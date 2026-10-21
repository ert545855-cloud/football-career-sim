// @ts-check
// ALIŞKANLIKLAR → ÖZELLİKLER. Beyin her haftanın davranışını hafızasına yazar (üstel ortalama: son haftalar
// daha ağır basar). Bir davranış yerleşince kendiliğinden bir özelliğe dönüşür (Salon Tutkunu, Gece Kuşu…);
// bırakılınca zamanla kaybolur (eşikler arasında boşluk var: bir haftalık sapma özelliği silmez).
// Deneyimden doğan özellikler de var: büyük maç anıları, penaltılar, uzun sakatlık.
import { clamp, round1 } from '../rng.js';

export const HABIT_KEYS = ['gym', 'train', 'rest', 'party', 'social', 'media', 'junk', 'late'];
const ALPHA = 0.22;

export function createHabits() {
  return { gym: 0.6, train: 2, rest: 1, party: 0, social: 0.4, media: 0.5, junk: 0, late: 0, weeks: 0 };
}

/** Haftanın davranışını hafızaya yazar. Sakatken antrenman/salon alışkanlığı donar (ceza değil). */
export function habitsOnWeek(h, w, { injured = false, diet = 'balanced', sleep = 7.8 } = {}) {
  const m = {
    gym: (w.gym || []).filter((g) => g.station !== 'stretch').length,
    train: (w.train || 0) + (w.drill || 0) * 0.5,
    rest: w.rest || 0,
    party: (w.party || 0) + (w.outBar || 0),
    social: (w.team || 0) + (w.outings || 0) - (w.outBar || 0) * 0.5,
    media: (w.media || 0) + (w.posts || 0) * 0.3 + (w.sponsor || 0) * 0.5,
    junk: (diet === 'free' ? 1 : 0) + (w.party || 0) * 0.3,
    late: sleep < 7 ? 1 : 0,
  };
  for (const k of HABIT_KEYS) {
    if (injured && (k === 'gym' || k === 'train')) continue;
    h[k] = round2(h[k] + (m[k] - h[k]) * ALPHA);
  }
  h.weeks = (h.weeks || 0) + 1;
  return m;
}
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Özellikler. on/off: alışkanlık (h) ve deneyim (x: anı sayıları) üzerinden; fx: etkiler; how: nasıl oluştuğu.
 * fx anahtarları: muscle (kas gelişimi ×), loss (kas kaybı ×), train (antrenman ×), injury (sakatlık ×),
 *   sleep (+saat), focus (+), social (ihtiyaç artışı +), big/pen/tackle (maç anı ×), rel/persona/fame/morale (haftalık)
 */
