// MEKİK KOŞUSU (BİP TESTİ) — saf mantık (Node testlerinde çalışır).
//
// İki çizgi arası 20 m. Her mekik, bip sesine kadar bitmeli; seviyeler (2 mekik) giderek hızlanır.
// Erken varırsan çizgide bip'i beklersin (nefes toplanır). Geç kalırsan uyarı alırsın; üst üste 2 uyarı = test biter.
// KOŞ'a basılı tutmak hızlandırır; bırakınca yavaşlarsın. Hızlı koşmak nefesi orantısızca tüketir;
// nefes biterse azami hız yarıya düşer. Çizgiye yaklaşırken DÖN'e basarsan hızlı dönersin (zamanlama).
// Dayanıklılık statı: rahat tempo eşiği, nefes kapasitesi ve azami hız.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export const SHUTTLE_M = 20;
export const SHUTTLES_PER_LEVEL = 2;

export function shuttleParams(skill = 0.3) {
  const e = 0.25 + 0.75 * clamp(skill, 0, 1);
  return {
    e,
    vmax: lerp(7.2, 9.2, e),
    accel: 4.2,
    decel: 3.2,
    easy: lerp(4.4, 5.6, e), // bu hızın altında nefes toplanır
    drain: lerp(5.5, 3.8, e), // (v − easy)^1.5 başına nefes kaybı (sn)
    recover: lerp(9, 13, e),
    turnWindow: 2.6, // çizgiden önce DÖN'e basılabilecek mesafe (m)
    targetLevel: Math.round(lerp(3, 6, clamp(skill, 0, 1))),
  };
}

/** Seviyenin gerektirdiği hız (m/s) ve mekik süresi. */
export const levelSpeed = (level) => 4.0 + 0.42 * (level - 1);
export const shuttleTime = (level) => SHUTTLE_M / levelSpeed(level);
export const levelOf = (n) => Math.floor(n / SHUTTLES_PER_LEVEL) + 1;

/** n. mekiğin bitiş anı (bip), testin başından itibaren. */
export function deadlineOf(n) {
  let t = 0;
  for (let i = 0; i <= n; i++) t += shuttleTime(levelOf(i));
  return t;
}

export function createShuttle(P) {
  return {
    t: 0, x: 0, dir: 1, v: 0, breath: 100, gassed: false,
    n: 0, // tamamlanan mekik
    leaveAt: 0, // bu andan önce çizgiden çıkamazsın (bip bekleme)
    turning: 0, armed: false, warnings: 0, over: false, overReason: null,
    hold: false, perfectTurns: 0, turns: 0, lateCount: 0, beeps: 0,
    events: [],
    P,
  };
}

export function setHold(R, on) { R.hold = !!on; }

/** DÖN: çizgiye yeterince yakınsa hızlı dönüş kurulur. */
export function pressTurn(R) {
  if (R.over || R.turning > 0) return false;
  const lineX = R.dir > 0 ? SHUTTLE_M : 0;
  const d = Math.abs(lineX - R.x);
  if (d <= R.P.turnWindow) {
    R.armed = true;
    R.events.push({ type: 'armed' });
    return true;
  }
  R.events.push({ type: 'early' });
  return false;
}

/** Hedef seviyeye göre ilerleme etiketi: "6.2" (seviye.mekik) */
export function levelLabel(n) {
  const L = levelOf(Math.max(0, n - 1));
  const s = n === 0 ? 0 : ((n - 1) % SHUTTLES_PER_LEVEL) + 1;
  return `${n === 0 ? 1 : L}.${s}`;
}

