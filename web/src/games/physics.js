// FİZİK MOTORU — gerçek birimler (metre, saniye, kg). Kuşbakışı 2.5B: x,y zemin düzlemi (ekranda y aşağı), z yükseklik.
// Top: hava direnci, Magnus (falso), yerçekimi, sekme, çimde yuvarlanma. Oyuncular: ivme, azami hız, dönüş ataleti, çarpışma.
// Tuval/DOM bağımlılığı yok → Node testlerinde çalışır. Mini oyunlar metreyi piksele kendileri çevirir (ppm).
// Sürüm 2: hıza bağlı hava direnci (drag crisis), doygunluğa ulaşan Magnus, sekmede dönüş–sürtünme etkileşimi
// (kayma → yuvarlanma, üst falso topu öne kaçırır, alt falso frenler), top–oyuncu ve top–kale direği çarpışması,
// kaleye şut çözücü (solveShot).

export const G = 9.81;
export const BALL_R = 0.11;
/** Kale ölçüleri (m) ve direk yarıçapı */
export const GOAL = { w: 7.32, h: 2.44, postR: 0.06, depth: 2 };
const SAT = 0.45; // Magnus doygunluğu: spin parametresi S = r·ω/v bunun üstünde etkisi düzleşir

/** Zemin ve hava ayarları. Hava durumu bunları değiştirebilir (ıslak çim = daha az sürtünme, daha alçak sekme). */
export const ENV = {
  drag: 0.013, // hava direnci katsayısı (hızlı topta, Cd≈0.25): a = −k·|v|·v  (0.5·ρ·Cd·A / m)
  dragLow: 1.75, // yavaş topta katsayı çarpanı (Cd≈0.45); geçiş ≈11 m/s civarında (drag crisis)
  magnus: 0.006, // falso: a⊥ = k·ω·|v|
  roll: 0.9, // yuvarlanma sabit yavaşlaması (m/s²)
  rollDamp: 0.16, // hızla orantılı çim sürtünmesi (1/s)
  bounce: 0.55, // dikey sekme katsayısı
  mu: 0.42, // top–çim sürtünme katsayısı (sekmede ve kayarken)
  spinDecayAir: 0.3,
  spinDecayGround: 0.9,
  groundMagnus: 0.65, // yerde giden topta falsonun etkisi (hava ile kıyasla)
  grip: 1, // oyuncu tutunması (ivme/dönüş çarpanı): ıslak/karlı zeminde düşer
  wind: { x: 0, y: 0 },
};

export const SURFACES = {
  dry: {},
  wet: { roll: 0.55, rollDamp: 0.1, bounce: 0.42, mu: 0.2 }, // yağmur: top kayar (sekmede hız kaybetmez), alçak seker
  heavy: { roll: 1.6, rollDamp: 0.26, bounce: 0.4, mu: 0.6, grip: 0.86 }, // çamur/ağır zemin
  snow: { roll: 1.9, rollDamp: 0.3, bounce: 0.3, mu: 0.66, grip: 0.8 }, // kar: top çabuk durur, alçak seker, kaygan
};
SURFACES.wet.grip = 0.9;

/** Hava durumundan fizik ortamı: yüzey + rüzgâr. weather: core/weather.js nesnesi (yoksa kuru, rüzgârsız). */
export function envFor(surface = 'dry', wind = null) {
  if (surface && typeof surface === 'object') return envFor(surface.surface, surface.wind);
  return { ...ENV, ...(SURFACES[surface] || {}), wind: wind || ENV.wind };
}

/** Zemin tutunması: oyuncunun ivmesi ve azami hızı kaygan zeminde düşer. */
export function applyGrip(body, env) {
  const g = env?.grip ?? 1;
  if (g >= 1) return body;
  body.accel *= g;
  body.maxSpeed *= 0.5 + g * 0.5;
  if (body.turn) body.turn *= g;
  return body;
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
  b.air = b.vz > 0.05 || b.z > 0.01;
  // Yerden vuruş yuvarlanarak başlar (ω = v/r); havadan vuruşta falso verilmezse top dönmeden gider,
  // yere değince kayar, sürtünmeyle ileri dönüş kazanır ve yavaşlar.
  b.top = top || (b.air ? 0 : h / BALL_R);
  b.bounces = 0;
  b.t = 0;
  return b;
}

/** Hıza bağlı hava direnci katsayısı (drag crisis): yavaş topta yüksek, hızlı topta düşük. */
export function dragAt(speed, env = ENV) {
  const lo = env.drag * (env.dragLow ?? 1);
  return lo + (env.drag - lo) / (1 + Math.exp(-(speed - 11) / 1.6));
}

