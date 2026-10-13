// BAŞARIMLAR EKRANI — kategoriye göre rozet vitrini; kilitlilerde ilerleme çubuğu.
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, CATEGORIES, TIERS, progressOf } from '../../core/achievements.js';
import { icon } from '../art.js';
import { animateBars, esc } from '../dom.js';
import { achievementSheet, badgeHTML } from '../achievementsView.js';

export function achievementsScreen(app, params = {}) {
  const s = app.state;
  const filter = params.cat || 'all';
  const list = ACHIEVEMENTS.filter((a) => filter === 'all' || a.cat === filter);
  const unlocked = ACHIEVEMENTS.filter((a) => s.achievements?.unlocked?.[a.id]).length;
  const byTier = Object.keys(TIERS).map((t) => {
    const all = ACHIEVEMENTS.filter((a) => a.tier === t);
    const got = all.filter((a) => s.achievements?.unlocked?.[a.id]).length;
    return `<div class="kpi"><b style="color:${TIERS[t].color}">${got}/${all.length}</b><span>${TIERS[t].name}</span></div>`;
  }).join('');

  // Önce açılanlar, sonra en çok ilerleyenler
  const cards = list
    .map((a) => ({ a, p: progressOf(s, a) }))
    .sort((x, y) => Number(y.p.unlocked) - Number(x.p.unlocked) || y.p.pct - x.p.pct)
    .map(({ a, p }) => `
      <button class="ach-tile ${p.unlocked ? 'on' : ''}" data-ach="${a.id}" style="--tier:${TIERS[a.tier].color}">
        ${badgeHTML(a, { unlocked: p.unlocked, size: 54 })}
        <b>${esc(a.title)}</b>
        ${p.unlocked ? `<span class="small" style="color:${TIERS[a.tier].color}">${TIERS[a.tier].name}</span>` : `<span class="bar"><i style="--c:${TIERS[a.tier].color}" data-w="${Math.round(p.pct * 100)}"></i></span>`}
      </button>`)
    .join('');

  const tabs = [['all', 'Tümü'], ...Object.entries(CATEGORIES)]
    .map(([id, name]) => `<button class="chip ${id === filter ? 'accent' : ''}" data-cat="${id}">${esc(name)}</button>`)
    .join('');

  return {
    tabs: 'career',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Başarımlar</h1>
        <span class="chip accent">${unlocked}/${ACHIEVEMENTS.length}</span>
      </div>
      <div class="kpis" style="margin-top:12px">${byTier}</div>
      <div class="chips scroll-x" style="margin-top:12px">${tabs}</div>
      <div class="ach-grid">${cards}</div>
      <p class="muted small center" style="margin-top:14px">Her rozet moral (altın ve üstü ün de) kazandırır.</p>`,
    mount(node) {
      animateBars(node);
      node.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-ach],[data-cat],[data-act]');
        if (!t) return;
        app.click();
        if (t.dataset.ach) await achievementSheet(s, ACHIEVEMENT_BY_ID[t.dataset.ach]);
        else if (t.dataset.cat) app.go('achievements', { cat: t.dataset.cat });
        else if (t.dataset.act === 'back') app.go('career');
      });
    },
  };
}
