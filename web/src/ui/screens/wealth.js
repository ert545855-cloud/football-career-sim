// SERVET EKRANI — senin sokağın (piksel), toplam servet; sekmeler: İşletmeler · Emlak · Vakıf · Yatırım.
import { BIZ_TYPES, activeBiz, bizAdvice, bizValue, canOpen, ensureBusiness, estimate, openBusiness, sellBiz, setManager, setMarketing, upgradeBiz, visitBiz } from '../../core/business.js';
import {
  DISTRICT_BY_ID, PROP_TYPES, RENT_POLICY, REALTY_RULES, buyProperty, ensureRealty, propName, realtySummary, renovate, renovateCost, sellProperty, setRentPolicy,
} from '../../core/realestate.js';
import { FOUNDATION_RULES, PROJECTS, canFound, canStart, donate, ensureFoundation, found, foundationName, startProject } from '../../core/foundation.js';
import { portfolioValue } from '../../core/invest.js';
import { questsOn } from '../../core/quests.js';
import { seasonWeeks } from '../../core/calendar.js';
import { money } from '../../core/economy.js';
import { buzz, sfx } from '../../audio.js';
import { icon } from '../art.js';
import { animateBars, esc, sheet, toast } from '../dom.js';
import { meter } from '../components.js';
import { sparkline } from './invest.js';
import { drawBuilding, drawStreet } from '../wealthArt.js';

const TABS = [['biz', 'İşletmeler'], ['realty', 'Emlak'], ['fnd', 'Vakıf'], ['inv', 'Yatırım']];
const SW = 200;
const SH = 104;
const QUALITY = { iyi: ['güvenilir', 'good'], orta: ['normal', ''], sorunlu: ['riskli', 'warn'] };

