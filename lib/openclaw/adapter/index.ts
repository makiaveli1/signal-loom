/**
 * Hermes adapter — legacy OpenClaw-shaped facade over Nero/Hermes runtime data.
 *
 * The UI still imports OpenClaw-shaped types/routes while we migrate the product.
 * This adapter keeps that surface stable but sources sessions, health, and chat
 * from Hermes instead of the old OpenClaw gateway.
 *
 * Architecture:
 * - Browser → Next.js API routes (/api/openclaw/* during migration) → adapter
 * - Server-side session/history reads use ~/.hermes/state.db
 * - Chat calls use Hermes' OpenAI-compatible API server at 127.0.0.1:8642
 */

export type { OpenClawSession, OpenClawAgent, OpenClawRuntimeHealth } from './types';
import type { OpenClawSession } from './types';

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

async function withMock<T>(mock: T, real: () => Promise<T>): Promise<T> {
  if (USE_MOCK) return mock;
  return real();
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

// Server implementation lives in ./sessions. Do not statically import it here:
// this facade is imported by client components, and ./sessions pulls server-only
// Hermes state-db code when invoked from API routes.

export async function loadSessionsReal(): Promise<AdapterResult<OpenClawSession[]>> {
  const sessions = await import('./sessions');
  return sessions.loadSessionsReal();
}

export async function loadSessions(): Promise<AdapterResult<OpenClawSession[]>> {
  // On the client (browser), call the Next.js API route to avoid CORS.
  // On the server, call loadSessionsReal directly (has access to gateway token).
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/openclaw/sessions');
      if (!res.ok) {
        return { ok: false, error: `API error ${res.status}`, retryable: true };
      }
      const data = await res.json() as OpenClawSession[];
      return { ok: true, data, fetchedAt: new Date().toISOString() };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Failed to load sessions',
        retryable: true,
      };
    }
  }

  return withMock(
    {
      ok: true,
      data: [] as OpenClawSession[],
      fetchedAt: new Date().toISOString(),
    },
    loadSessionsReal,
  );
}

// ---------------------------------------------------------------------------
// Runtime health
// ---------------------------------------------------------------------------

export { loadRuntimeHealth } from './health';

// ---------------------------------------------------------------------------
// Agents — live agent status from the gateway session store
// ---------------------------------------------------------------------------

import type { OpenClawAgent, OpenClawMessage, AdapterResult } from './types';

const MOCK_AGENTS: OpenClawAgent[] = [
  {
    id: 'nero',
    name: 'Nero',
    status: 'active',
    accentColor: '#CC5500',
    currentTask: 'Signal Loom Sprint 3 — DE outbound send lifecycle',
    role: 'orchestration',
  },
  {
    id: 'hermes',
    name: 'Hermès',
    status: 'active',
    accentColor: '#E8A83C',
    currentTask: 'Preparing outbound emails for review',
    role: 'commercial',
  },
  {
    id: 'hephaestus',
    name: 'Hephaestus',
    status: 'idle',
    accentColor: '#D44D2C',
    currentTask: 'Waiting for next task',
    role: 'execution',
  },
  {
    id: 'orion',
    name: 'Orion',
    status: 'idle',
    accentColor: '#4A9EFF',
    currentTask: 'Waiting for next task',
    role: 'research',
  },
  {
    id: 'ariadne',
    name: 'Ariadne',
    status: 'idle',
    accentColor: '#CC44CC',
    currentTask: 'Waiting for next task',
    role: 'design',
  },
  {
    id: 'argus',
    name: 'Argus',
    status: 'idle',
    accentColor: '#44BB44',
    currentTask: 'Waiting for next task',
    role: 'review',
  },
];

