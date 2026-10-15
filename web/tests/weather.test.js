import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLUBS } from '../src/core/data.js';
import { conditionPct, fatigueAt, isWinterWeek, monthName, weatherFor } from '../src/core/weather.js';
import { applyGrip, createBall, createBody, envFor, kick, restPoint } from '../src/games/physics.js';

const clubOf = (cc) => CLUBS.find((c) => c.country === cc).id;

test('hava: deterministik, kar yalnız kışın, iklim farkı', () => {
  const a = weatherFor({ season: 3, week: 12, homeId: clubOf('ru') });
  const b = weatherFor({ season: 3, week: 12, homeId: clubOf('ru') });
  assert.deepEqual(a, b);
  assert.equal(monthName(1), 'Ağustos');
  assert.equal(monthName(22), 'Mayıs');
  assert.ok(isWinterWeek(12) && !isWinterWeek(3));
  const count = (cc, pred, weeks) => {
    let n = 0;
    for (let s = 1; s <= 40; s++) for (const w of weeks) if (pred(weatherFor({ season: s, week: w, homeId: clubOf(cc) }))) n++;
    return n;
  };
  const winter = [10, 11, 12, 13, 14, 15];
  const summer = [1, 2, 3, 21, 22];
  assert.equal(count('ru', (w) => w.id === 'snow', summer), 0);
  assert.ok(count('ru', (w) => w.id === 'snow', winter) > count('es', (w) => w.id === 'snow', winter) + 40);
  assert.equal(count('br', (w) => w.id === 'snow', winter), 0);
  assert.ok(count('sa', (w) => w.id === 'hot', summer) > 60);
  const snow = [];
  for (let s = 1; s <= 30; s++) for (const w of winter) { const x = weatherFor({ season: s, week: w, homeId: clubOf('ru') }); if (x.id === 'snow') snow.push(x); }
  assert.ok(snow.every((x) => x.temp <= 0 && x.surface === 'snow'));
});

test('yorgunluk: dakika ve sıcakla artar, dayanıklılıkla azalır', () => {
  const base = { energy: 85, stamina: 40 };
  assert.ok(fatigueAt({ ...base, minute: 80 }) > fatigueAt({ ...base, minute: 30 }));
  assert.ok(fatigueAt({ ...base, minute: 80, stamina: 85 }) < fatigueAt({ ...base, minute: 80, stamina: 15 }));
  assert.ok(fatigueAt({ ...base, minute: 80, weather: { fatigue: 1.3 } }) > fatigueAt({ ...base, minute: 80 }));
  assert.ok(fatigueAt({ ...base, minute: 80, energy: 35 }) > fatigueAt({ ...base, minute: 80 }));
  assert.equal(fatigueAt({ ...base, minute: 70, from: 70 }), 0);
  assert.ok(conditionPct(fatigueAt({ minute: 90, energy: 0, stamina: 0, weather: { fatigue: 1.3 } })) >= 35);
});

test('zemin fiziği: karda top çabuk durur, ıslakta uzağa kayar; kaygan zeminde tutunma düşer', () => {
  const roll = (surface) => {
    const b = createBall(0, 0, 0);
    kick(b, { dirX: 1, dirY: 0, speed: 14 });
    return restPoint(b, { env: envFor(surface) }).x;
  };
  assert.ok(roll('wet') > roll('dry'));
  assert.ok(roll('dry') > roll('heavy'));
  assert.ok(roll('heavy') > roll('snow'));
  const env = envFor({ surface: 'snow', wind: { x: 3, y: 0 } });
  assert.equal(env.wind.x, 3);
  const body = applyGrip(createBody(0, 0, { maxSpeed: 8, accel: 7 }), env);
  assert.ok(body.accel < 7 && body.maxSpeed < 8);
});
