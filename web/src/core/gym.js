// SPOR SALONU — halter, dambıl, koşu bandı ve esneme. İki fiziksel değer üretir:
//   Kondisyon (cond 0–100): maç içi yorulma hızı, oyundan alınma riski, sakatlık riski.
//   Güç (power 0–100): ikili mücadele (top kapma), kafa topu ve şut sertliği.
// İkisi de çalışılmazsa haftalık düşer (yaşla daha hızlı). Ağır seans kas ağrısı (sore) bırakır:
// maç gününe ağrıyla çıkarsan biraz daha erken yorulursun ve sakatlık riski artar → zamanlama önemli.
import { clamp } from './rng.js';
import { addProgress, changeEnergy } from './player.js';
import { CLUB_BY_ID } from './data.js';
import { clubRating } from './league.js';

export const GYM_RULES = { maxPerWeek: 2, condStart: 58, powerStart: 42, floorCond: 25, floorPower: 15 };

/** İstasyonlar: energy = enerji bedeli, sore = kas ağrısı */
export const GYM_STATIONS = {
  barbell: {
    id: 'barbell', name: 'Halter', full: 'Halter · Squat', energy: 14, sore: 30,
    desc: 'Bacak ve gövde gücü. İkili mücadele, kafa topu ve şut sertliği.',
    how: 'Bar inerken güç göstergesi döner. Ok yeşil bölgedeyken bas: bar kalkar. Her sette ağırlık artar, iki kaçırış seti bitirir.',
    gains: 'Güç ++ · Hız +',
  },
  dumbbell: {
    id: 'dumbbell', name: 'Dambıl', full: 'Dambıl · Biceps', energy: 10, sore: 18,
    desc: 'Üst vücut gücü ve denge. Omuz omuza mücadelede ayakta kalırsın.',
    how: 'Ritme uy: ışık yanan koldaki SOL ya da SAĞ düğmeye vuruşta bas. Yanlış kol ya da geç basış seriyi bozar.',
    gains: 'Güç + · Kondisyon + · Defans +',
  },
  treadmill: {
    id: 'treadmill', name: 'Koşu Bandı', full: 'Koşu Bandı · İnterval', energy: 16, sore: 15,
    desc: 'Aralıklı koşu programı. Kondisyon ve dayanıklılık.',
    how: 'SOL-SAĞ düğmelerine sırayla basarak adım at. Bant hızlanınca sen de hızlan: yeşil bölgede kal, geri kayarsan banttan düşersin.',
    gains: 'Kondisyon ++ · Dayanıklılık +',
  },
  stretch: {
    id: 'stretch', name: 'Esneme', full: 'Esneme · Mobilite', energy: 0, sore: -40,
    desc: 'Köpük rulo ve esneme. Kas ağrısını alır, 2 hafta sakatlık riskini azaltır.',
    how: '', gains: 'Ağrı −40 · Sakatlık riski −%15 (2 hf)', noGame: true,
  },
};

export function ensureGym(state) {
  const g = state.gym || (state.gym = {});
  g.cond ??= GYM_RULES.condStart;
  g.power ??= GYM_RULES.powerStart;
  g.sore ??= 0;
  g.stretchWeeks ??= 0;
  g.total ||= 0;
  g.best ||= {};
  g.log ||= [];
  const key = `${state.calendar?.season || 1}-${state.calendar?.week || 1}`;
  if (g.weekKey !== key) { g.weekKey = key; g.week = 0; }
  return g;
}

export const condOf = (state) => (state?.gym ? state.gym.cond : GYM_RULES.condStart);
export const powerOf = (state) => (state?.gym ? state.gym.power : GYM_RULES.powerStart);

/** Maç içi yorulma çarpanı: kondisyon 100 → %13 daha yavaş yorulur, 25 → %12 daha hızlı */
export const condFatigueMult = (cond = GYM_RULES.condStart) => clamp(1 + (60 - cond) / 300, 0.85, 1.15);
/** Maç gününe kalan kas ağrısı: yorgunluğa eklenir */
export const soreFatigue = (state) => Math.max(0, (state?.gym?.sore || 0) - 20) / 900;

