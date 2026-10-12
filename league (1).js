import { CLUB_BY_ID, LEAGUES, SEASON_WEEKS } from '../../core/data.js';
import { leagueOf, sortedTable } from '../../core/league.js';
import { crestSVG } from '../art.js';
import { esc } from '../dom.js';

export function leagueScreen(app, params = {}) {
  const s = app.state;
  const myLeague = leagueOf(s.career.clubId);
  const view = (app.leagueView ||= { tab: 'table', league: myLeague });
  if (params.reset) view.league = myLeague;
  const lg = s.world.leagues[view.league];
  const rows = sortedTable(lg);

  const table = `
    <table class="table">
      <thead><tr><th>#</th><th>Takım</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AV</th><th>P</th></tr></thead>
      <tbody>${rows.map((r, i) => {
        const c = CLUB_BY_ID[r.id];
        return `<tr class="${r.id === s.career.clubId ? 'me' : ''} ${i === 0 ? 'top' : ''}">
          <td class="pos">${i + 1}</td>
          <td><div class="team-cell">${crestSVG(c, 'crest sm')}<span>${c.short}</span><span class="form-dots">${r.last.map((x) => `<i class="${x}"></i>`).join('')}</span></div></td>
          <td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td class="pts">${r.pts}</td></tr>`;
      }).join('')}</tbody>
    </table>`;

  const myLg = s.world.leagues[myLeague];
  const fixtures = myLg.fixtures.map((round, i) => {
    const m = round.find(([h, a]) => h === s.career.clubId || a === s.career.clubId);
    if (!m) return '';
    const [h, a] = m;
    const res = myLg.results[i]?.find((r) => r.h === h && r.a === a);
    const isHome = h === s.career.clubId;
    const opp = CLUB_BY_ID[isHome ? a : h];
    let badge = `<span class="chip">H${i + 1}</span>`;
    if (res) {
      const my = isHome ? res.hg : res.ag;
      const op = isHome ? res.ag : res.hg;
      const tone = my > op ? 'good' : my < op ? 'bad' : '';
      badge = `<span class="chip ${tone}">${my}-${op}</span>`;
    } else if (i + 1 === s.calendar.week) badge = '<span class="chip accent">Sıradaki</span>';
    return `<div class="li"><span class="muted small" style="width:28px">H${i + 1}</span>${crestSVG(opp, 'crest sm')}<div class="grow ellipsis"><b>${esc(opp.name)}</b> <span class="muted small">${isHome ? '(İ)' : '(D)'}</span></div>${badge}</div>`;
  }).join('');

  const lastWeek = s.calendar.week - 1 > 0 ? s.calendar.week - 1 : null;
  const lastResults = lastWeek ? (lg.results[lastWeek - 1] || []).map((r) => `<div class="li"><div class="grow small ellipsis" style="text-align:right">${CLUB_BY_ID[r.h].name}</div><b class="tnum" style="min-width:44px;text-align:center">${r.hg} - ${r.ag}</b><div class="grow small ellipsis">${CLUB_BY_ID[r.a].name}</div></div>`).join('') : '';

  return {
    tabs: 'league',
    html: `
      <h1 class="h-title">Lig</h1>
      <p class="muted small" style="margin:4px 0 12px">Sezon ${s.calendar.season} · Hafta ${Math.min(s.calendar.week, SEASON_WEEKS)}/${SEASON_WEEKS}</p>
      <div class="seg" style="margin-bottom:10px">
        ${Object.values(LEAGUES).map((l) => `<button class="${view.league === l.id ? 'on' : ''}" data-lg="${l.id}">${l.name}</button>`).join('')}
      </div>
      <div class="seg">
        <button class="${view.tab === 'table' ? 'on' : ''}" data-tab="table">Puan Durumu</button>
        <button class="${view.tab === 'fix' ? 'on' : ''}" data-tab="fix">Fikstürüm</button>
      </div>
      <div class="card" style="margin-top:12px;padding:8px 10px">${view.tab === 'table' ? table : `<div class="list">${fixtures}</div>`}</div>
      ${view.tab === 'table' && lastResults ? `<div class="h-sec">Hafta ${lastWeek} sonuçları</div><div class="card list" style="padding:4px 12px">${lastResults}</div>` : ''}
      <p class="muted small" style="margin-top:12px">Lider sezon sonunda şampiyon olur ve şampiyonluk primi alır.</p>`,
    mount(el) {
      el.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        app.click();
        if (t.dataset.lg) view.league = t.dataset.lg;
        if (t.dataset.tab) view.tab = t.dataset.tab;
        app.go('league');
      });
    },
  };
}
