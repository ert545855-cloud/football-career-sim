// TRANSFER PİYASASI — piyasa değeri, kulüp bütçeleri, bonservis bedeli, transfer söylentileri (ilgi aşaması),
// kiralık teklifler (satın alma opsiyonlu) ve kariyer transfer geçmişi.
import { CLUB_BY_ID, CLUBS, LEAGUES } from './data.js';
import { chance, clamp, pick, rand, roundTo, shuffle } from './rng.js';
import { clubRating, leagueOf, leaguePrestige } from './league.js';
import { form, ovr } from './player.js';

/** Piyasa değeri (€): güç, yaş, potansiyel, ün ve form */
export function marketValue(state) {
  const p = state.player;
  const o = ovr(p);
  const ageK = p.age <= 21 ? 1.35 : p.age <= 24 ? 1.2 : p.age <= 28 ? 1 : p.age <= 31 ? 0.7 : 0.4;
  const potK = 1 + Math.max(0, (p.potential || o) - o) / 40;
  const fameK = 1 + (p.fame || 0) / 80;
  const formK = clamp(0.8 + (form(p) - 6.5) * 0.15, 0.7, 1.3);
  const v = 60000 * Math.pow(1.145, o - 45) * ageK * potK * fameK * formK;
  return roundTo(v, v >= 1e6 ? 100000 : 10000);
}

/** Kulübün transfer bütçesi (€): güç ve lig prestiji; sezona göre küçük oynama */
export function clubBudget(state, clubId) {
  const r = clubRating(state.world, clubId);
  const pr = leaguePrestige(leagueOf(clubId)) ?? 0.5;
  const seed = ((clubId.charCodeAt(0) * 31 + (clubId.charCodeAt(1) || 7) * 17 + (state.calendar?.season || 1) * 13) % 40) / 100;
  const b = 250000 * Math.pow(1.16, r - 50) * (0.5 + pr) * (0.8 + seed);
  return roundTo(b, b >= 1e6 ? 100000 : 10000);
}

/**
 * Tekliflere bonservis bedeli ve bütçe ekler; bütçesi yetmeyen kulüpler düşer.
 * Sözleşmesi biten oyuncu serbesttir (bonservissiz).
 */
export function priceOffers(state, offers, kind) {
  const free = kind === 'end' && (state.career.contract?.yearsLeft ?? 1) <= 0;
  const value = marketValue(state);
  const releaseOn = !!(state.career.contract?.clauses?.release && state.career.contract.clauses.clubId === state.career.clubId);
  const out = [];
  for (const o of offers) {
    if (o.renewal || o.clubId === state.career.clubId) { out.push(o); continue; }
    const budget = clubBudget(state, o.clubId);
    let fee = free ? 0 : roundTo(value * rand(0.85, 1.25) * (releaseOn ? 0.85 : 1), value >= 1e6 ? 100000 : 10000);
    if (o.loan) fee = 0;
    o.fee = fee;
    o.budget = budget;
    o.free = free;
    if (fee > budget * 1.1 && !o.tag) continue; // bütçe yetmiyor
    out.push(o);
  }
  // hiç teklif kalmadıysa en azından bir tane (bedel indirimli) bırak
  if (!out.length && offers.length) {
    const o = offers[0];
    o.fee = Math.min(o.fee ?? 0, o.budget ?? 0);
    out.push(o);
  }
  return out;
}

// ─────────────────────────── Söylentiler ───────────────────────────
export function ensureMarket(state) {
  const m = (state.market ||= {});
  m.interest ||= []; // {clubId, level 1..3, since:{s,w}}
  m.transfers ||= []; // {s, w, from, to, fee, kind:'transfer'|'free'|'loan'|'buy'}
  m.rumorWeek ||= 0;
  return m;
}

const LEVELS = ['', 'izliyor', 'scout gönderdi', 'teklif hazırlıyor'];

/**
 * Haftalık: iyi oynayan oyuncuya kulüpler ilgi gösterir (ilgi aşaması). Haber metinleri döner.
 */
