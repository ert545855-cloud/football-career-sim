// GARAJ ÇİZİMİ — yandan piksel araba (hatchback, sedan, SUV, süper spor) ve garaj arka planı.
// Modifiyeler görünür: boya + kaplama, şerit, jant, body kit, spoyler, cam filmi, neon, egzoz.
import { disc, glow, px as R, shade, vgrad } from './pixelScenes.js';

export const CW = 192;
export const CH = 104;
const G = 92; // zemin çizgisi

/** Gövde geometrileri (sağa bakan araç) */
const BODIES = {
  hatch: {
    sil: [[38, 84], [38, 68], [44, 56], [56, 48], [98, 47], [112, 56], [136, 60], [148, 64], [152, 72], [152, 82], [148, 86], [42, 86]],
    win: [[[48, 60], [57, 51], [76, 50], [76, 60]], [[80, 60], [80, 50], [97, 50], [106, 60]]],
    wheels: [62, 128], r: 9, front: [146, 65, 6, 4], rear: [38, 66, 4, 7], spoiler: [42, 52], belt: 70, doors: [78, 108], top: 47,
  },
  sedan: {
    sil: [[30, 84], [30, 70], [34, 64], [54, 62], [66, 50], [110, 49], [124, 61], [152, 64], [160, 70], [160, 82], [156, 86], [34, 86]],
    win: [[[60, 61], [69, 52], [88, 52], [88, 61]], [[92, 61], [92, 52], [108, 52], [119, 61]]],
    wheels: [60, 136], r: 9, front: [154, 66, 6, 3], rear: [30, 67, 4, 5], spoiler: [34, 62], belt: 72, doors: [90, 122], top: 49,
  },
  suv: {
    sil: [[32, 82], [32, 54], [38, 44], [108, 43], [124, 56], [152, 59], [158, 64], [158, 80], [154, 84], [36, 84]],
    win: [[[40, 56], [44, 47], [70, 47], [70, 56]], [[74, 56], [74, 47], [98, 47], [98, 56]], [[102, 56], [102, 47], [108, 47], [118, 56]]],
    wheels: [60, 134], r: 11, front: [152, 61, 6, 4], rear: [32, 56, 4, 9], spoiler: [38, 43], belt: 66, doors: [72, 100], top: 43, rails: true,
  },
  super: {
    sil: [[28, 84], [28, 72], [40, 66], [70, 58], [86, 52], [112, 52], [134, 62], [160, 68], [166, 74], [164, 84], [160, 86], [32, 86]],
    win: [[[74, 61], [88, 54], [110, 54], [124, 62]]],
    wheels: [62, 140], r: 9, front: [156, 68, 8, 3], rear: [28, 72, 4, 4], spoiler: [34, 66], belt: 76, doors: [102], top: 52, intake: [80, 72, 14, 5],
  },
};

function poly(c, pts, col) {
  c.fillStyle = col;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}

// ─────────────────────────── garaj ───────────────────────────
function garage(c, t) {
  vgrad(c, 0, 0, CW, G, [[0, '#0f172a'], [1, '#1e293b']]);
  for (let x = 0; x < CW; x += 16) R(c, x, 8, 1, G - 8, 'rgba(255,255,255,.04)');
  // tavan ışık şeridi
  R(c, 20, 4, 152, 3, '#e0f2fe');
  glow(c, 96, 6, 90, 'rgba(186,230,253,ALPHA)', 0.18 + Math.sin(t * 9) * 0.01);
  // alet panosu (sol)
  R(c, 6, 18, 34, 30, '#334155');
  for (let y = 21; y < 46; y += 4) for (let x = 9; x < 38; x += 4) R(c, x, y, 1, 1, '#1e293b');
  R(c, 10, 22, 2, 14, '#ef4444');
  R(c, 9, 22, 4, 3, '#9ca3af');
  R(c, 16, 22, 2, 16, '#9ca3af');
  R(c, 15, 36, 4, 3, '#facc15');
  R(c, 22, 24, 10, 2, '#9ca3af');
  R(c, 30, 23, 3, 4, '#9ca3af');
  R(c, 24, 32, 2, 10, '#f97316');
  R(c, 33, 30, 3, 12, '#22c55e');
  // takım çantası (sağ)
  R(c, 168, 54, 20, 30, '#b91c1c');
  for (let y = 58; y < 82; y += 6) R(c, 169, y, 18, 1, '#7f1d1d');
  R(c, 175, 57, 6, 1, '#e5e7eb');
  // lastik yığını
  for (let i = 0; i < 3; i++) {
    R(c, 4, 84 - i * 6, 16, 6, '#111827');
    R(c, 6, 85 - i * 6, 12, 1, '#374151');
  }
  // zemin (epoksi, yansımalı)
  vgrad(c, 0, G, CW, CH - G, [[0, '#475569'], [1, '#334155']]);
  R(c, 0, G, CW, 1, '#64748b');
  for (let x = -10; x < CW; x += 26) R(c, x + ((G * 3) % 26), G + 5, 14, 1, 'rgba(255,255,255,.08)');
}

