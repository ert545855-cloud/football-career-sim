// KIŞ TEMASI — ekranın üstünde yağan piksel kar + alt çubuğun üstünde biriken kar.
// Tek bir sabit tuval (pointer-events: none). Ekran değişince silinmez; sadece açılıp kapanır.
// Hareket azaltma tercihinde daha az ve daha yavaş tane. Sekme gizliyken durur.

let S = null;

function make() {
  const c = document.createElement('canvas');
  c.className = 'snow-canvas';
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const st = { c, ctx, on: false, raf: 0, flakes: [], W: 0, H: 0, dpr: 1, last: 0, pile: 0, reduce, gust: 0 };
  const resize = () => {
    st.dpr = Math.min(2, window.devicePixelRatio || 1);
    st.W = window.innerWidth;
    st.H = window.innerHeight;
    c.width = Math.round(st.W * st.dpr);
    c.height = Math.round(st.H * st.dpr);
    const n = Math.round(Math.min(150, (st.W * st.H) / (reduce ? 14000 : 6500)));
    st.flakes = Array.from({ length: n }, () => flake(st, true));
  };
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(st.raf);
    else if (st.on) { st.last = performance.now(); st.raf = requestAnimationFrame((t) => frame(st, t)); }
  });
  return st;
}

function flake(st, anywhere = false) {
  const z = 0.35 + Math.random() * 0.65;
  return { x: Math.random() * st.W, y: anywhere ? Math.random() * st.H : -6, z, ph: Math.random() * 6.28, s: z > 0.82 ? 3 : 2 };
}

function frame(st, now) {
  if (!st.on) return;
  const dt = Math.min(0.05, (now - st.last) / 1000);
  st.last = now;
  const { ctx, W, H, dpr } = st;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  st.gust += dt;
  const wind = Math.sin(st.gust * 0.3) * 14 + Math.sin(st.gust * 1.1) * 4;
  const speed = st.reduce ? 0.5 : 1;
  // Alt çubuğun üst kenarı (kar orada birikir)
  const bar = document.querySelector('.tabbar');
  const floor = bar ? bar.getBoundingClientRect().top : H;
  for (const f of st.flakes) {
    f.y += (18 + f.z * 34) * dt * speed;
    f.x += (wind * f.z + Math.sin(st.gust * (0.9 + f.z) + f.ph) * 9) * dt * speed;
    if (f.y > floor - 2) {
      st.pile = Math.min(1, st.pile + 0.0009);
      Object.assign(f, flake(st));
    }
    if (f.x < -6) f.x = W + 4;
    if (f.x > W + 6) f.x = -4;
    ctx.fillStyle = `rgba(255,255,255,${0.45 + f.z * 0.5})`;
    ctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
  }
  // Biriken kar: alt çubuğun üstünde dalgalı bir yığın
  if (bar && st.pile > 0.02) {
    const r = bar.getBoundingClientRect();
    const h = 2 + st.pile * 7;
    ctx.fillStyle = 'rgba(244,248,255,.95)';
    ctx.beginPath();
    ctx.moveTo(r.left, r.top + 1);
    for (let x = r.left; x <= r.right + 6; x += 6) {
      const y = r.top + 1 - h * (0.55 + 0.45 * Math.sin(x * 0.045) * Math.sin(x * 0.013 + 1.3));
      ctx.lineTo(x, Math.round(y));
    }
    ctx.lineTo(r.right, r.top + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(190,210,240,.55)';
    ctx.fillRect(r.left, r.top, r.width, 1);
  }
  st.raf = requestAnimationFrame((t) => frame(st, t));
}

/** Kar efektini aç/kapat. */
export function setSnow(on) {
  if (typeof document === 'undefined') return;
  if (on && !S) S = make();
  if (!S) return;
  if (on === S.on) return;
  S.on = on;
  S.c.classList.toggle('on', on);
  cancelAnimationFrame(S.raf);
  if (on) {
    S.last = performance.now();
    S.raf = requestAnimationFrame((t) => frame(S, t));
  } else {
    S.ctx.clearRect(0, 0, S.c.width, S.c.height);
  }
}
