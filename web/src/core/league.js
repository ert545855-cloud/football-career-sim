// LİG DÜNYASI — 28 ülkenin lig piramidi (leagueConfig.js: gerçek takım sayıları, gruplar, devre sayısı).
//
// Kayıt boyutu küçük kalsın diye:
//   • Fikstür kaydedilmez; takım listesi + tohumdan her seferinde aynı üretilir (fixturesOf)
//   • Tüm maç sonuçları sadece "odak" liglerde tutulur (üst ligler + oynadığın lig);
//     diğer liglerde yalnızca son haftanın sonuçları (last) saklanır
// Takvim: sezonun hafta sayısı oyuncunun liginin tur sayısıdır (en az 22). Diğer ligler turlarını bu takvime yayar.
// Küme düşme / çıkma kuralları (doğrudan, play-off, gruplar arası eşleşme) yapılandırmadan okunur; sonra her lig
// hedef takım sayısına göre dengelenir (yapı değişse ya da eski kayıt yüklense de tablolar doğru boyutta kalır).
import { ALL_CLUBS, CLUBS, CLUB_BY_ID, LEAGUES, SEASON_WEEKS } from './data.js';
import { clamp, poisson, randInt, rand } from './rng.js';
import { hashStr, seededRng, seededShuffle } from './world/generate.js';
import { COUNTRY_BY_ID, COUNTRY_PRESTIGE } from './world/countries.js';
import { LEAGUE_SYSTEM, divisionGroups, divisionSize, groupLeagueId } from './world/leagueConfig.js';
import { BASE_WEEKS, roundWeek, roundsFor, setSeasonWeeks } from './calendar.js';

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

/**
 * Lig fikstürü, takım sayısından bağımsız (Berger tabloları).
 * Tek sayıda takımda her tur bir takım bay geçer. legs: her rakiple maç sayısı (2 = çift devre, ikinci devre
 * ilk devrenin iç/dış saha tersidir). Her takım en çok iki maç üst üste iç sahada ya da deplasmanda oynar.
 * rnd verilirse tohumlu. 18 takım → 34 tur, 20 → 38, 29 → 58 (her takım 56 maç, 2 bay).
 * method 'circle': eski sürümün sırası (12 takımlı eski kayıtların süren sezonu değişmesin diye).
 */
export function roundRobin(ids, rnd = Math.random, legs = 2, method = 'berger') {
  const teams = seededShuffle(ids, rnd);
  if (teams.length < 2) return [];
  if (teams.length % 2) teams.push(null);
  const n = teams.length;
  const first = [];
  if (method === 'circle') {
    let arr = [...teams];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        if (!a || !b) continue;
        pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
      }
      first.push(pairs);
      arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
    }
  } else {
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        let h = (r + i) % (n - 1);
        let a = i === 0 ? n - 1 : (n - 1 - i + r) % (n - 1);
        if (r % 2 === 1) [h, a] = [a, h];
        if (!teams[h] || !teams[a]) continue;
        pairs.push([teams[h], teams[a]]);
      }
      first.push(pairs);
    }
  }
  const second = first.map((round) => round.map(([h, a]) => [a, h]));
  const out = [];
  for (let l = 0; l < Math.max(1, legs); l++) out.push(...(l % 2 === 0 ? first : second));
  return out;
}

function emptyRow(id) {
  return { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, last: [] };
}

/** Ligin devre sayısı (yapılandırmadan) */
const legsOf = (leagueId) => LEAGUES[leagueId]?.legs || 2;
/** Dünyadaki ligin devre sayısı: yeni dünyalar kurulurken yazar; eski (v2) kayıtların ligleri çift devre */
const lgLegs = (lg) => lg.legs || 2;

/** Fikstür: eski kayıtlarda saklı, yenilerde tohumdan üretilir (bellekte önbellek) */
const FIXTURE_CACHE = new WeakMap();
export function fixturesOf(lg) {
  if (Array.isArray(lg.fixtures)) return lg.fixtures;
  let f = FIXTURE_CACHE.get(lg);
  if (!f) {
    f = roundRobin(lg.teams.slice().sort(), seededRng(lg.seed >>> 0), lgLegs(lg), lg.rr === 'berger' ? 'berger' : 'circle');
    FIXTURE_CACHE.set(lg, f);
  }
  return f;
}

