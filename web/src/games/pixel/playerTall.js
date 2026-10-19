// GERÇEKÇİ ORANLI PİKSEL OYUNCU — 18×34 ızgara (yayın açısı tarzı): küçük kafa, uzun bacak, kol/omuz ayrımı,
// formada yaka + arma, şortta gölge, tozlukta bant, kramponda şerit. Saf ızgara üretici (Node'da test edilir).
// API ve kareler eski (chibi) üreticiyle aynı: yön 'down' | 'up' | 'side', kare idle | run0–3 | lunge | ready | kick.
import { defaultLook, HAIR_STYLES, OUTLINE, shade } from './playerPixels.js';

export const TW = 18;
export const TH = 34;
/** Ayakların değdiği satır (altındaki satır dış hat) */
export const FOOT_ROW = 32;
const EYE = '#1b1715';

const lum = (hex) => {
  const h = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

function grid() {
  const px = new Array(TW * TH).fill(null);
  const ok = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH;
  const set = (x, y, c) => { if (c && ok(x, y)) px[y * TW + x] = c; };
  const get = (x, y) => (ok(x, y) ? px[y * TW + x] : null);
  const clear = (x, y) => { if (ok(x, y)) px[y * TW + x] = null; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  /** w piksel kalınlığında çizgi (uzuv) */
  const line = (x0, y0, x1, y1, c, w = 2) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      rect(x, y, w, 1, typeof c === 'function' ? c(y, i / n) : c);
    }
  };
  return { px, set, get, clear, rect, line };
}

function outline(g) {
  const add = [];
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (g.get(x, y)) continue;
    if (g.get(x - 1, y) || g.get(x + 1, y) || g.get(x, y - 1) || g.get(x, y + 1)) add.push([x, y]);
  }
  for (const [x, y] of add) g.set(x, y, OUTLINE);
}

// 3×5 rakamlar (sırt numarası)
const DIGITS = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

function numberColor(L) {
  const body = L.kit.body;
  const acc = L.kit.accent;
  if (L.kit.pattern === 'solid' && Math.abs(lum(acc) - lum(body)) > 0.25) return acc;
  return lum(body) > 0.55 ? '#14110f' : '#ffffff';
}

function shirtAt(L, x, y, x0, x1, y0) {
  const k = L.kit;
  const rx = x - x0;
  const ry = y - y0;
  switch (k.pattern) {
    case 'stripes': return rx % 3 === 1 ? k.accent : k.body;
    case 'hoops': return ry % 3 === 2 ? k.accent : k.body;
    case 'half': return x <= (x0 + x1) / 2 ? k.body : k.accent;
    case 'sash': return Math.abs(rx - ry * ((x1 - x0 + 1) / 8)) < 1.1 ? k.accent : k.body;
    default: return k.body;
  }
}

// ───────────────────────────── KAFA ─────────────────────────────
// satır 2–7 (6 satır), saç 0–3
const HEAD_F = [[7, 10], [6, 11], [6, 11], [6, 11], [6, 11], [7, 10]];
const HEAD_S = [[7, 10], [6, 11], [6, 11], [6, 12], [6, 11], [7, 10]];

