// AVRUPA KUPALARI — Şampiyonlar Ligi, Avrupa Ligi, Konferans Ligi (32'şer takım).
//
// Katılım: Avrupa ülkelerinin üst liglerinde geçen sezonun sırası (ilk sezon kulüp gücü).
// Takvim (22 haftalık tasarım; sezon uzunluğuna ölçeklenir): 8 grup × 4 takım, 6 maç günü (hafta 3,5,7,9,12,14)
// → son 16 (16) → çeyrek (18) → yarı (20) → final (22).
// Eleme turları tek maç; berabere biterse uzatma ve penaltılar.
import { CLUB_BY_ID, COUNTRIES, LEAGUES } from '../data.js';
import { EURO_SLOTS } from './countries.js';
import { clubRating, goalLambda, sortedTable, worldWeeks } from '../league.js';
import { BASE_WEEKS, scaleWeek } from '../calendar.js';
import { chance, poisson, rand } from '../rng.js';
import { ovr } from '../player.js';

export const CUPS = {
  cl: { id: 'cl', name: 'Şampiyonlar Ligi', short: 'ŞL', color: '#1e3a8a', accent: '#93c5fd', prestige: 1.4, prize: 1.2 },
  el: { id: 'el', name: 'Avrupa Ligi', short: 'AL', color: '#c2410c', accent: '#fdba74', prestige: 0.9, prize: 0.6 },
  ecl: { id: 'ecl', name: 'Konferans Ligi', short: 'KL', color: '#15803d', accent: '#86efac', prestige: 0.6, prize: 0.35 },
};
export const CUP_IDS = ['cl', 'el', 'ecl'];
export const CUP_WEEKS = { group: [3, 5, 7, 9, 12, 14], r16: 16, qf: 18, sf: 20, f: 22 };
/** Bu sezonun Avrupa takvimi (sezon uzunluğu W haftaya ölçekli) */
export function europeWeeks(W = BASE_WEEKS) {
  const s = (w) => scaleWeek(w, W);
  return { group: CUP_WEEKS.group.map(s), r16: s(CUP_WEEKS.r16), qf: s(CUP_WEEKS.qf), sf: s(CUP_WEEKS.sf), f: s(CUP_WEEKS.f) };
}
export const STAGE_LABEL = { group: 'Grup aşaması', r16: 'Son 16', qf: 'Çeyrek final', sf: 'Yarı final', f: 'Final', done: 'Tamamlandı' };
const GROUP_ROUNDS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]], [[1, 0], [3, 2]], [[2, 0], [3, 1]], [[3, 0], [2, 1]]];
const GROUP_NAMES = 'ABCDEFGH'.split('');

/** Ülkenin üst ligi (sıralı) — tablo ya da güç */
function rankedTop(world, country, byRating) {
  const top = Object.values(LEAGUES).find((l) => l.country === country && l.tier === 1 && !l.youth);
  const lg = world?.leagues?.[top?.id];
  if (!lg) return [];
  if (byRating) return lg.teams.slice().sort((a, b) => clubRating(world, b) - clubRating(world, a));
  return sortedTable(lg).map((r) => r.id);
}

/**
 * Katılımcılar: önce ŞL, sonra AL, sonra KL (aynı ülkeden sırayla).
 * @param {object} world sıralamanın alınacağı dünya (geçen sezon sonu ya da ilk sezon)
 * @param {boolean} byRating ilk sezon: tablo yok, güce göre
 */
export function europeQualifiers(world, byRating = false) {
  const out = { cl: [], el: [], ecl: [] };
  for (const c of COUNTRIES.filter((x) => x.euro)) {
    const ranked = rankedTop(world, c.id, byRating);
    let i = 0;
    for (const cup of CUP_IDS) {
      const n = EURO_SLOTS[cup][c.id] || 0;
      out[cup].push(...ranked.slice(i, i + n));
      i += n;
    }
  }
  return out;
}

