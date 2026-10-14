import { CLUBS, CLUB_BY_ID, COUNTRY_BY_ID, ITEM_BY_ID, LEAGUES, LIVING_COST } from './data.js';
import { COUNTRY_PRESTIGE } from './world/countries.js';
import { clamp, roundTo, chance, randInt, shuffle } from './rng.js';
import { addFocus, clubRating, countryOf, leagueIdIn } from './league.js';
import { ovr, form } from './player.js';
import { RelationshipService } from './chirp/relationships.js';
import { onCarSold } from './garage.js';

/** Haftalık maaş: kulüp gücüyle üstel artar, oyuncunun kulübe göre seviyesi çarpan olur. */
export function wageFor(clubR, playerOvr, country = 'tr') {
  const base = 100 * Math.exp(clubR / 14);
  const perf = clamp(0.55 + 0.6 * (playerOvr / clubR - 0.5), 0.5, 1.25);
  // Ülke maaş çarpanı: Premier Lig ve Körfez daha çok öder, alt ekonomiler daha az
  const mult = COUNTRY_BY_ID[country]?.wage ?? 1;
  return Math.max(250, roundTo(base * perf * mult, 50));
}

/** Eşya etkileri: araç ve evde sadece en iyisi sayılır, diğerleri toplanır. */
export function itemEffects(state) {
  const fx = { morale: 0, energy: 0, fans: 0, fame: 0, train: 0 };
  const owned = state.career.items.map((id) => ITEM_BY_ID[id]).filter(Boolean);
  const best = {};
  for (const it of owned) {
    if (it.cat === 'vehicle' || it.cat === 'home') {
      if (!best[it.cat] || it.price + it.weekly * 50 > best[it.cat].price + best[it.cat].weekly * 50) best[it.cat] = it;
    }
  }
  for (const it of owned) {
    if ((it.cat === 'vehicle' || it.cat === 'home') && best[it.cat] !== it) continue;
    for (const [k, v] of Object.entries(it.fx || {})) fx[k] = (fx[k] || 0) + v;
  }
  return fx;
}

export function weeklyUpkeep(state) {
  return state.career.items.reduce((sum, id) => sum + (ITEM_BY_ID[id]?.weekly || 0), 0);
}

export function weeklyFinance(state) {
  const income = state.career.contract.wage;
  const upkeep = weeklyUpkeep(state);
  // Menajer komisyonu (core/agent.js): maaştan haftalık pay
  const agent = Math.round(income * (state.agent?.commission || 0));
  return { income, living: LIVING_COST, upkeep, agent, net: income - LIVING_COST - upkeep - agent };
}

export function canBuy(state, item) {
  if (item.kind === 'use') return state.career.money >= item.price;
  if (state.career.items.includes(item.id)) return false;
  return state.career.money >= item.price;
}

/** @returns {{ok:boolean, msg:string}} */
export function buyItem(state, id) {
  const item = ITEM_BY_ID[id];
  if (!item) return { ok: false, msg: 'Ürün bulunamadı.' };
  if (!canBuy(state, item)) return { ok: false, msg: state.career.items.includes(id) ? 'Zaten sahipsin.' : 'Paran yetmiyor.' };
  state.career.money -= item.price;
  if (item.kind === 'use') {
    const p = state.player;
    if (item.use.energy) p.energy = clamp(p.energy + item.use.energy, 0, 100);
    if (item.use.morale) p.morale = clamp(p.morale + item.use.morale, 0, 100);
    return { ok: true, msg: `${item.name} keyfini çıkardın!` };
  }
  state.career.items.push(id);
  return { ok: true, msg: item.kind === 'sub' ? `${item.name} aboneliği başladı.` : `${item.name} artık senin!` };
}

/** Sahip olunan eşyayı yarı fiyatına satar ya da aboneliği iptal eder. */
export function sellItem(state, id) {
  const item = ITEM_BY_ID[id];
  const idx = state.career.items.indexOf(id);
  if (!item || idx < 0) return { ok: false, msg: 'Bu eşyaya sahip değilsin.' };
  state.career.items.splice(idx, 1);
  if (item.kind === 'sub') return { ok: true, msg: `${item.name} aboneliği iptal edildi.` };
  const refund = Math.round(item.price * 0.5);
  state.career.money += refund;
  // Modifiyeli araba: parçaların bir kısmı da para eder
  const modRefund = item.cat === 'vehicle' ? onCarSold(state, id) : 0;
  return { ok: true, msg: `${item.name} satıldı: +€${(refund + modRefund).toLocaleString('tr-TR')}${modRefund ? ' (modifiyeler dahil)' : ''}` };
}

/**
 * Transfer teklifleri.
 * kind 'mid' = devre arası, 'end' = sezon sonu (sözleşmesi bitenler için mevcut kulüpten yenileme dahil).
 */
