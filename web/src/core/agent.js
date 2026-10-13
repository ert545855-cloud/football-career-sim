// MENAJER / AJAN — temsilci seçimi, komisyon, sözleşme pazarlığı, zam talebi ve ajan ağından gelen teklifler.
//
// Ajan özellikleri:
//   commission: haftalık maaş ve imza parasından kesilen pay
//   skill:      pazarlık ustalığı (kabul olasılığını artırır)
//   network:    bağlantılar (transfer pencerelerinde ek, daha büyük kulüp teklifi getirir)
//   aggressive: sert pazarlıkçı — daha çok kabul ettirir ama kulübün masadan kalkma riski artar
//   sponsor:    reklam gelirine çarpan
// Kendini temsil etmek (ajan yok) komisyonsuzdur ama pazarlıkta zayıf kalırsın.
import { CLUBS, CLUB_BY_ID } from './data.js';
import { chance, clamp, roundTo, shuffle } from './rng.js';
import { clubRating, leagueOf } from './league.js';
import { form, ovr, changeMorale, changeRel } from './player.js';
import { outlookFor, wageFor } from './economy.js';

/** @typedef {{id:string,name:string,firm:string,title:string,bio:string,commission:number,skill:number,network:number,aggressive?:boolean,sponsor?:number,minFame:number,minOvr:number,look:object,color:string}} AgentDef */

/** @type {AgentDef[]} */
export const AGENTS = [
  {
    id: 'self', name: 'Kendini temsil et', firm: 'Ajan yok', title: 'Komisyon yok',
    bio: 'Pazarlığı kendin yaparsın. Para cebinde kalır ama kulüpler seni pek ciddiye almaz.',
    commission: 0, skill: 0.1, network: 0, minFame: 0, minOvr: 0, color: '#64748b', look: null, suit: null,
  },
  {
    id: 'kemal', name: 'Kemal Aksoy', firm: 'Aksoy Futbol', title: 'Mahalle menajeri',
    bio: 'Seni altyapıdan beri tanıyor. Az komisyon alır, kulüplerle arası iyidir ama büyük masalarda tecrübesi azdır.',
    commission: 0.05, skill: 0.35, network: 0.15, minFame: 0, minOvr: 0, color: '#a16207',
    look: { skin: 2, hair: 'bald', hairColor: 4 }, suit: ['#57534e', '#f5f5f4'],
  },
  {
    id: 'selin', name: 'Selin Ateş', firm: 'Ateş Sports Management', title: 'Kurumsal ajans',
    bio: 'Sponsor anlaşmalarında usta. Reklam gelirin %20 artar; transfer ağı orta seviyede.',
    commission: 0.08, skill: 0.55, network: 0.4, sponsor: 1.2, minFame: 18, minOvr: 0, color: '#db2777',
    look: { skin: 1, hair: 'long', hairColor: 0 }, suit: ['#831843', '#fce7f3'],
  },
  {
    id: 'ferit', name: 'Ferit "Kaplan" Yurt', firm: 'Kaplan Menajerlik', title: 'Sert pazarlıkçı',
    bio: 'Masaya yumruğunu vurur. Çoğu zaman istediğini alır ama ipi fazla gerince kulüp masadan kalkabilir.',
    commission: 0.1, skill: 0.75, network: 0.35, aggressive: true, minFame: 28, minOvr: 40, color: '#ea580c',
    look: { skin: 3, hair: 'buzz', hairColor: 0 }, suit: ['#111827', '#f97316'],
  },
  {
    id: 'vitali', name: 'Lorenzo Vitali', firm: 'Vitali Global', title: 'Süper ajan',
    bio: 'Avrupa\'nın en güçlü ajanlarından. Büyük kulüplerin kapısını açar; komisyonu da büyüktür.',
    commission: 0.12, skill: 0.65, network: 0.85, sponsor: 1.1, minFame: 55, minOvr: 60, color: '#7c3aed',
    look: { skin: 0, hair: 'short', hairColor: 4 }, suit: ['#1e1b4b', '#e0e7ff'],
  },
];
export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

export const AGENT_RULES = {
  contractSeasons: 2,
  /** Sözleşme bitmeden ayrılma bedeli: haftalık maaşın katı */
  releaseWeeks: 2,
  /** Zam talebi: sezonda bir kez, bu haftadan sonra */
  raiseFromWeek: 5,
  maxRounds: 2,
};

