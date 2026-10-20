// SERVET PİKSEL SANATI — senin sokağın: sahip olduğun işletmeler (kafe, spor salonu, krampon mağazası),
// mülkler (stüdyo, daire, rezidans, dükkân, villa) ve vakfın binası; boş arsada SATILIK tabelası.
// Akşam gökyüzü, yanan pencereler, yürüyen insanlar, geçen araba.
import { R, seedRng, shadeHex } from '../games/pixel/gymArt.js';
import { drawPixelText, pixelTextWidth } from '../games/pixel/font.js';

const WIN = '#fde68a';
const WIN_OFF = '#334155';

function windows(c, x, y, w, h, cols, rows, t, seed, lit = 0.6) {
  const r = seedRng(seed);
  const gx = Math.floor((w - 2) / cols);
  const gy = Math.floor((h - 2) / rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const on = r() < lit;
    const flick = on && r() < 0.05 && Math.sin(t * 3 + i + j * 7) > 0.6;
    R(c, x + 2 + i * gx, y + 2 + j * gy, Math.max(1, gx - 2), Math.max(1, gy - 2), on && !flick ? WIN : WIN_OFF);
  }
}

function sign(c, text, cx, y, bg, fg) {
  const w = pixelTextWidth(text) + 6;
  R(c, Math.round(cx - w / 2), y, w, 9, bg);
  R(c, Math.round(cx - w / 2), y + 8, w, 1, shadeHex(bg, -0.4));
  drawPixelText(c, text, cx, y + 2, fg, { align: 'center' });
}

