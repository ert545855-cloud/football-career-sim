import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENV, envFor, FixedStep, createBall, kick, stepBall, predict, landing, restPoint, groundSpeed,
  createBody, steer, stepBody, bodySpeed, timeToReach, interceptBall, collideBodies, firstTouch, solveKick,
} from '../src/games/physics.js';

const run = (b, T, env = ENV) => { for (let t = 0; t < T; t += 1 / 120) stepBall(b, 1 / 120, env); return b; };

test('yerden pas: sürtünmeyle yavaşlar ve durur; sert pas daha uzağa gider', () => {
  const r = [10, 16, 22].map((v) => {
    const b = kick(createBall(), { dirX: 0, dirY: -1, speed: v });
    return restPoint(b);
  });
  assert.ok(r[0].y > r[1].y && r[1].y > r[2].y, 'sert pas daha uzak');
  assert.ok(-r[1].y > 25 && -r[1].y < 50, `16 m/s ≈ 25–50 m (${-r[1].y})`);
  const b = run(kick(createBall(), { dirX: 1, dirY: 0, speed: 12 }), 15);
  assert.ok(groundSpeed(b) < 0.06 && b.z === 0);
});

test('havadan top: parabol, iner, seker (her sekmede alçalır) ve yuvarlanır', () => {
  const b = kick(createBall(), { dirX: 0, dirY: -1, speed: 22, loft: (30 * Math.PI) / 180 });
  let apex = 0;
  const peaks = [];
  let rising = true;
  let prevZ = 0;
  for (let t = 0; t < 6; t += 1 / 120) {
    stepBall(b, 1 / 120);
    apex = Math.max(apex, b.z);
    if (rising && b.z < prevZ) { peaks.push(prevZ); rising = false; }
    if (!rising && b.z > prevZ) rising = true;
    prevZ = b.z;
  }
  assert.ok(apex > 3 && apex < 9, `tepe ${apex}`);
  assert.ok(b.bounces >= 2, 'en az iki sekme');
  assert.ok(peaks[1] < peaks[0] * 0.5, 'sekme alçalır');
  const L = landing(kick(createBall(), { dirX: 0, dirY: -1, speed: 22, loft: 0.5 }));
  assert.ok(-L.y > 25 && -L.y < 42, `iniş ${-L.y}`);
});

test('falso (Magnus): + spin sağa, − spin sola kıvırır; düz top düz gider', () => {
  const side = (spin) => landing(kick(createBall(), { dirX: 0, dirY: -1, speed: 20, loft: 0.3, spin })).x;
  assert.ok(side(50) > 1, 'sağa');
  assert.ok(side(-50) < -1, 'sola');
  assert.ok(Math.abs(side(0)) < 1e-9);
  // yerden giden topta da etkili ama daha az
  const g = predict(kick(createBall(), { dirX: 0, dirY: -1, speed: 16, spin: 50 }), { T: 3 }).find((p) => p.y < -20);
  assert.ok(g.x > 0.8 && g.x < Math.abs(side(50)) * 2);
});

test('rüzgâr ve ıslak zemin', () => {
  const calm = landing(kick(createBall(), { dirX: 0, dirY: -1, speed: 22, loft: 0.5 }));
  const windy = landing(kick(createBall(), { dirX: 0, dirY: -1, speed: 22, loft: 0.5 }), { env: envFor('dry', { x: 6, y: 0 }) });
  assert.ok(windy.x > calm.x + 0.5, 'yan rüzgâr topu sürükler');
  const dry = restPoint(kick(createBall(), { dirX: 0, dirY: -1, speed: 14 }));
  const wet = restPoint(kick(createBall(), { dirX: 0, dirY: -1, speed: 14 }), { env: envFor('wet') });
  assert.ok(wet.y < dry.y, 'ıslak çimde top daha uzağa kayar');
});

test('sabit adım: kare hızı fark etmeksizin aynı sonuç', () => {
  const sim = (frame) => {
    const b = kick(createBall(), { dirX: 0.3, dirY: -1, speed: 18, loft: 0.3, spin: 30 });
    const fx = new FixedStep(1 / 120);
    for (let t = 0; t < 1.5 - 1e-9; t += frame) fx.run(frame, (h) => { stepBall(b, h); });
    return b;
  };
  const a = sim(1 / 60);
  const c = sim(1 / 30);
  assert.ok(Math.hypot(a.x - c.x, a.y - c.y) < 0.05);
});

