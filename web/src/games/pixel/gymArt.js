// SPOR SALONU PİKSEL SANATI — duvar, ayna, kauçuk zemin, squat kafesi, plaka ağacı, dambıl rafı,
// koşu bandı (yandan), sehpa, yoga minderi, su sebili, posterler. Hepsi mantıksal pikselle çizilir
// (düşük çözünürlüklü tuvale), sonra ekranda keskin büyütülür.
import { drawPixelText } from './font.js';

export function shadeHex(hex, f) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = f < 0 ? 0 : 255;
  const p = Math.abs(f);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export const R = (c, x, y, w, h, col) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Tekrarlanabilir rastgele (dekor sabit kalsın) */
export function seedRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Düşük çözünürlüklü tuval: hedef boyuta göre piksel birimi (u) seçer.
 * @returns {{c:CanvasRenderingContext2D, LW:number, LH:number, u:number, blit:(ctx:CanvasRenderingContext2D)=>void}}
 */
export function lowRes(state, W, H, cols = 132) {
  const u = Math.max(2, Math.min(6, Math.round(W / cols)));
  const LW = Math.ceil(W / u);
  const LH = Math.ceil(H / u);
  if (!state.off || state.off.width !== LW || state.off.height !== LH) {
    state.off = document.createElement('canvas');
    state.off.width = LW;
    state.off.height = LH;
    state.offCtx = state.off.getContext('2d');
  }
  const c = state.offCtx;
  c.imageSmoothingEnabled = false;
  return {
    c, LW, LH, u,
    blit(ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(state.off, 0, 0, LW * u, LH * u);
    },
  };
}

// ─────────────────────────── oda ───────────────────────────
/** Arka duvar + ayna + tavan lambaları + kauçuk zemin. floorY: zeminin başladığı satır */
export function drawGymRoom(c, LW, LH, t, { floorY = Math.round(LH * 0.62), sign = 'SPOR SALONU', accent = '#c6ff3d', mirror = true, window: win = true } = {}) {
  // duvar
  R(c, 0, 0, LW, floorY, '#262c3a');
  for (let x = 0; x < LW; x += 18) R(c, x, 0, 1, floorY, '#21263273');
  R(c, 0, 0, LW, 6, '#151923');
  // tavan lambaları
  for (let x = 10; x < LW; x += 46) {
    R(c, x, 6, 22, 2, '#e8edf5');
    R(c, x + 1, 8, 20, 1, '#9aa6b8');
    const g = c.createRadialGradient(x + 11, 9, 1, x + 11, 9, 30);
    g.addColorStop(0, 'rgba(255,255,240,0.18)');
    g.addColorStop(1, 'rgba(255,255,240,0)');
    c.fillStyle = g;
    c.fillRect(x - 20, 8, 62, 40);
  }
  // pencere (şehir manzarası)
  if (win) {
    const wx = Math.round(LW * 0.04);
    const wy = 12;
    const ww = Math.round(LW * 0.24);
    const wh = Math.round(floorY * 0.34);
    R(c, wx - 1, wy - 1, ww + 2, wh + 2, '#11151d');
    const sky = c.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#5b8fd6');
    sky.addColorStop(1, '#b9d6f2');
    c.fillStyle = sky;
    c.fillRect(wx, wy, ww, wh);
    const r = seedRng(7);
    for (let x = wx; x < wx + ww; x += 4 + Math.floor(r() * 4)) {
      const bh = 6 + Math.floor(r() * wh * 0.6);
      const bw = 3 + Math.floor(r() * 4);
      R(c, x, wy + wh - bh, bw, bh, r() < 0.5 ? '#5c6f8f' : '#6e82a3');
      for (let yy = wy + wh - bh + 2; yy < wy + wh - 1; yy += 3) if (r() < 0.6) R(c, x + 1, yy, 1, 1, '#f8e7a1');
    }
    R(c, wx + Math.round(ww / 2), wy, 1, wh, '#11151d');
    R(c, wx, wy + Math.round(wh / 2), ww, 1, '#11151d88');
  }
  // ayna şeridi
  if (mirror) {
    const my = Math.round(floorY * 0.42);
    const mh = Math.round(floorY * 0.5);
    const mx0 = Math.round(LW * 0.32);
    R(c, mx0 - 1, my - 1, LW - mx0 + 2, mh + 2, '#9aa6b8');
    const mg = c.createLinearGradient(mx0, my, LW, my + mh);
    mg.addColorStop(0, '#5f6d84');
    mg.addColorStop(0.5, '#7b8aa3');
    mg.addColorStop(1, '#55627a');
    c.fillStyle = mg;
    c.fillRect(mx0, my, LW - mx0, mh);
    // parlama çizgileri
    c.fillStyle = 'rgba(255,255,255,0.16)';
    for (let k = 0; k < 4; k++) {
      const gx = mx0 + 10 + k * 34 + ((t * 6) % 34);
      for (let i = 0; i < mh; i++) c.fillRect(Math.round(gx + i * 0.5), my + i, 2, 1);
    }
    for (let x = mx0 + 40; x < LW; x += 40) R(c, x, my, 1, mh, '#4b566b');
  }
  // tabela
  if (sign) {
    const sx = Math.round(LW * 0.66);
    const w = sign.length * 4 + 7;
    R(c, sx - Math.round(w / 2), 12, w, 11, '#0f131b');
    R(c, sx - Math.round(w / 2), 22, w, 1, accent);
    drawPixelText(c, sign, sx, 15, accent, { align: 'center' });
  }
  // süpürgelik + zemin
  R(c, 0, floorY - 2, LW, 2, '#131720');
  R(c, 0, floorY, LW, LH - floorY, '#1b1f28');
  const r2 = seedRng(3);
  for (let y = floorY + 1; y < LH; y += 10) R(c, 0, y, LW, 1, '#232835');
  for (let y = floorY; y < LH; y += 10) for (let x = ((y / 10) % 2) * 10; x < LW; x += 20) R(c, x, y, 1, 10, '#232835');
  for (let i = 0; i < LW * 0.6; i++) R(c, r2() * LW, floorY + r2() * (LH - floorY), 1, 1, r2() < 0.5 ? '#2a3040' : '#161a22');
}

