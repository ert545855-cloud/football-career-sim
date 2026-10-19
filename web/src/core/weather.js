// HAVA DURUMU VE ZEMİN — her maçın havası ev sahibinin ülkesine ve takvimdeki aya göre belirlenir.
// Deterministik: (sezon, hafta, ev sahibi) aynıysa hava aynıdır; oyunun rastgele akışını (rng) bozmaz.
// Fizik: yüzey (kuru/ıslak/ağır/karlı) top sürtünmesini, sekmeyi ve oyuncu tutunmasını değiştirir; rüzgâr havadaki topu iter.
import { CLUB_BY_ID, LEAGUES, SEASON_WEEKS } from './data.js';

export const MONTHS = ['Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs'];

/** Haftanın ayı (sezon Ağustos'ta başlar, Mayıs'ta biter). */
export function monthIndex(week = 1) {
  const w = Math.max(1, Math.min(SEASON_WEEKS, week));
  return Math.min(MONTHS.length - 1, Math.floor(((w - 1) / SEASON_WEEKS) * MONTHS.length));
}
export const monthName = (week) => MONTHS[monthIndex(week)];
/** Kış: Aralık, Ocak, Şubat */
export const isWinterWeek = (week) => { const m = monthIndex(week); return m >= 4 && m <= 6; };

// Ülke iklimi: yağmur / kar / sıcak / rüzgâr eğilimi (0-1) ve kış sıcaklığı
const CLIMATE = {
  tr: { rain: 0.32, snow: 0.3, hot: 0.3, wind: 0.2, winter: 3 },
  en: { rain: 0.5, snow: 0.12, hot: 0.05, wind: 0.32, winter: 4 },
  sc: { rain: 0.55, snow: 0.22, hot: 0, wind: 0.4, winter: 2 },
  wa: { rain: 0.6, snow: 0.12, hot: 0, wind: 0.38, winter: 4 },
  es: { rain: 0.18, snow: 0.04, hot: 0.55, wind: 0.12, winter: 9 },
  pt: { rain: 0.26, snow: 0.01, hot: 0.45, wind: 0.2, winter: 10 },
  it: { rain: 0.25, snow: 0.08, hot: 0.45, wind: 0.12, winter: 6 },
  fr: { rain: 0.36, snow: 0.12, hot: 0.25, wind: 0.2, winter: 4 },
  de: { rain: 0.38, snow: 0.3, hot: 0.12, wind: 0.22, winter: 1 },
  dk: { rain: 0.42, snow: 0.3, hot: 0.02, wind: 0.42, winter: 1 },
  ch: { rain: 0.3, snow: 0.45, hot: 0.1, wind: 0.12, winter: -1 },
  pl: { rain: 0.32, snow: 0.45, hot: 0.12, wind: 0.2, winter: -2 },
  ru: { rain: 0.26, snow: 0.7, hot: 0.12, wind: 0.24, winter: -9 },
  ua: { rain: 0.28, snow: 0.55, hot: 0.18, wind: 0.22, winter: -4 },
  ro: { rain: 0.28, snow: 0.45, hot: 0.25, wind: 0.18, winter: -2 },
  gr: { rain: 0.2, snow: 0.04, hot: 0.55, wind: 0.32, winter: 10 },
  cn: { rain: 0.3, snow: 0.3, hot: 0.4, wind: 0.2, winter: 0 },
  jp: { rain: 0.38, snow: 0.2, hot: 0.4, wind: 0.2, winter: 5 },
  kr: { rain: 0.3, snow: 0.35, hot: 0.35, wind: 0.2, winter: -2 },
  us: { rain: 0.26, snow: 0.25, hot: 0.4, wind: 0.24, winter: 3 },
  ca: { rain: 0.26, snow: 0.6, hot: 0.12, wind: 0.26, winter: -8 },
  sa: { rain: 0.04, snow: 0, hot: 0.85, wind: 0.3, winter: 19 },
  eg: { rain: 0.04, snow: 0, hot: 0.8, wind: 0.3, winter: 17 },
  ma: { rain: 0.14, snow: 0.02, hot: 0.6, wind: 0.24, winter: 13 },
  ng: { rain: 0.4, snow: 0, hot: 0.8, wind: 0.1, winter: 27 },
  za: { rain: 0.2, snow: 0, hot: 0.5, wind: 0.3, winter: 15 },
  br: { rain: 0.4, snow: 0, hot: 0.7, wind: 0.12, winter: 24 },
  ar: { rain: 0.26, snow: 0, hot: 0.45, wind: 0.24, winter: 18 },
};

export const WEATHER = {
  clear: { name: 'Açık', emoji: '☀️', surface: 'dry', note: 'Kuru zemin, ideal şartlar.' },
  cloudy: { name: 'Bulutlu', emoji: '⛅', surface: 'dry', note: 'Serin ve kuru, ideal şartlar.' },
  hot: { name: 'Sıcak', emoji: '🥵', surface: 'dry', note: 'Bunaltıcı sıcak: kondisyon daha hızlı düşer.' },
  windy: { name: 'Rüzgârlı', emoji: '🌬️', surface: 'dry', note: 'Sert rüzgâr: havadaki top yolundan sapar.' },
  rain: { name: 'Yağmurlu', emoji: '🌧️', surface: 'wet', note: 'Islak zemin: top kayar, alçak seker; ayak kayabilir.' },
  storm: { name: 'Sağanak', emoji: '⛈️', surface: 'wet', note: 'Sağanak ve rüzgâr: top kayar, uzun toplar sürüklenir.' },
  mud: { name: 'Ağır Zemin', emoji: '🥾', surface: 'heavy', note: 'Çamurlu saha: top çabuk yavaşlar, koşmak zor.' },
  snow: { name: 'Karlı', emoji: '🌨️', surface: 'snow', note: 'Karlı saha: turuncu top, top çabuk durur, zemin kaygan.' },
};

