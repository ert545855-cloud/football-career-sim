// @ts-check
// SEÇME SKORUNA GÖRE TAKIM TEKLİFLERİ
//
//   9–7 hak → A, B, C açık      6–4 hak → A, B açık      3 ve altı → yalnızca A
//
//   A · Alt Lig Takımı        : en alt ligden (1. Lig, alt yarı) rastgele kulüp, ilk 11 garantisi
//   B · Üst Lig Takımı (kiralık): Süper Lig kulübü sözleşme imzalar, 1 yıl 1. Lig'e kiralar (forma şartıyla)
//   C · Dev Kulüp Altyapısı    : büyük kulübün U-17 takımı; gelişim bonusu, sezon sonunda A takıma yükselme
import { CLUBS, CLUB_BY_ID } from '../data.js';
import { clubRating } from '../league.js';

/** @typedef {'A'|'B'|'C'} OfferKind */
/**
 * @typedef {{kind:OfferKind, locked:boolean, requirement:string, clubId:string, parentId:string|null, leagueId:string,
 *   wage:number, years:number, signingBonus:number, guarantee:boolean, loanSeasons:number, academy:boolean, trainingBonus:number}} StarterOffer
 */

export const SCORE_TIERS = [
  { min: 7, max: 9, options: /** @type {OfferKind[]} */ (['A', 'B', 'C']) },
  { min: 4, max: 6, options: /** @type {OfferKind[]} */ (['A', 'B']) },
  { min: 0, max: 3, options: /** @type {OfferKind[]} */ (['A']) },
];

export const OFFER_KINDS = {
  A: {
    id: 'A',
    title: 'Alt Lig Takımı',
    badge: 'İlk 11 garantisi',
    minScore: 0,
    pros: ['İlk sezon ilk 11 garantisi', 'Hemen A takım futbolu', 'Takımın yıldızı olma şansı'],
    cons: ['Düşük maaş', 'Gözden uzak bir lig'],
  },
  B: {
    id: 'B',
    title: 'Üst Lig Takımı · Kiralık',
    badge: 'Süper Lig sözleşmesi',
    minScore: 4,
    pros: ['Süper Lig kulübüyle 3 yıllık sözleşme', '1 yıl 1. Lig\'de forma şartlı kiralık', 'Sezon sonunda ana kulübe dönüş'],
    cons: ['Ana kulüpte forma rekabeti zor', 'Kiralıkken transfer yapılamaz'],
  },
  C: {
    id: 'C',
    title: 'Dev Kulüp Altyapısı',
    badge: 'U-17 takımı',
    minScore: 7,
    pros: ['Dev kulübün altyapısı: antrenman gelişimi +%25', 'U-17 Gelişim Ligi\'nde düzenli forma', 'Sezon sonunda A takım sözleşmesi'],
    cons: ['Altyapı bursu: maaş çok düşük', 'A takıma yükselmek için kendini kanıtlaman lazım'],
  },
};

/** Skora göre açılan seçenekler */
export function unlockedOptions(score) {
  const s = Math.max(0, Math.min(9, Math.round(score)));
  return (SCORE_TIERS.find((t) => s >= t.min && s <= t.max) || SCORE_TIERS[SCORE_TIERS.length - 1]).options;
}

/** Kulüp havuzları (dünyadaki güncel güçlere göre) */
export function offerPools(world) {
  const r = (id) => clubRating(world, id);
  const supers = CLUBS.filter((c) => c.league === 'super').sort((a, b) => r(b.id) - r(a.id));
  const firsts = CLUBS.filter((c) => c.league === 'first').sort((a, b) => r(b.id) - r(a.id));
  const half = Math.ceil(firsts.length / 2);
  return {
    /** A: en alt lig, alt yarı */
    lower: firsts.slice(half).map((c) => c.id),
    /** B: Süper Lig'in orta sırası (ilk 4 dev ve son sıradaki hariç) */
    parentsB: supers.slice(4, supers.length - 1).map((c) => c.id),
    /** B kiralık adresi: 1. Lig üst yarısı */
    loanClubs: firsts.slice(0, half).map((c) => c.id),
    /** C: ilk 4 dev kulübün altyapısı */
    giants: supers.slice(0, 4).map((c) => c.id),
  };
}

