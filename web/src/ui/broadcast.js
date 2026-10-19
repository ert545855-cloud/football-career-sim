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
  const SUB_NAME = ['Emre Kaya', 'Burak Şahin', 'Can Yıldız', 'Mert Aksoy', 'Deniz Kurt', 'Onur Çelik'][Math.floor(Math.random() * 6)];
  function applyMe() {
    if (!mePlayer) return;
    if (meOn) { mePlayer.look = mePlayer.meLook; mePlayer.name = me.name; mePlayer.num = me.num; }
    else { mePlayer.look = subLook; mePlayer.name = SUB_NAME; mePlayer.num = 14; }
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
  const rateNow = () => (o.auto ? 5 : ({ 1: 0.75, 2: 1.2, 4: 1.8 }[o.speed?.() || 1] || 0.75));
  /** Geçişler gerçek zamanlı akar (yayın hızından bağımsız), sadece 2x/4x'te biraz hızlanır */
  const wipeRate = () => (o.auto ? 6 : ({ 1: 1, 2: 1.35, 4: 1.9 }[o.speed?.() || 1] || 1));

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

  // ─────────────────────────── Tribün (önceden çizilir): iki katlı stadyum ───────────────────────────
  function buildCrowd() {
    const u = Math.max(2, Math.round(H / 115));
    const hU = Math.ceil((H * 0.5) / u);
    const crowdSc = FAR * 0.93;
    const wU = Math.ceil(((PL + 46) * ppm() * crowdSc) / u);
    const r = seeded(4242);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const rowH = 5;
    const roofH = 7;
    const balcony = 7;
    const frontH = 9;
    const upperBottom = Math.round(roofH + (hU - roofH - frontH) * 0.36);
    const lowerTop = upperBottom + balcony;
    const aisle = (x) => x % 52 < 5;
    const awayFrom = wU * 0.77;
    const awayTo = wU * 0.93;
    const fans = [];
    const rowsY = [];
    const addTier = (top, bottom, tier) => {
      const rows = Math.floor((bottom - top - 2) / rowH);
      for (let row = 0; row < rows; row++) {
        const yb = bottom - 2 - row * rowH;
        rowsY.push({ yb, tier, row });
        for (let x = (row % 2) * 2 + 1; x < wU - 3; x += 4 + (r() < 0.12 ? 1 : 0)) {
          if (aisle(x) || aisle(x + 2)) continue;
          if (r() < (tier === 'up' ? 0.08 : 0.04)) continue;
          const away = tier === 'low' && x > awayFrom && x < awayTo;
          const pal = away ? awayFans : homeFans;
          const v = r();
          const shirt = v < 0.46 ? pal[0] : v < 0.74 ? pal[1] : v < 0.85 ? '#1f2937' : v < 0.91 ? '#e5e7eb' : pick(['#475569', '#7c2d12', '#334155', '#9ca3af']);
          fans.push({ x, yb, shirt, skin: pick(SKINS), hair: pick(HAIR_COLORS), away, ph: r(), dk: (tier === 'up' ? 0.25 : 0) + (row / Math.max(1, rows)) * 0.3, scarf: r() < 0.25 });
        }
      }
    };
    addTier(roofH, upperBottom, 'up');
    addTier(lowerTop, hU - frontH + 2, 'low');
    const banners = [];
    const bannerTexts = [
      (o.names?.home || 'EV SAHİBİ').toUpperCase(),
      'SONUNA KADAR',
      `ŞAMPİYON ${(o.names?.homeShort || '').toUpperCase()}`.trim(),
      'HEP SENİNLEYİZ',
      `${(o.names?.city || 'ŞEHİR').toUpperCase()} BURADA`,
      'BU TRİBÜN SUSMAZ',
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
    for (let i = 0; i < 12; i++) {
      const fxu = 24 + i * (wU / 12.5) + r() * 16;
      const away = fxu > awayFrom && fxu < awayTo;
      const pal = away ? awayFans : homeFans;
      const lowRows = rowsY.filter((q) => q.tier === 'low');
      const ry = lowRows[Math.floor(r() * Math.max(1, lowRows.length - 1))]?.yb ?? hU - 14;
      flags.push({ x: fxu, y: ry - 6, c1: pal[0], c2: pal[1], kind: r() < 0.45 ? 'check' : r() < 0.5 ? 'half' : 'band', ph: r() * 6, away });
    }
    const make = (mode) => {
      const c = document.createElement('canvas');
      c.width = wU;
      c.height = hU;
      const g = c.getContext('2d');
      const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      // basamaklar (beton) + koltuk sıraları
      R(0, 0, wU, hU, '#151b26');
      for (const q of rowsY) {
        R(0, q.yb - 1, wU, 2, q.tier === 'up' ? (q.row % 2 ? '#171e2a' : '#1a2230') : (q.row % 2 ? '#1d2533' : '#212a3a'));
        R(0, q.yb + 1, wU, 1, '#0f141d');
      }
      // merdivenler (her iki katta)
      for (let x = 0; x < wU; x += 52) {
        for (const [y0, y1] of [[roofH, upperBottom], [lowerTop, hU - frontH]]) {
          for (let y = y0; y < y1; y += 2) R(x, y, 5, 1, y % 4 ? '#525b6b' : '#727b8b');
          R(x, y0, 1, y1 - y0, '#facc15');
          R(x + 4, y0, 1, y1 - y0, '#facc15');
        }
      }
      // taraftarlar: sakin / dalga / sevinç / atkı açma
      const sc = mode === 'scarf';
      for (const f of fans) {
        const cel = (mode === 'home' && !f.away) || (mode === 'away' && f.away) || mode === 'all';
        const jump = cel ? -1 - (f.ph < 0.5 ? 1 : 0) : mode === 'b' ? (f.ph < 0.5 ? -1 : 0) : 0;
        const dk = f.dk;
        const y = f.yb + jump;
        R(f.x, y - 2, 3, 3, shade(f.shirt, -dk));
        if (f.scarf && !sc) R(f.x, y - 2, 3, 1, shade(f.away ? awayFans[1] : homeFans[1], -dk));
        R(f.x + (f.ph < 0.3 ? 1 : 0), y - 4, 2, 2, shade(f.skin, -dk));
        if (f.ph > 0.2) R(f.x + (f.ph < 0.3 ? 1 : 0), y - 4, 2, 1, shade(f.hair, -dk));
        if (cel) {
          R(f.x - 1, y - 6, 1, 4, shade(f.skin, -dk));
          R(f.x + 3, y - 6, 1, 4, shade(f.skin, -dk));
        } else if (sc && !f.away) {
          // atkılar başların üstünde gergin
          R(f.x - 1, y - 6, 5, 1, shade((f.ph < 0.5 ? homeFans[0] : homeFans[1]), -dk));
          R(f.x - 1, y - 5, 1, 2, shade(f.skin, -dk));
          R(f.x + 3, y - 5, 1, 2, shade(f.skin, -dk));
        } else if (mode === 'b' && f.ph > 0.82) {
          R(f.x + 3, y - 5, 1, 3, shade(f.skin, -dk)); // tek kol havada
        }
      }
      // üst kat ile alt kat arası: VIP locaları ve LED şerit
      R(0, upperBottom, wU, balcony, '#2a3242');
      R(0, upperBottom, wU, 1, '#4b5567');
      for (let x = 3; x < wU; x += 9) { R(x, upperBottom + 2, 6, 3, r() < 0.7 ? '#fde68a' : '#93c5fd'); R(x, upperBottom + 2, 6, 1, 'rgba(255,255,255,0.35)'); }
      for (let x = 0; x < wU; x += 4) R(x, upperBottom + balcony - 2, 2, 1, x % 8 ? homeFans[0] : homeFans[1]);
      // ön duvar + pankartlar
      R(0, hU - frontH + 1, wU, frontH - 1, '#1a2130');
      R(0, hU - frontH + 1, wU, 1, '#3b4558');
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
      // çatı: çelik makas + projektör sırası
      R(0, 0, wU, roofH, '#0a0e16');
      R(0, roofH - 1, wU, 1, '#2b3445');
      g.fillStyle = '#1c2433';
      for (let x = 0; x < wU; x += 8) { g.fillRect(x, 1, 1, roofH - 2); for (let k = 0; k < 4; k++) g.fillRect(x + k, 1 + k, 1, 1); }
      for (let x = 6; x < wU; x += 22) { R(x, 2, 5, 3, '#fffbe6'); R(x, 2, 5, 1, '#ffffff'); }
      return c;
    };
    const lights = [];
    for (let x = 6; x < wU; x += 22) lights.push(x + 2.5);
    crowd = { u, hU, wU, crowdSc, flags, lights, lowerTop, upperBottom, awayFrom, awayTo, frames: { a: make('a'), b: make('b'), home: make('home'), away: make('away'), all: make('all'), scarf: make('scarf') } };
    buildTifo();
  }

  /** Dev koreografi (ev sahibi): takım renklerinde şeritler ve kısa ad */
  function buildTifo() {
    if (!crowd) return;
    const tw = Math.round((W * 1.25) / crowd.u);
    const vis = Math.round(standsBottom() / crowd.u) - 6;
    const th = Math.max(16, Math.min(Math.round(crowd.hU - 16), vis));
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const g = c.getContext('2d');
    const [c1, c2] = homeFans;
    for (let x = 0; x < tw; x += 6) { g.fillStyle = Math.floor(x / 6) % 2 ? c1 : c2; g.fillRect(x, 0, 6, th); }
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < th; y += 4) g.fillRect(0, y, tw, 1);
    g.fillStyle = c1;
    g.fillRect(tw * 0.2, th * 0.22, tw * 0.6, th * 0.56);
    g.fillStyle = c2;
    g.font = `900 ${Math.round(th * 0.42)}px "Arial Black", Impact, system-ui`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText((o.names?.homeShort || 'EV').toUpperCase(), tw / 2, th * 0.52, tw * 0.56);
    g.font = `900 ${Math.round(th * 0.14)}px system-ui`;
    g.fillText('★ ★ ★', tw / 2, th * 0.14);
    crowd.tifo = c;
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
    const v = 10 + Math.random() * 4;
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
        p.sp = 5.2;
      } else {
        const [tx, ty] = formationTarget(p);
        p.tx = tx;
        p.ty = ty;
        p.sp = 3.8;
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
      o2.sp = o2.pos === 'GK' ? 2 : 4.4;
      o2.decideT = (o2.decideT ?? 1) - dt;
      if (o2.decideT <= 0) {
        o2.decideT = 1.3 + Math.random() * 1.6;
        const dg = Math.abs(gx - o2.x);
        if (o2.pos !== 'GK' && dg < 22 && Math.abs(o2.y - 34) < 15 && Math.random() < 0.38) ambientShot(o2);
        else if (o2.pos === 'GK' || Math.random() < 0.78) passFrom(o2);
      }
      // top kapma
      const n = nearestTo(team(other(o2.side)), b.x, b.y);
      if (n && n.d < 1.15 && o2.pos !== 'GK' && Math.random() < dt * 0.9) {
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
          if (!S.replaying) ev.onGoal?.();
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
            if (!S.replaying) { coachReact(ev.side === 'my' ? 'miss' : 'save'); hype(ev.side === 'my' ? 'home' : 'away', 0.25); }
          } else if (outcome === 'post') {
            S.ball.vx = -d * 8; S.ball.vy = (rr() - 0.5) * 6; S.ball.vz = 2.5;
            sfxHook('post');
            if (!S.replaying) coachReact(ev.side === 'my' ? 'miss' : 'save');
          } else {
            if (!S.replaying) coachReact(ev.side === 'my' ? 'miss' : 'save');
            fly(gx + d * 7, ty + (ty - 34) * 0.5, 0.3, 0.32, { onEnd: () => { S.ball.vx = d * 2; S.ball.vy = 0; } });
          }
        },
      });
      celebT = T;
    });
    const total = tShot + 0.7 + (outcome === 'goal' ? 3.9 : 1.5);
    return { events: ev2, total, scorer, assister, tShot, getCelebT: () => celebT };
  }

  let sfxHook = () => {};
  /** Gol sevinci: golcü kendi sevincini yapar, takım arkadaşları koşup etrafında halka olur ve zıplar; tribün ve kulübe coşar */
  function celebrate(ev, scorer, att, def, d, gx) {
    if (S.replaying) return;
    const homeScored = (ev.side === 'my') === !!o.homeIsMy;
    S.crowdMode = homeScored ? 'home' : 'away';
    S.crowdT = 6;
    hype(homeScored ? 'home' : 'away', 1);
    coachReact(ev.side === 'my' ? 'cheer' : 'concede');
    // golcü tribünlerin önüne (uzak taç çizgisi, köşeye yakın) koşar: kamera taraftarla birlikte gösterir
    const cx = gx - d * 7;
    const cy = 3.2;
    scorer.scripted = true;
    scorer.tx = cx; scorer.ty = cy; scorer.sp = 7.8;
    scorer.celebrate = true;
    scorer.celebT = 0;
    scorer.celebStyle = scorer === mePlayer && meOn ? (me.celebration || 'corner') : ['corner', 'slide', 'plane', 'heart', 'dance', 'corner', 'flip'][Math.floor(Math.random() * 7)];
    const mates = att.filter((p) => p !== scorer && p.pos !== 'GK').sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, 6);
    mates.forEach((p, i) => {
      p.scripted = true; p.mark = null;
      p.group = { to: scorer, a: (i / mates.length) * Math.PI * 2 + 0.4, r: 1.15 + (i % 2) * 0.35, delay: 0.35 + i * 0.18 };
      p.sp = 7.2;
      p.tx = cx - d * 2; p.ty = cy - 2;
    });
    // kaleci de uzaktan yumruklarını sıkar
    const gk0 = att.find((p) => p.pos === 'GK');
    if (gk0) { gk0.scripted = true; gk0.celebrate = true; gk0.celebStyle = 'heart'; gk0.tx = gk0.x + d * 3; gk0.ty = gk0.y; gk0.sp = 3; }
    for (const p of def) { if (p.pos !== 'GK') { p.mark = null; p.scripted = true; p.tx = p.x - d * 3; p.ty = p.y; p.sp = 1.4; p.face = 'up'; p.dejected = true; } }
    showBanner(ev, scorer);
    S.camFocus = scorer;
    // konfeti (tribünden)
    for (let i = 0; i < 90; i++) S.confetti.push({ x: Math.random(), y: -Math.random() * 0.3, v: 0.1 + Math.random() * 0.18, c: (homeScored ? homeFans : awayFans)[i % 2], ph: Math.random() * 6 });
  }

  /** Takım sevinci hedefleri: golcünün etrafında halka; bir süre sonra iç içe (sarılma) */
  function groupStep(dt) {
    for (const p of players) {
      const gr = p.group;
      if (!gr) continue;
      gr.t = (gr.t || 0) + dt;
      if (gr.t < gr.delay) continue;
      const hug = gr.t > 2.4 ? 0.55 : 1;
      p.tx = gr.to.x + Math.cos(gr.a) * gr.r * 1.2 * hug;
      p.ty = clamp(gr.to.y + 0.9 + Math.sin(gr.a) * gr.r * 0.8 * hug, 0.6, PWm);
      p.sp = Math.hypot(p.tx - p.x, p.ty - p.y) > 3 ? 7.2 : 3;
    }
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
    showBanner.tm = setTimeout(() => banner.classList.remove('on'), 2800 / Math.max(1, S.rate));
  }

  function setTag(text, cls = '') {
    S.tagText = text === 'CANLI' ? '' : text;
    if (!tagEl) return;
    tagEl.textContent = text;
    tagEl.className = `bc-tag ${cls}`;
  }

  // ─────────────────────────── Tribün coşkusu: meşale, duman, koreografi, zıplama ───────────────────────────
  const FX = { flares: [], smoke: [], tifo: null, bounce: 0, nextFlare: 3, chantT: 14 };
  function crowdPoint(away) {
    if (!crowd) return null;
    const x = away ? lerp(crowd.awayFrom + 4, crowd.awayTo - 4, Math.random()) : lerp(10, crowd.awayFrom - 12, Math.random());
    // görünen alt tribünde (yayın kadrajı)
    const visTop = crowd.hU - Math.max(14, (standsBottom() / crowd.u) * 0.85);
    const y = lerp(Math.max(crowd.lowerTop + 4, visTop), crowd.hU - 13, Math.random());
    return { x, y };
  }
  /** Taraf coşar: meşaleler yanar, (ev sahibi golünde) dev koreografi açılır, tribün zıplar */
  function hype(end, power = 1) {
    if (o.auto) return;
    const away = end === 'away';
    const n = Math.round((away ? 5 : 12) * power);
    for (let i = 0; i < n; i++) { const pt = crowdPoint(away); if (pt) FX.flares.push({ ...pt, t: Math.random() * 0.4, life: 3 + Math.random() * 3, ph: Math.random() * 6 }); }
    if (power >= 1 && !away && crowd) FX.tifo = { t: 0, life: 6, cx: ((S.cam.x + 23) * ppm() * crowd.crowdSc) / crowd.u };
    FX.bounce = Math.max(FX.bounce, 5 * power);
  }
  function fxUpdate(dt) {
    FX.nextFlare -= dt;
    if (FX.nextFlare <= 0) {
      FX.nextFlare = 3.5 + Math.random() * 5;
      const pt = crowdPoint(Math.random() < 0.3);
      if (pt) FX.flares.push({ ...pt, t: 0, life: 2.5 + Math.random() * 3, ph: Math.random() * 6 });
    }
    for (const f of FX.flares) {
      f.t += dt;
      if (Math.random() < dt * 10) FX.smoke.push({ x: f.x + (Math.random() - 0.5) * 2, y: f.y - 3, vx: 0.6 + Math.random() * 1.6, vy: -(2.2 + Math.random() * 2.6), r: 1.6 + Math.random() * 1.8, a: 0.34, red: Math.random() < 0.35 });
    }
    FX.flares = FX.flares.filter((f) => f.t < f.life);
    for (const m of FX.smoke) { m.x += m.vx * dt; m.y += m.vy * dt; m.r += dt * 2.4; m.a -= dt * 0.075; }
    FX.smoke = FX.smoke.filter((m) => m.a > 0 && m.y > -14);
    if (FX.smoke.length > 260) FX.smoke.splice(0, FX.smoke.length - 260);
    if (FX.tifo) { FX.tifo.t += dt; if (FX.tifo.t > FX.tifo.life) FX.tifo = null; }
    if (FX.bounce > 0) FX.bounce -= dt;
    FX.chantT -= dt;
    if (FX.chantT <= 0) { FX.chantT = 15 + Math.random() * 15; FX.bounce = Math.max(FX.bounce, 3.2); }
    coachStep(dt);
  }

  // ─────────────────────────── Saha kenarı: teknik direktör kamerası ───────────────────────────
  const coachBox = document.createElement('div');
  coachBox.className = 'bc-coach';
  coachBox.innerHTML = `<canvas></canvas><b class="bc-cbub" data-cbub></b><span>${escapeHtml(o.coach?.name || 'Teknik Direktör')}</span>`;
  root.appendChild(coachBox);
  const ccv = coachBox.querySelector('canvas');
  const cbub = coachBox.querySelector('[data-cbub]');
  const cctx = ccv.getContext('2d');
  const coachLook = defaultLook({
    skin: o.coach?.skin || '#d9a07a', hair: 'short', hairColor: o.coach?.hair || '#2a1a10', beard: true, longSleeve: true, pants: true, stripes: true, zip: true,
    kit: { body: '#161a24', accent: '#e5e7eb', pattern: 'solid', shorts: '#161a24', socks: '#161a24' }, boots: { main: '#f4f4f0', accent: '#16181d' },
  });
  // mood: tepki (cheer/concede/miss/save/instruct) · act: boşta davranış (pace: kenar çizgisinde volta, read: not panosu, stand: kollar bağlı)
  const C = { mood: 'idle', t: 0, show: 0, next: 9 + Math.random() * 8, x: 0.5, tx: 0.5, face: 1, act: 'stand', actT: 2, clip: false, ph: 0, cam: 0, camNext: 14 + Math.random() * 10 };
  const COACH_LINES = {
    cheer: ['GOOOL!', 'İşte bu!', 'Evet, evet!'], concede: ['Olamaz!', 'Uyuyor musunuz?!', 'Nasıl bıraktınız?!'],
    miss: ['Nasıl kaçar?!', 'Of be!', 'Bitir şunu!'], save: ['Bravo!', 'Aferin!', 'Harika kurtarış!'],
    instruct: ['Hadi baskı!', 'Öne çık!', 'Kanatlar!', 'Topu çevir!', 'Sakin olun!'],
  };
  function coachReact(kind) {
    if (o.auto) return;
    C.mood = kind; C.t = 0; C.show = kind === 'cheer' ? 5 : kind === 'concede' ? 4.2 : 3.4;
    if (kind === 'cheer') C.face = C.x > 0.5 ? -1 : 1; // golde kenar çizgisinde birkaç adım koşar
    const ls = COACH_LINES[kind] || [];
    cbub.textContent = ls[Math.floor(Math.random() * ls.length)] || '';
    cbub.className = `bc-cbub ${kind}`;
  }
  function coachPose() {
    const t = C.t;
    switch (C.mood) {
      case 'cheer': return t < 1.1 ? { f: `run${Math.floor(t * 9) % 4}`, dir: 'side', flip: C.face < 0, lift: 0 } : { f: 'cheer', lift: Math.abs(Math.sin(t * 7.5)) * 0.18 };
      case 'concede': return { f: t < 1.4 ? 'angry' : 'sad', lift: 0 };
      case 'miss': return { f: Math.floor(t * 2.5) % 2 ? 'angry' : 'pointL', lift: 0, shake: Math.sin(t * 34) * 0.8 };
      case 'save': return { f: Math.floor(t * 5) % 2 ? 'clap' : 'cross', lift: 0 };
      case 'instruct': return C.clip ? { f: Math.floor(t * 1.3) % 2 ? 'clipPt' : 'clip', lift: 0 } : { f: Math.floor(t * 1.3) % 2 ? 'point' : 'pointL', lift: 0 };
      default:
        if (C.act === 'pace') return { f: `walk${C.clip ? 'C' : ''}${Math.floor(C.ph) % 4}`, dir: 'side', flip: C.face < 0, lift: 0 };
        if (C.act === 'read') return { f: Math.floor(t * 1.6) % 3 === 2 ? 'clipW' : 'clip', lift: 0 };
        return { f: 'cross', lift: 0 };
    }
  }
  /** Boşta sıradaki davranış: volta at (bazen panoya bakarak), panoya not al ya da kollarını bağlayıp izle */
  function coachNextAct() {
    const r = Math.random();
    C.t = 0;
    if (r < 0.55) {
      C.act = 'pace';
      C.clip = Math.random() < 0.45;
      const span = 0.32 + Math.random() * 0.28;
      C.tx = clamp(C.x + (C.x > 0.5 ? -span : span) * (Math.random() < 0.85 ? 1 : -1), 0.2, 0.8);
      C.face = C.tx >= C.x ? 1 : -1;
      C.actT = 9;
    } else if (r < 0.8) {
      C.act = 'read'; C.clip = true; C.actT = 3 + Math.random() * 2.5;
    } else {
      C.act = 'stand'; C.clip = false; C.actT = 2.5 + Math.random() * 2.5;
    }
  }
  function drawCoach() {
    const cw = ccv.clientWidth || 96;
    const ch = ccv.clientHeight || 84;
    if (ccv.width !== Math.round(cw * dpr)) { ccv.width = Math.round(cw * dpr); ccv.height = Math.round(ch * dpr); }
    const g = cctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    // yedek kulübesi: arka duvar, kavisli cam çatı, koltuklar, buzluk, su şişeleri, çim
    g.fillStyle = '#16233b'; g.fillRect(0, 0, cw, ch);
    const floor = ch * 0.8;
    g.fillStyle = '#3a4a66'; g.fillRect(0, ch * 0.18, cw, floor - ch * 0.18);
    g.fillStyle = '#4b5d7e'; g.fillRect(0, ch * 0.18, cw, 2);
    g.fillStyle = 'rgba(148,163,184,0.35)';
    g.beginPath(); g.moveTo(0, ch * 0.2); g.quadraticCurveTo(cw * 0.5, ch * 0.02, cw, ch * 0.2); g.lineTo(cw, ch * 0.26); g.quadraticCurveTo(cw * 0.5, ch * 0.09, 0, ch * 0.26); g.fill();
    g.fillStyle = '#64748b'; for (let x = 4; x < cw; x += cw / 5) g.fillRect(Math.round(x), ch * 0.14, 1, floor - ch * 0.14);
    const seatW = cw / 6.5;
    for (let i = 0; i < 6; i++) {
      const sx = 4 + i * (seatW + 2);
      g.fillStyle = '#1e3a8a'; g.fillRect(sx, ch * 0.42, seatW, ch * 0.2);
      g.fillStyle = '#2547a8'; g.fillRect(sx, ch * 0.58, seatW, ch * 0.06);
    }
    g.fillStyle = '#1d4ed8'; g.fillRect(4, floor - ch * 0.14, cw * 0.16, ch * 0.14);
    g.fillStyle = '#e5e7eb'; g.fillRect(4, floor - ch * 0.14, cw * 0.16, 2);
    g.fillStyle = '#334155'; for (let i = 0; i < 3; i++) g.fillRect(cw - 12 - i * 5, floor - ch * 0.12, 3, ch * 0.12);
    g.fillStyle = '#3c8636'; g.fillRect(0, floor, cw, ch - floor);
    g.fillStyle = '#45973e'; for (let x = 0; x < cw; x += 6) g.fillRect(x, floor, 3, ch - floor);
    // teknik alan: kesikli beyaz çizgi (kulübe önü) ve kenar çizgisi
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let x = 2; x < cw; x += 6) g.fillRect(x, floor - 2, 3, 1);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(0, Math.min(ch - 2, floor + ch * 0.05), cw, Math.max(1.5, ch * 0.022));
    // teknik direktör
    const ps = coachPose();
    const h = ch * 0.5;
    const lift = ps.lift * h;
    const px = cw * C.x;
    // arkasında hafif ışık (koyu eşofman zeminden ayrışsın)
    const gl = g.createRadialGradient(px, floor - h * 0.6, 2, px, floor - h * 0.6, h * 0.9);
    gl.addColorStop(0, 'rgba(255,255,255,0.22)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, cw, ch);
    drawPixelPlayer(g, px + (ps.shake || 0), floor + 1, h, coachLook, { dir: ps.dir || 'down', frame: ps.f, flip: !!ps.flip, lift, shadow: true });
  }
  function coachStep(dt) {
    C.t += dt;
    if (C.show > 0) C.show -= dt;
    if (C.show <= 0 && C.mood !== 'idle') { C.mood = 'idle'; cbub.textContent = ''; coachNextAct(); }
    if (C.mood === 'cheer' && C.t < 1.1) C.x = clamp(C.x + C.face * 0.26 * dt, 0.18, 0.82);
    if (C.mood === 'idle') {
      C.next -= dt;
      if (C.next <= 0 && !S.script) { C.next = 12 + Math.random() * 12; coachReact('instruct'); }
      // kenar çizgisinde volta: yavaş yürüyüş, adım karesi hıza bağlı
      C.actT -= dt;
      if (C.act === 'pace') {
        const d = C.tx - C.x;
        const v = 0.085 * dt;
        if (Math.abs(d) <= v) { C.x = C.tx; coachNextAct(); }
        else { C.x += Math.sign(d) * v; C.face = Math.sign(d); C.ph += dt * 4.2; }
      } else if (C.actT <= 0) coachNextAct();
      // ara sıra yayın kenardaki teknik direktöre kısa bir kesme yapar
      if (!o.auto && !S.replaying) {
        C.camNext -= dt;
        if (C.camNext <= 0 && !S.script && !S.celebrate) {
          C.camNext = 22 + Math.random() * 14;
          C.cam = 6.5;
          if (C.act !== 'pace') { C.act = 'stand'; C.actT = 0; coachNextAct(); }
        }
      }
    }
    if (C.cam > 0) C.cam -= dt;
    const visible = C.show > 0 || C.cam > 0 || root.classList.contains('bc-full');
    coachBox.classList.toggle('on', visible);
    if (visible && !S.paused) drawCoach();
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
    // tribün hali: sevinçte zıplayarak kollar havada, tezahüratta atkılar açık ve zıplama, sakinken dalgalanma
    const beat = Math.floor(performance.now() / 260) % 2;
    let mode;
    if (S.crowdT > 0) mode = beat ? S.crowdMode : 'b';
    else if (FX.bounce > 0) mode = beat ? 'scarf' : 'b';
    else mode = Math.floor(S.time * 2.6) % 2 ? 'b' : 'a';
    const fr = crowd.frames[mode] || crowd.frames.a;
    const u = crowd.u;
    const x0 = W / 2 - (23 + S.cam.x) * ppm() * crowd.crowdSc;
    const jump = (S.crowdT > 0 || FX.bounce > 0) && beat ? -u : 0;
    const top = sb - crowd.hU * u;
    g.imageSmoothingEnabled = false;
    g.drawImage(fr, 0, 0, crowd.wU, crowd.hU, Math.round(x0), Math.round(top + jump), crowd.wU * u, crowd.hU * u);
    // projektör parıltısı
    for (const lx of crowd.lights) {
      const sx = x0 + lx * u;
      if (sx < -30 || sx > W + 30) continue;
      const sy = top + 3.5 * u;
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, u * 9);
      gr.addColorStop(0, 'rgba(255,250,220,0.55)');
      gr.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = gr;
      g.fillRect(sx - u * 9, sy - u * 9, u * 18, u * 18);
    }
    // dev koreografi (açılır, dalgalanır, kapanır)
    if (FX.tifo && crowd.tifo) {
      const tf = FX.tifo;
      const a = Math.min(1, tf.t / 0.8, (tf.life - tf.t) / 0.8);
      const tw = crowd.tifo.width;
      const th = crowd.tifo.height;
      const tx = x0 + (tf.cx - tw / 2) * u;
      const ty = top + (crowd.hU - th - 9) * u;
      g.save();
      g.globalAlpha = clamp(a, 0, 1) * 0.96;
      const sl = 6;
      for (let i = 0; i < tw; i += sl) {
        const wv = Math.round(Math.sin(performance.now() / 260 + i * 0.12) * 1.2) * u;
        g.drawImage(crowd.tifo, i, 0, sl, th, Math.round(tx + i * u), Math.round(ty + wv), sl * u, th * u);
      }
      g.restore();
    }
    // meşaleler ve duman
    for (const f of FX.flares) {
      const sx = x0 + f.x * u;
      if (sx < -40 || sx > W + 40) continue;
      const sy = top + f.y * u + jump;
      const life = Math.min(1, f.t / 0.3, (f.life - f.t) / 0.5);
      const fl = 0.75 + 0.25 * Math.sin(performance.now() / 45 + f.ph);
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, u * 10 * fl);
      gr.addColorStop(0, `rgba(255,120,40,${0.75 * life})`);
      gr.addColorStop(0.35, `rgba(255,60,30,${0.35 * life})`);
      gr.addColorStop(1, 'rgba(255,40,20,0)');
      g.fillStyle = gr;
      g.fillRect(sx - u * 10, sy - u * 10, u * 20, u * 20);
      g.fillStyle = `rgba(255,236,170,${life})`;
      g.fillRect(Math.round(sx - u), Math.round(sy - u * 1.5), u * 2, u * 2);
      g.fillStyle = `rgba(255,90,40,${life})`;
      g.fillRect(Math.round(sx - u * 0.5), Math.round(sy - u * 2.5), u, u);
      if (Math.random() < 0.5) { g.fillStyle = '#ffd166'; g.fillRect(Math.round(sx + (Math.random() - 0.5) * u * 6), Math.round(sy - Math.random() * u * 6), Math.max(1, u / 2), Math.max(1, u / 2)); }
    }
    for (const m of FX.smoke) {
      const sx = x0 + m.x * u;
      if (sx < -60 || sx > W + 60) continue;
      g.fillStyle = m.red ? `rgba(220,90,80,${m.a * 0.7})` : `rgba(205,208,214,${m.a})`;
      g.beginPath();
      g.arc(sx, top + m.y * u, m.r * u, 0, Math.PI * 2);
      g.fill();
    }
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
    } else if (p.group && p.group.t > p.group.delay && sp < 1.2) {
      // takım sevinci: zıplayarak kollar havada, golcüye dönük
      dir = 'down';
      frame = Math.floor(S.time * 4 + p.slot) % 2 ? 'ready' : 'idle';
      p.lift = Math.abs(Math.sin(S.time * 7 + p.slot * 1.3)) * 0.42;
    } else if (p.dejected && sp < 0.8) {
      dir = 'up'; frame = 'idle';
    } else if (p.celebrate && (sp < 0.6 || p.celebStyle === 'plane')) {
      const cs = p.celebStyle || 'corner';
      const ct = p.celebT || 0;
      if (cs === 'plane') { dir = sp > 0.6 ? 'side' : 'down'; flip = p.vx < 0; frame = 'lunge'; }
      else if (cs === 'slide') { dir = 'side'; flip = (p.side === 'my') === (p.x > 52.5) ? false : true; frame = 'lunge'; }
      else if (cs === 'dance') { dir = 'down'; frame = Math.floor(ct * 4) % 2 ? 'run0' : 'run2'; }
      else if (cs === 'flip' && ct < 0.7) { dir = 'side'; frame = 'ready'; p.rot = -Math.PI * 2 * ease(ct / 0.7); p.lift = Math.sin(Math.PI * (ct / 0.7)) * 1.3; }
      else { frame = 'ready'; dir = 'down'; if (cs === 'flip') { p.rot = 0; p.lift = 0; } }
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

  /** Geçiş: iris kapanır → logolu yayın jeneriği → iris açılır (gerçek zamanlı, ~1.5 sn) */
  function drawWipe() {
    const w = S.wipe;
    if (!w) return;
    const p = clamp(w.t / w.dur, 0, 1);
    const g = ctx;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.hypot(W, H) * 0.56;
    const close = 0.36;
    const open = 0.64;
    let r = 0;
    if (p < close) r = R * (1 - ease(p / close));
    else if (p > open) r = R * ease((p - open) / (1 - open));
    g.save();
    g.beginPath();
    g.rect(0, 0, W, H);
    if (r > 0.5) g.arc(cx, cy, r, 0, Math.PI * 2, true);
    g.fillStyle = '#05070d';
    g.fill('evenodd');
    if (r > 0.5 && r < R * 0.98) {
      g.lineWidth = Math.max(3, W / 120);
      g.strokeStyle = '#ffd23f';
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.lineWidth = Math.max(2, W / 220);
      g.strokeStyle = '#e8541e';
      g.beginPath(); g.arc(cx, cy, r + Math.max(4, W / 90), 0, Math.PI * 2); g.stroke();
    }
    // jenerik: ışınlar + logo (iris tamamen kapalıyken)
    const mid = p >= close * 0.8 && p <= open + (1 - open) * 0.25;
    if (mid) {
      const q = clamp((p - close * 0.8) / (open + (1 - open) * 0.25 - close * 0.8), 0, 1);
      const a = Math.sin(Math.PI * q);
      g.globalAlpha = a;
      g.translate(cx, cy);
      g.rotate(w.t * 0.9);
      for (let i = 0; i < 12; i++) {
        g.rotate(Math.PI / 6);
        g.fillStyle = i % 2 ? 'rgba(255,210,63,0.16)' : 'rgba(232,84,30,0.12)';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(R, -R * 0.09); g.lineTo(R, R * 0.09); g.fill();
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sc0 = 0.72 + 0.28 * (1 - Math.pow(1 - Math.min(1, q * 2), 3));
      const lh = H * 0.7 * sc0;
      if (logo && logo.complete && logo.naturalWidth) g.drawImage(logo, cx - lh / 2, cy - lh / 2, lh, lh);
      else {
        g.fillStyle = '#ffd23f';
        g.font = `900 ${Math.round(H * 0.12)}px "Arial Black", system-ui`;
        g.textAlign = 'center';
        g.fillText('NEW FOOTBALL STARS', cx, cy);
      }
      if (S.tagText) {
        g.font = `900 ${Math.round(H * 0.06)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillStyle = '#ffffff';
        g.fillText(S.tagText, cx, cy + lh * 0.55);
      }
    }
    g.restore();
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
    if (S.freeze || S.wipe?.fired) return;
    if (S.script) updateScript(dt);
    else ambient(dt);
    groupStep(dt);
    for (const p of players) { steer(p, dt); if (p.celebrate && Math.hypot(p.vx, p.vy) < 0.6) p.celebT = (p.celebT || 0) + dt; }
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
    S.rate = rateNow() * (S.replaying ? 0.45 : 1);
    if (!S.paused) {
      resize();
      // sabit adımlar (yüksek hızda da kararlı)
      let rem = dt0 * S.rate;
      while (rem > 0) { const st = Math.min(1 / 60, rem); update(st); rem -= st; }
      // geçiş perdesi (gerçek zaman)
      if (S.wipe) {
        const w = S.wipe;
        w.t += dt0 * wipeRate();
        if (!w.fired && w.t >= w.dur / 2) { w.fired = true; w.fn?.(); }
        if (w.t >= w.dur) { S.wipe = null; w.res(); }
      }
      fxUpdate(dt0);
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
        hype('home', 1);
      };
      await wipe(line, 1.6);
      setTag('TAKIMLAR SAHADA', 'live');
      await startScript([], 1.5);
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
      await startScript([], 1.3);
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
      await wipe(() => { scn = buildScenario(ev, seed); S.camFocus = null; }, o.auto ? 0.12 : 1.6);
      await startScript(scn.events, scn.total);
      if (ev.outcome === 'goal' && ev.replay && !o.auto && (o.speed?.() || 1) === 1) {
        // yavaş çekim tekrar (aynı tohum → aynı hareket)
        await wipe(() => { S.replaying = true; setTag('↺ TEKRAR', 'replay'); const r = buildScenario(ev, seed); scn = r; }, 1.4);
        await startScript(scn.events, scn.tShot + 1.8);
        S.replaying = false;
      }
      for (const p of players) { p.celebrate = false; p.holdPose = false; p.pose = null; p.rot = 0; p.lift = 0; p.scripted = false; p.mark = null; p.face = null; p.waitT = 0; p.group = null; p.dejected = false; }
      S.camFocus = null;
      if (ev.outcome === 'goal') {
        await wipe(() => {
          S.netLock = null;
          S.bulge = null;
          kickoffShape(other(ev.side));
          setTag('CANLI', 'live');
        }, o.auto ? 0.12 : 1.5);
      } else {
        S.netLock = null;
        if (ev.outcome === 'miss') S.restart = { t: 0.5, kind: 'gk', team: other(ev.side) };
        setTag('CANLI', 'live');
      }
    },
    /** Devre arası: perde + ikinci yarı başlama vuruşu */
    async halfTime() {
      setTag('DEVRE ARASI', 'live');
      await wipe(() => kickoffShape(o.homeIsMy ? 'opp' : 'my'), o.auto ? 0.1 : 1.8);
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