/** Sakatlık riski çarpanı: düşük kondisyon, kas ağrısı; esneme korur */
export function gymInjuryMult(state) {
  const g = state?.gym;
  if (!g) return 1;
  let m = clamp(1 + (55 - g.cond) / 220, 0.82, 1.2);
  if (g.sore > 45) m *= 1.15;
  if (g.stretchWeeks > 0) m *= 0.85;
  return m;
}

/** Maç anında etkin yetenek çarpanı: güç ikili mücadeleye, kafa topuna ve şuta; kondisyon çalım/hücuma */
export function gymSkillMult(state, type, context) {
  const g = state?.gym;
  if (!g) return 1;
  const pw = g.power - GYM_RULES.powerStart;
  const cd = g.cond - GYM_RULES.condStart;
  if (type === 'tackle') return 1 + pw / 700;
  if (type === 'shot' && context === 'corner') return 1 + pw / 600;
  if (type === 'shot') return 1 + pw / 1500;
  if (type === 'dribble' || type === 'attack') return 1 + cd / 800;
  return 1;
}

/** Arayüz için etkiler (yüzde) */
export function gymEffects(state) {
  const g = ensureGym(state);
  return {
    fatigue: Math.round((condFatigueMult(g.cond) - 1) * 100), // − iyi
    injury: Math.round((gymInjuryMult(state) - 1) * 100),
    tackle: Math.round((gymSkillMult(state, 'tackle') - 1) * 100),
    header: Math.round((gymSkillMult(state, 'shot', 'corner') - 1) * 100),
    shot: Math.round((gymSkillMult(state, 'shot', 'box') - 1) * 1000) / 10,
    sore: Math.round(g.sore),
  };
}

/** Kulüp tesisinin kalitesi (0.9–1.1) + evdeki özel salon + kendi spor salonu işletmen */
export function gymQuality(state) {
  const r = state.world ? clubRating(state.world, state.career.clubId) : 50;
  let q = 0.9 + clamp((r - 30) / 50, 0, 1) * 0.2;
  if ((state.career?.items || []).includes('villa')) q += 0.06;
  if ((state.business?.list || []).some((b) => b.type === 'gym' && !b.closed)) q += 0.08;
  if ((state.career?.items || []).includes('coach')) q += 0.1; // kişisel antrenör
  return Math.round(q * 100) / 100;
}

export const gymName = (state) => {
  const club = CLUB_BY_ID[state.career?.clubId];
  return club ? `${club.short} Kuvvet Salonu` : 'Kulüp Spor Salonu';
};

/** Salon seansı yapılabilir mi */
export function canGym(state, station) {
  const g = ensureGym(state);
  const st = GYM_STATIONS[station];
  if (!st) return { ok: false, reason: 'Böyle bir istasyon yok.' };
  if (state.calendar.phase !== 'week') return { ok: false, reason: 'Sezon arası.' };
  if (state.calendar.slots <= 0) return { ok: false, reason: 'Bu haftaki tüm zamanını kullandın. Maç gününe geç.' };
  if (state.flags?.injuredWeeks > 0 && station !== 'stretch') return { ok: false, reason: 'Sakatsın: yalnızca esneme yapabilirsin.' };
  if (!st.noGame && g.week >= GYM_RULES.maxPerWeek) return { ok: false, reason: `Haftada en fazla ${GYM_RULES.maxPerWeek} ağırlık/kardiyo seansı. Fazlası sakatlık getirir.` };
  if (state.player.energy < st.energy) return { ok: false, reason: 'Enerjin çok düşük. Önce dinlen.' };
  return { ok: true };
}

const dim = (v) => clamp(1 - v / 140, 0.15, 1); // değer yükseldikçe kazanç azalır

/**
 * Seansı uygular. q: mini oyun başarısı 0..1 (esnemede yok sayılır).
 * @returns {{ok:boolean, text?:string, cond:number, power:number, dCond:number, dPower:number, sore:number, record?:boolean, stat?:string}}
 */