// ─────────────────────────── ekipman ───────────────────────────
/** Squat kafesi (önden): iki dikme, delikler, kancalar, güvenlik kolları */
export function drawSquatRack(c, cx, floorY, { half = 34, h = 74, hookY = null } = {}) {
  const top = floorY - h;
  for (const sx of [cx - half - 3, cx + half - 2]) {
    R(c, sx, top, 5, h, '#2f3542');
    R(c, sx, top, 1, h, '#4a5265');
    R(c, sx + 4, top, 1, h, '#1d212a');
    for (let y = top + 4; y < floorY - 4; y += 4) R(c, sx + 2, y, 1, 1, '#11141a');
    R(c, sx - 3, floorY - 2, 11, 2, '#1d212a');
  }
  R(c, cx - half - 3, top, half * 2 + 6, 4, '#2f3542');
  R(c, cx - half - 3, top, half * 2 + 6, 1, '#4a5265');
  // kancalar
  const hy = hookY ?? top + 22;
  R(c, cx - half - 6, hy, 4, 2, '#c0c7d2');
  R(c, cx + half + 2, hy, 4, 2, '#c0c7d2');
  // güvenlik kolları
  R(c, cx - half - 6, floorY - 22, 4, 2, '#d33f49');
  R(c, cx + half + 2, floorY - 22, 4, 2, '#d33f49');
  // kaldırma platformu
  R(c, cx - half - 10, floorY - 1, half * 2 + 20, 4, '#5b3b22');
  R(c, cx - half - 10, floorY - 1, half * 2 + 20, 1, '#7a5230');
  R(c, cx - 14, floorY - 1, 28, 4, '#24282f');
}

