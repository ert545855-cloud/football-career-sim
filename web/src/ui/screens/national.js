// MİLLİ TAKIM EKRANI — seviye, milli maç sayıları, çağrı hedefi, turnuva geçmişi.
import { NATIONAL_TEAMS, NATIONAL_WEEKS, RESULT_LABEL, callUpScore, ensureNational, nextCallTarget, tournamentName } from '../../core/national.js';
import { icon } from '../art.js';
import { animateBars, esc } from '../dom.js';
import { meter } from '../components.js';
import { nationalCrest } from '../nationalView.js';

export function nationalScreen(app) {
  const s = app.state;
  const n = ensureNational(s);
  const tgt = nextCallTarget(s);
  const cur = tgt.current ? NATIONAL_TEAMS[tgt.current] : null;
  const nextWeek = NATIONAL_WEEKS.find((w) => w >= s.calendar.week);
  const nextT = s.calendar.season % 2 === 0 ? s.calendar.season : s.calendar.season + 1;
  const score = Math.round(callUpScore(s));
  const totalCaps = n.caps.U19 + n.caps.U21 + n.caps.A;

  const levels = ['U19', 'U21', 'A'].map((l) => `<div class="nat-level ${tgt.current === l ? 'on' : ''}"><b>${n.caps[l]}</b><span>${NATIONAL_TEAMS[l].short}</span><div class="muted small">${n.goals[l]} gol</div></div>`).join('');
  const log = n.log.slice(0, 8).map((l) => `<div class="li"><span class="nat-res ${l.res === 'W' ? 'good' : l.res === 'D' ? 'warn' : l.res === 'L' ? 'bad' : ''}"></span><div class="grow small">${esc(l.text)}</div><span class="muted small">S${l.s}·H${l.w}</span></div>`).join('');
  const tours = n.tournaments.slice().reverse().map((t) => `<div class="li">${icon(t.result === 'champion' ? 'trophy' : 'flag', 'ico sm')}<div class="grow"><b class="small">${esc(t.name)}</b><div class="muted small">Sezon ${t.season}</div></div><span class="chip ${t.result === 'champion' ? 'gold' : t.result === 'final' || t.result === 'sf' ? 'accent' : ''}">${esc(RESULT_LABEL[t.result])}</span></div>`).join('');

  return {
    tabs: 'career',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Milli Takım</h1>
      </div>

      <div class="card nat-hero" style="margin-top:12px">
        <div class="row" style="gap:14px">${nationalCrest('crest lg', tgt.current || 'A')}<div class="grow"><div class="muted small">Durumun</div><b style="font-size:19px">${cur ? esc(cur.name) : 'Kadro dışı'}</b><div class="muted small">${totalCaps} milli maç · ${n.goals.U19 + n.goals.U21 + n.goals.A} gol</div></div></div>
        <div style="margin-top:12px">${meter('Çağrı puanı', 'target', Math.min(100, (score / (tgt.need || 70)) * 100), 100, 'var(--bad)', `${score}${tgt.need ? ` / ${tgt.need}` : ''}`)}</div>
        <p class="muted small" style="margin:8px 0 0">${tgt.next ? `${esc(NATIONAL_TEAMS[tgt.next].name)} için çağrı puanın ${tgt.need} olmalı. Puan: OVR + form + ün + Federasyon ilişkisi.` : cur ? 'Bu seviyede kadrodasın. Formunu koru!' : 'Yaşın genç takımlar için geçti; A Milli Takım için gelişmeye devam et.'}</p>
      </div>

      <div class="nat-levels" style="margin-top:12px">${levels}</div>

      <div class="h-sec">Takvim</div>
      <div class="card" style="display:grid;gap:8px">
        <div class="row between small"><span class="muted">Sıradaki milli ara</span><b>${nextWeek ? `Hafta ${nextWeek}` : 'Gelecek sezon'}</b></div>
        <div class="row between small"><span class="muted">Sıradaki büyük turnuva</span><b>${esc(tournamentName(nextT))} · Sezon ${nextT} sonu</b></div>
        <div class="row between small"><span class="muted">Reddedilen çağrı</span><b>${n.declined}</b></div>
        <p class="muted small" style="margin:0">Milli maç enerji götürür; çok yorgun gidersen sakatlanma riski artar. Çağrıyı reddetmek Federasyon ve taraftarla aranı bozar.</p>
      </div>

      ${tours ? `<div class="h-sec">Turnuvalar</div><div class="card list">${tours}</div>` : ''}
      ${log ? `<div class="h-sec">Milli maçlar</div><div class="card list">${log}</div>` : '<div class="card muted small" style="margin-top:14px">Henüz milli forma giymedin. U-19 çağrısı için çağrı puanın 28 olmalı.</div>'}`,
    mount(node) {
      animateBars(node);
      node.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="back"]')) {
          app.click();
          app.go('career');
        }
      });
    },
  };
}
