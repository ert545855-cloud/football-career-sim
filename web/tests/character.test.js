import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame, doAction, takeOffer } from '../src/core/game.js';
import { characterSkillMult, changePersona, ensureCharacter, potentialRange } from '../src/core/character.js';
import { clubBudget, marketValue, priceOffers, rumorsOnWeek } from '../src/core/market.js';
import { offerFor } from '../src/core/economy.js';
import { archiveOnMatch, monthlyAward } from '../src/core/archive.js';
import { runSummerCamp, summerCampDue } from '../src/core/summerCamp.js';
import { CLUBS } from '../src/core/data.js';

const fresh = (pos = 'FW') => { setRandom(seeded(11)); return newGame({ name: 'Karakter Test', position: pos }); };

test('karakter: kişilik, yıldızlar, potansiyel ve uyum yeni oyunda hazır', () => {
  const s = fresh();
  const p = s.player;
  for (const k of ['professionalism', 'leadership', 'ambition', 'discipline']) assert.ok(p.persona[k] >= 0 && p.persona[k] <= 100);
  assert.ok(p.weakFoot >= 1 && p.weakFoot <= 5);
  assert.ok(p.potential >= 66 && p.potential <= 94);
  assert.equal(s.adapt.clubId, s.career.clubId);
  const [lo, hi] = potentialRange(p);
  assert.ok(lo <= p.potential && hi >= p.potential);
});

test('kişilik uçlarda yavaşlar', () => {
  const s = fresh();
  s.player.persona.discipline = 95;
  changePersona(s, 'discipline', 10);
  assert.ok(s.player.persona.discipline < 97, `disiplin ${s.player.persona.discipline}`);
});

test('özel çalışma: tekrarlarla zayıf ayak yıldızı artar', () => {
  const s = fresh();
  const before = s.player.weakFoot;
  for (let i = 0; i < 12; i++) {
    s.calendar.slots = 4;
    s.player.energy = 100;
    const r = doAction(s, 'drill', 'weakFoot');
    assert.ok(r.ok, r.text);
  }
  assert.ok(s.player.weakFoot > before);
});

test('oyun tarzı ve uyum etkin yeteneği değiştirir', () => {
  const s = fresh('FW');
  const base = characterSkillMult(s, 'shot', 'box');
  s.player.style = 'finisher';
  assert.ok(characterSkillMult(s, 'shot', 'box') > base);
  s.adapt.pct = 20;
  assert.ok(characterSkillMult(s, 'shot', 'box') < characterSkillMult({ ...s, adapt: { ...s.adapt, pct: 100 } }, 'shot', 'box'));
});

test('piyasa: bonservis, bütçe, serbest kalma; kiralık sözleşmeyi ana kulüpte bırakır', () => {
  const s = fresh();
  assert.ok(marketValue(s) > 0);
  const strong = CLUBS.slice().sort((a, b) => b.rating - a.rating)[0];
  assert.ok(clubBudget(s, strong.id) > clubBudget(s, CLUBS[CLUBS.length - 1].id));
  const offers = priceOffers(s, [offerFor(s, strong.id)], 'mid');
  assert.ok(offers.length >= 1 && offers[0].fee >= 0 && offers[0].budget > 0);
  s.career.contract.yearsLeft = 0;
  const free = priceOffers(s, [offerFor(s, strong.id)], 'end');
  assert.equal(free[0].fee, 0);
  // kiralık
  s.career.contract = { wage: 777, yearsLeft: 2 };
  const parent = s.career.clubId;
  const loan = { ...offerFor(s, strong.id), loan: true, buyOption: 500000, years: 1 };
  takeOffer(s, loan);
  assert.equal(s.career.contract.wage, 777);
  assert.equal(s.career.loan.parentId, parent);
  assert.equal(s.market.transfers.at(-1).kind, 'loan');
});

test('söylentiler: formdaki oyuncuya kulüpler ilgi gösterir', () => {
  const s = fresh();
  s.player.ratings = [8.4, 8.2, 8.6, 8.1, 8.5];
  let news = 0;
  for (let i = 0; i < 40; i++) news += rumorsOnWeek(s, { played: true, rating: 8.3, goals: 2 }).length;
  assert.ok(news > 0 && s.market.interest.length > 0);
});

test('arşiv: gol türleri, rekorlar ve ayın oyuncusu', () => {
  const s = fresh();
  const match = { oppId: CLUBS[0].id, goals: [{ me: true, kind: 'penalty' }, { me: true, kind: 'cross' }, { me: false, kind: 'open' }] };
  archiveOnMatch(s, match, { played: true, goals: 2, assists: 1, rating: 8.9 });
  assert.equal(s.career.goalTypes.penalty, 1);
  assert.equal(s.career.records.mostGoals, 2);
  let won = 0;
  for (let k = 0; k < 30; k++) {
    for (let i = 0; i < 4; i++) archiveOnMatch(s, match, { played: true, goals: 2, assists: 1, rating: 8.8 });
    s.calendar.week = 4 + k * 4;
    if (monthlyAward(s)) won++;
  }
  assert.ok(won > 5);
});

test('yaz kampı: 2. sezondan itibaren, sezonda bir kez', () => {
  const s = fresh();
  assert.equal(summerCampDue(s), false);
  s.calendar.season = 2;
  s.calendar.week = 1;
  assert.equal(summerCampDue(s), true);
  const r = runSummerCamp(s, 'tactics');
  assert.equal(r.focus.id, 'tactics');
  assert.equal(summerCampDue(s), false);
  ensureCharacter(s);
});