/** Sezon takvimi: dünyanın hafta sayısı (eski kayıtlar 22) */
export const worldWeeks = (world) => world?.weeks || BASE_WEEKS;

/** Ligin turlarının haftalara dağılımı (önbellekli): byWeek[w] = o hafta oynanan tur indeksleri */
const WEEK_CACHE = new WeakMap();
function weekPlan(world, lg) {
  const W = worldWeeks(world);
  let p = WEEK_CACHE.get(lg);
  if (!p || p.W !== W) {
    const R = fixturesOf(lg).length;
    const byWeek = Array.from({ length: W + 1 }, () => []);
    const weekOf = [];
    for (let r = 0; r < R; r++) {
      const w = Math.min(W, roundWeek(r, R, W));
      byWeek[w].push(r);
      weekOf.push(w);
    }
    p = { W, byWeek, weekOf };
    WEEK_CACHE.set(lg, p);
  }
  return p;
}
/** Bu hafta oynanan tur indeksleri */
export const roundsInWeek = (world, lg, week) => weekPlan(world, lg).byWeek[week] || [];
/** Turun oynandığı hafta */
export const weekOfRound = (world, lg, r) => weekPlan(world, lg).weekOf[r] || r + 1;
/** Bu haftanın tüm eşleşmeleri */
export const matchesInWeek = (world, lg, week) => roundsInWeek(world, lg, week).flatMap((r) => fixturesOf(lg)[r] || []);

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

/** Oyunun etkin dünyası (leagueOf dünya parametresi almadan doğru ligi bulsun); takvim uzunluğu da buradan */
let ACTIVE = null;
export function useWorld(world) {
  ACTIVE = world || null;
  if (world) INDEX_CACHE.delete(world);
  setSeasonWeeks(worldWeeks(world));
  return world;
}

/** Kulübün şu anki ligi (küme düşme/çıkma sonrası değişebilir) */
export const leagueOf = (clubId) => leagueIdIn(ACTIVE, clubId);
export const countryOf = (clubId) => CLUB_BY_ID[clubId]?.country || 'tr';

/** Ligin tur sayısı (takım sayısı ve devre sayısından) */
export const leagueRounds = (world, leagueId) => {
  const lg = world?.leagues?.[leagueId];
  return lg ? fixturesOf(lg).length : roundsFor(LEAGUES[leagueId]?.size || 0, legsOf(leagueId));
};

/** Sezonun hafta sayısı: oyuncunun liginin tur sayısı (en az 22) */
export function weeksFor(world, clubId) {
  const lid = clubId ? leagueIdIn(world, clubId) : null;
  return Math.max(BASE_WEEKS, lid ? leagueRounds(world, lid) : BASE_WEEKS);
}
/** Dünyanın takvimini oyuncunun kulübüne göre kurar */
export function setWorldWeeks(world, clubId) {
  world.weeks = weeksFor(world, clubId);
  if (world === ACTIVE) setSeasonWeeks(world.weeks);
  return world.weeks;
}

/** Varsayılan odak: Türkiye'nin üst iki ligi ve U-17 (oynadığın lig ayrıca eklenir) */
export const DEFAULT_FOCUS = ['super', 'first', 'u17'];

/** Odak ligler (tüm sonuçları saklanır): Türkiye + oynadığın/vatandaşı olduğun ülkenin üst iki kademesi */
export function countryFocus(...ccs) {
  const out = new Set(DEFAULT_FOCUS);
  for (const cc of ccs) {
    if (!cc || cc === 'tr') continue;
    for (const lg of Object.values(LEAGUES)) if (lg.country === cc && !lg.legacy && (lg.youth || lg.level <= 2)) out.add(lg.id);
  }
  return [...out];
}

/** Yapılandırmadaki (yeni dünyada kurulan) ligler */
const activeLeagues = () => Object.values(LEAGUES).filter((l) => !l.legacy);

/** İlk sezon üyeliği: kulüplerin varsayılan ligleri */
function defaultMembership() {
  const teams = {};
  for (const lg of activeLeagues()) teams[lg.id] = [];
  for (const c of ALL_CLUBS) if (c.league && teams[c.league]) teams[c.league].push(c.id);
  return { teams, moves: [], playoffs: {} };
}

