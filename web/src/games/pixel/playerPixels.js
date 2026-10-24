// PİKSEL OYUNCU — saf ızgara üretici (tuval yok → Node'da test edilir).
// Atlas'taki piksel taraftarlarla aynı tarz: büyük kafa (chibi), 1 piksel siyah dış hat, düz renk + tek ton gölge.
// Yönler: 'down' (önden, kameraya bakar), 'up' (arkadan, sırtında numara), 'side' (sağa bakar; sola için çevrilir).
// Kareler: idle, run0–run3 (koşu döngüsü), lunge (uzanma), ready (kaleci/kollar yukarı), kick.
// Görünüş (look): ten, saç modeli ve rengi, forma (desen), şort, tozluk, krampon, eldiven, saç bandı, uzun kol, numara.
import { BALL_DESIGNS } from '../../core/matchBall.js';

export const PW = 20;
export const PH = 28;
export const OUTLINE = '#14110f';
const EYE = '#1b1715';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Renk açma/koyulaştırma: k > 0 açar, k < 0 koyulaştırır. */
export function shade(hex, k) {
  const h = String(hex || '#888888').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const v = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const out = v.map((c) => Math.round(clamp(k >= 0 ? c + (255 - c) * k : c * (1 + k), 0, 255)));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const lum = (hex) => {
  const h = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const HAIR_STYLES = ['short', 'buzz', 'curly', 'long', 'mohawk', 'bald'];

export function defaultLook(o = {}) {
  return {
    skin: '#e8b58f',
    hair: 'short',
    hairColor: '#2a1a10',
    kit: { body: '#2563eb', accent: '#ffffff', pattern: 'solid', shorts: '#ffffff', socks: '#2563eb' },
    boots: { main: '#16181d', accent: '#e5e7eb' },
    gloves: null,
    band: null,
    longSleeve: false,
    number: '',
    ...o,
  };
}

// 3×5 rakam yazı tipi (sırttaki numara)
const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

function makeGrid() {
  const px = new Array(PW * PH).fill(null);
  const set = (x, y, c) => {
    if (c && x >= 0 && y >= 0 && x < PW && y < PH) px[y * PW + x] = c;
  };
  const clear = (x, y) => {
    if (x >= 0 && y >= 0 && x < PW && y < PH) px[y * PW + x] = null;
  };
  const get = (x, y) => (x >= 0 && y >= 0 && x < PW && y < PH ? px[y * PW + x] : null);
  const rect = (x, y, w, h, c) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c);
  };
  /** 2 piksel kalınlığında çizgi (bacak/kol parçaları) */
  const line = (x0, y0, x1, y1, c, wdt = 2) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      rect(x, y, wdt, 1, c);
    }
  };
  return { px, set, clear, get, rect, line };
}

/** Dış hat: dolu bir komşusu olan her boş piksel siyah olur (piksel sanat çerçevesi). */
function outline(g) {
  const add = [];
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      if (g.get(x, y)) continue;
      if (g.get(x - 1, y) || g.get(x + 1, y) || g.get(x, y - 1) || g.get(x, y + 1)) add.push([x, y]);
    }
  }
  for (const [x, y] of add) g.set(x, y, OUTLINE);
}

// ─────────────────────────────────────────────────────────────
// KAFA
// ─────────────────────────────────────────────────────────────
const HEAD_ROWS = [[7, 12], [6, 13], [5, 14], [5, 14], [5, 14], [5, 14], [5, 14], [5, 14], [6, 13], [7, 12]];

function headShape(g, oy, c) {
  HEAD_ROWS.forEach(([a, b], r) => {
    for (let x = a; x <= b; x++) g.set(x, oy + r, c);
  });
}
const inHead = (x, r) => r >= 0 && r < HEAD_ROWS.length && x >= HEAD_ROWS[r][0] && x <= HEAD_ROWS[r][1];

