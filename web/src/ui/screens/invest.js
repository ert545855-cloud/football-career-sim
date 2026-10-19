// YATIRIM EKRANI — servetin, menajerinin portföy notları, maaştan otomatik yatırım ve sanal piyasa.
// Varlığa dokununca al/sat penceresi açılır (52 haftalık grafik, komisyon, menajer uyarısı).
import {
  ASSET_BY_ID, AUTO_PCTS, KIND_LABEL, MGMT_FEE, MIN_TRADE, PROFILES, REGIMES, RISK_LABEL,
  addToPlan, assetName, assetTicker, buy, canManage, canTrade, ensureInvest, investPct, listedAssets, planWeights,
  portfolioSummary, portfolioValue, sell, setMode, weeklyCost, withdrawPlan,
} from '../../core/invest.js';
import { currentAgent } from '../../core/agent.js';
import { money } from '../../core/economy.js';
import { buzz, sfx } from '../../audio.js';
import { icon } from '../art.js';
import { esc, sheet, toast } from '../dom.js';
import { agentAvatar } from '../agentView.js';

// ─────────────────────────── Biçimlendirme ───────────────────────────
export function fmtPrice(p) {
  if (p >= 1000) return `€${Math.round(p).toLocaleString('tr-TR')}`;
  if (p >= 1) return `€${p.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `€${p.toLocaleString('tr-TR', { maximumSignificantDigits: 4 })}`;
}
const fmtQty = (q) => (q >= 1000 ? Math.round(q).toLocaleString('tr-TR') : q.toLocaleString('tr-TR', { maximumSignificantDigits: 4 }));
const signMoney = (v) => `${v >= 0 ? '+' : ''}${money(v)}`;
const tone = (v) => (v > 0.0005 ? 't-up' : v < -0.0005 ? 't-down' : 't-flat');

const SYMBOL = { VADE: '%', ENDX: '▲', ALTN: 'Au', GOLC: 'G', PXC: 'P', KEDI: 'K' };
/** Para rozeti (SVG): varlık renginde madeni para, ortasında sembol; kedi coin'in kulakları var */
export function coinBadge(state, a, size = 36) {
  const sym = a.kind === 'fan' ? String(state.player?.name || 'F')[0].toLocaleUpperCase('tr') : SYMBOL[a.id] || a.ticker[0];
  const ears = a.id === 'KEDI' ? `<path d="M9 9 L12 1 L16 7 Z M27 9 L24 1 L20 7 Z" fill="${a.color}" stroke="#0b1210" stroke-width="1.2"/>` : '';
  return `<svg class="coin" viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true">${ears}
    <circle cx="18" cy="19" r="15.5" fill="${a.color}" stroke="#0b1210" stroke-width="1.5"/>
    <circle cx="18" cy="19" r="11.5" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2"/>
    <path d="M8 13 A12 12 0 0 1 18 7" stroke="rgba(255,255,255,.55)" stroke-width="2" fill="none" stroke-linecap="round"/>
    <text x="18" y="${sym.length > 1 ? 23.5 : 24.5}" text-anchor="middle" font-size="${sym.length > 1 ? 11 : 14}" font-weight="900" fill="rgba(0,0,0,.72)" font-family="system-ui,sans-serif">${esc(sym)}</text></svg>`;
}

let gid = 0;
/** Küçük çizgi grafik */
export function sparkline(values, { w = 76, h = 26, color = '#4ade80' } = {}) {
  if (!values || values.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || hi || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - lo) / span) * (h - 4)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const id = `sg${++gid}`;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

/** Büyük grafik: 52 hafta, en yüksek / en düşük etiketli */
function bigChart(values, color, fmt = fmtPrice) {
  if (!values || values.length < 2) return '<div class="inv-chart empty muted small">Grafik için en az iki hafta gerekiyor.</div>';
  const w = 320;
  const h = 130;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || hi || 1;
  const X = (i) => 4 + (i / (values.length - 1)) * (w - 8);
  const Y = (v) => 14 + (1 - (v - lo) / span) * (h - 30);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const id = `bg${++gid}`;
  const iHi = values.indexOf(hi);
  const iLo = values.indexOf(lo);
  const last = values[values.length - 1];
  // etiketler grafiğin içinde kalır; son haftalara düşen uç değer etiketlenmez (güncel fiyat başlıkta yazıyor)
  const lbl = (i, v, below) => `<text x="${clampX(X(i))}" y="${Math.max(10, Math.min(h - 20, below ? Y(v) + 13 : Y(v) - 5)).toFixed(1)}" text-anchor="middle">${esc(fmt(v))}</text>`;
  const nearEnd = (i) => i >= values.length - 4;
  const clampX = (x) => Math.max(26, Math.min(w - 26, x)).toFixed(1);
  return `<svg class="inv-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Fiyat grafiği">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${[0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${w}" y1="${(14 + f * (h - 30)).toFixed(1)}" y2="${(14 + f * (h - 30)).toFixed(1)}" class="grid"/>`).join('')}
    <path d="${d} L${X(values.length - 1)} ${h - 16} L${X(0)} ${h - 16} Z" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="${X(values.length - 1)}" cy="${Y(last)}" r="3.5" fill="${color}" stroke="#06110d" stroke-width="1.5"/>
    ${nearEnd(iHi) ? '' : lbl(iHi, hi, false)}${nearEnd(iLo) || iLo === iHi ? '' : lbl(iLo, lo, true)}
    <text x="4" y="${h - 3}" class="axis">${values.length} hf önce</text><text x="${w - 4}" y="${h - 3}" text-anchor="end" class="axis">Bu hafta</text></svg>`;
}

const riskDots = (r) => `<span class="risk r${r}" title="Risk: ${RISK_LABEL[r]}">${[1, 2, 3, 4].map((i) => `<i class="${i <= r ? 'on' : ''}"></i>`).join('')}</span>`;
const weekChange = (hist) => (hist && hist.length >= 2 ? hist[hist.length - 1] / hist[hist.length - 2] - 1 : 0);

// ─────────────────────────── Ekran ───────────────────────────
export function investScreen(app, params = {}) {
  const s = app.state;
  const v = ensureInvest(s);
  const sum = portfolioSummary(s);
  const ag = currentAgent(s);
  const managed = v.mode === 'managed';
  const from = params.from || app.current || 'hub';
  const back = ['hub', 'career', 'agent'].includes(from) ? from : 'hub';
  const notes = v.log.slice(0, 3);
  const assets = listedAssets(s);

  // dağılım çubuğu
  const alloc = sum.rows.filter((r) => r.value > 0);
  const allocBar = alloc.length
    ? `<div class="inv-alloc">${alloc.map((r) => `<i style="flex:${r.value};background:${ASSET_BY_ID[r.id].color}" title="${esc(assetName(s, ASSET_BY_ID[r.id]))}"></i>`).join('')}</div>
      <div class="inv-legend">${alloc.slice(0, 5).map((r) => `<span><i style="background:${ASSET_BY_ID[r.id].color}"></i>${esc(assetTicker(s, ASSET_BY_ID[r.id]))} %${Math.round(r.w * 100)}</span>`).join('')}</div>`
    : '<p class="muted small" style="margin:10px 0 0">Henüz yatırımın yok. Aşağıdan bir varlık seç ya da maaşından otomatik yatırımı aç.</p>';
  const wk = sum.weekly && sum.weekly.s === s.calendar.season ? sum.weekly : null;
  // portföy değeri geçmişi: ilk yatırımdan itibaren
  const vh = v.valHist.map((x) => x.v);
  const firstNz = vh.findIndex((x) => x > 0);
  const valHist = firstNz < 0 ? [] : vh.slice(Math.max(0, firstNz - 1));

  const noteHTML = notes.length
    ? notes.map((n, i) => `<div class="inv-note ${n.tone || 'info'} ${i ? 'old' : ''}"><p>${esc(n.text)}</p><span>S${n.s}·H${n.w}</span></div>`).join('')
    : `<div class="inv-note info"><p>${esc(ag.id === 'self' ? 'Portföyünü kendin takip ediyorsun. Bir menajerle anlaşırsan seni uyarır, yorum yapar ve istersen portföyünü yönetir.' : `${ag.name.split(' ')[0]} portföyünü takip ediyor. Önemli bir gelişme olunca sana yazacak.`)}</p></div>`;

  const plan = planWeights(s);
  const planChips = Object.entries(plan).sort((a, b) => b[1] - a[1]).map(([id, w]) => `<span class="chip"><i class="inv-dot" style="background:${ASSET_BY_ID[id].color}"></i>${esc(ASSET_BY_ID[id].name)} %${Math.round(w * 100)}</span>`).join('');
  const manage = canManage(s);

  const rows = assets.map((a) => {
    const hist = v.hist[a.id] || [];
    const ch = weekChange(hist);
    const h = sum.rows.find((r) => r.id === a.id);
    const col = ch > 0.0005 ? '#4ade80' : ch < -0.0005 ? '#ff5d6c' : '#93aa9f';
    return `<button class="inv-row" data-asset="${a.id}">
      ${coinBadge(s, a)}
      <span class="inv-name"><b>${esc(assetName(s, a))}</b><span>${esc(assetTicker(s, a))} · ${esc(KIND_LABEL[a.kind])} ${riskDots(a.risk)}</span>${h ? `<span class="held">Sende ${money(h.value)} <em class="${tone(h.pct)}">${investPct(h.pct)}</em></span>` : ''}</span>
      ${sparkline(hist.slice(-26), { color: col })}
      <span class="inv-px"><b class="tnum">${fmtPrice(v.prices[a.id])}</b><em class="${tone(ch)}">${investPct(ch)}</em></span>
    </button>`;
  }).join('');

  const txName = (t) => (t.id === 'plan' ? 'Menajer planı' : esc(assetName(s, ASSET_BY_ID[t.id] || { name: t.id, kind: '' })));
  const txLabel = { buy: 'Alım', sell: 'Satış', plan: 'Plana ekleme', withdraw: 'Plandan çekim' };
  const tx = v.tx.slice(0, 8).map((t) => `<div class="li"><span class="tx-ic ${t.t}">${icon(t.t === 'sell' || t.t === 'withdraw' ? 'download' : 'upload', 'ico sm')}</span><div class="grow small"><b>${txLabel[t.t]}${t.auto ? ' · otomatik' : ''}</b> · ${txName(t)}${t.pnl != null ? ` <em class="${tone(t.pnl)}">${signMoney(t.pnl)}</em>` : ''}</div><b class="small tnum">${t.t === 'sell' || t.t === 'withdraw' ? '+' : '−'}${money(t.amount)}</b><span class="muted small">H${t.w}</span></div>`).join('');

  return {
    tabs: back === 'hub' ? 'home' : 'career',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Yatırım</h1>
        <span class="chip regime ${v.regime}">${v.regime === 'bull' ? '🐂' : v.regime === 'bear' ? '🐻' : '〰️'} ${esc(REGIMES[v.regime].name)}</span>
      </div>

      <div class="card inv-hero" style="margin-top:12px">
        <div class="muted small">Toplam servet</div>
        <div class="inv-total tnum">${money(sum.wealth)}</div>
        <div class="inv-split"><span><i class="inv-dot" style="background:var(--gold)"></i>Nakit <b class="tnum">${money(sum.cash)}</b></span><span><i class="inv-dot" style="background:var(--accent)"></i>Portföy <b class="tnum">${money(sum.value)}</b></span></div>
        ${wk && (wk.value || wk.change) ? `<div class="inv-week ${tone(wk.change)}">Bu hafta <b>${signMoney(wk.change)}</b> (${investPct(wk.pct)})${wk.autoInvested ? ` · maaştan ${money(wk.autoInvested)} yatırıldı` : ''}</div>` : ''}
        ${valHist.length >= 2 ? `<div class="inv-vh">${sparkline(valHist, { w: 300, h: 44, color: '#c6ff3d' })}</div>` : ''}
        ${allocBar}
        ${sum.value || sum.realized ? `<div class="inv-pnl">
          <div><span>Açık kâr/zarar</span><b class="${tone(sum.pnl)}">${signMoney(sum.pnl)}</b></div>
          <div><span>Gerçekleşen</span><b class="${tone(sum.realized)}">${signMoney(sum.realized)}</b></div>
          <div><span>Komisyon</span><b>${money(sum.fees)}</b></div>
        </div>` : ''}
      </div>

      <div class="card inv-agent" style="--c:${ag.color}">
        <div class="row" style="gap:12px">${agentAvatar(ag, 44)}<div class="grow" style="min-width:0"><b>${esc(ag.id === 'self' ? 'Kendin takip ediyorsun' : ag.name)}</b><div class="muted small">${esc(ag.id === 'self' ? 'Menajerin yok' : managed ? `Portföyünü yönetiyor · ${PROFILES[v.profile].name} plan` : 'Portföyünü takip ediyor')}</div></div></div>
        <div class="inv-notes">${noteHTML}</div>
        <div class="seg" data-seg="mode" style="margin-top:10px"><button class="${managed ? '' : 'on'}" data-v="advice">Kararlar bende</button><button class="${managed ? 'on' : ''} ${manage.ok ? '' : 'locked'}" data-v="managed">${manage.ok ? '' : icon('lock', 'ico xs')} Menajer yönetsin</button></div>
        ${managed ? `
          <div class="seg" data-seg="profile" style="margin-top:8px">${Object.values(PROFILES).map((p) => `<button class="${v.profile === p.id ? 'on' : ''}" data-v="${p.id}">${p.name}</button>`).join('')}</div>
          <p class="muted small" style="margin:8px 0 6px">${esc(PROFILES[v.profile].desc)} Yönetim ücreti haftalık %${(MGMT_FEE * 100).toFixed(2).replace('.', ',')} (yılda ~%2); dengeleme komisyonları portföyden düşer.</p>
          <div class="chips">${planChips}</div>
          <div class="row" style="gap:8px;margin-top:10px"><button class="btn primary grow" data-act="plan-add">${icon('plus')} Para ekle</button><button class="btn grow" data-act="plan-out" ${sum.value > 0 ? '' : 'disabled'}>${icon('download')} Para çek</button></div>`
        : manage.ok ? '' : `<p class="muted small" style="margin:8px 0 0">${esc(manage.reason)}</p><button class="btn ghost block sm" style="margin-top:8px" data-act="agent">${icon('handshake')} Menajer seç</button>`}
      </div>

      <div class="card inv-auto">
        <div class="row between"><b>Maaştan otomatik yatırım</b><span class="muted small">her hafta</span></div>
        <p class="muted small" style="margin:4px 0 8px">Net maaşının seçtiğin kadarı hafta sonu ${managed ? 'menajerinin planına eklenir' : 'seçtiğin varlığa yatırılır'}.</p>
        <div class="seg" data-seg="auto">${AUTO_PCTS.map((p) => `<button class="${v.auto.pct === p ? 'on' : ''}" data-v="${p}">${p ? `%${Math.round(p * 100)}` : 'Kapalı'}</button>`).join('')}</div>
        ${!managed && v.auto.pct > 0 ? `<div class="seg wrap" data-seg="target">${assets.map((a) => `<button class="${v.auto.target === a.id ? 'on' : ''}" data-v="${a.id}">${esc(a.kind === 'fan' ? assetTicker(s, a) : a.name.split(' ')[0])}</button>`).join('')}</div>` : ''}
      </div>

      <div class="h-sec">Piyasa <span>fiyatlar hafta sonu güncellenir</span></div>
      <div class="card inv-market">${rows}</div>

      ${tx ? `<div class="h-sec">Son işlemler</div><div class="card list">${tx}</div>` : ''}
      <p class="muted small center" style="margin-top:14px">Oyun içi sanal piyasadır: tüm varlıklar kurgusaldır, gerçek para ya da gerçek kripto paralarla ilgisi yoktur.</p>`,
    mount(node) {
      node.addEventListener('click', async (e) => {
        const segBtn = e.target.closest('[data-seg] button');
        if (segBtn) return onSeg(segBtn);
        const t = e.target.closest('[data-asset],[data-act]');
        if (!t || t.disabled) return;
        app.click();
        if (t.dataset.asset) {
          if (await tradeSheet(app, t.dataset.asset)) app.go('invest', { from: back });
          return;
        }
        const act = t.dataset.act;
        if (act === 'back') return app.go(back);
        if (act === 'agent') return app.go('agent');
        if (act === 'plan-add' || act === 'plan-out') {
          if (await planSheet(app, act === 'plan-add' ? 'add' : 'out')) app.go('invest', { from: back });
        }
      });

      async function onSeg(b) {
        const seg = b.parentElement.dataset.seg;
        const val = b.dataset.v;
        sfx('tick');
        if (seg === 'mode') {
          if (val === v.mode) return;
          if (val === 'managed') {
            if (!manage.ok) return toast(manage.reason, 'bad');
            const ok = await app.confirm(
              `${ag.name.split(' ')[0]} portföyünü yönetsin`,
              `Kripto ve fonlardaki yatırımların ${PROFILES[v.profile].name.toLocaleLowerCase('tr')} plana göre dağıtılır, her hafta gerekirse dengelenir. Yönetim ücreti yılda yaklaşık %2. Taraftar tokenin yönetime dahil değildir.`,
              'Yönetsin',
              'primary',
            );
            if (!ok) return;
          }
          const r = setMode(s, val);
          if (!r.ok) return toast(r.text, 'bad');
          app.save();
          toast(val === 'managed' ? `${ag.name.split(' ')[0]} portföyünü devraldı.` : 'Kararlar artık sende.', 'good');
        } else if (seg === 'profile') {
          if (val === v.profile) return;
          setMode(s, 'managed', val);
          app.save();
          toast(`${PROFILES[val].name} plana geçildi; portföy yeniden dengelendi.`, 'good');
        } else if (seg === 'auto') {
          v.auto.pct = Number(val);
          if (v.auto.pct && !managed && !ASSET_BY_ID[v.auto.target]) v.auto.target = 'ENDX';
          app.save();
        } else if (seg === 'target') {
          v.auto.target = val;
          app.save();
        }
        app.go('invest', { from: back });
      }
    },
  };
}

// ─────────────────────────── Al / sat penceresi ───────────────────────────
async function tradeSheet(app, id) {
  const s = app.state;
  const v = ensureInvest(s);
  const a = ASSET_BY_ID[id];
  const hist = v.hist[id] || [];
  const ch = weekChange(hist);
  const price = v.prices[id];
  const h = v.holdings[id];
  const value = h ? h.qty * price : 0;
  const can = canTrade(s, id);
  const ag = currentAgent(s);
  const first = ag.id === 'self' ? 'İç sesin' : ag.name.split(' ')[0];
  const st = { side: 'buy', amount: Math.min(s.career.money, Math.max(MIN_TRADE, Math.round(s.career.money * 0.1))), frac: 1 };
  const color = a.color;

  const res = await sheet({
    html: `
      <div class="row" style="gap:12px">${coinBadge(s, a, 46)}<div class="grow" style="min-width:0"><b class="inv-sh-name">${esc(assetName(s, a))}</b><div class="muted small">${esc(assetTicker(s, a))} · ${esc(KIND_LABEL[a.kind])} · Risk: ${RISK_LABEL[a.risk]}</div></div>
        <div class="inv-px big"><b class="tnum">${fmtPrice(price)}</b><em class="${tone(ch)}">${investPct(ch)} hf</em></div></div>
      ${bigChart(hist, color)}
      <p class="small" style="margin:8px 0">${esc(a.desc)} <span class="muted">İşlem komisyonu %${(a.fee * 100).toLocaleString('tr-TR')}.</span></p>
      ${h ? `<div class="card inv-hold">
        <div><span>Miktar</span><b class="tnum">${fmtQty(h.qty)} ${esc(assetTicker(s, a))}</b></div>
        <div><span>Değer</span><b class="tnum">${money(value)}</b></div>
        <div><span>Ort. maliyet</span><b class="tnum">${fmtPrice(h.cost / h.qty)}</b></div>
        <div><span>Kâr/zarar</span><b class="${tone(value - h.cost)}">${signMoney(value - h.cost)} (${investPct(h.cost ? value / h.cost - 1 : 0)})</b></div>
      </div>` : ''}
      ${can.ok ? `
        <div class="seg" data-side style="margin-top:12px"><button class="on" data-v="buy">Al</button><button data-v="sell" ${h ? '' : 'disabled'}>Sat</button></div>
        <div data-panel="buy">
          <div class="inv-amt"><span>€</span><input type="number" inputmode="numeric" min="${MIN_TRADE}" step="50" data-amt value="${st.amount}"></div>
          <input type="range" class="inv-range" min="0" max="${Math.max(MIN_TRADE, Math.floor(s.career.money))}" step="1" data-range value="${st.amount}">
          <div class="chips inv-pre">${[[0.1, '%10'], [0.25, '%25'], [0.5, '%50'], [1, 'Tümü']].map(([f, l]) => `<button class="chip" data-pre="${f}">${l}</button>`).join('')}<span class="muted small">Kasa ${money(s.career.money)}</span></div>
        </div>
        <div data-panel="sell" hidden>
          <div class="chips inv-pre">${[[0.25, '%25'], [0.5, '%50'], [0.75, '%75'], [1, 'Tümü']].map(([f, l]) => `<button class="chip ${f === 1 ? 'on' : ''}" data-sfrac="${f}">${l}</button>`).join('')}</div>
        </div>
        <div class="card inv-preview" data-preview></div>
        <div class="inv-warn" data-warn hidden></div>
        <div class="stack" style="margin-top:12px">
          <button class="btn primary block" data-close="ok" data-go>Onayla</button>
          <button class="btn ghost block" data-close="cancel">Vazgeç</button>
        </div>`
      : `<p class="muted small">${esc(can.reason)}</p><button class="btn block" data-close="cancel">Kapat</button>`}`,
    onMount(node) {
      if (!can.ok) return;
      const amt = node.querySelector('[data-amt]');
      const range = node.querySelector('[data-range]');
      const preview = node.querySelector('[data-preview]');
      const warn = node.querySelector('[data-warn]');
      const go = node.querySelector('[data-go]');
      const render = () => {
        if (st.side === 'buy') {
          const amount = Math.floor(st.amount || 0);
          const fee = amount * a.fee;
          const okAmt = amount >= MIN_TRADE && amount <= s.career.money;
          preview.innerHTML = `<div class="row between small"><span class="muted">Alacağın miktar</span><b class="tnum">≈ ${fmtQty(Math.max(0, amount - fee) / price)} ${esc(assetTicker(s, a))}</b></div>
            <div class="row between small"><span class="muted">Komisyon</span><b class="tnum">${money(fee)}</b></div>
            <div class="row between small"><span class="muted">İşlem sonrası kasa</span><b class="tnum">${money(s.career.money - amount)}</b></div>`;
          go.disabled = !okAmt;
          go.textContent = okAmt ? `${money(amount)} ile al` : amount > s.career.money ? 'Kasan yetmiyor' : `En az ${money(MIN_TRADE)}`;
          const wealth = s.career.money + portfolioValue(s);
          let w = '';
          if (a.kind === 'meme' && amount > wealth * 0.05) w = 'Meme coin\'ler bir gecede sıfırlanabilir. Kaybetmeyi göze alabileceğin kadar koy.';
          else if (a.kind !== 'deposit' && s.career.money - amount < weeklyCost(s) * 4) w = 'Bu alımdan sonra kasanda 4 haftalık giderden az para kalıyor.';
          else if ((a.kind === 'crypto' || a.kind === 'meme') && amount > wealth * 0.4) w = 'Servetinin büyük kısmını tek bir kripto paraya koyuyorsun. Çeşitlendirmeyi düşün.';
          warn.hidden = !w;
          warn.innerHTML = w ? `<b>${esc(first)}:</b> ${esc(w)}` : '';
        } else {
          const q = h.qty * st.frac;
          const gross = q * price;
          const fee = gross * a.fee;
          const costPart = h.cost * st.frac;
          preview.innerHTML = `<div class="row between small"><span class="muted">Satılacak</span><b class="tnum">${fmtQty(q)} ${esc(assetTicker(s, a))}</b></div>
            <div class="row between small"><span class="muted">Eline geçecek</span><b class="tnum">${money(gross - fee)}</b></div>
            <div class="row between small"><span class="muted">Kâr/zarar</span><b class="${tone(gross - fee - costPart)}">${signMoney(gross - fee - costPart)}</b></div>`;
          go.disabled = false;
          go.textContent = `${money(gross - fee)} karşılığında sat`;
          warn.hidden = true;
        }
      };
      const setAmt = (x, from) => {
        st.amount = Math.max(0, Math.min(Math.floor(s.career.money), Math.floor(x || 0)));
        if (from !== 'input') amt.value = st.amount;
        if (from !== 'range') range.value = st.amount;
        render();
      };
      const clearPre = () => node.querySelectorAll('[data-pre]').forEach((x) => x.classList.remove('on'));
      amt.addEventListener('input', () => { clearPre(); setAmt(Number(amt.value), 'input'); });
      range.addEventListener('input', () => { clearPre(); setAmt(Number(range.value), 'range'); });
      node.addEventListener('click', (e) => {
        const sideB = e.target.closest('[data-side] button');
        if (sideB && !sideB.disabled) {
          st.side = sideB.dataset.v;
          sideB.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === sideB));
          node.querySelector('[data-panel="buy"]').hidden = st.side !== 'buy';
          node.querySelector('[data-panel="sell"]').hidden = st.side !== 'sell';
          sfx('tick');
          render();
        }
        const pre = e.target.closest('[data-pre]');
        if (pre) {
          sfx('tick');
          node.querySelectorAll('[data-pre]').forEach((x) => x.classList.toggle('on', x === pre));
          setAmt(Math.floor(s.career.money * Number(pre.dataset.pre)));
        }
        const sf = e.target.closest('[data-sfrac]');
        if (sf) {
          st.frac = Number(sf.dataset.sfrac);
          node.querySelectorAll('[data-sfrac]').forEach((x) => x.classList.toggle('on', x === sf));
          sfx('tick');
          render();
        }
      });
      render();
    },
  });
  if (res !== 'ok') return false;
  const r = st.side === 'buy' ? buy(s, id, st.amount) : sell(s, id, st.frac);
  app.save();
  if (!r.ok) { toast(r.text, 'bad'); return false; }
  sfx('coin');
  buzz([12, 30, 12]);
  if (st.side === 'buy') toast(`${fmtQty(r.qty)} ${assetTicker(s, a)} aldın.${r.note ? ` ${first}: "${r.note.text.slice(0, 90)}${r.note.text.length > 90 ? '…' : ''}"` : ''}`, r.note ? 'warn' : 'good');
  else toast(`${money(r.net)} kasaya geçti (${signMoney(r.pnl)}).`, r.pnl >= 0 ? 'good' : 'bad');
  return true;
}

