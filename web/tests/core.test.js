import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLUBS, LEAGUES, STAT_KEYS } from '../src/core/data.js';
import { roundsFor, seasonWeeks } from '../src/core/calendar.js';
import { setRandom, seeded } from '../src/core/rng.js';
import { roundRobin, createWorld, simulateWeek, sortedTable, worldWeeks } from '../src/core/league.js';
import { newGame, endSeason, doAction, canDoAction } from '../src/core/game.js';
import { EVENTS, resolveEvent } from '../src/core/events.js';
import { createPlayer, ovr, effectiveSkill, addProgress, cleanName } from '../src/core/player.js';
import { generateOffers, buyItem, sellItem, wageFor } from '../src/core/economy.js';
import { playWeek } from '../scripts/bot.js';

/** Fikstür denetimi: her çift tam `legs` kez, bir takım bir turda en çok bir kez, tek sayıda takımda her turda tek bay */
function checkFixture(ids, legs) {
  const rounds = roundRobin(ids, Math.random, legs);
  const n = ids.length;
  assert.equal(rounds.length, roundsFor(n, legs), `${n} takım, ${legs} devre`);
  for (const r of rounds) {
    assert.equal(r.length, Math.floor(n / 2));
    assert.equal(new Set(r.flat()).size, r.length * 2, 'bir takım aynı turda iki maç oynamamalı');
  }
  const home = Object.fromEntries(ids.map((i) => [i, 0]));
  const games = Object.fromEntries(ids.map((i) => [i, 0]));
  const pairs = new Map();
  for (const r of rounds) for (const [h, a] of r) {
    home[h]++;
    games[h]++;
    games[a]++;
    const k = [h, a].sort().join('-');
    pairs.set(k, (pairs.get(k) || 0) + 1);
  }
  assert.equal(pairs.size, (n * (n - 1)) / 2, 'herkes herkesle');
  for (const v of pairs.values()) assert.equal(v, legs);
  for (const id of ids) {
    assert.equal(games[id], legs * (n - 1));
    // çift devrede iç/dış saha eşit
    if (legs % 2 === 0) assert.equal(home[id], (legs / 2) * (n - 1));
  }
  return rounds;
}

test('fikstür motoru: takım sayısından bağımsız (18, 20, 24, 29 takım; 2–4 devre; tek sayıda bay)', () => {
  setRandom(seeded(1));
  const mk = (n) => Array.from({ length: n }, (_, i) => `t${String(i).padStart(2, '0')}`);
  for (const n of [2, 3, 8, 10, 12, 17, 18, 20, 21, 24, 29, 30]) checkFixture(mk(n), 2);
  checkFixture(mk(12), 3);
  checkFixture(mk(10), 4);
  // 18 takım → 34 tur, 20 → 38, 29 → 58 (her turda bir takım bay)
  assert.equal(roundRobin(mk(18)).length, 34);
  assert.equal(roundRobin(mk(20)).length, 38);
  const r29 = roundRobin(mk(29));
  assert.equal(r29.length, 58);
  for (const r of r29) assert.equal(new Set(r.flat()).size, 28, 'tek sayıda takımda her tur bir bay');
  // gerçek ligler: Süper Lig 18, 1. Lig 20
  const sl = CLUBS.filter((c) => c.league === 'super').map((c) => c.id);
  const fl = CLUBS.filter((c) => c.league === 'first').map((c) => c.id);
  assert.equal(sl.length, 18);
  assert.equal(fl.length, 20);
  checkFixture(sl, 2);
  checkFixture(fl, 2);
});

test('lig tablosu: sezon sonunda her takım tüm maçlarını oynamış, puanlar ve gol averajı tutarlı', () => {
  setRandom(seeded(2));
  const world = createWorld(1);
  for (let w = 1; w <= worldWeeks(world); w++) simulateWeek(world, w);
  for (const lg of Object.values(world.leagues)) {
    const rows = sortedTable(lg);
    const gf = rows.reduce((s, r) => s + r.gf, 0);
    const ga = rows.reduce((s, r) => s + r.ga, 0);
    assert.equal(gf, ga);
    const games = (rows.length - 1) * (LEAGUES[lg.id]?.legs || 2);
    for (const r of rows) {
      assert.equal(r.p, games, `${lg.id}: ${rows.length} takım → ${games} maç`);
      assert.equal(r.w + r.d + r.l, games);
      assert.equal(r.pts, r.w * 3 + r.d);
    }
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].pts >= rows[i].pts);
  }
});

test('aksiyonlar: slot ve enerji kuralları', () => {
  const s = newGame({ name: 'T', position: 'DF' });
  assert.equal(canDoAction(s, 'sponsor').ok, false, 'ün 20 altında reklam yok');
  for (let i = 0; i < 4; i++) assert.equal(doAction(s, 'rest').ok, true);
  assert.equal(doAction(s, 'rest').ok, false, 'slot bitti');
});

test('sezon sonu: sözleşmesi biten oyuncu en az bir teklif alır', () => {
  setRandom(seeded(4));
  for (let i = 0; i < 20; i++) {
    const s = newGame({ name: 'T', position: 'FW' });
    s.career.contract.yearsLeft = 1;
    s.player.rel.manager = 10;
    for (let w = 1; w <= worldWeeks(s.world); w++) simulateWeek(s.world, w);
    s.calendar.week = seasonWeeks();
    endSeason(s);
    assert.ok(s.pending.offers && s.pending.offers.list.length >= 1);
    assert.equal(s.pending.offers.mandatory, true);
  }
});

test('maaş kulüp gücüyle artar', () => {
  assert.ok(wageFor(30, 25) < wageFor(50, 45));
  assert.ok(wageFor(50, 45) < wageFor(79, 75));
});

test('5 sezonluk otomatik kariyer: sayılar geçerli kalır', () => {
  setRandom(seeded(5));
  for (const pos of ['FW', 'MF', 'DF']) {
    const s = newGame({ name: 'Bot', position: pos });
    let seasons = 0;
    for (let w = 0; w < 400 && seasons < 5; w++) {
      const { report } = playWeek(s, 0.5);
      if (report) seasons++;
      assert.ok(Number.isFinite(s.career.money));
      assert.ok(s.player.energy >= 0 && s.player.energy <= 100);
      for (const k of STAT_KEYS) assert.ok(s.player.stats[k] >= 1 && s.player.stats[k] <= 99);
      for (const v of Object.values(s.player.rel)) assert.ok(v >= 0 && v <= 100);
    }
    assert.equal(seasons, 5);
    assert.ok(ovr(s.player) > 35, `${pos} 5 sezonda gelişmeli`);
    assert.equal(s.career.history.length, 5);
    const offers = generateOffers(s, 'mid');
    assert.ok(Array.isArray(offers));
  }
});

test('fikstür dengesi: kimse ikiden fazla maç üst üste iç sahada ya da deplasmanda oynamaz', () => {
  setRandom(seeded(12));
  for (const n of [12, 17, 18, 20, 24]) {
    const ids = Array.from({ length: n }, (_, i) => `k${i}`);
    const rounds = roundRobin(ids);
    const seq = Object.fromEntries(ids.map((id) => [id, []]));
    for (const r of rounds) for (const [h, a] of r) { seq[h].push('İ'); seq[a].push('D'); }
    for (const id of ids) {
      let run = 1;
      for (let i = 1; i < seq[id].length; i++) { run = seq[id][i] === seq[id][i - 1] ? run + 1 : 1; assert.ok(run <= 2, `${n} takım: ${id} ${seq[id].join('')}`); }
    }
  }
});
