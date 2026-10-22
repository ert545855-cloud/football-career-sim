// BEDEN & ZİHİN EKRANI — oyuncunun içindeki "beyin": canlı vücut taraması, ölçüler ve gidişat, beslenme planı,
// zihin göstergeleri ve ihtiyaçlar, yük oranı, ortaya çıkan özellikler (nasıl oluştuğuyla), iç ses ve öneriler,
// kişisel hedef, çevredeki insanların istekleri, anılar ve beyin günlüğü.
import { CLUB_BY_ID } from '../../core/data.js';
import { canDoAction } from '../../core/game.js';
import { playerLook } from '../../core/cosmetics.js';
import {
  DIETS, NEEDS, NEED_KEYS, TRAITS, acwrLive, bodyFx, brainAdvice, brainSummary, canDiet, ensureBrain, fatPctOf, goalProgress, nearTraits, setDiet, weightOf,
} from '../../core/brain/index.js';
import { icon } from '../art.js';
import { animateBars, esc, toast } from '../dom.js';
import { meter } from '../components.js';
import { mountBodyFigure } from '../bodyArt.js';

const f1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
/** İşaretli değişim; good: 1 artış iyi, −1 azalış iyi, 0 nötr */
const sgn = (v, unit = '', good = 1) => {
  const r = Math.round(v * 10) / 10;
  if (!r) return '<span class="muted">±0</span>';
  const col = !good ? 'var(--muted)' : (r > 0) === (good > 0) ? 'var(--good)' : 'var(--bad)';
  return `<span style="color:${col}">${r > 0 ? '+' : '−'}${String(Math.abs(r)).replace('.', ',')}${unit}</span>`;
};
const ACTION_NAMES = { rest: 'Dinlen', train: 'Antrenman', gym: 'Spor Salonu', team: 'Takımla Yemek', media: 'Taraftar & Medya', manager: 'Hocayla Görüş', drill: 'Özel Çalışma' };

/** Ölçüm geçmişi grafiği (kilo, kas, yağ %) */
function trendSVG(hist) {
  const pts = hist.slice(-30);
  if (pts.length < 2) return '<p class="muted small" style="margin:6px 0 0">Grafik için birkaç hafta gerekiyor.</p>';
  const W = 300;
  const H = 70;
  const line = (key, color) => {
    const vals = pts.map((p) => p[key]);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = Math.max(key === 'f' ? 1.5 : 1, hi - lo);
    const d = vals.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * W).toFixed(1)} ${(H - 6 - ((v - lo) / span) * (H - 14)).toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
  };
  return `<svg class="body-trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Beden grafiği">${line('w', '#e2e8f0')}${line('m', '#22c55e')}${line('f', '#f59e0b')}</svg>
    <div class="row small muted" style="gap:12px;margin-top:4px"><span><i class="lg-dot" style="background:#e2e8f0"></i>Kilo</span><span><i class="lg-dot" style="background:#22c55e"></i>Kas</span><span><i class="lg-dot" style="background:#f59e0b"></i>Yağ %</span><span class="grow" style="text-align:right">${pts.length} hafta</span></div>`;
}

function pctChip(label, mult, goodUp = true) {
  const d = Math.round((mult - 1) * 100);
  if (!d) return '';
  const good = goodUp ? d > 0 : d < 0;
  return `<span class="chip ${good ? 'good' : 'bad'}">${esc(label)} ${d > 0 ? '+' : '−'}%${Math.abs(d)}</span>`;
}

