import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { CLUBS, COUNTRIES, LEAGUES } from '../src/core/data.js';
import { newGame } from '../src/core/game.js';
import { migrate } from '../src/core/storage.js';
import { generateOffers, wageFor } from '../src/core/economy.js';
import {
  createWorld, fixturesOf, leagueOf, leaguePrestige, positionOf, promotions, simulateWeek, sortedTable, upgradeWorld, useWorld,
} from '../src/core/league.js';
import { CUP_IDS, createEurope, cupOf, europeQualifiers, europeWeek, playEuropeWeek } from '../src/core/world/europe.js';

test('dünya: 28 ülke, her ligde 12 kulüp, Türkiye 4 kademe', () => {
  assert.equal(COUNTRIES.length, 28);
  const real = Object.values(LEAGUES).filter((l) => !l.youth);
  assert.equal(real.length, 28 * 3 + 1);
  for (const lg of real) assert.equal(CLUBS.filter((c) => c.league === lg.id).length, 12, lg.id);
  assert.deepEqual(Object.values(LEAGUES).filter((l) => l.country === 'tr' && !l.youth).map((l) => l.id), ['super', 'first', 'tr2', 'tr3']);
  const ids = new Set(CLUBS.map((c) => c.id));
  assert.equal(ids.size, CLUBS.length);
  const shorts = new Set(CLUBS.map((c) => `${c.country}:${c.short}`));
  assert.equal(shorts.size, CLUBS.length, 'ülke içinde kısa adlar benzersiz');
  // Üst lig ortalaması alt ligden güçlü
  for (const c of COUNTRIES) {
    const avg = (lid) => CLUBS.filter((x) => x.league === lid).reduce((s, x) => s + x.rating, 0) / 12;
    const ls = real.filter((l) => l.country === c.id).sort((a, b) => a.tier - b.tier);
    for (let i = 0; i < ls.length - 1; i++) assert.ok(avg(ls[i].id) > avg(ls[i + 1].id), `${ls[i].id} > ${ls[i + 1].id}`);
  }
  assert.ok(leaguePrestige('en1') > leaguePrestige('super') && leaguePrestige('super') > leaguePrestige('first'));
});

test('fikstür tohumdan aynı üretilir, her takım her hafta bir kez oynar', () => {
  setRandom(seeded(3));
  const w = createWorld(1);
  const lg = w.leagues.es1;
  const f1 = fixturesOf(lg);
  const copy = JSON.parse(JSON.stringify(lg));
  assert.deepEqual(fixturesOf(copy), f1, 'kayıttan yüklenince aynı fikstür');
  assert.equal(f1.length, 22);
  for (const round of f1) {
    const seen = round.flat();
    assert.equal(new Set(seen).size, 12);
  }
  assert.equal(w.leagues.es1.fixtures, undefined, 'fikstür kayda yazılmaz');
});

test('küme düşme / çıkma: 2 takım yer değiştirir, ligler 12 kalır, leagueOf güncellenir', () => {
  setRandom(seeded(4));
  const w = useWorld(createWorld(1));
  for (let wk = 1; wk <= 22; wk++) simulateWeek(w, wk);
  const relegated = sortedTable(w.leagues.super).slice(-2).map((r) => r.id);
  const promoted = sortedTable(w.leagues.first).slice(0, 2).map((r) => r.id);
  const { moves } = promotions(w);
  assert.equal(moves.length, (27 * 2 + 3) * 4);
  const next = useWorld(createWorld(2, null, { prev: w }));
  for (const lg of Object.values(next.leagues)) assert.equal(lg.teams.length, 12, lg.id);
  for (const id of promoted) assert.equal(leagueOf(id), 'super');
  for (const id of relegated) assert.equal(leagueOf(id), 'first');
  assert.ok(positionOf(next, promoted[0]) >= 1);
});

test('yalnızca odak liglerin tüm sonuçları saklanır', () => {
  setRandom(seeded(5));
  const w = createWorld(1);
  simulateWeek(w, 1);
  simulateWeek(w, 2);
  assert.equal(w.leagues.super.results.length, 2);
  assert.equal(w.leagues.en1.results.length, 0);
  assert.equal(w.leagues.en1.last.length, 6);
});