/** Kayıt alanı */
export function ensureAgent(state) {
  const a = state.agent || (state.agent = {});
  a.id = a.id || 'self';
  a.since = a.since || state.calendar?.season || 1;
  a.untilSeason = a.untilSeason ?? null;
  a.commission = AGENT_BY_ID[a.id]?.commission ?? 0;
  a.raiseSeason = a.raiseSeason ?? 0;
  a.paid = a.paid || 0;
  a.log = a.log || [];
  return a;
}

export const currentAgent = (state) => AGENT_BY_ID[ensureAgent(state).id] || AGENTS[0];

/** Ajan seni temsil etmeyi kabul eder mi? */
export function canHire(state, id) {
  const ag = AGENT_BY_ID[id];
  if (!ag) return { ok: false, reason: 'Ajan bulunamadı.' };
  const cur = ensureAgent(state);
  if (cur.id === id) return { ok: false, reason: 'Zaten seni temsil ediyor.' };
  if (state.player.fame < ag.minFame) return { ok: false, reason: `${ag.name} için ünün en az ${ag.minFame} olmalı.` };
  if (ovr(state.player) < ag.minOvr) return { ok: false, reason: `${ag.name} OVR ${ag.minOvr}+ oyuncularla çalışıyor.` };
  return { ok: true };
}

/** Mevcut ajandan erken ayrılma bedeli */
export function releaseFee(state) {
  const a = ensureAgent(state);
  if (a.id === 'self' || !a.untilSeason || state.calendar.season > a.untilSeason) return 0;
  return roundTo(state.career.contract.wage * AGENT_RULES.releaseWeeks, 50);
}

export function hireAgent(state, id) {
  const check = canHire(state, id);
  if (!check.ok) return check;
  const fee = releaseFee(state);
  if (state.career.money < fee) return { ok: false, reason: `Mevcut ajanından ayrılmak için €${fee.toLocaleString('tr-TR')} gerekiyor.` };
  state.career.money -= fee;
  const a = ensureAgent(state);
  a.id = id;
  a.since = state.calendar.season;
  a.untilSeason = id === 'self' ? null : state.calendar.season + AGENT_RULES.contractSeasons - 1;
  a.commission = AGENT_BY_ID[id].commission;
  a.log.unshift({ s: state.calendar.season, w: state.calendar.week, text: id === 'self' ? 'Ajanınla yollarını ayırdın.' : `${AGENT_BY_ID[id].name} ile ${AGENT_RULES.contractSeasons} sezonluk temsil sözleşmesi imzaladın.` });
  a.log.length = Math.min(a.log.length, 12);
  return { ok: true, fee };
}

/** Haftalık komisyon (economy.weeklyFinance bunu düşer) */
export function weeklyCommission(state) {
  return Math.round(state.career.contract.wage * (state.agent?.commission || 0));
}

/** Reklam geliri çarpanı */
export function agentSponsorMult(state) {
  return currentAgent(state).sponsor || 1;
}

// ─────────────────────────── Teklifler ───────────────────────────

/** Kulübün seni ne kadar istediği (0–1). Pazarlık ve ajan tavsiyesi buna dayanır. */
export function clubInterest(state, offer) {
  const o = ovr(state.player);
  const r = clubRating(state.world, offer.clubId);
  const f = form(state.player);
  let v = 0.4 + (o - (r - 3)) * 0.035 + (f - 6.5) * 0.12 + state.player.fame / 350;
  if (offer.renewal) v += (state.player.rel.board - 50) / 200 + (state.player.influence || 0) / 400;
  return clamp(v, 0.05, 0.95);
}

/** Ajan ağı: transfer penceresinde bağlantılarından ek (daha büyük) kulüp teklifi gelebilir. */
export function agentNetworkOffers(state, offers, kind) {
  const ag = currentAgent(state);
  if (!ag.network || offers.length >= 4) return offers;
  if (!chance(ag.network * (kind === 'mid' ? 0.35 : 0.6))) return offers;
  const o = ovr(state.player);
  const curR = clubRating(state.world, state.career.clubId);
  const taken = new Set([state.career.clubId, ...offers.map((x) => x.clubId)]);
  const reach = 4 + ag.network * 10; // büyük ajan daha büyük kulüplere ulaşır
  const pool = shuffle(CLUBS.filter((c) => !taken.has(c.id)))
    .map((c) => ({ c, r: clubRating(state.world, c.id) }))
    .filter(({ r }) => r > curR && r <= o + reach);
  const pickC = pool.sort((a, b) => b.r - a.r)[0];
  if (!pickC) return offers;
  const wage = wageFor(pickC.r, o);
  offers.push({
    clubId: pickC.c.id,
    wage,
    years: 3,
    signingBonus: roundTo(wage * 8, 100),
    renewal: false,
    outlook: outlookFor(pickC.r, o),
    viaAgent: ag.id,
  });
  ensureAgent(state).log.unshift({ s: state.calendar.season, w: state.calendar.week, text: `${ag.name} bağlantılarını kullandı: ${pickC.c.name} masada.` });
  return offers;
}

