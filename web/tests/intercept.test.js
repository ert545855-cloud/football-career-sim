import test from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../src/core/rng.js';
import { createDefense, defenseStep, defMoveTo, defLunge, simulateDefense, readingPolicy, interceptSkill, laneGap } from '../src/games/interceptLogic.js';

function tally(mk, { skill = 0.5, context = 'duel', n = 80, seed = 900 } = {}) {
  const out = { won: 0, beaten: 0, methods: {} };
  for (let i = 0; i < n; i++) {
    const rnd = seeded(seed + i);
    const D = simulateDefense(mk(rnd), { skill, context, rnd });
    out[D.result.outcome]++;
    out.methods[D.result.method] = (out.methods[D.result.method] || 0) + 1;
  }
  return out;
}

test('hiçbir şey yapmazsan rakipler paslaşıp ara pasıyla geçer', () => {
  for (const context of ['duel', 'threat']) {
    const r = tally(() => () => {}, { context });
    assert.ok(r.beaten >= 76, `${context}: ${JSON.stringify(r)}`);
  }
});

test('bakışı okuyup koridora koşan ve zamanında uzanan savunmacı pası keser', () => {
  for (const context of ['duel', 'threat']) {
    const r = tally(() => readingPolicy(0.2), { context, skill: 0.6 });
    assert.ok(r.won >= 60, `${context}: ${JSON.stringify(r)}`);
    assert.ok((r.methods.lunge || 0) + (r.methods.intercept || 0) > 40);
  }
});

test('rastgele koşmak işe yaramaz', () => {
  const r = tally((rnd) => { let next = 0; return (D) => { if (D.t > next) { defMoveTo(D, rnd() * D.Wm, D.Hm * (0.3 + rnd() * 0.5)); next = D.t + 0.8; } }; });
  assert.ok(r.won < 35, JSON.stringify(r));
});

test('top sahibine yapışıp ıskalarsan sıyrılır; savunmacı kısa süre dengesini toparlar', () => {
  let shrugs = 0;
  for (let i = 0; i < 40; i++) {
    const D = createDefense({ skill: 0.1, rnd: seeded(40 + i) });
    const c = D.att[D.carrier].body;
    D.me.x = c.x;
    D.me.y = c.y + 1.0;
    defLunge(D);
    for (const e of D.events) if (e.type === 'shrug') { shrugs++; assert.ok(D.me.stun > 0); }
  }
  assert.ok(shrugs > 10);
  const a = interceptSkill(0.1);
  const b = interceptSkill(0.9);
  assert.ok(b.defSpeed > a.defSpeed && b.lungeReach > a.lungeReach && b.look > a.look && b.decoy < a.decoy);
});

test('koridor ölçümü ve pas sayacı', () => {
  const D = createDefense({ rnd: seeded(5) });
  D.me.x = 10;
  D.me.y = 10;
  assert.ok(laneGap(D, { x: 0, y: 10 }, { x: 20, y: 10 }) < 1e-9);
  assert.ok(Math.abs(laneGap(D, { x: 0, y: 0 }, { x: 20, y: 0 }) - 10) < 1e-9);
  let k = 0;
  while (!D.result && k++ < 60 * 30) defenseStep(D, 1 / 60);
  assert.ok(D.result.passes >= 1);
});
