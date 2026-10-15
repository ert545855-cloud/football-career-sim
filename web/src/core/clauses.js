// SÖZLEŞME MADDELERİ — imzadan önce pazarlıkla eklenen maddeler.
//  • Gol primi: attığın her gol için ek ödeme.
//  • Serbest kalma bedeli: büyük kulüpler bedeli ödeyip seni alabilir (daha çok teklif gelir).
//  • İlk 11 garantisi: bu sezon (sezon ortasında imzalarsan gelecek sezon da) forma garantisi.
//  • Sadakat primi: her sezon sonunda kulüpte kaldıysan ikramiye.
//  • Küme düşme maddesi: kulüp düşerse sözleşmen feshedilir, istediğin kulübe gidebilirsin.
// Kabul olasılığı oyuncunun pazarlık gücüne (OVR - kulüp gücü, ün) ve maddenin kulübe maliyetine bağlıdır.
import { LEAGUES } from './data.js';
import { chance, clamp } from './rng.js';
import { clubRating, leagueOf } from './league.js';
import { ovr } from './player.js';

export const CLAUSES = {
  goalBonus: { name: 'Gol primi', desc: (o) => `Her gol için ${o.goalBonusFmt}`, cost: 0.15, icon: 'ball' },
  release: { name: 'Serbest kalma bedeli', desc: () => 'Büyük kulüpler bedeli ödeyip seni transfer edebilir: daha çok teklif.', cost: 0.25, icon: 'swap' },
  starter: { name: 'İlk 11 garantisi', desc: () => 'Bu sezon forma garantisi.', cost: 0.45, icon: 'check' },
  loyalty: { name: 'Sadakat primi', desc: (o) => `Her sezon sonu ${o.loyaltyFmt}`, cost: 0.2, icon: 'heart' },
  relegation: { name: 'Küme düşme maddesi', desc: () => 'Kulüp düşerse sözleşme feshedilir.', cost: 0.12, icon: 'shield', lowerOnly: true },
};

/** Oyuncunun pazarlık gücü (0..1) */
export function leverage(state, clubId) {
  const r = clubRating(state.world, clubId);
  const o = ovr(state.player);
  return clamp(0.45 + (o - (r - 3)) / 20 + (state.player.fame || 0) / 200, 0.05, 0.95);
}

/** Bu teklif için madde seçenekleri ve kabul olasılıkları */
export function clauseOptions(state, offer) {
  const lev = leverage(state, offer.clubId);
  const tier = LEAGUES[leagueOf(offer.clubId)]?.tier || 1;
  const goalBonus = Math.round((offer.wage * 0.25) / 50) * 50 || 50;
  const loyalty = Math.round((offer.wage * 3) / 100) * 100;
  return Object.entries(CLAUSES)
    .filter(([id, c]) => !(c.lowerOnly && tier === 1 && clubRating(state.world, offer.clubId) >= 70) && !(id === 'starter' && offer.guarantee))
    .map(([id, c]) => ({
      id, name: c.name, icon: c.icon,
      desc: c.desc({ goalBonusFmt: `€${goalBonus.toLocaleString('tr-TR')}`, loyaltyFmt: `€${loyalty.toLocaleString('tr-TR')}` }),
      p: clamp(Math.round((lev - c.cost + 0.35) * 100) / 100, 0.05, 0.95),
      value: id === 'goalBonus' ? goalBonus : id === 'loyalty' ? loyalty : true,
    }));
}

/**
 * Seçilen maddeleri masaya koy (en fazla 2). Kabul edilenler teklife yazılır; çok madde isteyince maaş biraz düşebilir.
 * @returns {{accepted:string[], rejected:string[], wageCut:number}}
 */
export function negotiateClauses(state, offer, ids = []) {
  const opts = Object.fromEntries(clauseOptions(state, offer).map((o) => [o.id, o]));
  const accepted = [];
  const rejected = [];
  for (const id of ids.slice(0, 2)) {
    const o = opts[id];
    if (!o) continue;
    if (chance(o.p)) accepted.push(id);
    else rejected.push(id);
  }
  offer.clauses = { ...(offer.clauses || {}) };
  for (const id of accepted) {
    if (id === 'starter') offer.guarantee = true;
    else offer.clauses[id] = opts[id].value;
  }
  let wageCut = 0;
  if (accepted.length >= 2) {
    wageCut = Math.round((offer.wage * 0.05) / 50) * 50;
    offer.wage -= wageCut;
  }
  offer.clausesDone = true;
  return { accepted, rejected, wageCut };
}

/** İmzalanınca sözleşmeye işlenir */
export function applyClauses(state, offer) {
  const c = offer.clauses || {};
  state.career.contract.clauses = Object.keys(c).length ? { ...c, clubId: offer.clubId } : null;
}

export const contractClauses = (state) => {
  const c = state.career?.contract?.clauses;
  return c && c.clubId === state.career.clubId ? c : null;
};

/** Gol primi (maç sonunda) */
export function goalBonusFor(state, goals) {
  const c = contractClauses(state);
  return c?.goalBonus && goals ? c.goalBonus * goals : 0;
}

/** Sezon sonu: sadakat primi; küme düşme maddesi tetiklenirse sözleşme biter */
export function clausesOnSeasonEnd(state, relegated) {
  const c = contractClauses(state);
  if (!c) return null;
  const out = {};
  if (c.loyalty) { state.career.money += c.loyalty; out.loyalty = c.loyalty; }
  if (c.relegation && relegated) { state.career.contract.yearsLeft = 0; out.released = true; }
  return out;
}

export const clauseLabel = (id) => CLAUSES[id]?.name || id;