/** Tek bina çizer; (x, base) sol alt köşe. @returns genişlik */
export function drawBuilding(c, kind, x, base, t, o = {}) {
  const seed = (o.seed || 1) + x;
  switch (kind) {
    case 'cafe': {
      const w = 30;
      R(c, x, base - 26, w, 26, '#7c4a26');
      R(c, x, base - 26, w, 2, '#5a3519');
      // tente (çizgili)
      for (let i = 0; i < w; i += 4) R(c, x + i, base - 16, 2, 4, i % 8 ? '#f5e6c8' : '#b45309');
      R(c, x, base - 12, w, 1, '#3a2210');
      R(c, x + 3, base - 11, 12, 11, '#fbd38d');
      R(c, x + 4, base - 10, 10, 9, '#f6ad55');
      R(c, x + 19, base - 11, 8, 11, '#3a2210');
      windows(c, x + 2, base - 24, w - 4, 8, 3, 1, t, seed, 0.8);
      sign(c, o.label || 'KAFE', x + w / 2, base - 36, '#1f1208', '#fbbf24');
      // dışarıda masa
      R(c, x + w + 1, base - 4, 4, 1, '#e5e7eb');
      R(c, x + w + 2, base - 3, 2, 3, '#9ca3af');
      return w + 6;
    }
    case 'gym': {
      const w = 34;
      R(c, x, base - 30, w, 30, '#1e293b');
      R(c, x, base - 30, w, 2, '#334155');
      R(c, x + 2, base - 20, w - 4, 18, '#7dd3fc');
      R(c, x + 2, base - 20, w - 4, 1, '#bae6fd');
      // içeride dambıl ve koşan siluet
      R(c, x + 6, base - 9, 8, 1, '#334155');
      R(c, x + 5, base - 11, 2, 5, '#0f172a');
      R(c, x + 13, base - 11, 2, 5, '#0f172a');
      const ph = Math.floor(t * 8) % 2;
      R(c, x + 23, base - 14, 2, 3, '#0f172a');
      R(c, x + 22 + ph, base - 11, 3, 4, '#0f172a');
      R(c, x + 18, base - 4, 12, 2, '#0f172a');
      sign(c, o.label || 'FİT', x + w / 2, base - 40, '#052e16', '#4ade80');
      return w + 3;
    }
    case 'boots': {
      const w = 34;
      R(c, x, base - 30, w, 30, '#2e1065');
      R(c, x, base - 30, w, 2, '#4c1d95');
      R(c, x + 3, base - 18, w - 6, 16, '#ede9fe');
      // vitrinde krampon
      R(c, x + 8, base - 9, 10, 3, '#7c3aed');
      R(c, x + 8, base - 6, 10, 1, '#111827');
      R(c, x + 14, base - 11, 4, 2, '#7c3aed');
      R(c, x + 20, base - 9, 8, 3, '#c6ff3d');
      R(c, x + 20, base - 6, 8, 1, '#111827');
      // dev krampon tabelası
      R(c, x + 6, base - 42, 22, 6, '#7c3aed');
      R(c, x + 6, base - 36, 22, 2, '#111827');
      R(c, x + 20, base - 45, 8, 3, '#7c3aed');
      R(c, x + 9, base - 40, 10, 1, '#c6ff3d');
      if (o.label) drawPixelText(c, o.label, x + w / 2, base - 27, '#c4b5fd', { align: 'center' });
      return w + 3;
    }
    case 'small': {
      const w = 20;
      R(c, x, base - 24, w, 24, o.color || '#9a6b4f');
      R(c, x - 1, base - 26, w + 2, 2, shadeHex(o.color || '#9a6b4f', -0.35));
      windows(c, x + 1, base - 22, w - 2, 14, 2, 2, t, seed, 0.6);
      R(c, x + 7, base - 7, 6, 7, '#3f2a1d');
      return w + 3;
    }
    case 'mid': {
      const w = 26;
      R(c, x, base - 44, w, 44, o.color || '#64748b');
      R(c, x - 1, base - 46, w + 2, 2, shadeHex(o.color || '#64748b', -0.35));
      windows(c, x + 1, base - 42, w - 2, 34, 3, 5, t, seed, 0.55);
      R(c, x + 10, base - 8, 6, 8, '#1f2937');
      return w + 3;
    }
    case 'tower': {
      const w = 26;
      R(c, x, base - 66, w, 66, o.color || '#334155');
      R(c, x + 2, base - 70, w - 4, 4, shadeHex(o.color || '#334155', -0.3));
      R(c, x + Math.round(w / 2), base - 76, 1, 6, '#94a3b8');
      if (Math.floor(t * 2) % 2) R(c, x + Math.round(w / 2), base - 77, 1, 1, '#ef4444');
      windows(c, x + 1, base - 64, w - 2, 54, 4, 9, t, seed, 0.5);
      R(c, x + 8, base - 9, 10, 9, '#0f172a');
      R(c, x + 8, base - 9, 10, 1, '#94a3b8');
      return w + 3;
    }
    case 'shop': {
      const w = 24;
      R(c, x, base - 22, w, 22, o.color || '#a16207');
      R(c, x, base - 22, w, 2, shadeHex(o.color || '#a16207', -0.35));
      R(c, x + 2, base - 15, w - 4, 15, o.tenant ? '#fef3c7' : '#4b5563');
      if (!o.tenant) for (let y = base - 14; y < base; y += 2) R(c, x + 2, y, w - 4, 1, '#374151'); // kepenk
      if (o.tenant) sign(c, o.tenant.slice(0, 6).toLocaleUpperCase('tr'), x + w / 2, base - 21, '#0f172a', '#fbbf24');
      return w + 3;
    }
    case 'villa': {
      const w = 36;
      R(c, x - 2, base - 3, w + 6, 3, '#3f8f3a');
      R(c, x + 2, base - 20, w - 4, 18, '#f1f5f9');
      for (let i = 0; i < 10; i++) R(c, x + i * 2, base - 20 - i, w - i * 4, 1, '#b91c1c'); // çatı
      R(c, x + 6, base - 14, 6, 5, WIN);
      R(c, x + w - 12, base - 14, 6, 5, WIN);
      R(c, x + 15, base - 10, 6, 8, '#7c2d12');
      R(c, x - 1, base - 9, 3, 6, '#166534');
      R(c, x + w - 1, base - 11, 3, 8, '#166534');
      return w + 5;
    }
    case 'foundation': {
      const w = 34;
      R(c, x, base - 28, w, 28, '#f8fafc');
      R(c, x, base - 28, w, 2, '#cbd5e1');
      windows(c, x + 1, base - 26, w - 2, 12, 4, 1, t, seed, 0.9);
      R(c, x + 13, base - 10, 8, 10, '#1d4ed8');
      // kalp tabelası
      const hx = x + w / 2 - 4;
      const hy = base - 38;
      R(c, hx + 1, hy, 2, 2, '#ef4444'); R(c, hx + 5, hy, 2, 2, '#ef4444');
      R(c, hx, hy + 1, 8, 3, '#ef4444'); R(c, hx + 1, hy + 4, 6, 1, '#ef4444'); R(c, hx + 2, hy + 5, 4, 1, '#ef4444'); R(c, hx + 3, hy + 6, 2, 1, '#ef4444');
      if (o.label) drawPixelText(c, o.label, x + w / 2, base - 20, '#1e3a8a', { align: 'center' });
      // önünde top oynayan çocuklar
      const k = Math.floor(t * 4) % 2;
      R(c, x + w + 2, base - 5, 2, 5, '#f97316'); R(c, x + w + 2, base - 7, 2, 2, '#e8b58f');
      R(c, x + w + 9, base - 5, 2, 5, '#22c55e'); R(c, x + w + 9, base - 7, 2, 2, '#c98d62');
      R(c, x + w + 5 + k * 2, base - 2, 2, 2, '#f8fafc');
      return w + 14;
    }
    default: {
      // boş arsa: SATILIK
      const w = 22;
      R(c, x, base - 2, w, 2, '#57534e');
      R(c, x + 10, base - 18, 1, 16, '#78716c');
      sign(c, 'SATILIK', x + 10, base - 26, '#b91c1c', '#fff');
      return w + 3;
    }
  }
}

