// GARAJ — arabanı modifiye et: boya, kaplama, jant, body kit, spoyler, cam filmi, neon, motor, plaka.
//
// Modifiyeler arabaya özeldir (araba satılırsa harcamanın %30'u geri gelir). Her parça puan verir:
//   • style  → stil: haftalık moral, ün
//   • power  → performans (motor): moral, ama hız cezası riski (rastgele olaylar)
//   • flash  → dikkat çekme: taraftar ilgisi artar, paparazzi de seni daha kolay bulur
//   • stealth→ gizlilik (koyu cam): paparazzi şansını azaltır
import { ITEM_BY_ID } from './data.js';
import { changeFame, changeMorale, changeRel } from './player.js';

/** Modifiye edilebilen araçlar ve gövde tipi (çizim) + fiyat çarpanı + taban performans */
export const CARS = {
  hatch: { body: 'hatch', mult: 1, power: 22, name: 'Hatchback' },
  sedan: { body: 'sedan', mult: 2, power: 48, name: 'Elektrikli Sedan' },
  suv: { body: 'suv', mult: 3, power: 52, name: 'Lüks SUV' },
  super: { body: 'super', mult: 6, power: 86, name: 'Süper Spor' },
};

/** Modifiye kategorileri ve seçenekleri. price: taban (araç çarpanıyla çarpılır). */
export const MOD_CATS = [
  {
    id: 'paint', name: 'Boya', icon: 'paint',
    options: [
      { id: 'stock', name: 'Fabrika rengi', price: 0 },
      { id: 'black', name: 'Gece siyahı', price: 450, color: '#111827', style: 1 },
      { id: 'white', name: 'İnci beyazı', price: 450, color: '#f1f5f9', style: 1 },
      { id: 'red', name: 'Yarış kırmızısı', price: 450, color: '#dc2626', style: 1 },
      { id: 'blue', name: 'Gece mavisi', price: 450, color: '#1d4ed8', style: 1 },
      { id: 'green', name: 'Asit yeşili', price: 600, color: '#84cc16', style: 2, flash: 1 },
      { id: 'orange', name: 'Turuncu', price: 600, color: '#f97316', style: 2, flash: 1 },
      { id: 'club', name: 'Kulüp renkleri', price: 900, club: true, style: 3, flash: 1 },
    ],
  },
  {
    id: 'finish', name: 'Kaplama', icon: 'sparkle',
    options: [
      { id: 'gloss', name: 'Parlak', price: 0 },
      { id: 'metallic', name: 'Metalik', price: 350, style: 1 },
      { id: 'matte', name: 'Mat', price: 700, style: 2 },
      { id: 'chrome', name: 'Krom', price: 2500, style: 4, flash: 3 },
    ],
  },
  {
    id: 'stripes', name: 'Şerit', icon: 'flag',
    options: [
      { id: 'none', name: 'Yok', price: 0 },
      { id: 'racing', name: 'Yarış şeridi', price: 350, style: 2 },
      { id: 'side', name: 'Yan şerit', price: 300, style: 1 },
      { id: 'number', name: 'Forma numarası', price: 500, style: 2, flash: 1 },
    ],
  },
  {
    id: 'rims', name: 'Jant', icon: 'target',
    options: [
      { id: 'stock', name: 'Standart', price: 0 },
      { id: 'sport', name: 'Spor jant', price: 800, style: 2 },
      { id: 'carbon', name: 'Karbon jant', price: 2500, style: 3, power: 1 },
      { id: 'gold', name: 'Altın jant', price: 6000, style: 5, flash: 3 },
    ],
  },
  {
    id: 'kit', name: 'Body kit', icon: 'car',
    options: [
      { id: 'stock', name: 'Standart', price: 0 },
      { id: 'sport', name: 'Spor tampon + marşpiyel', price: 1500, style: 3, power: 1 },
      { id: 'wide', name: 'Geniş kasa (widebody)', price: 5000, style: 6, flash: 2 },
    ],
  },
  {
    id: 'spoiler', name: 'Spoyler', icon: 'bolt',
    options: [
      { id: 'none', name: 'Yok', price: 0 },
      { id: 'lip', name: 'Bagaj spoyleri', price: 300, style: 1 },
      { id: 'wing', name: 'Yarış kanadı', price: 1800, style: 3, power: 1, flash: 1 },
    ],
  },
  {
    id: 'tint', name: 'Cam filmi', icon: 'eye',
    options: [
      { id: 'none', name: 'Yok', price: 0 },
      { id: 'light', name: 'Açık film', price: 150, stealth: 1 },
      { id: 'dark', name: 'Koyu film', price: 400, style: 1, stealth: 3 },
    ],
  },
  {
    id: 'neon', name: 'Neon', icon: 'sparkle',
    options: [
      { id: 'none', name: 'Yok', price: 0 },
      { id: 'club', name: 'Kulüp renginde', price: 600, style: 2, flash: 3 },
      { id: 'purple', name: 'Mor', price: 600, style: 2, flash: 4, color: '#a855f7' },
      { id: 'cyan', name: 'Turkuaz', price: 600, style: 2, flash: 4, color: '#22d3ee' },
    ],
  },
  {
    id: 'engine', name: 'Motor', icon: 'wrench',
    options: [
      { id: 'stock', name: 'Fabrika', price: 0 },
      { id: 's1', name: 'Stage 1 yazılım', price: 2000, power: 2 },
      { id: 's2', name: 'Stage 2 turbo + egzoz', price: 6000, power: 4, flash: 1 },
      { id: 's3', name: 'Stage 3 yarış motoru', price: 15000, power: 7, flash: 2 },
    ],
  },
  {
    id: 'plate', name: 'Plaka', icon: 'star',
    options: [
      { id: 'stock', name: 'Standart', price: 0 },
      { id: 'custom', name: 'Özel plaka (isim + numara)', price: 1000, style: 2, flash: 1 },
    ],
  },
];
export const MOD_CAT_BY_ID = Object.fromEntries(MOD_CATS.map((c) => [c.id, c]));
export const optionOf = (cat, id) => MOD_CAT_BY_ID[cat]?.options.find((o) => o.id === id) || MOD_CAT_BY_ID[cat]?.options[0];

