import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayer, buildBall, defaultLook, HAIR_STYLES, PW, PH, OUTLINE, shade, dirFromVelocity, runFrame } from '../src/games/pixel/playerPixels.js';
import { npcLook, keeperLook, kitFrom } from '../src/games/pixel/looks.js';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { ensureCosmetics, buyCosmetic, equipCosmetic, playerLook, COSMETICS, COSMETIC_BY_ID, previewLook } from '../src/core/cosmetics.js';

const count = (g, c) => g.px.filter((p) => p && p.toLowerCase() === c.toLowerCase()).length;
const sig = (g) => g.px.map((p) => p || '.').join('');

test('piksel oyuncu: boyut, siyah dış hat, forma ve krampon renkleri', () => {
  const L = defaultLook({ kit: { body: '#c8102e', accent: '#ffd200', pattern: 'stripes', shorts: '#111827', socks: '#c8102e' }, boots: { main: '#c6ff3d', accent: '#111111' } });
  for (const dir of ['down', 'up', 'side']) {
    const g = buildPlayer(L, dir, 'idle');
    assert.equal(g.w, PW);
    assert.equal(g.h, PH);
    assert.equal(g.px.length, PW * PH);
    assert.ok(count(g, OUTLINE) > 40, `${dir} dış hat`);
    assert.ok(count(g, '#c8102e') + count(g, shade('#c8102e', -0.18)) + count(g, shade('#c8102e', -0.1)) > 6, `${dir} forma`);
    assert.ok(count(g, '#ffd200') > 3, `${dir} çizgili desen`);
    assert.ok(count(g, '#c6ff3d') >= 2, `${dir} krampon`);
  }
});

test('saç modelleri, yönler ve koşu kareleri birbirinden farklı', () => {
  const sigs = new Set(HAIR_STYLES.map((h) => sig(buildPlayer(defaultLook({ hair: h }), 'down'))));
  assert.equal(sigs.size, HAIR_STYLES.length);
  const L = defaultLook();
  assert.notEqual(sig(buildPlayer(L, 'down')), sig(buildPlayer(L, 'up')));
  const frames = new Set(['idle', 'run0', 'run1', 'run2', 'run3'].map((f) => sig(buildPlayer(L, 'side', f))));
  assert.ok(frames.size >= 4, 'yan koşu döngüsü');
  assert.notEqual(sig(buildPlayer(L, 'down', 'run0')), sig(buildPlayer(L, 'down', 'run2')));
});

test('sırtta numara, eldiven, saç bandı ve uzun kol görünür', () => {
  const back = buildPlayer(defaultLook({ number: '10', kit: { body: '#1d4ed8', accent: '#fbbf24', pattern: 'solid', shorts: '#1d4ed8', socks: '#fbbf24' } }), 'up');
  const noNum = buildPlayer(defaultLook({ number: '', kit: { body: '#1d4ed8', accent: '#fbbf24', pattern: 'solid', shorts: '#1d4ed8', socks: '#fbbf24' } }), 'up');
  assert.ok(count(back, '#fbbf24') > count(noNum, '#fbbf24') + 8, 'numara pikselleri');
  assert.ok(count(buildPlayer(defaultLook({ gloves: '#123456' }), 'down'), '#123456') >= 2);
  assert.ok(count(buildPlayer(defaultLook({ band: '#abcdef' }), 'down'), '#abcdef') >= 8);
  const shortS = buildPlayer(defaultLook({ skin: '#f6d3b3' }), 'down');
  const longS = buildPlayer(defaultLook({ skin: '#f6d3b3', longSleeve: true }), 'down');
  assert.ok(count(longS, '#f6d3b3') < count(shortS, '#f6d3b3'), 'uzun kol teni kapatır');
  const k = buildPlayer(keeperLook('#22d3ee'), 'down', 'ready');
  assert.ok(count(k, '#f4f4f0') >= 4, 'kaleci eldiveni');
});

test('top kareleri, yön ve koşu karesi seçimi', () => {
  assert.notEqual(sig(buildBall(0)), sig(buildBall(1)));
  assert.equal(buildBall(0).px.length, 81);
  assert.deepEqual(dirFromVelocity(3, 0), { dir: 'side', flip: false });
  assert.deepEqual(dirFromVelocity(-3, 0.5), { dir: 'side', flip: true });
  assert.equal(dirFromVelocity(0, -2).dir, 'up');
  assert.equal(dirFromVelocity(0.5, 3).dir, 'down');
  assert.equal(runFrame(5.2, 0.1), 'idle');
  assert.equal(runFrame(5.2, 4), 'run1');
});

test('görünüşler: kulüp formasından desen; NPC yüzü tohuma göre sabit', () => {
  const kit = kitFrom({ colors: ['#065f46', '#f8fafc'], pattern: 'sash' });
  assert.equal(kit.pattern, 'sash');
  assert.equal(kit.body, '#065f46');
  const a = npcLook({ colors: ['#111', '#fff'] }, 7);
  const b = npcLook({ colors: ['#111', '#fff'] }, 7);
  const c = npcLook({ colors: ['#111', '#fff'] }, 8);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('kozmetik: varsayılanlar, satın al-giy, para düşer; antrenman forması yalnız antrenmanda', () => {
  setRandom(seeded(4));
  const s = newGame({ name: 'Arda Yılmaz', position: 'FW' });
  const c = ensureCosmetics(s);
  assert.equal(c.eq.boots, 'boots_black');
  assert.ok(c.owned.includes('tr_club'));
  s.career.money = 10000;
  const r = buyCosmetic(s, 'boots_neon');
  assert.ok(r.ok);
  assert.equal(s.career.money, 10000 - COSMETIC_BY_ID.boots_neon.price);
  assert.equal(playerLook(s).boots.main, '#c6ff3d');
  buyCosmetic(s, 'tr_bib');
  assert.notEqual(playerLook(s).kit.body, '#f97316', 'maçta kulüp forması');
  assert.equal(playerLook(s, { training: true }).kit.body, '#f97316');
  s.career.money = 0;
  assert.equal(buyCosmetic(s, 'boots_gold').ok, false, 'para yetmez');
  assert.ok(equipCosmetic(s, 'boots_black').ok);
  assert.equal(equipCosmetic(s, 'boots_gold').ok, false, 'sahip olunmayan giyilemez');
  s.career.money = 1000;
  buyCosmetic(s, 'hair_mohawk');
  assert.equal(s.player.avatar.hair, 'mohawk');
  assert.equal(playerLook(s).hair, 'mohawk');
  assert.equal(previewLook(s, 'band_red').band, '#dc2626');
  assert.ok(COSMETICS.filter((x) => x.slot === 'boots').length >= 6);
});
