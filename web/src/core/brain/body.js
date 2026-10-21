// @ts-check
// BEDEN — boy, kilo, kas kütlesi ve yağ oranı. Kod "kas +1" demez: her hafta vücuda giren ve harcanan enerji,
// salondaki uyarı (halter/dambıl), protein, uyku, stres, yaş ve genetik birlikte hesaplanır.
//   • Kas: uyarı × protein × toparlanma × enerji dengesi × yaş × genetik tavana kalan pay. Çalışmayan kas erir;
//     sakatlıkta hareketsizlik kas kaybettirir.
//   • Yağ: haftalık kalori fazlası / açığı (7700 kcal ≈ 1 kg yağ). Antrenman, maç dakikası ve salon yakar;
//     takım yemeği, gece hayatı ve serbest beslenme ekler. 27 yaşından sonra metabolizma yavaşlar.
//   • Boy: 21 yaşına kadar genetik hedefe doğru uzar.
// Sahaya etkisi: yağ fazlası hızı ve dayanıklılığı düşürür, sakatlığı artırır; kas ikili mücadele, kafa ve şut
// gücünü artırır ama aşırı hacim hızı keser; boy hava toplarında avantaj.
import { clamp, gaussian, rand, round1 } from '../rng.js';

/** Mevkiye göre başlangıç (yetişkin boyu hedef) */
const BASE = { FW: { h: 180, bmi: 22.4, fat: 11.5 }, MF: { h: 177, bmi: 22.1, fat: 11 }, DF: { h: 185, bmi: 22.9, fat: 12 } };
const SMM_SHARE = 0.54; // yağsız kütlenin kas payı (sporcu)
const KCAL_PER_KG_FAT = 7700;
/** Ortalama bir hafta (2 antrenman, 1 maç, 1 salon) dengeli beslenmede kalori dengesi sıfır */
const NEUTRAL_BURN = 2 * 450 + 990 + 300;

/** Beslenme planları (günlük kalori farkı, protein çarpanı, haftalık ücret, moral) */
export const DIETS = {
  balanced: { id: 'balanced', name: 'Dengeli', icon: '🥗', kcal: 0, protein: 1, cost: 0, morale: 0, desc: 'Kulüp yemekhanesi. Kiloyu korur.' },
  protein: { id: 'protein', name: 'Yüksek protein', icon: '🍗', kcal: 180, protein: 1.3, cost: 90, morale: 0, desc: 'Kas yapımını hızlandırır; salonla birlikte işe yarar.' },
  cut: { id: 'cut', name: 'Yağ yakımı', icon: '🥦', kcal: -480, protein: 1.05, cost: 70, morale: -1, desc: 'Kalori açığı: yağ hızla gider, kas yapımı yavaşlar, biraz huysuz olursun.' },
  free: { id: 'free', name: 'Serbest', icon: '🍔', kcal: 560, protein: 0.8, cost: 0, morale: 1, desc: 'Ne canın isterse. Moral iyi, bel çevresi değil.' },
  chef: { id: 'chef', name: 'Kişisel şef', icon: '👨‍🍳', kcal: 0, protein: 1.3, cost: 650, morale: 1, desc: 'Şef kaloriyi hedefine göre ayarlar: yağ %10 civarına iner, kas yapımı hızlanır.', minWage: 3000 },
};
export const DIET_IDS = Object.keys(DIETS);

/** Salon istasyonlarının yaktığı kalori ve kas uyarısı */
const GYM_BURN = { barbell: 300, dumbbell: 260, treadmill: 520, stretch: 60 };
const GYM_STIM = { barbell: 1, dumbbell: 0.75, treadmill: 0.1, stretch: 0 };
/** Dışarıda yemek / gece: kalori */
export const EXTRA_KCAL = { team: 500, cafe: 250, bar: 900, home: 1000, party: 1300, dinner: 500 };

const hm2 = (b) => (b.height / 100) ** 2;
export const weightOf = (b) => b.muscle + b.lean + b.fat;
export const fatPctOf = (b) => (b.fat / weightOf(b)) * 100;
/** Kas indeksi: kas (kg) / boy² — futbolcuda ~10–11 */
export const muscleIndex = (b) => b.muscle / hm2(b);
/** Genetik kas tavanı */
export const muscleCap = (b) => b.frame * 13.4 * hm2(b);

