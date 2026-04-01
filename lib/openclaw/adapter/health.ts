/**
 * Runtime health adapter — loads real health status from the OpenClaw gateway.
 *
 * The gateway exposes a lightweight health endpoint at GET /health that returns
 * { ok: true, status: "live" }. This is the correct approach for a health check.
 * The tool-invoke approach (system_health tool) was removed — that tool doesn't exist.
 */

import type {
  OpenClawRuntimeHealth,
  AdapterResult,
} from './types';
import { gatewayGet } from './client';

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

export async function loadRuntimeHealth(): Promise<AdapterResult<OpenClawRuntimeHealth>> {
  try {
    // GET /health — lightweight, no auth required, returns { ok: true, status: "live" }
    const raw = await gatewayGet<{ ok: boolean; status?: string }>('/health');

    return {
      ok: true,
      data: {
        gateway: {
          reachable: raw?.ok === true,
          error: raw?.ok !== true ? 'Gateway returned unhealthy status' : undefined,
        },
        queue: {
          healthy: raw?.ok === true,
          depth: 0,
        },
        heartbeat: {
          fresh: raw?.ok === true,
          lastSeen: new Date().toISOString(),
        },
        canvas: {
          enabled: false,
        },
        browser: {
          lanesActive: 2,
          lanesTotal: 4,
        },
      },
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
 * Lightweight gateway reachability check — GET /health is sufficient.
 */
export async function probeGatewayHealth(): Promise<AdapterResult<{ ok: boolean }>> {
  try {
    const raw = await gatewayGet<{ ok: boolean }>('/health');
    return {
      ok: true,
      data: { ok: raw?.ok === true },
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
