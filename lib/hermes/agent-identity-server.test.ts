import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAgentNameFromSoul, resolveAgentIdentity } from './agent-identity-server.ts';

test('extractAgentNameFromSoul reads identity from SOUL heading', () => {
  assert.equal(extractAgentNameFromSoul('# SOUL.md — Athena for Hermes\n'), 'Athena');
});

test('extractAgentNameFromSoul reads identity from body declaration', () => {
  assert.equal(extractAgentNameFromSoul('## Identity\n\nYou are **Daedalus**, running on Hermes Agent.'), 'Daedalus');
});

test('resolveAgentIdentity prefers explicit env customization', () => {
  const identity = resolveAgentIdentity({ env: { SIGNAL_LOOM_AGENT_NAME: 'Oracle Prime' }, hermesHome: '/definitely/missing' });
  assert.equal(identity.name, 'Oracle Prime');
  assert.equal(identity.id, 'oracle-prime');
  assert.equal(identity.source, 'env');
});
