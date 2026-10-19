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

test('hiçbir şey yapmazsan rakipler paslaşıp ara pasıyla geçer (arkadaşın ara sıra keser)', () => {
  for (const context of ['duel', 'threat']) {
    const r = tally(() => () => {}, { context });
    assert.ok(r.beaten >= 60, `${context}: ${JSON.stringify(r)}`);
    assert.ok((r.methods.cover || 0) < 20, `takım savunması tek başına kazandırmamalı: ${JSON.stringify(r)}`);
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
  assert.ok(r.won < 40, JSON.stringify(r));
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

test('kayarak müdahale: topa girersen kazanırsın, adama girersen faul', async () => {
  const { defSlide } = await import('../src/games/interceptLogic.js');
  let won = 0;
  let foul = 0;
  for (let i = 0; i < 40; i++) {
    const D = createDefense({ skill: 0.5, rnd: seeded(300 + i) });
    const c = D.att[D.carrier].body;
    const behind = i % 2 === 0;
    c.y = 22; // taşıyıcı ilerlemiş olsun (savunmacı 20% çizgisinin üstüne çıkamaz)
    D.ball.y = c.y + 0.55;
    D.me.x = c.x + 0.3;
    D.me.y = behind ? c.y - 2.4 : c.y + 2.6; // arkadan adama / önden topa
    defSlide(D, (behind ? c.x : D.ball.x) - D.me.x, (behind ? c.y : D.ball.y) - D.me.y);
    for (let k = 0; k < 60 && !D.result; k++) defenseStep(D, 1 / 60);
    if (D.result?.method === 'slide' && D.result.outcome === 'won') won++;
    if (D.result?.outcome === 'foul') foul++;
  }
  assert.ok(won > 5, `kazanılan kayış ${won}`);
  assert.ok(foul > 0, `faul ${foul}`);
});
