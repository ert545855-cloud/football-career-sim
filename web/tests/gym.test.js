import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { GYM_RULES, canGym, ensureGym, finishGym, gymInjuryMult, gymOnWeek, gymSkillMult, soreFatigue } from '../src/core/gym.js';
import { fatigueAt } from '../src/core/weather.js';
import { injuryRisk } from '../src/core/injury.js';
import { momentFatigue } from '../src/core/match.js';

const fresh = () => { setRandom(seeded(31)); const s = newGame({ name: 'Salon Test', position: 'DF' }); s.calendar.slots = 4; s.player.energy = 100; return s; };

test('salon: varsayılanlar, kazançlar ve haftalık sınır', () => {
  const s = fresh();
  const g = ensureGym(s);
  assert.equal(g.cond, GYM_RULES.condStart);
  assert.equal(g.power, GYM_RULES.powerStart);
  const r = finishGym(s, 'barbell', 1, { score: 12, label: '12 tekrar' });
  assert.ok(r.ok);
  assert.ok(r.dPower > 2, `güç +${r.dPower}`);
  assert.equal(s.calendar.slots, 3);
  assert.equal(s.player.energy, 86);
  assert.ok(g.sore > 20);
  assert.equal(g.best.barbell.score, 12);
  const r2 = finishGym(s, 'treadmill', 0.8);
  assert.ok(r2.ok && r2.dCond > 3);
  assert.equal(canGym(s, 'dumbbell').ok, false, 'haftada 2 seans');
  assert.equal(canGym(s, 'stretch').ok, true, 'esneme sınırsız');
  const st = finishGym(s, 'stretch');
  assert.ok(st.ok && g.sore < r2.sore && g.stretchWeeks === 2);
});

test('salon: kötü performans az, iyi performans çok kazandırır; tavana yaklaştıkça yavaşlar', () => {
  const a = fresh();
  const b = fresh();
  const lo = finishGym(a, 'treadmill', 0.1).dCond;
  const hi = finishGym(b, 'treadmill', 1).dCond;
  assert.ok(hi > lo * 2);
  const c = fresh();
  ensureGym(c).cond = 95;
  assert.ok(finishGym(c, 'treadmill', 1).dCond < hi * 0.7);
});

test('salon: çalışılmazsa düşer, ağrı geçer, sakatlıkta yalnız esneme', () => {
  const s = fresh();
  const g = ensureGym(s);
  g.sore = 60;
  const c0 = g.cond;
  const p0 = g.power;
  gymOnWeek(s, { trainings: 0 });
  assert.ok(g.cond < c0 && g.power < p0 && g.sore < 30);
  for (let i = 0; i < 80; i++) gymOnWeek(s, {});
  assert.ok(g.cond >= GYM_RULES.floorCond && g.power >= GYM_RULES.floorPower);
  s.flags.injuredWeeks = 2;
  assert.equal(canGym(s, 'barbell').ok, false);
  assert.equal(canGym(s, 'stretch').ok, true);
});

test('maça etkisi: kondisyon yorgunluğu, güç ikili mücadeleyi, ağrı sakatlık riskini değiştirir', () => {
  const fit = fatigueAt({ minute: 80, energy: 90, stamina: 40, cond: 95 });
  const unfit = fatigueAt({ minute: 80, energy: 90, stamina: 40, cond: 30 });
  assert.ok(fit < unfit * 0.85, `${fit} / ${unfit}`);
  assert.equal(fatigueAt({ minute: 80, energy: 90, stamina: 40 }), fatigueAt({ minute: 80, energy: 90, stamina: 40, cond: 60 }), 'varsayılan davranış değişmedi');
  const s = fresh();
  const g = ensureGym(s);
  g.power = 90;
  assert.ok(gymSkillMult(s, 'tackle') > 1.06);
  assert.ok(gymSkillMult(s, 'shot', 'corner') > gymSkillMult(s, 'shot', 'box'));
  assert.equal(gymSkillMult(s, 'pass'), 1);
  g.power = 20;
  assert.ok(gymSkillMult(s, 'tackle') < 1);
  // sakatlık
  const match = { role: 'starter', energy0: 80 };
  g.cond = 90; g.sore = 0;
  const safe = injuryRisk(s, match);
  g.cond = 30; g.sore = 70;
  const risky = injuryRisk(s, match);
  assert.ok(risky > safe * 1.3, `${safe} → ${risky}`);
  assert.ok(gymInjuryMult(s) > 1);
  // ağrıyla maça çıkmak erken yorar
  const m = { role: 'starter', energy0: 90, weather: null, sore0: soreFatigue(s) };
  const sore = momentFatigue(s, m, 70);
  g.sore = 0;
  assert.ok(sore > momentFatigue(s, { ...m, sore0: soreFatigue(s) }, 70));
});
