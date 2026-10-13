// SOSYAL SAHNE — tasarım referansındaki düzen: üstte bilgi çubuğu, ortada piksel sahne,
// altta kişinin kartı (portre + isim + söz) ve 4 cevap seçeneği.
import { CLUB_BY_ID } from '../core/data.js';
import { money } from '../core/economy.js';
import { TONES, answerOuting, finishOuting, homeScore } from '../core/social/index.js';
import { resolveSocialChoice } from '../core/social/events.js';
import { tabloidSheet } from './tabloidView.js';
import { buzz, sfx } from '../audio.js';
import { SH, SW, drawScene } from './pixelScenes.js';
import { sceneOptsFor } from './sceneOpts.js';

export { sceneOptsFor };
import { avatarSVG, crestSVG, icon } from './art.js';
import { changeChips } from './components.js';
import { el, esc, root, sheet, sleep } from './dom.js';

function hud(state) {
  const club = CLUB_BY_ID[state.career.clubId];
  const p = state.player;
  return `<div class="scene-hud">
    <span class="sh-club">${crestSVG(club, 'crest sm')}<b>${esc(club.short)}</b></span>
    <span class="sh-item">${icon('calendar', 'ico sm')}<span><b>Hafta ${state.calendar.week}</b><small>Sezon ${state.calendar.season}</small></span></span>
    <span class="sh-item">${icon('coin', 'ico sm')}<span><b data-hud-money>${money(state.career.money)}</b><small>Banka</small></span></span>
    <span class="sh-item heart">${icon('heartFill', 'ico sm')}<span><b data-hud-morale>%${Math.round(p.morale)}</b><small>Moral</small></span></span>
    <span class="sh-item bolt">${icon('bolt', 'ico sm')}<span><b data-hud-energy>%${Math.round(p.energy)}</b><small>Enerji</small></span></span>
  </div>`;
}

function portrait(person) {
  if (!person) return `<span class="npc-portrait alone">${icon('user')}</span>`;
  return `<span class="npc-portrait">${avatarSVG(person.look, { colors: person.clothes }, person.number ?? '')}</span>`;
}

/**
 * Buluşma sahnesini oynatır (çözülünce sonuç döner).
 * @param {any} app
 * @param {any} outing core/social startOuting().outing
 */
