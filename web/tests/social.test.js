import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { migrate } from '../src/core/storage.js';
import {
  SOCIAL_RULES, answerOuting, canGoOut, ensureSocial, finishOuting, outingsLeft, partnerOf, romanceAllowed, socialContacts,
  socialOnWeekEnd, startOuting, toneDelta, PERSON_BY_ID,
} from '../src/core/social/index.js';
import {
  FURNITURE_BY_ID, buyFurniture, ensureHome, homeOf, homeScore, placeFurniture, sellFurniture, setFinish, storeFurniture,
} from '../src/core/social/home.js';

const fresh = (seed = 5, patch = {}) => {
  setRandom(seeded(seed));
  const s = newGame({ name: 'Test Oyuncu', position: 'FW' });
  s.career.money = 100000;
  Object.assign(s.player, patch);
  return s;
};

/** Buluşmayı en iyi cevaplarla oynar (kişinin sevdiği üsluplar) */
function playBest(s, venueId, tierId, who) {
  const st = startOuting(s, { venueId, tierId, companionId: who });
  assert.ok(st.ok, st.reason);
  const o = st.outing;
  while (o.i < o.beats.length) {
    const opts = o.beats[o.i].options;
    let best = 0;
    let bestD = -99;
    opts.forEach((op, i) => {
      const d = toneDelta(o.person, o.kind, op.tone, s.social.rel[who]?.v ?? 0);
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    });
    answerOuting(s, o, best);
  }
  return { outing: o, result: finishOuting(s, o) };
}

test('sosyal: yeni kariyer ve eski kayıt sosyal durumu kurar; flört 18 yaş altı kapalı', () => {
  const s = fresh(5, { age: 17 });
  assert.ok(s.social && s.social.rel.emre && s.social.home);
  assert.equal(romanceAllowed(s), false);
  s.social.rel.zeynep.met = true;
  assert.ok(!socialContacts(s).some((c) => c.kind === 'romance'), '18 altı rehberde flört görünmez');
  assert.equal(canGoOut(s, 'cafe', 'cafe2', 'zeynep').ok, false);
  assert.ok(canGoOut(s, 'cafe', 'cafe1', 'emre').ok, 'arkadaşla her yaşta buluşulur');
  // Eski kayıt: social alanı yok → migrate ekler
  const old = JSON.parse(JSON.stringify(s));
  delete old.social;
  const m = migrate(old);
  assert.ok(m.social.rel.selim && m.social.home.placed);
});

test('sosyal: üslup etkisi kişiliğe göre; flört arkadaşa ters teper', () => {
  const z = PERSON_BY_ID.zeynep;
  assert.ok(toneDelta(z, 'romance', 'deep', 30) > toneDelta(z, 'romance', 'cocky', 30));
  assert.ok(toneDelta(z, 'romance', 'cocky', 30) < 0);
  assert.ok(toneDelta(PERSON_BY_ID.emre, 'friend', 'flirty') < 0);
  assert.ok(toneDelta(PERSON_BY_ID.melis, 'romance', 'cocky', 30) > 0, 'Melis özgüveni sever');
});

test('sosyal: çıkış para/enerji/zaman harcar; haftalık sınır', () => {
  const s = fresh(8);
  const money = s.career.money;
  const slots = s.calendar.slots;
  const { result } = playBest(s, 'cafe', 'cafe1', 'emre');
  assert.equal(s.career.money, money - 20);
  assert.equal(s.calendar.slots, slots - 1);
  assert.ok(result.changes.some((c) => c.key === 'rel' && c.delta > 0));
  assert.equal(outingsLeft(s), SOCIAL_RULES.maxOutingsPerWeek - 1);
  playBest(s, 'bar', 'bar1', 'emre');
  assert.equal(outingsLeft(s), 0);
  assert.equal(canGoOut(s, 'cafe', 'cafe1', 'emre').ok, false);
});

test('sosyal: iyi buluşmalar flörtü sevgiliye taşır; görüşülmezse ilişki soğur ve biter', () => {
  const s = fresh(11, { age: 22 });
  ensureSocial(s);
  s.social.rel.zeynep.met = true;
  s.social.rel.zeynep.v = 20;
  let partner = false;
  for (let i = 0; i < 12 && !partner; i++) {
    s.calendar.slots = 4;
    s.social.week = { key: '', n: 0 };
    s.player.energy = 100;
    const { result } = playBest(s, 'cafe', 'cafe2', 'zeynep');
    if (result.stage?.partner) partner = true;
  }
  assert.ok(partner, 'birkaç iyi buluşmada sevgili olunur');
  assert.equal(partnerOf(s).id, 'zeynep');
  // Uzun süre görüşmeme: soğuma → ayrılık
  s.social.rel.zeynep.v = 52;
  s.social.rel.zeynep.last = 0;
  s.calendar.week = 30;
  let out = null;
  for (let i = 0; i < 10 && s.social.partner; i++) out = socialOnWeekEnd(s);
  assert.equal(s.social.partner, null);
  assert.equal(out.breakup, 'Zeynep');
});

