// YAŞAYAN DÜNYA — kişisel rakip, kulüp başkanı (seçim, mali kriz) ve dünya yıldızlarının transferleri/emeklilikleri.
// Tüm isimler kurgusaldır.
import { CLUB_BY_ID, COUNTRY_BY_ID, LEAGUES } from './data.js';
import { chance, clamp, pick, rand, randInt, round1, shuffle } from './rng.js';
import { clubRating, leagueOf, sortedTable } from './league.js';
import { randomName } from './world/names.js';
import { changeMorale, changeRel, ovr } from './player.js';
import { ensureBallon } from './ballondor.js';

const langOf = (clubId) => COUNTRY_BY_ID[CLUB_BY_ID[clubId]?.country || 'tr']?.lang || 'tr';

// ─────────────────────────── Rakip ───────────────────────────
/** Aynı yaşta, aynı mevkide, başka bir kulüpte oynayan kişisel rakip */
export function ensureRival(state) {
  const p = state.player;
  if (state.rival && state.rival.alive !== false) return state.rival;
  const myLg = leagueOf(state.career.clubId);
  const lg = state.world.leagues[myLg];
  const pool = (lg ? sortedTable(lg).map((r) => r.id) : []).filter((id) => id !== state.career.clubId);
  const clubId = pool.length ? pick(pool) : state.career.clubId;
  state.rival = {
    name: randomName(langOf(clubId)),
    position: p.position,
    age: p.age + pick([-1, 0, 0, 1]),
    clubId,
    ovr: ovr(p) + randInt(-2, 3),
    season: { goals: 0, assists: 0, apps: 0, rating: 0 },
    totals: { goals: 0, assists: 0, apps: 0 },
    h2h: { w: 0, d: 0, l: 0 },
    heat: 40, // rekabet sıcaklığı (manşetler)
    alive: true,
  };
  return state.rival;
}

/** Haftalık: rakibin maçı (simüle), aynı maçtaysanız kafa kafaya */
export function rivalOnMatch(state, summary, match) {
  const r = ensureRival(state);
  if (!r || r.retired) return null;
  const s = r.season;
  s.apps++;
  const g = { FW: 0.45, MF: 0.16, DF: 0.05 }[r.position] * (0.6 + (r.ovr - 50) / 60);
  const goals = Math.max(0, Math.round(rand(0, 1) < g ? 1 + (rand(0, 1) < g * 0.3 ? 1 : 0) : 0));
  const assists = rand(0, 1) < g * 0.6 ? 1 : 0;
  s.goals += goals;
  s.assists += assists;
  s.rating = round1(((s.rating * (s.apps - 1)) + clamp(6.4 + (r.ovr - 60) / 20 + goals * 0.8 + rand(-0.6, 0.6), 4.5, 9.5)) / s.apps);
  r.totals.apps++;
  r.totals.goals += goals;
  r.totals.assists += assists;
  let h2h = null;
  if (match && (match.oppId === r.clubId)) {
    const res = summary.result;
    r.h2h[res === 'W' ? 'w' : res === 'D' ? 'd' : 'l']++;
    r.heat = clamp(r.heat + 12, 0, 100);
    h2h = { res, rivalGoals: goals, myGoals: summary.goals };
  }
  return { goals, assists, h2h };
}

/** Sezon sonu: rakip gelişir, bazen transfer olur */
export function rivalSeasonEnd(state) {
  const r = state.rival;
  if (!r) return null;
  r.age++;
  r.ovr = clamp(r.ovr + (r.age <= 23 ? randInt(1, 4) : r.age <= 29 ? randInt(-1, 2) : randInt(-3, 0)), 30, 92);
  const out = { name: r.name, last: { ...r.season } };
  r.season = { goals: 0, assists: 0, apps: 0, rating: 0 };
  if (r.age >= 36 && chance(0.5)) { r.retired = true; out.retired = true; return out; }
  if (chance(0.25)) {
    // daha güçlü bir kulübe transfer
    const cands = Object.values(CLUB_BY_ID).filter((c) => clubRating(state.world, c.id) > clubRating(state.world, r.clubId) && clubRating(state.world, c.id) <= r.ovr + 10);
    if (cands.length) { r.clubId = pick(cands).id; out.moved = r.clubId; }
  }
  return out;
}

// ─────────────────────────── Başkan ───────────────────────────
export function ensurePresident(state) {
  const clubId = state.career.clubId;
  if (!state.board || state.board.clubId !== clubId) {
    state.board = {
      clubId,
      president: randomName(langOf(clubId)),
      approval: randInt(45, 70),
      nextElection: state.calendar.season + randInt(1, 3),
      crisis: null,
      elections: [],
    };
  }
  return state.board;
}

/** Haftalık: başkanın onayı; zayıf kulüplerde mali kriz olasılığı */
export function boardOnMatch(state, summary) {
  const b = ensurePresident(state);
  b.approval = clamp(b.approval + (summary.result === 'W' ? 2 : summary.result === 'L' ? -3 : 0), 0, 100);
  if (b.crisis) {
    b.crisis.weeks -= 1;
    if (b.crisis.weeks <= 0) {
      // geciken maaşlar ödenir
      state.career.money += b.crisis.owed || 0;
      const owed = b.crisis.owed;
      b.crisis = null;
      return { crisisEnd: owed };
    }
    return null;
  }
  const r = clubRating(state.world, state.career.clubId);
  const pCrisis = (r < 60 ? 0.025 : 0.008) + (b.approval < 30 ? 0.02 : 0);
  if (state.calendar.week >= 4 && chance(pCrisis)) {
    b.crisis = { weeks: randInt(2, 3), owed: 0, s: state.calendar.season, w: state.calendar.week };
    return { crisisStart: b.crisis };
  }
  return null;
}

