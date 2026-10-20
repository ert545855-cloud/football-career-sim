// GAYRİMENKUL — kiralık daire, dükkân ve villa al; kiracı bul, kira topla, değer artışından kazan.
// Her semtin kendi piyasası var (haftalık rastgele yürüyüş). Kiracı kalitesi kira politikana ve mülkün
// durumuna bağlı: düşük kira iyi kiracı ve hızlı doluluk, yüksek kira daha çok gelir ama sorunlu kiracı riski.
// Olaylar: geç ödeme, tahliye, su kaçağı, kombi arızası, çatı tamiri. Bakım yap (yenileme) → kira ve değer artar.
// Semt ve mülk isimleri kurgusaldır. Zarlar kendi tohumuyla.
import { clamp, roundTo, seeded } from './rng.js';
import { changeMorale } from './player.js';

export const PROP_TYPES = {
  studio: { id: 'studio', name: '1+0 Stüdyo', price: [45000, 70000], rent: [260, 380], art: 'small', vacancy: 1.2 },
  flat1: { id: 'flat1', name: '1+1 Daire', price: [90000, 140000], rent: [450, 650], art: 'mid', vacancy: 1 },
  flat2: { id: 'flat2', name: '2+1 Daire', price: [160000, 240000], rent: [760, 1050], art: 'mid', vacancy: 0.95 },
  resid: { id: 'resid', name: '3+1 Rezidans', price: [320000, 480000], rent: [1300, 1800], art: 'tower', vacancy: 0.85 },
  shop: { id: 'shop', name: 'Dükkân', price: [250000, 380000], rent: [1250, 1750], art: 'shop', vacancy: 0.6 },
  villa: { id: 'villa', name: 'Villa', price: [900000, 1400000], rent: [3200, 4600], art: 'villa', vacancy: 0.55 },
};
export const DISTRICTS = [
  { id: 'sahil', name: 'Sahil Mahallesi', demand: 1.15, drift: 0.0016 },
  { id: 'stad', name: 'Stadyum Yanı', demand: 1.1, drift: 0.0012 },
  { id: 'carsi', name: 'Eski Çarşı', demand: 1, drift: 0.0008 },
  { id: 'yenikent', name: 'Yeni Kent', demand: 0.95, drift: 0.0022 },
  { id: 'uni', name: 'Üniversite Caddesi', demand: 1.2, drift: 0.001 },
  { id: 'liman', name: 'Liman', demand: 0.9, drift: 0.0018 },
  { id: 'baglar', name: 'Bağlar', demand: 0.85, drift: 0.0006 },
  { id: 'tepe', name: 'Tepe Sitesi', demand: 1.05, drift: 0.0014 },
];
export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
export const RENT_POLICY = [
  { id: 0, name: 'Uygun', mult: 0.9, find: 1.35, good: 0.65 },
  { id: 1, name: 'Piyasa', mult: 1, find: 1, good: 0.5 },
  { id: 2, name: 'Yüksek', mult: 1.12, find: 0.65, good: 0.32 },
];
const TENANTS = ['Aile Yılmazer', 'Öğretmen Ece H.', 'Mühendis Kaan T.', 'Öğrenci Defne', 'Emekli Nuri Bey', 'Hemşire Selma', 'Grafiker Mert', 'Genç çift Aras', 'Doktor Leyla', 'Esnaf Rıza Usta', 'Yazılımcı Can', 'Kuaför Ayten', 'Market sahibi Hakan', 'Mimar Zeynep'];
const SHOP_TENANTS = ['Fırın', 'Eczane', 'Berber', 'Kırtasiye', 'Çiçekçi', 'Döner salonu', 'Telefoncu', 'Spor mağazası'];
export const REALTY_RULES = { listings: 4, refreshWeeks: 6, max: 8 };

