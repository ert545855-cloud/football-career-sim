// PİKSEL SPRITE ÇİZİCİ — playerPixels ızgaralarını tuvale (önbellekli) çevirir ve keskin (bulanıksız) çizer.
import { buildBall, dirFromVelocity, runFrame } from './playerPixels.js';
import { buildPlayerTall, TW, TH } from './playerTall.js';

export { dirFromVelocity, runFrame };

/** Gerçekçi oranlı oyuncular eski chibi boyuna göre biraz daha uzun çizilir (ince gövde, küçük kafa). */
export const SPRITE_SCALE = 1.12;
export const SPRITE_W = TW;
export const SPRITE_H = TH;

const cache = new Map();
const MAX = 600;

function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function gridCanvas(grid) {
  const c = document.createElement('canvas');
  c.width = grid.w;
  c.height = grid.h;
  const x = c.getContext('2d');
  const img = x.createImageData(grid.w, grid.h);
  grid.px.forEach((col, i) => {
    if (!col) return;
    const [r, g, b] = hexToRgb(col);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  });
  x.putImageData(img, 0, 0);
  return c;
}

function cached(key, make) {
  let c = cache.get(key);
  if (!c) {
    if (cache.size > MAX) cache.clear();
    c = gridCanvas(make());
    cache.set(key, c);
  }
  return c;
}

const lookKey = (L) => JSON.stringify(L);

export function playerCanvas(look, dir = 'down', frame = 'idle') {
  return cached(`t|${lookKey(look)}|${dir}|${frame}`, () => buildPlayerTall(look, dir, frame));
}

/** Cihaz piksellerine oturan ölçek: pikseller eşit boyda görünsün. */
export function crispScale(ctx, s) {
  const dpr = Math.abs(ctx.getTransform?.().a || 1);
  return Math.max(1, Math.round(s * dpr)) / dpr;
}

/**
 * Oyuncu çizer; (x, y) ayakların değdiği nokta. h: istenen boy (CSS piksel).
 * o.marker: başın üstünde piksel ok (kontrol ettiğin oyuncu). o.ring: ayak altında takım halkası.
 */
export function drawPixelPlayer(ctx, x, y, h, look, o = {}) {
  const { dir = 'down', frame = 'idle', flip = false, alpha = 1, shadow = true, ring = null, marker = null, rot = 0, lift = 0, label = null } = o;
  const s = crispScale(ctx, (h * SPRITE_SCALE) / TH);
  const w = TW * s;
  const hh = TH * s;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath();
    ctx.ellipse(x + s, y - s * 0.5, w * 0.46, s * 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ring) {
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(1.5, s * 0.9);
    ctx.globalAlpha = alpha * 0.85;
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.5, w * 0.6, s * 2.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
  ctx.translate(x, y - lift);
  if (rot) ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  // ızgaranın son satırı (dış hat) ayak hizası
  ctx.drawImage(playerCanvas(look, dir, frame), -w / 2, -hh + s * 0.5, w, hh);
  ctx.restore();
  if (marker) {
    // piksel ok ▼
    const ax = x;
    const ay = y - lift - hh - s * 1.5;
    const u = Math.max(1.5, s);
    ctx.save();
    ctx.globalAlpha = alpha;
    const rowsO = [9, 9, 7, 5, 3, 1];
    const rowsC = [7, 5, 3, 1];
    ctx.fillStyle = '#14110f';
    rowsO.forEach((n, r) => ctx.fillRect(ax - (n / 2) * u, ay + (r - 2) * u, n * u, u));
    ctx.fillStyle = marker;
    rowsC.forEach((n, r) => ctx.fillRect(ax - (n / 2) * u, ay + (r - 1) * u, n * u, u));
    ctx.restore();
  }
  if (label) {
    ctx.save();
    ctx.font = `800 ${Math.max(9, s * 4.2)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const ly = y - lift - hh - (marker ? s * 7 : s * 1.5);
    ctx.strokeText(label, x, ly);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x, ly);
    ctx.restore();
  }
}

/** Hareketli oyuncu: hız vektöründen yön + koşu karesi seçer. state: {dir, ph} saklar. */
export function drawMovingPlayer(ctx, x, y, h, look, vx, vy, st, o = {}) {
  const sp = Math.hypot(vx, vy);
  const d = dirFromVelocity(vx, vy, st.last || o.face || 'down');
  if (sp >= 0.25) st.last = d.dir === 'side' ? (d.flip ? 'left' : 'right') : d.dir;
  const face = o.face && sp < 0.25 ? o.face : null;
  const dir = face ? (face === 'left' || face === 'right' ? 'side' : face) : d.dir;
  const flip = face ? face === 'left' : d.flip;
  drawPixelPlayer(ctx, x, y, h, look, { ...o, dir, flip, frame: o.frame || runFrame(st.ph || 0, sp) });
}

let BALL_VARIANT = 'white';
/** Top rengi (karlı maçta turuncu top). Mini oyun katmanı oyun başında ayarlar, sonunda sıfırlar. */
export function setBallVariant(v = 'white') { BALL_VARIANT = v || 'white'; }

export function drawPixelBall(ctx, x, y, size, rot = 0, { shadow = true, lift = 0, variant = null } = {}) {
  const frame = Math.floor(Math.abs(rot) * 1.6) % 2;
  const v = variant || BALL_VARIANT;
  const c = cached(`b|${frame}|${v}`, () => buildBall(frame, v));
  const s = crispScale(ctx, size / 9);
  const w = 9 * s;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(x + lift * 0.25, y + w * 0.4, w * 0.45 * Math.max(0.4, 1 - lift / 80), w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, Math.round(x - w / 2), Math.round(y - lift - w / 2), w, w);
  ctx.restore();
}
