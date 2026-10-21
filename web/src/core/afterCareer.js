// FUTBOL SONRASI — emeklilikten sonra teknik direktörlük ya da TV yorumculuğu.
//
//  • Efsane puanı: kariyer toplamları, kupalar, milli maçlar ve Altın Top'tan. İlk tekliflerin seviyesini belirler.
//  • Teknik direktör: her sezon 3 karar (taktik, transfer, antrenman) → kulübün gücü değişir → lig simüle edilir.
//    Yönetim hedefi tutarsa itibar artar, kötü sezonlarda kovulursun ve daha küçük kulüplerden teklif gelir.
//  • TV yorumcusu: her sezon 3 program, her birinde üslup seçimi (objektif / sert / esprili) → popülerlik,
//    tartışma ve kazanç. Sezon sonunda sözleşme ve "Yılın Yorumcusu" ödülü.
import { CLUBS, CLUB_BY_ID, LEAGUES } from './data.js';
import { clamp, chance, pick, rand, roundTo, shuffle } from './rng.js';
import { createWorld, evolveRatings, positionOf, simulateWeek, sortedTable, worldWeeks } from './league.js';

export const COACH_CHOICES = {
  tactic: [
    { id: 'attack', label: 'Hücum futbolu', desc: 'Çok gol atar, çok yersin. Güçlü kadroda iyi.', att: 3, def: -2 },
    { id: 'balanced', label: 'Dengeli', desc: 'Risk yok, sürpriz de yok.', att: 0, def: 0 },
    { id: 'defend', label: 'Önce savunma', desc: 'Zayıf kadroyla puan toplamanın yolu.', att: -2, def: 3 },
  ],
  transfer: [
    { id: 'star', label: 'Yıldız transferi', desc: 'Bu sezon +3 güç; yönetim beklentisi artar.', now: 3, next: 0, pressure: 1 },
    { id: 'youth', label: 'Gençlere şans', desc: 'Bu sezon +0, gelecek sezon +3. Taraftar sabırlı.', now: 0, next: 3, pressure: -1 },
    { id: 'keep', label: 'Kadroyu koru', desc: 'Uyum: +1 güç.', now: 1, next: 0, pressure: 0 },
  ],
  training: [
    { id: 'hard', label: 'Ağır antrenman', desc: '+2 güç ama sakatlık krizi riski.', bonus: 2, risk: 0.3 },
    { id: 'normal', label: 'Normal', desc: '+1 güç.', bonus: 1, risk: 0.08 },
    { id: 'light', label: 'Hafif', desc: 'Sakatlık yok; güç artışı yok.', bonus: 0, risk: 0 },
  ],
};

export const SHOWS = [
  { id: 'postmatch', name: 'Maç Sonu Masası', desc: 'Derbi sonrası canlı yayın: hakem kararları tartışılıyor.' },
  { id: 'transfer', name: 'Transfer Gündemi', desc: 'Yaz transfer döneminin en çok konuşulan isimleri masada.' },
  { id: 'national', name: 'Milli Takım Özel', desc: 'Milli takımın turnuva kadrosunu değerlendiriyorsun.' },
  { id: 'derby', name: 'Derbi Öncesi', desc: 'Büyük maç öncesi iki takımın şansı.' },
  { id: 'legends', name: 'Efsaneler Konuşuyor', desc: 'Kendi kariyerini ve bugünün futbolunu anlatıyorsun.' },
];

export const TONES = [
  { id: 'objective', label: 'Objektif analiz', desc: 'Taktik tahtası, veri, saygılı dil.', pop: 3, controversy: -2, money: 0 },
  { id: 'harsh', label: 'Sert eleştiri', desc: 'Reyting patlar ama kulüpler ve federasyon kızar.', pop: 6, controversy: 8, money: 400 },
  { id: 'funny', label: 'Esprili', desc: 'Sosyal medyada klip olursun.', pop: 5, controversy: 1, money: 200 },
];

/** Efsane puanı (0–100+) */
export function legendScore(state) {
  const c = state.career;
  const t = c.totals || {};
  const awards = (c.awards || []).length;
  const ballon = (c.awards || []).filter((a) => a.ballon).length;
  const caps = state.national?.caps?.A || c.caps || 0;
  return Math.round(clamp((t.goals || 0) * 0.25 + (t.assists || 0) * 0.2 + (t.apps || 0) * 0.04 + awards * 5 + caps * 0.25 + ballon * 20 + (state.player.fame || 0) * 0.2 + (state.foundation?.legacy || 0) * 0.5, 0, 150));
}

