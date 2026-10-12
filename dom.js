// Küçük DOM yardımcıları: kaçış, toast, alt sayfa (sheet), sayaç animasyonu, konfeti.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

let appRoot = null;
export function setRoot(root) {
  appRoot = root;
}
export const root = () => appRoot;

// ── Toast ──
let toastWrap = null;
export function toast(text, tone = '') {
  if (!toastWrap || !toastWrap.isConnected) {
    toastWrap = el('<div class="toast-wrap"></div>');
    appRoot.appendChild(toastWrap);
  }
  const t = el(`<div class="toast ${tone}">${esc(text)}</div>`);
  toastWrap.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s, transform .3s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(-10px)';
    setTimeout(() => t.remove(), 320);
  }, 2200);
}

/**
 * Alt sayfa / orta modal. render(container, close) içerik çizer.
 * @returns Promise<any> close(value) ile çözülür.
 */
export function sheet({ html, center = false, dismissable = true, onMount }) {
  return new Promise((resolve) => {
    const layer = el(`<div class="layer ${center ? 'center' : ''}"><div class="backdrop"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`);
    appRoot.appendChild(layer);
    let closed = false;
    const close = (value) => {
      if (closed) return;
      closed = true;
      layer.classList.add('out');
      setTimeout(() => layer.remove(), 220);
      resolve(value);
    };
    if (dismissable) layer.querySelector('.backdrop').addEventListener('click', () => close(null));
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-close]');
      if (b) close(b.dataset.close === '' ? true : b.dataset.close);
    });
    onMount?.(layer.querySelector('.sheet'), close);
  });
}

/** Sayıyı animasyonla sayar. */
export function countUp(node, to, { from = 0, duration = 900, decimals = 0, prefix = '', suffix = '' } = {}) {
  if (!node) return;
  const start = performance.now();
  const fmt = (v) => prefix + (decimals ? v.toFixed(decimals).replace('.', ',') : Math.round(v).toLocaleString('tr-TR')) + suffix;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const e = 1 - Math.pow(1 - t, 3);
    node.textContent = fmt(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Bar dolumlarını bir sonraki karede başlatır (CSS geçişi için). */
export function animateBars(scope) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      scope.querySelectorAll('[data-w]').forEach((n) => {
        n.style.width = `${n.dataset.w}%`;
      });
      scope.querySelectorAll('[data-h]').forEach((n) => {
        n.style.height = `${n.dataset.h}%`;
      });
    }),
  );
}

/** Konfeti patlaması (tuval katmanı, 2.5 sn). */
export function confetti({ count = 140, colors = ['#c6ff3d', '#ffcf3d', '#38bdf8', '#ffffff', '#ff5d6c'] } = {}) {
  const canvas = el('<canvas class="confetti-canvas"></canvas>');
  appRoot.appendChild(canvas);
  const rect = appRoot.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: count }, () => ({
    x: rect.width / 2 + (Math.random() - 0.5) * 60,
    y: rect.height * 0.35,
    vx: (Math.random() - 0.5) * 520,
    vy: -Math.random() * 620 - 180,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 12,
    w: 5 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  let last = t0;
  const tick = (now) => {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (const p of parts) {
      p.vy += 900 * dt;
      p.vx *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (now - t0 < 2600) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function signed(v, digits = 0) {
  const n = digits ? Number(v).toFixed(digits).replace('.', ',') : Math.round(v);
  return v > 0 ? `+${n}` : `${n}`;
}