export function generateOffers(state, kind) {
  const { player, career, world } = state;
  const o = ovr(player);
  const f = form(player);
  const curR = clubRating(world, career.clubId);
  const myCountry = countryOf(career.clubId);
  const offers = [];

  // Yedekte kalan oyuncuya daha küçük kulüplerden "oynama şansı" teklifi gelir
  const rel = new RelationshipService(state);
  // Yedekte kalan ya da yönetimin satış listesine koyduğu oyuncuya küçük kulüplerden teklif gelir
  const benched = (state.flags.benchStreak || 0) >= 3 || career.season.starts < (kind === 'end' ? 8 : 4) || rel.onTransferList();

  const fits = (c) => {
    const r = clubRating(world, c.id);
    const stepUp = r >= curR + 3 && o >= r - 6;
    const stepDown = benched && r < curR && r >= o - 8 && r <= o + 2;
    return stepUp || stepDown;
  };
  const all = CLUBS.filter((c) => c.id !== career.clubId);
  const domestic = shuffle(all.filter((c) => (c.country || 'tr') === myCountry)).filter(fits);
  // Yurt dışı ilgisi: ün ve güç arttıkça açılır (genç ve tanınmayan oyuncuya yabancı kulüp gelmez)
  const abroad = clamp((player.fame - 18) / 55 + (o - 52) / 45, 0, 1);
  const foreign = abroad > 0 ? shuffle(all.filter((c) => (c.country || 'tr') !== myCountry && clubRating(world, c.id) >= curR + 2 && o >= clubRating(world, c.id) - 7)).slice(0, 60) : [];

  for (const c of domestic) {
    if (offers.length >= 3) break;
    const r = clubRating(world, c.id);
    let p = r < curR ? 0.45 : 0.16 + (f - 6.5) * 0.12 + player.fame / 260;
    if (r >= curR && o >= r - 3) p += 0.15;
    if (kind === 'mid') p *= 0.7;
    if (chance(clamp(p, 0.03, 0.85))) offers.push(makeOffer(c.id, r, o, true));
  }
  const maxOffers = player.fame >= 50 ? 4 : 3;
  for (const c of foreign) {
    if (offers.length >= maxOffers) break;
    const r = clubRating(world, c.id);
    let p = (0.05 + (f - 6.5) * 0.06 + player.fame / 400) * abroad * (0.6 + (COUNTRY_PRESTIGE[c.country] ?? 0.5) * 0.5);
    if (kind === 'mid') p *= 0.7;
    if (chance(clamp(p, 0.005, 0.5))) offers.push(makeOffer(c.id, r, o, true));
  }
  // Körfez parası: tanınmış oyuncuya Suudi Arabistan'dan yüksek maaşlı teklif
  if (player.fame >= 45 && myCountry !== 'sa' && offers.length < maxOffers && chance(kind === 'end' ? 0.18 : 0.08)) {
    const sa = shuffle(all.filter((c) => c.country === 'sa' && LEAGUES[c.league]?.tier === 1))[0];
    if (sa) {
      const off = makeOffer(sa.id, clubRating(world, sa.id), o, true);
      off.wage = roundTo(off.wage * 1.6, 50);
      off.signingBonus = roundTo(off.wage * 12, 100);
      off.tag = 'gulf';
      offers.push(off);
    }
  }

  if (kind === 'end' && career.contract.yearsLeft <= 0) {
    if (rel.boardWillRenew()) {
      const w = Math.round((wageFor(curR, o, myCountry) * 1.05 * rel.boardWageMultiplier()) / 50) * 50;
      offers.unshift({ clubId: career.clubId, wage: Math.max(w, career.contract.wage), years: randInt(2, 3), signingBonus: 0, renewal: true, outlook: outlookFor(curR, o) });
    }
    if (offers.length === 0) {
      // İşsiz kalmasın: seviyesine uygun bir kulüp mutlaka gelir (önce kendi ülkesinden)
      const pool = all.filter((c) => (c.country || 'tr') === myCountry);
      const fallback = (pool.length ? pool : all)
        .map((c) => ({ c, r: clubRating(world, c.id) }))
        .filter(({ r }) => r <= o + 6)
        .sort((a, b) => b.r - a.r)[0] || { c: all[all.length - 1], r: clubRating(world, all[all.length - 1].id) };
      offers.push(makeOffer(fallback.c.id, fallback.r, o, true));
    }
  }
  return offers;
}

function makeOffer(clubId, r, o, move) {
  const wage = wageFor(r, o, countryOf(clubId));
  return {
    clubId,
    wage,
    years: randInt(2, 4),
    signingBonus: move ? roundTo(wage * randInt(4, 10), 100) : 0,
    renewal: false,
    outlook: outlookFor(r, o),
  };
}

/** Yeni kulüpte forma şansı tahmini (ilk 11 rakibi ≈ kulüp gücü − 3). */
export function outlookFor(clubR, playerOvr) {
  const diff = playerOvr - (clubR - 3);
  if (diff >= 3) return { id: 'starter', label: 'İlk 11 adayı', tone: 'good' };
  if (diff >= -3) return { id: 'rotation', label: 'Rotasyon oyuncusu', tone: 'warn' };
  return { id: 'bench', label: 'Yedek kalabilirsin', tone: 'bad' };
}

export function acceptOffer(state, offer) {
  const { career, player } = state;
  const moving = offer.clubId !== career.clubId;
  // İmza parasından menajer payı düşülür
  const cut = Math.round((offer.signingBonus || 0) * (state.agent?.commission || 0));
  career.money += (offer.signingBonus || 0) - cut;
  if (cut && state.agent) state.agent.paid = (state.agent.paid || 0) + cut;
  career.contract = { wage: offer.wage, yearsLeft: offer.years };
  if (moving) {
    const from = CLUB_BY_ID[career.clubId]?.name;
    career.clubId = offer.clubId;
    if (state.world) addFocus(state.world, leagueIdIn(state.world, offer.clubId));
    player.rel.manager = 50;
    player.rel.teammates = 40;
    career.moves = (career.moves || 0) + 1;
    return `${from} → ${CLUB_BY_ID[offer.clubId].name} transferi tamamlandı!`;
  }
  return `${CLUB_BY_ID[offer.clubId].name} ile sözleşme yenilendi (${offer.years} yıl).`;
}

export const money = (v) => {
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(Math.round(v));
  if (a >= 1_000_000) return `${sign}€${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace('.', ',')}M`;
  if (a >= 10_000) return `${sign}€${Math.round(a / 1000)}K`;
  return `${sign}€${a.toLocaleString('tr-TR')}`;
};
