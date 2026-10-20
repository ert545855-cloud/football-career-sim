// @ts-check
// KULÜP KADROSU — mentor adaylarını ve gençleri barındıran yapay zekâ oyuncuları.
// Kadro yalnızca oyuncunun bulunduğu kulüp için üretilir; her sezon yaşlanır, emeklilik ve
// yeni transferlerle yenilenir. Sonuç düz JSON olarak state.mentor.squads[clubId] altında tutulur.
import { CLUB_BY_ID, COUNTRY_BY_ID, LEAGUES } from '../data.js';
import { NAME_BLOCK, foreignLang, foreignShare, randomName } from '../world/names.js';
import { SquadPlayer, TRAIT_IDS } from './models.js';

/** @typedef {import('./models.js').SquadPosition} SquadPosition */
/** @typedef {{clubId:string, season:number, seq:number, players:Array<ReturnType<SquadPlayer['toJSON']>>}} SquadData */

const VET_FIRST = ['Ferhat', 'Ercan', 'Tamer', 'Levent', 'Yavuz', 'Kadir', 'Orhan', 'Erhan', 'Cemal', 'Nedim', 'Sedat', 'Taner', 'Zafer', 'İlker', 'Erol', 'Ahmet', 'Serdar', 'Koray'];
const YOUNG_FIRST = ['Arda', 'Kerem', 'Emir', 'Yusuf', 'Mert', 'Burak', 'Efe', 'Barış', 'Ozan', 'Deniz', 'Kaan', 'Umut', 'Eren', 'Tuna', 'Alp', 'Berat', 'Çınar', 'Ege', 'Poyraz', 'Aras'];
const LAST = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Koç', 'Kurt', 'Aksoy', 'Polat', 'Erdem', 'Tekin', 'Güneş', 'Yıldırım', 'Karaca', 'Toprak', 'Bozkurt', 'Uçar', 'Akın', 'Ateş', 'Duman', 'Kılıç', 'Özkan', 'Bulut'];

const SIZE = 9;

/** @param {() => number} rnd */
const mk = (rnd) => ({
  int: (/** @type {number} */ a, /** @type {number} */ b) => a + Math.floor(rnd() * (b - a + 1)),
  pick: (/** @type {any[]} */ arr) => arr[Math.floor(rnd() * arr.length)],
  chance: (/** @type {number} */ p) => rnd() < p,
});

const clamp = (/** @type {number} */ v, /** @type {number} */ a, /** @type {number} */ b) => Math.max(a, Math.min(b, v));

/**
 * Yeni bir kadro oyuncusu üretir.
 * @param {() => number} rnd
 * @param {{clubId:string, season:number, seq:number, rating:number, kind:'legend'|'veteran'|'prime'|'young', origin?:import('./models.js').Origin,
 *   taken:Set<string>, numbers:Set<number>, position?:SquadPosition}} o
 */
