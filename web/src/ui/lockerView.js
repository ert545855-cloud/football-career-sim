// SOYUNMA ODASI, HOCA VE BASIN — ekran, ana sayfa kartı ve akışlar.
import { CLUB_BY_ID } from '../core/data.js';
import { attitudeBar } from './attitudeView.js';
import { attitudeOf } from '../core/attitude.js';
import { ROLES, STYLES, canAskRole, ensureCoach, requestRole, roleInfo, securityLabel } from '../core/coach.js';
import { armband, canChat, chatWith, chooseLocker, ensureLocker, moodLabel, teamMood, teammates } from '../core/locker.js';
import { TONES, answerPress } from '../core/press.js';
import { icon } from './art.js';
import { animateBars, esc, sheet, toast } from './dom.js';
import { changeChips, meter } from './components.js';
import { squadAvatar } from './mentorView.js';
import { sfx, buzz } from '../audio.js';

const POS_SPOTS = {
  // dizilişteki konumlar (x,y yüzde; aşağı = kendi kalemiz)
  '4-3-3': [[50, 92], [15, 72], [38, 76], [62, 76], [85, 72], [30, 52], [50, 58], [70, 52], [18, 26], [50, 18], [82, 26]],
  '4-2-3-1': [[50, 92], [15, 72], [38, 76], [62, 76], [85, 72], [38, 58], [62, 58], [18, 36], [50, 38], [82, 36], [50, 16]],
  '4-4-2': [[50, 92], [15, 72], [38, 76], [62, 76], [85, 72], [15, 48], [38, 52], [62, 52], [85, 48], [38, 20], [62, 20]],
  '3-5-2': [[50, 92], [28, 76], [50, 78], [72, 76], [10, 50], [32, 54], [50, 46], [68, 54], [90, 50], [38, 20], [62, 20]],
  '4-1-4-1': [[50, 92], [15, 72], [38, 76], [62, 76], [85, 72], [50, 62], [15, 44], [38, 46], [62, 46], [85, 44], [50, 18]],
};
/** Oyuncunun dizilişteki noktası (rol + mevki): role uygun hedef noktaya en yakın diziliş noktası */
const ROLE_TARGET = {
  poacher: [50, 14], target: [50, 14], false9: [50, 24], winger: [85, 24],
  playmaker: [50, 55], b2b: [62, 52], anchor: [50, 64], ten: [50, 38],
  stopper: [40, 78], libero: [50, 80], fullback: [88, 66],
};
function mySpot(formation, pos, role) {
  const f = (POS_SPOTS[formation] || POS_SPOTS['4-3-3']).slice(1);
  const t = ROLE_TARGET[role] || { FW: [50, 16], MF: [50, 55], DF: [40, 78] }[pos] || [50, 50];
  return f.reduce((a, b) => (Math.hypot(b[0] - t[0], b[1] - t[1]) < Math.hypot(a[0] - t[0], a[1] - t[1]) ? b : a));
}

function formationSVG(c, pos) {
  const f = POS_SPOTS[c.formation] || POS_SPOTS['4-3-3'];
  const me = mySpot(c.formation, pos, c.role);
  const dots = f.map(([x, y]) => {
    const mine = x === me[0] && y === me[1];
    return `<circle cx="${x}" cy="${y}" r="${mine ? 5.2 : 3.6}" fill="${mine ? '#c6ff3d' : 'rgba(255,255,255,.75)'}" ${mine ? 'stroke="#0b1a05" stroke-width="1.2"' : ''}/>`;
  }).join('');
  return `<svg class="form-svg" viewBox="0 0 100 100" aria-label="Diziliş ${esc(c.formation)}">
    <rect x="2" y="2" width="96" height="96" rx="4" fill="#1d6b35" stroke="rgba(255,255,255,.4)"/>
    <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(255,255,255,.35)"/><circle cx="50" cy="50" r="9" fill="none" stroke="rgba(255,255,255,.35)"/>
    <rect x="30" y="84" width="40" height="14" fill="none" stroke="rgba(255,255,255,.35)"/><rect x="30" y="2" width="40" height="14" fill="none" stroke="rgba(255,255,255,.35)"/>
    ${dots}</svg>`;
}

