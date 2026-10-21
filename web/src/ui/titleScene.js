// GİRİŞ EKRANI SAHNESİ — gece stadı (piksel sanat, canlı):
//   yıldızlı gökyüzü, tribün çatısı ve ışıkları, dalga yapan kalabalık (kulüp renklerinde), foto flaşları,
//   iki ışık kulesi ve ışık hüzmeleri, kayan LED reklam panosu, perspektif saha ve ortada top sektiren oyuncu.
//   Sahne mantıksal 180 birim genişliğinde çizilir, tuvale keskin büyütülür. Yerleşim DOM'dan gelir:
//   oyuncu logonun altıyla düğmelerin üstü arasındaki boşluğa (anchor) oturur; ekran ne olursa olsun kaymaz.
import { drawPixelBall, drawPixelPlayer } from '../games/pixel/sprites.js';
import { drawPixelText, pixelTextWidth } from '../games/pixel/font.js';
import { defaultLook, shade } from '../games/pixel/playerPixels.js';

const LW = 180;

const R = (c, x, y, w, h, col) => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function lcg(seed) {
  let a = seed >>> 0 || 1;
  return () => ((a = (a * 16807) % 2147483647) / 2147483647);
}

const DEFAULT_LOOK = defaultLook({
  skin: '#c98e62', hair: 'short', hairColor: '#1f1309',
  kit: { body: '#1d4ed8', accent: '#facc15', pattern: 'solid', shorts: '#f8fafc', socks: '#1d4ed8' },
  boots: { main: '#f8fafc', accent: '#ef4444' },
  number: '10',
});

/**
 * Sahneyi kurar ve canlandırır.
 * @param {HTMLCanvasElement} cv
 * @param {{look?:object, colors?:string[], anchor:() => {top:number, bottom:number} | null, winter?:() => boolean, board?:string}} o
 * @returns {{stop:() => void, layout:() => void}}
 */
