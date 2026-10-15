// EVİM — evini dizayn et: mobilya al, odaya yerleştir, döndür, depoya kaldır; duvar ve zemin seç.
// Odaya dokun: seçili eşyayı oraya taşır. Eşyaya dokun: seçer. Yeşil noktalar eşyanın sığdığı yerleri gösterir.
import { CLUB_BY_ID } from '../../core/data.js';
import { money } from '../../core/economy.js';
import {
  FLOORS, FURNITURE, FURNITURE_BY_ID, STYLES, WALLS, buyFurniture, dims, ensureHome, fits, homeOf, homeScore, placeFurniture,
  sellFurniture, setFinish, storeFurniture,
} from '../../core/social/home.js';
import { buzz, sfx } from '../../audio.js';
import { icon } from '../art.js';
import { esc, toast } from '../dom.js';
import { CELL, SIDE, TOP, cellAt, drawRoom, itemPreview, roomSize } from '../homeCanvas.js';

const CATS = ['Salon', 'Yatak odası', 'Dekor', 'Futbol'];
let lastCat = 'Salon';

export function wallColorOf(state) {
  const h = ensureHome(state);
  const w = WALLS.find((x) => x.id === h.wall);
  return w?.color || CLUB_BY_ID[state.career.clubId].colors[0];
}