const PLATE_COLS = ['#d33f49', '#2f6fd6', '#e8c13a', '#3a9f52', '#e5e7eb'];
/** Bar + plakalar (önden). kg plaka sayısını belirler */
export function drawBarbell(c, cx, y, kg = 60, { half = 40, bend = 0 } = {}) {
  // bar
  for (let x = -half; x <= half; x++) {
    const yy = Math.round(y + (bend * (x * x)) / (half * half));
    R(c, cx + x, yy, 1, 2, x > -6 && x < 6 ? '#8d96a6' : '#c3cad6');
  }
  const n = Math.max(1, Math.min(5, Math.floor((kg - 20) / 20)));
  for (const side of [-1, 1]) {
    let px = cx + side * (half - 12);
    for (let i = 0; i < n; i++) {
      const ph = 16 - i * 1.6;
      const col = PLATE_COLS[i % PLATE_COLS.length];
      const yy = Math.round(y + 1 + bend - ph / 2);
      R(c, px - (side < 0 ? 2 : 0), yy, 3, Math.round(ph), col);
      R(c, px - (side < 0 ? 2 : 0), yy, 1, Math.round(ph), shadeHex(col, 0.3));
      R(c, px - (side < 0 ? 2 : 0) + 2, yy, 1, Math.round(ph), shadeHex(col, -0.35));
      px += side * 3;
    }
    R(c, px - (side < 0 ? 1 : 0), Math.round(y - 1 + bend), 2, 4, '#e2e6ec'); // kelepçe
  }
}

/** Plaka ağacı */
export function drawPlateTree(c, x, floorY) {
  R(c, x + 6, floorY - 30, 2, 30, '#2f3542');
  R(c, x, floorY - 2, 14, 2, '#1d212a');
  for (let i = 0; i < 4; i++) {
    const col = PLATE_COLS[i];
    const py = floorY - 6 - i * 7;
    R(c, x + 1, py - 4, 3, 9, col);
    R(c, x + 10, py - 4, 3, 9, col);
    R(c, x + 4, py, 6, 1, '#4a5265');
  }
}

/** Dambıl rafı: iki katlı, boyları artan çiftler */
export function drawDumbbellRack(c, x, floorY, w = 70, { empty = -1 } = {}) {
  const h = 22;
  const top = floorY - h;
  R(c, x, top + 6, w, 2, '#3a4150');
  R(c, x, top + 15, w, 2, '#3a4150');
  for (const lx of [x + 1, x + w - 3]) R(c, lx, top + 6, 2, h - 6, '#2a2f3a');
  const n = Math.floor((w - 6) / 8);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < n; i++) {
      if (row * n + i === empty) continue;
      const dx = x + 4 + i * 8;
      const dy = top + (row ? 11 : 2);
      const s = 2 + Math.floor(((row * n + i) / (n * 2)) * 3);
      R(c, dx, dy + 2, 6, 1, '#9aa3b2');
      R(c, dx, dy + 2 - Math.floor(s / 2), 2, s + 1, '#20242c');
      R(c, dx + 4, dy + 2 - Math.floor(s / 2), 2, s + 1, '#20242c');
    }
  }
}

/** Ağırlık sehpası (yandan) */
export function drawBench(c, x, floorY, w = 30) {
  R(c, x, floorY - 9, w, 4, '#1f2430');
  R(c, x, floorY - 9, w, 1, '#3a4358');
  R(c, x + 3, floorY - 5, 2, 5, '#4a5265');
  R(c, x + w - 5, floorY - 5, 2, 5, '#4a5265');
  R(c, x + 1, floorY - 1, 6, 1, '#2a2f3a');
  R(c, x + w - 7, floorY - 1, 6, 1, '#2a2f3a');
}

/** Yoga minderi + köpük rulo */
export function drawMat(c, x, floorY, w = 28) {
  R(c, x, floorY - 2, w, 3, '#7c3aed');
  R(c, x, floorY - 2, w, 1, '#a78bfa');
  R(c, x + w + 2, floorY - 5, 10, 5, '#0ea5e9');
  R(c, x + w + 2, floorY - 5, 10, 1, '#7dd3fc');
  for (let i = 0; i < 4; i++) R(c, x + w + 3 + i * 2, floorY - 4, 1, 3, '#0369a1');
}

