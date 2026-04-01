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

// Streaming: add POST /api/openclaw/chat/stream and wire streamMessage to it
// when the UI needs streaming support. Not wired yet — see route.ts comment.
