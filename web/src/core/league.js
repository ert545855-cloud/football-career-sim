// LİG DÜNYASI — 86 lig, ~1000 kulüp. Her hafta tüm ligler oynanır.
//
// Kayıt boyutu küçük kalsın diye:
//   • Fikstür kaydedilmez; takım listesi + tohumdan her seferinde aynı üretilir (fixturesOf)
//   • Tüm maç sonuçları sadece "odak" liglerde tutulur (oyuncunun ülkesi + bulunduğu lig);
//     diğer liglerde yalnızca son haftanın sonuçları (last) saklanır
// Lig üyeliği dünyaya aittir: sezon sonunda küme düşme / çıkma olur (her kademe arası 3 takım:
// alt ligin ilk 2'si doğrudan, 3–6. sıralar arasında play-off; üst ligin son 3'ü düşer). Avrupa'ya yalnız 1. kademe gider.
import { ALL_CLUBS, CLUB_BY_ID, LEAGUES, SEASON_WEEKS } from './data.js';
import { clamp, poisson, randInt, rand } from './rng.js';
import { hashStr, seededRng, seededShuffle } from './world/generate.js';
import { COUNTRY_BY_ID, COUNTRY_PRESTIGE } from './world/countries.js';

/** Lig adı (yabancı liglerde bayrakla): "🏴 Premier Lig" */
export function leagueLabel(id, { country = false } = {}) {
  const lg = LEAGUES[id];
  if (!lg) return '';
  const c = COUNTRY_BY_ID[lg.country];
  if (!c || lg.country === 'tr') return lg.name;
  return country ? `${c.flag} ${c.name} ${lg.name}` : `${c.flag} ${lg.name}`;
}

const TIER_FACTOR = { 1: 1, 2: 0.47, 3: 0.12, 4: 0.05 };
/** Ligin dünya sahnesindeki ağırlığı (Türkiye Süper Lig 0.85, Premier Lig 1.25, alt ligler düşük) */
export function leaguePrestige(leagueId) {
  const lg = LEAGUES[leagueId];
  if (!lg || lg.youth) return 0.04;
  return (COUNTRY_PRESTIGE[lg.country] ?? 0.5) * (TIER_FACTOR[lg.tier] ?? 0.05);
}

