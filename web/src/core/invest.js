// YATIRIM — oyun içi sanal piyasa. Kazandığın parayı kurgusal kripto paralara, endeks fonuna, altına,
// vadeli hesaba ya da (ünlendikçe) kendi taraftar tokenine yatırırsın. Fiyatlar her hafta sonu değişir.
//
// Piyasa modeli (haftalık, log getiri):
//   r = sürüklenme + rejim etkisi × beta + oynaklık × (kriptoda ortak etken + kendi gürültüsü) + olay şokları
//   Rejim: yatay / boğa / ayı (Markov zinciri). Olaylar: çöküş, fon onayı, düzenleme, listeleme, hack, viral, rug pull.
//   Taraftar tokeni oyuncunun maç notu, golleri, sakatlığı ile oynar.
// Menajer portföyü takip eder (uyarı, yorum, haftalık not); istersen portföyünü bir plana göre yönetir (ücretli).
// Piyasa kendi tohumlu üretecini kullanır (kayıtta saklanır); oyunun geri kalanının rastgeleliğini bozmaz.
// Tüm varlıklar kurgusaldır; gerçek kripto para, şirket ya da fonla ilgisi yoktur.
import { clamp, seeded } from './rng.js';
import { currentAgent, ensureAgent } from './agent.js';
import { changeMorale } from './player.js';
import { money, weeklyFinance } from './economy.js';

/** @typedef {{id:string,name:string,ticker:string,kind:'deposit'|'fund'|'gold'|'crypto'|'meme'|'fan',risk:number,start:number,drift:number,vol:number,beta?:number,fee:number,color:string,desc:string,minFame?:number}} Asset */

/** @type {Asset[]} */
export const ASSETS = [
  { id: 'VADE', ticker: 'VADE', name: 'Vadeli Hesap', kind: 'deposit', risk: 0, start: 1, drift: 0.0016, vol: 0, fee: 0, color: '#94a3b8', desc: 'Her hafta faiz işler, değeri asla düşmez. Getirisi düşük ama risksiz.' },
  { id: 'ENDX', ticker: 'ENDX', name: 'Süper Endeks Fonu', kind: 'fund', risk: 1, start: 100, drift: 0.0048, vol: 0.022, fee: 0.002, color: '#38bdf8', desc: 'Yüzlerce şirkete yayılmış fon. Kısa vadede iner çıkar, uzun vadede istikrarlı büyür.' },
  { id: 'ALTN', ticker: 'ALTN', name: 'Gram Altın', kind: 'gold', risk: 1, start: 62, drift: 0.001, vol: 0.016, fee: 0.004, color: '#facc15', desc: 'Kriz zamanlarının sığınağı. Piyasalar düşerken genelde değer kazanır.' },
  { id: 'GOLC', ticker: 'GOLC', name: 'GolCoin', kind: 'crypto', risk: 2, start: 24000, drift: 0.001, vol: 0.075, beta: 1, fee: 0.006, color: '#f59e0b', desc: 'Kurgusal kripto dünyasının en büyüğü. Dalgalı ama köklü.' },
  { id: 'PXC', ticker: 'PXC', name: 'PixelChain', kind: 'crypto', risk: 3, start: 38, drift: -0.002, vol: 0.11, beta: 1.3, fee: 0.006, color: '#a78bfa', desc: 'Oyun ve dijital koleksiyon zinciri. Haberlerle sert oynar.' },
  { id: 'KEDI', ticker: 'KEDI', name: 'Kale Kedisi', kind: 'meme', risk: 4, start: 0.0042, drift: -0.026, vol: 0.18, beta: 1.8, fee: 0.01, color: '#f472b6', desc: 'Şaka diye çıkmış meme coin. Bir gecede ikiye katlanır ya da sıfırlanır.' },
  { id: 'FAN', ticker: 'FAN', name: 'Taraftar Tokenin', kind: 'fan', risk: 3, start: 1, drift: 0, vol: 0.045, fee: 0.008, color: '#c6ff3d', minFame: 30, desc: 'Senin adına çıkan taraftar tokeni. Fiyatı maç notuna, gollerine ve sakatlıklarına göre oynar.' },
];
export const ASSET_BY_ID = Object.fromEntries(ASSETS.map((a) => [a.id, a]));
export const RISK_LABEL = ['Risksiz', 'Düşük', 'Orta', 'Yüksek', 'Çok yüksek'];
export const KIND_LABEL = { deposit: 'Mevduat', fund: 'Fon', gold: 'Emtia', crypto: 'Kripto', meme: 'Meme coin', fan: 'Taraftar tokeni' };
const CRYPTOISH = new Set(['crypto', 'meme', 'fan']);

export const REGIMES = {
  normal: { name: 'Yatay piyasa', crypto: 0, meme: 0, fund: 0, gold: 0 },
  bull: { name: 'Boğa sezonu', crypto: 0.022, meme: 0.03, fund: 0.002, gold: -0.001 },
  bear: { name: 'Ayı piyasası', crypto: -0.024, meme: -0.03, fund: -0.003, gold: 0.002 },
};

