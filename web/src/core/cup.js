// KUPALAR — ülke kupası (Türkiye Kupası vb.) ve Süper Kupa.
//  • Biçim (ülkedeki kulüp sayısına göre):
//      24+ kulüp: alt liglerin Ön Elemesi (gerekirse iki tur) → 6 grup × 4 takım (tek devre, 3 maç) →
//      grup 1. ve 2.leri + en iyi 4 grup üçüncüsü = Son 16 → Çeyrek final → Yarı final → Final
//      72+ kulüp: 12 grup → ilk 2'ler + en iyi 8 üçüncü = Son 32;  16–23 kulüp: 3 grup → ilk 2 + en iyi 2 üçüncü = çeyrek final
//  • En güçlü kulüpler (üst lig) doğrudan gruptan başlar; alt lig kulüpleri ön elemede tek maç oynar
//    (Türkiye'de 1. ön elemede 3. ve 4. lig, 2. ön elemede onların galipleri ile 2. lig).
//  • Eleme ağacı (şablon) baştan bellidir: ilk eleme turunun eşleşmeleri gruplar bitince kurayla yerleşir,
//    sonraki turlar ağaçtaki komşu eşleşmelerin galipleriyle oynanır. Turlar hafta içi oynanır.
//  • Senin kulübünün maçı canlı yayınla oynanır; diğerleri simüle edilir. Grup maçlarında beraberlik olur;
//    eleme maçlarında berabere biterse penaltılar.
//  • Süper Kupa: sezon başında lig şampiyonu ile kupa şampiyonu (aynıysa lig ikincisi) karşılaşır.
import { CLUB_BY_ID, COUNTRY_BY_ID, LEAGUES } from './data.js';
import { chance, clamp, poisson, randInt, shuffle } from './rng.js';
import { applyMakeup, clubRating, goalLambda, sortedTable } from './league.js';
import { changeFame, changeMorale, changeRel } from './player.js';
import { planMatch, finalizeMatch } from './match.js';

export const CUP_STAGES = ['pre1', 'pre2', 'g1', 'g2', 'g3', 'r32', 'r16', 'qf', 'sf', 'f'];
export const KO_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'f'];
export const CUP_WEEK = { pre1: 2, pre2: 4, g1: 5, g2: 7, g3: 9, r32: 12, r16: 13, qf: 15, sf: 17, f: 19 };
export const ROUND_LABEL = {
  pre1: '1. Ön eleme', pre2: 'Ön eleme', pre: 'Ön eleme', g1: 'Grup 1. maç', g2: 'Grup 2. maç', g3: 'Grup 3. maç', groups: 'Grup aşaması',
  r32: 'Son 32', r16: 'Son 16', qf: 'Çeyrek final', sf: 'Yarı final', f: 'Final', super: 'Süper Kupa', makeup: 'Ertelenen maç',
};
/** Turun adı (iki ön eleme turu varsa 2. tur "2. Ön eleme") */
export const roundLabel = (cup, st) => (st === 'pre2' && cup?.pre?.pre1 ? '2. Ön eleme' : ROUND_LABEL[st] || '');
/** Eski adlar (arayüz uyumu) */
export const CUP_ROUNDS = CUP_STAGES;
const GL = 'ABCDEFGHIJKL';
export const isGroupStage = (st) => st === 'g1' || st === 'g2' || st === 'g3';
const isPre = (st) => st === 'pre1' || st === 'pre2';
const mdOf = (st) => Number(st?.[1]) || 0;

export function cupName(country) {
  if (country === 'tr') return 'Türkiye Kupası';
  return `${COUNTRY_BY_ID[country]?.name || 'Ülke'} Kupası`;
}
export const superName = (country) => (country === 'tr' ? 'Türkiye Süper Kupası' : `${COUNTRY_BY_ID[country]?.name || ''} Süper Kupası`);

const countryClubs = (world, cc) => Object.values(world.leagues)
  .filter((lg) => LEAGUES[lg.id]?.country === cc && !LEAGUES[lg.id]?.youth)
  .flatMap((lg) => sortedTable(lg).map((r) => r.id));

const tie = (h, a) => ({ h, a, hg: null, ag: null, pens: null, w: null });
const slot = (label) => ({ h: null, a: null, hl: label[0], al: label[1], hg: null, ag: null, pens: null, w: null });

