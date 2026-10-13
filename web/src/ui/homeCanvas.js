// EV PLANI ÇİZİMİ — kuşbakışı piksel oda: zemin, duvarlar, pencere ve mobilyalar.
// Hücre 16 mantıksal piksel; tuval CSS ile keskin büyütülür (image-rendering: pixelated).
import { FURNITURE_BY_ID, dims, layerOf } from '../core/social/home.js';
import { disc, glow, px as R, rng, shade, vgrad } from './pixelScenes.js';

export const CELL = 16;
export const SIDE = 6; // yan duvar kalınlığı
export const TOP = 22; // üst duvar (yüzü görünür: tablolar buraya asılır)
export const BOTTOM = 6;

export const roomSize = (plan) => ({ w: plan.w * CELL + SIDE * 2, h: TOP + plan.h * CELL + BOTTOM });

/** Tuval koordinatından hücre (duvara dokunuş y = -1) */
export function cellAt(plan, x, y) {
  const cx = Math.floor((x - SIDE) / CELL);
  if (cx < 0 || cx >= plan.w) return null;
  if (y < TOP && y >= 2) return { x: cx, y: -1 };
  const cy = Math.floor((y - TOP) / CELL);
  if (cy < 0 || cy >= plan.h) return null;
  return { x: cx, y: cy };
}

// ─────────────────────────── zemin ───────────────────────────
function drawFloor(c, plan, floor) {
  const W = plan.w * CELL;
  const H = plan.h * CELL;
  const ox = SIDE;
  const oy = TOP;
  const r = rng(plan.w * 31 + plan.h);
  if (floor === 'marble') {
    R(c, ox, oy, W, H, '#e7e5e4');
    for (let y = 0; y < plan.h; y++) {
      for (let x = 0; x < plan.w; x++) {
        R(c, ox + x * CELL, oy + y * CELL, CELL, CELL, (x + y) % 2 ? '#e7e5e4' : '#f5f5f4');
        for (let k = 0; k < 4; k++) R(c, ox + x * CELL + Math.floor(r() * 14) + 1, oy + y * CELL + Math.floor(r() * 14) + 1, 2, 1, '#d6d3d1');
      }
    }
    for (let x = 0; x <= plan.w; x++) R(c, ox + x * CELL, oy, 1, H, 'rgba(120,113,108,.25)');
    for (let y = 0; y <= plan.h; y++) R(c, ox, oy + y * CELL, W, 1, 'rgba(120,113,108,.25)');
  } else if (floor === 'carpet') {
    R(c, ox, oy, W, H, '#64748b');
    for (let i = 0; i < W * H * 0.04; i++) R(c, ox + Math.floor(r() * W), oy + Math.floor(r() * H), 1, 1, r() > 0.5 ? '#71809a' : '#566477');
  } else if (floor === 'parquet') {
    for (let y = 0; y < H; y += 8) {
      for (let x = 0; x < W; x += 8) {
        const horiz = ((x + y) / 8) % 2 === 0;
        const base = horiz ? '#b7794a' : '#a86b3e';
        R(c, ox + x, oy + y, 8, 8, base);
        if (horiz) R(c, ox + x, oy + y + 4, 8, 1, '#8c5530');
        else R(c, ox + x + 4, oy + y, 1, 8, '#8c5530');
      }
    }
  } else {
    // ahşap: yatay döşeme tahtaları
    for (let y = 0; y < H; y += 4) {
      const row = y / 4;
      R(c, ox, oy + y, W, 4, row % 2 ? '#a0673d' : '#b0744a');
      R(c, ox, oy + y + 3, W, 1, '#7c4a2a');
      const off = (row * 11) % 24;
      for (let x = off; x < W; x += 24 + (row % 3) * 4) R(c, ox + x, oy + y, 1, 3, '#7c4a2a');
    }
  }
}

