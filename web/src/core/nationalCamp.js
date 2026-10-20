// MİLLİ TAKIM KAMPI — U-19 / U-21 / A Milli için kendi "ana ekranı" olan kamp.
//  • Milli arada 2 maç (eleme / hazırlık). Maçlar kulüp maçları gibi oynanır: canlı anlatım + birden çok kritik an.
//  • Maç öncesi kamp hakları: antrenman (mini oyun), taktik toplantısı, takımla vakit, dinlenme, basın toplantısı.
//  • Hoca güveni ilk 11'i belirler; takım uyumu ve hazırlık yeteneği etkiler.
//  • Büyük turnuva: çift sezon sonunda A Milli (Avrupa Şampiyonası / Dünya Kupası), tek sezon sonunda
//    U-21/U-19 Avrupa Şampiyonası. Grup (3 maç, puan tablosu) → çeyrek → yarı → final. Her maçı oynayabilir
//    ya da hızlı simüle edebilirsin.
import { GAME_WEIGHTS } from './data.js';
import { randomName } from './world/names.js';
import { nameLangOf } from './world/locale.js';
import { chance, clamp, pick, poisson, rand, randInt, round1, shuffle } from './rng.js';
import { addProgress, changeEnergy, changeFame, changeMorale, changeRel, form, ovr } from './player.js';
import { CONTINENTAL, HOME_NATION, NATIONAL_TEAMS, NATIONS, callUpScore, ensureNational, nationByShort, rivalNations } from './national.js';
import { buildEvents, buildMoments } from './match.js';
import { fatigueAt, weatherFor } from './weather.js';
import { nationLineup } from './lineups.js';

export const CAMP_SLOTS = 2; // maç başına kamp hakkı
export const TOURNEY_SLOTS = 1;

export const CAMP_ACTIONS = [
  { id: 'train', name: 'Antrenman', icon: 'whistle', desc: 'Hocanın gözü üstünde. Başarırsan güven artar.', energy: -10 },
  { id: 'tactics', name: 'Taktik Toplantısı', icon: 'clipboard', desc: 'Rakibi analiz et: güven +5, bu maçta yetenek +%5', energy: -2 },
  { id: 'team', name: 'Takımla Vakit', icon: 'users', desc: 'Kamp arkadaşlarınla turnuva: uyum +10, moral +4', energy: -3 },
  { id: 'rest', name: 'Dinlen', icon: 'bed', desc: 'Fizyoterapi ve uyku: enerji +14', energy: 14 },
  { id: 'press', name: 'Basın Toplantısı', icon: 'mic', desc: 'Ün kazanırsın; yanlış bir söz güveni düşürebilir.', energy: -2 },
];

// Rakip yıldızları için kurgusal soyadlar (gerçek kişi değil)
const STAR_NAMES = ['Moreau', 'Silva', 'Becker', 'Rossi', 'Novak', 'Jensen', 'Kowal', 'Garrido', 'Duval', 'Santos', 'Brandt', 'Bianco', 'Horvat', 'Ivanko', 'Costa', 'Lindqvist', 'Okafor', 'Haddad', 'Varga', 'Mendes'];

// Rakip ülkenin iklimi (deplasman havası)
const NATION_CC = { ARG: 'ar', FRA: 'fr', BRA: 'br', İSP: 'es', İNG: 'en', POR: 'pt', ALM: 'de', HOL: 'dk', İTA: 'it', BEL: 'fr', HIR: 'ro', URU: 'ar', KOL: 'br', FAS: 'ma', DAN: 'dk', İSV: 'ch', AVU: 'ch', SEN: 'ng', UKR: 'ua', JAP: 'jp', SIR: 'ro', POL: 'pl', ABD: 'us', MEK: 'us', ÇEK: 'pl', İSK: 'sc', MAC: 'ro', YUN: 'gr', GÜR: 'tr', NOR: 'dk' };

