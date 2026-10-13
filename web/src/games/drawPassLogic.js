// ÇİZEREK PAS — saf oyun mantığı (tuval/sprite bağımlılığı yok → Node testlerinde çalışır).
import { CurvePath } from './curvePath.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Etkin yetenek (0–1) → oynanış. %25 taban: yeni başlayan da oynayabilsin. */
export function passSkill(skill) {
  const e = 0.25 + 0.75 * clamp(skill ?? 0.3, 0, 1);
  return {
    slow: 0.15 * lerp(1.5, 0.7, e), // ağır çekim oranı (küçük = daha çok düşünme süresi)
    curveFidelity: lerp(0.55, 1, e), // çizilen kavisin uygulanabilen kısmı
    error: lerp(34, 0, e), // 300 px'lik pasta en büyük yanal sapma (px, k ile ölçeklenir)
    speed: lerp(0.85, 1.15, e),
    steal: lerp(1.25, 0.8, e), // rakibin top kapma mesafesi çarpanı
  };
}

/**
 * Rakibin topa ondan önce varabileceği en erken yol noktası (Unity EnemyAI ile aynı mantık).
 * @returns {{x:number,y:number}} koşulacak nokta
 */
export function interceptPoint(path, ballSpeed, from, { defSpeed, reach, reaction, reachH, elapsed = 0 }) {
  const done = ballSpeed * elapsed;
  const N = 24;
  for (let i = 1; i <= N; i++) {
    const s = lerp(done, path.length, i / N);
    const p = path.at(s);
    if (p.h > reachH) continue;
    const ballT = (s - done) / ballSpeed;
    const run = Math.max(0, Math.hypot(p.x - from.x, p.y - from.y) - reach);
    if (reaction + run / defSpeed <= ballT) return { x: p.x, y: p.y };
  }
  return { x: path.p3.x, y: path.p3.y };
}

/** Çizilen noktalardan yolu kurar (oyundakiyle aynı ayarlar). k = ekran ölçeği (W / 390). */
export function buildPassPath(points, k = 1, curveFidelity = 1) {
  const p = new CurvePath();
  p.build(points, { loftPerPx: 1 / (600 * k), maxLoft: 1 });
  p.scaleCurve(curveFidelity);
  return p;
}
