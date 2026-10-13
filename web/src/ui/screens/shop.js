import { SHOP_CATEGORIES, SHOP_ITEMS } from '../../core/data.js';
import { buyItem, canBuy, money, sellItem, weeklyFinance } from '../../core/economy.js';
import { icon, itemArt } from '../art.js';
import { esc, toast } from '../dom.js';
import { sprite } from '../../assets/sprites.js';
import { sfx } from '../../audio.js';

const FX_LABEL = { morale: 'Moral', energy: 'Enerji', fans: 'Taraftar', fame: 'Ün', train: 'Antrenman' };

function fxChips(item) {
  const src = item.kind === 'use' ? item.use : item.fx;
  return Object.entries(src || {})
    .map(([k, v]) => `<span class="chip good">${FX_LABEL[k]} ${k === 'train' ? `+%${Math.round(v * 100)}` : `+${v}`}${item.kind === 'use' || k === 'train' ? '' : '/hf'}</span>`)
    .join('');
}

export function shopScreen(app) {
  const s = app.state;
  const view = (app.shopView ||= { cat: 'vehicle' });
  const fin = weeklyFinance(s);
  const items = SHOP_ITEMS.filter((i) => i.cat === view.cat);

  const cards = items.map((it) => {
    const owned = s.career.items.includes(it.id);
    const afford = canBuy(s, it);
    let btn;
    if (owned) btn = `<button class="btn sm ghost block" data-sell="${it.id}">${it.kind === 'sub' ? 'İptal et' : `Sat (${money(it.price * 0.5)})`}</button>`;
    else btn = `<button class="btn sm ${afford ? 'primary' : ''} block" data-buy="${it.id}" ${afford ? '' : 'disabled'}>${it.kind === 'sub' ? 'Abone ol' : it.kind === 'use' ? 'Kullan' : 'Satın al'}</button>`;
    const price = it.kind === 'sub' ? `${money(it.weekly)}<span class="muted small">/hf</span>` : money(it.price);
    return `<div class="item ${owned ? 'owned' : ''}">
      <div class="art">${itemArt(it)}</div>
      <h4>${esc(it.name)}</h4>
      <div class="muted small" style="line-height:1.3">${esc(it.desc)}</div>
      <div class="chips">${fxChips(it)}</div>
      <div class="row between"><span class="price">${price}</span>${it.weekly && it.kind !== 'sub' ? `<span class="muted small">Gider ${money(it.weekly)}/hf</span>` : ''}</div>
      ${owned ? `<span class="chip accent" style="align-self:flex-start">${icon('check')} Sahipsin</span>` : ''}
      ${btn}
    </div>`;
  }).join('');

  return {
    tabs: 'shop',
    html: `
      <div class="row between">
        <h1 class="h-title">Mağaza</h1>
        <span class="money-pill">${icon('coin')} <span class="tnum">${money(s.career.money)}</span></span>
      </div>
      <div class="shop-street" aria-hidden="true">${['merch_red', 'merch_cart', 'merch_blue', 'merch_jerseys'].map((n) => sprite(n, { h: 74, w: 96 })).join('')}</div>
      <div class="card" style="margin-top:12px">
        <div class="row between small"><span class="muted">Haftalık maaş</span><b class="tnum">${money(fin.income)}</b></div>
        <div class="row between small" style="margin-top:6px"><span class="muted">Yaşam + eşya giderleri</span><b class="tnum" style="color:var(--bad)">−${money(fin.living + fin.upkeep)}</b></div>
        <div class="divider" style="margin:10px 0"></div>
        <div class="row between"><span>Haftalık net</span><b class="tnum" style="color:${fin.net >= 0 ? 'var(--good)' : 'var(--bad)'}">${fin.net >= 0 ? '+' : ''}${money(fin.net)}</b></div>
      </div>
      <div class="scroller" style="margin:14px 0 12px">
        ${SHOP_CATEGORIES.map((c) => `<button class="opt ${view.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.name}</button>`).join('')}
      </div>
      <p class="muted small" style="margin:0 0 10px">${view.cat === 'vehicle' || view.cat === 'home' ? 'Bu kategoride sadece en iyi eşyanın etkisi geçerli.' : 'Bu kategorideki etkiler birbirine eklenir.'}</p>
      <div class="shop-grid">${cards}</div>`,
    mount(el) {
      el.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.cat) {
          app.click();
          view.cat = t.dataset.cat;
          app.go('shop');
        } else if (t.dataset.buy) {
          const r = buyItem(s, t.dataset.buy);
          toast(r.msg, r.ok ? 'good' : 'bad');
          if (r.ok) {
            sfx('coin');
            app.save();
            app.go('shop');
          } else sfx('error');
        } else if (t.dataset.sell) {
          const r = sellItem(s, t.dataset.sell);
          toast(r.msg, r.ok ? 'good' : 'bad');
          if (r.ok) {
            sfx('coin');
            app.save();
            app.go('shop');
          }
        }
      });
    },
  };
}
