// SPOR SALONU MİNİ OYUNLARI — saf mantık (Node'da test edilir). Çizim: games/gym.js
//   Halter: bar iner, güç göstergesi gidip gelir; yeşil bölgede bas → tekrar. Her sette ağırlık artar.
//   Dambıl: ritim oyunu; ışık yanan kolun düğmesine vuruşta bas, seri yap.
//   Koşu bandı: SOL-SAĞ sırayla bas, bant hızına yetiş; yeşil bölgede kal, geri kayarsan düşersin.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ─────────────────────────── HALTER ───────────────────────────
export const BAR = { setsMax: 5, repsPerSet: 3, downT: 0.65, upT: 0.55, restT: 0.9, gaugeTimeout: 2.4 };

/** power 0–100: bölge genişliği ve başlangıç ağırlığı */
export function barbellParams(power = 40) {
  const p = clamp(power, 0, 100) / 100;
  return {
    zoneW: 0.17 + p * 0.13, // göstergenin oranı
    speed: 0.95, // tur/sn (her sette artar)
    kg0: Math.round((40 + p * 70) / 5) * 5,
    stepKg: 10,
  };
}

export function createBarbell(P, rnd = Math.random) {
  return { P, rnd, set: 1, rep: 0, kg: P.kg0, maxKg: P.kg0, misses: 0, phase: 'down', t: 0, g: 0, dir: 1, zoneC: 0.55, zoneW: P.zoneW, speed: P.speed, reps: 0, perfect: 0, last: null, done: false, lift: 0 };
}

export function barbellStep(B, dt) {
  if (B.done) return;
  B.t += dt;
  if (B.phase === 'down') {
    B.lift = 1 - Math.min(1, B.t / BAR.downT);
    if (B.t >= BAR.downT) { B.phase = 'gauge'; B.t = 0; B.g = 0; B.dir = 1; }
  } else if (B.phase === 'gauge') {
    B.g += B.dir * B.speed * 2 * dt;
    if (B.g >= 1) { B.g = 2 - B.g; B.dir = -1; }
    if (B.g <= 0) { B.g = -B.g; B.dir = 1; }
    if (B.t >= BAR.gaugeTimeout) miss(B);
  } else if (B.phase === 'up') {
    B.lift = Math.min(1, B.t / BAR.upT);
    if (B.t >= BAR.upT) {
      if (B.rep >= BAR.repsPerSet) {
        if (B.set >= BAR.setsMax) { B.done = true; return; }
        B.phase = 'rest'; B.t = 0;
      } else { B.phase = 'down'; B.t = 0; }
    }
  } else if (B.phase === 'fail') {
    // spotter barı alır
    B.lift = Math.min(1, B.t / 0.9) * 0.9;
    if (B.t >= 0.9) {
      if (B.misses >= 2) { B.done = true; return; }
      B.phase = 'down'; B.t = 0;
    }
  } else if (B.phase === 'rest') {
    B.lift = 1;
    if (B.t >= BAR.restT) {
      B.set += 1; B.rep = 0; B.kg += B.P.stepKg; B.maxKg = Math.max(B.maxKg, B.kg);
      B.speed *= 1.14; B.zoneW = Math.max(0.09, B.zoneW * 0.88);
      B.zoneC = 0.35 + B.rnd() * 0.4;
      B.phase = 'down'; B.t = 0;
    }
  }
}

function miss(B) {
  B.misses += 1;
  B.last = 'miss';
  B.phase = 'fail';
  B.t = 0;
}

/** Bas: göstergedeyken değerlendirir */
export function barbellPress(B) {
  if (B.done || B.phase !== 'gauge') return null;
  const d = Math.abs(B.g - B.zoneC);
  if (d <= B.zoneW / 2) {
    const perfect = d <= B.zoneW * 0.15;
    B.rep += 1; B.reps += 1;
    if (perfect) B.perfect += 1;
    B.last = perfect ? 'perfect' : 'good';
    B.phase = 'up'; B.t = 0;
    return B.last;
  }
  miss(B);
  return 'miss';
}

export function barbellResult(B) {
  const max = BAR.setsMax * BAR.repsPerSet;
  const q = clamp((B.reps + B.perfect * 0.5) / (max * 1.2), 0, 1);
  const lifted = B.reps ? B.kg - (B.rep === 0 ? B.P.stepKg : 0) : 0;
  return { q, reps: B.reps, perfect: B.perfect, maxKg: B.reps ? Math.max(B.P.kg0, lifted) : 0, score: B.reps ? B.reps * 10 + B.perfect * 5 + Math.round(B.maxKg / 10) : 0, label: `${B.reps} tekrar · ${B.reps ? Math.max(B.P.kg0, lifted) : 0} kg` };
}

// ─────────────────────────── DAMBIL ───────────────────────────
export const CURL = { beats: 24, lead: 1.4 };

export function curlParams(power = 40) {
  const p = clamp(power, 0, 100) / 100;
  return { bpm0: 64 + p * 10, bpm1: 104 + p * 16, window: 0.2 + p * 0.06 };
}

