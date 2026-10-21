import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { completeCupMatch, createCup, cupOnWeekEnd, groupTable, planCupMatch, scheduleSuperCup, cupSeasonEnd } from '../src/core/cup.js';
import { chooseTreatment, ensureMedical, medicalOnWeekEnd, startInjury, treatmentOptions } from '../src/core/injury.js';
import { clauseOptions, negotiateClauses, applyClauses, goalBonusFor, clausesOnSeasonEnd } from '../src/core/clauses.js';
import { lastMinuteOffer } from '../src/core/economy.js';
import { CLUB_BY_ID, LEAGUES } from '../src/core/data.js';

test('kupa: üst lig ön elemeye girmez; alt ligler kademeli ön eleme; gruplar → doğrudan çeyrek final', () => {
  setRandom(seeded(101));
  const s = newGame({ name: 'Kupa Test', position: 'FW' });
  const cup = createCup(s);
  assert.ok(cup && cup.name === 'Türkiye Kupası');
  const topIds = s.world.leagues.super.teams;
  // AŞAMA 1: ön elemede tek bir üst lig kulübü yok
  const preClubs = cup.plan.flatMap((p) => p.enter);
  assert.equal(topIds.filter((id) => preClubs.includes(id)).length, 0, 'Süper Lig kulüpleri ön elemeye katılmaz');
  assert.deepEqual([...cup.direct].sort(), [...topIds].sort(), 'tüm Süper Lig kulüpleri doğrudan gruplarda');
  // kademeli katılım: 1. tur amatörler + en alt lig, sonraki turlarda üst kademeler
  const lvl = (id) => (CLUB_BY_ID[id].amateur ? 5 : LEAGUES[CLUB_BY_ID[id].league].level);
  assert.ok(cup.plan[0].enter.every((id) => lvl(id) >= 4), '1. tur: 3. Lig + amatörler');
  assert.ok(cup.plan[1].enter.every((id) => lvl(id) === 3), '2. tur: 2. Lig katılır');
  assert.ok(cup.plan[2].enter.every((id) => lvl(id) === 2), '3. tur: 1. Lig katılır');
  // AŞAMA 2: 4 grup; her gruba en az bir ön eleme galibi
  assert.equal(cup.format.groups, 4);
  assert.equal(cup.format.groups * cup.format.size, topIds.length + cup.format.qualifiers);
  // AŞAMA 3: gruplardan sonra doğrudan çeyrek final (Son 32 / Son 16 yok)
  assert.deepEqual(Object.keys(cup.rounds), ['qf', 'sf', 'f']);
  assert.ok(!cup.stages.some((st) => st === 'r32' || st === 'r16'));
  const me = s.career.clubId;
  assert.ok(preClubs.includes(me), '1. Lig kulübümüz ön elemede');
  let played = 0;
  let groupsDone = false;
  for (let week = 1; week <= s.world.weeks && !cup.winner; week++) {
    s.calendar.week = week;
    const t = cupOnWeekEnd(s, week);
    if (t) {
      const m = planCupMatch(s);
      assert.ok(m.cup && m.homeId === t.h);
      const grp = /^g\d+$/.test(t.round);
      assert.equal(m.knockout, !grp, 'grup maçı eleme değil');
      m.score = grp && played === 3 ? { my: 1, opp: 1 } : { my: 3, opp: 0 };
      const r = completeCupMatch(s, m, { success: true });
      assert.equal(s.pending.cupTie, null);
      if (grp) assert.equal(r.pens, null, 'grupta penaltı yok');
      played++;
    }
    if (!groupsDone && cup.stage === 'qf') {
      groupsDone = true;
      // gruplar bitti: her grubun 1. ve 2.si çeyrek finalde, başka kimse yok
      const teams = cup.rounds.qf.flatMap((x) => [x.h, x.a]);
      assert.equal(new Set(teams).size, 8);
      const expected = cup.groups.flatMap((g) => groupTable(s.world, g).slice(0, 2).map((r) => r.id));
      assert.deepEqual([...teams].sort(), [...expected].sort());
      // grup birincisi iç sahada, başka grubun ikincisine karşı
      for (const t of cup.rounds.qf) assert.ok(cup.groups.find((g) => groupTable(s.world, g)[0].id === t.h));
      // gruplarda hem üst lig hem ön eleme galipleri vardı
      assert.ok(cup.groups.every((g) => g.teams.some((id) => topIds.includes(id))));
      assert.ok(cup.groups.some((g) => g.teams.some((id) => !topIds.includes(id))));
    }
  }
  assert.ok(groupsDone, 'gruplar çeyrek finale bağlandı');
  assert.ok(cup.winner, 'final oynandı');
  assert.equal(cup.winner, me, 'hep kazanan kulübümüz şampiyon');
  assert.ok(played >= 10, `ön eleme + grup + eleme maçları oynandı: ${played}`);
  const pair = cupSeasonEnd(s, s.career.clubId, 'xx');
  assert.ok(s.lastCup && s.lastCup.winner);
  assert.ok(pair && scheduleSuperCup(s, pair) && s.pending.cupTie.kind === 'super');
  setRandom(Math.random);
});