function drawHead(g, L, dir, oy) {
  const skin = L.skin;
  const hairC = L.hairColor;
  const hl = shade(hairC, 0.28);
  const hsd = shade(hairC, -0.25);
  const style = HAIR_STYLES.includes(L.hair) ? L.hair : 'short';
  const H = (x, r, c = hairC) => g.set(x, oy + r, c);
  const fillHeadRows = (r0, r1, c = hairC) => {
    for (let r = r0; r <= r1; r++) for (let x = HEAD_ROWS[r][0]; x <= HEAD_ROWS[r][1]; x++) H(x, r, c);
  };
  const stubble = shade(skin, -0.22);

  if (dir === 'side') {
    headShape(g, oy, skin);
    g.set(15, oy + 5, skin); // burun
    g.set(12, oy + 4, EYE);
    g.set(12, oy + 5, EYE);
    g.set(13, oy + 7, shade(skin, -0.25)); // ağız
    if (style === 'short') {
      fillHeadRows(0, 2);
      for (let r = 3; r <= 6; r++) for (let x = 5; x <= 8; x++) H(x, r);
      for (let x = 9; x <= 11; x++) H(x, 3);
      H(5, 7);
      H(6, 7);
    } else if (style === 'buzz') {
      fillHeadRows(0, 1);
      for (let r = 2; r <= 5; r++) for (let x = 5; x <= 8; x++) if ((x + r) % 2 === 0) H(x, r, hsd);
    } else if (style === 'curly') {
      for (const x of [6, 8, 10, 12]) g.set(x, oy - 1, hairC);
      fillHeadRows(0, 3);
      for (let r = 4; r <= 7; r++) for (let x = 5; x <= 8; x++) H(x, r);
      for (const [x, r] of [[7, 1], [10, 0], [12, 2], [6, 5]]) H(x, r, hl);
    } else if (style === 'long') {
      fillHeadRows(0, 2);
      for (let x = 5; x <= 10; x++) H(x, 3);
      for (let r = 4; r <= 9; r++) for (let x = 4; x <= 8; x++) H(x, r);
      for (let x = 5; x <= 7; x++) { g.set(x, oy + 10, hairC); g.set(x, oy + 11, hairC); }
    } else if (style === 'mohawk') {
      for (let x = 8; x <= 11; x++) g.set(x, oy - 2, hairC);
      for (let x = 7; x <= 12; x++) g.set(x, oy - 1, hairC);
      fillHeadRows(0, 0);
      for (let r = 1; r <= 4; r++) for (let x = 5; x <= 8; x++) if ((x + r) % 2 === 0) H(x, r, stubble);
      H(9, -1, hl);
    } else {
      g.set(8, oy + 1, shade(skin, 0.3));
    }
    if (style !== 'long') {
      g.set(8, oy + 4, shade(skin, -0.12)); // kulak
      g.set(8, oy + 5, shade(skin, -0.12));
    }
    if (L.band) for (let x = 5; x <= 14; x++) if (inHead(x, 3)) H(x, 3, L.band);
    return;
  }

  if (dir === 'up') {
    headShape(g, oy, skin);
    g.set(4, oy + 4, skin);
    g.set(4, oy + 5, skin);
    g.set(15, oy + 4, skin);
    g.set(15, oy + 5, skin);
    if (style === 'short') {
      fillHeadRows(0, 7);
      for (let x = 7; x <= 12; x++) H(x, 8, hsd);
    } else if (style === 'buzz') {
      fillHeadRows(0, 6, hsd);
      for (let r = 1; r <= 6; r++) for (let x = HEAD_ROWS[r][0]; x <= HEAD_ROWS[r][1]; x++) if ((x + r) % 2 === 0) H(x, r, hairC);
    } else if (style === 'curly') {
      for (const x of [6, 8, 10, 12]) g.set(x, oy - 1, hairC);
      fillHeadRows(0, 8);
      for (const [x, r] of [[7, 2], [11, 3], [9, 5], [6, 6], [12, 7]]) H(x, r, hl);
    } else if (style === 'long') {
      fillHeadRows(0, 9);
      for (let x = 4; x <= 15; x++) for (let r = 4; r <= 9; r++) if (x === 4 || x === 15) H(x, r);
      for (let x = 6; x <= 13; x++) { g.set(x, oy + 10, hairC); g.set(x, oy + 11, hairC); }
      for (let r = 2; r <= 8; r += 3) H(9, r, hl);
    } else if (style === 'mohawk') {
      for (let r = -2; r <= 8; r++) { g.set(9, oy + r, hairC); g.set(10, oy + r, hairC); }
      for (let r = 1; r <= 7; r++) for (let x = HEAD_ROWS[r][0]; x <= HEAD_ROWS[r][1]; x++) if (x < 9 || x > 10) if ((x + r) % 2 === 0) H(x, r, stubble);
    } else {
      g.set(8, oy + 1, shade(skin, 0.3));
      g.set(9, oy + 1, shade(skin, 0.3));
    }
    if (L.band) for (let x = 5; x <= 14; x++) H(x, 3, L.band);
    return;
  }

  // 'down' — önden
  headShape(g, oy, skin);
  g.set(4, oy + 4, skin);
  g.set(4, oy + 5, skin);
  g.set(15, oy + 4, skin);
  g.set(15, oy + 5, skin);
  if (style === 'short') {
    fillHeadRows(0, 2);
    for (const x of [5, 6, 7, 8, 13, 14]) H(x, 3);
    H(5, 4);
    H(14, 4);
    H(8, 1, hl);
    H(9, 1, hl);
  } else if (style === 'buzz') {
    fillHeadRows(0, 0);
    for (let x = HEAD_ROWS[1][0]; x <= HEAD_ROWS[1][1]; x++) H(x, 1, x % 2 ? hairC : hsd);
    for (const x of [5, 14]) { H(x, 2, hsd); H(x, 3, hsd); }
  } else if (style === 'curly') {
    for (const x of [6, 8, 10, 12]) g.set(x, oy - 1, hairC);
    fillHeadRows(0, 2);
    for (const x of [5, 6, 7, 12, 13, 14]) H(x, 3);
    for (const x of [5, 14]) { H(x, 4); H(x, 5); }
    for (const [x, r] of [[7, 1], [11, 0], [9, 2], [13, 1]]) H(x, r, hl);
  } else if (style === 'long') {
    fillHeadRows(0, 2);
    for (const x of [5, 6, 7, 8, 12, 13, 14]) H(x, 3);
    for (let r = 4; r <= 9; r++) { H(4, r); H(5, r); H(14, r); H(15, r); }
    g.set(4, oy + 10, hairC);
    g.set(15, oy + 10, hairC);
    H(8, 1, hl);
  } else if (style === 'mohawk') {
    for (let r = -2; r <= 2; r++) { g.set(9, oy + r, hairC); g.set(10, oy + r, hairC); }
    g.set(9, oy - 1, hl);
    for (let r = 0; r <= 2; r++) for (let x = HEAD_ROWS[r][0]; x <= HEAD_ROWS[r][1]; x++) if ((x < 9 || x > 10) && (x + r) % 2 === 0) H(x, r, stubble);
  } else {
    g.set(8, oy + 1, shade(skin, 0.3));
    g.set(9, oy + 1, shade(skin, 0.3));
  }
  if (L.band) for (let x = 5; x <= 14; x++) H(x, 3, L.band);
  // yüz
  g.set(7, oy + 4, EYE);
  g.set(7, oy + 5, EYE);
  g.set(12, oy + 4, EYE);
  g.set(12, oy + 5, EYE);
  g.set(9, oy + 7, shade(skin, -0.25));
  g.set(10, oy + 7, shade(skin, -0.25));
  g.set(6, oy + 6, shade(skin, -0.08));
  g.set(13, oy + 6, shade(skin, -0.08));
}

