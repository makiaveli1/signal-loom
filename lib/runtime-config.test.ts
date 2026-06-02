import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRuntimeConfigTruth,
  resolveSignalLoomRuntimeConfig,
} from './runtime-config.ts';

test('resolveSignalLoomRuntimeConfig prefers private API URL and token env names', () => {
  const config = resolveSignalLoomRuntimeConfig({
    HERMES_API_URL: 'http://127.0.0.1:9999/',
    NEXT_PUBLIC_HERMES_API_URL: 'http://example.invalid:8642',
    HERMES_API_KEY: 'hermes-token',
    API_SERVER_KEY: 'api-token',
    OPENCLAW_GATEWAY_TOKEN: 'legacy-token',
  });

  assert.equal(config.apiUrl, 'http://127.0.0.1:9999');
  assert.equal(config.apiUrlSource, 'HERMES_API_URL');
  assert.equal(config.apiUrlValid, true);
  assert.equal(config.apiUrlLoopback, true);
  assert.equal(config.token, 'hermes-token');
  assert.equal(config.tokenSource, 'HERMES_API_KEY');
  assert.equal(config.issues.length, 0);
});

test('buildRuntimeConfigTruth reports missing token without exposing secret values', () => {
  const truth = buildRuntimeConfigTruth({
    HERMES_API_URL: 'http://localhost:8642',
  });
  const serialized = JSON.stringify(truth);

  assert.equal(truth.auth.tokenPresent, false);
  assert.equal(truth.auth.tokenSource, null);
  assert.equal(truth.issues.some((issue) => issue.code === 'missing_token'), true);
  assert.equal(serialized.includes('Bearer'), false);
});

test('buildRuntimeConfigTruth marks public URL fallback and legacy token source as warnings', () => {
  const truth = buildRuntimeConfigTruth({
    NEXT_PUBLIC_HERMES_API_URL: 'http://127.0.0.1:8642',
    OPENCLAW_GATEWAY_TOKEN: 'legacy-secret',
    NEXT_PUBLIC_USE_MOCK_DATA: 'true',
    SIGNAL_LOOM_ENABLE_INSTALL: 'true',
  });

  assert.equal(truth.api.source, 'NEXT_PUBLIC_HERMES_API_URL');
  assert.equal(truth.auth.tokenPresent, true);
  assert.equal(truth.auth.tokenSource, 'OPENCLAW_GATEWAY_TOKEN');
  assert.equal(truth.flags.mockDataEnabled, true);
  assert.equal(truth.flags.installEnabled, true);
  assert.equal(truth.issues.some((issue) => issue.code === 'public_api_url_source'), true);
  assert.equal(truth.issues.some((issue) => issue.code === 'legacy_token_source'), true);
  assert.equal(JSON.stringify(truth).includes('legacy-secret'), false);
});

test('buildRuntimeConfigTruth redacts credentials and secret query params from browser-visible API URL', () => {
  const truth = buildRuntimeConfigTruth({
    HERMES_API_URL: 'http://user:pass@127.0.0.1:8642/v1?token=secret-token&mode=local',
    HERMES_API_KEY: 'server-token',
  });
  const serialized = JSON.stringify(truth);

  assert.equal(serialized.includes('user:pass'), false);
  assert.equal(serialized.includes('secret-token'), false);
  assert.equal(serialized.includes('server-token'), false);
  assert.match(truth.api.url, /%5Bredacted%5D:%5Bredacted%5D@127\.0\.0\.1:8642/);
  assert.equal(truth.api.url.includes('token=%5Bredacted%5D'), true);
  assert.equal(truth.api.url.includes('mode=local'), true);
});

test('resolveSignalLoomRuntimeConfig flags invalid and non-loopback API URLs', () => {
  const invalid = resolveSignalLoomRuntimeConfig({
    HERMES_API_URL: 'not a url',
    HERMES_API_KEY: 'secret',
  });
  assert.equal(invalid.apiUrlValid, false);
  assert.equal(invalid.issues.some((issue) => issue.code === 'invalid_api_url'), true);

  const remote = resolveSignalLoomRuntimeConfig({
    HERMES_API_URL: 'https://hermes.example.com',
    HERMES_API_KEY: 'secret',
  });
  assert.equal(remote.apiUrlValid, true);
  assert.equal(remote.apiUrlLoopback, false);
  assert.equal(remote.issues.some((issue) => issue.code === 'non_loopback_api_url'), true);
});
