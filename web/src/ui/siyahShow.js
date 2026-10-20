// SİYAH SHOW — piksel TV stüdyosu: masada beş kurgusal karakter, LED duvar, kamera kesmeleri, alt bant,
// daktilo altyazı, "SÖZÜ KESİLDİ" damgası ve Dürüm Usta tavuk döner reklam arası.
import { CAST, showScript } from '../core/siyahShow.js';
import { drawPixelText } from '../games/pixel/font.js';
import { root } from './dom.js';
import { sfx } from '../audio.js';
import { duckMusic } from '../music/player.js';

const LW = 120;
const LH = 92;
const DESK = 60; // masanın üst kenarı

/** Karakterler: masadaki yerleri ve görünüşleri */
const LOOKS = {
  riza: { x: 14, skin: '#e0a98a', hair: 'bald', hairColor: '#cbd5e1', mustache: '#94a3b8', suit: '#4b5563', shirt: '#f8fafc', tie: '#facc15' },
  nevzat: { x: 37, skin: '#c98b67', hair: 'curly', hairColor: '#1f1a17', mustache: '#1f1a17', suit: '#7c4a2d', shirt: '#e2e8f0', tie: '#7f1d1d' },
  host: { x: 60, skin: '#e8b48f', hair: 'slick', hairColor: '#111111', suit: '#111827', shirt: '#ffffff', tie: '#111111', cards: true },
  sermet: { x: 83, skin: '#b9784f', hair: 'side', hairColor: '#3b2a1e', mustache: '#3b2a1e', suit: '#7c2d12', shirt: '#7c2d12', tie: null, zip: true },
  cemil: { x: 106, skin: '#f1c7a3', hair: 'side', hairColor: '#6b4f3a', glasses: true, suit: '#1e3a8a', shirt: '#dbeafe', tie: '#0f172a', board: true },
};
const ORDER = ['riza', 'nevzat', 'host', 'sermet', 'cemil'];

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
};