export function rumorsOnWeek(state, summary) {
  const m = ensureMarket(state);
  const p = state.player;
  const out = [];
  const f = form(p);
  const curR = clubRating(state.world, state.career.clubId);
  const o = ovr(p);
  // ilgi sönümlenmesi
  for (const it of m.interest) if (f < 6.4 && chance(0.25)) it.level -= 1;
  m.interest = m.interest.filter((it) => it.level > 0 && it.clubId !== state.career.clubId);
  const hot = (summary?.played && (summary.rating >= 7.6 || summary.goals >= 2)) || f >= 7.2;
  const amb = p.persona?.ambition ?? 50;
  if (!hot || !chance(0.35 + (amb - 50) / 300)) return out;
  // var olan ilgiyi büyüt ya da yeni kulüp
  const grow = m.interest.length && chance(0.55) ? pick(m.interest) : null;
  if (grow && grow.level < 3) {
    grow.level += 1;
    out.push(`Söylenti: ${CLUB_BY_ID[grow.clubId].name} ${LEVELS[grow.level]}!`);
    return out;
  }
  const cands = shuffle(CLUBS.filter((c) => c.id !== state.career.clubId && !m.interest.some((x) => x.clubId === c.id)))
    .filter((c) => { const r = clubRating(state.world, c.id); return r >= curR + 2 && r <= o + 9; })
    .slice(0, 1);
  for (const c of cands) {
    m.interest.push({ clubId: c.id, level: 1, s: state.calendar.season, w: state.calendar.week });
    if (m.interest.length > 5) m.interest.shift();
    const lg = LEAGUES[c.league];
    out.push(`Transfer söylentisi: ${c.name} (${lg?.name || ''}) seni izliyor. Gözcüler tribündeydi.`);
  }
  return out;
}

/** İlgi gösteren kulüplerin teklif olasılığını artırır: listede yoksa ekleme şansı */
export function interestOffers(state, offers, makeFor) {
  const m = ensureMarket(state);
  const have = new Set(offers.map((x) => x.clubId));
  for (const it of m.interest.slice().sort((a, b) => b.level - a.level)) {
    if (offers.length >= 4) break;
    if (have.has(it.clubId)) { offers.find((x) => x.clubId === it.clubId).interest = it.level; continue; }
    if (chance(0.2 + it.level * 0.22)) {
      const o = makeFor(it.clubId);
      if (o) { o.interest = it.level; offers.push(o); have.add(it.clubId); }
    }
  }
  return offers;
}

/**
 * Kiralık teklif: yedekte kalan genç oyuncuya (≤23) devre arasında oynayabileceği bir kulüpten,
 * sezon sonuna kadar, satın alma opsiyonuyla.
 */
export function loanOffer(state, makeFor) {
  const p = state.player;
  if (p.age > 23 || state.career.loan) return null;
  const benched = (state.flags.benchStreak || 0) >= 3 || state.career.season.starts < 4;
  if (!benched || !chance(0.6)) return null;
  const curR = clubRating(state.world, state.career.clubId);
  const o = ovr(p);
  const cands = CLUBS.filter((c) => c.id !== state.career.clubId && (c.country || 'tr') === (CLUB_BY_ID[state.career.clubId]?.country || 'tr'))
    .filter((c) => { const r = clubRating(state.world, c.id); return r < curR && r >= o - 6 && r <= o + 3; });
  if (!cands.length) return null;
  const c = pick(cands);
  const off = makeFor(c.id);
  if (!off) return null;
  off.loan = true;
  off.buyOption = roundTo(marketValue(state) * 0.9, 10000);
  off.years = 1;
  off.signingBonus = 0;
  off.wage = Math.max(off.wage, state.career.contract.wage);
  return off;
}

/** Transfer kaydı (kariyer arşivi ve rekorlar için) */
export function recordTransfer(state, { from, to, fee = 0, kind = 'transfer' }) {
  const m = ensureMarket(state);
  m.transfers.push({ s: state.calendar.season, w: state.calendar.week, from, to, fee, kind });
  m.interest = m.interest.filter((it) => it.clubId !== to);
}

export const interestLabel = (lvl) => LEVELS[lvl] || '';
