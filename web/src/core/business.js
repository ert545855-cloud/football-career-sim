// KENDİ İŞİN — kafe, spor salonu, krampon markası. Haftalık ciro − gider = kâr/zarar (kasana yansır).
// Talep: ünün, işletmenin puanı (müşteri memnuniyeti), seviye, pazarlama ve olaylar. Krampon markası
// gollerinle satar. Üst üste zarar ve boş kasa iflasa götürür. Menajerin fikir verir.
// Sahaya etkisi: kafe takım arkadaşı ilişkisini, spor salonu salon verimini (+%8), marka taraftar ilişkisini artırır;
// zarar eden işletme moralini düşürür. Zarlar kendi tohumuyla (oyunun rastgele akışını bozmaz).
import { clamp, roundTo, seeded } from './rng.js';
import { changeMorale, changeRel } from './player.js';
import { currentAgent } from './agent.js';
import { scaleWeek } from './calendar.js';

export const BIZ_TYPES = {
  cafe: {
    id: 'cafe', name: 'Kafe', cost: 60000, fixed: 1100, rev: 1500, fameSens: 0.012, vol: 0.16, risk: 'Orta',
    upgrade: [0, 45000, 120000], lvl: [1, 1.45, 2], costLvl: [1, 1.3, 1.7], mkt: [0, 300, 800], mgr: 450,
    perk: 'Takım arkadaşların burada takılır: takım uyumu her hafta +0,5',
    desc: 'Stadın yakınında küçük bir kafe. Maç günleri dolup taşar, kış aylarında sakinleşir.',
    sign: 'KAFE', color: '#b45309',
  },
  gym: {
    id: 'gym', name: 'Spor Salonu', cost: 180000, fixed: 3200, rev: 4300, fameSens: 0.008, vol: 0.1, risk: 'Düşük',
    upgrade: [0, 110000, 260000], lvl: [1, 1.4, 1.9], costLvl: [1, 1.25, 1.6], mkt: [0, 600, 1500], mgr: 800,
    perk: 'Kendi salonunda çalışırsın: spor salonu verimi +%8',
    desc: 'Üyelik sistemiyle düzenli gelir. Yavaş ama istikrarlı büyür.',
    sign: 'FİT', color: '#16a34a',
  },
  boots: {
    id: 'boots', name: 'Krampon Markası', cost: 400000, fixed: 6500, rev: 5000, fameSens: 0.032, vol: 0.28, risk: 'Yüksek',
    upgrade: [0, 250000, 600000], lvl: [1, 1.6, 2.4], costLvl: [1, 1.35, 1.8], mkt: [0, 1500, 4000], mgr: 1500,
    perk: 'Kendi kramponunla oynarsın: taraftar ilişkisi her hafta +0,6; gollerin satış patlatır',
    desc: 'Adını taşıyan krampon serisi. Ünün ve gollerinle satar; kötü sezonda stok kalır.',
    sign: 'BOOTS', color: '#7c3aed',
  },
};
export const BIZ_RULES = { maxPerType: 1, bankruptWeeks: 4, histLen: 16 };

const hashStr = (str) => {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const rngFor = (state, tag) => seeded(hashStr(`${state.player?.name}|${state.calendar?.season}|${state.calendar?.week}|biz|${tag}`));
const gauss = (R) => {
  let u = 0;
  let v = 0;
  while (!u) u = R();
  while (!v) v = R();
  return clamp(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v), -2.5, 2.5);
};

export function ensureBusiness(state) {
  const b = state.business || (state.business = {});
  b.list ||= [];
  b.log ||= [];
  b.total ||= 0; // toplam kâr/zarar
  return b;
}

export function bizName(state, type) {
  const parts = String(state.player?.name || 'Oyuncu').split(' ');
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (type === 'cafe') return `${last} Kafe`;
  if (type === 'gym') return `${first} Fitness`;
  return `${first.toLocaleUpperCase('tr')} ${state.player?.number || 10}`;
}

export const activeBiz = (state) => ensureBusiness(state).list.filter((x) => !x.closed);

export function canOpen(state, type) {
  const T = BIZ_TYPES[type];
  if (!T) return { ok: false, reason: 'Böyle bir iş yok.' };
  if (activeBiz(state).some((x) => x.type === type)) return { ok: false, reason: `Zaten bir ${T.name.toLocaleLowerCase('tr')} işletiyorsun.` };
  if (state.career.money < T.cost) return { ok: false, reason: `Kurmak için ${T.cost.toLocaleString('tr-TR')} € gerekiyor.` };
  if (type === 'boots' && (state.player?.fame || 0) < 35) return { ok: false, reason: 'Krampon markası için ünün en az 35 olmalı.' };
  return { ok: true };
}