const defaults = () => Object.fromEntries(MOD_CATS.map((c) => [c.id, c.options[0].id]));

export function ensureGarage(state) {
  const g = state.garage || (state.garage = {});
  g.cars = g.cars || {};
  g.spent = g.spent || 0;
  g.installs = g.installs || 0;
  return g;
}

/** Sürdüğün araba (en değerli; bisiklet hariç) */
export function currentCarId(state) {
  const order = ['super', 'suv', 'sedan', 'hatch'];
  return order.find((id) => (state.career.items || []).includes(id)) || null;
}

export function ownedCars(state) {
  return ['hatch', 'sedan', 'suv', 'super'].filter((id) => (state.career.items || []).includes(id));
}

export function carState(state, carId) {
  const g = ensureGarage(state);
  const c = g.cars[carId] || (g.cars[carId] = { mods: defaults(), owned: [], spent: 0 });
  c.mods = { ...defaults(), ...c.mods };
  c.owned = c.owned || [];
  return c;
}

export function modPrice(carId, cat, optId) {
  const o = optionOf(cat, optId);
  return Math.round((o?.price || 0) * (CARS[carId]?.mult || 1));
}

/** Seçeneği uygula: sahip olunmayan seçenek satın alınır (eskiye dönmek bedava) */
export function applyMod(state, carId, cat, optId) {
  if (!CARS[carId] || !(state.career.items || []).includes(carId)) return { ok: false, msg: 'Bu araca sahip değilsin.' };
  const o = optionOf(cat, optId);
  if (!o || o.id !== optId) return { ok: false, msg: 'Parça bulunamadı.' };
  const c = carState(state, carId);
  if (c.mods[cat] === optId) return { ok: true, msg: 'Zaten takılı.', same: true };
  const key = `${cat}:${optId}`;
  const free = o.price === 0 || c.owned.includes(key);
  const price = free ? 0 : modPrice(carId, cat, optId);
  if (state.career.money < price) return { ok: false, msg: 'Paran yetmiyor.' };
  state.career.money -= price;
  if (!free) {
    c.owned.push(key);
    c.spent += price;
    const g = ensureGarage(state);
    g.spent += price;
    g.installs += 1;
  }
  c.mods[cat] = optId;
  return { ok: true, price, msg: price ? `${o.name} takıldı (−€${price.toLocaleString('tr-TR')}).` : `${o.name} seçildi.` };
}

export const isOwnedMod = (state, carId, cat, optId) => optionOf(cat, optId).price === 0 || carState(state, carId).owned.includes(`${cat}:${optId}`);

/** Araba puanları (sürdüğün araba) */
export function carStats(state, carId = currentCarId(state)) {
  if (!carId) return { carId: null, style: 0, power: 0, flash: 0, stealth: 0, perf: 0, installed: 0 };
  const c = carState(state, carId);
  let style = 0;
  let power = 0;
  let flash = 0;
  let stealth = 0;
  let installed = 0;
  for (const cat of MOD_CATS) {
    const o = optionOf(cat.id, c.mods[cat.id]);
    if (!o || !o.price) continue;
    installed += 1;
    style += o.style || 0;
    power += o.power || 0;
    flash += o.flash || 0;
    stealth += o.stealth || 0;
  }
  const base = CARS[carId];
  return { carId, style, power, flash, stealth, installed, perf: Math.min(100, base.power + power * 3), body: base.body };
}

/** Haftalık etki: stil → moral/ün, dikkat → taraftar */
export function garageOnWeekEnd(state) {
  const st = carStats(state);
  if (!st.carId) return null;
  const morale = Math.min(4, Math.round((st.style + st.power) / 7));
  if (morale) changeMorale(state.player, morale);
  if (st.flash >= 4) changeRel(state.player, 'fans', 1);
  if (st.style >= 15) changeFame(state.player, 0.2);
  return { morale, fans: st.flash >= 4 ? 1 : 0 };
}

/** Araba satılınca modifiye harcamasının %30'u geri gelir */
export function onCarSold(state, carId) {
  const g = ensureGarage(state);
  const c = g.cars[carId];
  if (!c) return 0;
  const refund = Math.round((c.spent || 0) * 0.3);
  state.career.money += refund;
  delete g.cars[carId];
  return refund;
}

/** Plaka yazısı: "34 KRM 10" gibi */
export function plateText(state) {
  const last = (state.player.name.split(' ').pop() || 'KRM').toLocaleUpperCase('tr').replace(/[^A-ZÇĞİÖŞÜ]/g, '').slice(0, 3) || 'KRM';
  return `34 ${last} ${state.player.number || 10}`;
}

export const carName = (carId) => ITEM_BY_ID[carId]?.name || CARS[carId]?.name || '';
