import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { NATIONAL_WEEKS, nationalWindow } from '../src/core/national.js';
import {
  activeCamp, campRole, doCampAction, endCamp, finishCampMatch, fixtureCard, planCampMatch, simulateCampMatch, startCamp, startTournamentCamp, tournamentFor,
} from '../src/core/nationalCamp.js';
import { applyAiEvent, resolveMoment, scoreLine } from '../src/core/match.js';

const setStats = (s, v) => { for (const k of Object.keys(s.player.stats)) s.player.stats[k] = v; };

function u19Player(seed) {
  setRandom(seeded(seed));
  const s = newGame({ name: 'Kamp Testi', position: 'FW' });
  s.player.age = 18;
  s.player.ratings = [7, 7];
  setStats(s, 33);
  s.calendar.week = NATIONAL_WEEKS[0];
  return s;
}

test('kamp: U-19 çağrısı 2 maçlık kampa döner; aksiyonlar, rol ve maçlar', () => {
  const s = u19Player(41);
  const call = nationalWindow(s);
  assert.equal(call.level, 'U19');
  const camp = startCamp(s, call);
  assert.equal(s.pending.national, null);
  assert.equal(camp.fixtures.length, 2);
  assert.notEqual(camp.fixtures[0].opp, camp.fixtures[1].opp);
  const card = fixtureCard(s);
  assert.ok(card.my.includes('U-19') && card.opp.includes('U-19'));
  assert.equal(card.prof.last5.length, 5);
  // Kamp hakları
  const t0 = camp.trust;
  assert.ok(doCampAction(s, 'tactics').ok);
  assert.ok(camp.trust > t0 && camp.prep);
  assert.ok(doCampAction(s, 'train', { success: true }).ok);
  assert.equal(camp.slots, 0);
  assert.equal(doCampAction(s, 'rest').ok, false, 'hak bitince aksiyon yok');
  // Maç: kulüp maçı nesnesiyle uyumlu, anlatım milli isimleri kullanır
  const m = planCampMatch(s);
  assert.ok(m.national && m.teams.home && m.names.my.startsWith('Türkiye'));
  assert.equal(m.role, campRole(s));
  const line = applyAiEvent(m, { minute: 10, side: 'my', kind: 'goal' });
  // anlatım ya takım adını ya golcüyü kullanır (şablon rastgele); skor satırı milli kısaltmayla
  assert.ok((line.text.includes('Türkiye') || !!line.scorer) && scoreLine(m).includes('TÜR'));
  for (const mo of m.moments) resolveMoment(m, mo, { success: true, accuracy: 0.8, outcome: 'goal' }, 'Kamp');
  const r1 = finishCampMatch(s, m);
  assert.equal(r1.next, 'camp');
  assert.equal(camp.slots, 2, 'ikinci maç öncesi haklar yenilenir');
  const r2 = finishCampMatch(s, simulateCampMatch(s));
  assert.equal(r2.next, 'over');
  const sum = endCamp(s);
  assert.equal(activeCamp(s), null);
  assert.equal(sum.played.length, 2);
  assert.ok(s.national.caps.U19 >= 1);
});

test('kamp: turnuva grup → eleme; sonuç kaydedilir, tekrar başlamaz', () => {
  for (const seed of [5, 6, 7, 8]) {
    setRandom(seeded(seed));
    const s = newGame({ name: 'Turnuva Testi', position: 'MF' });
    s.player.age = 26;
    s.player.ratings = [7.5, 7.5];
    setStats(s, 75);
    s.calendar.season = 2;
    s.national.current = 'A';
    const tour = tournamentFor(s);
    assert.ok(tour && tour.level === 'A');
    const camp = startTournamentCamp(s, tour);
    assert.equal(camp.fixtures.length, 3);
    let guard = 0;
    let r;
    do { r = finishCampMatch(s, simulateCampMatch(s)); } while (r.next !== 'over' && ++guard < 10);
    const T = camp.tournament;
    assert.ok(['group', 'qf', 'sf', 'final', 'champion'].includes(T.result), T.result);
    if (T.result !== 'group') assert.ok(camp.played.length >= 4);
    const table = Object.values(T.table);
    assert.equal(table.reduce((a, x) => a + x.p, 0), 12, 'grupta 6 maç oynanır');
    const sum = endCamp(s);
    assert.ok(sum.record && s.national.tournaments.some((t) => t.season === 2));
    assert.equal(tournamentFor(s), null);
  }
});

test('kamp: U-21 Avrupa Şampiyonası tek sezonlarda, bu sezon genç milli maçı varsa', () => {
  setRandom(seeded(9));
  const s = newGame({ name: 'Genç Test', position: 'DF' });
  s.calendar.season = 3;
  s.national.current = 'U21';
  assert.equal(tournamentFor(s), null);
  s.national.youthSeason = { 3: 2 };
  assert.equal(tournamentFor(s).level, 'U21');
});
