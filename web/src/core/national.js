// MİLLİ TAKIM — U-19, U-21 ve A Milli Takım; milli aralar, kritik anlı milli maçlar ve büyük turnuvalar.
//
//  • Çağrı: OVR, form, ün ve Federasyon ilişkisinden bir "çağrı puanı". Yaşa göre en üst uygun takım.
//  • Milli ara (NATIONAL_WEEKS): kulüp maçından sonra çağrı gelir. Kampa katılırsan bir milli maç oynanır
//    (oyuncunun kritik anı mini oyunla), reddedersen dinlenirsin ama Federasyon ve taraftar küser.
//  • Yorgunluk dengesi: milli maç enerji götürür; yorgunken gidersen sakatlık riski artar.
//  • Büyük turnuva: çift sezonların sonunda (Avrupa Şampiyonası / Dünya Kupası) A takımdaysan.
//    Grup + çeyrek + yarı otomatik; finalde kritik an senin.
import { chance, clamp, pick, poisson, rand, randInt, round1, shuffle } from './rng.js';
import { changeEnergy, changeFame, changeMorale, changeRel, form, ovr } from './player.js';

export const NATIONAL_WEEKS = [6, 16];

export const NATIONAL_TEAMS = {
  U19: { id: 'U19', name: 'U-19 Milli Takımı', short: 'U-19', maxAge: 19, minScore: 28, base: 58, fame: 1, fans: 1 },
  U21: { id: 'U21', name: 'U-21 Milli Takımı', short: 'U-21', maxAge: 21, minScore: 40, base: 64, fame: 1.5, fans: 2 },
  A: { id: 'A', name: 'A Milli Takım', short: 'A Milli', maxAge: 99, minScore: 64, base: 72, fame: 3, fans: 3 },
};

/** Oyuncunun milli takımı: vatandaşlığa göre (setHomeNation). Varsayılan Türkiye. */
export const HOME_NATION = { country: 'tr', name: 'Türkiye', short: 'TÜR', colors: ['#e30a17', '#ffffff'], r: 74, conf: 'UEFA' };
const TEAM_BASE = Object.fromEntries(Object.entries(NATIONAL_TEAMS).map(([k, t]) => [k, { minScore: t.minScore, base: t.base }]));