/** Göğüs hizasından yukarı portre (ayak noktası masanın üstü) */
function drawBust(c, id, t, st) {
  const P = LOOKS[id];
  const x = P.x;
  const talking = st.speaker === id || st.speaker === 'all';
  const laugh = st.laugh;
  const bob = laugh ? Math.round(Math.abs(Math.sin(t * 9 + x)) * 1.2) : talking ? Math.round(Math.abs(Math.sin(t * 5)) * 0.6) : 0;
  const hy = DESK - 27 - bob; // kafa üstü
  // gövde (omuzlar masaya iner)
  for (let r = 0; r < 13; r++) {
    const w = 14 + Math.min(6, r);
    R(c, x - w / 2, DESK - 13 + r - bob * 0, w, 1, P.suit);
  }
  R(c, x - 11, DESK - 8, 22, 9, P.suit);
  // gömlek + kravat / fermuar
  if (P.zip) { R(c, x - 1, DESK - 13, 2, 13, shade(P.suit, 0.25)); R(c, x - 3, DESK - 13, 6, 2, shade(P.suit, -0.3)); }
  else {
    for (let r = 0; r < 6; r++) R(c, x - 3 + r * 0.5, DESK - 13 + r, 6 - r, 1, P.shirt);
    if (P.tie) { R(c, x - 1, DESK - 13, 2, 2, P.tie); R(c, x - 1, DESK - 11, 2, 7, P.tie); }
    R(c, x - 5, DESK - 13, 2, 5, shade(P.suit, -0.25)); R(c, x + 3, DESK - 13, 2, 5, shade(P.suit, -0.25)); // yaka
  }
  // boyun
  R(c, x - 2, hy + 11, 4, 3, shade(P.skin, -0.15));
  // kafa
  R(c, x - 5, hy + 1, 10, 10, P.skin);
  R(c, x - 4, hy, 8, 12, P.skin);
  R(c, x - 6, hy + 4, 1, 3, shade(P.skin, -0.12)); R(c, x + 5, hy + 4, 1, 3, shade(P.skin, -0.12)); // kulak
  // saç
  const hc = P.hairColor;
  if (P.hair === 'bald') { R(c, x - 5, hy + 3, 1, 3, hc); R(c, x + 4, hy + 3, 1, 3, hc); R(c, x - 2, hy + 1, 3, 1, shade(P.skin, 0.3)); }
  else if (P.hair === 'curly') { for (let i = -5; i <= 4; i += 2) R(c, x + i, hy - 1, 2, 2, hc); R(c, x - 5, hy, 10, 2, hc); R(c, x - 6, hy + 1, 2, 3, hc); R(c, x + 4, hy + 1, 2, 3, hc); R(c, x - 2, hy - 1, 1, 1, shade(hc, 0.3)); }
  else if (P.hair === 'slick') { R(c, x - 5, hy - 1, 10, 3, hc); R(c, x - 5, hy + 2, 2, 2, hc); R(c, x - 1, hy - 1, 4, 1, shade(hc, 0.35)); }
  else { R(c, x - 5, hy - 1, 10, 2, hc); R(c, x - 5, hy + 1, 3, 2, hc); R(c, x + 3, hy + 1, 2, 1, hc); }
  // gözler (arada göz kırpma)
  const blink = (Math.floor(t * 1.3 + x) % 7 === 0) && (t * 1.3 + x) % 1 < 0.15;
  const ey = hy + 5;
  if (blink) { R(c, x - 3, ey, 2, 1, shade(P.skin, -0.4)); R(c, x + 1, ey, 2, 1, shade(P.skin, -0.4)); }
  else { R(c, x - 3, ey, 1, 1, '#111'); R(c, x + 2, ey, 1, 1, '#111'); }
  R(c, x - 3, ey - 2, 2, 1, P.hair === 'bald' ? shade(P.skin, -0.3) : shade(hc, 0.05)); R(c, x + 1, ey - 2, 2, 1, P.hair === 'bald' ? shade(P.skin, -0.3) : shade(hc, 0.05));
  if (P.glasses) {
    // ince çerçeve, açık mavi cam, gözler içeride
    for (const gx of [x - 5, x + 1]) {
      R(c, gx, ey - 1, 4, 1, '#1f2937'); R(c, gx, ey + 1, 4, 1, '#1f2937'); R(c, gx, ey - 1, 1, 3, '#1f2937'); R(c, gx + 3, ey - 1, 1, 3, '#1f2937');
      R(c, gx + 1, ey, 2, 1, '#dbeafe');
    }
    R(c, x - 1, ey - 1, 2, 1, '#1f2937');
    if (!blink) { R(c, x - 3, ey, 1, 1, '#111'); R(c, x + 2, ey, 1, 1, '#111'); }
  }
  R(c, x, ey + 2, 1, 1, shade(P.skin, -0.25)); // burun
  if (P.mustache) R(c, x - 2, ey + 3, 5, 1, P.mustache);
  // ağız
  const open = (talking && Math.floor(t * 8) % 2 === 0) || laugh;
  if (open) R(c, x - 1, ey + 4, 3, 2, '#5b1a1a'); else R(c, x - 1, ey + 4, 3, 1, shade(P.skin, -0.4));
  // el hareketi: konuşan el kaldırır; Sermet "Ben." derken kollarını kavuşturur
  if (st.ben && id === 'sermet') { R(c, x - 9, DESK - 6, 18, 3, shade(P.suit, -0.25)); R(c, x - 9, DESK - 6, 3, 3, P.skin); R(c, x + 6, DESK - 6, 3, 3, P.skin); }
  else if (talking && st.speaker !== 'all') {
    const up = Math.round(Math.sin(t * 6) * 2);
    const side = id === 'riza' || id === 'nevzat' ? 1 : -1;
    const hx = x + side * 11;
    R(c, hx - 1, DESK - 10 + up, 3, 8 - up, P.suit);
    R(c, hx - 1, DESK - 13 + up, 3, 3, P.skin);
  }
}

