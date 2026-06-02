/**
 * GET /api/openclaw/health
 *
 * Returns the OpenClaw runtime health snapshot.
 */

import { NextResponse } from 'next/server.js';
import { listHermesSessions } from '../../../../lib/hermes/state-db.ts';
import { runtimeContractHeaders, sanitizeRuntimeDetail } from '../../../../lib/runtime-contract.ts';

function healthySnapshot() {
  return {
    gateway: { reachable: true },
    queue: { healthy: true, depth: 0 },
    heartbeat: { fresh: true, lastSeen: new Date().toISOString() },
    canvas: { enabled: false },
    browser: { lanesActive: 1, lanesTotal: 1 },
  };
}

function degradedSnapshot(message: string) {
  return {
    gateway: { reachable: false, error: message },
    queue: { healthy: false, depth: 0 },
    heartbeat: { fresh: false, lastSeen: new Date().toISOString() },
    canvas: { enabled: false },
    browser: { lanesActive: 0, lanesTotal: 1 },
  };
}

export async function GET() {
  try {
    await listHermesSessions(1);
    return NextResponse.json(healthySnapshot(), {
      headers: {
        'Cache-Control': 'private, max-age=10',
        'X-Adapter-Fetched-At': new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = sanitizeRuntimeDetail(error);
    return NextResponse.json(degradedSnapshot(message), {
      headers: runtimeContractHeaders('health', message),
    });
  }
}
