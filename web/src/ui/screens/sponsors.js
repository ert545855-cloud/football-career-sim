// SPONSORLAR EKRANI — gece şehrinde dev reklam panosu (en büyük markan + senin piksel pozun), marka imajı,
// aktif sözleşmeler, reklam çekimi, teklifler ve menajer yorumu.
import {
  BRAND_BY_ID, SPONSOR_RULES, acceptOffer, canShoot, declineOffer, ensureSponsors, finishShoot, offerAdvice, shootOptions,
} from '../../core/sponsors.js';
import { questsOn } from '../../core/quests.js';
import { playerLook } from '../../core/cosmetics.js';
import { money } from '../../core/economy.js';
import { buzz, sfx } from '../../audio.js';
import { icon } from '../art.js';
import { animateBars, esc, sheet, toast } from '../dom.js';
import { meter } from '../components.js';
import { runShoot, drawProduct } from '../../games/shoot.js';
import { blitSprite } from '../../games/gym.js';
import { R, seedRng, shadeHex } from '../../games/pixel/gymArt.js';
import { drawPixelText, pixelTextWidth } from '../../games/pixel/font.js';

const LW = 200;
const LH = 92;

function drawBillboard(c, t, o) {
  // gece gökyüzü + yıldızlar
  const g = c.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, '#0b1026');
  g.addColorStop(1, '#22184a');
  c.fillStyle = g;
  c.fillRect(0, 0, LW, LH);
  const r = seedRng(11);
  for (let i = 0; i < 40; i++) R(c, r() * LW, r() * 40, 1, 1, r() < 0.3 ? '#fde68a' : '#94a3b8');
  // uzak binalar
  for (let x = 0; x < LW; x += 8 + Math.floor(r() * 8)) {
    const h = 20 + Math.floor(r() * 40);
    const w = 7 + Math.floor(r() * 10);
    R(c, x, LH - 14 - h, w, h, r() < 0.5 ? '#1a1f3a' : '#141932');
    for (let yy = LH - 12 - h; yy < LH - 16; yy += 4) for (let xx = x + 1; xx < x + w - 1; xx += 3) if (r() < 0.35) R(c, xx, yy, 1, 2, '#f8d77a');
  }
  // pano: binanın tepesinde iskele + ışıklar
  const bx = 46;
  const by = 8;
  const bw = 108;
  const bh = 50;
  R(c, bx + 18, by + bh, 3, 24, '#2a2f45');
  R(c, bx + bw - 21, by + bh, 3, 24, '#2a2f45');
  R(c, bx - 2, by - 2, bw + 4, bh + 4, '#0f1222');
  const b = o.brand;
  const bg = c.createLinearGradient(bx, by, bx + bw, by + bh);
  bg.addColorStop(0, shadeHex(b.color, 0.25));
  bg.addColorStop(1, shadeHex(b.color, -0.3));
  c.fillStyle = bg;
  c.fillRect(bx, by, bw, bh);
  for (let x = bx; x < bx + bw; x += 6) R(c, x, by, 1, bh, 'rgba(255,255,255,0.05)');
  drawPixelText(c, b.logo, bx + 72, by + 8, b.ink, { scale: 2, align: 'center', shadow: 'rgba(0,0,0,0.35)' });
  drawPixelText(c, o.slogan, bx + 72, by + 30, b.ink, { align: 'center' });
  if (o.hasBrand) drawProduct(c, b.product, bx + 64, by + 38, b, 1);
  // oyuncu pozu (panodaki dev görsel)
  const frame = ['cheer', 'point', 'cross'][Math.floor(t / 3) % 3];
  blitSprite(c, o.look, 'down', frame, bx + 22, by + bh - 1, 1);
  // pano ışıkları
  for (let i = 0; i < 4; i++) {
    const lx = bx + 10 + i * 30;
    R(c, lx, by - 4, 4, 2, '#e5e7eb');
    const lg = c.createLinearGradient(0, by - 2, 0, by + 16);
    lg.addColorStop(0, 'rgba(255,248,220,0.22)');
    lg.addColorStop(1, 'rgba(255,248,220,0)');
    c.fillStyle = lg;
    c.fillRect(lx - 6, by - 2, 16, 18);
  }
  // sokak, lambalar, geçen araba
  R(c, 0, LH - 14, LW, 14, '#1b1d2b');
  R(c, 0, LH - 14, LW, 1, '#3a3f5c');
  for (let x = 4; x < LW; x += 16) R(c, x, LH - 6, 8, 1, '#f8fafc55');
  for (const lx of [16, 184]) {
    R(c, lx, LH - 40, 2, 26, '#3a3f5c');
    R(c, lx - 3, LH - 41, 8, 2, '#3a3f5c');
    R(c, lx - 2, LH - 39, 6, 1, '#fde68a');
  }
  const carX = ((t * 40) % (LW + 40)) - 30;
  R(c, carX, LH - 12, 22, 5, '#ef4444');
  R(c, carX + 4, LH - 15, 12, 4, '#b91c1c');
  R(c, carX + 5, LH - 14, 4, 2, '#93c5fd');
  R(c, carX + 11, LH - 14, 4, 2, '#93c5fd');
  R(c, carX + 3, LH - 7, 4, 2, '#111827');
  R(c, carX + 15, LH - 7, 4, 2, '#111827');
  R(c, carX + 21, LH - 11, 1, 2, '#fde68a');
}

