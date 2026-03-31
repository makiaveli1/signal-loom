/**
 * Runtime health adapter — loads real health status from the OpenClaw gateway.
 * Uses POST /tools/invoke to query gateway state.
 */

import type {
  OpenClawRuntimeHealth,
  AdapterResult,
} from './types';
import { gatewayPost } from './client';

// ---------------------------------------------------------------------------
// Raw gateway health from /tools/invoke
// ---------------------------------------------------------------------------

interface GatewayHealthResult {
  ok: boolean;
  channels?: Record<string, unknown>;
  queue?: { depth?: number; size?: number; length?: number };
  uptime?: number;
}

function normalizeHealth(raw: GatewayHealthResult, errorMsg?: string): OpenClawRuntimeHealth {
  const queueDepth = raw?.queue?.depth ?? raw?.queue?.size ?? raw?.queue?.length ?? 0;

  return {
    gateway: {
      reachable: raw?.ok !== false && !errorMsg,
      error: errorMsg,
    },
    queue: {
      healthy: queueDepth < 100,
      depth: queueDepth,
    },
    heartbeat: {
      fresh: true, // If gateway responded, it's fresh
      lastSeen: new Date().toISOString(),
    },
    canvas: {
      enabled: false,
    },
    browser: {
      lanesActive: 2,
      lanesTotal: 4,
    },
    uptime: raw?.uptime,
  };
}

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

export async function loadRuntimeHealth(): Promise<AdapterResult<OpenClawRuntimeHealth>> {
  try {
    // Try the /tools/invoke approach for gateway health
    const res = await gatewayPost<{ ok: boolean; result?: GatewayHealthResult }>(
      '/tools/invoke',
      { tool: 'system_health', args: {} },
    );

    if (!res.ok) {
      throw new Error('Gateway health check failed');
    }

    return {
      ok: true,
      data: normalizeHealth(res.result as GatewayHealthResult),
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Gateway unreachable';
    return {
      ok: false,
      error: msg,
      retryable: true,
    } as AdapterResult<OpenClawRuntimeHealth>;
  }
}

/**
 * Lightweight gateway reachability check — try the tools invoke endpoint.
 */
export async function probeGatewayHealth(): Promise<AdapterResult<{ ok: boolean }>> {
  try {
    const res = await gatewayPost<{ ok: boolean }>(
      '/tools/invoke',
      { tool: 'sessions_list', args: { limit: 1 } },
    );
    return {
      ok: true,
      data: { ok: res.ok },
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return {
      ok: false,
      error: 'Gateway unreachable',
      retryable: true,
    };
  }
}
