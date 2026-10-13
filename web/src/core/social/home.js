// EV DİZAYNI — evin oda planı (ızgara), mobilya kataloğu, yerleştirme, konfor ve prestij.
//
// Evin büyüklüğü oturduğun evden gelir (mağazadaki ev eşyaları). Mobilyalar satın alınır, ızgaraya
// yerleştirilir. Yerleştirilen mobilyalar:
//   • Konfor → her hafta ek enerji ve moral (dinlenme kalitesi)
//   • Prestij → ev partilerinin etkisi, ün ve magazin ilgisi
// Aynı stildeki 4+ mobilya "uyum bonusu" verir.
import { ITEM_BY_ID } from '../data.js';

/** Ev planları (mağazadaki ev eşyasına göre); w×h ızgara */
export const HOMES = {
  room: { id: 'room', name: 'Kulüp misafirhanesi', w: 5, h: 4, wall: '#cbd5e1', floor: 'wood' },
  studio: { id: 'studio', name: 'Stüdyo daire', w: 6, h: 5, wall: '#e2e8f0', floor: 'wood' },
  flat: { id: 'flat', name: 'Site dairesi', w: 8, h: 6, wall: '#f1f5f9', floor: 'parquet' },
  penthouse: { id: 'penthouse', name: 'Deniz manzaralı rezidans', w: 9, h: 7, wall: '#f8fafc', floor: 'marble' },
  villa: { id: 'villa', name: 'Bahçeli villa', w: 11, h: 8, wall: '#fef3c7', floor: 'marble' },
};

export const WALLS = [
  { id: 'white', name: 'Kırık beyaz', color: '#f1f5f9', price: 0 },
  { id: 'sage', name: 'Adaçayı', color: '#b5c9b0', price: 150 },
  { id: 'navy', name: 'Lacivert', color: '#334e7a', price: 150 },
  { id: 'terracotta', name: 'Kiremit', color: '#c8805f', price: 150 },
  { id: 'club', name: 'Kulüp renkleri', color: null, price: 300 },
];
export const FLOORS = [
  { id: 'wood', name: 'Ahşap', price: 0 },
  { id: 'parquet', name: 'Parke', price: 200 },
  { id: 'marble', name: 'Mermer', price: 600 },
  { id: 'carpet', name: 'Halı kaplama', price: 250 },
];

export const STYLES = { modern: 'Modern', classic: 'Klasik', sporty: 'Sportif', luxury: 'Lüks' };

/**
 * Mobilya kataloğu. w×h: ızgarada kapladığı alan (döndürülünce yer değiştirir).
 * comfort/prestige: puan; style: uyum bonusu için.
 */
