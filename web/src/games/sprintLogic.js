// KOŞU — saf mantık (Node testlerinde çalışır). Adım fiziği + ritim.
//
// • Her adım hız kazandırır: kazanç = güç × ritim kalitesi × (1 − (v/vmax)³). Sürat statı vmax'ı ve gücü belirler,
//   yani statın arttıkça koşucun GERÇEKTEN hızlanır (hedef de senin potansiyeline göre ayarlanır).
// • Ritim: iki adım arası ideal pencerede (≈4–6 adım/sn) "MÜKEMMEL". Tuşlara deli gibi basmak (spam) kısa,
//   verimsiz adımlar demek; çok yavaş basmak da hız kaybettirir. Aynı ayağa iki kez basmak tökezletir.
// • Çıkış: "BAŞLA!" işaretinden önce basarsan hatalı çıkış (+0.3 sn ceza). Tepki süren ölçülür.
// • Dayanıklılık: eşik temposunun üstünde koşmak nefesi tüketir, altında toparlar. Nefes biterse adımlar güçsüzleşir.
//   Dayanıklılık statı eşiği yükseltir. Doğru taktik: tempoyu koru, son düzlükte depar at.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function sprintParams(skill = 0.3, mode = 'sprint') {
  const e = 0.25 + 0.75 * clamp(skill, 0, 1);
  const endurance = mode === 'endurance';
  return {
    mode,
    e,
    endurance,
    distance: endurance ? 150 : 60,
    vmax: endurance ? lerp(7.4, 9.2, e) : lerp(8.1, 10.3, e),
    gain: lerp(1.1, 1.3, e),
    drag: endurance ? 0.18 : 0.12, // yavaşlama (1/s); dayanıklılıkta adım temposu hızı belirler
    // ideal adım aralığı (sn); yetenek pencereyi genişletir
    win: endurance ? [lerp(0.22, 0.2, e), lerp(0.36, 0.4, e)] : [lerp(0.17, 0.15, e), lerp(0.24, 0.27, e)],
    // dayanıklılık
    thresh: lerp(0.79, 0.84, e), // sürdürülebilir hız oranı (v/vmax)
    drainK: 115,
    recK: 22,
    falsePenalty: 0.3,
  };
}

export function createRun() {
  return { x: 0, v: 0, t: 0, last: null, lastT: null, go: false, stam: 100, gassed: false, stumble: 0, steps: 0, qSum: 0, perfect: 0, topV: 0, react: null, falseStarts: 0, finished: false, time: null };
}

/** İki adım arası süreye göre ritim kalitesi (0–1) ve etiketi. */
export function stepQuality(dtStep, P) {
  const [lo, hi] = P.win;
  if (dtStep == null) return { q: 0.75, label: 'start' };
  if (dtStep < 0.085) return { q: 0.1, label: 'spam' };
  if (dtStep < lo) return { q: lerp(0.15, 0.85, ((dtStep - 0.085) / (lo - 0.085)) ** 2), label: 'early' };
  if (dtStep <= hi) return { q: 1, label: 'perfect' };
  if (dtStep < 0.55) return { q: lerp(0.95, 0.4, (dtStep - hi) / (0.55 - hi)), label: 'late' };
  return { q: 0.4, label: 'late' };
}

/**
 * Bir adım. now = koşu saati (sn, BAŞLA anında 0).
 * @returns {{q:number,label:string}|null}
 */
export function runStep(R, P, side, now) {
  if (R.finished) return null;
  if (!R.go) {
    R.falseStarts++;
    return { q: 0, label: 'false' };
  }
  if (R.react == null) R.react = now;
  if (R.last === side) {
    // aynı ayak: tökezleme
    R.v *= 0.72;
    R.stumble = 0.3;
    R.last = side;
    R.lastT = now;
    return { q: 0, label: 'stumble' };
  }
  const dtStep = R.lastT == null ? null : now - R.lastT;
  const sq = stepQuality(dtStep, P);
  let q = sq.q;
  if (R.stumble > 0) q *= 0.5;
  if (R.gassed) q *= 0.25; // nefes kesildi: bacaklar kurşun gibi
  const x = R.v / P.vmax;
  R.v = Math.min(P.vmax, R.v + P.gain * q * Math.max(0, 1 - x * x * x));
  R.last = side;
  R.lastT = now;
  R.steps++;
  R.qSum += q;
  if (sq.label === 'perfect') R.perfect++;
  return { q, label: sq.label };
}

