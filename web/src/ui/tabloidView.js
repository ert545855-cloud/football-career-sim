// MAGAZİN — paparazzi fotoğrafı (piksel sahne + flaş + gren) ve gazete sayfası.
// Hem buluşma sonrası "Magazine düştün!" sayfasında hem de Chirp'teki Flaş Magazin gönderilerinde kullanılır.
import { PERSON_BY_ID } from '../core/social/data.js';
import { buzz, sfx } from '../audio.js';
import { SH, SW, drawScene } from './pixelScenes.js';
import { sceneOptsFor } from './sceneOpts.js';
import { icon } from './art.js';
import { changeChips } from './components.js';
import { esc, sheet, sleep } from './dom.js';

/** Paparazzi karesi: sahne + objektif flaşı + gren + sarı daire */
export function paintPhoto(canvas, state, photo = {}) {
  const c = canvas.getContext('2d');
  canvas.width = SW;
  canvas.height = SH;
  const person = photo.personId ? PERSON_BY_ID[photo.personId] : null;
  try {
    drawScene(c, 1.3, sceneOptsFor(state, photo.venueId || 'bar', photo.palette, person));
  } catch {
    c.fillStyle = '#111';
    c.fillRect(0, 0, SW, SH);
  }
  // flaş patlaması
  const g = c.createRadialGradient(150, 30, 2, 150, 30, 70);
  g.addColorStop(0, 'rgba(255,255,255,.75)');
  g.addColorStop(0.25, 'rgba(255,255,255,.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, SW, SH);
  // gren
  for (let i = 0; i < 900; i++) {
    const x = (i * 97) % SW;
    const y = (i * 53 + Math.floor(i / 7)) % SH;
    c.fillStyle = i % 3 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.12)';
    c.fillRect(x, y, 1, 1);
  }
  // magazin dairesi (yakalanan kişiler)
  c.strokeStyle = '#facc15';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(person ? 100 : 60, 66, person ? 74 : 40, 40, 0, 0, Math.PI * 2);
  c.stroke();
}

export function paintPhotos(root, state) {
  root.querySelectorAll('canvas[data-photo]').forEach((cv) => {
    if (cv.dataset.done) return;
    let photo = {};
    try {
      photo = JSON.parse(cv.dataset.photo);
    } catch {
      /* boş */
    }
    paintPhoto(cv, state, photo);
    cv.dataset.done = '1';
  });
}

const TONE_LABEL = { bad: 'SKANDAL', warn: 'DEDİKODU', good: 'AŞK & HAYAT' };

/** Gazete sayfası (manşet + fotoğraf + alt başlık) */
export function tabloidHTML(state, tab) {
  const photo = esc(JSON.stringify({ venueId: tab.venueId, palette: tab.palette, personId: tab.personId || null }));
  const date = `Sezon ${tab.s ?? state.calendar.season} · Hafta ${tab.w ?? state.calendar.week}`;
  return `<div class="tabloid ${tab.tone || ''}">
    <div class="tb-mast"><b>FLAŞ</b><span>MAGAZİN</span><small>${date}</small></div>
    <div class="tb-kicker">${TONE_LABEL[tab.tone] || 'ÖZEL'} · ÖZEL HABER</div>
    <h2 class="tb-head">${esc(tab.headline)}</h2>
    <div class="tb-photo"><canvas data-photo="${photo}"></canvas><span class="tb-stamp">ÖZEL</span><span class="tb-credit">${icon('camera', 'ico xs')} Flaş Magazin</span></div>
    <p class="tb-sub">${esc(tab.sub || '')}</p>
  </div>`;
}

/** "Magazine düştün!" sayfası: flaş patlamaları, deklanşör sesi, titreşim */
export async function tabloidSheet(app, ev) {
  const tab = ev.press || ev.tabloid;
  await sheet({
    center: true,
    onMount: async (node) => {
      paintPhotos(node, app.state);
      const flash = node.querySelector('.tb-flash');
      for (let i = 0; i < 3; i++) {
        flash?.classList.remove('go');
        void flash?.offsetWidth;
        flash?.classList.add('go');
        sfx('camera');
        await sleep(170);
      }
      buzz(tab.tone === 'bad' ? 'heartBreak' : 'flash');
    },
    html: `<div class="tb-flash"></div>
      ${tabloidHTML(app.state, tab)}
      <p class="lead center" style="margin-top:12px">${esc(ev.text)}</p>
      ${changeChips(ev.changes || [])}
      <p class="muted small center" style="margin:8px 0 0">${icon('chirp', 'ico xs')} Flaş Magazin haberi Chirp'te paylaştı.</p>
      <button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
  });
}
