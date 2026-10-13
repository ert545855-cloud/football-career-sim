import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame, takeOffer } from '../src/core/game.js';
import { weeklyFinance } from '../src/core/economy.js';
import {
  AGENTS, acceptCounter, askRaise, canHire, hireAgent, negotiate, negotiationOdds, agentNetworkOffers, releaseFee,
} from '../src/core/agent.js';

const offerFor = (s, clubId = 'efe') => ({ clubId, wage: 1000, years: 3, signingBonus: 6000, renewal: false, outlook: { id: 'rotation', label: 'Rotasyon oyuncusu', tone: 'warn' } });

test('ajan: işe alma şartları, komisyon ve ayrılma bedeli', () => {
  setRandom(seeded(21));
  const s = newGame({ name: 'Test', position: 'MF' });
  assert.equal(s.agent.id, 'self');
  assert.equal(weeklyFinance(s).agent, 0);
  assert.equal(canHire(s, 'vitali').ok, false, 'süper ajan acemiyi almaz');
  assert.ok(hireAgent(s, 'kemal').ok);
  const f = weeklyFinance(s);
  assert.equal(f.agent, Math.round(s.career.contract.wage * 0.05));
  assert.equal(f.net, f.income - f.living - f.upkeep - f.agent);
  assert.ok(releaseFee(s) > 0, 'sözleşme sürerken ayrılmak bedelli');
  s.player.fame = 30;
  s.career.money = 100000;
  const before = s.career.money;
  assert.ok(hireAgent(s, 'selin').ok);
  assert.ok(s.career.money < before);
});

test('ajan: pazarlık olasılıkları tutarlı; açgözlülük kabulü düşürür, iyi ajan artırır', () => {
  setRandom(seeded(22));
  const s = newGame({ name: 'Test', position: 'FW' });
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = 42; // kulübün orta düzeyde ilgilendiği oyuncu
  const o = offerFor(s);
  const none = negotiationOdds(s, o, { wage: 0, bonus: 0, years: 3 });
  assert.equal(none.accept, 1);
  const modest = negotiationOdds(s, o, { wage: 1, bonus: 0, years: 3 });
  const greedy = negotiationOdds(s, o, { wage: 3, bonus: 2, guarantee: true, years: 3 });
  for (const x of [modest, greedy]) assert.ok(Math.abs(x.accept + x.counter + x.walk - 1) < 1e-9);
  assert.ok(greedy.accept < modest.accept);
  // Sert pazarlıkçı OVR 40+ ister; ilgi (OVR'ye bağlı) aynı kalsın diye karşılaştırmayı aynı statlarla yap
  s.player.fame = 30;
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = 50;
  const selfOdds = negotiationOdds(s, o, { wage: 1, bonus: 0, years: 3 });
  assert.ok(hireAgent(s, 'ferit').ok);
  const withAgent = negotiationOdds(s, o, { wage: 1, bonus: 0, years: 3 });
  assert.ok(withAgent.accept > selfOdds.accept, 'sert pazarlıkçı daha çok kabul ettirir');
});

test('ajan: pazarlık sonuçları teklifi doğru günceller', () => {
  setRandom(seeded(23));
  const s = newGame({ name: 'Test', position: 'FW' });
  const a = offerFor(s);
  const r1 = negotiate(s, a, { wage: 2, bonus: 1, years: 3 }, 0); // kesin kabul
  assert.equal(r1.result, 'accept');
  assert.equal(a.wage, 1200);
  assert.equal(a.signingBonus, 9000);
  const b = offerFor(s);
  const oddsB = negotiationOdds(s, b, { wage: 3, bonus: 0, years: 3 }, 1);
  const r2 = negotiate(s, b, { wage: 3, bonus: 0, years: 3 }, oddsB.accept + 1e-6); // karşı teklif
  assert.equal(r2.result, 'counter');
  acceptCounter(b);
  assert.ok(b.wage > 1000 && b.wage < 1350);
  const c = offerFor(s);
  const r3 = negotiate(s, c, { wage: 3, bonus: 2, years: 3 }, 0.999999); // masadan kalkar
  assert.equal(r3.result, 'walk');
  assert.ok(c.withdrawn);
});

test('ajan: garanti maddesi, imza parası payı ve ağ teklifi', () => {
  setRandom(seeded(24));
  const s = newGame({ name: 'Test', position: 'FW' });
  s.player.fame = 30;
  hireAgent(s, 'selin');
  const o = { ...offerFor(s), guarantee: true };
  const before = s.career.money;
  takeOffer(s, o);
  assert.equal(s.career.clubId, 'efe');
  assert.equal(s.career.money - before, 6000 - Math.round(6000 * 0.08));
  assert.ok(s.career.guarantee && s.career.guarantee.untilSeason >= s.calendar.season);
  // Ağ: süper ajan ve yüksek OVR ile mutlaka bir ek teklif gelir (şans 1'e zorlanır)
  setRandom(() => 0);
  s.player.fame = 60;
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = 70;
  s.career.money = 1e6;
  assert.ok(hireAgent(s, 'vitali').ok);
  const list = agentNetworkOffers(s, [], 'end');
  assert.equal(list.length, 1);
  assert.equal(list[0].viaAgent, 'vitali');
});

test('ajan: zam talebi sezonda bir kez', () => {
  setRandom(seeded(25));
  const s = newGame({ name: 'Test', position: 'DF' });
  s.career.loan = null;
  s.career.academy = null;
  s.calendar.week = 8;
  const w = s.career.contract.wage;
  const r = askRaise(s, 0);
  assert.ok(r.ok && r.success);
  assert.ok(s.career.contract.wage > w);
  const again = askRaise(s, 0);
  assert.equal(again.ok, false);
  assert.ok(AGENTS.every((a) => a.commission >= 0 && a.commission < 0.2));
});