/** Haftalık olaylar: fx = basit getiri şoku. Metindeki %{ID} o varlığın gerçekleşen haftalık değişimiyle dolar. */
export const EVENTS = [
  { id: 'crash', p: 0.009, tone: 'bad', text: 'Küresel piyasalarda kara hafta: Endeks fonu %{ENDX}, GolCoin %{GOLC}.', fx: { ENDX: -0.12, GOLC: -0.2, PXC: -0.26, KEDI: -0.35, ALTN: 0.05 } },
  { id: 'etf', p: 0.025, tone: 'good', text: 'GolCoin için büyük fon onayı çıktı: fiyat %{GOLC}!', fx: { GOLC: 0.22, PXC: 0.1, KEDI: 0.12 } },
  { id: 'regul', p: 0.02, tone: 'bad', text: 'Kripto paralara sıkı düzenleme geliyor: GolCoin %{GOLC}.', fx: { GOLC: -0.18, PXC: -0.2, KEDI: -0.25 } },
  { id: 'listing', p: 0.018, tone: 'good', text: 'PixelChain büyük bir borsada listelendi: %{PXC}!', fx: { PXC: 0.4 } },
  { id: 'hack', p: 0.02, tone: 'bad', text: 'PixelChain köprüsü hacklendi! Fiyat %{PXC}.', fx: { PXC: -0.35 } },
  { id: 'pump', p: 0.026, tone: 'good', text: 'Kale Kedisi sosyal medyada viral oldu: %{KEDI}!', fx: { KEDI: 0.9 } },
  { id: 'rug', p: 0.025, tone: 'bad', text: 'Kale Kedisi geliştiricileri ortadan kayboldu! Fiyat %{KEDI}.', fx: { KEDI: -0.85 } },
];

/** Menajerin yönettiği planlar (hedef ağırlıklar) */
export const PROFILES = {
  safe: { id: 'safe', name: 'Temkinli', desc: 'Paranı korur: vadeli hesap, fon ve altın.', w: { VADE: 0.45, ENDX: 0.4, ALTN: 0.15 } },
  balanced: { id: 'balanced', name: 'Dengeli', desc: 'Fon ağırlıklı, biraz kripto.', w: { VADE: 0.15, ENDX: 0.45, ALTN: 0.1, GOLC: 0.22, PXC: 0.08 } },
  bold: { id: 'bold', name: 'Atak', desc: 'Yüksek risk, yüksek getiri beklentisi.', w: { ENDX: 0.25, ALTN: 0.05, GOLC: 0.4, PXC: 0.22, KEDI: 0.08 } },
};
export const AUTO_PCTS = [0, 0.1, 0.2, 0.3, 0.5];
export const MIN_TRADE = 50;
/** Yönetim ücreti: yönetilen portföy değerinin haftalık payı (~yıllık %2) */
export const MGMT_FEE = 0.0004;
const HIST_LEN = 52;
const FAN_FAME = 30;

const hashStr = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const weekIdx = (state) => (state.calendar?.season || 1) * 100 + (state.calendar?.week || 1);
const sig = (v) => (v >= 100 ? Math.round(v * 100) / 100 : Number(v.toPrecision(5)));

/** Piyasanın kendi üreteci: kayıttaki tohumdan başlar, kullanım sonrası tohum ilerler */
function marketRng(v) {
  const g = seeded(v.rs >>> 0);
  const R = () => g();
  R.save = () => { v.rs = Math.floor(g() * 4294967296) >>> 0; };
  return R;
}
function gauss(R) {
  let u = 0;
  let w = 0;
  while (u === 0) u = R();
  while (w === 0) w = R();
  return clamp(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w), -3, 3);
}
const pick = (R, arr) => arr[Math.floor(R() * arr.length)];

export const fanUnlocked = (state) => (state.player?.fame || 0) >= FAN_FAME;
/** Piyasada görünen varlıklar (taraftar tokeni ünle açılır, açıldıktan sonra hep kalır) */
export function listedAssets(state) {
  const v = ensureInvest(state);
  return ASSETS.filter((a) => a.kind !== 'fan' || v.prices.FAN != null);
}
export function assetName(state, a) {
  if (a.kind !== 'fan') return a.name;
  const first = String(state.player?.name || 'Oyuncu').split(' ')[0];
  return `${first} Taraftar Tokeni`;
}
export function assetTicker(state, a) {
  if (a.kind !== 'fan') return a.ticker;
  const first = String(state.player?.name || 'FAN').split(' ')[0].toLocaleUpperCase('tr');
  return first.replace(/[^A-ZÇĞİÖŞÜ]/g, '').slice(0, 5) || 'FAN';
}

/** Kayıt alanı (eski kayıtlarda yoksa oluşturulur) */
export function ensureInvest(state) {
  const v = state.invest || (state.invest = {});
  if (v.rs == null) v.rs = hashStr(`${state.player?.name || 'nfs'}|market`) ^ 0x9e3779b9;
  v.prices ||= {};
  v.hist ||= {};
  v.regime ||= 'normal';
  v.holdings ||= {};
  v.tx ||= [];
  v.log ||= [];
  v.auto ||= { pct: 0, target: 'ENDX' };
  v.mode ||= 'advice';
  v.profile ||= 'balanced';
  v.realized ||= 0;
  v.fees ||= 0;
  v.valHist ||= [];
  v.cool ||= {};
  if (ASSETS.some((a) => a.kind !== 'fan' && v.prices[a.id] == null)) seedHistory(v);
  return v;
}