/** Çift devreli lig fikstürü (çember yöntemi). 12 takım → 22 hafta. rnd verilirse tohumlu. */
export function roundRobin(ids, rnd = Math.random) {
  const teams = seededShuffle(ids, rnd);
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

/** Fikstür: eski kayıtlarda saklı, yenilerde tohumdan üretilir (bellekte önbellek) */
const FIXTURE_CACHE = new WeakMap();
export function fixturesOf(lg) {
  if (Array.isArray(lg.fixtures)) return lg.fixtures;
  let f = FIXTURE_CACHE.get(lg);
  if (!f) {
    f = roundRobin(lg.teams.slice().sort(), seededRng(lg.seed >>> 0));
    FIXTURE_CACHE.set(lg, f);
  }
  return f;
}

/** Dünya → (kulüp → lig) dizini */
const INDEX_CACHE = new WeakMap();
function indexOf(world) {
  let idx = INDEX_CACHE.get(world);
  if (!idx || idx.size === 0) {
    idx = new Map();
    for (const lg of Object.values(world.leagues || {})) for (const id of lg.teams || []) idx.set(id, lg.id);
    INDEX_CACHE.set(world, idx);
  }
  return idx;
}
export const leagueIdIn = (world, clubId) => (world ? indexOf(world).get(clubId) : null) ?? CLUB_BY_ID[clubId]?.league;

/** Oyunun etkin dünyası (leagueOf dünya parametresi almadan doğru ligi bulsun) */
let ACTIVE = null;
export function useWorld(world) {
  ACTIVE = world || null;
  if (world) INDEX_CACHE.delete(world);
  return world;
}

/** Kulübün şu anki ligi (küme düşme/çıkma sonrası değişebilir) */
export const leagueOf = (clubId) => leagueIdIn(ACTIVE, clubId);
export const countryOf = (clubId) => CLUB_BY_ID[clubId]?.country || 'tr';

/** Varsayılan odak: Türkiye ligleri */
export const DEFAULT_FOCUS = ['super', 'first', 'tr2', 'tr3', 'u17'];

/**
 * Yeni sezon dünyası.
 * @param {number} season
 * @param {object|null} prevRatings önceki sezonun kulüp güçleri
 * @param {{prev?:object, focus?:string[]}} [opts] prev: önceki dünya (küme düşme/çıkma için)
 */
export function createWorld(season = 1, prevRatings = null, opts = {}) {
  const ratings = Object.fromEntries(ALL_CLUBS.map((c) => [c.id, prevRatings?.[c.id] ?? c.rating]));
  const membership = opts.prev ? promotions(opts.prev) : null;
  const leagues = {};
  for (const lg of Object.values(LEAGUES)) {
    const ids = membership ? membership.teams[lg.id] || [] : ALL_CLUBS.filter((c) => c.league === lg.id).map((c) => c.id);
    leagues[lg.id] = {
      id: lg.id,
      teams: ids,
      seed: hashStr(`${season}-${lg.id}-${randInt(0, 1e6)}`),
      table: Object.fromEntries(ids.map((id) => [id, emptyRow(id)])),
      results: [],
      last: [],
      topScorerGoals: 0,
    };
  }
  const focus = [...new Set([...(opts.focus || DEFAULT_FOCUS)])];
  return { season, ratings, leagues, focus, moves: membership?.moves || [], playoffs: membership?.playoffs || {}, v: 2 };
}

/**
 * Küme düşme / çıkma: aynı ülkede ardışık kademeler arasında 2'şer takım yer değiştirir.
 * @returns {{teams:Object<string,string[]>, moves:Array<{clubId:string, from:string, to:string, up:boolean}>}}
 */
export function promotions(world) {
  const teams = Object.fromEntries(Object.values(world.leagues).map((lg) => [lg.id, lg.teams.slice()]));
  const moves = [];
  const byCountry = {};
  for (const lg of Object.values(LEAGUES)) {
    if (lg.youth || !world.leagues[lg.id]) continue;
    (byCountry[lg.country] ||= []).push(lg);
  }
  const playoffs = {};
  for (const list of Object.values(byCountry)) {
    list.sort((a, b) => a.tier - b.tier);
    for (let i = 0; i < list.length - 1; i++) {
      const upper = world.leagues[list[i].id];
      const lower = world.leagues[list[i + 1].id];
      const down = sortedTable(upper).slice(-3).map((r) => r.id);
      const table = sortedTable(lower).map((r) => r.id);
      const po = playoff(world, table.slice(2, 6));
      playoffs[lower.id] = po;
      const up = [...table.slice(0, 2), po.winner];
      teams[upper.id] = teams[upper.id].filter((id) => !down.includes(id)).concat(up);
      teams[lower.id] = teams[lower.id].filter((id) => !up.includes(id)).concat(down);
      for (const id of up) moves.push({ clubId: id, from: lower.id, to: upper.id, up: true, playoff: id === po.winner });
      for (const id of down) moves.push({ clubId: id, from: upper.id, to: lower.id, up: false });
    }
  }
  return { teams, moves, playoffs };
}

/** Play-off: 3–6. sıralar; yarı final (3–6, 4–5) ve tek maç final. Güçlü olan biraz daha şanslı. */
export function playoff(world, ids) {
  const play = (a, b) => {
    const p = 1 / (1 + Math.exp(-(clubRating(world, a) - clubRating(world, b)) / 7));
    return rand() < p ? a : b;
  };
  if (ids.length < 4) return { semis: [], final: null, winner: ids[0] };
  const s1 = [ids[0], ids[3]];
  const s2 = [ids[1], ids[2]];
  const f = [play(...s1), play(...s2)];
  return { semis: [s1, s2], final: f, winner: play(...f) };
}

export const clubRating = (world, id) => world?.ratings?.[id] ?? CLUB_BY_ID[id]?.rating ?? 40;

export function fixtureFor(world, clubId, week) {
  const lg = world.leagues[leagueIdIn(world, clubId)];
  if (!lg) return null;
  const round = fixturesOf(lg)[week - 1] || [];
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

/** Bu ligin tüm sonuçları saklanıyor mu? */
export const isFocus = (world, leagueId) => !!world.focus?.includes(leagueId) || Array.isArray(world.leagues[leagueId]?.fixtures);

/** Haftanın sonuçları (odak liglerde tümü, diğerlerinde sadece son hafta) */
export function weekResults(world, leagueId, week) {
  const lg = world.leagues[leagueId];
  if (!lg) return [];
  if (lg.results?.[week - 1]) return lg.results[week - 1];
  return lg.lastWeek === week ? lg.last || [] : [];
}

/**
 * Haftanın tüm maçlarını oynatır. Oyuncunun maçı (myResult) verilirse o skor kullanılır.
 * @returns {{[leagueId]: Array<{h,a,hg,ag}>}}
 */
export function simulateWeek(world, week, myResult = null, { skip = null } = {}) {
  const out = {};
  for (const lg of Object.values(world.leagues)) {
    const round = (fixturesOf(lg)[week - 1] || []).filter(([h, a]) => {
      // ertelenen maç: bu hafta oynanmaz, tabloya sonra işlenir
      if (skip && skip.h === h && skip.a === a) { (lg.postponed ||= []).push({ h, a, week }); return false; }
      return true;
    });
    const results = round.map(([h, a]) => {
      let hg;
      let ag;
      if (myResult && myResult.h === h && myResult.a === a) {
        hg = myResult.hg;
        ag = myResult.ag;
      } else {
        [hg, ag] = simulateScore(world, h, a);
      }
      if (lg.table[h] && lg.table[a]) applyResult(lg.table, h, a, hg, ag);
      return { h, a, hg, ag };
    });
    if (isFocus(world, lg.id)) {
      lg.results = lg.results || [];
      lg.results[week - 1] = results;
    }
    lg.last = results;
    lg.lastWeek = week;
    out[lg.id] = results;
  }
  return out;
}

/** Sezon sonu: oynanamayan ertelenmiş maçlar simüle edilir */
export function flushPostponed(world) {
  for (const lg of Object.values(world.leagues)) {
    for (const p of lg.postponed || []) {
      if (!lg.table[p.h] || !lg.table[p.a]) continue;
      const [hg, ag] = simulateScore(world, p.h, p.a);
      applyResult(lg.table, p.h, p.a, hg, ag);
    }
    lg.postponed = [];
  }
}

/** Ertelenen maçın sonucunu tabloya ve o haftanın sonuçlarına işler */
export function applyMakeup(world, h, a, hg, ag) {
  for (const lg of Object.values(world.leagues)) {
    if (!lg.table[h] || !lg.table[a]) continue;
    const i = (lg.postponed || []).findIndex((p) => p.h === h && p.a === a);
    const wk = i >= 0 ? lg.postponed[i].week : null;
    if (i >= 0) lg.postponed.splice(i, 1);
    applyResult(lg.table, h, a, hg, ag);
    if (wk && lg.results?.[wk - 1]) lg.results[wk - 1].push({ h, a, hg, ag, makeup: true });
    return true;
  }
  return false;
}

export function sortedTable(league) {
  return Object.values(league.table).sort(
    (x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.id.localeCompare(y.id),
  );
}

export function positionOf(world, clubId) {
  const lg = world.leagues[leagueIdIn(world, clubId)];
  if (!lg) return 0;
  return sortedTable(lg).findIndex((r) => r.id === clubId) + 1;
}

/** Sezon sonu: kulüp güçleri biraz değişir (sıralamaya göre; yükselen güçlenir, düşen zayıflar). */
export function evolveRatings(world) {
  const next = { ...world.ratings };
  const moved = new Map((world.moves || []).map((m) => [m.clubId, m.up]));
  for (const lg of Object.values(world.leagues)) {
    const table = sortedTable(lg);
    table.forEach((row, i) => {
      const n = table.length;
      const trend = i < 3 ? 1 : i >= n - 3 ? -1 : 0;
      const base = CLUB_BY_ID[row.id]?.rating ?? next[row.id];
      // Kulüpler kendi tarihî seviyelerinden çok uzaklaşmaz
      next[row.id] = clamp(Math.round(next[row.id] + trend + rand(-1.5, 1.5)), base - 7, base + 7);
    });
  }
  // Yeni ligine uyum (bir önceki küme hareketi): çıkan biraz güçlenir, düşen biraz zayıflar
  for (const [id, up] of moved) {
    const base = CLUB_BY_ID[id]?.rating ?? next[id];
    next[id] = clamp(next[id] + (up ? 2 : -2), base - 7, base + 7);
  }
  return next;
}

/** Ligdeki yapay gol kralının gol sayısı (ödül karşılaştırması için). */
export function aiTopScorerGoals(leagueId) {
  const tier = LEAGUES[leagueId]?.tier || 2;
  return tier === 1 ? randInt(19, 27) : randInt(16, 23);
}

/**
 * Eski kayıt göçü: eksik ligleri ekler ve mevcut haftaya kadar oynatır (tablolar tutarlı olsun).
 * @param {object} world
 * @param {number} week şu anki hafta (bu haftanın maçı henüz oynanmadı)
 */
export function upgradeWorld(world, week = 1) {
  if (!world || world.v >= 2) return world;
  const fresh = createWorld(world.season || 1);
  const added = [];
  for (const [id, lg] of Object.entries(fresh.leagues)) {
    if (world.leagues[id]) continue;
    world.leagues[id] = lg;
    added.push(id);
  }
  for (const lg of Object.values(world.leagues)) {
    lg.last = lg.last || [];
    if (!lg.teams) lg.teams = Object.keys(lg.table || {});
  }
  world.focus = world.focus || DEFAULT_FOCUS.slice();
  world.moves = world.moves || [];
  world.v = 2;
  // Yeni eklenen ligler geçmiş haftaları oynasın
  for (let w = 1; w < week; w++) {
    for (const id of added) {
      const lg = world.leagues[id];
      const res = (fixturesOf(lg)[w - 1] || []).map(([h, a]) => {
        const [hg, ag] = simulateScore(world, h, a);
        applyResult(lg.table, h, a, hg, ag);
        return { h, a, hg, ag };
      });
      if (isFocus(world, id)) lg.results[w - 1] = res;
      lg.last = res;
      lg.lastWeek = w;
    }
  }
  return world;
}

/** Odak listesine lig ekle (oyuncu başka bir lige transfer olduğunda) */
export function addFocus(world, leagueId) {
  if (!world.focus) world.focus = DEFAULT_FOCUS.slice();
  if (!world.focus.includes(leagueId)) world.focus.push(leagueId);
}

export { SEASON_WEEKS };