// ─────────────────────────────────────────────────────────────
// GÖVDE
// ─────────────────────────────────────────────────────────────
function shirtColor(L, x, y, x0, x1, y0) {
  const k = L.kit;
  const rx = x - x0;
  const ry = y - y0;
  switch (k.pattern) {
    case 'stripes': return rx % 4 === 1 || rx % 4 === 2 ? k.accent : k.body;
    case 'hoops': return ry === 2 || ry === 4 ? k.accent : k.body;
    case 'half': return x <= (x0 + x1) / 2 ? k.body : k.accent;
    case 'sash': return Math.abs(rx - ry * ((x1 - x0) / 5)) < 1.3 ? k.accent : k.body;
    default: return k.body;
  }
}

function torso(g, L, x0, x1, y0, y1, { shadeRight = true, shadeLeft = false } = {}) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let c = shirtColor(L, x, y, x0, x1, y0);
      if ((shadeRight && x >= x1 - 1) || (shadeLeft && x <= x0 + 1)) c = shade(c, -0.18);
      if (y === y1) c = shade(c, -0.1);
      g.set(x, y, c);
    }
  }
}

function numberOnBack(g, L, cx, y) {
  const s = String(L.number ?? '').replace(/\D/g, '').slice(0, 2);
  if (!s) return;
  const body = L.kit.body;
  const col = L.kit.pattern === 'solid' ? (lum(L.kit.accent) - lum(body) > 0.25 || lum(body) - lum(L.kit.accent) > 0.25 ? L.kit.accent : lum(body) > 0.55 ? '#14110f' : '#ffffff') : lum(body) > 0.55 ? '#14110f' : '#ffffff';
  const total = s.length * 3 + (s.length - 1);
  let x = Math.round(cx - total / 2);
  for (const ch of s) {
    const m = DIGITS[ch];
    m.forEach((row, j) => row.split('').forEach((b, i) => { if (b === '1') g.set(x + i, y + j, col); }));
    x += 4;
  }
}

