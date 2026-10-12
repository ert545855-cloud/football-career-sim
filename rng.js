// Rastgelelik ve küçük matematik yardımcıları.
// Testlerde ve simülasyonda tekrar üretilebilir sonuç için setRandom ile tohumlu üreteç verilebilir.

let rng = Math.random;

export function setRandom(fn) {
  rng = typeof fn === 'function' ? fn : Math.random;
}

/** Tohumlu, hızlı PRNG (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const random = () => rng();
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
export const rand = (a = 0, b = 1) => a + rng() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const chance = (p) => rng() < p;
export const pick = (arr) => arr[Math.floor(rng() * arr.length)];

export function weightedPick(entries) {
  // entries: [[value, weight], ...]
  let total = 0;
  for (const [, w] of entries) total += Math.max(0, w);
  if (total <= 0) return entries[0]?.[0];
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

export function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L && k < 20);
  return k - 1;
}

export function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const roundTo = (v, step) => Math.round(v / step) * step;
export const round1 = (v) => Math.round(v * 10) / 10;
