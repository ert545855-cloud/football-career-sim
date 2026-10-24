import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMatchBall } from '../src/core/matchBall.js';
import { formatMatchClock } from '../src/core/matchClock.js';
import { buildBall } from '../src/games/pixel/playerPixels.js';

test('match ball selection follows weather, tournament, and country precedence', () => {
  assert.equal(selectMatchBall({ weather: { id: 'snow' }, country: 'br', tournament: 'cup' }), 'orange');
  assert.equal(selectMatchBall({ weather: { id: 'rain' }, country: 'br', tournament: 'cup' }), 'rain');
  assert.equal(selectMatchBall({ night: true, country: 'de' }), 'night');
  assert.equal(selectMatchBall({ tournament: 'cup', country: 'tr' }), 'international');
  assert.equal(selectMatchBall({ country: 'br' }), 'brazil');
  assert.equal(selectMatchBall({ country: 'unknown' }), 'white');
});

test('match clock displays all digits at representative minute values', () => {
  for (const [value, expected] of [[0, '00:00'], [1, '01:00'], [9.75, '09:45'], [45, '45:00'], [71, '71:00'], [90, '90:00']]) {
    assert.equal(formatMatchClock(value), expected);
  }
});

test('ball designs keep the same sprite dimensions and vary their appearance', () => {
  const plain = buildBall(0, 'white');
  const orange = buildBall(0, 'orange');
  const brazil = buildBall(0, 'brazil');
  assert.equal(plain.w, 9);
  assert.equal(plain.h, 9);
  assert.equal(orange.px.length, plain.px.length);
  assert.notDeepEqual(orange.px, plain.px);
  assert.notDeepEqual(brazil.px, plain.px);
});