// ─────────────────────────── duvarlar ───────────────────────────
function drawWalls(c, plan, wallColor, t, view) {
  const { w: CW, h: CH } = roomSize(plan);
  // üst duvarın yüzü
  vgrad(c, SIDE, 0, CW - SIDE * 2, TOP, [[0, shade(wallColor, -0.12)], [1, shade(wallColor, 0.04)]]);
  R(c, SIDE, TOP - 3, CW - SIDE * 2, 3, shade(wallColor, -0.35)); // süpürgelik
  // pencereler (her 4 hücrede bir)
  for (let x = 1; x < plan.w - 1; x += 4) {
    const wx = SIDE + x * CELL + 2;
    R(c, wx, 3, CELL * 2 - 4, 13, '#1f2937');
    if (view === 'sea') {
      vgrad(c, wx + 1, 4, CELL * 2 - 6, 6, [[0, '#fdba74'], [1, '#f9a8d4']]);
      vgrad(c, wx + 1, 10, CELL * 2 - 6, 5, [[0, '#2563eb'], [1, '#1e3a8a']]);
      if (Math.sin(t * 3 + x) > 0.3) R(c, wx + 6 + (x % 3) * 4, 12, 2, 1, '#fde68a');
    } else {
      vgrad(c, wx + 1, 4, CELL * 2 - 6, 11, [[0, '#7dd3fc'], [1, '#bae6fd']]);
      R(c, wx + 3, 10, 5, 5, '#94a3b8');
      R(c, wx + 10, 8, 6, 7, '#64748b');
      R(c, wx + 18, 11, 6, 4, '#94a3b8');
    }
    R(c, wx + CELL - 3, 3, 2, 13, '#1f2937');
    R(c, wx - 1, 16, CELL * 2 - 2, 1, '#e5e7eb');
  }
  // yan ve alt duvar (kesit)
  const edge = shade(wallColor, -0.45);
  R(c, 0, 0, SIDE, CH, edge);
  R(c, CW - SIDE, 0, SIDE, CH, edge);
  R(c, 0, CH - BOTTOM, CW, BOTTOM, edge);
  R(c, SIDE - 1, TOP, 1, CH - TOP - BOTTOM, 'rgba(0,0,0,.25)');
  R(c, CW - SIDE, TOP, 1, CH - TOP - BOTTOM, 'rgba(0,0,0,.25)');
  // kapı (alt duvarda)
  R(c, SIDE + CELL, CH - BOTTOM, CELL + 4, BOTTOM, '#78350f');
  R(c, SIDE + CELL + 2, CH - BOTTOM + 2, 2, 2, '#facc15');
}

// ─────────────────────────── mobilyalar (döndürülmemiş yerel koordinatlar) ───────────────────────────
function bed(c, W, H, col, pillows) {
  R(c, 0, 0, W, H, shade(col, -0.35));
  R(c, 1, 1, W - 2, H - 2, '#f8fafc');
  const pw = Math.floor((W - 4 - (pillows - 1) * 2) / pillows);
  for (let i = 0; i < pillows; i++) {
    R(c, 2 + i * (pw + 2), 2, pw, 5, '#e2e8f0');
    R(c, 2 + i * (pw + 2), 6, pw, 1, '#cbd5e1');
  }
  const by = Math.round(H * 0.42);
  R(c, 1, by, W - 2, H - by - 1, col);
  R(c, 1, by, W - 2, 2, shade(col, 0.3));
  R(c, 1, H - 3, W - 2, 1, shade(col, -0.2));
}

function sofa(c, W, H, col, chaise = false) {
  const dark = shade(col, -0.45);
  if (chaise) {
    // L koltuk: üst sıra + sol şezlong; boş köşede sehpa
    R(c, 0, 0, W, CELL, shade(col, -0.3));
    R(c, 0, CELL, CELL, H - CELL, shade(col, -0.3));
    R(c, 0, 0, W, 4, dark);
    R(c, 0, 0, 3, H, dark);
    R(c, W - 3, 0, 3, CELL, dark);
    R(c, 3, H - 3, CELL - 3, 3, dark);
    for (let i = 0; i < 3; i++) {
      R(c, 4 + i * ((W - 7) / 3), 5, (W - 7) / 3 - 2, CELL - 7, col);
      R(c, 4 + i * ((W - 7) / 3), 5, (W - 7) / 3 - 2, 1, shade(col, 0.25));
    }
    R(c, 4, CELL, CELL - 6, H - CELL - 4, col);
    // sehpa
    R(c, CELL + 6, CELL + 4, W - CELL - 12, H - CELL - 8, '#a16207');
    R(c, CELL + 6, CELL + 4, W - CELL - 12, 1, '#ca8a04');
    R(c, CELL + 10, CELL + 7, 3, 3, '#f8fafc');
    return;
  }
  R(c, 0, 0, W, H, shade(col, -0.3));
  R(c, 0, 0, W, 4, dark);
  R(c, 0, 0, 3, H, dark);
  R(c, W - 3, 0, 3, H, dark);
  const n = Math.max(1, Math.round((W - 6) / 14));
  const cw = (W - 6) / n;
  for (let i = 0; i < n; i++) {
    R(c, 3 + i * cw + 1, 5, cw - 2, H - 6, col);
    R(c, 3 + i * cw + 1, 5, cw - 2, 1, shade(col, 0.25));
  }
}