export function makeSquadPlayer(rnd, o) {
  const r = mk(rnd);
  const young = o.kind === 'young';
  let name = '';
  // Kulübün ülkesine göre isim; kadroların yaklaşık %12'si yabancı oyuncu
  const country = COUNTRY_BY_ID[CLUB_BY_ID[o.clubId]?.country || 'tr'] || COUNTRY_BY_ID.tr;
  const tier = LEAGUES[CLUB_BY_ID[o.clubId]?.league]?.tier || 3;
  const foreign = r.chance(foreignShare(country.id, tier, country.wage || 1) * (young ? 0.4 : 1));
  const lang = foreign ? foreignLang(country.id, country.lang, rnd) : country.lang;
  for (let i = 0; i < 30 && (!name || o.taken.has(name)); i++) {
    name = lang === 'tr' ? `${r.pick(young ? YOUNG_FIRST : VET_FIRST)} ${r.pick(LAST)}` : randomName(lang, rnd);
    if (NAME_BLOCK.has(name)) name = '';
  }
  o.taken.add(name);
  const ranges = {
    legend: { age: [32, 35], inf: [78, 95], ovr: [1, 8] },
    veteran: { age: [30, 34], inf: [62, 92], ovr: [0, 7] },
    prime: { age: [24, 29], inf: [30, 70], ovr: [-3, 5] },
    young: { age: [17, 20], inf: [4, 18], ovr: [-14, -6] },
  }[o.kind];
  const age = r.int(ranges.age[0], ranges.age[1]);
  let influence = r.int(ranges.inf[0], ranges.inf[1]);
  if (o.origin === 'transfer') influence = Math.round(influence * 0.65); // yeni gelen henüz söz sahibi değil
  if (o.origin === 'veteran') influence = Math.round(influence * 0.9); // tecrübeli transfer liderlik için alınır
  const position = o.position || r.pick(/** @type {SquadPosition[]} */ (['GK', 'DF', 'DF', 'MF', 'MF', 'FW']));
  let number = 0;
  for (let i = 0; i < 40 && (!number || o.numbers.has(number)); i++) number = position === 'GK' ? r.pick([1, 12, 23, 35]) : r.int(2, young ? 77 : 30);
  o.numbers.add(number);
  return new SquadPlayer({
    id: `${o.clubId}-${o.seq}`,
    name,
    age,
    position,
    influence,
    trait: r.pick(TRAIT_IDS),
    ovr: clamp(Math.round(o.rating + r.int(ranges.ovr[0], ranges.ovr[1])), 15, 95),
    origin: o.origin || (young ? 'academy' : 'core'),
    joinedSeason: o.season,
    number,
    avatar: (() => {
      const hair = young ? r.pick(['short', 'curly', 'mohawk', 'long', 'buzz']) : r.pick(['short', 'buzz', 'bald', 'short', 'curly']);
      // Tecrübelilerde kısa saçta kırlaşma
      const grey = age >= 33 && (hair === 'short' || hair === 'buzz') && r.chance(0.4);
      return { skin: r.int(0, 4), hair, hairColor: grey ? 4 : r.int(0, 3) };
    })(),
  });
}

/**
 * Rolleri yeniden dağıtır:
 * - Kaptan: 27+ yaştakiler arasında nüfuzu (ve tecrübesi) en yüksek olan
 * - Yıldız Oyuncu: kaptan dışında, gücü kulüp seviyesinde olanlar arasında en parlak 2 oyuncu
 *   (güç + saha içi ağırlık; tecrübeli liderler de yıldız sayılabilir)
 * - Genç Yetenek: 20 yaş ve altı; diğerleri As Oyuncu
 * @param {SquadPlayer[]} players
 * @param {number} rating kulüp gücü
 */
export function assignRoles(players, rating) {
  for (const p of players) p.role = p.age <= 20 ? 'youngster' : 'regular';
  const senior = players.filter((p) => p.age >= 27).sort((a, b) => b.influence + b.age * 0.5 - (a.influence + a.age * 0.5));
  if (senior[0]) senior[0].role = 'captain';
  const status = (/** @type {SquadPlayer} */ p) => p.ovr + p.influence * 0.15;
  const stars = players
    .filter((p) => p.role === 'regular' && p.ovr >= rating)
    .sort((a, b) => status(b) - status(a))
    .slice(0, 2);
  for (const p of stars) p.role = 'star';
  return players;
}

/**
 * Kulüp için ilk kadroyu üretir: bir kulüp efsanesi, 1–3 tecrübeli, 3 olgun, 2 genç.
 * @param {string} clubId
 * @param {number} season
 * @param {number} rating kulübün güncel gücü
 * @param {() => number} rnd
 * @param {{avoidNames?:string[]}} [opts]
 * @returns {SquadData}
 */
export function generateSquad(clubId, season, rating, rnd, opts = {}) {
  const r = mk(rnd);
  const taken = new Set(opts.avoidNames || []);
  const numbers = new Set();
  let seq = 0;
  /** @type {SquadPlayer[]} */
  const players = [];
  const add = (/** @type {any} */ kind, /** @type {any} */ extra = {}) => players.push(makeSquadPlayer(rnd, { clubId, season, seq: ++seq, rating, kind, taken, numbers, ...extra }));
  add('legend');
  const vets = r.int(2, 3);
  for (let i = 0; i < vets; i++) add('veteran');
  while (players.length < SIZE - 2) add('prime');
  add('young', { origin: 'academy' });
  add('young', { origin: r.chance(0.5) ? 'academy' : 'transfer' });
  assignRoles(players, rating);
  return { clubId, season, seq, players: players.map((p) => p.toJSON()) };
}