/** Biçim: kulüp sayısına göre grup sayısı, en iyi üçüncü sayısı ve elemenin başladığı tur */
function formatFor(n) {
  if (n >= 72) return { groups: 12, ko: 'r32', thirds: 8 };
  if (n >= 24) return { groups: 6, ko: 'r16', thirds: 4 };
  if (n >= 16) return { groups: 3, ko: 'qf', thirds: 2 };
  return { groups: 0, ko: 'qf', thirds: 0 };
}

const pairUp = (list) => { const sh = shuffle(list); const out = []; for (let i = 0; i + 1 < sh.length; i += 2) out.push(tie(sh[i], sh[i + 1])); return out; };

/** Sezonun kupasını kurar. Kurulduğu hafta geçmiş turlar varsa (yeni kulüp, eski kayıt) onları simüle eder. */
export function createCup(state) {
  const cc = CLUB_BY_ID[state.career.clubId]?.country || 'tr';
  const ids = [...new Set(countryClubs(state.world, cc))].filter((id) => CLUB_BY_ID[id]);
  if (ids.length < 8) { state.cup = null; return null; }
  const ranked = ids.sort((a, b) => clubRating(state.world, b) - clubRating(state.world, a));
  const me = state.career.clubId;
  const F = formatFor(ranked.length);
  const G = F.groups * 4;
  const base = { v: 2, season: state.calendar.season, country: cc, name: cupName(cc), format: F, pre: null, preByes: {}, direct: [], groups: [], rounds: {}, out: null, winner: null, myResults: [] };
  if (!F.groups) {
    // az kulüp: en güçlü 8 kulüp doğrudan çeyrek finalde
    const field = ranked.slice(0, 8);
    if (!field.includes(me) && ranked.includes(me)) field[7] = me;
    const sh = shuffle(field);
    base.rounds = koTemplate({ ko: 'qf', groups: 4 });
    base.rounds.qf.forEach((t, i) => Object.assign(t, { h: sh[i * 2], a: sh[i * 2 + 1] }));
    base.stage = 'qf';
  } else {
    const D = G / 2; // doğrudan gruptan başlayan
    const T = G - D; // ön elemeden gelecek
    const used = ranked.slice(0, Math.min(ranked.length, D + 4 * T));
    if (!used.includes(me) && ranked.includes(me)) used[used.length - 1] = me;
    base.direct = used.slice(0, D);
    const rest = used.slice(D); // güçlüden zayıfa
    const M = rest.length;
    if (M > T) {
      base.pre = {};
      if (M > 2 * T) {
        // iki tur: en zayıflar 1. ön elemede, kalanlar 2. ön elemede onları bekler
        const n1 = 2 * (M - 2 * T);
        base.pre.pre1 = pairUp(rest.slice(M - n1));
        base.preByes.pre2 = rest.slice(0, M - n1);
        base.stage = 'pre1';
      } else {
        const n2 = 2 * (M - T);
        base.pre.pre2 = pairUp(rest.slice(M - n2));
        base.preByes.g1 = rest.slice(0, M - n2);
        base.stage = 'pre2';
      }
    } else {
      base.direct = used.slice(0, G);
      base.stage = 'g1';
    }
    base.rounds = koTemplate(F);
    if (base.stage === 'g1') drawGroups(state.world, base, base.direct);
  }
  state.cup = base;
  catchUp(state);
  return state.cup;
}

/** Eleme ağacının boş şablonu (yer tutucu adlarla) */
function koTemplate(F) {
  const rounds = {};
  const first = F.ko;
  const labels = [];
  if (F.groups === 12) {
    for (let i = 0; i < 8; i++) labels.push([`1${GL[i]}`, '3. (en iyi)']);
    for (let i = 8; i < 12; i++) labels.push([`1${GL[i]}`, `2${GL[i - 8]}`]);
    for (let i = 0; i < 4; i++) labels.push([`2${GL[4 + i]}`, `2${GL[11 - i]}`]);
  } else if (F.groups === 6) {
    for (let i = 0; i < 4; i++) labels.push([`1${GL[i]}`, '3. (en iyi)']);
    labels.push(['1E', '2A'], ['1F', '2B'], ['2C', '2F'], ['2D', '2E']);
  } else if (F.groups === 3) {
    labels.push(['1A', '3. (en iyi)'], ['1B', '3. (en iyi)'], ['1C', '2A'], ['2B', '2C']);
  } else {
    for (let i = 0; i < 4; i++) labels.push(['?', '?']);
  }
  rounds[first] = labels.map(slot);
  let prev = rounds[first];
  for (const r of KO_ROUNDS.slice(KO_ROUNDS.indexOf(first) + 1)) {
    const cur = [];
    for (let i = 0; i < prev.length; i += 2) cur.push(slot(['Galip', 'Galip']));
    rounds[r] = cur;
    prev = cur;
  }
  return rounds;
}

