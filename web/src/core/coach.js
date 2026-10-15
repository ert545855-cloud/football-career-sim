// TEKNİK DİREKTÖR VE TAKTİK ROLLER
//  • Her kulübün bir hocası var: oyun anlayışı (stil), diziliş, koltuk güvencesi ve sana bakışı (likes).
//  • Oyuncuya taktik bir rol verilir (ör. Kanat Forvet, Oyun Kurucu, Hücumcu Bek). Rol, maçta gelen
//    kritik anların türünü değiştirir; stil de gol beklentisini ve an dağılımını etkiler.
//  • Kötü sonuçlarda koltuk güvencesi düşer; sıfırlanırsa hoca kovulur, yeni hoca gelir: ilişki sıfırlanır,
//    yeni diziliş ve rol. Transferde yeni kulübün hocası seni karşılar.
import { CLUB_BY_ID, COUNTRY_BY_ID, LEAGUES } from './data.js';
import { clamp, chance, pick, rand, randInt } from './rng.js';
import { randomName } from './world/names.js';
import { clubRating, leagueOf, sortedTable } from './league.js';
import { form } from './player.js';

export const STYLES = {
  attack: { id: 'attack', name: 'Hücumcu', desc: 'Bol pozisyon, bol gol; savunma riskli.', goals: 1.12, conc: 1.08, moments: { shot: 1.15, attack: 1.3, tackle: 0.9 } },
  balance: { id: 'balance', name: 'Dengeli', desc: 'Kontrollü, risksiz futbol.', goals: 1, conc: 1, moments: {} },
  defend: { id: 'defend', name: 'Savunmacı', desc: 'Önce kalesini korur; az gol yer, az atar.', goals: 0.88, conc: 0.86, moments: { tackle: 1.35, attack: 0.75, shot: 0.9 } },
  press: { id: 'press', name: 'Gegenpress', desc: 'Önde baskı, yüksek tempo; yorucu.', goals: 1.06, conc: 0.96, fatigue: 1.08, moments: { tackle: 1.25, attack: 1.15 } },
  counter: { id: 'counter', name: 'Kontra Atak', desc: 'Topu rakibe bırakır, hızlı çıkar.', goals: 1, conc: 0.95, moments: { attack: 1.55, pass: 0.9 } },
};
export const FORMATIONS = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '4-1-4-1'];

/** Taktik roller: an çarpanları (moments) ve şut bağlamı çarpanları (ctx); fit: hangi özellikler bu role uyar */
export const ROLES = {
  FW: {
    poacher: { name: 'Fırsatçı Golcü', desc: 'Ceza sahasında bitirici: daha çok şut anı.', moments: { shot: 1.3, pass: 0.75 }, fit: { shooting: 1 } },
    target: { name: 'Hedef Forvet', desc: 'Sırtı dönük oyun, kafa topları ve kornerler.', moments: { shot: 1.1 }, ctx: { corner: 2.2 }, fit: { shooting: 0.5, defending: 0.3, stamina: 0.2 } },
    winger: { name: 'Kanat Forvet', desc: 'Hız ve çalım: daha çok hücum anı.', moments: { attack: 1.7, shot: 0.85 }, fit: { speed: 0.7, shooting: 0.3 } },
    false9: { name: 'Sahte 9', desc: 'Geriye gelip oyunu kurar: daha çok pas anı.', moments: { pass: 1.5, shot: 0.85 }, fit: { passing: 0.7, shooting: 0.3 } },
  },
  MF: {
    playmaker: { name: 'Oyun Kurucu', desc: 'Oyunun beyni: pas anları artar.', moments: { pass: 1.3 }, fit: { passing: 1 } },
    b2b: { name: 'Box-to-Box', desc: 'İki ceza sahası arası: hücum ve savunma.', moments: { attack: 1.35, tackle: 1.2, pass: 0.9 }, fit: { stamina: 0.6, passing: 0.2, defending: 0.2 } },
    anchor: { name: 'Ön Libero', desc: 'Savunmanın önünde kalkan: top kapma anları.', moments: { tackle: 1.7, attack: 0.6, shot: 0.7 }, fit: { defending: 0.7, passing: 0.3 } },
    ten: { name: '10 Numara', desc: 'Son pas ve uzaktan şut, serbest vuruşlar.', moments: { shot: 1.35, attack: 1.2, tackle: 0.6 }, ctx: { freekick: 2, edge: 1.3 }, fit: { passing: 0.5, shooting: 0.5 } },
  },
  DF: {
    stopper: { name: 'Stoper', desc: 'Hava hakimiyeti ve sert müdahale.', moments: { tackle: 1.15 }, ctx: { corner: 1.4 }, fit: { defending: 0.8, stamina: 0.2 } },
    fullback: { name: 'Hücumcu Bek', desc: 'Kanatta bindirme: pas ve hücum anları.', moments: { pass: 1.4, attack: 1.5, tackle: 0.85 }, fit: { speed: 0.5, passing: 0.3, stamina: 0.2 } },
    libero: { name: 'Libero', desc: 'Geriden oyun kurar: uzun ve kavisli paslar.', moments: { pass: 1.35, tackle: 0.95 }, fit: { passing: 0.6, defending: 0.4 } },
  },
};

