import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { migrate } from '../src/core/storage.js';
import {
  ACHIEVEMENTS, ACHIEVEMENT_BY_ID, achievementsOnMatch, checkAchievements, drainAchievementQueue, progressOf,
} from '../src/core/achievements.js';
import { playWeek } from '../scripts/bot.js';

test('başarımlar: kimlikler benzersiz, her tanım geçerli', () => {
  const ids = new Set();
  for (const a of ACHIEVEMENTS) {
    assert.ok(!ids.has(a.id), `tekrar eden kimlik ${a.id}`);
    ids.add(a.id);
    assert.ok(a.goal > 0 && typeof a.value === 'function' && a.title && a.desc);
  }
});

test('başarımlar: yeni kariyerde hiçbiri açık değil, değerler hatasız hesaplanır', () => {
  setRandom(seeded(11));
  const s = newGame({ name: 'Test', position: 'MF' });
  assert.deepEqual(s.achievements.unlocked, {});
  for (const a of ACHIEVEMENTS) {
    const p = progressOf(s, a);
    assert.ok(p.pct >= 0 && p.pct <= 1, a.id);
  }
  assert.equal(checkAchievements(s).length, 0);
});

test('başarımlar: hat-trick ve falsolu pas sayaçları maçtan gelir', () => {
  setRandom(seeded(12));
  const s = newGame({ name: 'Test', position: 'FW' });
  const match = {
    moments: [
      { type: 'pass', done: true, success: true, curve: -0.6 },
      { type: 'pass', done: true, success: true, curve: 0.05 },
      { type: 'tackle', done: true, success: true },
    ],
  };
  const fresh = achievementsOnMatch(s, { played: true, goals: 3, rating: 9.1, result: 'W' }, match);
  const ids = fresh.map((a) => a.id);
  for (const id of ['brace', 'hattrick', 'curve_pass']) assert.ok(ids.includes(id), `${id} açılmalı`);
  assert.equal(s.achievements.c.curvedPasses, 1);
  assert.equal(s.achievements.c.tackles, 1);
  assert.equal(s.achievements.c.winStreak, 1);
  // kuyruk bir kez boşaltılır
  assert.equal(drainAchievementQueue(s).length, fresh.length);
  assert.equal(drainAchievementQueue(s).length, 0);
  // tekrar açılmaz
  assert.equal(achievementsOnMatch(s, { played: true, goals: 3, rating: 9, result: 'L' }, { moments: [] }).length, 0);
  assert.equal(s.achievements.c.winStreak, 0);
});

test('başarımlar: açılan rozet, ölçü düşse de açık kalır (ör. para)', () => {
  setRandom(seeded(13));
  const s = newGame({ name: 'Test', position: 'DF' });
  s.career.money = 1_200_000;
  assert.ok(checkAchievements(s).some((a) => a.id === 'millionaire'));
  s.career.money = 10;
  const p = progressOf(s, ACHIEVEMENT_BY_ID.millionaire);
  assert.ok(p.unlocked);
  assert.equal(p.pct, 1);
});

test('başarımlar: otomatik kariyerde ilk rozetler açılır, eski kayıt güvenle yüklenir', () => {
  setRandom(seeded(14));
  const s = newGame({ name: 'Bot', position: 'FW' });
  for (let w = 0; w < 30; w++) playWeek(s, 0.6);
  checkAchievements(s);
  const got = Object.keys(s.achievements.unlocked);
  assert.ok(got.includes('debut'), 'ilk maç rozeti');
  assert.ok(s.achievements.c.trainings > 10, 'antrenman sayacı');
  for (const id of got) assert.ok(s.achievements.unlocked[id].s >= 1);

  const old = JSON.parse(JSON.stringify(s));
  delete old.achievements;
  const m = migrate(old);
  assert.ok(m.achievements && m.achievements.unlocked && m.achievements.c);
});
