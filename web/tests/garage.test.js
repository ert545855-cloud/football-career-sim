import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { buyItem, sellItem } from '../src/core/economy.js';
import { applyMod, carStats, currentCarId, garageOnWeekEnd, modPrice, optionOf } from '../src/core/garage.js';

const fresh = () => {
  setRandom(seeded(9));
  const s = newGame({ name: 'Test Oyuncu', position: 'FW' });
  s.career.money = 2_000_000;
  return s;
};

test('garaj: araba yokken modifiye yok; en değerli araba sürülür', () => {
  const s = fresh();
  assert.equal(currentCarId(s), null);
  assert.equal(applyMod(s, 'hatch', 'paint', 'red').ok, false);
  buyItem(s, 'bike');
  assert.equal(currentCarId(s), null, 'bisiklet modifiye edilmez');
  buyItem(s, 'hatch');
  buyItem(s, 'super');
  assert.equal(currentCarId(s), 'super');
});

test('garaj: fiyat araca göre ölçeklenir; sahip olunan parçaya dönmek bedava', () => {
  const s = fresh();
  buyItem(s, 'hatch');
  buyItem(s, 'super');
  assert.equal(modPrice('super', 'rims', 'gold'), modPrice('hatch', 'rims', 'gold') * 6);
  const m0 = s.career.money;
  const r = applyMod(s, 'hatch', 'rims', 'gold');
  assert.ok(r.ok && r.price === 6000);
  assert.equal(s.career.money, m0 - 6000);
  assert.ok(applyMod(s, 'hatch', 'rims', 'stock').ok);
  const m1 = s.career.money;
  assert.equal(applyMod(s, 'hatch', 'rims', 'gold').price, 0, 'daha önce alınan jant tekrar ücret almaz');
  assert.equal(s.career.money, m1);
  s.career.money = 10;
  assert.equal(applyMod(s, 'hatch', 'engine', 's3').ok, false, 'para yetmezse takılmaz');
});

test('garaj: puanlar, haftalık etki, satışta %30 iade', () => {
  const s = fresh();
  buyItem(s, 'sedan');
  for (const [c, o] of [['paint', 'club'], ['rims', 'gold'], ['kit', 'wide'], ['neon', 'purple'], ['tint', 'dark'], ['engine', 's2']]) assert.ok(applyMod(s, 'sedan', c, o).ok);
  const st = carStats(s);
  assert.equal(st.installed, 6);
  assert.equal(st.style, optionOf('paint', 'club').style + 5 + 6 + 2 + 1);
  assert.ok(st.flash >= 4 && st.stealth === 3);
  assert.ok(st.perf > 48);
  s.player.morale = 40;
  const fans = s.player.rel.fans;
  const fx = garageOnWeekEnd(s);
  assert.ok(fx.morale > 0 && s.player.morale > 40);
  assert.equal(s.player.rel.fans, Math.min(100, fans + 1));
  const spent = s.garage.cars.sedan.spent;
  const m = s.career.money;
  sellItem(s, 'sedan');
  assert.equal(s.career.money, m + Math.round(48000 * 0.5) + Math.round(spent * 0.3));
  assert.equal(s.garage.cars.sedan, undefined);
});