function head(g, L, dir, oy) {
  const skin = L.skin;
  const sk2 = shade(skin, -0.16);
  const hc = L.hairColor;
  const hl = shade(hc, 0.3);
  const hd = shade(hc, -0.28);
  const style = HAIR_STYLES.includes(L.hair) ? L.hair : 'short';
  const rows = dir === 'side' ? HEAD_S : HEAD_F;
  rows.forEach(([a, b], r) => { for (let x = a; x <= b; x++) g.set(x, oy + r, x === b && dir !== 'side' ? sk2 : skin); });
  const H = (x, r, c = hc) => g.set(x, oy + r, c);
  const row = (r, a, b, c = hc) => { for (let x = a; x <= b; x++) H(x, r, c); };

  if (dir === 'side') {
    // yüz sağa: göz, kaş, burun, ağız, kulak
    H(10, 2, EYE); H(10, 1, shade(hc, -0.1));
    H(12, 3, skin); H(11, 4, sk2);
    H(10, 4, shade(skin, -0.3));
    H(8, 2, sk2); H(8, 3, sk2); // kulak
    if (style === 'short') { row(-1, 7, 10); row(0, 6, 11); row(1, 6, 8); row(2, 6, 7); H(6, 3); H(9, -1, hl); }
    else if (style === 'buzz') { row(-1, 7, 10, hd); row(0, 6, 10, hd); for (let r = 1; r <= 2; r++) for (let x = 6; x <= 7; x++) if ((x + r) % 2 === 0) H(x, r, hd); }
    else if (style === 'curly') { H(7, -2); H(9, -2); row(-1, 6, 11); row(0, 5, 11); row(1, 5, 8); row(2, 5, 7); row(3, 5, 6); H(8, -1, hl); H(6, 1, hl); }
    else if (style === 'long') { row(-1, 7, 10); row(0, 6, 11); row(1, 5, 8); for (let r = 2; r <= 7; r++) row(r, 5, 6 + (r < 5 ? 1 : 0)); H(9, -1, hl); }
    else if (style === 'mohawk') { row(-2, 7, 10); row(-1, 6, 10); for (let r = 0; r <= 2; r++) for (let x = 6; x <= 8; x++) if ((x + r) % 2 === 1) H(x, r, shade(skin, -0.25)); H(8, -2, hl); }
    else { H(8, 0, shade(skin, 0.28)); }
    if (L.band) row(1, 6, 11, L.band);
    return;
  }

  // önden / arkadan: kulaklar
  for (const x of [5, 12]) { H(x, 2, sk2); H(x, 3, sk2); }
  if (dir === 'up') {
    if (style === 'short') { row(-1, 7, 10); for (let r = 0; r <= 3; r++) row(r, 6, 11); row(4, 7, 10, hd); H(8, 0, hl); }
    else if (style === 'buzz') { for (let r = -1; r <= 3; r++) for (let x = HEAD_F[Math.max(0, r)][0]; x <= HEAD_F[Math.max(0, r)][1]; x++) H(x, r, (x + r) % 2 ? hc : hd); }
    else if (style === 'curly') { H(7, -2); H(10, -2); row(-1, 6, 11); for (let r = 0; r <= 4; r++) row(r, 5, 12); H(8, 0, hl); H(10, 2, hl); }
    else if (style === 'long') { row(-1, 7, 10); for (let r = 0; r <= 4; r++) row(r, 5, 12); for (let r = 5; r <= 8; r++) row(r, 6, 11); H(9, 1, hl); H(8, 4, hl); }
    else if (style === 'mohawk') { for (let r = -2; r <= 4; r++) { H(8, r); H(9, r); } for (let r = 0; r <= 3; r++) for (const x of [6, 7, 10, 11]) if ((x + r) % 2) H(x, r, shade(skin, -0.25)); }
    else { H(8, 0, shade(skin, 0.28)); H(9, 0, shade(skin, 0.28)); }
    if (L.band) row(1, 5, 12, L.band);
    return;
  }
  // önden yüz
  if (style === 'short') { row(-1, 7, 10); row(0, 6, 11); H(6, 1); H(7, 1); H(11, 1); H(8, -1, hl); }
  else if (style === 'buzz') { row(-1, 7, 10, hd); for (let x = 6; x <= 11; x++) H(x, 0, x % 2 ? hc : hd); H(6, 1, hd); H(11, 1, hd); }
  else if (style === 'curly') { H(7, -2); H(10, -2); row(-1, 6, 11); row(0, 5, 12); H(5, 1); H(6, 1); H(11, 1); H(12, 1); H(8, -1, hl); H(10, 0, hl); }
  else if (style === 'long') { row(-1, 7, 10); row(0, 6, 11); H(6, 1); H(11, 1); for (let r = 1; r <= 6; r++) { H(5, r); H(12, r); } H(8, -1, hl); }
  else if (style === 'mohawk') { for (let r = -2; r <= 0; r++) { H(8, r); H(9, r); } H(8, -2, hl); for (const x of [6, 7, 10, 11]) if (x % 2) H(x, 0, shade(skin, -0.25)); }
  else { H(8, 0, shade(skin, 0.28)); }
  if (L.band) row(1, 6, 11, L.band);
  // kaş + göz + burun + ağız
  H(7, 1, style === 'bald' ? sk2 : shade(hc, 0.05));
  H(10, 1, style === 'bald' ? sk2 : shade(hc, 0.05));
  H(7, 2, EYE); H(10, 2, EYE);
  H(8, 3, sk2);
  H(8, 4, shade(skin, -0.32)); H(9, 4, shade(skin, -0.32));
}

