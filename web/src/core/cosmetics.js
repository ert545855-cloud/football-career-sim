// KOZMETİK — krampon, antrenman forması, saç bandı, eldiven, kol boyu, berber (saç modeli/rengi).
// Satın alınır, giyilir; mini oyunlardaki piksel oyuncuna yansır. Statlara etkisi yok (Altın Krampon küçük ün verir).
import { AVATAR, CLUB_BY_ID } from './data.js';
import { spriteBuild } from './brain/body.js';
import { lookFromAvatar, kitFrom } from '../games/pixel/looks.js';

export const COSMETIC_SLOTS = [
  { id: 'casual', name: 'Serbest stil', where: 'Maç dışı profil ve dolap önizlemesi' },
  { id: 'boots', name: 'Krampon', where: 'Maç, antrenman, seçmeler' },
  { id: 'training', name: 'Antrenman forması', where: 'Antrenmanda (maçta kulüp forması giyilir)' },
  { id: 'band', name: 'Saç bandı', where: 'Her yerde' },
  { id: 'gloves', name: 'Eldiven', where: 'Her yerde' },
  { id: 'sleeve', name: 'Kol', where: 'Her yerde' },
  { id: 'hair', name: 'Berber', where: 'Saç modelin' },
  { id: 'dye', name: 'Saç rengi', where: 'Saç rengin' },
  { id: 'celebration', name: 'Gol sevinci', where: 'Canlı yayında attığın gollerden sonra' },
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
  // Gol sevinci (canlı yayın)
  { id: 'cel_corner', slot: 'celebration', name: 'Köşe bayrağı koşusu', price: 0, celebration: 'corner', pose: { dir: 'side', frame: 'run0' }, desc: 'Klasik: köşeye koş, tribünü selamla.' },
  { id: 'cel_slide', slot: 'celebration', name: 'Diz kayması', price: 900, celebration: 'slide', pose: { dir: 'side', frame: 'lunge' }, desc: 'Çimde dizlerinin üstünde kay.' },
  { id: 'cel_plane', slot: 'celebration', name: 'Uçak', price: 1200, celebration: 'plane', pose: { dir: 'down', frame: 'lunge' }, desc: 'Kollar açık, tribünlerin önünden süzül.' },
  { id: 'cel_heart', slot: 'celebration', name: 'Kalp', price: 800, celebration: 'heart', pose: { dir: 'down', frame: 'ready' }, desc: 'Taraftara ellerinle kalp yap.' },
  { id: 'cel_shush', slot: 'celebration', name: 'Sus işareti', price: 1500, celebration: 'shush', pose: { dir: 'down', frame: 'ready' }, desc: 'Deplasmanda rakip tribünü sustur.' },
  { id: 'cel_dance', slot: 'celebration', name: 'Dans', price: 2200, celebration: 'dance', pose: { dir: 'down', frame: 'run0' }, desc: 'Takım arkadaşlarınla koreografi.' },
  { id: 'cel_flip', slot: 'celebration', name: 'Ters takla', price: 3500, celebration: 'flip', pose: { dir: 'side', frame: 'ready' }, desc: 'Akrobatik: havada ters takla!' },
  // Serbest stil kıyafetleri: maç kitinden ayrı saklanır ve yalnızca maç dışı görünüşte kullanılır.
  { id: 'casual_tracksuit', slot: 'casual', outfitCategory: 'tracksuit', name: 'Başlangıç eşofmanı', price: 0, isDefault: true, kit: K('#243b63', '#c6ff3d', 'solid', '#17253c', '#243b63'), boots: { main: '#263449', accent: '#e5e7eb' }, casualFit: 'tracksuit', longSleeve: true, stripes: true },
  { id: 'casual_training', slot: 'casual', outfitCategory: 'tracksuit', name: 'Modern antrenman takımı', price: 4200, kit: K('#174b65', '#38bdf8', 'solid', '#173446', '#174b65'), boots: { main: '#f4f4f0', accent: '#38bdf8' }, casualFit: 'tracksuit', longSleeve: true, stripes: true },
  { id: 'casual_heritage', slot: 'casual', outfitCategory: 'tracksuit', name: 'Retro spor takımı', price: 6500, kit: K('#772f39', '#f4f4f0', 'solid', '#44242d', '#772f39'), boots: { main: '#e5e7eb', accent: '#772f39' }, casualFit: 'tracksuit', longSleeve: true, stripes: true },
  { id: 'casual_tee_jeans', slot: 'casual', outfitCategory: 'daily', name: 'Tişört ve kot', price: 1800, kit: K('#e8e7df', '#38bdf8', 'solid', '#25415f', '#25415f'), boots: { main: '#334155', accent: '#e5e7eb' }, casualFit: 'tshirt', longSleeve: false },
  { id: 'casual_hoodie', slot: 'casual', outfitCategory: 'daily', name: 'Sweatshirt ve jogger', price: 3200, kit: K('#374151', '#c6ff3d', 'solid', '#262d37', '#262d37'), boots: { main: '#1f2937', accent: '#c6ff3d' }, casualFit: 'hoodie', longSleeve: true, zip: true },
  { id: 'casual_street', slot: 'casual', outfitCategory: 'daily', name: 'Şehir stili', price: 5600, kit: K('#7c3aed', '#f4f4f0', 'solid', '#25223d', '#25223d'), boots: { main: '#f4f4f0', accent: '#7c3aed' }, casualFit: 'hoodie', longSleeve: true, stripes: true },
  { id: 'casual_suit_black', slot: 'casual', outfitCategory: 'suit', name: 'Klasik siyah takım', price: 9000, kit: K('#20242e', '#f4f4f0', 'solid', '#20242e', '#20242e'), boots: { main: '#17191e', accent: '#b9bfc4' }, casualFit: 'suit', longSleeve: true },
  { id: 'casual_suit_blue', slot: 'casual', outfitCategory: 'suit', name: 'Modern gece mavisi', price: 14000, kit: K('#18334d', '#d8e3ed', 'solid', '#18334d', '#18334d'), boots: { main: '#17191e', accent: '#d8e3ed' }, casualFit: 'suit', longSleeve: true },
  { id: 'casual_awards', slot: 'casual', outfitCategory: 'special', name: 'Ödül gecesi', price: 22000, kit: K('#392b4d', '#fbbf24', 'solid', '#282333', '#282333'), boots: { main: '#fbbf24', accent: '#fff7d6' }, casualFit: 'suit', longSleeve: true },
];

