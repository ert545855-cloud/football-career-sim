import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { CLUBS, COUNTRIES, LEAGUES } from '../src/core/data.js';
import { newGame } from '../src/core/game.js';
import { migrate } from '../src/core/storage.js';
import { generateOffers, wageFor } from '../src/core/economy.js';
import {
  createWorld, fixturesOf, leagueOf, leaguePrestige, matchesInWeek, positionOf, promotions, roundsInWeek, simulateWeek, sortedTable, upgradeWorld, useWorld, worldWeeks,
} from '../src/core/league.js';
import { CUP_IDS, createEurope, cupOf, europeQualifiers, europeWeek, europeWeeks, playEuropeWeek } from '../src/core/world/europe.js';
import { LEAGUE_SYSTEM, promotedCount, relegatedCount } from '../src/core/world/leagueConfig.js';
import { seasonWeeks } from '../src/core/calendar.js';

test('dünya: 28 ülke, her lig yapılandırmadaki gerçek takım sayısında, Türkiye 4 kademe', () => {
  assert.equal(COUNTRIES.length, 28);
  const real = Object.values(LEAGUES).filter((l) => !l.youth && !l.legacy);
  // yapılandırmadaki her kademe/grup bir lig
  const expected = Object.values(LEAGUE_SYSTEM).reduce((n, divs) => n + divs.reduce((m, d) => m + (d.groups?.length || 1), 0), 0);
  assert.equal(real.length, expected);
  for (const lg of real) assert.equal(CLUBS.filter((c) => c.league === lg.id).length, lg.size, lg.id);
  // gerçek takım sayıları
  const size = (id) => CLUBS.filter((c) => c.league === id).length;
  assert.equal(size('super'), 18, 'Süper Lig 18');
  assert.equal(size('first'), 20, '1. Lig 20');
  assert.equal(size('en1'), 20, 'Premier Lig 20');
  assert.equal(size('es1'), 20, 'La Liga 20');
  assert.equal(size('it1'), 20, 'Serie A 20');
  assert.equal(size('de1'), 18, 'Bundesliga 18');
  assert.equal(size('en2'), 24, 'Championship 24');
  // ülke başına kademe sayısı yapılandırmadan (ABD 2, Türkiye 4)
  const tiers = (cc) => new Set(real.filter((l) => l.country === cc).map((l) => l.level)).size;
  assert.equal(tiers('tr'), 4);
  assert.equal(tiers('us'), 2);
  assert.deepEqual(real.filter((l) => l.country === 'tr').map((l) => l.id), ['super', 'first', 'tr2', 'tr2b', 'tr3', 'tr3b', 'tr3c', 'tr3d']);
  const ids = new Set(CLUBS.map((c) => c.id));
  assert.equal(ids.size, CLUBS.length);
  const shorts = new Set(CLUBS.map((c) => `${c.country}:${c.short}`));
  assert.equal(shorts.size, CLUBS.length, 'ülke içinde kısa adlar benzersiz');
  // Üst kademe ortalaması alt kademeden güçlü
  for (const c of COUNTRIES) {
    const avgLv = (lv) => { const xs = CLUBS.filter((x) => x.country === c.id && LEAGUES[x.league]?.level === lv); return xs.reduce((s, x) => s + x.rating, 0) / xs.length; };
    for (let lv = 1; lv < tiers(c.id); lv++) assert.ok(avgLv(lv) > avgLv(lv + 1), `${c.id} ${lv} > ${lv + 1}`);
  }
  assert.ok(leaguePrestige('en1') > leaguePrestige('super') && leaguePrestige('super') > leaguePrestige('first'));
});

test('yapılandırma tutarlı: üst kademeden düşen = alt kademeden çıkan (her ülke, her sınır)', () => {
  for (const [cc, divs] of Object.entries(LEAGUE_SYSTEM)) {
    for (let i = 0; i < divs.length - 1; i++) {
      if (divs[i + 1].closed) continue;
      assert.equal(relegatedCount(divs[i]), promotedCount(divs[i + 1]), `${cc}: ${divs[i].name} ↔ ${divs[i + 1].name}`);
    }
    assert.equal(relegatedCount(divs[divs.length - 1]), 0, `${cc}: en alt kademeden düşme yok`);
  }
});