// ───────────────────────────── GÖVDE ─────────────────────────────
function torsoFront(g, L, oy, dir) {
  // omuz 5–12, bel 6–11 (satır oy..oy+7)
  for (let r = 0; r < 8; r++) {
    const a = r < 6 ? 5 : 6;
    const b = r < 6 ? 12 : 11;
    for (let x = a; x <= b; x++) {
      let c = shirtAt(L, x, oy + r, 5, 12, oy);
      if (x >= b - 1) c = shade(c, -0.2);
      else if (x === a) c = shade(c, 0.08);
      if (r === 7) c = shade(c, -0.12);
      g.set(x, oy + r, c);
    }
  }
  const acc = L.kit.accent;
  if (dir === 'down') {
    // V yaka + arma + sponsor bandı
    g.set(7, oy, acc); g.set(10, oy, acc);
    g.set(8, oy, shade(L.skin, -0.1)); g.set(9, oy, shade(L.skin, -0.1));
    g.set(8, oy + 1, acc); g.set(9, oy + 1, acc);
    g.set(10, oy + 2, acc); g.set(10, oy + 3, shade(acc, -0.2));
    const band = lum(L.kit.body) > 0.55 ? shade(L.kit.body, -0.3) : shade(L.kit.body, 0.35);
    for (let x = 7; x <= 10; x++) g.set(x, oy + 4, band);
  } else {
    for (let x = 7; x <= 10; x++) g.set(x, oy, acc);
    const s = String(L.number ?? '').replace(/\D/g, '').slice(0, 2);
    if (s) {
      const col = numberColor(L);
      const total = s.length * 3 + (s.length - 1);
      let x = Math.round(9 - total / 2);
      for (const ch of s) {
        DIGITS[ch].forEach((rowS, j) => rowS.split('').forEach((b, i) => { if (b === '1') g.set(x + i, oy + 2 + j, col); }));
        x += 4;
      }
    }
  }
}

/** Kol (önden): omuz kolluğu + önkol + el; uzun kolda forma rengi bileğe iner. */
function armFront(g, L, side, pose, oy) {
  const sl = side === 'L' ? 3 : 13; // kolluk
  const ax = side === 'L' ? 2 : 14; // önkol
  const sleeve = shade(L.kit.body, side === 'R' ? -0.22 : 0);
  const skin = shade(L.skin, side === 'R' ? -0.12 : 0);
  const fore = L.longSleeve ? sleeve : skin;
  const hand = L.gloves || skin;
  if (pose === 'up') {
    g.rect(sl, oy - 1, 2, 3, sleeve);
    g.rect(side === 'L' ? 2 : 14, oy - 5, 2, 4, fore);
    g.rect(side === 'L' ? 1 : 14, oy - 8, 3, L.gloves ? 3 : 2, hand);
    return;
  }
  if (pose === 'out') {
    g.rect(sl, oy, 2, 2, sleeve);
    g.rect(side === 'L' ? 0 : 15, oy + 1, 3, 2, fore);
    g.rect(side === 'L' ? 0 : 16, oy + 3, 2, 1, hand);
    return;
  }
  const dy = pose === 'fwd' ? -1 : pose === 'back' ? 1 : 0;
  g.rect(sl, oy, 2, 3, sleeve);
  g.clear(side === 'L' ? 3 : 14, oy);
  g.rect(ax, oy + 3, 2, 3 + dy, fore);
  g.rect(ax, oy + 6 + dy, 2, L.gloves ? 2 : 1, hand);
}