const emptyRow = (id) => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });

/** Torbalı kura: her gruba her torbadan bir takım, mümkünse aynı ülkeden iki takım aynı grupta olmaz */
function drawGroups(world, teams) {
  const sorted = teams.slice().sort((a, b) => clubRating(world, b) - clubRating(world, a));
  const pots = [0, 1, 2, 3].map((p) => sorted.slice(p * 8, p * 8 + 8).sort(() => Math.random() - 0.5));
  const groups = Array.from({ length: 8 }, () => []);
  for (const pot of pots) {
    const left = pot.slice();
    for (const g of groups) {
      const countries = new Set(g.map((id) => CLUB_BY_ID[id]?.country));
      let k = left.findIndex((id) => !countries.has(CLUB_BY_ID[id]?.country));
      if (k < 0) k = 0;
      g.push(left.splice(k, 1)[0]);
    }
  }
  return groups;
}

function newCup(world, id, teams) {
  const groups = drawGroups(world, teams);
  return {
    id,
    teams,
    groups,
    table: Object.fromEntries(teams.map((t) => [t, emptyRow(t)])),
    results: {}, // 'g1'..'g6', 'r16', 'qf', 'sf', 'f' → [{h,a,hg,ag,pen?,w}]
    ko: { r16: [], qf: [], sf: [], f: [] },
    stage: 'group',
    winner: null,
  };
}

/**
 * Yeni sezonun Avrupa kupaları.
 * @param {number} season
 * @param {object} world yeni sezonun dünyası (güçler)
 * @param {object|null} prevWorld geçen sezonun dünyası (sıralama); yoksa güce göre
 */
export function createEurope(season, world, prevWorld = null) {
  const q = europeQualifiers(prevWorld || world, !prevWorld);
  return { season, cups: Object.fromEntries(CUP_IDS.map((id) => [id, newCup(world, id, q[id])])) };
}

export function groupTable(cup, gi) {
  return cup.groups[gi].map((id) => cup.table[id]).sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf);
}

function playMatch(world, h, a, knockout = false, boost = {}) {
  const hr = clubRating(world, h) + (boost[h] || 0);
  const ar = clubRating(world, a) + (boost[a] || 0);
  // Kupa maçlarında iç saha avantajı azdır (eleme turları tek maç, tarafsız sahaya yakın)
  let hg = poisson(goalLambda(hr, ar, !knockout) * (knockout ? 1.05 : 1));
  let ag = poisson(goalLambda(ar, hr, false));
  let pen = null;
  let w = hg > ag ? h : ag > hg ? a : null;
  if (knockout && !w) {
    // Uzatma: küçük gol şansı, sonra penaltılar
    if (chance(0.35)) {
      if (chance(0.5 + (hr - ar) / 120)) hg += 1;
      else ag += 1;
      w = hg > ag ? h : a;
    } else {
      const ph = 3 + Math.round(rand(0, 2));
      let pa = 3 + Math.round(rand(0, 2));
      if (pa === ph) pa = ph + (chance(0.5) ? 1 : -1);
      pen = [ph, pa];
      w = ph > pa ? h : a;
    }
  }
  return { h, a, hg, ag, pen, w };
}

function applyGroup(cup, m) {
  const H = cup.table[m.h];
  const A = cup.table[m.a];
  H.p++; A.p++;
  H.gf += m.hg; H.ga += m.ag; A.gf += m.ag; A.ga += m.hg;
  if (m.hg > m.ag) { H.w++; A.l++; H.pts += 3; } else if (m.hg < m.ag) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
}

/** Haftanın kupa aşaması */
export function stageOfWeek(week, W = BASE_WEEKS) {
  const cw = europeWeeks(W);
  const g = cw.group.indexOf(week);
  if (g >= 0) return { stage: 'group', md: g + 1 };
  for (const st of ['r16', 'qf', 'sf', 'f']) if (cw[st] === week) return { stage: st };
  return null;
}

