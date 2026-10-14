// ÇİZEREK PAS — saf oyun mantığı (tuval/sprite bağımlılığı yok → Node testlerinde çalışır).
import { CurvePath } from './curvePath.js';
import { solveKick, ENV } from './physics.js';

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
    // Fizik (metre/saniye)
    power: lerp(23, 32, e), // en sert vuruş (m/s)
    spinMax: lerp(45, 85, e), // en çok falso (rad/s)
    arrive: lerp(6.8, 9, e), // yerden pasın arkadaşa varış hızı
    defSpeed: lerp(7.3, 6.4, e), // rakiplerin azami koşu hızı (iyi pasörün pası daha zor kesilir)
    read: lerp(0.18, 0.42, e), // rakibin falsoyu okuyabilmesi için geçen süre
    control: 0.55, // arkadaşın ilk kontrolü (teknik)
    maxDev: lerp(0.24, 0.42, e), // çıkış yönünün kirişten en büyük sapması (radyan): kavis ustalığı
  };
}

/** Pas çizgisinin yüksekliği (0–1) → fiziksel yükselme açısı. Kısa paslar yerden, uzunlar havadan. */
export function loftAngle(loft) {
  return loft < 0.34 ? 0 : lerp(0.2, 0.52, clamp((loft - 0.34) / 0.66, 0, 1));
}

/**
 * Çizilen yoldan fiziksel vuruş: çıkış yönü = çizginin başındaki teğet, falso = hedefi tutturan Magnus dönüşü,
 * yükselme = çizgi uzunluğu. Koordinatlar piksel; ppm = metre başına piksel.
 */
export function kickFromPath(path, ppm, sk, env = ENV) {
  const from = { x: path.p0.x / ppm, y: path.p0.y / ppm };
  const to = { x: path.p3.x / ppm, y: path.p3.y / ppm };
  const loft = loftAngle(path.loft);
  const curved = Math.abs(path.curve) > 0.06;
  const base = { loft, arrive: sk.arrive, maxSpeed: sk.power, maxSpin: sk.spinMax, env };
  if (!curved) return { ...solveKick(from, to, base), from, to };
  // Çıkış yönü: çizginin başındaki teğet; fizik sınırı: kirişten en çok sk.maxDev sapabilir (aşırı kavis kırpılır)
  const tg = path.tangentAt(0);
  const D = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const cx = (to.x - from.x) / D;
  const cy = (to.y - from.y) / D;
  let dev = Math.atan2(cx * tg.y - cy * tg.x, cx * tg.x + cy * tg.y);
  dev = clamp(dev, -sk.maxDev, sk.maxDev);
  const dir = { x: cx * Math.cos(dev) - cy * Math.sin(dev), y: cx * Math.sin(dev) + cy * Math.cos(dev) };
  let sol = solveKick(from, to, { ...base, dir });
  if (sol.err > 1) {
    // falso sınırına takıldı: en çok falsoyla, yönü çözerek dene
    const alt = solveKick(from, to, { ...base, spin: sol.spin });
    if (alt.err < sol.err) sol = alt;
  }
  return { ...sol, from, to };
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
