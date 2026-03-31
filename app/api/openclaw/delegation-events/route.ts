/**
 * GET /api/openclaw/delegation-events
 *
 * Returns recent delegation events from the OpenClaw gateway session store.
 */

import { NextResponse } from 'next/server';
import { loadDelegationEvents } from '@/lib/openclaw/adapter';

export async function GET() {
  const result = await loadDelegationEvents();

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, retryable: result.retryable },
      { status: 502 },
    );
  }

  return NextResponse.json(result.data, {
    headers: {
      'Cache-Control': 'private, max-age=60',
      'X-Adapter-Fetched-At': result.fetchedAt ?? new Date().toISOString(),
    },
  });
}
