// KUPALAR — ülke kupası (Türkiye Kupası vb.) ve Süper Kupa.
//  • Kupa: ülkenin en güçlü 32 kulübü (alt ligler dahil), tek maç eleme. Turlar lig haftalarının arasında (hafta içi):
//    Son 32 (3. hafta), Son 16 (7), Çeyrek (11), Yarı (15), Final (19). Berabere biterse penaltılar.
//  • Senin kulübünün maçı kulüp maçı gibi oynanır (canlı anlatım + kritik anlar). Diğer eşleşmeler simüle edilir.
//  • Süper Kupa: sezon başında lig şampiyonu ile kupa şampiyonu (aynıysa lig ikincisi) karşılaşır.
import { CLUB_BY_ID, COUNTRY_BY_ID, LEAGUES } from './data.js';
import { chance, clamp, poisson, randInt, shuffle } from './rng.js';
import { clubRating, goalLambda, sortedTable } from './league.js';
import { changeFame, changeMorale, changeRel } from './player.js';
import { planMatch, finalizeMatch } from './match.js';

export const CUP_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'f'];
export const CUP_WEEK = { r32: 3, r16: 7, qf: 11, sf: 15, f: 19 };
export const ROUND_LABEL = { r32: 'Son 32', r16: 'Son 16', qf: 'Çeyrek final', sf: 'Yarı final', f: 'Final', super: 'Süper Kupa' };

export function cupName(country) {
  if (country === 'tr') return 'Türkiye Kupası';
  return `${COUNTRY_BY_ID[country]?.name || 'Ülke'} Kupası`;
}
export const superName = (country) => (country === 'tr' ? 'Türkiye Süper Kupası' : `${COUNTRY_BY_ID[country]?.name || ''} Süper Kupası`);

const countryClubs = (world, cc) => Object.values(world.leagues)
  .filter((lg) => LEAGUES[lg.id]?.country === cc && !LEAGUES[lg.id]?.youth)
  .flatMap((lg) => sortedTable(lg).map((r) => r.id));

/** Sezonun kupasını kurar (kulübün ülkesinde) */
export function createCup(state) {
  const cc = CLUB_BY_ID[state.career.clubId]?.country || 'tr';
  const ids = [...new Set(countryClubs(state.world, cc))].filter((id) => CLUB_BY_ID[id]);
  if (ids.length < 8) { state.cup = null; return null; }
  const ranked = ids.sort((a, b) => clubRating(state.world, b) - clubRating(state.world, a));
  const size = ranked.length >= 32 ? 32 : 16;
  let field = ranked.slice(0, size);
  // Kendi kulübün her zaman kupada (alt lig takımları da kupaya katılır)
  if (!field.includes(state.career.clubId) && ids.includes(state.career.clubId)) field[field.length - 1] = state.career.clubId;
  field = shuffle(field);
  const first = size === 32 ? 'r32' : 'r16';
  const ties = [];
  for (let i = 0; i < field.length; i += 2) ties.push({ h: field[i], a: field[i + 1], hg: null, ag: null, pens: null, w: null });
  state.cup = { season: state.calendar.season, country: cc, name: cupName(cc), rounds: { [first]: ties }, current: first, out: null, winner: null, myResults: [] };
  return state.cup;
}

export function ensureCup(state) {
  if (!state.career?.clubId || !state.world) return null;
  if (!state.cup || state.cup.season !== state.calendar.season) createCup(state);
  return state.cup;
}

function simTie(world, t, final = false) {
  const hr = clubRating(world, t.h);
  const ar = clubRating(world, t.a);
  t.hg = poisson(goalLambda(hr, ar, !final));
  t.ag = poisson(goalLambda(ar, hr, false));
  if (t.hg === t.ag) {
    const ph = clamp(0.5 + (hr - ar) / 120, 0.25, 0.75);
    t.pens = chance(ph) ? [randInt(4, 5), randInt(2, 3)] : [randInt(2, 3), randInt(4, 5)];
  }
  t.w = t.hg > t.ag || (t.pens && t.pens[0] > t.pens[1]) ? t.h : t.a;
  return t;
}

const myTieOf = (cup, round, clubId) => cup?.rounds?.[round]?.find((t) => t.h === clubId || t.a === clubId) || null;

/**
 * Lig haftası bitince (endWeek): bu hafta kupa turu varsa diğer eşleşmeleri oynatır; senin maçın için pending.cupTie.
 */
export function cupOnWeekEnd(state, week) {
  const cup = ensureCup(state);
  if (!cup || cup.winner) return null;
  const round = cup.current;
  if (CUP_WEEK[round] !== week) return null;
  const ties = cup.rounds[round];
  const mine = myTieOf(cup, round, state.career.clubId);
  for (const t of ties) if (t !== mine && t.w == null) simTie(state.world, t, round === 'f');
  if (mine && !cup.out) {
    state.pending.cupTie = { kind: 'cup', round, h: mine.h, a: mine.a, name: cup.name, season: cup.season };
    return state.pending.cupTie;
  }
  advanceCup(state);
  return null;
}

