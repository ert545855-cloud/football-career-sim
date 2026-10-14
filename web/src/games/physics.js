// FİZİK MOTORU — gerçek birimler (metre, saniye, kg). Kuşbakışı 2.5B: x,y zemin düzlemi (ekranda y aşağı), z yükseklik.
// Top: hava direnci, Magnus (falso), yerçekimi, sekme, çimde yuvarlanma. Oyuncular: ivme, azami hız, dönüş ataleti, çarpışma.
// Tuval/DOM bağımlılığı yok → Node testlerinde çalışır. Mini oyunlar metreyi piksele kendileri çevirir (ppm).

export const G = 9.81;
export const BALL_R = 0.11;

/** Zemin ve hava ayarları. Hava durumu bunları değiştirebilir (ıslak çim = daha az sürtünme, daha alçak sekme). */
export const ENV = {
  drag: 0.013, // hava direnci katsayısı: a = −k·|v|·v  (0.5·ρ·Cd·A / m)
  magnus: 0.006, // falso: a⊥ = k·ω·|v|
  roll: 0.9, // yuvarlanma sabit yavaşlaması (m/s²)
  rollDamp: 0.16, // hızla orantılı çim sürtünmesi (1/s)
  bounce: 0.55, // dikey sekme katsayısı
  skid: 0.84, // sekmede yatay hız kaybı
  spinDecayAir: 0.3,
  spinDecayGround: 0.9,
  groundMagnus: 0.65, // yerde giden topta falsonun etkisi (hava ile kıyasla)
  wind: { x: 0, y: 0 },
};

export const SURFACES = {
  dry: {},
  wet: { roll: 0.55, rollDamp: 0.1, bounce: 0.42, skid: 0.93 }, // yağmur: top kayar, alçak seker
  heavy: { roll: 1.6, rollDamp: 0.26, bounce: 0.4, skid: 0.72 }, // çamur/ağır zemin
};

export function envFor(surface = 'dry', wind = null) {
  return { ...ENV, ...(SURFACES[surface] || {}), wind: wind || ENV.wind };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = Math.hypot;

// ─────────────────────────────────────────────────────────────
// SABİT ADIM
// ─────────────────────────────────────────────────────────────
/** Kare hızından bağımsız, kararlı entegrasyon: dt'yi sabit h adımlarına böler. */
export class FixedStep {
  constructor(h = 1 / 120, maxSteps = 10) {
    this.h = h;
    this.max = maxSteps;
    this.acc = 0;
  }
  run(dt, fn) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= this.h && n < this.max) {
      if (fn(this.h) === false) { this.acc = 0; return n + 1; }
      this.acc -= this.h;
      n++;
    }
    if (n >= this.max) this.acc = 0; // geride kaldıysak yetişmeye çalışma (sarmal önleme)
    return n;
  }
}

// ─────────────────────────────────────────────────────────────
// TOP
// ─────────────────────────────────────────────────────────────
export function createBall(x = 0, y = 0, z = 0) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, spin: 0, top: 0, rot: 0, bounces: 0, air: false, t: 0 };
}

export const cloneBall = (b) => ({ ...b });
export const ballSpeed = (b) => hyp(b.vx, b.vy, b.vz);
export const groundSpeed = (b) => hyp(b.vx, b.vy);

/**
 * Topa vur. dir: birim vektör (zeminde), speed: m/s (toplam), loft: radyan yükselme, spin: rad/s (+ = ekranda sağa kıvrılır),
 * top: üst falso (+ = top erken düşer).
 */
export function kick(b, { dirX, dirY, speed, loft = 0, spin = 0, top = 0 }) {
  const l = hyp(dirX, dirY) || 1;
  const h = speed * Math.cos(loft);
  b.vx = (dirX / l) * h;
  b.vy = (dirY / l) * h;
  b.vz = speed * Math.sin(loft);
  b.spin = spin;
  b.top = top;
  b.air = b.vz > 0.05 || b.z > 0.01;
  b.bounces = 0;
  b.t = 0;
  return b;
}