/** Sokak sahnesi: assets [{kind, label, color, tenant}] */
export function drawStreet(c, W, H, t, assets) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1e1b4b');
  g.addColorStop(0.55, '#7c3aed');
  g.addColorStop(1, '#f59e0b');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  R(c, W - 30, 10, 8, 8, '#fef3c7');
  R(c, W - 31, 11, 10, 6, '#fef3c7');
  const r = seedRng(21);
  for (let i = 0; i < 18; i++) R(c, r() * W, r() * 26, 1, 1, '#e9d5ff');
  // uzak silüet
  for (let x = 0; x < W; x += 6 + Math.floor(r() * 7)) {
    const h = 18 + Math.floor(r() * 30);
    R(c, x, H - 16 - h, 6 + Math.floor(r() * 8), h, '#3b2a6b');
  }
  const base = H - 14;
  // kaldırım + yol
  R(c, 0, base, W, 3, '#6b7280');
  R(c, 0, base + 3, W, H - base - 3, '#27272a');
  for (let x = ((-t * 20) % 14) - 14; x < W; x += 14) R(c, Math.round(x), base + 7, 7, 1, '#fafafa66');
  let x = 4;
  for (const a of assets) {
    if (x > W - 20) break;
    x += drawBuilding(c, a.kind, x, base, t, a);
  }
  if (x < W - 26) drawBuilding(c, 'empty', x + 2, base, t);
  // yürüyen insanlar
  for (let i = 0; i < 3; i++) {
    const px = ((t * (8 + i * 3) + i * 70) % (W + 20)) - 10;
    const step = Math.floor(t * 6 + i) % 2;
    R(c, px, base - 6, 2, 4, ['#ef4444', '#22c55e', '#38bdf8'][i]);
    R(c, px, base - 8, 2, 2, '#e8b58f');
    R(c, px - step, base - 2, 1, 2, '#1f2937');
    R(c, px + 1 + step, base - 2, 1, 2, '#1f2937');
  }
  // araba
  const cx = W + 30 - ((t * 34) % (W + 60));
  R(c, cx, base + 2, 18, 4, '#0ea5e9');
  R(c, cx + 3, base, 10, 3, '#0369a1');
  R(c, cx + 4, base + 1, 3, 1, '#bae6fd');
  R(c, cx + 9, base + 1, 3, 1, '#bae6fd');
  R(c, cx + 2, base + 6, 3, 2, '#111827');
  R(c, cx + 13, base + 6, 3, 2, '#111827');
  R(c, cx, base + 3, 1, 1, '#fde68a');
}