/**
 * Yeni sezon dünyası.
 * @param {number} season
 * @param {object|null} prevRatings önceki sezonun kulüp güçleri
 * @param {{prev?:object, focus?:string[], clubId?:string, must?:string[]}} [opts]
 *   prev: önceki dünya (küme düşme/çıkma için); clubId: oyuncunun kulübü (takvim uzunluğu);
 *   must: lige mutlaka alınacak kulüpler (oyuncunun kulübü pasif kalmasın);
 *   noMoves: küme düşme/çıkma yok, kulüpler bulundukları kademede kalır (sezon ortası yapı geçişi)
 */
export function createWorld(season = 1, prevRatings = null, opts = {}) {
  const ratings = Object.fromEntries(ALL_CLUBS.map((c) => [c.id, prevRatings?.[c.id] ?? c.rating]));
  const membership = opts.prev ? promotions(opts.prev, { must: opts.must || (opts.clubId ? [opts.clubId] : []), noMoves: !!opts.noMoves }) : defaultMembership();
  const leagues = {};
  for (const lg of activeLeagues()) {
    const ids = membership.teams[lg.id] || [];
    leagues[lg.id] = {
      id: lg.id,
      legs: lg.legs || 2,
      rr: 'berger',
      teams: ids,
      seed: hashStr(`${season}-${lg.id}-${randInt(0, 1e6)}`),
      table: Object.fromEntries(ids.map((id) => [id, emptyRow(id)])),
      results: [],
      last: [],
      topScorerGoals: 0,
    };
  }
  const focus = [...new Set([...(opts.focus || DEFAULT_FOCUS)])];
  const world = { season, ratings, leagues, focus, moves: membership.moves || [], playoffs: membership.playoffs || {}, v: 3 };
  world.weeks = weeksFor(world, opts.clubId || null);
  return world;
}

const byRating = (world) => (a, b) => clubRating(world, b) - clubRating(world, a);

/**
 * Küme düşme / çıkma (yapılandırmadan) ve lig boyutlarının dengelenmesi.
 *  • Üst kademenin her grubundan son `down` takım düşer.
 *  • Alt kademenin her grubundan ilk `direct` takım çıkar; `playoff` sıraları grup içi play-off oynar,
 *    play-off galibi sayısı `spots`tan fazlaysa galipler kendi aralarında eşleşir.
 *  • Sonra her kademe hedef takım sayısına göre dengelenir (eksikse yeni kulüp/alt kademenin en güçlüsü,
 *    fazlaysa en zayıfı bir alt kademeye) ve gruplara dağıtılır (eski grubunda kalan kulüpler yerini korur).
 * @returns {{teams:Object<string,string[]>, moves:Array<{clubId,from,to,up,playoff?}>, playoffs:Object}}
 */
