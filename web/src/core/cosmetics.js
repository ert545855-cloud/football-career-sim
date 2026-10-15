// KOZMETİK — krampon, antrenman forması, saç bandı, eldiven, kol boyu, berber (saç modeli/rengi).
// Satın alınır, giyilir; mini oyunlardaki piksel oyuncuna yansır. Statlara etkisi yok (Altın Krampon küçük ün verir).
import { AVATAR, CLUB_BY_ID } from './data.js';
import { lookFromAvatar, kitFrom } from '../games/pixel/looks.js';

export const COSMETIC_SLOTS = [
  { id: 'boots', name: 'Krampon', where: 'Maç, antrenman, seçmeler' },
  { id: 'training', name: 'Antrenman forması', where: 'Antrenmanda (maçta kulüp forması giyilir)' },
  { id: 'band', name: 'Saç bandı', where: 'Her yerde' },
  { id: 'gloves', name: 'Eldiven', where: 'Her yerde' },
  { id: 'sleeve', name: 'Kol', where: 'Her yerde' },
  { id: 'hair', name: 'Berber', where: 'Saç modelin' },
  { id: 'dye', name: 'Saç rengi', where: 'Saç rengin' },
];

const K = (body, accent, pattern, shorts, socks) => ({ body, accent, pattern, shorts, socks });

export const COSMETICS = [
  // Krampon
  { id: 'boots_black', slot: 'boots', name: 'Klasik Siyah', price: 0, boots: { main: '#16181d', accent: '#e5e7eb' } },
  { id: 'boots_white', slot: 'boots', name: 'Buz Beyazı', price: 900, boots: { main: '#f4f4f0', accent: '#2563eb' } },
  { id: 'boots_neon', slot: 'boots', name: 'Neon Yıldırım', price: 1800, boots: { main: '#c6ff3d', accent: '#16181d' } },
  { id: 'boots_fire', slot: 'boots', name: 'Ateş Kırmızısı', price: 2500, boots: { main: '#e11d48', accent: '#fbbf24' } },
  { id: 'boots_ocean', slot: 'boots', name: 'Okyanus', price: 3200, boots: { main: '#0ea5e9', accent: '#f4f4f0' } },
  { id: 'boots_pink', slot: 'boots', name: 'Pembe Panter', price: 4000, boots: { main: '#f472b6', accent: '#16181d' } },
  { id: 'boots_purple', slot: 'boots', name: 'Gece Moru', price: 5500, boots: { main: '#7c3aed', accent: '#c6ff3d' } },
  { id: 'boots_gold', slot: 'boots', name: 'Altın Krampon', price: 25000, boots: { main: '#fbbf24', accent: '#fff7d6' }, fame: 1, desc: 'Giydiğin her maç ün +1' },
  // Antrenman forması
  { id: 'tr_club', slot: 'training', name: 'Kulüp antrenmanı', price: 0, kit: null },
  { id: 'tr_bib', slot: 'training', name: 'Turuncu yelek', price: 600, kit: K('#f97316', '#fde68a', 'solid', '#14110f', '#14110f') },
  { id: 'tr_white', slot: 'training', name: 'Bembeyaz', price: 1200, kit: K('#f4f4f0', '#94a3b8', 'solid', '#f4f4f0', '#f4f4f0') },
  { id: 'tr_blackgold', slot: 'training', name: 'Siyah-Altın', price: 2200, kit: K('#16181d', '#fbbf24', 'stripes', '#16181d', '#fbbf24') },
  { id: 'tr_retro', slot: 'training', name: 'Retro 90\'lar', price: 3500, kit: K('#7c3aed', '#22d3ee', 'sash', '#16181d', '#7c3aed') },
  { id: 'tr_army', slot: 'training', name: 'Asker yeşili', price: 2800, kit: K('#3f6212', '#a3a35a', 'hoops', '#1c2410', '#3f6212') },
  { id: 'tr_star', slot: 'training', name: 'Ay-Yıldız', price: 4500, kit: K('#dc2626', '#f4f4f0', 'half', '#f4f4f0', '#dc2626') },
  // Saç bandı
  { id: 'band_none', slot: 'band', name: 'Bantsız', price: 0, band: null },
  { id: 'band_white', slot: 'band', name: 'Beyaz bant', price: 300, band: '#f4f4f0' },
  { id: 'band_black', slot: 'band', name: 'Siyah bant', price: 300, band: '#16181d' },
  { id: 'band_red', slot: 'band', name: 'Kırmızı bant', price: 450, band: '#dc2626' },
  { id: 'band_neon', slot: 'band', name: 'Neon bant', price: 700, band: '#c6ff3d' },
  // Eldiven
  { id: 'gloves_none', slot: 'gloves', name: 'Eldivensiz', price: 0, gloves: null },
  { id: 'gloves_black', slot: 'gloves', name: 'Siyah eldiven', price: 500, gloves: '#16181d' },
  { id: 'gloves_white', slot: 'gloves', name: 'Beyaz eldiven', price: 500, gloves: '#f4f4f0' },
  // Kol
  { id: 'sleeve_short', slot: 'sleeve', name: 'Kısa kol', price: 0, longSleeve: false },
  { id: 'sleeve_long', slot: 'sleeve', name: 'Uzun kol', price: 400, longSleeve: true },
  // Berber (saç modeli) ve saç rengi
  ...AVATAR.hairStyles.map((h) => ({ id: `hair_${h}`, slot: 'hair', name: AVATAR.hairStyleNames[h], price: 250, hair: h })),
  ...['Siyah', 'Kahve', 'Kumral', 'Sarı', 'Platin', 'Kızıl'].map((n, i) => ({ id: `dye_${i}`, slot: 'dye', name: n, price: 350, hairColor: i })),
];

