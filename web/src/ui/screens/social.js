// SOSYAL YAŞAM EKRANI — mekânlar (kafe, bar, ev partisi), rehber (arkadaş, takım arkadaşı, flört), evim ve garaj.
import { money } from '../../core/economy.js';
import {
  SOCIAL_RULES, VENUES, canGoOut, homeOf, homeScore, outingsLeft, partnerOf, romanceAllowed, socialContacts, startOuting, venueTier,
} from '../../core/social/index.js';
import { buzz, sfx } from '../../audio.js';
import { avatarSVG, icon } from '../art.js';
import { animateBars, esc, sheet, toast } from '../dom.js';
import { SH, SW, drawScene } from '../pixelScenes.js';
import { outingResultSheets, playOuting, sceneOptsFor } from '../sceneView.js';
import { carName, carStats, currentCarId } from '../../core/garage.js';
import { CH, CW, drawCar } from '../carCanvas.js';
import { carLook } from './garage.js';
import { paintPhotos, tabloidSheet } from '../tabloidView.js';

let lastVenue = 'cafe';

const stars = (n) => `<span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(Math.max(0, 3 - n))}</i></span>`;

export function portraitHTML(p, cls = '') {
  return `<span class="npc-portrait ${cls}">${avatarSVG(p.look, { colors: p.clothes }, p.number ?? '')}</span>`;
}

function contactRow(c) {
  const col = c.kind === 'romance' ? '#f472b6' : c.kind === 'teammate' ? 'var(--accent)' : 'var(--blue)';
  return `<button class="contact" data-contact="${esc(c.id)}">
    ${portraitHTML(c, 'sm')}
    <span class="grow" style="min-width:0">
      <span class="row" style="gap:6px"><b class="ellipsis">${esc(c.name)}</b><span class="chip xs" style="--c:${col}">${c.partner ? '♥ Sevgilin' : esc(c.stage.label)}</span></span>
      <span class="muted small ellipsis" style="display:block">${esc(c.job)}</span>
      <span class="bar"><i style="--c:${col}" data-w="${c.value}"></i></span>
    </span>
    ${icon('chev', 'ico sm')}
  </button>`;
}

