// GARAJ EKRANI — arabanı modifiye et. Parçaya dokun: takılır (ilk kez satın alınır), eskiye dönmek bedava.
import { CLUB_BY_ID } from '../../core/data.js';
import { money } from '../../core/economy.js';
import {
  CARS, MOD_CATS, applyMod, carName, carState, carStats, currentCarId, isOwnedMod, modPrice, optionOf, ownedCars, plateText,
} from '../../core/garage.js';
import { buzz, sfx } from '../../audio.js';
import { icon } from '../art.js';
import { esc, toast } from '../dom.js';
import { CH, CW, drawCar } from '../carCanvas.js';

let view = { car: null, cat: 'paint' };

/** Çizim seçenekleri (araba modifiyelerinden) */
export function carLook(state, carId) {
  const c = carState(state, carId);
  const club = CLUB_BY_ID[state.career.clubId];
  const paint = optionOf('paint', c.mods.paint);
  const neon = optionOf('neon', c.mods.neon);
  const stock = (state.career.items || []).includes(carId) ? { hatch: '#60a5fa', sedan: '#e2e8f0', suv: '#111827', super: '#ef4444' }[carId] : '#60a5fa';
  return {
    body: CARS[carId].body,
    color: paint.club ? club.colors[0] : paint.color || stock,
    stripeColor: paint.club ? club.colors[1] : undefined,
    finish: c.mods.finish,
    stripes: c.mods.stripes,
    rims: c.mods.rims,
    kit: c.mods.kit,
    spoiler: c.mods.spoiler,
    tint: c.mods.tint,
    neon: c.mods.neon === 'none' ? null : neon.color || club.colors[0],
    engine: c.mods.engine,
    plate: c.mods.plate === 'custom',
    number: state.player.number,
  };
}

const statBar = (label, v, max, col) => `<div class="gs"><span>${label}</span><div class="bar"><i style="--c:${col};width:${Math.round(Math.min(1, v / max) * 100)}%"></i></div><b>${v}</b></div>`;

