import test from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../src/core/rng.js';
import { createDuel, duelStep, duelPoke, duelSlide, duelMoveTo, ballLoose, inPokeReach, tackleSkill } from '../src/games/tackleLogic.js';

function play(policy, { skill = 0.5, n = 120, threat = false, seed = 500 } = {}) {
  const out = { won: 0, beaten: 0, early: 0, foul: 0, card: 0, methods: {}, t: 0 };
  for (let i = 0; i < n; i++) {
    const rnd = seeded(seed + i);
    const D = createDuel({ skill, threat, rnd });
    let k = 0;
    while (!D.result && k++ < 20000) {
      policy(D, rnd);
      duelStep(D, 1 / 120);
      D.events.length = 0;
    }
    out[D.result.outcome]++;
    if (D.result.card) out.card++;
    if (D.result.method) out.methods[D.result.method] = (out.methods[D.result.method] || 0) + 1;
    out.t += D.t / n;
  }
  return out;
}
// insan gibi: fırsatı görünce 0.25 sn sonra dürt
const pokeHuman = (D) => {
  if (D._p == null && ballLoose(D) && inPokeReach(D)) D._p = D.t + 0.25;
  if (D._p != null && D.t >= D._p) { duelPoke(D); D._p = null; }
};

test('hiçbir şey yapmazsan çoğunlukla geçilirsin (otomatik jokey tek başına yetmez)', () => {
  const r = play(() => {}, { skill: 0.5 });
  assert.ok(r.beaten > r.won * 1.8, JSON.stringify(r));
  assert.ok(r.t > 2 && r.t < 9, `süre ${r.t}`);
});

test('top ayağından açıldığında zamanında dürtmek kazandırır; yetenek oranı artırır', () => {
  const none = play(() => {}, { skill: 0.5 });
  const lo = play(pokeHuman, { skill: 0.15 });
  const hi = play(pokeHuman, { skill: 0.9 });
  assert.ok(lo.won > none.won, `${lo.won} > ${none.won}`);
  assert.ok(hi.won > lo.won, `yetenek: ${hi.won} > ${lo.won}`);
  assert.ok(hi.methods.poke > 20);
});

test('top açıkken kayarak müdahale çoğunlukla temiz; adama doğru kaymak faul ve kart getirir', () => {
  const clean = play((D) => {
    const dx = D.ball.x - D.def.x;
    const dy = D.ball.y - D.def.y;
    if (ballLoose(D) && Math.hypot(dx, dy) < 2.2) duelSlide(D, dx, dy);
  }, { skill: 0.6 });
  assert.ok(clean.won > clean.foul * 3, JSON.stringify(clean));
  assert.ok(clean.methods.slide > 50);
  const dirty = play((D) => {
    const dx = D.att.x - D.def.x;
    const dy = D.att.y - D.def.y;
    if (!ballLoose(D) && Math.hypot(dx, dy) < 2.0) duelSlide(D, dx, dy);
  }, { skill: 0.3 });
  assert.ok(dirty.foul > 15, JSON.stringify(dirty));
  assert.ok(dirty.card > 0, 'sarı kart çıkabilir');
});

test('erken (topa uzakken) kaymak: yerde kalırsın, "erken daldın"', () => {
  const r = play((D) => {
    const dx = D.ball.x - D.def.x;
    const dy = D.ball.y - D.def.y;
    if (!D._done && Math.hypot(dx, dy) < 7.5) { D._done = duelSlide(D, dx, dy); }
  }, { skill: 0.4 });
  assert.ok(r.early + r.beaten > r.won, JSON.stringify(r));
  assert.ok(r.early > 0);
});

test('sürükleyerek pozisyon: savunmacı parmağı ataletle takip eder, sahadan çıkmaz', () => {
  const D = createDuel({ skill: 0.5, rnd: seeded(3) });
  duelMoveTo(D, 2, D.Hm * 0.5);
  const x0 = D.def.x;
  for (let i = 0; i < 30; i++) duelStep(D, 1 / 120);
  assert.ok(D.def.x < x0 && D.def.x > 2, 'ivmeyle yola çıktı, henüz varmadı');
  duelMoveTo(D, -50, 999);
  for (let i = 0; i < 600 && !D.result; i++) duelStep(D, 1 / 120);
  assert.ok(D.def.x >= 0.5 && D.def.y <= D.Hm);
  const a = tackleSkill(0.1);
  const b = tackleSkill(0.9);
  assert.ok(b.defSpeed > a.defSpeed && b.reach > a.reach && b.react < a.react);
});
