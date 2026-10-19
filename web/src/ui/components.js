// Ekranlarda tekrar kullanılan parçalar.
import { CLUB_BY_ID, LEAGUES, STATS } from '../core/data.js';
import { money } from '../core/economy.js';
import { clubRating, leagueLabel, leagueOf } from '../core/league.js';
import { crestSVG, icon } from './art.js';
import { esc, signed } from './dom.js';

export function meter(label, ico, value, max = 100, color = 'var(--accent)', right = null) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="meter">
    <div class="meter-top"><span class="lbl">${icon(ico)} ${esc(label)}</span><span class="tnum">${right ?? Math.round(value)}</span></div>
    <div class="bar"><i style="--c:${color}" data-w="${pct}"></i></div>
  </div>`;
}

export const energyColor = (v) => (v < 30 ? 'var(--bad)' : v < 55 ? 'var(--warn)' : 'var(--good)');
export const moraleColor = (v) => (v < 30 ? 'var(--bad)' : v < 55 ? 'var(--warn)' : 'var(--blue)');
export const ratingColor = (r) => (r >= 8 ? 'var(--accent)' : r >= 7 ? 'var(--good)' : r >= 6 ? 'var(--warn)' : 'var(--bad)');

export function statRow(key, value, progress = 0, highlight = false) {
  const st = STATS[key];
  return `<div class="stat-row ${highlight ? 'hl' : ''}">
    <span class="n">${st.name}</span>
    <div class="bar thick"><b data-w="${Math.min(100, value + progress)}"></b><i style="--c:${st.color}" data-w="${value}"></i></div>
    <span class="v">${value}</span>
  </div>`;
}

export function changeChips(changes = []) {
  if (!changes.length) return '';
  return `<div class="chips">${changes
    .map((c) => {
      const tone = c.delta > 0 ? 'good' : 'bad';
      const val = c.key === 'money' ? (c.delta > 0 ? '+' : '') + money(c.delta) : signed(c.delta, Number.isInteger(c.delta) ? 0 : 1);
      return `<span class="chip ${tone}">${esc(c.label)} ${val}</span>`;
    })
    .join('')}</div>`;
}

export function clubLine(clubId) {
  const c = CLUB_BY_ID[clubId];
  return `<span class="row" style="gap:6px">${crestSVG(c, 'crest sm')}<span class="ellipsis">${esc(c.name)}</span></span>`;
}

export function offerCard(state, offer, i, { negotiable = false } = {}) {
  const c = CLUB_BY_ID[offer.clubId];
  const lg = LEAGUES[leagueOf(offer.clubId)];
  const r = clubRating(state.world, offer.clubId);
  const cur = state.career.contract.wage;
  const diff = offer.wage - cur;
  const tone = offer.outlook?.tone || 'warn';
  return `<div class="card" style="padding:12px">
    <div class="row">
      ${crestSVG(c, 'crest')}
      <div class="grow">
        <div style="font-weight:800">${esc(c.name)} ${offer.renewal ? '<span class="chip accent">Yenileme</span>' : ''}</div>
        <div class="muted small">${esc(leagueLabel(lg.id, { country: true }))} · Güç ${r}${offer.tag === 'gulf' ? ' · <b style="color:var(--gold)">Körfez parası</b>' : ''}</div>
        <div class="chips" style="margin-top:6px">
          <span class="chip gold">${money(offer.wage)}/hf</span>
          <span class="chip ${diff >= 0 ? 'good' : 'bad'}">${diff >= 0 ? '+' : ''}${money(diff)}</span>
          <span class="chip">${offer.years} yıl</span>
          ${offer.signingBonus ? `<span class="chip gold">İmza ${money(offer.signingBonus)}</span>` : ''}
          ${offer.outlook ? `<span class="chip ${tone}">${esc(offer.outlook.label)}</span>` : ''}
          ${offer.guarantee ? '<span class="chip good">İlk 11 garantisi</span>' : ''}
          ${offer.viaAgent ? `<span class="chip accent">${icon('handshake', 'ico xs')} Ajanının bağlantısı</span>` : ''}
          ${offer.negotiated ? '<span class="chip accent">Pazarlıkla iyileşti</span>' : ''}
          ${offer.loan ? `<span class="chip warn">${icon('swap', 'ico xs')} Kiralık · sezon sonuna kadar</span>${offer.buyOption ? `<span class="chip">Satın alma opsiyonu ${money(offer.buyOption)}</span>` : ''}` : ''}
          ${!offer.renewal && !offer.loan && offer.fee != null ? (offer.free ? '<span class="chip good">Bonservissiz (serbest)</span>' : `<span class="chip">Bonservis ${money(offer.fee)}</span>`) : ''}
          ${!offer.renewal && offer.budget ? `<span class="chip">Kulüp bütçesi ${money(offer.budget)}</span>` : ''}
          ${offer.interest ? `<span class="chip accent">${icon('eye', 'ico xs')} Seni uzun süredir izliyor</span>` : ''}
        </div>
      </div>
    </div>
    ${negotiable ? `<div class="offer-btns"><button class="btn block" data-negotiate="${i}">${icon('handshake')} Pazarlık</button><button class="btn primary block" data-offer="${i}">${icon('check')} ${offer.renewal ? 'Yenile' : 'İmzala'}</button></div>`
      : `<button class="btn primary block" style="margin-top:10px" data-offer="${i}">${icon('check')} ${offer.renewal ? 'Sözleşmeyi Yenile' : 'İmzala'}</button>`}
  </div>`;
}
