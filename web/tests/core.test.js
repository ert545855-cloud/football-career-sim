import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLUBS, STAT_KEYS, SEASON_WEEKS } from '../src/core/data.js';
import { setRandom, seeded } from '../src/core/rng.js';
import { roundRobin, createWorld, simulateWeek, sortedTable } from '../src/core/league.js';
import { newGame, endSeason, doAction, canDoAction } from '../src/core/game.js';
import { EVENTS, resolveEvent } from '../src/core/events.js';
import { createPlayer, ovr, effectiveSkill, addProgress, cleanName } from '../src/core/player.js';
import { generateOffers, buyItem, sellItem, wageFor } from '../src/core/economy.js';
import { playWeek } from '../scripts/bot.js';

test('fikstür: 12 takım → 22 hafta, herkes herkesle iki kez, 11 iç 11 dış saha', () => {
  setRandom(seeded(1));
  const ids = CLUBS.filter((c) => c.league === 'first').map((c) => c.id);
  const rounds = roundRobin(ids);
  assert.equal(rounds.length, SEASON_WEEKS);
  for (const r of rounds) {
    assert.equal(r.length, 6);
    assert.equal(new Set(r.flat()).size, 12, 'bir takım aynı haftada iki maç oynamamalı');
  }
  const home = Object.fromEntries(ids.map((i) => [i, 0]));
  const pairs = new Map();
  for (const r of rounds) for (const [h, a] of r) {
    home[h]++;
    const k = [h, a].sort().join('-');
    pairs.set(k, (pairs.get(k) || 0) + 1);
  }
  for (const id of ids) assert.equal(home[id], 11);
  assert.equal(pairs.size, 66);
  for (const v of pairs.values()) assert.equal(v, 2);
});

test('lig tablosu: puanlar ve gol averajı tutarlı', () => {
  setRandom(seeded(2));
  const world = createWorld(1);
  for (let w = 1; w <= SEASON_WEEKS; w++) simulateWeek(world, w);
  for (const lg of Object.values(world.leagues)) {
    const rows = sortedTable(lg);
    const gf = rows.reduce((s, r) => s + r.gf, 0);
    const ga = rows.reduce((s, r) => s + r.ga, 0);
    assert.equal(gf, ga);
    for (const r of rows) {
      assert.equal(r.p, 22);
      assert.equal(r.w + r.d + r.l, 22);
      assert.equal(r.pts, r.w * 3 + r.d);
    }
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].pts >= rows[i].pts);
  }
});

test('oyuncu: başlangıç statları ve OVR ~20', () => {
  for (const pos of ['FW', 'MF', 'DF']) {
    const p = createPlayer({ name: 'Test', position: pos });
    const o = ovr(p);
    assert.ok(o >= 18 && o <= 22, `${pos} OVR ${o}`);
    const s = effectiveSkill(p, { shooting: 1 });
    assert.ok(s > 0 && s < 1);
  }
  assert.equal(cleanName('  <b>Ali</b>  Veli  '), 'Ali Veli');
});

test('gelişim: stat 99\'u geçmez', () => {
  const p = createPlayer({ name: 'T', position: 'FW' });
  p.stats.shooting = 98;
  for (let i = 0; i < 200; i++) addProgress(p, 'shooting', 5);
  assert.equal(p.stats.shooting, 99);
});

test('olaylar: her seçenek hatasız uygulanır ve değerler sınır içinde kalır', () => {
  setRandom(seeded(3));
  for (const ev of EVENTS) {
    for (let c = 0; c < ev.choices.length; c++) {
      const s = newGame({ name: 'Test', position: 'MF' });
      s.career.money = 50000;
      s.player.fame = 70;
      assert.doesNotThrow(() => ev.text(s, { summary: { played: true, rating: 5, goals: 1 } }));
      const out = resolveEvent(s, ev.id, c);
      assert.ok(Array.isArray(out.changes));
      for (const k of STAT_KEYS) assert.ok(s.player.stats[k] >= 1 && s.player.stats[k] <= 99);
      assert.ok(s.player.morale >= 0 && s.player.morale <= 100);
      assert.ok(Number.isFinite(s.career.money));
    }
  }
});

test('mağaza: al, sat, tek kullanımlık', () => {
  const s = newGame({ name: 'T', position: 'FW' });
  s.career.money = 1000;
  assert.equal(buyItem(s, 'bike').ok, true);
  assert.equal(buyItem(s, 'bike').ok, false, 'iki kez alınamaz');
  assert.equal(buyItem(s, 'super').ok, false, 'para yetmez');
  s.player.energy = 50;
  assert.equal(buyItem(s, 'spa').ok, true);
  assert.equal(s.player.energy, 70);
  const before = s.career.money;
  assert.equal(sellItem(s, 'bike').ok, true);
  assert.equal(s.career.money, before + 175);
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
    for (let w = 1; w <= SEASON_WEEKS; w++) simulateWeek(s.world, w);
    s.calendar.week = SEASON_WEEKS;
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