export function finishGym(state, station, q = 0, detail = {}) {
  const chk = canGym(state, station);
  if (!chk.ok) return { ok: false, text: chk.reason };
  const g = ensureGym(state);
  const st = GYM_STATIONS[station];
  const p = state.player;
  q = clamp(q, 0, 1);
  const Q = gymQuality(state);
  const F = clamp(0.55 + p.energy / 160, 0.6, 1.15); // yorgunken verim düşük
  const age = p.age > 30 ? 0.8 : p.age < 21 ? 1.1 : 1;
  const c0 = g.cond;
  const p0 = g.power;
  let stat = null;
  if (station === 'barbell') {
    g.power += (1.4 + 3 * q) * Q * F * age * dim(g.power);
    g.cond += 0.4 * q * Q;
    addProgress(p, 'speed', 0.14 * q * Q);
    stat = 'speed';
  } else if (station === 'dumbbell') {
    g.power += (1 + 2 * q) * Q * F * age * dim(g.power);
    g.cond += 0.9 * q * Q * dim(g.cond);
    addProgress(p, 'defending', 0.12 * q * Q);
    stat = 'defending';
  } else if (station === 'treadmill') {
    g.cond += (2 + 4.6 * q) * Q * F * age * dim(g.cond);
    addProgress(p, 'stamina', 0.32 * q * Q);
    stat = 'stamina';
  } else if (station === 'stretch') {
    g.stretchWeeks = 2;
    g.cond += 0.4;
    changeEnergy(p, 4);
  }
  g.cond = clamp(g.cond, 0, 100);
  g.power = clamp(g.power, 0, 100);
  g.sore = clamp(g.sore + st.sore * (station === 'stretch' ? 1 : 0.6 + q * 0.4), 0, 100);
  if (st.energy) changeEnergy(p, -st.energy);
  if (!st.noGame) g.week += 1;
  g.total += 1;
  state.calendar.slots -= 1;
  // rekor
  let record = false;
  const score = detail.score ?? Math.round(q * 100);
  if (!st.noGame && score > (g.best[station]?.score || 0)) {
    record = !!g.best[station];
    g.best[station] = { score, label: detail.label || `%${Math.round(q * 100)}`, s: state.calendar.season, w: state.calendar.week };
  }
  g.log.unshift({ s: state.calendar.season, w: state.calendar.week, station, q: Math.round(q * 100) });
  if (g.log.length > 10) g.log.length = 10;
  return { ok: true, cond: g.cond, power: g.power, dCond: g.cond - c0, dPower: g.power - p0, sore: g.sore, record, stat, quality: Q };
}

/** Dinlen aksiyonu kas ağrısını azaltır */
export function gymOnRest(state) {
  if (state.gym) state.gym.sore = Math.max(0, state.gym.sore - 20);
}

/** Maç: oynadıysan maç kondisyonu korunur; ağır maç ağrı bırakır */
export function gymOnMatch(state, summary) {
  const g = ensureGym(state);
  if (summary?.played) {
    g.cond = clamp(g.cond + 0.8, 0, 100);
    g.sore = clamp(g.sore + 10, 0, 100);
  }
}

/** Hafta sonu: kondisyon ve güç çalışılmazsa düşer, ağrı geçer */
export function gymOnWeek(state, { trainings = 0 } = {}) {
  const g = ensureGym(state);
  const p = state.player;
  const agePen = p.age >= 33 ? 1.2 : p.age >= 30 ? 0.6 : 0;
  const worked = g.week > 0;
  g.cond = Math.max(GYM_RULES.floorCond, g.cond - (2.2 + agePen) + trainings * 0.35);
  if (!worked) g.power = Math.max(GYM_RULES.floorPower, g.power - (0.8 + agePen * 0.5));
  g.sore = Math.max(0, g.sore - 38);
  if (g.stretchWeeks > 0) g.stretchWeeks -= 1;
  // yeni haftanın sayacı ensureGym'de sıfırlanır (weekKey)
}

/** Yaz kampı kondisyon odağı */
export function gymOnCamp(state, focus) {
  const g = ensureGym(state);
  if (focus === 'fitness') { g.cond = clamp(g.cond + 12, 0, 100); g.power = clamp(g.power + 3, 0, 100); }
  else g.cond = clamp(g.cond + 4, 0, 100);
}
