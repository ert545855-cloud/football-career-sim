// SEÇMELER KAMPI EKRANI — istasyon listesi → seçme raporu (skor + mevki) → teklif ekranı.
import { CLUB_BY_ID, LEAGUES, POSITIONS, STATS } from '../../core/data.js';
import { money } from '../../core/economy.js';
import {
  MAX_SCORE, OFFER_KINDS, offerText, SCORE_TIERS, STATIONS, TryoutSession, tryoutStatBonus, unlockedOptions,
} from '../../core/onboarding/index.js';
import { avatarSVG, crestSVG, icon } from '../art.js';
import { animateBars, esc } from '../dom.js';
import { sprite } from '../../assets/sprites.js';
import { heartsHTML } from '../../games/tryoutStation.js';

const PREVIEW_KIT = { colors: ['#334155', '#f8fafc'], pattern: 'solid' };

export function tryoutsScreen(app) {
  const d = app.draft;
  const session = new TryoutSession(d.tryout);
  if (session.finished && d.stage === 'camp') d.stage = 'report';
  const html = d.stage === 'offers' ? offersView(d) : d.stage === 'report' ? reportView(d, session) : campView(d, session);
  return {
    tabs: false,
    html,
    mount(el) {
      animateBars(el);
      el.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-act],[data-pos],[data-offer]');
        if (!t || t.disabled) return;
        app.click();
        const act = t.dataset.act;
        if (act === 'leave') return app.leaveTryouts();
        if (act === 'station') return app.runStation();
        if (act === 'to-report') {
          d.stage = 'report';
          app.saveDraft();
          return app.go('tryouts');
        }
        if (t.dataset.pos) {
          d.position = t.dataset.pos;
          app.saveDraft();
          return app.go('tryouts');
        }
        if (act === 'offers') return app.showStarterOffers();
        if (act === 'back-report') {
          d.stage = 'report';
          app.saveDraft();
          return app.go('tryouts');
        }
        if (t.dataset.offer) return app.acceptStarterOffer(Number(t.dataset.offer));
      });
    },
  };
}

function header(title, sub, back = 'leave') {
  return `<div class="row" style="margin-bottom:10px">
    <button class="icon-btn" data-act="${back}" aria-label="Geri">${icon('back')}</button>
    <div class="grow"><div class="muted small">${esc(sub)}</div><h1 class="h-title">${esc(title)}</h1></div>
  </div>`;
}

function campView(d, session) {
  const cur = session.current;
  const total = session.score();
  const cards = STATIONS.map((s, i) => {
    const st = session.stations[s.id];
    const state = st.done ? 'done' : cur?.id === s.id ? 'now' : 'wait';
    const badge = state === 'done' ? `<span class="chip ${st.hearts ? 'good' : 'bad'}">${st.hearts}/3 hak</span>` : state === 'now' ? '<span class="chip accent">Sıradaki</span>' : '<span class="chip">Bekliyor</span>';
    return `<div class="station-card ${state}">
      <span class="station-art">${sprite(s.sprite, { size: 46 })}</span>
      <div class="grow" style="min-width:0">
        <div class="row between"><b>${i + 1}. ${esc(s.name)}</b>${badge}</div>
        <div class="muted small" style="margin:3px 0 6px">${esc(s.teaches)} · ${s.attempts} deneme</div>
        <div class="hearts sm">${heartsHTML(st.done || state === 'now' ? st.hearts : 3)}</div>
      </div>
    </div>`;
  }).join('');
  return `
    ${header('Seçmeler Kampı', `${d.name} · 17 yaş`)}
    <div class="scout-card">
      <div class="avatar-ring" style="width:54px;height:54px">${avatarSVG(d.avatar, PREVIEW_KIT, '?')}</div>
      <div class="grow small" style="line-height:1.45"><b>Scout:</b> "Üç istasyon var, her birinde <b>3 hakkın</b>. Her hata bir hak götürür. Sonunda kalan hakların <b>seçme skorun</b> olur; teklifler buna göre gelir."</div>
    </div>
    <div class="score-strip">
      <span class="muted small">Seçme skoru</span>
      <div class="bar thick grow"><i style="--c:var(--gold)" data-w="${(total / MAX_SCORE) * 100}"></i></div>
      <b class="tnum">${total}/${MAX_SCORE}</b>
    </div>
    <div class="stack" style="margin-top:12px">${cards}</div>
    <div class="spacer"></div>
    ${cur
    ? `<button class="btn primary lg block" data-act="station">${icon('play')} ${esc(cur.name)}na Gir</button>`
    : `<button class="btn primary lg block" data-act="to-report">${icon('chart')} Seçme Raporunu Gör</button>`}`;
}