export const COSMETIC_BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
const DEFAULT_EQ = { boots: 'boots_black', training: 'tr_club', band: 'band_none', gloves: 'gloves_none', sleeve: 'sleeve_short', celebration: 'cel_corner', casual: 'casual_tracksuit' };

/** Giyili gol sevinci (canlı yayın animasyonu) */
export const celebrationOf = (state) => COSMETIC_BY_ID[ensureCosmetics(state).eq.celebration]?.celebration || 'corner';

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
  if (it.slot !== 'casual') equipCosmetic(state, id);
  return { ok: true, msg: it.slot === 'casual' ? `${it.name} satın alındı. Önizlemeden sonra “Giy” ile seçebilirsin.` : `${it.name} alındı ve giyildi.` };
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
export function playerLook(state, { training = false, club = null, offPitch = false } = {}) {
  const c = ensureCosmetics(state);
  const kitClub = club || CLUB_BY_ID[state.career?.clubId] || { colors: ['#2563eb', '#ffffff'] };
  const get = (slot) => COSMETIC_BY_ID[c.eq[slot]] || {};
  const tr = training ? get('training').kit : null;
  const look = lookFromAvatar(state.player?.avatar || {}, kitClub, {
    kit: tr ? { ...tr } : kitFrom(kitClub),
    boots: { ...(get('boots').boots || { main: '#16181d', accent: '#e5e7eb' }) },
    band: get('band').band || null,
    gloves: get('gloves').gloves || null,
    longSleeve: !!get('sleeve').longSleeve,
    number: String(state.player?.number ?? ''),
    build: spriteBuild(state.brain?.body), // Beden & Zihin: kaslı / kilolu gövde
  });
  if (offPitch) {
    const outfit = get('casual');
    if (outfit.kit) look.kit = { ...outfit.kit };
    if (outfit.boots) look.boots = { ...outfit.boots };
    look.pants = true;
    look.casualFit = outfit.casualFit || 'tracksuit';
    look.casual = true;
    look.number = '';
    look.longSleeve = outfit.longSleeve ?? true;
    look.zip = !!outfit.zip;
    look.stripes = !!outfit.stripes;
    look.band = null;
    look.gloves = null;
  }
  return look;
}

/** Önizleme: bir ürünü denemek (satın almadan) için görünüş. */
export function previewLook(state, id, opts) {
  const it = COSMETIC_BY_ID[id];
  const base = playerLook(state, { ...opts, training: opts?.training || it?.slot === 'training' });
  if (!it) return base;
  const L = { ...base };
  if (it.boots) L.boots = { ...it.boots };
  if (it.slot === 'training' && it.kit) L.kit = { ...it.kit };
  if (it.slot === 'casual') {
    if (it.kit) L.kit = { ...it.kit };
    if (it.boots) L.boots = { ...it.boots };
    L.pants = true;
    L.casualFit = it.casualFit || 'tracksuit';
    L.casual = true;
    L.number = '';
    L.longSleeve = it.longSleeve ?? true;
    L.zip = !!it.zip;
    L.stripes = !!it.stripes;
    L.band = null;
    L.gloves = null;
  }
  if (it.slot === 'band') L.band = it.band;
  if (it.slot === 'gloves') L.gloves = it.gloves;
  if (it.slot === 'sleeve') L.longSleeve = it.longSleeve;
  if (it.slot === 'hair') L.hair = it.hair;
  if (it.slot === 'dye') L.hairColor = AVATAR.hairColors[it.hairColor];
  return L;
}

export const cosmeticCount = (state) => ensureCosmetics(state).owned.filter((id) => (COSMETIC_BY_ID[id]?.price || 0) > 0).length;