const pickFrom = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const round50 = (v) => Math.round(v / 50) * 50;

/** Başlangıç maaşı (economy.wageFor ile aynı ölçek) */
function wageFor(clubR, playerOvr) {
  const base = 100 * Math.exp(clubR / 14);
  const perf = Math.max(0.5, Math.min(1.25, 0.55 + 0.6 * (playerOvr / clubR - 0.5)));
  return Math.max(250, round50(base * perf));
}

/**
 * Seçme skoruna göre üç teklif kartını üretir. Kilitli seçenekler de döner (ekranda kilitli gösterilir).
 * @param {any} world
 * @param {number} score 0–9
 * @param {{ovr:number}} player başlangıç gücü (maaş için)
 * @param {() => number} rnd
 * @returns {StarterOffer[]}
 */
export function buildStarterOffers(world, score, player, rnd = Math.random) {
  const open = unlockedOptions(score);
  const pools = offerPools(world);
  const r = (id) => clubRating(world, id);

  const aClub = pickFrom(pools.lower, rnd);
  const bParent = pickFrom(pools.parentsB, rnd);
  const bLoan = pickFrom(pools.loanClubs.filter((id) => id !== aClub), rnd);
  const cParent = pickFrom(pools.giants, rnd);

  const base = (kind) => ({ kind, locked: !open.includes(kind), requirement: `En az ${OFFER_KINDS[kind].minScore} hak gerekir` });
  return [
    {
      ...base('A'),
      clubId: aClub,
      parentId: null,
      leagueId: CLUB_BY_ID[aClub].league,
      wage: wageFor(r(aClub), player.ovr),
      years: 2,
      signingBonus: 0,
      guarantee: true,
      loanSeasons: 0,
      academy: false,
      trainingBonus: 0,
    },
    {
      ...base('B'),
      clubId: bLoan,
      parentId: bParent,
      leagueId: CLUB_BY_ID[bLoan].league,
      wage: round50(wageFor(r(bParent), player.ovr) * 0.6),
      years: 3,
      signingBonus: round50(wageFor(r(bParent), player.ovr) * 2),
      guarantee: true,
      loanSeasons: 1,
      academy: false,
      trainingBonus: 0,
    },
    {
      ...base('C'),
      clubId: `${cParent}-u17`,
      parentId: cParent,
      leagueId: 'u17',
      wage: 300,
      years: 1,
      signingBonus: 0,
      guarantee: true,
      loanSeasons: 0,
      academy: true,
      trainingBonus: 0.25,
    },
  ];
}

/**
 * Seçilen başlangıç teklifini kariyere işler (newGame içinde çağrılır).
 * @param {any} state
 * @param {StarterOffer} offer
 */
export function applyStarterOffer(state, offer) {
  if (offer.locked) throw new Error('Bu seçenek seçme skoruyla açılmadı.');
  const { career, calendar } = state;
  // Garanti, kiralık ve altyapı dönemi ilk sezonu kapsar (kiralık süresi loanSeasons kadar)
  const until = calendar.season + Math.max(1, offer.loanSeasons || 1) - 1;
  career.clubId = offer.clubId;
  career.contract = { wage: offer.wage, yearsLeft: offer.years };
  career.money += offer.signingBonus || 0;
  career.start = { kind: offer.kind, clubId: offer.clubId, parentId: offer.parentId, season: calendar.season };
  career.loan = offer.kind === 'B' ? { parentId: offer.parentId, untilSeason: until } : null;
  career.academy = offer.kind === 'C' ? { parentId: offer.parentId, team: 'U-17', untilSeason: until, trainingBonus: offer.trainingBonus } : null;
  career.guarantee = offer.guarantee ? { untilSeason: until, reason: offer.kind } : null;
  const club = CLUB_BY_ID[offer.clubId];
  if (offer.kind === 'A') return `${club.name} ile ${offer.years} yıllık sözleşme imzaladın. İlk 11 garantin var!`;
  if (offer.kind === 'B') return `${CLUB_BY_ID[offer.parentId].name} ile ${offer.years} yıllık sözleşme imzaladın ve ${club.name} takımına 1 yıllığına kiralandın.`;
  return `${CLUB_BY_ID[offer.parentId].name} altyapısına katıldın: ${club.name} takımında başlıyorsun.`;
}