// ─────────────────────────── jantlar ───────────────────────────
function wheel(c, cx, cy, r, rims, t, spin) {
  disc(c, cx, cy, r, '#0b0f14');
  disc(c, cx, cy, r - 1, '#1f2937');
  const rr = r - 3;
  const styles = {
    stock: { face: '#9ca3af', spoke: '#6b7280', n: 5 },
    sport: { face: '#111827', spoke: '#9ca3af', n: 10 },
    carbon: { face: '#0b0f14', spoke: '#374151', n: 6, caliper: '#dc2626' },
    gold: { face: '#a16207', spoke: '#facc15', n: 6 },
  };
  const s = styles[rims] || styles.stock;
  disc(c, cx, cy, rr, s.face);
  if (s.caliper) R(c, cx + 1, cy - rr + 1, 3, 4, s.caliper);
  c.strokeStyle = s.spoke;
  c.lineWidth = rims === 'sport' ? 1 : 1.6;
  for (let i = 0; i < s.n; i++) {
    const a = spin + (i / s.n) * Math.PI * 2;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    c.stroke();
  }
  disc(c, cx, cy, 1, rims === 'gold' ? '#fde68a' : '#e5e7eb');
}

/**
 * Arabayı çizer.
 * @param {{body:string, color:string, finish:string, stripes:string, stripeColor:string, rims:string, kit:string, spoiler:string,
 *   tint:string, neon:string|null, engine:string, number:number|string, plate:boolean}} o
 */
