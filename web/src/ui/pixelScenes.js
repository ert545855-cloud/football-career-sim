// PİKSEL SANAT SAHNELERİ — kafe, bar ve ev; 192×120 mantıksal piksel, ekranda keskin büyütülür.
// Kompozisyon gönderilen tasarım referansındaki gibi: önde oyuncu (arkadan), masanın karşısında kişi.
// Hafif animasyon: lamba titreşimi, kahve buharı, deniz pırıltısı, neon yanıp sönmesi, disko ışıkları.
import { AVATAR } from '../core/data.js';

export const SW = 192;
export const SH = 120;

// ─────────────────────────── çizim yardımcıları ───────────────────────────
const R = (c, x, y, w, h, col) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
    c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
function vgrad(c, x, y, w, h, stops) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
}
function glow(c, x, y, r, col, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col.replace('ALPHA', a));
  g.addColorStop(1, col.replace('ALPHA', 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = f < 0 ? 0 : 255;
  const p = Math.abs(f);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}
/** Tekrarlanabilir rastgele (dekor her karede aynı yerde kalsın) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────── karakterler ───────────────────────────

/** Oturan kişi (önden). x: merkez, y: başın üstü, k: ölçek. look: avatar; clothes: [üst, yaka] */
export function drawSeated(c, x, y, look = {}, clothes = ['#334155', '#94a3b8'], t = 0, k = 1.5) {
  const skin = AVATAR.skins[look.skin ?? 1] || AVATAR.skins[1];
  const hair = AVATAR.hairColors[look.hairColor ?? 1] || AVATAR.hairColors[1];
  const skinD = shade(skin, -0.2);
  const style = look.hair || 'short';
  const S = (dx, dy, w, h, col) => R(c, x + dx * k, y + dy * k, Math.max(1, w * k), Math.max(1, h * k), col);
  const D = (dx, dy, r, col) => disc(c, x + dx * k, y + dy * k, Math.round(r * k), col);
  const b = Math.sin(t * 1.6) * 0.5; // nefes
  // uzun saç (arkada)
  if (style === 'long' || style === 'wavy') S(-7, 4 + b, 14, 15, shade(hair, -0.15));
  if (style === 'bob') S(-7, 4 + b, 14, 7, shade(hair, -0.15));
  if (style === 'ponytail') S(6, 3 + b, 3, 10, shade(hair, -0.1));
  // gövde
  S(-10, 15, 20, 16, clothes[0]);
  S(-11, 17, 22, 14, clothes[0]);
  S(-2, 15, 4, 3, clothes[1]);
  S(-11, 17, 1, 14, shade(clothes[0], -0.25));
  S(10, 17, 1, 14, shade(clothes[0], 0.12));
  // boyun + baş
  S(-2, 11 + b, 4, 4, skinD);
  D(0, 6 + b, 6, skin);
  S(-7, 6 + b, 1, 3, skinD);
  S(7, 6 + b, 1, 3, skinD);
  // saç (üst)
  const hy = b;
  switch (style) {
    case 'bald': break;
    case 'buzz': S(-5, hy, 11, 2, shade(hair, 0.1)); break;
    case 'curly':
      for (const [dx, dy] of [[-5, 1], [-2, -1], [2, -1], [5, 1], [-6, 4], [6, 4], [0, -1]]) D(dx, dy + hy, 2, hair);
      break;
    case 'mohawk': S(-1, hy - 3, 3, 5, hair); break;
    case 'long':
    case 'wavy':
    case 'bob':
      S(-6, hy - 1, 13, 4, hair);
      S(-7, hy + 1, 3, style === 'bob' ? 9 : 13, hair);
      S(5, hy + 1, 3, style === 'bob' ? 9 : 13, hair);
      S(-3, hy - 1, 6, 1, shade(hair, 0.25));
      if (style === 'wavy') {
        S(-8, hy + 8, 1, 3, hair);
        S(8, hy + 10, 1, 3, hair);
      }
      break;
    case 'ponytail':
      S(-6, hy - 1, 13, 4, hair);
      S(-7, hy + 1, 2, 4, hair);
      S(-3, hy - 1, 6, 1, shade(hair, 0.25));
      break;
    default:
      S(-6, hy - 1, 13, 4, hair);
      S(-7, hy + 1, 2, 4, hair);
      S(6, hy + 1, 2, 3, hair);
  }
  // yüz
  const blink = (t * 0.7) % 4 < 0.12;
  S(-3, hy + 6, 2, blink ? 0.6 : 2, '#1b1410');
  S(2, hy + 6, 2, blink ? 0.6 : 2, '#1b1410');
  if (!blink) {
    S(-3, hy + 6, 0.7, 0.7, '#fff');
    S(2, hy + 6, 0.7, 0.7, '#fff');
  }
  if (look.fem) {
    S(-4, hy + 5, 1, 1, '#1b1410');
    S(4, hy + 5, 1, 1, '#1b1410');
    S(-1, hy + 9.5, 3, 1, '#c2416b');
    S(-5, hy + 8, 2, 1, 'rgba(255,120,120,.45)');
    S(4, hy + 8, 2, 1, 'rgba(255,120,120,.45)');
  } else S(-1, hy + 9.5, 3, 1, shade(skin, -0.45));
  // kollar ve eller masada
  S(-13, 25, 6, 5, clothes[0]);
  S(7, 25, 6, 5, clothes[0]);
  S(-9, 28, 4, 2, skin);
  S(5, 28, 4, 2, skin);
}

/** Oyuncu (arkadan, önde ve büyük). x: merkez, y: başın üstü */
export function drawPlayerBack(c, x, y, look = {}, colors = ['#111827', '#e5e7eb']) {
  const hair = AVATAR.hairColors[look.hairColor ?? 1] || AVATAR.hairColors[1];
  const skin = AVATAR.skins[look.skin ?? 1] || AVATAR.skins[1];
  const style = look.hair || 'short';
  // kapüşonlu üst
  R(c, x - 26, y + 26, 52, 40, colors[0]);
  R(c, x - 30, y + 32, 60, 40, colors[0]);
  R(c, x - 14, y + 20, 28, 10, shade(colors[0], 0.08)); // kapüşon
  R(c, x - 30, y + 32, 3, 40, shade(colors[0], 0.12));
  R(c, x + 4, y + 36, 1, 30, shade(colors[0], -0.3));
  // ense + kulak
  R(c, x - 6, y + 18, 12, 6, shade(skin, -0.25));
  R(c, x - 13, y + 9, 3, 6, shade(skin, -0.15));
  R(c, x + 11, y + 9, 3, 6, shade(skin, -0.15));
  // baş (arkadan saç)
  if (style === 'bald') disc(c, x, y + 10, 11, skin);
  else {
    disc(c, x, y + 10, 11, hair);
    R(c, x - 8, y + 2, 7, 2, shade(hair, 0.18)); // parlama
    if (style === 'curly') for (const [dx, dy] of [[-9, 3], [9, 3], [-5, -1], [5, -1], [0, -2]]) disc(c, x + dx, y + dy, 3, hair);
    if (style === 'buzz') disc(c, x, y + 10, 11, shade(hair, 0.15));
  }
}

// ─────────────────────────── sahneler ───────────────────────────

function cafe(c, t, o) {
  const pal = o.palette || 'bosphorus';
  const r = rng(7);
  const day = pal === 'terrace'; // Bebek Teras: gündüz, açık hava, deniz
  // tavan ve duvar
  if (day) {
    vgrad(c, 0, 0, SW, 80, [[0, '#cbb894'], [0.3, '#e8dcc4'], [1, '#d8c7a6']]);
    for (let y = 18; y < 78; y += 9) R(c, 0, y, 48, 1, 'rgba(120,90,50,.12)');
  } else {
    vgrad(c, 0, 0, SW, 80, [[0, '#2a1a12'], [0.25, '#3b261a'], [1, '#4a3122']]);
    // tuğla doku (sol duvar)
    for (let y = 16; y < 78; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 48; x += 8) R(c, x, y, 7, 3, r() < 0.5 ? '#5a3a29' : '#634030');
  }
  // menü tahtası
  R(c, 6, 22, 34, 36, '#1d1d1b');
  R(c, 5, 21, 36, 1, '#8a6a4a');
  R(c, 5, 58, 36, 1, '#8a6a4a');
  for (let i = 0; i < 9; i++) {
    R(c, 9, 26 + i * 3.6, 14 + (i * 7) % 9, 1, i === 0 || i === 5 ? '#f5f5f4' : '#a8a29e');
    if (i !== 0 && i !== 5) R(c, 33, 26 + i * 3.6, 4, 1, '#a8a29e');
  }
  // tezgâh + espresso + vitrin
  R(c, 48, 50, 66, 22, '#5c3b26');
  R(c, 48, 49, 66, 2, '#8b5e3c');
  R(c, 54, 38, 14, 11, '#9ca3af');
  R(c, 56, 40, 10, 5, '#4b5563');
  R(c, 74, 42, 30, 8, 'rgba(200,230,255,.25)');
  for (let i = 0; i < 6; i++) R(c, 76 + i * 4.5, 46, 3, 2, ['#f59e0b', '#fde68a', '#b45309', '#fca5a5'][i % 4]);
  // tabela (sıcak ışık)
  R(c, 56, 20, 50, 12, '#24160e');
  const flick = 0.85 + Math.sin(t * 7) * 0.03 + (r() < 0.02 ? -0.2 : 0);
  glow(c, 81, 26, 30, 'rgba(255,190,110,ALPHA)', 0.25 * flick);
  for (let i = 0; i < 8; i++) R(c, 60 + i * 5.4, 24, 3.5, 4, `rgba(255,210,150,${0.85 * flick})`);
  // pencere (sağ)
  if (day) {
    vgrad(c, 120, 14, 72, 34, [[0, '#60a5fa'], [1, '#bae6fd']]);
    // bulutlar
    for (const [bx, by] of [[128, 20], [160, 26]]) {
      const x = 120 + ((bx - 120 + t * 2) % 76);
      R(c, x, by, 12, 3, '#f8fafc');
      R(c, x + 3, by - 2, 6, 2, '#f8fafc');
    }
    // karşı kıyı tepeleri ve yalılar
    for (let i = 0; i < 9; i++) R(c, 120 + i * 8, 40 - Math.abs(Math.sin(i * 1.3)) * 6, 8, 10, i % 2 ? '#4d7c4a' : '#3f6b3c');
    for (let i = 0; i < 7; i++) R(c, 123 + i * 10, 44, 5, 4, ['#f5f5f4', '#fca5a5', '#fde68a'][i % 3]);
    vgrad(c, 120, 48, 72, 30, [[0, '#0ea5e9'], [1, '#0c4a6e']]);
    // vapur
    const fx = 120 + ((t * 4) % 90) - 12;
    R(c, fx, 55, 14, 3, '#f8fafc');
    R(c, fx + 3, 52, 7, 3, '#f8fafc');
    R(c, fx + 6, 49, 2, 3, '#111827');
    R(c, fx, 58, 14, 1, '#1e3a8a');
    for (let i = 0; i < 14; i++) if (Math.sin(t * 3 + i * 1.7) > 0.4) R(c, 122 + ((i * 37) % 68), 60 + ((i * 13) % 16), 2, 1, '#e0f2fe');
    // martılar
    for (let i = 0; i < 2; i++) {
      const gx = 126 + ((t * (6 + i * 3) + i * 30) % 64);
      const gy = 22 + i * 7 + Math.sin(t * 2 + i) * 2;
      R(c, gx, gy, 2, 1, '#334155');
      R(c, gx + 2, gy - 1, 2, 1, '#334155');
    }
  } else if (pal === 'warm') {
    vgrad(c, 120, 14, 72, 64, [[0, '#283a5c'], [1, '#41557a']]);
    for (let i = 0; i < 6; i++) R(c, 124 + i * 11, 40 + (i % 3) * 6, 8, 38, '#1f2a44');
    for (let i = 0; i < 14; i++) R(c, 126 + r() * 60, 44 + r() * 30, 1, 1, (Math.sin(t * 2 + i) > 0 ? '#fde68a' : '#a16207'));
  } else {
    vgrad(c, 120, 14, 72, 64, [[0, '#f4a261'], [0.45, '#e76f51'], [0.75, '#9d5c7a'], [1, '#5b4b7a']]);
    // köprü
    R(c, 120, 50, 72, 8, '#3c3552');
    for (let i = 0; i < 9; i++) R(c, 120 + i * 9, 52 - Math.sin(i / 2) * 2, 6, 6, '#463d60');
    R(c, 140, 30, 2, 26, '#2a2440');
    R(c, 172, 30, 2, 26, '#2a2440');
    c.strokeStyle = '#2a2440';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(120, 50);
    c.quadraticCurveTo(141, 32, 141, 31);
    c.quadraticCurveTo(157, 50, 173, 31);
    c.quadraticCurveTo(183, 44, 192, 48);
    c.stroke();
    R(c, 120, 48, 72, 2, '#2f2946');
    // su + pırıltı
    vgrad(c, 120, 58, 72, 20, [[0, '#355070'], [1, '#22324d']]);
    for (let i = 0; i < 16; i++) {
      const sx = 122 + ((i * 37) % 68);
      const sy = 60 + ((i * 13) % 16);
      if (Math.sin(t * 3 + i * 1.7) > 0.3) R(c, sx, sy, 2, 1, '#fcd9a8');
    }
    // şehir ışıkları
    for (let i = 0; i < 18; i++) if (Math.sin(t * 1.3 + i) > -0.2) R(c, 121 + ((i * 23) % 70), 53 + (i % 3), 1, 1, '#fde68a');
  }
  // pencere çerçeveleri
  R(c, 118, 12, 2, 68, '#1c120c');
  for (const x of [143, 167]) R(c, x, 12, 2, 68, '#1c120c');
  R(c, 118, 12, 74, 2, '#1c120c');
  R(c, 118, 44, 74, 1, '#1c120c');
  // asma bitkiler
  for (const px of [8, 46, 112]) {
    for (let i = 0; i < 9; i++) R(c, px + Math.sin(i) * 3, 2 + i * 2, 3, 2, i % 2 ? '#3f7d3a' : '#2f6b2c');
  }
  // sarkıt lambalar
  for (const lx of [30, 90, 150]) {
    R(c, lx, 0, 1, 10, '#111');
    R(c, lx - 5, 10, 11, 4, '#1a1a1a');
    const f = 0.9 + Math.sin(t * 5 + lx) * 0.05;
    glow(c, lx, 16, 28, 'rgba(255,200,120,ALPHA)', 0.35 * f);
    R(c, lx - 2, 14, 5, 2, '#ffe2a8');
  }
  // teras: ip lambalar
  if (day) {
    c.strokeStyle = '#57534e';
    c.beginPath();
    c.moveTo(0, 6);
    c.quadraticCurveTo(96, 18, 192, 6);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const lx = 8 + i * 16;
      const ly = 6 + Math.sin((lx / 192) * Math.PI) * 6 + 1;
      R(c, lx, ly, 2, 2, Math.sin(t * 3 + i) > -0.6 ? '#fde68a' : '#a16207');
    }
  }
  // arka masalar ve müşteriler
  for (const [mx, col] of [[64, '#1f2937'], [100, '#334155']]) {
    R(c, mx - 6, 66, 3, 6, col);
    disc(c, mx - 5, 63, 2, '#c98e62');
    R(c, mx + 4, 68, 12, 2, '#6b4a33');
  }
  // zemin
  if (day) {
    vgrad(c, 0, 78, SW, 42, [[0, '#a8a29e'], [1, '#78716c']]);
    for (let y = 80; y < SH; y += 6) R(c, 0, y, SW, 1, 'rgba(0,0,0,.12)');
  } else {
    vgrad(c, 0, 78, SW, 42, [[0, '#3a2518'], [1, '#2a1a10']]);
    for (let y = 80; y < SH; y += 5) R(c, 0, y, SW, 1, 'rgba(0,0,0,.18)');
  }
}