function drawStudio(c, t, st, ctx) {
  // arka duvar
  for (let y = 0; y < DESK; y++) R(c, 0, y, LW, 1, y < 20 ? '#07070d' : y < 50 ? '#0d0e1a' : '#141529');
  // LED paneller
  c.globalAlpha = 0.18;
  for (let x = 0; x < LW; x += 11) R(c, x, 8, 1, DESK - 8, '#6366f1');
  for (let y = 8; y < DESK; y += 11) R(c, 0, y, LW, 1, '#6366f1');
  c.globalAlpha = 1;
  // spot ışık konileri
  const spotX = st.speaker && LOOKS[st.speaker] ? LOOKS[st.speaker].x : LW / 2;
  for (let i = 0; i < 26; i++) { c.globalAlpha = 0.05; R(c, spotX - 4 - i, i * 2.6, 8 + i * 2, 3, '#e0e7ff'); }
  c.globalAlpha = 1;
  // büyük ekran (sunucunun arkası)
  const sw = 50;
  const sx = LW / 2 - sw / 2;
  R(c, sx - 2, 4, sw + 4, 32, '#000');
  R(c, sx, 6, sw, 28, '#0b1020');
  const phase = Math.floor(t / 4) % 2;
  if (phase === 0) {
    // logo: SİYAH SHOW (siyah zemin, beyaz yazı, mor alt çizgi)
    drawPixelText(c, 'SİYAH', LW / 2, 9, '#ffffff', { scale: 2, align: 'center' });
    drawPixelText(c, 'SHOW', LW / 2, 22, '#a78bfa', { scale: 2, align: 'center' });
  } else {
    R(c, sx + 2, 9, 16, 9, ctx.homeCol[0]); R(c, sx + 2, 18, 16, 2, ctx.homeCol[1]);
    R(c, sx + sw - 18, 9, 16, 9, ctx.awayCol[0]); R(c, sx + sw - 18, 18, 16, 2, ctx.awayCol[1]);
    drawPixelText(c, ctx.hs, sx + 10, 11, '#fff', { align: 'center', shadow: '#000' });
    drawPixelText(c, ctx.as, sx + sw - 10, 11, '#fff', { align: 'center', shadow: '#000' });
    drawPixelText(c, ctx.phase === 'ht' ? ctx.score : 'VS', LW / 2, 12, '#fde047', { align: 'center' });
    drawPixelText(c, ctx.phase === 'ht' ? 'DEVRE ARASI' : 'MAÇ ÖNÜ', LW / 2, 25, '#cbd5e1', { align: 'center' });
  }
  // yan ekranlar: kulüp renkleri
  for (const [x0, col] of [[4, ctx.homeCol], [LW - 20, ctx.awayCol]]) {
    R(c, x0 - 1, 8, 18, 18, '#000');
    R(c, x0, 9, 16, 16, col[0]);
    for (let i = 0; i < 16; i += 4) R(c, x0, 9 + ((i + Math.floor(t * 6)) % 16), 16, 1, shade(col[0], 0.2));
  }
  // karakterler (arkadan öne)
  for (const id of ORDER) drawBust(c, id, t, st);
  // masa
  R(c, 0, DESK, LW, LH - DESK, '#0a0a12');
  R(c, 0, DESK, LW, 2, '#2a2a40');
  R(c, 0, DESK + 2, LW, 1, '#8b5cf6');
  for (let x = 6; x < LW; x += 14) { c.globalAlpha = 0.25; R(c, x, DESK + 6, 6, 1, '#c4b5fd'); c.globalAlpha = 1; }
  drawPixelText(c, 'SİYAH SHOW', LW / 2, DESK + 11, '#e5e7eb', { scale: 2, align: 'center' });
  // masadaki eşyalar: mikrofonlar, kupalar, taktik tahtası, sunucu kartları
  for (const id of ORDER) {
    const x = LOOKS[id].x;
    R(c, x - 6, DESK - 6, 1, 6, '#4b5563'); R(c, x - 7, DESK - 8, 3, 3, '#111827');
    if (id !== 'host') { R(c, x + 6, DESK - 4, 3, 4, '#f8fafc'); R(c, x + 9, DESK - 3, 1, 2, '#f8fafc'); }
  }
  // dürüm tabakları (Rıza ve Nevzat)
  for (const id of ['riza', 'nevzat']) { const x = LOOKS[id].x; R(c, x - 2, DESK - 2, 8, 2, '#e5e7eb'); R(c, x - 1, DESK - 4, 6, 2, '#d6a35c'); R(c, x, DESK - 5, 4, 1, '#f5deb3'); }
  // Cemil'in taktik tahtası
  { const x = LOOKS.cemil.x; R(c, x + 3, DESK - 9, 11, 9, '#065f46'); R(c, x + 3, DESK - 9, 11, 1, '#e5e7eb'); for (const [dx, dy, col] of [[2, 2, '#fff'], [5, 4, '#fff'], [8, 2, '#fff'], [4, 6, '#f87171'], [8, 6, '#f87171']]) R(c, x + 3 + dx, DESK - 9 + dy, 1, 1, col); R(c, x + 5, DESK - 5, 4, 1, '#fde047'); }
  // sunucu kartları
  { const x = LOOKS.host.x; R(c, x - 4, DESK - 5, 8, 5, '#f8fafc'); R(c, x - 3, DESK - 4, 6, 1, '#94a3b8'); }
  // kahkaha: konfeti benzeri ışıltılar
  if (st.laugh) for (let i = 0; i < 12; i++) R(c, (i * 37 + Math.floor(t * 30)) % LW, (i * 13 + Math.floor(t * 20)) % DESK, 1, 1, '#fde047');
}