// ─────────────────────────── Menajer planı: para ekle / çek ───────────────────────────
async function planSheet(app, kind) {
  const s = app.state;
  const ag = currentAgent(s);
  const V = portfolioValue(s, Object.keys(ASSET_BY_ID).filter((id) => id !== 'FAN'));
  const max = Math.floor(kind === 'add' ? s.career.money : V);
  const st = { amount: Math.min(max, Math.max(MIN_TRADE, Math.round(max * 0.25))) };
  const res = await sheet({
    center: true,
    html: `
      <div class="row" style="gap:12px">${agentAvatar(ag, 44)}<div class="grow"><b>${kind === 'add' ? 'Plana para ekle' : 'Plandan para çek'}</b><div class="muted small">${esc(ag.name)} · ${esc(PROFILES[ensureInvest(s).profile].name)} plan</div></div></div>
      <div class="inv-amt" style="margin-top:12px"><span>€</span><input type="number" inputmode="numeric" min="${MIN_TRADE}" step="50" data-amt value="${st.amount}"></div>
      <div class="chips inv-pre">${[[0.1, '%10'], [0.25, '%25'], [0.5, '%50'], [1, 'Tümü']].map(([f, l]) => `<button class="chip" data-pre="${f}">${l}</button>`).join('')}<span class="muted small">${kind === 'add' ? 'Kasa' : 'Yönetilen'} ${money(max)}</span></div>
      <p class="muted small">${kind === 'add' ? 'Tutar planın ağırlıklarına göre dağıtılır; varlıkların komisyonu düşülür.' : 'Her varlıktan orantılı satılır; komisyon düşülür.'}</p>
      <div class="stack" style="margin-top:10px"><button class="btn primary block" data-close="ok">Onayla</button><button class="btn ghost block" data-close="cancel">Vazgeç</button></div>`,
    onMount(node) {
      const amt = node.querySelector('[data-amt]');
      amt.addEventListener('input', () => { st.amount = Math.max(0, Math.min(max, Math.floor(Number(amt.value) || 0))); });
      node.addEventListener('click', (e) => {
        const pre = e.target.closest('[data-pre]');
        if (!pre) return;
        sfx('tick');
        st.amount = Math.floor(max * Number(pre.dataset.pre));
        amt.value = st.amount;
      });
    },
  });
  if (res !== 'ok') return false;
  const r = kind === 'add' ? addToPlan(s, st.amount) : withdrawPlan(s, st.amount);
  app.save();
  if (!r.ok) { toast(r.text, 'bad'); return false; }
  sfx('coin');
  toast(kind === 'add' ? `${money(st.amount)} plana eklendi.` : `${money(r.net)} kasaya geçti.`, 'good');
  return true;
}
