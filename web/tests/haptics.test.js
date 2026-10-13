import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAPTICS, configureHaptics, haptic, iosSchedule, scalePattern } from '../src/haptics.js';

test('titreşim: desenler ve güç ölçeği (aralar değişmez)', () => {
  assert.ok(HAPTICS.goal.reduce((a, b) => a + b, 0) > HAPTICS.pass.reduce((a, b) => a + b, 0), 'gol pastan uzun hissedilir');
  for (const [k, p] of Object.entries(HAPTICS)) {
    assert.ok(Array.isArray(p) && p.length % 2 === 1, `${k}: titreşimle başlayıp titreşimle biter`);
    assert.ok(p.every((v) => v > 0 && v <= 400), k);
  }
  assert.deepEqual(scalePattern([10, 40, 20], 2), [20, 40, 40]);
  assert.deepEqual(scalePattern(30, 0.5), [15]);
});

test('titreşim: iPhone tık planı (uzun parça birkaç tık, en fazla 10)', () => {
  assert.deepEqual(iosSchedule([16]), [0]);
  const goal = iosSchedule(HAPTICS.goal);
  assert.ok(goal.length >= 5 && goal.length <= 10);
  for (let i = 1; i < goal.length; i++) assert.ok(goal[i] > goal[i - 1]);
});

test('titreşim: navigator.vibrate ile çalışır, kapalıyken susar', () => {
  const calls = [];
  const nav = globalThis.navigator;
  if (!nav) return;
  const had = 'vibrate' in nav;
  try {
    Object.defineProperty(nav, 'vibrate', { value: (p) => calls.push(p), configurable: true, writable: true });
  } catch {
    return; // ortam izin vermiyor
  }
  configureHaptics({ vibrate: true, haptic: 'strong' });
  haptic('kick');
  assert.deepEqual(calls[0], Math.round(HAPTICS.kick[0] * 1.6));
  haptic('pass');
  assert.equal(calls[1][1], HAPTICS.pass[1]);
  configureHaptics({ vibrate: false });
  haptic('goal');
  assert.equal(calls.length, 2);
  configureHaptics({ vibrate: true, haptic: 'normal' });
  if (!had) delete nav.vibrate;
});
