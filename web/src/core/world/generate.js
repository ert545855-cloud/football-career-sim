// DÜNYA ÜRETİCİ — ülke verisinden ligleri ve kurgusal kulüpleri her açılışta aynı şekilde üretir
// (tohumlu rastgelelik: kayıt dosyasına kulüp listesi yazılmaz, sadece güçler ve tablolar).
import { COUNTRIES } from './countries.js';

/** Basit 32-bit karma + mulberry32: tohumlu, tekrarlanabilir rastgelelik */
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededShuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Forma renk çiftleri */
const PALETTE = [
  ['#c8102e', '#ffffff'], ['#1d4ed8', '#ffffff'], ['#111827', '#f8fafc'], ['#16a34a', '#ffffff'], ['#f59e0b', '#111827'],
  ['#7c3aed', '#fde68a'], ['#0e7490', '#f8fafc'], ['#b91c1c', '#111827'], ['#0f766e', '#fde047'], ['#1e3a8a', '#fbbf24'],
  ['#be123c', '#1e293b'], ['#ea580c', '#ffffff'], ['#65a30d', '#111827'], ['#0369a1', '#f97316'], ['#9d174d', '#f8fafc'],
  ['#334155', '#facc15'], ['#f8fafc', '#dc2626'], ['#f8fafc', '#1d4ed8'], ['#fde047', '#1e3a8a'], ['#7f1d1d', '#38bdf8'],
  ['#047857', '#fbbf24'], ['#581c87', '#f8fafc'], ['#0c4a6e', '#e0f2fe'], ['#a16207', '#111827'], ['#dc2626', '#facc15'],
  ['#2563eb', '#dc2626'], ['#000000', '#16a34a'], ['#e11d48', '#38bdf8'], ['#15803d', '#dc2626'], ['#6b21a8', '#22d3ee'],
];
const KITS = ['solid', 'stripes', 'hoops', 'half', 'sash'];

/** Ülkedeki lig kimliği (Türkiye'nin ilk iki ligi eski kayıtlarla uyum için 'super' ve 'first') */
export const leagueIdFor = (countryId, level) => (countryId === 'tr' ? ['super', 'first', 'tr2', 'tr3'][level - 1] : `${countryId}${level}`);

/** Kademeye göre güç aralığı */
export function tierRange(country, level) {
  if (country.id === 'tr') return [[50, 79], [26, 45], [16, 30], [10, 22]][level - 1];
  const [lo, hi] = country.range;
  if (level === 1) return [lo, hi];
  if (level === 2) return [Math.max(10, lo - 22), Math.max(14, lo - 1)];
  return [Math.max(8, lo - 34), Math.max(12, lo - 13)];
}

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '');

function shortCode(town, name, taken) {
  const base = strip(town).toUpperCase();
  const words = name.split(/\s+/).filter((w) => !town.includes(w));
  const tries = [base.slice(0, 3), `${(strip(words[0] || '') || 'X')[0].toUpperCase()}${base.slice(0, 2)}`, `${base[0]}${base.slice(-2)}`, `${base.slice(0, 2)}${(strip(words[0] || 'X')[0] || 'X').toUpperCase()}`];
  for (const t of tries) if (t.length === 3 && !taken.has(t)) return t;
  for (let i = 2; i < 10; i++) {
    const t = `${base.slice(0, 2)}${i}`;
    if (!taken.has(t)) return t;
  }
  return base.slice(0, 3);
}

/**
 * Ligler ve kulüpler. Türkiye'nin Süper Lig ve 1. Lig kulüpleri data.js'te; buradan sadece alt ligleri gelir.
 * @returns {{leagues:Array<object>, clubs:Array<object>}}
 */
export function generateWorld(reserved = {}) {
  const leagues = [];
  const clubs = [];
  for (const country of COUNTRIES) {
    const rnd = seededRng(hashStr(`krampon-${country.id}`));
    country.leagues.forEach((name, i) => {
      const level = i + 1;
      leagues.push({ id: leagueIdFor(country.id, level), name, short: country.id === 'tr' ? ['SL', '1L', '2L', '3L'][i] : `${country.short}${level}`, tier: level, level, country: country.id });
    });
    // Kasabalardan kulüp adları: her kasabaya bir kulüp, ilk kasabalara ikinci (derbi) kulüp
    const levels = country.id === 'tr' ? [3, 4] : [1, 2, 3];
    const need = levels.length * 12;
    const towns = seededShuffle(country.towns, rnd);
    const entries = [];
    const usedNames = new Set();
    let ti = 0;
    while (entries.length < need && ti < towns.length * 3) {
      const town = towns[ti % towns.length];
      const pats = seededShuffle(country.patterns, rnd);
      const pattern = pats.find((p) => !usedNames.has(p.replace('{T}', town)));
      ti += 1;
      if (!pattern) continue;
      const name = pattern.replace('{T}', town);
      usedNames.add(name);
      entries.push({ town, name });
    }
    const order = seededShuffle(entries, rnd);
    const taken = new Set(reserved[country.id] || []);
    levels.forEach((level, li) => {
      const group = order.slice(li * 12, li * 12 + 12);
      const [lo, hi] = tierRange(country, level);
      group.forEach((e, k) => {
        const t = k / (group.length - 1);
        const rating = Math.round(hi - (hi - lo) * Math.pow(t, 0.9) + (rnd() - 0.5) * 2);
        const short = shortCode(e.town, e.name, taken);
        taken.add(short);
        const colors = PALETTE[Math.floor(rnd() * PALETTE.length)];
        clubs.push({
          id: `${leagueIdFor(country.id, level)}-${String(k + 1).padStart(2, '0')}`,
          name: e.name,
          short,
          league: leagueIdFor(country.id, level),
          rating: Math.max(8, rating),
          colors: rnd() < 0.2 ? [colors[1], colors[0]] : colors,
          pattern: KITS[Math.floor(rnd() * KITS.length)],
          city: e.town,
          country: country.id,
        });
      });
    });
  }
  return { leagues, clubs };
}