export const FURNITURE = [
  { id: 'bed_simple', name: 'Tek kişilik yatak', cat: 'Yatak odası', w: 1, h: 2, price: 300, comfort: 3, prestige: 0, style: 'modern', color: '#94a3b8' },
  { id: 'bed_double', name: 'Çift kişilik yatak', cat: 'Yatak odası', w: 2, h: 2, price: 1500, comfort: 6, prestige: 1, style: 'classic', color: '#a16207' },
  { id: 'bed_luxe', name: 'Ortopedik lüks yatak', cat: 'Yatak odası', w: 2, h: 2, price: 9000, comfort: 10, prestige: 3, style: 'luxury', color: '#e2e8f0' },
  { id: 'sofa_small', name: 'İki kişilik kanepe', cat: 'Salon', w: 2, h: 1, price: 600, comfort: 3, prestige: 1, style: 'modern', color: '#64748b' },
  { id: 'sofa_l', name: 'L koltuk', cat: 'Salon', w: 3, h: 2, price: 4000, comfort: 6, prestige: 2, style: 'modern', color: '#475569' },
  { id: 'sofa_leather', name: 'Deri Chesterfield', cat: 'Salon', w: 3, h: 1, price: 12000, comfort: 6, prestige: 5, style: 'classic', color: '#7c2d12' },
  { id: 'tv', name: 'Dev ekran TV', cat: 'Salon', w: 2, h: 1, price: 2500, comfort: 3, prestige: 2, style: 'modern', color: '#0f172a' },
  { id: 'table', name: 'Yemek masası', cat: 'Salon', w: 2, h: 2, price: 1800, comfort: 2, prestige: 2, style: 'classic', color: '#92400e' },
  { id: 'rug', name: 'Desenli halı', cat: 'Dekor', w: 2, h: 2, price: 700, comfort: 2, prestige: 1, style: 'classic', color: '#b91c1c', floor: true },
  { id: 'plant', name: 'Saksı bitkisi', cat: 'Dekor', w: 1, h: 1, price: 120, comfort: 1, prestige: 1, style: 'modern', color: '#16a34a' },
  { id: 'lamp', name: 'Lambader', cat: 'Dekor', w: 1, h: 1, price: 250, comfort: 1, prestige: 1, style: 'modern', color: '#fde68a' },
  { id: 'painting', name: 'Modern tablo', cat: 'Dekor', w: 1, h: 1, price: 3000, comfort: 1, prestige: 4, style: 'luxury', color: '#7c3aed', wall: true },
  { id: 'aquarium', name: 'Akvaryum', cat: 'Dekor', w: 2, h: 1, price: 5000, comfort: 3, prestige: 4, style: 'luxury', color: '#0ea5e9' },
  { id: 'trophy', name: 'Kupa dolabı', cat: 'Futbol', w: 2, h: 1, price: 2000, comfort: 1, prestige: 3, style: 'sporty', color: '#facc15', trophies: true },
  { id: 'jersey', name: 'Çerçeveli forma', cat: 'Futbol', w: 1, h: 1, price: 400, comfort: 0, prestige: 2, style: 'sporty', color: '#2563eb', wall: true },
  { id: 'console', name: 'Oyun köşesi', cat: 'Futbol', w: 2, h: 1, price: 1500, comfort: 3, prestige: 1, style: 'sporty', color: '#22c55e' },
  { id: 'gym', name: 'Ev spor aleti', cat: 'Futbol', w: 2, h: 2, price: 6000, comfort: 2, prestige: 2, style: 'sporty', color: '#475569', train: 0.04 },
  { id: 'massage_chair', name: 'Masaj koltuğu', cat: 'Futbol', w: 1, h: 1, price: 4500, comfort: 5, prestige: 2, style: 'luxury', color: '#1f2937' },
  { id: 'piano', name: 'Kuyruklu piyano', cat: 'Dekor', w: 2, h: 2, price: 25000, comfort: 2, prestige: 8, style: 'luxury', color: '#111827' },
  { id: 'bar_cart', name: 'Kahve köşesi', cat: 'Salon', w: 1, h: 1, price: 900, comfort: 2, prestige: 2, style: 'modern', color: '#78350f' },
];
export const FURNITURE_BY_ID = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));

/** Oturulan ev (mağazadan en iyisi; yoksa misafirhane) */
export function homeOf(state) {
  const order = ['villa', 'penthouse', 'flat', 'studio'];
  for (const id of order) if ((state.career.items || []).includes(id)) return HOMES[id];
  return HOMES.room;
}

export function ensureHome(state) {
  const s = state.social || (state.social = {});
  const h = s.home || (s.home = {});
  h.owned = h.owned || []; // satın alınmış ama yerleştirilmemiş: [{uid, id}]
  h.placed = h.placed || []; // [{uid, id, x, y, rot}]
  h.wall = h.wall || 'white';
  h.floor = h.floor || 'wood';
  h.walls = h.walls || ['white'];
  h.floors = h.floors || ['wood'];
  h.seq = h.seq || 0;
  h.planId = h.planId || homeOf(state).id;
  // Ev değiştiyse sığmayan mobilyalar depoya döner
  const plan = homeOf(state);
  if (h.planId !== plan.id) {
    h.planId = plan.id;
    const keep = [];
    for (const p of h.placed) {
      if (fits(plan, h.placed.filter((q) => q !== p && keep.includes(q)), p, p.x, p.y, p.rot)) keep.push(p);
      else h.owned.push({ uid: p.uid, id: p.id });
    }
    h.placed = keep;
  }
  return h;
}

export const dims = (f, rot) => (rot ? { w: f.h, h: f.w } : { w: f.w, h: f.h });

/** Katman: duvara asılanlar (tablo, forma) yalnızca üst duvarda; halılar zeminde; diğerleri eşya */
export const layerOf = (f) => (f.wall ? 'wall' : f.floor ? 'floor' : 'obj');

/** Mobilya bu konuma sığar mı? (sınır + çakışma; halılar üstüne eşya alır, tablolar duvara asılır) */
export function fits(plan, placed, item, x, y, rot) {
  const f = FURNITURE_BY_ID[item.id];
  if (!f) return false;
  if (f.wall && (y !== 0 || rot)) return false;
  const d = dims(f, rot);
  if (x < 0 || y < 0 || x + d.w > plan.w || y + d.h > plan.h) return false;
  for (const p of placed) {
    if (p.uid === item.uid) continue;
    const g = FURNITURE_BY_ID[p.id];
    if (!g) continue;
    if (layerOf(g) !== layerOf(f)) continue; // farklı katmanlar üst üste olabilir
    const e = dims(g, p.rot);
    if (x < p.x + e.w && x + d.w > p.x && y < p.y + e.h && y + d.h > p.y) return false;
  }
  return true;
}