/** Beklenen haftalık kâr aralığı (kurmadan önce gösterilir) */
export function estimate(state, type, level = 1) {
  const T = BIZ_TYPES[type];
  const fame = state.player?.fame || 0;
  const rev = T.rev * T.lvl[level - 1] * (1 + fame * T.fameSens) * 0.95;
  const cost = T.fixed * T.costLvl[level - 1];
  const mid = rev - cost;
  return { lo: roundTo(mid - rev * T.vol * 1.3, 50), hi: roundTo(mid + rev * T.vol * 1.3, 50), mid: roundTo(mid, 50) };
}

/** Menajerin fikri (kurmadan önce) */
export function bizAdvice(state, type) {
  const T = BIZ_TYPES[type];
  const ag = currentAgent(state);
  const who = ag.id === 'self' ? 'İç sesin' : ag.name.split(' ')[0];
  const left = state.career.money - T.cost;
  const est = estimate(state, type);
  if (left < T.fixed * 8) return `${who}: "Kurduktan sonra kasada ${Math.max(0, Math.round(left)).toLocaleString('tr-TR')} € kalıyor. İlk aylar zararla geçerse batarsın; biraz daha biriktir."`;
  if (est.mid < 0) return `${who}: "Şu anki ününle bu iş zarar eder. Önce sahada adını duyur, sonra kurarız."`;
  if (type === 'boots') return `${who}: "Büyük risk, büyük ödül. Gol attıkça satar ama kötü sezonda depoda kalır. Pazarlamayı ihmal etme."`;
  if (type === 'gym') return `${who}: "Sağlam iş. Yavaş büyür ama istikrarlıdır; kendi salonunda da çalışırsın."`;
  return `${who}: "Küçük ve sevimli bir iş. İyi bir müdür bulursan dertsiz para getirir."`;
}

export function openBusiness(state, type) {
  const c = canOpen(state, type);
  if (!c.ok) return c;
  const T = BIZ_TYPES[type];
  const b = ensureBusiness(state);
  state.career.money -= T.cost;
  const biz = {
    id: `${type}-${state.calendar.season}-${state.calendar.week}`, type, name: bizName(state, type), level: 1, rating: 3.4,
    invested: T.cost, marketing: 1, manager: false, effects: [], rivals: 0, hist: [], weeks: 0, debtWeeks: 0, lossStreak: 0,
    opened: { s: state.calendar.season, w: state.calendar.week }, visitedKey: null, closed: false, profit: 0,
  };
  b.list.push(biz);
  log(state, `${biz.name} açıldı! (${T.name})`);
  return { ok: true, biz };
}

function log(state, text) {
  const b = ensureBusiness(state);
  b.log.unshift({ s: state.calendar?.season, w: state.calendar?.week, text });
  if (b.log.length > 16) b.log.length = 16;
}

const findBiz = (state, id) => ensureBusiness(state).list.find((x) => x.id === id && !x.closed);

export function setMarketing(state, id, v) { const z = findBiz(state, id); if (z) z.marketing = clamp(v, 0, 2); return !!z; }
export function setManager(state, id, on) { const z = findBiz(state, id); if (z) z.manager = !!on; return !!z; }

export function upgradeBiz(state, id) {
  const z = findBiz(state, id);
  if (!z) return { ok: false, text: 'İşletme bulunamadı.' };
  const T = BIZ_TYPES[z.type];
  if (z.level >= 3) return { ok: false, text: 'En üst seviyede.' };
  const cost = T.upgrade[z.level];
  if (state.career.money < cost) return { ok: false, text: `Büyütmek için ${cost.toLocaleString('tr-TR')} € gerekiyor.` };
  state.career.money -= cost;
  z.level += 1;
  z.invested += cost;
  z.rating = clamp(z.rating + 0.2, 1, 5);
  log(state, `${z.name} büyüdü: seviye ${z.level}.`);
  return { ok: true, cost };
}

/** İşletmeyi ziyaret: 1 zaman hakkı, puan ve moral (haftada bir) */
export function visitBiz(state, id) {
  const z = findBiz(state, id);
  if (!z) return { ok: false, text: 'İşletme bulunamadı.' };
  const key = `${state.calendar.season}-${state.calendar.week}`;
  if (z.visitedKey === key) return { ok: false, text: 'Bu hafta zaten uğradın.' };
  if (state.calendar.phase !== 'week' || state.calendar.slots <= 0) return { ok: false, text: 'Bu hafta zamanın kalmadı.' };
  z.visitedKey = key;
  state.calendar.slots -= 1;
  z.rating = clamp(z.rating + 0.3, 1, 5);
  changeMorale(state.player, 2);
  if (z.type === 'cafe') changeRel(state.player, 'teammates', 1.5);
  if (z.type === 'boots') changeRel(state.player, 'fans', 1.5);
  return { ok: true };
}