/** Grup kurası: torbalara göre (güçlüler ayrı gruplara), ön elemeden gelenler son torbada */
function drawGroups(world, cup, field) {
  const g = cup.format.groups;
  const ranked = [...field].sort((a, b) => clubRating(world, b) - clubRating(world, a));
  const pots = [0, 1, 2, 3].map((p) => shuffle(ranked.slice(p * g, (p + 1) * g)));
  cup.groups = [];
  for (let i = 0; i < g; i++) {
    const teams = pots.map((pot) => pot[i]).filter(Boolean);
    const [a, b, c, d] = teams;
    cup.groups.push({
      id: GL[i], teams,
      fx: [
        { md: 1, h: a, a: b }, { md: 1, h: c, a: d },
        { md: 2, h: d, a: a }, { md: 2, h: b, a: c },
        { md: 3, h: a, a: c }, { md: 3, h: d, a: b },
      ].map((f) => ({ ...f, hg: null, ag: null })),
    });
  }
}

/** Grup puan durumu */
export function groupTable(world, g) {
  const rows = Object.fromEntries(g.teams.map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const f of g.fx) {
    if (f.hg == null) continue;
    const H = rows[f.h];
    const A = rows[f.a];
    H.p++; A.p++;
    H.gf += f.hg; H.ga += f.ag; A.gf += f.ag; A.ga += f.hg;
    if (f.hg > f.ag) { H.w++; A.l++; H.pts += 3; } else if (f.hg < f.ag) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || (world ? clubRating(world, y.id) - clubRating(world, x.id) : 0));
}

/** En iyi üçüncüler sıralaması */
export function thirdsTable(world, cup) {
  return cup.groups.map((g) => ({ ...groupTable(world, g)[2], group: g.id })).filter((r) => r.id)
    .sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || clubRating(world, y.id) - clubRating(world, x.id));
}

export function ensureCup(state) {
  if (!state.career?.clubId || !state.world) return null;
  if (!state.cup || state.cup.season !== state.calendar.season || state.cup.v !== 2) createCup(state);
  return state.cup;
}

function simScore(world, h, a, neutral = false) {
  const hr = clubRating(world, h);
  const ar = clubRating(world, a);
  return [poisson(goalLambda(hr, ar, !neutral)), poisson(goalLambda(ar, hr, false))];
}

function simTie(world, t, final = false) {
  [t.hg, t.ag] = simScore(world, t.h, t.a, final);
  if (t.hg === t.ag) {
    const ph = clamp(0.5 + (clubRating(world, t.h) - clubRating(world, t.a)) / 120, 0.25, 0.75);
    t.pens = chance(ph) ? [randInt(4, 5), randInt(2, 3)] : [randInt(2, 3), randInt(4, 5)];
  }
  t.w = t.hg > t.ag || (t.pens && t.pens[0] > t.pens[1]) ? t.h : t.a;
  return t;
}

/** Bu turdaki maçlar (ön eleme eşleşmeleri, grup maç günü fikstürleri ya da eleme eşleşmeleri) */
function stageMatches(cup, st) {
  if (isPre(st)) return cup.pre?.[st] || [];
  if (isGroupStage(st)) return cup.groups.flatMap((g) => g.fx.filter((f) => f.md === mdOf(st)).map((f) => Object.assign(f, { group: g.id })));
  return cup.rounds[st] || [];
}
const myIn = (m, me) => m.h === me || m.a === me;
const played = (m) => m.hg != null;

/** Lig haftası bitince: bu hafta kupa turu varsa diğer maçlar oynanır, senin maçın için pending.cupTie */
export function cupOnWeekEnd(state, week) {
  const cup = ensureCup(state);
  if (!cup || cup.winner || !cup.stage) return null;
  const st = cup.stage;
  if (CUP_WEEK[st] !== week) return null;
  const me = state.career.clubId;
  const list = stageMatches(cup, st);
  const mine = list.find((m) => myIn(m, me) && !played(m)) || null;
  for (const m of list) if (m !== mine && !played(m)) playSim(state.world, cup, st, m);
  if (mine && !cup.out) {
    state.pending.cupTie = { kind: 'cup', round: st, h: mine.h, a: mine.a, name: cup.name, season: cup.season, group: mine.group || null };
    return state.pending.cupTie;
  }
  advanceCup(state);
  return null;
}