function legFront(g, L, side, lift, oy, { kick = false, spread = 0 } = {}) {
  // oy: şort altı (satır 21); diz oy+2; tozluk oy+3..; krampon iki satır
  const x = (side === 'L' ? 6 : 10) + (side === 'L' ? -spread : spread);
  const far = side === 'R';
  const skin = shade(L.skin, far ? -0.12 : 0);
  const sock = shade(L.kit.socks, far ? -0.15 : 0);
  const boot = L.boots.main;
  g.rect(x, oy, 2, 2, skin); // uyluk + diz
  g.rect(x, oy + 2, 2, 1, shade(L.kit.accent, far ? -0.15 : 0)); // tozluk bandı
  const footY = FOOT_ROW - 1 - Math.round(lift * 1.5);
  for (let y = oy + 3; y < footY; y++) g.rect(x, y, 2, 1, sock);
  const bx = side === 'L' ? x - 1 : x;
  g.rect(bx, footY, 3, 1, boot);
  g.set(side === 'L' ? x : x + 1, footY, L.boots.accent);
  g.rect(bx, footY + 1, 3, 1, shade(boot, -0.3));
  if (kick) {
    // vuran ayak öne kalkmış: krampon dışa ve yukarıda
    for (let y = footY - 3; y <= footY + 1; y++) for (let i = -1; i <= 3; i++) g.clear(bx + i, y);
    g.rect(x + 1, footY - 4, 2, 2, sock);
    g.rect(x + 1, footY - 2, 3, 2, boot);
    g.set(x + 2, footY - 2, L.boots.accent);
  }
}

function frontBody(g, L, frame, dir) {
  const run = frame.startsWith('run') ? Number(frame.slice(3)) : -1;
  const bob = run === 1 || run === 3 ? -1 : frame === 'lunge' ? 2 : 0;
  const oy = 9 + bob; // gövde başlangıcı
  const armPose = frame === 'ready' ? ['up', 'up'] : frame === 'lunge' ? ['out', 'out'] : run === 0 ? ['back', 'fwd'] : run === 2 ? ['fwd', 'back'] : ['down', 'down'];
  // arka plan: uzak kol (sağ) önce
  armFront(g, L, 'R', armPose[1], oy);
  armFront(g, L, 'L', armPose[0], oy);
  torsoFront(g, L, oy, dir);
  // şort (oy+8..oy+11)
  const sh = L.kit.shorts;
  for (let r = 0; r < 4; r++) for (let x = 5; x <= 12; x++) {
    if (r === 3 && (x === 8 || x === 9)) continue;
    g.set(x, oy + 8 + r, x >= 10 ? shade(sh, -0.16) : r === 0 ? shade(sh, -0.08) : sh);
  }
  if (lum(sh) > 0.6) { g.set(6, oy + 10, L.kit.body); } // şort kenarında küçük şerit
  const legTop = oy + 12;
  const spread = frame === 'lunge' ? 3 : 0;
  const liftL = run === 0 ? 2 : 0;
  const liftR = run === 2 ? 2 : 0;
  legFront(g, L, 'R', liftR, legTop, { kick: frame === 'kick', spread });
  legFront(g, L, 'L', liftL, legTop, { spread });
}

// ───────────────────────────── YANDAN ─────────────────────────────
function limbColorFor(L, far, kind) {
  const k = far ? -0.24 : 0;
  if (kind === 'shorts') return shade(L.kit.shorts, k - 0.04);
  if (kind === 'skin') return shade(L.skin, k);
  if (kind === 'sock') return shade(L.kit.socks, k);
  return null;
}