/** Kol: omuzdan ele; uzun kol forma rengini kola uzatır, eldiven eli boyar. */
function arm(g, L, pts, { far = false } = {}) {
  const k = far ? -0.22 : 0;
  const sleeve = shade(L.kit.body, k - 0.05);
  const skin = shade(L.skin, k);
  const fore = L.longSleeve ? sleeve : skin;
  const hand = L.gloves ? shade(L.gloves, k) : skin;
  const [a, b, c] = pts; // omuz, dirsek, el
  g.line(a[0], a[1], b[0], b[1], sleeve);
  g.line(b[0], b[1] + 1, c[0], c[1] - 1, fore);
  g.rect(c[0], c[1], 2, 1, hand);
}

/** Bacak: kalça → diz → ayak; dizde ten, altında tozluk, ayakta krampon. */
function leg(g, L, hip, knee, foot, { far = false, toe = 1 } = {}) {
  const k = far ? -0.22 : 0;
  const shorts = shade(L.kit.shorts, k);
  const skin = shade(L.skin, k);
  const sock = shade(L.kit.socks, k);
  const boot = shade(L.boots.main, k);
  g.line(hip[0], hip[1], knee[0], knee[1] - 1, shorts);
  g.rect(knee[0], knee[1], 2, 1, skin);
  g.line(knee[0], knee[1] + 1, foot[0], foot[1] - 1, sock);
  // krampon: 3 piksel, burun yönüne
  const bx = toe > 0 ? foot[0] : foot[0] - 1;
  g.rect(bx, foot[1], 3, 1, boot);
  g.set(bx + (toe > 0 ? 1 : 1), foot[1], shade(L.boots.accent, k));
}