test('oyuncu: ivmelenir, azami hızı aşmaz, yüksek hızda keskin dönemez (atalet)', () => {
  const p = createBody(0, 0, { maxSpeed: 8, accel: 7 });
  let t = 0;
  let top = 0;
  while (p.y > -20 && t < 10) { steer(p, 0, -100, 1 / 120); stepBody(p, 1 / 120); t += 1 / 120; top = Math.max(top, bodySpeed(p)); }
  assert.ok(t > 2.6 && t < 3.8, `20 m ${t.toFixed(2)} sn`);
  assert.ok(top <= 8.0001);
  const est = timeToReach(createBody(0, 0, { maxSpeed: 8, accel: 7 }), 0, -20);
  assert.ok(Math.abs(est - t) < 0.5, `tahmin ${est} ≈ ${t}`);
  // 90° dönüş: hızlıyken ileri savrulur
  const y0 = p.y;
  for (let i = 0; i < 60; i++) { steer(p, p.x + 100, y0, 1 / 120); stepBody(p, 1 / 120); }
  assert.ok(p.y < y0 - 1, 'dönüşte ileri savrulma');
  // varışta durur
  const q = createBody(0, 0);
  for (let i = 0; i < 600; i++) { steer(q, 5, 0, 1 / 120); stepBody(q, 1 / 120); }
  assert.ok(Math.abs(q.x - 5) < 0.15 && bodySpeed(q) < 0.4);
});

test('çarpışma: ağır oyuncu hafifi iter; momentum korunur', () => {
  const a = createBody(0, 0, { mass: 90 });
  const b = createBody(0.7, 0, { mass: 65 });
  a.vx = 4;
  b.vx = -2;
  const before = a.mass * a.vx + b.mass * b.vx;
  const j = collideBodies(a, b);
  assert.ok(j > 0);
  const after = a.mass * a.vx + b.mass * b.vx;
  assert.ok(Math.abs(before - after) < 1e-6);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= a.radius + b.radius - 1e-9);
  assert.ok(b.vx > -2, 'hafif oyuncu geri itildi');
});

test('araya girme tahmini: yakındaki rakip yetişir, uzaktaki yetişemez; falsoyu okuyamayan şaşırır', () => {
  const b = kick(createBall(0, 0), { dirX: 0, dirY: -1, speed: 16 });
  const near = createBody(1.5, -10);
  const far = createBody(14, -10);
  assert.ok(interceptBall(near, b, { reaction: 0.2 }));
  assert.equal(interceptBall(far, b, { reaction: 0.2, T: 1.2 }), null);
  // sağa kıvrılan top sağdaki rakibe gider; falsoyu okuyamayan (düz tahmin) yetişemeyeceğini sanır
  const curl = kick(createBall(0, 0), { dirX: 0, dirY: -1, speed: 18, spin: 60 });
  const side = createBody(2, -12);
  const real = interceptBall(side, curl, { reaction: 0.2, T: 1.5 });
  const guess = interceptBall(side, curl, { reaction: 0.2, T: 1.5, noSpin: true });
  assert.ok(real && real.x > 0.5, 'gerçek yol sağa kıvrılır');
  assert.equal(guess, null);
});

test('ilk kontrol: yumuşak pas yapışır, çok sert pas sekip kaçar; teknik eşiği yükseltir', () => {
  const p = createBody(0, 0);
  const soft = kick(createBall(0, 1), { dirX: 0, dirY: -1, speed: 8 });
  assert.equal(firstTouch(soft, p, 0.2).clean, true);
  const hard = kick(createBall(0, 1), { dirX: 0, dirY: -1, speed: 24 });
  const bad = firstTouch(hard, p, 0.1, () => 0.5);
  assert.equal(bad.clean, false);
  assert.ok(Math.hypot(bad.bounce.vx, bad.bounce.vy) < 24 * 0.6);
  assert.equal(firstTouch(hard, p, 0.95).clean, true);
});

test('vuruş çözücü: yerden, havadan ve sabit yönlü falsolu pas hedefi tutturur', () => {
  const g = solveKick({ x: 0, y: 0 }, { x: 5, y: -24 }, { arrive: 7 });
  assert.ok(g.err < 0.5, `yerden hata ${g.err}`);
  assert.ok(Math.abs(g.arriveV - 7) < 1.2);
  const a = solveKick({ x: 0, y: 0 }, { x: -8, y: -30 }, { loft: 0.4 });
  assert.ok(a.err < 0.6, `havadan hata ${a.err}`);
  const c = solveKick({ x: 0, y: 0 }, { x: 0, y: -28 }, { dir: { x: -0.2, y: -1 }, loft: 0.35 });
  assert.ok(c.err < 0.6 && c.spin > 10, 'sola çıkıp sağa dönen pas için + falso');
  // çözümü gerçekten oynat
  const b = kick(createBall(), c);
  const L = landing(b);
  assert.ok(Math.hypot(L.x, L.y + 28) < 0.8);
});
