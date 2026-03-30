/**
 * Mock data for local development without a running OpenClaw gateway.
 *
 * Used when NEXT_PUBLIC_USE_MOCK_DATA=true.
 * This data should closely mirror what the real adapter returns so UI
 * development can proceed without gateway access.
 */

import type {
  OpenClawSession,
  OpenClawMessage,
  OpenClawAgent,
  OpenClawRuntimeHealth,
  OpenClawApproval,
  OpenClawDelegationEvent,
} from './types';

// ---------------------------------------------------------------------------
// Sessions / Threads
// ---------------------------------------------------------------------------

export const MOCK_SESSIONS: OpenClawSession[] = [
  {
    id: 'agent:main:session:signal-loom-sprint3',
    shortId: 'sprint3',
    title: 'Signal Loom Sprint 3 build',
    agentId: 'nero',
    agentName: 'Nero',
    messageCount: 18,
    lastMessageAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    status: 'active',
    tags: ['signal-loom', 'sprint-3'],
    preview: 'Sprint 3 should make Signal Loom operationally real before making it more elaborate...',
  },
  {
    id: 'agent:forge:session:verdantia-q2',
    shortId: 'verdantia',
    title: 'Verdantia Q2 positioning strategy',
    agentId: 'hephaestus',
    agentName: 'Hephaestus',
    messageCount: 31,
    lastMessageAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: 'idle',
    tags: ['verdantia', 'strategy'],
    preview: 'The Q2 positioning should focus on AI training services for enterprise clients...',
  },
  {
    id: 'agent:scout:session:last30days-research',
    shortId: 'last30ds',
    title: 'Last30days AI tools landscape',
    agentId: 'orion',
    agentName: 'Orion',
    messageCount: 9,
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'done',
    tags: ['research', 'ai-tools'],
    preview: 'The competitive landscape for AI tools has shifted significantly in the last 30 days...',
  },
  {
    id: 'agent:studio:session:website-studio-review',
    shortId: 'web-studio',
    title: 'Website Studio review — Brian McGarry',
    agentId: 'ariadne',
    agentName: 'Ariadne',
    messageCount: 14,
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'done',
    tags: ['website-studio', 'lead-gen'],
    preview: 'The Brian McGarry landing page is ready for deployment approval...',
  },
];

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const MOCK_MESSAGES: Record<string, OpenClawMessage[]> = {
  [MOCK_SESSIONS[0].id]: [
    {
      id: 'msg-s3-1',
      role: 'user',
      content: 'Start Sprint 3 for Signal Loom. We need real OpenClaw integration.',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-s3-2',
      role: 'assistant',
      content: 'Understood. Sprint 3 connects Signal Loom to the real OpenClaw runtime. The primary goal is making Signal Loom operationally real — real message flow, real sessions, real agent activity.',
      timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
      agentId: 'nero',
    },
    {
      id: 'msg-s3-3',
      role: 'user',
      content: 'What are the key integration points?',
      timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-s3-4',
      role: 'assistant',
      content: 'The gateway exposes: session state via agent session API, chat via /v1/chat/completions, and runtime health via /health. We build one canonical adapter layer that normalizes all of this.',
      timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      agentId: 'nero',
    },
  ],
};

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const MOCK_AGENTS: OpenClawAgent[] = [
  {
    id: 'nero',
    name: 'Nero',
    status: 'active',
    accentColor: '#e8603a',
    currentTask: 'Sprint 3 integration',
    lastActiveAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    role: 'execution',
  },
  {
    id: 'hephaestus',
    name: 'Hephaestus',
    status: 'waiting_on_nero',
    accentColor: '#e8733a',
    currentTask: 'Waiting on Sprint 3 adapter spec',
    lastActiveAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    role: 'execution',
  },
  {
    id: 'orion',
    name: 'Orion',
    status: 'done',
    accentColor: '#3ab8c8',
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    role: 'research',
  },
  {
    id: 'ariadne',
    name: 'Ariadne',
    status: 'done',
    accentColor: '#9b8dc8',
    lastActiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    role: 'design',
  },
  {
    id: 'argus',
    name: 'Argus',
    status: 'idle',
    accentColor: '#c9943a',
    lastActiveAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    role: 'review',
  },
  {
    id: 'hermes',
    name: 'Hermes',
    status: 'idle',
    accentColor: '#e8a04a',
    lastActiveAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    role: 'commercial',
  },
];

// ---------------------------------------------------------------------------
// Runtime health
// ---------------------------------------------------------------------------

export const MOCK_HEALTH: OpenClawRuntimeHealth = {
  gateway: { reachable: true },
  queue: { healthy: true, depth: 0 },
  heartbeat: { fresh: true, lastSeen: new Date().toISOString() },
  canvas: { enabled: false },
  browser: { lanesActive: 2, lanesTotal: 4 },
  uptime: 86400,
};

// ---------------------------------------------------------------------------
// Delegation events
// ---------------------------------------------------------------------------

export const MOCK_DELEGATION_EVENTS: OpenClawDelegationEvent[] = [
  {
    id: 'evt-s3-1',
    threadId: MOCK_SESSIONS[0].id,
    type: 'received',
    actor: 'user',
    title: 'Nero received a message',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt-s3-2',
    threadId: MOCK_SESSIONS[0].id,
    type: 'delegated',
    actor: 'nero',
    targetAgentId: 'hephaestus',
    title: 'Assigned to Hephaestus',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt-s3-3',
    threadId: MOCK_SESSIONS[0].id,
    type: 'agent_active',
    actor: 'hephaestus',
    title: 'Hephaestus is working',
    createdAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt-s3-4',
    threadId: MOCK_SESSIONS[0].id,
    type: 'agent_returned',
    actor: 'hephaestus',
    title: 'Hephaestus returned',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt-s3-5',
    threadId: MOCK_SESSIONS[1].id,
    type: 'received',
    actor: 'user',
    title: 'Nero received a message',
    createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
  },
  {
    id: 'evt-s3-6',
    threadId: MOCK_SESSIONS[1].id,
    type: 'approval_requested',
    actor: 'hephaestus',
    title: 'Approval requested',
    createdAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export const MOCK_APPROVALS: OpenClawApproval[] = [
  {
    id: 'approval-1',
    linkedThreadId: MOCK_SESSIONS[1].id,
    summary: 'Deploy Brian McGarry landing page to production',
    requestedBy: 'hephaestus',
    requestedAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
    status: 'pending',
    canResolve: true,
  },
  {
    id: 'approval-2',
    linkedThreadId: MOCK_SESSIONS[0].id,
    summary: 'Sprint 3 scope change: add real session loading',
    requestedBy: 'nero',
    requestedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'pending',
    canResolve: true,
  },
];