/** Rakip ülkeler (A takım gücü; gençlerde aynı sıra korunur, ölçek düşer) */
export const NATIONS = [
  { name: 'Arjantin', short: 'ARG', r: 86, colors: ['#75aadb', '#ffffff'] },
  { name: 'Fransa', short: 'FRA', r: 86, colors: ['#1e3a8a', '#ffffff'] },
  { name: 'Brezilya', short: 'BRA', r: 85, colors: ['#facc15', '#16a34a'] },
  { name: 'İspanya', short: 'İSP', r: 85, colors: ['#c60b1e', '#ffc400'] },
  { name: 'İngiltere', short: 'İNG', r: 84, colors: ['#ffffff', '#1e3a8a'] },
  { name: 'Portekiz', short: 'POR', r: 83, colors: ['#9f1239', '#15803d'] },
  { name: 'Almanya', short: 'ALM', r: 82, colors: ['#f8fafc', '#111827'] },
  { name: 'Hollanda', short: 'HOL', r: 81, colors: ['#f97316', '#ffffff'] },
  { name: 'İtalya', short: 'İTA', r: 80, colors: ['#1d4ed8', '#ffffff'] },
  { name: 'Belçika', short: 'BEL', r: 79, colors: ['#b91c1c', '#facc15'] },
  { name: 'Hırvatistan', short: 'HIR', r: 78, colors: ['#dc2626', '#ffffff'] },
  { name: 'Uruguay', short: 'URU', r: 77, colors: ['#7dd3fc', '#111827'] },
  { name: 'Kolombiya', short: 'KOL', r: 76, colors: ['#facc15', '#1e3a8a'] },
  { name: 'Fas', short: 'FAS', r: 75, colors: ['#b91c1c', '#15803d'] },
  { name: 'Danimarka', short: 'DAN', r: 75, colors: ['#c8102e', '#ffffff'] },
  { name: 'İsviçre', short: 'İSV', r: 74, colors: ['#dc2626', '#ffffff'] },
  { name: 'Avusturya', short: 'AVU', r: 74, colors: ['#ef4444', '#ffffff'] },
  { name: 'Senegal', short: 'SEN', r: 73, colors: ['#f8fafc', '#16a34a'] },
  { name: 'Ukrayna', short: 'UKR', r: 72, colors: ['#facc15', '#1d4ed8'] },
  { name: 'Japonya', short: 'JAP', r: 72, colors: ['#1e40af', '#ffffff'] },
  { name: 'Sırbistan', short: 'SIR', r: 72, colors: ['#b91c1c', '#1e3a8a'] },
  { name: 'Polonya', short: 'POL', r: 71, colors: ['#ffffff', '#dc2626'] },
  { name: 'ABD', short: 'ABD', r: 71, colors: ['#ffffff', '#1e3a8a'] },
  { name: 'Meksika', short: 'MEK', r: 71, colors: ['#15803d', '#ffffff'] },
  { name: 'Çekya', short: 'ÇEK', r: 70, colors: ['#dc2626', '#1e3a8a'] },
  { name: 'İskoçya', short: 'İSK', r: 69, colors: ['#1e3a8a', '#ffffff'] },
  { name: 'Macaristan', short: 'MAC', r: 69, colors: ['#dc2626', '#15803d'] },
  { name: 'Yunanistan', short: 'YUN', r: 68, colors: ['#1d4ed8', '#ffffff'] },
  { name: 'Gürcistan', short: 'GÜR', r: 67, colors: ['#ffffff', '#dc2626'] },
  { name: 'Norveç', short: 'NOR', r: 72, colors: ['#ba0c2f', '#00205b'] },
  // oyundaki diğer ülkeler ve kıta turnuvaları için ek takımlar
  { name: 'Türkiye', short: 'TÜR', r: 74, colors: ['#e30a17', '#ffffff'] },
  { name: 'Galler', short: 'GAL', r: 69, colors: ['#c8102e', '#ffffff'] },
  { name: 'Rusya', short: 'RUS', r: 70, colors: ['#ffffff', '#1d4ed8'] },
  { name: 'Romanya', short: 'ROM', r: 68, colors: ['#facc15', '#1e3a8a'] },
  { name: 'Çin', short: 'ÇİN', r: 60, colors: ['#dc2626', '#facc15'] },
  { name: 'Suudi Arabistan', short: 'SUU', r: 64, colors: ['#ffffff', '#15803d'] },
  { name: 'Güney Kore', short: 'KOR', r: 71, colors: ['#dc2626', '#1e3a8a'] },
  { name: 'İran', short: 'İRA', r: 70, colors: ['#ffffff', '#dc2626'] },
  { name: 'Avustralya', short: 'AVS', r: 70, colors: ['#facc15', '#15803d'] },
  { name: 'Katar', short: 'KAT', r: 63, colors: ['#7f1d1d', '#ffffff'] },
  { name: 'Güney Afrika', short: 'GAF', r: 63, colors: ['#facc15', '#15803d'] },
  { name: 'Mısır', short: 'MIS', r: 67, colors: ['#dc2626', '#ffffff'] },
  { name: 'Nijerya', short: 'NİJ', r: 70, colors: ['#15803d', '#ffffff'] },
  { name: 'Fildişi Sahili', short: 'FİL', r: 71, colors: ['#f97316', '#ffffff'] },
  { name: 'Cezayir', short: 'CEZ', r: 69, colors: ['#ffffff', '#15803d'] },
  { name: 'Kamerun', short: 'KAM', r: 68, colors: ['#15803d', '#dc2626'] },
  { name: 'Gana', short: 'GAN', r: 67, colors: ['#ffffff', '#111827'] },
  { name: 'Ekvador', short: 'EKV', r: 70, colors: ['#facc15', '#1e3a8a'] },
  { name: 'Şili', short: 'ŞİL', r: 69, colors: ['#dc2626', '#1e3a8a'] },
  { name: 'Paraguay', short: 'PAR', r: 67, colors: ['#dc2626', '#ffffff'] },
  { name: 'Peru', short: 'PER', r: 66, colors: ['#ffffff', '#dc2626'] },
  { name: 'Kanada', short: 'KAN', r: 68, colors: ['#dc2626', '#ffffff'] },
  { name: 'Kosta Rika', short: 'KOS', r: 65, colors: ['#dc2626', '#1e3a8a'] },
  { name: 'Panama', short: 'PAN', r: 63, colors: ['#dc2626', '#ffffff'] },
  { name: 'Jamaika', short: 'JAM', r: 62, colors: ['#facc15', '#15803d'] },
];
const CONF_OF = {
  ARG: 'CONMEBOL', BRA: 'CONMEBOL', URU: 'CONMEBOL', KOL: 'CONMEBOL', EKV: 'CONMEBOL', ŞİL: 'CONMEBOL', PAR: 'CONMEBOL', PER: 'CONMEBOL',
  FAS: 'CAF', SEN: 'CAF', GAF: 'CAF', MIS: 'CAF', NİJ: 'CAF', FİL: 'CAF', CEZ: 'CAF', KAM: 'CAF', GAN: 'CAF',
  JAP: 'AFC', ÇİN: 'AFC', SUU: 'AFC', KOR: 'AFC', İRA: 'AFC', AVS: 'AFC', KAT: 'AFC',
  ABD: 'CONCACAF', MEK: 'CONCACAF', KAN: 'CONCACAF', KOS: 'CONCACAF', PAN: 'CONCACAF', JAM: 'CONCACAF',
};
for (const n of NATIONS) n.conf = CONF_OF[n.short] || 'UEFA';

