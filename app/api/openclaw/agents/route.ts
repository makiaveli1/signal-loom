/**
 * GET /api/openclaw/agents
 *
 * Returns live agent status from the OpenClaw gateway session store.
 */

import { NextResponse } from 'next/server';
import { loadAgents } from '@/lib/openclaw/adapter';

export async function GET() {
  const result = await loadAgents();

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, retryable: result.retryable },
      { status: 502 },
    );
  }

  return NextResponse.json(result.data, {
    headers: {
      'Cache-Control': 'private, max-age=30',
      'X-Adapter-Fetched-At': result.fetchedAt ?? new Date().toISOString(),
    },
  });
}