/** Kondisyon kaybı çarpanı (maç içi yorgunluk) */
const FATIGUE = { hot: 1.3, mud: 1.2, snow: 1.12, storm: 1.1, rain: 1.04 };
/** Maçta gol beklentisi çarpanı (yapay olaylar) */
const GOALS = { snow: 0.86, mud: 0.88, storm: 1.06, rain: 1.04, windy: 0.95, hot: 0.95 };

// Küçük, yerel ve tohumlanmış rastgele: global rng akışını değiştirmez
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bir maçın (veya antrenman haftasının) havası.
 * @returns {{id, name, emoji, surface, note, temp, wind:{x,y}, windKmh, fatigue, goals, winter, month}}
 */
export function weatherFor({ season = 1, week = 1, homeId = '', country, tier } = {}) {
  const club = CLUB_BY_ID[homeId];
  const cc = country || club?.country || 'tr';
  const cl = CLIMATE[cc] || CLIMATE.tr;
  const lvl = tier ?? LEAGUES[club?.league]?.tier ?? 1;
  const r = mulberry(hash(`${season}|${week}|${homeId}|${cc}`));
  const m = monthIndex(week);
  const winter = m >= 4 && m <= 6;
  const shoulder = m === 3 || m === 7; // Kasım, Mart
  const summer = m === 0 || m === 1 || m === 9; // Ağustos, Eylül, Mayıs

  let id = r() < 0.45 ? 'clear' : 'cloudy';
  const pSnow = winter ? cl.snow : shoulder ? cl.snow * 0.25 : 0;
  const pRain = cl.rain * (summer ? 0.55 : winter ? 0.9 : 1.15);
  const pHot = summer ? cl.hot : 0;
  const x = r();
  if (x < pSnow) id = 'snow';
  else if (x < pSnow + pRain) {
    id = r() < 0.12 + cl.wind * 0.25 ? 'storm' : 'rain';
    // Alt liglerde ve kış aylarında yağmur sahayı çamura çevirir
    if (id === 'rain' && (winter || shoulder) && r() < 0.15 + Math.max(0, lvl - 1) * 0.14) id = 'mud';
  } else if (x < pSnow + pRain + pHot) id = 'hot';
  else if (r() < cl.wind * 0.45) id = 'windy';

  const w = WEATHER[id];
  // Rüzgâr (m/s, oyun düzleminde): rüzgârlı/sağanakta sert, diğerlerinde hafif esinti
  const strong = id === 'windy' || id === 'storm';
  const speed = strong ? 6 + r() * 5 : id === 'snow' ? 1.5 + r() * 2.5 : r() * 2.6;
  const ang = r() * Math.PI * 2;
  const wind = { x: Math.round(Math.cos(ang) * speed * 10) / 10, y: Math.round(Math.sin(ang) * speed * 10) / 10 };
  const base = winter ? cl.winter : shoulder ? cl.winter + 6 : summer ? cl.winter + 18 + cl.hot * 8 : cl.winter + 10;
  let temp = Math.round(base + (r() - 0.5) * 6);
  if (id === 'snow') temp = Math.min(temp, Math.round(-1 - r() * 5));
  if (id === 'hot') temp = Math.max(temp, 31 + Math.round(r() * 6));
  return {
    id, name: w.name, emoji: w.emoji, surface: w.surface, note: w.note,
    temp, wind, windKmh: Math.round(speed * 3.6),
    fatigue: FATIGUE[id] || 1,
    goals: GOALS[id] || 1,
    winter, month: MONTHS[m],
  };
}

/** Bu ülkede kış karlı geçer mi? (kış teması için) */
export const snowyCountry = (cc) => (CLIMATE[cc] || CLIMATE.tr).snow > 0.05;

/** Bu haftanın (antrenman) havası: oyuncunun kulübünün şehrinde. */
export function weekWeather(state) {
  return weatherFor({ season: state.calendar?.season, week: state.calendar?.week, homeId: state.career?.clubId });
}

/** Rüzgâr yönü oku (ekran düzleminde) */
export function windArrow(wind) {
  const a = Math.atan2(wind?.y || 0, wind?.x || 0);
  const dirs = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  return dirs[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** Kısa etiket: "🌧️ Yağmurlu · 7°C" */
export const weatherLabel = (w) => (w ? `${w.emoji} ${w.name} · ${w.temp}°C` : '');

/**
 * MAÇ İÇİ YORGUNLUK — dakikaya, maça başlarken enerjiye, dayanıklılığa ve havaya göre 0..0.65.
 * Devre arası biraz toparlar. Yedekten girenler yalnızca oyunda kaldıkları süre kadar yorulur.
 */
export function fatigueAt({ minute = 0, energy = 80, stamina = 40, weather = null, from = 0, cond = 60, sore = 0 } = {}) {
  const played = Math.max(0, minute - from);
  // kondisyon (spor salonu): 100 → %13 daha yavaş yorulur, 25 → %12 daha hızlı
  const condMult = Math.max(0.85, Math.min(1.15, 1 + (60 - cond) / 300));
  const rate = (1.25 - Math.min(99, stamina) / 110) * (weather?.fatigue || 1) * condMult; // 99 dayanıklılık → ~0.35
  let f = (played / 90) * 0.42 * rate + (played > 0 ? sore : 0);
  if (minute > 45 && from < 45) f -= 0.05; // devre arası
  f += Math.max(0, 70 - energy) / 160; // yorgun başlarsan daha erken düşersin
  return Math.max(0, Math.min(0.65, f));
}

/** Kondisyon yüzdesi (arayüz için) */
export const conditionPct = (f) => Math.round(100 - f * 100);