/** İlk açılışta 26 haftalık geçmiş üretilir (grafikler boş görünmesin) */
function seedHistory(v) {
  const R = marketRng(v);
  for (const a of ASSETS) {
    if (a.kind === 'fan' || v.prices[a.id] != null) continue;
    const path = [a.start];
    let p = a.start;
    for (let i = 0; i < 25; i++) {
      const lr = a.kind === 'deposit' ? Math.log(1 + a.drift) : a.drift + a.vol * gauss(R) * 0.9;
      p = Math.max(a.start * 0.05, p * Math.exp(lr));
      path.push(sig(p));
    }
    // bugünkü fiyat başlangıç değerine yakın kalsın: yolu sona göre ölçekle
    const k = a.start / path[path.length - 1];
    v.hist[a.id] = path.map((x) => sig(x * k));
    v.prices[a.id] = a.start;
  }
  R.save();
}

function pushHist(v, id, p) {
  const h = v.hist[id] || (v.hist[id] = []);
  h.push(p);
  if (h.length > HIST_LEN) h.splice(0, h.length - HIST_LEN);
}

// ─────────────────────────── Değerleme ───────────────────────────

export const holdingValue = (state, id) => {
  const v = ensureInvest(state);
  const h = v.holdings[id];
  return h ? h.qty * (v.prices[id] || 0) : 0;
};
export function portfolioValue(state, ids = null) {
  const v = ensureInvest(state);
  return Object.keys(v.holdings).filter((id) => !ids || ids.includes(id)).reduce((n, id) => n + holdingValue(state, id), 0);
}
/** Haftalık zorunlu gider (yaşam + abonelikler) */
export const weeklyCost = (state) => {
  const f = weeklyFinance(state);
  return Math.max(1, f.living + f.upkeep);
};

/** Özet: değer, maliyet, K/Z, dağılım, nakit tamponu */
export function portfolioSummary(state) {
  const v = ensureInvest(state);
  const rows = Object.entries(v.holdings).map(([id, h]) => {
    const value = h.qty * (v.prices[id] || 0);
    return { id, qty: h.qty, cost: h.cost, value, pnl: value - h.cost, pct: h.cost > 0 ? value / h.cost - 1 : 0 };
  }).sort((a, b) => b.value - a.value);
  const value = rows.reduce((n, r) => n + r.value, 0);
  const cost = rows.reduce((n, r) => n + r.cost, 0);
  const cash = Math.max(0, state.career.money);
  const wealth = cash + value;
  const cryptoValue = rows.filter((r) => CRYPTOISH.has(ASSET_BY_ID[r.id]?.kind)).reduce((n, r) => n + r.value, 0);
  const memeValue = rows.filter((r) => ASSET_BY_ID[r.id]?.kind === 'meme').reduce((n, r) => n + r.value, 0);
  for (const r of rows) r.w = value > 0 ? r.value / value : 0;
  return {
    rows, value, cost, pnl: value - cost, pnlPct: cost > 0 ? value / cost - 1 : 0, realized: v.realized, fees: v.fees,
    cash, wealth, cryptoShare: wealth > 0 ? cryptoValue / wealth : 0, memeShare: wealth > 0 ? memeValue / wealth : 0,
    cashWeeks: Math.floor(cash / weeklyCost(state)), weekly: v.weekly || null, regime: v.regime,
  };
}

// ─────────────────────────── Al / sat ───────────────────────────

function logTx(state, v, t) {
  v.tx.unshift({ s: state.calendar.season, w: state.calendar.week, ...t });
  if (v.tx.length > 40) v.tx.length = 40;
}

/** Elle işlem yapılabilir mi? (yönetilen portföyde yalnız taraftar tokeni elle alınıp satılır) */
export function canTrade(state, id) {
  const v = ensureInvest(state);
  const a = ASSET_BY_ID[id];
  if (!a || v.prices[id] == null) return { ok: false, reason: 'Bu varlık piyasada değil.' };
  if (v.mode === 'managed' && a.kind !== 'fan') return { ok: false, reason: 'Portföyünü menajerin yönetiyor. Para eklemek ya da çekmek için plan bölümünü kullan.' };
  return { ok: true };
}

/** amount: kasadan çıkacak tutar (komisyon dahil) */
export function buy(state, id, amount, { auto = false } = {}) {
  const v = ensureInvest(state);
  const a = ASSET_BY_ID[id];
  const can = auto ? { ok: !!a && v.prices[id] != null, reason: 'Bu varlık piyasada değil.' } : canTrade(state, id);
  if (!can.ok) return { ok: false, text: can.reason };
  amount = Math.floor(amount);
  if (amount < MIN_TRADE) return { ok: false, text: `En az ${money(MIN_TRADE)} yatırabilirsin.` };
  if (amount > state.career.money) return { ok: false, text: 'Kasanda yeterli para yok.' };
  const wealthBefore = state.career.money + portfolioValue(state);
  const fee = amount * a.fee;
  const qty = (amount - fee) / v.prices[id];
  const h = v.holdings[id] || (v.holdings[id] = { qty: 0, cost: 0 });
  h.qty += qty;
  h.cost += amount;
  state.career.money -= amount;
  v.fees += fee;
  logTx(state, v, { t: 'buy', id, amount, qty, price: v.prices[id], auto });
  const note = auto ? null : buyComment(state, a, amount, wealthBefore);
  if (note) addNote(state, v, note);
  return { ok: true, qty, fee, note };
}

