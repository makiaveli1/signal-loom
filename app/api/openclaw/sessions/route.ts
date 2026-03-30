/**
 * GET /api/openclaw/sessions
 *
 * Returns all sessions from the OpenClaw adapter.
 * The adapter handles normalization and mock fallback internally.
 */

import { NextResponse } from 'next/server';
import { loadSessions } from '@/lib/openclaw/adapter';

export async function GET() {
  const result = await loadSessions();

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, retryable: result.retryable },
      { status: 502 },
    );
  }

  return NextResponse.json(result.data, {
    headers: {
      'Cache-Control': 'private, max-age=30',
      'X-Adapter-Fetched-At': result.fetchedAt,
    },
  });
}