export function promotions(world, { must = [], noMoves = false } = {}) {
  const teams = {};
  const moves = [];
  const playoffs = {};
  const placed = new Set();
  // gençlik ligleri: üst lig kulüplerinin altyapıları (sabit üyelik, yapılandırmadan)
  for (const lg of Object.values(LEAGUES)) if (lg.youth) teams[lg.id] = ALL_CLUBS.filter((c) => c.league === lg.id).map((c) => c.id);
  for (const [cc, divs] of Object.entries(LEAGUE_SYSTEM)) {
    const N = divs.length;
    // önceki sezonun kademe havuzları
    const pools = Array.from({ length: N + 2 }, () => []);
    const prevGroup = new Map();
    const worldLeagues = (level) => Object.values(world.leagues).filter((lg) => {
      const m = LEAGUES[lg.id];
      return m && !m.youth && m.country === cc && Math.min(m.level, N) === level;
    });
    for (let L = 1; L <= N; L++) {
      for (const lg of worldLeagues(L)) {
        for (const id of lg.teams) {
          if (!CLUB_BY_ID[id] || placed.has(id)) continue;
          if (CLUB_BY_ID[id].inactive && !must.includes(id)) continue; // yapıdan taşan eski kulüp
          pools[L].push(id);
          placed.add(id);
          prevGroup.set(id, lg.id);
        }
      }
    }
    const protectedUp = new Set();
    const protectedDown = new Set();
    // kademeler arası hareketler (önceki sezonun tablolarına göre)
    for (let L = 1; L < N && !noMoves; L++) {
      const upper = divs[L - 1];
      const lower = divs[L];
      if (lower.closed) continue;
      const down = [];
      for (const lg of worldLeagues(L)) {
        const tbl = sortedTable(lg).map((r) => r.id).filter((id) => pools[L].includes(id));
        if (upper.down) down.push(...tbl.slice(-upper.down));
      }
      const up = [];
      const poWinners = [];
      const lowerLeagues = worldLeagues(L + 1);
      for (const lg of lowerLeagues) {
        const tbl = sortedTable(lg).map((r) => r.id).filter((id) => pools[L + 1].includes(id));
        const direct = lower.up?.direct || 0;
        for (const id of tbl.slice(0, direct)) up.push({ id, from: lg.id, playoff: false });
        if (lower.up?.playoff) {
          const [a, b] = lower.up.playoff;
          const po = playoff(world, tbl.slice(a - 1, b));
          playoffs[lg.id] = po;
          if (po.winner) poWinners.push({ id: po.winner, from: lg.id });
        }
      }
      // play-off galipleri kontenjandan fazlaysa gruplar arası eşleşme
      const spots = lower.up?.playoff ? Math.min(lower.up.spots ?? lowerLeagues.length, poWinners.length) : 0;
      let alive = poWinners.slice();
      while (alive.length > spots && alive.length > 1) {
        const next = [];
        for (let i = 0; i + 1 < alive.length; i += 2) {
          const w = playMatch(world, alive[i].id, alive[i + 1].id);
          const win = w === alive[i].id ? alive[i] : alive[i + 1];
          const lose = win === alive[i] ? alive[i + 1] : alive[i];
          (playoffs[win.from].cross ||= []).push([alive[i].id, alive[i + 1].id]);
          (playoffs[lose.from].cross ||= []).push([alive[i].id, alive[i + 1].id]);
          next.push(win);
        }
        if (alive.length % 2) next.push(alive[alive.length - 1]);
        alive = next;
      }
      for (const lg of lowerLeagues) {
        const po = playoffs[lg.id];
        if (po && po.winner && !alive.some((x) => x.id === po.winner)) po.winner = null; // gruplar arası turda elendi
      }
      for (const w of alive.slice(0, spots)) up.push({ id: w.id, from: w.from, playoff: true });
      // uygula
      for (const id of down) {
        pools[L] = pools[L].filter((x) => x !== id);
        pools[L + 1].push(id);
        protectedDown.add(id);
        moves.push({ clubId: id, from: prevGroup.get(id), to: null, up: false });
      }
      for (const u of up) {
        pools[L + 1] = pools[L + 1].filter((x) => x !== u.id);
        pools[L].push(u.id);
        protectedUp.add(u.id);
        moves.push({ clubId: u.id, from: u.from, to: null, up: true, playoff: u.playoff });
      }
    }
    // dengele: yukarıdan aşağı
    // yerleşmemiş kulüpler: önce bu kademenin varsayılan kulüpleri, sonra üst kademelerde yer bulamayanlar
    const fresh = (L) => {
      const free = CLUBS.filter((c) => c.country === cc && !c.inactive && !placed.has(c.id) && (LEAGUES[c.league]?.level || 99) <= L);
      return free.sort((a, b) => (LEAGUES[b.league].level === L) - (LEAGUES[a.league].level === L) || clubRating(world, b.id) - clubRating(world, a.id)).map((c) => c.id);
    };
    for (let L = 1; L <= N; L++) {
      const cap = divisionSize(divs[L - 1]);
      let pool = pools[L];
      if (pool.length < cap) {
        // yeni kulüpler (kademenin varsayılan kulüpleri), sonra alt kademenin en güçlüleri
        for (const id of fresh(L)) {
          if (pool.length >= cap) break;
          pool.push(id);
          placed.add(id);
        }
        if (pool.length < cap && L < N) {
          const cand = pools[L + 1].filter((id) => !protectedDown.has(id)).sort(byRating(world));
          while (pool.length < cap && cand.length) {
            const id = cand.shift();
            pools[L + 1] = pools[L + 1].filter((x) => x !== id);
            pool.push(id);
            moves.push({ clubId: id, from: prevGroup.get(id) || null, to: null, up: true });
          }
        }
      }
      if (pool.length > cap) {
        const keep = new Set(must);
        const sorted = pool.slice().sort((a, b) => (protectedUp.has(a) ? 1 : 0) - (protectedUp.has(b) ? 1 : 0) || clubRating(world, a) - clubRating(world, b));
        const extra = pool.length - cap;
        const out = sorted.filter((id) => !keep.has(id)).slice(0, extra);
        pool = pool.filter((id) => !out.includes(id));
        if (L < N) {
          pools[L + 1].push(...out);
          for (const id of out) moves.push({ clubId: id, from: prevGroup.get(id) || null, to: null, up: false });
        }
      }
      pools[L] = pool;
      // gruplara dağıt: eski grubunda yer varsa orada kalır, diğerleri en boş gruba
      const groups = divisionGroups(divs[L - 1]).map((g, gi) => ({ id: groupLeagueId(cc, L, gi), cap: g.teams, list: [] }));
      const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
      const rest = [];
      for (const id of pool) {
        const g = byId[prevGroup.get(id)];
        if (g && g.list.length < g.cap && !protectedUp.has(id) && !protectedDown.has(id)) g.list.push(id);
        else rest.push(id);
      }
      for (const id of rest.sort(byRating(world))) {
        const g = groups.filter((x) => x.list.length < x.cap).sort((x, y) => (x.list.length - x.cap) - (y.list.length - y.cap) || Math.random() - 0.5)[0] || groups[0];
        g.list.push(id);
      }
      for (const g of groups) teams[g.id] = g.list;
    }
  }
  // hareketlerin hedef ligi
  const where = {};
  for (const [lid, ids] of Object.entries(teams)) for (const id of ids) where[id] = lid;
  const out = [];
  const seen = new Set();
  for (const m of moves.reverse()) {
    if (seen.has(m.clubId)) continue;
    seen.add(m.clubId);
    m.to = where[m.clubId] || null;
    const fromLv = LEAGUES[m.from]?.level;
    const toLv = LEAGUES[m.to]?.level;
    if (!m.to || (fromLv && toLv && fromLv === toLv)) continue;
    out.push(m);
  }
  return { teams, moves: out.reverse(), playoffs };
}