function bar(c, t, o) {
  const pal = o.palette || 'neon';
  const r = rng(11);
  if (pal === 'rooftop') {
    vgrad(c, 0, 0, SW, 70, [[0, '#0b1026'], [1, '#22184a']]);
    for (let i = 0; i < 40; i++) if (Math.sin(t * 2 + i * 3) > -0.4) R(c, r() * SW, r() * 40, 1, 1, '#e0e7ff');
    for (let i = 0; i < 16; i++) {
      const bh = 14 + r() * 26;
      const bx = i * 12 + r() * 4;
      R(c, bx, 70 - bh, 10, bh, '#141a33');
      for (let k = 0; k < 6; k++) if (r() < 0.6) R(c, bx + 2 + (k % 3) * 3, 72 - bh + 4 + Math.floor(k / 3) * 5, 1, 2, Math.sin(t + i + k) > -0.5 ? '#fbbf24' : '#7c5a10');
    }
    // ip ışıklar
    for (let i = 0; i < 24; i++) {
      const lx = i * 8 + 4;
      const ly = 10 + Math.sin(i / 3.8) * 6;
      R(c, lx, ly, 2, 2, Math.sin(t * 4 + i) > 0 ? '#fde68a' : '#f59e0b');
      glow(c, lx + 1, ly + 1, 6, 'rgba(253,230,138,ALPHA)', 0.25);
    }
    R(c, 0, 66, SW, 6, '#3b2f5c');
  } else {
    // duvar + raf
    vgrad(c, 0, 0, SW, 80, pal === 'pub' ? [[0, '#1e130b'], [1, '#3a2617']] : [[0, '#0c0716'], [1, '#1c1030']]);
    R(c, 20, 18, 100, 36, pal === 'pub' ? '#2a1a10' : '#120a20');
    glow(c, 70, 36, 60, pal === 'pub' ? 'rgba(255,170,90,ALPHA)' : 'rgba(168,85,247,ALPHA)', 0.25);
    for (let row = 0; row < 3; row++) {
      R(c, 22, 30 + row * 10, 96, 1, '#4b3a2a');
      for (let i = 0; i < 15; i++) {
        const col = ['#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#e879f9', '#fde68a'][(i + row) % 6];
        R(c, 24 + i * 6.3, 23 + row * 10, 3, 7, col);
        R(c, 25 + i * 6.3, 21 + row * 10, 1, 2, col);
      }
    }
    if (pal === 'pub') {
      // TV'de maç
      R(c, 134, 18, 44, 28, '#111');
      R(c, 136, 20, 40, 24, '#2f7d32');
      R(c, 155, 20, 1, 24, '#e5f5e5');
      const bx = 140 + ((t * 9) % 32);
      R(c, bx, 30 + Math.sin(t * 3) * 6, 2, 2, '#fff');
      // atkılar
      for (let i = 0; i < 4; i++) R(c, 128 + i * 15, 52, 12, 4, i % 2 ? '#c8102e' : '#ffd200');
    } else {
      // neon tabela
      const on = Math.sin(t * 6) > -0.85;
      const nc = on ? '#f472b6' : '#7a3a5e';
      for (const [x, y, w, h] of [[136, 16, 40, 2], [136, 34, 40, 2], [136, 16, 2, 20], [174, 16, 2, 20]]) R(c, x, y, w, h, nc);
      for (let i = 0; i < 4; i++) R(c, 142 + i * 8, 22, 5, 8, on ? '#67e8f9' : '#2a5560');
      if (on) glow(c, 156, 26, 36, 'rgba(244,114,182,ALPHA)', 0.3);
      // disko ışınları
      for (let i = 0; i < 3; i++) {
        const a = t * 0.8 + i * 2.1;
        c.fillStyle = ['rgba(56,189,248,.06)', 'rgba(232,121,249,.06)', 'rgba(250,204,21,.05)'][i];
        c.beginPath();
        c.moveTo(96, 0);
        c.lineTo(96 + Math.cos(a) * 140 - 14, 110);
        c.lineTo(96 + Math.cos(a) * 140 + 14, 110);
        c.closePath();
        c.fill();
      }
    }
    // tezgâh
    R(c, 0, 58, 128, 14, pal === 'pub' ? '#4a2e1a' : '#1f1533');
    R(c, 0, 57, 128, 2, pal === 'pub' ? '#7a4d2c' : '#6d28d9');
  }
  // kalabalık siluetleri
  for (let i = 0; i < 9; i++) {
    const cx = 10 + i * 21 + Math.sin(i * 7) * 4;
    const dy = Math.sin(t * 2.5 + i) * 1.2;
    disc(c, cx, 62 + dy, 3, pal === 'pub' ? '#3a2a20' : '#1a1230');
    R(c, cx - 4, 65 + dy, 8, 10, pal === 'pub' ? '#2c1f17' : '#140d25');
  }
  vgrad(c, 0, 76, SW, 44, pal === 'pub' ? [[0, '#2a1b10'], [1, '#170f08']] : [[0, '#120b20'], [1, '#07040d']]);
}

