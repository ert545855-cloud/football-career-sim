import test from 'node:test';
import assert from 'node:assert/strict';
import { kickoffFor } from '../src/core/match.js';
import { selectMatchBall } from '../src/core/matchBall.js';

test('başlama saati maç kimliğinden sabit ve akşam bayrağı saate uyuyor', () => {
  const a = kickoffFor('3-12');
  assert.deepEqual(kickoffFor('3-12'), a);
  for (let w = 1; w <= 40; w++) {
    const k = kickoffFor(`1-${w}`);
    assert.match(k.time, /^\d\d:\d\d$/);
    assert.equal(k.night, parseInt(k.time, 10) >= 19);
  }
});

test('kupa ve büyük maçlar hep akşam, lig maçlarında gündüz de var', () => {
  for (let w = 1; w <= 30; w++) {
    assert.equal(kickoffFor(`cup-${w}`, { cup: { name: 'Kupa' } }).night, true);
    assert.equal(kickoffFor(`1-${w}`, { big: { kind: 'derby' } }).night, true);
  }
  const day = Array.from({ length: 40 }, (_, w) => kickoffFor(`2-${w}`)).filter((k) => !k.night);
  assert.ok(day.length > 5);
});

test('akşam maçında gece topu, karda yine turuncu top', () => {
  assert.equal(selectMatchBall({ night: true, country: 'tr' }), 'night');
  assert.equal(selectMatchBall({ night: true, weather: { id: 'snow', surface: 'snow' } }), 'orange');
});
