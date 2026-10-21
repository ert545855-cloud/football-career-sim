// @ts-check
// FOTOĞRAFLAR — Chirp'te paylaşılabilen görseller.
//  • Maç kareleri: canlı yayından alınan görüntüler (golün, asistin, sevincin; ya da maç sırasında 📸 ile).
//    Görüntü verisi kayıt dosyasını şişirmesin diye ayrı bir depoda (tarayıcı belleği) tutulur; kayıtta yalnızca
//    künyesi (hafta, dakika, skor, rakip) durur. Görüntü bulunamazsa (başka cihaz, temizlenmiş tarayıcı) künyeden
//    çizilmiş bir maç kartı gösterilir.
//  • Yaşam fotoğrafları: kahve, akşam yemeği, ev, araba, antrenman, stat, selfie — oyunun piksel sahnelerinden
//    o an çizilir (veri saklanmaz).
import { currentCarId } from '../garage.js';
import { ensureChirp } from './timeline.js';

/** state.chirp (ensureChirp her çağrıda nesneyi yeniden kurar; aynı nesne üzerinde çalışmak için bir kez) */
const chirpOf = (state) => state.chirp || ensureChirp(state);

/** Galeride tutulan en fazla maç karesi (görüntüleri de silinir) */
export const GALLERY_CAP = 30;
/** Maç başına elle alınabilecek kare */
export const SNAPS_PER_MATCH = 6;
const STORE_KEY = 'nfs.photos.v1';

// ─────────────────────────── görüntü deposu ───────────────────────────
/** @type {Map<string,string>} */
const MEM = new Map();
let loaded = false;

function ls() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
function loadStore() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = ls()?.getItem(STORE_KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw))) MEM.set(k, String(v));
  } catch {
    /* bozuk depo: boş başla */
  }
}
function persist() {
  const store = ls();
  if (!store) return;
  for (let tries = 0; tries < 8; tries++) {
    try {
      store.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(MEM)));
      return;
    } catch {
      // kota doldu: en eski görüntüyü bellekte bırakıp depodan düş
      const first = MEM.keys().next().value;
      if (first == null) return;
      MEM.delete(first);
    }
  }
}

export const photoStore = {
  /** @param {string} id */
  get(id) {
    loadStore();
    return MEM.get(id) || null;
  },
  /** @param {string} id @param {string} dataURL */
  put(id, dataURL) {
    loadStore();
    if (!dataURL) return;
    MEM.set(id, dataURL);
    persist();
  },
  /** @param {string[]} ids */
  remove(ids) {
    loadStore();
    let changed = false;
    for (const id of ids) changed = MEM.delete(id) || changed;
    if (changed) persist();
  },
  size() {
    loadStore();
    return MEM.size;
  },
};

// ─────────────────────────── galeri (kayıtta künye) ───────────────────────────

/** Galeri (yeniden eskiye) */
export function galleryOf(state) {
  const ch = chirpOf(state);
  ch.gallery = ch.gallery || [];
  return ch.gallery;
}

const KIND_LABEL = { goal: 'Golün', assist: 'Asistin', celebration: 'Gol sevinci', team: 'Takımın golü', snap: 'Maçtan kare', fulltime: 'Maç sonu' };
export const frameLabel = (kind) => KIND_LABEL[kind] || 'Maçtan kare';

/**
 * Maç karesi ekler.
 * @param {any} state
 * @param {{kind:string, minute?:number, score?:string, opp?:string, oppId?:string, matchId?:string, comp?:string}} meta
 * @param {string|null} dataURL canlı yayından alınan görüntü (yoksa yalnızca künye)
 * @returns {object} galeri kaydı
 */
