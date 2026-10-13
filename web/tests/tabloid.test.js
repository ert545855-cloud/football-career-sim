import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { buyItem } from '../src/core/economy.js';
import { applyMod } from '../src/core/garage.js';
import { answerOuting, finishOuting, startOuting } from '../src/core/social/index.js';
import { paparazziOdds, publishTabloid, resolveSocialChoice, SOCIAL_EVENTS } from '../src/core/social/events.js';
import { getEvent, resolveEvent } from '../src/core/events.js';
import { timelineOf } from '../src/core/chirp/index.js';

const fresh = (patch = {}) => {
  setRandom(seeded(17));
  const s = newGame({ name: 'Arda Yılmaz', position: 'FW' });
  s.career.money = 500000;
  Object.assign(s.player, { age: 22, fame: 40, ...patch });
  return s;
};
const paparazzi = SOCIAL_EVENTS.find((e) => e.id === 'paparazzi');

function outing(s, venueId, tierId, who, picks = 0) {
  const st = startOuting(s, { venueId, tierId, companionId: who });
  assert.ok(st.ok, st.reason);
  const o = st.outing;
  while (o.i < o.beats.length) answerOuting(s, o, picks);
  return o;
}

test('paparazzi: bar > kafe, ev 0; ün artırır; koyu cam azaltır, neon artırır', () => {
  const s = fresh();
  const bar = outing(s, 'bar', 'bar2', 'emre');
  const cafe = outing(s, 'cafe', 'cafe1', 'emre');
  const tierBar = { prestige: 2 };
  assert.ok(paparazziOdds(s, bar, tierBar) > paparazziOdds(s, cafe, { prestige: 1 }));
  assert.equal(paparazziOdds(s, { ...cafe, venueId: 'home' }, {}), 0);
  const low = fresh({ fame: 10 });
  assert.equal(paparazziOdds(low, bar, tierBar), 0, 'tanınmayan oyuncuyu paparazzi kovalamaz');
  const base = paparazziOdds(s, bar, tierBar);
  buyItem(s, 'hatch');
  applyMod(s, 'hatch', 'tint', 'dark');
  assert.ok(paparazziOdds(s, bar, tierBar) < base, 'koyu cam gizler');
  applyMod(s, 'hatch', 'tint', 'none');
  applyMod(s, 'hatch', 'neon', 'purple');
  applyMod(s, 'hatch', 'rims', 'gold');
  assert.ok(paparazziOdds(s, bar, tierBar) > base, 'gösterişli araba dikkat çeker');
});

test('paparazzi: barda gece hayatı magazine düşer, Chirp\'te Flaş Magazin paylaşır', () => {
  const s = fresh();
  const o = outing(s, 'bar', 'bar2', 'emre', 1); // esprili cevaplar (soda değil)
  o.picks = o.picks.filter((t) => t !== 'humble');
  const mgr = s.player.rel.manager;
  const before = timelineOf(s).list().length;
  const ev = paparazzi.apply({ state: s, outing: o, tier: { name: 'Neon Lounge', prestige: 2 } });
  assert.equal(ev.tone, 'bad');
  assert.match(ev.tabloid.headline, /GECE KULÜBÜNDE/);
  assert.ok(s.player.rel.manager < mgr);
  const entry = publishTabloid(s, ev.tabloid);
  assert.equal(s.social.press[0], entry);
  const tl = timelineOf(s).list();
  assert.equal(tl.length, before + 1);
  assert.equal(tl[0].authorId, 'magazin');
  assert.equal(tl[0].topic, 'scandal');
  assert.ok(tl[0].meta.photo.venueId === 'bar');
  // Soda içtiysen haber olumlu
  const o2 = outing(s, 'bar', 'bar1', 'emre');
  o2.picks = ['humble'];
  assert.equal(paparazzi.apply({ state: s, outing: o2, tier: { name: 'Tribün Pub', prestige: 1 } }).tone, 'good');
});

test('paparazzi: sevgili varken başkasıyla yakalanmak skandal ve ayrılık getirebilir', () => {
  const s = fresh();
  Object.assign(s.social.rel.zeynep, { met: true, v: 62 });
  s.social.partner = 'zeynep';
  Object.assign(s.social.rel.melis, { met: true, v: 30 });
  const o = outing(s, 'bar', 'bar3', 'melis');
  const tier = { name: 'Rooftop 34', prestige: 3 };
  assert.ok(paparazziOdds(s, o, tier) > paparazziOdds(s, { ...o, kind: 'friend' }, tier) * 1.5, 'skandal kokusu paparazziyi çeker');
  const ev = paparazzi.apply({ state: s, outing: o, tier });
  assert.equal(ev.tone, 'bad');
  assert.equal(s.social.partner, null, '62 − 30 → ilişki biter');
  assert.equal(ev.breakup, 'Zeynep');
});

test('sataşma: seçime göre sonuç; karşılık vermek ceza ve magazin', () => {
  const s = fresh();
  const ev = { id: 'provoke', venueId: 'bar', palette: 'neon' };
  const fans = s.player.rel.fans;
  const r1 = resolveSocialChoice(s, ev, 'sign');
  assert.ok(s.player.rel.fans > fans && r1.tone === 'good');
  const money = s.career.money;
  const r2 = resolveSocialChoice(s, ev, 'fight');
  assert.equal(s.career.money, money - 2000);
  assert.ok(r2.press && r2.press.tone === 'bad');
});

test('haftalık magazin olayları: sevgili şartı ve gazete sayfası', () => {
  const s = fresh();
  const doorstep = getEvent('tabloid_doorstep');
  assert.equal(doorstep.when(s), false);
  Object.assign(s.social.rel.ece, { met: true, v: 70 });
  s.social.partner = 'ece';
  assert.equal(doorstep.when(s), true);
  const r = resolveEvent(s, 'tabloid_doorstep', 0);
  assert.ok(r.press && r.press.tone === 'good');
  assert.ok(s.social.rel.ece.v > 70);
  const sim = { ...outing(s, 'cafe', 'cafe1', 'emre') };
  finishOuting(s, sim);
});
