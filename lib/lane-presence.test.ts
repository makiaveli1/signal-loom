import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLanePresence } from './lane-presence.ts';
import type { Agent } from './types/index.ts';
import type { OpenClawSession } from './openclaw/adapter/types.ts';

const agents: Agent[] = [
  { id: 'hephaestus', name: 'Hephaestus', role: 'Code', status: 'idle', taskPreview: 'No work', browserEnabled: false, accentColor: '#3ab8c8' },
  { id: 'argus', name: 'Argus', role: 'QA', status: 'blocked', taskPreview: 'Waiting on evidence', browserEnabled: false, accentColor: '#e8603a' },
];

const now = new Date('2026-06-03T12:00:00.000Z').getTime();

function session(overrides: Partial<OpenClawSession>): OpenClawSession {
  return {
    id: 'agent:hephaestus:session:child-1',
    shortId: 'child-1',
    title: 'Implement feature',
    agentId: 'hephaestus',
    agentName: 'Hephaestus',
    messageCount: 3,
    parentSessionId: 'parent-1',
    lastMessageAt: '2026-06-03T11:58:00.000Z',
    status: 'active',
    tags: [],
    preview: 'working on feature',
    ...overrides,
  };
}

test('buildLanePresence marks active delegated lanes as running with latest task', () => {
  const presence = buildLanePresence({
    agents,
    sessions: [session({})],
    runtimeActivities: {
      'agent:hephaestus:session:child-1': { status: 'active', updatedAt: '2026-06-03T11:59:00.000Z', preview: 'npm test running' },
    },
    now,
  });

  assert.equal(presence.hephaestus.state, 'running');
  assert.equal(presence.hephaestus.activeCount, 1);
  assert.equal(presence.hephaestus.latestTask, 'npm test running');
  assert.equal(presence.hephaestus.ageLabel, '1m ago');
});

test('buildLanePresence distinguishes blocked and stale lanes', () => {
  const presence = buildLanePresence({
    agents,
    sessions: [
      session({ id: 'agent:hephaestus:session:old', shortId: 'old', status: 'idle', lastMessageAt: '2026-06-03T03:00:00.000Z' }),
      session({ id: 'agent:argus:session:qa', shortId: 'qa', agentId: 'argus', agentName: 'Argus', status: 'idle', lastMessageAt: '2026-06-03T11:45:00.000Z' }),
    ],
    now,
  });

  assert.equal(presence.hephaestus.state, 'stale');
  assert.equal(presence.hephaestus.staleCount, 1);
  assert.equal(presence.argus.state, 'blocked');
});