export function addFrame(state, meta, dataURL) {
  const ch = chirpOf(state);
  const g = galleryOf(state);
  ch.photoSeq = (ch.photoSeq || 0) + 1;
  const id = `f${state.calendar?.season || 1}_${state.calendar?.week || 1}_${ch.photoSeq}`;
  const rec = {
    id,
    t: 'frame',
    kind: meta.kind || 'snap',
    s: state.calendar?.season || 1,
    w: state.calendar?.week || 1,
    min: meta.minute ?? null,
    score: meta.score || '',
    opp: meta.opp || '',
    oppId: meta.oppId || null,
    matchId: meta.matchId || null,
    comp: meta.comp || '',
    img: !!dataURL,
    used: false,
  };
  g.unshift(rec);
  if (dataURL) photoStore.put(id, dataURL);
  // sınır: önce paylaşılmamış eski kareler gider
  if (g.length > GALLERY_CAP) {
    const drop = [];
    for (let i = g.length - 1; i >= 0 && g.length - drop.length > GALLERY_CAP; i--) if (!g[i].used) drop.push(g[i].id);
    while (g.length - drop.length > GALLERY_CAP) drop.push(g[g.length - 1 - drop.length]?.id);
    ch.gallery = g.filter((x) => !drop.includes(x.id));
    photoStore.remove(drop.filter(Boolean));
  }
  return rec;
}

/** Bu maçın kareleri (en iyisi önce: gol > asist > sevinç > takım golü > diğer) */
export function framesOfMatch(state, matchId) {
  const order = { goal: 0, assist: 1, celebration: 2, team: 3, fulltime: 4, snap: 5 };
  return galleryOf(state).filter((f) => f.matchId === matchId).sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
}

export const frameById = (state, id) => galleryOf(state).find((f) => f.id === id) || null;

/** Kareyi galeriden siler (paylaşılmışsa gönderide künyesiyle kalır) */
export function deleteFrame(state, id) {
  const ch = chirpOf(state);
  ch.gallery = galleryOf(state).filter((f) => f.id !== id);
  const usedInPost = (ch.timeline || []).some((t) => t.meta?.pic?.id === id);
  if (!usedInPost) photoStore.remove([id]);
}

// ─────────────────────────── yaşam fotoğrafları ───────────────────────────

/**
 * Paylaşılabilir yaşam fotoğrafları (durumuna göre: arabası olan arabasıyla, evi döşeli olan evinden…).
 * @returns {{scene:string, label:string, caption:string, icon:string}[]}
 */
export function lifestyleOptions(state) {
  const out = [
    { scene: 'selfie', label: 'Selfie', caption: 'Yeni haftaya hazırım 😎', icon: 'user' },
    { scene: 'training', label: 'Antrenman', caption: 'Çalışmaya devam 💪 #Antrenman', icon: 'run' },
    { scene: 'stadium', label: 'Stat', caption: 'Burası bizim evimiz 🏟️', icon: 'flag' },
    { scene: 'cafe', label: 'Kahve molası', caption: 'Kahve molası ☕', icon: 'coffee' },
  ];
  if (currentCarId(state)) out.push({ scene: 'car', label: 'Arabam', caption: 'Yeni yol arkadaşım 🚗', icon: 'car' });
  if ((state.social?.home?.placed || []).length >= 3) out.push({ scene: 'home', label: 'Evim', caption: 'Evde huzur 🏠', icon: 'home' });
  out.push({ scene: 'dinner', label: 'Akşam yemeği', caption: 'Güzel bir akşam 🍽️', icon: 'star' });
  const trophies = (state.career?.awards || []).filter((a) => a.icon === 'trophy').length;
  if (trophies) out.push({ scene: 'trophy', label: 'Kupalarım', caption: `Koleksiyon büyüyor 🏆 (${trophies})`, icon: 'trophy' });
  return out;
}

/** Fotoğrafın beğeni çarpanı (maç kareleri, özellikle gol anı, en çok etkileşimi alır) */
export function picLikeMult(pic) {
  if (!pic) return 1;
  if (pic.t === 'frame') return { goal: 2.1, assist: 1.7, celebration: 1.9, team: 1.4, fulltime: 1.3, snap: 1.35 }[pic.kind] || 1.35;
  return { trophy: 1.7, car: 1.45, stadium: 1.3, training: 1.25, selfie: 1.3 }[pic.scene] || 1.2;
}