export function bizValue(state, z) {
  const T = BIZ_TYPES[z.type];
  const recent = z.hist.slice(-8);
  const avg = recent.length ? recent.reduce((n, x) => n + x, 0) / recent.length : 0;
  return roundTo(Math.max(T.cost * 0.25, z.invested * 0.55 + Math.max(0, avg) * 40 * (0.7 + z.rating / 10)), 500);
}

export function sellBiz(state, id) {
  const z = findBiz(state, id);
  if (!z) return { ok: false, text: 'İşletme bulunamadı.' };
  const v = bizValue(state, z);
  state.career.money += v;
  z.closed = true;
  z.closedHow = 'satış';
  log(state, `${z.name} ${v.toLocaleString('tr-TR')} €'ya satıldı.`);
  return { ok: true, value: v };
}

const EVENTS = [
  { id: 'review', p: 0.05, types: ['cafe', 'gym', 'boots'], text: (z) => `${z.name} sosyal medyada viral oldu! Kapıda kuyruk var.`, fx: (z) => { z.effects.push({ mult: 1.4, weeks: 3 }); z.rating += 0.2; }, kind: 'good' },
  { id: 'inspection', p: 0.05, types: ['cafe'], text: (z, ok) => (ok ? `${z.name} hijyen denetiminden temiz çıktı.` : `${z.name} hijyen denetiminde ceza yedi (3.000 €).`), fx: (z, st) => { if (z.rating < 3.5) { st.career.money -= 3000; z.rating -= 0.3; return false; } return true; }, kind: 'info' },
  { id: 'supply', p: 0.04, types: ['cafe', 'boots'], text: (z) => `${z.name}: tedarik krizi, raflar boşaldı.`, fx: (z) => { z.effects.push({ mult: 0.72, weeks: 2 }); }, kind: 'bad' },
  { id: 'rival', p: 0.03, types: ['cafe', 'gym', 'boots'], text: (z) => `${z.name}: hemen yanına bir rakip açıldı. Müşteri bölünecek.`, fx: (z) => { z.rivals = Math.min(3, z.rivals + 1); }, kind: 'bad' },
  { id: 'staff', p: 0.04, types: ['cafe', 'gym'], text: (z, ok) => (ok ? `${z.name}: bir çalışan ayrıldı ama müdürün hemen yerini doldurdu.` : `${z.name}: iki çalışan birden istifa etti, hizmet aksadı.`), fx: (z) => { if (z.manager) return true; z.rating -= 0.4; return false; }, kind: 'info' },
  { id: 'influencer', p: 0.03, types: ['cafe', 'gym', 'boots'], text: (z) => `Ünlü bir fenomen ${z.name}'den paylaşım yaptı!`, fx: (z) => { z.effects.push({ mult: 1.25, weeks: 2 }); }, kind: 'good' },
  { id: 'theft', p: 0.02, types: ['cafe', 'gym', 'boots'], text: (z) => `${z.name}'de hırsızlık: 2.500 € zarar.`, fx: (z, st) => { st.career.money -= 2500; }, kind: 'bad' },
  { id: 'stock', p: 0.04, types: ['boots'], text: (z) => `${z.name}: yeni sezon modeli tuttu, stoklar tükeniyor!`, fx: (z) => { z.effects.push({ mult: 1.35, weeks: 3 }); }, kind: 'good' },
];

