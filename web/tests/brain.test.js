import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { weeklyFinance } from '../src/core/economy.js';
import { selection } from '../src/core/match.js';
import { playWeek } from '../scripts/bot.js';
import {
  acwrLive, brainInjuryMult, brainNote, brainOnWeek, brainSkillMult, ensureBrain, fatPctOf, setDiet, spriteBuild, weightOf,
} from '../src/core/brain/index.js';

const fresh = (seed = 5, pos = 'FW') => {
  setRandom(seeded(seed));
  return newGame({ name: 'Beyin Test', position: pos });
};

/** n hafta aynı yaşam: week(s) deftere yazar, sonra hafta kapanır */
function live(s, n, week, { mins = 90, rating = 6.8 } = {}) {
  for (let i = 0; i < n; i++) {
    s.calendar.week = 1 + (i % 30);
    week(s);
    const sm = { played: mins > 0, rating, result: 'D', goals: 0 };
    brainNote(s, 'match', { summary: sm, match: { role: 'starter', subOff: mins, moments: [] }, opp: 'Rakip' });
    brainOnWeek(s, { summary: sm });
  }
}
const gymWeek = (s) => { brainNote(s, 'gym', { station: 'barbell', q: 0.85 }); brainNote(s, 'gym', { station: 'dumbbell', q: 0.8 }); brainNote(s, 'train', { stars: 2 }); brainNote(s, 'train', { stars: 2 }); };
const lazyWeek = (s) => { brainNote(s, 'action', { id: 'rest' }); brainNote(s, 'action', { id: 'rest' }); brainNote(s, 'event', { id: 'nightclub', energy: -25 }); brainNote(s, 'outing', { venueId: 'bar' }); };

test('salon + protein kası büyütür; salonsuz ve sakatlıkta kas erir', () => {
  const a = fresh(1);
  const b = fresh(1);
  const m0 = ensureBrain(a).body.muscle;
  setDiet(a, 'protein');
  ensureBrain(b);
  live(a, 20, gymWeek);
  live(b, 20, (s) => { brainNote(s, 'action', { id: 'rest' }); }, { mins: 0 });
  assert.ok(a.brain.body.muscle - m0 > 2.2, `salon: +${(a.brain.body.muscle - m0).toFixed(2)} kg`);
  assert.ok(a.brain.body.muscle - b.brain.body.muscle > 2, 'salonsuz çok daha az');
  // sakatlık: 6 hafta hareketsiz
  const c = fresh(2);
  c.player.age = 26;
  const before = ensureBrain(c).body.muscle;
  c.flags.injuredWeeks = 6;
  live(c, 6, () => {}, { mins: 0 });
  assert.ok(c.brain.body.muscle < before - 0.4, 'sakatlıkta kas kaybı');
});

test('gece hayatı + serbest beslenme yağ ekler, yağ yakımı planı indirir', () => {
  const s = fresh(3);
  const f0 = fatPctOf(ensureBrain(s).body);
  setDiet(s, 'free');
  live(s, 24, lazyWeek, { mins: 30 });
  const f1 = fatPctOf(s.brain.body);
  assert.ok(f1 > f0 + 4, `yağ ${f0.toFixed(1)} → ${f1.toFixed(1)}`);
  assert.ok(s.brain.traits.nightowl, 'Gece Kuşu özelliği oluştu');
  assert.ok(brainSkillMult(s, 'dribble') < 0.97, 'kilolu oyuncu çalımda yavaş');
  setDiet(s, 'cut');
  live(s, 16, (x) => { brainNote(x, 'gym', { station: 'treadmill', q: 0.8 }); brainNote(x, 'train', { stars: 2 }); brainNote(x, 'train', { stars: 2 }); });
  assert.ok(fatPctOf(s.brain.body) < f1 - 3, 'yağ yakımı işe yaradı');
  assert.ok(!s.brain.traits.nightowl, 'alışkanlık bırakılınca özellik kaybolur');
});

