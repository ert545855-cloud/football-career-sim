// @ts-check
// BÜYÜK MAÇLAR — derbi, sezon finali, zirve ve kader maçları. Bu maçlarda oyuncu heyecanlanır:
// mini oyunlarda etkin yetenek düşer, oyun temposu artar ve şut nişangahı titrer.
// Soğukkanlı mentor heyecanı %20 azaltır ve nişangahı yavaşlatır.
import { CLUB_BY_ID, SEASON_WEEKS } from '../data.js';
import { fixtureFor, leagueIdIn, positionOf } from '../league.js';

/** Kurgusal kulüpler arasındaki geleneksel rekabetler. */
export const RIVALRIES = [
  ['bog', 'aka', 'İstanbul Derbisi'],
  ['ege', 'akd', 'Kıyı Derbisi'],
  ['bas', 'kap', 'Anadolu Derbisi'],
  ['tor', 'akd', 'Akdeniz Derbisi'],
  ['mun', 'ulu', 'Marmara Derbisi'],
  ['kfi', 'fir', 'Karadeniz–Fırat Derbisi'],
  ['pam', 'efe', 'Ege Derbisi'],
  ['dat', 'efe', 'Güney Ege Derbisi'],
  ['har', 'nem', 'GAP Derbisi'],
  ['van', 'agr', 'Doğu Derbisi'],
  ['kiz', 'has', 'Bozkır Derbisi'],
  ['sap', 'kac', 'Yaylalar Derbisi'],
  ['mnz', 'agr', 'Dağlar Derbisi'],
];

/** Büyük maç türleri: taban heyecan (0–1) */
export const BIG_MATCH_KINDS = {
  derby: { label: 'Derbi', base: 0.3, icon: 'fire' },
  final: { label: 'Sezon Finali', base: 0.35, icon: 'trophy' },
  summit: { label: 'Zirve Maçı', base: 0.25, icon: 'star' },
  decider: { label: 'Kader Maçı', base: 0.3, icon: 'shield' },
};

/** @typedef {{kind:keyof typeof BIG_MATCH_KINDS, label:string, title:string, base:number}} BigMatch */

/** İki kulüp arasındaki derbinin adı (yoksa null). */
export function derbyName(a, b) {
  const r = RIVALRIES.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (r) return r[2];
  // Aynı kasabanın iki kulübü (ör. Kingsbridge United – Kingsbridge City): şehir derbisi
  const A = CLUB_BY_ID[a];
  const B = CLUB_BY_ID[b];
  if (A && B && a !== b && A.city && A.city === B.city && A.country === B.country) return `${A.city} Derbisi`;
  return null;
}

/**
 * Bir maçın büyük maç olup olmadığını belirler.
 * @param {any} state
 * @param {{myId:string, oppId:string, week:number}} m
 * @returns {BigMatch|null}
 */
export function bigMatchFor(state, m) {
  const derby = derbyName(m.myId, m.oppId);
  if (derby) return { kind: 'derby', label: 'Derbi', title: derby, base: BIG_MATCH_KINDS.derby.base };
  if (m.week === SEASON_WEEKS) return { kind: 'final', label: 'Final', title: 'Sezon Finali', base: BIG_MATCH_KINDS.final.base };
  if (m.week >= 6 && state.world?.leagues) {
    const a = positionOf(state.world, m.myId);
    const b = positionOf(state.world, m.oppId);
    const n = Object.keys(state.world.leagues[leagueIdIn(state.world, m.myId)]?.table || {}).length || 12;
    if (a <= 3 && b <= 3) return { kind: 'summit', label: 'Zirve Maçı', title: 'Zirve Maçı', base: BIG_MATCH_KINDS.summit.base };
    if (m.week >= 15 && a > n - 3 && b > n - 3) return { kind: 'decider', label: 'Kader Maçı', title: 'Kümede Kalma Finali', base: BIG_MATCH_KINDS.decider.base };
  }
  return null;
}

/** Bu haftanın (henüz planlanmamış) maçı büyük maç mı? Diyaloglar ve ana ekran için. */
export function upcomingBigMatch(state) {
  const fx = fixtureFor(state.world, state.career.clubId, state.calendar.week);
  if (!fx) return null;
  const [h, a] = fx;
  const myId = state.career.clubId;
  return bigMatchFor(state, { myId, oppId: h === myId ? a : h, week: state.calendar.week });
}

/**
 * Oyuncunun büyük maçtaki heyecan (hata) katsayısı ve mini oyun ayarları.
 * Tecrübe heyecanı azaltır (en fazla %40); Soğukkanlı mentor ×0.8 uygular.
 * @param {BigMatch|null} big
 * @param {{apps:number}} totals kariyer toplamları
 * @param {{nervesMult:number, aimTempo:number}} bonus mentor bonusu
 * @returns {{nerves:number, skillMult:number, tempo:number, aimTempo:number, experience:number}}
 */
export function nervesFor(big, totals, bonus) {
  if (!big) return { nerves: 0, skillMult: 1, tempo: 1, aimTempo: 1, experience: 0 };
  const experience = Math.min(0.4, (totals?.apps || 0) / 250);
  const nerves = Math.round(big.base * (1 - experience) * (bonus?.nervesMult ?? 1) * 1000) / 1000;
  const aimTempo = bonus?.aimTempo ?? 1;
  return {
    nerves,
    /** Etkin yetenek çarpanı: heyecan arttıkça mini oyun zorlaşır */
    skillMult: Math.round((1 - nerves * 0.3) * 1000) / 1000,
    /** Mini oyun temposu (rakipler, kaleci, süre, nişangah salınımı). Soğukkanlı: ×0.8 */
    tempo: Math.round((1 + nerves * 0.6) * aimTempo * 1000) / 1000,
    aimTempo,
    experience,
  };
}
