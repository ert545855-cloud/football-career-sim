// GOL SİNEMATİĞİ — maçta attığın ilk golden sonra kısa (8 sn) gol sevinci videosu. Ses yok (oyunun tribün
// sesi sürer). Videodaki genel isim plakası, oyuncunun kendi piksel yüzü, adı, forma numarası ve dakikasıyla
// kaplanır. Dokununca geçilir; video yüklenemezse sessizce atlanır.
import { esc } from './dom.js';
import { playerCanvas } from '../games/pixel/sprites.js';

const SRC = `${import.meta.env?.BASE_URL || '/'}media/goal-celebration`;
/** Videodaki isim plakasının yeri (16:9 kareye göre %) ve görünme aralığı (sn) */
const PLATE = { left: 1.2, top: 64.2, width: 53.6, height: 28.6, in: 1.95, out: 7.05 };
const MAX_WAIT_MS = 2500;

/** Oyuncu yüzü: piksel oyuncunun baş-omuz kısmı, kulüp rengi zeminde */
function faceCanvas(look) {
  const src = playerCanvas(look, 'down', 'idle');
  const cv = document.createElement('canvas');
  const s = Math.max(1, Math.floor(96 / Math.max(1, src.width)));
  const h = Math.round(src.height * 0.52);
  cv.width = src.width * s;
  cv.height = h * s;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, src.width, h, 0, 0, cv.width, cv.height);
  return cv;
}

/**
 * @param {HTMLElement} host yayın kutusu (tam ekran döndürmesi de geçerli olsun diye içine yerleşir)
 * @param {{look?:object, name:string, number?:number|string, minute?:number, club?:string, colors?:string[]}} o
 * @returns {Promise<'ended'|'skipped'|'failed'>}
 */
export function playGoalCinematic(host, o = {}) {
  return new Promise((resolve) => {
    if (!host) { resolve('failed'); return; }
    const [c1 = '#c8102e', c2 = '#ffd200'] = o.colors || [];
    const parts = String(o.name || '').trim().split(/\s+/);
    const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '';
    const last = parts.length > 1 ? parts.at(-1) : '';
    const wrap = document.createElement('div');
    wrap.className = 'gcine';
    wrap.innerHTML = `
      <div class="gcine-box">
        <video muted playsinline preload="auto" poster="${SRC}.jpg" disablepictureinpicture>
          <source src="${SRC}.mp4" type="video/mp4">
          <source src="${SRC}.webm" type="video/webm">
        </video>
        <div class="gcine-plate" style="--l:${PLATE.left}%;--t:${PLATE.top}%;--w:${PLATE.width}%;--h:${PLATE.height}%;--c1:${c1};--c2:${c2}">
          <div class="gcine-face"></div>
          <div class="gcine-txt">
            <b>${esc(first)}${last ? `<br>${esc(last)}` : ''}</b>
            <span>${o.number != null ? `#${esc(o.number)}` : ''}${o.minute != null ? ` · ⚽ ${esc(o.minute)}'` : ''}${o.club ? ` · ${esc(o.club)}` : ''}</span>
          </div>
        </div>
        <div class="gcine-skip">Geç ▸</div>
      </div>`;
    const box = wrap.querySelector('.gcine-box');
    const video = wrap.querySelector('video');
    const plate = wrap.querySelector('.gcine-plate');
    if (o.look) {
      try { wrap.querySelector('.gcine-face').appendChild(faceCanvas(o.look)); } catch { /* yüz çizilemezse boş kalsın */ }
    }
    video.muted = true; // sesi yok; iOS otomatik oynatma için de şart
    video.defaultMuted = true;

    let done = false;
    let raf = 0;
    const finish = (why) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      wrap.classList.add('out');
      setTimeout(() => { video.pause(); video.removeAttribute('src'); video.load(); wrap.remove(); }, 320);
      resolve(why);
    };
    // 16:9 kutuyu kabın içine sığdır (dikeyde de, döndürülmüş tam ekranda da)
    const fit = () => {
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (!W || !H) return;
      const w = Math.min(W, (H * 16) / 9);
      box.style.width = `${w}px`;
      box.style.height = `${(w * 9) / 16}px`;
      box.style.fontSize = `${w / 64}px`;
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    // plaka: videodaki isim plakası görünürken üstünde dur
    const tick = () => {
      const t = video.currentTime || 0;
      const a = Math.max(0, Math.min(1, (t - PLATE.in) / 0.35, (PLATE.out - t) / 0.4));
      plate.style.opacity = a.toFixed(3);
      plate.style.transform = `translateX(${(1 - Math.min(1, (t - PLATE.in) / 0.35)) * -6}%)`;
      if (!done) raf = requestAnimationFrame(tick);
    };

    wrap.addEventListener('pointerdown', (e) => { e.stopPropagation(); finish('skipped'); });
    video.addEventListener('ended', () => finish('ended'));
    video.addEventListener('error', () => finish('failed'));
    wrap.querySelector('source:last-of-type').addEventListener('error', () => finish('failed')); // hiçbir biçim çalmazsa
    const timer = setTimeout(() => { if (video.readyState < 2) finish('failed'); }, MAX_WAIT_MS);
    video.addEventListener('playing', () => clearTimeout(timer), { once: true });

    host.appendChild(wrap);
    ro?.observe(wrap);
    fit();
    raf = requestAnimationFrame(tick);
    const p = video.play();
    if (p?.catch) p.catch(() => finish('failed'));
  });
}