test('eski kayıt: sadece Türkiye ligleri olan dünya yükseltilir', () => {
  setRandom(seeded(6));
  const s = newGame({ name: 'Eski Kayıt', position: 'MF' });
  // eski biçim: 3 lig, fikstür kayıtta
  const old = { season: 1, ratings: s.world.ratings, leagues: {} };
  for (const id of ['super', 'first', 'u17']) old.leagues[id] = { ...s.world.leagues[id], fixtures: fixturesOf(s.world.leagues[id]) };
  for (let wk = 1; wk <= 4; wk++) simulateWeek(old, wk);
  s.world = old;
  s.calendar.week = 5;
  migrate(s);
  assert.equal(s.world.v, 2);
  assert.ok(s.world.leagues.en1 && s.world.leagues.tr3);
  assert.equal(Object.values(s.world.leagues.en1.table).reduce((n, r) => n + r.p, 0), 4 * 12, 'yeni ligler geçmiş haftaları oynadı');
  assert.ok(s.world.europe, 'Avrupa kupaları kuruldu');
});

test('Avrupa: 3 kupa × 32 takım, çakışma yok; sezon sonunda kazanan belli', () => {
  setRandom(seeded(7));
  const w = createWorld(1);
  const q = europeQualifiers(w, true);
  const all = CUP_IDS.flatMap((id) => q[id]);
  for (const id of CUP_IDS) assert.equal(q[id].length, 32, id);
  assert.equal(new Set(all).size, 96);
  w.europe = createEurope(1, w);
  for (const id of CUP_IDS) assert.equal(w.europe.cups[id].groups.length, 8);
  for (let wk = 1; wk <= 22; wk++) playEuropeWeek(w, wk);
  for (const id of CUP_IDS) {
    const cup = w.europe.cups[id];
    assert.equal(cup.stage, 'done');
    assert.ok(cup.winner && cup.teams.includes(cup.winner));
    assert.equal(cup.results.r16.length, 8);
    assert.equal(cup.results.f.length, 1);
  }
});

test('Avrupa: oyuncunun kulübü kupadaysa maç, katkı ve prim hesaplanır', () => {
  setRandom(seeded(8));
  const s = newGame({ name: 'Avrupalı', position: 'FW' });
  const cl = s.world.europe.cups.cl;
  s.career.clubId = cl.teams[0];
  assert.equal(cupOf(s.world, s.career.clubId), 'cl');
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = 80;
  let played = 0;
  for (let wk = 1; wk <= 14; wk++) {
    const r = europeWeek(s, wk);
    if (r.my) {
      played += 1;
      assert.ok(r.my.match.h === s.career.clubId || r.my.match.a === s.career.clubId);
    }
  }
  assert.equal(played, 6, '6 grup maçı');
  assert.ok(s.career.season.europe.apps >= 1);
});

test('transfer: tanınmayan gence yurt dışı teklifi gelmez; yıldız oyuncuya gelir; maaş ülkeye göre', () => {
  setRandom(seeded(9));
  const s = newGame({ name: 'Genç', position: 'FW' });
  s.calendar.week = 22;
  let foreign = 0;
  for (let i = 0; i < 40; i++) foreign += generateOffers(s, 'end').filter((o) => CLUBS.find((c) => c.id === o.clubId).country !== 'tr').length;
  assert.equal(foreign, 0);
  s.player.fame = 75;
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = 82;
  s.player.ratings = [8, 8.2, 7.9, 8.4];
  s.career.clubId = 'bog';
  useWorld(s.world);
  foreign = 0;
  for (let i = 0; i < 60; i++) foreign += generateOffers(s, 'end').filter((o) => CLUBS.find((c) => c.id === o.clubId).country !== 'tr').length;
  assert.ok(foreign > 5, `yurt dışı teklif sayısı ${foreign}`);
  assert.ok(wageFor(70, 70, 'en') > wageFor(70, 70, 'tr') && wageFor(70, 70, 'tr') > wageFor(70, 70, 'ng'));
});
