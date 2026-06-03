import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConnectionTruthSummary,
  buildContextChips,
  buildSessionIntelligence,
  buildThreadHandoffReport,
  extractToolReceipts,
  getApprovalRiskProfile,
  getApprovalSafetyLabel,
  redactOperationalText,
} from './operator-qol.ts';
import type { Approval, Message, RuntimeState, Thread } from './types/index.ts';

const runtime: RuntimeState = {
  gateway: 'healthy',
  queue: 'healthy',
  heartbeatFreshness: 'fresh',
  browserLanes: 2,
  canvasEnabled: false,
  issueCount: 0,
};

const thread: Thread = {
  id: 'thread-1',
  title: 'Fix operator cockpit',
  status: 'waiting_on_user',
  lastActive: '2026-06-03T10:00:00.000Z',
  unreadCount: 0,
  hasApproval: true,
  linkedAgents: ['argus'],
  linkedChildren: ['child-1'],
  messages: [],
  session: {
    id: 'session-abc123',
    shortId: 'abc123',
    title: 'Fix operator cockpit',
    status: 'active',
    parentSessionId: null,
    lastMessageAt: '2026-06-03T10:00:00.000Z',
    messageCount: 3,
    preview: 'operator cockpit work',
    tags: ['signal-loom'],
    agentId: 'nero',
    agentName: 'Nero',
  },
};

test('buildConnectionTruthSummary distinguishes ready, blocked, and degraded states', () => {
  const ready = buildConnectionTruthSummary({
    runtime,
    liveConnected: true,
    detection: {
      status: 'ready',
      binary: { found: true, version: 'Hermes 1.0.0' },
      api: { url: 'http://127.0.0.1:8642', reachable: true, authenticated: true },
      home: { configExists: true, stateDbExists: true, stateDbPath: '/home/likwid/.hermes/state.db' },
    },
  });
  assert.equal(ready.state, 'ready');
  assert.equal(ready.sendAllowed, true);
  assert.equal(ready.okCount, 5);

  const tokenNeeded = buildConnectionTruthSummary({
    runtime,
    liveConnected: true,
    detection: {
      status: 'needs_token',
      binary: { found: true },
      api: { reachable: true, authenticated: false, error: 'HTTP 401 token=supersecretvalue' },
      home: { configExists: true, stateDbExists: true },
    },
  });
  assert.equal(tokenNeeded.state, 'blocked');
  assert.equal(tokenNeeded.sendAllowed, false);
  assert.match(tokenNeeded.primaryLabel, /API token needed/);
  assert.equal(tokenNeeded.checks.some((check) => check.detail.includes('supersecretvalue')), false);

  const stateMissing = buildConnectionTruthSummary({
    runtime,
    liveConnected: false,
    detection: {
      status: 'state_db_missing',
      binary: { found: true },
      api: { reachable: true, authenticated: true },
      home: { configExists: true, stateDbExists: false },
    },
  });
  assert.equal(stateMissing.state, 'degraded');
  assert.equal(stateMissing.sendAllowed, true);
  assert.ok(stateMissing.nextActions.some((action) => action.includes('Sending is allowed')));
});

test('session intelligence creates triage/search text and context chips', () => {
  const intelligence = buildSessionIntelligence({ thread, childCount: 1, transcriptMessageCount: 4 });
  assert.equal(intelligence.triage, 'needs-you');
  assert.ok(intelligence.searchableText.includes('signal-loom'));
  assert.ok(intelligence.labels.includes('needs review'));

  const chips = buildContextChips({ thread, childCount: 1, pendingApprovalCount: 1, transcriptState: 'loaded' });
  assert.deepEqual(chips.map((chip) => chip.id).slice(0, 4), ['status', 'approval', 'children', 'session']);
});

test('approval safety labels keep gateway and local boundaries explicit', () => {
  assert.equal(getApprovalSafetyLabel({ source: 'gateway', status: 'pending' }).label, 'Gateway synced');
  assert.equal(getApprovalSafetyLabel({ source: 'derived', status: 'pending' }).label, 'Derived/local');
  assert.equal(getApprovalSafetyLabel({ source: 'mock', status: 'pending' }).label, 'Dev mock');
  assert.equal(getApprovalSafetyLabel({ source: 'gateway', status: 'approved' }).label, 'Unsynced decision');
});


test('approval risk profiles classify external, config, command, and draft decisions', () => {
  assert.equal(getApprovalRiskProfile({ title: 'Post LinkedIn update', recommendation: 'Approve send', urgency: 'high', source: 'gateway' }).category, 'External action');
  assert.equal(getApprovalRiskProfile({ title: 'Update .env token', recommendation: 'Change config', urgency: 'medium', source: 'derived' }).category, 'Local config');
  assert.equal(getApprovalRiskProfile({ title: 'Run update command', recommendation: 'Install package', urgency: 'medium', source: 'gateway' }).category, 'Command/run');
  assert.equal(getApprovalRiskProfile({ title: 'Review draft', recommendation: 'Revise copy', urgency: 'low', source: 'mock' }).reversibility, 'local only');
});

test('handoff reports summarize transcript, approvals, delegation, receipts, and redact secrets', () => {
  const messages: Message[] = [
    { id: 'm1', role: 'user', content: 'Please fix this', timestamp: '2026-06-03T10:00:00.000Z' },
    { id: 'm2', role: 'assistant', content: '[Tool: terminal] npm test\n\n[Result] exit_code=0 token=supersecretvalue', timestamp: '2026-06-03T10:01:00.000Z' },
  ];
  const approvals: Approval[] = [{
    id: 'appr-1',
    title: 'Submit public post',
    urgency: 'high',
    raisedBy: 'Nero',
    recommendation: 'Ask first',
    linkedThreadId: thread.id,
    source: 'gateway',
    status: 'pending',
  }];
  const report = buildThreadHandoffReport({
    thread,
    messages,
    approvals,
    delegationEvents: [{
      id: 'evt-1',
      threadId: thread.id,
      type: 'delegated',
      actor: 'Nero',
      title: 'QA pass',
      createdAt: '2026-06-03T10:02:00.000Z',
      childSessionIds: ['child-1'],
    }],
    generatedAt: '2026-06-03T10:03:00.000Z',
  });

  assert.match(report.markdown, /Pending approvals: 1/);
  assert.match(report.markdown, /QA pass/);
  assert.match(report.markdown, /Receipt Summary/);
  assert.equal(report.markdown.includes('supersecretvalue'), false);
  assert.equal(extractToolReceipts(messages).length, 2);
});

test('redactOperationalText strips common token shapes', () => {
  assert.equal(redactOperationalText('api_key=abcdefghijklmnopqrstuvwxyz'), 'api_key=[redacted]');
  assert.equal(redactOperationalText('url?token=abcdefghijklmnopqrstuvwxyz&ok=1'), 'url?token=[redacted]&ok=1');
});