/**
 * Kadroyu bir sonraki sezona taşır: yaşlanma, nüfuz/güç değişimi, emeklilik, ayrılık ve yeni gelenler.
 * @param {SquadData} squad
 * @param {number} rating
 * @param {() => number} rnd
 * @param {{avoidNames?:string[]}} [opts]
 * @returns {{squad:SquadData, retired:SquadPlayer[], joined:SquadPlayer[], left:SquadPlayer[]}}
 */
export function advanceSquad(squad, rating, rnd, opts = {}) {
  const r = mk(rnd);
  const season = squad.season + 1;
  const players = squad.players.map((p) => SquadPlayer.from(p));
  const retired = [];
  const left = [];
  const stay = [];
  for (const p of players) {
    p.age += 1;
    if (p.age <= 20) {
      p.ovr = clamp(p.ovr + r.int(2, 5), 15, 95);
      p.influence = clamp(p.influence + r.int(3, 7), 0, 100);
    } else if (p.age <= 30) {
      p.ovr = clamp(p.ovr + r.int(-1, 2), 15, 95);
      p.influence = clamp(p.influence + (p.age <= 26 ? r.int(2, 6) : r.int(4, 8)), 0, 100);
    } else {
      p.ovr = clamp(p.ovr - (p.age <= 32 ? r.int(0, 1) : r.int(0, 2)), 15, 95);
      p.influence = clamp(p.influence + (p.age <= 33 ? r.int(4, 8) : r.int(-1, 3)), 0, 100);
    }
    // Kaptanlık ve yıldızlık soyunma odasındaki sözü güçlendirir
    if (p.role === 'captain') p.influence = clamp(p.influence + 3, 0, 100);
    else if (p.role === 'star') p.influence = clamp(p.influence + 1, 0, 100);
    if (p.age >= 37 || (p.age >= 35 && r.chance(0.35))) retired.push(p);
    else if (p.age >= 22 && p.age <= 29 && r.chance(0.12)) left.push(p);
    else stay.push(p);
  }
  // Yenilenme
  const taken = new Set([...(opts.avoidNames || []), ...stay.map((p) => p.name)]);
  const numbers = new Set(stay.map((p) => p.number));
  let seq = squad.seq;
  const joined = [];
  const add = (/** @type {any} */ kind, /** @type {any} */ origin) => {
    const p = makeSquadPlayer(rnd, { clubId: squad.clubId, season, seq: ++seq, rating, kind, origin, taken, numbers });
    stay.push(p);
    joined.push(p);
  };
  // Her sezon altyapıdan 1 genç çıkar; bazen ikincisi
  add('young', 'academy');
  if (r.chance(0.35) && stay.length < SIZE + 1) add('young', 'academy');
  // Tecrübe azaldıysa tecrübeli transfer
  while (stay.filter((p) => p.age >= 30).length < 3) add('veteran', 'veteran');
  while (stay.length < SIZE) add('prime', 'transfer');
  // Kadro şişmesin: en zayıf olgun oyuncu ayrılır
  while (stay.length > SIZE + 1) {
    const weakest = stay.filter((p) => p.age > 20 && p.age < 30).sort((a, b) => a.ovr - b.ovr)[0];
    if (!weakest) break;
    stay.splice(stay.indexOf(weakest), 1);
    left.push(weakest);
  }
  assignRoles(stay, rating);
  return { squad: { clubId: squad.clubId, season, seq, players: stay.map((p) => p.toJSON()) }, retired, joined, left };
}

/**
 * Devre arası transfer penceresi: bazen kulübe genç bir transfer gelir.
 * @param {SquadData} squad
 * @param {number} rating
 * @param {() => number} rnd
 * @returns {SquadPlayer|null}
 */
export function windowSigning(squad, rating, rnd, opts = {}) {
  if (rnd() >= 0.55) return null;
  const players = squad.players.map((p) => SquadPlayer.from(p));
  const taken = new Set([...(opts.avoidNames || []), ...players.map((p) => p.name)]);
  const numbers = new Set(players.map((p) => p.number));
  const p = makeSquadPlayer(rnd, { clubId: squad.clubId, season: squad.season, seq: ++squad.seq, rating, kind: 'young', origin: 'transfer', taken, numbers });
  p.age = Math.max(18, p.age);
  players.push(p);
  assignRoles(players, rating);
  squad.players = players.map((x) => x.toJSON());
  return p;
}

export const clubName = (/** @type {string} */ id) => CLUB_BY_ID[id]?.name || id;
