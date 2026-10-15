// SAKATLIK ARAYÜZÜ — sakatlık anı ve tedavi seçimi, oyuncu ekranındaki sağlık kartı.
import { chooseTreatment, ensureMedical, recoveryPct, treatmentOptions } from '../core/injury.js';
import { money } from '../core/economy.js';
import { icon } from './art.js';
import { esc, sheet } from './dom.js';
import { sfx, buzz } from '../audio.js';

export async function injuryFlow(app) {
  const s = app.state;
  const inj = s.pending.injury;
  if (!inj) return;
  sfx('miss');
  buzz('heartBreak');
  const opts = treatmentOptions(s, inj);
  const pick = await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center inj-ic">${icon('bandage')}</div>
      <div class="center"><span class="chip bad">SAKATLIK</span></div>
      <h3 class="center" style="margin-top:8px">${esc(inj.name)}</h3>
      <p class="lead center">${esc(inj.part)} · Doktorun tahmini: <b>${inj.weeks} hafta</b>${inj.painkiller ? ' (ağrı kesiciyle oynarken kötüleşti)' : ''}.</p>
      <div class="stack">${opts.map((o, i) => `<button class="btn block treat ${i === 0 ? 'primary' : ''}" data-close="${o.id}" ${o.cost > s.career.money ? 'disabled' : ''}>
        <span class="tr-top"><b>${esc(o.name)}</b><span>${o.weeks ? `${o.weeks} hf` : 'maç kaçırma'}${o.cost ? ` · ${money(o.cost)}` : ''}</span></span>
        <span class="tr-desc">${esc(o.desc)}</span></button>`).join('')}</div>`,
  });
  const r = chooseTreatment(s, pick || opts[0].id);
  app.save();
  await sheet({ center: true, html: `<h3 class="center">Tedavi planı</h3><p class="lead center">${esc(r.note)}</p><div class="chips" style="justify-content:center">${r.weeks ? `<span class="chip bad">${icon('bandage', 'ico xs')} ${r.weeks} hafta yoksun</span>` : '<span class="chip warn">Riskli: bu hafta oynayacaksın</span>'}${r.cost ? `<span class="chip">${money(r.cost)}</span>` : ''}</div><button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>` });
}

/** Oyuncu ekranı: sağlık kartı */
export function medicalCard(state) {
  const m = ensureMedical(state);
  const cur = m.current;
  const weeks = state.flags.injuredWeeks || 0;
  const hist = m.history.slice(0, 4).map((h) => `<div class="li small"><span class="news-dot ${h.total >= 6 ? 'bad' : 'info'}"></span><span class="grow">${esc(h.name)}</span><span class="muted">${h.total ? `${h.total} hf` : 'darbe'} · S${h.s}</span></div>`).join('');
  const status = cur && weeks > 0
    ? `<div class="row between"><b style="color:var(--bad)">${icon('bandage', 'ico sm')} ${esc(cur.name)}</b><span class="chip bad">${weeks} hf kaldı</span></div>
       <div class="bar" style="margin-top:8px"><i style="--c:var(--good);width:${recoveryPct(state)}%"></i></div>
       <p class="muted small" style="margin:6px 0 0">${esc(cur.part)} · Tedavi: ${esc({ rest: 'dinlenme', fast: 'hızlandırılmış', surgery: 'ameliyat', clinic: 'yurt dışı klinik', play: 'ağrı kesici' }[cur.treatment] || 'planlanıyor')}</p>`
    : weeks > 0 ? `<div class="row between"><b style="color:var(--bad)">${icon('bandage', 'ico sm')} Sakatsın</b><span class="chip bad">${weeks} hf</span></div>`
      : `<div class="row between"><b style="color:var(--good)">${icon('check', 'ico sm')} Sağlıklı</b>${m.fragile > 0 ? `<span class="chip warn">Dönüş dönemi: ${m.fragile} hf dikkat</span>` : state.flags.painkiller ? '<span class="chip warn">Ağrı kesiciyle oynuyorsun</span>' : ''}</div>`;
  return `<div class="h-sec">Sağlık</div><div class="card">${status}
    ${m.prone >= 0.1 ? `<p class="muted small" style="margin:8px 0 0">Sakatlığa yatkınlık: <b style="color:var(--warn)">%${Math.round(m.prone * 100)}</b> · Dinlen, yorgun maça çıkma.</p>` : ''}
    ${hist ? `<div class="list" style="margin-top:8px">${hist}</div>` : ''}</div>`;
}