function frontBody(g, L, frame, dir) {
  const oy = 13;
  const run = frame.startsWith('run') ? Number(frame.slice(3)) : -1;
  const bob = run === 0 || run === 2 ? -1 : 0;
  const y = (v) => v + bob;
  // kollar (gövdenin arkasında başlar)
  const swing = run === 0 ? [-1, 1] : run === 2 ? [1, -1] : [0, 0];
  if (frame === 'ready') {
    arm(g, L, [[3, y(oy + 1)], [2, y(oy - 2)], [2, y(oy - 4)]]);
    arm(g, L, [[15, y(oy + 1)], [16, y(oy - 2)], [16, y(oy - 4)]]);
    if (L.gloves) { g.rect(1, y(oy - 5), 3, 2, L.gloves); g.rect(16, y(oy - 5), 3, 2, L.gloves); }
  } else {
    // kollar gövdeden bir piksel ayrık: aradaki boşluk dış hat olur
    arm(g, L, [[2, y(oy)], [2, y(oy + 2 + swing[0])], [2, y(oy + 4 + swing[0])]]);
    arm(g, L, [[16, y(oy)], [16, y(oy + 2 + swing[1])], [16, y(oy + 4 + swing[1])]]);
    g.set(4, y(oy), shade(L.kit.body, -0.05));
    g.set(15, y(oy), shade(L.kit.body, -0.2));
    g.set(3, y(oy), shade(L.kit.body, -0.05));
    g.set(16, y(oy), shade(L.kit.body, -0.2));
  }
  // gövde
  torso(g, L, 5, 14, y(oy), y(oy + 5));
  // yaka
  if (dir === 'down') {
    g.set(8, y(oy), L.kit.accent);
    g.set(11, y(oy), L.kit.accent);
    g.set(9, y(oy), shade(L.skin, -0.1));
    g.set(10, y(oy), shade(L.skin, -0.1));
    g.set(9, y(oy + 1), L.kit.accent);
    g.set(10, y(oy + 1), L.kit.accent);
  } else {
    for (let x = 8; x <= 11; x++) g.set(x, y(oy), L.kit.accent);
    numberOnBack(g, L, 10, y(oy + 1));
  }
  // şort
  for (let yy = oy + 6; yy <= oy + 8; yy++) for (let x = 6; x <= 13; x++) g.set(x, y(yy), x >= 12 ? shade(L.kit.shorts, -0.15) : L.kit.shorts);
  g.clear(9, y(oy + 8));
  g.clear(10, y(oy + 8));
  // bacaklar (öne/arkaya bakış: dikey; koşuda biri kalkar)
  const lift = (side) => (run === 0 && side === 'L') || (run === 2 && side === 'R') ? 2 : run === 1 || run === 3 ? 0 : 0;
  for (const [side, x] of [['L', 6], ['R', 12]]) {
    const up = lift(side);
    const kx = x;
    const ky = y(oy + 9) - up;
    // diz
    g.rect(kx, ky, 2, 1, L.skin);
    // tozluk
    g.rect(kx, ky + 1, 2, 2, L.kit.socks);
    // krampon
    g.rect(side === 'L' ? kx - 1 : kx, ky + 3, 3, 1, L.boots.main);
    g.set(side === 'L' ? kx : kx + 1, ky + 3, L.boots.accent);
    if (frame === 'kick' && side === 'R') {
      // vuran ayak: geri çekilmiş
      for (let j = 1; j <= 3; j++) for (let i = 0; i < 3; i++) g.clear(kx + i, ky + j);
      g.rect(kx + 1, ky + 1, 2, 1, L.kit.socks);
      g.rect(kx + 1, ky + 2, 3, 1, L.boots.main);
    }
  }
}

function sideBody(g, L, frame) {
  const oy = 13;
  const run = frame.startsWith('run') ? Number(frame.slice(3)) : -1;
  const lunge = frame === 'lunge';
  const bob = run === 1 || run === 3 ? -1 : lunge ? 1 : 0;
  const y = (v) => v + bob;
  // bacak pozları: [kalça, diz, ayak]
  const STRIDE = { front: [[10, y(21)], [12, y(23)], [13, 26]], back: [[8, y(21)], [7, y(23)], [5, 25]] };
  const PASS = { front: [[9, y(21)], [10, y(23)], [10, 26]], back: [[9, y(21)], [10, y(22)], [8, 24]] };
  const IDLE = { front: [[10, y(21)], [10, y(23)], [10, 26]], back: [[8, y(21)], [8, y(23)], [8, 26]] };
  const LUNGE = { front: [[10, y(21)], [13, y(23)], [16, 26]], back: [[8, y(21)], [6, y(23)], [4, 26]] };
  let near;
  let far;
  if (lunge) { near = LUNGE.front; far = LUNGE.back; }
  else if (run === 0) { near = STRIDE.front; far = STRIDE.back; }
  else if (run === 1) { near = PASS.front; far = PASS.back; }
  else if (run === 2) { near = STRIDE.back; far = STRIDE.front; }
  else if (run === 3) { near = PASS.back; far = PASS.front; }
  else { near = IDLE.front; far = IDLE.back; }
  // uzak kol + uzak bacak (koyu)
  const armFwd = [[10, y(oy)], [12, y(oy + 2)], [13, y(oy + 3)]];
  const armBack = [[9, y(oy)], [7, y(oy + 2)], [6, y(oy + 3)]];
  const armDown = [[9, y(oy)], [9, y(oy + 2)], [9, y(oy + 4)]];
  const nearArm = lunge ? [[10, y(oy)], [12, y(oy + 1)], [14, y(oy + 1)]] : run === 0 ? armBack : run === 2 ? armFwd : armDown;
  const farArm = lunge ? [[9, y(oy)], [7, y(oy + 1)], [5, y(oy + 1)]] : run === 0 ? armFwd : run === 2 ? armBack : armDown;
  arm(g, L, farArm, { far: true });
  leg(g, L, far[0], far[1], far[2], { far: true });
  // gövde
  torso(g, L, 6, 12, y(oy), y(oy + 5), { shadeRight: false, shadeLeft: true });
  g.set(11, y(oy), L.kit.accent);
  g.set(12, y(oy), L.kit.accent);
  for (let yy = oy + 6; yy <= oy + 7; yy++) for (let x = 6; x <= 12; x++) g.set(x, y(yy), x <= 7 ? shade(L.kit.shorts, -0.15) : L.kit.shorts);
  leg(g, L, near[0], near[1], near[2]);
  arm(g, L, nearArm);
}

