import { NextRequest } from 'next/server';
import { loadSessionMessages } from '@/lib/openclaw/adapter';

/**
 * GET /api/openclaw/sessions/history?sessionKey=<key>&limit=<n>
 *
 * Server-side proxy for the sessions_history tool.
 * The sessions_history tool cannot be called directly from the browser due to CORS —
 * the OpenClaw gateway does not include Access-Control-Allow-Origin headers.
 * This route calls the gateway server-side and returns the result to the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionKey = searchParams.get('sessionKey');
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  if (!sessionKey) {
    return new Response(JSON.stringify({ error: 'sessionKey is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await loadSessionMessages(sessionKey, limit);

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
