/**
 * POST /api/openclaw/chat/stream
 *
 * Server-side streaming chat route.
 *
 * Architecture:
 * - Browser calls this route (no gateway token needed — it's server-side)
 * - This route attaches the gateway token server-side and proxies to /v1/chat/completions
 * - Streams SSE back to the browser
 *
 * Body: { sessionKey: string; content: string; model?: string; history?: OpenClawMessage[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { gatewayPost } from '@/lib/openclaw/adapter/client';

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

  // Server-side streaming to gateway — token is attached by gatewayPost/gatewayFetch
  // NEXT: wire sessionKey for proper session routing when gateway supports it
  const gatewayBody = {
    model: typeof model === 'string' && model ? model : 'openclaw/default',
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 4096,
  };

  let gatewayResponse: Response;
  try {
    // We need to use fetch directly here to handle the streaming response
    // gatewayPost doesn't support streaming responses
    const GATEWAY_URL = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? 'http://127.0.0.1:18789';
    const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? '';

    gatewayResponse = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
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

  // Stream SSE from gateway to browser
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = gatewayResponse.body!.getReader();

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const rawLine of lines) {
            const trimmed = rawLine.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const parsed: ChatCompletionDelta = JSON.parse(data);
                const chunk = parsed.choices?.[0]?.delta?.content ?? '';
                if (chunk) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
                }
                const finishReason = parsed.choices?.[0]?.finish_reason;
                if (finishReason) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, finishReason })}\n\n`));
                }
              } catch {
                // skip individual parse errors
              }
            }
          }
        }
        // Send final done
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e instanceof Error ? e.message : 'Stream interrupted' })}\n\n`));
      } finally {
        controller.close();
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
