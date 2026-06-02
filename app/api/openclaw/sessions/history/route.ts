import { NextRequest } from 'next/server.js';
import { resolveAgentIdentity } from '../../../../../lib/hermes/agent-identity-server.ts';
import { loadHermesMessages, unixToIso } from '../../../../../lib/hermes/state-db.ts';
import { runtimeContractHeaders, sanitizeRuntimeDetail } from '../../../../../lib/runtime-contract.ts';
import type { OpenClawMessage } from '../../../../../lib/openclaw/adapter/types.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function emptyHistoryPayload(error?: unknown, limit = 80) {
  return {
    ok: true,
    data: {
      messages: [],
      truncated: false,
      contentTruncated: false,
      droppedMessages: false,
      totalBytes: 0,
      degraded: true,
      error: sanitizeRuntimeDetail(error ?? 'Hermes session history unavailable'),
      requestedLimit: limit,
    },
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/openclaw/sessions/history?sessionKey=<key>&limit=<n>
 *
 * Compatibility route: returns Hermes session messages in the legacy
 * OpenClaw-shaped envelope used by the current UI.
 */
function normalizeMessageRole(role: string): OpenClawMessage['role'] {
  if (role === 'user' || role === 'system' || role === 'tool') return role;
  return 'assistant';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionKey = searchParams.get('sessionKey');
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  if (!sessionKey) {
    return new Response(JSON.stringify({ error: 'sessionKey is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const raw = await loadHermesMessages(sessionKey, limit);
    const identity = resolveAgentIdentity();
    const messages: OpenClawMessage[] = raw.map((m) => ({
      id: String(m.id),
      role: normalizeMessageRole(m.role),
      content: m.content,
      timestamp: unixToIso(m.timestamp) ?? new Date().toISOString(),
      agentId: m.role === 'assistant' ? identity.id : undefined,
    }));
    const totalBytes = messages.reduce((sum, m) => sum + m.content.length, 0);

    return new Response(JSON.stringify({
      ok: true,
      data: {
        messages,
        truncated: raw.length >= limit,
        contentTruncated: false,
        droppedMessages: false,
        totalBytes,
      },
      fetchedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return new Response(JSON.stringify(emptyHistoryPayload(error, limit)), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...runtimeContractHeaders('session-history', error),
      },
    });
  }
}