const lambda = (a, b) => 1.25 * Math.exp((a - b) / 18);
const teamR = (level, season) => NATIONAL_TEAMS[level].base + ((season * 7) % 5) - 2;
export const oppRating = (nation, level) => (level === 'A' ? nation.r : nation.r - (level === 'U21' ? 12 : 18));
export const teamLabel = (level) => (level === 'A' ? HOME_NATION.name : `${HOME_NATION.name} ${NATIONAL_TEAMS[level].short}`);
export const oppLabel = (nation, level) => (level === 'A' ? nation.name : `${nation.name} ${NATIONAL_TEAMS[level].short}`);

/** Milli takım kadrosu (seviye başına kalıcı): kurgusal takım arkadaşları */
export function squadFor(state, level) {
  const n = ensureNational(state);
  n.squads = n.squads || {};
  if (!n.squads[level]) {
    const used = new Set();
    const lang = nameLangOf(state.player?.nationality || 'tr');
    const name = () => {
      for (let i = 0; i < 20; i++) {
        const nm = randomName(lang);
        if (!used.has(nm)) { used.add(nm); return nm; }
      }
      return randomName(lang);
    };
    const base = NATIONAL_TEAMS[level].base;
    const shape = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'GK', 'DF', 'DF', 'MF', 'MF', 'FW'];
    n.squads[level] = shape.map((pos, i) => ({ name: name(), pos, ovr: Math.round(base + rand(-5, 6) - (i > 10 ? 3 : 0)), num: i + 1, captain: i === 5 }));
  }
  return n.squads[level];
}

function oppProfile(nation, level, seed) {
  const r = oppRating(nation, level);
  const last5 = Array.from({ length: 5 }, (_, i) => {
    const x = Math.sin(seed * 9.1 + i * 3.7) * 0.5 + 0.5 + (r - 70) / 40;
    return x > 0.62 ? 'G' : x > 0.38 ? 'B' : 'M';
  });
  return { r, last5, star: { name: STAR_NAMES[(seed * 7 + nation.short.length) % STAR_NAMES.length], num: [7, 9, 10, 11][seed % 4] } };
}

function newCamp(state, level, extra) {
  const n = ensureNational(state);
  const team = NATIONAL_TEAMS[level];
  const score = callUpScore(state);
  const trust = clamp(Math.round(45 + (score - team.minScore) * 1.5 + ((state.player.rel.federation ?? 50) - 50) * 0.15), 25, 85);
  squadFor(state, level);
  n.current = level;
  const camp = {
    level, season: state.calendar.season, week: state.calendar.week,
    trust, chem: 50, slots: extra.tournament ? TOURNEY_SLOTS : CAMP_SLOTS, prep: false, idx: 0,
    played: [], log: [], over: false, ...extra,
  };
  n.camp = camp;
  return camp;
}

/** Milli ara çağrısını kampa çevirir (2 maç) */
export function startCamp(state, call) {
  const pool = rivalNations((x) => x.r <= 84 && x.short !== call.opp);
  const second = pick(pool);
  const comp2 = call.level === 'A' ? pick(['Hazırlık Maçı', 'Uluslar Ligi', 'Eleme Grubu']) : 'Eleme Grubu';
  const camp = newCamp(state, call.level, {
    comp: call.comp,
    fixtures: [
      { opp: call.opp, home: call.home, comp: call.comp },
      { opp: second.short, home: !call.home, comp: comp2 },
    ],
  });
  state.pending.national = null;
  return camp;
}

/** Bu sezon sonunda hangi turnuva? A (çift sezon) ya da U-21/U-19 Avrupa Şampiyonası (tek sezon) */
export function tournamentFor(state) {
  const n = ensureNational(state);
  const s = state.calendar.season;
  if (n.tournaments.some((t) => t.season === s)) return null;
  const capsThisSeason = n.seasonCaps?.[s] || 0;
  const lvl = n.current;
  if (s % 2 === 0) {
    if (capsThisSeason > 0 || lvl === 'A') return { level: 'A', name: s % 4 === 2 ? CONTINENTAL[HOME_NATION.conf] : 'Dünya Kupası', continental: s % 4 === 2 };
    return null;
  }
  if ((lvl === 'U21' || lvl === 'U19') && (n.youthSeason?.[s] || 0) > 0) {
    return { level: lvl, name: `${NATIONAL_TEAMS[lvl].short} ${CONTINENTAL[HOME_NATION.conf]}`, continental: true };
  }
  return null;
}

