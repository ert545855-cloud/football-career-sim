// CANLI YAYIN — maç ekranının üstündeki yayın açısı (piksel sanat): tribünler (taraftar, bayrak, pankart, görevli),
// LED reklam panoları (kurgusal sponsorlar), perspektifli çim, 22 oyuncu + hakem ve top. Akış kendi kendine oynar;
// goller (rakip goller dahil) ve pozisyonlar senaryo olarak canlandırılır, istenirse yavaş çekim tekrar gösterilir.
// Tüm kulüp, sponsor ve oyuncu isimleri kurgusaldır.
import { drawPixelPlayer, drawPixelBall, dirFromVelocity, runFrame, setBallVariant } from '../games/pixel/sprites.js';
import { npcLook, keeperLook, SKINS, HAIR_COLORS } from '../games/pixel/looks.js';
import { defaultLook, shade } from '../games/pixel/playerPixels.js';
import { weatherFx } from '../games/weatherFx.js';

const PL = 105;
const PWm = 68;
const GY0 = 30.34;
const GY1 = 37.66;
const GH = 2.44;
const FAR = 0.62; // uzak taç çizgisindeki ölçek

// 4-3-3 (sağa hücum eden takım için, metre)
const FORM = [
  ['GK', 4.5, 34], ['DF', 21, 9], ['DF', 19, 26], ['DF', 19, 42], ['DF', 21, 59],
  ['MF', 36, 17], ['MF', 33, 34], ['MF', 36, 51], ['FW', 49, 13], ['FW', 51, 34], ['FW', 49, 55],
];

