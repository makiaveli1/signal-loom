/**
 * OpenClaw adapter — normalized facade over the OpenClaw gateway API.
 *
 * Provides a stable interface for Signal Loom regardless of whether
 * we are using mock data or the real gateway.
 *
 * Architecture:
 * - Browser → Next.js API routes (/api/openclaw/*) → adapter (server-side) → gateway
 * - All adapter functions are server-side when called from Next.js API routes
 * - The gateway URL is 127.0.0.1:18789 (WSL localhost)
 */

export type { OpenClawSession, OpenClawAgent, OpenClawRuntimeHealth } from './types';

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

export { loadSessionsReal } from './sessions';

import { loadSessionsReal } from './sessions';

export async function loadSessions() {
  return withMock(
    {
      ok: true,
      data: [],
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

import type { OpenClawAgent, OpenClawApproval, OpenClawMessage, AdapterResult } from './types';

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

  // Load sessions from the gateway to derive live agent status
  try {
    const sessionsResult = await loadSessionsReal();

    if (!sessionsResult.ok || !sessionsResult.data) {
      return { ok: false, error: 'Could not load sessions', retryable: true };
    }

    // Aggregate sessions by agentId prefix
    const now = Date.now();
    const STALE_MS = 5 * 60 * 1000; // 5 minutes

    const agentMap: Record<string, { lastActive: number; sessionCount: number }> = {};

    for (const session of sessionsResult.data) {
      const id = session.agentId ?? 'nero';
      if (!agentMap[id]) agentMap[id] = { lastActive: 0, sessionCount: 0 };
      if (session.lastMessageAt) {
        const t = new Date(session.lastMessageAt).getTime();
        if (t > agentMap[id].lastActive) agentMap[id].lastActive = t;
      }
      agentMap[id].sessionCount++;
    }

    const liveAgents: OpenClawAgent[] = MOCK_AGENTS.map((mock) => {
      const stats = agentMap[mock.id];
      const isStale = !stats || now - stats.lastActive > STALE_MS;
      const isActive = stats && now - stats.lastActive <= STALE_MS;

      return {
        ...mock,
        status: isActive ? 'active' : isStale ? 'idle' : 'idle',
        lastActiveAt: stats?.lastActive ? new Date(stats.lastActive).toISOString() : undefined,
        currentTask:
          isActive && stats?.sessionCount
            ? `${stats.sessionCount} active session${stats.sessionCount > 1 ? 's' : ''}`
            : isStale
              ? 'No recent activity'
              : mock.currentTask,
      };
    });

    return {
      ok: true,
      data: liveAgents,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Agent loading failed',
      retryable: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Approvals — pending human approval items
// ---------------------------------------------------------------------------

export async function loadApprovals(): Promise<AdapterResult<OpenClawApproval[]>> {
  return {
    ok: true,
    data: [],
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Session messages — load messages for a specific session
// ---------------------------------------------------------------------------

export async function loadSessionMessages(_sessionKey: string): Promise<AdapterResult<OpenClawMessage[]>> {
  return {
    ok: true,
    data: [],
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Send message — post a message to a session
// ---------------------------------------------------------------------------

export async function sendMessage(args: {
  sessionKey: string;
  content: string;
  model?: string;
  history?: unknown[];
}): Promise<AdapterResult<OpenClawMessage>> {
  // TODO: implement via gateway /tools/invoke with sessions_send tool
  // For now, return a mock response so the composer doesn't break
  return {
    ok: true,
    data: {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `Message queued for session: ${args.sessionKey}`,
      timestamp: new Date().toISOString(),
    },
    fetchedAt: new Date().toISOString(),
  };
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

  // In production, this would load from the gateway session transcripts
  // by scanning recent sessions for delegation-related messages.
  // For now, fall back to mock + session metadata.
  try {
    const sessionsResult = await loadSessionsReal();
    if (!sessionsResult.ok) {
      return { ok: false, error: 'Could not load sessions', retryable: true };
    }

    // Derive delegation events from session metadata
    // (In full implementation, parse transcripts for delegation patterns)
    const events: DelegationEvent[] = [];

    for (const session of sessionsResult.data.slice(0, 20)) {
      if (session.lastMessageAt) {
        const minutesAgo = Math.floor((Date.now() - new Date(session.lastMessageAt).getTime()) / 60000);
        if (minutesAgo < 180) {
          events.push({
            id: `evt-gw-${session.shortId}`,
            type: 'returned',
            timestamp: session.lastMessageAt,
            fromAgent: session.agentName,
            toAgent: 'Nero',
            taskSummary: session.preview?.slice(0, 80) ?? `Session: ${session.title}`,
            status: 'completed',
          });
        }
      }
    }

    return {
      ok: true,
      data: events.length > 0 ? events : MOCK_DELEGATION_EVENTS,
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
