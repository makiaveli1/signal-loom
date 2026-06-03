import test from 'node:test';
import assert from 'node:assert/strict';
import { DESKTOP_CAPABILITIES, shouldExposeNativeControls, summarizeDesktopCapabilities } from './desktop-capabilities.ts';

test('desktop capability model keeps browser fallbacks for every native feature', () => {
  assert.ok(DESKTOP_CAPABILITIES.length >= 5);
  for (const capability of DESKTOP_CAPABILITIES) {
    assert.ok(capability.browserFallback.length > 20, capability.id);
    assert.ok(capability.guardrail.length > 20, capability.id);
    assert.notEqual(capability.tauriScope.toLowerCase(), 'execute shell');
  }
});

test('desktop summary separates available and planned native work', () => {
  const summary = summarizeDesktopCapabilities();
  assert.equal(summary.available, 1);
  assert.ok(summary.planned >= 4);
  assert.ok(summary.risky >= 3);
});

test('native controls require both tauri runtime and explicit desktop mode', () => {
  assert.equal(shouldExposeNativeControls({ isTauri: false, explicitDesktopMode: true }), false);
  assert.equal(shouldExposeNativeControls({ isTauri: true, explicitDesktopMode: false }), false);
  assert.equal(shouldExposeNativeControls({ isTauri: true, explicitDesktopMode: true }), true);
});