/** Turnuva kampı: 4'lü grup → çeyrek → yarı → final */
export function startTournamentCamp(state, tour = tournamentFor(state)) {
  if (!tour) return null;
  // kıta şampiyonası: aynı konfederasyondan en güçlüler; Dünya Kupası: dünyanın her yerinden
  const conf = tour.continental ? rivalNations((x) => x.conf === HOME_NATION.conf).sort((a, b) => b.r - a.r).slice(0, 10) : [];
  const field = shuffle(conf.length >= 6 ? conf : rivalNations((x) => x.r >= 68));
  const group = field.slice(0, 3).map((x) => x.short);
  const knock = field.slice(3, 6).map((x) => x.short).sort((a, b) => nationByShort(a).r - nationByShort(b).r);
  const table = Object.fromEntries([HOME_NATION.short, ...group].map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  return newCamp(state, tour.level, {
    tournament: { name: tour.name, stage: 'group', group, knock, table, result: null, round: 0 },
    comp: tour.name,
    fixtures: group.map((opp, i) => ({ opp, home: i !== 1, comp: `${tour.name} · Grup ${i + 1}. maç`, stage: 'group' })),
  });
}

export const activeCamp = (state) => (state.national?.camp && !state.national.camp.over ? state.national.camp : null);
export const currentFixture = (camp) => camp?.fixtures[camp.idx] || null;

/** Rol: hoca güveni + çağrı puanı → ilk 11 mi yedek mi */
export function campRole(state, camp = activeCamp(state)) {
  if (!camp) return 'sub';
  const team = NATIONAL_TEAMS[camp.level];
  const v = camp.trust + (callUpScore(state) - team.minScore) * 1.2;
  return v >= 58 ? 'starter' : 'sub';
}

/** Rakip kartı bilgisi */
export function fixtureCard(state, camp = activeCamp(state)) {
  const fx = currentFixture(camp);
  if (!fx) return null;
  const nation = nationByShort(fx.opp);
  const prof = oppProfile(nation, camp.level, camp.season * 13 + camp.week + camp.idx);
  const myR = Math.round(teamR(camp.level, camp.season));
  const weather = weatherFor({ season: camp.season, week: camp.week, homeId: `nat-${fx.opp}-${camp.idx}`, country: fx.home ? 'tr' : NATION_CC[fx.opp] || 'en', tier: 1 });
  return { fx, nation, prof, myR, weather, my: teamLabel(camp.level), opp: oppLabel(nation, camp.level) };
}

/** Kamp aksiyonu (antrenman için mini oyun sonucu verilir) */
export function doCampAction(state, id, result = null) {
  const camp = activeCamp(state);
  if (!camp || camp.slots <= 0) return { ok: false, text: 'Bu maç öncesi kamp hakkın kalmadı.' };
  const p = state.player;
  const act = CAMP_ACTIONS.find((a) => a.id === id);
  if (!act) return { ok: false, text: 'Bilinmeyen aksiyon' };
  if (act.energy < 0 && p.energy + act.energy < 5) return { ok: false, text: 'Çok yorgunsun. Önce dinlen.' };
  const before = { trust: camp.trust, chem: camp.chem, energy: p.energy, morale: p.morale, fame: p.fame };
  let text = '';
  camp.slots -= 1;
  changeEnergy(p, act.energy);
  if (id === 'train') {
    const ok = !!result?.success;
    camp.trust = clamp(camp.trust + (ok ? 8 : 2), 0, 100);
    const stat = { FW: 'shooting', MF: 'passing', DF: 'defending' }[p.position] || 'passing';
    addProgress(p, stat, ok ? 0.25 : 0.1);
    text = ok ? 'Antrenmanda parladın. Hoca not defterine bir şeyler yazdı.' : 'Antrenman zor geçti ama çabanı gördüler.';
  } else if (id === 'tactics') {
    camp.trust = clamp(camp.trust + 5, 0, 100);
    camp.prep = true;
    text = 'Rakibin zayıf yönlerini ezberledin. Hoca hazırlığından memnun.';
  } else if (id === 'team') {
    camp.chem = clamp(camp.chem + 10, 0, 100);
    changeMorale(p, 4);
    text = pick(['Kamptaki PlayStation turnuvasını kazandın, herkes seni konuşuyor.', 'Akşam yemeğinde şakaların masayı güldürdü. Uyum arttı.', 'Kaptanla uzun bir sohbet ettin; artık takımın bir parçasısın.']);
  } else if (id === 'rest') {
    text = 'Fizyoterapi ve deliksiz bir uyku. Bacakların tazelendi.';
  } else if (id === 'press') {
    if (chance(0.72)) {
      changeFame(p, 1.5 + (camp.level === 'A' ? 1 : 0));
      changeRel(p, 'fans', 2);
      text = 'Basın toplantısında kendinden emin konuştun. Manşetlerdesin!';
    } else {
      camp.trust = clamp(camp.trust - 5, 0, 100);
      changeFame(p, 0.5);
      text = 'Bir sözün yanlış anlaşıldı: "Hocayla konuşmam lazım" diye manşet oldu. Güven azaldı.';
    }
  }
  camp.log.unshift(text);
  const changes = [
    { key: 'trust', label: 'Hoca güveni', delta: camp.trust - before.trust },
    { key: 'chem', label: 'Uyum', delta: camp.chem - before.chem },
    { key: 'energy', label: 'Enerji', delta: p.energy - before.energy },
    { key: 'morale', label: 'Moral', delta: p.morale - before.morale },
    { key: 'fame', label: 'Ün', delta: round1(p.fame - before.fame) },
  ].filter((c) => c.delta);
  return { ok: true, text, changes };
}

/** Milli takımın sahadaki 10'u (oyuncu hariç): kalıcı kamp kadrosundan */
function campXI(state, level) {
  const sq = squadFor(state, level).slice(0, 11).map((p) => ({ name: p.name, pos: p.pos, num: p.num }));
  const i = sq.findIndex((p) => p.pos === state.player.position);
  if (i >= 0) sq.splice(i, 1);
  return sq;
}

/** Kampın sıradaki maçı: kulüp maç ekranıyla uyumlu nesne */
export function planCampMatch(state) {
  const camp = activeCamp(state);
  const card = fixtureCard(state, camp);
  if (!card) return null;
  const { fx, nation, weather } = card;
  const p = state.player;
  const level = camp.level;
  const role = campRole(state, camp);
  const subMinute = role === 'sub' ? randInt(52, 70) : null;
  let subOff = null;
  if (role === 'starter') {
    const f75 = fatigueAt({ minute: 75, energy: p.energy, stamina: p.stats.stamina, weather });
    if (f75 > 0.36 && chance(clamp((f75 - 0.36) * 2.6, 0, 0.8))) subOff = randInt(64, 80);
  }
  const stage = camp.tournament?.stage;
  const myR = teamR(level, camp.season) + clamp((ovr(p) - NATIONAL_TEAMS[level].minScore) * 0.12, -2, 4) + (fx.home ? 2 : 0) + (camp.chem - 50) / 25;
  const oppR = oppRating(nation, level) + (fx.home ? 0 : 2) + (stage === 'final' ? 3 : stage === 'sf' ? 2 : 0);
  const onShare = role === 'starter' ? (subOff ? subOff / 90 : 1) : (90 - subMinute) / 90;
  let lMy = lambda(myR, oppR) * (1 - 0.24 * onShare) * weather.goals;
  let lOpp = lambda(oppR, myR) * weather.goals;
  if (p.position === 'DF') lOpp *= 1 - 0.14 * onShare;
  const events = buildEvents(lMy, lOpp, clamp(0.5 + (myR - oppR) / 120, 0.2, 0.8));
  const moments = buildMoments(p.position, role, subMinute, subOff);
  const nerves = clamp((level === 'A' ? 0.22 : level === 'U21' ? 0.16 : 0.1) + (stage === 'final' ? 0.3 : stage === 'sf' || stage === 'qf' ? 0.15 : 0) - (camp.played.length ? 0.04 : 0), 0, 0.7);
  const my = { name: teamLabel(level), short: HOME_NATION.short, colors: HOME_NATION.colors, pattern: 'solid', national: level };
  const opp = { name: oppLabel(nation, level), short: nation.short, colors: nation.colors, pattern: 'solid' };
  return {
    id: `nat-${camp.season}-${camp.week}-${camp.idx}-${camp.tournament ? 't' : 'w'}`,
    national: true, level, season: camp.season, week: camp.week,
    homeId: fx.home ? HOME_NATION.short : nation.short, awayId: fx.home ? nation.short : HOME_NATION.short, isHome: fx.home,
    myId: HOME_NATION.short, oppId: nation.short,
    teams: { home: fx.home ? my : opp, away: fx.home ? opp : my },
    names: { my: my.name, opp: opp.name }, shorts: { my: HOME_NATION.short, opp: nation.short },
    myKit: my, oppKit: opp,
    myR: Math.round(myR), oppR: Math.round(oppR), oppKeeper: Math.min(0.95, oppR / 92),
    role, reason: null, subMinute, subOff, weather, energy0: p.energy,
    stoppage: randInt(1, 5) + (stage && stage !== 'group' ? 1 : 0),
    knockout: !!stage && stage !== 'group',
    big: { kind: stage === 'final' ? 'final' : 'national', title: `${my.name} · ${fx.comp}`, nerves, tempo: 1 + nerves * 0.35, skillMult: (1 - nerves * 0.15) * (camp.prep ? 1.05 : 1) * (1 + (camp.chem - 50) / 1000), cool: false },
    comp: fx.comp,
    events, moments,
    lineups: { my: campXI(state, level), opp: nationLineup(nation.short, level) },
    goals: [],
    score: { my: 0, opp: 0 },
    tally: { rating: 0, goals: 0, assists: 0, won: 0, lost: 0, progress: [] },
  };
}

function updateTable(table, a, b, ga, gb) {
  const A = table[a];
  const B = table[b];
  if (!A || !B) return;
  A.p++; B.p++;
  A.gf += ga; A.ga += gb; B.gf += gb; B.ga += ga;
  if (ga > gb) { A.w++; B.l++; A.pts += 3; } else if (ga < gb) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
}

export const sortedGroup = (t) => Object.values(t.table).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);