const DRAW = {
  bed_simple: (c, W, H, f) => bed(c, W, H, f.color, 1),
  bed_double: (c, W, H, f) => bed(c, W, H, f.color, 2),
  bed_luxe: (c, W, H) => {
    bed(c, W, H, '#1e3a8a', 2);
    R(c, 0, 0, W, 2, '#facc15');
  },
  sofa_small: (c, W, H, f) => sofa(c, W, H, f.color),
  sofa_l: (c, W, H, f) => sofa(c, W, H, f.color, true),
  sofa_leather: (c, W, H, f) => {
    sofa(c, W, H, f.color);
    for (let x = 6; x < W - 4; x += 5) R(c, x, 2, 1, 1, '#fcd34d');
  },
  tv: (c, W, H) => {
    R(c, 1, 6, W - 2, H - 7, '#3f3f46');
    R(c, 2, 7, W - 4, 1, '#52525b');
    R(c, 3, 1, W - 6, 4, '#0f172a');
    R(c, 4, 2, W - 8, 1, '#38bdf8');
    R(c, W / 2 - 2, 5, 4, 1, '#27272a');
  },
  table: (c, W, H, f) => {
    const ch = shade(f.color, -0.25);
    for (const [x, y] of [[W / 2 - 3, 0], [W / 2 - 3, H - 4], [0, H / 2 - 3], [W - 4, H / 2 - 3]]) R(c, x, y, x === 0 || x === W - 4 ? 4 : 6, x === 0 || x === W - 4 ? 6 : 4, ch);
    R(c, 4, 4, W - 8, H - 8, f.color);
    R(c, 4, 4, W - 8, 1, shade(f.color, 0.25));
    for (const [x, y] of [[W / 2 - 1, 6], [W / 2 - 1, H - 9], [6, H / 2 - 1], [W - 9, H / 2 - 1]]) R(c, x, y, 3, 3, '#f8fafc');
  },
  rug: (c, W, H, f) => {
    R(c, 1, 1, W - 2, H - 2, f.color);
    R(c, 3, 3, W - 6, H - 6, shade(f.color, 0.35));
    R(c, 5, 5, W - 10, H - 10, f.color);
    for (let y = 7; y < H - 7; y += 4) for (let x = 7 + (y % 8 ? 2 : 0); x < W - 7; x += 4) R(c, x, y, 1, 1, '#fde68a');
    for (let x = 1; x < W - 1; x += 2) {
      R(c, x, 0, 1, 1, shade(f.color, 0.4));
      R(c, x, H - 1, 1, 1, shade(f.color, 0.4));
    }
  },
  plant: (c, W, H) => {
    disc(c, W / 2, H / 2 + 1, 4, '#9a3412');
    for (const [dx, dy, col] of [[-3, -2, '#15803d'], [3, -1, '#16a34a'], [0, -4, '#22c55e'], [-2, 3, '#16a34a'], [3, 3, '#15803d']]) disc(c, W / 2 + dx, H / 2 + dy, 2, col);
  },
  lamp: (c, W, H, f, t) => {
    glow(c, W / 2, H / 2, 14, 'rgba(254,240,138,ALPHA)', 0.28 + Math.sin(t * 4) * 0.03);
    disc(c, W / 2, H / 2, 5, '#fef3c7');
    disc(c, W / 2, H / 2, 2, '#fde68a');
  },
  aquarium: (c, W, H, f, t) => {
    R(c, 0, 2, W, H - 4, '#1f2937');
    R(c, 1, 3, W - 2, H - 6, '#0ea5e9');
    R(c, 1, 3, W - 2, 2, '#7dd3fc');
    for (let i = 0; i < 3; i++) {
      const fx = 2 + ((t * (6 + i * 3) + i * 9) % (W - 6));
      R(c, fx, 6 + i * 2, 3, 1, ['#f97316', '#facc15', '#f43f5e'][i]);
    }
    R(c, 3, H - 5, 2, 2, '#16a34a');
    R(c, W - 6, H - 5, 2, 2, '#16a34a');
  },
  trophy: (c, W, H, f, t, o) => {
    R(c, 0, 1, W, H - 2, '#3f2a1a');
    R(c, 1, 2, W - 2, H - 4, 'rgba(200,230,255,.25)');
    const n = Math.max(1, Math.min(5, o.trophies || 1));
    for (let i = 0; i < n; i++) {
      const x = 3 + i * 6;
      R(c, x, 5, 4, 3, '#facc15');
      R(c, x + 1, 8, 2, 2, '#ca8a04');
    }
  },
  console: (c, W, H) => {
    R(c, 0, 1, W, 7, '#1f2937');
    R(c, 3, 2, W - 6, 4, '#0f172a');
    R(c, 4, 3, W - 8, 2, '#22c55e');
    disc(c, W / 2, H - 4, 3, '#dc2626');
    R(c, W / 2 - 4, 9, 3, 2, '#e5e7eb');
  },
  gym: (c, W, H) => {
    R(c, 1, 1, W - 2, H - 2, '#1f2937');
    R(c, W / 2 - 3, 6, 6, H - 10, '#475569');
    R(c, W / 2 - 3, 6, 6, 1, '#64748b');
    R(c, 3, 9, W - 6, 2, '#9ca3af');
    R(c, 3, 6, 3, 8, '#111827');
    R(c, W - 6, 6, 3, 8, '#111827');
  },
  massage_chair: (c, W, H, f) => {
    disc(c, W / 2, H / 2 + 1, 6, f.color);
    disc(c, W / 2, H / 2 + 2, 4, '#374151');
    R(c, W / 2 - 3, 1, 6, 3, '#111827');
  },
  piano: (c, W, H) => {
    c.fillStyle = '#0b0f19';
    c.beginPath();
    c.moveTo(2, H - 6);
    c.lineTo(2, 4);
    c.quadraticCurveTo(W / 2, -1, W - 3, 8);
    c.quadraticCurveTo(W - 1, H - 8, W - 4, H - 6);
    c.closePath();
    c.fill();
    R(c, 4, 6, W - 12, 1, '#374151');
    R(c, 2, H - 6, W - 6, 4, '#f8fafc');
    for (let x = 4; x < W - 6; x += 3) R(c, x, H - 6, 1, 2, '#0b0f19');
    R(c, W / 2 - 3, H - 2, 6, 2, '#1f2937');
  },
  bar_cart: (c, W, H) => {
    R(c, 1, 2, W - 2, H - 4, '#78350f');
    R(c, 1, 2, W - 2, 1, '#a16207');
    R(c, 3, 4, 6, 6, '#1f2937');
    R(c, 4, 5, 4, 2, '#9ca3af');
    R(c, 10, 6, 3, 3, '#f8fafc');
  },
};