/** Tek fizik adımı (h saniye). */
export function stepBall(b, h, env = ENV) {
  const wx = env.wind?.x || 0;
  const wy = env.wind?.y || 0;
  const airborne = b.z > 0.0005 || b.vz > 0.0005;
  const rx = b.vx - wx;
  const ry = b.vy - wy;
  const sp3 = hyp(rx, ry, b.vz);
  const spH = hyp(b.vx, b.vy);
  let ax = -env.drag * sp3 * rx;
  let ay = -env.drag * sp3 * ry;
  let az = airborne ? -env.drag * sp3 * b.vz - G : 0;
  // Magnus: z ekseni dönüşü yatay kuvvet üretir (sağa/sola kıvrılma)
  const m = env.magnus * b.spin * (airborne ? 1 : env.groundMagnus);
  ax += m * -b.vy;
  ay += m * b.vx;
  if (airborne && b.top) az -= env.magnus * b.top * spH; // üst falso: top düşer

  b.vx += ax * h;
  b.vy += ay * h;
  if (!airborne) {
    // çimde yuvarlanma: hız yönüne ters, sıfırı geçmez
    const s = hyp(b.vx, b.vy);
    if (s > 0) {
      const ns = Math.max(0, s - (env.roll + env.rollDamp * s) * h);
      b.vx *= ns / s;
      b.vy *= ns / s;
    }
    b.vz = 0;
    b.z = 0;
  } else {
    b.vz += az * h;
  }
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.z += b.vz * h;
  if (b.z < 0) {
    b.z = 0;
    if (b.vz < -1.1) {
      b.vz = -b.vz * env.bounce;
      b.vx *= env.skid;
      b.vy *= env.skid;
      b.spin *= 0.55;
      b.top *= 0.5;
      b.bounces++;
    } else b.vz = 0;
  }
  b.air = b.z > 0.0005 || b.vz > 0.0005;
  b.spin *= Math.exp(-(b.air ? env.spinDecayAir : env.spinDecayGround) * h);
  b.rot += (hyp(b.vx, b.vy) / BALL_R) * h * 0.08;
  b.t += h;
  return b;
}

/** Topun gelecekteki yolu (kopya üzerinde). Her örnek: {t,x,y,z,v}. */
export function predict(b, { T = 4, h = 1 / 60, env = ENV, every = 1, noSpin = false } = {}) {
  const c = cloneBall(b);
  if (noSpin) { c.spin = 0; c.top = 0; }
  const out = [{ t: 0, x: c.x, y: c.y, z: c.z, v: groundSpeed(c) }];
  const n = Math.ceil(T / h);
  for (let i = 1; i <= n; i++) {
    stepBall(c, h, env);
    if (i % every === 0) out.push({ t: i * h, x: c.x, y: c.y, z: c.z, v: groundSpeed(c) });
    if (!c.air && groundSpeed(c) < 0.05) break;
  }
  return out;
}

/** İlk yere değme noktası (havadaki top için); havada değilse null. */
export function landing(b, { env = ENV, T = 6, h = 1 / 120 } = {}) {
  if (!b.air) return null;
  const c = cloneBall(b);
  const n0 = c.bounces;
  for (let t = 0; t < T; t += h) {
    stepBall(c, h, env);
    if (c.bounces > n0 || !c.air) return { x: c.x, y: c.y, t: t + h };
  }
  return { x: c.x, y: c.y, t: T };
}

/** Topun duracağı nokta. */
export function restPoint(b, { env = ENV, T = 12, h = 1 / 60 } = {}) {
  const c = cloneBall(b);
  let t = 0;
  for (; t < T; t += h) {
    stepBall(c, h, env);
    if (!c.air && groundSpeed(c) < 0.05) break;
  }
  return { x: c.x, y: c.y, t };
}

// ─────────────────────────────────────────────────────────────
// OYUNCU GÖVDESİ
// ─────────────────────────────────────────────────────────────
/**
 * maxSpeed m/s (≈6–9.5), accel m/s² (ileri ivme), decel (fren), turn (yanal ivme sınırı), radius m, mass kg.
 */
export function createBody(x = 0, y = 0, o = {}) {
  return {
    x, y, vx: 0, vy: 0,
    maxSpeed: o.maxSpeed ?? 7,
    accel: o.accel ?? 6,
    decel: o.decel ?? 10,
    turn: o.turn ?? 14,
    radius: o.radius ?? 0.42,
    mass: o.mass ?? 75,
    facing: o.facing ?? 0, // radyan; 0 = ekranda yukarı
    stun: 0, // >0 iken kontrol yok (yerde, sendeledi)
  };
}