const penalties = (edge) => (chance(clamp(0.5 + edge, 0.15, 0.85)) ? [randInt(4, 5), randInt(2, 3)] : [randInt(2, 3), randInt(4, 5)]);

/** Hızlı simülasyon (oynamadan): oyuncunun katkısı OVR ve forma göre */
export function simulateCampMatch(state) {
  const m = planCampMatch(state);
  const p = state.player;
  let my = poisson(lambda(m.myR, m.oppR));
  let o = poisson(lambda(m.oppR, m.myR));
  const posGoal = { FW: 0.3, MF: 0.13, DF: 0.05 }[p.position] || 0.12;
  const on = m.role === 'starter' ? 1 : 0.35;
  const rating = clamp(round1(6.3 + (ovr(p) - NATIONAL_TEAMS[m.level].minScore) / 18 + (form(p) - 6.5) * 0.4 + rand(-0.6, 0.6)), 4.5, 9.6);
  const goals = chance(posGoal * on * (0.6 + rating / 10)) ? 1 : 0;
  const assists = !goals && chance(posGoal * 0.7 * on) ? 1 : 0;
  my += goals;
  if (assists && my <= o) my += 1;
  m.score = { my, opp: o };
  m.tally = { rating: rating - 6, goals, assists, won: 0, lost: 0, progress: [], simulated: true };
  return m;
}

