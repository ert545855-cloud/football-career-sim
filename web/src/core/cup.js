// KUPALAR — ülke kupası (Türkiye Kupası vb.) ve Süper Kupa.
//  • Kupa: ülkenin en güçlü 64'e kadar kulübü (alt ligler dahil), tek maç eleme.
//    Ön Eleme (2. hafta, güçlü kulüpler bay geçer) → Son 32 (4) → Son 16 (8) → Çeyrek final (12) → Yarı final (15) → Final (19).
//    Turlar lig haftalarının arasında, hafta içi oynanır: lig maçından sonra otomatik başlamaz, ana ekranda ayrı maç olarak bekler.
//  • Senin kulübünün maçı kulüp maçı gibi oynanır (canlı yayın + kritik anlar). Diğer eşleşmeler simüle edilir.
//  • Süper Kupa: sezon başında lig şampiyonu ile kupa şampiyonu (aynıysa lig ikincisi) karşılaşır.
import { CLUB_BY_ID, COUNTRY_BY_ID, LEAGUES } from './data.js';
import { chance, clamp, poisson, randInt, shuffle } from './rng.js';
import { applyMakeup, clubRating, goalLambda, sortedTable } from './league.js';
import { changeFame, changeMorale, changeRel } from './player.js';
import { planMatch, finalizeMatch } from './match.js';

export const CUP_ROUNDS = ['pre', 'r32', 'r16', 'qf', 'sf', 'f'];
export const CUP_WEEK = { pre: 2, r32: 4, r16: 8, qf: 12, sf: 15, f: 19 };
export const ROUND_LABEL = { pre: 'Ön eleme', r32: 'Son 32', r16: 'Son 16', qf: 'Çeyrek final', sf: 'Yarı final', f: 'Final', super: 'Süper Kupa' };

export function cupName(country) {
  if (country === 'tr') return 'Türkiye Kupası';
  return `${COUNTRY_BY_ID[country]?.name || 'Ülke'} Kupası`;
}
export const superName = (country) => (country === 'tr' ? 'Türkiye Süper Kupası' : `${COUNTRY_BY_ID[country]?.name || ''} Süper Kupası`);

const countryClubs = (world, cc) => Object.values(world.leagues)
  .filter((lg) => LEAGUES[lg.id]?.country === cc && !LEAGUES[lg.id]?.youth)
  .flatMap((lg) => sortedTable(lg).map((r) => r.id));

/** Sezonun kupasını kurar (kulübün ülkesinde): en güçlüler bay geçer, diğerleri ön elemede eşleşir */
export function createCup(state) {
  const cc = CLUB_BY_ID[state.career.clubId]?.country || 'tr';
  const ids = [...new Set(countryClubs(state.world, cc))].filter((id) => CLUB_BY_ID[id]);
  if (ids.length < 8) { state.cup = null; return null; }
  const ranked = ids.sort((a, b) => clubRating(state.world, b) - clubRating(state.world, a));
  const mk = (list) => { const out = []; for (let i = 0; i < list.length; i += 2) out.push({ h: list[i], a: list[i + 1], hg: null, ag: null, pens: null, w: null }); return out; };
  // Kendi kulübün her zaman kupada (alt lig takımları da katılır)
  const ensureMe = (field) => { if (!field.includes(state.career.clubId) && ids.includes(state.career.clubId)) field[field.length - 1] = state.career.clubId; return field; };
  let cup;
  if (ranked.length >= 34) {
    const n = Math.min(64, ranked.length - (ranked.length % 2));
    const extra = n - 32; // ön elemede elenecek takım sayısı
    let field = ensureMe(ranked.slice(0, n));
    const byes = field.slice(0, 32 - extra);
    const pre = shuffle(field.slice(32 - extra));
    cup = { rounds: { pre: mk(pre) }, current: 'pre', byes };
  } else {
    const size = ranked.length >= 32 ? 32 : 16;
    const field = shuffle(ensureMe(ranked.slice(0, size)));
    const first = size === 32 ? 'r32' : 'r16';
    cup = { rounds: { [first]: mk(field) }, current: first, byes: [] };
  }
  state.cup = { season: state.calendar.season, country: cc, name: cupName(cc), ...cup, out: null, winner: null, myResults: [] };
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
  // ön elemeden çıkanlar bay geçen güçlü kulüplerle birleşir
  const winners = shuffle([...ties.map((t) => t.w), ...(round === 'pre' ? cup.byes || [] : [])]);
  const nt = [];
  for (let i = 0; i < winners.length; i += 2) nt.push({ h: winners[i], a: winners[i + 1], hg: null, ag: null, pens: null, w: null });
  cup.rounds[next] = nt;
  cup.current = next;
}

/** Kupa maçının planı (kulüp maçı formatında) */
export function planCupMatch(state) {
  const tie = state.pending.cupTie;
  if (!tie) return null;
  if (tie.kind === 'makeup') {
    // ertelenen lig maçı: lig maçı gibi (beraberlik olabilir)
    return planMatch(state, { homeId: tie.h, awayId: tie.a, id: `makeup-${tie.season}-${tie.week}`, cup: { kind: 'makeup', round: 'makeup', name: `Ertelenen maç · ${tie.week}. hafta` } });
  }
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
  if (tie?.kind === 'makeup') {
    const hg = match.isHome ? match.score.my : match.score.opp;
    const ag = match.isHome ? match.score.opp : match.score.my;
    applyMakeup(state.world, tie.h, tie.a, hg, ag);
    state.pending.cupTie = null;
    const won = match.score.my > match.score.opp;
    return { summary, won, draw: match.score.my === match.score.opp, pens: null, award: null, round: 'makeup', makeup: true, out: false };
  }
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
    while (!cup.winner && guard++ < 8) {
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
  if (cup.current === 'pre' && (cup.byes || []).includes(state.career.clubId)) return `Son 32'den başlıyor (H${CUP_WEEK.r32})`;
  return `${ROUND_LABEL[cup.current]} (H${CUP_WEEK[cup.current]})`;
};

/** Bekleyen (hafta içi) kupa maçı için kısa etiket */
export const cupTieLabel = (tie) => (tie?.kind === 'super' ? 'Süper Kupa' : tie?.kind === 'makeup' ? 'ertelenen lig maçı' : `${tie?.name || 'Kupa'} · ${ROUND_LABEL[tie?.round] || ''}`);

