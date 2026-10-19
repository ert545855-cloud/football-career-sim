// KADROLAR (maç için) — golcü ve asist isimleri: kendi takımın mentor kadrosundan, rakip takımlar
// kulüp ve sezona göre sabit (tohumlu) kurgusal isimlerle. Böylece rakip golcüler de isimleriyle görünür.
import { CLUB_BY_ID, COUNTRY_BY_ID } from './data.js';
import { randomName } from './world/names.js';
import { MentorManager } from './mentor/index.js';

const SHAPE = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'];
const NUMS = { GK: [1], DF: [2, 3, 4, 5], MF: [6, 8, 10], FW: [7, 9, 11] };
const cache = new Map();

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seeded(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kurgusal 11 (kulüp + sezon sabit) */
function generated(key, lang) {
  if (cache.has(key)) return cache.get(key);
  const rnd = seeded(hash(key));
  const used = new Set();
  const counters = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const xi = SHAPE.map((pos) => {
    let name = '';
    for (let i = 0; i < 10 && (!name || used.has(name)); i++) name = randomName(lang, rnd);
    used.add(name);
    const num = NUMS[pos][counters[pos]++] ?? 12 + counters[pos];
    return { name, pos, num };
  });
  if (cache.size > 400) cache.clear();
  cache.set(key, xi);
  return xi;
}

/**
 * Kulübün maç kadrosu. Kendi kulübünde mentor kadrosundaki isimler kullanılır, oyuncunun kendisi hariç.
 * @returns {Array<{name:string,pos:string,num:number}>}
 */
export function clubLineup(state, clubId, { mine = false } = {}) {
  const club = CLUB_BY_ID[clubId];
  const lang = COUNTRY_BY_ID[club?.country || 'tr']?.lang || 'tr';
  const base = generated(`${clubId}|${state.calendar?.season || 1}`, lang).map((p) => ({ ...p }));
  if (!mine) return base;
  // kendi takımın: tanıdık isimler (soyunma odası kadrosu) önce
  let squad = [];
  try { squad = new MentorManager(state).squad(); } catch { squad = []; }
  const meName = state.player.name;
  const byPos = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of squad) if (p.name !== meName && byPos[p.position]) byPos[p.position].push(p);
  const out = base.map((p) => {
    const real = byPos[p.pos].shift();
    return real ? { name: real.name, pos: p.pos, num: real.number || p.num } : p;
  });
  // oyuncunun mevkisinden bir kişiyi çıkar (sen oynuyorsun)
  const idx = out.findIndex((p) => p.pos === state.player.position);
  if (idx >= 0) out.splice(idx, 1);
  return out;
}

/** Milli maç: kalıcı milli kadro ve rakip ülke (kurgusal) */
export function nationLineup(short, level = 'A') {
  return generated(`nat|${short}|${level}`, ['ARG', 'İSP', 'URU', 'KOL', 'MEK'].includes(short) ? 'es' : ['BRA', 'POR'].includes(short) ? 'pt' : ['FRA', 'BEL', 'FAS', 'SEN'].includes(short) ? 'fr' : ['ALM', 'AVU', 'İSV'].includes(short) ? 'de' : ['İTA'].includes(short) ? 'it' : 'en');
}

const W = { GK: 0, DF: 1, MF: 3, FW: 6 };

/** Golcü (mevkiye göre ağırlıklı) ve olası asist yapan */
export function pickScorer(xi, rnd = Math.random, { assistP = 0.62 } = {}) {
  if (!xi?.length) return { scorer: null, assist: null };
  const total = xi.reduce((a, p) => a + (W[p.pos] ?? 1), 0);
  let r = rnd() * total;
  let scorer = xi[0];
  for (const p of xi) { r -= W[p.pos] ?? 1; if (r <= 0) { scorer = p; break; } }
  let assist = null;
  if (rnd() < assistP) {
    const others = xi.filter((p) => p !== scorer && p.pos !== 'GK');
    assist = others[Math.floor(rnd() * others.length)] || null;
  }
  return { scorer, assist };
}

/** Kısa isim: "Kerem Aydın" → "K. Aydın" */
export const shortName = (n) => {
  if (!n) return '';
  const parts = n.split(' ');
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : n;
};