/** Ana sayfa kartı */
export function hubLockerCard(state) {
  const c = ensureCoach(state);
  if (!c) return '';
  const mood = teamMood(state);
  const r = roleInfo(state.player.position, c.role);
  const arm = armband(state);
  return `<button class="card locker-card" data-act="locker">
    <span class="lk-ic">${icon('users')}</span>
    <span class="grow" style="min-width:0;text-align:left"><b>Soyunma Odası</b><span class="muted small ellipsis" style="display:block">Hoca ${esc(c.name)} · ${esc(c.formation)} · Rolün: ${esc(r.name)}</span></span>
    <span class="chip ${mood >= 58 ? 'good' : mood < 42 ? 'bad' : ''}">${esc(moodLabel(mood))}</span>
    ${arm ? `<span class="chip gold">${arm === 'captain' ? 'Kaptan' : 'Yrd. Kaptan'}</span>` : ''}
  </button>`;
}

export function lockerScreen(app) {
  const s = app.state;
  const c = ensureCoach(s);
  const l = ensureLocker(s);
  const st = STYLES[c.style];
  const r = roleInfo(s.player.position, c.role);
  const sec = securityLabel(c.security);
  const mood = teamMood(s);
  const arm = armband(s);
  const tms = teammates(s);
  const likes = Math.round(c.likes || 0);
  const list = tms.map((t) => `<button class="li tm" data-tm="${esc(t.id)}">
      ${squadAvatar(t, s.career.clubId, 'sm')}
      <div class="grow" style="min-width:0;text-align:left"><b class="ellipsis" style="display:block">${esc(t.name)}${t.role === 'captain' ? ' <span class="chip xs gold">K</span>' : ''}</b>
        <span class="muted small">${esc(t.position)} · ${t.age} yaş · ${esc(t.roleLabel)}</span>
        <div class="bar" style="margin-top:5px;height:5px"><i style="--c:${t.rel >= 65 ? 'var(--good)' : t.rel >= 40 ? '#38bdf8' : 'var(--bad)'}" data-w="${t.rel}"></i></div></div>
      <span class="tnum small muted">${t.rel}</span></button>`).join('');
  const log = l.log.slice(0, 5).map((x) => `<div class="li"><span class="news-dot info"></span><div class="grow small"><b>${esc(x.title)}</b> · ${esc(x.text)}</div><span class="muted small">H${x.w}</span></div>`).join('');
  const hist = (s.coachHistory || []).filter((h) => h.clubId === s.career.clubId).slice(0, 4).map((h) => `<div class="li small"><span class="grow">${esc(h.name)}</span><span class="muted">S${h.until.s}·H${h.until.w} · ${h.reason === 'results' ? 'kovuldu' : h.reason === 'season' ? 'sezon sonu ayrıldı' : 'ayrıldı'}</span></div>`).join('');

  return {
    tabs: 'home',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Soyunma Odası</h1>
        ${arm ? `<span class="chip gold">${icon('crown', 'ico xs')} ${arm === 'captain' ? 'Kaptansın' : 'Yardımcı kaptan'}</span>` : ''}
      </div>

      <div class="card coach-card" style="margin-top:12px">
        <div class="row" style="gap:12px;align-items:flex-start">
          ${formationSVG(c, s.player.position)}
          <div class="grow" style="min-width:0">
            <div class="muted small">Teknik direktör</div>
            <b style="font-size:18px">${esc(c.name)}</b>
            <div class="chips" style="margin-top:6px"><span class="chip accent">${esc(st.name)}</span><span class="chip">${esc(c.formation)}</span><span class="chip ${sec.tone}">${esc(sec.text)}</span></div>
            <p class="muted small" style="margin:6px 0 0">${esc(st.desc)}</p>
          </div>
        </div>
        <div class="divider" style="margin:12px 0"></div>
        <div class="row between"><div><div class="muted small">Rolün</div><b>${esc(r.name)}</b></div><span class="chip ${likes >= 4 ? 'good' : likes <= -4 ? 'bad' : ''}">Hoca sana: ${likes >= 4 ? 'güveniyor' : likes <= -4 ? 'mesafeli' : 'nötr'}</span></div>
        <p class="muted small" style="margin:4px 0 10px">${esc(r.desc)}</p>
        <button class="btn ghost block" data-act="role" ${canAskRole(s) ? '' : 'disabled'}>${icon('clipboard')} ${canAskRole(s) ? 'Rol değişikliği iste' : 'Hocayla yakın zamanda konuştun'}</button>
      </div>

      <div class="card" style="margin-top:12px;display:grid;gap:10px">
        ${meter('Takım havası', 'smile', mood, 100, mood >= 58 ? 'var(--good)' : mood >= 42 ? '#38bdf8' : 'var(--bad)', moodLabel(mood))}
        ${meter('Koltuk güvencesi (hoca)', 'shield', c.security, 100, c.security >= 45 ? 'var(--good)' : c.security >= 25 ? '#f59e0b' : 'var(--bad)')}
      </div>

      <div class="h-sec">Takım arkadaşları <span>${canChat(s) ? 'Sohbet: 1 hak' : 'Sohbet: kullanıldı'}</span></div>
      <div class="card list">${list || '<p class="muted small">Kadro bilgisi yok.</p>'}</div>
      ${log ? `<div class="h-sec">Soyunma odasından</div><div class="card list">${log}</div>` : ''}
      ${hist ? `<div class="h-sec">Eski hocalar</div><div class="card list">${hist}</div>` : ''}
      <div style="height:16px"></div>`,
    mount(node) {
      animateBars(node);
      node.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act],[data-tm]');
        if (!b || b.disabled) return;
        app.click();
        if (b.dataset.act === 'back') return app.go('hub');
        if (b.dataset.act === 'role') { await roleSheet(app); return app.go('locker'); }
        if (b.dataset.tm) {
          if (!canChat(s)) { toast('Bu hafta zaten bir sohbet ettin.', 'bad'); return; }
          const tm = tms.find((t) => t.id === b.dataset.tm);
          const go = await sheet({ center: true, html: `<div class="center">${squadAvatar(tm, s.career.clubId, 'lg')}</div><h3 class="center">${esc(tm.name)}</h3><p class="lead center">${esc(tm.position)} · ${tm.age} yaş · İlişki ${tm.rel}</p><button class="btn primary block" data-close="chat">${icon('coffee')} Sohbet et</button><button class="btn ghost block" style="margin-top:8px" data-close>Vazgeç</button>` });
          if (go !== 'chat') return;
          const r2 = chatWith(s, tm.id);
          app.save();
          sfx('coin');
          await sheet({ center: true, html: `<h3 class="center">Sohbet</h3><p class="lead center">${esc(r2.text)}</p>${changeChips([{ key: 'rel', label: tm.name, delta: r2.gain }, { key: 'teammates', label: 'Takım', delta: 1 }])}<button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>` });
          app.go('locker');
        }
      });
    },
  };
}

/** Rol değişikliği iste */
export async function roleSheet(app) {
  const s = app.state;
  const c = ensureCoach(s);
  const opts = Object.entries(ROLES[s.player.position] || {});
  const pick = await sheet({
    html: `<h3>Hangi rolde oynamak istiyorsun?</h3><p class="lead">Hoca ${esc(c.name)} ilişkinize ve rolün sana uygunluğuna göre karar verecek.</p>
      <div class="stack">${opts.map(([id, r]) => `<button class="btn block ${id === c.role ? 'ghost' : ''}" data-close="${id}" ${id === c.role ? 'disabled' : ''} style="text-align:left;justify-content:flex-start;height:auto;padding:10px 14px"><span><b>${esc(r.name)}</b>${id === c.role ? ' · şu anki rolün' : ''}<br><span class="muted small" style="font-weight:600">${esc(r.desc)}</span></span></button>`).join('')}</div>
      <button class="btn ghost block" style="margin-top:10px" data-close>Vazgeç</button>`,
  });
  if (!pick || !ROLES[s.player.position]?.[pick]) return;
  const r = requestRole(s, pick);
  app.save();
  if (r.accepted) { sfx('levelup'); buzz('pass'); } else sfx('error');
  await sheet({ center: true, html: `<h3 class="center">${r.accepted ? 'Rol değişti!' : 'Hoca ikna olmadı'}</h3><p class="lead center">${esc(r.text)}</p><button class="btn primary block" style="margin-top:12px" data-close>Tamam</button>` });
}

/** Haftalık soyunma odası olayı */
export async function lockerFlow(app) {
  const s = app.state;
  const p = s.pending.locker;
  if (!p) return;
  sfx('swish');
  const choice = await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center"><span class="chip accent">${icon('users', 'ico xs')} SOYUNMA ODASI</span></div>
      <h3 class="center" style="margin-top:8px">${esc(p.title)}</h3><p class="lead center">${esc(p.text)}</p>
      <div class="stack">${p.choices.map((c, i) => `<button class="btn block ${i === 0 ? 'primary' : ''}" data-close="${i}">${esc(c)}</button>`).join('')}</div>`,
  });
  const out = chooseLocker(s, Number(choice) || 0);
  app.save();
  if (!out) return;
  await sheet({ center: true, html: `<h3 class="center">${esc(out.title)}</h3><p class="lead center">${esc(out.note)}</p>${changeChips(out.changes)}<button class="btn primary block" style="margin-top:14px" data-close>Devam</button>` });
}

