import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { CLUB_BY_ID, LEAGUES } from '../src/core/data.js';
import { buildStarterOffers, offerText } from '../src/core/onboarding/offers.js';
import { HOME_NATION, NATIONAL_TEAMS, ensureNational } from '../src/core/national.js';
import { squadFor, startTournamentCamp } from '../src/core/nationalCamp.js';
import { ensureSocial, PERSON_BY_ID } from '../src/core/social/index.js';
import { awayBanner, bannerTexts, brandTexts } from '../src/core/world/locale.js';
import { leagueOf } from '../src/core/league.js';

test('vatandaşlık: kariyer o ülkede başlar, milli takım ve teklifler o ülkeden', () => {
  setRandom(seeded(31));
  const s = newGame({ name: 'Pablo Ruiz', position: 'MF', nationality: 'es' });
  assert.equal(s.player.nationality, 'es');
  assert.equal(CLUB_BY_ID[s.career.clubId].country, 'es', 'başlangıç kulübü İspanya\'da');
  assert.equal(leagueOf(s.career.clubId), 'es2', '2. kademe');
  ensureNational(s);
  assert.equal(HOME_NATION.name, 'İspanya');
  assert.ok(NATIONAL_TEAMS.A.minScore > 64, 'güçlü ülkede milli formaya ulaşmak daha zor');
  const offers = buildStarterOffers(s.world, 9, { ovr: 30 }, seeded(4), 'es');
  assert.ok(offers.every((o) => CLUB_BY_ID[o.clubId].country === 'es'));
  assert.equal(CLUB_BY_ID[offers[2].clubId].league, 'esu17', 'altyapı: İspanya U-17 ligi');
  assert.ok(LEAGUES.esu17.youth);
  assert.equal(offerText('{top} sözleşmesi', 'es'), `${LEAGUES.es1.name} sözleşmesi`);
  // milli kamp: İspanyol isimler; turnuva: Avrupa ülkeleri, kendi ülken rakip değil
  const sq = squadFor(s, 'U19');
  assert.ok(sq.every((p) => !/Yılmaz|Kaya|Demir/.test(p.name)));
  const camp = startTournamentCamp(s, { level: 'A', name: 'Avrupa Şampiyonası', continental: true });
  assert.ok(!camp.tournament.group.includes('İSP'));
  assert.ok(Object.keys(camp.tournament.table).includes('İSP'));
  // memleket arkadaşları yerel adlarla
  ensureSocial(s);
  assert.notEqual(PERSON_BY_ID.emre.name, 'Emre');
  setRandom(Math.random);
});

test('vatandaşlık: Türkiye seçilince her şey eskisi gibi; diğer kıtalarda kıta şampiyonası', () => {
  setRandom(seeded(32));
  const s = newGame({ name: 'Arda Yılmaz', position: 'FW' });
  assert.equal(s.player.nationality, 'tr');
  ensureNational(s);
  ensureSocial(s);
  assert.equal(HOME_NATION.short, 'TÜR');
  assert.equal(NATIONAL_TEAMS.A.minScore, 64);
  assert.equal(PERSON_BY_ID.emre.name, 'Emre');
  const j = newGame({ name: 'Kenta Ito', position: 'FW', nationality: 'jp' });
  ensureNational(j);
  assert.equal(HOME_NATION.conf, 'AFC');
  const camp = startTournamentCamp(j, { level: 'A', name: 'Asya Kupası', continental: true });
  assert.ok(camp.tournament.group.every((x) => ['KOR', 'SUU', 'ÇİN', 'İRA', 'AVS', 'KAT'].includes(x)), camp.tournament.group.join(','));
  setRandom(Math.random);
});

test('stadyum: pankart ve panolar ev sahibi ülkenin dilinde', () => {
  const es = bannerTexts('es', { home: 'Real Puerto', fan: 'Puerto', city: 'Sevilla' });
  assert.ok(es.includes('HASTA EL FINAL') && es.includes('SEVILLA PRESENTE'));
  assert.equal(awayBanner('de', 'Adler'), 'ADLER AUSWÄRTS');
  assert.equal(bannerTexts('tr', { home: 'İstanbul Kartal', fan: 'Kartal', city: 'İstanbul' })[4], 'İSTANBUL BURADA');
  assert.equal(brandTexts('jp')[1], 'ターボコーラ');
  assert.equal(brandTexts('tr')[1], 'TURBO KOLA');
});