/**
 * Oyuncu ızgarası. @returns {{w:number,h:number,px:(string|null)[]}}
 */
export function buildPlayer(look, dir = 'down', frame = 'idle') {
  const L = defaultLook(look);
  L.kit = { ...defaultLook().kit, ...(look?.kit || {}) };
  L.boots = { ...defaultLook().boots, ...(look?.boots || {}) };
  const g = makeGrid();
  if (dir === 'side') {
    sideBody(g, L, frame);
    g.rect(9, 12, 3, 1, L.skin); // boyun
    drawHead(g, L, 'side', frame.startsWith('run') && (frame === 'run1' || frame === 'run3') ? 1 : 2);
  } else {
    frontBody(g, L, frame, dir);
    const bob = frame === 'run0' || frame === 'run2' ? -1 : 0;
    g.rect(8, 12 + bob, 4, 1, L.skin);
    drawHead(g, L, dir, 2 + bob);
  }
  outline(g);
  return { w: PW, h: PH, px: g.px };
}

/** Piksel top (9×9), iki dönüş karesi. variant 'orange': karlı maçların turuncu topu. */
export function buildBall(frame = 0, variant = 'white') {
  const M = frame % 2 === 0
    ? ['..OOOOO..', '.OKWWWKO.', 'OKKWWWKKO', 'OWWWKWWWO', 'OWWKKKWSO', 'OWWWKWWSO', 'OKKWWWKKO', '.OKWWSKO.', '..OOOOO..']
    : ['..OOOOO..', '.OWWKWWO.', 'OWWKKKWWO', 'OKWWKWWKO', 'OKKWWWKKO', 'OKWWWWWKO', 'OWWWKWWSO', '.OWKKKSO.', '..OOOOO..'];
  const design = BALL_DESIGNS[variant] || BALL_DESIGNS.white;
  const C = { O: OUTLINE, W: design.light, K: design.dark, S: design.shade };
  const px = [];
  for (let y = 0; y < M.length; y++) {
    for (let x = 0; x < M[y].length; x++) {
      const ch = M[y][x];
      const accent = ch === 'W' || ch === 'S';
      const pattern = design.pattern;
      const mark = pattern === 'diagonal' ? (x - y + 18) % 5 === 0
        : pattern === 'cross' ? x === 4 || y === 4
          : pattern === 'vertical' ? x === 3 || x === 5
            : pattern === 'horizontal' ? y === 3 || y === 5
              : pattern === 'geometric' ? (x + y) % 4 === 0 || (x - y + 18) % 5 === 0
                : false;
      px.push(accent && mark ? design.accent : C[ch] || null);
    }
  }
  return { w: 9, h: 9, px };
}

/** Hıza göre yön: yatay baskınsa yan (sola için flip), değilse yukarı/aşağı. */
export function dirFromVelocity(vx, vy, prev = 'down') {
  const sp = Math.hypot(vx, vy);
  if (sp < 0.25) return { dir: prev === 'left' || prev === 'right' ? 'side' : prev, flip: prev === 'left' };
  if (Math.abs(vx) > Math.abs(vy) * 1.15) return { dir: 'side', flip: vx < 0 };
  return { dir: vy < 0 ? 'up' : 'down', flip: false };
}

/** Koşu karesi: faz (radyan benzeri sayaç) → run0..run3; yavaşsa idle. */
export function runFrame(phase, speed) {
  if (speed < 0.35) return 'idle';
  return `run${Math.floor(((phase % 4) + 4) % 4)}`;
}
