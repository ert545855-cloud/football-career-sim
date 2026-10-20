import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IV_TOTAL, IV_ZONES, createInterval, intervalParams, intervalResult, intervalStep, jump, nextHurdle, segmentAt } from '../src/games/intervalLogic.js';

/** Basit kontrolcü: bölgenin ortasını hedefler; engelden önce zıplar */
function run(cond, mode) {
  const P = intervalParams(0.5, cond);
  const R = createInterval(P);
  const dt = 1 / 30;
  while (!R.done) {
    const seg = segmentAt(R.t);
    const [lo, hi] = IV_ZONES[seg.kind];
    if (mode === 'smart') {
      // nabız gecikmesini hesaba katan hız hedefi
      const vT = ((lo + hi) / 2 - 78) / P.hrGain;
      R.hold = R.v < vT;
      const h = nextHurdle(R);
      if (h && h.x - R.x < Math.max(0.6, R.v * 0.25) && R.air <= 0) jump(R);
    } else if (mode === 'full') R.hold = true;
    else R.hold = false;
    intervalStep(R, dt);
  }
  return intervalResult(R);
}

test('kondisyon parkuru: akıllı tempo bölgede kalır, tam gaz ve hiç basmamak başarısız', () => {
  const smart = run(60, 'smart');
  const full = run(60, 'full');
  const idle = run(60, 'idle');
  assert.ok(smart.success, `akıllı tempo başarılı: ${JSON.stringify(smart)}`);
  assert.ok(smart.zone > full.zone && smart.zone > idle.zone, `${smart.zone} > ${full.zone}, ${idle.zone}`);
  assert.ok(!idle.success);
  assert.ok(full.hits > 0 || !full.success);
});

test('kondisyon parkuru: düşük kondisyonla aynı hızda nabız daha yüksek', () => {
  const lo = intervalParams(0.5, 25);
  const hi = intervalParams(0.5, 90);
  assert.ok(lo.hrGain > hi.hrGain * 1.2);
  // tam gaz sprintte düşük kondisyonlu oyuncu kırmızı bölgeye girer, yüksek kondisyonlu girmez
  assert.ok(78 + lo.vmax * lo.hrGain > 190);
  assert.ok(78 + hi.vmax * hi.hrGain < 190);
  assert.ok(IV_TOTAL > 25 && IV_TOTAL < 40);
});