function playSim(world, cup, st, m) {
  if (isGroupStage(st)) [m.hg, m.ag] = simScore(world, m.h, m.a);
  else simTie(world, m, st === 'f');
}

/** Kurulduğu hafta geçmiş turları simüle eder */
function catchUp(state) {
  const cup = state.cup;
  let guard = 0;
  while (cup && !cup.winner && cup.stage && CUP_WEEK[cup.stage] < (state.calendar?.week || 1) && guard++ < 12) {
    const st = cup.stage;
    for (const m of stageMatches(cup, st)) if (!played(m)) playSim(state.world, cup, st, m);
    advanceCup(state);
  }
}

/** Tur tamamlandıysa bir sonrakine geçer */
function advanceCup(state) {
  const cup = state.cup;
  const st = cup.stage;
  if (!st || stageMatches(cup, st).some((m) => !played(m))) return;
  const me = state.career.clubId;
  if (st === 'pre1') {
    // 1. ön eleme galipleri 2. ön elemede bekleyenlerle eşleşir
    const ties = cup.pre.pre1;
    if (ties.some((t) => myIn(t, me) && t.w !== me)) cup.out = cup.out || 'pre1';
    cup.pre.pre2 = pairUp([...(cup.preByes.pre2 || []), ...ties.map((t) => t.w)]);
    cup.stage = 'pre2';
    return;
  }
  if (st === 'pre2') {
    const ties = cup.pre.pre2;
    if (ties.some((t) => myIn(t, me) && t.w !== me)) cup.out = cup.out || 'pre2';
    drawGroups(state.world, cup, [...cup.direct, ...(cup.preByes.g1 || []), ...ties.map((t) => t.w)]);
    cup.stage = 'g1';
    return;
  }
  if (st === 'g1' || st === 'g2') { cup.stage = st === 'g1' ? 'g2' : 'g3'; return; }
  if (st === 'g3') {
    buildKnockout(state.world, cup);
    const first = cup.rounds[cup.format.ko];
    if (cup.groups.some((g) => g.teams.includes(me)) && !first.some((t) => myIn(t, me))) cup.out = cup.out || 'groups';
    cup.stage = cup.format.ko;
    return;
  }
  // eleme turları
  const ties = cup.rounds[st];
  if (st === 'f') {
    cup.winner = ties[0].w;
    cup.stage = null;
    return;
  }
  const next = KO_ROUNDS[KO_ROUNDS.indexOf(st) + 1];
  cup.rounds[next] = cup.rounds[next].map((t, i) => ({ ...t, h: ties[i * 2].w, a: ties[i * 2 + 1].w }));
  cup.stage = next;
}

/** Gruplar bitti: Son 32 (ya da 16/8) kurası; ağaç şablonundaki yerlerine yerleşir */
function buildKnockout(world, cup) {
  const F = cup.format;
  const tabs = cup.groups.map((g) => groupTable(world, g));
  const W = tabs.map((t) => t[0].id);
  const R = tabs.map((t) => t[1].id);
  const first = cup.rounds[F.ko];
  if (F.ko === 'r32') {
    const thirds = thirdsTable(world, cup).slice(0, F.thirds);
    cup.thirds = thirds.map((r) => r.id);
    // grup birincileri (A–H) en iyi üçüncülerle; aynı gruptan gelen eşleşmez
    const pool = [...thirds];
    for (let i = 0; i < 8; i++) {
      let j = pool.findIndex((r) => r.group !== GL[i]);
      if (j < 0) j = 0;
      const t3 = pool.splice(j, 1)[0];
      Object.assign(first[i], { h: W[i], a: t3.id, al: `3${t3.group}` });
    }
    for (let i = 8; i < 12; i++) Object.assign(first[i], { h: W[i], a: R[i - 8] });
    for (let i = 0; i < 4; i++) Object.assign(first[12 + i], { h: R[4 + i], a: R[11 - i] });
    // ağaçta güçlüler ayrı yollara: kura sırası karıştırılır (eşleşmeler aynı kalır)
    const order = shuffle(first.map((_, i) => i));
    cup.rounds.r32 = order.map((i) => first[i]);
  } else if (F.groups === 6 || F.groups === 3) {
    const nT = F.thirds;
    const thirds = thirdsTable(world, cup).slice(0, nT);
    cup.thirds = thirds.map((r) => r.id);
    const pool = [...thirds];
    for (let i = 0; i < nT; i++) {
      let j = pool.findIndex((r) => r.group !== GL[i]);
      if (j < 0) j = 0;
      const t3 = pool.splice(j, 1)[0];
      Object.assign(first[i], { h: W[i], a: t3.id, al: `3${t3.group}` });
    }
    if (F.groups === 6) {
      Object.assign(first[4], { h: W[4], a: R[0] });
      Object.assign(first[5], { h: W[5], a: R[1] });
      Object.assign(first[6], { h: R[2], a: R[5] });
      Object.assign(first[7], { h: R[3], a: R[4] });
    } else {
      Object.assign(first[2], { h: W[2], a: R[0] });
      Object.assign(first[3], { h: R[1], a: R[2] });
    }
    const order = shuffle(first.map((_, i) => i));
    cup.rounds[F.ko] = order.map((i) => first[i]);
  }
}