// ─────────────────────────── Pazarlık ───────────────────────────

export const ASKS = {
  wage: [
    { id: 0, label: 'Olduğu gibi', pct: 0 },
    { id: 1, label: '+%10', pct: 0.1 },
    { id: 2, label: '+%20', pct: 0.2 },
    { id: 3, label: '+%35', pct: 0.35 },
  ],
  bonus: [
    { id: 0, label: 'Olduğu gibi', pct: 0 },
    { id: 1, label: '+%50', pct: 0.5 },
    { id: 2, label: '+%100', pct: 1 },
  ],
};

/** İsteklerin "açgözlülük" ölçüsü */
export function greed(offer, ask) {
  let g = (ASKS.wage[ask.wage]?.pct || 0) + (ASKS.bonus[ask.bonus]?.pct || 0) * 0.14;
  if (ask.guarantee) g += offer.outlook?.id === 'starter' ? 0.04 : offer.outlook?.id === 'rotation' ? 0.14 : 0.3;
  if (ask.years && ask.years !== offer.years) g += 0.03;
  return g;
}

/** Kabul / karşı teklif / masadan kalkma olasılıkları (arayüzde ajan tavsiyesi için de kullanılır) */
export function negotiationOdds(state, offer, ask, round = 1) {
  const ag = currentAgent(state);
  const interest = clubInterest(state, offer) - (round - 1) * 0.12;
  const g = greed(offer, ask);
  if (g <= 0.0001) return { accept: 1, counter: 0, walk: 0, interest };
  const accept = clamp(interest + ag.skill * 0.35 + (ag.aggressive ? 0.08 : 0) - g * 1.7, 0.03, 0.96);
  const counterShare = clamp(0.55 + ag.skill * 0.3 + interest * 0.2 - (ag.aggressive ? 0.15 : 0) - (round - 1) * 0.25, 0.05, 0.95);
  const counter = (1 - accept) * counterShare;
  return { accept, counter, walk: 1 - accept - counter, interest };
}

/** İsteklere göre yeni şartlar */
export function termsFor(offer, ask, share = 1) {
  const w = (ASKS.wage[ask.wage]?.pct || 0) * share;
  const b = (ASKS.bonus[ask.bonus]?.pct || 0) * share;
  return {
    wage: roundTo(offer.wage * (1 + w), 50),
    signingBonus: offer.signingBonus ? roundTo(offer.signingBonus * (1 + b), 100) : roundTo(offer.wage * 3 * b, 100),
    years: ask.years || offer.years,
    guarantee: !!ask.guarantee && share >= 1,
  };
}

/**
 * Pazarlık turu. Teklif nesnesini (state.pending.offers içindeki) yerinde günceller.
 * @returns {{result:'accept'|'counter'|'walk', offer:any, counter?:any, text:string}}
 */
export function negotiate(state, offer, ask, roll = Math.random()) {
  const ag = currentAgent(state);
  offer.rounds = (offer.rounds || 0) + 1;
  const odds = negotiationOdds(state, offer, ask, offer.rounds);
  const club = CLUB_BY_ID[offer.clubId];
  const who = ag.id === 'self' ? 'Sen' : ag.name;
  if (roll < odds.accept) {
    Object.assign(offer, termsFor(offer, ask), { negotiated: true });
    return { result: 'accept', offer, text: `${club.name} isteklerinizi kabul etti! ${who === 'Sen' ? '' : `${who}: "Hak ettiğini aldın."`}`.trim() };
  }
  if (roll < odds.accept + odds.counter && offer.rounds <= AGENT_RULES.maxRounds) {
    const counter = termsFor(offer, ask, 0.5);
    offer.counter = counter;
    return { result: 'counter', offer, counter, text: `${club.name} ortada buluşmayı teklif ediyor.` };
  }
  offer.withdrawn = true;
  return { result: 'walk', offer, text: `${club.name} masadan kalktı. ${ag.aggressive ? `${who} ipi fazla gerdi.` : 'Talepler fazla bulundu.'}` };
}

