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

/**
 * Stream a message to an agent — returns SSE text chunks as a ReadableStream.
 *
 * Usage:
 *   const stream = streamMessage({ sessionKey, content });
 *   const reader = stream.getReader();
 *   for (;;) { const { done, value } = await reader.read(); if (done) break; appendChunk(value); }
 */
export function streamMessage(params: SendMessageParams): ReadableStream<string> {
  const { content, model = 'openclaw/default' } = params;

  const body: ChatCompletionRequest = {
    model,
    messages: [{ role: 'user', content }],
    stream: true,
    temperature: 0.7,
    max_tokens: 4096,
  };

  const GATEWAY_URL = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? 'http://127.0.0.1:18789';
  const GATEWAY_TOKEN = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN ?? '';

  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GATEWAY_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok || !response.body) {
          const text = await response.text();
          controller.enqueue(`[error] ${response.status}: ${text}`);
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const chunk = parsed.choices?.[0]?.delta?.content ?? '';
                if (chunk) controller.enqueue(chunk);
              } catch {
                // ignore individual parse errors
              }
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