export const TRAITS = {
  gymrat: {
    name: 'Salon Tutkunu', icon: '🏋️', tone: 'good',
    on: (h) => h.gym >= 1.45, off: (h) => h.gym <= 0.9,
    fx: { muscle: 1.15, sore: 1.2 }, desc: 'Kas gelişimi +%15 · ağrılar daha çabuk geçer',
    how: (h) => `Son haftalarda haftada ortalama ${fmt(h.gym)} salon seansı yaptın.`,
  },
  workhorse: {
    name: 'Çalışkan', icon: '🔨', tone: 'good',
    on: (h) => h.train >= 2.45, off: (h) => h.train <= 1.8,
    fx: { train: 1.05, rel: { manager: 0.3 } }, desc: 'Antrenman verimi +%5 · hoca seni sever',
    how: (h) => `Haftada ortalama ${fmt(h.train)} antrenman: tesise ilk gelen sensin.`,
  },
  nightowl: {
    name: 'Gece Kuşu', icon: '🌙', tone: 'bad',
    on: (h) => h.party >= 0.6, off: (h) => h.party <= 0.25,
    fx: { sleep: -0.5, focus: -6, morale: 1, persona: { professionalism: -0.2 } }, desc: 'Uyku −0,5 saat · odak −6 · moral +1/hf · profesyonellik eriyor',
    how: (h) => `Gece hayatı rutinin oldu (haftada ${fmt(h.party)} gece).`,
  },
  couch: {
    name: 'Rahatına Düşkün', icon: '🛋️', tone: 'bad',
    on: (h) => h.train <= 1.2 && h.gym <= 0.3 && h.rest >= 1.6, off: (h) => h.train >= 2 || h.gym >= 0.8,
    fx: { loss: 1.4, rel: { manager: -0.4 } }, desc: 'Kas daha hızlı erir · hoca hoşnutsuz',
    how: (h) => `Antrenman az (haftada ${fmt(h.train)}), dinlenme çok (${fmt(h.rest)}).`,
  },
  socialite: {
    name: 'Sosyal Kelebek', icon: '🦋', tone: 'good',
    on: (h) => h.social >= 1.1, off: (h) => h.social <= 0.6,
    fx: { social: -4, focus: -3, rel: { teammates: 0.4 } }, desc: 'Takım arkadaşları +0,4/hf · yalnızlık hissetmezsin · odak −3',
    how: (h) => `Haftada ortalama ${fmt(h.social)} kez takımla ya da arkadaşlarla vakit geçirdin.`,
  },
  lonewolf: {
    name: 'Yalnız Kurt', icon: '🐺', tone: 'info',
    on: (h) => h.social <= 0.12 && (h.weeks || 0) >= 8, off: (h) => h.social >= 0.4,
    fx: { focus: 4, social: 3, rel: { teammates: -0.2 } }, desc: 'Odak +4 · takımdan kopuyorsun',
    how: () => 'Haftalardır takım arkadaşlarınla dışarıda vakit geçirmedin.',
  },
  spotlight: {
    name: 'Kamera Aşığı', icon: '📸', tone: 'info',
    on: (h) => h.media >= 1.1, off: (h) => h.media <= 0.5,
    fx: { focus: -4, fame: 0.15 }, desc: 'Ün +0,15/hf · odak −4',
    how: (h) => `Medya, reklam ve paylaşımlar haftanın büyük kısmı (${fmt(h.media)}).`,
  },
  foodie: {
    name: 'Fast Food Sevdalısı', icon: '🍔', tone: 'bad',
    on: (h) => h.junk >= 0.6, off: (h) => h.junk <= 0.25,
    fx: { morale: 1 }, desc: 'Moral +1/hf · kalori fazlası beline gidiyor',
    how: () => 'Serbest beslenme ve gece atıştırmaları alışkanlığa döndü.',
  },
  monk: {
    name: 'Temiz Yaşam', icon: '🧘', tone: 'good',
    on: (h) => h.party <= 0.05 && h.late <= 0.15 && h.train >= 2 && (h.weeks || 0) >= 10, off: (h) => h.party >= 0.3 || h.late >= 0.4,
    fx: { injury: 0.92, sleep: 0.3 }, desc: 'Sakatlık riski −%8 · uyku +0,3 saat',
    how: () => 'Uzun süredir gece hayatı yok, uykun düzenli, antrenmanı aksatmıyorsun.',
  },
  // ── deneyimden ──
  bigGame: {
    name: 'Büyük Maç Oyuncusu', icon: '🔥', tone: 'good', exp: true,
    on: (_h, x) => x.bigPos >= 3 && x.bigPos > x.bigNeg + 1, off: (_h, x) => x.bigPos <= x.bigNeg,
    fx: { big: 1.03 }, desc: 'Büyük maçlarda +%3',
    how: (_h, x) => `Büyük maçlarda parladın (${x.bigPos} güzel anı).`,
  },
  choker: {
    name: 'Baskı Altında Eziliyor', icon: '🫨', tone: 'bad', exp: true,
    on: (_h, x) => x.bigNeg >= 3 && x.bigNeg > x.bigPos + 1, off: (_h, x) => x.bigNeg <= x.bigPos,
    fx: { big: 0.97 }, desc: 'Büyük maçlarda −%3 (bir büyük maç zaferi kırar)',
    how: (_h, x) => `Büyük maçlarda üst üste kötü anılar (${x.bigNeg}).`,
  },
  penCool: {
    name: 'Penaltı Ustası', icon: '🎯', tone: 'good', exp: true,
    on: (_h, x) => x.penNet >= 3, off: (_h, x) => x.penNet <= 1,
    fx: { pen: 1.05 }, desc: 'Penaltıda +%5', how: (_h, x) => `Son penaltılarının çoğunu gole çevirdin (+${x.penNet}).`,
  },
  penNerves: {
    name: 'Penaltı Kabusu', icon: '😰', tone: 'bad', exp: true,
    on: (_h, x) => x.penNet <= -2, off: (_h, x) => x.penNet >= 0,
    fx: { pen: 0.95 }, desc: 'Penaltıda −%5 (iki gol bu korkuyu yener)', how: () => 'Son penaltıları kaçırınca bu an seni geriyor.',
  },
  injuryFear: {
    name: 'Sakatlık Korkusu', icon: '🩹', tone: 'bad', exp: true,
    on: (_h, x) => x.fearWeeks > 0, off: (_h, x) => x.fearWeeks <= 0,
    fx: { tackle: 0.96 }, desc: 'İkili mücadelede −%4 (birkaç hafta sürer)', how: () => 'Uzun sakatlıktan döndün; kafan hâlâ o anda.',
  },
};
export const TRAIT_IDS = Object.keys(TRAITS);

