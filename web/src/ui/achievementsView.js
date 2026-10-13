// BAŞARIM ARAYÜZÜ — rozet çizimi, açılış bildirimi ve ayrıntı penceresi.
import { ACHIEVEMENTS, CATEGORIES, TIERS, progressOf } from '../core/achievements.js';
import { sprite } from '../assets/sprites.js';
import { FRAMES } from '../assets/sprites.js';
import { buzz, sfx } from '../audio.js';
import { icon } from './art.js';
import { el, esc, root, sheet, sleep } from './dom.js';

/** Madalyon: seviye rengi halka, ortada sprite ya da ikon. Kilitliyse gri + kilit. */
export function badgeHTML(ach, { unlocked = true, size = 56 } = {}) {
  const tier = TIERS[ach.tier];
  const inner = ach.sprite && FRAMES[ach.sprite] ? sprite(ach.sprite, { size: Math.round(size * 0.56) }) : icon(ach.icon, 'ico');
  return `<span class="badge-medal ${unlocked ? '' : 'locked'} t-${ach.tier}" style="--tier:${tier.color};--sz:${size}px">${inner}${unlocked ? '' : `<i class="badge-lock">${icon('lock', 'ico sm')}</i>`}</span>`;
}

let showing = Promise.resolve();

/** Açılan başarımları sırayla, üstten kayan bir şeritle gösterir (oyunu bloklamaz). */
const TIER_RANK = { platinum: 4, gold: 3, silver: 2, bronze: 1 };

export function showAchievementToasts(list) {
  if (!list?.length) return showing;
  // Çok sayıda rozet aynı anda açıldıysa (ör. eski kayıt) en değerli ikisi + toplu özet gösterilir
  let rest = 0;
  if (list.length > 3) {
    const sorted = [...list].sort((x, y) => TIER_RANK[y.tier] - TIER_RANK[x.tier]);
    rest = list.length - 2;
    list = sorted.slice(0, 2);
  }
  showing = showing.then(async () => {
    if (rest) list = [...list, { id: '_more', tier: 'silver', title: `+${rest} başarım daha`, desc: 'Kariyer › Başarımlar ekranından hepsini gör.', icon: 'medal' }];
    for (const ach of list) {
      const tier = TIERS[ach.tier];
      const node = el(`<div class="ach-toast t-${ach.tier}" style="--tier:${tier.color}">
        ${badgeHTML(ach, { size: 44 })}
        <div class="grow"><div class="ach-kicker">BAŞARIM AÇILDI · ${esc(tier.name.toLocaleUpperCase('tr'))}</div><b>${esc(ach.title)}</b><div class="muted small">${esc(ach.desc)}</div></div>
      </div>`);
      root().appendChild(node);
      sfx('levelup');
      buzz(ach.tier === 'platinum' || ach.tier === 'gold' ? [20, 40, 20, 40, 60] : [16, 40, 24]);
      await sleep(2600);
      node.classList.add('out');
      await sleep(260);
      node.remove();
      await sleep(120);
    }
  });
  return showing;
}

/** Ayrıntı penceresi */
export function achievementSheet(state, ach) {
  const p = progressOf(state, ach);
  const tier = TIERS[ach.tier];
  const when = state.achievements?.unlocked?.[ach.id];
  const fmt = (v) => (ach.goal >= 10000 ? `€${Math.round(v).toLocaleString('tr-TR')}` : Math.round(v * 10) / 10);
  return sheet({
    center: true,
    html: `
      <div class="center" style="margin:6px 0 10px">${badgeHTML(ach, { unlocked: p.unlocked, size: 92 })}</div>
      <div class="center"><span class="chip" style="color:${tier.color}">${esc(tier.name)} · ${esc(CATEGORIES[ach.cat])}</span></div>
      <h3 class="center" style="margin-top:8px">${esc(ach.title)}</h3>
      <p class="lead center">${esc(ach.desc)}</p>
      ${p.unlocked
        ? `<div class="center"><span class="chip good">${icon('check', 'ico xs')} Sezon ${when?.s ?? '?'} · Hafta ${when?.w ?? '?'} açıldı</span></div>`
        : `<div class="row between small"><span class="muted">İlerleme</span><b class="tnum">${fmt(p.value)} / ${fmt(p.goal)}</b></div><div class="bar thick" style="margin-top:6px"><i style="--c:${tier.color};width:${Math.round(p.pct * 100)}%"></i></div>`}
      <p class="muted small center" style="margin-top:10px">Ödül: Moral +${tier.morale}${tier.fame ? ` · Ün +${tier.fame}` : ''}</p>
      <button class="btn primary block" style="margin-top:12px" data-close>Tamam</button>`,
  });
}

/** Kariyer ekranındaki özet kartı */
export function achievementsCard(state) {
  const A = state.achievements || { unlocked: {} };
  const unlocked = ACHIEVEMENTS.filter((a) => A.unlocked[a.id]);
  const recent = unlocked
    .map((a) => ({ a, u: A.unlocked[a.id] }))
    .sort((x, y) => y.u.s - x.u.s || y.u.w - x.u.w)
    .slice(0, 5);
  const pct = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);
  return `
    <button class="card ach-card" data-act="achievements">
      <div class="row between"><span class="row" style="gap:8px">${icon('medal', 'ico sm')}<b>Başarımlar</b></span><span class="chip accent">${unlocked.length}/${ACHIEVEMENTS.length}</span></div>
      <div class="bar" style="margin:10px 0"><i style="--c:var(--accent)" data-w="${pct}"></i></div>
      <div class="ach-strip">${recent.length ? recent.map(({ a }) => badgeHTML(a, { size: 40 })).join('') : '<span class="muted small">İlk rozetin için ilk maçına çık!</span>'}</div>
    </button>`;
}
