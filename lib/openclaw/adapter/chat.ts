/**
 * Chat adapter — sends messages to Nero via the Hermes API server.
 *
 * Uses the OpenAI-compatible /v1/chat/completions endpoint.
 * Hermes translates these to the internal agent chat protocol.
 */

import type { OpenClawMessage, AdapterResult } from './types';
import { gatewayPost } from './client';

// ---------------------------------------------------------------------------
// OpenAI-compatible chat completion types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

interface ChatCompletionChoice {
  message: ChatMessage;
  finish_reason: string;
  index: number;
}

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatCompletionChoice[];
}

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

export interface SendMessageParams {
  sessionKey: string;
  content: string;
  model?: string;
  history?: OpenClawMessage[];
}

/**
 * Send a message to an agent and return the response (non-streaming).
 */
export async function sendMessage(
  params: SendMessageParams,
): Promise<AdapterResult<OpenClawMessage>> {
  const {
    sessionKey,
    content,
    model = 'hermes-agent',
    history = [],
  } = params;

  // sessionKey is passed for context; the gateway may use it to route to the right session.
  // The /v1/chat/completions endpoint uses the conversation history.
  const messages: ChatMessage[] = [
    ...history.map((m) => ({
      role: (m.role === 'action-summary' ? 'assistant' : m.role) as ChatMessage['role'],
      content: m.content,
      name: m.agentId,
    })),
    { role: 'user' as const, content },
  ];

  try {
    const response = await gatewayPost<ChatCompletionResponse>(
      '/v1/chat/completions',
      { model, messages, temperature: 0.7, max_tokens: 4096 },
      { headers: { 'X-Hermes-Session-Id': sessionKey } },
    );

    const choice = response.choices?.[0];
    if (!choice) {
      return { ok: false, error: 'No response from agent', retryable: true };
    }

    return {
      ok: true,
      data: {
        id: response.id ?? `msg-${Date.now()}`,
        role: 'assistant',
        content: choice.message.content ?? '',
        timestamp: new Date().toISOString(),
        agentId: model.split('/').pop() ?? 'nero',
      },
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('[Hermes adapter] sendMessage failed:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to send message',
      retryable: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Streaming — browser-safe via local server route
// ---------------------------------------------------------------------------

export type StreamMessageEvent =
  | { type: 'open'; at: string }
  | { type: 'chunk'; chunk: string; at: string; index?: number }
  | { type: 'heartbeat'; at: string }
  | { type: 'done'; at: string; finishReason?: string }
  | { type: 'error'; error: string; at: string };

/**
 * Stream a message to an agent via the server-side streaming route.
 *
 * Architecture:
 * - Browser calls POST /api/openclaw/chat/stream (no token — server-side)
 * - Server route attaches token and proxies to Hermes /v1/chat/completions
 * - Server streams normalized SSE events back to browser
 *
 * Token is NEVER exposed to the browser.
 */
export function streamMessage(
  params: SendMessageParams,
  options: { signal?: AbortSignal } = {},
): ReadableStream<StreamMessageEvent> {
  const { content, model = 'hermes-agent', history = [], sessionKey } = params;

  const messages: ChatMessage[] = [
    ...history.map((m) => ({
      role: (m.role === 'action-summary' ? 'assistant' : m.role) as ChatMessage['role'],
      content: m.content,
      name: m.agentId,
    })),
    { role: 'user' as const, content },
  ];

  const body = JSON.stringify({ sessionKey, content, model, history: messages });

  return new ReadableStream<StreamMessageEvent>({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      const emit = (event: StreamMessageEvent) => {
        if (!closed) controller.enqueue(event);
      };

      try {
        const response = await fetch('/api/openclaw/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: options.signal,
        });

        if (!response.ok || !response.body) {
          const text = await response.text();
          let error = `HTTP ${response.status}`;
          try {
            const parsed = JSON.parse(text);
            if (parsed.error) error = parsed.error;
          } catch {
            const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (clean) error = clean.slice(0, 240);
          }
          emit({ type: 'error', error, at: new Date().toISOString() });
          safeClose();
          return;
        }

        emit({ type: 'open', at: new Date().toISOString() });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventId = 0;

        const processPacket = (packet: string) => {
          const dataLines = packet
            .split('\n')
            .map((line) => line.trimEnd())
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart());

          if (dataLines.length === 0) return;
          const data = dataLines.join('\n').trim();
          if (!data || data === '[DONE]') {
            emit({ type: 'done', at: new Date().toISOString() });
            safeClose();
            return;
          }

          try {
            const parsed = JSON.parse(data) as Partial<StreamMessageEvent> & { chunk?: string; done?: boolean; finishReason?: string; error?: string };
            if (parsed.error) {
              emit({ type: 'error', error: parsed.error, at: new Date().toISOString() });
              safeClose();
              return;
            }
            if (parsed.done || parsed.type === 'done') {
              emit({ type: 'done', at: new Date().toISOString(), finishReason: parsed.finishReason });
              safeClose();
              return;
            }
            if (parsed.type === 'heartbeat') {
              emit({ type: 'heartbeat', at: new Date().toISOString() });
              return;
            }
            if (parsed.chunk) {
              eventId += 1;
              emit({ type: 'chunk', chunk: parsed.chunk, at: new Date().toISOString(), index: eventId });
            }
          } catch {
            // A malformed packet should not kill the stream; keep buffering future packets.
          }
        };

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
        if (!closed) emit({ type: 'done', at: new Date().toISOString() });
      } catch (e) {
        if (options.signal?.aborted) {
          emit({ type: 'error', error: 'Stream cancelled by operator', at: new Date().toISOString() });
        } else {
          emit({ type: 'error', error: e instanceof Error ? e.message : 'Stream failed', at: new Date().toISOString() });
        }
      } finally {
        safeClose();
      }
    },
    cancel() {
      // The caller owns AbortController cancellation; this hook exists so the
      // browser releases the stream quickly if the UI tears down mid-response.
    },
  });
}