export const roleInfo = (pos, id) => ROLES[pos]?.[id] || Object.values(ROLES[pos] || ROLES.MF)[0];

function bestRole(player, style) {
  const opts = ROLES[player.position] || ROLES.MF;
  let best = null;
  for (const [id, r] of Object.entries(opts)) {
    let v = 0;
    for (const [k, w] of Object.entries(r.fit)) v += (player.stats[k] || 0) * w;
    // stil tercihi: kontra/hücumcu hoca hızlı rolleri, savunmacı hoca savunma rollerini sever
    if (style === 'counter' && (id === 'winger' || id === 'fullback')) v += 4;
    if (style === 'defend' && (id === 'anchor' || id === 'stopper')) v += 4;
    if (style === 'attack' && (id === 'poacher' || id === 'ten')) v += 3;
    if (!best || v > best.v) best = { id, v };
  }
  return best.id;
}

function newCoach(state, reason = 'hire') {
  const club = CLUB_BY_ID[state.career.clubId];
  const lang = COUNTRY_BY_ID[club?.country]?.lang || 'tr';
  const foreign = chance(0.3);
  const name = randomName(foreign ? pick(['es', 'it', 'pt', 'de', 'en']) : lang);
  const style = pick(Object.keys(STYLES));
  const c = {
    clubId: state.career.clubId,
    name,
    style,
    formation: pick(FORMATIONS),
    since: { s: state.calendar.season, w: state.calendar.week },
    security: randInt(62, 78),
    likes: reason === 'sacked' ? Math.round(rand(-6, 6)) : 0,
    role: bestRole(state.player, style),
    form: [],
    age: randInt(38, 64),
    reason,
  };
  return c;
}

/** Mevcut hoca (kulüp değiştiyse yeni hoca) */
export function ensureCoach(state) {
  if (!state.career || !state.player) return null;
  if (!state.coach || state.coach.clubId !== state.career.clubId) {
    const prev = state.coach;
    state.coach = newCoach(state, prev ? 'transfer' : 'hire');
    state.coachHistory = state.coachHistory || [];
    if (prev) state.coachHistory.unshift({ name: prev.name, clubId: prev.clubId, until: { s: state.calendar.season, w: state.calendar.week }, reason: 'transfer' });
  }
  const c = state.coach;
  if (!roleInfo(state.player.position, c.role) || !ROLES[state.player.position]?.[c.role]) c.role = bestRole(state.player, c.style);
  return c;
}

/** Maçtaki an türü çarpanları: rol × stil */
export function momentWeights(state, base) {
  const c = ensureCoach(state);
  if (!c) return base;
  const r = roleInfo(state.player.position, c.role);
  const st = STYLES[c.style] || STYLES.balance;
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = v * (r.moments?.[k] ?? 1) * (st.moments?.[k] ?? 1);
  return out;
}

/** Şut bağlamı çarpanları (Hedef Forvet daha çok korner, 10 Numara serbest vuruş…) */
export function contextWeights(state) {
  const c = state.coach;
  if (!c) return {};
  return roleInfo(state.player.position, c.role)?.ctx || {};
}

/** Gol beklentisi çarpanları (stil) */
export function styleGoals(state) {
  const st = STYLES[state.coach?.style] || STYLES.balance;
  return { my: st.goals, opp: st.conc, fatigue: st.fatigue || 1 };
}

/** Kulübün beklenen sırası (güce göre) */
function expectedPos(state) {
  const lg = state.world.leagues[leagueOf(state.career.clubId)];
  if (!lg) return 6;
  const ids = sortedTable(lg).map((r) => r.id);
  const byR = [...ids].sort((a, b) => clubRating(state.world, b) - clubRating(state.world, a));
  return byR.indexOf(state.career.clubId) + 1;
}

