// GOL SEVİNCİ SEÇİMİ — golden sonra süreli olay: sahip olduğun sevinçlerden birine dokun, oyuncun onu yapsın.
//   Başlangıçta 1 sevinç (köşe bayrağı). Mağazadan aldıkça seçenekler 3'e kadar çıkar; boş yuvalar kilitli görünür.
//   Süre dolarsa kuşandığın sevinç yapılır.
import { COSMETICS, ensureCosmetics } from '../core/cosmetics.js';
import { playerCanvas, SPRITE_W, SPRITE_H } from '../games/pixel/sprites.js';

export const CELEB_SLOTS = 3;
export const CELEB_PICK_MS = 4200;

/** Önizleme pozları (canlı yayındaki sevinçle aynı kareler) */
const THUMB = {
  corner: { dir: 'down', frame: 'cheer' },
  slide: { dir: 'side', frame: 'lunge' },
  plane: { dir: 'down', frame: 'lunge' },
  heart: { dir: 'down', frame: 'clap' },
  shush: { dir: 'down', frame: 'point' },
  dance: { dir: 'down', frame: 'run0' },
  flip: { dir: 'down', frame: 'cheer', rot: Math.PI },
};

/** Seçenekler: önce kuşanılan, sonra sahip olunan diğerleri (pahalıdan ucuza), en fazla 3 */
export function celebrationChoices(state) {
  const cs = ensureCosmetics(state);
  const eq = cs.eq.celebration || 'cel_corner';
  const own = COSMETICS.filter((c) => c.slot === 'celebration' && (c.price === 0 || cs.owned.includes(c.id)));
  own.sort((a, b) => (b.id === eq) - (a.id === eq) || b.price - a.price);
  return own.slice(0, CELEB_SLOTS).map((c) => ({ id: c.id, style: c.celebration, name: c.name, eq: c.id === eq }));
}

function drawThumb(cv, look, style) {
  const t = THUMB[style] || THUMB.corner;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const k = Math.max(1, Math.round(1.25 * dpr));
  cv.width = SPRITE_W * k + 8 * dpr;
  cv.height = SPRITE_H * k + 4 * dpr;
  cv.style.width = `${cv.width / dpr}px`;
  cv.style.height = `${cv.height / dpr}px`;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.save();
  if (t.rot) {
    // takla: ters dönmüş oyuncu + etrafında dönüş oku
    const f = 0.62;
    const cx = cv.width / 2;
    const cy = cv.height * 0.5;
    const rad = Math.min(cv.width, cv.height) * 0.44;
    g.strokeStyle = '#ffd34d';
    g.lineWidth = Math.max(2, Math.round(1.5 * dpr));
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, rad, Math.PI * 0.95, Math.PI * 2.2);
    g.stroke();
    // ok ucu (yayın sonunda, saat yönünde)
    const ea = Math.PI * 2.2;
    const ex = cx + Math.cos(ea) * rad;
    const ey = cy + Math.sin(ea) * rad;
    const tx = -Math.sin(ea);
    const ty = Math.cos(ea);
    const ah = 4.5 * dpr;
    g.fillStyle = '#ffd34d';
    g.beginPath();
    g.moveTo(ex + tx * ah, ey + ty * ah);
    g.lineTo(ex - ty * ah * 0.8 - tx * ah * 0.2, ey + tx * ah * 0.8 - ty * ah * 0.2);
    g.lineTo(ex + ty * ah * 0.8 - tx * ah * 0.2, ey - tx * ah * 0.8 - ty * ah * 0.2);
    g.closePath();
    g.fill();
    g.translate(cx, cy);
    g.rotate(Math.PI);
    g.drawImage(playerCanvas(look, 'down', 'cheer'), (-SPRITE_W * k * f) / 2, (-SPRITE_H * k * f) / 2, SPRITE_W * k * f, SPRITE_H * k * f);
  } else {
    g.translate(cv.width / 2, cv.height - 2 * dpr);
    g.drawImage(playerCanvas(look, t.dir, t.frame), (-SPRITE_W * k) / 2, -SPRITE_H * k, SPRITE_W * k, SPRITE_H * k);
  }
  g.restore();
}

/**
 * Seçim panelini yayın kutusunun içine açar.
 * @returns {Promise<string>} seçilen sevinç stili (süre dolarsa ilk/kuşanılan)
 */
export function pickCelebration(host, { look, choices, ms = CELEB_PICK_MS, delay = 850, onPick = null } = {}) {
  // önce GOOOL perdesi otursun, sonra seçim paneli kayarak gelsin
  return new Promise((r) => setTimeout(r, delay)).then(() => openPick(host, { look, choices, ms, onPick }));
}

function openPick(host, { look, choices, ms, onPick }) {
  return new Promise((resolve) => {
    const list = (choices && choices.length ? choices : [{ id: 'cel_corner', style: 'corner', name: 'Köşe bayrağı koşusu', eq: true }]).slice(0, CELEB_SLOTS);
    const box = document.createElement('div');
    box.className = 'cel-pick';
    const slots = [];
    for (let i = 0; i < CELEB_SLOTS; i++) {
      const c = list[i];
      slots.push(c
        ? `<button class="cel-opt ${c.eq ? 'eq' : ''}" data-cel="${c.style}" data-i="${i}"><canvas></canvas><b>${c.name}</b><kbd>${i + 1}</kbd></button>`
        : '<div class="cel-opt locked"><span class="lk">🔒</span><b>Mağazadan al</b></div>');
    }
    box.innerHTML = `<div class="cel-pick-h"><span>GOL SEVİNCİNİ SEÇ</span><span data-sec></span></div><div class="cel-bar"><i></i></div><div class="cel-opts">${slots.join('')}</div>`;
    host.appendChild(box);
    box.querySelectorAll('[data-cel]').forEach((b) => drawThumb(b.querySelector('canvas'), look, b.dataset.cel));
    const bar = box.querySelector('.cel-bar i');
    const sec = box.querySelector('[data-sec]');
    const t0 = performance.now();
    let done = false;
    let raf = 0;
    const finish = (style, btn) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      btn?.classList.add('on');
      onPick?.(style, !!btn);
      setTimeout(() => box.classList.add('done'), btn ? 280 : 60);
      setTimeout(() => box.remove(), btn ? 650 : 420);
      resolve(style);
    };
    const def = () => list[0].style;
    const tick = () => {
      if (!box.isConnected) return finish(def(), null);
      const left = Math.max(0, ms - (performance.now() - t0));
      bar.style.width = `${(left / ms) * 100}%`;
      sec.textContent = `${Math.ceil(left / 1000)} sn`;
      if (left <= 0) return finish(def(), null);
      raf = requestAnimationFrame(tick);
    };
    const onKey = (e) => {
      const n = Number(e.key);
      const b = box.querySelector(`[data-i="${n - 1}"]`);
      if (b) { e.preventDefault(); finish(b.dataset.cel, b); }
    };
    window.addEventListener('keydown', onKey);
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('[data-cel]');
      if (b) finish(b.dataset.cel, b);
    });
    tick();
  });
}
