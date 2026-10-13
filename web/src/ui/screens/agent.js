// MENAJER EKRANI — temsilcin, sözleşmen, zam talebi ve ajan pazarı.
import { CLUB_BY_ID } from '../../core/data.js';
import {
  AGENTS, AGENT_RULES, askRaise, canAskRaise, canHire, currentAgent, ensureAgent, hireAgent, raiseOdds, releaseFee,
} from '../../core/agent.js';
import { money } from '../../core/economy.js';
import { buzz, sfx } from '../../audio.js';
import { crestSVG, icon } from '../art.js';
import { animateBars, esc, sheet, toast } from '../dom.js';
import { agentAvatar } from '../agentView.js';

const statBar = (label, v, c) => `<div class="ag-stat"><span>${label}</span><div class="bar"><i style="--c:${c}" data-w="${Math.round(v * 100)}"></i></div></div>`;

export function agentScreen(app) {
  const s = app.state;
  const a = ensureAgent(s);
  const ag = currentAgent(s);
  const c = s.career;
  const club = CLUB_BY_ID[c.clubId];
  const raise = canAskRaise(s);
  const odds = raiseOdds(s);
  const underpaid = odds.gap > 0.05;
  const g = c.guarantee && s.calendar.season <= c.guarantee.untilSeason;

  const market = AGENTS.filter((x) => x.id !== ag.id).map((x) => {
    const ok = canHire(s, x.id);
    return `<article class="card ag-card ${ok.ok ? '' : 'off'}">
      <div class="row" style="gap:12px">${agentAvatar(x, 48)}<div class="grow" style="min-width:0"><b>${esc(x.name)}</b><div class="muted small">${esc(x.firm)} · ${esc(x.title)}</div></div><span class="chip ${x.commission ? 'gold' : ''}">${x.commission ? `%${Math.round(x.commission * 100)}` : 'Komisyonsuz'}</span></div>
      <p class="small muted" style="margin:8px 0">${esc(x.bio)}</p>
      ${x.id === 'self' ? '' : `${statBar('Pazarlık', x.skill, 'var(--accent)')}${statBar('Bağlantılar', x.network, 'var(--blue)')}`}
      ${ok.ok ? `<button class="btn ${x.id === 'self' ? 'ghost' : 'primary'} block" style="margin-top:10px" data-hire="${x.id}">${x.id === 'self' ? 'Ajansız devam et' : `${icon('handshake')} ${esc(x.name.split(' ')[0])} ile anlaş`}</button>` : `<div class="chips" style="margin-top:8px"><span class="chip">${icon('lock', 'ico xs')} ${esc(ok.reason)}</span></div>`}
    </article>`;
  }).join('');

  const log = (a.log || []).slice(0, 6).map((l) => `<div class="li"><span class="news-dot info"></span><div class="grow small">${esc(l.text)}</div><span class="muted small">S${l.s}·H${l.w}</span></div>`).join('');

  return {
    tabs: 'career',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Menajer</h1>
      </div>

      <div class="card ag-hero" style="--c:${ag.color};margin-top:12px">
        <div class="row" style="gap:14px">${agentAvatar(ag, 72)}<div class="grow" style="min-width:0"><div class="muted small">Temsilcin</div><b class="ag-name">${esc(ag.name)}</b><div class="muted small">${esc(ag.firm)}</div></div></div>
        <p class="small" style="margin:10px 0">${esc(ag.bio)}</p>
        ${ag.id === 'self' ? '' : `${statBar('Pazarlık', ag.skill, 'var(--accent)')}${statBar('Bağlantılar', ag.network, 'var(--blue)')}`}
        <div class="chips" style="margin-top:10px">
          <span class="chip gold">Komisyon %${Math.round(ag.commission * 100)}</span>
          ${a.untilSeason ? `<span class="chip">Sözleşme S${a.untilSeason} sonuna kadar</span>` : ''}
          ${a.paid ? `<span class="chip">Toplam ödenen ${money(a.paid)}</span>` : ''}
          ${ag.sponsor && ag.sponsor > 1 ? `<span class="chip accent">Reklam geliri +%${Math.round((ag.sponsor - 1) * 100)}</span>` : ''}
        </div>
      </div>

      <div class="h-sec">Sözleşmen</div>
      <div class="card" style="display:grid;gap:8px">
        <div class="row" style="gap:10px">${crestSVG(club, 'crest sm')}<b class="grow">${esc(club.name)}</b>${g ? '<span class="chip good">İlk 11 garantisi</span>' : ''}</div>
        <div class="row between small"><span class="muted">Haftalık maaş</span><b>${money(c.contract.wage)}</b></div>
        <div class="row between small"><span class="muted">Kalan süre</span><b>${c.contract.yearsLeft} yıl</b></div>
        <div class="row between small"><span class="muted">Piyasa değerin (tahmini)</span><b style="color:${underpaid ? 'var(--good)' : 'var(--muted)'}">${money(odds.market)}/hf</b></div>
        <p class="muted small" style="margin:0">${underpaid ? 'Değerinin altında kazanıyorsun. Zam istemek için iyi zaman.' : 'Maaşın piyasa değerinle uyumlu. Zam için iyi bir form dönemi bekle.'}</p>
        <button class="btn ${raise.ok ? 'primary' : ''} block" data-act="raise" ${raise.ok ? '' : 'disabled'}>${icon('coin')} Zam iste${raise.ok ? ` · şans ${odds.p >= 0.6 ? 'yüksek' : odds.p >= 0.35 ? 'orta' : 'düşük'}` : ''}</button>
        ${raise.ok ? '' : `<span class="muted small">${esc(raise.reason)}</span>`}
      </div>

      ${log ? `<div class="h-sec">Ajan dosyası</div><div class="card list">${log}</div>` : ''}

      <div class="h-sec">Ajan pazarı <span>Ayrılma bedeli ${money(releaseFee(s))}</span></div>
      <div class="stack">${market}</div>
      <p class="muted small center" style="margin-top:12px">Ajan sözleşmeleri ${AGENT_RULES.contractSeasons} sezonluktur. Erken ayrılırsan ${AGENT_RULES.releaseWeeks} haftalık maaşın kadar bedel ödersin.</p>`,
    mount(node) {
      animateBars(node);
      node.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-hire],[data-act]');
        if (!t || t.disabled) return;
        app.click();
        if (t.dataset.act === 'back') return app.go('career');
        if (t.dataset.act === 'raise') {
          const r = askRaise(s);
          app.save();
          if (!r.ok) return toast(r.text, 'bad');
          if (r.success) {
            sfx('coin');
            buzz([14, 40, 20]);
          } else sfx('error');
          await sheet({
            center: true,
            html: `<div class="center">${crestSVG(club, 'crest lg')}</div><h3 class="center">${r.success ? 'Zam onaylandı!' : 'Zam reddedildi'}</h3><p class="lead center">${esc(r.text)}</p>
              ${r.success ? `<div class="chips" style="justify-content:center"><span class="chip">${money(r.before)}</span>${icon('chev', 'ico sm')}<span class="chip gold">${money(r.after)}/hf</span><span class="chip good">Moral +5</span></div>` : '<div class="chips" style="justify-content:center"><span class="chip bad">Moral −3</span><span class="chip bad">Yönetim −4</span></div>'}
              <button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>`,
          });
          return app.go('agent');
        }
        const id = t.dataset.hire;
        const x = AGENTS.find((q) => q.id === id);
        const fee = releaseFee(s);
        const ok = await app.confirm(
          id === 'self' ? 'Ajansız devam' : `${x.name} ile anlaş`,
          `${id === 'self' ? 'Komisyon ödemezsin ama pazarlıkta zayıf kalırsın.' : `Maaşının %${Math.round(x.commission * 100)}'i komisyon olarak kesilir.`}${fee ? ` Mevcut ajanından ayrılma bedeli: ${money(fee)}.` : ''}`,
          'Onayla',
        );
        if (!ok) return;
        const r = hireAgent(s, id);
        app.save();
        if (!r.ok) return toast(r.reason, 'bad');
        sfx('coin');
        toast(id === 'self' ? 'Artık kendini temsil ediyorsun.' : `${x.name} artık temsilcin!`, 'good');
        app.go('agent');
      });
    },
  };
}