/** frac: elindekinin satılacak oranı (0–1) */
export function sell(state, id, frac = 1, { managed = false } = {}) {
  const v = ensureInvest(state);
  const a = ASSET_BY_ID[id];
  const h = v.holdings[id];
  if (!a || !h || h.qty <= 0) return { ok: false, text: 'Elinde bu varlık yok.' };
  if (!managed) {
    const can = canTrade(state, id);
    if (!can.ok) return { ok: false, text: can.reason };
  }
  frac = clamp(frac, 0, 1);
  if (frac <= 0) return { ok: false, text: 'Satılacak miktar seç.' };
  const q = h.qty * frac;
  const gross = q * v.prices[id];
  const fee = gross * a.fee;
  const net = Math.round(gross - fee);
  const costPart = h.cost * frac;
  if (frac >= 0.999) delete v.holdings[id];
  else { h.qty -= q; h.cost -= costPart; }
  state.career.money += net;
  v.realized += net - costPart;
  v.fees += fee;
  if (!managed) logTx(state, v, { t: 'sell', id, amount: net, qty: q, price: v.prices[id], pnl: net - costPart });
  return { ok: true, net, pnl: net - costPart, fee };
}

// ─────────────────────────── Menajer yönetimi ───────────────────────────

const MANAGED_IDS = ASSETS.filter((a) => a.kind !== 'fan').map((a) => a.id);

export function canManage(state) {
  const ag = currentAgent(state);
  if (ag.id === 'self') return { ok: false, reason: 'Portföy yönetimi için önce bir menajerle anlaşmalısın (Kariyer → Menajer).' };
  return { ok: true };
}

/** Planın hedef ağırlıkları; menajerin karakteri planı biraz değiştirir */
export function planWeights(state, profile = ensureInvest(state).profile) {
  const ag = currentAgent(state);
  const w = { ...(PROFILES[profile] || PROFILES.balanced).w };
  const crypto = (w.GOLC || 0) + (w.PXC || 0) + (w.KEDI || 0);
  if (ag.id === 'kemal' && crypto > 0) {
    // mahalle menajeri kriptoya güvenmez: o pay fona ve altına gider
    delete w.GOLC; delete w.PXC; delete w.KEDI;
    w.ENDX = (w.ENDX || 0) + crypto * 0.7;
    w.ALTN = (w.ALTN || 0) + crypto * 0.3;
  } else if (ag.aggressive && profile !== 'safe') {
    const from = w.VADE ? 'VADE' : 'ENDX';
    const d = Math.min(w[from], 0.06);
    w[from] -= d;
    w.KEDI = (w.KEDI || 0) + d;
  } else if (ag.id === 'vitali') {
    const d = Math.min(w.ENDX || 0, 0.05);
    w.ENDX -= d;
    w.ALTN = (w.ALTN || 0) + d;
  }
  const tot = Object.values(w).reduce((n, x) => n + x, 0) || 1;
  for (const k of Object.keys(w)) { w[k] /= tot; if (w[k] < 1e-6) delete w[k]; }
  return w;
}

/** Portföyü hedef ağırlıklara getirir (alım-satım komisyonu düşülür). @returns ödenen komisyon */
export function rebalance(state, force = false) {
  const v = ensureInvest(state);
  const w = planWeights(state);
  const V = portfolioValue(state, MANAGED_IDS);
  if (V < 1) return 0;
  let maxDev = 0;
  for (const id of MANAGED_IDS) maxDev = Math.max(maxDev, Math.abs(holdingValue(state, id) / V - (w[id] || 0)));
  if (!force && maxDev < 0.05) return 0;
  let fees = 0;
  for (const id of MANAGED_IDS) fees += Math.abs(V * (w[id] || 0) - holdingValue(state, id)) * ASSET_BY_ID[id].fee;
  const after = V - fees;
  const cost = MANAGED_IDS.reduce((n, id) => n + (v.holdings[id]?.cost || 0), 0);
  for (const id of MANAGED_IDS) {
    if (!w[id]) { delete v.holdings[id]; continue; }
    v.holdings[id] = { qty: (after * w[id]) / v.prices[id], cost: cost * w[id] };
  }
  v.fees += fees;
  return fees;
}

export function setMode(state, mode, profile) {
  const v = ensureInvest(state);
  if (profile && PROFILES[profile]) v.profile = profile;
  if (mode === 'managed') {
    const c = canManage(state);
    if (!c.ok) return { ok: false, text: c.reason };
    const was = v.mode;
    v.mode = 'managed';
    v.auto.target = 'plan';
    rebalance(state, true);
    if (was !== 'managed' || profile) addNote(state, v, { kind: 'managedStart', tone: 'info', text: voice(state, 'managedStart', { plan: PROFILES[v.profile].name }) });
    return { ok: true };
  }
  v.mode = 'advice';
  if (v.auto.target === 'plan') v.auto.target = 'ENDX';
  return { ok: true };
}

