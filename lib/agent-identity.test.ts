import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addressAgentPrompt,
  buildAgentIdentity,
  initialsForAgentName,
  slugifyAgentName,
} from './agent-identity.ts';

test('buildAgentIdentity normalizes customizable names without defaulting to Nero', () => {
  assert.deepEqual(buildAgentIdentity({ name: '  Athena  ', source: 'env' }), {
    id: 'athena',
    name: 'Athena',
    initials: 'AT',
    roleLabel: 'Operator',
    source: 'env',
  });
});

test('buildAgentIdentity falls back to generic Hermes Agent identity', () => {
  const identity = buildAgentIdentity();
  assert.equal(identity.name, 'Hermes Agent');
  assert.equal(identity.id, 'hermes-agent');
  assert.equal(identity.source, 'fallback');
});

test('agent identity helpers support multi-word and non-ascii names', () => {
  assert.equal(slugifyAgentName('Oracle Prime'), 'oracle-prime');
  assert.equal(initialsForAgentName('Oracle Prime'), 'OP');
  assert.equal(initialsForAgentName('元宝'), '元宝');
  assert.equal(addressAgentPrompt(buildAgentIdentity({ name: 'Oracle Prime' }), 'summarize this'), 'Oracle Prime: summarize this');
});