function reportView(d, session) {
  const r = session.report();
  const open = unlockedOptions(r.score);
  const tier = SCORE_TIERS.find((t) => r.score >= t.min && r.score <= t.max);
  const bonus = tryoutStatBonus(r);
  const chosen = d.position || r.position;
  const rows = r.stations.map((s) => `<div class="li"><span class="station-art sm">${sprite(STATIONS.find((x) => x.id === s.id).sprite, { size: 30 })}</span><div class="grow"><b class="small">${esc(s.name)}</b><div class="muted small">${s.successes}/${s.attempts} başarılı${s.hearts === 0 ? ' · elendin' : ''}</div></div><div class="hearts sm">${heartsHTML(s.hearts)}</div></div>`).join('');
  const tiers = SCORE_TIERS.map((t) => `<div class="tier ${t === tier ? 'on' : ''}"><b>${t.min === 0 ? '0–3' : `${t.min}–${t.max}`} hak</b><span>${t.options.join(' · ')}</span></div>`).join('');
  const posCards = Object.values(POSITIONS).map((p) => `<button class="pos-card compact ${chosen === p.id ? 'on' : ''}" data-pos="${p.id}">
      <div class="row"><span class="pos-tag">${p.short}</span><div class="grow"><b>${p.name}</b>${p.id === r.position ? ' <span class="chip gold">Scout önerisi</span>' : ''}<div class="muted small" style="margin-top:2px">${esc(p.desc)}</div></div></div>
    </button>`).join('');
  return `
    ${header('Seçme Raporu', 'Kamp tamamlandı')}
    <div class="card center report-score">
      <div class="muted small">Seçme skoru</div>
      <div class="big-score">${r.score}<small>/${MAX_SCORE}</small></div>
      <div class="chip ${r.score >= 7 ? 'gold' : r.score >= 4 ? 'accent' : ''}">${esc(r.grade.label)}</div>
      <p class="muted small" style="margin:8px 0 0">${esc(r.grade.text)}</p>
    </div>
    <div class="card list" style="margin-top:10px">${rows}</div>
    <div class="h-sec">Teklif kademeleri</div>
    <div class="tiers">${tiers}</div>
    <p class="muted small" style="margin:8px 0 0">Bu skorla açılan seçenekler: <b style="color:var(--text)">${open.map((k) => `${k} (${OFFER_KINDS[k].title})`).join(', ')}</b></p>
    <div class="h-sec">Mevkin</div>
    <div class="stack">${posCards}</div>
    <div class="chips" style="margin-top:10px">${Object.entries(bonus).filter(([, v]) => v).map(([k, v]) => `<span class="chip good">${STATS[k].name} +${v}</span>`).join('') || '<span class="chip">Kamp katkısı yok</span>'}<span class="muted small" style="align-self:center">kamp performansından başlangıç katkısı</span></div>
    <div class="spacer"></div>
    <button class="btn primary lg block" data-act="offers">${icon('briefcase')} Teklifleri Gör</button>`;
}

function offerCard(o, i, score, cc = 'tr') {
  const k = OFFER_KINDS[o.kind];
  const T = (t) => offerText(t, cc);
  const club = CLUB_BY_ID[o.clubId];
  const parent = o.parentId ? CLUB_BY_ID[o.parentId] : null;
  const crests = o.kind === 'B'
    ? `${crestSVG(parent, 'crest lg')}<span class="loan-arrow">${icon('chev')}<small>kiralık</small></span>${crestSVG(club, 'crest')}`
    : crestSVG(o.kind === 'C' ? parent : club, 'crest lg');
  const main = o.kind === 'B' ? parent : o.kind === 'C' ? parent : club;
  const where = o.kind === 'B' ? `${club.name} (${LEAGUES[club.league].name}) · 1 yıl` : o.kind === 'C' ? `${club.name} · ${(LEAGUES[club.league] || LEAGUES.u17).name}` : `${LEAGUES[club.league].name} · ${club.city}`;
  return `<article class="starter-offer ${o.locked ? 'locked' : ''} k${o.kind}">
    <div class="so-head"><span class="so-kind">${o.kind}</span><div class="grow"><b>${esc(k.title)}</b><div class="muted small">${esc(T(k.badge))}</div></div>${o.locked ? `<span class="chip">${icon('lock', 'ico sm')} Kilitli</span>` : ''}</div>
    <div class="so-crests">${crests}</div>
    <h3 class="center" style="margin:6px 0 2px">${esc(main.name)}</h3>
    <div class="muted small center">${esc(where)}</div>
    ${o.locked
    ? `<p class="center small" style="margin:12px 0 0"><b>${esc(o.requirement)}</b> · senin skorun ${score}</p>`
    : `<div class="chips" style="justify-content:center;margin:10px 0"><span class="chip gold">${money(o.wage)}/hf</span><span class="chip">${o.years} yıl</span>${o.signingBonus ? `<span class="chip gold">İmza ${money(o.signingBonus)}</span>` : ''}</div>
      <ul class="so-list pros">${k.pros.map((p) => `<li>${esc(T(p))}</li>`).join('')}</ul>
      <ul class="so-list cons">${k.cons.map((p) => `<li>${esc(T(p))}</li>`).join('')}</ul>
      <button class="btn primary block" data-offer="${i}">${icon('check')} Bu teklifi kabul et</button>`}
  </article>`;
}

function offersView(d) {
  return `
    ${header('Teklifler', `Seçme skoru ${d.score}/${MAX_SCORE}`, 'back-report')}
    <p class="muted small" style="margin:0 0 12px;line-height:1.5">Scoutların raporu kulüplere ulaştı. Bir teklifi kabul ettiğinde kariyerin başlar.</p>
    <div class="stack">${d.offers.map((o, i) => offerCard(o, i, d.score, d.nationality || 'tr')).join('')}</div>`;
}
