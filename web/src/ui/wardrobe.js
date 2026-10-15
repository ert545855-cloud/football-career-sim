// DOLAP — kozmetik mağazası: krampon, antrenman forması, bant, eldiven, kol, berber. Piksel önizleme.
import { COSMETICS, COSMETIC_BY_ID, COSMETIC_SLOTS, buyCosmetic, ensureCosmetics, equipCosmetic, playerLook, previewLook } from '../core/cosmetics.js';
import { money } from '../core/economy.js';
import { drawPixelPlayer } from '../games/pixel/sprites.js';
import { icon } from './art.js';
import { esc, toast } from './dom.js';
import { sfx } from '../audio.js';

function drawInto(canvas, look, { dir = 'down', frame = 'idle', both = false } = {}) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  const ph = r.height * 0.86;
  if (both) {
    drawPixelPlayer(ctx, r.width * 0.3, r.height * 0.94, ph, look, { dir: 'down', frame: 'idle' });
    drawPixelPlayer(ctx, r.width * 0.7, r.height * 0.94, ph, look, { dir: 'up', frame: 'idle' });
  } else {
    drawPixelPlayer(ctx, r.width / 2, r.height * 0.94, ph, look, { dir, frame, shadow: true });
  }
}

export function wardrobeHTML(app) {
  const s = app.state;
  const c = ensureCosmetics(s);
  const view = (app.wardrobeView ||= { slot: 'boots', training: false, preview: null });
  const items = COSMETICS.filter((it) => it.slot === view.slot);
  const slot = COSMETIC_SLOTS.find((x) => x.id === view.slot);
  const cards = items.map((it) => {
    const owned = c.owned.includes(it.id);
    const on = c.eq[it.slot] === it.id;
    const afford = s.career.money >= it.price;
    const btn = on
      ? `<button class="btn sm ghost block" disabled>${icon('check', 'ico sm')} Giyili</button>`
      : owned
        ? `<button class="btn sm block" data-equip="${it.id}">Giy</button>`
        : `<button class="btn sm ${afford ? 'primary' : ''} block" data-buy-c="${it.id}" ${afford ? '' : 'disabled'}>${money(it.price)}</button>`;
    return `<div class="item wr-item ${on ? 'owned' : ''}" data-try="${it.id}">
      <canvas class="wr-px" data-px="${it.id}" aria-hidden="true"></canvas>
      <h4>${esc(it.name)}</h4>
      ${it.desc ? `<div class="muted small">${esc(it.desc)}</div>` : ''}
      ${owned && !on ? '<span class="chip" style="align-self:flex-start">Sende</span>' : ''}
      ${btn}
    </div>`;
  }).join('');
  return `
    <div class="card wr-stage">
      <canvas class="wr-big" data-big aria-label="Oyuncunun görünüşü"></canvas>
      <div class="wr-side">
        <div class="seg" style="margin-bottom:8px">
          <button class="${view.training ? '' : 'on'}" data-wr-mode="match">Maç</button>
          <button class="${view.training ? 'on' : ''}" data-wr-mode="training">Antrenman</button>
        </div>
        <p class="muted small" style="margin:0">${view.preview ? `Deniyorsun: <b>${esc(COSMETIC_BY_ID[view.preview]?.name || '')}</b>` : 'Bir ürüne dokun, üstünde dene.'}</p>
        <p class="muted small" style="margin:6px 0 0">${esc(slot?.where || '')}</p>
      </div>
    </div>
    <div class="scroller" style="margin:12px 0">
      ${COSMETIC_SLOTS.map((x) => `<button class="opt ${view.slot === x.id ? 'on' : ''}" data-wr-slot="${x.id}">${x.name}</button>`).join('')}
    </div>
    <div class="shop-grid">${cards}</div>`;
}

export function mountWardrobe(app, el) {
  const s = app.state;
  const view = app.wardrobeView;
  const redraw = () => {
    const big = el.querySelector('[data-big]');
    const look = view.preview ? previewLook(s, view.preview, { training: view.training }) : playerLook(s, { training: view.training });
    if (big) drawInto(big, look, { both: true });
    el.querySelectorAll('[data-px]').forEach((cv) => drawInto(cv, previewLook(s, cv.dataset.px, { training: view.training || COSMETIC_BY_ID[cv.dataset.px]?.slot === 'training' }), { dir: COSMETIC_BY_ID[cv.dataset.px]?.slot === 'hair' || COSMETIC_BY_ID[cv.dataset.px]?.slot === 'dye' ? 'down' : 'down' }));
  };
  requestAnimationFrame(redraw);
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-wr-slot],[data-wr-mode],[data-equip],[data-buy-c],[data-try]');
    if (!t) return;
    if (t.dataset.wrSlot) {
      app.click();
      view.slot = t.dataset.wrSlot;
      view.preview = null;
      view.training = view.slot === 'training' ? true : view.training;
      app.go('shop');
    } else if (t.dataset.wrMode) {
      app.click();
      view.training = t.dataset.wrMode === 'training';
      app.go('shop');
    } else if (t.dataset.equip) {
      const r = equipCosmetic(s, t.dataset.equip);
      toast(r.msg, r.ok ? 'good' : 'bad');
      if (r.ok) { sfx('click'); view.preview = null; app.save(); app.go('shop'); }
    } else if (t.dataset.buyC) {
      const r = buyCosmetic(s, t.dataset.buyC);
      toast(r.msg, r.ok ? 'good' : 'bad');
      if (r.ok) { sfx('coin'); view.preview = null; app.save(); app.go('shop'); } else sfx('error');
    } else if (t.dataset.try) {
      view.preview = t.dataset.try;
      const big = el.querySelector('[data-big]');
      if (big) drawInto(big, previewLook(s, view.preview, { training: view.training || COSMETIC_BY_ID[view.preview]?.slot === 'training' }), { both: true });
      const p = el.querySelector('.wr-side p');
      if (p) p.innerHTML = `Deniyorsun: <b>${esc(COSMETIC_BY_ID[view.preview]?.name || '')}</b>`;
    }
  });
}