export const SPONSORS = [
  { t: 'NEW FOOTBALL STARS', bg: '#0b1d3a', fg: '#ffd23f' },
  { t: 'TURBO KOLA', bg: '#d7262e', fg: '#ffffff' },
  { t: 'YILDIZ BANK', bg: '#0f172a', fg: '#7dd3fc' },
  { t: 'PİKSEL TELEKOM', bg: '#5b21b6', fg: '#ffffff' },
  { t: 'GOL TV', bg: '#111827', fg: '#c6ff3d' },
  { t: 'ATLAS LASTİK', bg: '#f97316', fg: '#111827' },
  { t: 'MAVİ HAVAYOLU', bg: '#1d4ed8', fg: '#ffffff' },
  { t: 'KRAMPON SPOR', bg: '#065f46', fg: '#ffffff' },
  { t: 'ŞİMŞEK ENERJİ', bg: '#facc15', fg: '#111827' },
  { t: 'DEV MARKET', bg: '#be123c', fg: '#fde68a' },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rgb(hex) {
  let h = String(hex || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const lum = (hex) => { const [r, g, b] = rgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const cdist = (a, b) => { const A = rgb(a); const B = rgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };

const REF_LOOK = defaultLook({
  skin: '#e8b58f', hair: 'buzz', hairColor: '#2a1a10',
  kit: { body: '#facc15', accent: '#111827', pattern: 'solid', shorts: '#111827', socks: '#111827' },
  boots: { main: '#111111', accent: '#e5e7eb' },
});

/**
 * @param {HTMLElement} root .bc kapsayıcısı (içinde .bc-cv, .bc-mini, [data-goalbanner], [data-tag])
 * @param {object} o {myKit, oppKit, homeIsMy, lineups:{my,opp}, me:{look,num,name,pos,onPitch}, weather, speed():number, auto, names:{home,away,homeShort,awayShort,city}}
 */
export function createBroadcast(root, o) {
  const cv = root.querySelector('.bc-cv');
  const mini = root.querySelector('.bc-mini');
  const banner = root.querySelector('[data-goalbanner]');
  const tagEl = root.querySelector('[data-tag]');
  const ctx = cv.getContext('2d');
  const mctx = mini?.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  let crowd = null;
  let grassPat = null;
  const fx = weatherFx(o.weather || null, {});
  const snow = o.weather?.surface === 'snow';
  const logo = typeof Image !== 'undefined' ? new Image() : null;
  if (logo) logo.src = `${import.meta.env?.BASE_URL || '/'}logo.webp`;

  // ── Takımlar ve formalar ──
  const myClub = { colors: o.myKit?.colors || ['#2563eb', '#ffffff'], pattern: o.myKit?.pattern || 'solid' };
  let oppClub = { colors: o.oppKit?.colors || ['#dc2626', '#ffffff'], pattern: o.oppKit?.pattern || 'solid' };
  if (cdist(myClub.colors[0], oppClub.colors[0]) < 120) {
    const alt = cdist(myClub.colors[0], oppClub.colors[1]) >= 120 ? [oppClub.colors[1], oppClub.colors[0]] : lum(myClub.colors[0]) > 0.5 ? ['#1f2937', '#f8fafc'] : ['#f8fafc', '#1f2937'];
    oppClub = { colors: alt, pattern: 'solid' };
  }
  const homeFans = (o.homeIsMy ? o.myKit : o.oppKit)?.colors || myClub.colors;
  const awayFans = (o.homeIsMy ? o.oppKit : o.myKit)?.colors || oppClub.colors;
  const gkCol = { my: cdist(myClub.colors[0], '#22d3ee') > 120 ? '#22d3ee' : '#a3e635', opp: cdist(oppClub.colors[0], '#f472b6') > 120 ? '#f472b6' : '#fb923c' };

  const players = [];
  const me = o.me || {};
  let mePlayer = null;
  function makeTeam(side) {
    const club = side === 'my' ? myClub : oppClub;
    const pool = { GK: [], DF: [], MF: [], FW: [] };
    for (const p of o.lineups?.[side] || []) (pool[p.pos] || pool.MF).push(p);
    let sub = 12;
    let meSlotUsed = false;
    FORM.forEach(([pos, bx, by], i) => {
      let info = pool[pos].shift();
      let isMe = false;
      if (!info && side === 'my' && me.pos === pos && !meSlotUsed) {
        meSlotUsed = true;
        isMe = true;
        info = { name: me.name || 'Sen', num: me.num || 9, pos };
      }
      if (!info) info = { name: `Oyuncu ${sub}`, num: sub++, pos };
      const seed = (side === 'my' ? 100 : 300) + i * 7 + (info.num || 0);
      const look = pos === 'GK' ? { ...keeperLook(gkCol[side], seed), number: String(info.num || 1) } : npcLook(club, seed, info.num);
      const p = {
        side, pos, slot: i, num: info.num, name: info.name, look, isMe, bx, by,
        x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, sp: 5, st: {}, ph: Math.random() * 4,
        pose: null, poseT: 0, rot: 0, lift: 0, face: null, scripted: false,
      };
      if (isMe) {
        p.meLook = { ...(me.look || look), number: String(me.num || '') };
        p.benchLook = look;
        p.benchName = info.name;
        mePlayer = p;
      }
      players.push(p);
    });
  }
  makeTeam('my');
  makeTeam('opp');
  // Sen sahada değilsen (yedek/sakat) senin yerinde yedek oynar
  let meOn = !!me.onPitch;
  const subLook = mePlayer ? npcLook(myClub, 911, 14) : null;
  function applyMe() {
    if (!mePlayer) return;
    if (meOn) { mePlayer.look = mePlayer.meLook; mePlayer.name = me.name; mePlayer.num = me.num; }
    else { mePlayer.look = subLook; mePlayer.name = 'Yedek'; mePlayer.num = 14; }
  }
  applyMe();
  const team = (side) => players.filter((p) => p.side === side);
  const other = (s) => (s === 'my' ? 'opp' : 'my');
  const dirOf = (s) => (s === 'my' ? 1 : -1);
  const gk = (side) => players.find((p) => p.side === side && p.pos === 'GK');
  const ref = { x: 52.5, y: 44, vx: 0, vy: 0, st: {}, ph: 0, look: REF_LOOK };

  // ── Durum ──
  const S = {
    time: 0, rate: 1, paused: false, poss: 'my',
    cam: { x: 52.5, t: 0.55 },
    ball: { x: 52.5, y: 34, z: 0, vx: 0, vy: 0, vz: 0, owner: null, flight: null, rot: 0 },
    script: null, restart: null, wipe: null, celebrate: null, bulge: null, confetti: [],
    boardShift: 0, boardT: 0, tag: '', freeze: false, flash: 0,
  };
  const rateNow = () => (o.auto ? 5 : ({ 1: 1, 2: 1.7, 4: 2.8 }[o.speed?.() || 1] || 1));

  // ── Projeksiyon ──
  // yatay tam ekranda daha geniş açı (yayın kamerası), dikeyde daha yakın plan
  const ppm = () => (H / W > 0.5 ? W / 16 : W / 29);
  const sc = (t) => FAR + (1 - FAR) * t;
  const yFar = () => H * (H / W > 0.5 ? 0.41 : 0.36);
  const yNear = () => H * 1.3;
  let shiftY = 0;
  const Y = (t) => yFar() - shiftY + (yNear() - yFar()) * ((FAR * t + ((1 - FAR) * t * t) / 2) / (FAR + (1 - FAR) / 2));
  const X = (x, t) => W / 2 + (x - S.cam.x) * ppm() * sc(t);
  const P = (x, y, z = 0) => { const t = y / PWm; return [X(x, t), Y(t) - z * ppm() * sc(t) * 0.95]; };
  const boardH = () => Math.max(12, H * 0.07);
  const standsBottom = () => yFar() - shiftY - boardH() - H * 0.012;

  // ─────────────────────────── Tribün (önceden çizilir) ───────────────────────────
  function buildCrowd() {
    const u = Math.max(2, Math.round(H / 115));
    const hU = Math.ceil((H * 0.46) / u);
    const crowdSc = FAR * 0.93;
    const wU = Math.ceil(((PL + 46) * ppm() * crowdSc) / u);
    const r = seeded(4242);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const fans = [];
    const rowH = 5;
    const rows = Math.floor((hU - 12) / rowH);
    const aisle = (x) => x % 52 < 5;
    const awayFrom = wU * 0.77;
    const awayTo = wU * 0.93;
    for (let row = 0; row < rows; row++) {
      const yb = hU - 9 - row * rowH;
      for (let x = (row % 2) * 2 + 1; x < wU - 3; x += 4 + (r() < 0.12 ? 1 : 0)) {
        if (aisle(x) || aisle(x + 2)) continue;
        if (r() < 0.05) continue;
        const away = x > awayFrom && x < awayTo;
        const pal = away ? awayFans : homeFans;
        const v = r();
        const shirt = v < 0.44 ? pal[0] : v < 0.72 ? pal[1] : v < 0.84 ? '#1f2937' : v < 0.9 ? '#e5e7eb' : pick(['#475569', '#7c2d12', '#334155', '#9ca3af']);
        fans.push({ x, yb, shirt, skin: pick(SKINS), hair: pick(HAIR_COLORS), away, ph: r(), dk: row / rows, scarf: r() < 0.18 });
      }
    }
    const banners = [];
    const bannerTexts = [
      (o.names?.home || 'EV SAHİBİ').toUpperCase(),
      'SONUNA KADAR',
      `ŞAMPİYON ${(o.names?.homeShort || '').toUpperCase()}`.trim(),
      'HEP SENİNLEYİZ',
      `${(o.names?.city || 'ŞEHİR').toUpperCase()} BURADA`,
    ];
    let bx = 18;
    let bi = 0;
    while (bx < awayFrom - 60) {
      const text = bannerTexts[bi % bannerTexts.length];
      const w = Math.min(90, 14 + text.length * 4.6);
      const col = bi % 2 ? [homeFans[1], homeFans[0]] : [homeFans[0], homeFans[1]];
      banners.push({ x: bx, w, text, bg: col[0], fg: col[1] });
      bx += w + 14 + Math.floor(r() * 18);
      bi++;
    }
    banners.push({ x: awayFrom + 6, w: Math.min(80, (awayTo - awayFrom) - 10), text: `${(o.names?.awayShort || 'DEPLASMAN').toUpperCase()} DEPLASMANDA`, bg: awayFans[0], fg: awayFans[1] });
    const flags = [];
    for (let i = 0; i < 9; i++) {
      const fxu = 30 + i * (wU / 9.5) + r() * 20;
      const away = fxu > awayFrom && fxu < awayTo;
      const pal = away ? awayFans : homeFans;
      flags.push({ x: fxu, y: hU - 14 - Math.floor(r() * (rows - 3)) * rowH, c1: pal[0], c2: pal[1], kind: r() < 0.45 ? 'check' : r() < 0.5 ? 'half' : 'band', ph: r() * 6, away });
    }
    const make = (mode) => {
      const c = document.createElement('canvas');
      c.width = wU;
      c.height = hU;
      const g = c.getContext('2d');
      const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      // beton basamaklar + koltuk sıraları
      R(0, 0, wU, hU, '#151b26');
      for (let row = 0; row < rows; row++) {
        const yb = hU - 9 - row * rowH;
        R(0, yb - 1, wU, 2, row % 2 ? '#1d2533' : '#212a3a');
        R(0, yb + 1, wU, 1, '#0f141d');
      }
      // merdivenler (koridor)
      for (let x = 0; x < wU; x++) {
        if (x % 52 !== 0) continue;
        for (let y = 4; y < hU - 8; y += 2) { R(x, y, 5, 1, y % 4 ? '#5b6474' : '#7b8494'); }
        R(x, 4, 1, hU - 12, '#facc15');
        R(x + 4, 4, 1, hU - 12, '#facc15');
      }
      // taraftarlar
      for (const f of fans) {
        const cel = (mode === 'home' && !f.away) || (mode === 'away' && f.away);
        const bob = mode === 'b' ? (f.ph < 0.5 ? -1 : 0) : cel ? -1 - (f.ph < 0.5 ? 1 : 0) : 0;
        const dk = 0.38 * f.dk;
        const y = f.yb + bob;
        R(f.x, y - 2, 3, 3, shade(f.shirt, -dk));
        if (f.scarf) R(f.x, y - 2, 3, 1, shade(f.away ? awayFans[1] : homeFans[1], -dk));
        R(f.x + (f.ph < 0.3 ? 1 : 0), y - 4, 2, 2, shade(f.skin, -dk));
        if (f.ph > 0.2) R(f.x + (f.ph < 0.3 ? 1 : 0), y - 4, 2, 1, shade(f.hair, -dk));
        if (cel) {
          R(f.x - 1, y - 5, 1, 3, shade(f.skin, -dk));
          R(f.x + 3, y - 5, 1, 3, shade(f.skin, -dk));
        } else if (mode === 'b' && f.ph > 0.86) {
          R(f.x + 3, y - 5, 1, 3, shade(f.skin, -dk)); // tek kol havada
        }
      }
      // ön duvar + pankartlar
      R(0, hU - 8, wU, 8, '#1a2130');
      R(0, hU - 8, wU, 1, '#3b4558');
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const b of banners) {
        R(b.x, hU - 15, b.w, 10, b.bg);
        R(b.x, hU - 15, b.w, 1, shade(b.bg, 0.25));
        R(b.x, hU - 6, b.w, 1, shade(b.bg, -0.35));
        R(b.x + 1, hU - 14, 1, 8, shade(b.fg, -0.1));
        R(b.x + b.w - 2, hU - 14, 1, 8, shade(b.fg, -0.1));
        g.fillStyle = b.fg;
        g.font = `900 7px "Arial Black", Impact, system-ui, sans-serif`;
        g.fillText(b.text, b.x + b.w / 2, hU - 9.6, b.w - 6);
      }
      // görevliler (turuncu yelek)
      for (let x = 26; x < wU; x += 70) {
        R(x, hU - 7, 3, 3, '#f97316');
        R(x + 1, hU - 7, 1, 3, '#fde68a');
        R(x, hU - 9, 2, 2, '#c98e62');
        R(x, hU - 4, 1, 3, '#1f2937');
        R(x + 2, hU - 4, 1, 3, '#1f2937');
      }
      // çatı ve projektörler
      R(0, 0, wU, 4, '#0a0e16');
      for (let x = 6; x < wU; x += 22) { R(x, 1, 3, 2, '#fff6c4'); }
      return c;
    };
    crowd = { u, hU, wU, crowdSc, flags, frames: { a: make('a'), b: make('b'), home: make('home'), away: make('away') } };
  }

  function buildGrass() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const r = seeded(99);
    for (let i = 0; i < 260; i++) {
      const v = r();
      g.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
      g.fillRect(Math.floor(r() * 32) * 2, Math.floor(r() * 32) * 2, 2, 2);
    }
    grassPat = ctx.createPattern(c, 'repeat');
  }

  function resize() {
    // clientWidth/Height: döndürülmüş (tam ekran yatay) görünümde de gerçek yerleşim boyutu
    const nw = Math.max(200, Math.round(root.clientWidth));
    const nh = Math.max(120, Math.round(root.clientHeight));
    if (nw === W && nh === H) return;
    W = nw;
    H = nh;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    if (mini) {
      mini.width = Math.round((mini.clientWidth || 86) * dpr);
      mini.height = Math.round((mini.clientHeight || 55) * dpr);
    }
    buildCrowd();
    buildGrass();
  }

  // ─────────────────────────── Konumlar ───────────────────────────
  const baseOf = (p) => (p.side === 'my' ? [p.bx, p.by] : [PL - p.bx, PWm - p.by]);
  function place(p, x, y) { p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.tx = x; p.ty = y; }
  function kickoffShape(kickTeam) {
    for (const p of players) {
      const [bx, by] = baseOf(p);
      const d = dirOf(p.side);
      const half = d > 0 ? clamp(bx * 0.92, 3, 50) : clamp(PL - (PL - bx) * 0.92, 55, PL - 3);
      place(p, half, by);
      p.pose = null; p.rot = 0; p.lift = 0; p.scripted = false; p.face = null;
    }
    const k = team(kickTeam).filter((p) => p.pos === 'FW').sort((a, b) => Math.abs(a.y - 34) - Math.abs(b.y - 34))[0];
    if (k) place(k, 52.5 - dirOf(kickTeam) * 0.6, 34);
    S.ball = { x: 52.5, y: 34, z: 0, vx: 0, vy: 0, vz: 0, owner: k || null, flight: null, rot: 0 };
    S.poss = kickTeam;
    S.restart = { t: 0.8, kind: 'kickoff' };
    ref.x = 47; ref.y = 40;
    S.cam.x = 52.5;
    S.cam.t = 0.55;
  }

  // ─────────────────────────── Top ───────────────────────────
  /** Topu uçur: (x0,y0,z0) → (x1,y1,z1), T saniye, kavis h, yan falso curl */
  function fly(x1, y1, z1, T, { h = 0, curl = 0, onEnd = null, from = null } = {}) {
    const b = S.ball;
    const f = from || { x: b.x, y: b.y, z: b.z };
    b.owner = null;
    b.flight = { x0: f.x, y0: f.y, z0: f.z, x1, y1, z1, T: Math.max(0.05, T), t: 0, h, curl, onEnd };
  }
  function giveBall(p) {
    const b = S.ball;
    b.owner = p;
    b.flight = null;
    b.z = 0;
    S.poss = p.side;
  }
  function updateBall(dt) {
    const b = S.ball;
    if (b.flight) {
      const f = b.flight;
      f.t += dt;
      const u = clamp(f.t / f.T, 0, 1);
      const px = b.x;
      const py = b.y;
      b.x = lerp(f.x0, f.x1, u);
      b.y = lerp(f.y0, f.y1, u) + f.curl * Math.sin(Math.PI * u);
      b.z = lerp(f.z0, f.z1, u) + 4 * f.h * u * (1 - u);
      b.vx = (b.x - px) / Math.max(dt, 1e-4);
      b.vy = (b.y - py) / Math.max(dt, 1e-4);
      b.rot += dt * 14;
      if (u >= 1) {
        const cb = f.onEnd;
        b.flight = null;
        if (cb) cb();
      }
    } else if (b.owner) {
      const p = b.owner;
      const sp = Math.hypot(p.vx, p.vy);
      const ux = sp > 0.3 ? p.vx / sp : dirOf(p.side);
      const uy = sp > 0.3 ? p.vy / sp : 0;
      b.x = p.x + ux * 0.7;
      b.y = p.y + uy * 0.5 + 0.25;
      b.z = 0;
      b.vx = p.vx;
      b.vy = p.vy;
      b.rot += dt * sp * 1.6;
    } else {
      // serbest top: sürtünme + zıplama
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vz -= 9.8 * dt;
      b.z += b.vz * dt;
      if (b.z < 0) { b.z = 0; b.vz = Math.abs(b.vz) > 1.2 ? -b.vz * 0.45 : 0; }
      const k = Math.exp(-(b.z > 0 ? 0.25 : 1.4) * dt);
      b.vx *= k;
      b.vy *= k;
      b.rot += dt * Math.hypot(b.vx, b.vy) * 1.4;
      b.y = clamp(b.y, 0.4, PWm - 0.4);
      if (S.netLock) {
        const n = S.netLock;
        b.x = n.d > 0 ? clamp(b.x, PL + 0.3, PL + 1.8) : clamp(b.x, -1.8, -0.3);
        b.y = clamp(b.y, GY0 + 0.3, GY1 - 0.3);
      }
    }
  }

  // ─────────────────────────── Oyuncu hareketi ───────────────────────────
  function steer(p, dt) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const want = d < 0.25 ? 0 : Math.min(p.sp, d * 1.8);
    const ux = d ? dx / d : 0;
    const uy = d ? dy / d : 0;
    const ax = ux * want - p.vx;
    const ay = uy * want - p.vy;
    const al = Math.hypot(ax, ay);
    const k = al > 0 ? Math.min(1, (11 * dt) / al) : 0;
    p.vx += ax * k;
    p.vy += ay * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ph += Math.hypot(p.vx, p.vy) * dt * 1.9;
    if (p.poseT > 0) { p.poseT -= dt; if (p.poseT <= 0 && !p.holdPose) { p.pose = null; p.rot = 0; p.lift = 0; } }
  }

  const nearestTo = (list, x, y) => {
    let best = null;
    let bd = 1e9;
    for (const p of list) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    return best ? { p: best, d: bd } : null;
  };
  const pressureOn = (p) => nearestTo(team(other(p.side)), p.x, p.y)?.d ?? 20;

  // ─────────────────────────── Akış (senaryo dışı) ───────────────────────────
  function formationTarget(p) {
    const b = S.ball;
    const d = dirOf(p.side);
    const att = S.poss === p.side;
    if (p.pos === 'GK') {
      const gx = d > 0 ? 3 : PL - 3;
      const near = Math.abs(b.x - (d > 0 ? 0 : PL)) < 32;
      return [gx + d * (near ? 1.5 : 7), 34 + (b.y - 34) * 0.16];
    }
    const [bx, by] = baseOf(p);
    const k = att ? { DF: 0.5, MF: 0.55, FW: 0.5 }[p.pos] : { DF: 0.25, MF: 0.4, FW: 0.45 }[p.pos];
    const push = att ? 8 : -2;
    const tx = bx + (b.x - 52.5) * k + d * push + Math.sin(S.time * 0.6 + p.slot) * 1.2;
    const ty = by + (b.y - 34) * 0.3 + Math.cos(S.time * 0.5 + p.slot * 1.7) * 1.2;
    return [clamp(tx, 3, PL - 3), clamp(ty, 2.5, PWm - 2.5)];
  }

  function passFrom(p) {
    const d = dirOf(p.side);
    let best = null;
    let bs = -1e9;
    for (const q of team(p.side)) {
      if (q === p) continue;
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (dist < 6 || dist > 36) continue;
      const fwd = (q.x - p.x) * d;
      const sc0 = fwd * 0.45 + Math.min(pressureOn(q), 8) * 1.1 - dist * 0.12 + Math.random() * 7 - (q.pos === 'GK' ? 14 : 0);
      if (sc0 > bs) { bs = sc0; best = q; }
    }
    if (!best) return false;
    const dist = Math.hypot(best.x - p.x, best.y - p.y);
    const v = 12 + Math.random() * 5;
    const T = dist / v;
    const lx = clamp(best.x + best.vx * T * 0.8, 2, PL - 2);
    const ly = clamp(best.y + best.vy * T * 0.8, 2, PWm - 2);
    best.tx = lx;
    best.ty = ly;
    best.waitT = T + 0.3;
    p.pose = 'kick'; p.poseT = 0.22;
    fly(lx, ly, 0, T, {
      h: dist > 24 ? dist * 0.09 : 0.15,
      onEnd: () => {
        if (Math.hypot(best.x - lx, best.y - ly) < 2.6) giveBall(best);
        else { S.ball.vx = (lx - p.x) / T * 0.4; S.ball.vy = (ly - p.y) / T * 0.4; }
      },
    });
    S.passer = p;
    return true;
  }

  function ambientShot(p) {
    const d = dirOf(p.side);
    const gx = d > 0 ? PL : 0;
    const keeper = gk(other(p.side));
    const save = Math.random() < 0.55;
    const ty = save ? 32 + Math.random() * 4 : Math.random() < 0.5 ? GY0 - 1.5 - Math.random() * 3 : GY1 + 1.5 + Math.random() * 3;
    const dist = Math.hypot(gx - p.x, ty - p.y);
    const T = dist / 22;
    p.pose = 'kick'; p.poseT = 0.25;
    if (save && keeper) { keeper.tx = gx - d * 1.2; keeper.ty = ty; keeper.sp = 7; }
    fly(gx - (save ? d * 1.1 : -d * 2), ty, save ? 0.6 + Math.random() : 0.4 + Math.random() * 1.5, T, {
      h: 0.3,
      onEnd: () => {
        if (save && keeper) { giveBall(keeper); keeper.pose = 'ready'; keeper.poseT = 0.5; }
        else { S.ball.vx = d * 4; S.ball.vy = 0; S.restart = { t: 1.0, kind: 'gk', team: other(p.side) }; }
      },
    });
  }

  function ambient(dt) {
    const b = S.ball;
    if (S.restart) {
      S.restart.t -= dt;
      if (S.restart.t <= 0) {
        const r = S.restart;
        S.restart = null;
        if (r.kind === 'gk') {
          const k = gk(r.team);
          b.x = k.x; b.y = k.y; b.z = 0; b.vx = 0; b.vy = 0;
          giveBall(k);
          k.decideT = 0.6;
        } else if (r.kind === 'kickoff' && b.owner) {
          passFrom(b.owner);
        }
      }
    }
    // hedefler
    const loose = !b.owner && !b.flight && !S.restart;
    const chasers = new Set();
    if (loose) {
      for (const s of ['my', 'opp']) { const n = nearestTo(team(s).filter((p) => p.pos !== 'GK'), b.x, b.y); if (n) chasers.add(n.p); }
    } else if (b.owner) {
      const def = team(other(b.owner.side)).filter((p) => p.pos !== 'GK').sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y));
      def.slice(0, 2).forEach((p) => chasers.add(p));
    }
    for (const p of players) {
      if (p === b.owner) continue;
      if (p.waitT > 0) { p.waitT -= dt; continue; }
      if (chasers.has(p)) {
        const dd = dirOf(p.side);
        p.tx = b.x - dd * 0.6;
        p.ty = b.y;
        p.sp = 6.2;
      } else {
        const [tx, ty] = formationTarget(p);
        p.tx = tx;
        p.ty = ty;
        p.sp = 4.6;
      }
    }
    if (loose) {
      if (b.x < -0.6 || b.x > PL + 0.6) { S.restart = { t: 0.7, kind: 'gk', team: b.x < 0 ? 'my' : 'opp' }; b.vx = 0; b.vy = 0; }
      else for (const p of chasers) if (Math.hypot(p.x - b.x, p.y - b.y) < 0.9 && b.z < 1) { giveBall(p); p.decideT = 0.5; break; }
    }
    const o2 = b.owner;
    if (o2 && !S.restart) {
      const d = dirOf(o2.side);
      const gx = d > 0 ? PL : 0;
      o2.tx = clamp(o2.x + d * 5, 2, PL - 2);
      o2.ty = clamp(o2.y + Math.sin(S.time * 0.8 + o2.slot) * 2.5 + (34 - o2.y) * 0.05, 3, PWm - 3);
      o2.sp = o2.pos === 'GK' ? 2 : 5.2;
      o2.decideT = (o2.decideT ?? 1) - dt;
      if (o2.decideT <= 0) {
        o2.decideT = 0.8 + Math.random() * 1.3;
        const dg = Math.abs(gx - o2.x);
        if (o2.pos !== 'GK' && dg < 22 && Math.abs(o2.y - 34) < 15 && Math.random() < 0.38) ambientShot(o2);
        else if (o2.pos === 'GK' || Math.random() < 0.78) passFrom(o2);
      }
      // top kapma
      const n = nearestTo(team(other(o2.side)), b.x, b.y);
      if (n && n.d < 1.15 && o2.pos !== 'GK' && Math.random() < dt * 1.3) {
        n.p.pose = 'lunge'; n.p.poseT = 0.35;
        giveBall(n.p);
        n.p.decideT = 0.4;
      }
    }
    if (b.flight && b.z < 1.3) {
      // pas arası
      const passer = S.passer;
      for (const p of players) {
        if (!passer || p.side === passer.side || p.pos === 'GK') continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < 0.8 && Math.random() < 0.3) { giveBall(p); p.decideT = 0.5; break; }
      }
    }
  }

  // ─────────────────────────── Senaryolar ───────────────────────────
  function startScript(events, total, { onFrame = null } = {}) {
    return new Promise((res) => {
      S.script = { t: 0, events: events.sort((a, b) => a.at - b.at), i: 0, total, res, onFrame };
    });
  }
  function updateScript(dt) {
    const sc0 = S.script;
    sc0.t += dt;
    while (sc0.i < sc0.events.length && sc0.events[sc0.i].at <= sc0.t) sc0.events[sc0.i++].fn();
    sc0.onFrame?.(dt, sc0.t);
    // senaryo dışı oyuncular: savunma adam tutar, hücum boşa koşar
    for (const p of players) {
      if (p.scripted || p === S.ball.owner) continue;
      if (p.mark) {
        const m = p.mark;
        const d = dirOf(p.side);
        p.tx = m.x - d * 1.3;
        p.ty = m.y + (34 - m.y) * 0.12;
        p.sp = 6;
      }
    }
    if (sc0.t >= sc0.total) {
      S.script = null;
      sc0.res();
    }
  }

  function findPlayer(list, name, meFlag) {
    if (meFlag && mePlayer && list.includes(mePlayer)) return mePlayer;
    if (!name) return null;
    return list.find((p) => p.name === name) || null;
  }

  /** Atak pozisyonu kurulumu: herkes yerine ışınlanır (geçiş perdesinin arkasında) */
  function setup(side, rr) {
    const d = dirOf(side);
    const gx = d > 0 ? PL : 0;
    const fxm = (m) => gx - d * m;
    const att = team(side);
    const def = team(other(side));
    for (const p of players) { p.scripted = false; p.mark = null; p.pose = null; p.rot = 0; p.lift = 0; p.holdPose = false; p.waitT = 0; p.face = null; }
    for (const p of att) {
      const [, by] = baseOf(p);
      const m = { GK: 86, DF: 38 + rr() * 8, MF: 21 + rr() * 6, FW: 12 + rr() * 6 }[p.pos];
      place(p, fxm(m), clamp(by + (rr() - 0.5) * 6, 4, 64));
      p.tx = fxm(m * 0.9);
      p.sp = 4;
    }
    for (const p of def) {
      const [, by] = baseOf(p);
      if (p.pos === 'GK') { place(p, fxm(1.2), 34); p.sp = 7; continue; }
      const m = { DF: 8 + rr() * 5, MF: 16 + rr() * 6, FW: 30 + rr() * 8 }[p.pos];
      place(p, fxm(m), clamp(by * 0.7 + 34 * 0.3 + (rr() - 0.5) * 4, 6, 62));
    }
    // adam tutma: her savunmacı en yakın hücumcuyu izler
    for (const p of def) {
      if (p.pos === 'GK') continue;
      const n = nearestTo(att.filter((q) => q.pos !== 'GK'), p.x, p.y);
      p.mark = n?.p || null;
    }
    return { d, gx, fxm, att, def };
  }

  /** Gol / pozisyon senaryosu */
  function buildScenario(ev, seed) {
    const rr = seeded(seed);
    const { d, gx, fxm, att, def } = setup(ev.side, rr);
    const keeper = def.find((p) => p.pos === 'GK');
    const kind = ev.kind || 'open';
    let scorer = findPlayer(att, ev.scorer, ev.me) || att.filter((p) => p.pos === 'FW')[Math.floor(rr() * 3)] || att[9];
    let assister = ev.assist === null ? null : findPlayer(att.filter((p) => p !== scorer), ev.assist, ev.meAssist);
    const needsAssist = ['open', 'cross', 'corner'].includes(kind);
    if (!assister && needsAssist && ev.assist !== null) assister = att.filter((p) => p !== scorer && p.pos !== 'GK' && p.pos !== 'DF')[Math.floor(rr() * 4)] || null;
    if (kind === 'corner' && !assister) assister = att.find((p) => p.pos === 'MF' && p !== scorer);
    if (kind === 'cross' && !assister) assister = att.find((p) => p.pos !== 'GK' && p !== scorer);
    scorer.scripted = true;
    if (assister) assister.scripted = true;
    const sideY = rr() < 0.5 ? -1 : 1;
    const ev2 = [];
    let tShot = 0;
    let shotFrom = null;
    let header = false;
    const B = S.ball;
    B.netLock = null;
    S.netLock = null;
    const at = (t, fn) => ev2.push({ at: t, fn });

    if (kind === 'penalty') {
      const spot = [fxm(11), 34];
      place(scorer, fxm(13.8), 34 - sideY * 1.2);
      for (const p of players) if (p !== scorer && p.pos !== 'GK') { place(p, fxm(18 + rr() * 4), clamp(18 + rr() * 32, 6, 62)); p.mark = null; p.tx = p.x; p.ty = p.y; }
      B.x = spot[0]; B.y = spot[1]; B.z = 0; B.owner = null; B.flight = null; B.vx = 0; B.vy = 0;
      place(keeper, fxm(0.4), 34);
      at(0.5, () => { scorer.tx = spot[0] + d * -0.6; scorer.ty = 34; scorer.sp = 4.5; });
      tShot = 1.25;
      shotFrom = 'spot';
    } else if (kind === 'freekick') {
      const fy = 34 + sideY * (2 + rr() * 6);
      const ballP = [fxm(22), fy];
      B.x = ballP[0]; B.y = ballP[1]; B.z = 0; B.owner = null; B.flight = null; B.vx = 0; B.vy = 0;
      place(scorer, fxm(24.5), fy - sideY * 1.5);
      // baraj
      const ux = (gx - ballP[0]) / Math.hypot(gx - ballP[0], 34 - fy);
      const uy = (34 - fy) / Math.hypot(gx - ballP[0], 34 - fy);
      def.filter((p) => p.pos !== 'GK').slice(0, 4).forEach((p, i) => { place(p, ballP[0] + ux * 9.15 - uy * (i - 1.5) * 0.8, ballP[1] + uy * 9.15 + ux * (i - 1.5) * 0.8); p.mark = null; p.scripted = true; p.face = d > 0 ? 'left' : 'right'; });
      at(0.45, () => { scorer.tx = ballP[0] - d * 0.6; scorer.ty = fy; scorer.sp = 4; });
      tShot = 1.15;
      shotFrom = 'fk';
    } else if (kind === 'corner') {
      const cy = sideY < 0 ? 0.7 : PWm - 0.7;
      place(assister, gx - d * 0.6, cy);
      B.x = gx - d * 0.9; B.y = cy; B.z = 0; B.owner = null; B.flight = null; B.vx = 0; B.vy = 0;
      place(scorer, fxm(14), 34 - sideY * 3);
      const tgt = [fxm(7.5 + rr() * 2), 34 + (rr() - 0.5) * 5];
      at(0.15, () => { scorer.tx = tgt[0]; scorer.ty = tgt[1]; scorer.sp = 6.5; });
      at(0.55, () => {
        assister.pose = 'kick'; assister.poseT = 0.3;
        fly(tgt[0], tgt[1], 1.8, 1.05, { h: 3.6 });
      });
      tShot = 1.6;
      header = true;
      at(1.35, () => { scorer.lift = 0.5; scorer.poseT = 0.5; scorer.pose = 'idle'; });
    } else if (kind === 'cross') {
      const wy = sideY < 0 ? 7 : PWm - 7;
      place(assister, fxm(16), wy);
      giveBall(assister);
      place(scorer, fxm(15), 34 + sideY * 4);
      const tgt = [fxm(7 + rr() * 3), 34 + (rr() - 0.5) * 6];
      at(0.0, () => { assister.tx = fxm(8); assister.ty = wy; assister.sp = 6.5; scorer.tx = tgt[0]; scorer.ty = tgt[1]; scorer.sp = 5.5; });
      at(0.85, () => {
        assister.pose = 'kick'; assister.poseT = 0.3;
        fly(tgt[0], tgt[1], 1.8, 0.75, { h: 2.6 });
      });
      tShot = 1.6;
      header = true;
      at(1.4, () => { scorer.lift = 0.5; scorer.poseT = 0.5; scorer.pose = 'idle'; });
    } else if (kind === 'long') {
      place(scorer, fxm(29), 34 + sideY * (3 + rr() * 5));
      giveBall(scorer);
      at(0, () => { scorer.tx = fxm(25); scorer.ty = scorer.y; scorer.sp = 5; });
      tShot = 0.9;
    } else if (kind === 'solo' || kind === 'counter') {
      place(scorer, fxm(kind === 'counter' ? 38 : 30), 34 + sideY * (4 + rr() * 6));
      giveBall(scorer);
      const dfd = def.filter((p) => p.pos === 'DF').sort((a, b) => Math.hypot(a.x - scorer.x, a.y - scorer.y) - Math.hypot(b.x - scorer.x, b.y - scorer.y))[0];
      if (dfd) { place(dfd, fxm(kind === 'counter' ? 24 : 20), scorer.y - sideY * 2); dfd.scripted = true; dfd.mark = null; }
      at(0, () => { scorer.tx = fxm(11); scorer.ty = 34 + sideY * 2.5; scorer.sp = 7.4; if (dfd) { dfd.tx = scorer.x + d * 1.5; dfd.ty = scorer.y; dfd.sp = 6; } });
      at(kind === 'counter' ? 1.0 : 0.65, () => { if (dfd) { dfd.pose = 'lunge'; dfd.poseT = 0.6; dfd.tx = dfd.x + (scorer.y > dfd.y ? 0 : 0); dfd.sp = 2; } });
      tShot = kind === 'counter' ? 2.2 : 1.7;
    } else {
      // açık oyun: pas + şut
      const ay = 34 + sideY * (9 + rr() * 6);
      place(assister || scorer, fxm(25), ay);
      giveBall(assister || scorer);
      place(scorer, assister ? fxm(17) : scorer.x, assister ? 34 - sideY * (2 + rr() * 4) : scorer.y);
      const run = [fxm(11 + rr() * 3), 34 - sideY * (1 + rr() * 3)];
      at(0, () => { const a = assister || scorer; a.tx = fxm(21); a.ty = ay - sideY * 2; a.sp = 5; if (assister) { scorer.tx = run[0]; scorer.ty = run[1]; scorer.sp = 7; } });
      if (assister) {
        at(0.7, () => {
          assister.pose = 'kick'; assister.poseT = 0.25;
          const dist = Math.hypot(run[0] - B.x, run[1] - B.y);
          fly(run[0], run[1], 0, dist / 15, { h: 0.2, onEnd: () => giveBall(scorer) });
        });
        tShot = 0.7 + Math.hypot(run[0] - fxm(25), run[1] - ay) / 15 + 0.3;
      } else tShot = 1.0;
    }

    // ── şut ──
    const outcome = ev.outcome || 'goal';
    let ty;
    let tz;
    if (outcome === 'goal') { ty = 34 + (rr() < 0.5 ? -1 : 1) * (1.4 + rr() * 2.0); tz = header ? 0.5 + rr() * 1.1 : 0.15 + rr() * 1.9; if (shotFrom === 'fk') tz = 1.6 + rr() * 0.6; }
    else if (outcome === 'save') { ty = 34 + (rr() - 0.5) * 4.5; tz = 0.3 + rr() * 1.4; }
    else if (outcome === 'post') { const bar = rr() < 0.3; ty = bar ? 32 + rr() * 4 : rr() < 0.5 ? GY0 + 0.05 : GY1 - 0.05; tz = bar ? GH : 0.4 + rr() * 1.8; }
    else { const over = rr() < 0.35; ty = over ? 31 + rr() * 6 : rr() < 0.5 ? GY0 - 0.8 - rr() * 2.5 : GY1 + 0.8 + rr() * 2.5; tz = over ? 3.1 + rr() : 0.3 + rr() * 1.2; }
    const curl = shotFrom === 'fk' ? -(ty - B.y) * 0.08 + (rr() - 0.5) * 1.5 : 0;
    let celebT = 0;
    at(tShot, () => {
      scorer.pose = 'kick'; scorer.poseT = 0.3;
      const from = header ? { x: B.x, y: B.y, z: Math.max(1.6, B.z) } : { x: B.x, y: B.y, z: 0 };
      const dist = Math.hypot(gx - from.x, ty - from.y);
      const v = header ? 15 : shotFrom === 'fk' ? 21 : shotFrom === 'spot' ? 23 : kind === 'long' ? 27 : 24;
      const T = dist / v;
      // kaleci
      const dive = outcome === 'save' ? ty : outcome === 'goal' ? (rr() < 0.3 ? 34 - (ty - 34) * 0.7 : 34 + (ty - 34) * 0.4) : 34 + (ty - 34) * 0.5;
      keeper.scripted = true;
      ev2.push({ at: tShot + Math.min(T * 0.35, 0.16), fn: () => {
        keeper.tx = gx - d * 1.0; keeper.ty = dive; keeper.sp = outcome === 'save' ? 12 : 6;
        if (Math.abs(dive - 34) > 1) { keeper.pose = 'lunge'; keeper.holdPose = true; keeper.poseT = 9; keeper.rot = (dive > 34 ? 1 : -1) * 1.15 * -d; keeper.lift = 0.35; }
      } });
      ev2.sort((a, b) => a.at - b.at);
      const endX = outcome === 'miss' ? gx + d * 0.3 : gx - d * (outcome === 'save' ? 0.9 : 0.05);
      fly(endX, ty, tz, T, {
        h: header ? 0.1 : shotFrom === 'fk' ? 1.8 : kind === 'long' ? 0.9 : 0.25,
        curl,
        from,
        onEnd: () => {
          if (outcome === 'goal') {
            S.netLock = { d };
            fly(gx + d * 1.5, ty, Math.max(0.2, tz * 0.5), 0.16, { onEnd: () => { S.ball.vx = d * 0.5; S.ball.vy = 0; S.ball.vz = 0; } });
            S.bulge = { d, gx, y: ty, z: tz, t: 0 };
            S.flash = 1;
            celebrate(ev, scorer, att, def, d, gx);
          } else if (outcome === 'save') {
            giveBall(keeper);
            S.poss = keeper.side;
            sfxHook('save');
          } else if (outcome === 'post') {
            S.ball.vx = -d * 8; S.ball.vy = (rr() - 0.5) * 6; S.ball.vz = 2.5;
            sfxHook('post');
          } else {
            fly(gx + d * 7, ty + (ty - 34) * 0.5, 0.3, 0.32, { onEnd: () => { S.ball.vx = d * 2; S.ball.vy = 0; } });
          }
        },
      });
      celebT = T;
    });
    const total = tShot + 0.6 + (outcome === 'goal' ? 2.6 : 1.2);
    return { events: ev2, total, scorer, assister, tShot, getCelebT: () => celebT };
  }

  let sfxHook = () => {};
  function celebrate(ev, scorer, att, def, d, gx) {
    if (S.replaying) return;
    const homeScored = (ev.side === 'my') === !!o.homeIsMy;
    S.crowdMode = homeScored ? 'home' : 'away';
    S.crowdT = 4;
    // golcü köşe bayrağına, takım arkadaşları peşinden
    const cx = gx - d * 4;
    const cy = PWm - 5;
    scorer.scripted = true;
    scorer.tx = cx; scorer.ty = cy; scorer.sp = 7.8;
    scorer.celebrate = true;
    att.filter((p) => p !== scorer && p.pos !== 'GK').sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, 4).forEach((p, i) => {
      p.scripted = true; p.mark = null;
      p.tx = cx - d * (1.2 + (i % 2) * 1.2); p.ty = cy - 1.5 - Math.floor(i / 2) * 1.4; p.sp = 7;
    });
    for (const p of def) { if (p.pos !== 'GK') { p.mark = null; p.scripted = true; p.tx = p.x - d * 3; p.ty = p.y; p.sp = 1.6; p.face = 'up'; } }
    showBanner(ev, scorer);
    S.camFocus = scorer;
    // konfeti (tribünden)
    for (let i = 0; i < 70; i++) S.confetti.push({ x: Math.random(), y: -Math.random() * 0.3, v: 0.12 + Math.random() * 0.2, c: (homeScored ? homeFans : awayFans)[i % 2], ph: Math.random() * 6 });
  }

  function showBanner(ev, scorer) {
    if (!banner) return;
    const club = ev.side === 'my' ? myClub : oppClub;
    const nm = (scorer?.name || '').toUpperCase();
    const ast = ev.assistLabel ? `<small>Asist: ${escapeHtml(ev.assistLabel)}</small>` : '';
    banner.innerHTML = `<div class="bcg" style="--c1:${club.colors[0]};--c2:${club.colors[1]}"><b>GOL!</b><span><em>${scorer?.num ?? ''}</em>${escapeHtml(nm)}</span>${ast}</div>`;
    banner.classList.remove('on');
    void banner.offsetWidth;
    banner.classList.add('on');
    clearTimeout(showBanner.tm);
    showBanner.tm = setTimeout(() => banner.classList.remove('on'), 2300 / Math.max(1, S.rate));
  }

  function setTag(text, cls = '') {
    if (!tagEl) return;
    tagEl.textContent = text;
    tagEl.className = `bc-tag ${cls}`;
  }

  /** Geçiş perdesi (kesme): kapanır → fn → açılır */
  function wipe(fn, dur = 0.5) {
    return new Promise((res) => {
      S.wipe = { t: 0, dur, fn, fired: false, res };
    });
  }

  // ─────────────────────────── Çizim ───────────────────────────
  function drawStands() {
    const g = ctx;
    const sb = standsBottom();
    // gökyüzü / çatı arkası
    g.fillStyle = '#0a0f18';
    g.fillRect(0, 0, W, Math.max(0, sb));
    if (!crowd) return;
    const mode = S.crowdT > 0 ? S.crowdMode : Math.floor(S.time * 2.6) % 2 ? 'b' : 'a';
    const fr = crowd.frames[mode] || crowd.frames.a;
    const u = crowd.u;
    const x0 = W / 2 - (23 + S.cam.x) * ppm() * crowd.crowdSc;
    const top = sb - crowd.hU * u;
    g.imageSmoothingEnabled = false;
    g.drawImage(fr, 0, 0, crowd.wU, crowd.hU, Math.round(x0), Math.round(top), crowd.wU * u, crowd.hU * u);
    // bayraklar (dalgalanır)
    for (const f of crowd.flags) {
      const fx0 = x0 + f.x * u;
      if (fx0 < -40 || fx0 > W + 40) continue;
      const fy0 = top + f.y * u;
      const cel = S.crowdT > 0 && ((S.crowdMode === 'home' && !f.away) || (S.crowdMode === 'away' && f.away));
      const amp = cel ? 1.8 : 1;
      g.fillStyle = '#9ca3af';
      g.fillRect(Math.round(fx0), Math.round(fy0 - 2 * u), Math.max(1, u * 0.5), 12 * u);
      const fw = 11;
      const fh = 7;
      for (let i = 0; i < fw; i++) {
        const wv = Math.round(Math.sin(S.time * 7 * amp + f.ph + i * 0.7) * amp * (i / fw) * 1.6);
        for (let j = 0; j < fh; j++) {
          let col;
          if (f.kind === 'check') col = ((i >> 1) + (j >> 1)) % 2 ? f.c1 : f.c2;
          else if (f.kind === 'half') col = j < fh / 2 ? f.c1 : f.c2;
          else col = j === 2 || j === 4 ? f.c2 : f.c1;
          g.fillStyle = shade(col, i > fw * 0.7 ? -0.12 : 0);
          g.fillRect(Math.round(fx0 + (i + 1) * u), Math.round(fy0 + (j - 2 + wv) * u), u, u);
        }
      }
    }
  }

  function drawBoards() {
    const g = ctx;
    const bh = boardH();
    const by = yFar() - shiftY - bh;
    const s = FAR * 0.985;
    const pw = 15;
    // alt gölge şeridi
    g.fillStyle = '#0b1220';
    g.fillRect(0, by - 2, W, bh + 3);
    const shift = S.boardShift;
    const font = `900 ${Math.round(bh * 0.5)}px "Arial Black", Impact, system-ui, sans-serif`;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = -2; i < 10; i++) {
      const x0 = W / 2 + (i * pw - 12 - S.cam.x) * ppm() * s;
      const w = pw * ppm() * s - 2;
      if (x0 > W || x0 + w < 0) continue;
      const sp = SPONSORS[((i + 2) * 3 + shift) % SPONSORS.length];
      const nx = SPONSORS[((i + 2) * 3 + shift + 1) % SPONSORS.length];
      const roll = S.boardT < 0.35 ? ease(1 - S.boardT / 0.35) : 0; // yeni reklama kayış
      g.save();
      g.beginPath();
      g.rect(x0, by, w, bh);
      g.clip();
      const draw = (spn, oy) => {
        g.fillStyle = spn.bg;
        g.fillRect(x0, by + oy, w, bh);
        g.fillStyle = spn.fg;
        g.fillText(spn.t, x0 + w / 2, by + oy + bh * 0.54, w - 8);
      };
      if (roll > 0) { draw(sp, -bh * (1 - roll)); draw(nx, bh * roll); }
      else draw(sp, 0);
      // LED tarama çizgileri + parıltı
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let yy = by + 1; yy < by + bh; yy += 2) g.fillRect(x0, yy, w, 1);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x0, by, w, 1.5);
      g.restore();
    }
  }

  function poly(pts, fill) {
    const g = ctx;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }

  function drawPitch() {
    const g = ctx;
    const topY = Y(-0.04);
    g.fillStyle = snow ? '#7fa58a' : '#3c8636';
    g.fillRect(0, topY, W, H - topY + 2);
    // çim bantları (biçme izleri)
    const band = 5.25;
    for (let i = -4; i < 24; i++) {
      const x0 = i * band;
      const x1 = x0 + band;
      const pts = [[X(x0, -0.04), Y(-0.04)], [X(x1, -0.04), Y(-0.04)], [X(x1, 1.4), Y(1.4)], [X(x0, 1.4), Y(1.4)]];
      if (Math.max(pts[1][0], pts[2][0]) < 0 || Math.min(pts[0][0], pts[3][0]) > W) continue;
      poly(pts, i % 2 ? (snow ? '#86ad90' : '#45973e') : (snow ? '#7aa286' : '#3d8a37'));
    }
    // doku
    if (grassPat) {
      g.save();
      const m = new DOMMatrix([1, 0, 0, 1, Math.round(-S.cam.x * ppm() * 0.8) % 64, Math.round(-shiftY) % 64]);
      grassPat.setTransform?.(m);
      g.fillStyle = grassPat;
      g.fillRect(0, topY, W, H - topY);
      g.restore();
    }
    // uzak taraf pusu
    const grd = g.createLinearGradient(0, topY, 0, topY + H * 0.3);
    grd.addColorStop(0, 'rgba(10,20,30,0.22)');
    grd.addColorStop(1, 'rgba(10,20,30,0)');
    g.fillStyle = grd;
    g.fillRect(0, topY, W, H * 0.3);
    if (o.weather) fx.tint?.(g, W, H);
    // çizgiler
    g.strokeStyle = 'rgba(246,248,240,0.88)';
    g.lineCap = 'round';
    const seg = (pts) => {
      g.beginPath();
      pts.forEach(([x, y], i) => { const [sx, sy] = P(x, y); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
      g.stroke();
    };
    const lineSeg = (x0, y0, x1, y1, n = 6) => { const pts = []; for (let i = 0; i <= n; i++) pts.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]); seg(pts); };
    const arc = (cx, cy, r, a0, a1, n = 28) => { const pts = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } seg(pts); };
    g.lineWidth = Math.max(1, W / 300);
    lineSeg(0, 0, PL, 0, 2);
    lineSeg(0, PWm, PL, PWm, 2);
    lineSeg(0, 0, 0, PWm, 8);
    lineSeg(PL, 0, PL, PWm, 8);
    lineSeg(52.5, 0, 52.5, PWm, 8);
    arc(52.5, 34, 9.15, 0, Math.PI * 2, 48);
    for (const [gx, d] of [[0, 1], [PL, -1]]) {
      lineSeg(gx, 13.84, gx + d * 16.5, 13.84, 3);
      lineSeg(gx + d * 16.5, 13.84, gx + d * 16.5, 54.16, 8);
      lineSeg(gx + d * 16.5, 54.16, gx, 54.16, 3);
      lineSeg(gx, 24.84, gx + d * 5.5, 24.84, 2);
      lineSeg(gx + d * 5.5, 24.84, gx + d * 5.5, 43.16, 4);
      lineSeg(gx + d * 5.5, 43.16, gx, 43.16, 2);
      const a = Math.acos(5.5 / 9.15);
      if (d > 0) arc(gx + 11, 34, 9.15, -a, a, 14); else arc(gx - 11, 34, 9.15, Math.PI - a, Math.PI + a, 14);
      // penaltı noktası
      const [px, py] = P(gx + d * 11, 34);
      g.fillStyle = 'rgba(246,248,240,0.9)';
      g.fillRect(px - 1.5, py - 1, 3, 2);
      // köşe yayları
      arc(gx, 0, 1, d > 0 ? 0 : Math.PI / 2, d > 0 ? Math.PI / 2 : Math.PI, 6);
      arc(gx, PWm, 1, d > 0 ? -Math.PI / 2 : Math.PI, d > 0 ? 0 : Math.PI * 1.5, 6);
    }
    const [cx, cy] = P(52.5, 34);
    g.fillStyle = 'rgba(246,248,240,0.9)';
    g.fillRect(cx - 1.5, cy - 1, 3, 2);
  }

  /** Kale: arka kısım (uzak direk + ağ) ve ön kısım (yakın direk + üst direk) ayrı çizilir → top ağın içinde kalır */
  function drawGoal(gx, d, part) {
    const g = ctx;
    const back = gx - d * 2.0;
    const bul = S.bulge && S.bulge.gx === gx ? S.bulge : null;
    const bulgeAt = (y, z) => {
      if (!bul) return 0;
      const k = Math.exp(-bul.t * 2.4) * Math.sin(bul.t * 16 + 0.5) * 0.9;
      const near = Math.exp(-((y - bul.y) ** 2) / 6 - ((z - bul.z) ** 2) / 2);
      return -d * k * near * 0.9 - d * 0.5 * near * Math.exp(-bul.t * 1.5);
    };
    const s0 = sc(GY0 / PWm);
    g.lineWidth = Math.max(1, W / 520);
    g.strokeStyle = 'rgba(255,255,255,0.42)';
    const L2 = (a, b) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
    if (part === 'back') {
      // arka ağ (dikey + yatay ızgara), üst ağ, uzak yan ağ
      for (let i = 0; i <= 10; i++) {
        const y = lerp(GY0, GY1, i / 10);
        const bx = back + bulgeAt(y, 1);
        L2(P(gx, y, GH), P(bx, y, 1.7));
        L2(P(bx, y, 1.7), P(back + bulgeAt(y, 0.3), y, 0));
      }
      for (const z of [0.35, 0.75, 1.15, 1.55]) {
        const pts = [];
        for (let i = 0; i <= 10; i++) { const y = lerp(GY0, GY1, i / 10); pts.push(P(back + bulgeAt(y, z), y, z)); }
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        g.stroke();
      }
      for (let k = 1; k <= 4; k++) { const fx2 = lerp(gx, back, k / 5); L2(P(fx2, GY0, lerp(GH, 1.7, k / 5)), P(fx2, GY0, 0)); }
      // uzak direk
      g.strokeStyle = '#f8fafc';
      g.lineWidth = Math.max(2, 0.12 * ppm() * s0);
      L2(P(gx, GY0, 0), P(gx, GY0, GH));
    } else {
      g.strokeStyle = 'rgba(255,255,255,0.42)';
      g.lineWidth = Math.max(1, W / 520);
      for (let k = 1; k <= 4; k++) { const fx2 = lerp(gx, back, k / 5); L2(P(fx2, GY1, lerp(GH, 1.7, k / 5)), P(fx2, GY1, 0)); }
      L2(P(gx, GY1, GH), P(back, GY1, 1.7));
      L2(P(back, GY1, 1.7), P(back, GY1, 0));
      g.strokeStyle = '#f8fafc';
      g.lineWidth = Math.max(2, 0.12 * ppm() * sc(GY1 / PWm));
      L2(P(gx, GY1, 0), P(gx, GY1, GH));
      L2(P(gx, GY0, GH), P(gx, GY1, GH));
    }
  }

  function drawCornerFlag(x, y) {
    const [sx, sy] = P(x, y);
    const s = sc(y / PWm);
    const hgt = 1.6 * ppm() * s;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(Math.round(sx), Math.round(sy - hgt), Math.max(1, s * 2), hgt);
    const wv = Math.sin(S.time * 6 + x) * 2 * s;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(sx + 1, sy - hgt);
    ctx.lineTo(sx + 1 + 7 * s, sy - hgt + 2.5 * s + wv * 0.4);
    ctx.lineTo(sx + 1, sy - hgt + 5 * s);
    ctx.fill();
  }

  function facing(p) {
    if (p.face) return p.face;
    const b = S.ball;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    if (Math.abs(dx) * 0.8 > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  }

  function drawActor(p, isRef = false) {
    const t = p.y / PWm;
    const [sx, sy] = P(p.x, p.y);
    if (sx < -40 || sx > W + 40 || sy < -20 || sy > H + 80) return;
    const h = 1.78 * ppm() * sc(t);
    const sp = Math.hypot(p.vx, p.vy);
    let dir;
    let flip = false;
    let frame;
    if (p.pose) {
      frame = p.pose;
      if (p.pose === 'lunge' && p.side) { dir = p.rot ? (p.ty > 34 ? 'down' : 'up') : 'side'; flip = !p.rot && (p.side === 'my' ? false : true); }
      else if (p.pose === 'ready') { dir = 'down'; }
      else { const f = sp > 0.3 ? dirFromVelocity(p.vx, p.vy, 'down') : null; dir = f ? f.dir : 'side'; flip = f ? f.flip : dirOf(p.side || 'my') < 0; if (p.pose === 'kick') { dir = 'side'; flip = (p.vx || dirOf(p.side)) < 0; } }
    } else if (p.celebrate && sp < 0.6) {
      frame = 'ready'; dir = 'down';
    } else if (sp > 0.35) {
      const f = dirFromVelocity(p.vx, p.vy, p.st.last || 'down');
      dir = f.dir; flip = f.flip;
      p.st.last = f.dir === 'side' ? (f.flip ? 'left' : 'right') : f.dir;
      frame = runFrame(p.ph, sp);
    } else {
      const fc = facing(p);
      dir = fc === 'left' || fc === 'right' ? 'side' : fc;
      flip = fc === 'left';
      frame = 'idle';
    }
    const lift = (p.lift || 0) * ppm() * sc(t);
    drawPixelPlayer(ctx, sx, sy, h, p.look, { dir, flip, frame, rot: p.rot || 0, lift, shadow: true, marker: !isRef && p === mePlayer && meOn ? '#ff4d4d' : null });
  }

  function drawBall() {
    const b = S.ball;
    const t = b.y / PWm;
    const [sx, sy] = P(b.x, b.y);
    const s = sc(t);
    const size = Math.max(4, 0.42 * ppm() * s);
    setBallVariant(snow ? 'orange' : 'white');
    drawPixelBall(ctx, sx, sy - size * 0.42, size, b.rot, { lift: b.z * ppm() * s * 0.95 });
  }

  function drawWipe() {
    const w = S.wipe;
    if (!w) return;
    const p = clamp(w.t / w.dur, 0, 1);
    // 0 → 0.5 kapanır, 0.5 → 1 açılır
    const cover = p < 0.5 ? ease(p * 2) : ease((1 - p) * 2);
    const g = ctx;
    const x = lerp(-W * 0.6, W * 0.5, p < 0.5 ? ease(p * 2) : 1) + (p >= 0.5 ? (p - 0.5) * 2 * W * 1.2 : 0);
    g.save();
    g.globalAlpha = 0.97;
    const bw = W * 1.4 * Math.max(0.35, cover);
    g.translate(x, 0);
    g.transform(1, 0, -0.35, 1, 0, 0);
    g.fillStyle = '#0b1d3a';
    g.fillRect(-bw / 2, 0, bw, H);
    g.fillStyle = '#ffd23f';
    g.fillRect(-bw / 2 - 8, 0, 8, H);
    g.fillRect(bw / 2, 0, 5, H);
    g.fillStyle = '#e8541e';
    g.fillRect(-bw / 2 - 14, 0, 4, H);
    g.restore();
    if (cover > 0.6) {
      g.save();
      g.globalAlpha = (cover - 0.6) / 0.4;
      if (logo && logo.complete && logo.naturalWidth) {
        const lh = H * 0.62;
        g.drawImage(logo, W / 2 - lh / 2, H / 2 - lh / 2, lh, lh);
      } else {
        g.fillStyle = '#ffd23f';
        g.font = `900 ${Math.round(H * 0.12)}px "Arial Black", system-ui`;
        g.textAlign = 'center';
        g.fillText('NEW FOOTBALL STARS', W / 2, H / 2);
      }
      g.restore();
    }
  }

  function drawMini() {
    if (!mctx || !mini.width) return;
    const g = mctx;
    const w = mini.width;
    const h = mini.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(14, 40, 22, 0.82)';
    g.fillRect(0, 0, w, h);
    const m = 3 * dpr;
    const mx = (x) => m + (x / PL) * (w - 2 * m);
    const my = (y) => m + (y / PWm) * (h - 2 * m);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = Math.max(1, dpr * 0.8);
    g.strokeRect(mx(0), my(0), mx(PL) - mx(0), my(PWm) - my(0));
    g.beginPath(); g.moveTo(mx(52.5), my(0)); g.lineTo(mx(52.5), my(PWm)); g.stroke();
    g.beginPath(); g.arc(mx(52.5), my(34), (9.15 / PL) * (w - 2 * m), 0, Math.PI * 2); g.stroke();
    g.strokeRect(mx(0), my(13.84), mx(16.5) - mx(0), my(54.16) - my(13.84));
    g.strokeRect(mx(PL - 16.5), my(13.84), mx(PL) - mx(PL - 16.5), my(54.16) - my(13.84));
    const r = Math.max(2, 1.6 * dpr);
    for (const p of players) {
      g.fillStyle = p.side === 'my' ? myClub.colors[0] : oppClub.colors[0];
      g.beginPath(); g.arc(mx(p.x), my(p.y), r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = p === mePlayer && meOn ? '#ff4d4d' : 'rgba(0,0,0,0.6)';
      g.lineWidth = p === mePlayer && meOn ? 1.6 * dpr : 0.8 * dpr;
      g.stroke();
    }
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(mx(S.ball.x), my(S.ball.y), r * 0.8, 0, Math.PI * 2); g.fill();
  }

  function render() {
    const g = ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    drawStands();
    drawBoards();
    drawPitch();
    // derinlik sıralı varlıklar
    const ents = [];
    for (const p of players) ents.push({ t: p.y / PWm + (p.pos === 'GK' ? 0.0005 : 0), f: () => drawActor(p) });
    ents.push({ t: ref.y / PWm, f: () => drawActor(ref, true) });
    ents.push({ t: S.ball.y / PWm + 0.0002, f: drawBall });
    for (const [gx, d] of [[0, 1], [PL, -1]]) {
      ents.push({ t: GY0 / PWm - 0.001, f: () => drawGoal(gx, d, 'back') });
      ents.push({ t: GY1 / PWm + 0.001, f: () => drawGoal(gx, d, 'front') });
    }
    for (const [x, y] of [[0, 0], [PL, 0], [0, PWm], [PL, PWm]]) ents.push({ t: y / PWm, f: () => drawCornerFlag(x, y) });
    ents.sort((a, b) => a.t - b.t);
    for (const e of ents) e.f();
    // konfeti
    if (S.confetti.length) {
      for (const c of S.confetti) {
        g.fillStyle = c.c;
        g.fillRect(Math.round(c.x * W + Math.sin(S.time * 3 + c.ph) * 6), Math.round(c.y * H), 2, 3);
      }
    }
    if (o.weather) fx.sky?.(g, W, H, S.time);
    // gol parlaması
    if (S.flash > 0) { g.fillStyle = `rgba(255,255,255,${S.flash * 0.35})`; g.fillRect(0, 0, W, H); }
    // tekrar: sinema bantları
    if (S.replaying) {
      g.fillStyle = 'rgba(0,0,0,0.85)';
      g.fillRect(0, 0, W, H * 0.06);
      g.fillRect(0, H * 0.94, W, H * 0.06);
      g.fillStyle = 'rgba(255, 210, 63, 0.08)';
      g.fillRect(0, 0, W, H);
    }
    // vinyet
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    drawWipe();
  }

  // ─────────────────────────── Döngü ───────────────────────────
  function update(dt) {
    S.time += dt;
    S.boardT += dt;
    if (S.boardT > 7) { S.boardT = 0; S.boardShift = (S.boardShift + 1) % SPONSORS.length; }
    if (S.crowdT > 0) S.crowdT -= dt;
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2.5);
    if (S.bulge) { S.bulge.t += dt; if (S.bulge.t > 2.5) S.bulge = null; }
    if (S.confetti.length) {
      for (const c of S.confetti) c.y += c.v * dt;
      S.confetti = S.confetti.filter((c) => c.y < 0.45);
    }
    if (S.wipe) {
      const w = S.wipe;
      w.t += dt;
      if (!w.fired && w.t >= w.dur / 2) { w.fired = true; w.fn?.(); }
      if (w.t >= w.dur) { S.wipe = null; w.res(); }
    }
    if (S.freeze || S.wipe?.fired) return;
    if (S.script) updateScript(dt);
    else ambient(dt);
    for (const p of players) steer(p, dt);
    // hakem: topu çapraz takip
    const b = S.ball;
    const rt = [clamp(b.x - 9 * (b.x > 52.5 ? 1 : -1) * 0.5, 8, 97), clamp(b.y + 11, 8, 60)];
    ref.vx += ((rt[0] - ref.x) * 0.9 - ref.vx) * Math.min(1, dt * 2);
    ref.vy += ((rt[1] - ref.y) * 0.9 - ref.vy) * Math.min(1, dt * 2);
    const rs = Math.hypot(ref.vx, ref.vy);
    if (rs > 6) { ref.vx *= 6 / rs; ref.vy *= 6 / rs; }
    ref.x += ref.vx * dt;
    ref.y += ref.vy * dt;
    ref.ph += rs * dt * 1.9;
    updateBall(dt);
    // kamera
    const focus = S.camFocus || b;
    const lead = b.owner ? dirOf(b.owner.side) * 3 : 0;
    const tx = clamp(focus.x + lead, 8, PL - 8);
    S.cam.x += (tx - S.cam.x) * (1 - Math.exp(-dt * 2.4));
    const tt = clamp(focus.y / PWm, 0.3, 0.92);
    S.cam.t += (tt - S.cam.t) * (1 - Math.exp(-dt * 1.6));
    shiftY = clamp((S.cam.t - 0.5) * H * 0.42, 0, H * 0.17);
  }

  let raf = 0;
  let last = 0;
  let frameN = 0;
  function loop(now) {
    if (!root.isConnected) { stop(); return; }
    const dt0 = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    S.rate = rateNow() * (S.replaying ? 0.5 : 1);
    if (!S.paused) {
      resize();
      // sabit adımlar (yüksek hızda da kararlı)
      let rem = dt0 * S.rate;
      while (rem > 0) { const st = Math.min(1 / 60, rem); update(st); rem -= st; }
      render();
      if (frameN++ % 2 === 0) drawMini();
    }
    raf = requestAnimationFrame(loop);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  // ─────────────────────────── Dış API ───────────────────────────
  kickoffShape(o.homeIsMy ? 'my' : 'opp');
  resize();

  const api = {
    get playersCount() { return players.length; },
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } },
    stop,
    pause() { S.paused = true; },
    resume() { S.paused = false; last = 0; },
    onSfx(fn) { sfxHook = fn; },
    /** Tünel çıkışı: oyuncular orta sahada sıraya dizilir, tribün coşar, sonra yerlerine koşar */
    async intro() {
      if (o.auto) return;
      const home = team(o.homeIsMy ? 'my' : 'opp');
      const away = team(o.homeIsMy ? 'opp' : 'my');
      S.freeze = false;
      const line = () => {
        home.forEach((p, i) => { place(p, 52.5 - 1.4 - (10 - i) * 0.95, 44); p.face = 'down'; p.scripted = true; });
        away.forEach((p, i) => { place(p, 52.5 + 1.4 + i * 0.95, 44); p.face = 'down'; p.scripted = true; });
        ref.x = 52.5; ref.y = 44.3; ref.vx = 0; ref.vy = 0;
        S.ball = { ...S.ball, x: 52.5, y: 45.2, z: 0, owner: null, flight: null, vx: 0, vy: 0 };
        S.cam.x = 52.5; S.cam.t = 0.66;
        S.camFocus = { x: 52.5, y: 44 };
        S.crowdMode = 'home'; S.crowdT = 3.2;
      };
      await wipe(line, 0.6);
      setTag('TAKIMLAR SAHADA', 'live');
      await startScript([], 1.7);
      // yerlerine koşu
      for (const p of players) {
        const [bx, by] = baseOf(p);
        const d = dirOf(p.side);
        p.face = null;
        p.tx = d > 0 ? clamp(bx * 0.92, 3, 50) : clamp(PL - (PL - bx) * 0.92, 55, PL - 3);
        p.ty = by;
        p.sp = 6;
      }
      S.camFocus = null;
      await startScript([], 1.6);
      setTag('CANLI', 'live');
      kickoffShape(o.homeIsMy ? 'my' : 'opp');
    },
    /**
     * Gol ya da pozisyonu canlandırır.
     * ev: {side:'my'|'opp', outcome:'goal'|'save'|'post'|'miss', kind, scorer, assist, me, meAssist, assistLabel, replay}
     */
    async play(ev) {
      if (S.script || S.wipe) return;
      const seed = (Math.random() * 1e9) >>> 0;
      let scn = null;
      setTag(ev.outcome === 'goal' ? 'CANLI' : 'POZİSYON', 'live');
      await wipe(() => { scn = buildScenario(ev, seed); S.camFocus = null; }, o.auto ? 0.12 : 0.5);
      await startScript(scn.events, scn.total);
      if (ev.outcome === 'goal' && ev.replay && !o.auto && (o.speed?.() || 1) === 1) {
        // yavaş çekim tekrar (aynı tohum → aynı hareket)
        await wipe(() => { S.replaying = true; setTag('↺ TEKRAR', 'replay'); const r = buildScenario(ev, seed); scn = r; }, 0.45);
        await startScript(scn.events, scn.tShot + 1.4);
        S.replaying = false;
      }
      for (const p of players) { p.celebrate = false; p.holdPose = false; p.pose = null; p.rot = 0; p.lift = 0; p.scripted = false; p.mark = null; p.face = null; p.waitT = 0; }
      S.camFocus = null;
      if (ev.outcome === 'goal') {
        await wipe(() => {
          S.netLock = null;
          S.bulge = null;
          kickoffShape(other(ev.side));
          setTag('CANLI', 'live');
        }, o.auto ? 0.12 : 0.45);
      } else {
        S.netLock = null;
        if (ev.outcome === 'miss') S.restart = { t: 0.5, kind: 'gk', team: other(ev.side) };
        setTag('CANLI', 'live');
      }
    },
    /** Devre arası: perde + ikinci yarı başlama vuruşu */
    async halfTime() {
      setTag('DEVRE ARASI', 'live');
      await wipe(() => kickoffShape(o.homeIsMy ? 'opp' : 'my'), o.auto ? 0.1 : 0.8);
      setTag('CANLI', 'live');
    },
    fullTime(res) {
      S.freeze = true;
      for (const p of players) { p.vx = 0; p.vy = 0; }
      setTag('MAÇ SONU', 'live');
      if (res) { S.crowdMode = res; S.crowdT = 5; }
    },
    /** Oyuncu oyuna girdi / çıktı */
    setOnPitch(on) { meOn = !!on; applyMe(); },
    face() { return mePlayer?.meLook || me.look; },
  };
  return api;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
