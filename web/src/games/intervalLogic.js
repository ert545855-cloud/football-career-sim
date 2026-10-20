// KONDİSYON PARKURU (NABIZ KOŞUSU) — saf mantık (Node testlerinde çalışır).
//
// Atletizm pistinde aralıklı koşu: TEMPO bölümlerinde nabzı 115–145, SPRİNT bölümlerinde 158–182 aralığında tut.
// KOŞ'a basılı tut: hızlan; bırak: yavaşla. Nabız hızın arkasından gecikmeyle gelir. Kondisyonun düşükse aynı hızda
// nabız daha yüksek çıkar: sprintte tam gaz gidersen kırmızı bölgeye (190+) girersin, nefesin kesilir.
// Sprint bölümlerinde engeller var: ZIPLA ile aş; çarparsan sendelersin.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Bölümler: [tür, süre sn] */
export const IV_PROGRAM = [['jog', 5], ['sprint', 5.5], ['jog', 4.5], ['sprint', 6], ['jog', 4.5], ['sprint', 5.5], ['cool', 3.5]];
export const IV_ZONES = { jog: [115, 145], sprint: [158, 182], cool: [100, 135] };
export const IV_RED = 190;
export const IV_TOTAL = IV_PROGRAM.reduce((a, [, d]) => a + d, 0);

export function intervalParams(skill = 0.3, cond = 60) {
  const e = 0.25 + 0.75 * clamp(skill, 0, 1);
  const c = clamp(cond, 0, 100) / 100;
  return {
    e, c,
    vmax: lerp(7.4, 9, e),
    vmin: 2.2,
    accel: lerp(3.6, 4.6, e),
    decel: 3.2,
    // nabız = 78 + v × kazanç; kondisyon düşükse kazanç yüksek (aynı hızda daha yüksek nabız)
    hrGain: 13 * (1.28 - c * 0.5) * lerp(1.06, 0.96, e),
    hrLag: 1.5, // nabzın hıza yetişme süresi (sn)
    airT: 0.56,
    jumpWindow: 1.15, // engele bu kadar metre kala zıplamak temiz geçiş sayılır
    target: lerp(0.5, 0.6, clamp(skill, 0, 1)),
  };
}

export function segmentAt(t) {
  let acc = 0;
  for (let i = 0; i < IV_PROGRAM.length; i++) {
    const [kind, d] = IV_PROGRAM[i];
    if (t < acc + d) return { i, kind, t0: acc, t1: acc + d, left: acc + d - t };
    acc += d;
  }
  const [kind] = IV_PROGRAM[IV_PROGRAM.length - 1];
  return { i: IV_PROGRAM.length - 1, kind, t0: acc, t1: acc, left: 0 };
}

/** Engeller: sprint bölümlerinde, sprint hızında ~1.9 sn arayla (metre cinsinden konum) */
function buildHurdles(P) {
  const out = [];
  let acc = 0;
  let pos = 0;
  for (const [kind, d] of IV_PROGRAM) {
    const v = kind === 'sprint' ? P.vmax * 0.86 : 4.5;
    if (kind === 'sprint') {
      for (let s = 1.6; s < d - 0.6; s += 1.9) out.push({ x: pos + v * s, hit: false, cleared: false });
    }
    pos += v * d;
    acc += d;
  }
  return out;
}

export function createInterval(P) {
  return {
    P, t: 0, x: 0, v: 3.5, hr: 92, hold: false,
    air: 0, stumble: 0, gasp: 0,
    inZone: 0, total: 0, redT: 0, hits: 0, cleared: 0, jumps: 0,
    hurdles: buildHurdles(P), events: [], done: false, lastSeg: -1,
  };
}

export const setRun = (R, on) => { R.hold = !!on; };

/** ZIPLA: havadayken tekrar basılamaz */
export function jump(R) {
  if (R.done || R.air > 0) return false;
  R.air = R.P.airT;
  R.jumps++;
  return true;
}

export function intervalStep(R, dt) {
  if (R.done) return;
  const P = R.P;
  R.t += dt;
  const seg = segmentAt(R.t);
  if (seg.i !== R.lastSeg) { R.lastSeg = seg.i; R.events.push({ type: 'seg', kind: seg.kind }); }
  // hız
  let cap = P.vmax;
  if (R.gasp > 0) { cap = P.vmax * 0.55; R.gasp -= dt; }
  if (R.stumble > 0) { cap = Math.min(cap, 3); R.stumble -= dt; }
  if (R.hold) R.v = Math.min(cap, R.v + P.accel * dt);
  else R.v = Math.max(P.vmin, R.v - P.decel * dt);
  R.v = Math.min(R.v, cap + 0.0001);
  R.x += R.v * dt;
  // nabız: hızı gecikmeyle izler
  const hrTarget = 78 + R.v * P.hrGain;
  R.hr += (hrTarget - R.hr) * (1 - Math.exp(-dt / P.hrLag));
  if (R.hr >= IV_RED) {
    R.redT += dt;
    if (R.gasp <= 0 && R.redT > 0.9) { R.gasp = 1.6; R.redT = 0; R.events.push({ type: 'gasp' }); }
  } else R.redT = Math.max(0, R.redT - dt * 0.5);
  // bölge
  const [lo, hi] = IV_ZONES[seg.kind];
  R.total += dt;
  if (R.hr >= lo && R.hr <= hi) R.inZone += dt;
  // havada
  if (R.air > 0) R.air = Math.max(0, R.air - dt);
  // engeller
  for (const h of R.hurdles) {
    if (h.hit || h.cleared) continue;
    if (R.x >= h.x) {
      if (R.air > 0) { h.cleared = true; R.cleared++; R.events.push({ type: 'clear' }); }
      else { h.hit = true; R.hits++; R.stumble = 0.7; R.v = Math.min(R.v, 2.6); R.events.push({ type: 'hit' }); }
    }
  }
  if (R.t >= IV_TOTAL) { R.done = true; R.events.push({ type: 'end' }); }
}

/** Kalan engel (oyuncunun önündeki ilk) */
export const nextHurdle = (R) => R.hurdles.find((h) => !h.hit && !h.cleared && h.x > R.x - 0.2) || null;

export function intervalResult(R) {
  const zone = R.total ? R.inZone / R.total : 0;
  const q = clamp(zone - R.hits * 0.06, 0, 1);
  const success = q >= R.P.target;
  const label = q >= 0.8 ? 'Kusursuz tempo!' : q >= R.P.target ? 'Nabzını iyi yönettin.' : R.hits >= 3 ? 'Engellere çok takıldın.' : 'Nabız bölgesinin dışında kaldın.';
  return { success, accuracy: q, q, zone: Math.round(zone * 100), hits: R.hits, cleared: R.cleared, label, outcome: success ? 'success' : 'missed' };
}
