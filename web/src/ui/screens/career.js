import { CLUB_BY_ID, LEAGUES } from '../../core/data.js';
import { awardArt } from '../spriteMap.js';
import { MAX_SCORE, OFFER_KINDS } from '../../core/onboarding/index.js';
import { ovr } from '../../core/player.js';
import { crestSVG, icon } from '../art.js';
import { animateBars, esc } from '../dom.js';
import { achievementsCard } from '../achievementsView.js';
import { currentAgent } from '../../core/agent.js';
import { money } from '../../core/economy.js';
import { agentAvatar } from '../agentView.js';
import { nationalCrest } from '../nationalView.js';
import { ensureNational } from '../../core/national.js';
import { ballonSummary, golden } from '../ballonView.js';
import { archiveHTML, livingWorldHTML } from '../lifeView.js';

export function careerScreen(app) {
  const s = app.state;
  const c = s.career;
  const se = c.season;
  const avg = se.apps ? (se.ratingSum / se.apps).toFixed(1).replace('.', ',') : '–';
  const tot = c.totals;
  const awards = c.awards.slice().reverse().map((a) => `<div class="award">${awardArt(a.icon || 'trophy')}<div class="grow"><b>${esc(a.title)}</b><div class="muted small">Sezon ${a.season}</div></div></div>`).join('');
  const history = c.history.slice().reverse().map((h) => `<tr>
      <td class="pos">S${h.season}</td>
      <td><div class="team-cell">${crestSVG(CLUB_BY_ID[h.clubId], 'crest sm')}<span>${CLUB_BY_ID[h.clubId].short}</span></div></td>
      <td>${h.apps}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg ? h.avg.toFixed(1) : '–'}</td><td>${h.position}.</td><td class="pts">${h.ovr}</td></tr>`).join('');
  // Kariyer başlangıcı: seçme skoru, seçilen yol, forma numarası geçmişi
  const start = c.start
    ? `<div class="h-sec">Kariyer başlangıcı</div>
      <div class="card" style="display:grid;gap:8px">
        <div class="row between"><span class="muted small">Seçme skoru</span><b style="color:var(--gold)">${c.tryout?.score ?? '–'}/${MAX_SCORE}</b></div>
        <div class="row between"><span class="muted small">Yol</span><b class="small">${c.start.kind} · ${esc(OFFER_KINDS[c.start.kind].title)}</b></div>
        <div class="row between"><span class="muted small">İlk kulüp</span><b class="small">${esc(CLUB_BY_ID[c.start.parentId || c.start.clubId]?.name || '')}</b></div>
        ${(c.numberHistory || []).length ? `<div class="chips">${c.numberHistory.map((h) => `<span class="chip">S${h.season} · ${esc(CLUB_BY_ID[h.clubId]?.short || '')} · #${h.number}</span>`).join('')}</div>` : ''}
      </div>`
    : '';
  const news = c.news.slice(0, 15).map((n) => `<div class="li"><span class="news-dot ${n.kind}"></span><div class="grow small">${esc(n.text)}</div><span class="muted small">S${n.s}·H${n.w}</span></div>`).join('');

  return {
    tabs: 'career',
    html: `
      <h1 class="h-title">Kariyer</h1>
      <p class="muted small" style="margin:4px 0 0">${s.player.age} yaş · ${c.moves || 0} transfer · ${c.caps || 0} milli maç · OVR ${ovr(s.player)}</p>

      <div style="margin-top:14px">${achievementsCard(s)}</div>
      <div class="career-links">
        <button class="card cl-tile" data-act="national">${nationalCrest('crest sm', ensureNational(s).current || 'A')}<b>Milli takım</b><span>${(() => { const n = ensureNational(s); return n.caps.A ? `A milli ${n.caps.A}` : n.caps.U21 + n.caps.U19 ? `Genç milli ${n.caps.U21 + n.caps.U19}` : 'Çağrı yok'; })()}</span></button>
        <button class="card cl-tile" data-act="ballon">${golden(34)}<b>Altın Top</b><span>${(() => { const b = ballonSummary(s); return b.rank <= 30 ? `${b.rank}. sıra` : b.best ? `En iyi ${b.best}.` : 'Aday değil'; })()}</span></button>
        <button class="card cl-tile" data-act="agent">${agentAvatar(currentAgent(s), 34)}<b>Menajer</b><span>${esc(currentAgent(s).id === 'self' ? 'Ajansız' : currentAgent(s).name.split(' ')[0])} · ${c.contract.yearsLeft} yıl</span></button>
      </div>

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

      ${start}

      <div class="h-sec">Kupalar ve ödüller</div>
      ${awards || '<div class="card muted small">Henüz ödülün yok. İlk kupa için çalışmaya devam!</div>'}

      ${archiveHTML(s)}

      ${livingWorldHTML(s)}

      ${history ? `<div class="h-sec">Sezonlar</div><div class="card" style="padding:8px 10px"><table class="table"><thead><tr><th>#</th><th>Kulüp</th><th>M</th><th>G</th><th>A</th><th>Not</th><th>Sıra</th><th>OVR</th></tr></thead><tbody>${history}</tbody></table></div>` : ''}

      <div class="h-sec">Haber akışı</div>
      <div class="card list">${news || '<span class="muted small">Henüz haber yok.</span>'}</div>
      <p class="muted small center" style="margin-top:14px">${LEAGUES.super.name} hedefin. Sonra efsane ol.</p>`,
    mount(node) {
      animateBars(node);
      node.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="achievements"]')) {
          app.click();
          app.go('achievements');
        } else if (e.target.closest('[data-act="agent"]')) {
          app.click();
          app.go('agent');
        } else if (e.target.closest('[data-act="national"]')) {
          app.click();
          app.go('national');
        } else if (e.target.closest('[data-act="ballon"]')) {
          app.click();
          app.go('ballon');
        }
      });
    },
  };
}