const stars = (v) => `<span class="stars sm" aria-label="${v.toFixed(1)} puan">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(v) ? 'on' : ''}">★</i>`).join('')}</span>`;
const signed = (v) => `${v >= 0 ? '+' : ''}${money(v)}`;
const tone = (v) => (v > 0 ? 't-up' : v < 0 ? 't-down' : 't-flat');
const bld = (kind, o = {}) => `<canvas class="bld" data-bld="${kind}" ${o.label ? `data-label="${esc(o.label)}"` : ''} ${o.color ? `data-color="${o.color}"` : ''} ${o.tenant ? `data-tenant="${esc(o.tenant)}"` : ''}></canvas>`;

export function netWorth(s) {
  const biz = activeBiz(s).reduce((n, z) => n + bizValue(s, z), 0);
  const re = (s.realty?.owned || []).reduce((n, p) => n + p.value, 0);
  return Math.max(0, s.career.money) + portfolioValue(s) + biz + re;
}

const PROP_COLORS = ['#9a6b4f', '#64748b', '#0f766e', '#7c2d12', '#334155', '#6d28d9'];

export function wealthScreen(app, params = {}) {
  const s = app.state;
  const tab = params.tab || 'biz';
  const back = params.from || 'hub';
  ensureBusiness(s);
  const re = ensureRealty(s);
  const f = ensureFoundation(s);
  const biz = activeBiz(s);
  const assets = [
    ...biz.map((z) => ({ kind: z.type, label: z.type === 'boots' ? z.name.split(' ')[0].slice(0, 6) : null })),
    ...(f.name ? [{ kind: 'foundation', label: 'VAKIF' }] : []),
    ...re.owned.slice().sort((a, b) => b.value - a.value).map((p, i) => ({ kind: PROP_TYPES[p.type].art, color: PROP_COLORS[i % PROP_COLORS.length], tenant: p.tenant?.name })),
  ];

  let body = '';
  if (tab === 'biz') body = bizTab(s, biz);
  else if (tab === 'realty') body = realtyTab(s, re);
  else if (tab === 'fnd') body = fndTab(s, f);
  else body = invTab(s);

  return {
    tabs: back === 'hub' ? 'home' : 'career',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Servet</h1>
        <span class="chip gold" title="Nakit + yatırım + işletme ve mülk değerleri">${money(netWorth(s))}</span>
      </div>
      <div class="card w-street" style="margin-top:12px"><canvas data-street aria-label="Senin sokağın: işletmelerin, mülklerin ve vakfın"></canvas></div>
      <div class="seg w-tabs" style="margin-top:12px">${TABS.map(([id, n]) => `<button class="${id === tab ? 'on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>
      <div style="margin-top:12px">${body}</div>`,
    mount(node) {
      animateBars(node);
      // sokak
      const cv = node.querySelector('[data-street]');
      const cx = cv.getContext('2d');
      const off = document.createElement('canvas');
      off.width = SW;
      off.height = SH;
      const oc = off.getContext('2d');
      const t0 = performance.now();
      const frame = () => {
        if (!cv.isConnected) return;
        const w = cv.clientWidth;
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        const h = Math.round((w * SH) / SW);
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = `${h}px`; }
        drawStreet(oc, SW, SH, (performance.now() - t0) / 1000, assets);
        cx.imageSmoothingEnabled = false;
        cx.drawImage(off, 0, 0, cv.width, cv.height);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      // küçük bina resimleri: binanın yüksekliğine göre kırpılır, tam sayı ölçekle keskin büyütülür
      const BH = { cafe: 40, gym: 44, boots: 48, small: 28, mid: 48, tower: 80, shop: 34, villa: 32, foundation: 42 };
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      node.querySelectorAll('[data-bld]').forEach((c) => {
        const h = BH[c.dataset.bld] || 44;
        const o = document.createElement('canvas');
        o.width = 52;
        o.height = h + 2;
        drawBuilding(o.getContext('2d'), c.dataset.bld, 6, h, 1, { label: c.dataset.label, color: c.dataset.color, tenant: c.dataset.tenant });
        const k = Math.max(2, Math.round((h > 60 ? 1.15 : 1.6) * dpr));
        c.width = o.width * k;
        c.height = o.height * k;
        c.style.width = `${(o.width * k) / dpr}px`;
        c.style.height = `${(o.height * k) / dpr}px`;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(o, 0, 0, c.width, c.height);
      });
      node.addEventListener('click', (e) => onClick(app, e, tab, back));
      node.addEventListener('change', (e) => onClick(app, e, tab, back));
    },
  };
}

// ─────────────────────────── İşletmeler ───────────────────────────
function bizTab(s, list) {
  const mine = list.map((z) => {
    const T = BIZ_TYPES[z.type];
    const last = z.hist[z.hist.length - 1] ?? 0;
    const val = bizValue(s, z);
    return `<article class="card biz-card" style="--bc:${T.color}">
      <div class="row" style="gap:12px;align-items:flex-end">${bld(z.type, { label: z.type === 'boots' ? z.name.split(' ')[0].slice(0, 6) : null })}
        <div class="grow" style="min-width:0"><b class="biz-name">${esc(z.name)}</b><div class="muted small">${esc(T.name)} · seviye ${z.level}/3</div>${stars(z.rating)}</div>
        <div class="biz-last"><span>Geçen hafta</span><b class="${tone(last)}">${signed(last)}</b></div></div>
      ${z.hist.length >= 2 ? `<div class="biz-spark">${sparkline(z.hist, { w: 300, h: 34, color: last >= 0 ? '#4ade80' : '#ff5d6c' })}</div>` : ''}
      <div class="sp-grid"><div><span>Toplam</span><b class="${tone(z.profit)}">${signed(z.profit)}</b></div><div><span>Değer</span><b>${money(val)}</b></div><div><span>Puan</span><b>${z.rating.toFixed(1).replace('.', ',')}</b></div><div><span>Hafta</span><b>${z.weeks}</b></div></div>
      <div class="muted small" style="margin-bottom:4px">Pazarlama</div>
      <div class="seg" data-mkt="${z.id}">${['Yok', 'Normal', 'Yoğun'].map((n, i) => `<button class="${z.marketing === i ? 'on' : ''}" data-v="${i}">${n}${T.mkt[i] ? ` · ${money(T.mkt[i])}` : ''}</button>`).join('')}</div>
      <label class="biz-toggle"><input type="checkbox" data-mgr="${z.id}" ${z.manager ? 'checked' : ''}> <span><b>Müdür</b> <span class="muted small">haftalık ${money(T.mgr)} · müşteri memnuniyeti artar, kötü olaylar azalır</span></span></label>
      <div class="chips" style="margin:6px 0 8px"><span class="chip accent">${esc(T.perk)}</span>${z.debtWeeks ? `<span class="chip bad">Borç ${z.debtWeeks}/4 hf</span>` : ''}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn sm grow" data-visit="${z.id}">${icon('users', 'ico sm')} Uğra (1 zaman)</button>
        ${z.level < 3 ? `<button class="btn sm grow" data-up="${z.id}">${icon('plus', 'ico sm')} Büyüt · ${money(T.upgrade[z.level])}</button>` : ''}
        <button class="btn ghost sm" data-sell="${z.id}">Sat · ${money(val)}</button>
      </div>
    </article>`;
  }).join('');
  const options = Object.values(BIZ_TYPES).filter((T) => !list.some((z) => z.type === T.id)).map((T) => {
    const c = canOpen(s, T.id);
    const est = estimate(s, T.id);
    return `<article class="card biz-card new" style="--bc:${T.color}">
      <div class="row" style="gap:12px;align-items:flex-end">${bld(T.id)}<div class="grow"><b class="biz-name">${esc(T.name)}</b><div class="muted small">Kuruluş ${money(T.cost)} · risk ${T.risk}</div>
      <div class="small" style="margin-top:4px">Tahmini haftalık <b class="${tone(est.mid)}">${signed(est.lo)} … ${signed(est.hi)}</b></div></div></div>
      <p class="small muted" style="margin:8px 0 6px">${esc(T.desc)}</p>
      <div class="chips"><span class="chip accent">${esc(T.perk)}</span></div>
      <div class="bubble-advice" style="margin:10px 0">${esc(bizAdvice(s, T.id))}</div>
      <button class="btn ${c.ok ? 'primary' : ''} block" data-open="${T.id}" ${c.ok ? '' : 'disabled'}>${c.ok ? `${icon('briefcase', 'ico sm')} ${esc(T.name)} kur` : esc(c.reason)}</button>
    </article>`;
  }).join('');
  const log = (s.business.log || []).slice(0, 6).map((l) => `<div class="li"><span class="news-dot info"></span><div class="grow small">${esc(l.text)}</div><span class="muted small">S${l.s}·H${l.w}</span></div>`).join('');
  return `${mine ? `<div class="stack">${mine}</div>` : '<div class="card muted small">Henüz bir işin yok. Kazancını büyütmek için bir işletme kurabilirsin; her hafta kâr ya da zarar eder.</div>'}
    ${options ? `<div class="h-sec">Yeni iş kur</div><div class="stack">${options}</div>` : ''}
    ${log ? `<div class="h-sec">Gelişmeler</div><div class="card list">${log}</div>` : ''}`;
}

// ─────────────────────────── Emlak ───────────────────────────
function realtyTab(s, re) {
  const sum = realtySummary(s);
  const wkLeft = Math.max(0, (re.listedAt || 0) + REALTY_RULES.refreshWeeks - ((s.calendar.season * 100) + s.calendar.week));
  const owned = re.owned.map((p, i) => {
    const T = PROP_TYPES[p.type];
    const gain = p.value - p.bought;
    const pol = RENT_POLICY[p.policy ?? 1];
    const q = p.tenant ? QUALITY[p.tenant.quality] : null;
    return `<article class="card re-card">
      <div class="row" style="gap:12px;align-items:flex-end">${bld(T.art, { color: PROP_COLORS[i % PROP_COLORS.length], tenant: p.tenant?.name })}
        <div class="grow" style="min-width:0"><b>${esc(T.name)}</b><div class="muted small">${esc(propName(p))}</div>
        <div class="small" style="margin-top:4px">Değer <b>${money(p.value)}</b> <em class="${tone(gain)}" style="font-style:normal">${signed(gain)}</em></div></div></div>
      <div class="re-tenant ${p.tenant ? '' : 'empty'}">${p.tenant
        ? `${icon('user', 'ico sm')}<span class="grow"><b>${esc(p.tenant.name)}</b> <span class="chip ${q[1]}">${q[0]}</span><br><span class="muted small">${money(p.tenant.rent)}/hf · ${p.tenant.weeksLeft} hf kaldı${p.tenant.late ? ` · ${p.tenant.late} gecikme` : ''}</span></span>`
        : `${icon('home', 'ico sm')}<span class="grow"><b>Boş</b> <span class="muted small">${p.vacant} haftadır · istenen ${money(Math.round(p.rent * pol.mult))}/hf</span></span>`}</div>
      ${meter('Bakım durumu', 'wrench', p.cond, 100, p.cond < 50 ? '#ff5d6c' : p.cond < 75 ? '#fbbf24' : '#4ade80', Math.round(p.cond))}
      <div class="muted small" style="margin:8px 0 4px">Kira politikası</div>
      <div class="seg" data-pol="${p.id}">${RENT_POLICY.map((x) => `<button class="${(p.policy ?? 1) === x.id ? 'on' : ''}" data-v="${x.id}">${x.name}</button>`).join('')}</div>
      <p class="muted small" style="margin:6px 0 8px">${pol.id === 0 ? 'Hızlı dolar, güvenilir kiracı gelir; gelir biraz düşük.' : pol.id === 2 ? 'Daha çok gelir ama geç dolar, riskli kiracı ihtimali yüksek.' : 'Piyasa fiyatı.'} Yeni kira bir sonraki kiracıda geçerli.</p>
      <div class="row" style="gap:8px">${p.cond < 95 ? `<button class="btn sm grow" data-reno="${p.id}">${icon('wrench', 'ico sm')} Yenile · ${money(renovateCost(p))}</button>` : ''}<button class="btn ghost sm grow" data-sellp="${p.id}">Sat · ${money(Math.round(p.value * 0.97))}</button></div>
    </article>`;
  }).join('');
  const listings = re.listings.map((l) => {
    const T = PROP_TYPES[l.type];
    const fee = Math.round(l.price * 0.04);
    const yld = (l.rent * seasonWeeks()) / l.price;
    const okMoney = s.career.money >= l.price + fee;
    return `<article class="card re-card listing">
      <div class="row" style="gap:12px;align-items:flex-end">${bld(T.art, { color: '#475569' })}
        <div class="grow" style="min-width:0"><b>${esc(T.name)}</b><div class="muted small">${esc(DISTRICT_BY_ID[l.district].name)} No:${l.no}</div>
        <div class="row between small" style="margin-top:4px"><span>Fiyat <b>${money(l.price)}</b></span><span class="muted">+ harç ${money(fee)}</span></div></div></div>
      <div class="sp-grid"><div><span>Kira (tahmini)</span><b>${money(l.rent)}/hf</b></div><div><span>Sezonluk getiri</span><b class="t-up">%${Math.round(yld * 100)}</b></div><div><span>Durum</span><b>%${l.cond}</b></div><div><span>Semt talebi</span><b>${DISTRICT_BY_ID[l.district].demand >= 1.1 ? 'Yüksek' : DISTRICT_BY_ID[l.district].demand >= 0.95 ? 'Orta' : 'Düşük'}</b></div></div>
      <button class="btn ${okMoney ? 'primary' : ''} block sm" data-buy="${l.lid}" ${okMoney && re.owned.length < REALTY_RULES.max ? '' : 'disabled'}>${okMoney ? `${icon('home', 'ico sm')} Satın al` : 'Kasan yetmiyor'}</button>
    </article>`;
  }).join('');
  return `<div class="card re-sum">
      <div class="sp-grid"><div><span>Mülk değeri</span><b>${money(sum.value)}</b></div><div><span>Değer artışı</span><b class="${tone(sum.gain)}">${signed(sum.gain)}</b></div><div><span>Haftalık kira</span><b>${money(sum.weeklyRent)}</b></div><div><span>Doluluk</span><b>${sum.occupied}/${sum.count}</b></div></div>
      <p class="muted small" style="margin:0">Kira geliri, aidat ve vergiler düşüldükten sonra her hafta kasana geçer. Arızalar ve sorunlu kiracılar masraf çıkarabilir.</p>
    </div>
    ${owned ? `<div class="h-sec">Mülklerin</div><div class="stack">${owned}</div>` : ''}
    <div class="h-sec">İlanlar <span>yeni ilanlar ${wkLeft || 1} hafta sonra</span></div>
    <div class="stack">${listings || '<div class="card muted small">Şu an ilan yok.</div>'}</div>
    <p class="muted small center" style="margin-top:10px">Semt ve mülk isimleri kurgusaldır.</p>`;
}

// ─────────────────────────── Vakıf ───────────────────────────
function fndTab(s, f) {
  if (!f.name) {
    const c = canFound(s);
    return `<article class="card fnd-card">
      <div class="row" style="gap:12px;align-items:flex-end">${bld('foundation', { label: 'VAKIF' })}<div class="grow"><b>${esc(foundationName(s))}</b><div class="muted small">Kuruluş: ${money(FOUNDATION_RULES.cost)} (vakfın ilk fonu olur) · ün ${FOUNDATION_RULES.minFame}+</div></div></div>
      <p class="small" style="margin:10px 0">Kendi vakfınla mahalle sahaları, burslar, kış kampanyaları ve futbol okulları kurarsın. Taraftar ilişkin, marka imajın ve ünün artar; biriken <b>miras puanı</b> iç saha maçlarında taraftar desteği verir (etkin yetenek +%3'e kadar) ve emeklilikten sonra efsane puanını yükseltir.</p>
      <button class="btn ${c.ok ? 'primary' : ''} block" data-found ${c.ok ? '' : 'disabled'}>${c.ok ? `${icon('heart', 'ico sm')} Vakfı kur` : esc(c.reason)}</button>
    </article>`;
  }
  const active = f.active.map((a) => {
    const P = PROJECTS[a.id];
    const pct = Math.round(((P.weeks - a.weeksLeft) / P.weeks) * 100);
    return `<div class="li"><span class="news-dot good"></span><div class="grow small"><b>${esc(P.name)}</b> · ${a.weeksLeft} hf kaldı<div class="qbar"><i style="width:${pct}%"></i></div></div></div>`;
  }).join('');
  const projects = Object.values(PROJECTS).filter((P) => !P.urgent || f.urgent?.id === P.id).map((P) => {
    const c = canStart(s, P.id);
    return `<article class="card fnd-proj ${P.urgent ? 'urgent' : ''}">
      <div class="row between"><b>${esc(P.name)}</b><span class="chip ${P.cost ? 'gold' : 'good'}">${P.cost ? money(P.cost) : P.raise ? 'Gelir getirir' : 'Ücretsiz'}</span></div>
      <p class="muted small" style="margin:4px 0 6px">${esc(P.desc)}</p>
      <div class="chips"><span class="chip">${P.weeks ? `${P.weeks} hf` : P.slot ? '1 zaman' : 'Anında'}</span><span class="chip accent">Taraftar +${P.fans}</span><span class="chip accent">İmaj +${P.image}</span><span class="chip accent">Miras +${P.legacy}</span>${P.kids ? `<span class="chip">${P.kids.toLocaleString('tr-TR')} çocuk</span>` : ''}</div>
      <button class="btn ${c.ok ? 'primary' : ''} block sm" style="margin-top:8px" data-proj="${P.id}" ${c.ok ? '' : 'disabled'}>${c.ok ? 'Başlat' : esc(c.reason)}</button>
    </article>`;
  }).join('');
  return `<article class="card fnd-card">
      <div class="row" style="gap:12px;align-items:flex-end">${bld('foundation', { label: 'VAKIF' })}<div class="grow"><b>${esc(f.name)}</b><div class="muted small">Kuruluş S${f.founded?.s}·H${f.founded?.w} · toplam bağış ${money(f.donated)}</div></div></div>
      <div class="sp-grid"><div><span>Fon</span><b>${money(f.fund)}</b></div><div><span>Miras</span><b>${f.legacy}</b></div><div><span>Ulaşılan çocuk</span><b>${f.kids.toLocaleString('tr-TR')}</b></div><div><span>Proje</span><b>${f.done.length}</b></div></div>
      <div class="muted small" style="margin-bottom:6px">Kasadan vakfa bağış</div>
      <div class="chips">${[5000, 25000, 100000].map((v) => `<button class="chip ${s.career.money >= v ? '' : 'off'}" data-donate="${v}">${money(v)}</button>`).join('')}</div>
    </article>
    ${f.urgent ? '<div class="card fnd-urgent"><b>⚠️ Acil çağrı</b><span class="small">Afet bölgesi yardım bekliyor. Aşağıdan "Afet bölgesine yardım" projesini başlatabilirsin.</span></div>' : ''}
    ${active ? `<div class="h-sec">Süren projeler</div><div class="card list">${active}</div>` : ''}
    <div class="h-sec">Projeler</div><div class="stack">${projects}</div>`;
}

function invTab(s) {
  const v = portfolioValue(s);
  return `<div class="card"><div class="row between"><span class="muted small">Yatırım portföyün</span><b>${money(v)}</b></div>
    <p class="muted small" style="margin:6px 0 10px">Kurgusal kripto paralar, endeks fonu, altın, vadeli hesap ve taraftar tokenin. Menajerin portföyünü takip eder.</p>
    <button class="btn primary block" data-act="invest">${icon('chart', 'ico sm')} Yatırım ekranına git</button></div>`;
}

// ─────────────────────────── etkileşim ───────────────────────────
async function onClick(app, e, tab, back) {
  const s = app.state;
  const go = (t = tab) => app.go('wealth', { tab: t, from: back });
  if (e.type === 'change') {
    const m = e.target.closest('[data-mgr]');
    if (m) { setManager(s, m.dataset.mgr, m.checked); app.save(); sfx('tick'); go(); }
    return;
  }
  const t = e.target.closest('[data-act],[data-tab],[data-mkt] button,[data-pol] button,[data-open],[data-visit],[data-up],[data-sell],[data-buy],[data-reno],[data-sellp],[data-found],[data-proj],[data-donate]');
  if (!t || t.disabled) return;
  app.click();
  if (t.dataset.act === 'back') return app.go(back);
  if (t.dataset.act === 'invest') return app.go('invest', { from: back });
  if (t.dataset.tab) return go(t.dataset.tab);
  const segM = t.closest('[data-mkt]');
  if (segM) { setMarketing(s, segM.dataset.mkt, Number(t.dataset.v)); app.save(); return go(); }
  const segP = t.closest('[data-pol]');
  if (segP) { setRentPolicy(s, segP.dataset.pol, Number(t.dataset.v)); app.save(); return go(); }
  const done = (r, okText, failSfx = true) => {
    app.save();
    if (!r.ok) { toast(r.text || r.reason, 'bad'); if (failSfx) sfx('error'); return false; }
    sfx('coin');
    buzz([12, 30, 12]);
    if (okText) toast(okText, 'good');
    go();
    return true;
  };
  if (t.dataset.open) {
    const T = BIZ_TYPES[t.dataset.open];
    if (!(await app.confirm(`${T.name} kur`, `${money(T.cost)} kasandan çıkacak. İşletme her hafta kâr ya da zarar eder; kasan ekside kalırsa iflas riski var.`, 'Kur', 'primary'))) return;
    return done(openBusiness(s, T.id), `${T.name} açıldı! İlk haftanın sonucu hafta sonunda.`);
  }
  if (t.dataset.visit) return done(visitBiz(s, t.dataset.visit), 'İşletmene uğradın: çalışanlar ve müşteriler mutlu.');
  if (t.dataset.up) return done(upgradeBiz(s, t.dataset.up), 'İşletmen büyüdü!');
  if (t.dataset.sell) {
    if (!(await app.confirm('İşletmeyi sat', 'Bu işletmeyi şimdiki değerinden satacaksın. Geri dönüşü yok.', 'Sat'))) return;
    const r = sellBiz(s, t.dataset.sell);
    return done(r, r.ok ? `${money(r.value)} kasana geçti.` : '');
  }
  if (t.dataset.buy) {
    const r = buyProperty(s, t.dataset.buy);
    return done(r, r.ok ? 'Tapun hazır! Kiracı arayışı başladı.' : '');
  }
  if (t.dataset.reno) return done(renovate(s, t.dataset.reno), 'Mülk yenilendi: kira ve değer arttı.');
  if (t.dataset.sellp) {
    if (!(await app.confirm('Mülkü sat', 'Satışta %3 komisyon ödenir. Kiracı varsa sözleşmesi yeni sahibine devredilir.', 'Sat'))) return;
    const r = sellProperty(s, t.dataset.sellp);
    return done(r, r.ok ? `${money(r.net)} kasana geçti (${r.gain >= 0 ? 'kâr' : 'zarar'} ${money(Math.abs(r.gain))}).` : '');
  }
  if (t.hasAttribute('data-found')) {
    const r = found(s);
    if (r.ok) questsOn(s, 'charity', {});
    return done(r, 'Vakfın kuruldu! Basında harika haberler var.');
  }
  if (t.dataset.donate) {
    const r = donate(s, Number(t.dataset.donate));
    if (r.ok) questsOn(s, 'charity', {});
    return done(r, 'Bağışın vakıf fonuna geçti.');
  }
  if (t.dataset.proj) {
    const r = startProject(s, t.dataset.proj);
    if (!r.ok) return done(r);
    questsOn(s, 'charity', { id: t.dataset.proj });
    app.save();
    sfx('levelup');
    await sheet({
      center: true,
      html: `<h3 class="center">${esc(r.P.name)}</h3><p class="lead center">${r.instant ? 'Tamamlandı! Taraftarlar ve basın çok olumlu.' : `Başladı: ${r.P.weeks} hafta sürecek.`}</p>
        <div class="chips" style="justify-content:center"><span class="chip good">Taraftar +${r.P.fans}</span><span class="chip good">İmaj +${r.P.image}</span><span class="chip good">Miras +${r.P.legacy}</span></div>
        <button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>`,
    });
    return go();
  }
}