function home(c, t, o) {
  const wall = o.wall || '#e2e8f0';
  vgrad(c, 0, 0, SW, 80, [[0, shade(wall, -0.25)], [1, shade(wall, -0.05)]]);
  // pencere
  R(c, 118, 14, 60, 40, '#1f2937');
  if (o.view === 'sea') {
    vgrad(c, 120, 16, 56, 20, [[0, '#fb923c'], [1, '#f472b6']]);
    vgrad(c, 120, 36, 56, 16, [[0, '#1d4ed8'], [1, '#1e3a8a']]);
    for (let i = 0; i < 8; i++) if (Math.sin(t * 3 + i) > 0.2) R(c, 122 + i * 7, 40 + (i % 3) * 3, 2, 1, '#fde68a');
  } else {
    vgrad(c, 120, 16, 56, 36, [[0, '#1e293b'], [1, '#334155']]);
    for (let i = 0; i < 7; i++) R(c, 122 + i * 8, 30 + (i % 3) * 4, 6, 22, '#0f172a');
    for (let i = 0; i < 14; i++) if (Math.sin(t + i * 2) > -0.3) R(c, 123 + ((i * 17) % 52), 32 + ((i * 7) % 18), 1, 1, '#fde68a');
  }
  R(c, 147, 14, 2, 40, '#1f2937');
  R(c, 118, 33, 60, 2, '#1f2937');
  // tablo / forma
  R(c, 20, 16, 26, 20, '#78350f');
  R(c, 22, 18, 22, 16, o.jersey || '#2563eb');
  R(c, 30, 22, 6, 6, '#fff');
  // kupa dolabı
  if (o.trophies) {
    R(c, 56, 24, 40, 34, '#3f2a1a');
    R(c, 58, 26, 36, 30, 'rgba(200,230,255,.18)');
    for (let i = 0; i < Math.min(6, o.trophies); i++) {
      const tx = 61 + (i % 3) * 11;
      const ty = 30 + Math.floor(i / 3) * 13;
      R(c, tx, ty, 6, 5, '#facc15');
      R(c, tx + 2, ty + 5, 2, 3, '#ca8a04');
      R(c, tx + 1, ty + 8, 4, 1, '#a16207');
    }
  }
  // lambader
  R(c, 104, 30, 1, 40, '#111');
  R(c, 99, 24, 11, 7, '#fef3c7');
  glow(c, 104, 30, 26, 'rgba(254,243,199,ALPHA)', 0.35 + Math.sin(t * 4) * 0.02);
  // bitki
  R(c, 6, 60, 10, 12, '#9a3412');
  for (let i = 0; i < 7; i++) disc(c, 11 + Math.sin(i * 2) * 4, 52 - i * 2, 3, i % 2 ? '#15803d' : '#16a34a');
  // kanepe (arka)
  R(c, 40, 60, 112, 16, '#475569');
  R(c, 36, 56, 8, 22, '#334155');
  R(c, 148, 56, 8, 22, '#334155');
  // zemin + halı
  vgrad(c, 0, 76, SW, 44, [[0, o.floor === 'marble' ? '#d6d3d1' : '#7c5235'], [1, o.floor === 'marble' ? '#a8a29e' : '#4a2f1e']]);
  R(c, 30, 86, 130, 26, 'rgba(185,28,28,.35)');
}