/** Tek maç (play-off): güçlü olan biraz daha şanslı */
function playMatch(world, a, b) {
  const p = 1 / (1 + Math.exp(-(clubRating(world, a) - clubRating(world, b)) / 7));
  return rand() < p ? a : b;
}

/**
 * Play-off: sıralı takımlar (en iyi önce) tek maç eleme oynar; 2'nin kuvveti değilse üst sıradakiler bay geçer.
 * 4 takım: 3.–6. → (3–6, 4–5) yarı final, final. 5 takım: 4.–5. ön tur, sonra yarı final ve final.
 * @returns {{rounds:Array<Array<[string,string]>>, semis:Array<[string,string]>, final:[string,string]|null, winner:string|null, all:string[]}}
 */
export function playoff(world, ids) {
  const all = ids.slice();
  if (ids.length < 2) return { rounds: [], semis: [], final: null, winner: ids[0] || null, all };
  let p = 1;
  while (p < ids.length) p *= 2;
  const rounds = [];
  const m = ids.length - p / 2;
  let alive = ids.slice();
  if (m > 0 && m < p / 2) {
    const byes = alive.slice(0, alive.length - 2 * m);
    const players = alive.slice(alive.length - 2 * m);
    const pairs = [];
    for (let i = 0; i < m; i++) pairs.push([players[i], players[2 * m - 1 - i]]);
    rounds.push(pairs);
    alive = [...byes, ...pairs.map(([a, b]) => playMatch(world, a, b))];
  }
  while (alive.length > 1) {
    const pairs = [];
    const n = alive.length;
    for (let i = 0; i < n / 2; i++) pairs.push([alive[i], alive[n - 1 - i]]);
    rounds.push(pairs);
    alive = pairs.map(([a, b]) => playMatch(world, a, b));
  }
  const final = rounds[rounds.length - 1]?.[0] || null;
  const semis = rounds.length >= 2 ? rounds[rounds.length - 2] : [];
  return { rounds, semis, final, winner: alive[0], all };
}

export const clubRating = (world, id) => world?.ratings?.[id] ?? CLUB_BY_ID[id]?.rating ?? 40;

