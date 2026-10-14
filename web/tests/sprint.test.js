import test from 'node:test';
import assert from 'node:assert/strict';
import { sprintParams, createRun, runStep, runTick, simulateRun, idealTime, targetTime, stepQuality, ghostTrace } from '../src/games/sprintLogic.js';

test('sürat statı koşucuyu gerçekten hızlandırır (hedef de potansiyele göre)', () => {
  const lo = sprintParams(0.1);
  const hi = sprintParams(0.9);
  assert.ok(hi.vmax > lo.vmax);
  assert.ok(idealTime(hi) < idealTime(lo) - 0.5);
  assert.ok(targetTime(hi) < targetTime(lo));
  for (const P of [lo, hi]) assert.ok(targetTime(P) > idealTime(P), 'hedef kusursuz koşudan biraz yavaş');
  const t = idealTime(sprintParams(0.5));
  assert.ok(t > 6.8 && t < 9.5, `60 m ≈ 7–9 sn (${t})`);
});

test('ritim kazanır: tuşlara deli gibi basmak (spam) ve çok hızlı basmak hedefi kaçırır', () => {
  for (const sk of [0.2, 0.8]) {
    const P = sprintParams(sk);
    const tgt = targetTime(P);
    const mid = (P.win[0] + P.win[1]) / 2;
    assert.ok(simulateRun(P, () => mid).time < tgt);
    assert.ok(simulateRun(P, () => 0.07).time > tgt * 1.15, 'spam');
    assert.ok(simulateRun(P, () => 0.12).time > tgt, 'çok hızlı (pencere öncesi)');
    assert.ok(simulateRun(P, () => 0.5).time > tgt, 'çok yavaş');
  }
  assert.equal(stepQuality(0.2, sprintParams(0.5)).label, 'perfect');
  assert.equal(stepQuality(0.05, sprintParams(0.5)).label, 'spam');
});

test('aynı ayak iki kez: tökezleme; BAŞLA demeden basmak: hatalı çıkış cezası', () => {
  const P = sprintParams(0.5);
  const R = createRun();
  assert.equal(runStep(R, P, 'L', 0).label, 'false');
  R.go = true;
  runStep(R, P, 'L', 0.2);
  runStep(R, P, 'R', 0.4);
  const v = R.v;
  assert.equal(runStep(R, P, 'R', 0.6).label, 'stumble');
  assert.ok(R.v < v);
  // ceza bitiş süresine eklenir
  const clean = simulateRun(P, () => 0.2).time;
  const S = createRun();
  S.falseStarts = 1;
  S.go = true;
  let side = 'L';
  let next = 0.2;
  while (!S.finished) {
    if (S.t >= next) { runStep(S, P, side, S.t); side = side === 'L' ? 'R' : 'L'; next = S.t + 0.2; }
    runTick(S, P, 1 / 120);
  }
  assert.ok(Math.abs(S.time - clean - P.falsePenalty) < 0.05);
});

test('dayanıklılık: körlemesine depar nefesi bitirir; nefese bakarak tempo tutan hedefi geçer', () => {
  const P = sprintParams(0.9, 'endurance');
  const tgt = targetTime(P);
  const lo = P.win[0];
  const hi = P.win[1];
  const mid = (lo + hi) / 2;
  const blind = simulateRun(P, () => lo + 0.02);
  assert.ok(blind.time > tgt, `kör depar ${blind.time} > ${tgt}`);
  let wins = 0;
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 20; i++) {
    const R = simulateRun(P, (r) => (r.x > P.distance - 30 && r.stam > 15 ? lo + 0.02 : r.stam < 35 ? hi - 0.02 : mid) + (rnd() - 0.5) * 0.1);
    if (R.time <= tgt) wins++;
  }
  assert.ok(wins >= 16, `${wins}/20`);
});

test('hedef koşucu izi: başta 0, hedef sürede bitişte', () => {
  const P = sprintParams(0.5);
  const g = ghostTrace(P);
  assert.equal(g(0), 0);
  assert.ok(Math.abs(g(targetTime(P)) - P.distance) < 1.5);
  assert.ok(g(1) < g(2));
});
