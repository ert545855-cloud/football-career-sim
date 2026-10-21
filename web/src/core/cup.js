// KUPALAR — ülke kupası (Türkiye Kupası vb.) ve Süper Kupa. Biçim ülkenin lig piramidinden hesaplanır (sabit sayı yok).
//
//  AŞAMA 1 · ALT LİG ÖN ELEMELERİ: yalnız alt kademelerin kulüpleri (ve Türkiye'de amatörler) tek maç eleme oynar.
//     Kademeli katılım: en alt kademe ilk turda başlar, her üst kademe bir sonraki turda katılır; son turlarda
//     gerekiyorsa güçlüler bay geçer, böylece gruplara tam olarak gereken sayıda takım kalır. Elenen veda eder.
//     ÜST LİG KULÜPLERİ BU AŞAMAYA KATILMAZ.
//  AŞAMA 2 · GRUP AŞAMASI: üst ligin tüm kulüpleri (seribaşları) + ön elemeyi geçen alt lig kulüpleri gruplara çekilir.
//     Üst ligde 8+ kulüp varsa 4 grup (çeyrek final), azsa 2 grup (yarı final). Grup büyüklüğü, her gruba en az bir
//     ön eleme galibi düşecek şekilde üst lig takım sayısından hesaplanır. Gruplarda tek devre; beraberlik puan.
//  AŞAMA 3 · FİNAL ELEMELERİ: grup birincileri ve ikincileri ara tur olmadan doğrudan çeyrek finale (ya da yarı finale);
//     tek maç, berabere biterse penaltılar. Eleme ağacı baştan bellidir (1A–2B, 1C–2D | 1B–2A, 1D–2C).
//  • Takvim: turlar sezona yayılır (hafta içi), sezon uzunluğuna göre (calendar.js).
//  • Senin kulübünün maçı canlı yayınla oynanır; diğerleri simüle edilir.
//  • Süper Kupa: sezon başında lig şampiyonu ile kupa şampiyonu (aynıysa lig ikincisi) karşılaşır.
import { AMATEUR_CLUBS, CLUB_BY_ID, COUNTRY_BY_ID, LEAGUES } from './data.js';
import { chance, clamp, poisson, randInt, shuffle } from './rng.js';
import { applyMakeup, clubRating, goalLambda, roundRobin, sortedTable } from './league.js';
import { changeFame, changeMorale, changeRel } from './player.js';
import { planMatch, finalizeMatch } from './match.js';
import { seasonWeeks } from './calendar.js';

export const CUP_VERSION = 3;
export const KO_ROUNDS = ['qf', 'sf', 'f'];
export const ROUND_LABEL = {
  pre: 'Ön eleme', groups: 'Grup aşaması', qf: 'Çeyrek final', sf: 'Yarı final', f: 'Final', super: 'Süper Kupa', makeup: 'Ertelenen maç',
};
const GL = 'ABCDEFGHIJKLMNOP';
export const isGroupStage = (st) => /^g\d+$/.test(st || '');
export const isPreStage = (st) => /^pre\d+$/.test(st || '');
const mdOf = (st) => Number(String(st || '').replace(/^\D+/, '')) || 0;

/** Turun adı: "3. Ön eleme", "Grup 2. maç", "Çeyrek final" */
export function roundLabel(cup, st) {
  if (isPreStage(st)) {
    const n = cup?.plan?.length || 1;
    return n > 1 ? `${mdOf(st)}. Ön eleme` : 'Ön eleme';
  }
  if (isGroupStage(st)) return `Grup ${mdOf(st)}. maç`;
  return ROUND_LABEL[st] || '';
}
/** Turun haftası */
export const cupWeek = (cup, st) => cup?.weeks?.[st] ?? null;

export function cupName(country) {
  if (country === 'tr') return 'Türkiye Kupası';
  return `${COUNTRY_BY_ID[country]?.name || 'Ülke'} Kupası`;
}
export const superName = (country) => (country === 'tr' ? 'Türkiye Süper Kupası' : `${COUNTRY_BY_ID[country]?.name || ''} Süper Kupası`);

