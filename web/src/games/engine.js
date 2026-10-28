// MİNİ OYUN MOTORU — tuval, retina ölçekleme, döngü, dokunma/fare girdisi, parçacıklar, çizim yardımcıları.
import { adaptiveDpr } from '../ui/adaptiveDpr.js';
import { drawSprite, spritePattern } from '../assets/sprites.js';

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/**
 * Tuval sahnesi. update(dt, t) ve render(ctx, W, H, t) her karede çağrılır.
 * tempo: oyun dünyasının hız çarpanı (büyük maç heyecanı > 1, Soğukkanlı mentor yavaşlatır).
 */
export function createStage(host, { update, render, pointer, tempo = 1 } = {}) {
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const stage = { canvas, ctx, W: 0, H: 0, dpr: 1, t: 0, shakeAmt: 0, running: true };

  const adDpr = adaptiveDpr('game', { max: 2.5 });
  const resize = () => {
    const r = host.getBoundingClientRect();
    stage.dpr = adDpr.value; // uyarlanır çözünürlük
    stage.W = Math.max(1, r.width);
    stage.H = Math.max(1, r.height);
    canvas.width = Math.round(stage.W * stage.dpr);
    canvas.height = Math.round(stage.H * stage.dpr);
    canvas.style.width = `${stage.W}px`;
    canvas.style.height = `${stage.H}px`;
  };
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(host);
  window.addEventListener('resize', resize);

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, time: performance.now() };
  };
  const onDown = (e) => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* yok */ }
    pointer?.('down', pos(e));
  };
  const onMove = (e) => { e.preventDefault(); pointer?.('move', pos(e)); };
  const onUp = (e) => { e.preventDefault(); pointer?.('up', pos(e)); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  let last = performance.now();
  let raf = 0;
  const frame = (now) => {
    if (!stage.running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (adDpr.frame(now)) resize();
    stage.t += dt;
    update?.(dt * tempo, stage.t);
    const { W, H, dpr } = stage;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (stage.shakeAmt > 0.2) {
      ctx.translate((Math.random() - 0.5) * stage.shakeAmt, (Math.random() - 0.5) * stage.shakeAmt);
      stage.shakeAmt *= 0.88;
    }
    render?.(ctx, W, H, stage.t);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  stage.shake = (a = 10) => { stage.shakeAmt = a; };
  stage.stop = () => {
    stage.running = false;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    window.removeEventListener('resize', resize);
    canvas.remove();
  };
  return stage;
}

// ─────────────────────────────────────────────────────────────
// PARÇACIKLAR
// ─────────────────────────────────────────────────────────────
export class Particles {
  constructor() { this.list = []; }
  burst(x, y, { n = 20, colors = ['#fff'], speed = 260, gravity = 600, life = 1, size = 3, spread = Math.PI * 2, angle = -Math.PI / 2 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: gravity, life, max: life, size: size * (0.6 + Math.random() * 0.8), c: colors[i % colors.length] });
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
  render(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

/** Ekranda büyüyüp sönen büyük yazı ("GOOOL!"). */
export class BigText {
  constructor() { this.items = []; }
  show(text, color = '#c6ff3d', size = 64) { this.items.push({ text, color, size, t: 0 }); }
  update(dt) { for (const i of this.items) i.t += dt; this.items = this.items.filter((i) => i.t < 1.8); }
  render(ctx, W, H) {
    for (const i of this.items) {
      const s = i.t < 0.35 ? ease.outBack(i.t / 0.35) : 1;
      const a = i.t > 1.3 ? 1 - (i.t - 1.3) / 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(W / 2, H * 0.42);
      ctx.scale(s, s);
      ctx.rotate(-0.05);
      ctx.font = `900 ${Math.min(i.size, W * 0.16)}px system-ui, -apple-system, sans-serif`;
      // uzun yazılar ekrana sığsın
      const tw = ctx.measureText(i.text).width + 20;
      if (tw > W * 0.94) ctx.scale((W * 0.94) / tw, (W * 0.94) / tw);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(i.text, 0, 0);
      ctx.fillStyle = i.color;
      ctx.fillText(i.text, 0, 0);
      ctx.restore();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// ÇİZİM YARDIMCILARI
// ─────────────────────────────────────────────────────────────
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Futbol topu (dönen beşgenler + gölgelendirme). */
export function drawBall(ctx, x, y, r, rot = 0) {
  if (r < 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.7, '#e3e9e5');
  g.addColorStop(1, '#8fa199');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(rot);
  ctx.fillStyle = '#16211b';
  const pent = (cx, cy, s) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
    }
    ctx.closePath();
    ctx.fill();
  };
  pent(0, 0, r * 0.36);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pent(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, r * 0.3);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = Math.max(0.6, r * 0.06);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawShadow(ctx, x, y, rx, ry, alpha = 0.35) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Kuşbakışı oyuncu: gölge, omuzlar (forma), kafa, koşu sallanması.
 * kit: {colors:[c1,c2]}, number, facing: radyan (0 = yukarı bakar)
 */
export function drawTopPlayer(ctx, x, y, s, kit, { number = '', facing = 0, phase = 0, skin = '#d9a57b', hair = '#2a1a10', highlight = false, alpha = 1, ring = null } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  drawShadow(ctx, x + s * 0.15, y + s * 0.25, s * 0.95, s * 0.55, 0.3);
  if (ring) {
    // Takım halkası: forma rengi çimle karışsa da kimin kim olduğu görünür
    ctx.fillStyle = ring;
    ctx.globalAlpha = alpha * 0.28;
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.2, s * 1.15, s * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (highlight) {
    ctx.strokeStyle = 'rgba(198,255,61,.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.2, s * 1.25, s * 0.75, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.translate(x, y);
  ctx.rotate(facing);
  const swing = Math.sin(phase) * s * 0.35;
  // bacaklar
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(-s * 0.3, -swing * 0.6 - s * 0.1, s * 0.18, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 0.3, swing * 0.6 - s * 0.1, s * 0.18, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  // gövde (forma)
  const [c1, c2] = kit.colors;
  ctx.fillStyle = c1;
  roundRect(ctx, -s * 0.78, -s * 0.42, s * 1.56, s * 0.84, s * 0.4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.stroke();
  ctx.fillStyle = c2;
  ctx.fillRect(-s * 0.12, -s * 0.42, s * 0.24, s * 0.84);
  // kollar
  ctx.fillStyle = c1;
  ctx.beginPath(); ctx.ellipse(-s * 0.85, swing * 0.5, s * 0.2, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 0.85, -swing * 0.5, s * 0.2, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  // kafa
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(0, s * 0.06, s * 0.36, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
  ctx.restore();
  if (number !== '') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${Math.max(9, s * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeText(String(number), x, y - s * 1.25);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(number), x, y - s * 1.25);
    ctx.restore();
  }
}

/** Kuşbakışı çim (şeritli) + saha çizgileri. Atlas hazırsa piksel çim dokusu kullanılır. */
export function drawPitchTop(ctx, W, H, { box = 'none', circle = false } = {}) {
  const band = Math.max(40, H / 9);
  const grass = spritePattern(ctx, 'grass', 72);
  let i = 0;
  if (grass) {
    // Piksel çim dokusu + oyunun koyu yeşil tonu + biçilmiş şeritler
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6, 46, 22, 0.42)';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += band, i++) {
      if (i % 2) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, y, W, band + 1);
    }
  } else {
    for (let y = 0; y < H; y += band, i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1f7a3a' : '#23873f';
      ctx.fillRect(0, y, W, band + 1);
    }
  }
  // doku
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.5, Math.max(W, H));
  g.addColorStop(0, 'rgba(255,255,255,.05)');
  g.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, -4, W - 20, H + 8);
  if (box === 'top') {
    const bw = W * 0.74;
    ctx.strokeRect((W - bw) / 2, -4, bw, H * 0.22);
    const sw = W * 0.36;
    ctx.strokeRect((W - sw) / 2, -4, sw, H * 0.08);
    ctx.beginPath(); ctx.arc(W / 2, H * 0.22, W * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  if (box === 'bottom') {
    const bw = W * 0.74;
    ctx.strokeRect((W - bw) / 2, H * 0.78, bw, H * 0.24);
    const sw = W * 0.36;
    ctx.strokeRect((W - sw) / 2, H * 0.92, sw, H * 0.1);
    ctx.beginPath(); ctx.arc(W / 2, H * 0.78, W * 0.12, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    // kale
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(W / 2 - W * 0.13, H - 8, W * 0.26, 8);
    // köşe bayrakları (kale çizgisinin iki ucu)
    drawSprite(ctx, 'corner_flag', 14, H - 2, { h: 34, anchor: 'bottom' });
    drawSprite(ctx, 'corner_flag', W - 14, H - 2, { h: 34, anchor: 'bottom', flip: true });
  }
  if (circle) {
    ctx.beginPath(); ctx.arc(W / 2, H * 0.95, W * 0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, H * 0.95); ctx.lineTo(W - 10, H * 0.95); ctx.stroke();
  }
}

/** Tribün kalabalığı: yanıp sönen noktalar. */
export function makeCrowd(W, top, height, palette) {
  const dots = [];
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const y = top + (r + 0.5) * (height / rows);
    const step = 6 + r * 0.5;
    for (let x = 2; x < W; x += step) {
      dots.push({ x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3, c: palette[Math.floor(Math.random() * palette.length)], ph: Math.random() * 6.28, s: 1.6 + r * 0.18 });
    }
  }
  return dots;
}

export function drawCrowd(ctx, dots, t, excite = 0) {
  for (const d of dots) {
    const k = 0.55 + 0.45 * Math.sin(t * (2 + excite * 8) + d.ph);
    ctx.globalAlpha = 0.35 + 0.5 * k;
    ctx.fillStyle = d.c;
    const jump = excite > 0 ? Math.abs(Math.sin(t * 9 + d.ph)) * 3 * excite : 0;
    ctx.fillRect(d.x, d.y - jump, d.s, d.s);
  }
  ctx.globalAlpha = 1;
}

/** Ekran üstü zaman çubuğu. */
export function drawTimer(ctx, W, y, frac, color = '#c6ff3d') {
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  roundRect(ctx, 16, y, W - 32, 8, 4);
  ctx.fill();
  ctx.fillStyle = frac > 0.75 ? '#ff5d6c' : color;
  roundRect(ctx, 16, y, Math.max(8, (W - 32) * (1 - clamp(frac, 0, 1))), 8, 4);
  ctx.fill();
}

export function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