export function mountTitleScene(cv, o = {}) {
  const ctx = cv.getContext('2d');
  const off = document.createElement('canvas');
  const g = off.getContext('2d');
  let W = LW;
  let H = 320;
  let k = 2;
  let anchor = { top: 150, bottom: 220 };
  const look = o.look || DEFAULT_LOOK;
  const [c1, c2] = o.colors?.length ? o.colors : ['#1d4ed8', '#facc15'];
  const crowdCols = [c1, c1, c2, c1, '#f1f5f9', shade(c1, -0.35), shade(c2, -0.3), '#334155', '#475569', '#ef4444', '#f8fafc'];
  const board = (o.board || 'NEW FOOTBALL STARS').toUpperCase();
  let crowd = [];
  let flags = [];
  let stars = [];
  let flashes = [];
  let raf = 0;
  let stopped = false;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();

  function layout() {
    const rect = cv.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    k = rect.width / LW;
    W = LW;
    H = Math.max(200, Math.round(rect.height / k));
    off.width = W;
    off.height = H;
    cv.width = Math.round(rect.width * dpr);
    cv.height = Math.round(rect.height * dpr);
    const a = o.anchor?.();
    if (a) anchor = { top: (a.top - rect.top) / k, bottom: (a.bottom - rect.top) / k };
    // sahne çizgileri: oyuncunun ayakları boşluğun altına yakın; saha ufku onun biraz üstünde
    const gap = Math.max(0, anchor.bottom - anchor.top);
    geo.feet = Math.round(anchor.top + Math.min(gap * 0.82, Math.max(gap - 6, 34)));
    geo.showPlayer = gap >= 30;
    geo.horizon = Math.round(Math.min(geo.feet - 14, anchor.top + gap * 0.42));
    if (!geo.showPlayer) geo.horizon = Math.round(anchor.top + gap * 0.6);
    geo.standTop = Math.max(anchor.top + 8, geo.horizon - 46);
    if (geo.horizon - geo.standTop < 18) geo.standTop = geo.horizon - 18;
    geo.roof = geo.standTop - 6;
    geo.towerTop = Math.max(6, geo.roof - 44);
    buildCrowd();
    buildStars();
  }
  const geo = { feet: 200, horizon: 170, standTop: 120, roof: 114, towerTop: 70, showPlayer: true };

  function buildCrowd() {
    const r = lcg(97);
    const skins = ['#f6d3b3', '#e8b58f', '#c98e62', '#9a6440', '#6b4329'];
    crowd = [];
    for (let y = geo.standTop + 3; y < geo.horizon - 9; y += 3) {
      for (let x = (y % 2) + Math.floor(r() * 2); x < W; x += 2 + (r() < 0.18 ? 1 : 0)) {
        if (r() < 0.07) continue; // boş koltuk
        crowd.push({ x, y, c: crowdCols[Math.floor(r() * crowdCols.length)], s: skins[Math.floor(r() * skins.length)], ph: r() * 6.28, h: r() });
      }
    }
    // tribünde sallanan bayraklar (kulüp renkleri)
    flags = Array.from({ length: 5 }, (_, i) => ({ x: Math.round(14 + i * ((W - 28) / 4) + (r() - 0.5) * 10), y: geo.standTop + 4 + Math.floor(r() * Math.max(2, geo.horizon - geo.standTop - 18)), ph: r() * 6.28, c: i % 2 ? c2 : c1 }));
  }
  function buildStars() {
    const r = lcg(31);
    stars = Array.from({ length: 70 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * Math.max(10, geo.roof - 6)), p: r() * 6.28, b: r() }));
  }

  // ─────────────── çizim ───────────────
  function sky(t) {
    const grd = g.createLinearGradient(0, 0, 0, geo.horizon);
    grd.addColorStop(0, '#03060f');
    grd.addColorStop(0.55, '#071426');
    grd.addColorStop(1, '#10303a');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, geo.horizon + 1);
    for (const s of stars) {
      const tw = Math.sin(t * (1.2 + s.b) + s.p);
      if (tw > -0.4) R(g, s.x, s.y, 1, 1, s.b > 0.85 ? '#fff6c8' : tw > 0.6 ? '#e2e8ff' : '#8b9ac4');
    }
    // ışık hüzmelerinin gökyüzünde bıraktığı pus
    const haze = g.createRadialGradient(W / 2, geo.standTop, 4, W / 2, geo.standTop, W * 0.75);
    haze.addColorStop(0, 'rgba(190,255,220,.16)');
    haze.addColorStop(1, 'rgba(190,255,220,0)');
    g.fillStyle = haze;
    g.fillRect(0, 0, W, geo.horizon);
  }

  function stands(t, winter) {
    // çatı (kemerli) + çatı ışıkları
    for (let x = 0; x < W; x++) {
      const bow = Math.round(Math.pow((x - W / 2) / (W / 2), 2) * 5);
      R(g, x, geo.roof + bow - 2, 1, 4, '#0b1220');
      if (winter) R(g, x, geo.roof + bow - 3, 1, 1, x % 7 ? '#e8f1ff' : '#c7d6ee');
    }
    for (let x = 6; x < W; x += 12) {
      const bow = Math.round(Math.pow((x - W / 2) / (W / 2), 2) * 5);
      R(g, x, geo.roof + bow + 1, 3, 1, Math.sin(t * 3 + x) > -0.8 ? '#fde68a' : '#a16207');
    }
    // tribün zemini
    const sg = g.createLinearGradient(0, geo.standTop, 0, geo.horizon);
    sg.addColorStop(0, '#111827');
    sg.addColorStop(1, '#1e293b');
    g.fillStyle = sg;
    g.fillRect(0, geo.standTop, W, geo.horizon - geo.standTop);
    // kalabalık: baş + forma; soldan sağa ilerleyen dalga (kollar havada), tek tük zıplayan taraftar
    const span = Math.max(1, geo.horizon - geo.standTop);
    const wave = ((t * 0.22) % 1.6) * W - W * 0.3;
    for (const p of crowd) {
      const d = Math.abs(p.x - wave);
      const inWave = d < 18 && p.h < 1 - d / 18;
      const bob = !inWave && Math.sin(t * 5 + p.ph * 3) > 0.97 ? 1 : 0;
      const up = inWave ? 1 : bob;
      const depth = (p.y - geo.standTop) / span; // 0 üst (çatı gölgesi) → 1 ön sıra
      const dim = -0.62 + depth * 0.4;
      R(g, p.x, p.y + 1 - up, 1, 1, shade(p.c, dim));
      R(g, p.x, p.y - up, 1, 1, shade(p.s, dim - 0.05));
      if (inWave) R(g, p.x + (p.h < 0.5 ? -1 : 1), p.y - 2, 1, 1, shade(p.s, dim + 0.05));
    }
    for (const f of flags) {
      const wv = Math.sin(t * 3 + f.ph);
      R(g, f.x, f.y - 4, 1, 6, '#94a3b8');
      R(g, f.x + 1, f.y - 4 + (wv > 0 ? 0 : 1), 4, 2, shade(f.c, -0.15));
      R(g, f.x + 1, f.y - 2 + (wv > 0 ? 0 : 1), 4, 1, shade(f.c === c1 ? c2 : c1, -0.15));
    }
    // foto flaşları
    if (!reduced && Math.random() < 0.35) flashes.push({ x: Math.floor(Math.random() * W), y: geo.standTop + 2 + Math.floor(Math.random() * Math.max(2, geo.horizon - geo.standTop - 8)), life: 1 });
    flashes = flashes.filter((f) => (f.life -= 0.16) > 0);
    for (const f of flashes) {
      g.globalAlpha = f.life;
      R(g, f.x, f.y, 1, 1, '#ffffff');
      if (f.life > 0.6) { R(g, f.x - 1, f.y, 3, 1, 'rgba(255,255,255,.6)'); R(g, f.x, f.y - 1, 1, 3, 'rgba(255,255,255,.6)'); }
      g.globalAlpha = 1;
    }
    // korkuluk + kayan LED reklam panosu
    const by = geo.horizon - 8;
    R(g, 0, by, W, 8, '#05070c');
    R(g, 0, by, W, 1, '#1f2937');
    const msg = `${board}   +   `;
    const mw = pixelTextWidth(msg) + 4;
    const scroll = (t * 14) % mw;
    for (let x = -scroll; x < W; x += mw) drawPixelText(g, msg, Math.round(x), by + 2, '#a3e635');
    R(g, 0, by + 7, W, 1, '#0b0f17');
  }

  function tower(x, t, flip) {
    const top = geo.towerTop;
    const base = geo.standTop + 10;
    // direk (kafes)
    R(g, x - 1, top + 8, 3, base - top - 8, '#1f2937');
    for (let y = top + 10; y < base; y += 4) R(g, x - 2, y, 5, 1, '#111827');
    // kafa: 3×4 lamba
    R(g, x - 7, top, 15, 10, '#0f172a');
    R(g, x - 7, top, 15, 1, '#334155');
    const fl = 0.85 + 0.15 * Math.sin(t * 7.3 + x);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      R(g, x - 6 + i * 3.5, top + 1 + j * 3, 3, 2, fl > 0.75 ? '#fffbe6' : '#fde68a');
    }
    // ışık hüzmesi (sahaya doğru)
    g.save();
    g.globalCompositeOperation = 'lighter';
    const tx = flip ? W * 0.62 : W * 0.38;
    const grd = g.createLinearGradient(x, top + 5, tx, geo.feet);
    grd.addColorStop(0, `rgba(255,250,220,${0.28 * fl})`);
    grd.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x - 6, top + 6);
    g.lineTo(x + 6, top + 6);
    g.lineTo(tx + W * 0.32, geo.feet + 10);
    g.lineTo(tx - W * 0.32, geo.feet + 10);
    g.closePath();
    g.fill();
    // lamba parlaması
    const glow = g.createRadialGradient(x, top + 5, 1, x, top + 5, 22);
    glow.addColorStop(0, `rgba(255,252,230,${0.55 * fl})`);
    glow.addColorStop(1, 'rgba(255,252,230,0)');
    g.fillStyle = glow;
    g.fillRect(x - 24, top - 18, 48, 46);
    g.restore();
  }

  function pitch(winter) {
    const hz = geo.horizon;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const y0 = hz + (H - hz) * Math.pow(i / n, 1.7);
      const y1 = hz + (H - hz) * Math.pow((i + 1) / n, 1.7);
      const base = i % 2 ? '#2f8f3c' : '#37a246';
      R(g, 0, y0, W, Math.ceil(y1 - y0) + 1, shade(base, -0.45 + (i / n) * 0.35));
    }
    // çizgiler: uzak taç çizgisi, orta çizgi (perspektif), orta yuvarlak
    g.fillStyle = 'rgba(240,253,244,.55)';
    g.fillRect(0, hz + 1, W, 1);
    g.fillStyle = 'rgba(240,253,244,.35)';
    g.beginPath();
    g.moveTo(W / 2 - 0.5, hz + 1);
    g.lineTo(W / 2 + 0.5, hz + 1);
    g.lineTo(W / 2 + 1.5, H);
    g.lineTo(W / 2 - 1.5, H);
    g.fill();
    if (geo.showPlayer) {
      g.strokeStyle = 'rgba(240,253,244,.4)';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(W / 2, geo.feet - 1, 34, Math.max(4, (geo.feet - hz) * 0.45), 0, 0, Math.PI * 2);
      g.stroke();
    }
    if (winter) {
      const r = lcg(5);
      for (let i = 0; i < 90; i++) {
        const x = Math.floor(r() * W);
        const y = hz + 2 + Math.floor(Math.pow(r(), 0.6) * (H - hz - 2));
        const edge = x < 26 || x > W - 26;
        if (edge || r() < 0.25) R(g, x, y, 1 + (r() < 0.3 ? 1 : 0), 1, 'rgba(235,244,255,.75)');
      }
    }
    // sahanın ışıklı ortası
    const spot = g.createRadialGradient(W / 2, geo.feet - 6, 2, W / 2, geo.feet - 6, W * 0.55);
    spot.addColorStop(0, 'rgba(255,255,230,.16)');
    spot.addColorStop(1, 'rgba(255,255,230,0)');
    g.fillStyle = spot;
    g.fillRect(0, hz, W, H - hz);
  }

  /** Oyuncu topu sektiriyor: her vuruşta ayak değişir, beşte bir top kafaya kadar çıkar */
  function juggler(t) {
    if (!geo.showPlayer) return;
    const x = W / 2;
    const y = geo.feet;
    const T = 0.62;
    const n = Math.floor(t / T);
    const u = (t % T) / T;
    const big = n % 5 === 4;
    const peak = big ? 30 : 13;
    const lift = 4 + 4 * peak * u * (1 - u);
    const left = n % 2 === 1;
    const kick = u < 0.16 && !big;
    drawPixelPlayer(g, x, y, 32, look, { dir: 'down', frame: kick ? 'kick' : big && u > 0.3 && u < 0.85 ? 'ready' : 'idle', flip: left });
    const bx = x + (left ? -4 : 4) + Math.sin(u * Math.PI) * (left ? 1 : -1);
    drawPixelBall(g, bx, y - 2, 6, t * 3, { shadow: true, lift });
  }

  function vignette() {
    const v = g.createLinearGradient(0, geo.feet + 4, 0, H);
    v.addColorStop(0, 'rgba(3,6,12,0)');
    v.addColorStop(1, 'rgba(3,6,12,.82)');
    g.fillStyle = v;
    g.fillRect(0, geo.feet + 4, W, H - geo.feet);
    const top = g.createLinearGradient(0, 0, 0, geo.roof);
    top.addColorStop(0, 'rgba(3,6,12,.35)');
    top.addColorStop(1, 'rgba(3,6,12,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, W, geo.roof);
  }

  function frame(now) {
    if (stopped) return;
    if (!cv.isConnected) { stop(); return; }
    const t = reduced ? 2.2 : (now - t0) / 1000;
    const winter = !!o.winter?.();
    g.imageSmoothingEnabled = false;
    sky(t);
    tower(12, t, false);
    tower(W - 13, t, true);
    stands(t, winter);
    pitch(winter);
    juggler(t);
    vignette();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, W, H, 0, 0, cv.width, cv.height);
    if (!reduced) raf = requestAnimationFrame(frame);
  }

  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    document.removeEventListener('visibilitychange', onVis);
  }
  const onVis = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !stopped) raf = requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', onVis);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { layout(); if (reduced) frame(performance.now()); }) : null;
  ro?.observe(cv);
  layout();
  raf = requestAnimationFrame(frame);
  return { stop, layout };
}