function legSide(g, L, hip, knee, ankle, { far = false, toe = 1 } = {}) {
  const shorts = limbColorFor(L, far, 'shorts');
  const skin = limbColorFor(L, far, 'skin');
  const sock = limbColorFor(L, far, 'sock');
  // kalça → diz: şort bölgesi (ilk %40) + ten
  g.line(hip[0], hip[1], knee[0], knee[1], (_y, t) => (t < 0.2 ? shorts : skin));
  // diz → ayak bileği: bant + tozluk
  g.line(knee[0], knee[1] + 1, ankle[0], ankle[1], (_y, t) => (t < 0.15 ? shade(L.kit.accent, far ? -0.24 : 0) : sock));
  // krampon 4 piksel öne doğru, altı koyu
  const bx = toe > 0 ? ankle[0] : ankle[0] - 2;
  const boot = shade(L.boots.main, far ? -0.2 : 0);
  g.rect(bx, ankle[1] + 1, 4, 1, boot);
  g.set(bx + (toe > 0 ? 2 : 1), ankle[1] + 1, shade(L.boots.accent, far ? -0.2 : 0));
  g.rect(bx, ankle[1] + 2, 4, 1, shade(boot, -0.35));
}

function armSide(g, L, sh, el, hd, far = false) {
  const k = far ? -0.24 : 0;
  const sleeve = shade(L.kit.body, k - 0.04);
  const skin = shade(L.skin, k);
  const fore = L.longSleeve ? sleeve : skin;
  g.line(sh[0], sh[1], el[0], el[1], sleeve);
  g.line(el[0], el[1] + 1, hd[0], hd[1], fore);
  g.rect(hd[0], hd[1] + 1, 2, L.gloves ? 2 : 1, L.gloves ? shade(L.gloves, k) : skin);
}

