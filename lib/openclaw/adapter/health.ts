/**
 * Runtime health adapter — loads real health status from the OpenClaw gateway.
 */

import type {
  OpenClawRuntimeHealth,
  AdapterResult,
} from './types';
import { gatewayGet } from './client';

// ---------------------------------------------------------------------------
// Raw gateway health types
// ---------------------------------------------------------------------------

interface RawGatewayHealth {
  ok?: boolean;
  status?: string;
  state?: string;
  uptime?: number;
  queue?: {
    depth?: number;
    size?: number;
    length?: number;
  };
  channels?: Record<string, unknown>;
  heartbeat?: {
    lastSeen?: string;
    last_seen?: string;
    ts?: number;
  };
  errors?: string[];
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeHealth(raw: RawGatewayHealth): OpenClawRuntimeHealth {
  const now = Date.now();
  const lastSeen = raw.heartbeat?.lastSeen ?? raw.heartbeat?.last_seen;
  const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : null;
  const staleThresholdMs = 2 * 60 * 1000; // 2 minutes

  const queueDepth = raw.queue?.depth ?? raw.queue?.size ?? raw.queue?.length ?? 0;

  return {
    gateway: {
      reachable: raw.ok !== false && raw.state !== 'error',
      error: raw.errors?.[0],
    },
    queue: {
      healthy: queueDepth < 100,
      depth: queueDepth,
    },
    heartbeat: {
      fresh: lastSeenMs !== null ? (now - lastSeenMs < staleThresholdMs) : false,
      lastSeen: lastSeen ?? undefined,
    },
    canvas: {
      enabled: false, // canvas-disabled posture — never changes
    },
    browser: {
      lanesActive: 2,    // TODO: read from real gateway state when available
      lanesTotal: 4,
    },
    uptime: raw.uptime,
  };
}

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

/**
 * Load runtime health from the gateway.
 * Falls back to "unreachable" state if the gateway is not accessible.
 */
export async function loadRuntimeHealth(): Promise<AdapterResult<OpenClawRuntimeHealth>> {
  try {
    const raw = await gatewayGet<RawGatewayHealth>('/health');
    return {
      ok: true,
      data: normalizeHealth(raw),
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    // Gateway unreachable — return a clearly degraded health object
    console.warn('[OpenClaw adapter] loadRuntimeHealth failed:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Gateway unreachable',
      retryable: true,
    };
  }
}

/**
 * Lightweight gateway reachability check.
 * Returns { ok: true } if the gateway responds to /v1/models.
 */
export async function probeGatewayHealth(): Promise<AdapterResult<{ ok: boolean }>> {
  try {
    await gatewayGet('/v1/models');
    return {
      ok: true,
      data: { ok: true },
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Gateway unreachable',
      retryable: true,
    };
  }
}