export async function loadAgents(): Promise<AdapterResult<OpenClawAgent[]>> {
  if (USE_MOCK) {
    return { ok: true, data: MOCK_AGENTS, fetchedAt: new Date().toISOString() };
  }

  // Real agent status is derived from session data in the store, not here.
  // The store's loadSessions() loads real sessions and derives agent statuses
  // from them — that is the authoritative source for live agent data.
  return { ok: true, data: [], fetchedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Approvals — real or honestly derived approval candidates
// ---------------------------------------------------------------------------

import type { Approval } from '@/lib/types';
import { mockApprovals } from '@/lib/mock/data';

export type { Approval };

/**
 * Load approvals from the gateway or derive them from real session data.
 *
 * The gateway doesn't surface a dedicated "list approvals" endpoint —
 * approval requests are session-bound (requireApproval hook).
 *
 * We derive approval candidates from:
 * 1. Recent delegation events where an agent returned a result to Nero
 * 2. Sessions that ended recently with task-completion language
 * 3. Items that look like they need a human decision
 *
 * Items are labeled as:
 * - source: 'gateway' — came from a real approval request in the gateway
 * - source: 'derived' — inferred from delegation events and session data
 * - source: 'mock' — used when no real data is available
 */
export async function loadApprovals(): Promise<AdapterResult<Approval[]>> {
  if (USE_MOCK) {
    // In dev mode, show mock approvals honestly labeled as mock
    return {
      ok: true,
      data: mockApprovals.map((a) => ({ ...a, source: 'mock' as const })),
      fetchedAt: new Date().toISOString(),
    };
  }

  try {
    // Load sessions to derive approval candidates
    // Use loadSessions() — it routes through /api/openclaw/sessions from the browser
    // (avoids CORS when calling gateway directly from browser)
    const sessionsResult = await loadSessions();

    if (!sessionsResult.ok || !sessionsResult.data) {
      return { ok: false, error: 'Could not load sessions', retryable: true };
    }

    // Derive approval candidates from recent sessions
    const derived: Approval[] = [];
    const now = Date.now();
    const RECENT_MS = 2 * 60 * 60 * 1000; // 2 hours

    for (const session of sessionsResult.data) {
      if (!session.lastMessageAt) continue;
      const age = now - new Date(session.lastMessageAt).getTime();
      if (age > RECENT_MS) continue;

      const title = session.title ?? `Session: ${session.shortId}`;
      const agentName = session.agentName ?? session.agentId;

      // Detect tasks that look like they need approval
      // - Hephaestus returning a result
      // - Orion returning a research report
      // - Any agent flagging something for review
      const isDelegateReturn = title.toLowerCase().includes('return') ||
        title.toLowerCase().includes('complete') ||
        title.toLowerCase().includes('done') ||
        session.preview?.toLowerCase().includes('ready for review') ||
        session.preview?.toLowerCase().includes('needs approval') ||
        session.preview?.toLowerCase().includes('approve');

      if (isDelegateReturn || agentName !== 'Nero') {
        // Derive urgency from agent + how recent
        const urgency: Approval['urgency'] =
          agentName === 'Hephaestus' || agentName === 'Argus'
            ? 'high'
            : age < 30 * 60 * 1000
              ? 'medium'
              : 'low';

        derived.push({
          id: `derived-${session.shortId}`,
          title,
          urgency,
          raisedBy: agentName,
          recommendation:
            session.preview?.slice(0, 150) ??
            `Review ${agentName}'s output before proceeding.`,
          linkedThreadId: session.id,
          status: 'pending',
          source: 'derived',
          raisedAt: session.lastMessageAt,
        });
      }
    }

    // Sort by urgency then recency
    const order = { high: 0, medium: 1, low: 2 };
    derived.sort((a, b) => {
      const u = order[a.urgency] - order[b.urgency];
      if (u !== 0) return u;
      const ta = a.raisedAt ? new Date(a.raisedAt).getTime() : 0;
      const tb = b.raisedAt ? new Date(b.raisedAt).getTime() : 0;
      return tb - ta;
    });

    return {
      ok: true,
      data: derived,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Approval loading failed',
      retryable: true,
    };
  }
}

/**
 * Resolve an approval decision.
 *
 * Hermes does not expose OpenClaw's legacy /tools/invoke approval endpoint.
 * Browser callers go through a Next.js route; server callers lazily import the
 * Node-only audit logger. Either way, the UI is honest: resolved locally,
 * not synced to a nonexistent OpenClaw gateway tool.
 */
export async function resolveApproval(args: {
  approvalId: string;
  decision: 'approved' | 'denied' | 'revised';
  note?: string;
}): Promise<AdapterResult<{ resolved: boolean; synced: boolean }>> {
  const { approvalId, decision, note } = args;

  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/openclaw/approvals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, decision, note }),
      });

      if (!res.ok) {
        return { ok: false, error: `Approval API error ${res.status}`, retryable: true };
      }

      const data = await res.json() as { resolved: boolean; synced: boolean };
      return { ok: true, data, fetchedAt: new Date().toISOString() };
    }

    const { recordApprovalDecision } = await import('./approval-log');
    await recordApprovalDecision({ approvalId, decision, note });
    return {
      ok: true,
      data: { resolved: true, synced: false },
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Approval resolution failed',
      retryable: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Session messages — load messages for a specific session
// ---------------------------------------------------------------------------

export async function loadSessionMessages(
  sessionKey: string,
  limit = 80,
): Promise<AdapterResult<{
  messages: OpenClawMessage[];
  truncated: boolean;
  contentTruncated: boolean;
  droppedMessages: boolean;
  totalBytes: number;
}>> {
  const sessions = await import('./sessions');
  return sessions.loadSessionMessages(sessionKey, limit);
}

// ---------------------------------------------------------------------------
// Streaming message — server-side streaming via /api/openclaw/chat/stream
// ---------------------------------------------------------------------------
export { streamMessage } from './chat';
export type { StreamMessageEvent } from './chat';

// ---------------------------------------------------------------------------
// Send message — post a message to a session
// ---------------------------------------------------------------------------

export async function sendMessage(args: {
  sessionKey: string;
  content: string;
  model?: string;
  history?: unknown[];
}): Promise<AdapterResult<OpenClawMessage>> {
  const chat = await import('./chat');
  return chat.sendMessage({
    sessionKey: args.sessionKey,
    content: args.content,
    model: args.model ?? 'hermes-agent',
    history: (args.history ?? []) as OpenClawMessage[],
  });
}

// ---------------------------------------------------------------------------
// Delegation events — recent task delegation history
// ---------------------------------------------------------------------------

import type { DelegationEvent } from './types';

const MOCK_DELEGATION_EVENTS: DelegationEvent[] = [
  {
    id: 'evt-1',
    type: 'delegated',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    fromAgent: 'Nero',
    toAgent: 'Hermès',
    taskSummary: 'Draft and gate outbound email to Brian McGarry',
    status: 'in_progress',
  },
  {
    id: 'evt-2',
    type: 'delegated',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    fromAgent: 'Nero',
    toAgent: 'Hephaestus',
    taskSummary: 'Build email gate API route for Graph sendMail',
    status: 'completed',
  },
  {
    id: 'evt-3',
    type: 'returned',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    fromAgent: 'Hephaestus',
    toAgent: 'Nero',
    taskSummary: 'Email gate API route — build completed',
    status: 'completed',
  },
];

export async function loadDelegationEvents(): Promise<AdapterResult<DelegationEvent[]>> {
  if (USE_MOCK) {
    return { ok: true, data: MOCK_DELEGATION_EVENTS, fetchedAt: new Date().toISOString() };
  }

  // Derive delegation events from real session data.
  //
  // Honest limitation: the gateway session store contains session metadata
  // (status, message count, timestamps, child session keys) but not the
  // semantic content of conversations. Events are derived from session
  // characteristics — not from native delegation events.
  //
  // What we CAN infer from session metadata:
  // - A session with childSessions → Nero delegated work to a subagent
  // - A running session with high message count → active specialist work
  // - A done/idle session → completed work
  // - Channel (webchat, telegram) → where the interaction originated
  //
  // What we CANNOT infer (without transcript access):
  // - The specific task delegated
  // - The exact delegation chain for multi-agent flows
  // - Approval/email events (require transcript analysis)
  //
  // All derived events are labeled as honestly as the evidence allows.
  try {
    const sessionsResult = await loadSessions();
    if (!sessionsResult.ok) {
      return { ok: false, error: 'Could not load sessions', retryable: true };
    }

    const sessions = sessionsResult.data;
    const now = Date.now();
    const THREE_HRS = 3 * 60 * 60 * 1000;

    const events: DelegationEvent[] = [];

    for (const session of sessions.slice(0, 30)) {
      if (!session.lastMessageAt) continue;
      const ageMs = now - new Date(session.lastMessageAt).getTime();
      if (ageMs > THREE_HRS) continue;

      const childTag = session.tags.find((t) => t.startsWith('delegated:'));
      const childCount = childTag ? parseInt(childTag.split(':')[1]) : 0;

      // Type: session with child sessions → Nero delegated work
      if (childCount > 0) {
        events.push({
          id: `evt-delegated-${session.shortId}`,
          threadId: session.id,
          type: 'delegated',
          actor: 'nero',
          title: `Nero delegated to specialist (${childCount} sub-sessions)`,
          createdAt: session.lastMessageAt,
          status: session.status === 'active' ? 'in_progress' : 'completed',
          tags: session.tags,
        });
      }

      // Type: session with substantial message count → active specialist work
      if (session.messageCount > 10) {
        const isRecent = ageMs < 30 * 60 * 1000;
        events.push({
          id: `evt-active-${session.shortId}`,
          threadId: session.id,
          type: 'agent_active',
          actor: 'nero',
          title: isRecent
            ? `Active specialist session (${session.messageCount} messages)`
            : `Session was active (${session.messageCount} messages)`,
          createdAt: session.lastMessageAt,
          status: session.status === 'active' ? 'in_progress' : 'completed',
          tags: session.tags,
        });
      }

      // Type: completed session
      if (session.status === 'done') {
        events.push({
          id: `evt-returned-${session.shortId}`,
          threadId: session.id,
          type: 'agent_returned',
          actor: 'nero',
          title: session.tags.includes('telegram') ? 'Telegram session completed' : 'Session completed',
          createdAt: session.lastMessageAt,
          status: 'completed',
          tags: session.tags,
        });
      }
    }

    // Sort newest first
    events.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    // Return empty state if no real events — never silently fall back to mock
    if (events.length === 0) {
      return {
        ok: true,
        data: [],
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      ok: true,
      data: events,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Delegation events loading failed',
      retryable: true,
    };
  }
}