/** Oyundaki ülke kimliği → milli takım kısaltması */
export const NATION_OF_COUNTRY = {
  tr: 'TÜR', en: 'İNG', es: 'İSP', de: 'ALM', it: 'İTA', fr: 'FRA', pt: 'POR', sc: 'İSK', wa: 'GAL', dk: 'DAN', ru: 'RUS', ua: 'UKR', gr: 'YUN', ro: 'ROM',
  ch: 'İSV', pl: 'POL', cn: 'ÇİN', sa: 'SUU', jp: 'JAP', kr: 'KOR', za: 'GAF', eg: 'MIS', ng: 'NİJ', ma: 'FAS', br: 'BRA', ar: 'ARG', us: 'ABD', ca: 'KAN',
};
export const COUNTRY_OF_NATION = Object.fromEntries(Object.entries(NATION_OF_COUNTRY).map(([c, n]) => [n, c]));

/** Kıta şampiyonası adı */
export const CONTINENTAL = { UEFA: 'Avrupa Şampiyonası', CONMEBOL: 'Copa América', AFC: 'Asya Kupası', CAF: 'Afrika Uluslar Kupası', CONCACAF: 'Gold Cup' };

/**
 * Vatandaşlığa göre milli takımı ayarlar: ad, renkler, güç; çağrı eşikleri ülkenin gücüne göre kayar
 * (güçlü ülkede milli formayı giymek daha zor).
 */
export function setHomeNation(countryId = 'tr') {
  const short = NATION_OF_COUNTRY[countryId] || 'TÜR';
  const nat = NATIONS.find((x) => x.short === short) || NATIONS.find((x) => x.short === 'TÜR');
  Object.assign(HOME_NATION, { country: COUNTRY_OF_NATION[nat.short] || countryId, name: nat.name, short: nat.short, colors: nat.colors.slice(), r: nat.r, conf: nat.conf });
  const adj = nat.r - 74;
  for (const [k, t] of Object.entries(NATIONAL_TEAMS)) {
    t.minScore = Math.round(TEAM_BASE[k].minScore + adj * 0.7);
    t.base = TEAM_BASE[k].base + adj;
  }
  return HOME_NATION;
}

