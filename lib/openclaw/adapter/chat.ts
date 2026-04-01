/**
 * Chat adapter — sends messages to agents via the OpenClaw gateway.
 *
 * Uses the OpenAI-compatible /v1/chat/completions endpoint.
 * The gateway translates these to the internal agent chat protocol.
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

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
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
    model = 'openclaw/default',
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
    console.error('[OpenClaw adapter] sendMessage failed:', e);
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

/**
 * Stream a message to an agent via the server-side streaming route.
 *
 * Architecture:
 * - Browser calls POST /api/openclaw/chat/stream (no token — server-side)
 * - Server route attaches token and proxies to gateway /v1/chat/completions
 * - Server streams SSE back to browser
 *
 * Token is NEVER exposed to the browser.
 *
 * Usage:
 *   const stream = streamMessage({ sessionKey, content, model, history });
 *   const reader = stream.getReader();
 *   for (;;) { const { done, value } = await reader.read(); if (done) break; appendChunk(value); }
 */
export function streamMessage(params: SendMessageParams): ReadableStream<string> {
  const { content, model = 'openclaw/default', history = [], sessionKey } = params;

  const messages: ChatMessage[] = [
    ...history.map((m) => ({
      role: (m.role === 'action-summary' ? 'assistant' : m.role) as ChatMessage['role'],
      content: m.content,
      name: m.agentId,
    })),
    { role: 'user' as const, content },
  ];

  const body = JSON.stringify({ sessionKey, content, model, messages });

  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch('/api/openclaw/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

        if (!response.ok || !response.body) {
          const text = await response.text();
          let error = `HTTP ${response.status}`;
          try {
            const parsed = JSON.parse(text);
            if (parsed.error) error = parsed.error;
          } catch {
            // use HTTP status
          }
          controller.enqueue(`[error] ${error}`);
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          // SSE format: lines starting with "data: "
          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6).trim();
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                controller.enqueue(`[error] ${parsed.error}`);
                controller.close();
                return;
              }
              if (parsed.done) {
                controller.close();
                return;
              }
              if (parsed.chunk) {
                controller.enqueue(parsed.chunk);
              }
            } catch {
              // skip malformed SSE data
            }
          }
        }
      } catch (e) {
        controller.enqueue(`[error] ${e instanceof Error ? e.message : 'Stream failed'}`);
      } finally {
        controller.close();
      }
    },
  });
}
