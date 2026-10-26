// Fizik motoru 2: drag crisis, Magnus doygunluğu, sekme–dönüş etkileşimi, direk/gövde/file çarpışması, şut çözücü
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALL_R, GOAL, ENV, collideBallBody, collideGoalFrame, collideNet, createBall, createBody, dragAt, envFor, kick, magnusFactor, shotPath, solveShot, stepBall } from '../src/games/physics.js';

const run = (b, T, env = ENV, h = 1 / 120) => { for (let t = 0; t < T; t += h) stepBall(b, h, env); return b; };

test('drag crisis: yavaş topta direnç katsayısı yüksek, hızlıda düşük; Magnus çok dönen yavaş topta doyar', () => {
  assert.ok(dragAt(5) > dragAt(25) * 1.5);
  assert.ok(Math.abs(dragAt(30) - ENV.drag) < 0.0005);
  assert.ok(magnusFactor(10, 30) > 0.95 && magnusFactor(80, 6) < 0.4);
});

test('sekme: alt falsolu top frenlenir, üst falsolu top öne kaçar; düşen top yuvarlanmaya geçer', () => {
  const land = (top) => {
    const b = createBall(0, 0, 0);
    kick(b, { dirX: 0, dirY: -1, speed: 16, loft: 0.7, top });
    while (b.bounces === 0) stepBall(b, 1 / 240);
    return Math.hypot(b.vx, b.vy);
  };
  const back = land(-60);
  const none = land(0);
  const fwd = land(60);
  assert.ok(back < none && none < fwd, `alt ${back.toFixed(2)} < düz ${none.toFixed(2)} < üst ${fwd.toFixed(2)}`);
  const b = run(kick(createBall(0, 0, 0), { dirX: 0, dirY: -1, speed: 14, loft: 0.5 }), 3);
  assert.ok(!b.air && Math.abs(Math.hypot(b.vx, b.vy) - b.top * BALL_R) < 0.1, 'yuvarlanma koşulu v = ω·r');
});

test('ıslak zeminde top sekmede daha az hız kaybeder', () => {
  const after = (env) => {
    const b = kick(createBall(0, 0, 0), { dirX: 0, dirY: -1, speed: 18, loft: 0.35 });
    while (b.bounces === 0) stepBall(b, 1 / 240, env);
    return Math.hypot(b.vx, b.vy);
  };
  assert.ok(after(envFor('wet')) > after(envFor('dry')) + 0.5);
});

test('şut çözücü: hedef noktayı istenen sürede tutturur (falsolu ve üst falsolu da)', () => {
  for (const [from, to, o] of [[{ x: 0, y: 11 }, { x: 2.8, z: 1.9 }, { T: 0.5 }], [{ x: 1, y: 23 }, { x: -2.9, z: 2.1 }, { T: 1.1, spin: 40, top: 35 }], [{ x: -0.5, y: 18 }, { x: 3, z: 0.3 }, { T: 0.7 }]]) {
    const s = solveShot(from, to, o);
    assert.ok(Math.abs(s.hit.x - to.x) < 0.08 && Math.abs(s.hit.z - to.z) < 0.08, JSON.stringify(s.hit));
    assert.ok(Math.abs(s.t - o.T) < 0.03, `süre ${s.t}`);
  }
  // falsolu top dışarı çıkıp içeri döner: çıkış yönü hedefin dışında
  const c = solveShot({ x: 0, y: 23 }, { x: 0, z: 1.5 }, { T: 1.1, spin: 45 });
  assert.ok(c.dirX < -0.05, 'sağa dönen top sola çıkar');
});

test('direk: top direkten seker, kaleye girmez; üst direkten aşağı/geri döner', () => {
  const hit = (to) => {
    const s = solveShot({ x: 0, y: 14 }, to, { T: 0.55 });
    const { path, ball } = shotPath({ x: 0, y: 14 }, s, { frame: true });
    return { part: path.at(-1).hit, ball };
  };
  const p = hit({ x: GOAL.w / 2 + 0.02, z: 1 });
  assert.equal(p.part, 'post');
  assert.ok(p.ball.vy > 0, 'direkten sahaya döner');
  const bar = hit({ x: 0.5, z: GOAL.h + 0.03 });
  assert.equal(bar.part, 'bar');
  assert.ok(bar.ball.vy > 0 || bar.ball.vz < 0);
  assert.equal(collideGoalFrame(createBall(0, 5, 1)), null);
});

test('gövde ve file: top oyuncudan geri seker; ağlar topu durdurur', () => {
  const b = createBall(0, 0, 0.8);
  b.vy = -20;
  const p = createBody(0, -0.4);
  const v = collideBallBody(b, p);
  assert.ok(v > 19 && b.vy > 0 && b.vy < 20 * 0.5, `geri sekme ${b.vy}`);
  const n = createBall(0, -GOAL.depth + 0.05, 1);
  n.vy = -15;
  assert.ok(collideNet(n) > 14 && n.vy > 0 && n.vy < 3);
});
