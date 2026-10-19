// HAFTALIK GÖREVLER KARTI (ana ekran) — ilerleme çubukları, ödül al, haftanın sandığı.
import { QUESTS, claimQuest, ensureQuests, openChest } from '../core/quests.js';
import { COSMETIC_BY_ID, COSMETIC_SLOTS } from '../core/cosmetics.js';
import { money } from '../core/economy.js';
import { buzz, sfx } from '../audio.js';
import { icon } from './art.js';
import { esc, sheet, toast } from './dom.js';

export function questsCard(state) {
  const q = ensureQuests(state);
  if (!q.list?.length) return '';
  const done = q.list.filter((t) => t.done).length;
  const rows = q.list.map((t) => {
    const def = QUESTS[t.id];
    const tgt = def.binary ? 1 : t.target;
    const pct = Math.round((Math.min(tgt, t.progress) / tgt) * 100);
    return `<div class="qrow ${t.done ? 'done' : ''} ${t.claimed ? 'claimed' : ''}">
      <span class="qic">${icon(def.icon || 'target', 'ico sm')}</span>
      <div class="grow" style="min-width:0"><b>${esc(t.text)}</b>
        <div class="qbar"><i style="width:${pct}%"></i></div>
        <span class="qrew">${money(t.reward.money)}${t.reward.fame ? ` · Ün +${String(t.reward.fame).replace('.', ',')}` : ''}${t.hard ? ' · zor' : ''}</span></div>
      ${t.claimed ? `<span class="chip good">${icon('check', 'ico xs')}</span>` : t.done ? `<button class="btn primary sm" data-claim="${t.n}">Al</button>` : `<span class="muted small tnum">${def.binary ? '' : `${t.progress}/${tgt}`}</span>`}
    </div>`;
  }).join('');
  const chest = q.chest && !q.chestClaimed;
  return `<div class="h-sec">Haftalık görevler <span>${done}/${q.list.length} tamam</span></div>
    <div class="card quests" data-tut="quests">
      ${rows}
      <div class="qchest ${chest ? 'ready' : q.chestClaimed ? 'opened' : ''}">
        <span class="qchest-ic">${chestSVG(chest, q.chestClaimed)}</span>
        <div class="grow"><b>Haftanın sandığı</b><span class="muted small">${q.chestClaimed ? 'Açıldı! Gelecek hafta yenisi.' : 'Üç görevi de bitir: kozmetik ürün kazan.'}</span></div>
        ${chest ? '<button class="btn primary sm" data-chest>Aç</button>' : ''}
      </div>
      ${q.carried ? `<p class="muted small" style="margin:6px 0 0">Geçen haftanın alınmayan ödülü (${money(q.carried)}) kasana geçti.</p>` : ''}
    </div>`;
}

/** Piksel sandık */
function chestSVG(ready, opened) {
  const lid = opened ? '<rect x="3" y="2" width="18" height="5" fill="#8a5a2b" transform="rotate(-18 3 7)"/>' : '<rect x="3" y="6" width="18" height="5" fill="#8a5a2b"/><rect x="3" y="6" width="18" height="1" fill="#b07a42"/>';
  return `<svg viewBox="0 0 24 24" width="34" height="34" shape-rendering="crispEdges" aria-hidden="true">
    ${ready ? '<rect x="1" y="3" width="22" height="20" fill="rgba(255,207,61,.22)"/>' : ''}
    <rect x="3" y="11" width="18" height="10" fill="#6b4220"/><rect x="3" y="11" width="18" height="1" fill="#8a5a2b"/>
    ${lid}<rect x="11" y="${opened ? 11 : 9}" width="2" height="4" fill="#ffcf3d"/>
    <rect x="3" y="15" width="18" height="1" fill="#4a2c14"/>${opened ? '<rect x="7" y="9" width="2" height="2" fill="#c6ff3d"/><rect x="14" y="8" width="2" height="2" fill="#38bdf8"/>' : ''}</svg>`;
}

/** Ana ekran tıklamaları: true dönerse ekran yenilenmeli */
export async function questsClick(app, e) {
  const s = app.state;
  const c = e.target.closest('[data-claim]');
  if (c) {
    const r = claimQuest(s, Number(c.dataset.claim));
    if (!r.ok) return false;
    app.save();
    sfx('coin');
    buzz([10, 30, 10]);
    toast(`Görev ödülü: ${money(r.money)}${r.fame ? ` · Ün +${r.fame}` : ''}`, 'good');
    return true;
  }
  if (e.target.closest('[data-chest]')) {
    const r = openChest(s);
    if (!r.ok) return false;
    app.save();
    sfx('levelup');
    buzz([20, 40, 20, 40]);
    const it = r.cosmetic ? COSMETIC_BY_ID[r.cosmetic] : null;
    await sheet({
      center: true,
      html: `<div class="center" style="margin-bottom:6px">${chestSVG(false, true).replace('width="34" height="34"', 'width="86" height="86"')}</div>
        <h3 class="center">Haftanın sandığı açıldı!</h3>
        <p class="lead center">${it ? `<b>${esc(it.name)}</b> (${esc(COSMETIC_SLOTS.find((x) => x.id === it.slot)?.name || '')}) artık dolabında. Mağaza → Dolap'tan giyebilirsin.` : `Kasana <b>${money(r.money)}</b> eklendi.`}</p>
        <button class="btn primary block" style="margin-top:12px" data-close>Harika</button>`,
    });
    return true;
  }
  return false;
}