test('fikstür tohumdan aynı üretilir, her takım her turda bir kez oynar', () => {
  setRandom(seeded(3));
  const w = createWorld(1);
  const lg = w.leagues.es1;
  const f1 = fixturesOf(lg);
  const copy = JSON.parse(JSON.stringify(lg));
  assert.deepEqual(fixturesOf(copy), f1, 'kayıttan yüklenince aynı fikstür');
  assert.equal(f1.length, 38, '20 takım → 38 tur');
  for (const round of f1) assert.equal(new Set(round.flat()).size, 20);
  assert.equal(w.leagues.es1.fixtures, undefined, 'fikstür kayda yazılmaz');
});

test('takvim: sezon oyuncunun liginin tur sayısı kadar; diğer liglerin tüm turları sezona sığar', () => {
  setRandom(seeded(31));
  const fl = CLUBS.find((c) => c.league === 'first').id;
  const w = createWorld(1, null, { clubId: fl });
  assert.equal(w.weeks, 38, '1. Lig (20 takım) → 38 hafta');
  const sl = CLUBS.find((c) => c.league === 'super').id;
  assert.equal(createWorld(1, null, { clubId: sl }).weeks, 34, 'Süper Lig (18) → 34 hafta');
  for (const lg of Object.values(w.leagues)) {
    let n = 0;
    for (let wk = 1; wk <= w.weeks; wk++) n += roundsInWeek(w, lg, wk).length;
    assert.equal(n, fixturesOf(lg).length, `${lg.id}: tüm turlar takvimde`);
  }
  // oyuncunun liginde her hafta tam bir tur
  for (let wk = 1; wk <= w.weeks; wk++) assert.equal(roundsInWeek(w, w.leagues.first, wk).length, 1);
});

test('küme düşme / çıkma: yapılandırmadaki sayılar (doğrudan + play-off), lig boyutları korunur, leagueOf güncellenir', () => {
  setRandom(seeded(4));
  const w = useWorld(createWorld(1));
  for (let wk = 1; wk <= worldWeeks(w); wk++) simulateWeek(w, wk);
  const relegated = sortedTable(w.leagues.super).slice(-3).map((r) => r.id);
  const promoted = sortedTable(w.leagues.first).slice(0, 2).map((r) => r.id);
  const { moves, playoffs } = promotions(w);
  // Türkiye: Süper Lig ↔ 1. Lig 3'er, 1. Lig ↔ 2. Lig 4'er, 2. Lig ↔ 3. Lig 6'şar
  const lv = (id) => LEAGUES[id]?.level;
  const count = (a, b, up) => moves.filter((m) => LEAGUES[m.to]?.country === 'tr' && lv(m.from) === a && lv(m.to) === b && m.up === up).length;
  assert.equal(count(2, 1, true), 3);
  assert.equal(count(1, 2, false), 3);
  assert.equal(count(3, 2, true), 4);
  assert.equal(count(2, 3, false), 4);
  assert.equal(count(4, 3, true), 6);
  assert.equal(count(3, 4, false), 6);
  // kapalı lig (ABD): hareket yok
  assert.equal(moves.filter((m) => LEAGUES[m.to]?.country === 'us').length, 0);
  const po = playoffs.first;
  const table = sortedTable(w.leagues.first).map((r) => r.id);
  assert.ok(table.slice(2, 6).includes(po.winner), 'play-off galibi 3–6. sıralardan');
  assert.ok(moves.some((m) => m.clubId === po.winner && m.up && m.playoff));
  const next = useWorld(createWorld(2, null, { prev: w }));
  for (const lg of Object.values(next.leagues)) assert.equal(lg.teams.length, LEAGUES[lg.id].size, lg.id);
  for (const id of promoted) assert.equal(leagueOf(id), 'super');
  for (const id of relegated) assert.equal(leagueOf(id), 'first');
  assert.ok(positionOf(next, promoted[0]) >= 1);
  // birkaç sezon üst üste: boyutlar sabit, kulüp kaybolmaz
  let cur = next;
  for (let season = 3; season <= 5; season++) {
    for (let wk = 1; wk <= worldWeeks(cur); wk++) simulateWeek(cur, wk);
    cur = useWorld(createWorld(season, null, { prev: cur }));
    for (const lg of Object.values(cur.leagues)) assert.equal(lg.teams.length, LEAGUES[lg.id].size, `${season} ${lg.id}`);
    const all = Object.values(cur.leagues).flatMap((lg) => lg.teams);
    assert.equal(new Set(all).size, all.length, 'bir kulüp iki ligde olamaz');
  }
});

