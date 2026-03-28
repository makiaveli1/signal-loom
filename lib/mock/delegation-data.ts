import type { DelegationEvent } from '@/lib/types';

const now = Date.now();

export const mockDelegationEvents: DelegationEvent[] = [
  // Thread 1 - 6 events (full delegation arc)
  {
    id: 'ev-1-1',
    threadId: 'thread-1',
    type: 'received',
    actor: 'user',
    title: 'You sent a message',
    createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
    linkedMessageId: 'msg-1-1',
  },
  {
    id: 'ev-1-2',
    threadId: 'thread-1',
    type: 'delegated',
    actor: 'nero',
    targetAgentId: 'hephaestus',
    title: 'Nero assigned to Hephaestus',
    createdAt: new Date(now - 29 * 60 * 1000).toISOString(),
  },
  {
    id: 'ev-1-3',
    threadId: 'thread-1',
    type: 'agent_active',
    actor: 'hephaestus',
    title: 'Hephaestus is working on it',
    createdAt: new Date(now - 28 * 60 * 1000).toISOString(),
  },
  {
    id: 'ev-1-4',
    threadId: 'thread-1',
    type: 'agent_returned',
    actor: 'hephaestus',
    title: 'Hephaestus returned',
    createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'ev-1-5',
    threadId: 'thread-1',
    type: 'approval_requested',
    actor: 'hephaestus',
    title: 'Approval requested — Deploy Verdantia API fixes to staging',
    createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'ev-1-6',
    threadId: 'thread-1',
    type: 'decision_made',
    actor: 'user',
    title: 'You decided: approved on Deploy Verdantia API fixes to staging',
    createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
  },

  // Thread 8 - 5 events (multi-agent delegation)
  {
    id: 'ev-8-1',
    threadId: 'thread-8',
    type: 'received',
    actor: 'user',
    title: 'You sent a message',
    createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
    linkedMessageId: 'msg-8-1',
  },
  {
    id: 'ev-8-2',
    threadId: 'thread-8',
    type: 'delegated',
    actor: 'nero',
    targetAgentId: 'hephaestus',
    title: 'Nero assigned to Hephaestus',
    createdAt: new Date(now - 29 * 60 * 1000).toISOString(),
  },
  {
    id: 'ev-8-3',
    threadId: 'thread-8',
    type: 'delegated',
    actor: 'nero',
    targetAgentId: 'argus',
    title: 'Nero assigned to Argus',
    createdAt: new Date(now - 28 * 60 * 1000).toISOString(),
  },
  {
    id: 'ev-8-4',
    threadId: 'thread-8',
    type: 'agent_active',
    actor: 'argus',
    title: 'Argus is working on it',
    createdAt: new Date(now - 27 * 60 * 1000).toISOString(),
  },
  {
    id: 'ev-8-5',
    threadId: 'thread-8',
    type: 'agent_returned',
    actor: 'argus',
    title: 'Argus returned',
    createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
  },
];
