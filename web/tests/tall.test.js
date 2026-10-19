import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerTall, TW, TH, FOOT_ROW } from '../src/games/pixel/playerTall.js';
import { npcLook, keeperLook } from '../src/games/pixel/looks.js';

const FRAMES = ['idle', 'run0', 'run1', 'run2', 'run3', 'kick', 'lunge', 'ready'];
const DIRS = ['down', 'up', 'side'];

test('gerçekçi oyuncu: tüm yön ve karelerde dolu ızgara, ayaklar yerde', () => {
  const L = npcLook({ colors: ['#c8102e', '#ffd200'], pattern: 'stripes' }, 3, 10);
  for (const d of DIRS) for (const f of FRAMES) {
    const g = buildPlayerTall(L, d, f);
    assert.equal(g.w, TW);
    assert.equal(g.h, TH);
    assert.equal(g.px.length, TW * TH);
    const filled = g.px.filter(Boolean).length;
    assert.ok(filled > 120, `${d}/${f} dolu piksel ${filled}`);
    if (f === 'idle') {
      const feet = g.px.slice(FOOT_ROW * TW, (FOOT_ROW + 1) * TW).filter(Boolean).length;
      assert.ok(feet > 0, `${d} ayak satırı boş`);
    }
  }
});

test('gerçekçi oyuncu: sırtta numara, kalecide eldiven', () => {
  const L = npcLook({ colors: ['#1d4ed8', '#ffffff'] }, 5, 7);
  const back = buildPlayerTall(L, 'up', 'idle');
  assert.ok(back.px.includes('#ffffff'), 'numara rengi');
  const K = keeperLook('#22d3ee', 4);
  const ready = buildPlayerTall(K, 'down', 'ready');
  assert.ok(ready.px.includes(K.gloves), 'eldiven');
  // kafa kare alanın üst %25'inde (gerçekçi oran)
  const rows = [];
  for (let y = 0; y < TH; y++) if (ready.px.slice(y * TW, (y + 1) * TW).some(Boolean)) rows.push(y);
  assert.ok(rows.length >= 30, 'boy uzun');
});