/** Magnus doygunluğu: S = r·ω/v büyüdükçe kaldırma katsayısı düzleşir (yavaş ama çok dönen top sonsuz kıvrılmaz). */
export function magnusFactor(omega, speed) {
  const S = (BALL_R * Math.abs(omega)) / Math.max(1, speed);
  return 1 / Math.sqrt(1 + (S / SAT) ** 2);
}

/** Tek fizik adımı (h saniye). Yere çarpma olursa b.impact = çarpma hızı (m/s, ses/titreşim için). */
export function stepBall(b, h, env = ENV) {
  const wx = env.wind?.x || 0;
  const wy = env.wind?.y || 0;
  const airborne = b.z > 0.0005 || b.vz > 0.0005;
  const rx = b.vx - wx;
  const ry = b.vy - wy;
  const sp3 = hyp(rx, ry, b.vz);
  const spH = hyp(b.vx, b.vy);
  const k = dragAt(sp3, env);
  let ax = -k * sp3 * rx;
  let ay = -k * sp3 * ry;
  let az = airborne ? -k * sp3 * b.vz - G : 0;
  // Magnus: z ekseni dönüşü yatay kuvvet üretir (sağa/sola kıvrılma); üst falso dikey kuvvet (+ = düşürür, − = asılı kalır)
  const fM = airborne ? magnusFactor(hyp(b.spin, b.top || 0), sp3) : 1; // yerde: oyun ayarı groundMagnus
  const m = env.magnus * b.spin * fM * (airborne ? 1 : env.groundMagnus);
  ax += m * -b.vy;
  ay += m * b.vx;
  if (airborne && b.top) az -= env.magnus * b.top * fM * spH;

  b.vx += ax * h;
  b.vy += ay * h;
  b.impact = 0;
  if (!airborne) {
    const s = hyp(b.vx, b.vy);
    if (s > 0) {
      let ns = s;
      // kayma: temas noktası kayıyorsa (v ≠ ω·r) sürtünme hızı ω·r'ye yaklaştırır
      const slip = s - (b.top || 0) * BALL_R;
      if (Math.abs(slip) > 0.05) {
        const dv = Math.min(env.mu * G * h, (2 / 7) * Math.abs(slip));
        ns -= Math.sign(slip) * dv;
        b.top = (b.top || 0) + (Math.sign(slip) * dv * 2.5) / BALL_R;
      }
      // çimde yuvarlanma: hız yönüne ters, sıfırı geçmez
      ns = Math.max(0, ns - (env.roll + env.rollDamp * ns) * h);
      b.vx *= ns / s;
      b.vy *= ns / s;
      if (Math.abs(slip) <= 0.05) b.top = ns / BALL_R; // yuvarlanma koşulu
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
      const vn = -b.vz;
      b.vz = vn * env.bounce;
      // teğetsel sürtünme darbesi: kayma = yatay hız − ω·r; en fazla yuvarlanma koşuluna (2/7·kayma) kadar
      const s = hyp(b.vx, b.vy);
      if (s > 1e-6) {
        const slip = s - (b.top || 0) * BALL_R;
        const dv = Math.min(env.mu * (1 + env.bounce) * vn, (2 / 7) * Math.abs(slip)) * Math.sign(slip);
        const ns = Math.max(0, s - dv);
        b.vx *= ns / s;
        b.vy *= ns / s;
        b.top = (b.top || 0) + (dv * 2.5) / BALL_R;
      }
      b.spin *= 0.7;
      b.bounces++;
      b.impact = vn;
    } else b.vz = 0;
  }
  b.air = b.z > 0.0005 || b.vz > 0.0005;
  b.spin *= Math.exp(-(b.air ? env.spinDecayAir : env.spinDecayGround) * h);
  if (b.air && b.top) b.top *= Math.exp(-env.spinDecayAir * h);
  b.rot += (hyp(b.vx, b.vy) / BALL_R) * h * 0.08;
  b.t += h;
  return b;
}