/** Yeni oyuncunun bedeni (17 yaş: hâlâ uzuyor) */
export function createBody(position = 'FW', age = 17) {
  const base = BASE[position] || BASE.FW;
  const target = round1(base.h + clamp(gaussian() * 4, -9, 9));
  const height = round1(age >= 21 ? target : target - rand(1.2, 3.2));
  const w0 = (base.bmi + clamp(gaussian() * 0.7, -1.6, 1.6)) * (height / 100) ** 2 - (age < 19 ? 1.5 : 0);
  const fatPct = clamp(base.fat + rand(-1.5, 2), 7, 16);
  const fat = (w0 * fatPct) / 100;
  const ffm = w0 - fat;
  const muscle = ffm * SMM_SHARE;
  return {
    height,
    heightTarget: target,
    muscle: round2(muscle),
    lean: round2(ffm - muscle), // kemik, organ, su
    fat: round2(fat),
    fat0: round2(fat), // doğal yağ ayar noktası
    muscle0: round2(muscle),
    frame: round2(clamp(1 + gaussian() * 0.05, 0.9, 1.1)), // kas genetiği
    metab: round2(clamp(1 + gaussian() * 0.04, 0.92, 1.08)), // metabolizma
    hist: [],
  };
}

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Haftalık fizyoloji. w: haftanın defteri (brain.week), ctx: { age, diet, sleep, stress, injured, gymQ, traits, nutrition }
 * @returns {{dMuscle:number, dFat:number, dHeight:number, surplus:number, burn:number, stimulus:number}}
 */
export function bodyOnWeek(b, w, ctx) {
  const diet = DIETS[ctx.diet] || DIETS.balanced;
  const age = ctx.age || 20;
  // ── enerji dengesi ──
  const gymBurn = (w.gym || []).reduce((n, g) => n + (GYM_BURN[g.station] || 0) * (0.7 + 0.3 * (g.q ?? 0.6)), 0);
  const burn = (450 * (w.train || 0) + 250 * (w.drill || 0) + gymBurn + 11 * (w.minutes || 0)) * b.metab;
  let dietKcal = diet.kcal;
  if (diet.id === 'chef') {
    // şef hedefe göre ayarlar: yağ %10'a
    const fp = fatPctOf(b);
    dietKcal = fp > 11 ? -360 : fp < 9 ? 200 : 0;
  }
  if (ctx.nutrition && diet.id === 'free') dietKcal *= 0.8; // beslenme koçu serbesti biraz frenler
  const extras = w.kcal || 0;
  const ageTerm = Math.max(0, age - 27) * 22 * 7;
  const surplus = dietKcal * 7 + extras - (burn - NEUTRAL_BURN) + ageTerm + rand(-250, 250);
  // vücut uyum sağlar (metabolizma, gündelik hareket): fazlanın ancak bir kısmı yağa döner; yağ, kişinin doğal
  // ayar noktasından uzaklaştıkça geri çekilir (kilo alınca daha çok yakarsın, verince iştah artar)
  const setPoint = b.fat0 ?? b.fat;
  const effective = surplus * 0.4 - (b.fat - setPoint) * 330;

  // ── kas ──
  const S = (w.gym || []).reduce((n, g) => n + (GYM_STIM[g.station] || 0) * (0.55 + 0.45 * (g.q ?? 0.6)), 0) + (w.train || 0) * 0.04 + ((w.minutes || 0) / 90) * 0.06 + (w.extraStim || 0);
  const stimulus = 1 - Math.exp(-S / 1.1);
  const protein = diet.protein * (ctx.nutrition ? 1.1 : 1);
  const sleep = ctx.sleep ?? 7.8;
  const stress = ctx.stress ?? 25;
  const recovery = clamp(0.55 + (sleep - 5) * 0.17, 0.6, 1.08) * (stress > 60 ? 1 - (stress - 60) / 200 : 1);
  const energy = surplus >= 0 ? 1 + Math.min(0.25, surplus / 14000) : 1 - Math.min(0.45, -surplus / 9000);
  const ageMult = age <= 20 ? 1.1 : age <= 27 ? 1 : age <= 31 ? 0.8 : 0.6;
  const cap = muscleCap(b);
  const room = clamp((cap - b.muscle) / (cap * 0.25), 0, 1);
  let dMuscle = 0.1 * stimulus * protein * recovery * energy * ageMult * room * (ctx.gymQ || 1) * (ctx.muscleMult || 1);
  // gençlikte doğal olgunlaşma (iskelet ve kas büyür)
  if (!ctx.injured) dMuscle += (age <= 20 ? 0.025 : age <= 24 ? 0.008 : 0) * room;
  // çalışmayan kas erir (yaşla hızlanır); sakatlıkta hareketsizlik
  if (S < 0.15) dMuscle -= 0.035 * (age > 30 ? 1.5 : 1) * (ctx.lossMult || 1);
  if (ctx.injured) dMuscle -= 0.09 * (ctx.lossMult || 1);
  if (surplus < -3000) dMuscle -= 0.02;
  const floor = (b.muscle0 || b.muscle) * 0.85;
  const m0 = b.muscle;
  b.muscle = round2(clamp(b.muscle + dMuscle, floor, cap));
  dMuscle = b.muscle - m0;

  // ── yağ ──
  const f0 = b.fat;
  const toFat = (effective - Math.max(0, dMuscle) * 2500) / KCAL_PER_KG_FAT;
  const wt = weightOf(b);
  b.fat = round2(clamp(b.fat + toFat, wt * 0.05, wt * 0.32));
  const dFat = b.fat - f0;

  // ── boy (21 yaşına kadar) ──
  let dHeight = 0;
  if (age < 21 && b.height < b.heightTarget) {
    const h0 = b.height;
    b.height = Math.round(Math.min(b.heightTarget, b.height + (b.heightTarget - b.height) * (age <= 18 ? 0.02 : 0.012)) * 100) / 100;
    dHeight = b.height - h0;
    b.lean = round2(b.lean * (b.height / h0) ** 2); // iskelet büyür
  }
  return { dMuscle, dFat, dHeight, surplus: Math.round(surplus), burn: Math.round(burn), stimulus };
}