/** Ülkenin kupa kulüpleri: kademe → kulüpler (üst lig ayrı), amatörler en alt dalgada */
function entrants(world, cc) {
  const byLevel = {};
  for (const lg of Object.values(world.leagues)) {
    const m = LEAGUES[lg.id];
    if (!m || m.youth || m.country !== cc) continue;
    (byLevel[m.level] ||= []).push(...lg.teams.filter((id) => CLUB_BY_ID[id]));
  }
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  const top = byLevel[levels[0]] || [];
  const lower = levels.slice(1).map((l) => byLevel[l]);
  const amateurs = AMATEUR_CLUBS.filter((c) => c.country === cc).map((c) => c.id);
  if (amateurs.length) {
    if (lower.length) lower[lower.length - 1] = [...lower[lower.length - 1], ...amateurs];
    else lower.push(amateurs);
  }
  return { top: [...new Set(top)], lower: lower.map((w) => [...new Set(w)]) };
}

const tie = (h, a) => ({ h, a, hg: null, ag: null, pens: null, w: null });
const slot = (hl, al) => ({ h: null, a: null, hl, al, hg: null, ag: null, pens: null, w: null });

/**
 * Biçim: grup sayısı, grup büyüklüğü, ön elemeden gelecek takım ve ön eleme turlarının planı.
 * @param {number} topN üst lig kulüp sayısı
 * @param {number[]} waveSizes alt kademelerin kulüp sayıları (en alttan yukarı)
 */
export function cupFormat(topN, waveSizes) {
  const groups = topN >= 8 ? 4 : 2;
  const ko = groups === 4 ? 'qf' : 'sf';
  const size = Math.ceil((topN + groups) / groups);
  const lowerTotal = waveSizes.reduce((a, b) => a + b, 0);
  const qualifiers = Math.min(groups * size - topN, lowerTotal);
  // ön eleme turları: her dalga girer, gruplara tam `qualifiers` takım kalacak şekilde
  const rounds = [];
  let c = 0;
  const waves = waveSizes.slice();
  for (let i = 0; i < waves.length; i++) {
    const total = c + waves[i];
    const after = waves.slice(i + 1).reduce((a, b) => a + b, 0);
    const last = i === waves.length - 1;
    if (!last) {
      if (total >= 2 && Math.ceil(total / 2) + after >= qualifiers) {
        rounds.push({ wave: i, size: total, matches: Math.floor(total / 2) });
        c = Math.ceil(total / 2);
      } else {
        waves[i + 1] += waves[i];
        waves[i] = 0;
        rounds.push(null); // bu dalga bir sonrakine katıldı
      }
      continue;
    }
    if (total <= qualifiers) { c = total; break; }
    const K = Math.ceil(Math.log2(total / qualifiers));
    const m = total - qualifiers * 2 ** (K - 1);
    rounds.push({ wave: i, size: total, matches: m });
    let n = total - m;
    for (let k = 1; k < K; k++) {
      rounds.push({ wave: null, size: n, matches: n / 2 });
      n /= 2;
    }
    c = n;
  }
  return { groups, size, ko, top: topN, qualifiers, rounds };
}

/** Turları sezona yayar: ön eleme → grup maç günleri → çeyrek/yarı final → final (her tur ayrı hafta) */
export function scheduleCup(stages, W = seasonWeeks()) {
  const first = 2;
  const end = Math.min(W - 1, Math.max(first + stages.length - 1, Math.round(W * 0.88)));
  const weeks = {};
  let prev = first - 1;
  stages.forEach((st, i) => {
    const w = stages.length > 1 ? Math.round(first + (i * (end - first)) / (stages.length - 1)) : first;
    const wk = Math.max(prev + 1, w);
    weeks[st] = Math.min(W, wk);
    prev = wk;
  });
  return weeks;
}

/**
 * Sezonun kupasını kurar. Kurulduğu hafta geçmiş turlar varsa (yeni kulüp, eski kayıt) onları simüle eder.
 * keep: eski biçimden geçişte oyuncunun kupadaki durumu korunur ('alive': geçmiş maçlarını kazanmış sayılır,
 * 'out': ilk geçmiş maçında elenir).
 */
