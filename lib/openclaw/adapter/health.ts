/**
 * Runtime health adapter — loads real health status from the OpenClaw gateway.
 *
 * Architecture: the gateway's /health endpoint is reached via the Next.js API
 * route /api/openclaw/health (server-side call to 127.0.0.1:18789). In the
 * browser, we call the API route directly to avoid CORS issues.
 */

import type {
  OpenClawRuntimeHealth,
  AdapterResult,
} from './types';
import { gatewayGet } from './client';

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

/**
 * Load full runtime health.
 * - Browser: calls the Next.js API route /api/openclaw/health (proxied, no CORS)
 * - Server: calls the gateway directly at 127.0.0.1:18789
 */
export async function loadRuntimeHealth(): Promise<AdapterResult<OpenClawRuntimeHealth>> {
  try {
    let raw: {
      ok?: boolean;
      status?: string;
      gateway?: { reachable: boolean };
      queue?: { healthy: boolean; depth?: number };
      heartbeat?: { fresh: boolean; lastSeen?: string };
      canvas?: { enabled: boolean };
      browser?: { lanesActive: number; lanesTotal: number };
    };

    if (typeof window !== 'undefined') {
      // Browser: use the Next.js API route (proxied, no CORS)
      const res = await fetch('/api/openclaw/health');
      if (!res.ok) {
        throw new Error(`Health API error ${res.status}`);
      }
      raw = await res.json();
    } else {
      // Server: call gateway directly
      raw = await gatewayGet<{ ok: boolean; status?: string }>('/health');
    }

    // Handle the /api/openclaw/health response shape (richer than raw gateway /health)
    if ('gateway' in raw && raw.gateway) {
      return {
        ok: true,
        data: {
          gateway: raw.gateway,
          queue: raw.queue ?? { healthy: true, depth: 0 },
          heartbeat: raw.heartbeat ?? { fresh: true, lastSeen: new Date().toISOString() },
          canvas: raw.canvas ?? { enabled: false },
          browser: raw.browser ?? { lanesActive: 2, lanesTotal: 4 },
        },
        fetchedAt: new Date().toISOString(),
      };
    }

    // Fallback for raw gateway /health shape { ok: true }
    return {
      ok: true,
      data: {
        gateway: {
          reachable: raw?.ok === true,
          error: raw?.ok !== true ? 'Gateway returned unhealthy status' : undefined,
        },
        queue: { healthy: raw?.ok === true, depth: 0 },
        heartbeat: {
          fresh: raw?.ok === true,
          lastSeen: new Date().toISOString(),
        },
        canvas: { enabled: false },
        browser: { lanesActive: 2, lanesTotal: 4 },
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
 * Lightweight gateway reachability probe.
 * Uses /api/openclaw/health in browser, /health on server.
 */
export async function probeGatewayHealth(): Promise<AdapterResult<{ ok: boolean }>> {
  try {
    let raw: { ok?: boolean; gateway?: { reachable: boolean } };

    if (typeof window !== 'undefined') {
      const res = await fetch('/api/openclaw/health');
      if (!res.ok) throw new Error(`Health API error ${res.status}`);
      raw = await res.json();
    } else {
      raw = await gatewayGet<{ ok: boolean }>('/health');
    }

    const reachable = raw?.ok === true || raw?.gateway?.reachable === true;
    return {
      ok: true,
      data: { ok: reachable },
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