/** Mali kriz sürerken maaş ödenmez (sonra toplu ödenir) — weeklyFinance'tan önce çağrılır */
export function withheldWage(state) {
  const b = state.board;
  if (!b?.crisis || b.clubId !== state.career.clubId) return 0;
  const w = state.career.contract?.wage || 0;
  b.crisis.owed = (b.crisis.owed || 0) + w;
  return w;
}

/** Sezon sonu seçim gerekiyorsa adaylar */
export function electionDue(state) {
  const b = ensurePresident(state);
  return state.calendar.season >= b.nextElection;
}

const PROMISES = [
  { id: 'star', text: 'Dünya yıldızı transferi ve şampiyonluk', fans: 1 },
  { id: 'academy', text: 'Altyapıya ve gençlere yatırım', fans: 0 },
  { id: 'debt', text: 'Borçları kapatıp mali disiplin', fans: -1 },
  { id: 'stadium', text: 'Yeni stadyum projesi', fans: 1 },
];

export function makeElection(state) {
  const b = ensurePresident(state);
  const challenger = randomName(langOf(state.career.clubId));
  const promise = pick(PROMISES);
  const pInc = clamp(b.approval / 100 + rand(-0.15, 0.15), 0.1, 0.9);
  const e = { s: state.calendar.season, incumbent: b.president, challenger, promise, pInc };
  state.pending.election = e;
  return e;
}

/** Seçim sonucu; choice: 'inc' | 'chal' | 'neutral' */
export function resolveElection(state, choice) {
  const e = state.pending.election;
  if (!e) return null;
  state.pending.election = null;
  const b = ensurePresident(state);
  // açıkça destek vermek az da olsa sonucu etkiler (ünlüysen daha çok)
  const sway = (state.player.fame || 0) / 600;
  const p = clamp(e.pInc + (choice === 'inc' ? sway : choice === 'chal' ? -sway : 0), 0.05, 0.95);
  const incWins = chance(p);
  const winner = incWins ? e.incumbent : e.challenger;
  let boardD = 0;
  if (choice !== 'neutral') boardD = (choice === 'inc') === incWins ? 10 : -12;
  if (boardD) changeRel(state.player, 'board', boardD);
  if (!incWins) { b.president = e.challenger; b.approval = 62; b.promise = e.promise.id; }
  else b.approval = clamp(b.approval + 5, 0, 100);
  b.nextElection = state.calendar.season + 3;
  b.elections.unshift({ s: e.s, winner, choice });
  if (e.promise.id === 'star' && !incWins) changeMorale(state.player, 3);
  return { winner, incWins, boardD };
}

// ─────────────────────────── Dünya yıldızları ───────────────────────────
const BIG_LEAGUES = ['en1', 'es1', 'de1', 'it1', 'fr1'];

/** Yıldızlara kulüp ata (bir kez) */
function ensureStarClubs(state) {
  const b = ensureBallon(state);
  const bigClubs = Object.values(CLUB_BY_ID).filter((c) => BIG_LEAGUES.includes(c.league)).sort((x, y) => clubRating(state.world, y.id) - clubRating(state.world, x.id)).slice(0, 24);
  for (const st of b.pool) if (!st.clubId || !CLUB_BY_ID[st.clubId]) st.clubId = pick(bigClubs)?.id || null;
  return { b, bigClubs };
}

/**
 * Transfer pencerelerinde (devre arası ve sezon sonu) yıldız transferleri; sezon sonunda yaşlı yıldızlar emekli,
 * yerlerine genç yetenekler. Haber metinleri döner.
 */
export function worldStarsWindow(state, kind = 'mid') {
  const { b, bigClubs } = ensureStarClubs(state);
  const news = [];
  const movers = shuffle(b.pool.filter((p) => p.star || p.r >= 84)).slice(0, kind === 'end' ? 3 : 1);
  for (const st of movers) {
    if (!chance(kind === 'end' ? 0.6 : 0.35)) continue;
    const to = pick(bigClubs.filter((c) => c.id !== st.clubId));
    if (!to) continue;
    const fee = Math.round((40 + (st.r - 80) * 9 + rand(-10, 25)) * (st.age <= 26 ? 1.3 : 0.8));
    news.push(`Dünya futbolu: ${st.name}, ${CLUB_BY_ID[st.clubId]?.name || 'kulübünden'} ${to.name} formasına! Bonservis €${Math.max(15, fee)} milyon.`);
    st.clubId = to.id;
  }
  if (kind === 'end') {
    for (const st of b.pool) {
      st.age = (st.age || 25) + 1;
      if (st.age >= 34 && chance(0.4)) {
        news.push(`${st.name} ${st.age} yaşında futbolu bıraktı. Bir devir kapandı.`);
        const young = { ...st, name: randomName(pick(['es', 'pt', 'fr', 'de', 'en', 'it'])), age: randInt(18, 20), r: randInt(82, 87), pts: 0, clubId: pick(bigClubs)?.id, star: true, id: `${st.id}y${state.calendar.season}` };
        Object.assign(st, young);
        news.push(`Yeni harika çocuk: ${st.name} (${st.age}) Avrupa'nın gündeminde.`);
      } else if (st.age <= 27) st.r = clamp(st.r + randInt(0, 2), 70, 95);
      else if (st.age >= 31) st.r = clamp(st.r - randInt(0, 2), 70, 95);
    }
  }
  return news;
}

export const presidentLabel = (b) => (b.approval >= 65 ? 'Güçlü' : b.approval >= 40 ? 'Dengede' : 'Tartışmalı');
export { LEAGUES };