/**
 * Maçı kapatır: not, milli maç/gol sayıları, etkiler, turnuva ilerlemesi.
 * @returns {{res, my, opp, pens, rating, goals, assists, injured, changes, next:'camp'|'over', text}}
 */
export function finishCampMatch(state, match) {
  const n = ensureNational(state);
  const camp = activeCamp(state);
  if (!camp) return null;
  const p = state.player;
  const t = match.tally;
  const played = match.role === 'starter' || !!match.subMinute;
  let { my, opp } = match.score;
  let pens = null;
  if (match.knockout && my === opp) pens = penalties((match.myR - match.oppR) / 100 + (t.goals ? 0.05 : 0));
  const res = my > opp || (pens && pens[0] > pens[1]) ? 'W' : my < opp || pens ? 'L' : 'D';
  const rating = t.simulated ? clamp(round1(6 + t.rating), 4, 10) : clamp(round1(6 + t.rating + (res === 'W' ? 0.3 : res === 'L' ? -0.3 : 0) + rand(-0.2, 0.2)), 3.5, 10);
  const level = camp.level;
  const team = NATIONAL_TEAMS[level];
  const before = { fame: p.fame, fans: p.rel.fans, morale: p.morale, energy: p.energy, federation: p.rel.federation ?? 50 };
  if (played) {
    n.caps[level] += 1;
    n.goals[level] += t.goals;
    if (level === 'A') { n.seasonCaps[camp.season] = (n.seasonCaps[camp.season] || 0) + 1; state.career.caps = n.caps.A; }
    else { n.youthSeason = n.youthSeason || {}; n.youthSeason[camp.season] = (n.youthSeason[camp.season] || 0) + 1; }
  }
  changeFame(p, (played ? team.fame : 0.3) + t.goals * 1.5 + (rating >= 8 ? 1 : 0));
  changeRel(p, 'fans', (played ? team.fans : 0) + t.goals * 2);
  changeRel(p, 'federation', played ? 2 : 1);
  changeMorale(p, res === 'W' ? 6 : res === 'D' ? 1 : -3);
  changeEnergy(p, -(match.role === 'starter' ? 14 : 7) * (match.weather?.fatigue || 1));
  // Kampta güven: iyi not ilk 11'i sağlamlaştırır
  camp.trust = clamp(camp.trust + (played ? (rating - 6.5) * 6 : -1), 0, 100);
  for (const [stat, amount] of t.progress || []) addProgress(p, stat, amount * 0.8);
  let injured = 0;
  if (played && chance(p.energy < 25 ? 0.1 : 0.025)) {
    injured = randInt(1, 2);
    state.flags.injuredWeeks = Math.max(state.flags.injuredWeeks || 0, injured);
  }
  const nation = nationByShort(match.oppId);
  const line = `${team.short} · ${HOME_NATION.name} ${my}-${opp}${pens ? ` (P ${pens[0]}-${pens[1]})` : ''} ${nation.name}${t.goals ? ` · ${t.goals} gol` : ''}${t.assists ? ` · ${t.assists} asist` : ''}`;
  n.log.unshift({ s: camp.season, w: camp.week, text: line, res });
  n.log.length = Math.min(n.log.length, 24);
  camp.played.push({ opp: match.oppId, my, opp_goals: opp, pens, res, rating: played ? rating : null, goals: t.goals, assists: t.assists, comp: match.comp, stage: camp.tournament?.stage || null });
  camp.prep = false;

  // İlerleme
  let next = 'camp';
  const T = camp.tournament;
  if (T) {
    if (T.stage === 'group') {
      updateTable(T.table, HOME_NATION.short, match.oppId, my, opp);
      // aynı turda gruptaki diğer maç
      const round = camp.idx;
      const [a, b] = round === 0 ? [T.group[1], T.group[2]] : round === 1 ? [T.group[0], T.group[2]] : [T.group[0], T.group[1]];
      {
        const ra = nationByShort(a);
        const rb = nationByShort(b);
        updateTable(T.table, a, b, poisson(lambda(oppRating(ra, level), oppRating(rb, level))), poisson(lambda(oppRating(rb, level), oppRating(ra, level))));
      }
      if (camp.idx === 2) {
        const rank = sortedGroup(T).findIndex((r) => r.id === HOME_NATION.short);
        if (rank <= 1) {
          T.stage = 'qf';
          camp.fixtures.push({ opp: T.knock[0], home: true, comp: `${T.name} · Çeyrek final`, stage: 'qf' });
        } else { T.result = 'group'; next = 'over'; }
      }
    } else if (res === 'W') {
      const order = ['qf', 'sf', 'final'];
      const i = order.indexOf(T.stage);
      if (T.stage === 'final') { T.result = 'champion'; next = 'over'; }
      else {
        T.stage = order[i + 1];
        camp.fixtures.push({ opp: T.knock[i + 1], home: true, comp: `${T.name} · ${T.stage === 'sf' ? 'Yarı final' : 'Final'}`, stage: T.stage });
      }
    } else {
      T.result = T.stage;
      next = 'over';
    }
  }
  camp.idx += 1;
  if (!T && camp.idx >= camp.fixtures.length) next = 'over';
  if (next === 'camp') camp.slots = T ? TOURNEY_SLOTS : CAMP_SLOTS;
  const changes = [
    { key: 'fame', label: 'Ün', delta: round1(p.fame - before.fame) },
    { key: 'fans', label: 'Taraftar', delta: p.rel.fans - before.fans },
    { key: 'federation', label: 'Federasyon', delta: (p.rel.federation ?? 50) - before.federation },
    { key: 'morale', label: 'Moral', delta: p.morale - before.morale },
    { key: 'energy', label: 'Enerji', delta: p.energy - before.energy },
  ].filter((c) => c.delta);
  return { res, my, opp, pens, rating: played ? rating : null, played, goals: t.goals, assists: t.assists, injured, changes, next, text: line, nation };
}