export function bodyScreen(app) {
  const s = app.state;
  const b = ensureBrain(s);
  const sum = brainSummary(s);
  const body = b.body;
  const fx = bodyFx(body);
  const hist = body.hist;
  const ago4 = hist.length > 1 ? hist[Math.max(0, hist.length - 5)] : null;
  const ago8 = hist.length > 1 ? hist[Math.max(0, hist.length - 9)] : null;
  const adv = brainAdvice(s, (id) => canDoAction(s, id).ok);
  const acwrNow = acwrLive(s, { withMatch: false });
  const acwr = acwrLive(s, { withMatch: true }); // bu haftanın tahmini (maç dahil)
  const m = b.mind;
  const look = playerLook(s);
  const club = CLUB_BY_ID[s.career.clubId];
  const g = b.goal;
  const gp = g ? goalProgress(g, g.metric === 'fat' ? fatPctOf(body) : g.metric === 'muscle' ? body.muscle : g.metric === 'sleep' ? m.sleep : g.metric === 'teammates' ? s.player.rel.teammates : g.acc || 0) : 0;
  const traits = Object.entries(b.traits);
  const near = nearTraits(b.traits, b.habits);
  const mems = [...(b.memories || [])].sort((a, c) => c.int - a.int).slice(0, 6);
  const diet = DIETS[b.diet] || DIETS.balanced;
  const thoughtTone = adv.thought?.mood === 'bad' ? 'bad' : adv.thought?.mood === 'good' ? 'good' : 'info';

  return {
    tabs: 'player',
    html: `
      <div class="row" style="margin-bottom:12px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Beden & Zihin</h1>
        <span class="chip">${sum.mood.emoji} ${esc(sum.mood.name)}</span>
      </div>

      <div class="card thought ${thoughtTone}">
        <div class="row" style="gap:10px;align-items:flex-start"><span class="th-ic">${icon('brain')}</span>
          <div class="grow"><div class="muted small">İç sesin</div><b class="th-text">“${esc(adv.thought?.text || '')}”</b></div></div>
        ${adv.actions.length ? `<div class="th-advice"><span class="muted small">Beynin önerisi</span><div class="chips">${adv.actions.map((a) => `<span class="chip accent" title="${esc(a.why)}">${esc(ACTION_NAMES[a.id] || a.id)} · <span class="muted">${esc(a.why)}</span></span>`).join('')}</div></div>` : ''}
        ${adv.diet ? `<button class="btn sm ghost" style="margin-top:8px" data-diet="${adv.diet.id}">${DIETS[adv.diet.id].icon} ${esc(adv.diet.why)}</button>` : ''}
      </div>

      <div class="h-sec">Bedenin <span>${esc(sum.type.name)}</span></div>
      <div class="card body-card">
        <canvas class="body-fig" data-body-fig aria-label="Vücut taraması"></canvas>
        <div class="body-stats">
          <div><span>Boy</span><b>${f1(body.height)} cm</b>${body.height < body.heightTarget - 0.2 && s.player.age < 21 ? '<small class="muted">uzuyor</small>' : ''}</div>
          <div><span>Kilo</span><b>${f1(weightOf(body))} kg</b><small>${ago4 ? sgn(weightOf(body) - ago4.w, ' kg', 0) : ''}</small></div>
          <div><span>Kas kütlesi</span><b>${f1(body.muscle)} kg</b><small>${ago4 ? sgn(body.muscle - ago4.m, ' kg') : ''}</small></div>
          <div><span>Yağ oranı</span><b>%${f1(fx.fat)}</b><small>${ago4 ? sgn(fx.fat - ago4.f, ' puan', -1) : ''}</small></div>
          <div><span>Kas indeksi</span><b>${f1(fx.mi)}</b><small class="muted">kg/m²</small></div>
          <p class="muted small" style="margin:4px 0 0">Değişim: son 4 hafta. Kesik çizgi 8 hafta önceki bedenin.</p>
        </div>
      </div>
      <div class="card" style="margin-top:8px">
        ${trendSVG(hist)}
        <div class="chips" style="margin-top:10px">${[pctChip('Hız', fx.speed), pctChip('İkili mücadele', fx.power), pctChip('Kafa topu', fx.aerial), pctChip('Yorulma', fx.fatigue, false), pctChip('Sakatlık riski', fx.injury, false)].join('') || '<span class="chip good">Bedenin ideal aralıkta: sahaya ek etkisi yok</span>'}</div>
        <p class="muted small" style="margin:8px 0 0">Kas her hafta salondaki uyarıya, proteine, uykuya, strese, yaşa ve kalori dengesine göre değişir. Çalışmazsan erir. Yağ, harcadığından fazla yediğinde artar: takım yemeği, gece hayatı ve serbest beslenme ekler; antrenman, maç ve koşu bandı yakar.</p>
      </div>

      <div class="h-sec">Beslenme <span>${diet.icon} ${esc(diet.name)}${diet.cost ? ` · €${diet.cost}/hf` : ''}</span></div>
      <div class="diet-grid">
        ${Object.values(DIETS).map((d) => {
          const c = canDiet(s, d.id);
          return `<button class="diet ${d.id === b.diet ? 'on' : ''} ${c.ok ? '' : 'off'}" data-diet="${d.id}" ${c.ok ? '' : `title="${esc(c.reason)}"`}>
            <span class="d-ic">${d.icon}</span><b>${esc(d.name)}</b><span class="muted">${d.cost ? `€${d.cost}/hf` : 'Ücretsiz'}</span><small>${esc(d.desc)}</small></button>`;
        }).join('')}
      </div>

      <div class="h-sec">Zihnin</div>
      <div class="card" style="display:grid;gap:10px">
        ${meter('Özgüven', 'star', m.conf, 100, '#22c55e')}
        ${meter('Odak', 'target', m.focus, 100, '#38bdf8')}
        ${meter('Stres', 'bolt', m.stress, 100, m.stress >= 65 ? 'var(--bad)' : m.stress >= 45 ? 'var(--warn)' : '#94a3b8')}
        ${meter('Uyku', 'moon', m.sleep - 4, 5, m.sleep < 6.5 ? 'var(--bad)' : '#a78bfa', `${f1(m.sleep)} sa`)}
        <p class="muted small" style="margin:0">Özgüven ve odak sahada yeteneğini artırır; stres (özellikle penaltı ve büyük maçta) ve uykusuzluk düşürür. Odak antrenman verimini de belirler.</p>
      </div>

      <div class="h-sec">İhtiyaçların <span>Dolu = karşılanmış</span></div>
      <div class="card needs">
        ${NEED_KEYS.map((k) => {
          const v = 100 - (b.needs[k] || 0);
          return `<div class="need"><span>${NEEDS[k].icon}</span><div class="grow"><div class="row between small"><b>${esc(NEEDS[k].name)}</b><span class="muted">${esc(NEEDS[k].hint)}</span></div><div class="bar"><i style="--c:${v < 30 ? 'var(--bad)' : v < 55 ? 'var(--warn)' : 'var(--good)'}" data-w="${v}"></i></div></div></div>`;
        }).join('')}
      </div>

      <div class="h-sec">Yük oranı <span>akut : kronik</span></div>
      <div class="card">
        <div class="row between"><b style="font-size:22px;color:${acwr > 1.45 ? 'var(--bad)' : acwr < 0.6 ? 'var(--warn)' : 'var(--good)'}">${f1(acwr)}</b><span class="muted small">Bu hafta, maç dahil tahmin · şu ana kadar ${f1(acwrNow)}</span></div>
        <div class="acwr"><i style="left:${Math.min(100, (acwr / 2) * 100)}%"></i></div>
        <div class="row between small muted" style="margin-top:4px"><span>0</span><span>güvenli 0,8–1,3</span><span>2</span></div>
        <p class="muted small" style="margin:6px 0 0">Bu haftaki yükün (antrenman, salon, maç dakikası) son haftaların ortalamasına oranı. Aniden yüklenirsen (1,5 üstü) kas sakatlığı riski hızla artar; uzun ara sonrası da (0,6 altı) vücut hazırlıksızdır.</p>
      </div>

      <div class="h-sec">Özelliklerin <span>Alışkanlık ve deneyimden</span></div>
      <div class="card">
        ${traits.length ? traits.map(([id, t]) => {
          const d = TRAITS[id];
          return d ? `<div class="trait ${d.tone}"><span class="t-ic">${d.icon}</span><div class="grow"><b>${esc(d.name)}</b><div class="small">${esc(d.desc)}</div><div class="muted small">${esc(t.how || '')}</div></div></div>` : '';
        }).join('') : '<p class="muted small" style="margin:0">Henüz yerleşmiş bir alışkanlığın yok. Ne yaparsan o olursun: düzenli salon seni Salon Tutkunu, gece hayatı Gece Kuşu yapar.</p>'}
        ${near.length ? `<div class="divider" style="margin:10px 0"></div><div class="muted small" style="margin-bottom:6px">Oluşmak üzere</div>${near.map((n) => `<div class="near"><span>${TRAITS[n.id].icon} ${esc(TRAITS[n.id].name)}</span><div class="bar"><i style="--c:${TRAITS[n.id].tone === 'bad' ? 'var(--warn)' : 'var(--accent)'}" data-w="${n.pct}"></i></div><b class="small">%${n.pct}</b></div>`).join('')}` : ''}
      </div>

      ${g || b.npc.expect?.length ? `<div class="h-sec">Hedefler ve istekler</div>
      <div class="card" style="display:grid;gap:10px">
        ${g ? `<div><div class="row between small"><b>🎯 Kendine hedefin: ${esc(g.text)}</b><span class="muted">${Math.max(0, g.due - b.t)} hf</span></div><div class="bar" style="margin-top:6px"><i style="--c:var(--accent)" data-w="${gp}"></i></div></div>` : ''}
        ${(b.npc.expect || []).map((e) => `<div class="row between small"><span>${icon('clipboard', 'ico sm')} ${esc(e.who)}: ${esc(e.goal || e.text)}</span><span class="muted">${Math.max(0, e.due - b.t)} hf</span></div>`).join('')}
      </div>` : ''}

      <div class="h-sec">Anıların</div>
      <div class="card">
        ${mems.length ? mems.map((x) => `<div class="mem" style="opacity:${(0.45 + x.int * 0.55).toFixed(2)}"><span>${x.val > 0.3 ? '💚' : x.val < -0.3 ? '💔' : '🤍'}</span><div class="grow small">${esc(x.text)}</div><span class="muted small">S${x.s} H${x.w}</span></div>`).join('') : '<p class="muted small" style="margin:0">Kariyerin yeni başlıyor. İlk golün, ilk derbin, ilk kupan burada yaşayacak.</p>'}
      </div>

      ${b.log?.length ? `<div class="h-sec">Beyin günlüğü</div><div class="card">${b.log.slice(0, 8).map((l) => `<div class="li"><span class="news-dot ${l.kind === 'bad' ? 'bad' : l.kind === 'good' ? 'good' : 'info'}"></span><div class="grow small">${esc(l.text)}</div><span class="muted small">H${l.w}</span></div>`).join('')}</div>` : ''}
      <p class="muted small" style="margin:14px 2px 6px">Beyin her hafta ne yaptığını hatırlar. Ölçüler kural tablosundan gelmez: yediğin, uyuduğun, çalıştığın ve yaşadığın her şeyden hesaplanır.</p>`,
    mount(el) {
      animateBars(el);
      const cv = el.querySelector('[data-body-fig]');
      if (cv) {
        mountBodyFigure(cv, {
          height: body.height, mi: fx.mi, fat: fx.fat, skin: look.skin, hairColor: look.hairColor, shorts: look.kit?.shorts || club?.colors?.[0],
          ghost: ago8 ? { height: ago8.h || body.height, mi: ago8.m / ((ago8.h || body.height) / 100) ** 2, fat: ago8.f } : null,
        });
      }
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-act=back]')) {
          app.click();
          app.go('player');
          return;
        }
        const d = e.target.closest('[data-diet]');
        if (d) {
          app.click();
          const r = setDiet(s, d.dataset.diet);
          if (!r.ok) { toast(r.reason); return; }
          app.save();
          toast(`${DIETS[d.dataset.diet].icon} Beslenme planı: ${DIETS[d.dataset.diet].name}`);
          app.go('body');
        }
      });
    },
  };
}