/** Rakip olabilecek milli takımlar (kendi ülken hariç) */
export const rivalNations = (filter = () => true) => NATIONS.filter((x) => x.short !== HOME_NATION.short && filter(x));
const NATION_BY_SHORT = Object.fromEntries(NATIONS.map((n) => [n.short, n]));
export const nationByShort = (s) => NATION_BY_SHORT[s] || null;

const MOMENT_BY_POS = { FW: { type: 'shot', context: 'box' }, MF: { type: 'pass', context: 'final' }, DF: { type: 'tackle', context: 'threat' } };

export function ensureNational(state) {
  setHomeNation(state.player?.nationality || 'tr');
  const n = state.national || (state.national = {});
  n.caps = { U19: 0, U21: 0, A: 0, ...(n.caps || {}) };
  n.goals = { U19: 0, U21: 0, A: 0, ...(n.goals || {}) };
  // Eski kayıtlar: olay sistemiyle kazanılmış A milli maçları
  if (state.career?.caps && n.caps.A < state.career.caps) n.caps.A = state.career.caps;
  n.log = n.log || [];
  n.tournaments = n.tournaments || [];
  n.declined = n.declined || 0;
  n.seasonCaps = n.seasonCaps || {};
  n.current = n.current ?? null; // bu sezonki seviye
  return n;
}

/** Çağrı puanı: OVR + form + ün + federasyon */
export function callUpScore(state) {
  const p = state.player;
  const fed = p.rel.federation ?? 50;
  return ovr(p) + (form(p) - 6.5) * 4 + (p.fame || 0) * 0.06 + (fed - 50) * 0.05 - ((state.flags.benchStreak || 0) >= 3 ? 4 : 0);
}

/** Bu hafta hangi milli takıma çağrılır? (null = çağrı yok) */
export function callUpLevel(state) {
  const p = state.player;
  if ((p.rel.federation ?? 50) < 18) return null; // federasyonla aran bozuksa çağrılmazsın
  if ((state.flags.injuredWeeks || 0) > 0) return null;
  const score = callUpScore(state);
  if (score >= NATIONAL_TEAMS.A.minScore) return 'A';
  if (p.age <= NATIONAL_TEAMS.U21.maxAge && score >= NATIONAL_TEAMS.U21.minScore) return 'U21';
  if (p.age <= NATIONAL_TEAMS.U19.maxAge && score >= NATIONAL_TEAMS.U19.minScore) return 'U19';
  return null;
}

/** Bir sonraki çağrı için hedef (arayüzdeki ilerleme çubuğu) */
export function nextCallTarget(state) {
  const score = callUpScore(state);
  const age = state.player.age;
  const levels = ['U19', 'U21', 'A'].filter((l) => age <= NATIONAL_TEAMS[l].maxAge);
  const cur = callUpLevel(state);
  const next = levels.find((l) => NATIONAL_TEAMS[l].minScore > score && (!cur || NATIONAL_TEAMS[l].minScore > NATIONAL_TEAMS[cur].minScore));
  return { score, current: cur, next, need: next ? NATIONAL_TEAMS[next].minScore : null };
}

const teamStrength = (level, season) => NATIONAL_TEAMS[level].base + ((season * 7) % 5) - 2;
const scaledR = (nation, level) => (level === 'A' ? nation.r : nation.r - (level === 'U21' ? 12 : 18));
const lambda = (a, b) => 1.25 * Math.exp((a - b) / 18);

/**
 * Milli ara haftasında çağrı (game.endWeek çağırır). Çağrı varsa state.pending.national ayarlanır.
 * @returns {object|null}
 */
