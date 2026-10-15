import test from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame, trainingSetup, finishTraining } from '../src/core/game.js';
import { starsFor, coachTip, fatigueFactor, hardMasters, DIFFICULTY } from '../src/core/training.js';
import { ensureAchievements, checkAchievements } from '../src/core/achievements.js';

const fresh = () => {
  setRandom(seeded(21));
  return newGame({ name: 'Deniz Kaya', position: 'MF' });
};

test('zorluk: etkin yeteneği kaydırır; zor antrenman başarıda daha çok geliştirir', () => {
  const s = fresh();
  const e = trainingSetup(s, 'passing', 'easy');
  const n = trainingSetup(s, 'passing', 'normal');
  const h = trainingSetup(s, 'passing', 'hard');
  assert.ok(e.skill > n.skill && n.skill > h.skill);
  const ok = { success: true, accuracy: 0.9, outcome: 'success' };
  const a = fresh();
  a.player.energy = 100;
  const p0 = a.player.progress.passing + a.player.stats.passing;
  finishTraining(a, 'passing', ok, 'normal');
  const gN = a.player.progress.passing + a.player.stats.passing - p0;
  const b = fresh();
  b.player.energy = 100;
  const q0 = b.player.progress.passing + b.player.stats.passing;
  finishTraining(b, 'passing', ok, 'hard');
  const gH = b.player.progress.passing + b.player.stats.passing - q0;
  assert.ok(gH > gN * 1.25, `${gH} > ${gN}`);
  assert.equal(DIFFICULTY.hard.gain, 1.35);
});

test('yıldız ve rekor: başarısız 0, isabete göre 1–3; rekor yalnız iyileşince', () => {
  assert.equal(starsFor({ success: false }), 0);
  assert.equal(starsFor({ success: true, accuracy: 0.2 }), 1);
  assert.equal(starsFor({ success: true, accuracy: 0.6 }), 2);
  assert.equal(starsFor({ success: true, accuracy: 0.9 }), 3);
  const s = fresh();
  const r1 = finishTraining(s, 'shooting', { success: true, accuracy: 0.6, outcome: 'goal' }, 'hard');
  assert.equal(r1.stars, 2);
  assert.equal(r1.newBest, true);
  const r2 = finishTraining(s, 'shooting', { success: true, accuracy: 0.3, outcome: 'goal' }, 'hard');
  assert.equal(r2.newBest, false);
  assert.equal(r2.best, 2);
  assert.equal(s.training.best.shooting.hard, 2);
  assert.ok(r1.tip.text.length > 5);
});

test('yorgunluk: enerji düşükken verim düşer', () => {
  assert.equal(fatigueFactor(80), 1);
  assert.ok(fatigueFactor(40) < 1 && fatigueFactor(20) < fatigueFactor(40));
  const ok = { success: true, accuracy: 0.8, outcome: 'goal' };
  const a = fresh();
  a.player.energy = 90;
  const r1 = finishTraining(a, 'shooting', ok, 'normal');
  const b = fresh();
  b.player.energy = 20;
  const r2 = finishTraining(b, 'shooting', ok, 'normal');
  assert.equal(r1.fatigue, 1);
  assert.ok(r2.fatigue < 1);
});

test('hoca yorumu sonuca göre değişir', () => {
  assert.match(coachTip('tackle', { success: true, method: 'lunge' }).text, /Pas arası/);
  assert.match(coachTip('tackle', { success: false, outcome: 'beaten', method: 'dribble' }).text, /uzak/);
  assert.match(coachTip('pass', { success: false, outcome: 'intercept' }).text, /kavis/);
  assert.match(coachTip('dribble', { success: false, clean: 3, rows: 8 }).text, /yüklen/);
  assert.match(coachTip('shuttle', { success: false, gassed: true }).text, /Nefes/);
  assert.match(coachTip('shuttle', { success: true, level: '6.1', perfectTurns: 5 }).text, /Seviye 6.1/);
  assert.equal(coachTip('shot', { success: true, accuracy: 0.9 }).tone, 'good');
});

test('başarım: 3 farklı antrenmanda Zor seviyede 3 yıldız', () => {
  const s = fresh();
  ensureAchievements(s);
  for (const k of ['shooting', 'passing', 'speed']) finishTraining(s, k, { success: true, accuracy: 0.95, outcome: 'x' }, 'hard');
  assert.equal(hardMasters(s), 3);
  checkAchievements(s);
  assert.ok(s.achievements.unlocked.drill_master);
});