/** Dürüm Usta reklamı: dönen tavuk döner, lavaş, ayran */
function drawAd(c, t) {
  for (let y = 0; y < LH; y++) R(c, 0, y, LW, 1, y < LH * 0.5 ? '#f59e0b' : '#ea580c');
  // ışınlar
  c.globalAlpha = 0.18;
  for (let i = 0; i < 12; i++) { const a = t * 0.5 + (i / 12) * Math.PI * 2; for (let r = 8; r < 90; r += 3) R(c, 30 + Math.cos(a) * r, 46 + Math.sin(a) * r * 0.7, 2, 2, '#fff7ed'); }
  c.globalAlpha = 1;
  // döner şişi (dikey koni, şeritler döner)
  const cx = 28;
  R(c, cx - 1, 6, 2, 78, '#9ca3af');
  for (let y = 12; y < 78; y++) {
    const k = (y - 12) / 66;
    const w = Math.round(12 + 10 * Math.sin(Math.PI * Math.min(1, k * 1.1)) - k * 4);
    const band = Math.floor((y + t * 14) / 3) % 2;
    R(c, cx - w / 2, y, w, 1, band ? '#c2410c' : '#d97706');
    R(c, cx - w / 2, y, 2, 1, '#7c2d12');
    if ((y + Math.floor(t * 10)) % 7 === 0) R(c, cx + w / 2 - 3, y, 2, 1, '#fde68a');
  }
  // ısıtıcı
  R(c, cx + 14, 10, 4, 66, '#374151');
  for (let y = 12; y < 74; y += 4) R(c, cx + 15, y, 2, 2, Math.sin(t * 8 + y) > 0 ? '#ef4444' : '#f97316');
  // logo
  R(c, 56, 6, 60, 32, '#7c2d12');
  R(c, 57, 7, 58, 30, '#fff7ed');
  drawPixelText(c, 'DÜRÜM USTA', 86, 10, '#7c2d12', { align: 'center' });
  drawPixelText(c, 'TAVUK', 86, 18, '#ea580c', { scale: 2, align: 'center' });
  drawPixelText(c, 'DÖNER', 86, 29, '#7c2d12', { align: 'center' });
  // dürüm + ayran
  R(c, 58, 54, 28, 9, '#f5deb3'); R(c, 60, 52, 24, 2, '#e8c690'); R(c, 80, 50, 6, 13, '#fde68a');
  for (let i = 0; i < 6; i++) R(c, 61 + i * 4, 56, 2, 2, i % 2 ? '#16a34a' : '#c2410c');
  R(c, 92, 44, 16, 20, '#f8fafc'); R(c, 92, 44, 16, 3, '#38bdf8'); drawPixelText(c, 'AYRAN', 100, 52, '#0ea5e9', { align: 'center' });
  // fiyat etiketi zıplar
  const by = 70 + Math.round(Math.sin(t * 6) * 2);
  R(c, 56, by, 60, 12, '#15803d'); R(c, 57, by + 1, 58, 10, '#22c55e');
  drawPixelText(c, 'AYRAN BEDAVA', 86, by + 3, '#ffffff', { align: 'center' });
}