export function buyFurniture(state, id) {
  const f = FURNITURE_BY_ID[id];
  if (!f) return { ok: false, msg: 'Ürün yok.' };
  if (state.career.money < f.price) return { ok: false, msg: 'Paran yetmiyor.' };
  const h = ensureHome(state);
  state.career.money -= f.price;
  const item = { uid: `f${++h.seq}`, id };
  h.owned.push(item);
  return { ok: true, item, msg: `${f.name} alındı. Şimdi evine yerleştir!` };
}

/** Depodaki ya da yerleşik mobilyayı (x,y)'ye koyar */
export function placeFurniture(state, uid, x, y, rot = 0) {
  const h = ensureHome(state);
  const plan = homeOf(state);
  const fromOwned = h.owned.find((o) => o.uid === uid);
  const fromPlaced = h.placed.find((p) => p.uid === uid);
  const item = fromOwned || fromPlaced;
  if (!item) return { ok: false, msg: 'Mobilya bulunamadı.' };
  if (!fits(plan, h.placed, item, x, y, rot)) return { ok: false, msg: 'Buraya sığmıyor.' };
  if (fromOwned) {
    h.owned = h.owned.filter((o) => o.uid !== uid);
    h.placed.push({ uid, id: item.id, x, y, rot });
  } else Object.assign(fromPlaced, { x, y, rot });
  return { ok: true };
}

export function storeFurniture(state, uid) {
  const h = ensureHome(state);
  const p = h.placed.find((q) => q.uid === uid);
  if (!p) return false;
  h.placed = h.placed.filter((q) => q.uid !== uid);
  h.owned.push({ uid: p.uid, id: p.id });
  return true;
}

export function sellFurniture(state, uid) {
  const h = ensureHome(state);
  const it = h.owned.find((o) => o.uid === uid) || h.placed.find((p) => p.uid === uid);
  if (!it) return 0;
  h.owned = h.owned.filter((o) => o.uid !== uid);
  h.placed = h.placed.filter((p) => p.uid !== uid);
  const refund = Math.round(FURNITURE_BY_ID[it.id].price * 0.4);
  state.career.money += refund;
  return refund;
}

export function setFinish(state, kind, id) {
  const h = ensureHome(state);
  const list = kind === 'wall' ? WALLS : FLOORS;
  const opt = list.find((o) => o.id === id);
  if (!opt) return { ok: false, msg: 'Seçenek yok.' };
  const owned = kind === 'wall' ? h.walls : h.floors;
  if (!owned.includes(id)) {
    if (state.career.money < opt.price) return { ok: false, msg: 'Paran yetmiyor.' };
    state.career.money -= opt.price;
    owned.push(id);
  }
  h[kind] = id;
  return { ok: true };
}

/** Evin puanları: konfor, prestij, stil uyumu, antrenman bonusu */
export function homeScore(state) {
  const h = ensureHome(state);
  const plan = homeOf(state);
  let comfort = 0;
  let prestige = 0;
  let train = 0;
  const styles = {};
  for (const p of h.placed) {
    const f = FURNITURE_BY_ID[p.id];
    if (!f) continue;
    comfort += f.comfort;
    prestige += f.prestige;
    train += f.train || 0;
    styles[f.style] = (styles[f.style] || 0) + 1;
  }
  const top = Object.entries(styles).sort((a, b) => b[1] - a[1])[0];
  const harmony = top && top[1] >= 4 ? top[0] : null;
  if (harmony) {
    comfort += 3;
    prestige += 3;
  }
  // Kupa dolabı ödül sayısıyla parlar
  if (h.placed.some((p) => p.id === 'trophy')) prestige += Math.min(6, (state.career.awards || []).length);
  if (h.floor === 'marble') prestige += 2;
  // Ev büyüklüğü taban prestiji
  const base = { room: 0, studio: 1, flat: 3, penthouse: 6, villa: 9 }[plan.id] || 0;
  prestige += base;
  return {
    comfort,
    prestige,
    train,
    harmony,
    /** Haftalık etki: enerji ve moral (sınırlı) */
    weekly: { energy: Math.min(8, Math.round(comfort / 4)), morale: Math.min(5, Math.round(comfort / 7)) },
  };
}

/** Evdeki mobilya listesi (depo + yerleşik) */
export function inventory(state) {
  const h = ensureHome(state);
  return { owned: h.owned.map((o) => ({ ...o, f: FURNITURE_BY_ID[o.id] })), placed: h.placed.map((p) => ({ ...p, f: FURNITURE_BY_ID[p.id] })) };
}

export const homeItemName = (state) => ITEM_BY_ID[homeOf(state).id]?.name || homeOf(state).name;
