import { CLUBS, CLUB_BY_ID, LEAGUES, SEASON_WEEKS } from './data.js';
import { clamp, poisson, shuffle, randInt, rand } from './rng.js';

/** Çift devreli lig fikstürü (çember yöntemi). 12 takım → 22 hafta. */
export function roundRobin(ids) {
  const teams = shuffle(ids);
  if (teams.length % 2) teams.push(null);
  const n = teams.length;
  let arr = [...teams];
  const first = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (!a || !b) continue;
      // İç/dış saha dengesi: tur ve eşleşme sırasına göre çevir
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    first.push(pairs);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const second = first.map((round) => round.map(([h, a]) => [a, h]));
  return [...first, ...second];
}

function emptyRow(id) {
  return { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, last: [] };
}

export function createWorld(season = 1, prevRatings = null) {
  const ratings = prevRatings ? { ...prevRatings } : Object.fromEntries(CLUBS.map((c) => [c.id, c.rating]));
  const leagues = {};
  for (const lg of Object.values(LEAGUES)) {
    const ids = CLUBS.filter((c) => c.league === lg.id).map((c) => c.id);
    leagues[lg.id] = {
      id: lg.id,
      teams: ids,
      fixtures: roundRobin(ids),
      table: Object.fromEntries(ids.map((id) => [id, emptyRow(id)])),
      results: [], // results[weekIndex] = [{h, a, hg, ag}]
      topScorerGoals: 0,
    };
  }
  return { season, ratings, leagues };
}

export const clubRating = (world, id) => world.ratings[id] ?? CLUB_BY_ID[id]?.rating ?? 40;
export const leagueOf = (clubId) => CLUB_BY_ID[clubId]?.league;

export function fixtureFor(world, clubId, week) {
  const lg = world.leagues[leagueOf(clubId)];
  const round = lg?.fixtures[week - 1] || [];
  return round.find(([h, a]) => h === clubId || a === clubId) || null;
}

/** Beklenen gol (Poisson λ): güç farkına ve iç sahaya göre. */
export function goalLambda(attR, defR, home) {
  const base = home ? 1.42 : 1.12;
  return clamp(base * Math.exp((attR - defR) / 30), 0.2, 3.6);
}

export function simulateScore(world, h, a) {
  const hr = clubRating(world, h);
  const ar = clubRating(world, a);
  return [poisson(goalLambda(hr, ar, true)), poisson(goalLambda(ar, hr, false))];
}

export function applyResult(table, h, a, hg, ag) {
  const H = table[h];
  const A = table[a];
  H.p++; A.p++;
  H.gf += hg; H.ga += ag;
  A.gf += ag; A.ga += hg;
  if (hg > ag) { H.w++; A.l++; H.pts += 3; push(H, 'G'); push(A, 'M'); }
  else if (hg < ag) { A.w++; H.l++; A.pts += 3; push(H, 'M'); push(A, 'G'); }
  else { H.d++; A.d++; H.pts++; A.pts++; push(H, 'B'); push(A, 'B'); }
}

function push(row, r) {
  row.last.push(r);
  if (row.last.length > 5) row.last.shift();
}

/**
 * Haftanın tüm maçlarını oynatır. Oyuncunun maçı (myResult) verilirse o skor kullanılır.
 * @returns {{[leagueId]: Array<{h,a,hg,ag}>}}
 */
export function simulateWeek(world, week, myResult = null) {
  const out = {};
  for (const lg of Object.values(world.leagues)) {
    const round = lg.fixtures[week - 1] || [];
    const results = round.map(([h, a]) => {
      let hg;
      let ag;
      if (myResult && myResult.h === h && myResult.a === a) {
        hg = myResult.hg;
        ag = myResult.ag;
      } else {
        [hg, ag] = simulateScore(world, h, a);
      }
      applyResult(lg.table, h, a, hg, ag);
      return { h, a, hg, ag };
    });
    lg.results[week - 1] = results;
    out[lg.id] = results;
  }
  return out;
}

export function sortedTable(league) {
  return Object.values(league.table).sort(
    (x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.id.localeCompare(y.id),
  );
}

export function positionOf(world, clubId) {
  const lg = world.leagues[leagueOf(clubId)];
  return sortedTable(lg).findIndex((r) => r.id === clubId) + 1;
}

/** Sezon sonu: kulüp güçleri biraz değişir (sıralamaya göre). */
export function evolveRatings(world) {
  const next = { ...world.ratings };
  for (const lg of Object.values(world.leagues)) {
    const table = sortedTable(lg);
    table.forEach((row, i) => {
      const n = table.length;
      const trend = i < 3 ? 1 : i >= n - 3 ? -1 : 0;
      const base = CLUB_BY_ID[row.id].rating;
      // Kulüpler kendi tarihî seviyelerinden çok uzaklaşmaz
      next[row.id] = clamp(Math.round(next[row.id] + trend + rand(-1.5, 1.5)), base - 6, base + 6);
    });
  }
  return next;
}

/** Ligdeki yapay gol kralının gol sayısı (ödül karşılaştırması için). */
export function aiTopScorerGoals(leagueId) {
  return leagueId === 'super' ? randInt(19, 27) : randInt(16, 23);
}

export { SEASON_WEEKS };
