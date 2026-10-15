import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { CUP_WEEK, completeCupMatch, createCup, cupOnWeekEnd, planCupMatch, scheduleSuperCup, cupSeasonEnd } from '../src/core/cup.js';
import { chooseTreatment, ensureMedical, medicalOnWeekEnd, startInjury, treatmentOptions } from '../src/core/injury.js';
import { clauseOptions, negotiateClauses, applyClauses, goalBonusFor, clausesOnSeasonEnd } from '../src/core/clauses.js';
import { lastMinuteOffer } from '../src/core/economy.js';

test('kupa: tur haftasında eşleşme, maç, ilerleme; şampiyonluk ödülü', () => {
  setRandom(seeded(101));
  const s = newGame({ name: 'Kupa Test', position: 'FW' });
  const cup = createCup(s);
  assert.ok(cup && cup.name === 'Türkiye Kupası');
  const first = cup.current;
  assert.ok(cup.rounds[first].some((t) => t.h === s.career.clubId || t.a === s.career.clubId));
  const tie = cupOnWeekEnd(s, CUP_WEEK[first]);
  assert.ok(tie && s.pending.cupTie);
  const m = planCupMatch(s);
  assert.ok(m.cup && m.knockout && m.homeId === tie.h);
  m.score = { my: 3, opp: 0 };
  const r = completeCupMatch(s, m);
  assert.equal(r.won, true);
  assert.equal(s.pending.cupTie, null);
  assert.notEqual(cup.current, first, 'sonraki tura geçildi');
  // berabere: penaltılar karar verir, won her zaman boolean
  const t2 = cupOnWeekEnd(s, CUP_WEEK[cup.current]);
  if (t2) {
    const m2 = planCupMatch(s);
    m2.score = { my: 1, opp: 1 };
    const r2 = completeCupMatch(s, m2, { success: true });
    assert.ok(r2.pens && typeof r2.won === 'boolean');
  }
  const pair = cupSeasonEnd(s, s.career.clubId, 'xx');
  assert.ok(s.lastCup && s.lastCup.winner);
  assert.ok(scheduleSuperCup(s, pair) && s.pending.cupTie.kind === 'super');
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