/** Yönetilen plana para ekle */
export function addToPlan(state, amount, { auto = false } = {}) {
  const v = ensureInvest(state);
  amount = Math.floor(amount);
  if (v.mode !== 'managed') return { ok: false, text: 'Portföy yönetimi kapalı.' };
  if (amount < MIN_TRADE) return { ok: false, text: `En az ${money(MIN_TRADE)} ekleyebilirsin.` };
  if (amount > state.career.money) return { ok: false, text: 'Kasanda yeterli para yok.' };
  const w = planWeights(state);
  let fees = 0;
  for (const [id, x] of Object.entries(w)) {
    const part = amount * x;
    const fee = part * ASSET_BY_ID[id].fee;
    fees += fee;
    const h = v.holdings[id] || (v.holdings[id] = { qty: 0, cost: 0 });
    h.qty += (part - fee) / v.prices[id];
    h.cost += part;
  }
  state.career.money -= amount;
  v.fees += fees;
  logTx(state, v, { t: 'plan', id: 'plan', amount, auto });
  return { ok: true, fee: fees };
}

/** Yönetilen plandan para çek (her varlıktan orantılı satılır) */
export function withdrawPlan(state, amount) {
  const v = ensureInvest(state);
  const V = portfolioValue(state, MANAGED_IDS);
  if (V < 1) return { ok: false, text: 'Yönetilen portföyün boş.' };
  const frac = clamp(amount / V, 0, 1);
  let net = 0;
  let pnl = 0;
  for (const id of MANAGED_IDS) {
    if (!v.holdings[id]) continue;
    const r = sell(state, id, frac >= 0.995 ? 1 : frac, { managed: true });
    if (r.ok) { net += r.net; pnl += r.pnl; }
  }
  logTx(state, v, { t: 'withdraw', id: 'plan', amount: net, pnl });
  return { ok: true, net, pnl };
}

// ─────────────────────────── Haftalık fiyatlar ───────────────────────────

function fanReturn(state, ctx, RG, e) {
  const sm = ctx?.summary;
  let r = 0.001 + RG.crypto * 0.35 + 0.045 * e;
  if (sm?.played) r += (sm.rating - 6.6) * 0.04 + (sm.goals || 0) * 0.035 + (sm.assists || 0) * 0.015 + (sm.motm ? 0.03 : 0);
  else if (sm) r -= 0.015;
  if (state.flags?.injuredWeeks > 0) r -= 0.03;
  return r;
}

const pctTxt = (x) => `${x >= 0 ? '+' : '−'}%${Math.abs(x * 100).toFixed(Math.abs(x) < 0.1 ? 1 : 0).replace('.', ',')}`;
export { pctTxt as investPct };

function stepPrices(state, v, R, ctx) {
  const prev = v.regime;
  const r = R();
  if (prev === 'normal') v.regime = r < 0.06 ? 'bull' : r < 0.11 ? 'bear' : 'normal';
  else if (r < 0.1) v.regime = 'normal';
  const RG = REGIMES[v.regime];
  const f = gauss(R); // kripto ortak etkeni
  const ret = {};
  for (const a of ASSETS) {
    if (v.prices[a.id] == null) continue;
    let lr;
    if (a.kind === 'deposit') lr = Math.log(1 + a.drift);
    else if (a.kind === 'fan') lr = fanReturn(state, ctx, RG, gauss(R));
    else {
      const e = gauss(R);
      const z = a.kind === 'crypto' || a.kind === 'meme' ? 0.75 * f + 0.66 * e : e;
      lr = a.drift + (RG[a.kind] || 0) * (a.beta || 1) + a.vol * z;
    }
    ret[a.id] = clamp(lr, -0.7, 0.7);
  }
  const fired = [];
  const touched = new Set();
  for (const ev of EVENTS) {
    if (R() >= ev.p || fired.length >= 2) continue;
    const ids = Object.keys(ev.fx);
    if (ids.some((id) => touched.has(id))) continue;
    ids.forEach((id) => touched.add(id));
    fired.push(ev);
    for (const [id, x] of Object.entries(ev.fx)) if (ret[id] != null) ret[id] += Math.log(1 + x);
  }
  const before = { ...v.prices };
  for (const [id, lr] of Object.entries(ret)) {
    const a = ASSET_BY_ID[id];
    v.prices[id] = Math.max(a.start * 0.0004, sig(v.prices[id] * Math.exp(lr)));
    pushHist(v, id, v.prices[id]);
  }
  const chg = Object.fromEntries(Object.keys(ret).map((id) => [id, v.prices[id] / before[id] - 1]));
  const events = fired.map((ev) => ({
    id: ev.id, tone: ev.tone, assets: Object.keys(ev.fx),
    text: ev.text.replace(/%\{(\w+)\}/g, (_m, id) => pctTxt(chg[id] ?? 0)),
  }));
  return { events, chg, regimeChanged: v.regime !== prev ? v.regime : null };
}

// ─────────────────────────── Menajer takibi ───────────────────────────

