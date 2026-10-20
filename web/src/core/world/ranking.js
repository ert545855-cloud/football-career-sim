// KULÜP SIRALAMASI — dünya kulüp katsayısı (UEFA katsayısı benzeri).
// Puan = geçmiş sezonların sönümlenen puanı + bu sezonun canlı puanı.
// Sezon puanı: lig sırası × lig prestiji (şampiyonluk bonusu) + Avrupa kupası galibiyet/beraberlik + tur bonusları.
import { CLUB_BY_ID, LEAGUES } from '../data.js';
import { leagueIdIn, leaguePrestige, sortedTable, clubRating } from '../league.js';

const CUP_WEIGHT = { cl: 1, el: 0.7, ecl: 0.5 };
const STAGE_BONUS = { r16: 4, qf: 6, sf: 8, f: 10 };
const DECAY = 0.6;

/** Başlangıç (geçmiş) puanı: kulübün gücü ve liginin prestijinden. */
export function basePoints(world, id) {
  const lg = leagueIdIn(world, id);
  const r = clubRating(world, id);
  return Math.max(0, (r - 35) * 1.6 * (0.25 + leaguePrestige(lg)));
}

/** Bu sezonun (o ana kadarki) puanları: lig + Avrupa. */
export function seasonPoints(world) {
  const pts = {};
  const add = (id, v) => { pts[id] = (pts[id] || 0) + v; };
  for (const lg of Object.values(world.leagues || {})) {
    const meta = LEAGUES[lg.id];
    if (!meta || meta.youth) continue;
    const pr = leaguePrestige(lg.id);
    const rows = sortedTable(lg);
    const played = rows[0]?.p || 0;
    if (!played) continue;
    const frac = Math.min(1, played / 22);
    rows.forEach((r, i) => add(r.id, ((rows.length - i) * 1.2 + (i === 0 ? 8 : 0)) * pr * frac));
  }
  const cups = world.europe?.cups || {};
  for (const [cid, cup] of Object.entries(cups)) {
    const w = CUP_WEIGHT[cid] || 0.5;
    for (const row of Object.values(cup.table || {})) add(row.id, (row.w * 2 + row.d) * w);
    for (const [st, pairs] of Object.entries(cup.ko || {})) {
      for (const p of pairs || []) for (const id of p) add(id, (STAGE_BONUS[st] || 0) * w * 0.5);
    }
    if (cup.winner) add(cup.winner, 12 * w);
  }
  return pts;
}

export function ensureRanking(state) {
  const r = (state.ranking ||= { pts: {}, prev: {}, season: state.calendar?.season || 1 });
  if (!r.init && state.world) {
    // sıfırdan: tüm kulüplere başlangıç puanı (yalnız sıfırdan büyükler saklanır)
    for (const id of Object.keys(CLUB_BY_ID)) {
      if (CLUB_BY_ID[id].amateur) continue;
      const b = basePoints(state.world, id);
      if (b > 0.5) r.pts[id] = Math.round(b * 10) / 10;
    }
    r.init = true;
  }
  return r;
}

/** Canlı sıralama: [{id, pts, rank, change}] (büyükten küçüğe). */
export function clubRanking(state) {
  const r = ensureRanking(state);
  const live = seasonPoints(state.world);
  const ids = new Set([...Object.keys(r.pts), ...Object.keys(live), state.career?.clubId].filter(Boolean));
  const list = [...ids]
    .filter((id) => CLUB_BY_ID[id])
    .map((id) => ({ id, pts: Math.round(((r.pts[id] || 0) + (live[id] || 0)) * 10) / 10 }))
    .sort((a, b) => b.pts - a.pts);
  list.forEach((x, i) => {
    x.rank = i + 1;
    x.change = r.prev[x.id] ? r.prev[x.id] - x.rank : 0;
  });
  return list;
}

/** Sezon sonu: sezon puanı kalıcı puana eklenir, eskiler sönümlenir; sıra değişimi için önceki sıralar saklanır. */
export function rankingSeasonEnd(state, world) {
  const r = ensureRanking(state);
  const before = clubRanking(state);
  r.prev = Object.fromEntries(before.slice(0, 300).map((x) => [x.id, x.rank]));
  const live = seasonPoints(world);
  const next = {};
  for (const id of new Set([...Object.keys(r.pts), ...Object.keys(live)])) {
    const v = (r.pts[id] || 0) * DECAY + (live[id] || 0);
    if (v > 0.5) next[id] = Math.round(v * 10) / 10;
  }
  r.pts = next;
  r.season = (state.calendar?.season || 1) + 1;
  return before;
}

export function myRank(state) {
  const list = clubRanking(state);
  return list.find((x) => x.id === state.career.clubId) || null;
}