/** Kulübün bu haftaki lig maçları (tek sayıda takımda bay haftası: boş; sıkışık takvimde iki maç) */
export function fixturesForWeek(world, clubId, week) {
  const lg = world.leagues[leagueIdIn(world, clubId)];
  if (!lg) return [];
  return matchesInWeek(world, lg, week).filter(([h, a]) => h === clubId || a === clubId);
}

/** Kulübün bu haftaki (ilk) lig maçı; maç yoksa null */
export function fixtureFor(world, clubId, week) {
  return fixturesForWeek(world, clubId, week)[0] || null;
}

/** Kulübün sezon fikstürü: [{round, week, h, a}] (byes: bay turları da {round, week, bye:true}) */
export function clubFixtures(world, clubId, { byes = false } = {}) {
  const lg = world.leagues[leagueIdIn(world, clubId)];
  if (!lg) return [];
  const out = [];
  fixturesOf(lg).forEach((round, r) => {
    const m = round.find(([h, a]) => h === clubId || a === clubId);
    if (m) out.push({ round: r, week: weekOfRound(world, lg, r), h: m[0], a: m[1] });
    else if (byes) out.push({ round: r, week: weekOfRound(world, lg, r), bye: true });
  });
  return out;
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
 * Haftanın tüm maçlarını oynatır (her ligin o haftaya düşen turları). Oyuncunun maçı (myResult) verilirse o skor kullanılır.
 * skip: bu hafta oynanmayacak eşleşme(ler) (ertelenen ya da hafta içine alınan maç) — tabloya sonra işlenir.
 * @returns {{[leagueId]: Array<{h,a,hg,ag}>}}
 */
export function simulateWeek(world, week, myResult = null, { skip = null } = {}) {
  const out = {};
  const skips = Array.isArray(skip) ? skip : skip ? [skip] : [];
  for (const lg of Object.values(world.leagues)) {
    const round = matchesInWeek(world, lg, week).filter(([h, a]) => {
      if (skips.some((s) => s.h === h && s.a === a)) { (lg.postponed ||= []).push({ h, a, week }); return false; }
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

/** Tablo bölgeleri yapılandırmadan: kaç takım çıkar / play-off / düşer */
export function zoneRules(leagueId) {
  const lg = LEAGUES[leagueId];
  if (!lg || lg.youth || lg.legacy) return { up: 0, po: null, down: 0 };
  const up = lg.up && !lg.closed && lg.level > 1 ? lg.up.direct || 0 : 0;
  const po = lg.up && !lg.closed && lg.level > 1 && lg.up.playoff ? lg.up.playoff : null;
  const below = LEAGUE_SYSTEM[lg.country]?.[lg.level];
  const down = below && !below.closed ? lg.down || 0 : 0;
  return { up, po, down };
}

/** Sezon sonu: kulüp güçleri biraz değişir (sıralamaya göre; yükselen güçlenir, düşen zayıflar). */
export function evolveRatings(world) {
  const next = { ...world.ratings };
  const moved = new Map((world.moves || []).map((m) => [m.clubId, m.up]));
  for (const lg of Object.values(world.leagues)) {
    const table = sortedTable(lg);
    const n = table.length;
    const band = Math.max(1, Math.round(n * 0.15));
    table.forEach((row, i) => {
      const trend = i < band ? 1 : i >= n - band ? -1 : 0;
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

/** Ligdeki yapay gol kralının gol sayısı (ödül karşılaştırması için; maç sayısına göre ölçeklenir). */
export function aiTopScorerGoals(leagueId, world = ACTIVE) {
  const tier = LEAGUES[leagueId]?.tier || 2;
  const games = world?.leagues?.[leagueId] ? Math.max(1, (world.leagues[leagueId].teams.length - 1) * lgLegs(world.leagues[leagueId])) : 22;
  const base = tier === 1 ? randInt(19, 27) : randInt(16, 23);
  return Math.round(base * Math.sqrt(games / 22));
}

/**
 * Eski kayıt göçü: eksik ligleri ekler ve mevcut haftaya kadar oynatır (tablolar tutarlı olsun).
 * v2 dünyalar (12 takımlı eski yapı) süren sezonu öyle bitirir; yeni yapı bir sonraki sezon kurulur.
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
      const res = matchesInWeek(world, lg, w).map(([h, a]) => {
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
  if (leagueId && !world.focus.includes(leagueId)) world.focus.push(leagueId);
}

export { SEASON_WEEKS };