/** Menajerlerin sesi: her menajer piyasaya kendi karakteriyle yorum yapar */
const VOICE = {
  self: {
    drop: ['İç sesin: "Portföyün bu hafta {pct}. Panikle satmak zararı kalıcı yapar; ama bu paranın gitmesini kaldırabilir misin?"'],
    gain: ['İç sesin: "Bu hafta {pct}. Şansı yetenekle karıştırma."'],
    concentration: ['İç sesin: "Servetinin {share} kısmı kriptoda. Bir menajer olsa \'çeşitlendir\' derdi."'],
    meme: ['İç sesin: "Kale Kedisi\'ne bu kadar para? Emin misin?"'],
    cash: ['İç sesin: "Kasada {weeks} haftalık gider kadar para kaldı. Biraz nakit tut."'],
    idle: ['İç sesin: "Kasada boşta {cash} duruyor. Vadeli hesap bile hiç yoktan iyidir."'],
    bull: ['Kripto piyasasında boğa sezonu başladı.'], bear: ['Kripto piyasası ayıya döndü.'], normal: ['Piyasa yataya bağladı.'],
    event: ['{event}'], monthly: ['Portföyün son 4 haftada {pct}.'], managedStart: [''],
  },
  kemal: {
    drop: ['Evlat, portföy bu hafta {pct}. Ben demiştim, bu işler kumar gibi. Gece uykunu kaçıracak parayı oraya koyma.', 'Bu hafta {pct}. Telaşla satma ama bir daha düşün; futbolcunun parası alın teriyle kazanılır.'],
    gain: ['Bu hafta {pct}, maşallah! Ama kâr cebe girince kârdır; bir kısmını kenara çek derim.'],
    concentration: ['Servetinin {share} kısmı kriptoda. Bu kadar yumurtayı aynı sepete koyma oğlum.'],
    meme: ['O kedili coin ne ola? Şakadan çıkmış para şakayla gider, dikkat et.'],
    cash: ['Kasada {weeks} haftalık gider kadar para kaldı. Faturalar yatırım beklemez; biraz nakit tut.'],
    idle: ['Kasanda boşta {cash} duruyor. Hiç değilse vadeli hesaba koy, faizi işlesin.'],
    bull: ['Kripto coşmuş diyorlar, herkes zengin olacağını sanıyor. Ben temkinliyim evlat.'],
    bear: ['Kripto piyasası çakılıyor. Telaşla satma ama yeni para da sokma.'],
    normal: ['Piyasa sakinleşti. İşimize, futbolumuza bakalım.'],
    event: ['{event} Elinde {asset} var, aklında olsun.'],
    monthly: ['Portföyünü temkinli yönetiyorum: son 4 haftada {pct}. Kriptoya bulaşmadım, gönlün rahat olsun.'],
    managedStart: ['Tamam evlat, paranı ben idare ederim. {plan} planla gidiyoruz ama kriptoya tek kuruş koymam, haberin olsun.'],
  },
  selin: {
    drop: ['Portföy haftayı {pct} ile kapattı. Risk profilinle uyumlu mu, birlikte gözden geçirelim.'],
    gain: ['Güzel hafta: {pct}. Hedef ağırlıklarının dışına çıktıysan dengelemeyi düşün.'],
    concentration: ['Servetinin {share} kısmı kripto. Profesyonel standartta bu oran en fazla %25 olur.'],
    meme: ['Meme coin pozisyonun servetinin {share} kısmı. Bu bir yatırım değil, piyango bileti.'],
    cash: ['Nakit tamponun {weeks} haftaya düştü. En az 8 haftalık gider nakitte durmalı.'],
    idle: ['Boşta {cash} nakit var. Endeks fonu uzun vadede en mantıklı başlangıç.'],
    bull: ['Kripto piyasası boğa sezonuna girdi. Fırsat var ama kalabalığa kapılarak karar verme.'],
    bear: ['Ayı piyasası başladı. Kademeli alım ya da beklemek, ikisi de savunulabilir.'],
    normal: ['Piyasa yataya bağladı. Planına sadık kal.'],
    event: ['{event} {asset} pozisyonun var, gelişmeleri izliyorum.'],
    monthly: ['Aylık rapor: yönettiğim portföy son 4 haftada {pct}. Dengeleme yapıldı, ücretler düşüldü.'],
    managedStart: ['Portföyünü {plan} planla yönetmeye başladım. Her ay rapor göndereceğim.'],
  },
  ferit: {
    drop: ['{pct} mi? Geçici! Düşüş fırsattır kardeşim. Ama satamayacağın parayla oynama.'],
    gain: ['{pct}! İşte böyle! Kazananı kovalarız, daha gidecek.'],
    concentration: ['Kriptoda {share} mi? Cesursun! Ama kasayı da boşaltma, kulüp cezaları kapıda.'],
    meme: ['Kale Kedisi\'nde güzel pozisyon. Uçarsa beni unutma, çakılırsa beni tanımıyorsun.'],
    cash: ['Kasada {weeks} haftalık para kaldı. Yatırım güzel ama kirayı da ödeyeceğiz.'],
    idle: ['{cash} boşta yatıyor! Para çalışmazsa sen çalışırsın. Bir yere koy şunu.'],
    bull: ['BOĞA GELDİ! Kemerleri bağla.'],
    bear: ['Ayı piyasası. Güçlüler bu dönemde toplar.'],
    normal: ['Piyasa uyudu. Fırtına öncesi sessizlik.'],
    event: ['{event} Elindeki {asset} için gözüm üstünde.'],
    monthly: ['Bu ay portföy {pct}. Atak oynuyoruz, sabırlı ol.'],
    managedStart: ['Paran bende güvende... çoğunlukla. {plan} planla gaza basıyoruz, biraz da kedi coin ekledim.'],
  },
  vitali: {
    drop: ['Bu hafta {pct}. Profesyoneller düşüşü planlar; çeşitlendirme seni korur.'],
    gain: ['Ottimo! {pct}. Kârın bir kısmını fona ya da altına taşı.'],
    concentration: ['Servetinin {share} kısmı kriptoda. Müvekkillerimin hiçbirinde bu oran %20\'yi geçmez.'],
    meme: ['Meme coin mi? Büyük kariyerler böyle haberlerle anılmamalı. Pozisyonu küçült.'],
    cash: ['Nakdin {weeks} haftalık gidere indi. Önce güvenlik, sonra getiri.'],
    idle: ['{cash} nakit boşta. Endeks fonu ve altın karışımıyla başlayalım mı?'],
    bull: ['Kripto boğası başladı. Coşku dönemlerinde disiplin her şeydir.'],
    bear: ['Ayı piyasası. Sabırlı yatırımcı bu dönemde değer yaratır.'],
    normal: ['Piyasa dengelendi. Planımıza devam.'],
    event: ['{event} {asset} pozisyonunu takip ediyorum.'],
    monthly: ['Aylık rapor: portföy son 4 haftada {pct}. Dengeleme tamam, risk kontrol altında.'],
    managedStart: ['Portföyünü {plan} planla yönetiyorum; altın payını biraz artırdım. Rahat ol, sen golüne bak.'],
  },
};

