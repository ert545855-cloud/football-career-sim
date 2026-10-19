// REKLAM ÇEKİMİ — saf mantık. Yönetmen bir poz ister; dört poz düğmesinden doğrusuna süre dolmadan bas.
// Ne kadar çabuk ve doğru poz verirsen çekim o kadar iyi. Her çekimde süre kısalır. Çekim sayısı: 6.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const POSES = [
  { id: 'cheer', name: 'Yumruklar havaya', call: 'Zafer pozu! Yumruklar havaya!', frame: 'cheer' },
  { id: 'cross', name: 'Kollar bağlı', call: 'Kendinden emin: kollar bağlı!', frame: 'cross' },
  { id: 'point', name: 'Kameraya göster', call: 'Kameraya göster, bize bak!', frame: 'point' },
  { id: 'clap', name: 'Alkışla', call: 'Taraftarı alkışla!', frame: 'clap' },
  { id: 'ready', name: 'Kollar yukarı', call: 'Kollar yukarı, enerji!', frame: 'ready' },
  { id: 'kick', name: 'Topa vur', call: 'Topa vur, aksiyon!', frame: 'kick' },
  { id: 'product', name: 'Ürünü göster', call: 'Ürünü kameraya göster!', frame: 'pointL' },
];
export const POSE_BY_ID = Object.fromEntries(POSES.map((p) => [p.id, p]));
export const SHOOT = { takes: 6, callT: 0.9, flashT: 0.45, reviewT: 0.85 };

/** skill 0–1 (imaj/ün): ilk pencere uzunluğu */
export function shootParams(skill = 0.4) {
  const s = clamp(skill, 0, 1);
  return { window0: 2.5 + s * 0.6, windowMin: 1.15 + s * 0.3 };
}

export function createShoot(P, rnd = Math.random, { product = true } = {}) {
  const pool = POSES.filter((p) => product || p.id !== 'product');
  const takes = [];
  let last = null;
  for (let i = 0; i < SHOOT.takes; i++) {
    let pose;
    do pose = pool[Math.floor(rnd() * pool.length)]; while (pose.id === last);
    last = pose.id;
    const others = pool.filter((p) => p.id !== pose.id).sort(() => rnd() - 0.5).slice(0, 3);
    const options = [pose, ...others].sort(() => rnd() - 0.5).map((p) => p.id);
    const window = P.window0 - (P.window0 - P.windowMin) * (i / (SHOOT.takes - 1));
    takes.push({ pose: pose.id, options, window, picked: null, points: 0, verdict: null, at: 0 });
  }
  return { P, takes, i: 0, t: 0, phase: 'call', done: false };
}

export const currentTake = (S) => S.takes[S.i];

export function shootStep(S, dt) {
  if (S.done) return;
  S.t += dt;
  const tk = currentTake(S);
  if (S.phase === 'call' && S.t >= SHOOT.callT) { S.phase = 'pick'; S.t = 0; }
  else if (S.phase === 'pick' && S.t >= tk.window) { tk.verdict = 'late'; tk.points = 0; S.phase = 'flash'; S.t = 0; }
  else if (S.phase === 'flash' && S.t >= SHOOT.flashT) { S.phase = 'review'; S.t = 0; }
  else if (S.phase === 'review' && S.t >= SHOOT.reviewT) {
    if (S.i >= S.takes.length - 1) { S.done = true; return; }
    S.i += 1; S.phase = 'call'; S.t = 0;
  }
}

/** Poz seç. @returns 'perfect'|'good'|'wrong'|null */
export function shootPick(S, poseId) {
  if (S.done || S.phase !== 'pick') return null;
  const tk = currentTake(S);
  tk.picked = poseId;
  tk.at = S.t;
  if (poseId !== tk.pose) { tk.verdict = 'wrong'; tk.points = 0; }
  else {
    const speed = 1 - S.t / tk.window;
    tk.points = 0.45 + 0.55 * speed;
    tk.verdict = speed > 0.55 ? 'perfect' : 'good';
  }
  S.phase = 'flash';
  S.t = 0;
  return tk.verdict;
}

export function shootResult(S) {
  const pts = S.takes.reduce((n, t) => n + t.points, 0);
  const q = clamp(pts / S.takes.length, 0, 1);
  const good = S.takes.filter((t) => t.verdict === 'perfect' || t.verdict === 'good').length;
  const perfect = S.takes.filter((t) => t.verdict === 'perfect').length;
  return { q, good, perfect, score: Math.round(q * 100), label: `${good}/${S.takes.length} kare · ${perfect} mükemmel` };
}