/** Hoca değişikliği bildirimi */
export async function coachChangeFlow(app) {
  const s = app.state;
  const cc = s.pending.coachChange;
  if (!cc) return;
  s.pending.coachChange = null;
  app.save();
  const st = STYLES[cc.coach.style];
  const r = roleInfo(s.player.position, cc.coach.role);
  sfx('whistle');
  await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center"><span class="chip bad">HOCA DEĞİŞTİ</span></div>
      <h3 class="center" style="margin-top:8px">${esc(cc.old.name)} gönderildi</h3>
      <p class="lead center">Yönetim kötü sonuçların ardından ${esc(CLUB_BY_ID[s.career.clubId].name)}'da değişikliğe gitti. Yeni teknik direktör <b>${esc(cc.coach.name)}</b>.</p>
      <div class="card" style="display:grid;gap:6px">
        <div class="row between small"><span class="muted">Oyun anlayışı</span><b>${esc(st.name)}</b></div>
        <div class="row between small"><span class="muted">Diziliş</span><b>${esc(cc.coach.formation)}</b></div>
        <div class="row between small"><span class="muted">Senin rolün</span><b>${esc(r.name)}</b></div>
        <div class="row between small"><span class="muted">Hocayla ilişkin</span><b>${s.player.rel.manager}</b></div>
      </div>
      <p class="muted small center" style="margin:10px 0 0">Yeni hocaya kendini baştan kanıtlamalısın. İlk maç öncesi basın seni bekliyor.</p>
      <button class="btn primary block" style="margin-top:14px" data-close>Anladım</button>`,
  });
}

/** Basın toplantısı: soru soru, üç tondan biri */
export async function pressFlow(app, match) {
  const s = app.state;
  const press = match.press;
  if (!press || match.pressDone) return;
  const answers = [];
  sfx('camera');
  for (let i = 0; i < press.qs.length; i++) {
    const q = press.qs[i];
    const tone = await sheet({
      center: true,
      dismissable: false,
      html: `<div class="center"><span class="chip">${icon('mic', 'ico xs')} ${esc(press.title)} · ${i + 1}/${press.qs.length}</span></div>
        <div class="press-q">${icon('mic')}<p>“${esc(q.q)}”</p></div>
        <div class="stack">${Object.entries(q.a).map(([t, a]) => `<button class="btn block press-a ${t}" data-close="${t}"><span class="pa-tone">${icon(TONES[t].icon, 'ico xs')} ${TONES[t].label}</span><span class="pa-text">${esc(a.text)}</span></button>`).join('')}</div>`,
    });
    answers.push(tone || 'humble');
    sfx('camera');
  }
  const out = answerPress(s, press, answers, match);
  match.pressDone = true;
  if (s.pending.match && s.pending.match.id === match.id) { s.pending.match.pressDone = true; if (match.big && s.pending.match.big) s.pending.match.big.nerves = match.big.nerves; }
  app.save();
  await sheet({
    center: true,
    html: `<h3 class="center">Basın toplantısı bitti</h3>
      ${out.headline ? `<div class="press-headline"><small>MANŞET</small><b>“${esc(out.headline)}”</b></div>` : '<p class="lead center">Sözlerin dengeli bulundu.</p>'}
      ${changeChips(out.changes)}
      ${out.nerves ? `<p class="muted small center" style="margin:8px 0 0">${out.nerves < 0 ? 'Özgüvenin heyecanını azalttı.' : 'Sözlerin ortamı gerdi: maçta heyecan daha yüksek.'}</p>` : ''}
      ${out.attShift ? `<div style="margin-top:12px">${attitudeBar(attitudeOf(s), { delta: out.attShift })}</div>` : ''}
      <button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
  });
}
