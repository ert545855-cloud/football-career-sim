// MENAJER ARAYÜZÜ — ajan portresi, pazarlık penceresi, menajerli teklif akışı.
import { CLUB_BY_ID } from '../core/data.js';
import {
  AGENT_RULES, ASKS, acceptCounter, agentAdvice, currentAgent, negotiate, negotiationOdds, termsFor,
} from '../core/agent.js';
import { money } from '../core/economy.js';
import { buzz, sfx } from '../audio.js';
import { avatarSVG, crestSVG, icon } from './art.js';
import { esc, sheet } from './dom.js';

export function agentAvatar(ag, size = 56) {
  if (!ag.look) return `<span class="ag-av self" style="--sz:${size}px">${icon('user')}</span>`;
  return `<span class="ag-av" style="--sz:${size}px;--c:${ag.color}">${avatarSVG(ag.look, { colors: ag.suit }, '')}</span>`;
}

const pctTxt = (v) => `%${Math.round(v * 100)}`;

/**
 * Pazarlık penceresi. Teklifi yerinde günceller.
 * @returns {Promise<'accepted'|'counter-accepted'|'withdrawn'|'cancel'>}
 */
export async function negotiationSheet(app, offer) {
  const s = app.state;
  const ag = currentAgent(s);
  const club = CLUB_BY_ID[offer.clubId];
  const ask = { wage: 1, bonus: 0, guarantee: false, years: offer.years };
  const advice = agentAdvice(s, offer);
  const canGuarantee = offer.outlook?.id !== 'starter';

  const choice = await sheet({
    dismissable: false,
    html: `
      <div class="row" style="gap:12px">${agentAvatar(ag, 54)}<div class="grow"><div class="muted small">${esc(ag.id === 'self' ? 'Kendini temsil ediyorsun' : `${ag.name} · ${ag.title}`)}</div><b>${esc(club.name)} ile pazarlık</b></div>${crestSVG(club, 'crest sm')}</div>
      <div class="bubble-advice lvl-${advice.level}">${esc(advice.text)}<div class="interest"><span>Kulübün ilgisi</span><div class="bar"><i style="--c:${advice.level === 'high' ? 'var(--good)' : advice.level === 'mid' ? 'var(--warn)' : 'var(--bad)'};width:${Math.round(advice.interest * 100)}%"></i></div></div></div>
      <div class="neg-row"><span>Maaş <b class="muted">${money(offer.wage)}/hf</b></span><div class="seg" data-seg="wage">${ASKS.wage.map((a) => `<button class="${a.id === ask.wage ? 'on' : ''}" data-v="${a.id}">${a.label}</button>`).join('')}</div></div>
      <div class="neg-row"><span>İmza parası <b class="muted">${money(offer.signingBonus || 0)}</b></span><div class="seg" data-seg="bonus">${ASKS.bonus.map((a) => `<button class="${a.id === ask.bonus ? 'on' : ''}" data-v="${a.id}">${a.label}</button>`).join('')}</div></div>
      <div class="neg-row"><span>Süre</span><div class="seg" data-seg="years">${[offer.years - 1, offer.years, offer.years + 1].filter((y) => y >= 1 && y <= 5).map((y) => `<button class="${y === ask.years ? 'on' : ''}" data-v="${y}">${y} yıl</button>`).join('')}</div></div>
      ${canGuarantee ? `<label class="neg-check"><input type="checkbox" data-guarantee> <span><b>İlk 11 garantisi</b><br><span class="muted small">Forma şansın ${esc(offer.outlook?.label?.toLocaleLowerCase('tr') || 'belirsiz')}. Garanti maddesi zor kabul edilir.</span></span></label>` : ''}
      <div class="card neg-preview" data-preview></div>
      <div class="stack" style="margin-top:12px">
        <button class="btn primary block" data-close="send">${icon('handshake')} Talebi gönder</button>
        <button class="btn ghost block" data-close="cancel">Vazgeç</button>
      </div>`,
    onMount: (node) => {
      const preview = node.querySelector('[data-preview]');
      const render = () => {
        const t = termsFor(offer, ask);
        const o = negotiationOdds(s, offer, ask, (offer.rounds || 0) + 1);
        preview.innerHTML = `
          <div class="row between small"><span class="muted">İstenen maaş</span><b>${money(t.wage)}/hf</b></div>
          <div class="row between small"><span class="muted">İmza parası</span><b>${money(t.signingBonus)}</b></div>
          <div class="row between small"><span class="muted">Süre</span><b>${t.years} yıl${ask.guarantee ? ' · ilk 11 garantisi' : ''}</b></div>
          <div class="odds"><i class="acc" style="flex:${o.accept}"></i><i class="ctr" style="flex:${o.counter}"></i><i class="walk" style="flex:${Math.max(0.0001, o.walk)}"></i></div>
          <div class="row between small muted"><span>Kabul ${pctTxt(o.accept)}</span><span>Karşı teklif ${pctTxt(o.counter)}</span><span>Masadan kalkar ${pctTxt(o.walk)}</span></div>
          ${ag.commission ? `<div class="muted small" style="margin-top:6px">Ajan payı: maaşın ${pctTxt(ag.commission)}'i · imza parasından ${money(Math.round(t.signingBonus * ag.commission))}</div>` : ''}`;
      };
      node.addEventListener('click', (e) => {
        const b = e.target.closest('[data-seg] button');
        if (!b) return;
        const seg = b.parentElement.dataset.seg;
        ask[seg] = Number(b.dataset.v);
        b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        sfx('tick');
        render();
      });
      node.querySelector('[data-guarantee]')?.addEventListener('change', (e) => {
        ask.guarantee = e.target.checked;
        render();
      });
      render();
    },
  });
  if (choice !== 'send') return 'cancel';

  const r = negotiate(s, offer, ask);
  app.save();
  if (r.result === 'accept') {
    sfx('coin');
    buzz([14, 40, 20]);
    await sheet({
      center: true,
      html: `<div class="center">${agentAvatar(ag, 72)}</div><h3 class="center">Anlaşma!</h3><p class="lead center">${esc(r.text)}</p>
        <div class="chips" style="justify-content:center"><span class="chip gold">${money(offer.wage)}/hf</span><span class="chip">${offer.years} yıl</span>${offer.signingBonus ? `<span class="chip gold">İmza ${money(offer.signingBonus)}</span>` : ''}${offer.guarantee ? '<span class="chip good">İlk 11 garantisi</span>' : ''}</div>
        <button class="btn primary block" style="margin-top:14px" data-close>Teklife dön</button>`,
    });
    return 'accepted';
  }
  if (r.result === 'counter') {
    const c = r.counter;
    const lastRound = offer.rounds >= AGENT_RULES.maxRounds;
    const v = await sheet({
      center: true,
      dismissable: false,
      html: `<div class="center">${crestSVG(club, 'crest lg')}</div><h3 class="center">Karşı teklif</h3><p class="lead center">${esc(r.text)}</p>
        <div class="card"><div class="row between small"><span class="muted">Maaş</span><b>${money(c.wage)}/hf</b></div><div class="row between small"><span class="muted">İmza parası</span><b>${money(c.signingBonus)}</b></div><div class="row between small"><span class="muted">Süre</span><b>${c.years} yıl</b></div></div>
        <div class="stack" style="margin-top:12px"><button class="btn primary block" data-close="take">${icon('check')} Karşı teklifi kabul et</button>${lastRound ? '' : '<button class="btn block" data-close="push">Yeniden pazarlık (risk artar)</button>'}<button class="btn ghost block" data-close="keep">İlk teklife dön</button></div>`,
    });
    if (v === 'take') {
      acceptCounter(offer);
      app.save();
      sfx('coin');
      return 'counter-accepted';
    }
    delete offer.counter;
    app.save();
    if (v === 'push') return negotiationSheet(app, offer);
    return 'cancel';
  }
  sfx('error');
  buzz([60, 40, 60]);
  await sheet({
    center: true,
    html: `<div class="center">${crestSVG(club, 'crest lg')}</div><h3 class="center">Masadan kalktılar</h3><p class="lead center">${esc(r.text)}</p><button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>`,
  });
  return 'withdrawn';
}