/** Kampı kapatır; turnuvaysa kaydeder (ödül, ün). */
export function endCamp(state) {
  const n = ensureNational(state);
  const camp = n.camp;
  if (!camp) return null;
  camp.over = true;
  const p = state.player;
  let award = null;
  let record = null;
  const T = camp.tournament;
  if (T) {
    record = { season: camp.season, name: T.name, result: T.result || 'group', level: camp.level };
    n.tournaments.push(record);
    const lvl = { group: 0, qf: 1, sf: 2, final: 3, champion: 5 }[record.result] || 0;
    const k = camp.level === 'A' ? 1 : 0.5;
    changeFame(p, (2 + lvl * 2) * k);
    changeRel(p, 'fans', Math.round((2 + lvl * 2) * k));
    changeMorale(p, record.result === 'champion' ? 20 : lvl >= 2 ? 6 : -4);
    if (record.result === 'champion') {
      award = { season: camp.season, title: `${T.name} Şampiyonu`, icon: 'trophy', national: true };
      state.career.awards.push(award);
    }
  }
  const summary = { level: camp.level, played: camp.played, tournament: T ? { ...T } : null, record, award };
  n.lastCamp = { season: camp.season, week: camp.week, level: camp.level, played: camp.played.length, tournament: T?.name || null, result: T?.result || null };
  n.camp = null;
  return summary;
}

/** Kamp ekranındaki antrenman mini oyununun ayarı */
export function campTrainingSetup(state) {
  const pos = state.player.position;
  const type = pos === 'FW' ? 'shot' : pos === 'DF' ? 'tackle' : 'pass';
  return { type, context: type === 'shot' ? 'box' : type === 'pass' ? 'buildup' : 'duel', weights: GAME_WEIGHTS[type] };
}