/** Kupa maçının planı (kulüp maçı formatında) */
export function planCupMatch(state) {
  const t = state.pending.cupTie;
  if (!t) return null;
  if (t.kind === 'makeup') {
    // ertelenen lig maçı: lig maçı gibi (beraberlik olabilir)
    return planMatch(state, { homeId: t.h, awayId: t.a, id: `makeup-${t.season}-${t.week}`, cup: { kind: 'makeup', round: 'makeup', name: `Ertelenen maç · ${t.week}. hafta` } });
  }
  const isFinal = t.round === 'f' || t.kind === 'super';
  const grp = isGroupStage(t.round);
  const title = t.kind === 'super' ? superName(state.cup?.country || 'tr') : `${t.name} · ${grp ? `Grup ${t.group} · ${mdOf(t.round)}. maç` : roundLabel(state.cup, t.round)}`;
  return planMatch(state, {
    homeId: t.h, awayId: t.a,
    id: `cup-${t.season}-${t.kind}-${t.round}`,
    cup: { kind: t.kind, round: t.round, name: title, group: t.group || null },
    knockout: !grp,
    big: isFinal ? { kind: 'final', title, nerves: 0.38, tempo: 1.15, skillMult: 0.95, cool: false } : null,
  });
}

/**
 * Kupa maçı bitti: oyuncu istatistikleri (finalizeMatch), penaltılar (eleme), tur ilerlemesi, ödül.
 * shootout: (elemede beraberlikte) oyuncunun penaltı sonucu {success} — yoksa simüle edilir.
 */