const SCENES = { cafe, bar, home };

/**
 * Sahneyi çizer.
 * @param {CanvasRenderingContext2D} c 192×120 mantıksal tuval
 * @param {{scene:'cafe'|'bar'|'home', palette?:string, npc?:{look:object, clothes:string[]}|null, me:{look:object, colors:string[]}, wall?:string, floor?:string, view?:string, trophies?:number, jersey?:string}} o
 */
export function drawScene(c, t, o) {
  c.imageSmoothingEnabled = false;
  (SCENES[o.scene] || cafe)(c, t, o);
  const tableCol = o.scene === 'bar' ? '#2d1d14' : o.scene === 'home' ? '#78350f' : '#6b4226';
  // karşıdaki kişi (masanın arkasında)
  if (o.npc) drawSeated(c, 132, 46, o.npc.look, o.npc.clothes, t, 1.5);
  // ön masa
  c.fillStyle = tableCol;
  c.beginPath();
  c.moveTo(70, 90);
  c.lineTo(SW, 86);
  c.lineTo(SW, SH);
  c.lineTo(58, SH);
  c.closePath();
  c.fill();
  R(c, 66, 88, SW - 66, 2, shade(tableCol.startsWith('#') ? tableCol : '#6b4226', 0.2));
  // masadaki içecekler
  if (o.scene === 'cafe') {
    for (const [cx, cy] of [[104, 96], [146, 94]]) {
      R(c, cx, cy, 8, 6, '#f5f5f4');
      R(c, cx + 8, cy + 1, 2, 3, '#e7e5e4');
      R(c, cx + 1, cy, 6, 1, '#7c4a2a');
      R(c, cx - 2, cy + 6, 12, 1, '#d6d3d1');
      for (let k = 0; k < 3; k++) {
        const sy = cy - 3 - ((t * 6 + k * 3) % 9);
        R(c, cx + 2 + Math.sin(t * 3 + k) * 1.5, sy, 1, 2, `rgba(255,255,255,${0.35 - ((t * 6 + k * 3) % 9) / 30})`);
      }
    }
    R(c, 124, 92, 2, 6, '#16a34a');
    disc(c, 125, 90, 2, '#f9a8d4');
  } else if (o.scene === 'bar') {
    for (const [cx, col] of [[100, '#f59e0b'], [150, '#38bdf8']]) {
      R(c, cx, 92, 7, 9, 'rgba(255,255,255,.35)');
      R(c, cx + 1, 95, 5, 5, col);
      R(c, cx + 5, 89, 1, 5, '#e5e7eb');
    }
  } else {
    R(c, 110, 94, 30, 4, '#e5e7eb');
    for (let i = 0; i < 5; i++) R(c, 112 + i * 5, 92, 3, 2, ['#f59e0b', '#ef4444', '#fde68a'][i % 3]);
  }
  // oyuncu (arkadan, önde)
  drawPlayerBack(c, 36, 66, o.me.look, o.me.colors);
}

// Ev planı çizimi (homeCanvas.js) aynı piksel yardımcılarını kullanır
export { R as px, disc, vgrad, glow, shade, rng };