/** Karşı teklifi kabul et */
export function acceptCounter(offer) {
  if (!offer.counter) return offer;
  Object.assign(offer, offer.counter, { negotiated: true });
  delete offer.counter;
  return offer;
}

/** Ajanın tavsiyesi (kulübün ilgisine göre) */
export function agentAdvice(state, offer) {
  const ag = currentAgent(state);
  const i = clubInterest(state, offer);
  const level = i >= 0.7 ? 'high' : i >= 0.45 ? 'mid' : 'low';
  const text = {
    high: 'Seni çok istiyorlar. Maaşta %20 rahat isteriz, imza parasını da zorlayabiliriz.',
    mid: 'İlgililer ama sınırsız değil. %10 makul; fazlası risk.',
    low: 'Masada pek kozumuz yok. Teklifi olduğu gibi kabul etmek en güvenlisi.',
  }[level];
  return { level, interest: i, text: ag.id === 'self' ? `İçgüdün: ${text.replace('isteriz', 'istenir').replace('zorlayabiliriz', 'zorlanabilir')}` : text };
}

// ─────────────────────────── Zam talebi ───────────────────────────

/** Sözleşme ortasında zam istemek: sezonda bir kez, form ve piyasa değerine göre. */
export function canAskRaise(state) {
  const a = ensureAgent(state);
  if (state.calendar.phase !== 'week') return { ok: false, reason: 'Sezon arası.' };
  if (a.raiseSeason === state.calendar.season) return { ok: false, reason: 'Bu sezon zaten zam istedin.' };
  if (state.calendar.week < AGENT_RULES.raiseFromWeek) return { ok: false, reason: `Zam için en az ${AGENT_RULES.raiseFromWeek}. haftayı bekle; önce sahada göster.` };
  if (state.career.loan || state.career.academy) return { ok: false, reason: 'Kiralık / altyapı sözleşmesinde zam istenemez.' };
  return { ok: true };
}

export function raiseOdds(state) {
  const ag = currentAgent(state);
  const o = ovr(state.player);
  const r = clubRating(state.world, state.career.clubId);
  const market = wageFor(r, o);
  const gap = (market - state.career.contract.wage) / Math.max(1, state.career.contract.wage);
  const f = form(state.player);
  const p = clamp(0.2 + gap * 1.2 + (f - 6.5) * 0.18 + (state.player.rel.board - 50) / 150 + ag.skill * 0.25, 0.03, 0.92);
  return { p, market, gap };
}

export function askRaise(state, roll = Math.random()) {
  const check = canAskRaise(state);
  if (!check.ok) return { ok: false, text: check.reason };
  const a = ensureAgent(state);
  a.raiseSeason = state.calendar.season;
  const { p, market } = raiseOdds(state);
  const club = CLUB_BY_ID[state.career.clubId];
  if (roll < p) {
    const newWage = roundTo(Math.max(state.career.contract.wage * 1.08, (state.career.contract.wage + market) / 2), 50);
    const before = state.career.contract.wage;
    state.career.contract.wage = newWage;
    state.career.contract.yearsLeft += 1;
    changeMorale(state.player, 5);
    a.log.unshift({ s: state.calendar.season, w: state.calendar.week, text: `Zam: €${before} → €${newWage}/hf, sözleşme 1 yıl uzadı.` });
    return { ok: true, success: true, before, after: newWage, text: `${club.name} yönetimi zammı onayladı ve sözleşmeni 1 yıl uzattı.` };
  }
  changeMorale(state.player, -3);
  changeRel(state.player, 'board', -4);
  a.log.unshift({ s: state.calendar.season, w: state.calendar.week, text: 'Zam talebin reddedildi.' });
  return { ok: true, success: false, text: `${club.name} yönetimi şimdilik zam düşünmüyor. "Önce sahada göster."` };
}

/** İmza parasından ajan payı */
export function signingCut(state, bonus) {
  return Math.round((bonus || 0) * (state.agent?.commission || 0));
}

export const agentLeagueOf = (offer) => leagueOf(offer.clubId);
