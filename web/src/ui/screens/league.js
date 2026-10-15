// LİG EKRANI — 28 ülke × 3 lig (Türkiye 4): puan durumu, fikstürüm, haftanın sonuçları; Avrupa kupaları.
import { cupSection } from '../cupView.js';
import { CLUB_BY_ID, COUNTRIES, COUNTRY_BY_ID, LEAGUES, SEASON_WEEKS } from '../../core/data.js';
import { EURO_SLOTS } from '../../core/world/countries.js';
import { fixturesOf, leagueOf, sortedTable, weekResults } from '../../core/league.js';
import { crestSVG } from '../art.js';
import { esc } from '../dom.js';
import { europeSection } from '../europeView.js';
import { clubRanking } from '../../core/world/ranking.js';

/** Kulüp sıralaması bölümü: dünya / Avrupa / kendi ülken */
function rankingSection(app, view) {
  const s = app.state;
  const all = clubRanking(s);
  const scope = view.rankScope || 'world';
  const myCountry = CLUB_BY_ID[s.career.clubId]?.country || 'tr';
  const list = all.filter((x) => scope === 'world' || (scope === 'europe' ? COUNTRY_BY_ID[CLUB_BY_ID[x.id]?.country]?.euro : CLUB_BY_ID[x.id]?.country === myCountry));
  const top = list.slice(0, 50);
  const mine = list.findIndex((x) => x.id === s.career.clubId);
  const row = (x, i) => {
    const c = CLUB_BY_ID[x.id];
    const lg = LEAGUES[c.league] || {};
    const ch = x.change > 0 ? `<span class="rk-up">▲${x.change}</span>` : x.change < 0 ? `<span class="rk-down">▼${-x.change}</span>` : '<span class="muted">–</span>';
    return `<div class="li rk ${x.id === s.career.clubId ? 'me' : ''}"><b class="rk-pos tnum">${i + 1}</b>${crestSVG(c, 'crest sm')}<div class="grow" style="min-width:0"><b class="ellipsis" style="display:block">${esc(c.name)}</b><span class="muted small ellipsis">${COUNTRY_BY_ID[c.country]?.flag || ''} ${esc(lg.name || '')}</span></div><span class="small" style="width:34px;text-align:right">${ch}</span><b class="tnum" style="width:52px;text-align:right">${x.pts.toFixed(1)}</b></div>`;
  };
  return `
    <div class="seg" style="margin-bottom:10px">
      <button class="${scope === 'world' ? 'on' : ''}" data-rscope="world">Dünya</button>
      <button class="${scope === 'europe' ? 'on' : ''}" data-rscope="europe">Avrupa</button>
      <button class="${scope === 'country' ? 'on' : ''}" data-rscope="country">${COUNTRY_BY_ID[myCountry]?.flag || ''} Ülkem</button>
    </div>
    ${mine >= 0 ? `<div class="card list rk-mine">${row(list[mine], mine)}</div>` : ''}
    <div class="card list" style="padding:4px 12px;margin-top:10px">${top.map(row).join('')}</div>
    <p class="muted small" style="margin-top:10px">Puan: lig sıralaması × lig prestiji, şampiyonluk ve Avrupa kupalarındaki galibiyetler ve turlar. Eski sezonların puanı her yıl azalır.</p>`;
}

/** Ülkenin ligleri (kademe sırasıyla) */
const leaguesOf = (country) => Object.values(LEAGUES).filter((l) => l.country === country).sort((a, b) => (a.level || a.tier) - (b.level || b.tier));

/** Tablo bölgeleri: yükselme / düşme / Avrupa */
function zoneOf(lg, i, n) {
  const list = leaguesOf(lg.country).filter((l) => !l.youth);
  const idx = list.findIndex((l) => l.id === lg.id);
  if (lg.youth) return '';
  if (idx > 0 && i < 2) return 'up';
  if (idx > 0 && i < 6) return 'po';
  if (idx >= 0 && idx < list.length - 1 && i >= n - 3) return 'down';
  if (lg.tier === 1 && COUNTRY_BY_ID[lg.country]?.euro) {
    const cl = EURO_SLOTS.cl[lg.country] || 0;
    const el = EURO_SLOTS.el[lg.country] || 0;
    const ecl = EURO_SLOTS.ecl[lg.country] || 0;
    if (i < cl) return 'cl';
    if (i < cl + el) return 'el';
    if (i < cl + el + ecl) return 'ecl';
  }
  return '';
}