test('eski 12 takımlı dünya: süren sezon aynen biter, yeni sezonda gerçek yapıya geçilir', () => {
  setRandom(seeded(41));
  const s = newGame({ name: 'Eski Yapı', position: 'FW' });
  // eski (v2) dünya: her ligde 12 takım, takvim 22 hafta
  const legacy = { season: 1, ratings: s.world.ratings, leagues: {}, focus: ['super', 'first'], moves: [], v: 2 };
  for (const [id, lg] of Object.entries(s.world.leagues)) {
    if (LEAGUES[id].groupIdx || LEAGUES[id].youth) continue;
    const teams = lg.teams.slice(0, 12);
    legacy.leagues[id] = { ...lg, teams, table: Object.fromEntries(teams.map((t) => [t, { id: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, last: [] }])), results: [], last: [] };
  }
  useWorld(legacy);
  assert.equal(worldWeeks(legacy), 22);
  for (let wk = 1; wk <= 22; wk++) simulateWeek(legacy, wk);
  for (const r of Object.values(legacy.leagues.super.table)) assert.equal(r.p, 22);
  const next = createWorld(2, null, { prev: legacy, clubId: legacy.leagues.first.teams[0] });
  for (const lg of Object.values(next.leagues)) assert.equal(lg.teams.length, LEAGUES[lg.id].size, lg.id);
  assert.equal(next.weeks >= 34, true);
});

test('yalnızca odak liglerin tüm sonuçları saklanır', () => {
  setRandom(seeded(5));
  const w = createWorld(1, null, { clubId: CLUBS.find((c) => c.league === 'first').id });
  simulateWeek(w, 1);
  simulateWeek(w, 2);
  assert.equal(w.leagues.super.results.length, 2);
  assert.equal(w.leagues.en1.results.length, 0);
  assert.equal(w.leagues.en1.last.length, 10);
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
  let games = 0;
  for (let wk = 1; wk <= 4; wk++) games += matchesInWeek(s.world, s.world.leagues.en1, wk).length * 2;
  assert.equal(Object.values(s.world.leagues.en1.table).reduce((n, r) => n + r.p, 0), games, 'yeni ligler geçmiş haftaları oynadı');
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
  const groupWeeks = europeWeeks(seasonWeeks()).group;
  for (let wk = 1; wk <= groupWeeks[groupWeeks.length - 1]; wk++) {
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

test('kulüp sıralaması: başlangıç puanı, canlı sıra ve sezon sonu sönümlenmesi', async () => {
  const { clubRanking, rankingSeasonEnd, myRank } = await import('../src/core/world/ranking.js');
  setRandom(seeded(11));
  const s = newGame({ name: 'Test Oyuncu', position: 'FW' });
  const list = clubRanking(s);
  assert.ok(list.length > 100);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].pts >= list[i].pts);
  assert.equal(list[0].rank, 1);
  assert.ok(myRank(s));
  const before = { ...s.ranking.pts };
  const top = list[0].id;
  rankingSeasonEnd(s, s.world);
  assert.ok(s.ranking.pts[top] <= before[top] + 1e-9 + 200);
  assert.equal(s.ranking.prev[top], 1);
  setRandom(Math.random);
});
