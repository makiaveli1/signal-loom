import test from 'node:test';
import assert from 'node:assert/strict';

const SECRET_DB_PATH = '/tmp/signal-loom-secret-token/.hermes/state.db';
process.env.HERMES_STATE_DB = SECRET_DB_PATH;
process.env.HERMES_AGENT_NAME = 'Nero';
process.env.HERMES_AGENT_ID = 'nero';

async function textFromStream(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  assert.ok(reader, 'expected a streaming body');
  const first = await reader.read();
  await reader.cancel();
  return new TextDecoder().decode(first.value);
}

function assertNoRuntimeLeak(serialized: string) {
  assert.equal(serialized.includes(SECRET_DB_PATH), false);
  assert.equal(serialized.includes('/tmp/signal-loom-secret-token'), false);
  assert.equal(serialized.includes('secret-token'), false);
}

test('health route returns deterministic sanitized degraded snapshot when state DB is missing', async () => {
  const { GET } = await import('./health/route.ts');
  const response = await GET();
  const payload = await response.json();
  const serialized = JSON.stringify(payload);

  assert.equal(response.headers.get('X-Signal-Loom-Degraded'), 'health');
  assert.equal(payload.gateway.reachable, false);
  assert.match(payload.gateway.error, /local Hermes state database/i);
  assertNoRuntimeLeak(serialized);
  assertNoRuntimeLeak(response.headers.get('X-Signal-Loom-Degraded-Reason') ?? '');
});

test('sessions route fallback does not leak local state DB paths', async () => {
  const { GET } = await import('./sessions/route.ts');
  const response = await GET();
  const payload = await response.json();
  const serialized = JSON.stringify(payload);

  assert.equal(response.headers.get('X-Signal-Loom-Degraded'), 'sessions');
  assert.equal(Array.isArray(payload), true);
  assert.match(payload[0].preview, /local Hermes state database/i);
  assertNoRuntimeLeak(serialized);
  assertNoRuntimeLeak(response.headers.get('X-Signal-Loom-Degraded-Reason') ?? '');
});

test('session history validates missing sessionKey before touching runtime state', async () => {
  const { GET } = await import('./sessions/history/route.ts');
  const response = await GET(new Request('http://localhost/api/openclaw/sessions/history') as never);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, 'sessionKey is required');
});

test('session history degraded payload does not leak local state DB paths', async () => {
  const { GET } = await import('./sessions/history/route.ts');
  const response = await GET(new Request('http://localhost/api/openclaw/sessions/history?sessionKey=abc&limit=10') as never);
  const payload = await response.json();
  const serialized = JSON.stringify(payload);

  assert.equal(response.headers.get('X-Signal-Loom-Degraded'), 'session-history');
  assert.equal(payload.data.degraded, true);
  assert.match(payload.data.error, /local Hermes state database/i);
  assertNoRuntimeLeak(serialized);
  assertNoRuntimeLeak(response.headers.get('X-Signal-Loom-Degraded-Reason') ?? '');
});

test('live SSE degraded frame does not leak local state DB paths', async () => {
  const { GET } = await import('./live/route.ts');
  const response = await GET();
  const firstFrame = await textFromStream(response);

  assert.equal(response.headers.get('X-Signal-Loom-Degraded'), 'live-events');
  assertNoRuntimeLeak(response.headers.get('X-Signal-Loom-Degraded-Reason') ?? '');
  assert.match(firstFrame, /event: connected/);
  assert.match(firstFrame, /local Hermes state database/i);
  assertNoRuntimeLeak(firstFrame);
});
