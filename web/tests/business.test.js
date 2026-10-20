import { test } from 'node:test';
import assert from 'node:assert/strict';
import { random, setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import {
  BIZ_RULES, activeBiz, bizAdvice, bizValue, businessOnWeek, canOpen, estimate, openBusiness, sellBiz, setManager, upgradeBiz, visitBiz,
} from '../src/core/business.js';
import { buyProperty, ensureRealty, realtyOnWeek, realtySummary, renovate, sellProperty, setRentPolicy } from '../src/core/realestate.js';
import { gymQuality } from '../src/core/gym.js';

const fresh = () => { setRandom(seeded(61)); const s = newGame({ name: 'İş İnsanı', position: 'FW' }); s.career.money = 900_000; s.player.fame = 40; return s; };
const weeks = (s, n, fn, ctx = {}) => { let out = []; for (let i = 0; i < n; i++) { s.calendar.week = (i % 22) + 1; out.push(fn(s, ctx)); } return out; };

test('iş: kur, kâr et, büyüt, müdür tut, sat; oyun rastgeleliği bozulmaz', () => {
  const s = fresh();
  assert.ok(canOpen(s, 'cafe').ok);
  assert.ok(bizAdvice(s, 'cafe').length > 10);
  const est = estimate(s, 'cafe');
  assert.ok(est.hi > est.lo);
  const r = openBusiness(s, 'cafe');
  assert.ok(r.ok);
  assert.equal(s.career.money, 840_000);
  assert.equal(canOpen(s, 'cafe').ok, false, 'aynı türden ikinci işletme yok');
  setRandom(seeded(5));
  const expect = random();
  setRandom(seeded(5));
  const rows = weeks(s, 30, businessOnWeek);
  assert.equal(random(), expect);
  const total = rows.reduce((n, x) => n + x.profit, 0);
  assert.ok(total > 0, `30 haftada kâr ${total}`);
  const z = activeBiz(s)[0];
  assert.ok(upgradeBiz(s, z.id).ok);
  assert.equal(z.level, 2);
  setManager(s, z.id, true);
  s.calendar.phase = 'week'; s.calendar.slots = 2;
  assert.ok(visitBiz(s, z.id).ok);
  assert.equal(visitBiz(s, z.id).ok, false, 'haftada bir ziyaret');
  const v = bizValue(s, z);
  const m = s.career.money;
  assert.ok(sellBiz(s, z.id).ok);
  assert.equal(s.career.money, m + v);
  assert.equal(activeBiz(s).length, 0);
});

test('iş: kendi spor salonun salon verimini artırır; krampon markası ün ister', () => {
  const s = fresh();
  const q0 = gymQuality(s);
  openBusiness(s, 'gym');
  assert.ok(gymQuality(s) > q0);
  s.player.fame = 20;
  assert.equal(canOpen(s, 'boots').ok, false);
});

test('iş: kasa ekside kalırsa iflas eder', () => {
  const s = fresh();
  openBusiness(s, 'boots');
  s.player.fame = 0; // satış çöker
  s.career.money = -50_000;
  let bankrupt = false;
  for (let i = 0; i < BIZ_RULES.bankruptWeeks + 2 && !bankrupt; i++) {
    s.calendar.week = i + 1;
    const r = businessOnWeek(s);
    bankrupt = r.news.some((n) => n.text.includes('iflas etti'));
  }
  assert.ok(bankrupt);
  assert.equal(activeBiz(s).length, 0);
});

test('gayrimenkul: al, kiracı bul, kira topla, yenile, sat', () => {
  const s = fresh();
  const r = ensureRealty(s);
  assert.equal(r.listings.length, 4);
  const l = r.listings.slice().sort((a, b) => a.price - b.price)[0];
  const m0 = s.career.money;
  const b = buyProperty(s, l.lid);
  assert.ok(b.ok);
  assert.ok(s.career.money < m0 - l.price);
  const p = r.owned[0];
  setRentPolicy(s, p.id, 0); // uygun kira: hızlı kiracı
  let rent = 0;
  for (let i = 0; i < 30; i++) { s.calendar.week = (i % 22) + 1; rent += realtyOnWeek(s).rent; }
  assert.ok(rent > 0, 'kira toplandı');
  assert.ok(realtySummary(s).count === 1);
  p.cond = 50;
  const rentBefore = p.rent;
  assert.ok(renovate(s, p.id).ok);
  assert.equal(p.cond, 100);
  assert.ok(p.rent > rentBefore);
  const sold = sellProperty(s, p.id);
  assert.ok(sold.ok && sold.net > 0);
  assert.equal(r.owned.length, 0);
});

test('gayrimenkul: yüksek kira daha uzun boş kalır', () => {
  let lowVac = 0;
  let highVac = 0;
  for (let k = 0; k < 12; k++) {
    for (const [pol, add] of [[0, (v) => { lowVac += v; }], [2, (v) => { highVac += v; }]]) {
      const s = fresh();
      s.player.name = `Kira ${k}`;
      const r = ensureRealty(s);
      const l = r.listings.slice().sort((x, y) => x.price - y.price)[0];
      assert.ok(buyProperty(s, l.lid).ok);
      setRentPolicy(s, r.owned[0].id, pol);
      let v = 0;
      for (let i = 0; i < 12 && !r.owned[0].tenant; i++) { s.calendar.week = i + 1; realtyOnWeek(s); v++; }
      add(v);
    }
  }
  assert.ok(highVac > lowVac, `uygun ${lowVac} / yüksek ${highVac}`);
});

import { PROJECTS, canFound, canStart, donate, ensureFoundation, found, foundationHomeMult, foundationOnWeek, startProject } from '../src/core/foundation.js';
import { legendScore } from '../src/core/afterCareer.js';

test('vakıf: kur, bağış yap, proje bitir; miras taraftarı, imajı ve efsane puanını artırır', () => {
  const s = fresh();
  s.player.fame = 10;
  assert.equal(canFound(s).ok, false);
  s.player.fame = 30;
  const fans0 = s.player.rel.fans;
  const img0 = s.player.rel.sponsor;
  const leg0 = legendScore(s);
  assert.ok(found(s).ok);
  const f = ensureFoundation(s);
  assert.ok(f.name.endsWith('Vakfı'));
  assert.ok(donate(s, 50_000).ok);
  const r = startProject(s, 'pitch');
  assert.ok(r.ok && !r.instant);
  assert.equal(canStart(s, 'pitch').ok, false, 'aynı proje iki kez sürmez');
  for (let i = 0; i < PROJECTS.pitch.weeks; i++) { s.calendar.week = i + 2; foundationOnWeek(s); }
  assert.equal(f.active.length, 0);
  assert.ok(f.legacy >= PROJECTS.pitch.legacy);
  s.calendar.phase = 'week'; s.calendar.slots = 2;
  assert.ok(startProject(s, 'hospital').instant);
  assert.ok(s.player.rel.fans > fans0 && s.player.rel.sponsor > img0);
  assert.ok(legendScore(s) > leg0);
  assert.ok(foundationHomeMult(s, true) > 1 && foundationHomeMult(s, false) === 1);
  assert.equal(canStart(s, 'academy').ok, false, 'okul için miras ve fon gerekir');
  s.calendar.week = 10;
  assert.equal(canStart(s, 'match').ok, false, 'yardım maçı sezon sonunda');
});