export function homeScreen(app) {
  const s = app.state;
  const plan = homeOf(s);
  const size = roomSize(plan);

  return {
    tabs: 'social',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <div class="grow" style="min-width:0"><h1 class="h-title">Evim</h1><div class="muted small ellipsis">${esc(plan.name)} · ${plan.w}×${plan.h}</div></div>
        <span class="money-pill">${icon('coin')} <span class="tnum" data-money></span></span>
      </div>
      <div class="home-score" data-score></div>
      <div class="room-wrap"><canvas class="room-canvas" width="${size.w}" height="${size.h}" style="aspect-ratio:${size.w}/${size.h}"></canvas></div>
      <div class="room-bar" data-bar></div>
      <div data-store></div>

      <div class="h-sec">Duvar ve zemin</div>
      <div class="card finish">
        <div class="muted small">Duvar rengi</div>
        <div class="fin-swatches" data-walls></div>
        <div class="muted small" style="margin-top:10px">Zemin</div>
        <div class="fin-swatches" data-floors></div>
      </div>

      <div class="h-sec">Mobilya mağazası</div>
      <div class="seg" data-cats>${CATS.map((c) => `<button data-cat="${c}">${c}</button>`).join('')}</div>
      <div class="furn-grid" data-catalog></div>
      <p class="muted small center" style="margin-top:12px">Konfor her hafta enerji ve moral verir. Prestij ev partilerini, ünü ve magazinin ilgisini artırır. Aynı stilden 4 eşya: <b>uyum bonusu</b>. Daha büyük ev için Mağaza › Ev.</p>`,
    mount(node) {
      const cv = node.querySelector('.room-canvas');
      const ctx = cv.getContext('2d');
      /** seçim: {uid, rot, placed:boolean} */
      let sel = null;
      let raf = 0;
      const t0 = performance.now();
      const h = () => ensureHome(s);

      const hintsFor = () => {
        if (!sel) return [];
        const item = { uid: sel.uid, id: sel.id };
        const f = FURNITURE_BY_ID[sel.id];
        const out = [];
        if (f.wall) {
          for (let x = 0; x < plan.w; x++) if (fits(plan, h().placed, item, x, 0, 0)) out.push({ x, y: -1 });
          return out;
        }
        for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) if (fits(plan, h().placed, item, x, y, sel.rot)) out.push({ x, y });
        return out;
      };
      let hints = [];

      const frame = (now) => {
        if (!cv.isConnected) return;
        drawRoom(ctx, (now - t0) / 1000, {
          plan,
          wallColor: wallColorOf(s),
          floor: h().floor,
          placed: h().placed,
          selected: sel?.placed ? sel.uid : null,
          hints,
          view: ['penthouse', 'villa'].includes(plan.id) ? 'sea' : 'city',
          trophies: (s.career.awards || []).length,
          jersey: CLUB_BY_ID[s.career.clubId].colors[0],
        });
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      const renderScore = () => {
        const hs = homeScore(s);
        node.querySelector('[data-money]').textContent = money(s.career.money);
        node.querySelector('[data-score]').innerHTML = `
          <span class="hs-item">${icon('sofa', 'ico sm')}<b>${hs.comfort}</b><small>Konfor</small></span>
          <span class="hs-item gold">${icon('crown', 'ico sm')}<b>${hs.prestige}</b><small>Prestij</small></span>
          <span class="hs-item good">${icon('bolt', 'ico sm')}<b>+${hs.weekly.energy}</b><small>Enerji/hf</small></span>
          <span class="hs-item heart">${icon('smile', 'ico sm')}<b>+${hs.weekly.morale}</b><small>Moral/hf</small></span>
          ${hs.harmony ? `<span class="chip gold" style="grid-column:1/-1;justify-self:center">${icon('sparkle', 'ico xs')} ${STYLES[hs.harmony]} uyum bonusu</span>` : ''}
          ${hs.train ? `<span class="chip accent" style="grid-column:1/-1;justify-self:center">${icon('dumbbell', 'ico xs')} Antrenman +%${Math.round(hs.train * 100)}</span>` : ''}`;
      };

      const renderBar = () => {
        const bar = node.querySelector('[data-bar]');
        if (!sel) {
          bar.innerHTML = `<span class="muted small">${h().placed.length ? 'Bir eşyaya dokunup seç; sonra odada gitmesini istediğin yere dokun.' : 'Aşağıdaki mağazadan mobilya al, sonra odaya yerleştir.'}</span>`;
          return;
        }
        const f = FURNITURE_BY_ID[sel.id];
        bar.innerHTML = `
          <div class="row" style="gap:8px;min-width:0"><b class="ellipsis">${esc(f.name)}</b><span class="chip">${icon('sofa', 'ico xs')} ${f.comfort}</span><span class="chip gold">${icon('crown', 'ico xs')} ${f.prestige}</span></div>
          <div class="muted small">${sel.placed ? 'Taşımak için odada bir yere dokun.' : f.wall ? 'Üst duvarda bir yere dokunarak as.' : 'Yerleştirmek için odada yeşil noktalı bir yere dokun.'}</div>
          <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">
            ${f.wall ? '' : `<button class="btn sm" data-do="rotate">${icon('rotate', 'ico sm')} Döndür</button>`}
            ${sel.placed ? `<button class="btn sm" data-do="store">${icon('box', 'ico sm')} Depoya</button>` : ''}
            <button class="btn sm danger" data-do="sell">${icon('trash', 'ico sm')} Sat ${money(Math.round(f.price * 0.4))}</button>
            <button class="btn sm primary" data-do="done" style="margin-left:auto">${icon('check', 'ico sm')} Tamam</button>
          </div>`;
      };

      const renderStore = () => {
        const owned = h().owned;
        node.querySelector('[data-store]').innerHTML = owned.length
          ? `<div class="h-sec">Depo <span>${owned.length} eşya · yerleştirmek için seç</span></div>
             <div class="store-row">${owned.map((o) => `<button class="store-item ${sel?.uid === o.uid ? 'on' : ''}" data-owned="${o.uid}"><canvas data-prev="${o.id}"></canvas><span>${esc(FURNITURE_BY_ID[o.id].name)}</span></button>`).join('')}</div>`
          : '';
        node.querySelectorAll('[data-store] canvas[data-prev]').forEach((c) => itemPreview(c, FURNITURE_BY_ID[c.dataset.prev], { jersey: CLUB_BY_ID[s.career.clubId].colors[0] }));
      };

      const renderFinish = () => {
        const club = CLUB_BY_ID[s.career.clubId];
        node.querySelector('[data-walls]').innerHTML = WALLS.map((w) => {
          const owned = h().walls.includes(w.id);
          const col = w.color || club.colors[0];
          return `<button class="fin-swatch ${h().wall === w.id ? 'on' : ''}" data-wall="${w.id}" title="${esc(w.name)}"><i style="background:${col}"></i><span>${esc(w.name)}</span><small>${owned ? (h().wall === w.id ? 'Seçili' : 'Sahipsin') : money(w.price)}</small></button>`;
        }).join('');
        const FL = { wood: 'linear-gradient(#b0744a 0 50%,#a0673d 50%)', parquet: 'repeating-linear-gradient(45deg,#b7794a 0 4px,#a86b3e 4px 8px)', marble: 'linear-gradient(135deg,#f5f5f4,#d6d3d1)', carpet: '#64748b' };
        node.querySelector('[data-floors]').innerHTML = FLOORS.map((f) => {
          const owned = h().floors.includes(f.id);
          return `<button class="fin-swatch ${h().floor === f.id ? 'on' : ''}" data-floor="${f.id}"><i style="background:${FL[f.id]};background-size:8px 8px"></i><span>${esc(f.name)}</span><small>${owned ? (h().floor === f.id ? 'Seçili' : 'Sahipsin') : money(f.price)}</small></button>`;
        }).join('');
      };

      const renderCatalog = () => {
        node.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === lastCat));
        const list = FURNITURE.filter((f) => f.cat === lastCat);
        const count = (id) => h().placed.filter((p) => p.id === id).length + h().owned.filter((p) => p.id === id).length;
        node.querySelector('[data-catalog]').innerHTML = list.map((f) => {
          const n = count(f.id);
          const afford = s.career.money >= f.price;
          return `<article class="furn ${afford ? '' : 'off'}">
            <canvas data-prev="${f.id}"></canvas>
            <b>${esc(f.name)}</b>
            <div class="chips"><span class="chip">${icon('sofa', 'ico xs')} ${f.comfort}</span><span class="chip gold">${icon('crown', 'ico xs')} ${f.prestige}</span><span class="chip">${f.wall ? 'Duvar' : `${f.w}×${f.h}`}</span></div>
            <span class="muted small">${STYLES[f.style]}${f.train ? ` · antrenman +%${Math.round(f.train * 100)}` : ''}${n ? ` · ${n} adet var` : ''}</span>
            <button class="btn sm ${afford ? 'primary' : ''} block" data-buy="${f.id}" ${afford ? '' : 'disabled'}>${icon('coin', 'ico sm')} ${money(f.price)}</button>
          </article>`;
        }).join('');
        node.querySelectorAll('[data-catalog] canvas[data-prev]').forEach((c) => itemPreview(c, FURNITURE_BY_ID[c.dataset.prev], { jersey: CLUB_BY_ID[s.career.clubId].colors[0], trophies: 3 }));
      };

      const refresh = () => {
        hints = hintsFor();
        renderScore();
        renderBar();
        renderStore();
        renderFinish();
        renderCatalog();
      };
      const select = (next) => {
        sel = next;
        hints = hintsFor();
        renderBar();
        renderStore();
      };
      refresh();

      const itemAt = (cell) => {
        const placed = h().placed.map((p) => ({ ...p, f: FURNITURE_BY_ID[p.id] })).filter((p) => p.f);
        if (cell.y < 0) return placed.find((p) => p.f.wall && cell.x >= p.x && cell.x < p.x + p.f.w) || null;
        const hit = (p) => {
          const d = dims(p.f, p.rot);
          return !p.f.wall && cell.x >= p.x && cell.x < p.x + d.w && cell.y >= p.y && cell.y < p.y + d.h;
        };
        return placed.find((p) => hit(p) && !p.f.floor) || placed.find((p) => hit(p)) || null;
      };

      cv.addEventListener('click', (e) => {
        const r = cv.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * cv.width;
        const y = ((e.clientY - r.top) / r.height) * cv.height;
        const cell = cellAt(plan, x, y);
        if (!cell) return;
        const hitItem = itemAt(cell);
        if (sel) {
          const f = FURNITURE_BY_ID[sel.id];
          if (hitItem && hitItem.uid === sel.uid) return select(null);
          // Dokunulan hücre eşyanın ortasına gelsin
          const d = dims(f, sel.rot);
          let tx = Math.max(0, Math.min(plan.w - d.w, cell.x - Math.floor((d.w - 1) / 2)));
          let ty = f.wall ? 0 : Math.max(0, Math.min(plan.h - d.h, cell.y - Math.floor((d.h - 1) / 2)));
          if (f.wall && cell.y >= 0 && !hitItem) {
            toast('Tablolar ve formalar üst duvara asılır.', 'bad');
            return;
          }
          if (!f.wall && cell.y < 0) return;
          let res = placeFurniture(s, sel.uid, tx, ty, sel.rot);
          if (!res.ok && !f.wall) {
            // Dokunulan hücre sol üst köşe olarak da dene
            tx = Math.min(plan.w - d.w, cell.x);
            ty = Math.min(plan.h - d.h, cell.y);
            res = placeFurniture(s, sel.uid, tx, ty, sel.rot);
          }
          if (res.ok) {
            sfx('tick');
            buzz(8);
            app.save();
            select({ ...sel, placed: true });
            renderScore();
            return;
          }
          if (hitItem) return select({ uid: hitItem.uid, id: hitItem.id, rot: hitItem.rot || 0, placed: true });
          sfx('error');
          toast(res.msg, 'bad');
          return;
        }
        if (hitItem) {
          sfx('click');
          select({ uid: hitItem.uid, id: hitItem.id, rot: hitItem.rot || 0, placed: true });
        }
      });

      node.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-act],[data-do],[data-owned],[data-wall],[data-floor],[data-cat],[data-buy]');
        if (!t || t.disabled) return;
        if (t.dataset.act === 'back') {
          cancelAnimationFrame(raf);
          app.click();
          return app.go('social');
        }
        if (t.dataset.cat) {
          app.click();
          lastCat = t.dataset.cat;
          return renderCatalog();
        }
        if (t.dataset.owned) {
          app.click();
          const o = h().owned.find((x) => x.uid === t.dataset.owned);
          if (!o) return;
          select(sel?.uid === o.uid ? null : { uid: o.uid, id: o.id, rot: 0, placed: false });
          cv.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (t.dataset.buy) {
          const r = buyFurniture(s, t.dataset.buy);
          if (!r.ok) {
            sfx('error');
            return toast(r.msg, 'bad');
          }
          sfx('coin');
          buzz(10);
          app.save();
          toast(r.msg, 'good');
          sel = { uid: r.item.uid, id: r.item.id, rot: 0, placed: false };
          refresh();
          cv.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (t.dataset.wall || t.dataset.floor) {
          const kind = t.dataset.wall ? 'wall' : 'floor';
          const r = setFinish(s, kind, t.dataset.wall || t.dataset.floor);
          if (!r.ok) {
            sfx('error');
            return toast(r.msg, 'bad');
          }
          sfx('swish');
          app.save();
          renderFinish();
          renderScore();
          return;
        }
        if (t.dataset.do && sel) {
          const f = FURNITURE_BY_ID[sel.id];
          if (t.dataset.do === 'done') {
            app.click();
            return select(null);
          }
          if (t.dataset.do === 'rotate') {
            const rot = sel.rot ? 0 : 1;
            if (!sel.placed) {
              app.click();
              return select({ ...sel, rot });
            }
            const p = h().placed.find((x) => x.uid === sel.uid);
            const d = dims(f, rot);
            // Aynı yerde dönmüyorsa yakınlarda dene
            const tries = [[p.x, p.y], [Math.min(p.x, plan.w - d.w), Math.min(p.y, plan.h - d.h)], [p.x - 1, p.y], [p.x, p.y - 1], [p.x - 1, p.y - 1]];
            for (const [x, y] of tries) {
              if (placeFurniture(s, sel.uid, x, y, rot).ok) {
                sfx('tick');
                app.save();
                return select({ ...sel, rot });
              }
            }
            sfx('error');
            return toast('Döndürmek için yer yok. Önce biraz kenara çek.', 'bad');
          }
          if (t.dataset.do === 'store') {
            storeFurniture(s, sel.uid);
            sfx('swish');
            app.save();
            sel = null;
            return refresh();
          }
          if (t.dataset.do === 'sell') {
            const ok = await app.confirm('Satılsın mı?', `${f.name} ${money(Math.round(f.price * 0.4))} karşılığında satılacak (alış fiyatının %40'ı).`, 'Sat');
            if (!ok) return;
            const refund = sellFurniture(s, sel.uid);
            sfx('coin');
            app.save();
            toast(`${f.name} satıldı: +${money(refund)}`, 'good');
            sel = null;
            return refresh();
          }
        }
      });
    },
  };
}

export { CELL, SIDE, TOP };