test('kupa biçimi: her ülkede üst lig doğrudan grupta, gruplara tam olarak kontenjan kadar takım kalır', () => {
  setRandom(seeded(105));
  for (const nat of ['tr', 'en', 'de', 'us', 'sc', 'ca', 'ar', 'wa', 'ro', 'br', 'eg']) {
    const s = newGame({ name: 'Kupa Ülke', position: 'MF', nationality: nat });
    const cup = s.cup;
    const top = Object.values(s.world.leagues).filter((lg) => LEAGUES[lg.id].country === nat && LEAGUES[lg.id].level === 1).flatMap((lg) => lg.teams);
    assert.equal(cup.direct.length, top.length, nat);
    // turları sırayla oyna: gruplara giren = üst lig + kontenjan
    for (let week = 1; week <= s.world.weeks && !cup.winner; week++) { s.calendar.week = week; const t = cupOnWeekEnd(s, week); if (t) { const m = planCupMatch(s); m.score = { my: 2, opp: 1 }; completeCupMatch(s, m); } }
    const inGroups = cup.groups.flatMap((g) => g.teams);
    assert.equal(inGroups.length, top.length + cup.format.qualifiers, nat);
    assert.ok(top.every((id) => inGroups.includes(id)), `${nat}: üst lig grupta`);
    assert.ok(cup.winner, `${nat}: kupa tamamlandı`);
    const weeks = cup.stages.map((st) => cup.weeks[st]);
    for (let i = 1; i < weeks.length; i++) assert.ok(weeks[i] > weeks[i - 1], `${nat}: turlar ayrı haftalarda`);
    assert.ok(weeks[weeks.length - 1] <= s.world.weeks, `${nat}: final sezon içinde`);
  }
  setRandom(Math.random);
});

test('kupa: sezon ortasında kurulursa geçmiş turlar simüle edilir', () => {
  setRandom(seeded(77));
  const s = newGame({ name: 'Kupa Geç', position: 'MF' });
  s.cup = null;
  const probe = createCup(s);
  s.calendar.week = probe.weeks.qf + 1;
  s.cup = null;
  const cup = createCup(s);
  assert.equal(cup.stage, 'sf', 'çeyrek final haftası geçti');
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

test('kupa: karda ertelenen eşleşme bir hafta bekler, tur o oynanınca ilerler', async () => {
  const { cupTieReady, cupTieCanPostpone, postponeCupTie } = await import('../src/core/cup.js');
  setRandom(seeded(202));
  const s = newGame({ name: 'Kar Test', position: 'FW' });
  const cup = createCup(s);
  let t = null;
  let week = 1;
  for (; week <= s.world.weeks && !t; week++) { s.calendar.week = week; t = cupOnWeekEnd(s, week); }
  assert.ok(t, 'bir kupa eşleşmesi geldi');
  const stage = cup.stage;
  s.calendar.week = week; // eşleşmenin oynanacağı hafta
  const m = planCupMatch(s);
  m.weather = { ...m.weather, id: 'snow', temp: -6, postpone: true };
  assert.ok(cupTieCanPostpone(s, m));
  postponeCupTie(s, m);
  assert.equal(cupTieReady(s), false, 'bu hafta oynanmaz');
  assert.equal(cupTieCanPostpone(s, m), false, 'ikinci kez ertelenmez');
  // hafta biter: tur ilerlemez, yeni eşleşme gelmez
  assert.equal(cupOnWeekEnd(s, week), null);
  assert.equal(cup.stage, stage);
  s.calendar.week = week + 1;
  assert.ok(cupTieReady(s), 'gelecek hafta oynanır');
  const m2 = planCupMatch(s);
  m2.score = { my: 2, opp: 0 };
  completeCupMatch(s, m2, { success: true });
  assert.equal(s.pending.cupTie, null);
  // gecikmeli tur sonraki hafta sonunda işlenir
  for (let w = week + 1; w <= week + 3 && !s.pending.cupTie && !cup.out; w++) cupOnWeekEnd(s, w);
  assert.notEqual(cup.stage, stage, 'kupa ilerledi');
  setRandom(Math.random);
});