export function socialScreen(app) {
  const s = app.state;
  const left = outingsLeft(s);
  const partner = partnerOf(s);
  const contacts = socialContacts(s);
  const pc = partner ? contacts.find((c) => c.id === partner.id) : null;
  const hs = homeScore(s);
  const plan = homeOf(s);
  const venue = VENUES[lastVenue];
  const carId = currentCarId(s);
  const cs = carStats(s, carId);

  const tierCards = venue.tiers.map((t0) => {
    const t = venueTier(s, lastVenue, t0.id);
    const ok = canGoOut(s, lastVenue, t0.id, 'alone');
    return `<button class="venue ${ok.ok ? '' : 'off'}" data-tier="${t0.id}">
      <canvas width="${SW}" height="${SH}" data-thumb="${t0.id}" data-palette="${t.palette}"></canvas>
      <span class="venue-info">
        <b>${esc(t.name)}</b>
        ${stars(Math.max(1, t.prestige))}
        <span class="chips"><span class="chip">${icon('coin', 'ico xs')} ${money(t.price)}</span><span class="chip bad">${icon('bolt', 'ico xs')} ${t.energy}</span><span class="chip good">${icon('smile', 'ico xs')} +${t.morale}</span></span>
      </span>
    </button>`;
  }).join('');

  const log = (s.social.log || []).slice(0, 6).map((l) => `<div class="li"><span class="news-dot info"></span><div class="grow small">${esc(l.text)}</div><span class="muted small">S${l.s}·H${l.w}</span></div>`).join('');

  return {
    tabs: 'social',
    html: `
      <div class="row" style="gap:10px">
        <h1 class="h-title grow">Sosyal Yaşam</h1>
        <span class="chip ${left ? 'accent' : ''}">${icon('calendar', 'ico xs')} Bu hafta ${left}/${SOCIAL_RULES.maxOutingsPerWeek}</span>
      </div>

      ${pc ? `<div class="card partner-card" style="margin-top:12px">
        ${portraitHTML(pc, 'lg')}
        <div class="grow" style="min-width:0"><div class="muted small">♥ Sevgilin</div><b style="font-size:18px">${esc(pc.full)}</b><div class="muted small">${esc(pc.job)}</div>
          <div class="bar" style="margin-top:8px"><i style="--c:#f472b6" data-w="${pc.value}"></i></div>
          <div class="muted small" style="margin-top:4px">${esc(pc.stage.label)} · Haftada bir görüşmezseniz ilişki soğur.</div></div>
      </div>` : ''}

      <div class="h-sec">Mekânlar <span>Her çıkış 1 zaman hakkı</span></div>
      <div class="seg" data-venues>${Object.values(VENUES).map((v) => `<button class="${v.id === lastVenue ? 'on' : ''}" data-venue="${v.id}">${icon(v.icon, 'ico sm')} ${esc(v.name)}</button>`).join('')}</div>
      <p class="muted small" style="margin:8px 2px">${esc(venue.desc)}</p>
      <div class="venues">${tierCards}</div>

      <div class="h-sec">Rehber <span>${contacts.length} kişi</span></div>
      <div class="card list contacts">${contacts.map(contactRow).join('')}</div>
      ${romanceAllowed(s) ? (contacts.some((c) => c.kind === 'romance') ? '' : '<p class="muted small center">Kafeye ya da bara tek başına gidersen yeni biriyle tanışabilirsin.</p>') : `<p class="muted small center">${icon('lock', 'ico xs')} Flört ${SOCIAL_RULES.romanceMinAge} yaşından sonra açılır. Arkadaşların ve takım arkadaşlarınla her yaşta buluşabilirsin.</p>`}

      <div class="h-sec">Evim</div>
      <button class="card home-card" data-act="home">
        <canvas width="${SW}" height="${SH}" data-thumb="home1" data-palette="home"></canvas>
        <span class="grow" style="min-width:0;text-align:left">
          <b>${esc(plan.name)}</b>
          <span class="chips" style="margin-top:6px"><span class="chip">${icon('sofa', 'ico xs')} Konfor ${hs.comfort}</span><span class="chip gold">${icon('crown', 'ico xs')} Prestij ${hs.prestige}</span></span>
          <span class="muted small" style="display:block;margin-top:6px">Her hafta +${hs.weekly.energy} enerji, +${hs.weekly.morale} moral · Evini dizayn et ${icon('chev', 'ico xs')}</span>
        </span>
      </button>

      <div class="h-sec">Garaj</div>
      <button class="card home-card" data-act="garage">
        ${carId ? `<canvas width="${CW}" height="${CH}" data-car></canvas>` : `<span class="se-ic" style="width:64px;height:64px">${icon('car')}</span>`}
        <span class="grow" style="min-width:0;text-align:left">
          <b>${carId ? esc(carName(carId)) : 'Garajın boş'}</b>
          ${carId ? `<span class="chips" style="margin-top:6px"><span class="chip">${icon('wrench', 'ico xs')} ${cs.installed} modifiye</span><span class="chip gold">Stil ${cs.style}</span><span class="chip bad">Güç ${cs.perf}</span></span>` : ''}
          <span class="muted small" style="display:block;margin-top:6px">${carId ? 'Boya, jant, body kit, neon, motor' : 'Önce Mağaza › Araçlar\'dan bir araba al'} ${icon('chev', 'ico xs')}</span>
        </span>
      </button>

      ${(s.social.press || []).length ? `<div class="h-sec">Magazin arşivi <span>${s.social.press.length} haber</span></div>
      <div class="press-clips">${s.social.press.slice(0, 8).map((p, i) => `<button class="clip ${p.tone || ''}" data-press="${i}"><canvas data-photo="${esc(JSON.stringify({ venueId: p.venueId, palette: p.palette, personId: p.personId || null }))}"></canvas><span class="clip-mast">FLAŞ MAGAZİN · S${p.s} H${p.w}</span><b>${esc(p.headline)}</b></button>`).join('')}</div>` : ''}

      ${log ? `<div class="h-sec">Son etkinlikler</div><div class="card list">${log}</div>` : ''}`,
    mount(node) {
      animateBars(node);
      node.querySelectorAll('canvas[data-thumb]').forEach((cv) => {
        const id = cv.dataset.thumb;
        const venueId = id.startsWith('cafe') ? 'cafe' : id.startsWith('bar') ? 'bar' : 'home';
        drawScene(cv.getContext('2d'), 0.6, sceneOptsFor(s, venueId, cv.dataset.palette, null));
      });

      paintPhotos(node, s);
      const carCv = node.querySelector('canvas[data-car]');
      if (carCv && carId) drawCar(carCv.getContext('2d'), 0.4, carLook(s, carId));

      node.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-act],[data-venue],[data-tier],[data-contact],[data-press]');
        if (!t) return;
        app.click();
        if (t.dataset.press) {
          const p = s.social.press[Number(t.dataset.press)];
          if (p) await tabloidSheet(app, { text: p.sub, changes: [], press: p });
          return;
        }
        if (t.dataset.act === 'back') return app.go('hub');
        if (t.dataset.act === 'home') return app.go('home');
        if (t.dataset.act === 'garage') return app.go('garage');
        if (t.dataset.venue) {
          lastVenue = t.dataset.venue;
          return app.go('social');
        }
        if (t.dataset.tier) {
          const ok = canGoOut(s, lastVenue, t.dataset.tier, 'alone');
          if (!ok.ok) {
            sfx('error');
            return toast(ok.reason, 'bad');
          }
          const who = await pickCompanion(app, lastVenue, t.dataset.tier);
          if (who) await goOut(app, lastVenue, t.dataset.tier, who);
          return;
        }
        if (t.dataset.contact) {
          const r = await inviteSheet(app, t.dataset.contact);
          if (r) await goOut(app, r.venueId, r.tierId, t.dataset.contact);
        }
      });
    },
  };
}