function voice(state, kind, vars = {}, R = Math.random) {
  const ag = currentAgent(state);
  const lines = (VOICE[ag.id] || VOICE.self)[kind] || VOICE.self[kind] || [''];
  return pick(R, lines).replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? '');
}

function addNote(state, v, note) {
  if (!note?.text) return;
  v.log.unshift({ s: state.calendar.season, w: state.calendar.week, agent: currentAgent(state).id, ...note });
  if (v.log.length > 12) v.log.length = 12;
}

/** Alım sonrası yorum: meme coin'e büyük para ya da kasayı boşaltan alım */
function buyComment(state, a, amount, wealthBefore) {
  const cashAfter = state.career.money;
  const weeks = Math.floor(Math.max(0, cashAfter) / weeklyCost(state));
  if (a.kind === 'meme' && amount > wealthBefore * 0.05) return { kind: 'meme', tone: 'warn', text: voice(state, 'meme', { share: `%${Math.round((holdingValue(state, a.id) / Math.max(1, wealthBefore)) * 100)}` }) };
  if (weeks < 4 && a.kind !== 'deposit') return { kind: 'cash', tone: 'warn', text: voice(state, 'cash', { weeks }) };
  return null;
}

/** Menajer haftalık portföyü inceler; en fazla iki not düşer */
function agentWatch(state, v, w, R) {
  const now = weekIdx(state);
  const sum = portfolioSummary(state);
  const notes = [];
  const ready = (k, gap) => (v.cool[k] || 0) <= now && (v.cool[k] = now + gap);
  const pct = pctTxt(w.pct);
  if (sum.value > 200) {
    if (w.pct <= -0.1 && ready('drop', 2)) notes.push({ kind: 'drop', tone: 'bad', text: voice(state, 'drop', { pct }, R) });
    else if (w.pct >= 0.15 && ready('gain', 2)) notes.push({ kind: 'gain', tone: 'good', text: voice(state, 'gain', { pct }, R) });
  }
  if (w.regimeChanged && ready(`reg-${w.regimeChanged}`, 3)) notes.push({ kind: w.regimeChanged, tone: w.regimeChanged === 'bear' ? 'warn' : 'info', text: voice(state, w.regimeChanged, {}, R) });
  const held = (ids) => ids.find((id) => (v.holdings[id]?.qty || 0) > 0);
  for (const ev of w.events) {
    const h = held(ev.assets);
    if (h && notes.length < 2) notes.push({ kind: 'event', tone: ev.tone === 'bad' ? 'bad' : 'good', text: voice(state, 'event', { event: ev.text, asset: ASSET_BY_ID[h].name }, R) });
  }
  if (notes.length < 2 && v.mode === 'advice') {
    if (sum.memeShare > 0.15 && ready('meme', 6)) notes.push({ kind: 'meme', tone: 'warn', text: voice(state, 'meme', { share: `%${Math.round(sum.memeShare * 100)}` }, R) });
    else if (sum.cryptoShare > 0.5 && ready('concentration', 5)) notes.push({ kind: 'concentration', tone: 'warn', text: voice(state, 'concentration', { share: `%${Math.round(sum.cryptoShare * 100)}` }, R) });
    else if (sum.value > 0 && sum.cashWeeks < 3 && ready('cash', 5)) notes.push({ kind: 'cash', tone: 'warn', text: voice(state, 'cash', { weeks: sum.cashWeeks }, R) });
    else if (sum.value === 0 && state.career.money > weeklyCost(state) * 30 && ready('idle', 10)) notes.push({ kind: 'idle', tone: 'info', text: voice(state, 'idle', { cash: money(state.career.money) }, R) });
  }
  if (v.mode === 'managed' && notes.length < 2 && (state.calendar.week % 4 === 0) && v.valHist.length >= 5) {
    const old = v.valHist[v.valHist.length - 5]?.v || 0;
    const nowV = v.valHist[v.valHist.length - 1]?.v || 0;
    if (old > 0) notes.push({ kind: 'monthly', tone: nowV >= old ? 'good' : 'info', text: voice(state, 'monthly', { pct: pctTxt(nowV / old - 1) }, R) });
  }
  return notes.slice(0, 2);
}