export function createCup(state, { keep = null } = {}) {
  const cc = CLUB_BY_ID[state.career.clubId]?.country || 'tr';
  const { top, lower } = entrants(state.world, cc);
  if (top.length + lower.flat().length < 8) { state.cup = null; return null; }
  const world = state.world;
  const byR = (a, b) => clubRating(world, b) - clubRating(world, a);
  // dalgalar: en alt kademe önce; her dalga güçten zayıfa
  const waves = lower.slice().reverse().map((w) => w.slice().sort(byR));
  const F = cupFormat(top.length, waves.map((w) => w.length));
  const plan = [];
  F.rounds.forEach((r, i) => {
    if (!r) { if (waves[i + 1]) waves[i + 1] = [...waves[i], ...waves[i + 1]]; return; }
    plan.push({ id: `pre${plan.length + 1}`, enter: r.wave == null ? [] : waves[r.wave], matches: r.matches, size: r.size });
  });
  // ön elemesiz kalan dalgalar (az kulüp): doğrudan gruplara
  const viaPre = new Set(plan.flatMap((p) => p.enter));
  const directLower = waves.flat().filter((id) => !viaPre.has(id));
  const mds = F.size % 2 ? F.size : F.size - 1;
  const stages = [...plan.map((p) => p.id), ...Array.from({ length: mds }, (_, i) => `g${i + 1}`), ...KO_ROUNDS.slice(KO_ROUNDS.indexOf(F.ko))];
  const cup = {
    v: CUP_VERSION,
    season: state.calendar.season,
    country: cc,
    name: cupName(cc),
    format: { groups: F.groups, size: F.size, ko: F.ko, top: F.top, qualifiers: F.qualifiers, mds },
    plan: plan.map((p) => ({ id: p.id, enter: p.enter, matches: p.matches, size: p.size })),
    stages,
    weeks: scheduleCup(stages, seasonWeeks()),
    direct: top.slice().sort(byR),
    directLower,
    carry: [],
    pre: {},
    preByes: {},
    groups: [],
    rounds: koTemplate(F.groups),
    stage: stages[0],
    out: null,
    winner: null,
    myResults: [],
  };
  state.cup = cup;
  if (plan.length) startPre(state, 0);
  else drawGroups(world, cup, [...cup.direct, ...directLower]);
  if (keep) cup.keep = { id: state.career.clubId, mode: keep };
  catchUp(state);
  delete cup.keep;
  return state.cup;
}

/** Ön eleme turunu başlatır: önceki turun galipleri + bu turda katılanlar; gerekiyorsa en güçlüler bay geçer */
function startPre(state, k) {
  const cup = state.cup;
  const world = state.world;
  const p = cup.plan[k];
  const field = [...cup.carry, ...p.enter].sort((a, b) => clubRating(world, b) - clubRating(world, a));
  const playN = Math.min(field.length - (field.length % 2), p.matches * 2);
  const byes = field.slice(0, field.length - playN);
  const play = shuffle(field.slice(field.length - playN));
  const ties = [];
  for (let i = 0; i + 1 < play.length; i += 2) ties.push(tie(play[i], play[i + 1]));
  cup.pre[p.id] = ties;
  cup.preByes[p.id] = byes;
  cup.carry = [];
  cup.stage = p.id;
}

/** Eleme ağacının boş şablonu (yer tutucu adlarla) */
function koTemplate(groups) {
  const rounds = {};
  if (groups === 4) {
    rounds.qf = [slot('1A', '2B'), slot('1C', '2D'), slot('1B', '2A'), slot('1D', '2C')];
    rounds.sf = [slot('Galip', 'Galip'), slot('Galip', 'Galip')];
  } else {
    rounds.sf = [slot('1A', '2B'), slot('1B', '2A')];
  }
  rounds.f = [slot('Galip', 'Galip')];
  return rounds;
}

