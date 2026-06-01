import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConnectionChips,
  classifyDelegatedSessions,
  getComposerConnectionGate,
  getStatusRowState,
} from './status-truth.ts';

const baseRuntime = {
  gateway: 'healthy',
  queue: 'healthy',
  heartbeatFreshness: 'fresh',
  issueCount: 0,
};

test('buildConnectionChips splits Hermes API token state from runtime health', () => {
  const chips = buildConnectionChips({
    runtime: baseRuntime,
    liveConnected: true,
    detection: {
      status: 'needs_token',
      binary: { found: true, version: 'Hermes 1.2.3' },
      api: { url: 'http://127.0.0.1:8000', reachable: true, authenticated: false, error: 'HTTP 401' },
      home: { configExists: true, stateDbExists: true },
    },
  });

  assert.deepEqual(
    chips.map((chip) => [chip.id, chip.label, chip.tone]),
    [
      ['cli', 'CLI installed', 'ok'],
      ['api', 'API token needed', 'warn'],
      ['state-db', 'State DB connected', 'ok'],
      ['runtime', 'Runtime stream live', 'ok'],
      ['gateway', 'Gateway healthy', 'ok'],
    ],
  );
});

test('getStatusRowState stays neutral while detection is loading', () => {
  assert.deepEqual(
    getStatusRowState({ label: 'Hermes CLI', loading: true, ok: false, loadingDetail: 'Checking binary…' }),
    { label: 'Hermes CLI', ok: null, badge: 'checking', tone: 'neutral', detail: 'Checking binary…' },
  );
});

test('getComposerConnectionGate blocks while Hermes detection is still checking', () => {
  assert.deepEqual(getComposerConnectionGate({ detection: null, loading: true }), {
    blocked: true,
    tone: 'neutral',
    reason: 'Checking Hermes connection',
    detail: 'Signal Loom is checking the local Hermes API before sending so your draft is not lost to a predictable auth failure.',
    actionLabel: 'Checking…',
  });
});

test('getComposerConnectionGate blocks a reachable unauthenticated API without treating state DB as fatal', () => {
  const gate = getComposerConnectionGate({
    loading: false,
    detection: {
      status: 'state_db_missing',
      binary: { found: true, version: 'Hermes 1.2.3' },
      api: { url: 'http://127.0.0.1:8642', reachable: true, authenticated: true },
      home: { configExists: true, stateDbExists: false },
    },
  });
  assert.equal(gate.blocked, false);
  assert.equal(gate.tone, 'warn');
  assert.equal(gate.reason, 'No saved sessions yet');

  assert.deepEqual(
    getComposerConnectionGate({
      loading: false,
      detection: {
        status: 'needs_token',
        binary: { found: true, version: 'Hermes 1.2.3' },
        api: { url: 'http://127.0.0.1:8642', reachable: true, authenticated: false, error: 'HTTP 401' },
        home: { configExists: true, stateDbExists: true },
      },
    }),
    {
      blocked: true,
      tone: 'warn',
      reason: 'Hermes API token needed',
      detail: 'The local API answered, but Signal Loom cannot authenticate. Add HERMES_API_KEY, API_SERVER_KEY, or OPENCLAW_GATEWAY_TOKEN, then re-check.',
      actionLabel: 'Connect Hermes',
    },
  );
});

test('getComposerConnectionGate blocks missing or unreachable Hermes prerequisites', () => {
  assert.equal(getComposerConnectionGate({ loading: false, detection: { status: 'missing_binary', binary: { found: false } } }).blocked, true);
  assert.equal(getComposerConnectionGate({ loading: false, detection: { status: 'api_unreachable', binary: { found: true }, api: { reachable: false, error: 'ECONNREFUSED' } } }).blocked, true);
  assert.equal(getComposerConnectionGate({ loading: false, detection: { status: 'ready', binary: { found: true }, api: { reachable: true, authenticated: true }, home: { stateDbExists: true, configExists: true } } }).blocked, false);
});

test('classifyDelegatedSessions separates running, recent, completed, stale, and empty-created child sessions', () => {
  const now = Date.parse('2026-05-31T12:00:00.000Z');
  const sessions = [
    {
      id: 'child-running', shortId: 'run', title: 'Running child', status: 'active', parentSessionId: 'parent', lastMessageAt: '2026-05-31T11:59:00.000Z', messageCount: 3, preview: 'working', tags: [], agentId: 'sub', agentName: 'Subagent',
    },
    {
      id: 'child-created', shortId: 'new', title: 'Created child', status: 'active', parentSessionId: 'parent', lastMessageAt: '2026-05-31T11:58:00.000Z', messageCount: 0, preview: '', tags: [], agentId: 'sub', agentName: 'Subagent',
    },
    {
      id: 'child-recent', shortId: 'rec', title: 'Recent child', status: 'active', parentSessionId: 'parent', lastMessageAt: '2026-05-31T11:20:00.000Z', messageCount: 4, preview: 'recent', tags: [], agentId: 'sub', agentName: 'Subagent',
    },
    {
      id: 'child-done', shortId: 'done', title: 'Done child', status: 'done', parentSessionId: 'parent', lastMessageAt: '2026-05-31T11:55:00.000Z', messageCount: 5, preview: 'done', tags: [], agentId: 'sub', agentName: 'Subagent',
    },
    {
      id: 'child-stale', shortId: 'old', title: 'Old child', status: 'active', parentSessionId: 'parent', lastMessageAt: '2026-05-31T08:00:00.000Z', messageCount: 2, preview: 'old', tags: [], agentId: 'sub', agentName: 'Subagent',
    },
  ];

  const classified = classifyDelegatedSessions({ sessions, runtimeActivities: {}, now });

  assert.deepEqual(classified.runningNow.map((item) => item.session.id), ['child-running']);
  assert.deepEqual(classified.createdEmpty.map((item) => item.session.id), ['child-created']);
  assert.deepEqual(classified.recentlyDelegated.map((item) => item.session.id), ['child-recent']);
  assert.deepEqual(classified.completed.map((item) => item.session.id), ['child-done']);
  assert.deepEqual(classified.stale.map((item) => item.session.id), ['child-stale']);
});