export function playOuting(app, outing) {
  const s = app.state;
  const sceneOpts = sceneOptsFor(s, outing.venueId, outing.palette, outing.person);

  return new Promise((resolve) => {
    const layer = el(`
      <div class="scene-layer">
        ${hud(s)}
        <div class="scene-stage">
          <canvas width="${SW}" height="${SH}" class="scene-canvas"></canvas>
          <span class="scene-venue">${icon(outing.venueId === 'bar' ? 'glass' : outing.venueId === 'home' ? 'sofa' : 'coffee', 'ico sm')} ${esc(outing.venueName)}</span>
          <button class="scene-close" data-leave aria-label="Ayrıl">${icon('x')}</button>
        </div>
        <div class="scene-dialog">
          <div class="npc-card">
            ${portrait(outing.person)}
            <div class="npc-body">
              <span class="npc-name">${esc(outing.person ? outing.person.name : 'Yalnızsın')}</span>
              <p class="npc-line" data-line></p>
              <span class="npc-delta" data-delta></span>
            </div>
          </div>
          <div class="choices" data-choices></div>
        </div>
      </div>`);
    root().appendChild(layer);
    const cv = layer.querySelector('canvas');
    const ctx = cv.getContext('2d');
    let raf = 0;
    const t0 = performance.now();
    const frame = (now) => {
      drawScene(ctx, (now - t0) / 1000, sceneOpts);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const lineEl = layer.querySelector('[data-line]');
    const choicesEl = layer.querySelector('[data-choices]');
    const deltaEl = layer.querySelector('[data-delta]');
    let busy = false;

    const say = (text) => {
      lineEl.classList.remove('in');
      void lineEl.offsetWidth;
      lineEl.textContent = text;
      lineEl.classList.add('in');
    };

    const showBeat = () => {
      const beat = outing.beats[outing.i];
      say(beat.line);
      choicesEl.innerHTML = beat.options.map((o, i) => `<button class="choice" data-opt="${i}">${icon(TONES[o.tone]?.icon || 'chat', 'ico sm')}<span>${esc(o.text)}</span></button>`).join('');
    };

    const end = async (left = false) => {
      cancelAnimationFrame(raf);
      const result = left ? null : finishOuting(s, outing);
      app.save();
      layer.classList.add('out');
      await sleep(220);
      layer.remove();
      resolve(result);
    };

    const showEnd = (text) => {
      say(text);
      choicesEl.innerHTML = `<button class="choice primary" data-finish>${icon('check', 'ico sm')}<span>${outing.companionId === 'alone' ? 'Mekândan ayrıl' : 'Akşamı bitir'}</span></button>`;
    };

    if (outing.beats.length) showBeat();
    else showEnd(outing.venueId === 'bar' ? 'Barda tek başına bir şeyler içip müziği dinledin. Etrafında hareketli bir kalabalık var…' : outing.venueId === 'home' ? 'Evde yalnız, sakin bir akşam.' : 'Pencere kenarında tek başına kahveni yudumladın. Kafede tanıdık olmayan yüzler var…');

    layer.addEventListener('click', async (e) => {
      if (e.target.closest('[data-leave]')) {
        if (busy) return;
        const ok = await app.confirm('Ayrıl', 'Buluşmayı yarıda bırakırsan hiçbir şey kazanmazsın (para da harcanmaz).', 'Ayrıl');
        if (ok) end(true);
        return;
      }
      if (e.target.closest('[data-finish]')) {
        sfx('click');
        end(false);
        return;
      }
      const b = e.target.closest('[data-opt]');
      if (!b || busy) return;
      busy = true;
      const r = answerOuting(s, outing, Number(b.dataset.opt));
      choicesEl.querySelectorAll('.choice').forEach((x) => x.classList.toggle('picked', x === b));
      choicesEl.querySelectorAll('.choice').forEach((x) => (x.disabled = true));
      sfx(r.mood === 'positive' ? 'coin' : r.mood === 'negative' ? 'error' : 'tick');
      if (r.mood === 'positive') buzz('heart');
      else if (r.mood === 'negative') buzz('error');
      deltaEl.textContent = `${r.delta > 0 ? '+' : ''}${r.delta} ${r.mood === 'positive' ? '♥' : ''}`;
      deltaEl.className = `npc-delta show ${r.mood}`;
      await sleep(450);
      say(r.reply);
      await sleep(1300);
      deltaEl.className = 'npc-delta';
      busy = false;
      if (r.done) {
        const avg = outing.score / Math.max(1, outing.beats.length);
        showEnd(avg >= 3 ? 'Harika bir akşamdı, yine yapalım!' : avg >= 0 ? 'Güzeldi, görüşürüz.' : 'Biraz yorgunum, kalkayım ben.');
      } else showBeat();
    });
  });
}

/** Buluşma sonucu + olaylar */
export async function outingResultSheets(app, result, outing) {
  if (!result) return;
  if (result.stage?.partner) {
    sfx('levelup');
    buzz('celebrate');
  }
  await sheet({
    center: true,
    html: `
      <div class="center">${outing.person ? `<span class="npc-portrait lg">${avatarSVG(outing.person.look, { colors: outing.person.clothes }, outing.person.number ?? '')}</span>` : icon(outing.venueId === 'bar' ? 'glass' : 'coffee')}</div>
      <h3 class="center">${esc(outing.venueName)}</h3>
      <p class="lead center">${esc(result.closer)}</p>
      ${result.stage ? `<div class="center" style="margin:8px 0"><span class="chip ${result.stage.up ? 'good' : 'bad'}">${icon(result.stage.up ? 'heartFill' : 'x', 'ico xs')} ${esc(outing.person?.name || '')}: ${esc(result.stage.to)}</span></div>` : ''}
      ${result.stage?.partner ? `<p class="small center" style="color:var(--accent)">${esc(outing.person.name)} ile artık birliktesiniz! Haftada en az bir kez görüşün; ilişki moral verir.</p>` : ''}
      ${changeChips(result.changes.map((c) => ({ ...c, label: c.key === 'rel' ? `${c.label} ilişkisi` : c.label })))}
      <button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
  });
  for (const ev of result.events) {
    if (ev.press) {
      await tabloidSheet(app, ev);
      continue;
    }
    sfx(ev.tone === 'bad' ? 'error' : 'swish');
    if (ev.choices) {
      // Seçimli olay (ör. barda sataşma)
      const pickId = await sheet({
        center: true,
        dismissable: false,
        html: `<div class="event-art">${icon(ev.icon || 'sparkle')}</div><h3 class="center">${esc(ev.title)}</h3><p class="lead center">${esc(ev.text)}</p>
          <div class="stack">${ev.choices.map((c) => `<button class="btn block" data-close="${c.id}">${icon(c.icon || 'chat', 'ico sm')} ${esc(c.label)}</button>`).join('')}</div>`,
      });
      const r = resolveSocialChoice(app.state, ev, pickId);
      app.save();
      if (r.press) {
        await tabloidSheet(app, { ...ev, text: r.text, changes: r.changes, press: r.press });
        continue;
      }
      buzz(r.tone === 'bad' ? 'error' : 'tap');
      await sheet({
        center: true,
        html: `<h3 class="center">${esc(ev.title)}</h3><p class="lead center">${esc(r.text)}</p>${changeChips(r.changes)}<button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
      });
      continue;
    }
    await sheet({
      center: true,
      html: `<div class="event-art">${icon(ev.icon || 'sparkle')}</div><h3 class="center">${esc(ev.title)}</h3><p class="lead center">${esc(ev.text)}</p>
        ${ev.met ? `<div class="center"><span class="npc-portrait lg">${avatarSVG(ev.met.look, { colors: ev.met.clothes }, '')}</span></div>` : ''}
        ${changeChips(ev.changes || [])}
        <button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
    });
  }
}

export { homeScore };