export function ensureAfter(state) {
  const a = state.after || (state.after = {});
  a.path = a.path ?? null;
  a.year = a.year || 1;
  a.age = a.age || state.player.age;
  a.legend = a.legend ?? legendScore(state);
  a.coach = a.coach || null;
  a.pundit = a.pundit || null;
  a.awards = a.awards || [];
  return a;
}

// ─────────────────────────── Teknik direktörlük ───────────────────────────

/** Kulüp teklifleri: efsane puanı yükseldikçe daha büyük kulüpler */
export function coachOffers(state, { rep } = {}) {
  const a = ensureAfter(state);
  const level = rep ?? a.legend;
  const target = 30 + level * 0.45; // kulüp gücü hedefi
  const pool = shuffle(CLUBS)
    .filter((c) => c.rating <= target + 6 && c.rating >= target - 18 && c.id !== a.coach?.clubId)
    .sort((x, y) => y.rating - x.rating)
    .slice(0, 3);
  return (pool.length ? pool : CLUBS.slice(-3)).map((c) => ({
    clubId: c.id,
    salary: roundTo(400 + c.rating * 60, 100),
    target: boardTarget(c.id),
    years: 2,
  }));
}

/** Yönetimin hedef sırası (kulübün lig içindeki güç sırasından) */
export function boardTarget(clubId) {
  const club = CLUB_BY_ID[clubId];
  const lg = CLUBS.filter((c) => c.league === club.league).sort((a, b) => b.rating - a.rating);
  const idx = lg.findIndex((c) => c.id === clubId);
  return clamp(idx + 1 + 1, 1, lg.length - 2);
}

export function startCoaching(state, offer) {
  const a = ensureAfter(state);
  a.path = 'coach';
  a.coach = {
    clubId: offer.clubId,
    salary: offer.salary,
    target: offer.target,
    rep: clamp(a.legend * 0.5 + 20, 10, 80),
    seasons: [],
    titles: 0,
    pendingNext: 0,
    fired: false,
    offers: null,
  };
  return a.coach;
}

/**
 * Bir sezonu oynatır. choices = {tactic, transfer, training} (id'ler)
 * @returns {{position:number, target:number, champion:boolean, verdict:'extend'|'ok'|'fired', table:Array, rating:number, crisis:boolean, awards:string[]}}
 */
export function playCoachSeason(state, choices) {
  const a = ensureAfter(state);
  const co = a.coach;
  const tac = COACH_CHOICES.tactic.find((x) => x.id === choices.tactic) || COACH_CHOICES.tactic[1];
  const tr = COACH_CHOICES.transfer.find((x) => x.id === choices.transfer) || COACH_CHOICES.transfer[2];
  const trn = COACH_CHOICES.training.find((x) => x.id === choices.training) || COACH_CHOICES.training[1];
  const club = CLUB_BY_ID[co.clubId];
  const world = createWorld(a.year + 100, a.ratings || null);
  const base = world.ratings[co.clubId];
  const crisis = chance(trn.risk);
  // Teknik direktör etkisi: itibar (iyi hoca kadroyu %5'e kadar daha iyi oynatır) + kararlar
  const coachSkill = (co.rep - 50) / 25;
  const tacticFit = tac.id === 'attack' ? (base >= 60 ? 1 : -1) : tac.id === 'defend' ? (base < 50 ? 1.5 : -0.5) : 0.5;
  const rating = clamp(base + tr.now + co.pendingNext + trn.bonus + coachSkill + tacticFit - (crisis ? 4 : 0) + rand(-1.5, 1.5), 15, 95);
  world.ratings[co.clubId] = rating;
  for (let w = 1; w <= worldWeeks(world); w++) simulateWeek(world, w);
  const lg = world.leagues[club.league];
  const table = sortedTable(lg);
  const position = positionOf(world, co.clubId);
  const champion = position === 1;
  const target = co.target + (tr.pressure > 0 ? -1 : tr.pressure < 0 ? 1 : 0);
  const diff = target - position; // + = hedefin üstünde
  co.rep = clamp(co.rep + diff * 3 + (champion ? 12 : 0) - (crisis ? 2 : 0), 0, 100);
  if (champion) co.titles++;
  const awards = [];
  if (champion) awards.push(`${LEAGUES[club.league].name} Şampiyonu`);
  if (diff >= 4) awards.push('Yılın Teknik Direktörü');
  for (const t of awards) a.awards.push({ year: a.year, title: t, role: 'coach', clubId: co.clubId });
  let verdict = 'ok';
  if (diff <= -4 || (diff <= -2 && co.rep < 35)) verdict = 'fired';
  else if (diff >= 1) verdict = 'extend';
  co.seasons.push({ year: a.year, clubId: co.clubId, position, target, champion, tactic: tac.id, rating: Math.round(rating) });
  co.pendingNext = tr.next;
  a.ratings = evolveRatings(world);
  a.year += 1;
  a.age += 1;
  if (verdict === 'fired') {
    co.fired = true;
    co.offers = coachOffers(state, { rep: co.rep * 0.8 });
  } else if (verdict === 'extend') co.salary = roundTo(co.salary * 1.12, 100);
  return { position, target, champion, verdict, rating: Math.round(rating), crisis, awards, table: table.map((r) => ({ id: r.id, pts: r.pts })) };
}

