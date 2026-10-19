import { ACTIONS, CLUB_BY_ID, MAX_TRAININGS_PER_WEEK, SEASON_WEEKS } from '../../core/data.js';
import { canDoAction, overview } from '../../core/game.js';
import { fixtureFor, leagueLabel } from '../../core/league.js';
import { money } from '../../core/economy.js';
import { crestSVG, icon, playerAvatar } from '../art.js';
import { animateBars, esc } from '../dom.js';
import { energyColor, meter, moraleColor, ratingColor } from '../components.js';
import { RELATIONS } from '../../core/chirp/index.js';
import { shareCard, shareFlow } from '../chirpView.js';
import { bigMatchChip, hubMentorCard, meetingFlow, requestsSheet, selectionSheet } from '../mentorView.js';
import { actionArt } from '../spriteMap.js';
import { monthName, weatherFor } from '../../core/weather.js';
import { hubLockerCard } from '../lockerView.js';
import { ROUND_LABEL } from '../../core/cup.js';
import { portfolioValue } from '../../core/invest.js';


export function hubScreen(app) {
  const s = app.state;
  const { player, career, calendar, flags } = s;
  const ov = overview(s);
  const fx = fixtureFor(s.world, career.clubId, calendar.week);
  const [h, a] = fx || [career.clubId, career.clubId];
  const home = CLUB_BY_ID[h];
  const away = CLUB_BY_ID[a];
  const isHome = h === career.clubId;
  const wx = fx ? weatherFor({ season: calendar.season, week: calendar.week, homeId: h }) : null;
  const slots = Array.from({ length: 4 }, (_, i) => `<i class="${i < calendar.slots ? 'on' : ''}"></i>`).join('');

  const actionTiles = ACTIONS.map((act) => {
    const c = canDoAction(s, act.id);
    let sub = act.cost;
    if (act.id === 'train') sub = `${calendar.trainings}/${MAX_TRAININGS_PER_WEEK} · −18 enerji`;
    return `<button class="action ${c.ok ? '' : 'off'}" data-action="${act.id}" title="${esc(c.reason || act.desc)}">
      <span class="ic spr-ic">${actionArt(act.id, act.icon)}</span><b>${act.name}</b><span>${sub}</span></button>`;
  }).join('');

  const status = flags.injuredWeeks > 0
    ? `<span class="chip bad">${icon('bandage')} Sakat · ${flags.injuredWeeks} hf</span>`
    : flags.suspendedWeeks > 0 ? `<span class="chip bad">${icon('shield')} Cezalı · ${flags.suspendedWeeks} maç</span>`
    : player.energy < 30 ? `<span class="chip warn">${icon('bolt')} Yorgun</span>` : '';

  // Başlangıç yolu durumları: kiralık / altyapı / ilk 11 garantisi
  const startChips = [
    career.loan && calendar.season <= career.loan.untilSeason ? `<span class="chip warn">${icon('swap', 'ico sm')} Kiralık · ${esc(CLUB_BY_ID[career.loan.parentId].short)}</span>` : '',
    career.academy && calendar.season <= career.academy.untilSeason ? `<span class="chip accent">${icon('star', 'ico sm')} Altyapı · U-17</span>` : '',
    career.guarantee && calendar.season <= career.guarantee.untilSeason ? `<span class="chip good">${icon('check', 'ico sm')} İlk 11 garantisi</span>` : '',
    s.adapt && s.adapt.pct < 100 ? `<span class="chip" title="Yeni kulübüne uyum: etkin yeteneği hafifçe etkiler">${icon('users', 'ico sm')} Uyum %${s.adapt.pct}</span>` : '',
    s.market?.interest?.length ? `<span class="chip accent" title="Transfer söylentileri">${icon('eye', 'ico sm')} ${s.market.interest.length} kulüp izliyor</span>` : '',
    s.board?.crisis ? `<span class="chip bad">${icon('coin', 'ico sm')} Kulüpte mali kriz</span>` : '',
  ].join('');

  const cupTie = calendar.phase === 'week' ? s.pending.cupTie : null;
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

      ${startChips ? `<div class="chips" style="margin-top:10px">${startChips}</div>` : ''}
      ${shareCard(s)}

      <div class="row between" style="margin-top:14px">
        <div class="row" style="gap:6px;min-width:0">
          <span class="money-pill">${icon('coin')} <span class="tnum">${money(career.money)}</span></span>
          <button class="money-pill inv-pill" data-act="invest" data-tut="invest">${icon('chart')} <span class="tnum">${(() => { const pv = portfolioValue(s); return pv > 0 ? money(pv) : 'Yatırım'; })()}</span></button>
        </div>
        <div class="row" style="gap:6px">${status}<button class="icon-btn" data-act="settings" aria-label="Ayarlar">${icon('gear')}</button></div>
      </div>

      <div class="card" data-tut="meters" style="margin-top:12px;display:grid;gap:12px">
        ${meter('Enerji', 'bolt', player.energy, 100, energyColor(player.energy))}
        ${meter('Moral', 'smile', player.morale, 100, moraleColor(player.morale))}
        ${meter('Form', 'chart', (ov.form - 3) * 14.3, 100, ratingColor(ov.form), ov.form.toFixed(1).replace('.', ','))}
      </div>

      ${cupTie ? `<div class="h-sec">Hafta içi kupa maçı <span>${esc(cupTie.kind === 'super' ? 'Süper Kupa' : ROUND_LABEL[cupTie.round] || '')}</span></div>
      <div class="card glow cup-next">
        <div class="fixture">
          <div class="team">${crestSVG(CLUB_BY_ID[cupTie.h])}<span>${esc(CLUB_BY_ID[cupTie.h].name)}</span></div>
          <div class="col" style="align-items:center;gap:6px"><span class="vs">VS</span><span class="chip gold">${icon('trophy', 'ico xs')} Kupa</span></div>
          <div class="team">${crestSVG(CLUB_BY_ID[cupTie.a])}<span>${esc(CLUB_BY_ID[cupTie.a].name)}</span></div>
        </div>
        <p class="muted small center" style="margin:10px 0 0">${esc(cupTie.name)} · tek maç eleme, berabere biterse penaltılar. Lig maçından önce oynanır.</p>
        <button class="btn primary block" style="margin-top:10px" data-act="cup">${icon('whistle')} Kupa Maçına Çık</button>
      </div>` : ''}

      <div class="h-sec">${cupTie ? 'Hafta sonu lig maçı' : 'Sıradaki maç'} <span>${monthName(calendar.week)} · Hafta ${calendar.week}/${SEASON_WEEKS}</span></div>
      <div class="card glow" data-tut="fixture">
        <div class="fixture">
          <div class="team">${crestSVG(home)}<span>${esc(home.name)}</span></div>
          <div class="col" style="align-items:center;gap:6px"><span class="vs">VS</span><span class="chip">${isHome ? 'İç saha' : 'Deplasman'}</span></div>
          <div class="team">${crestSVG(away)}<span>${esc(away.name)}</span></div>
        </div>
        <div class="row between small muted" style="margin-top:12px">
          <span>${esc(leagueLabel(ov.league.id))} · ${calendar.week === 1 ? 'Sezon başlıyor' : `${ov.position}. sıradasınız`}</span>
          <span>Kulüp gücü ${ov.clubRating}</span>
        </div>
        ${wx ? `<div class="row small muted wx-fore" title="${esc(wx.note)}"><span>${wx.emoji}</span><span>Hava tahmini: <b>${esc(wx.name)}</b> · ${wx.temp}°C${wx.windKmh >= 12 ? ` · rüzgâr ${wx.windKmh} km/sa` : ''}</span></div>` : ''}
        ${bigMatchChip(s) ? `<div class="chips" style="margin-top:10px;justify-content:center">${bigMatchChip(s)}</div>` : ''}
      </div>

      <div class="h-sec">Bu hafta <span class="slots">${slots}</span></div>
      <div class="actions">${actionTiles}</div>
      ${hubMentorCard(s)}
      ${hubLockerCard(s)}
      <button class="btn primary lg block ${calendar.slots === 0 ? 'pulse' : ''}" style="margin-top:12px" data-act="match">${icon('whistle')} ${cupTie ? 'Önce Kupa Maçı' : 'Maç Gününe Geç'}</button>

      <div class="h-sec">İlişkiler</div>
      <div class="card" style="display:grid;gap:12px">
        ${Object.values(RELATIONS).map((r) => meter(r.label, r.icon, player.rel[r.field], 100, r.color)).join('')}
        ${meter('Ün', 'star', player.fame, 100, '#c084fc')}
        ${meter('Kulüp Nüfuzu', 'flag', player.influence ?? 0, 100, 'var(--gold)')}
        <p class="muted small" style="margin:0">Sponsor reklam kazancını, Federasyon ceza riskini, Yönetim sözleşme yenilemeyi etkiler.</p>
      </div>

      ${news ? `<div class="h-sec">Haberler</div><div class="card list">${news}</div>` : ''}`,
    mount(el) {
      animateBars(el);
      el.addEventListener('click', async (e) => {
        const st = e.target.closest('[data-chirp-style]');
        if (st) {
          app.click();
          const r = await shareFlow(app, st.dataset.chirpStyle);
          app.go(r === 'chirp' ? 'chirp' : 'hub');
          return;
        }
        if (e.target.closest('[data-chirp-dismiss]')) {
          app.state.chirp.pendingPost = null;
          app.save();
          app.go('hub');
          return;
        }
        const mt = e.target.closest('[data-meet],[data-go-mentor],[data-open-selection],[data-open-requests]');
        if (mt) {
          app.click();
          if (mt.dataset.meet) {
            // Uygun değilse meetingFlow nedenini gösterir (enerji, haftalık sınır…)
            if (await meetingFlow(app, mt.dataset.meet)) app.go('hub');
          } else if (mt.hasAttribute('data-open-selection')) {
            await selectionSheet(app);
            app.go('hub');
          } else if (mt.hasAttribute('data-open-requests')) {
            await requestsSheet(app);
            app.go('hub');
          } else app.go('mentor');
          return;
        }
        const t = e.target.closest('[data-action],[data-act]');
        if (!t) return;
        app.click();
        if (t.dataset.action) app.runAction(t.dataset.action);
        else if (t.dataset.act === 'match' || t.dataset.act === 'cup') app.matchDay();
        else if (t.dataset.act === 'settings') app.go('settings');
        else if (t.dataset.act === 'locker') app.go('locker');
        else if (t.dataset.act === 'invest') app.go('invest', { from: 'hub' });
      });
    },
  };
}