export const bodySpeed = (p) => hyp(p.vx, p.vy);

/**
 * İstenen hız vektörüne ataletle yaklaş: ileri ivme hız arttıkça azalır, fren ve yanal dönüş sınırlıdır.
 * Yüksek hızda keskin dönüş zordur (gerçek koşu gibi).
 */
export function accelerate(p, wantVx, wantVy, h) {
  if (p.stun > 0) {
    p.stun -= h;
    const s = bodySpeed(p);
    if (s > 0) {
      const ns = Math.max(0, s - p.decel * 0.6 * h);
      p.vx *= ns / s;
      p.vy *= ns / s;
    }
    return;
  }
  const ws = hyp(wantVx, wantVy);
  if (ws > p.maxSpeed) {
    wantVx *= p.maxSpeed / ws;
    wantVy *= p.maxSpeed / ws;
  }
  const s = bodySpeed(p);
  let dvx = wantVx - p.vx;
  let dvy = wantVy - p.vy;
  if (s < 0.3) {
    // dururken: düz ivme
    const d = hyp(dvx, dvy);
    const lim = p.accel * h;
    if (d > lim) { dvx *= lim / d; dvy *= lim / d; }
  } else {
    const ux = p.vx / s;
    const uy = p.vy / s;
    let par = dvx * ux + dvy * uy; // hız yönünde
    let per = -dvx * uy + dvy * ux; // yanal
    const fwd = p.accel * Math.max(0.15, 1 - (s / p.maxSpeed) ** 2) * h;
    par = par > 0 ? Math.min(par, fwd) : Math.max(par, -p.decel * h);
    const lat = p.turn * (1 - 0.55 * Math.min(1, s / p.maxSpeed)) * h;
    per = clamp(per, -lat, lat);
    dvx = par * ux - per * uy;
    dvy = par * uy + per * ux;
  }
  p.vx += dvx;
  p.vy += dvy;
}

/** Hedefe koş (varışta yavaşla). speed: bu koşudaki azami hız (jokey, tempo). */
export function steer(p, tx, ty, h, { speed = p.maxSpeed, arrive = 1.2 } = {}) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = hyp(dx, dy);
  if (d < 1e-4) {
    accelerate(p, 0, 0, h);
    return d;
  }
  // fren mesafesi kadar önce yavaşla: v = √(2·decel·d)
  const v = Math.min(speed, Math.sqrt(2 * p.decel * 0.7 * d), d < arrive ? (speed * d) / arrive + 0.2 : Infinity);
  accelerate(p, (dx / d) * v, (dy / d) * v, h);
  return d;
}

export function stepBody(p, h, faceLerp = 10) {
  p.x += p.vx * h;
  p.y += p.vy * h;
  const s = bodySpeed(p);
  if (s > 0.4) {
    const want = Math.atan2(p.vx, -p.vy);
    let da = want - p.facing;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    p.facing += da * Math.min(1, faceLerp * h);
  }
  return p;
}

