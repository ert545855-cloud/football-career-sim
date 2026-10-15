import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headerContest } from '../src/games/headerLogic.js';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { planMatch, resolveMoment, momentTitle, MOMENT_INTRO } from '../src/core/match.js';

test('kafa düellosu: uzaksan ya da zamanlama kötüyse kaybedersin; markaj şansı düşürür', () => {
  assert.equal(headerContest({ dist: 2 }).won, false);
  assert.equal(headerContest({ dt: 0.6, dist: 0.2 }).why, 'late');
  assert.equal(headerContest({ dt: -0.6, dist: 0.2 }).why, 'early');
  const free = headerContest({ dt: 0, dist: 0.1, defDist: 3, skill: 0.6, rnd: () => 0.5 });
  const marked = headerContest({ dt: 0, dist: 0.1, defDist: 0.2, skill: 0.6, rnd: () => 0.5 });
  assert.ok(free.p > marked.p);
  assert.ok(headerContest({ dt: 0, dist: 0, defDist: 3, skill: 1, rnd: () => 0.5 }).p > headerContest({ dt: 0.3, dist: 1.2, defDist: 3, skill: 1, rnd: () => 0.5 }).p);
});

test('duran toplar: stoperin şut anları çoğunlukla korner; başlık ve anlatım', () => {
  setRandom(seeded(77));
  const s = newGame({ name: 'Stoper Test', position: 'DF' });
  const ctx = {};
  for (let i = 0; i < 300; i++) {
    const m = planMatch(s);
    for (const mo of m.moments) if (mo.type === 'shot') ctx[mo.context] = (ctx[mo.context] || 0) + 1;
  }
  const shots = Object.values(ctx).reduce((a, b) => a + b, 0);
  assert.ok(shots > 0 && ctx.corner / shots > 0.4, JSON.stringify(ctx));
  assert.equal(momentTitle({ type: 'shot', context: 'corner' }), 'Korner · Kafa Düellosu');
  assert.equal(momentTitle({ type: 'pass', context: 'final' }), 'Pas Anı');
  assert.ok(MOMENT_INTRO.shot.freekick && MOMENT_INTRO.shot.corner);
  const m = planMatch(s);
  const lines = resolveMoment(m, { minute: 30, type: 'shot', context: 'penalty' }, { success: true, panenka: true, outcome: 'goal' }, 'Test');
  assert.ok(lines[0].text.includes('Panenka'));
  const miss = resolveMoment(m, { minute: 40, type: 'shot', context: 'corner' }, { success: false, outcome: 'cleared' }, 'Test');
  assert.ok(miss[0].text.includes('kafa'));
  setRandom(Math.random);
});