test('boy 21 yaşına kadar hedefe uzar, sonra durur', () => {
  const s = fresh(4);
  const b = ensureBrain(s).body;
  const h0 = b.height;
  live(s, 30, gymWeek);
  assert.ok(b.height > h0 && b.height <= b.heightTarget + 1e-9);
  s.player.age = 22;
  const h1 = b.height;
  live(s, 10, gymWeek);
  assert.equal(b.height, h1);
});

test('alışkanlıktan özellik: Salon Tutkunu; etkiler sınırlı; kaslı sprite', () => {
  const s = fresh(6, 'DF');
  setDiet(s, 'protein');
  live(s, 26, gymWeek);
  assert.ok(s.brain.traits.gymrat, 'Salon Tutkunu');
  const t = brainSkillMult(s, 'tackle', 'duel');
  assert.ok(t > 1.02 && t <= 1.12, `ikili mücadele çarpanı ${t}`);
  for (const ty of ['shot', 'pass', 'tackle', 'dribble', 'attack']) {
    const v = brainSkillMult(s, ty, 'box');
    assert.ok(v >= 0.82 && v <= 1.12 && Number.isFinite(v));
  }
  assert.equal(spriteBuild(s.brain.body), 'muscular');
  assert.ok(s.brain.thought?.text?.length > 5, 'iç ses konuşuyor');
});

test('ani yük artışı (akut:kronik) sakatlık riskini artırır', () => {
  const s = fresh(7);
  ensureBrain(s);
  // birkaç hafta hafif yük (dinlenme, maç yok): kronik yük düşer
  live(s, 5, (x) => brainNote(x, 'action', { id: 'rest' }), { mins: 0 });
  const base = brainInjuryMult(s);
  for (let i = 0; i < 3; i++) brainNote(s, 'train', { stars: 1 });
  brainNote(s, 'gym', { station: 'barbell', q: 1 });
  brainNote(s, 'gym', { station: 'treadmill', q: 1 });
  brainNote(s, 'action', { id: 'drill' });
  assert.ok(acwrLive(s, { withMatch: false }) > 1.45);
  assert.ok(brainInjuryMult(s) > base * 1.05);
});

test('hoca kiloyu fark eder, süre koyar; tutmazsan kenara çeker', () => {
  const s = fresh(8);
  const b = ensureBrain(s);
  b.body.fat = weightOf(b.body) * 0.2;
  live(s, 1, () => {}, { mins: 90 });
  const ex = b.npc.expect.find((e) => e.key === 'fat');
  assert.ok(ex, 'hoca yağ oranı için süre verdi');
  const rel0 = s.player.rel.manager;
  setDiet(s, 'free');
  live(s, 6, lazyWeek, { mins: 20 });
  assert.ok(!b.npc.expect.find((e) => e.key === 'fat'), 'beklenti kapandı');
  assert.ok(s.player.rel.manager < rel0, 'hoca güveni düştü');
  assert.ok(selection(s).score < selection({ ...s, brain: null }).score, 'formsuz bedeni kadro kararını etkiler');
});

test('beslenme planı haftalık gidere eklenir; tam oyunda beyin bozulmadan çalışır', () => {
  const s = fresh(9, 'MF');
  const n0 = weeklyFinance(s).net;
  setDiet(s, 'protein');
  assert.equal(n0 - weeklyFinance(s).net, 90);
  setDiet(s, 'balanced');
  for (let i = 0; i < 12; i++) playWeek(s, 0.6);
  const b = s.brain;
  assert.ok(b.body.hist.length >= 10);
  for (const v of [b.body.muscle, b.body.fat, b.body.height, b.mind.stress, b.mind.conf, b.mind.focus, b.mind.sleep]) assert.ok(Number.isFinite(v));
  assert.ok(b.thought.text);
  assert.ok(b.memories.length >= 0);
});