function fmt(v) {
  return String(round1(v)).replace('.', ',');
}

/**
 * Özellikleri günceller. @returns {{gained:string[], lost:string[]}}
 */
export function evaluateTraits(traits, h, x, key) {
  const gained = [];
  const lost = [];
  for (const id of TRAIT_IDS) {
    const t = TRAITS[id];
    const has = !!traits[id];
    if (!has && t.on(h, x)) {
      // karşıt özellikler birlikte olmaz
      if ((id === 'socialite' && traits.lonewolf) || (id === 'lonewolf' && traits.socialite)) continue;
      if ((id === 'bigGame' && traits.choker) || (id === 'choker' && traits.bigGame)) continue;
      if ((id === 'penCool' && traits.penNerves) || (id === 'penNerves' && traits.penCool)) continue;
      traits[id] = { since: key, how: t.how(h, x) };
      gained.push(id);
    } else if (has && t.off(h, x)) {
      delete traits[id];
      lost.push(id);
    }
  }
  return { gained, lost };
}

/** Aktif özelliklerin birleşik etkisi */
export function traitFx(traits = {}) {
  const fx = { muscle: 1, loss: 1, train: 1, injury: 1, sleep: 0, focus: 0, social: 0, big: 1, pen: 1, tackle: 1, sore: 1, morale: 0, fame: 0, rel: {}, persona: {} };
  for (const id of Object.keys(traits)) {
    const f = TRAITS[id]?.fx;
    if (!f) continue;
    for (const k of ['muscle', 'loss', 'train', 'injury', 'big', 'pen', 'tackle', 'sore']) if (f[k]) fx[k] *= f[k];
    for (const k of ['sleep', 'focus', 'social', 'morale', 'fame']) if (f[k]) fx[k] += f[k];
    for (const [k, v] of Object.entries(f.rel || {})) fx.rel[k] = (fx.rel[k] || 0) + v;
    for (const [k, v] of Object.entries(f.persona || {})) fx.persona[k] = (fx.persona[k] || 0) + v;
  }
  fx.sleep = clamp(fx.sleep, -1, 0.5);
  return fx;
}

/** Oluşmak üzere olan alışkanlık özellikleri (arayüz): eşiğe yakınlık %0–99 */
const NEAR = { gymrat: ['gym', 1.45], workhorse: ['train', 2.45], nightowl: ['party', 0.6], socialite: ['social', 1.1], spotlight: ['media', 1.1], foodie: ['junk', 0.6] };
export function nearTraits(traits = {}, h = {}) {
  return Object.entries(NEAR)
    .filter(([id]) => !traits[id])
    .map(([id, [k, th]]) => ({ id, pct: Math.min(99, Math.round(((h[k] || 0) / th) * 100)) }))
    .filter((x) => x.pct >= 45)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);
}