/**
 * Hafta sonu: fiyatlar değişir, yönetilen portföy dengelenir, maaştan otomatik yatırım yapılır, menajer not düşer.
 * @param {any} state @param {{summary?:any, fin?:{net:number}}} ctx
 */
export function investOnWeek(state, ctx = {}) {
  const v = ensureInvest(state);
  const R = marketRng(v);
  const news = [];
  // taraftar tokeni: ün eşiği aşılınca piyasaya çıkar
  let fanLaunch = false;
  if (v.prices.FAN == null && fanUnlocked(state)) {
    v.prices.FAN = 1;
    v.hist.FAN = [1];
    fanLaunch = true;
    news.push({ text: `${assetName(state, ASSET_BY_ID.FAN)} piyasaya çıktı! Fiyatı senin performansına bağlı.`, kind: 'good' });
  }
  const before = portfolioValue(state);
  const { events, chg, regimeChanged } = stepPrices(state, v, R, ctx);
  const after = portfolioValue(state);
  const w = { change: after - before, pct: before > 0 ? after / before - 1 : 0, events, regimeChanged };

  // menajer yönetimi: ücret + dengeleme (menajer ayrıldıysa yönetim kapanır)
  let mgmtFee = 0;
  if (v.mode === 'managed') {
    if (!canManage(state).ok) {
      setMode(state, 'advice');
      news.push({ text: 'Menajerinle yolları ayırdın: portföy yönetimi kapandı, kararlar artık sende.', kind: 'info' });
    } else {
      const V = portfolioValue(state, MANAGED_IDS);
      mgmtFee = V * MGMT_FEE;
      for (const id of MANAGED_IDS) if (v.holdings[id]) { v.holdings[id].qty *= 1 - MGMT_FEE; }
      const a = ensureAgent(state);
      a.paid = (a.paid || 0) + Math.round(mgmtFee);
      rebalance(state);
    }
  }
  // maaştan otomatik yatırım
  let autoInvested = 0;
  if (v.auto.pct > 0 && (ctx.fin?.net || 0) > 0) {
    const amount = Math.floor(ctx.fin.net * v.auto.pct);
    if (amount >= MIN_TRADE && state.career.money >= amount) {
      const r = v.mode === 'managed' ? addToPlan(state, amount, { auto: true }) : buy(state, v.auto.target || 'ENDX', amount, { auto: true });
      if (r.ok) autoInvested = amount;
    }
  }
  const value = portfolioValue(state);
  v.valHist.push({ s: state.calendar.season, w: state.calendar.week, v: Math.round(value) });
  if (v.valHist.length > HIST_LEN) v.valHist.splice(0, v.valHist.length - HIST_LEN);
  v.weekly = { s: state.calendar.season, w: state.calendar.week, change: Math.round(w.change), pct: w.pct, value: Math.round(value), autoInvested, mgmtFee: Math.round(mgmtFee) };

  const notes = agentWatch(state, v, w, R);
  for (const n of notes.slice().reverse()) addNote(state, v, n);
  // önemli notlar haber akışına
  const top = notes.find((n) => n.tone === 'bad' || n.tone === 'warn' || ['bull', 'bear'].includes(n.kind) || n.kind === 'event');
  if (top) news.push({ text: `${currentAgent(state).id === 'self' ? 'Piyasa' : currentAgent(state).name.split(' ')[0]}: ${top.text}`, kind: top.tone === 'good' ? 'good' : top.tone === 'bad' ? 'bad' : 'info' });
  // portföy moralini etkiler (servetin anlamlı kısmıysa)
  const wealth = Math.max(1, state.career.money + value);
  if (before > wealth * 0.2) {
    if (w.pct <= -0.15) changeMorale(state.player, -3);
    else if (w.pct >= 0.15) changeMorale(state.player, 2);
  }
  R.save();
  return { events, chg, regimeChanged, weekly: v.weekly, notes, news, fanLaunch };
}

/** Haftalık özet satırı (hafta sonu penceresi için) */
export function weeklyLine(state) {
  const v = state.invest;
  if (!v?.weekly || (!v.weekly.value && !v.weekly.change)) return null;
  return v.weekly;
}
