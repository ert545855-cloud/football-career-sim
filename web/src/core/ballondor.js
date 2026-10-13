// ALTIN TOP (Ballon d'Or) YARIŞI — sezon boyu puan tablosu, aday listesi ve sezon sonu töreni.
//
// Dünya yıldızları (kurgusal) her hafta güçlerine göre puan toplar. Oyuncunun puanı:
//   gol, asist, maç notu, maçın oyuncusu, galibiyet (lig seviyesine göre çarpanlı)
//   + sezon sonu ödülleri (şampiyonluk, gol krallığı, sezonun oyuncusu)
//   + milli takım (turnuva derecesi, milli gol).
// Gerçekçi olsun diye 1. Lig'de puanlar yarı, altyapıda çok küçük sayılır: Altın Top için büyük sahne gerekir.
import { LEAGUES } from './data.js';
import { leagueOf } from './league.js';
import { clamp, pick, rand, randInt, round1 } from './rng.js';
import { changeFame, changeMorale, changeRel, ovr } from './player.js';

/** Kurgusal dünya yıldızları (gerçek kişiler değildir) */
const STAR_SEED = [
  ['Mateo Ferreyra', 'ARG', 'FW', 92, 26], ['Lucas Girard', 'FRA', 'FW', 92, 25], ['Thiago Moraes', 'BRA', 'FW', 90, 24],
  ['Pablo Salcedo', 'ESP', 'MF', 89, 23], ['Harry Whitmore', 'ENG', 'MF', 89, 27], ['Jonas Lindqvist', 'SWE', 'FW', 88, 24],
  ['Rafael Duarte', 'POR', 'MF', 88, 29], ['Kenji Arakawa', 'JPN', 'MF', 86, 26], ['Youssef Bennani', 'MAR', 'DF', 86, 27],
  ['Viktor Kovač', 'CRO', 'MF', 87, 30], ['Noah Becker', 'GER', 'DF', 87, 28], ['Ousmane Diallo', 'SEN', 'FW', 86, 25],
];
const FIRST = ['Adrien', 'Bruno', 'Dario', 'Emil', 'Felipe', 'Gabriel', 'Hugo', 'Ivan', 'Joel', 'Kai', 'Leon', 'Marco', 'Nico', 'Oscar', 'Rui', 'Samuel', 'Tomas', 'Yannick'];
const LAST = ['Almeida', 'Brandt', 'Costa', 'Dumont', 'Eriksen', 'Fontaine', 'Gómez', 'Horvat', 'Iversen', 'Janssen', 'Kowalski', 'Lemaire', 'Molina', 'Novak', 'Ortega', 'Petrov', 'Rossi', 'Silva', 'Varga', 'Weber'];
const NATS = ['ESP', 'ITA', 'GER', 'NED', 'BEL', 'URU', 'COL', 'DEN', 'POL', 'USA', 'AUT', 'SUI'];

export const BALLON_RULES = {
  nominees: 30,
  /** Lig seviyesi çarpanı: Süper Lig tam, 1. Lig yarım, altyapı çok düşük */
  tierMult: { 1: 0.85, 2: 0.4, 3: 0.1 },
  seasonAwards: { 'Şampiyon': 15, 'Gol Kralı': 12, 'Sezonun Oyuncusu': 10, 'Genç': 4 },
  tournament: { group: 0, qf: 8, sf: 16, final: 26, champion: 45 },
};

function makeStar([name, nat, pos, r, age], i) {
  return { id: `st${i}`, name, nat, pos, r, age, pts: 0, star: true };
}

function filler(i) {
  return { id: `f${i}`, name: `${pick(FIRST)} ${pick(LAST)}`, nat: pick(NATS), pos: pick(['FW', 'MF', 'DF']), r: randInt(80, 85), age: randInt(21, 31), pts: 0 };
}

/** Kayıt alanı: aday havuzu ve sezon geçmişi */
export function ensureBallon(state) {
  const b = state.ballon || (state.ballon = {});
  if (!Array.isArray(b.pool) || !b.pool.length) {
    b.pool = [...STAR_SEED.map(makeStar), ...Array.from({ length: BALLON_RULES.nominees - STAR_SEED.length - 1 }, (_, i) => filler(i))];
    b.season = state.calendar?.season || 1;
  }
  b.me = b.me || 0;
  b.history = b.history || [];
  b.lastRank = b.lastRank ?? null;
  return b;
}