export function shuttleStep(R, h) {
  if (R.over) return;
  const P = R.P;
  R.t += h;
  // nefes
  const over = Math.max(0, R.v - P.easy);
  if (over > 0) R.breath -= P.drain * over ** 1.5 * h;
  else R.breath += P.recover * (1 - R.v / P.easy) * h + 2 * h;
  R.breath = clamp(R.breath, 0, 100);
  if (R.breath <= 0 && !R.gassed) { R.gassed = true; R.events.push({ type: 'gassed' }); }
  if (R.gassed && R.breath >= 35) R.gassed = false;

  // bip çaldı ama o mekiği bitiremedin: uyarı (her bip'te bir kez; üst üste 2 = elendin)
  while (R.t > deadlineOf(R.beeps) + 0.05) {
    R.beeps++;
    if (R.n < R.beeps) {
      R.warnings++;
      R.lateCount++;
      R.events.push({ type: 'late', warnings: R.warnings });
      if (R.warnings >= 2) {
        R.over = true;
        R.overReason = 'late';
        R.events.push({ type: 'over' });
        return;
      }
    }
  }
  if (R.turning > 0) {
    R.turning -= h;
    if (R.turning <= 0) R.dir *= -1;
    return;
  }
  // bip beklemesi: çizgide dur
  if (R.t < R.leaveAt) {
    R.v = Math.max(0, R.v - P.decel * 2 * h);
    return;
  }
  const vmax = P.vmax * (R.gassed ? 0.5 : 1);
  if (R.hold) R.v = Math.min(vmax, R.v + P.accel * (1 - (R.v / vmax) ** 2) * h + 0.0001);
  else R.v = Math.max(0, R.v - P.decel * h);
  if (R.v > vmax) R.v = Math.max(vmax, R.v - P.decel * h);
  R.x += R.dir * R.v * h;
  const lineX = R.dir > 0 ? SHUTTLE_M : 0;
  if ((R.dir > 0 && R.x >= lineX) || (R.dir < 0 && R.x <= lineX)) {
    R.x = lineX;
    // çizgiye vardın: bip'e göre zamanında mı?
    const dl = deadlineOf(R.n);
    const late = R.t > dl + 0.05;
    R.n++;
    R.turns++;
    if (!late) {
      R.warnings = 0;
      R.events.push({ type: 'line', early: dl - R.t });
    }
    // dönüş: zamanında DÖN → hızlı, yoksa fren + dönüş
    if (R.armed) {
      R.turning = 0.28;
      R.v *= 0.35;
      R.perfectTurns++;
      R.events.push({ type: 'turn', perfect: true });
    } else {
      R.turning = 0.5 + 0.07 * R.v;
      R.v = 0;
      R.events.push({ type: 'turn', perfect: false });
    }
    R.armed = false;
    // erken vardıysan bir sonraki mekiğe bip'le çık
    R.leaveAt = late ? 0 : dl;
    R.events.push({ type: 'level', n: R.n });
  }
}

/** Sonuç: ulaşılan seviye (tamamlanan mekik), hedefle kıyas. */
export function shuttleResult(R) {
  const level = R.n / SHUTTLES_PER_LEVEL; // ör. 6.5 = 6. seviye bitti + yarısı
  const reached = levelOf(Math.max(0, R.n - 1));
  const success = reached >= R.P.targetLevel && R.n >= R.P.targetLevel * SHUTTLES_PER_LEVEL;
  return {
    success,
    accuracy: success ? clamp(0.5 + (level - R.P.targetLevel) / 4, 0, 1) : 0,
    outcome: success ? 'pass' : R.overReason === 'late' ? 'late' : 'fail',
    level: levelLabel(R.n),
    shuttles: R.n,
    target: R.P.targetLevel,
    gassed: R.gassed || R.breath < 5,
    perfectTurns: R.perfectTurns,
    turns: R.turns,
  };
}

/**
 * Simülasyon (testler/ayar): policy(R) → {hold:boolean, turn:boolean}. Hedefin 3 seviye ötesinde ya da elenince biter.
 */
export function simulateShuttle(P, policy, { dt = 1 / 60, maxLevel = null } = {}) {
  const R = createShuttle(P);
  const stopAt = (maxLevel ?? P.targetLevel + 3) * SHUTTLES_PER_LEVEL;
  while (!R.over && R.n < stopAt && R.t < 400) {
    const a = policy(R);
    setHold(R, a.hold);
    if (a.turn) pressTurn(R);
    shuttleStep(R, dt);
    R.events.length = 0;
  }
  return { R, res: shuttleResult(R) };
}

/** İyi koşucu: bip'e yetişecek kadar koş (hayalet koşucunun önünde kal), çizgiye yaklaşınca DÖN. */
export function pacedShuttlePolicy(R) {
  const P = R.P;
  const lineX = R.dir > 0 ? SHUTTLE_M : 0;
  const left = Math.abs(lineX - R.x);
  const dl = deadlineOf(R.n);
  const timeLeft = dl - R.t;
  const need = left / Math.max(0.1, timeLeft - 0.4);
  return { hold: R.v < need * 1.08 || timeLeft < 0.6, turn: left < P.turnWindow * 0.7 };
}