export function completeCupMatch(state, match, shootout = null) {
  const t = state.pending.cupTie;
  const summary = finalizeMatch(state, match);
  const { my, opp } = match.score;
  if (t?.kind === 'makeup') {
    const hg = match.isHome ? my : opp;
    const ag = match.isHome ? opp : my;
    applyMakeup(state.world, t.h, t.a, hg, ag);
    state.pending.cupTie = null;
    return { summary, won: my > opp, draw: my === opp, pens: null, award: null, round: 'makeup', makeup: true, out: false };
  }
  const cup = ensureCup(state);
  const grp = isGroupStage(t?.round);
  let pens = null;
  if (my === opp && !grp) {
    const edge = (match.myR - match.oppR) / 120 + (shootout ? (shootout.success ? 0.18 : -0.18) : 0);
    const win = chance(clamp(0.5 + edge, 0.15, 0.85));
    pens = win ? [randInt(4, 5), randInt(2, 3)] : [randInt(2, 3), randInt(4, 5)];
  }
  const won = my > opp || !!(pens && pens[0] > pens[1]);
  const myId = state.career.clubId;
  const p = state.player;
  let award = null;
  if (t?.kind === 'super') {
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
  let out = false;
  if (cup && t) {
    const m = stageMatches(cup, t.round).find((x) => myIn(x, myId) && !played(x));
    if (m) {
      const home = m.h === myId;
      m.hg = home ? my : opp;
      m.ag = home ? opp : my;
      if (!grp) {
        m.pens = pens ? (home ? pens : [pens[1], pens[0]]) : null;
        m.w = won ? myId : home ? m.a : m.h;
      }
    }
    cup.myResults.push({ round: t.round, opp: match.oppId, my, opp_goals: opp, pens, won, draw: my === opp && grp });
    if (!grp && !won) { cup.out = t.round; out = true; }
    state.pending.cupTie = null;
    advanceCup(state);
    if (grp && cup.out === 'groups') out = true;
    if (won && t.round === 'f') {
      award = { season: state.calendar.season, title: `${cup.name} Şampiyonu`, icon: 'trophy', club: myId };
      state.career.awards.push(award);
      state.career.money += Math.round((state.career.contract?.wage || 500) * 2);
      changeFame(p, 5);
      changeRel(p, 'fans', 6);
      changeMorale(p, 12);
    } else if (won) changeMorale(p, grp ? 2 : 3);
  }
  return { summary, won, draw: grp && my === opp, pens, award, round: t?.round, group: t?.group || null, out, stage: cup?.stage || null };
}

/** Sezon sonu: kalan turları tamamla ve Süper Kupa eşleşmesini hazırla */
export function cupSeasonEnd(state, leagueChampion, runnerUp) {
  const cup = state.cup;
  if (cup && !cup.winner) {
    let guard = 0;
    while (!cup.winner && cup.stage && guard++ < 12) {
      for (const m of stageMatches(cup, cup.stage)) if (!played(m)) playSim(state.world, cup, cup.stage, m);
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

/** Kulübün grubu (varsa) */
export const myGroup = (cup, clubId) => cup?.groups?.find((g) => g.teams.includes(clubId)) || null;

export const myCupStatus = (state) => {
  const cup = state.cup;
  if (!cup) return null;
  const me = state.career.clubId;
  if (cup.winner === me) return 'Şampiyon';
  if (cup.out) return cup.out === 'groups' ? 'Grupta elendi' : `${roundLabel(cup, cup.out)}'de elendi`;
  if (cup.winner) return 'Kupa bitti';
  const st = cup.stage;
  if (isPre(st) && !Object.values(cup.pre || {}).flat().some((t) => myIn(t, me)) && !(cup.preByes?.pre2 || []).includes(me)) return `Gruplardan başlıyor (H${CUP_WEEK.g1})`;
  if (st === 'pre1' && (cup.preByes?.pre2 || []).includes(me)) return `2. ön elemeden başlıyor (H${CUP_WEEK.pre2})`;
  if (isGroupStage(st)) {
    const g = myGroup(cup, me);
    if (g) {
      const pos = groupTable(state.world, g).findIndex((r) => r.id === me) + 1;
      return `Grup ${g.id} · ${pos}. sıra · ${mdOf(st)}. maç H${CUP_WEEK[st]}`;
    }
  }
  return `${roundLabel(cup, st)} (H${CUP_WEEK[st]})`;
};

/** Bekleyen (hafta içi) kupa maçı için kısa etiket */
export const cupTieLabel = (t) => (t?.kind === 'super' ? 'Süper Kupa' : t?.kind === 'makeup' ? 'ertelenen lig maçı' : `${t?.name || 'Kupa'} · ${isGroupStage(t?.round) ? `Grup ${t.group}` : ROUND_LABEL[t?.round] || ''}`);
/** Kupadaki tüm tur sırası (bu sezonun biçimine göre) */
export function cupStages(cup) {
  if (!cup) return [];
  const out = [];
  if (cup.pre?.pre1) out.push('pre1');
  if (cup.pre?.pre2 || cup.preByes?.pre2) out.push('pre2');
  if (cup.format?.groups) out.push('g1', 'g2', 'g3');
  out.push(...KO_ROUNDS.slice(KO_ROUNDS.indexOf(cup.format?.ko || 'qf')));
  return out;
}

/** Kazanırsan sonraki turdaki olası rakipler (ağaçtaki komşu eşleşme) */
export function nextPath(cup, clubId) {
  const st = cup?.stage;
  if (!st || !KO_ROUNDS.includes(st) || st === 'f') return null;
  const ties = cup.rounds[st];
  const i = ties.findIndex((t) => myIn(t, clubId));
  if (i < 0) return null;
  const mate = ties[i ^ 1];
  return { round: KO_ROUNDS[KO_ROUNDS.indexOf(st) + 1], tie: mate };
}
