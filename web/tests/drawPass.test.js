import test from 'node:test';
import assert from 'node:assert/strict';
import { CurvePath, pointAtFraction } from '../src/games/curvePath.js';
import { passSkill, interceptPoint, buildPassPath } from '../src/games/drawPassLogic.js';

// Ekranda yukarı (−y) çıkıp sağa (+x) kıvrılan çeyrek daire
function arc(R, n, sign = 1, ox = 200, oy = 600) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI / 2) * (i / n);
    pts.push({ x: ox + sign * (R - R * Math.cos(a)), y: oy - R * Math.sin(a) });
  }
  return pts;
}

test('Bezier çizimin 1/3 ve 2/3 noktalarından geçer, uçlar sabit', () => {
  const pts = arc(150, 60);
  const p = new CurvePath().build(pts);
  const q1 = pointAtFraction(pts, 1 / 3);
  const q2 = pointAtFraction(pts, 2 / 3);
  const b1 = p.evalT(1 / 3);
  const b2 = p.evalT(2 / 3);
  assert.ok(Math.hypot(b1.x - q1.x, b1.y - q1.y) < 0.05);
  assert.ok(Math.hypot(b2.x - q2.x, b2.y - q2.y) < 0.05);
  assert.deepEqual(p.p0, { x: pts[0].x, y: pts[0].y });
  const arcLen = (Math.PI / 2) * 150;
  assert.ok(Math.abs(p.length - arcLen) / arcLen < 0.06, `uzunluk ${p.length} ≈ ${arcLen}`);
});

test('Sabit hız: eşit mesafe adımları eşit uzunlukta', () => {
  const p = new CurvePath().build(arc(150, 60));
  let prev = p.at(0);
  let min = Infinity;
  let max = 0;
  for (let i = 1; i <= 40; i++) {
    const q = p.at((p.length * i) / 40);
    const d = Math.hypot(q.x - prev.x, q.y - prev.y);
    min = Math.min(min, d);
    max = Math.max(max, d);
    prev = q;
  }
  assert.ok(max / min < 1.03, `oran ${max / min}`);
  assert.equal(p.distanceToT(0), 0);
  assert.equal(p.distanceToT(p.length), 1);
});

test('Falso işareti: ekranda sağa kıvrılan pas turn > 0, curve < 0; sola tersi', () => {
  const right = new CurvePath().build(arc(150, 60, 1));
  const left = new CurvePath().build(arc(150, 60, -1));
  assert.ok(right.turn > 60 && right.curve < 0, `sağ turn ${right.turn}`);
  assert.ok(left.turn < -60 && left.curve > 0, `sol turn ${left.turn}`);
});

test('Düz pas: az nokta → dönüş yok; kısa çizim geçersiz değil ama kısa', () => {
  const p = new CurvePath().build([{ x: 0, y: 0 }, { x: 0, y: -100 }, { x: 0, y: -300 }]);
  assert.ok(Math.abs(p.turn) < 1e-6);
  assert.ok(Math.abs(p.length - 300) < 0.5);
  const c = p.closest(20, -150);
  assert.ok(Math.abs(c.d - 20) < 1 && Math.abs(c.along - 150) < 10);
});

test('İlmekli çizimde kontrol noktaları sınırlanır, NaN yok', () => {
  const pts = [{ x: 0, y: 0 }];
  for (let i = 1; i <= 30; i++) pts.push({ x: i * 10, y: -i * 3 });
  for (let i = 1; i <= 30; i++) pts.push({ x: 300 - i * 10, y: -90 - i });
  const p = new CurvePath().build(pts);
  const chord = Math.hypot(p.p3.x - p.p0.x, p.p3.y - p.p0.y);
  const s1 = { x: p.p0.x + (p.p3.x - p.p0.x) / 3, y: p.p0.y + (p.p3.y - p.p0.y) / 3 };
  assert.ok(Math.hypot(p.p1.x - s1.x, p.p1.y - s1.y) <= Math.max(10, chord * 0.9) + 1e-6);
  assert.ok(Number.isFinite(p.length) && Number.isFinite(p.turn));
});

test('Kavis ölçekleme ve bitiş kaydırma', () => {
  const p = new CurvePath().build(arc(150, 60));
  const full = p.turn;
  p.scaleCurve(0.5);
  assert.ok(Math.abs(p.turn) < Math.abs(full));
  p.scaleCurve(0);
  assert.ok(Math.abs(p.turn) < 0.5);
  const end = { ...p.p3 };
  p.shiftEnd(12, -5);
  assert.ok(Math.abs(p.p3.x - end.x - 12) < 1e-9 && Math.abs(p.p3.y - end.y + 5) < 1e-9);
});

test('Uzun pas havadan gider (görsel yükseklik), kısa pas yerden', () => {
  const long = buildPassPath([{ x: 0, y: 0 }, { x: 0, y: -400 }]);
  const short = buildPassPath([{ x: 0, y: 0 }, { x: 0, y: -100 }]);
  assert.ok(long.at(long.length / 2).h > 0.55, 'uzun pasın ortası erişilemez yükseklikte');
  assert.ok(short.at(short.length / 2).h < 0.55, 'kısa pas araya girilebilir');
});

test('Stat etkisi: iyi pasör daha yavaş zaman, daha az sapma, tam falso', () => {
  const lo = passSkill(0);
  const hi = passSkill(1);
  assert.ok(lo.slow > hi.slow);
  assert.ok(lo.error > 0 && hi.error === 0);
  assert.ok(lo.curveFidelity >= 0.6 && hi.curveFidelity === 1);
  assert.ok(lo.steal > hi.steal);
});

test('Araya girme: yolun üstündeki rakip erken noktaya, uzaktaki iniş noktasına koşar', () => {
  const p = buildPassPath([{ x: 0, y: 0 }, { x: 0, y: -200 }]);
  const o = { defSpeed: 175, reach: 17, reaction: 0.15, reachH: 0.55 };
  // Top 300 px/sn: yolun 25 px yanındaki rakip, topu kendi hizasında yakalar (inişe kadar beklemez)
  const near = interceptPoint(p, 300, { x: 25, y: -120 }, o);
  assert.ok(near.y > -130 && near.y < -60, `yakın rakip erken keser (${near.y})`);
  // Çok hızlı top / uzak rakip: yetişemez → iniş noktasına koşar
  const far = interceptPoint(p, 600, { x: 300, y: -100 }, o);
  assert.deepEqual(far, { x: p.p3.x, y: p.p3.y });
});