test('ev: mobilya al, yerleştir, çakışma, halı ve duvar katmanı, döndürme, depo, satış', () => {
  const s = fresh(3);
  const plan = homeOf(s);
  assert.equal(plan.id, 'room');
  const sofa = buyFurniture(s, 'sofa_l').item;
  assert.ok(placeFurniture(s, sofa.uid, 0, 0, 0).ok);
  const tv = buyFurniture(s, 'tv').item;
  assert.equal(placeFurniture(s, tv.uid, 1, 1, 0).ok, false, 'L koltukla çakışır');
  assert.ok(placeFurniture(s, tv.uid, 3, 2, 0).ok);
  const rug = buyFurniture(s, 'rug').item;
  assert.ok(placeFurniture(s, rug.uid, 0, 0, 0).ok, 'halı eşyanın altına serilebilir');
  const art = buyFurniture(s, 'painting').item;
  assert.equal(placeFurniture(s, art.uid, 2, 2, 0).ok, false, 'tablo yalnızca üst duvara');
  assert.ok(placeFurniture(s, art.uid, 1, 0, 0).ok, 'tablo duvarda, koltuğun üstünde olabilir');
  // Döndürme: 3×2 → 2×3
  const h = ensureHome(s);
  assert.ok(placeFurniture(s, sofa.uid, 0, 0, 1).ok);
  assert.equal(h.placed.find((p) => p.uid === sofa.uid).rot, 1);
  // Puanlar
  const hs = homeScore(s);
  assert.equal(hs.comfort, FURNITURE_BY_ID.sofa_l.comfort + FURNITURE_BY_ID.tv.comfort + FURNITURE_BY_ID.rug.comfort + FURNITURE_BY_ID.painting.comfort);
  assert.ok(hs.weekly.energy <= 8 && hs.weekly.morale <= 5);
  // Depo ve satış
  assert.ok(storeFurniture(s, tv.uid));
  assert.ok(h.owned.some((o) => o.uid === tv.uid));
  const money = s.career.money;
  const refund = sellFurniture(s, tv.uid);
  assert.equal(refund, Math.round(FURNITURE_BY_ID.tv.price * 0.4));
  assert.equal(s.career.money, money + refund);
  // Duvar ve zemin
  assert.ok(setFinish(s, 'wall', 'navy').ok);
  assert.equal(h.wall, 'navy');
  const m2 = s.career.money;
  assert.ok(setFinish(s, 'wall', 'navy').ok);
  assert.equal(s.career.money, m2, 'sahip olunan renk tekrar ücret almaz');
});

test('ev: daha küçük plana geçince sığmayanlar depoya döner; konfor haftalık enerji verir', () => {
  const s = fresh(4);
  s.career.items.push('villa');
  const h = ensureHome(s);
  assert.equal(homeOf(s).id, 'villa');
  const bed = buyFurniture(s, 'bed_luxe').item;
  assert.ok(placeFurniture(s, bed.uid, 8, 5, 0).ok);
  for (const id of ['sofa_l', 'massage_chair', 'tv', 'aquarium']) {
    const it = buyFurniture(s, id).item;
    for (let y = 0; y < 8; y++) {
      let ok = false;
      for (let x = 0; x < 11; x++) if ((ok = placeFurniture(s, it.uid, x, y, 0).ok)) break;
      if (ok) break;
    }
  }
  const comfort = homeScore(s).comfort;
  assert.ok(comfort >= 20);
  const e0 = s.player.energy = 40;
  socialOnWeekEnd(s);
  assert.ok(s.player.energy > e0, 'evin konforu enerji verir');
  // villayı sat → misafirhaneye dön
  s.career.items = s.career.items.filter((i) => i !== 'villa');
  ensureHome(s);
  assert.equal(homeOf(s).id, 'room');
  assert.ok(h.owned.some((o) => o.uid === bed.uid), 'sığmayan yatak depoya döner');
  for (const p of h.placed) assert.ok(p.x + 1 <= 5 && p.y + 1 <= 4);
});

test('sosyal: aynı kişiyle buluşmalar her seferinde farklı sohbetler getirir', async () => {
  const { newGame } = await import('../src/core/game.js');
  const so = await import('../src/core/social/index.js');
  const s = newGame({ name: 'Çeşit Test', position: 'MF' });
  const p = so.socialContacts(s)[0];
  const lines = [];
  for (let i = 0; i < 6; i++) {
    s.career.money = 1e6; s.player.energy = 100;
    const r = so.startOuting(s, { venueId: p.venues[i % p.venues.length], companionId: p.id });
    lines.push(...r.outing.beats.map((b) => b.line));
  }
  assert.ok(new Set(lines).size >= lines.length - 2, `${new Set(lines).size}/${lines.length}`);
});
