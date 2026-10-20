import { COUNTRIES, STAT_KEYS, POSITIONS, GROWTH } from './data.js';
import { clamp, lerp } from './rng.js';
import { RELATION_DEFAULTS } from './chirp/relationships.js';
import { potentialMult, styleGrowth } from './character.js';
const COUNTRY_IDS = new Set(COUNTRIES.map((c) => c.id));

/**
 * @param {{name:string, position:string, avatar?:object, number?:number, statBonus?:Record<string, number>}} setup
 *   statBonus: seçme kampından gelen başlangıç katkısı (istasyonda kalan her hak +1)
 */
export function createPlayer({ name, position, avatar, number, statBonus, nationality }) {
  const pos = POSITIONS[position] || POSITIONS.FW;
  const stats = { ...pos.stats };
  for (const [k, v] of Object.entries(statBonus || {})) if (k in stats) stats[k] = clamp(stats[k] + v, 1, 99);
  return {
    name: cleanName(name) || 'Yeni Oyuncu',
    /** Vatandaşlık (ülke kimliği): başlangıç ülkesi ve milli takım */
    nationality: COUNTRY_IDS.has(nationality) ? nationality : 'tr',
    position: pos.id,
    number: clamp(Number(number) || 9, 1, 99),
    avatar: avatar || { skin: 1, hair: 'short', hairColor: 1 },
    age: 17,
    stats,
    progress: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
    energy: 100,
    morale: 60,
    ratings: [],
    rel: { ...RELATION_DEFAULTS },
    fame: 3,
    /** Kulüp Nüfuzu (kaptanlık/söz hakkı, 0–100). Kulüp değişince büyük ölçüde sıfırlanır. */
    influence: 5,
    /** Kulüp Sadakati: yönetim ve hocanın gözündeki değer (0–100) */
    loyalty: 20,
    /** Aktif mentor bonusu (MentorManager.sync yazar) */
    mentorBonus: null,
  };
}

export function cleanName(raw) {
  return String(raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
}

export const isValidName = (raw) => cleanName(raw).length >= 2;

/** Mevkiye göre ağırlıklı genel güç (0–99). */
export function ovr(player) {
  const w = POSITIONS[player.position].ovr;
  let s = 0;
  for (const k of STAT_KEYS) s += (player.stats[k] || 0) * (w[k] || 0);
  return Math.round(s);
}

/** Son 5 maç notunun ortalaması (maç yoksa 6.5). */
export function form(player) {
  const r = player.ratings.slice(-5);
  if (!r.length) return 6.5;
  return Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10;
}

/** Enerji düştükçe performans %62'ye kadar iner. */
export const fatigueMult = (energy) => lerp(0.62, 1, energy / 100);
/** Moral 0 → %85, 100 → %106. */
export const moraleMult = (morale) => lerp(0.85, 1.06, morale / 100);

/** Mini oyun zorluğunu belirleyen 0–1 arası etkin yetenek. */
export function effectiveSkill(player, weights) {
  let s = 0;
  let tw = 0;
  for (const [k, w] of Object.entries(weights)) {
    s += (player.stats[k] || 0) * w;
    tw += w;
  }
  const base = tw > 0 ? s / tw / 100 : 0;
  return clamp(base * fatigueMult(player.energy) * moraleMult(player.morale), 0.02, 1);
}

export function growthMult(player, stat) {
  const pos = POSITIONS[player.position];
  if (stat === pos.primary) return GROWTH.primary;
  if (stat === pos.secondary) return GROWTH.secondary;
  return GROWTH.other;
}

export function ageFactor(age) {
  if (age <= 20) return 1.25;
  if (age <= 23) return 1.1;
  if (age <= 27) return 0.95;
  if (age <= 30) return 0.75;
  return 0.5;
}

/**
 * Gelişim puanı ekler; birikim 1'i geçince stat +1 olur.
 * Yüksek statlarda gelişim yavaşlar (room), mevki ve yaş çarpanı uygulanır.
 * @returns kazanılan tam stat puanı
 */
export function addProgress(player, stat, amount) {
  if (!(amount > 0)) return 0;
  const room = Math.max(0.06, 1 - player.stats[stat] / 105);
  // Potansiyel tavanı ve oyun tarzı (ilgili statlarda bonus)
  const pot = player.potential ? potentialMult(player, ovr(player)) : 1;
  player.progress[stat] += amount * growthMult(player, stat) * ageFactor(player.age) * room * pot * styleGrowth(player, stat);
  let gained = 0;
  while (player.progress[stat] >= 1 && player.stats[stat] < 99) {
    player.progress[stat] -= 1;
    player.stats[stat] += 1;
    gained++;
  }
  if (player.stats[stat] >= 99) player.progress[stat] = 0;
  return gained;
}

/** Antrenman sonucundan gelişim miktarı. */
export function trainingAmount(result, trainBonus = 0) {
  const q = result.success ? 0.6 + 0.4 * clamp(result.accuracy || 0, 0, 1) : 0.25;
  return 0.75 * q * (1 + trainBonus);
}

export function changeEnergy(player, delta) {
  player.energy = clamp(Math.round(player.energy + delta), 0, 100);
}

export function changeMorale(player, delta) {
  player.morale = clamp(Math.round(player.morale + delta), 0, 100);
}

export function changeRel(player, key, delta) {
  // Lider mentor: Takım Uyumu kayıpları yarıya iner
  if (key === 'teammates' && delta < 0) delta *= player.mentorBonus?.teamLossMult ?? 1;
  player.rel[key] = clamp(Math.round(player.rel[key] + delta), 0, 100);
}

export function changeFame(player, delta) {
  player.fame = clamp(Math.round((player.fame + delta) * 10) / 10, 0, 100);
}

/** Sezon sonu yaşlanma: gençler doğal gelişir, 30+ fiziksel düşüş. */
export function ageUp(player) {
  player.age += 1;
  const changes = {};
  const bump = (k, d) => {
    const before = player.stats[k];
    player.stats[k] = clamp(player.stats[k] + d, 1, 99);
    if (player.stats[k] !== before) changes[k] = (changes[k] || 0) + (player.stats[k] - before);
  };
  if (player.age <= 21) {
    const pos = POSITIONS[player.position];
    bump(pos.primary, 2);
    bump(pos.secondary, 1);
  } else if (player.age >= 34) {
    bump('speed', -4);
    bump('stamina', -4);
    bump('shooting', -1);
    bump('passing', -1);
    bump('defending', -1);
  } else if (player.age >= 31) {
    bump('speed', -2);
    bump('stamina', -2);
  }
  return changes;
}
