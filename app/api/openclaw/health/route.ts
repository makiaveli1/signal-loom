/**
 * GET /api/openclaw/health
 *
 * Returns the OpenClaw runtime health snapshot.
 */

import { NextResponse } from 'next/server';
import { loadRuntimeHealth } from '@/lib/openclaw/adapter';

export async function GET() {
  const result = await loadRuntimeHealth();

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        retryable: result.retryable,
        data: {
          gateway: { reachable: false, error: result.error },
          queue: { healthy: false },
          heartbeat: { fresh: false },
          canvas: { enabled: false },
          browser: { lanesActive: 0, lanesTotal: 4 },
        },
      },
      { status: 502 },
    );
  }

  return NextResponse.json(result.data, {
    headers: {
      'Cache-Control': 'private, max-age=10',
      'X-Adapter-Fetched-At': result.fetchedAt,
    },
  });
}