export function nationalWindow(state) {
  const n = ensureNational(state);
  if (!NATIONAL_WEEKS.includes(state.calendar.week)) return null;
  const level = callUpLevel(state);
  if (!level) return null;
  const team = NATIONAL_TEAMS[level];
  const pool = rivalNations((x) => x.r <= 82);
  const opp = pick(pool);
  const comp = level === 'A' ? pick(['Uluslar Ligi', 'Eleme Grubu', 'Hazırlık Maçı']) : 'Eleme Grubu';
  const role = callUpScore(state) >= team.minScore + 8 ? 'starter' : chance(0.6) ? 'starter' : 'sub';
  const call = { level, season: state.calendar.season, week: state.calendar.week, opp: opp.short, comp, role, home: chance(0.5) };
  n.current = level;
  state.pending.national = call;
  return call;
}

/** Kampa katılmadan: çağrıyı reddet (dinlen) */
export function declineCallUp(state) {
  const n = ensureNational(state);
  const call = state.pending.national;
  state.pending.national = null;
  if (!call) return { changes: [] };
  n.declined += 1;
  changeRel(state.player, 'federation', -8);
  changeRel(state.player, 'fans', -3);
  changeMorale(state.player, -2);
  changeEnergy(state.player, 8);
  n.log.unshift({ s: call.season, w: call.week, text: `${NATIONAL_TEAMS[call.level].short} çağrısını reddettin.` });
  return { changes: [{ key: 'federation', label: 'Federasyon', delta: -8 }, { key: 'fans', label: 'Taraftar', delta: -3 }, { key: 'energy', label: 'Enerji', delta: 8 }] };
}

/** Milli maçın kritik anı (mini oyun ayarları) */
export function nationalMoment(state) {
  const m = MOMENT_BY_POS[state.player.position] || MOMENT_BY_POS.MF;
  return { ...m };
}

/**
 * Milli maçı sonuçlandırır. result = mini oyun sonucu ({success, accuracy, outcome}).
 * @returns {{my:number, opp:number, res:'W'|'D'|'L', rating:number, goals:number, assists:number, text:string, changes:Array}}
 */
export function playNationalMatch(state, result) {
  const n = ensureNational(state);
  const call = state.pending.national;
  if (!call) return null;
  state.pending.national = null;
  const p = state.player;
  const level = call.level;
  const team = NATIONAL_TEAMS[level];
  const opp = nationByShort(call.opp);
  const myR = teamStrength(level, call.season) + clamp((ovr(p) - team.minScore) * 0.12, -2, 4) + (call.home ? 2 : 0);
  const oppR = scaledR(opp, level) + (call.home ? 0 : 2);
  let my = poisson(lambda(myR, oppR));
  let o = poisson(lambda(oppR, myR));
  let goals = 0;
  let assists = 0;
  const mom = nationalMoment(state);
  if (result?.success) {
    if (mom.type === 'shot') { my += 1; goals = 1; }
    else if (mom.type === 'pass') { if (chance(0.55 + 0.3 * (result.accuracy || 0))) { my += 1; assists = 1; } }
    else if (o > 0) o -= 1;
  } else if (mom.type === 'tackle' && chance(0.4)) o += 1;
  const res = my > o ? 'W' : my < o ? 'L' : 'D';
  const rating = clamp(round1(6.2 + (result?.success ? 1.1 : -0.5) + goals * 0.6 + assists * 0.5 + (res === 'W' ? 0.3 : res === 'L' ? -0.3 : 0) + rand(-0.3, 0.3)), 4, 10);

  // Etkiler: gurur, ün, yorgunluk
  const before = { fame: p.fame, fans: p.rel.fans, morale: p.morale, energy: p.energy, federation: p.rel.federation };
  const tired = p.energy < 35;
  changeFame(p, team.fame + goals * 1.5);
  changeRel(p, 'fans', team.fans + goals * 2);
  changeRel(p, 'federation', 2);
  changeMorale(p, res === 'W' ? 6 : res === 'D' ? 2 : -3);
  changeEnergy(p, call.role === 'starter' ? -15 : -8);
  let injured = 0;
  if (chance(tired ? 0.12 : 0.03)) {
    injured = randInt(1, 2);
    state.flags.injuredWeeks = Math.max(state.flags.injuredWeeks || 0, injured);
  }
  n.caps[level] += 1;
  n.goals[level] += goals;
  n.seasonCaps[call.season] = (n.seasonCaps[call.season] || 0) + (level === 'A' ? 1 : 0);
  if (level === 'A') state.career.caps = n.caps.A;
  const line = `${team.short} · ${HOME_NATION.name} ${my}-${o} ${opp.name}${goals ? ' · gol attın' : ''}${assists ? ' · asist yaptın' : ''}`;
  n.log.unshift({ s: call.season, w: call.week, text: line, res });
  n.log.length = Math.min(n.log.length, 20);
  const changes = [
    { key: 'fame', label: 'Ün', delta: round1(p.fame - before.fame) },
    { key: 'fans', label: 'Taraftar', delta: p.rel.fans - before.fans },
    { key: 'federation', label: 'Federasyon', delta: p.rel.federation - before.federation },
    { key: 'morale', label: 'Moral', delta: p.morale - before.morale },
    { key: 'energy', label: 'Enerji', delta: p.energy - before.energy },
  ].filter((c) => c.delta);
  return { call, opp, my, opp_goals: o, res, rating, goals, assists, injured, text: line, changes };
}