/** Duvara asılı eşyalar üst duvarın yüzüne çizilir */
const WALL_DRAW = {
  painting: (c, x, f) => {
    R(c, x + 2, 3, CELL - 4, 13, '#78350f');
    R(c, x + 3, 4, CELL - 6, 11, '#fef3c7');
    R(c, x + 4, 6, 4, 6, f.color);
    R(c, x + 7, 9, 4, 4, '#f97316');
    R(c, x + 5, 5, 3, 2, '#0ea5e9');
  },
  jersey: (c, x, f, o) => {
    R(c, x + 2, 3, CELL - 4, 14, '#1f2937');
    R(c, x + 3, 4, CELL - 6, 12, '#e5e7eb');
    const col = o.jersey || f.color;
    R(c, x + 5, 6, 6, 8, col);
    R(c, x + 4, 6, 2, 3, col);
    R(c, x + 10, 6, 2, 3, col);
    R(c, x + 7, 9, 2, 3, '#fff');
  },
};

/** Tek mobilya (önizleme ve oda için). x,y: tuvalde sol üst piksel */
export function drawItem(c, f, x, y, rot, t = 0, o = {}) {
  if (!f) return;
  if (f.wall) {
    (WALL_DRAW[f.id] || WALL_DRAW.painting)(c, x, f, o);
    return;
  }
  const W = f.w * CELL;
  const H = f.h * CELL;
  const draw = DRAW[f.id] || ((cc, w, h) => R(cc, 1, 1, w - 2, h - 2, f.color));
  c.save();
  if (rot) {
    // 90° döndür: kapladığı alan H×W olur
    c.translate(x + H, y);
    c.rotate(Math.PI / 2);
  } else c.translate(x, y);
  // gölge
  if (!f.floor && f.id !== 'sofa_l') {
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.fillRect(1, 2, W, H);
  }
  draw(c, W, H, f, t, o);
  c.restore();
}

