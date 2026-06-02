import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeRuntimeDetail,
  runtimeContractHeaders,
} from './runtime-contract.ts';

test('sanitizeRuntimeDetail removes local paths, API URLs, and bearer tokens', () => {
  const detail = sanitizeRuntimeDetail(
    'state.db not found: /home/likwid/.hermes/state.db; call http://127.0.0.1:8642/v1/models with Bearer secret-token',
  );

  assert.equal(detail.includes('/home/likwid'), false);
  assert.equal(detail.includes('127.0.0.1:8642'), false);
  assert.equal(detail.includes('secret-token'), false);
  assert.match(detail, /local Hermes state database/i);
  assert.match(detail, /local Hermes API/i);
  assert.match(detail, /Bearer \[redacted\]/);
});

test('sanitizeRuntimeDetail returns stable actionable fallback for empty details', () => {
  assert.equal(
    sanitizeRuntimeDetail(''),
    'Hermes runtime is unavailable. Start or reconnect the local Hermes API, then retry.',
  );
});

test('runtimeContractHeaders uses no-store and sanitized degraded reason header', () => {
  const headers = runtimeContractHeaders('sessions', 'state.db not found: C:\\Users\\likwi\\.hermes\\state.db\nBearer abc');

  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(headers['X-Signal-Loom-Degraded'], 'sessions');
  assert.equal(headers['X-Signal-Loom-Degraded-Reason']?.includes('C:\\Users'), false);
  assert.equal(headers['X-Signal-Loom-Degraded-Reason']?.includes('abc'), false);
  assert.match(headers['X-Signal-Loom-Degraded-Reason'] ?? '', /local Hermes state database/i);
});
