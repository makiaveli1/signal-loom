/**
 * POST /api/openclaw/chat
 *
 * Body: { sessionKey: string; content: string; model?: string; history?: OpenClawMessage[] }
 * Returns: OpenClawMessage (the assistant response)
 *
 * For streaming responses, see the streamMessage() adapter function.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chatGateErrorPayload, probeHermesChatGate } from '@/lib/hermes-server-gate';
import { sendMessage } from '@/lib/openclaw/adapter';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const { sessionKey, content, model, history } = body as Record<string, unknown>;

  if (!sessionKey || typeof sessionKey !== 'string') {
    return NextResponse.json({ error: 'sessionKey is required' }, { status: 400 });
  }
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }
  if (content.length > 10000) {
    return NextResponse.json({ error: 'Message too long (max 10000 chars)' }, { status: 400 });
  }

  const connectionGate = await probeHermesChatGate();
  if (!connectionGate.allowed) {
    return NextResponse.json(
      chatGateErrorPayload(connectionGate),
      { status: connectionGate.httpStatus },
    );
  }

  const result = await sendMessage({
    sessionKey,
    content,
    model: typeof model === 'string' ? model : undefined,
    history: Array.isArray(history) ? history : [],
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, retryable: result.retryable },
      { status: 502 },
    );
  }

  return NextResponse.json(result.data, {
    headers: {
      'X-Adapter-Fetched-At': result.fetchedAt,
    },
  });
}
