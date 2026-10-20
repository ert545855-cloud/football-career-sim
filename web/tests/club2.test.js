import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { completeCupMatch, createCup, cupOnWeekEnd, groupTable, planCupMatch, scheduleSuperCup, cupSeasonEnd } from '../src/core/cup.js';
import { chooseTreatment, ensureMedical, medicalOnWeekEnd, startInjury, treatmentOptions } from '../src/core/injury.js';
import { clauseOptions, negotiateClauses, applyClauses, goalBonusFor, clausesOnSeasonEnd } from '../src/core/clauses.js';
import { lastMinuteOffer } from '../src/core/economy.js';

test('kupa: ön eleme → gruplar (ilk 2 + en iyi 3.ler) → eleme ağacı; senin maçların hafta içi', () => {
  setRandom(seeded(101));
  const s = newGame({ name: 'Kupa Test', position: 'FW' });
  const cup = createCup(s);
  assert.ok(cup && cup.name === 'Türkiye Kupası');
  assert.equal(cup.format.groups, 6, 'Türkiye: 6 grup');
  assert.ok(cup.pre?.pre1?.length === 12 && cup.preByes.pre2.length === 12, 'alt liglerin iki turlu ön elemesi');
  assert.equal(cup.direct.length, 12, 'üst lig doğrudan grupta');
  const me = s.career.clubId;
  const inPre = cup.pre.pre1.some((t) => t.h === me || t.a === me) || cup.preByes.pre2.includes(me);
  assert.ok(inPre || cup.direct.includes(me), 'kulübün kupada');
  // eleme şablonu baştan hazır: Son 16 → Final
  assert.equal(cup.rounds.r16.length, 8);
  assert.equal(cup.rounds.f.length, 1);
  let played = 0;
  for (let week = 1; week <= 22 && !cup.winner; week++) {
    s.calendar.week = week;
    const t = cupOnWeekEnd(s, week);
    if (t) {
      const m = planCupMatch(s);
      assert.ok(m.cup && m.homeId === t.h);
      assert.equal(m.knockout, !['g1', 'g2', 'g3'].includes(t.round), 'grup maçı eleme değil');
      m.score = ['g1', 'g2', 'g3'].includes(t.round) && played === 1 ? { my: 1, opp: 1 } : { my: 3, opp: 0 };
      const r = completeCupMatch(s, m, { success: true });
      assert.equal(s.pending.cupTie, null);
      if (['g1', 'g2', 'g3'].includes(t.round)) assert.equal(r.pens, null, 'grupta penaltı yok');
      played++;
    }
    if (week === 9) {
      // gruplar bitti: 6 × (1. + 2.) + en iyi 4 üçüncü = 16
      assert.equal(cup.stage, 'r16');
      const teams = cup.rounds.r16.flatMap((x) => [x.h, x.a]);
      assert.equal(new Set(teams).size, 16);
      assert.equal(cup.thirds.length, 4);
      for (const g of cup.groups) { const tb = groupTable(s.world, g); assert.ok(teams.includes(tb[0].id) && teams.includes(tb[1].id)); }
    }
  }
  assert.ok(cup.winner, 'final oynandı');
  assert.equal(cup.winner, me, 'hep kazanan kulübümüz şampiyon');
  assert.ok(played >= 8, `grup + eleme maçları oynandı: ${played}`);
  const pair = cupSeasonEnd(s, s.career.clubId, 'xx');
  assert.ok(s.lastCup && s.lastCup.winner);
  assert.ok(pair && scheduleSuperCup(s, pair) && s.pending.cupTie.kind === 'super');
  setRandom(Math.random);
});

test('kupa: sezon ortasında kurulursa geçmiş turlar simüle edilir', () => {
  setRandom(seeded(77));
  const s = newGame({ name: 'Kupa Geç', position: 'MF' });
  s.calendar.week = 14;
  s.cup = null;
  const cup = createCup(s);
  assert.equal(cup.stage, 'qf', 'Son 16 haftası (13) geçti');
  assert.ok(cup.groups.every((g) => g.fx.every((f) => f.hg != null)));
  setRandom(Math.random);
});

test('sakatlık: tedavi seçenekleri, dönüş ve kırılgan dönem', () => {
  setRandom(seeded(102));
  const s = newGame({ name: 'Sakat Test', position: 'MF' });
  startInjury(s, 'hamstring', 3);
  assert.equal(s.flags.injuredWeeks, 3);
  const opts = treatmentOptions(s);
  assert.ok(opts.some((o) => o.id === 'fast') && opts.some((o) => o.id === 'rest'));
  chooseTreatment(s, 'fast');
  assert.equal(s.flags.injuredWeeks, 2);
  for (let i = 0; i < 2; i++) { s.flags.injuredWeeks -= 1; medicalOnWeekEnd(s); }
  const med = ensureMedical(s);
  assert.equal(med.current, null);
  assert.ok(med.fragile >= 3 && med.history.length === 1);
  startInjury(s, 'ankle', 1);
  chooseTreatment(s, 'play');
  assert.equal(s.flags.injuredWeeks, 0);
  assert.ok(s.flags.painkiller);
  const speed = s.player.stats.speed;
  startInjury(s, 'acl', 20);
  assert.ok(treatmentOptions(s).some((o) => o.id === 'surgery'));
  chooseTreatment(s, 'surgery');
  s.flags.injuredWeeks = 0;
  const back = medicalOnWeekEnd(s);
  assert.ok(back.returned && s.player.stats.speed === speed - 2);
  setRandom(Math.random);
});

test('sözleşme maddeleri ve son dakika teklifi', () => {
  setRandom(seeded(103));
  const s = newGame({ name: 'Madde Test', position: 'FW' });
  const offer = { clubId: s.career.clubId, wage: 2000, years: 3, signingBonus: 0 };
  const opts = clauseOptions(s, offer);
  assert.ok(opts.length >= 3 && opts.every((o) => o.p > 0 && o.p < 1));
  setRandom(() => 0.01); // her madde kabul
  const r = negotiateClauses(s, offer, ['goalBonus', 'loyalty']);
  assert.deepEqual(r.accepted, ['goalBonus', 'loyalty']);
  assert.ok(r.wageCut > 0 && offer.wage < 2000);
  s.career.contract = { wage: offer.wage, yearsLeft: 3 };
  applyClauses(s, offer);
  assert.equal(goalBonusFor(s, 2), offer.clauses.goalBonus * 2);
  const money0 = s.career.money;
  clausesOnSeasonEnd(s, false);
  assert.equal(s.career.money, money0 + offer.clauses.loyalty);
  setRandom(seeded(104));
  s.player.fame = 60;
  const lm = lastMinuteOffer(s, []);
  assert.ok(lm === null || (lm.lastMinute && lm.signingBonus > 0));
  setRandom(Math.random);
});