export function garageScreen(app) {
  const s = app.state;
  const cars = ownedCars(s);
  if (!view.car || !cars.includes(view.car)) view.car = currentCarId(s);
  const carId = view.car;

  if (!carId) {
    return {
      tabs: 'home',
      html: `
        <div class="row" style="gap:10px"><button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button><h1 class="h-title grow">Garaj</h1></div>
        <div class="card center" style="margin-top:14px;padding:24px 16px">
          <div class="event-art">${icon('car')}</div>
          <h3>Garajın boş</h3>
          <p class="muted">Modifiye için önce bir araba al. Mağaza › Araçlar'da ilk el arabalardan süper spora kadar seçenek var.</p>
          <button class="btn primary block" data-act="shop">${icon('bag')} Araçlara bak</button>
        </div>`,
      mount(node) {
        node.addEventListener('click', (e) => {
          const t = e.target.closest('[data-act]');
          if (!t) return;
          app.click();
          if (t.dataset.act === 'back') return app.go('social');
          app.shopView = { cat: 'vehicle' };
          app.go('shop');
        });
      },
    };
  }

  return {
    tabs: 'home',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <div class="grow" style="min-width:0"><h1 class="h-title">Garaj</h1><div class="muted small ellipsis" data-carname></div></div>
        <span class="money-pill">${icon('coin')} <span class="tnum" data-money></span></span>
      </div>
      ${cars.length > 1 ? `<div class="seg" style="margin-top:10px">${cars.map((id) => `<button class="${id === carId ? 'on' : ''}" data-car="${id}">${esc(CARS[id].name)}</button>`).join('')}</div>` : ''}
      <div class="car-stage">
        <canvas width="${CW}" height="${CH}" class="car-canvas"></canvas>
        <span class="car-plate" data-plate hidden></span>
        <button class="btn sm car-rev" data-act="rev">${icon('bolt', 'ico sm')} Gaz ver</button>
      </div>
      <div class="card car-stats" data-stats></div>
      <div class="mod-tabs" data-tabs>${MOD_CATS.map((c) => `<button data-cat="${c.id}">${icon(c.icon, 'ico sm')}<span>${c.name}</span></button>`).join('')}</div>
      <div class="mod-grid" data-opts></div>
      <p class="muted small center" style="margin-top:12px">Stil her hafta moral verir. Dikkat çeken araba taraftarı sevindirir ama paparazziyi de peşine takar; koyu cam filmi gizler. Güçlü motor hız cezası riskini artırır. Arabayı satarsan modifiye harcamasının %30'u geri gelir.</p>`,
    mount(node) {
      const cv = node.querySelector('.car-canvas');
      const ctx = cv.getContext('2d');
      const t0 = performance.now();
      let rev = 0;
      let look = carLook(s, carId);
      const frame = (now) => {
        if (!cv.isConnected) return;
        const t = (now - t0) / 1000;
        ctx.save();
        if (rev > 0) {
          rev -= 1 / 60;
          ctx.translate(Math.round(Math.sin(t * 60) * (rev > 0.3 ? 1 : 0)), 0);
        }
        drawCar(ctx, t, { ...look, rev: rev > 0 });
        ctx.restore();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);

      const render = () => {
        const c = carState(s, carId);
        const st = carStats(s, carId);
        look = carLook(s, carId);
        node.querySelector('[data-money]').textContent = money(s.career.money);
        node.querySelector('[data-carname]').textContent = `${carName(carId)} · ${st.installed} modifiye`;
        const plate = node.querySelector('[data-plate]');
        plate.hidden = c.mods.plate !== 'custom';
        plate.textContent = plateText(s);
        node.querySelector('[data-stats]').innerHTML = `
          ${statBar('Performans', st.perf, 100, 'var(--bad)')}
          ${statBar('Stil', st.style, 30, 'var(--gold)')}
          ${statBar('Dikkat', st.flash, 15, '#f472b6')}
          ${statBar('Gizlilik', st.stealth, 4, 'var(--blue)')}`;
        node.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === view.cat));
        const cat = MOD_CATS.find((x) => x.id === view.cat);
        const club = CLUB_BY_ID[s.career.clubId];
        node.querySelector('[data-opts]').innerHTML = cat.options.map((o) => {
          const on = c.mods[cat.id] === o.id;
          const owned = isOwnedMod(s, carId, cat.id, o.id);
          const price = modPrice(carId, cat.id, o.id);
          const afford = owned || s.career.money >= price;
          const sw = cat.id === 'paint' ? `<i class="mod-sw" style="background:${o.club ? `linear-gradient(135deg, ${club.colors[0]} 50%, ${club.colors[1]} 50%)` : o.color || look.color}"></i>`
            : cat.id === 'neon' && o.id !== 'none' ? `<i class="mod-sw glow" style="--g:${o.color || club.colors[0]}"></i>` : '';
          const fx = [o.style ? `Stil +${o.style}` : '', o.power ? `Güç +${o.power}` : '', o.flash ? `Dikkat +${o.flash}` : '', o.stealth ? `Gizlilik +${o.stealth}` : ''].filter(Boolean).join(' · ');
          return `<button class="mod ${on ? 'on' : ''} ${afford ? '' : 'off'}" data-opt="${o.id}">
            ${sw}<b>${esc(o.name)}</b>
            <small>${fx || '&nbsp;'}</small>
            <span class="chip ${on ? 'accent' : owned ? '' : 'gold'}">${on ? `${icon('check', 'ico xs')} Takılı` : owned ? 'Sahipsin' : money(price)}</span>
          </button>`;
        }).join('');
      };
      render();

      node.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act],[data-cat],[data-opt],[data-car]');
        if (!t) return;
        if (t.dataset.act === 'back') {
          app.click();
          return app.go('social');
        }
        if (t.dataset.act === 'rev') {
          rev = 1.1;
          sfx('engine');
          buzz('rev');
          if (look.engine === 's3') setTimeout(() => sfx('backfire'), 700);
          return;
        }
        if (t.dataset.car) {
          app.click();
          view.car = t.dataset.car;
          return app.go('garage');
        }
        if (t.dataset.cat) {
          app.click();
          view.cat = t.dataset.cat;
          return render();
        }
        if (t.dataset.opt) {
          const r = applyMod(s, carId, view.cat, t.dataset.opt);
          if (!r.ok) {
            sfx('error');
            buzz('error');
            return toast(r.msg, 'bad');
          }
          if (r.same) return;
          if (r.price) {
            sfx('coin');
            buzz([20, 40, 30]);
            toast(r.msg, 'good');
          } else {
            sfx('swish');
            buzz('tap');
          }
          if (view.cat === 'engine' && t.dataset.opt !== 'stock') {
            rev = 1.1;
            setTimeout(() => sfx('engine'), 150);
          }
          app.save();
          render();
        }
      });
    },
  };
}