export function createCurl(P, rnd = Math.random) {
  const beats = [];
  let t = CURL.lead;
  let side = 'L';
  for (let i = 0; i < CURL.beats; i++) {
    beats.push({ t, side, hit: null });
    const bpm = P.bpm0 + (P.bpm1 - P.bpm0) * (i / (CURL.beats - 1));
    t += 60 / bpm;
    // çoğunlukla sırayla; arada aynı koldan ikili
    side = rnd() < 0.2 ? side : side === 'L' ? 'R' : 'L';
  }
  return { P, beats, t: 0, combo: 0, maxCombo: 0, good: 0, perfect: 0, missed: 0, wrong: 0, done: false, flash: null };
}

export function curlStep(C, dt) {
  if (C.done) return;
  C.t += dt;
  for (const b of C.beats) {
    if (b.hit == null && C.t > b.t + C.P.window / 2) { b.hit = 'miss'; C.missed += 1; C.combo = 0; }
  }
  if (C.t > C.beats[C.beats.length - 1].t + 0.8) C.done = true;
}

/** side: 'L' | 'R' */
export function curlPress(C, side) {
  if (C.done) return null;
  const open = C.beats.filter((b) => b.hit == null && Math.abs(C.t - b.t) <= C.P.window / 2);
  if (!open.length) { C.combo = 0; C.flash = 'early'; return 'early'; }
  const b = open.sort((x, y) => Math.abs(C.t - x.t) - Math.abs(C.t - y.t))[0];
  if (b.side !== side) { b.hit = 'wrong'; C.wrong += 1; C.combo = 0; C.flash = 'wrong'; return 'wrong'; }
  const perfect = Math.abs(C.t - b.t) <= C.P.window * 0.2;
  b.hit = perfect ? 'perfect' : 'good';
  C.good += 1;
  if (perfect) C.perfect += 1;
  C.combo += 1;
  C.maxCombo = Math.max(C.maxCombo, C.combo);
  C.flash = b.hit;
  return b.hit;
}

export function curlResult(C) {
  const n = C.beats.length;
  const q = clamp((C.good + C.perfect * 0.4 + C.maxCombo * 0.15) / (n * 1.4 + n * 0.15), 0, 1);
  return { q, good: C.good, perfect: C.perfect, maxCombo: C.maxCombo, score: C.good * 4 + C.perfect * 2 + C.maxCombo, label: `${C.good}/${n} isabet · en uzun seri ${C.maxCombo}` };
}

// ─────────────────────────── KOŞU BANDI ───────────────────────────
/** İnterval programı: [başlangıç sn, km/sa] */
export const TREAD_PROGRAM = [[0, 8], [4, 11], [8, 14], [12, 10], [15, 15.5], [20, 12], [23, 17], [26, 9]];
export const TREAD = { duration: 29, zone: 0.36, kmhPerTap: 4.2 };

export function treadParams(cond = 58) {
  const c = clamp(cond, 0, 100) / 100;
  // yüksek kondisyon: aynı hız daha az adımla (verimli adım), bant programı biraz hafifler
  return { kmhPerTap: TREAD.kmhPerTap * (0.92 + c * 0.2), scale: 1.05 - c * 0.12 };
}

export function beltKmh(t, P) {
  let k = TREAD_PROGRAM[0][1];
  for (const [t0, v] of TREAD_PROGRAM) if (t >= t0) k = v;
  return k * P.scale;
}

export function createTread(P) {
  return { P, t: 0, x: 0, v: 0, taps: [], lastFoot: null, zoneT: 0, stumble: 0, fell: false, bumps: 0, done: false, hr: 92, steps: 0 };
}

/** Adım: sırayla SOL-SAĞ. Aynı ayakla iki kez basmak tökezletir. */
export function treadTap(T, foot) {
  if (T.done) return null;
  if (T.lastFoot === foot) { T.stumble = 0.35; T.v *= 0.75; T.lastFoot = foot; return 'stumble'; }
  T.lastFoot = foot;
  T.taps.push(T.t);
  T.steps += 1;
  return 'step';
}

export function treadStep(T, dt) {
  if (T.done) return;
  T.t += dt;
  // son 1,2 sn içindeki adım sıklığından koşu hızı
  T.taps = T.taps.filter((x) => T.t - x <= 1.2);
  const cadence = T.taps.length / 1.2;
  const target = cadence * T.P.kmhPerTap * (T.stumble > 0 ? 0.6 : 1);
  T.v += (target - T.v) * Math.min(1, dt * 3.2);
  if (T.stumble > 0) T.stumble -= dt;
  const belt = beltKmh(T.t, T.P);
  T.x += (T.v - belt) * 0.055 * dt;
  if (T.x > 1) { T.x = 0.6; T.v *= 0.6; T.bumps += 1; T.stumble = 0.5; }
  if (T.x < -1) { T.fell = true; T.done = true; return; }
  if (Math.abs(T.x) <= TREAD.zone) T.zoneT += dt;
  T.hr += ((95 + T.v * 6.5) - T.hr) * Math.min(1, dt * 0.8);
  if (T.t >= TREAD.duration) T.done = true;
}

export function treadResult(T) {
  const q = clamp((T.zoneT / TREAD.duration) * (T.fell ? 0.7 : 1) - T.bumps * 0.03, 0, 1);
  const km = T.steps * 0.0012 * 4.2; // yaklaşık
  return { q, zone: Math.round((T.zoneT / TREAD.duration) * 100), fell: T.fell, score: Math.round(q * 100), label: `Bölgede %${Math.round((T.zoneT / TREAD.duration) * 100)}${T.fell ? ' · banttan düştün' : ''} · ${km.toFixed(2).replace('.', ',')} km` };
}