/** Marka logosu: piksel yazı rozetinde */
function logoCanvas(brand) {
  const sc = 2;
  const w = pixelTextWidth(brand.logo) * sc + 10;
  const h = 5 * sc + 8;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.className = 'brand-logo';
  const c = cv.getContext('2d');
  c.fillStyle = brand.color;
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(0, h - 2, w, 2);
  drawPixelText(c, brand.logo, w / 2, 4, brand.ink, { scale: sc, align: 'center' });
  return cv;
}

export function sponsorsScreen(app, params = {}) {
  const s = app.state;
  const sp = ensureSponsors(s);
  const rel = s.player.rel.sponsor ?? 30;
  const top = sp.active.map((c) => BRAND_BY_ID[c.brandId]).sort((a, b) => b.base - a.base)[0];
  const look = playerLook(s);
  const shoot = canShoot(s);
  const opts = shootOptions(s);
  const back = params.from || 'hub';

  const contracts = sp.active.map((c) => {
    const b = BRAND_BY_ID[c.brandId];
    const pending = c.shootsReq - c.shootsDone;
    return `<article class="card sp-card" style="--bc:${b.color}">
      <div class="row between"><span data-logo="${b.id}"></span><span class="chip">${esc(b.catName)}</span></div>
      <div class="sp-grid">
        <div><span>Haftalık</span><b>${money(c.weekly)}</b></div>
        <div><span>Kalan</span><b>${c.weeksLeft} hf</b></div>
        <div><span>Gol primi</span><b>${c.perGoal ? money(c.perGoal) : '—'}</b></div>
        <div><span>Kazandırdığı</span><b>${money(c.paid + (c.goalsPaid || 0))}</b></div>
      </div>
      <div class="chips"><span class="chip ${pending ? 'warn' : 'good'}">${icon('camera', 'ico xs')} Çekim ${c.shootsDone}/${c.shootsReq}</span><span class="chip accent">${esc(b.perkText)}</span></div>
      ${pending ? `<button class="btn ${shoot.ok ? 'primary' : ''} block sm" style="margin-top:8px" data-shoot="${b.id}" ${shoot.ok ? '' : 'disabled'}>${shoot.ok ? `${icon('camera', 'ico sm')} Çekime git` : esc(shoot.reason)}</button>` : ''}
    </article>`;
  }).join('');

  const offers = sp.offers.map((o) => {
    const b = BRAND_BY_ID[o.brandId];
    return `<article class="card sp-card offer" style="--bc:${b.color}">
      <div class="row between"><span data-logo="${b.id}"></span><span class="chip ${o.renewal ? 'good' : 'gold'}">${o.renewal ? 'Yenileme' : 'Yeni teklif'}</span></div>
      <p class="small" style="margin:8px 0 6px">${esc(b.desc)}</p>
      <div class="sp-grid">
        <div><span>Haftalık</span><b>${money(o.weekly)}</b></div>
        <div><span>Süre</span><b>${o.weeks} hf</b></div>
        <div><span>İmza primi</span><b>${money(o.signBonus)}</b></div>
        <div><span>Gol primi</span><b>${o.perGoal ? money(o.perGoal) : '—'}</b></div>
      </div>
      <div class="chips"><span class="chip">${icon('camera', 'ico xs')} ${o.shootsReq} çekim zorunlu</span><span class="chip accent">${esc(b.perkText)}</span></div>
      <div class="bubble-advice" style="margin:10px 0">${esc(offerAdvice(s, o))}</div>
      <div class="row" style="gap:8px"><button class="btn primary grow" data-accept="${b.id}" ${sp.active.length >= SPONSOR_RULES.maxActive ? 'disabled' : ''}>${icon('handshake', 'ico sm')} İmzala</button><button class="btn ghost" data-decline="${b.id}">Reddet</button></div>
    </article>`;
  }).join('');

  const shootRows = opts.map((x) => {
    const b = x.brandId ? BRAND_BY_ID[x.brandId] : null;
    return `<button class="card sp-shoot ${shoot.ok ? '' : 'off'}" data-shoot="${x.brandId || 'local'}" ${shoot.ok ? '' : 'disabled'}>
      <span class="sp-dot" style="background:${b ? b.color : '#0ea5e9'}"></span>
      <span class="grow"><b>${esc(b ? b.name : 'Yerel reklam işi')}</b><span class="muted small">${x.pending ? 'Sözleşmedeki çekim · ' : b ? 'Ek çekim · ' : 'Tek seferlik · '}tahmini ${money(Math.round(x.fee * 0.75))}–${money(x.fee)}</span></span>
      ${icon('chev', 'ico sm')}
    </button>`;
  }).join('');

  const logRows = sp.log.slice(0, 6).map((l) => `<div class="li"><span class="news-dot info"></span><div class="grow small">${esc(l.text)}</div><span class="muted small">S${l.s}·H${l.w}</span></div>`).join('');

  const shootSec = `<div class="h-sec" id="sp-shoot">Reklam çekimi <span>−12 enerji · 1 zaman</span></div>
    ${opts.length ? `<div class="stack">${shootRows}</div>${shoot.ok ? '' : `<p class="muted small">${esc(shoot.reason)}</p>`}` : '<div class="card muted small">Reklam çekimi için ünün 20 olmalı ya da bir sponsorun olmalı.</div>'}`;

  return {
    tabs: back === 'hub' ? 'home' : 'career',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Sponsorlar</h1>
        <span class="chip gold">${money(sp.earned)} kazanıldı</span>
      </div>
      <div class="card sp-board" style="margin-top:12px"><canvas data-board aria-label="Reklam panosu"></canvas></div>
      <div class="card">
        ${meter('Marka imajı', 'briefcase', rel, 100, '#f472b6', Math.round(rel))}
        <p class="muted small" style="margin:6px 0 0">İmajın (Sponsor ilişkin) teklifleri ve ücreti belirler. İyi çekim, maçın oyuncusu, vakıf işleri artırır; kırmızı kart, kötü paylaşımlar ve yapılmayan çekimler düşürür.</p>
      </div>
      ${params.shoot ? shootSec : ''}
      <div class="h-sec">Sözleşmelerin <span>${sp.active.length}/${SPONSOR_RULES.maxActive}</span></div>
      ${contracts ? `<div class="stack">${contracts}</div>` : '<div class="card muted small">Henüz sponsorun yok. Ünün ve imajın arttıkça markalar sana gelecek.</div>'}
      ${offers ? `<div class="h-sec">Teklifler</div><div class="stack">${offers}</div>` : ''}
      ${params.shoot ? '' : shootSec}
      ${logRows ? `<div class="h-sec">Geçmiş</div><div class="card list">${logRows}</div>` : ''}
      <p class="muted small center" style="margin-top:12px">Markaların hepsi kurgusaldır.</p>`,
    mount(node) {
      animateBars(node);
      node.querySelectorAll('[data-logo]').forEach((n) => n.appendChild(logoCanvas(BRAND_BY_ID[n.dataset.logo])));
      const cv = node.querySelector('[data-board]');
      const cx = cv.getContext('2d');
      const off = document.createElement('canvas');
      off.width = LW;
      off.height = LH;
      const oc = off.getContext('2d');
      const brand = top || { logo: 'REKLAM ALANI', color: '#334155', ink: '#e2e8f0', product: 'can' };
      const slogan = top ? (top.cat === 'gear' ? 'HIZINI GÖSTER' : top.cat === 'drink' ? 'ENERJİN BİTMESİN' : top.cat === 'food' ? 'GOLÜN TADI' : top.cat === 'tech' ? 'HEP BAĞLI KAL' : 'YILDIZLARIN SEÇİMİ') : 'SENİ BEKLİYOR';
      const t0 = performance.now();
      const frame = () => {
        if (!cv.isConnected) return;
        const w = cv.clientWidth;
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        const h = Math.round((w * LH) / LW);
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = `${h}px`; }
        drawBillboard(oc, (performance.now() - t0) / 1000, { brand, look, slogan, hasBrand: !!top });
        cx.imageSmoothingEnabled = false;
        cx.drawImage(off, 0, 0, cv.width, cv.height);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      if (params.shoot) setTimeout(() => node.querySelector('#sp-shoot')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);

      node.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-act],[data-shoot],[data-accept],[data-decline]');
        if (!t || t.disabled) return;
        app.click();
        if (t.dataset.act === 'back') return app.go(back);
        if (t.dataset.accept) {
          const r = acceptOffer(s, t.dataset.accept);
          app.save();
          if (!r.ok) return toast(r.text, 'bad');
          sfx('coin');
          buzz([14, 40, 20]);
          toast(`${BRAND_BY_ID[t.dataset.accept].name} ile imzaladın!`, 'good');
          return app.go('sponsors', { from: back });
        }
        if (t.dataset.decline) {
          declineOffer(s, t.dataset.decline);
          app.save();
          return app.go('sponsors', { from: back });
        }
        if (t.dataset.shoot) {
          const brandId = t.dataset.shoot === 'local' ? null : t.dataset.shoot;
          const chk = canShoot(s);
          if (!chk.ok) return toast(chk.reason, 'bad');
          const res = await runShoot({ look: playerLook(s), brand: brandId ? BRAND_BY_ID[brandId] : null, skill: (s.player.rel.sponsor ?? 30) / 100, auto: app.autoplay });
          if (!res) return;
          const r = finishShoot(s, brandId, res.q);
          if (!r.ok) return toast(r.text, 'bad');
          questsOn(s, 'shoot', { brandId });
          app.save();
          sfx('coin');
          await sheet({
            center: true,
            html: `<h3 class="center">${esc(r.brand ? r.brand.name : 'Yerel reklam')} çekimi bitti</h3>
              <p class="lead center">${esc(res.label)}</p>
              <div class="chips" style="justify-content:center"><span class="chip gold">+${money(r.money)}</span><span class="chip ${r.rel > 0 ? 'good' : r.rel < 0 ? 'bad' : ''}">İmaj ${r.rel > 0 ? '+' : ''}${r.rel}</span><span class="chip good">Ün +${String(r.fame).replace('.', ',')}</span></div>
              <button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>`,
          });
          return app.go('sponsors', { from: back });
        }
      });
    },
  };
}