/** Topun gelecekteki yolu (kopya üzerinde). Her örnek: {t,x,y,z,v}. */
export function predict(b, { T = 4, h = 1 / 60, env = ENV, every = 1, noSpin = false } = {}) {
  const c = cloneBall(b);
  if (noSpin) { c.spin = 0; if (c.air) c.top = 0; } // yerdeki topun yuvarlanma dönüşü falso değildir
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

// ─────────────────────────────────────────────────────────────
// TOP – OYUNCU / KALE ÇARPIŞMASI
// ─────────────────────────────────────────────────────────────
/**
 * Top oyuncu gövdesine (dikey silindir) çarparsa seker: oyuncu topa göre çok ağırdır, topun bağıl hızı
 * normal yönde e katsayısıyla yansır, oyuncunun hızı eklenir. Çarpma hızını döndürür (0 = değmedi).
 */
export function collideBallBody(b, p, { height = 1.85, e = 0.3 } = {}) {
  if (b.z > height) return 0;
  const dx = b.x - p.x;
  const dy = b.y - p.y;
  const d = hyp(dx, dy);
  const min = p.radius + BALL_R;
  if (d >= min || d < 1e-6) return 0;
  const nx = dx / d;
  const ny = dy / d;
  b.x = p.x + nx * min;
  b.y = p.y + ny * min;
  const rvx = b.vx - (p.vx || 0);
  const rvy = b.vy - (p.vy || 0);
  const rel = rvx * nx + rvy * ny;
  if (rel >= 0) return 0;
  const tx = rvx - rel * nx;
  const ty = rvy - rel * ny;
  b.vx = (p.vx || 0) + tx * 0.75 - e * rel * nx;
  b.vy = (p.vy || 0) + ty * 0.75 - e * rel * ny;
  b.spin *= 0.4;
  b.top = (b.top || 0) * 0.5;
  return -rel;
}

/**
 * Top ile bir çubuk (direk/üst direk: A→B doğru parçası, yarıçap r) çarpışması. Çarpma hızını döndürür.
 * h verilirse son adımın yolu taranır (hızlı top direğin içinden geçip kaçmasın: sürekli çarpışma).
 */
export function collideBallBar(b, A, B, { r = GOAL.postR, e = 0.62, h = 0 } = {}) {
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const abz = B.z - A.z;
  const L2 = abx * abx + aby * aby + abz * abz || 1;
  const min = r + BALL_R;
  const dist = (x, y, z) => {
    const t = clamp(((x - A.x) * abx + (y - A.y) * aby + (z - A.z) * abz) / L2, 0, 1);
    const dx = x - (A.x + abx * t);
    const dy = y - (A.y + aby * t);
    const dz = z - (A.z + abz * t);
    return { dx, dy, dz, d: hyp(dx, dy, dz) };
  };
  let q = dist(b.x, b.y, b.z);
  if (h > 0) {
    // önceki konumdan şimdikine küçük adımlarla ilk temas anını bul
    const len = hyp(b.vx, b.vy, b.vz) * h;
    const n = Math.min(24, Math.ceil(len / (BALL_R * 0.4)));
    for (let i = 1; i <= n; i++) {
      const f = 1 - i / n; // geriye: f = 1 → önceki konum
      const x = b.x - b.vx * h * f;
      const y = b.y - b.vy * h * f;
      const z = b.z - b.vz * h * f;
      const c = dist(x, y, z);
      if (c.d < min) { b.x = x; b.y = y; b.z = z; q = c; break; }
    }
  }
  const { dx, dy, dz, d } = q;
  if (d >= min || d < 1e-6) return 0;
  const nx = dx / d;
  const ny = dy / d;
  const nz = dz / d;
  b.x += nx * (min - d);
  b.y += ny * (min - d);
  b.z += nz * (min - d);
  const vn = b.vx * nx + b.vy * ny + b.vz * nz;
  if (vn >= 0) return 0;
  const k = (1 + e) * vn;
  b.vx = (b.vx - k * nx) * 0.94;
  b.vy = (b.vy - k * ny) * 0.94;
  b.vz = (b.vz - k * nz) * 0.94;
  b.spin *= -0.5; // direkten dönen top falsosunu büyük ölçüde kaybeder
  b.top = (b.top || 0) * -0.4;
  b.air = true;
  return -vn;
}

/** Kale çerçevesi: kale çizgisi y = 0, saha y > 0, kalenin içi y < 0; orta x = 0. */
export const GOAL_FRAME = (() => {
  const hw = GOAL.w / 2;
  return [
    { part: 'post', A: { x: -hw, y: 0, z: 0 }, B: { x: -hw, y: 0, z: GOAL.h } },
    { part: 'post', A: { x: hw, y: 0, z: 0 }, B: { x: hw, y: 0, z: GOAL.h } },
    { part: 'bar', A: { x: -hw, y: 0, z: GOAL.h }, B: { x: hw, y: 0, z: GOAL.h } },
  ];
})();

/** Topu kale direkleri ve üst direkle çarpıştırır. {part, speed} ya da null. */
export function collideGoalFrame(b, opts = {}) {
  for (const f of GOAL_FRAME) {
    const v = collideBallBar(b, f.A, f.B, opts);
    if (v > 0) return { part: f.part, speed: v };
  }
  return null;
}

/** Ağlar: kale içindeki top arka fileye ve tavana çarpınca enerjisini kaybeder. Çarptıysa hızı döndürür. */
export function collideNet(b, { depth = GOAL.depth, damp = 0.12 } = {}) {
  if (b.y >= 0 || Math.abs(b.x) > GOAL.w / 2 || b.z > GOAL.h) return 0;
  let hit = 0;
  if (b.y < -depth + BALL_R && b.vy < 0) {
    hit = -b.vy;
    b.y = -depth + BALL_R;
    b.vy = -b.vy * damp;
    b.vx *= 0.35;
    b.vz *= 0.35;
    b.spin *= 0.2;
  }
  if (b.z > GOAL.h - BALL_R && b.vz > 0) { hit = Math.max(hit, b.vz); b.z = GOAL.h - BALL_R; b.vz *= -0.2; }
  return hit;
}

// ─────────────────────────────────────────────────────────────
// KALEYE ŞUT ÇÖZÜCÜ
// ─────────────────────────────────────────────────────────────
/** Topu kale çizgisine (y = 0) varana kadar sürer; geçiş noktası {x, z, t} (doğrusal ara değer). */
function crossGoalLine(b, env, h = 1 / 120, T = 4) {
  let px = b.x;
  let py = b.y;
  let pz = b.z;
  for (let t = 0; t < T; t += h) {
    stepBall(b, h, env);
    if (b.y <= 0) {
      const f = py / Math.max(1e-6, py - b.y);
      return { x: px + (b.x - px) * f, z: pz + (b.z - pz) * f, t: b.t - h + h * f };
    }
    if (!b.air && groundSpeed(b) < 0.3) break;
    px = b.x;
    py = b.y;
    pz = b.z;
  }
  return { x: b.x, z: b.z, t: Infinity };
}

/**
 * Kaleye şut: top from {x, y>0}'dan çıkıp kale çizgisini to {x, z} noktasından yaklaşık T saniyede geçsin.
 * spin (yan falso) ve top (üst falso) sabit verilir; çıkış yönü, yükselme açısı ve hız çözülür.
 * @returns {{dirX,dirY,speed,loft,spin,top,err,t}}
 */
export function solveShot(from, to, { T = 0.7, spin = 0, top = 0, env = ENV, maxSpeed = 40, iters = 18 } = {}) {
  const D = Math.max(1, hyp(to.x - from.x, from.y));
  let yaw = Math.atan2(to.x - from.x, from.y);
  let vh = Math.min(maxSpeed, (D / T) * 1.06);
  let vz = (to.z + 0.5 * G * T * T) / T;
  let best = null;
  for (let it = 0; it < iters; it++) {
    const speed = Math.min(maxSpeed, hyp(vh, vz));
    const loft = Math.atan2(vz, vh);
    const k = { dirX: Math.sin(yaw), dirY: -Math.cos(yaw), speed, loft, spin, top };
    const r = crossGoalLine(kick(createBall(from.x, from.y, 0), k), env);
    const ex = r.x - to.x;
    const ez = r.z - to.z;
    const et = Number.isFinite(r.t) ? r.t - T : 1;
    const err = hyp(ex, ez) + Math.abs(et) * 2;
    if (!best || err < best.err) best = { ...k, err, t: r.t, hit: { x: r.x, z: r.z } };
    if (Math.abs(ex) < 0.02 && Math.abs(ez) < 0.02 && Math.abs(et) < 0.01) break;
    yaw -= ex / D;
    const tr = Number.isFinite(r.t) ? r.t : T * 1.5;
    vh = Math.min(maxSpeed, vh * clamp(tr / T, 0.75, 1.35));
    vz -= (ez / Math.max(0.25, tr)) * 0.95;
  }
  return best;
}

/** Çözülmüş şutun yolu (çizim/önizleme): from'dan başlayıp kale çizgisinin until metre ötesine kadar örnekler. */
export function shotPath(from, k, { env = ENV, h = 1 / 120, until = -GOAL.depth, T = 3, frame = false } = {}) {
  const b = kick(createBall(from.x, from.y, 0), k);
  const out = [{ t: 0, x: b.x, y: b.y, z: b.z }];
  for (let t = 0; t < T; t += h) {
    stepBall(b, h, env);
    const hit = frame ? collideGoalFrame(b, { h }) : null;
    out.push({ t: b.t, x: b.x, y: b.y, z: b.z, impact: b.impact, hit: hit?.part });
    if (hit || b.y < until) break;
  }
  return { path: out, ball: b };
}