/** Bir işletmenin haftası (ctx.summary: maç özeti) */
function simWeek(state, z, ctx, R, news) {
  const T = BIZ_TYPES[z.type];
  const fame = state.player?.fame || 0;
  const sm = ctx?.summary;
  let mult = 1;
  for (const e of z.effects) mult *= e.mult;
  z.effects = z.effects.map((e) => ({ ...e, weeks: e.weeks - 1 })).filter((e) => e.weeks > 0);
  const week = state.calendar?.week || 1;
  const season = z.type === 'cafe' ? (week > scaleWeek(12) && week < scaleWeek(22) ? 0.88 : 1.05) : z.type === 'gym' ? (week <= scaleWeek(4) ? 1.15 : 1) : 1;
  let perf = 1;
  if (z.type === 'boots' && sm) perf += (sm.goals || 0) * 0.07 + (sm.motm ? 0.05 : 0) + (sm.played ? (sm.rating - 6.6) * 0.03 : -0.03);
  if (z.type === 'cafe' && sm?.result === 'W') perf += 0.06;
  const rev = Math.max(0, T.rev * T.lvl[z.level - 1] * (1 + fame * T.fameSens) * (0.62 + z.rating * 0.1) * [0.9, 1.12, 1.25][z.marketing] * Math.pow(0.92, z.rivals) * season * perf * mult * Math.exp(gauss(R) * T.vol - (T.vol * T.vol) / 2));
  const cost = T.fixed * T.costLvl[z.level - 1] + T.mkt[z.marketing] * (z.level >= 2 ? 1.3 : 1) + (z.manager ? T.mgr : 0);
  const profit = Math.round(rev - cost);
  // müşteri memnuniyeti: müdür varsa iyi bir seviyeye, yoksa vasata doğru gider
  const target = (z.manager ? 4.4 : 3.0) + (z.level - 1) * 0.25;
  z.rating = clamp(z.rating + (target - z.rating) * 0.12 + gauss(R) * 0.06, 1, 5);
  // olaylar (en fazla bir tane)
  for (const ev of EVENTS) {
    if (!ev.types.includes(z.type) || R() >= ev.p * (z.manager && ev.kind === 'bad' ? 0.6 : 1)) continue;
    const ok = ev.fx(z, state);
    z.rating = clamp(z.rating, 1, 5);
    news.push({ text: ev.text(z, ok), kind: ev.id === 'inspection' || ev.id === 'staff' ? (ok ? 'good' : 'bad') : ev.kind });
    break;
  }
  z.hist.push(profit);
  if (z.hist.length > BIZ_RULES.histLen) z.hist.splice(0, z.hist.length - BIZ_RULES.histLen);
  z.weeks += 1;
  z.profit += profit;
  z.lossStreak = profit < 0 ? z.lossStreak + 1 : 0;
  return { profit, rev: Math.round(rev), cost: Math.round(cost) };
}

/**
 * Hafta sonu tüm işletmeler. Kâr/zarar kasaya; kasa ekside kalırsa iflas sayacı işler.
 * @returns {{profit:number, rows:{name:string,profit:number}[], news:{text:string,kind:string}[]}}
 */
export function businessOnWeek(state, ctx = {}) {
  const b = ensureBusiness(state);
  const news = [];
  const rows = [];
  let total = 0;
  for (const z of b.list) {
    if (z.closed) continue;
    const R = rngFor(state, z.id);
    const r = simWeek(state, z, ctx, R, news);
    total += r.profit;
    rows.push({ name: z.name, profit: r.profit });
    // avantajlar
    if (z.type === 'cafe') changeRel(state.player, 'teammates', 0.5);
    if (z.type === 'boots') changeRel(state.player, 'fans', 0.6);
    if (z.lossStreak === 3) {
      const ag = currentAgent(state);
      news.push({ text: `${ag.id === 'self' ? 'Muhasebecin' : ag.name.split(' ')[0]}: "${z.name} üç haftadır zararda. ${z.manager ? 'Pazarlamayı artır ya da satmayı düşün.' : 'İyi bir müdür tutarsan müşteri memnuniyeti artar.'}"`, kind: 'bad' });
    }
    if (z.lossStreak >= 3) changeMorale(state.player, -1);
  }
  state.career.money += total;
  b.total += total;
  // iflas: kasa ekside kalırsa sayaç işler
  if (activeBiz(state).length && state.career.money < 0) {
    for (const z of activeBiz(state)) z.debtWeeks += 1;
    const worst = activeBiz(state).sort((x, y) => x.hist.slice(-4).reduce((n, v) => n + v, 0) - y.hist.slice(-4).reduce((n, v) => n + v, 0))[0];
    if (worst && worst.debtWeeks >= BIZ_RULES.bankruptWeeks) {
      worst.closed = true;
      worst.closedHow = 'iflas';
      const salvage = roundTo(worst.invested * 0.15, 500);
      state.career.money += salvage;
      changeMorale(state.player, -8);
      changeRel(state.player, 'sponsor', -5);
      news.push({ text: `${worst.name} iflas etti! Malzemeler ${salvage.toLocaleString('tr-TR')} €'ya satıldı. Basında kötü haberler çıktı.`, kind: 'bad' });
      log(state, `${worst.name} iflas etti.`);
    } else if (worst) news.push({ text: `Kasan ekside ve ${worst.name} borç birikiyor (${worst.debtWeeks}/${BIZ_RULES.bankruptWeeks} hafta). Para bulamazsan iflas edecek!`, kind: 'bad' });
  } else for (const z of activeBiz(state)) z.debtWeeks = 0;
  for (const n of news) if (n.kind !== 'info') log(state, n.text);
  return { profit: total, rows, news };
}