// ─────────────────────────── Büyük turnuva ───────────────────────────

export function tournamentName(season) {
  return season % 4 === 2 ? CONTINENTAL[HOME_NATION.conf] || 'Avrupa Şampiyonası' : 'Dünya Kupası';
}

/** Sezon sonunda turnuvaya gidiyor mu? (çift sezon + bu sezon A takımda oynadı ya da puanı yetiyor) */
export function tournamentEligible(state) {
  const n = ensureNational(state);
  const s = state.calendar.season;
  if (s % 2 !== 0) return false;
  if (n.tournaments.some((t) => t.season === s)) return false;
  return (n.seasonCaps[s] || 0) > 0 || callUpLevel(state) === 'A';
}

function simMatch(myR, oppR) {
  return { my: poisson(lambda(myR, oppR)), opp: poisson(lambda(oppR, myR)), pens: null };
}

/** Penaltı atışları: [biz, onlar], kazanan her zaman fazla atar */
function penalties(edge) {
  const win = chance(clamp(0.5 + edge, 0.15, 0.85));
  return win ? [randInt(4, 5), randInt(2, 3)] : [randInt(2, 3), randInt(4, 5)];
}

const won = (m) => m.my > m.opp || (m.pens && m.pens[0] > m.pens[1]);

/**
 * Turnuvayı finale kadar oynatır. Final, oyuncunun kritik anını bekler (state.pending.tournament.final).
 * Oyuncunun performansı OVR ve forma göre otomatik.
 */