export function leagueScreen(app, params = {}) {
  const s = app.state;
  const myLeague = leagueOf(s.career.clubId);
  const myCountry = LEAGUES[myLeague]?.country || 'tr';
  const view = (app.leagueView ||= { tab: 'table', league: myLeague, country: myCountry });
  if (params.reset) Object.assign(view, { league: myLeague, country: myCountry, tab: view.tab === 'europe' ? 'europe' : 'table' });
  if (!LEAGUES[view.league] || !s.world.leagues[view.league]) view.league = myLeague;
  const lg = s.world.leagues[view.league];
  const meta = LEAGUES[view.league];
  view.country = meta.country;
  const rows = sortedTable(lg);

  const table = `
    <table class="table">
      <thead><tr><th>#</th><th>Takım</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AV</th><th>P</th></tr></thead>
      <tbody>${rows.map((r, i) => {
        const c = CLUB_BY_ID[r.id];
        const z = zoneOf(meta, i, rows.length);
        return `<tr class="${r.id === s.career.clubId ? 'me' : ''} ${i === 0 ? 'top' : ''} ${z ? `z-${z}` : ''}">
          <td class="pos">${i + 1}</td>
          <td><div class="team-cell">${crestSVG(c, 'crest sm')}<span class="ellipsis">${esc(c.short)}</span><span class="form-dots">${r.last.map((x) => `<i class="${x}"></i>`).join('')}</span></div></td>
          <td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td class="pts">${r.pts}</td></tr>`;
      }).join('')}</tbody>
    </table>
    <div class="zones">${zoneLegend(meta)}</div>`;

  const myLg = s.world.leagues[myLeague];
  const fixtures = fixturesOf(myLg).map((round, i) => {
    const m = round.find(([h, a]) => h === s.career.clubId || a === s.career.clubId);
    if (!m) return '';
    const [h, a] = m;
    const res = weekResults(s.world, myLeague, i + 1).find((r) => r.h === h && r.a === a);
    const isHome = h === s.career.clubId;
    const opp = CLUB_BY_ID[isHome ? a : h];
    let badge = `<span class="chip">H${i + 1}</span>`;
    if (res) {
      const my = isHome ? res.hg : res.ag;
      const op = isHome ? res.ag : res.hg;
      const tone = my > op ? 'good' : my < op ? 'bad' : '';
      badge = `<span class="chip ${tone}">${my}-${op}</span>`;
    } else if (i + 1 === s.calendar.week) badge = '<span class="chip accent">Sıradaki</span>';
    else if (i + 1 < s.calendar.week) badge = '<span class="chip">–</span>';
    return `<div class="li"><span class="muted small" style="width:28px">H${i + 1}</span>${crestSVG(opp, 'crest sm')}<div class="grow ellipsis"><b>${esc(opp.name)}</b> <span class="muted small">${isHome ? '(İ)' : '(D)'}</span></div>${badge}</div>`;
  }).join('');

  const lastWeek = s.calendar.week - 1 > 0 ? s.calendar.week - 1 : null;
  const lastResults = lastWeek ? weekResults(s.world, view.league, lastWeek).map((r) => `<div class="li res"><div class="grow small ellipsis" style="text-align:right">${esc(CLUB_BY_ID[r.h].name)}</div>${crestSVG(CLUB_BY_ID[r.h], 'crest xs')}<b class="tnum">${r.hg} - ${r.ag}</b>${crestSVG(CLUB_BY_ID[r.a], 'crest xs')}<div class="grow small ellipsis">${esc(CLUB_BY_ID[r.a].name)}</div></div>`).join('') : '';

  // Ülke seçici: kendi ülken önce, sonra diğerleri
  const countries = [COUNTRY_BY_ID[myCountry], ...COUNTRIES.filter((c) => c.id !== myCountry)];
  const isMine = view.league === myLeague;

  return {
    tabs: 'league',
    html: `
      <h1 class="h-title">Lig</h1>
      <p class="muted small" style="margin:4px 0 12px">Sezon ${s.calendar.season} · Hafta ${Math.min(s.calendar.week, SEASON_WEEKS)}/${SEASON_WEEKS}</p>
      <div class="seg" style="margin-bottom:10px">
        <button class="${view.tab !== 'europe' && view.tab !== 'rank' && view.tab !== 'cup' ? 'on' : ''}" data-mode="leagues">🌍 Lig</button>
        <button class="${view.tab === 'cup' ? 'on' : ''}" data-mode="cup">🥇 Kupa</button>
        <button class="${view.tab === 'europe' ? 'on' : ''}" data-mode="europe">🏆 Avrupa</button>
        <button class="${view.tab === 'rank' ? 'on' : ''}" data-mode="rank">📊 Sıra</button>
      </div>
      ${view.tab === 'rank' ? rankingSection(app, view) : view.tab === 'cup' ? cupSection(s) : view.tab === 'europe' ? europeSection(app) : `
      <div class="country-row" data-countries>${countries.map((c) => `<button class="country ${c.id === view.country ? 'on' : ''}" data-country="${c.id}"><span class="flag">${c.flag}</span><span>${esc(c.name)}</span></button>`).join('')}</div>
      <div class="seg wrap" style="margin:10px 0">
        ${leaguesOf(view.country).filter((l) => !l.youth || myLeague === l.id).map((l) => `<button class="${view.league === l.id ? 'on' : ''}" data-lg="${l.id}">${esc(l.name)}</button>`).join('')}
      </div>
      <div class="seg">
        <button class="${view.tab === 'table' ? 'on' : ''}" data-tab="table">Puan Durumu</button>
        <button class="${view.tab === 'fix' ? 'on' : ''}" data-tab="fix">Fikstürüm</button>
      </div>
      ${view.tab === 'fix' ? `<div class="card" style="margin-top:12px;padding:8px 10px"><div class="muted small" style="margin:4px 2px 6px">${esc(CLUB_BY_ID[s.career.clubId].name)} · ${esc(LEAGUES[myLeague].name)}</div><div class="list">${fixtures}</div></div>`
        : `<div class="card" style="margin-top:12px;padding:8px 10px">${!isMine ? `<div class="muted small" style="margin:4px 2px 6px">${COUNTRY_BY_ID[meta.country].flag} ${esc(COUNTRY_BY_ID[meta.country].name)} · ${esc(meta.name)}</div>` : ''}${table}</div>
      ${lastResults ? `<div class="h-sec">Hafta ${lastWeek} sonuçları</div><div class="card list" style="padding:4px 12px">${lastResults}</div>` : ''}`}
      <p class="muted small" style="margin-top:12px">Lider sezon sonunda şampiyon olur. Her ligden son 3 takım düşer; alt ligin ilk 2'si doğrudan yükselir, 3–6. sıralar play-off oynar. Avrupa kupalarına yalnız 1. liglerin üst sıraları katılır.</p>`}`,
    mount(el) {
      el.querySelector('.country.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.europe !== undefined) return; // Avrupa bölümü kendi tıklamalarını yönetir
        app.click();
        if (t.dataset.mode) view.tab = ['europe', 'rank', 'cup'].includes(t.dataset.mode) ? t.dataset.mode : 'table';
        if (t.dataset.rscope) view.rankScope = t.dataset.rscope;
        if (t.dataset.country) {
          view.country = t.dataset.country;
          view.league = leaguesOf(t.dataset.country).find((l) => !l.youth).id;
        }
        if (t.dataset.lg) view.league = t.dataset.lg;
        if (t.dataset.tab) view.tab = t.dataset.tab;
        if (t.dataset.cup) view.cup = t.dataset.cup;
        app.go('league');
      });
    },
  };
}

function zoneLegend(meta) {
  const items = [];
  const list = leaguesOf(meta.country).filter((l) => !l.youth);
  const idx = list.findIndex((l) => l.id === meta.id);
  if (meta.tier === 1 && COUNTRY_BY_ID[meta.country]?.euro) items.push('<span><i class="z-cl"></i>Şampiyonlar Ligi</span><span><i class="z-el"></i>Avrupa Ligi</span><span><i class="z-ecl"></i>Konferans Ligi</span>');
  if (idx > 0) items.push('<span><i class="z-up"></i>Yükselme</span><span><i class="z-po"></i>Play-off (1 bilet)</span>');
  if (meta.tier > 1) items.push('<span class="muted">Avrupa kupalarına yalnız 1. lig takımları katılır</span>');
  if (idx >= 0 && idx < list.length - 1) items.push('<span><i class="z-down"></i>Düşme</span>');
  return items.join('');
}