/**
 * Programı oynatır. @returns {Promise<void>}
 * o: {phase, match, state, names:{home, away, hs, as}, colors:{home, away}, score}
 */
export function playSiyahShow(o) {
  return new Promise((resolve) => {
    const s = o.state;
    const ctx = {
      phase: o.phase, home: o.names.home, away: o.names.away, hs: o.names.hs, as: o.names.as,
      my: o.names.my, myName: s.player.name.split(' ')[0], score: o.score || '0-0', id: o.match?.id, myGoals: o.match?.tally?.goals || 0,
      homeCol: o.colors.home || ['#2563eb', '#fff'], awayCol: o.colors.away || ['#dc2626', '#fff'],
    };
    const lines = showScript(ctx);
    const layer = document.createElement('div');
    layer.className = 'ss-layer';
    layer.innerHTML = `<div class="ss-tv">
        <canvas class="ss-cv"></canvas>
        <div class="ss-bug"><b>SİYAH SHOW</b><span>● CANLI</span></div>
        <div class="ss-tag">${o.phase === 'ht' ? 'DEVRE ARASI' : 'MAÇ ÖNÜ'}</div>
        <div class="ss-adtag" hidden>REKLAM</div>
        <div class="ss-stamp" hidden>SÖZÜ KESİLDİ</div>
        <div class="ss-l3"><b data-who></b><span data-role></span></div>
      </div>
      <div class="ss-sub"><span data-text></span></div>
      <div class="ss-ctrl"><button class="btn ghost" data-next>İleri ▶</button><button class="btn" data-skip>Programı atla ⏭</button></div>
      <p class="ss-note">Kurgusal parodi program · Karakterler ve sponsor kurgusaldır.</p>`;
    root().appendChild(layer);
    duckMusic(true);
    const cv = layer.querySelector('.ss-cv');
    const g = cv.getContext('2d');
    const off = document.createElement('canvas');
    off.width = LW;
    off.height = LH;
    const c = off.getContext('2d');
    const whoEl = layer.querySelector('[data-who]');
    const roleEl = layer.querySelector('[data-role]');
    const textEl = layer.querySelector('[data-text]');
    const stamp = layer.querySelector('.ss-stamp');
    const adTag = layer.querySelector('.ss-adtag');
    const l3 = layer.querySelector('.ss-l3');
    let k = 1;
    const fit = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = Math.min(layer.clientWidth - 16, 720, (layer.clientHeight - 220) * (LW / LH));
      k = Math.max(1, Math.floor((w * dpr) / LW));
      cv.width = LW * k;
      cv.height = LH * k;
      cv.style.width = `${(LW * k) / dpr}px`;
      cv.style.height = `${(LH * k) / dpr}px`;
    };
    fit();
    const st = { i: -1, speaker: null, shown: 0, lineT: 0, cam: 'wide', laugh: false, ben: false, ad: false, done: false };
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    const finish = () => {
      if (st.done) return;
      st.done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      duckMusic(false);
      layer.classList.add('out');
      setTimeout(() => { layer.remove(); resolve(); }, 300);
    };
    const next = () => {
      st.i += 1;
      if (st.i >= lines.length) return finish();
      const L = lines[st.i];
      st.speaker = L.who;
      st.shown = 0;
      st.lineT = 0;
      st.laugh = !!L.laugh;
      st.ben = !!L.ben;
      st.ad = !!L.ad;
      if (L.cam) st.cam = L.cam;
      else if (L.who !== 'all') st.cam = Math.random() < 0.55 ? 'close' : 'wide';
      if (L.laugh || L.who === 'all') st.cam = 'wide';
      stamp.hidden = true;
      adTag.hidden = !L.ad;
      layer.classList.toggle('ad', !!L.ad);
      const who = L.who === 'all' ? (L.laugh ? '' : 'Rıza & Nevzat') : CAST[L.who]?.name || '';
      whoEl.textContent = who;
      roleEl.textContent = L.who === 'all' ? (L.laugh ? '' : 'Reklam') : CAST[L.who]?.role || '';
      l3.hidden = !who;
      l3.className = `ss-l3 w-${L.who}`;
      textEl.textContent = '';
      if (L.ben) sfx('swish');
      if (L.laugh) sfx('chant');
    };
    const tick = (now) => {
      if (!layer.isConnected) return finish();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      const L = lines[st.i];
      if (L) {
        st.lineT += dt;
        const speed = L.ben ? 2 : 38; // harf/sn (Sermet'in "Ben."i yavaş)
        const target = Math.min(L.text.length, Math.floor(st.lineT * speed));
        if (target !== st.shown) {
          st.shown = target;
          textEl.textContent = L.text.slice(0, target);
          if (target % 6 === 0 && !L.laugh) sfx('tick');
        }
        const full = st.shown >= L.text.length;
        if (full && L.cut && stamp.hidden) { stamp.hidden = false; sfx('whistle'); }
        const hold = L.cut ? 0.45 : L.ben ? 1.4 : L.laugh ? 1.6 : 1.1 + L.text.length * 0.012;
        if (full && st.lineT > L.text.length / speed + hold) next();
      }
      // çizim
      if (st.ad) drawAd(c, t); else drawStudio(c, t, st, ctx);
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, cv.width, cv.height);
      if (st.cam === 'close' && !st.ad && LOOKS[st.speaker]) {
        // yakın plan: konuşanın etrafındaki yarım kare, tam 2x
        const w = LW / 2;
        const h = LH / 2;
        const sx = Math.max(0, Math.min(LW - w, LOOKS[st.speaker].x - w / 2));
        const sy = DESK - h + 10;
        g.drawImage(off, sx, sy, w, h, 0, 0, cv.width, cv.height);
      } else g.drawImage(off, 0, 0, LW, LH, 0, 0, cv.width, cv.height);
      raf = requestAnimationFrame(tick);
    };
    layer.querySelector('[data-skip]').addEventListener('click', (e) => { e.stopPropagation(); sfx('click'); finish(); });
    const advance = () => {
      const L = lines[st.i];
      if (!L) return;
      if (st.shown < L.text.length) { st.lineT = L.text.length / 38 + 0.01; st.shown = L.text.length; textEl.textContent = L.text; if (L.cut) { stamp.hidden = false; } }
      else next();
    };
    layer.querySelector('[data-next]').addEventListener('click', (e) => { e.stopPropagation(); advance(); });
    layer.querySelector('.ss-tv').addEventListener('click', advance);
    window.addEventListener('resize', fit);
    next();
    raf = requestAnimationFrame(tick);
  });
}

