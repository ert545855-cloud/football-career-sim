// AVRUPA KUPALARI GÖRÜNÜMÜ — lig ekranında: kupa seçici, gruplar, eleme turları, kazanan.
import { CLUB_BY_ID, COUNTRY_BY_ID } from '../core/data.js';
import { CUPS, CUP_IDS, CUP_WEEKS, STAGE_LABEL, cupOf, groupTable } from '../core/world/europe.js';
import { crestSVG, icon } from './art.js';
import { esc } from './dom.js';

const flagOf = (id) => COUNTRY_BY_ID[CLUB_BY_ID[id]?.country]?.flag || '';

function matchRow(m, myId) {
  const H = CLUB_BY_ID[m.h];
  const A = CLUB_BY_ID[m.a];
  const mine = m.h === myId || m.a === myId;
  return `<div class="li res ${mine ? 'mine' : ''}">
    <div class="grow small ellipsis" style="text-align:right">${esc(H.name)} <span class="flag-xs">${flagOf(m.h)}</span></div>${crestSVG(H, 'crest xs')}
    <b class="tnum">${m.hg} - ${m.ag}</b>${crestSVG(A, 'crest xs')}
    <div class="grow small ellipsis"><span class="flag-xs">${flagOf(m.a)}</span> ${esc(A.name)}${m.pen ? ` <span class="muted">(pen. ${m.pen[0]}-${m.pen[1]})</span>` : ''}</div></div>`;
}

export function europeSection(app) {
  const s = app.state;
  const eu = s.world.europe;
  if (!eu) return '<div class="card muted small">Avrupa kupaları bu sezon başlamadı.</div>';
  const view = app.leagueView;
  const myId = s.career.clubId;
  const myCup = cupOf(s.world, myId);
  if (!view.cup || !eu.cups[view.cup]) view.cup = myCup || 'cl';
  const cup = eu.cups[view.cup];
  const meta = CUPS[view.cup];

  const groups = cup.groups.map((g, gi) => {
    const rows = groupTable(cup, gi);
    return `<div class="grp"><div class="grp-h">Grup ${'ABCDEFGH'[gi]}</div>${rows.map((r, i) => {
      const c = CLUB_BY_ID[r.id];
      return `<div class="grp-r ${r.id === myId ? 'me' : ''} ${i < 2 ? 'q' : ''}"><span class="pos">${i + 1}</span>${crestSVG(c, 'crest xs')}<span class="ellipsis grow">${esc(c.name)}</span><span class="flag-xs">${flagOf(r.id)}</span><span class="muted tnum">${r.gf - r.ga >= 0 ? '+' : ''}${r.gf - r.ga}</span><b class="tnum">${r.pts}</b></div>`;
    }).join('')}</div>`;
  }).join('');

  const ko = ['r16', 'qf', 'sf', 'f'].filter((k) => cup.results[k]).reverse().map((k) => `<div class="h-sec">${STAGE_LABEL[k]}</div><div class="card list" style="padding:4px 10px">${cup.results[k].map((m) => matchRow(m, myId)).join('')}</div>`).join('');
  const lastMd = [6, 5, 4, 3, 2, 1].find((n) => cup.results[`g${n}`]);
  const mdResults = cup.stage === 'group' || cup.stage === 'r16' ? (lastMd ? `<div class="h-sec">${lastMd}. maç günü</div><div class="card list" style="padding:4px 10px">${cup.results[`g${lastMd}`].map((m) => matchRow(m, myId)).join('')}</div>` : '') : '';
  const next = cup.stage === 'done' ? null : cup.stage === 'group' ? CUP_WEEKS.group.find((w) => w >= s.calendar.week) : CUP_WEEKS[cup.stage];

  return `
    <div class="seg" style="margin-bottom:10px">${CUP_IDS.map((id) => `<button class="${view.cup === id ? 'on' : ''}" data-cup="${id}">${CUPS[id].name}${myCup === id ? ' ★' : ''}</button>`).join('')}</div>
    <div class="cup-hero" style="--c:${meta.color};--a:${meta.accent}">
      <div class="row" style="gap:12px">${icon('trophy')}<div class="grow"><b>${meta.name}</b><div class="small">${STAGE_LABEL[cup.stage]}${next ? ` · sıradaki maçlar ${next}. hafta` : ''}</div></div></div>
      ${cup.winner ? `<div class="cup-winner">${crestSVG(CLUB_BY_ID[cup.winner], 'crest')}<div><div class="small">Şampiyon</div><b>${esc(CLUB_BY_ID[cup.winner].name)}</b></div></div>` : ''}
      ${myCup === view.cup ? `<div class="small" style="margin-top:8px">${icon('star', 'ico xs')} ${esc(CLUB_BY_ID[myId].name)} bu kupada mücadele ediyor.</div>` : ''}
    </div>
    ${ko}
    ${mdResults}
    <div class="h-sec">Gruplar</div>
    <div class="grp-grid">${groups}</div>
    <p class="muted small" style="margin-top:10px">Gruplarda ilk 2 son 16'ya kalır. Eleme turları tek maç; berabere biterse uzatma ve penaltılar.</p>`;
}
