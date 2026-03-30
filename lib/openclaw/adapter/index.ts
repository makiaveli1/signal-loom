/**
 * OpenClaw adapter — canonical bridge between Signal Loom and the OpenClaw runtime.
 *
 * Usage:
 *   import { loadSessions, sendMessage, loadRuntimeHealth } from '@/lib/openclaw/adapter';
 *
 * All functions return AdapterResult<T> — never throw to UI components.
 * Feature flag: NEXT_PUBLIC_USE_MOCK_DATA=true bypasses the real gateway.
 */

import type {
  OpenClawSession,
  OpenClawMessage,
  OpenClawAgent,
  OpenClawRuntimeHealth,
  OpenClawApproval,
  OpenClawDelegationEvent,
  AdapterResult,
} from './types';

import {
  probeGateway as probeGatewayReal,
  loadSessions as loadSessionsReal,
  loadSession as loadSessionReal,
} from './sessions';

import {
  sendMessage as sendMessageReal,
  streamMessage,
  type SendMessageParams,
} from './chat';

import {
  loadRuntimeHealth as loadRuntimeHealthReal,
} from './health';

import {
  MOCK_SESSIONS,
  MOCK_MESSAGES,
  MOCK_AGENTS,
  MOCK_HEALTH,
  MOCK_DELEGATION_EVENTS,
  MOCK_APPROVALS,
} from './mock-data';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

// ---------------------------------------------------------------------------
// Sessions / Threads
// ---------------------------------------------------------------------------

export async function loadSessions(): Promise<AdapterResult<OpenClawSession[]>> {
  if (USE_MOCK) {
    return {
      ok: true,
      data: MOCK_SESSIONS,
      fetchedAt: new Date().toISOString(),
    };
  }
  return loadSessionsReal();
}

export async function loadSession(sessionKey: string): Promise<AdapterResult<OpenClawSession>> {
  if (USE_MOCK) {
    const session = MOCK_SESSIONS.find((s) => s.id === sessionKey);
    if (!session) {
      return { ok: false, error: `Session not found: ${sessionKey}`, retryable: false };
    }
    return { ok: true, data: session, fetchedAt: new Date().toISOString() };
  }
  return loadSessionReal(sessionKey);
}

export async function loadSessionMessages(sessionKey: string): Promise<AdapterResult<OpenClawMessage[]>> {
  if (USE_MOCK) {
    const messages = MOCK_MESSAGES[sessionKey] ?? [];
    return { ok: true, data: messages, fetchedAt: new Date().toISOString() };
  }
  // TODO: implement real message loading from gateway
  return {
    ok: false,
    error: 'Message history not yet implemented for real gateway',
    retryable: false,
  };
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export async function sendMessage(params: SendMessageParams): Promise<AdapterResult<OpenClawMessage>> {
  if (USE_MOCK) {
    // Simulate a realistic response delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
    return {
      ok: true,
      data: {
        id: `mock-msg-${Date.now()}`,
        role: 'assistant',
        content: mockResponse(params.content),
        timestamp: new Date().toISOString(),
        agentId: 'nero',
      },
      fetchedAt: new Date().toISOString(),
    };
  }
  return sendMessageReal(params);
}

export { streamMessage };

function mockResponse(userContent: string): string {
  // Contextual mock responses for development
  const lower = userContent.toLowerCase();
  if (lower.includes('status') || lower.includes('health')) {
    return 'Gateway health is nominal. All systems operational. Active agents: Nero (1), Hephaestus (1), Orion (idle).';
  }
  if (lower.includes('session') || lower.includes('thread')) {
    return 'There are 4 active sessions. The most recent is the Signal Loom Sprint 3 build session, active 8 minutes ago.';
  }
  if (lower.includes('help') || lower.includes('what')) {
    return 'Signal Loom is connected to the real OpenClaw runtime. You can ask me about sessions, agent status, approvals, or delegation events.';
  }
  return `Understood. I received your message. Signal Loom Sprint 3 integration is proceeding — real sessions and messages are now flowing through the OpenClaw adapter layer.`;
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export async function loadAgents(): Promise<AdapterResult<OpenClawAgent[]>> {
  if (USE_MOCK) {
    return { ok: true, data: MOCK_AGENTS, fetchedAt: new Date().toISOString() };
  }
  // TODO: implement real agent status loading from gateway
  return {
    ok: false,
    error: 'Agent status loading not yet implemented for real gateway',
    retryable: false,
  };
}

// ---------------------------------------------------------------------------
// Runtime health
// ---------------------------------------------------------------------------

export async function loadRuntimeHealth(): Promise<AdapterResult<OpenClawRuntimeHealth>> {
  if (USE_MOCK) {
    return { ok: true, data: MOCK_HEALTH, fetchedAt: new Date().toISOString() };
  }
  return loadRuntimeHealthReal();
}

export async function probeGateway(): Promise<AdapterResult<{ ok: boolean }>> {
  if (USE_MOCK) {
    return { ok: true, data: { ok: true }, fetchedAt: new Date().toISOString() };
  }
  return probeGatewayReal();
}

// ---------------------------------------------------------------------------
// Delegation events
// ---------------------------------------------------------------------------

export async function loadDelegationEvents(): Promise<AdapterResult<OpenClawDelegationEvent[]>> {
  if (USE_MOCK) {
    return { ok: true, data: MOCK_DELEGATION_EVENTS, fetchedAt: new Date().toISOString() };
  }
  // TODO: implement real delegation event loading from gateway session history
  return {
    ok: false,
    error: 'Delegation events not yet implemented for real gateway',
    retryable: false,
  };
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export async function loadApprovals(): Promise<AdapterResult<OpenClawApproval[]>> {
  if (USE_MOCK) {
    return { ok: true, data: MOCK_APPROVALS, fetchedAt: new Date().toISOString() };
  }
  // TODO: implement real approval loading from gateway
  return {
    ok: false,
    error: 'Approvals not yet implemented for real gateway',
    retryable: false,
  };
}

export async function resolveApproval(
  approvalId: string,
  decision: 'approve' | 'deny',
): Promise<AdapterResult<{ done: boolean }>> {
  if (USE_MOCK) {
    console.log(`[mock] resolveApproval ${approvalId} → ${decision}`);
    return { ok: true, data: { done: true }, fetchedAt: new Date().toISOString() };
  }
  // TODO: implement real approval resolution via gateway exec.approval.resolve
  return {
    ok: false,
    error: 'Approval resolution not yet wired to real gateway',
    retryable: false,
  };
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type { SendMessageParams } from './chat';
