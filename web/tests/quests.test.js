import { test } from 'node:test';
import assert from 'node:assert/strict';
import { random, setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { QUESTS, claimQuest, ensureQuests, generateQuests, openChest, questsOn } from '../src/core/quests.js';
import { ensureCosmetics } from '../src/core/cosmetics.js';

const fresh = (pos = 'FW') => { setRandom(seeded(41)); return newGame({ name: 'Görev Test', position: pos }); };

test('görevler: haftada 3 görev, aynı hafta aynı görevler, oyun rastgeleliğini bozmaz', () => {
  const s = fresh();
  setRandom(seeded(2));
  const expect = random();
  setRandom(seeded(2));
  const q = ensureQuests(s);
  assert.equal(random(), expect);
  assert.equal(q.list.length, 3);
  assert.deepEqual(generateQuests(s).map((t) => t.id), q.list.map((t) => t.id));
  const cats = q.list.map((t) => QUESTS[t.id].cat);
  assert.deepEqual(cats, ['match', 'grow', 'life']);
  for (const t of q.list) assert.ok(t.reward.money > 0 && t.text.length > 4);
});

test('görevler: olaylar ilerletir, ödül alınır, üçü bitince sandık kozmetik verir', () => {
  const s = fresh();
  const q = ensureQuests(s);
  // görevleri bilinen hale getir
  q.list = [
    { n: 0, id: 'goals', target: 2, progress: 0, done: false, claimed: false, reward: { money: 500, fame: 0.5 }, text: '2 gol' },
    { n: 1, id: 'gym', target: 1, progress: 0, done: false, claimed: false, reward: { money: 300, fame: 0 }, text: 'salon' },
    { n: 2, id: 'media', target: 1, progress: 0, done: false, claimed: false, reward: { money: 300, fame: 0 }, text: 'medya' },
  ];
  questsOn(s, 'match', { played: true, goals: 1, rating: 7 });
  assert.equal(q.list[0].progress, 1);
  assert.equal(q.list[0].done, false);
  questsOn(s, 'match', { played: true, goals: 1, rating: 7 });
  assert.equal(q.list[0].done, true);
  questsOn(s, 'gym', { station: 'stretch' });
  assert.equal(q.list[1].done, false, 'esneme sayılmaz');
  questsOn(s, 'gym', { station: 'treadmill', q: 0.5 });
  questsOn(s, 'action', { id: 'media' });
  assert.ok(q.list.every((t) => t.done));
  assert.ok(q.chest);
  const m0 = s.career.money;
  assert.ok(claimQuest(s, 0).ok);
  assert.equal(s.career.money, m0 + 500);
  assert.equal(claimQuest(s, 0).ok, false, 'iki kez alınmaz');
  const owned = ensureCosmetics(s).owned.length;
  const r = openChest(s);
  assert.ok(r.ok);
  if (r.cosmetic) assert.equal(ensureCosmetics(s).owned.length, owned + 1);
  // hafta dönünce alınmayanlar kasaya geçer
  const m1 = s.career.money;
  s.calendar.week += 1;
  const q2 = ensureQuests(s);
  assert.equal(s.career.money, m1 + 600);
  assert.equal(q2.carried, 600);
  assert.equal(q2.list.length, 3);
});

test('görevler: yedek kulübesindeki oyuncuya forma giyme görevi, sakat oyuncuya maç görevi gelmez', () => {
  const s = fresh('MF');
  s.career.lastRole = 'bench';
  let benchQuest = 0;
  for (let w = 1; w <= 20; w++) { s.calendar.week = w; if (generateQuests(s).some((t) => ['play', 'rating', 'motm'].includes(t.id))) benchQuest++; }
  assert.ok(benchQuest >= 18);
  s.flags.injuredWeeks = 3;
  for (let w = 1; w <= 10; w++) { s.calendar.week = w; assert.ok(!generateQuests(s).some((t) => QUESTS[t.id].cat === 'match')); }
});