function sideBody(g, L, frame) {
  const run = frame.startsWith('run') ? Number(frame.slice(3)) : -1;
  const lunge = frame === 'lunge';
  const kick = frame === 'kick';
  const ready = frame === 'ready';
  const bob = run === 1 || run === 3 ? -1 : lunge ? 3 : 0;
  const lean = run >= 0 ? 1 : lunge ? 2 : 0;
  const Y = (v) => v + bob;
  const A = FOOT_ROW - 2; // ayak bileği (krampon iki satır altında)
  // bacak pozları [kalça, diz, bilek]
  const P = {
    idleN: [[8, Y(20)], [8, Y(24)], [8, A]], idleF: [[9, Y(20)], [10, Y(24)], [10, A]],
    strideF: [[8, Y(20)], [11, Y(24)], [12, A]], strideB: [[8, Y(20)], [6, Y(25)], [3, Y(28)]],
    passS: [[8, Y(20)], [9, Y(24)], [8, A]], passR: [[8, Y(20)], [11, Y(23)], [7, Y(27)]],
    kickN: [[9, Y(20)], [12, Y(22)], [15, Y(23)]], kickF: [[8, Y(20)], [8, Y(25)], [7, A]],
    lungeN: [[9, Y(19)], [12, Y(23)], [14, A]], lungeF: [[8, Y(19)], [5, Y(23)], [2, A]],
  };
  let near;
  let far;
  if (lunge) { near = P.lungeN; far = P.lungeF; }
  else if (kick) { near = P.kickN; far = P.kickF; }
  else if (run === 0) { near = P.strideF; far = P.strideB; }
  else if (run === 1) { near = P.passS; far = P.passR; }
  else if (run === 2) { near = P.strideB; far = P.strideF; }
  else if (run === 3) { near = P.passR; far = P.passS; }
  else { near = P.idleN; far = P.idleF; }
  // kollar [omuz, dirsek, el]
  const sh = [8 + lean, Y(10)];
  const ARM = {
    down: [sh, [8 + lean, Y(13)], [8 + lean, Y(15)]],
    fwd: [sh, [10 + lean, Y(13)], [12 + lean, Y(12)]],
    back: [sh, [6 + lean, Y(13)], [4 + lean, Y(15)]],
    up: [sh, [10, Y(7)], [11, Y(4)]],
    out: [sh, [11 + lean, Y(11)], [14, Y(11)]],
    outB: [sh, [5, Y(11)], [2, Y(11)]],
  };
  let nearArm;
  let farArm;
  if (ready) { nearArm = ARM.up; farArm = [sh, [9, Y(7)], [9, Y(4)]]; }
  else if (lunge) { nearArm = ARM.out; farArm = ARM.outB; }
  else if (kick) { nearArm = ARM.back; farArm = ARM.out; }
  else if (run === 0) { nearArm = ARM.back; farArm = ARM.fwd; }
  else if (run === 2) { nearArm = ARM.fwd; farArm = ARM.back; }
  else { nearArm = ARM.down; farArm = [sh, [9 + lean, Y(13)], [9 + lean, Y(15)]]; }

  armSide(g, L, ...farArm, true);
  legSide(g, L, ...far, { far: true });
  // gövde (satır 9..16), koşarken öne eğik
  for (let r = 0; r < 8; r++) {
    const off = lean && r < 4 ? lean : lean && r < 6 ? Math.max(0, lean - 1) : 0;
    const a = 6 + off;
    const b = (r < 6 ? 11 : 10) + off;
    for (let x = a; x <= b; x++) {
      let c = shirtAt(L, x, Y(9 + r), 6, 11, Y(9));
      if (x <= a) c = shade(c, -0.2);
      else if (x === b) c = shade(c, 0.06);
      if (r === 7) c = shade(c, -0.12);
      g.set(x, Y(9 + r), c);
    }
  }
  g.set(10 + lean, Y(9), L.kit.accent);
  g.set(11 + lean, Y(9), L.kit.accent);
  // şort (satır 17..19)
  for (let r = 0; r < 3; r++) for (let x = 6; x <= 11; x++) g.set(x, Y(17 + r), x <= 7 ? shade(L.kit.shorts, -0.16) : L.kit.shorts);
  legSide(g, L, ...near);
  armSide(g, L, ...nearArm);
  return { bob, lean };
}

/** Gerçekçi oranlı oyuncu ızgarası. @returns {{w:number,h:number,px:(string|null)[]}} */
export function buildPlayerTall(look, dir = 'down', frame = 'idle') {
  const L = defaultLook(look);
  L.kit = { ...defaultLook().kit, ...(look?.kit || {}) };
  L.boots = { ...defaultLook().boots, ...(look?.boots || {}) };
  const g = grid();
  if (dir === 'side') {
    const { bob, lean } = sideBody(g, L, frame);
    g.rect(8 + lean, 8 + bob, 2, 1, shade(L.skin, -0.12)); // boyun
    head(g, L, 'side', 2 + bob + (lean ? 0 : 0));
    if (lean) {
      // kafayı eğime göre bir piksel öne kaydır
      const moved = [];
      for (let y = 0; y <= 8 + bob; y++) for (let x = TW - 2; x >= 0; x--) { const c = g.get(x, y); if (c) moved.push([x, y, c]); }
      for (const [x, y] of moved) g.clear(x, y);
      for (const [x, y, c] of moved) g.set(x + 1, y, c);
    }
  } else {
    frontBody(g, L, frame, dir);
    const run = frame.startsWith('run') ? Number(frame.slice(3)) : -1;
    const bob = run === 1 || run === 3 ? -1 : frame === 'lunge' ? 2 : 0;
    g.rect(8, 8 + bob, 2, 1, shade(L.skin, -0.14));
    head(g, L, dir, 2 + bob);
  }
  outline(g);
  return { w: TW, h: TH, px: g.px };
}