/** Kiminle gidilecek? (mekâna uygun kişiler + yalnız) */
async function pickCompanion(app, venueId, tierId) {
  const s = app.state;
  const t = venueTier(s, venueId, tierId);
  const list = socialContacts(s);
  const rows = list.map((c) => {
    const ok = canGoOut(s, venueId, tierId, c.id);
    return `<button class="contact ${ok.ok ? '' : 'off'}" data-close="${ok.ok ? esc(c.id) : ''}" ${ok.ok ? '' : 'disabled'}>
      ${portraitHTML(c, 'sm')}
      <span class="grow" style="min-width:0"><b>${esc(c.name)}</b> <span class="muted small">${c.partner ? '♥ Sevgilin' : esc(c.stage.label)}</span>
      <span class="muted small ellipsis" style="display:block">${ok.ok ? esc(c.job) : esc(ok.reason)}</span></span>
    </button>`;
  }).join('');
  const alone = venueId !== 'home';
  const r = await sheet({
    html: `<h3>${esc(t.name)}</h3><p class="lead">Kimi davet edeceksin?</p>
      <div class="card list contacts">${rows}</div>
      ${alone ? `<button class="btn block" style="margin-top:10px" data-close="alone">${icon('user')} Tek başına git${romanceAllowed(s) ? ' · yeni biriyle tanışabilirsin' : ''}</button>` : ''}
      <button class="btn ghost block" style="margin-top:8px" data-close="">Vazgeç</button>`,
    onMount: (n) => animateBars(n),
  });
  return typeof r === 'string' && r ? r : null;
}

/** Kişiye tıklayınca: hangi mekâna davet edilsin? */
async function inviteSheet(app, contactId) {
  const s = app.state;
  const c = socialContacts(s).find((x) => x.id === contactId);
  if (!c) return null;
  const opts = [];
  for (const v of Object.values(VENUES)) {
    if (!c.venues.includes(v.id)) continue;
    for (const t0 of v.tiers) {
      const t = venueTier(s, v.id, t0.id);
      const ok = canGoOut(s, v.id, t0.id, c.id);
      opts.push(`<button class="btn block invite ${ok.ok ? '' : 'off'}" data-close="${v.id}|${t0.id}" ${ok.ok ? '' : 'disabled'}>
        ${icon(v.icon, 'ico sm')}<span class="grow" style="text-align:left">${esc(t.name)} <span class="muted small">${ok.ok ? '' : `· ${esc(ok.reason)}`}</span></span><span class="muted small">${money(t.price)}</span></button>`);
    }
  }
  const likes = c.likes.map((x) => ({ humble: 'alçakgönüllülük', funny: 'espri', deep: 'samimiyet', flirty: 'flört', cocky: 'özgüven', eye: 'dikkat' }[x])).join(', ');
  const r = await sheet({
    html: `<div class="center">${portraitHTML(c, 'lg')}</div>
      <h3 class="center">${esc(c.full || c.name)}</h3>
      <p class="muted small center" style="margin:0">${esc(c.job)}</p>
      <div class="chips" style="justify-content:center;margin:10px 0"><span class="chip">${c.partner ? '♥ Sevgilin' : esc(c.stage.label)} · ${c.value}/100</span>${c.value >= 25 ? `<span class="chip accent">Sever: ${esc(likes)}</span>` : '<span class="chip">Onu daha iyi tanımalısın</span>'}</div>
      <div class="stack">${opts.join('')}</div>
      <button class="btn ghost block" style="margin-top:8px" data-close="">Kapat</button>`,
  });
  if (typeof r !== 'string' || !r) return null;
  const [venueId, tierId] = r.split('|');
  return { venueId, tierId };
}

/** Buluşmayı oynat → sonuç → sosyal ekrana dön */
export async function goOut(app, venueId, tierId, companionId) {
  const s = app.state;
  const st = startOuting(s, { venueId, tierId, companionId });
  if (!st.ok) {
    sfx('error');
    toast(st.reason, 'bad');
    return;
  }
  sfx('swish');
  buzz(8);
  const result = await playOuting(app, st.outing);
  if (!result) return app.go('social');
  app.save();
  await outingResultSheets(app, result, st.outing);
  app.go('social');
}