/** Haftalık puan: yıldızlar güçlerine göre, oyuncu maç özetine göre */
export function ballonOnMatch(state, summary) {
  const b = ensureBallon(state);
  for (const p of b.pool) {
    const form = rand(-1.5, 1.5);
    p.pts = round1(p.pts + Math.max(0, (p.r - 78) * 0.7 + rand(0, 4) + form));
  }
  if (!summary?.played) return b.me;
  const mult = visibility(state);
  // Mevki ağırlıkları: orta saha ve defansta not ve galibiyet daha çok sayılır (gol az beklenir)
  const w = { FW: [4, 3, 3, 1], MF: [5, 4.5, 5, 1.5], DF: [6, 4, 7.5, 2.5] }[state.player.position] || [4, 3, 3, 1];
  const pts = (summary.goals || 0) * w[0] + (summary.assists || 0) * w[1] + ((summary.rating || 6.5) - 6.5) * w[2] + (summary.motm ? 3 : 0) + (summary.result === 'W' ? w[3] : 0);
  b.me = round1(b.me + Math.max(0, pts) * mult);
  return b.me;
}

/**
 * Görünürlük çarpanı: lig seviyesi × oyuncu kalitesi. Dünya sahnesinde fark edilmek için OVR 75+ gerekir;
 * 60'lı OVR'lerde parlak bir sezon bile ancak ilk 30'a sokar.
 */
export function visibility(state) {
  const tier = LEAGUES[leagueOf(state.career.clubId)]?.tier || 2;
  const q = clamp((ovr(state.player) - 55) / 25, 0.05, 1.2) ** 1.5;
  return (BALLON_RULES.tierMult[tier] ?? 0.4) * q;
}

/** Sıralama: [{name, pts, me?}] */
export function ballonStandings(state) {
  const b = ensureBallon(state);
  const me = { id: 'me', name: state.player.name, nat: 'TÜR', pos: state.player.position, pts: b.me, me: true };
  return [...b.pool, me].sort((x, y) => y.pts - x.pts);
}

export function ballonRank(state) {
  return ballonStandings(state).findIndex((x) => x.me) + 1;
}

/**
 * Sezon sonu: ödül ve turnuva puanları eklenir, tören sonucu belirlenir, havuz yenilenir.
 * game.endSeason çağırır (ödüller belli olduktan sonra, sezon numarası artmadan önce).
 */
export function ballonSeasonEnd(state, { awards = [], season }) {
  const b = ensureBallon(state);
  const mult = visibility(state);
  for (const a of awards) {
    for (const [k, v] of Object.entries(BALLON_RULES.seasonAwards)) if (a.title.includes(k)) b.me += v * mult;
  }
  const t = (state.national?.tournaments || []).find((x) => x.season === season);
  if (t) b.me += BALLON_RULES.tournament[t.result] || 0;
  // Yıldızların sezon sonu: kendi kupaları (rastgele)
  for (const p of b.pool) p.pts = round1(p.pts + (p.star ? rand(0, 30) : rand(0, 12)));
  b.me = round1(b.me);

  const table = ballonStandings(state);
  const rank = table.findIndex((x) => x.me) + 1;
  const podium = table.slice(0, 3).map((x) => ({ name: x.name, nat: x.nat, pts: x.pts, me: !!x.me }));
  const nominated = rank <= BALLON_RULES.nominees;
  const won = rank === 1;
  const result = { season, rank, nominated, won, podium, pts: b.me, winner: table[0].name };
  b.history.push({ season, rank, pts: b.me, winner: table[0].name });
  b.lastRank = rank;

  if (won) {
    state.career.awards.push({ season, title: 'Altın Top (Ballon d\'Or)', icon: 'star', ballon: true });
    changeFame(state.player, 15);
    changeRel(state.player, 'fans', 10);
    changeMorale(state.player, 25);
  } else if (rank <= 3) {
    changeFame(state.player, 6);
    changeMorale(state.player, 8);
  } else if (rank <= 10) changeFame(state.player, 3);

  // Yeni sezon: puanlar sıfırlanır; yıldızlar yaşlanır, emekli olanların yerine gençler gelir
  b.me = 0;
  for (let i = 0; i < b.pool.length; i++) {
    const p = b.pool[i];
    p.pts = 0;
    p.age += 1;
    p.r = clamp(p.r + (p.age <= 26 ? randInt(0, 2) : p.age >= 31 ? -randInt(1, 3) : randInt(-1, 1)), 78, 94);
    if (p.age >= 35 || p.r < 79) b.pool[i] = { ...filler(1000 + season * 40 + i), age: randInt(19, 22), r: randInt(82, 88), star: true };
  }
  b.season = season + 1;
  return result;
}
