// KAFA DÜELLOSU MANTIĞI (saf; Node testlerinde çalışır)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Kafa düellosu sonucu (saf): zamanlama hatası (sn), konum hatası (m), markaj mesafesi (m), yetenek */
export function headerContest({ dt = 0, dist = 0, defDist = 3, skill = 0.5, rnd = Math.random }) {
  if (dist > 1.5) return { won: false, why: 'far' };
  if (Math.abs(dt) > 0.42) return { won: false, why: dt < 0 ? 'early' : 'late' };
  const timing = 1 - Math.abs(dt) / 0.42;
  const pos = 1 - dist / 1.5;
  const press = clamp((1.2 - defDist) / 1.2, 0, 1);
  const p = clamp(0.2 + skill * 0.45 + timing * 0.3 + pos * 0.2 - press * 0.45, 0.05, 0.96);
  return { won: rnd() < p, p, timing, pos, press, why: 'duel' };
}

