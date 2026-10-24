import test from 'node:test';
import assert from 'node:assert/strict';
import { buyCosmetic, ensureCosmetics, equipCosmetic, playerLook, previewLook } from '../src/core/cosmetics.js';

function sampleState(money = 50000) {
  return {
    player: { avatar: { hair: 'short', hairColor: 0 }, number: 10 },
    career: { clubId: 'ankara', money },
  };
}

test('new and legacy players receive the free casual tracksuit without changing match kit', () => {
  const state = sampleState();
  const cosmetics = ensureCosmetics(state);
  assert.equal(cosmetics.eq.casual, 'casual_tracksuit');
  assert.ok(cosmetics.owned.includes('casual_tracksuit'));
  const matchLook = playerLook(state);
  const casualLook = playerLook(state, { offPitch: true });
  assert.equal(matchLook.casual, undefined);
  assert.equal(matchLook.number, '10');
  assert.equal(casualLook.casual, true);
  assert.equal(casualLook.pants, true);
  assert.equal(casualLook.number, '');
});

test('clothing preview is temporary; buying and equipping are separate actions', () => {
  const state = sampleState();
  ensureCosmetics(state);
  const preview = previewLook(state, 'casual_suit_black', { offPitch: true });
  assert.equal(preview.casualFit, 'suit');
  assert.equal(state.cosmetics.eq.casual, 'casual_tracksuit');

  const purchase = buyCosmetic(state, 'casual_suit_black');
  assert.equal(purchase.ok, true);
  assert.ok(state.cosmetics.owned.includes('casual_suit_black'));
  assert.equal(state.cosmetics.eq.casual, 'casual_tracksuit');
  assert.equal(equipCosmetic(state, 'casual_suit_black').ok, true);
  assert.equal(state.cosmetics.eq.casual, 'casual_suit_black');
});

test('clothing purchase rejects insufficient balance without mutating inventory', () => {
  const state = sampleState(10);
  ensureCosmetics(state);
  const result = buyCosmetic(state, 'casual_suit_black');
  assert.equal(result.ok, false);
  assert.equal(state.career.money, 10);
  assert.ok(!state.cosmetics.owned.includes('casual_suit_black'));
});

test('her günlük kıyafet tipi ön/arka gövde çizimini hatasız tamamlar (giriş akışı donmasın)', async () => {
  const { buildPlayerTall } = await import('../src/games/pixel/playerTall.js');
  const { COSMETICS } = await import('../src/core/cosmetics.js');
  const casuals = (COSMETICS || []).filter((c) => c.casualFit);
  const fits = new Set();
  for (const c of casuals) {
    fits.add(c.casualFit);
    const look = { skin: '#e8b58f', hair: 'short', hairColor: '#2a1a10', boots: c.boots, kit: c.kit, casualFit: c.casualFit, longSleeve: c.longSleeve, zip: c.zip, stripes: c.stripes, casual: true, pants: true, number: '' };
    for (const dir of ['down', 'up', 'side']) {
      assert.doesNotThrow(() => buildPlayerTall(look, dir, 'idle'), `${c.id} / ${dir}`);
    }
  }
  assert.ok(fits.has('tracksuit'), 'varsayılan eşofman tipi test edilmeli');
});
