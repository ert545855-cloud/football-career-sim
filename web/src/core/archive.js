// KARİYER ARŞİVİ — gol türleri, kulüp kulüp toplamlar, rekorlar, ayın oyuncusu ve sezonun 11'i.
import { CLUB_BY_ID, LEAGUES } from './data.js';
import { chance, clamp, round1 } from './rng.js';
import { leagueOf } from './league.js';

export const GOAL_KINDS = {
  open: 'Ayak (pas sonrası)', solo: 'Bireysel', long: 'Uzaktan', counter: 'Kontra', cross: 'Kafa (orta)', corner: 'Kafa (korner)',
  penalty: 'Penaltı', freekick: 'Serbest vuruş',
};

export function ensureArchive(state) {
  const c = state.career;
  c.goalTypes ||= {};
  c.clubStats ||= {};
  c.records ||= { bestRating: 0, bestRatingAt: null, mostGoals: 0, mostGoalsAt: null, hatTricks: 0, scoringStreak: 0, bestStreak: 0, mostAssists: 0 };
  c.monthly ||= { last: 0, ratings: [], goals: 0, assists: 0 };
  return c;
}

/** Maç sonu: gol türleri, kulüp toplamı, rekorlar, ayın oyuncusu birikimi */
export function archiveOnMatch(state, match, summary) {
  const c = ensureArchive(state);
  if (!summary.played) { c.records.scoringStreak = 0; return null; }
  for (const g of match.goals || []) if (g.me) c.goalTypes[g.kind || 'open'] = (c.goalTypes[g.kind || 'open'] || 0) + 1;
  const cs = (c.clubStats[c.clubId] ||= { apps: 0, goals: 0, assists: 0, from: state.calendar.season });
  cs.apps++;
  cs.goals += summary.goals;
  cs.assists += summary.assists;
  cs.to = state.calendar.season;
  const r = c.records;
  const at = { s: state.calendar.season, w: state.calendar.week, opp: CLUB_BY_ID[match.oppId]?.short || match.oppId };
  let rec = null;
  if (summary.rating > r.bestRating) { r.bestRating = summary.rating; r.bestRatingAt = at; if (summary.rating >= 8.5) rec = `Kariyer rekoru: ${summary.rating.toFixed(1)} maç notu!`; }
  if (summary.goals > r.mostGoals) { r.mostGoals = summary.goals; r.mostGoalsAt = at; if (summary.goals >= 2) rec = `Kariyer rekoru: bir maçta ${summary.goals} gol!`; }
  if (summary.assists > r.mostAssists) r.mostAssists = summary.assists;
  if (summary.goals >= 3) r.hatTricks++;
  r.scoringStreak = summary.goals > 0 ? r.scoringStreak + 1 : 0;
  if (r.scoringStreak > r.bestStreak) { r.bestStreak = r.scoringStreak; if (r.bestStreak >= 4) rec = `Kariyer rekoru: üst üste ${r.bestStreak} maçta gol!`; }
  c.monthly.ratings.push(summary.rating);
  c.monthly.goals += summary.goals;
  c.monthly.assists += summary.assists;
  return rec;
}

/**
 * Ayın oyuncusu (her 4 haftada): son 4 maçın ortalaması, gol ve asist katkısı. Kazanırsa ödül döner.
 */
export function monthlyAward(state) {
  const c = ensureArchive(state);
  const w = state.calendar.week;
  if (w % 4 !== 0 || c.monthly.last === `${state.calendar.season}-${w}`) return null;
  c.monthly.last = `${state.calendar.season}-${w}`;
  const m = c.monthly;
  const n = m.ratings.length;
  const avg = n ? m.ratings.reduce((a, b) => a + b, 0) / n : 0;
  c.monthly = { last: m.last, ratings: [], goals: 0, assists: 0 };
  if (n < 3) return null;
  const score = avg + (m.goals * 0.35 + m.assists * 0.2) / Math.max(1, n) * 2;
  const p = clamp((score - 7.3) * 0.9, 0, 0.85);
  if (!chance(p)) return null;
  const lg = LEAGUES[leagueOf(c.clubId)];
  const award = { season: state.calendar.season, title: `${lg?.name || 'Lig'} Ayın Oyuncusu`, icon: 'medal', month: w, avg: round1(avg), goals: m.goals, assists: m.assists };
  c.awards.push(award);
  return award;
}

/** Sezonun 11'i: düzenli oynayıp yüksek not alan oyuncu */
export function teamOfSeason(state, { avg, apps, leagueName }) {
  if (apps >= 15 && avg >= 7.05) return { season: state.calendar.season, title: `${leagueName} Sezonun 11'i`, icon: 'star' };
  return null;
}

/** Arşiv özeti (kariyer ekranı) */
export function archiveSummary(state) {
  const c = ensureArchive(state);
  const clubs = Object.entries(c.clubStats).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.apps - a.apps);
  const kinds = Object.entries(c.goalTypes).sort((a, b) => b[1] - a[1]);
  const totalKinds = kinds.reduce((a, [, n]) => a + n, 0);
  const transfers = state.market?.transfers || [];
  const topFee = transfers.reduce((m, t) => (t.fee > (m?.fee || 0) ? t : m), null);
  const trophies = c.awards.filter((a) => a.icon === 'trophy');
  const bestSeason = c.history.slice().sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))[0] || null;
  return { clubs, kinds, totalKinds, transfers, topFee, trophies, bestSeason, records: c.records };
}