/**
 * Odayı çizer.
 * @param {{plan:object, wallColor:string, floor:string, placed:Array, selected?:string, ghost?:{id:string,x:number,y:number,rot:number,ok:boolean}, hints?:Array<{x:number,y:number}>, view?:string, trophies?:number, jersey?:string}} o
 */
export function drawRoom(c, t, o) {
  const { plan } = o;
  const size = roomSize(plan);
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, size.w, size.h);
  drawFloor(c, plan, o.floor);
  drawWalls(c, plan, o.wallColor, t, o.view);
  // Katman sırası: halı → eşya → duvar
  const order = { floor: 0, obj: 1, wall: 2 };
  const items = o.placed
    .map((p) => ({ ...p, f: FURNITURE_BY_ID[p.id] }))
    .filter((p) => p.f)
    .sort((a, b) => order[layerOf(a.f)] - order[layerOf(b.f)] || a.y - b.y);
  for (const p of items) {
    const px = SIDE + p.x * CELL;
    const py = p.f.wall ? 0 : TOP + p.y * CELL;
    drawItem(c, p.f, px, py, p.rot, t, o);
  }
  // Yerleştirme ipuçları (sığdığı hücreler)
  for (const h of o.hints || []) {
    const pulse = 0.25 + Math.sin(t * 5) * 0.1;
    c.fillStyle = `rgba(198,255,61,${pulse})`;
    if (h.y < 0) c.fillRect(SIDE + h.x * CELL + 6, 9, 4, 4);
    else c.fillRect(SIDE + h.x * CELL + 6, TOP + h.y * CELL + 6, 4, 4);
  }
  // Seçili eşya çerçevesi
  const sel = items.find((p) => p.uid === o.selected);
  if (sel) {
    const d = dims(sel.f, sel.rot);
    const x = SIDE + sel.x * CELL;
    const y = sel.f.wall ? 1 : TOP + sel.y * CELL;
    const w = d.w * CELL;
    const h = sel.f.wall ? TOP - 3 : d.h * CELL;
    const on = Math.floor(t * 6) % 2;
    c.fillStyle = on ? '#c6ff3d' : '#f8fafc';
    for (let i = 0; i < w; i += 3) {
      c.fillRect(x + i, y, 2, 1);
      c.fillRect(x + i, y + h - 1, 2, 1);
    }
    for (let i = 0; i < h; i += 3) {
      c.fillRect(x, y + i, 1, 2);
      c.fillRect(x + w - 1, y + i, 1, 2);
    }
  }
}

/** Katalog önizlemesi: tek eşya küçük tuvalde */
export function itemPreview(canvas, f, o = {}) {
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  const W = f.wall ? CELL : f.w * CELL;
  const H = f.wall ? TOP : f.h * CELL;
  canvas.width = Math.max(W, 32) + 4;
  canvas.height = Math.max(H, 32) + 4;
  const x = Math.round((canvas.width - W) / 2);
  const y = Math.round((canvas.height - H) / 2);
  if (f.wall) {
    R(c, x - 2, y, W + 4, H, '#e2e8f0');
    c.save();
    c.translate(x, y);
    drawItem(c, f, 0, 0, 0, 0, o);
    c.restore();
  } else drawItem(c, f, x, y, 0, 0, o);
}
