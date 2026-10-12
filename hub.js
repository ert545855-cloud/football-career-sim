import { ACTIONS, CLUB_BY_ID, MAX_TRAININGS_PER_WEEK, SEASON_WEEKS } from '../../core/data.js';
import { canDoAction, overview } from '../../core/game.js';
import { fixtureFor } from '../../core/league.js';
import { money } from '../../core/economy.js';
import { crestSVG, icon, playerAvatar } from '../art.js';
import { animateBars, esc } from '../dom.js';
import { energyColor, meter, moraleColor, ratingColor } from '../components.js';

export function hubScreen(app) {
  const s = app.state;
  const { player, career, calendar, flags } = s;
  const ov = overview(s);
  const fx = fixtureFor(s.world, career.clubId, calendar.week);
  const [h, a] = fx || [career.clubId, career.clubId];
  const home = CLUB_BY_ID[h];
  const away = CLUB_BY_ID[a];
  const isHome = h === career.clubId;
  const slots = Array.from({ length: 4 }, (_, i) => `<i class="${i < calendar.slots ? 'on' : ''}"></i>`).join('');

  const actionTiles = ACTIONS.map((act) => {
    const c = canDoAction(s, act.id);
    let sub = act.cost;
    if (act.id === 'train') sub = `${calendar.trainings}/${MAX_TRAININGS_PER_WEEK} · −18 enerji`;
    return `<button class="action ${c.ok ? '' : 'off'}" data-action="${act.id}" title="${esc(c.reason || act.desc)}">
      <span class="ic">${icon(act.icon)}</span><b>${act.name}</b><span>${sub}</span></button>`;
  }).join('');

  const status = flags.injuredWeeks > 0
    ? `<span class="chip bad">${icon('bandage')} Sakat · ${flags.injuredWeeks} hf</span>`
    : player.energy < 30 ? `<span class="chip warn">${icon('bolt')} Yorgun</span>` : '';

  const news = career.news.slice(0, 3).map((n) => `<div class="li"><span class="news-dot ${n.kind}"></span><div class="grow small">${esc(n.text)}</div><span class="muted small">H${n.w}</span></div>`).join('');

  return {
    tabs: 'home',
    html: `
      <div class="topbar">
        <div class="avatar-ring">${playerAvatar(s)}</div>
        <div class="who">
          <div class="name ellipsis">${esc(player.name)}</div>
          <div class="sub">${crestSVG(ov.club, 'crest sm')} <span class="ellipsis">${esc(ov.club.name)}</span> · ${player.age} yaş</div>
        </div>
        <div class="ovr-badge">${ov.ovr}<small>OVR</small></div>
      </div>

      <div class="row between" style="margin-top:14px">
        <span class="money-pill">${icon('coin')} <span class="tnum">${money(career.money)}</span></span>
        <div class="row" style="gap:6px">${status}<button class="icon-btn" data-act="settings" aria-label="Ayarlar">${icon('gear')}</button></div>
      </div>

      <div class="card" style="margin-top:12px;display:grid;gap:12px">
        ${meter('Enerji', 'bolt', player.energy, 100, energyColor(player.energy))}
        ${meter('Moral', 'smile', player.morale, 100, moraleColor(player.morale))}
        ${meter('Form', 'chart', (ov.form - 3) * 14.3, 100, ratingColor(ov.form), ov.form.toFixed(1).replace('.', ','))}
      </div>

      <div class="h-sec">Sıradaki maç <span>Sezon ${calendar.season} · Hafta ${calendar.week}/${SEASON_WEEKS}</span></div>
      <div class="card glow">
        <div class="fixture">
          <div class="team">${crestSVG(home)}<span>${esc(home.name)}</span></div>
          <div class="col" style="align-items:center;gap:6px"><span class="vs">VS</span><span class="chip">${isHome ? 'İç saha' : 'Deplasman'}</span></div>
          <div class="team">${crestSVG(away)}<span>${esc(away.name)}</span></div>
        </div>
        <div class="row between small muted" style="margin-top:12px">
          <span>${esc(ov.league.name)} · ${calendar.week === 1 ? 'Sezon başlıyor' : `${ov.position}. sıradasınız`}</span>
          <span>Kulüp gücü ${ov.clubRating}</span>
        </div>
      </div>

      <div class="h-sec">Bu hafta <span class="slots">${slots}</span></div>
      <div class="actions">${actionTiles}</div>
      <button class="btn primary lg block ${calendar.slots === 0 ? 'pulse' : ''}" style="margin-top:12px" data-act="match">${icon('whistle')} Maç Gününe Geç</button>

      <div class="h-sec">İlişkiler</div>
      <div class="card" style="display:grid;gap:12px">
        ${meter('Teknik direktör', 'clipboard', player.rel.manager, 100, 'var(--blue)')}
        ${meter('Takım arkadaşları', 'users', player.rel.teammates, 100, 'var(--good)')}
        ${meter('Taraftar', 'flag', player.rel.fans, 100, 'var(--gold)')}
        ${meter('Ün', 'star', player.fame, 100, '#c084fc')}
      </div>

      ${news ? `<div class="h-sec">Haberler</div><div class="card list">${news}</div>` : ''}`,
    mount(el) {
      animateBars(el);
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-action],[data-act]');
        if (!t) return;
        app.click();
        if (t.dataset.action) app.runAction(t.dataset.action);
        else if (t.dataset.act === 'match') app.matchDay();
        else if (t.dataset.act === 'settings') app.go('settings');
      });
    },
  };
}