/** Eşleşmeler (eleme turları önceki turun kazananlarından) */
function pairsFor(cup, stage) {
  if (stage === 'r16') {
    // Grup birincisi, bir sonraki grubun ikincisiyle eşleşir
    const firsts = cup.groups.map((_, gi) => groupTable(cup, gi)[0].id);
    const seconds = cup.groups.map((_, gi) => groupTable(cup, gi)[1].id);
    return firsts.map((f, i) => [f, seconds[(i + 1) % 8]]);
  }
  const prev = { qf: 'r16', sf: 'qf', f: 'sf' }[stage];
  const winners = (cup.results[prev] || []).map((m) => m.w);
  const out = [];
  for (let i = 0; i < winners.length; i += 2) out.push([winners[i], winners[i + 1]]);
  return out;
}

/**
 * Haftanın kupa maçlarını oynatır.
 * @param {object} world
 * @param {number} week
 * @param {{boost?:Object<string,number>}} [opts] oyuncunun kulübüne katkı (yıldız oyuncu etkisi)
 * @returns {Array<{cup:string, stage:string, md?:number, matches:Array}>}
 */
export function playEuropeWeek(world, week, opts = {}) {
  const eu = world.europe;
  const st = stageOfWeek(week, worldWeeks(world));
  if (!eu || !st) return [];
  const out = [];
  for (const id of CUP_IDS) {
    const cup = eu.cups[id];
    if (!cup || cup.stage === 'done') continue;
    let matches = [];
    if (st.stage === 'group') {
      if (cup.stage !== 'group') continue;
      const key = `g${st.md}`;
      if (cup.results[key]) continue;
      for (const g of cup.groups) {
        for (const [i, j] of GROUP_ROUNDS[st.md - 1]) {
          const m = playMatch(world, g[i], g[j], false, opts.boost);
          applyGroup(cup, m);
          matches.push(m);
        }
      }
      cup.results[key] = matches;
      if (st.md === 6) cup.stage = 'r16';
    } else {
      if (cup.stage !== st.stage) continue;
      const pairs = pairsFor(cup, st.stage);
      matches = pairs.map(([h, a]) => playMatch(world, h, a, true, opts.boost));
      cup.ko[st.stage] = pairs;
      cup.results[st.stage] = matches;
      cup.stage = { r16: 'qf', qf: 'sf', sf: 'f', f: 'done' }[st.stage];
      if (st.stage === 'f') cup.winner = matches[0].w;
    }
    out.push({ cup: id, stage: st.stage, md: st.md, matches });
  }
  return out;
}

/** Kulüp hangi kupada? */
export function cupOf(world, clubId) {
  const eu = world?.europe;
  if (!eu) return null;
  return CUP_IDS.find((id) => eu.cups[id]?.teams.includes(clubId)) || null;
}

/** Kulüp kupada hâlâ var mı? (gruptan çıktı mı, elendi mi) */
export function stillIn(world, clubId) {
  const id = cupOf(world, clubId);
  if (!id) return false;
  const cup = world.europe.cups[id];
  if (cup.stage === 'group') return true;
  if (cup.stage === 'done') return cup.winner === clubId;
  const lastKo = ['f', 'sf', 'qf', 'r16'].find((k) => cup.results[k]);
  if (!lastKo) {
    const gi = cup.groups.findIndex((g) => g.includes(clubId));
    return groupTable(cup, gi).slice(0, 2).some((r) => r.id === clubId);
  }
  return cup.results[lastKo].some((m) => m.w === clubId);
}

/** Eski kayıt / yeni oyun: Avrupa yoksa kur ve geçmiş haftaları oynat */
export function ensureEurope(world, week = 1) {
  if (!world || world.europe) return world?.europe;
  world.europe = createEurope(world.season || 1, world, null);
  for (let w = 1; w < week; w++) playEuropeWeek(world, w);
  return world.europe;
}

