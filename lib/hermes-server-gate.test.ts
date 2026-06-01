import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chatGateErrorPayload,
  probeHermesChatGate,
  resolveHermesGatewayConfig,
} from './hermes-server-gate.ts';

function response(status: number) {
  return new Response(status >= 200 && status < 300 ? '{}' : 'nope', { status });
}

test('resolveHermesGatewayConfig prefers private Hermes API URL and token fallbacks', () => {
  assert.deepEqual(
    resolveHermesGatewayConfig({
      HERMES_API_URL: 'http://127.0.0.1:9999/',
      NEXT_PUBLIC_HERMES_API_URL: 'http://wrong.example',
      HERMES_API_KEY: 'hermes-token',
      API_SERVER_KEY: 'api-token',
      OPENCLAW_GATEWAY_TOKEN: 'legacy-token',
    }),
    { apiUrl: 'http://127.0.0.1:9999', token: 'hermes-token' },
  );

  assert.deepEqual(
    resolveHermesGatewayConfig({
      NEXT_PUBLIC_OPENCLAW_GATEWAY_URL: 'http://127.0.0.1:8643',
      OPENCLAW_GATEWAY_TOKEN: 'legacy-token',
    }),
    { apiUrl: 'http://127.0.0.1:8643', token: 'legacy-token' },
  );
});

test('probeHermesChatGate allows send when local models endpoint is reachable', async () => {
  const calls: Array<{ url: string; authorization?: string }> = [];
  const gate = await probeHermesChatGate({
    env: { HERMES_API_URL: 'http://127.0.0.1:8642', HERMES_API_KEY: 'secret' },
    timeoutMs: 50,
    fetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(input), authorization: headers.get('authorization') ?? undefined });
      return response(200);
    },
  });

  assert.equal(gate.allowed, true);
  assert.equal(gate.code, 'ready');
  assert.equal(calls[0]?.url, 'http://127.0.0.1:8642/v1/models');
  assert.equal(calls[0]?.authorization, 'Bearer secret');
});

test('probeHermesChatGate blocks predictable token failures before chat POST', async () => {
  const gate = await probeHermesChatGate({
    env: { HERMES_API_URL: 'http://127.0.0.1:8642' },
    timeoutMs: 50,
    fetchImpl: async () => response(401),
  });

  assert.equal(gate.allowed, false);
  assert.equal(gate.code, 'needs_token');
  assert.equal(gate.httpStatus, 503);
  assert.equal(gate.retryable, false);
  assert.match(gate.reason, /token/i);
});

test('probeHermesChatGate blocks unreachable Hermes API as retryable', async () => {
  const gate = await probeHermesChatGate({
    env: { HERMES_API_URL: 'http://127.0.0.1:8642', HERMES_API_KEY: 'secret' },
    timeoutMs: 50,
    fetchImpl: async () => {
      throw new Error('ECONNREFUSED');
    },
  });

  assert.equal(gate.allowed, false);
  assert.equal(gate.code, 'api_unreachable');
  assert.equal(gate.httpStatus, 503);
  assert.equal(gate.retryable, true);
  assert.match(gate.detail, /ECONNREFUSED/);
});

test('chatGateErrorPayload does not expose the private Hermes API URL', async () => {
  const gate = await probeHermesChatGate({
    env: { HERMES_API_URL: 'http://private.internal:8642' },
    timeoutMs: 50,
    fetchImpl: async () => response(401),
  });

  const payload = chatGateErrorPayload(gate);
  assert.equal('apiUrl' in payload.connectionGate, false);
  assert.equal(JSON.stringify(payload).includes('private.internal'), false);
});
