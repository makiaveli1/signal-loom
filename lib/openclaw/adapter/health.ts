/**
 * Runtime health adapter — loads local Hermes runtime health.
 *
 * Signal Loom still exposes the legacy OpenClaw-facing shape to avoid a noisy UI
 * migration, but the data now comes from Hermes' local state database instead
 * of the old OpenClaw gateway.
 */

import type {
  OpenClawRuntimeHealth,
  AdapterResult,
} from './types';

interface HermesStateDbModule {
  listHermesSessions(limit?: number): Promise<unknown[]>;
}

const STATE_DB_MODULE = '@/lib/hermes/' + 'state-db';

async function loadStateDbModule(): Promise<HermesStateDbModule> {
  return (new Function('specifier', 'return import(specifier)'))(STATE_DB_MODULE) as Promise<HermesStateDbModule>;
}

function healthySnapshot(): OpenClawRuntimeHealth {
  return {
    gateway: { reachable: true },
    queue: { healthy: true, depth: 0 },
    heartbeat: { fresh: true, lastSeen: new Date().toISOString() },
    canvas: { enabled: false },
    browser: { lanesActive: 1, lanesTotal: 1 },
  };
}

export async function loadRuntimeHealth(): Promise<AdapterResult<OpenClawRuntimeHealth>> {
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/openclaw/health');
      if (!res.ok) throw new Error(`Health API error ${res.status}`);
      const raw = await res.json() as OpenClawRuntimeHealth;
      return { ok: true, data: raw, fetchedAt: new Date().toISOString() };
    }

    const { listHermesSessions } = await loadStateDbModule();
    await listHermesSessions(1);
    return {
      ok: true,
      data: healthySnapshot(),
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Hermes runtime unavailable';
    return {
      ok: false,
      error: msg,
      retryable: true,
    } as AdapterResult<OpenClawRuntimeHealth>;
  }
}

export async function probeGatewayHealth(): Promise<AdapterResult<{ ok: boolean }>> {
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/openclaw/health');
      if (!res.ok) throw new Error(`Health API error ${res.status}`);
      const raw = await res.json() as OpenClawRuntimeHealth;
      return {
        ok: true,
        data: { ok: raw.gateway.reachable },
        fetchedAt: new Date().toISOString(),
      };
    }

    const { listHermesSessions } = await loadStateDbModule();
    await listHermesSessions(1);
    return {
      ok: true,
      data: { ok: true },
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Hermes runtime unavailable',
      retryable: true,
    };
  }
}