// ─────────────────────────── Oyuncunun kulübü kupada ───────────────────────────

const SCORE_SHARE = { FW: 0.36, MF: 0.16, DF: 0.06 };
const ASSIST_SHARE = { FW: 0.16, MF: 0.3, DF: 0.1 };

/**
 * Haftanın Avrupa maçları + oyuncunun katkısı (forma giydiyse gol/asist, prim).
 * @returns {{cups:Array, my:null|{cup:string, stage:string, md?:number, match:object, played:boolean, goals:number, assists:number, rating:number, prize:number, won:boolean, out:boolean}}}
 */
export function europeWeek(state, week) {
  const world = state.world;
  if (!world?.europe) return { cups: [], my: null };
  const myId = state.career.clubId;
  const cupId = cupOf(world, myId);
  const p = state.player;
  const injured = (state.flags.injuredWeeks || 0) > 0 || (state.flags.suspendedWeeks || 0) > 0;
  const s = state.career.season;
  // Forma şansı: sezon içindeki ilk 11 oranı (ilk haftalarda kulüp gücüne göre tahmin)
  const startRate = s.apps >= 3 ? s.starts / Math.max(1, s.apps) : ovr(p) >= clubRating(world, myId) - 3 ? 0.8 : 0.4;
  const plays = !!cupId && !injured && chance(Math.min(0.95, 0.15 + startRate));
  const boost = plays ? { [myId]: Math.max(-2, Math.min(4, (ovr(p) - clubRating(world, myId)) / 4)) } : {};
  const cups = playEuropeWeek(world, week, { boost });
  let my = null;
  for (const r of cups) {
    const match = r.matches.find((m) => m.h === myId || m.a === myId);
    if (!match) continue;
    const mine = match.h === myId ? match.hg : match.ag;
    const theirs = match.h === myId ? match.ag : match.hg;
    let goals = 0;
    let assists = 0;
    if (plays) {
      const q = Math.max(0.6, Math.min(1.5, ovr(p) / Math.max(30, clubRating(world, myId))));
      for (let g = 0; g < mine; g++) {
        if (chance((SCORE_SHARE[p.position] || 0.15) * q)) goals += 1;
        else if (chance((ASSIST_SHARE[p.position] || 0.15) * q)) assists += 1;
      }
    }
    const won = r.stage === 'group' ? mine > theirs : match.w === myId;
    const rating = plays ? Math.max(4.5, Math.min(10, 6.3 + goals * 0.8 + assists * 0.5 + (mine > theirs ? 0.4 : mine < theirs ? -0.3 : 0) + rand(-0.5, 0.5))) : 0;
    // Prim: eleme turu kazanınca ya da grup galibiyetinde
    const cup = CUPS[r.cup];
    const prize = won ? Math.round(state.career.contract.wage * cup.prize * (r.stage === 'group' ? 0.25 : r.stage === 'f' ? 3 : 1)) : 0;
    state.career.money += prize;
    if (plays) {
      const e = s.europe || (s.europe = { apps: 0, goals: 0, assists: 0 });
      e.apps += 1;
      e.goals += goals;
      e.assists += assists;
      const t = state.career.totals;
      t.euroApps = (t.euroApps || 0) + 1;
      t.euroGoals = (t.euroGoals || 0) + goals;
    }
    my = { cup: r.cup, stage: r.stage, md: r.md, match, played: plays, goals, assists, rating: Math.round(rating * 10) / 10, prize, won, out: r.stage !== 'group' && !won };
  }
  return { cups, my };
}

/** Kupa kazananları (sezon sonu raporu) */
export function europeWinners(world) {
  const eu = world?.europe;
  if (!eu) return {};
  return Object.fromEntries(CUP_IDS.map((id) => [id, eu.cups[id]?.winner || null]));
}