export function acceptCoachOffer(state, offer) {
  const co = ensureAfter(state).coach;
  co.clubId = offer.clubId;
  co.salary = offer.salary;
  co.target = offer.target;
  co.fired = false;
  co.offers = null;
  co.pendingNext = 0;
  return co;
}

// ─────────────────────────── TV yorumculuğu ───────────────────────────

export function startPunditry(state) {
  const a = ensureAfter(state);
  a.path = 'pundit';
  a.pundit = { pop: clamp(20 + a.legend * 0.5, 15, 80), controversy: 10, earnings: 0, seasons: [], shows: null, showIndex: 0 };
  newPunditSeason(state);
  return a.pundit;
}

export function newPunditSeason(state) {
  const p = ensureAfter(state).pundit;
  p.shows = shuffle(SHOWS).slice(0, 3).map((s) => s.id);
  p.showIndex = 0;
  p.season = { pop: 0, money: 0, notes: [] };
  return p.shows;
}

/** Bir programda üslup seçimi */
export function doShow(state, toneId) {
  const a = ensureAfter(state);
  const p = a.pundit;
  const tone = TONES.find((t) => t.id === toneId) || TONES[0];
  const show = SHOWS.find((s) => s.id === p.shows[p.showIndex]);
  // Tartışma çok yüksekse sert üslup geri teper
  const backlash = tone.id === 'harsh' && p.controversy > 55 && chance(0.45);
  const dPop = backlash ? -6 : tone.pop + Math.round(rand(-1, 2));
  const dCon = tone.controversy + (backlash ? 6 : 0);
  const fee = roundTo(800 + p.pop * 40 + tone.money, 100);
  p.pop = clamp(p.pop + dPop, 0, 100);
  p.controversy = clamp(p.controversy + dCon - 2, 0, 100);
  p.earnings += fee;
  state.career.money += fee;
  p.season.pop += dPop;
  p.season.money += fee;
  const note = backlash
    ? 'Sözlerin çok tepki çekti, kanal özür yayınladı.'
    : { objective: 'Analizin uzmanlar arasında konuşuldu.', harsh: 'Klip sosyal medyada patladı; kulüpler tepkili.', funny: 'Esprin gündem oldu, milyonlarca izlendi.' }[tone.id];
  p.season.notes.push(`${show.name}: ${note}`);
  p.showIndex += 1;
  return { show, tone, dPop, dCon, fee, backlash, note, done: p.showIndex >= p.shows.length };
}

/** Sezon sonu: sözleşme ve ödül */
export function endPunditSeason(state) {
  const a = ensureAfter(state);
  const p = a.pundit;
  const award = p.pop >= 85 && p.controversy < 60;
  if (award) a.awards.push({ year: a.year, title: 'Yılın Yorumcusu', role: 'pundit' });
  const bonus = roundTo(p.pop * 120, 500);
  state.career.money += bonus;
  p.earnings += bonus;
  const dropped = p.pop < 15;
  p.seasons.push({ year: a.year, pop: p.pop, controversy: p.controversy, money: p.season.money + bonus, award });
  a.year += 1;
  a.age += 1;
  if (!dropped) newPunditSeason(state);
  return { award, bonus, dropped, pop: p.pop, controversy: p.controversy };
}

/** Tamamen emekli ol (yol kapanır) */
export function fullyRetire(state) {
  const a = ensureAfter(state);
  a.path = 'rest';
  return a;
}

export const MAX_AFTER_AGE = 72;
export const pickShowName = (id) => SHOWS.find((s) => s.id === id)?.name || pick(SHOWS).name;
