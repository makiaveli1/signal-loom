/**
 * POST /api/openclaw/chat/stream
 *
 * Server-side streaming chat route for Hermes.
 *
 * Architecture:
 * - Browser calls this route (no gateway token needed — it's server-side)
 * - This route attaches the Hermes API key server-side and proxies to /v1/chat/completions
 * - Streams SSE back to the browser
 *
 * Body: { sessionKey: string; content: string; model?: string; history?: OpenClawMessage[] }
 */

import { NextRequest, NextResponse } from 'next/server';


interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

interface ChatCompletionDelta {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string;
    index?: number;
  }>;
}

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

  const messages: ChatMessage[] = [
    ...(Array.isArray(history) ? history : []).map((m: Record<string, unknown>) => ({
      role: (m.role === 'action-summary' ? 'assistant' : m.role) as ChatMessage['role'],
      content: String(m.content ?? ''),
      name: String(m.name ?? ''),
    })),
    { role: 'user' as const, content },
  ];

  // Server-side streaming to Hermes.
  // sessionKey becomes X-Hermes-Session-Id so the API server can continue the same UI thread.
  const gatewayBody = {
    model: typeof model === 'string' && model ? model : 'hermes-agent',
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 4096,
  };

  let gatewayResponse: Response;
  try {
    // We need to use fetch directly here to handle the streaming response.
    const GATEWAY_URL = process.env.NEXT_PUBLIC_HERMES_API_URL
      ?? process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL
      ?? 'http://127.0.0.1:8642';
    const GATEWAY_TOKEN = process.env.HERMES_API_KEY
      ?? process.env.API_SERVER_KEY
      ?? process.env.OPENCLAW_GATEWAY_TOKEN
      ?? '';

    gatewayResponse = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        ...(GATEWAY_TOKEN ? { 'Authorization': `Bearer ${GATEWAY_TOKEN}` } : {}),
        'X-Hermes-Session-Id': sessionKey,
        ...(GATEWAY_TOKEN ? { 'X-Hermes-Session-Key': `signal-loom:${sessionKey}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gatewayBody),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to reach gateway' },
      { status: 502 }
    );
  }

  if (!gatewayResponse.ok) {
    const text = await gatewayResponse.text();
    const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return NextResponse.json(
      { error: clean || `Gateway error ${gatewayResponse.status}` },
      { status: 502 }
    );
  }

  if (!gatewayResponse.body) {
    return NextResponse.json({ error: 'Gateway returned empty response' }, { status: 502 });
  }

  // Stream SSE from gateway to browser with normalized frames and heartbeats.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = gatewayResponse.body!.getReader();
      let closed = false;
      const send = (payload: Record<string, unknown>) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      const heartbeat = setInterval(() => send({ type: 'heartbeat', at: new Date().toISOString() }), 12_000);

      send({ type: 'open', at: new Date().toISOString() });

      const processPacket = (packet: string) => {
        const dataLines = packet
          .split('\n')
          .map((line) => line.trimEnd())
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart());

        if (dataLines.length === 0) return;
        const data = dataLines.join('\n').trim();
        if (!data || data === '[DONE]') {
          send({ done: true, at: new Date().toISOString() });
          close();
          return;
        }

        try {
          const parsed: ChatCompletionDelta = JSON.parse(data);
          const chunk = parsed.choices?.[0]?.delta?.content ?? '';
          if (chunk) {
            send({ chunk, at: new Date().toISOString() });
          }
          const finishReason = parsed.choices?.[0]?.finish_reason;
          if (finishReason) {
            send({ done: true, finishReason, at: new Date().toISOString() });
            close();
          }
        } catch {
          // skip individual parse errors; the next packet may still be valid
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const packet = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            processPacket(packet);
            if (closed) return;
            boundary = buffer.indexOf('\n\n');
          }
        }
        if (buffer.trim()) processPacket(buffer);
        if (!closed) send({ done: true, at: new Date().toISOString() });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : 'Stream interrupted', at: new Date().toISOString() });
      } finally {
        clearInterval(heartbeat);
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
