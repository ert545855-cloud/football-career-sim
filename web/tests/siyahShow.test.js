import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAST, showAirs, showScript } from '../src/core/siyahShow.js';

test('Siyah Show: Cemil\'in sözü kesilir, döner reklamı, Bursa frikiği ve "Ben."', () => {
  for (const phase of ['pre', 'ht']) {
    const L = showScript({ phase, home: 'Kaçkar FK', away: 'Kızılırmak FK', my: 'Kızılırmak FK', myName: 'Arda', score: '1-0', id: `t-${phase}`, myGoals: phase === 'ht' ? 2 : 0 });
    assert.ok(L.every((l) => l.who === 'all' || CAST[l.who]), 'kadro kurgusal');
    const cemil = L.filter((l) => l.who === 'cemil');
    assert.ok(cemil.length >= 2 && cemil.every((l) => l.cut && l.text.endsWith('—')), 'Cemil hep sözü kesilerek konuşur');
    assert.ok(L.some((l) => l.ad && /Dürüm Usta/.test(l.text)), 'tavuk döner reklamı');
    assert.ok(L.some((l) => l.who === 'sermet' && /Bursa/.test(l.text)), 'Bursa frikiği');
    const q = L.findIndex((l) => /Ronaldo/.test(l.text));
    assert.ok(q > 0 && L[q + 1].who === 'sermet' && L[q + 1].text === 'Ben.', 'Ronaldo mu sen mi? Ben.');
    assert.ok(!L.some((l) => /\{\w+\}/.test(l.text)), 'yer tutucu kalmadı');
    if (phase === 'ht') assert.ok(L.some((l) => /2 gol/.test(l.text)));
  }
  assert.equal(showAirs({ id: 'a', big: { kind: 'derby' } }, 'pre'), true, 'büyük maçta yayında');
  assert.equal(showAirs({ id: 'a' }, 'pre', 'off'), false);
  assert.equal(showAirs({ id: 'a' }, 'ht', 'on'), true);
});