/** Tur bitince sonraki turun eşleşmeleri */
function advanceCup(state) {
  const cup = state.cup;
  const round = cup.current;
  const ties = cup.rounds[round];
  if (ties.some((t) => t.w == null)) return;
  if (round === 'f') {
    cup.winner = ties[0].w;
    cup.current = null;
    return;
  }
  const next = CUP_ROUNDS[CUP_ROUNDS.indexOf(round) + 1];
  const winners = shuffle(ties.map((t) => t.w));
  const nt = [];
  for (let i = 0; i < winners.length; i += 2) nt.push({ h: winners[i], a: winners[i + 1], hg: null, ag: null, pens: null, w: null });
  cup.rounds[next] = nt;
  cup.current = next;
}

/** Kupa maçının planı (kulüp maçı formatında) */
export function planCupMatch(state) {
  const tie = state.pending.cupTie;
  if (!tie) return null;
  const isFinal = tie.round === 'f' || tie.kind === 'super';
  const title = tie.kind === 'super' ? superName(state.cup?.country || 'tr') : `${tie.name} · ${ROUND_LABEL[tie.round]}`;
  const m = planMatch(state, {
    homeId: tie.h, awayId: tie.a,
    id: `cup-${tie.season}-${tie.kind}-${tie.round}`,
    cup: { kind: tie.kind, round: tie.round, name: title },
    knockout: true,
    big: isFinal ? { kind: 'final', title, nerves: 0.38, tempo: 1.15, skillMult: 0.95, cool: false } : null,
  });
  return m;
}

/**
 * Kupa maçı bitti: oyuncu istatistikleri (finalizeMatch), penaltılar, tur ilerlemesi, ödül.
 * shootout: (beraberlikte) oyuncunun penaltı sonucu {success} — yoksa simüle edilir.
 */
export function completeCupMatch(state, match, shootout = null) {
  const tie = state.pending.cupTie;
  const summary = finalizeMatch(state, match);
  const cup = ensureCup(state);
  const { my, opp } = match.score;
  let pens = null;
  if (my === opp) {
    const edge = (match.myR - match.oppR) / 120 + (shootout ? (shootout.success ? 0.18 : -0.18) : 0);
    const win = chance(clamp(0.5 + edge, 0.15, 0.85));
    pens = win ? [randInt(4, 5), randInt(2, 3)] : [randInt(2, 3), randInt(4, 5)];
  }
  const won = my > opp || !!(pens && pens[0] > pens[1]);
  const myId = state.career.clubId;
  const p = state.player;
  let award = null;
  if (tie?.kind === 'super') {
    state.pending.cupTie = null;
    if (won) {
      award = { season: state.calendar.season, title: superName(cup?.country || 'tr'), icon: 'trophy', club: myId };
      state.career.awards.push(award);
      changeFame(p, 3);
      changeRel(p, 'fans', 4);
      changeMorale(p, 8);
    }
    return { summary, won, pens, award, round: 'super', out: !won };
  }
  if (cup && tie) {
    const t = myTieOf(cup, tie.round, myId);
    if (t) {
      const home = t.h === myId;
      t.hg = home ? my : opp;
      t.ag = home ? opp : my;
      t.pens = pens ? (home ? pens : [pens[1], pens[0]]) : null;
      t.w = won ? myId : home ? t.a : t.h;
    }
    cup.myResults.push({ round: tie.round, opp: match.oppId, my, opp_goals: opp, pens, won });
    if (!won) cup.out = tie.round;
    state.pending.cupTie = null;
    advanceCup(state);
    if (won && tie.round === 'f') {
      award = { season: state.calendar.season, title: `${cup.name} Şampiyonu`, icon: 'trophy', club: myId };
      state.career.awards.push(award);
      state.career.money += Math.round((state.career.contract?.wage || 500) * 2);
      changeFame(p, 5);
      changeRel(p, 'fans', 6);
      changeMorale(p, 12);
    } else if (won) changeMorale(p, 3);
  }
  return { summary, won, pens, award, round: tie?.round, out: !won };
}

/** Sezon sonu: kalan turları tamamla (elendiyse) ve Süper Kupa eşleşmesini hazırla */
export function cupSeasonEnd(state, leagueChampion, runnerUp) {
  const cup = state.cup;
  if (cup && !cup.winner) {
    let guard = 0;
    while (!cup.winner && guard++ < 6) {
      for (const t of cup.rounds[cup.current] || []) if (t.w == null) simTie(state.world, t, cup.current === 'f');
      advanceCup(state);
    }
  }
  const cupWinner = cup?.winner || null;
  const b = cupWinner && cupWinner !== leagueChampion ? cupWinner : runnerUp;
  state.lastCup = cup ? { season: cup.season, name: cup.name, winner: cupWinner, country: cup.country } : null;
  return leagueChampion && b ? { a: leagueChampion, b } : null;
}

/** Yeni sezon başında: kulübün Süper Kupa'daysa pending.cupTie */
export function scheduleSuperCup(state, pair) {
  if (!pair) return null;
  const me = state.career.clubId;
  if (pair.a !== me && pair.b !== me) return null;
  state.pending.cupTie = { kind: 'super', round: 'super', h: pair.a, a: pair.b, name: superName(CLUB_BY_ID[me]?.country || 'tr'), season: state.calendar.season };
  return state.pending.cupTie;
}

export const myCupStatus = (state) => {
  const cup = state.cup;
  if (!cup) return null;
  if (cup.winner === state.career.clubId) return 'Şampiyon';
  if (cup.out) return `${ROUND_LABEL[cup.out]}'de elendi`;
  if (cup.winner) return 'Kupa bitti';
  return `${ROUND_LABEL[cup.current]} (H${CUP_WEEK[cup.current]})`;
};

