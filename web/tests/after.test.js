import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame, retire } from '../src/core/game.js';
import {
  coachOffers, doShow, endPunditSeason, ensureAfter, legendScore, playCoachSeason, startCoaching, startPunditry, TONES,
} from '../src/core/afterCareer.js';

const legend = () => {
  const s = newGame({ name: 'Efsane', position: 'FW' });
  s.player.age = 36;
  s.career.totals = { apps: 500, goals: 260, assists: 90, motm: 60 };
  s.career.awards = Array.from({ length: 8 }, (_, i) => ({ season: i + 1, title: 'Süper Lig Şampiyonu', icon: 'trophy' }));
  retire(s);
  return s;
};

test('futbol sonrası: efsane puanı tekliflerin seviyesini belirler', () => {
  setRandom(seeded(51));
  const rookie = newGame({ name: 'Çaylak', position: 'MF' });
  const big = legend();
  assert.ok(legendScore(big) > legendScore(rookie) + 50);
  const avg = (s) => coachOffers(s).reduce((t, o) => t + (o.clubId ? 1 : 0), 0);
  assert.ok(avg(big) >= 1 && avg(rookie) >= 1);
  const lvl = (s) => Math.max(...coachOffers(s).map((o) => o.salary));
  assert.ok(lvl(big) > lvl(rookie), 'efsaneye daha büyük kulüpler');
});

test('futbol sonrası: teknik direktör sezonları tutarlı sonuç verir', () => {
  setRandom(seeded(52));
  const s = legend();
  const offer = coachOffers(s)[0];
  startCoaching(s, offer);
  let fired = 0;
  for (let i = 0; i < 8; i++) {
    const r = playCoachSeason(s, { tactic: 'balanced', transfer: 'keep', training: 'normal' });
    assert.ok(r.position >= 1 && r.position <= 12);
    assert.ok(['extend', 'ok', 'fired'].includes(r.verdict));
    if (r.verdict === 'fired') { fired++; s.after.coach.fired = false; }
  }
  const a = ensureAfter(s);
  assert.equal(a.coach.seasons.length, 8);
  assert.ok(a.coach.rep >= 0 && a.coach.rep <= 100);
  assert.equal(a.age, 44);
});

test('futbol sonrası: yorumculuk programları ve sezon sonu', () => {
  setRandom(seeded(53));
  const s = legend();
  startPunditry(s);
  const m0 = s.career.money;
  for (let i = 0; i < 3; i++) {
    const r = doShow(s, TONES[i].id);
    assert.ok(r.fee > 0);
    assert.equal(r.done, i === 2);
  }
  assert.ok(s.career.money > m0);
  const end = endPunditSeason(s);
  assert.ok(end.bonus > 0);
  assert.equal(s.after.pundit.seasons.length, 1);
  assert.equal(s.after.pundit.showIndex, 0, 'yeni sezonun programları hazır');
});
