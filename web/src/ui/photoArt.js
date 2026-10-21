// FOTOĞRAF ÇİZİMİ — Chirp gönderilerindeki ve galerideki görseller.
//  • Maç kareleri: canlı yayından alınmış görüntü; yoksa künyeden çizilen saha kartı.
//  • Yaşam fotoğrafları: piksel sahnelerden o an çizilir (selfie, antrenman, stat, kahve, akşam yemeği, ev, araba, kupalar).
import { CLUB_BY_ID } from '../core/data.js';
import { photoStore } from '../core/chirp/index.js';
import { currentCarId } from '../core/garage.js';
import { playerLook } from '../core/cosmetics.js';
import { drawPixelPlayer, playerCanvas } from '../games/pixel/sprites.js';
import { drawScene, px, rng, shade } from './pixelScenes.js';
import { sceneOptsFor } from './sceneOpts.js';
import { CW, CH, drawCar } from './carCanvas.js';
import { carLook } from './screens/garage.js';
import { esc } from './dom.js';

/** Mantıksal fotoğraf boyutu (16:9) */
export const PW = 192;
export const PH = 108;

const imgCache = new Map();
function imageOf(id) {
  const url = photoStore.get(id);
  if (!url) return null;
  let im = imgCache.get(id);
  if (!im) {
    im = new Image();
    im.src = url;
    imgCache.set(id, im);
  }
  return im;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

const clubOf = (s) => CLUB_BY_ID[s.career?.clubId] || { colors: ['#2563eb', '#ffffff'], name: '' };

// ─────────────────────────── sahneler ───────────────────────────

/** Stat tribünü: kulüp renklerinde kalabalık */
function stands(g, s, seed, y0 = 0, h = 46) {
  const [c1, c2] = clubOf(s).colors;
  const r = rng(seed);
  px(g, 0, y0, PW, h, '#1e293b');
  for (let y = y0 + 2; y < y0 + h; y += 3) {
    for (let x = (y / 3) % 2; x < PW; x += 3) {
      const k = r();
      px(g, x, y, 2, 2, k < 0.45 ? c1 : k < 0.7 ? c2 : k < 0.85 ? '#f1f5f9' : shade('#334155', r() * 0.3));
    }
  }
  // tribün çatısı ve ışıklar
  px(g, 0, y0, PW, 2, '#0f172a');
  for (let x = 12; x < PW; x += 44) px(g, x, y0 + 1, 8, 2, '#fde68a');
}

function grass(g, y0) {
  for (let y = y0; y < PH; y++) px(g, 0, y, PW, 1, (Math.floor((y - y0) / 5) % 2) ? '#2f8f3c' : '#36a046');
  px(g, 0, y0, PW, 1, '#e5f7e9');
}

function selfie(g, s, seed) {
  stands(g, s, seed, 0, 62);
  grass(g, 62);
  // arka plan flu (ön plandaki yüz öne çıksın)
  g.fillStyle = 'rgba(15,23,42,.35)';
  g.fillRect(0, 0, PW, PH);
  const look = playerLook(s);
  const src = playerCanvas(look, 'down', 'idle');
  // yakın plan: kafa, omuzlar ve forma (ızgaranın üst 20 satırı), hafif eğik selfie açısı
  const rows = 20;
  const k = 4.6;
  const w = src.width * k;
  g.save();
  g.translate(PW / 2 + 4, 10);
  g.rotate(-0.05);
  g.drawImage(src, 0, 0, src.width, rows, -w / 2, 0, w, rows * k);
  g.restore();
  // telefon ekranı çerçevesi hissi: üstte ince parlama
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.fillRect(0, 0, PW, 3);
}

function training(g, s, seed) {
  // gökyüzü + antrenman tesisi
  for (let y = 0; y < 44; y++) px(g, 0, y, PW, 1, shade('#7dd3fc', -y / 90));
  px(g, 0, 32, PW, 12, '#94a3b8');
  for (let x = 4; x < PW; x += 22) px(g, x, 26, 14, 18, '#cbd5e1');
  grass(g, 44);
  const r = rng(seed);
  // dubalar
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 28 + r() * 6;
    const y = 74 + (i % 2) * 14;
    px(g, x, y, 5, 4, '#f97316');
    px(g, x + 1, y - 2, 3, 2, '#fb923c');
  }
  drawPixelPlayer(g, PW / 2, 96, 56, playerLook(s, { training: true }), { dir: 'down', frame: 'run0' });
  px(g, PW / 2 + 16, 92, 6, 6, '#f8fafc');
}

function stadium(g, s, seed) {
  stands(g, s, seed, 0, 52);
  grass(g, 52);
  // orta saha çizgisi ve daire
  g.strokeStyle = 'rgba(255,255,255,.75)';
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(PW / 2, 82, 34, 12, 0, 0, Math.PI * 2);
  g.stroke();
  px(g, PW / 2, 52, 1, PH - 52, 'rgba(255,255,255,.75)');
  drawPixelPlayer(g, PW / 2, 100, 50, playerLook(s), { dir: 'down', frame: 'ready' });
}