/**
 * Maç sonrası: koltuk güvencesi ve hocanın sana bakışı. Güvence biterse hoca kovulur.
 * @returns {{sacked?:{old:object, coach:object}}|null}
 */
export function coachOnMatch(state, summary) {
  const c = ensureCoach(state);
  if (!c) return null;
  const lg = state.world.leagues[leagueOf(state.career.clubId)];
  const pos = lg ? sortedTable(lg).findIndex((r) => r.id === state.career.clubId) + 1 : 6;
  const exp = expectedPos(state);
  const res = summary.result;
  c.form = [...(c.form || []), res].slice(-6);
  const streakL = c.form.slice(-3).every((x) => x === 'L') && c.form.length >= 3;
  c.security = clamp(c.security + (res === 'W' ? 4 : res === 'D' ? 0 : -6) + clamp((exp - pos) * 0.6, -4, 3) - (streakL ? 6 : 0), 0, 100);
  if (summary.played && summary.rating != null) c.likes = clamp((c.likes || 0) + (summary.rating - 6.6) * 0.7, -12, 12);
  const week = state.calendar.week;
  if (c.security <= 0 && week >= 4 && week <= 20) return { sacked: sackCoach(state, 'results') };
  return null;
}

/** Hoca kovulur; yeni hoca gelir. Oyuncuyla ilişkisi yeniden kurulur. */
export function sackCoach(state, reason = 'results') {
  const old = state.coach;
  state.coachHistory = state.coachHistory || [];
  state.coachHistory.unshift({ name: old.name, clubId: old.clubId, until: { s: state.calendar.season, w: state.calendar.week }, reason });
  state.coachHistory.length = Math.min(state.coachHistory.length, 12);
  const c = newCoach(state, 'sacked');
  state.coach = c;
  // Yeni hoca: ilişki büyük ölçüde sıfırlanır; formun iyiyse sıcak başlar
  const p = state.player;
  const start = clamp(Math.round(45 + (form(p) - 6.5) * 8 + c.likes), 25, 75);
  p.rel.manager = Math.round(p.rel.manager * 0.25 + start * 0.75);
  state.pending.coachChange = { old: { name: old.name, style: old.style }, coach: { name: c.name, style: c.style, formation: c.formation, role: c.role }, s: state.calendar.season, w: state.calendar.week };
  return { old, coach: c };
}

/** Sezon sonu: başarısız hoca yönetim kararıyla gider, güvence tazelenir */
export function coachOnSeasonEnd(state) {
  const c = ensureCoach(state);
  if (!c) return null;
  if (c.security < 22 && chance(0.7)) return sackCoach(state, 'season');
  c.security = clamp(c.security + 25, 40, 90);
  c.form = [];
  return null;
}

/** Rol değişikliği iste (hocayla görüşme). İlişki iyiyse kabul eder. */
export function requestRole(state, roleId) {
  const c = ensureCoach(state);
  const p = state.player;
  if (!ROLES[p.position]?.[roleId]) return { ok: false, text: 'Bu rol mevkine uygun değil.' };
  if (roleId === c.role) return { ok: false, text: 'Zaten bu roldesin.' };
  const fitBest = bestRole(p, c.style) === roleId;
  const pAccept = clamp((p.rel.manager - 40) / 50 + (fitBest ? 0.3 : 0) + (c.likes || 0) / 40, 0.05, 0.95);
  c.lastAsk = { s: state.calendar.season, w: state.calendar.week };
  if (chance(pAccept)) {
    c.role = roleId;
    return { ok: true, accepted: true, text: `Hoca: "Peki, seni ${roleInfo(p.position, roleId).name} olarak deneyelim. Beni mahcup etme."` };
  }
  p.rel.manager = clamp(p.rel.manager - 2, 0, 100);
  return { ok: true, accepted: false, text: `Hoca: "Şu an takımın sana ${roleInfo(p.position, c.role).name} olarak ihtiyacı var. Sabret."` };
}

export const canAskRole = (state) => {
  const c = state.coach;
  return !c?.lastAsk || c.lastAsk.s !== state.calendar.season || state.calendar.week - c.lastAsk.w >= 3;
};

/** Koltuk durumu etiketi */
export function securityLabel(sec) {
  if (sec >= 70) return { text: 'Koltuğu sağlam', tone: 'good' };
  if (sec >= 45) return { text: 'Güvende', tone: '' };
  if (sec >= 25) return { text: 'Koltuğu sallantıda', tone: 'warn' };
  return { text: 'Gönderilmek üzere', tone: 'bad' };
}

export const leagueName = (state) => LEAGUES[leagueOf(state.career.clubId)]?.name || '';