export const COSMETIC_BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
const DEFAULT_EQ = { boots: 'boots_black', training: 'tr_club', band: 'band_none', gloves: 'gloves_none', sleeve: 'sleeve_short' };

export function ensureCosmetics(state) {
  const c = (state.cosmetics ||= {});
  c.owned ||= [];
  c.eq ||= {};
  for (const [slot, id] of Object.entries(DEFAULT_EQ)) {
    if (!c.owned.includes(id)) c.owned.push(id);
    if (!c.eq[slot]) c.eq[slot] = id;
  }
  // berber: mevcut saç modeli ve rengi zaten "sahip olunan"
  const av = state.player?.avatar || {};
  const hairId = `hair_${av.hair || 'short'}`;
  const dyeId = `dye_${av.hairColor ?? 0}`;
  for (const id of [hairId, dyeId]) if (COSMETIC_BY_ID[id] && !c.owned.includes(id)) c.owned.push(id);
  c.eq.hair = hairId;
  c.eq.dye = dyeId;
  return c;
}

export const ownsCosmetic = (state, id) => ensureCosmetics(state).owned.includes(id);
export const equipped = (state, slot) => ensureCosmetics(state).eq[slot];

export function buyCosmetic(state, id) {
  const it = COSMETIC_BY_ID[id];
  if (!it) return { ok: false, msg: 'Böyle bir ürün yok.' };
  const c = ensureCosmetics(state);
  if (c.owned.includes(id)) return equipCosmetic(state, id);
  if (state.career.money < it.price) return { ok: false, msg: 'Paran yetmiyor.' };
  state.career.money -= it.price;
  c.owned.push(id);
  equipCosmetic(state, id);
  return { ok: true, msg: `${it.name} alındı ve giyildi.` };
}

export function equipCosmetic(state, id) {
  const it = COSMETIC_BY_ID[id];
  const c = ensureCosmetics(state);
  if (!it || !c.owned.includes(id)) return { ok: false, msg: 'Önce satın almalısın.' };
  c.eq[it.slot] = id;
  if (it.slot === 'hair') state.player.avatar = { ...(state.player.avatar || {}), hair: it.hair };
  if (it.slot === 'dye') state.player.avatar = { ...(state.player.avatar || {}), hairColor: it.hairColor };
  return { ok: true, msg: `${it.name} giyildi.` };
}

/** Altın krampon gibi küçük etkiler (maç başına ün). */
export function cosmeticFame(state) {
  const b = COSMETIC_BY_ID[equipped(state, 'boots')];
  return b?.fame || 0;
}

/**
 * Oyuncunun piksel görünüşü. training: antrenman/seçme kıyafeti (antrenman forması varsa onu giyer).
 */
export function playerLook(state, { training = false, club = null } = {}) {
  const c = ensureCosmetics(state);
  const kitClub = club || CLUB_BY_ID[state.career?.clubId] || { colors: ['#2563eb', '#ffffff'] };
  const get = (slot) => COSMETIC_BY_ID[c.eq[slot]] || {};
  const tr = training ? get('training').kit : null;
  return lookFromAvatar(state.player?.avatar || {}, kitClub, {
    kit: tr ? { ...tr } : kitFrom(kitClub),
    boots: { ...(get('boots').boots || { main: '#16181d', accent: '#e5e7eb' }) },
    band: get('band').band || null,
    gloves: get('gloves').gloves || null,
    longSleeve: !!get('sleeve').longSleeve,
    number: String(state.player?.number ?? ''),
  });
}

/** Önizleme: bir ürünü denemek (satın almadan) için görünüş. */
export function previewLook(state, id, opts) {
  const it = COSMETIC_BY_ID[id];
  const base = playerLook(state, { ...opts, training: opts?.training || it?.slot === 'training' });
  if (!it) return base;
  const L = { ...base };
  if (it.boots) L.boots = { ...it.boots };
  if (it.slot === 'training' && it.kit) L.kit = { ...it.kit };
  if (it.slot === 'band') L.band = it.band;
  if (it.slot === 'gloves') L.gloves = it.gloves;
  if (it.slot === 'sleeve') L.longSleeve = it.longSleeve;
  if (it.slot === 'hair') L.hair = it.hair;
  if (it.slot === 'dye') L.hairColor = AVATAR.hairColors[it.hairColor];
  return L;
}

export const cosmeticCount = (state) => ensureCosmetics(state).owned.filter((id) => (COSMETIC_BY_ID[id]?.price || 0) > 0).length;