function trophy(g, s, seed) {
  for (let y = 0; y < PH; y++) px(g, 0, y, PW, 1, shade('#1f2937', -y / 300));
  // spot ışığı
  const grd = g.createRadialGradient(PW / 2, 30, 4, PW / 2, 60, 90);
  grd.addColorStop(0, 'rgba(253,230,138,.35)');
  grd.addColorStop(1, 'rgba(253,230,138,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, PW, PH);
  // raf
  px(g, 18, 62, PW - 36, 4, '#78350f');
  const n = Math.min(8, Math.max(1, (s.career?.awards || []).filter((a) => a.icon === 'trophy').length));
  for (let i = 0; i < n; i++) {
    const x = 30 + i * ((PW - 60) / Math.max(1, n - 1 || 1)) - 5;
    px(g, x, 46, 10, 9, '#facc15');
    px(g, x - 2, 47, 2, 5, '#eab308');
    px(g, x + 10, 47, 2, 5, '#eab308');
    px(g, x + 3, 55, 4, 4, '#ca8a04');
    px(g, x + 1, 59, 8, 3, '#a16207');
    px(g, x + 2, 47, 2, 6, '#fef08a');
  }
  drawPixelPlayer(g, PW / 2, 104, 40, playerLook(s), { dir: 'down', frame: 'cheer', shadow: false });
  void seed;
}

function fromScene(g, s, venue, palette) {
  const c = canvas(192, 120);
  const o = sceneOptsFor(s, venue, palette, null);
  drawScene(c.getContext('2d'), 0, o);
  g.drawImage(c, 0, 6, 192, 108, 0, 0, PW, PH);
}

function car(g, s, seed) {
  const id = currentCarId(s);
  if (!id) return stadium(g, s, seed);
  const c = canvas(CW, CH);
  drawCar(c.getContext('2d'), 0, carLook(s, id));
  g.drawImage(c, 0, 0, CW, CH, 0, (PH - CH) / 2, PW, CH);
  drawPixelPlayer(g, 30, PH - 8, 46, playerLook(s), { dir: 'down', frame: 'idle' });
}

const SCENES = {
  selfie,
  training,
  stadium,
  trophy,
  car,
  cafe: (g, s) => fromScene(g, s, 'cafe', 'bosphorus'),
  dinner: (g, s) => fromScene(g, s, 'bar', 'neon'),
  home: (g, s) => fromScene(g, s, 'home'),
};

/** Görüntüsü bulunamayan maç karesi: künyeden saha kartı */
function framePlaceholder(g, s, pic) {
  stands(g, s, (pic.min || 1) * 31 + (pic.w || 1), 0, 40);
  grass(g, 40);
  // kale ağı (sağda)
  for (let y = 46; y < 84; y += 3) px(g, 150, y, 30, 1, 'rgba(255,255,255,.6)');
  for (let x = 150; x < 181; x += 3) px(g, x, 46, 1, 38, 'rgba(255,255,255,.6)');
  px(g, 148, 44, 34, 2, '#f8fafc');
  px(g, 148, 44, 2, 42, '#f8fafc');
  // top ve oyuncu
  px(g, 162, 70, 5, 5, '#f8fafc');
  drawPixelPlayer(g, 92, 100, 52, playerLook(s), { dir: 'down', frame: pic.kind === 'goal' || pic.kind === 'celebration' ? 'ready' : 'run0' });
}

/**
 * Bir fotoğrafı tuvale çizer.
 * @param {HTMLCanvasElement} cv
 * @param {any} state
 * @param {{t:'frame', id:string, kind?:string}|{t:'scene', scene:string, seed?:number}} pic
 */
export function paintPic(cv, state, pic) {
  const W = 384;
  const H = 216;
  cv.width = W;
  cv.height = H;
  const out = cv.getContext('2d');
  if (pic?.t === 'frame') {
    const im = imageOf(pic.id);
    const drawImg = () => {
      out.imageSmoothingEnabled = true;
      const iw = im.naturalWidth || W;
      const ih = im.naturalHeight || H;
      const k = Math.max(W / iw, H / ih);
      out.drawImage(im, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
    };
    if (im) {
      if (im.complete && im.naturalWidth) { drawImg(); return; }
      im.addEventListener('load', drawImg, { once: true });
    }
  }
  const c = canvas(PW, PH);
  const g = c.getContext('2d');
  if (pic?.t === 'frame') framePlaceholder(g, state, pic);
  else (SCENES[pic?.scene] || selfie)(g, state, pic?.seed || 1);
  out.imageSmoothingEnabled = false;
  out.drawImage(c, 0, 0, W, H);
}

/** Kartlardaki tüm fotoğrafları çizer (data-pic) */
export function paintPics(root, state) {
  root?.querySelectorAll?.('canvas[data-pic]').forEach((cv) => {
    if (cv.dataset.done) return;
    let pic = null;
    try {
      pic = JSON.parse(cv.dataset.pic);
    } catch {
      /* boş */
    }
    paintPic(cv, state, pic);
    cv.dataset.done = '1';
  });
}

/** Fotoğrafın üstündeki etiket (maç karesinde dakika, skor, rakip) */
export function picBadge(pic) {
  if (!pic || pic.t !== 'frame') return '';
  const bits = [pic.min != null ? `${pic.min}'` : '', pic.score || '', pic.opp ? `vs ${pic.opp}` : ''].filter(Boolean);
  const ico = { goal: '⚽', assist: '🅰️', celebration: '🎉', team: '⚽', fulltime: '🏁', snap: '📸' }[pic.kind] || '📸';
  return bits.length ? `<span class="pic-badge">${ico} ${esc(bits.join(' · '))}</span>` : '';
}

/** Fotoğraf kutusu HTML'i */
export function picHTML(pic, { cls = '' } = {}) {
  if (!pic) return '';
  return `<div class="tw-pic ${cls}"><canvas data-pic="${esc(JSON.stringify(pic))}"></canvas>${picBadge(pic)}</div>`;
}