/** Hedef noktaya varış süresi tahmini (ivme profili + mevcut hızın bileşeni + tepki). */
export function timeToReach(p, x, y, { reaction = 0, reach = 0, speed = p.maxSpeed } = {}) {
  const dx = x - p.x;
  const dy = y - p.y;
  const d0 = hyp(dx, dy);
  const d = Math.max(0, d0 - reach);
  if (d <= 0) return reaction;
  const ux = dx / d0;
  const uy = dy / d0;
  const along = p.vx * ux + p.vy * uy;
  const perp = Math.abs(-p.vx * uy + p.vy * ux);
  const v0 = Math.max(0, along);
  // ters yöne koşuyorsa önce durması gerekir
  const brake = (along < 0 ? -along / p.decel : 0) + perp / (p.turn * 1.5);
  const a = p.accel * 0.8; // ortalama ivme (hız arttıkça azalır)
  const tAcc = Math.max(0, (speed - v0) / a);
  const dAcc = ((v0 + speed) / 2) * tAcc;
  const t = d <= dAcc ? (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a : tAcc + (d - dAcc) / speed;
  return reaction + brake + t;
}

/**
 * Topu keseceği en erken nokta: tahmini top yolunda, oyuncunun topa topa yetişebildiği ilk an.
 * maxZ: erişilebilir en yüksek top (kafa ≈ 1.9 m). noSpin: falsoyu okuyamayan oyuncu (düz çizgi tahmini).
 * @returns {{x,y,t,z}|null}
 */
export function interceptBall(p, b, { env = ENV, reaction = 0.2, reach = 0.9, maxZ = 1.8, T = 4, h = 1 / 30, noSpin = false, speed = p.maxSpeed } = {}) {
  const path = predict(b, { T, h, env, noSpin });
  for (let i = 1; i < path.length; i++) {
    const q = path[i];
    if (q.z > maxZ) continue;
    if (timeToReach(p, q.x, q.y, { reaction, reach, speed }) <= q.t) return { x: q.x, y: q.y, t: q.t, z: q.z };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// ÇARPIŞMA
// ─────────────────────────────────────────────────────────────
/** İki gövde (daire) çarpışması: üst üste binmeyi kütleye göre ayırır, darbe uygular. Darbe büyüklüğünü döndürür. */
export function collideBodies(a, b, e = 0.15) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = hyp(dx, dy);
  const min = a.radius + b.radius;
  if (d >= min || d < 1e-6) return 0;
  const nx = dx / d;
  const ny = dy / d;
  const ia = 1 / a.mass;
  const ib = 1 / b.mass;
  const over = min - d;
  a.x -= nx * over * (ia / (ia + ib));
  a.y -= ny * over * (ia / (ia + ib));
  b.x += nx * over * (ib / (ia + ib));
  b.y += ny * over * (ib / (ia + ib));
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel >= 0) return 0;
  const j = (-(1 + e) * rel) / (ia + ib);
  a.vx -= j * ia * nx;
  a.vy -= j * ia * ny;
  b.vx += j * ib * nx;
  b.vy += j * ib * ny;
  return j;
}

/** Top oyuncuya değiyor mu (ayak/gövde erişimi + yükseklik). */
export function touching(b, p, { reach = 0.35, maxZ = 0.6 } = {}) {
  return b.z <= maxZ && hyp(b.x - p.x, b.y - p.y) <= p.radius + reach;
}

/**
 * İlk kontrol: gelen topun göreli hızı kontrol eşiğini aşarsa top sekip kaçar (ağır dokunuş).
 * control: 0–1 (teknik). Dönen: {clean, quality, bounce?:{vx,vy}}
 */
export function firstTouch(b, p, control = 0.5, rnd = Math.random) {
  const rvx = b.vx - p.vx;
  const rvy = b.vy - p.vy;
  const rel = hyp(rvx, rvy, b.vz * 0.6);
  const limit = 13 + 13 * clamp(control, 0, 1); // m/s: bu hıza kadar top ayağa yapışır
  const quality = clamp(1 - Math.max(0, rel - limit * 0.55) / (limit * 0.9), 0, 1);
  if (rel <= limit) return { clean: true, quality, rel };
  // ağır dokunuş: top hızın bir kısmıyla, hafif saparak sekip gider
  const keep = clamp(0.22 + (rel - limit) * 0.025, 0.22, 0.5);
  const a = (rnd() - 0.5) * 1.1;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { clean: false, quality: quality * 0.5, rel, bounce: { vx: (rvx * c - rvy * s) * keep + p.vx, vy: (rvx * s + rvy * c) * keep + p.vy } };
}

// ─────────────────────────────────────────────────────────────
// VURUŞ ÇÖZÜCÜ
// ─────────────────────────────────────────────────────────────
function rotate(x, y, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

function evaluateKick(from, to, k, env, air) {
  const b = createBall(from.x, from.y, 0);
  kick(b, k);
  const h = 1 / 60;
  let best = { d: Infinity, x: b.x, y: b.y, v: 0, t: 0, interior: false };
  const n0 = 0;
  for (let i = 0; i < 360; i++) {
    stepBall(b, h, env);
    if (air) {
      if (b.bounces > n0) return { x: b.x, y: b.y, v: groundSpeed(b), t: b.t, interior: true };
      continue;
    }
    const d = hyp(b.x - to.x, b.y - to.y);
    if (d < best.d) best = { d, x: b.x, y: b.y, v: groundSpeed(b), t: b.t, interior: true };
    else if (d > best.d + 0.5) break; // uzaklaşmaya başladı: en yakın an geçti
    if (groundSpeed(b) < 0.08) { best.interior = false; best.stopped = true; break; }
  }
  if (air) return { x: b.x, y: b.y, v: groundSpeed(b), t: b.t, interior: false };
  return best;
}

/**
 * from → to vuruşunu bulur. Yerden pasta top hedefe 'arrive' hızıyla varır; havadan pasta hedefte yere iner.
 * dir verilirse çıkış yönü sabit tutulur ve hedefi tutturan FALSO (spin) çözülür (çizilen kavis); verilmezse yön çözülür.
 * @returns {{dirX,dirY,speed,loft,spin,err:number,end:{x,y}}}
 */
export function solveKick(from, to, { loft = 0, dir = null, spin = 0, arrive = 7, maxSpeed = 34, maxSpin = 80, env = ENV } = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const D = Math.max(0.5, hyp(dx, dy));
  const cx = dx / D;
  const cy = dy / D;
  const nx = -cy; // ekranda sağ
  const ny = cx;
  const air = loft > 0.1;
  let speed = air
    ? Math.sqrt((G * D) / Math.max(0.2, Math.sin(2 * loft))) * 1.06
    : Math.sqrt(arrive * arrive + 2 * (env.roll + env.rollDamp * arrive + 0.6) * D);
  speed = Math.min(maxSpeed, speed);
  let ang = 0; // kirişe göre çıkış açısı (yön çözülürken)
  let dirX = cx;
  let dirY = cy;
  const solveSpin = !!dir;
  if (solveSpin) {
    const l = hyp(dir.x, dir.y) || 1;
    dirX = dir.x / l;
    dirY = dir.y / l;
    // İlk falso tahmini, çember yayından: eğrilik κ = 2·sinθ / D, gereken yanal ivme a = κ·v², ω = a / (k·v)
    const cross = cx * dirY - cy * dirX; // + = çıkış kirişin sağında → sola kıvrılmalı (− falso)
    const vAvg = Math.max(6, speed * 0.75);
    const kM = env.magnus * (air ? 1 : env.groundMagnus);
    spin = clamp((-2 * cross * vAvg) / (D * kM), -maxSpin, maxSpin);
  }
  let prevSpin = null;
  let prevLat = null;
  let res = null;
  for (let it = 0; it < 12; it++) {
    const d = solveSpin ? { x: dirX, y: dirY } : rotate(cx, cy, ang);
    res = evaluateKick(from, to, { dirX: d.x, dirY: d.y, speed, loft, spin }, env, air);
    const lat = (res.x - to.x) * nx + (res.y - to.y) * ny;
    const lon = (res.x - to.x) * cx + (res.y - to.y) * cy;
    res.lat = lat;
    res.lon = lon;
    if (Math.abs(lat) < 0.15 && (air ? Math.abs(lon) < 0.3 : res.interior && Math.abs(res.v - arrive) < 0.4)) break;
    // yanal düzeltme
    if (solveSpin) {
      const s0 = spin;
      if (prevSpin !== null && Math.abs(lat - prevLat) > 1e-4 && Math.abs(spin - prevSpin) > 1e-4) {
        const slope = (lat - prevLat) / (spin - prevSpin);
        spin = clamp(spin - lat / slope, -maxSpin, maxSpin);
      } else {
        spin = clamp(spin + (lat > 0 ? -1 : 1) * Math.max(2, Math.abs(lat) * 3), -maxSpin, maxSpin);
      }
      prevSpin = s0;
      prevLat = lat;
    } else {
      ang -= lat / D;
    }
    // boyuna (hız) düzeltme
    if (air) speed = Math.min(maxSpeed, speed * Math.sqrt(D / Math.max(1, D + lon)));
    else if (!res.interior || res.stopped) speed = Math.min(maxSpeed, Math.sqrt(speed * speed + 2 * 3 * Math.max(0.5, -lon + 1)));
    else speed = clamp(Math.sqrt(Math.max(1, speed * speed + (arrive * arrive - res.v * res.v))), 2, maxSpeed);
  }
  const d = solveSpin ? { x: dirX, y: dirY } : rotate(cx, cy, ang);
  return { dirX: d.x, dirY: d.y, speed, loft, spin, err: hyp(res.lat, res.lon), end: { x: res.x, y: res.y }, arriveV: res.v, t: res.t };
}