export function drawCar(c, t, o, { background = true } = {}) {
  c.imageSmoothingEnabled = false;
  const b = BODIES[o.body] || BODIES.sedan;
  if (background) garage(c, t);
  else c.clearRect(0, 0, CW, CH);
  const color = o.color || '#60a5fa';
  const left = b.sil.reduce((m, p) => Math.min(m, p[0]), 999);
  const right = b.sil.reduce((m, p) => Math.max(m, p[0]), 0);
  // neon
  if (o.neon) {
    const pulse = 0.55 + Math.sin(t * 3) * 0.12;
    const g = c.createRadialGradient((left + right) / 2, G, 4, (left + right) / 2, G, (right - left) * 0.62);
    const col = o.neon;
    g.addColorStop(0, `${col}${Math.round(pulse * 200).toString(16).padStart(2, '0')}`);
    g.addColorStop(1, `${col}00`);
    c.fillStyle = g;
    c.fillRect(left - 30, G - 14, right - left + 60, CH - G + 14);
  }
  // gölge
  c.fillStyle = 'rgba(0,0,0,.45)';
  c.beginPath();
  c.ellipse((left + right) / 2, G + 1, (right - left) / 2 + 4, 3, 0, 0, Math.PI * 2);
  c.fill();

  // gövde
  const lift = o.kit === 'wide' ? 1 : 0;
  c.save();
  c.translate(0, lift);
  if (o.finish === 'chrome') {
    const g = c.createLinearGradient(0, b.top, 0, 86);
    g.addColorStop(0, '#f8fafc');
    g.addColorStop(0.35, shade(color, 0.55));
    g.addColorStop(0.55, '#64748b');
    g.addColorStop(1, shade(color, -0.2));
    c.fillStyle = g;
    c.beginPath();
    b.sil.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
  } else {
    poly(c, b.sil, color);
    // alt kısım gölgesi
    c.save();
    c.beginPath();
    b.sil.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.clip();
    R(c, 0, b.belt + 6, CW, 30, shade(color, -0.22));
    if (o.finish !== 'matte') R(c, 0, b.top, CW, 2, shade(color, 0.35));
    if (o.finish === 'gloss' || o.finish === 'metallic') {
      // yansıma çizgisi
      const sx = left + ((t * 30) % (right - left + 40)) - 20;
      for (let i = 0; i < 6; i++) R(c, sx + i, b.top + 4, 1, b.belt - b.top, `rgba(255,255,255,${o.finish === 'metallic' ? 0.12 : 0.08})`);
    }
    if (o.finish === 'metallic') {
      for (let i = 0; i < 40; i++) R(c, left + ((i * 37) % (right - left)), b.top + ((i * 13) % (86 - b.top)), 1, 1, 'rgba(255,255,255,.22)');
    }
    // şeritler
    if (o.stripes === 'racing') {
      R(c, 0, b.belt - 3, CW, 2, o.stripeColor || '#f8fafc');
      R(c, 0, b.belt + 1, CW, 2, o.stripeColor || '#f8fafc');
    } else if (o.stripes === 'side') {
      R(c, 0, b.belt + 2, CW, 4, o.stripeColor || '#111827');
    }
    c.restore();
  }
  if (o.stripes === 'number') {
    const dx = b.doors[0] + 2;
    disc(c, dx + 8, b.belt + 4, 6, '#f8fafc');
    c.fillStyle = '#111827';
    c.font = 'bold 8px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(o.number ?? 10), dx + 8, b.belt + 5);
  }
  // camlar
  const glass = o.tint === 'dark' ? '#0b1220' : o.tint === 'light' ? '#3b5a78' : '#93c5fd';
  for (const w of b.win) {
    poly(c, w, glass);
    if (o.tint !== 'dark') {
      const [x0, y0] = w[0];
      R(c, x0 + 4, y0 - 6, 2, 4, 'rgba(255,255,255,.35)');
    }
  }
  if (b.rails) R(c, 42, b.top - 2, 62, 2, '#9ca3af');
  // kapı çizgileri, kol, ayna
  for (const x of b.doors) R(c, x, b.belt - 10, 1, 22, shade(color, -0.4));
  for (const x of b.doors) R(c, x + 4, b.belt - 2, 4, 1, shade(color, -0.45));
  R(c, (b.win[b.win.length - 1][2] || b.win[0][2])[0] - 2, b.belt - 12, 4, 3, shade(color, -0.3));
  if (b.intake) R(c, ...b.intake, '#0b0f14');
  // farlar
  R(c, ...b.front, '#fef9c3');
  glow(c, b.front[0] + b.front[2], b.front[1] + 2, 16, 'rgba(254,249,195,ALPHA)', 0.35);
  R(c, ...b.rear, '#ef4444');
  glow(c, b.rear[0], b.rear[1] + 2, 8, 'rgba(239,68,68,ALPHA)', 0.3);
  // body kit
  if (o.kit === 'sport' || o.kit === 'wide') {
    R(c, b.wheels[0] + b.r, 84, b.wheels[1] - b.wheels[0] - b.r * 2, 3, '#0b0f14'); // marşpiyel
    R(c, right - 10, 85, 12, 2, '#0b0f14'); // ön lip
    R(c, left, 85, 8, 2, '#0b0f14'); // difüzör
  }
  // spoyler
  const [sx, sy] = b.spoiler;
  if (o.spoiler === 'lip') {
    R(c, sx - 2, sy - 2, 10, 2, shade(color, -0.35));
  } else if (o.spoiler === 'wing') {
    R(c, sx + 2, sy - 7, 2, 7, '#111827');
    R(c, sx + 10, sy - 7, 2, 7, '#111827');
    R(c, sx - 4, sy - 9, 22, 3, '#0b0f14');
    R(c, sx - 4, sy - 9, 22, 1, '#374151');
  }
  // egzoz
  if (o.engine === 's2' || o.engine === 's3') {
    R(c, left - 2, 82, 4, 2, '#9ca3af');
    R(c, left - 2, 79, 4, 2, '#9ca3af');
    if ((o.engine === 's3' && Math.sin(t * 2.3) > 0.93) || (o.rev && Math.sin(t * 25) > 0.5)) {
      R(c, left - 7, 79, 5, 2, '#f97316');
      R(c, left - 5, 82, 3, 2, '#facc15');
    }
  }
  // plaka (arka)
  if (o.plate) R(c, left + 1, 76, 5, 4, '#f8fafc');
  // jant yuvaları + tekerlekler (geniş kasada çamurluk)
  const spin = (o.spin || 0) + t * 0;
  for (const wx of b.wheels) {
    if (o.kit === 'wide') {
      c.fillStyle = shade(color, -0.3);
      c.beginPath();
      c.arc(wx, G - b.r, b.r + 4, Math.PI, 0);
      c.fill();
    }
    c.fillStyle = '#0b0f14';
    c.beginPath();
    c.arc(wx, G - b.r, b.r + 2, Math.PI, 0);
    c.fill();
  }
  c.restore();
  for (const wx of b.wheels) wheel(c, wx, G - b.r, b.r, o.rims, t, spin);
}