const hashStr = (str) => {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const rngFor = (state, tag) => seeded(hashStr(`${state.player?.name}|${state.calendar?.season}|${state.calendar?.week}|re|${tag}`));
const lerpR = (R, [a, b]) => a + (b - a) * R();
const weekNo = (state) => (state.calendar?.season || 1) * 100 + (state.calendar?.week || 1);

export function ensureRealty(state) {
  const r = state.realty || (state.realty = {});
  r.owned ||= [];
  r.index ||= Object.fromEntries(DISTRICTS.map((d) => [d.id, 1]));
  r.log ||= [];
  r.rent ||= 0;
  r.costs ||= 0;
  if (!r.listings || (r.listedAt || 0) + REALTY_RULES.refreshWeeks <= weekNo(state)) refreshListings(state, r);
  return r;
}

function refreshListings(state, r) {
  const R = rngFor(state, 'list');
  const fame = state.player?.fame || 0;
  const wealth = state.career?.money || 0;
  // ilanlar bütçeye yakın olsun ama arada hayal ettiren bir büyük mülk de çıksın
  const types = Object.keys(PROP_TYPES).filter((t) => t !== 'villa' || fame >= 40 || wealth > 600000);
  r.listings = [];
  for (let i = 0; i < REALTY_RULES.listings; i++) {
    const T = PROP_TYPES[types[Math.floor(R() * types.length)]];
    const d = DISTRICTS[Math.floor(R() * DISTRICTS.length)];
    const cond = Math.round(40 + R() * 55);
    const idx = r.index[d.id] || 1;
    const price = roundTo(lerpR(R, T.price) * idx * (0.75 + cond / 400), 500);
    const rent = roundTo(lerpR(R, T.rent) * (0.7 + cond / 330) * d.demand, 10);
    r.listings.push({ lid: `${weekNo(state)}-${i}`, type: T.id, district: d.id, price, rent, cond, no: 1 + Math.floor(R() * 90) });
  }
  r.listedAt = weekNo(state);
}

export const propName = (p) => `${DISTRICT_BY_ID[p.district]?.name || ''} No:${p.no}`;
export const grossYield = (l) => (l.rent * 52) / l.price;

export function buyProperty(state, lid) {
  const r = ensureRealty(state);
  const l = r.listings.find((x) => x.lid === lid);
  if (!l) return { ok: false, text: 'İlan bulunamadı.' };
  if (r.owned.length >= REALTY_RULES.max) return { ok: false, text: `En fazla ${REALTY_RULES.max} mülk.` };
  const fee = roundTo(l.price * 0.04, 50); // tapu harcı + komisyon
  if (state.career.money < l.price + fee) return { ok: false, text: `Satın almak için ${(l.price + fee).toLocaleString('tr-TR')} € gerekiyor (harç dahil).` };
  state.career.money -= l.price + fee;
  r.listings = r.listings.filter((x) => x.lid !== lid);
  const p = { id: l.lid, type: l.type, district: l.district, no: l.no, bought: l.price, value: l.price, base: l.price / ((r.index[l.district] || 1) * (0.8 + l.cond / 500)), rent: l.rent, cond: l.cond, policy: 1, tenant: null, vacant: 0, income: 0, spent: fee, since: weekNo(state) };
  r.owned.push(p);
  log(state, `${propName(p)} (${PROP_TYPES[p.type].name}) satın alındı.`);
  return { ok: true, prop: p, fee };
}

export function sellProperty(state, id) {
  const r = ensureRealty(state);
  const p = r.owned.find((x) => x.id === id);
  if (!p) return { ok: false, text: 'Mülk bulunamadı.' };
  const fee = roundTo(p.value * 0.03, 50);
  const net = p.value - fee;
  state.career.money += net;
  r.owned = r.owned.filter((x) => x !== p);
  log(state, `${propName(p)} ${net.toLocaleString('tr-TR')} €'ya satıldı (${net - p.bought >= 0 ? 'kâr' : 'zarar'} ${Math.abs(net - p.bought).toLocaleString('tr-TR')} €).`);
  return { ok: true, net, gain: net - p.bought };
}

export const renovateCost = (p) => roundTo(p.value * ((100 - p.cond) / 100) * 0.28 + 1500, 100);

export function renovate(state, id) {
  const r = ensureRealty(state);
  const p = r.owned.find((x) => x.id === id);
  if (!p) return { ok: false, text: 'Mülk bulunamadı.' };
  if (p.cond >= 95) return { ok: false, text: 'Mülk zaten çok iyi durumda.' };
  const cost = renovateCost(p);
  if (state.career.money < cost) return { ok: false, text: `Yenileme için ${cost.toLocaleString('tr-TR')} € gerekiyor.` };
  state.career.money -= cost;
  p.spent += cost;
  const gain = 100 - p.cond;
  p.cond = 100;
  p.rent = roundTo(p.rent * (1 + gain / 260), 10);
  p.base *= 1 + gain / 400;
  log(state, `${propName(p)} yenilendi.`);
  return { ok: true, cost };
}

export function setRentPolicy(state, id, v) {
  const p = ensureRealty(state).owned.find((x) => x.id === id);
  if (p) p.policy = clamp(v, 0, 2);
  return !!p;
}

function log(state, text) {
  const r = ensureRealty(state);
  r.log.unshift({ s: state.calendar?.season, w: state.calendar?.week, text });
  if (r.log.length > 16) r.log.length = 16;
}

/**
 * Hafta sonu: semt piyasaları, kira tahsilatı, kiracı bulma/çıkma, bakım ve arızalar.
 * @returns {{rent:number, costs:number, net:number, news:{text:string,kind:string}[]}}
 */
export function realtyOnWeek(state) {
  const r = ensureRealty(state);
  const news = [];
  const R = rngFor(state, 'week');
  // semt endeksleri
  for (const d of DISTRICTS) {
    const z = (R() + R() + R() - 1.5) * 1.4; // ~normal
    r.index[d.id] = clamp((r.index[d.id] || 1) * (1 + d.drift + z * 0.009), 0.6, 3);
  }
  let rent = 0;
  let costs = 0;
  for (const p of r.owned) {
    const T = PROP_TYPES[p.type];
    const D = DISTRICT_BY_ID[p.district];
    const pol = RENT_POLICY[p.policy ?? 1];
    p.value = roundTo(p.base * r.index[p.district] * (0.8 + p.cond / 500), 100);
    const asking = Math.round(p.rent * pol.mult);
    // aidat + vergi + küçük bakım
    let c = roundTo(p.value * 0.00035, 10);
    if (p.tenant) {
      const t = p.tenant;
      const late = t.quality === 'sorunlu' ? R() < 0.22 : t.quality === 'orta' ? R() < 0.05 : false;
      if (late) {
        t.late += 1;
        if (t.late >= 3) {
          news.push({ text: `${propName(p)}: ${t.name} üç kez kirayı ödemedi, tahliye edildi. Avukat masrafı 1.500 €.`, kind: 'bad' });
          c += 1500;
          p.tenant = null;
          p.vacant = 0;
          changeMorale(state.player, -2);
        } else if (t.late === 1) news.push({ text: `${propName(p)}: ${t.name} bu ay kirayı geciktirdi.`, kind: 'info' });
      } else {
        rent += t.rent;
        p.income += t.rent;
      }
      if (p.tenant) {
        t.weeksLeft -= 1;
        p.cond = Math.max(20, p.cond - (t.quality === 'sorunlu' ? 0.35 : 0.12));
        if (t.weeksLeft <= 0) {
          if (R() < (t.quality === 'iyi' ? 0.8 : 0.55)) {
            t.weeksLeft = 26 + Math.floor(R() * 26);
            t.rent = roundTo(t.rent * 1.04, 10);
            news.push({ text: `${propName(p)}: ${t.name} sözleşmeyi uzattı, kira %4 arttı.`, kind: 'good' });
          } else {
            news.push({ text: `${propName(p)}: ${t.name} taşındı, mülk boş.`, kind: 'info' });
            p.tenant = null;
            p.vacant = 0;
          }
        }
      }
    } else {
      p.vacant += 1;
      const pFind = 0.32 * D.demand * T.vacancy * pol.find * (0.55 + p.cond / 220);
      if (R() < pFind) {
        const goodP = pol.good * (0.6 + p.cond / 250);
        const q = R() < goodP ? 'iyi' : R() < 0.7 ? 'orta' : 'sorunlu';
        const name = p.type === 'shop' ? SHOP_TENANTS[Math.floor(R() * SHOP_TENANTS.length)] : TENANTS[Math.floor(R() * TENANTS.length)];
        p.tenant = { name, quality: q, rent: asking, weeksLeft: 26 + Math.floor(R() * 26), late: 0 };
        news.push({ text: `${propName(p)}: yeni kiracı ${name} (${q === 'iyi' ? 'güvenilir' : q === 'orta' ? 'normal' : 'riskli'}), haftalık ${asking.toLocaleString('tr-TR')} €.`, kind: q === 'sorunlu' ? 'info' : 'good' });
      }
    }
    // arızalar: kötü durumdaki mülkte daha sık
    const breakP = 0.015 + (100 - p.cond) / 1800;
    if (R() < breakP) {
      const kinds = [['Su kaçağı', 0.004], ['Kombi arızası', 0.003], ['Çatı tamiri', 0.009], ['Elektrik tesisatı', 0.005]];
      const [nm, f] = kinds[Math.floor(R() * kinds.length)];
      const cost = roundTo(Math.max(400, p.value * f), 50);
      c += cost;
      news.push({ text: `${propName(p)}: ${nm.toLocaleLowerCase('tr')}, ${cost.toLocaleString('tr-TR')} € masraf.`, kind: 'bad' });
    }
    costs += c;
    p.spent += c;
  }
  const net = rent - costs;
  state.career.money += net;
  r.rent += rent;
  r.costs += costs;
  for (const n of news) if (n.kind !== 'info') log(state, n.text);
  return { rent, costs, net, news };
}

export function realtySummary(state) {
  const r = ensureRealty(state);
  const value = r.owned.reduce((n, p) => n + p.value, 0);
  const bought = r.owned.reduce((n, p) => n + p.bought, 0);
  const weeklyRent = r.owned.reduce((n, p) => n + (p.tenant?.rent || 0), 0);
  return { value, bought, gain: value - bought, weeklyRent, count: r.owned.length, occupied: r.owned.filter((p) => p.tenant).length };
}