/** Su sebili */
export function drawWaterCooler(c, x, floorY) {
  R(c, x + 1, floorY - 26, 8, 9, '#7dd3fc');
  R(c, x + 2, floorY - 25, 2, 7, '#bae6fd');
  R(c, x, floorY - 17, 10, 17, '#e5e7eb');
  R(c, x, floorY - 17, 10, 1, '#f8fafc');
  R(c, x + 3, floorY - 12, 2, 2, '#ef4444');
  R(c, x + 6, floorY - 12, 2, 2, '#3b82f6');
}

/** Poster: ünlü olmayan kurgusal motivasyon afişi */
export function drawPoster(c, x, y, text, col = '#c6ff3d') {
  R(c, x, y, 22, 28, '#0f131b');
  R(c, x + 1, y + 1, 20, 26, '#1a2030');
  // kol kası silueti
  R(c, x + 6, y + 6, 10, 4, col);
  R(c, x + 4, y + 8, 4, 6, col);
  R(c, x + 14, y + 8, 4, 6, col);
  R(c, x + 8, y + 10, 6, 6, shadeHex(col, -0.3));
  drawPixelText(c, text, x + 11, y + 19, '#e5e7eb', { align: 'center' });
}

/**
 * Koşu bandı (yandan, koşucu sağa bakar). x0: arka silindir, len: bant uzunluğu, deckY: bant yüzeyi.
 * phase: bant çizgilerinin kayması (piksel). screen: konsol ekranı yazısı
 */
export function drawTreadmill(c, x0, deckY, len, phase = 0, { screen = '', screen2 = '', zone = null, warn = false, ch = 38 } = {}) {
  // gövde
  R(c, x0 - 4, deckY + 1, len + 10, 6, '#20242d');
  R(c, x0 - 4, deckY + 1, len + 10, 1, '#3a4150');
  R(c, x0 - 6, deckY - 1, 6, 8, '#2a2f3a'); // arka silindir kapağı
  R(c, x0 + len, deckY - 2, 10, 9, '#2a2f3a'); // motor kapağı
  R(c, x0 + len + 1, deckY - 2, 8, 1, '#4a5265');
  // bant
  R(c, x0, deckY - 1, len, 2, '#11141a');
  for (let x = Math.round(-((phase % 8) + 8)); x < len; x += 8) if (x >= 0) R(c, x0 + x, deckY - 1, 3, 1, '#2d3340');
  if (zone) {
    c.fillStyle = 'rgba(74,222,128,0.35)';
    c.fillRect(Math.round(zone[0]), deckY - 2, Math.round(zone[1] - zone[0]), 1);
  }
  if (warn) R(c, x0, deckY - 2, 6, 1, '#ef4444');
  // ayaklar
  R(c, x0 - 3, deckY + 7, 4, 3, '#151820');
  R(c, x0 + len + 3, deckY + 7, 4, 3, '#151820');
  // dikme + konsol
  const px = x0 + len + 4;
  const post = ch - 12;
  for (let i = 0; i < post; i++) R(c, px - Math.floor(i / 6), deckY - 2 - i, 3, 1, i % 6 ? '#2f3542' : '#3a4150');
  const cx = px - 8 - Math.floor(post / 6) + 4;
  const cy = deckY - ch;
  R(c, cx - 14, cy, 26, 13, '#1d212a');
  R(c, cx - 14, cy, 26, 1, '#4a5265');
  R(c, cx - 12, cy + 2, 22, 9, '#0b1a12');
  if (screen) drawPixelText(c, screen, cx - 1, cy + 3, '#4ade80', { align: 'center' });
  if (screen2) R(c, cx - 11, cy + 9, Math.max(1, Math.min(20, Math.round(Number(screen2) || 0))), 1, '#ef4444');
  // kollar (tutunma)
  R(c, x0 + Math.round(len * 0.45), cy + 10, Math.round(len * 0.55) - 2, 2, '#3a4150');
  R(c, x0 + Math.round(len * 0.45), cy + 10, 2, 5, '#3a4150');
}