/** Haftalık ölçüm geçmişi (grafik) */
export function recordBody(b, key, cap = 60) {
  const row = { k: key, w: round1(weightOf(b)), m: round1(b.muscle), f: round1(fatPctOf(b)), h: round1(b.height) };
  if (b.hist.at(-1)?.k === key) b.hist[b.hist.length - 1] = row;
  else b.hist.push(row);
  if (b.hist.length > cap) b.hist.splice(0, b.hist.length - cap);
}

/**
 * Bedenin sahaya etkileri (çarpanlar)
 * speed: çalım/hücum/hız · power: ikili mücadele, şut gücü · aerial: kafa topu · fatigue: maç içi yorulma hızı · injury: sakatlık
 */
export function bodyFx(b) {
  if (!b) return { mi: 10.3, fat: 11, speed: 1, power: 1, aerial: 1, fatigue: 1, injury: 1, excess: 0, lean: 0, bulk: 0 };
  const mi = muscleIndex(b);
  const fat = fatPctOf(b);
  const excess = Math.max(0, fat - 13);
  const lean = Math.max(0, 7 - fat);
  const bulk = Math.max(0, mi - 11.8);
  const power = 1 + clamp((mi - 10.3) * 0.035, -0.06, 0.08);
  return {
    mi,
    fat,
    excess,
    lean,
    bulk,
    speed: clamp(1 - excess * 0.011 - bulk * 0.03, 0.82, 1.02),
    power,
    aerial: clamp(1 + (b.height - 180) * 0.0025 + (power - 1) * 0.5, 0.94, 1.08),
    fatigue: clamp(1 + excess * 0.015 + bulk * 0.03 + lean * 0.01, 1, 1.3),
    injury: clamp(1 + excess * 0.018 + lean * 0.05 + bulk * 0.04, 1, 1.4),
  };
}

/** Vücut tipi etiketi */
export function bodyType(b) {
  const fx = bodyFx(b);
  if (fx.fat >= 18) return { id: 'heavy', name: 'Kilolu', tone: 'bad' };
  if (fx.fat >= 14.5) return { id: 'soft', name: 'Hafif kilolu', tone: 'warn' };
  if (fx.mi >= 11.6 && fx.fat < 12) return { id: 'muscular', name: 'Kaslı', tone: 'good' };
  if (fx.mi >= 10.9 && fx.fat < 12.5) return { id: 'athletic', name: 'Atletik', tone: 'good' };
  if (fx.mi < 9.7 && fx.fat < 10.5) return { id: 'slim', name: 'Zayıf', tone: 'info' };
  return { id: 'fit', name: 'Formda', tone: 'info' };
}

/** Piksel oyuncu için gövde tipi */
export function spriteBuild(b) {
  if (!b) return null;
  const fx = bodyFx(b);
  if (fx.fat >= 16) return 'heavy';
  if (fx.mi >= 11.3 && fx.fat < 13.5) return 'muscular';
  return null;
}

/** BMI */
export const bmiOf = (b) => weightOf(b) / hm2(b);
