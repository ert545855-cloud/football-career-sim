import test from 'node:test';
import assert from 'node:assert/strict';
import { shuttleParams, levelSpeed, deadlineOf, levelOf, createShuttle, shuttleStep, setHold, pressTurn, simulateShuttle, pacedShuttlePolicy, shuttleResult, SHUTTLE_M } from '../src/games/shuttleLogic.js';

const always = (R) => ({ hold: true, turn: Math.abs((R.dir > 0 ? SHUTTLE_M : 0) - R.x) < 1.5 });
const noTurn = (R) => ({ ...pacedShuttlePolicy(R), turn: false });

test('bip testi: seviyeler hızlanır, bip anları birikimli', () => {
  assert.ok(levelSpeed(5) > levelSpeed(1));
  assert.ok(deadlineOf(1) > deadlineOf(0));
  assert.equal(levelOf(0), 1);
  assert.equal(levelOf(2), 2);
  const a = shuttleParams(0.1);
  const b = shuttleParams(0.9);
  assert.ok(b.vmax > a.vmax && b.easy > a.easy && b.targetLevel > a.targetLevel);
});

test('tempo ayarı kazanır: nefese göre koşan hedefe ulaşır; hep basılı tutan nefessiz kalır', () => {
  for (const sk of [0.1, 0.5, 0.9]) {
    const P = shuttleParams(sk);
    const paced = simulateShuttle(P, pacedShuttlePolicy, { maxLevel: 20 });
    const all = simulateShuttle(P, always, { maxLevel: 20 });
    assert.ok(paced.res.success, `${sk}: tempolu koşu hedefe ulaşır (${paced.res.level} / ${P.targetLevel})`);
    assert.ok(paced.R.n > all.R.n, `${sk}: tempolu (${paced.R.n}) > hep basılı (${all.R.n})`);
  }
  assert.ok(simulateShuttle(shuttleParams(0.1), always, { maxLevel: 20 }).res.gassed, 'hep basılı: nefes biter');
});

test('dönüş zamanlaması: DÖN\'e basmadan dönmek seviye kaybettirir', () => {
  const P = shuttleParams(0.6);
  const good = simulateShuttle(P, pacedShuttlePolicy, { maxLevel: 20 });
  const bad = simulateShuttle(P, noTurn, { maxLevel: 20 });
  assert.ok(good.R.n > bad.R.n + 2, `${good.R.n} vs ${bad.R.n}`);
  assert.ok(good.res.perfectTurns > 3);
});

test('erken varan bip\'i bekler; iki kez üst üste geç kalan elenir', () => {
  const P = shuttleParams(0.5);
  const R = createShuttle(P);
  setHold(R, true);
  let waited = false;
  for (let i = 0; i < 60 * 12 && !R.over; i++) {
    if (Math.abs(SHUTTLE_M - R.x) < 2 && R.dir > 0) pressTurn(R);
    shuttleStep(R, 1 / 60);
    if (R.n === 1 && R.t < R.leaveAt) { waited = true; setHold(R, false); }
  }
  assert.ok(waited, 'ilk mekikte erken varıp bekledi');
  const L = createShuttle(P);
  for (let i = 0; i < 60 * 40 && !L.over; i++) {
    setHold(L, i % 5 === 0); // çok yavaş
    shuttleStep(L, 1 / 60);
  }
  assert.ok(L.over);
  const res = shuttleResult(L);
  assert.equal(res.outcome, 'late');
  assert.equal(res.success, false);
});
