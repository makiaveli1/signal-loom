import test from 'node:test';
import assert from 'node:assert/strict';
import { createHermesDetectionController } from './hermes-detection-client.ts';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Hermes detection controller coalesces concurrent refreshes into one fetch', async () => {
  let fetchCount = 0;
  const controller = createHermesDetectionController({
    fetchImpl: async () => {
      fetchCount += 1;
      return jsonResponse({ ok: true, status: 'ready', fetchedAt: 'now', api: { reachable: true, authenticated: true } });
    },
  });

  const [first, second] = await Promise.all([controller.refresh(), controller.refresh()]);

  assert.equal(fetchCount, 1);
  assert.equal(first.detection?.status, 'ready');
  assert.equal(second.detection?.status, 'ready');
  assert.equal(controller.getState().loading, false);
});

test('Hermes detection controller notifies subscribers and keeps last successful payload', async () => {
  const states: string[] = [];
  const controller = createHermesDetectionController({
    fetchImpl: async () => jsonResponse({ ok: false, status: 'needs_token', fetchedAt: 'now', api: { reachable: true, authenticated: false } }),
  });

  const unsubscribe = controller.subscribe((state) => {
    states.push(`${state.loading}:${state.detection?.status ?? 'none'}`);
  });
  await controller.refresh();
  unsubscribe();

  assert.deepEqual(states, ['false:none', 'true:none', 'false:needs_token']);
  assert.equal(controller.getState().detection?.status, 'needs_token');
});

test('Hermes detection controller converts fetch failures into unknown_error detection state', async () => {
  const controller = createHermesDetectionController({
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });

  const state = await controller.refresh();

  assert.equal(state.loading, false);
  assert.equal(state.error, 'network down');
  assert.equal(state.detection?.status, 'unknown_error');
  assert.equal(state.detection?.api?.reachable, false);
});
