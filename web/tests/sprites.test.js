// Sprite atlası bütünlük testleri: koddaki her sprite adı atlasta var mı, çerçeveler doku içinde mi?
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const atlas = JSON.parse(readFileSync(join(ROOT, 'src/assets/sprites/atlas.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/atlas/manifest.json'), 'utf8'));

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}

test('atlas: tüm çerçeveler doku sınırları içinde ve çakışmıyor', () => {
  const { w: W, h: H } = atlas.image;
  const frames = Object.entries(atlas.frames);
  assert.ok(frames.length >= 90);
  for (const [name, f] of frames) {
    assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= W && f.y + f.h <= H, `${name} dışarı taşıyor`);
    assert.ok(f.w > 4 && f.h > 4, `${name} çok küçük`);
  }
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const [na, a] = frames[i];
      const [nb, b] = frames[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `${na} ile ${nb} çakışıyor`);
    }
  }
});

test('atlas: manifestteki her sprite üretilmiş', () => {
  const names = [...Object.values(manifest.groups).flatMap((g) => Object.keys(g.sprites)), ...Object.keys(manifest.tiles)];
  for (const n of names) assert.ok(atlas.frames[n], `${n} atlasta yok`);
});

test('kod: kullanılan her sprite adı atlasta var', () => {
  const used = new Set();
  const call = /(?:sprite|spriteOr|drawSprite|spritePattern|spriteSize)\(\s*(?:ctx\s*,\s*)?'([a-z0-9_]+)'/g;
  for (const file of walk(join(ROOT, 'src'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(call)) used.add(m[1]);
    // spriteMap.js: `anahtar: 'sprite_adı'` eşlemeleri ve ['merch_red', …] listeleri
    if (file.endsWith('spriteMap.js')) for (const m of src.matchAll(/:\s*'([a-z0-9_]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/\[('(?:merch|fan|light)_[a-z0-9_]+'(?:,\s*'[a-z0-9_]+')*)\]/g)) {
      for (const n of m[1].matchAll(/'([a-z0-9_]+)'/g)) used.add(n[1]);
    }
  }
  assert.ok(used.size >= 30, `beklenenden az sprite bulundu: ${used.size}`);
  const missing = [...used].filter((n) => !atlas.frames[n]);
  assert.deepEqual(missing, [], `atlasta olmayan sprite adları: ${missing.join(', ')}`);
});
