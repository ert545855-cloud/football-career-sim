import { CLUB_BY_ID, LEAGUES } from '../../core/data.js';
import { ovr } from '../../core/player.js';
import { crestSVG, icon } from '../art.js';
import { esc } from '../dom.js';

export function careerScreen(app) {
  const s = app.state;
  const c = s.career;
  const se = c.season;
  const avg = se.apps ? (se.ratingSum / se.apps).toFixed(1).replace('.', ',') : '–';
  const tot = c.totals;
  const awards = c.awards.slice().reverse().map((a) => `<div class="award"><span class="tro">${icon(a.icon || 'trophy', 'tro')}</span><div class="grow"><b>${esc(a.title)}</b><div class="muted small">Sezon ${a.season}</div></div></div>`).join('');
  const history = c.history.slice().reverse().map((h) => `<tr>
      <td class="pos">S${h.season}</td>
      <td><div class="team-cell">${crestSVG(CLUB_BY_ID[h.clubId], 'crest sm')}<span>${CLUB_BY_ID[h.clubId].short}</span></div></td>
      <td>${h.apps}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg ? h.avg.toFixed(1) : '–'}</td><td>${h.position}.</td><td class="pts">${h.ovr}</td></tr>`).join('');
  const news = c.news.slice(0, 15).map((n) => `<div class="li"><span class="news-dot ${n.kind}"></span><div class="grow small">${esc(n.text)}</div><span class="muted small">S${n.s}·H${n.w}</span></div>`).join('');

  return {
    tabs: 'career',
    html: `
      <h1 class="h-title">Kariyer</h1>
      <p class="muted small" style="margin:4px 0 0">${s.player.age} yaş · ${c.moves || 0} transfer · ${c.caps || 0} milli maç · OVR ${ovr(s.player)}</p>

      <div class="h-sec">Bu sezon</div>
      <div class="kpis">
        <div class="kpi"><b>${se.apps}</b><span>Maç</span></div>
        <div class="kpi"><b>${se.goals}</b><span>Gol</span></div>
        <div class="kpi"><b>${se.assists}</b><span>Asist</span></div>
        <div class="kpi"><b>${avg}</b><span>Ort. not</span></div>
      </div>
      <div class="chips" style="margin-top:8px"><span class="chip">${se.starts} kez ilk 11</span><span class="chip gold">${se.motm} maçın oyuncusu</span></div>

      <div class="h-sec">Kariyer toplamı</div>
      <div class="kpis">
        <div class="kpi"><b>${tot.apps + se.apps}</b><span>Maç</span></div>
        <div class="kpi"><b>${tot.goals + se.goals}</b><span>Gol</span></div>
        <div class="kpi"><b>${tot.assists + se.assists}</b><span>Asist</span></div>
        <div class="kpi"><b>${c.awards.length}</b><span>Ödül</span></div>
      </div>

      <div class="h-sec">Kupalar ve ödüller</div>
      ${awards || '<div class="card muted small">Henüz ödülün yok. İlk kupa için çalışmaya devam!</div>'}

      ${history ? `<div class="h-sec">Sezonlar</div><div class="card" style="padding:8px 10px"><table class="table"><thead><tr><th>#</th><th>Kulüp</th><th>M</th><th>G</th><th>A</th><th>Not</th><th>Sıra</th><th>OVR</th></tr></thead><tbody>${history}</tbody></table></div>` : ''}

      <div class="h-sec">Haber akışı</div>
      <div class="card list">${news || '<span class="muted small">Henüz haber yok.</span>'}</div>
      <p class="muted small center" style="margin-top:14px">${LEAGUES.super.name} hedefin. Sonra efsane ol.</p>`,
    mount() {},
  };
}
