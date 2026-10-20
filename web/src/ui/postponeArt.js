// Ertelenen maç sahnesi: karla kaplı (ya da buz tutmuş / fırtınalı) stat, hakem ve saha görevlisi, kar yağışı.
import { playerCanvas } from '../games/pixel/sprites.js';
import { drawPixelText } from '../games/pixel/font.js';

const REF = { skin: '#d9a07a', hair: 'short', hairColor: '#1c1410', kit: { body: '#111827', accent: '#facc15', pattern: 'solid', shorts: '#111827', socks: '#111827' }, boots: { main: '#111', accent: '#e5e7eb' }, longSleeve: true, number: '' };
const CREW = { skin: '#a26b4a', hair: 'short', hairColor: '#2a1a10', beard: true, longSleeve: true, pants: true, zip: true, kit: { body: '#f97316', accent: '#fde047', pattern: 'solid', shorts: '#1f2937', socks: '#1f2937' }, boots: { main: '#3f3f46', accent: '#18181b' }, number: '' };

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function sprite(c, look, frame, x, y, flip = false) {
  const src = playerCanvas(look, 'down', frame);
  c.save();
  c.translate(Math.round(x), Math.round(y));
  if (flip) c.scale(-1, 1);
  c.drawImage(src, Math.round(-src.width / 2), -33);
  c.restore();
  R(c, x - 6, y, 12, 1, 'rgba(0,0,0,0.25)');
}

/** Tuvali canlandırır (kapsayıcı DOM'dan çıkınca durur). kind: snow | frost | storm */
export function drawPostponeArt(cv, kind = 'snow') {
  if (!cv) return;
  const LW = 160;
  const LH = 84;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const cssW = Math.min(340, (cv.parentElement?.clientWidth || 320));
  const k = Math.max(1, Math.floor((cssW * dpr) / LW));
  cv.width = LW * k;
  cv.height = LH * k;
  cv.style.width = `${(LW * k) / dpr}px`;
  cv.style.height = `${(LH * k) / dpr}px`;
  const off = document.createElement('canvas');
  off.width = LW;
  off.height = LH;
  const c = off.getContext('2d');
  const out = cv.getContext('2d');
  out.imageSmoothingEnabled = false;
  const flakes = Array.from({ length: kind === 'storm' ? 70 : 90 }, () => ({ x: Math.random() * LW, y: Math.random() * LH, v: 8 + Math.random() * 14, s: Math.random() < 0.2 ? 2 : 1, ph: Math.random() * 6 }));
  const t0 = performance.now();
  let flash = 0;
  const frame = (now) => {
    if (!cv.isConnected) return;
    const t = (now - t0) / 1000;
    const dt = 1 / 60;
    // gökyüzü
    const sky = kind === 'storm' ? ['#111827', '#1f2937'] : kind === 'frost' ? ['#0c1a2e', '#1e3a5f'] : ['#3b4252', '#5b6474'];
    for (let y = 0; y < 30; y++) R(c, 0, y, LW, 1, y < 15 ? sky[0] : sky[1]);
    // tribün silüeti
    R(c, 0, 18, LW, 14, '#1e2230');
    for (let x = 0; x < LW; x += 3) R(c, x, 19 + ((x * 7) % 3), 2, 2, kind === 'snow' ? '#cbd5e1' : '#334155');
    R(c, 0, 30, LW, 2, '#0f172a');
    // ışık direkleri
    for (const lx of [14, LW - 15]) { R(c, lx, 4, 1, 26, '#475569'); R(c, lx - 4, 2, 9, 4, '#1e293b'); R(c, lx - 3, 3, 7, 2, '#fef9c3'); }
    // saha
    const pitch = kind === 'frost' ? '#9cc7e6' : kind === 'storm' ? '#2f6b3c' : '#e8eef5';
    R(c, 0, 32, LW, LH - 32, pitch);
    if (kind === 'snow') { for (let x = 0; x < LW; x += 7) R(c, x, 32 + ((x * 13) % 40), 4, 1, '#ffffff'); R(c, 0, 32, LW, 2, '#f8fafc'); }
    if (kind === 'frost') for (let i = 0; i < 18; i++) if (Math.sin(t * 3 + i) > 0.6) R(c, (i * 37) % LW, 36 + ((i * 23) % 44), 1, 1, '#ffffff');
    if (kind === 'storm') { for (let y = 34; y < LH; y += 4) R(c, 0, y, LW, 1, '#2a5f35'); for (let i = 0; i < 10; i++) R(c, (i * 29 + 5) % LW, 50 + ((i * 17) % 26), 9, 1, '#4b8bbd'); }
    // görünmeyen çizgiler (yarı saydam)
    c.globalAlpha = kind === 'snow' ? 0.18 : 0.6;
    R(c, LW / 2, 32, 1, LH - 32, '#ffffff');
    R(c, 0, 58, LW, 1, '#ffffff');
    c.globalAlpha = 1;
    // kale
    R(c, LW - 24, 38, 1, 16, '#f8fafc'); R(c, LW - 8, 38, 1, 16, '#f8fafc'); R(c, LW - 24, 38, 17, 1, '#f8fafc');
    if (kind === 'snow') R(c, LW - 24, 37, 17, 1, '#ffffff');
    // kar yığını + kürek
    if (kind === 'snow') { R(c, 20, 66, 18, 4, '#f8fafc'); R(c, 23, 63, 12, 3, '#ffffff'); R(c, 46, 58, 1, 12, '#78350f'); R(c, 44, 70, 5, 2, '#9ca3af'); }
    // hakem ve saha görevlisi
    sprite(c, REF, Math.floor(t * 1.2) % 2 ? 'point' : 'idle', 78, 72);
    sprite(c, CREW, 'clip', 98, 74, true);
    // ERTELENDİ panosu
    const by = 40 + Math.round(Math.sin(t * 2) * 1);
    R(c, 104, by + 8, 1, 14, '#334155');
    R(c, 83, by - 1, 44, 10, '#000000');
    R(c, 84, by, 42, 8, '#dc2626');
    drawPixelText(c, 'ERTELENDİ', 105, by + 1, '#ffffff', { align: 'center' });
    // yağış
    for (const f of flakes) {
      if (kind === 'storm') {
        f.y += f.v * 3.2 * dt; f.x -= f.v * 0.8 * dt;
        if (f.y > LH) { f.y = -2; f.x = Math.random() * (LW + 20); }
        R(c, f.x, f.y, 1, 3, 'rgba(186,230,253,0.7)');
      } else {
        f.y += f.v * (kind === 'frost' ? 0.5 : 1) * dt; f.x += Math.sin(t * 1.5 + f.ph) * 4 * dt;
        if (f.y > LH) { f.y = -2; f.x = Math.random() * LW; }
        if (kind === 'frost' && f.s === 1) continue;
        R(c, f.x, f.y, f.s, f.s, '#ffffff');
      }
    }
    if (kind === 'storm') {
      if (flash <= 0 && Math.random() < 0.006) flash = 0.25;
      if (flash > 0) { c.globalAlpha = Math.min(0.7, flash * 3); R(c, 0, 0, LW, LH, '#e0f2fe'); c.globalAlpha = 1; flash -= dt; }
    }
    out.clearRect(0, 0, cv.width, cv.height);
    out.drawImage(off, 0, 0, LW * k, LH * k);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
