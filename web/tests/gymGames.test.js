import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../src/core/rng.js';
import {
  BAR, TREAD, barbellParams, barbellPress, barbellResult, barbellStep, beltKmh, createBarbell, createCurl, createTread,
  curlParams, curlPress, curlResult, curlStep, treadParams, treadResult, treadStep, treadTap,
} from '../src/games/gymLogic.js';

const DT = 1 / 60;

function runBarbell(power, strategy, seed = 3) {
  const B = createBarbell(barbellParams(power), seeded(seed));
  const rnd = seeded(seed + 1);
  for (let i = 0; i < 60 * 120 && !B.done; i++) {
    barbellStep(B, DT);
    if (B.phase === 'gauge') {
      if (strategy === 'perfect' && Math.abs(B.g - B.zoneC) < B.zoneW * 0.1) barbellPress(B);
      if (strategy === 'random' && rnd() < 0.03) barbellPress(B);
    }
  }
  return barbellResult(B);
}

test('halter: iyi zamanlama tüm setleri bitirir, rastgele basmak az, hiç basmamak hiç tekrar yapmaz', () => {
  const best = runBarbell(50, 'perfect');
  assert.equal(best.reps, BAR.setsMax * BAR.repsPerSet);
  assert.ok(best.q > 0.9, `q ${best.q}`);
  const rand = runBarbell(50, 'random');
  assert.ok(rand.q < best.q * 0.6, `rastgele ${rand.q}`);
  const none = runBarbell(50, 'none');
  assert.equal(none.reps, 0);
  assert.equal(none.q, 0);
  assert.ok(barbellParams(90).zoneW > barbellParams(20).zoneW && barbellParams(90).kg0 > barbellParams(20).kg0);
});

function runCurl(strategy) {
  const C = createCurl(curlParams(40), seeded(9));
  let i = 0;
  while (!C.done && i++ < 60 * 60) {
    curlStep(C, DT);
    const next = C.beats.find((b) => b.hit == null);
    if (next && Math.abs(C.t - next.t) < DT / 2 + 1e-9) {
      if (strategy === 'perfect') curlPress(C, next.side);
      if (strategy === 'wrong') curlPress(C, next.side === 'L' ? 'R' : 'L');
    }
  }
  return curlResult(C);
}

test('dambıl: ritme uyan yüksek, yanlış kolla basan düşük puan alır', () => {
  const p = runCurl('perfect');
  assert.ok(p.good >= 22 && p.q > 0.85, JSON.stringify(p));
  const w = runCurl('wrong');
  assert.equal(w.good, 0);
  assert.ok(w.q < 0.1);
  const n = runCurl('none');
  assert.equal(n.good, 0);
});

function runTread(strategy, cond = 60) {
  const P = treadParams(cond);
  const T = createTread(P);
  let acc = 0;
  let foot = 'L';
  while (!T.done) {
    treadStep(T, DT);
    if (strategy === 'match') {
      // bant hızına yetecek adım sıklığı (+ konuma göre düzeltme)
      const need = (beltKmh(T.t, P) / P.kmhPerTap) * (1 - T.x * 0.8);
      acc += need * DT;
      while (acc >= 1) { treadTap(T, foot); foot = foot === 'L' ? 'R' : 'L'; acc -= 1; }
    } else if (strategy === 'same') {
      acc += 4 * DT;
      while (acc >= 1) { treadTap(T, 'L'); acc -= 1; }
    }
  }
  return treadResult(T);
}

test('koşu bandı: bant hızına uyan bölgede kalır; adım atmayan düşer; aynı ayakla basmak tökezletir', () => {
  const good = runTread('match');
  assert.ok(!good.fell && good.zone > 75, JSON.stringify(good));
  const none = runTread('none');
  assert.ok(none.fell && none.q < 0.3, JSON.stringify(none));
  const same = runTread('same');
  assert.ok(same.q < good.q * 0.6, JSON.stringify(same));
  assert.ok(TREAD.duration > 20);
});