/** Grup kurası: seribaşları (üst lig, güç sırasıyla torbalar) + ön eleme galipleri son torbalarda; tek devre fikstür */
function drawGroups(world, cup, field) {
  const G = cup.format.groups;
  const byR = (a, b) => clubRating(world, b) - clubRating(world, a);
  const seeds = field.filter((id) => cup.direct.includes(id)).sort(byR);
  const quals = field.filter((id) => !cup.direct.includes(id)).sort(byR);
  const ordered = [...seeds, ...quals];
  const pots = [];
  for (let i = 0; i < ordered.length; i += G) pots.push(shuffle(ordered.slice(i, i + G)));
  cup.groups = [];
  for (let gi = 0; gi < G; gi++) {
    const teams = pots.map((pot) => pot[gi]).filter(Boolean);
    const fx = [];
    roundRobin(teams, Math.random, 1).forEach((round, r) => {
      for (const [h, a] of round) fx.push({ md: r + 1, h, a, hg: null, ag: null });
    });
    cup.groups.push({ id: GL[gi], teams, fx });
  }
  cup.stage = 'g1';
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

export function ensureCup(state) {
  if (!state.career?.clubId || !state.world) return null;
  if (!state.cup || state.cup.season !== state.calendar.season || state.cup.v !== CUP_VERSION) {
    const old = state.cup;
    const migrating = old && old.v !== CUP_VERSION && old.season === state.calendar.season;
    // eski biçimin bekleyen eşleşmesi yeni biçimde geçersiz
    if (old && old.v !== CUP_VERSION && state.pending?.cupTie?.kind === 'cup') state.pending.cupTie = null;
    createCup(state, { keep: migrating ? (old.out ? 'out' : 'alive') : null });
  }
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
  if (isPreStage(st)) return cup.pre?.[st] || [];
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
  // ertelenen (karda kalan) eşleşmen hâlâ bekliyorsa tur ilerlemez; gecikmeli tur sonraki haftalarda işlenir
  if (state.pending.cupTie && state.pending.cupTie.kind !== 'makeup') return null;
  if (!(cupWeek(cup, st) <= week)) return null;
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
  // eski kayıttan geçiş: oyuncunun geçmiş maçlarının sonucu eski durumuna göre
  if (cup.keep && myIn(m, cup.keep.id)) {
    const win = cup.keep.mode === 'alive';
    const meHome = m.h === cup.keep.id;
    [m.hg, m.ag] = win === meHome ? [2, 0] : [0, 2];
    if (!isGroupStage(st)) { m.pens = null; m.w = win ? cup.keep.id : meHome ? m.a : m.h; }
    if (!win) cup.keep = null;
    return;
  }
  if (isGroupStage(st)) [m.hg, m.ag] = simScore(world, m.h, m.a);
  else simTie(world, m, st === 'f');
}

/** Kurulduğu hafta geçmiş turları simüle eder */
function catchUp(state) {
  const cup = state.cup;
  let guard = 0;
  while (cup && !cup.winner && cup.stage && cupWeek(cup, cup.stage) < (state.calendar?.week || 1) && guard++ < 60) {
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
  const idx = cup.stages.indexOf(st);
  const next = cup.stages[idx + 1];
  if (isPreStage(st)) {
    const ties = cup.pre[st];
    if (ties.some((t) => myIn(t, me) && t.w !== me)) cup.out = cup.out || st;
    cup.carry = [...(cup.preByes[st] || []), ...ties.map((t) => t.w)];
    const k = cup.plan.findIndex((p) => p.id === st);
    if (isPreStage(next)) startPre(state, k + 1);
    else drawGroups(state.world, cup, [...cup.direct, ...cup.directLower, ...cup.carry]);
    if (!isPreStage(next)) cup.carry = [];
    return;
  }
  if (isGroupStage(st)) {
    if (isGroupStage(next)) { cup.stage = next; return; }
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
  cup.rounds[next] = cup.rounds[next].map((t, i) => ({ ...t, h: ties[i * 2].w, a: ties[i * 2 + 1].w }));
  cup.stage = next;
}

/** Gruplar bitti: birinciler ve ikinciler şablondaki yerlerine (grup birincisi iç saha) */
function buildKnockout(world, cup) {
  const tabs = Object.fromEntries(cup.groups.map((g) => [g.id, groupTable(world, g)]));
  const pick = (label) => tabs[label[1]]?.[Number(label[0]) - 1]?.id || null;
  const first = cup.rounds[cup.format.ko];
  for (const t of first) Object.assign(t, { h: pick(t.hl), a: pick(t.al) });
}

/** Kupa maçının planı (kulüp maçı formatında) */
export function planCupMatch(state) {
  const t = state.pending.cupTie;
  if (!t) return null;
  if (t.kind === 'makeup') {
    // ertelenen / hafta içine alınan lig maçı: lig maçı gibi (beraberlik olabilir)
    return planMatch(state, { homeId: t.h, awayId: t.a, id: `makeup-${t.season}-${t.week}-${t.h}`, cup: { kind: 'makeup', round: 'makeup', name: t.midweek ? `Lig · ${t.week}. hafta (hafta içi)` : `Ertelenen maç · ${t.week}. hafta` } });
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

/** Bekleyen eşleşme bu hafta oynanabilir mi? (karda ertelenen eşleşme bir hafta bekler) */
export function cupTieReady(state) {
  const t = state.pending?.cupTie;
  return !!t && !(t.delayUntil > (state.calendar?.week || 0));
}

/** Kupa/ertelenen maç oynanacakken hava muhalefeti: bir kez, finaller ve Süper Kupa hariç */
export function cupTieCanPostpone(state, match) {
  const t = state.pending?.cupTie;
  if (!t || t.delayed || t.kind === 'super' || t.round === 'f') return false;
  return !!match?.weather?.postpone && (state.calendar?.week || 0) < seasonWeeks();
}

/** Eşleşmeyi bir hafta erteler (lig maçı bu hafta normal oynanır) */
export function postponeCupTie(state, match) {
  const t = state.pending.cupTie;
  const why = match?.weather?.id === 'storm' ? 'storm' : match?.weather?.temp <= -8 && match?.weather?.id !== 'snow' ? 'frost' : 'snow';
  t.delayed = why;
  t.delayUntil = (state.calendar?.week || 0) + 1;
  t.announced = false;
  return why;
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
    while (!cup.winner && cup.stage && guard++ < 60) {
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

/** Kulüp kupaya hangi turda katılıyor? (ön eleme turu kimliği, 'groups' ya da null) */
export function entryStage(cup, clubId) {
  if (!cup) return null;
  if (cup.direct?.includes(clubId) || cup.directLower?.includes(clubId)) return 'groups';
  const p = cup.plan?.find((x) => x.enter.includes(clubId));
  return p ? p.id : null;
}

export const myCupStatus = (state) => {
  const cup = state.cup;
  if (!cup) return null;
  const me = state.career.clubId;
  if (cup.winner === me) return 'Şampiyon';
  if (cup.out) return cup.out === 'groups' ? 'Grupta elendi' : `${roundLabel(cup, cup.out)}'de elendi`;
  if (cup.winner) return 'Kupa bitti';
  const st = cup.stage;
  const entry = entryStage(cup, me);
  if (!entry) return 'Kupada yok';
  if (isPreStage(st)) {
    if (entry === 'groups') return `Üst lig: gruplardan başlıyor (H${cupWeek(cup, 'g1')})`;
    const ei = cup.stages.indexOf(entry);
    if (ei > cup.stages.indexOf(st)) return `${roundLabel(cup, entry)} turunda katılıyor (H${cupWeek(cup, entry)})`;
    if ((cup.preByes[st] || []).includes(me)) return `${roundLabel(cup, st)}: bay geçti`;
  }
  if (isGroupStage(st)) {
    const g = myGroup(cup, me);
    if (g) {
      const pos = groupTable(state.world, g).findIndex((r) => r.id === me) + 1;
      return `Grup ${g.id} · ${pos}. sıra · ${mdOf(st)}. maç H${cupWeek(cup, st)}`;
    }
  }
  return `${roundLabel(cup, st)} (H${cupWeek(cup, st)})`;
};

/** Bekleyen (hafta içi) kupa maçı için kısa etiket */
export const cupTieLabel = (t) => (t?.kind === 'super' ? 'Süper Kupa' : t?.kind === 'makeup' ? (t.midweek ? 'hafta içi lig maçı' : 'ertelenen lig maçı') : `${t?.name || 'Kupa'} · ${isGroupStage(t?.round) ? `Grup ${t.group}` : isPreStage(t?.round) ? 'Ön eleme' : ROUND_LABEL[t?.round] || ''}`);
/** Kupadaki tüm tur sırası (bu sezonun biçimine göre) */
export const cupStages = (cup) => cup?.stages || [];

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

/** Sıralı turlar arasında kulübün ön eleme maçları (UI) */
export const preRounds = (cup) => (cup?.plan || []).map((p) => p.id).filter((id) => cup.pre?.[id]);

export { sortedTable };