export function startTournament(state) {
  const n = ensureNational(state);
  const season = state.calendar.season;
  const p = state.player;
  const name = tournamentName(season);
  const myR = teamStrength('A', season) + clamp((ovr(p) - 60) * 0.12, -2, 5);
  const field = shuffle(NATIONS);
  const group = field.slice(0, 3);
  const knock = field.slice(3);
  const posGoal = { FW: 0.32, MF: 0.14, DF: 0.05 }[p.position] || 0.12;
  const perf = () => {
    const r = clamp(round1(6.4 + (ovr(p) - 70) / 14 + (form(p) - 6.5) * 0.5 + rand(-0.6, 0.6)), 4.5, 9.8);
    const g = chance(posGoal * (0.6 + r / 10)) ? 1 : 0;
    return { rating: r, goals: g };
  };
  const stages = [];
  // Grup: 3 maç, 4+ puan (ya da 3 puan + averaj) çıkar
  let pts = 0;
  let gd = 0;
  const gm = group.map((o) => {
    const m = simMatch(myR, o.r);
    const pf = perf();
    m.my += pf.goals && m.my === 0 ? 1 : 0;
    pts += m.my > m.opp ? 3 : m.my === m.opp ? 1 : 0;
    gd += m.my - m.opp;
    return { vs: o.short, ...m, ...pf };
  });
  const out = pts >= 4 || (pts === 3 && gd >= 0);
  stages.push({ id: 'group', name: 'Grup aşaması', matches: gm, pts, gd, through: out });
  let alive = out;
  const rounds = [['qf', 'Çeyrek final'], ['sf', 'Yarı final']];
  if (alive) {
    for (let i = 0; i < rounds.length && alive; i++) {
      const o = knock[i];
      const m = simMatch(myR, o.r + 2 * i);
      const pf = perf();
      if (pf.goals && m.my <= m.opp) m.my += 1; // oyuncunun golü skoru değiştirir
      if (m.my === m.opp) m.pens = penalties((myR - o.r) / 100);
      const st = { id: rounds[i][0], name: rounds[i][1], matches: [{ vs: o.short, ...m, ...pf }], through: won(m) };
      stages.push(st);
      alive = st.through;
    }
  }
  const t = { season, name, stages, final: alive ? { opp: knock[2].short, oppR: knock[2].r + 3, myR } : null, result: alive ? null : stages[stages.length - 1].id };
  state.pending.tournament = t;
  return t;
}

/**
 * Final: oyuncunun kritik anı skoru belirler.
 * @returns {{won:boolean, my:number, opp:number, pens:number[]|null, award:object|null}}
 */
export function finishTournament(state, momentResult) {
  const n = ensureNational(state);
  const t = state.pending.tournament;
  if (!t) return null;
  state.pending.tournament = null;
  let finalRes = null;
  if (t.final) {
    const m = simMatch(t.final.myR, t.final.oppR);
    const mom = nationalMoment(state);
    let goals = 0;
    if (momentResult?.success) {
      if (mom.type === 'shot') { m.my += 1; goals = 1; }
      else if (mom.type === 'pass') { if (chance(0.7)) m.my += 1; }
      else if (m.opp > 0) m.opp -= 1;
    }
    if (m.my === m.opp) m.pens = penalties(momentResult?.success ? 0.12 : -0.05);
    finalRes = { vs: t.final.opp, ...m, goals, rating: clamp(round1(6.5 + (momentResult?.success ? 1.4 : -0.6) + rand(-0.3, 0.3)), 4, 10), won: won(m) };
    t.stages.push({ id: 'final', name: 'Final', matches: [finalRes], through: finalRes.won });
    t.result = finalRes.won ? 'champion' : 'final';
  }
  const record = { season: t.season, name: t.name, result: t.result };
  n.tournaments.push(record);
  // Etkiler
  const p = state.player;
  const lvl = { group: 0, qf: 1, sf: 2, final: 3, champion: 5 }[t.result] || 0;
  changeFame(p, 2 + lvl * 2);
  changeRel(p, 'fans', 2 + lvl * 2);
  changeMorale(p, t.result === 'champion' ? 20 : lvl >= 2 ? 6 : -4);
  changeEnergy(p, -10);
  const apps = t.stages.reduce((sum, st) => sum + st.matches.length, 0);
  n.caps.A += apps;
  n.goals.A += t.stages.reduce((sum, st) => sum + st.matches.reduce((g, m) => g + (m.goals || 0), 0), 0);
  state.career.caps = n.caps.A;
  let award = null;
  if (t.result === 'champion') {
    award = { season: t.season, title: `${t.name} Şampiyonu`, icon: 'trophy', national: true };
    state.career.awards.push(award);
  }
  return { t, final: finalRes, award, apps };
}

export const RESULT_LABEL = { group: 'Grupta elendi', qf: 'Çeyrek finalde elendi', sf: 'Yarı finalde elendi', final: 'Finalist', champion: 'ŞAMPİYON' };