/** Sürekli zaman adımı (dt sn). Bitişte true döner. */
export function runTick(R, P, dt) {
  if (!R.go || R.finished) return false;
  R.t += dt;
  R.v = Math.max(0, R.v - P.drag * (R.gassed ? 2.5 : 1) * R.v * dt - (R.v > 0 && R.lastT != null && R.t - R.lastT > 0.6 ? 2.2 * dt : 0));
  if (R.stumble > 0) R.stumble -= dt;
  if (P.endurance) {
    const x = R.v / P.vmax;
    R.stam = clamp(R.stam + (x > P.thresh ? -(x - P.thresh) * P.drainK : (P.thresh - x) * P.recK + 1.5) * dt, 0, 100);
    if (R.stam <= 0) R.gassed = true;
    else if (R.gassed && R.stam >= 40) R.gassed = false;
  }
  R.x += R.v * dt;
  R.topV = Math.max(R.topV, R.v);
  if (R.x >= P.distance) {
    // bitişi kare arası doğrusal ara değerle hassaslaştır
    const over = (R.x - P.distance) / Math.max(0.01, R.v);
    R.time = R.t - over + R.falseStarts * P.falsePenalty;
    R.x = P.distance;
    R.finished = true;
    return true;
  }
  return false;
}

/** Bir koşuyu bir stratejiyle simüle eder (testler ve hedef süre için). policy(R,P) → sonraki adım aralığı (sn). */
export function simulateRun(P, policy, { react = 0.2, dt = 1 / 120, maxT = 60, trace = null } = {}) {
  const R = createRun();
  R.go = true;
  let next = react;
  let side = 'L';
  let tr = 0;
  while (!R.finished && R.t < maxT) {
    if (trace && R.t >= tr) {
      trace.push(R.x);
      tr += 0.05;
    }
    if (R.t >= next) {
      runStep(R, P, side, R.t);
      side = side === 'L' ? 'R' : 'L';
      next = R.t + policy(R, P);
    }
    runTick(R, P, dt);
  }
  return R;
}

/** İyi koşu: pencerenin ortasında ritim; dayanıklılıkta eşik temposu (yavaş/hızlı ritimle) + son 30 m depar. */
export function pacedPolicy(P) {
  const [lo, hi] = P.win;
  const mid = (lo + hi) / 2;
  if (!P.endurance) return () => mid;
  // nefese bakarak: son 30 m depar, nefes azsa yavaş ritim, yoksa orta ritim
  return (R) => (R.x > P.distance - 30 && R.stam > 15 ? lo + 0.02 : R.stam < 35 ? hi - 0.02 : mid);
}

export function idealTime(P) {
  return simulateRun(P, pacedPolicy(P)).time;
}

/** Hedef koşucunun konumu (t sn'de): kusursuz koşunun izi, hedef süreye ölçeklenmiş. */
export function ghostTrace(P) {
  const trace = [];
  const R = simulateRun(P, pacedPolicy(P), { trace });
  const scale = R.time / targetTime(P);
  return (t) => {
    const i = (t * scale) / 0.05;
    const a = Math.floor(i);
    if (a >= trace.length - 1) return Math.min(P.distance, trace[trace.length - 1] + (i - trace.length + 1) * 0.05 * (P.vmax * 0.9));
    return trace[a] + (trace[a + 1] - trace[a]) * (i - a);
  };
}

/** Hedef (rakip) süre: senin potansiyeline göre; yeni başlayana biraz daha pay. */
export function targetTime(P) {
  return idealTime(P) * lerp(1.09, 1.05, P.e);
}
