// REKLAM ÇEKİMİ — piksel stüdyo: marka fonu, softbox ışıklar, kamera ve kameraman, megafonlu yönetmen.
// Yönetmen pozu söyler; 4 poz düğmesinden doğrusuna süre dolmadan bas (mantık: shootLogic.js).
import { BigText, createStage } from './engine.js';
import { el, esc, root, sleep } from '../ui/dom.js';
import { icon } from '../ui/art.js';
import { buzz, sfx, unlock } from '../audio.js';
import { duckMusic } from '../music/player.js';
import { playerCanvas } from './pixel/sprites.js';
import { drawPixelText, pixelTextWidth } from './pixel/font.js';
import { R, lowRes, shadeHex } from './pixel/gymArt.js';
import { blitSprite } from './gym.js';
import { POSE_BY_ID, SHOOT, createShoot, currentTake, shootParams, shootPick, shootResult, shootStep } from './shootLogic.js';

const DIRECTOR = { skin: '#e0b089', hair: 'long', hairColor: '#1f1410', longSleeve: true, pants: true, kit: { body: '#334155', accent: '#f8fafc', pattern: 'solid', shorts: '#1e293b', socks: '#1e293b' }, boots: { main: '#16181d', accent: '#e5e7eb' } };
const CAMERAMAN = { skin: '#b97a50', hair: 'buzz', hairColor: '#14100c', beard: true, longSleeve: true, pants: true, kit: { body: '#111827', accent: '#9ca3af', pattern: 'solid', shorts: '#111827', socks: '#111827' }, boots: { main: '#374151', accent: '#111827' } };

/** Marka ürünü (mantıksal piksel). (x, y): ürünün sol üstü */
export function drawProduct(c, kind, x, y, brand = { color: '#c6ff3d', ink: '#111' }, k = 1) {
  const P = (dx, dy, w, h, col) => R(c, x + dx * k, y + dy * k, w * k, h * k, col);
  const col = brand.color;
  if (kind === 'can') { P(0, 0, 3, 5, col); P(0, 0, 3, 1, '#d1d5db'); P(1, 2, 1, 2, brand.ink); }
  else if (kind === 'bottle') { P(1, 0, 1, 1, '#d1d5db'); P(0, 1, 3, 5, col); P(0, 3, 3, 1, brand.ink); }
  else if (kind === 'phone') { P(0, 0, 3, 5, '#111827'); P(0, 1, 3, 3, col); }
  else if (kind === 'watch') { P(1, 0, 1, 1, '#4b5563'); P(0, 1, 3, 3, '#fbbf24'); P(1, 2, 1, 1, '#111827'); P(1, 4, 1, 1, '#4b5563'); }
  else if (kind === 'wrap') { P(0, 1, 5, 3, '#e8c38a'); P(0, 1, 5, 1, '#f5deb3'); P(4, 0, 1, 2, '#3f8f3a'); P(1, 3, 3, 1, col); }
  else if (kind === 'key') { P(0, 0, 3, 3, col); P(1, 1, 1, 1, '#111827'); P(3, 1, 3, 1, '#d1d5db'); }
  else { /* krampon */ P(0, 1, 5, 2, col); P(0, 3, 5, 1, '#111827'); P(3, 0, 2, 1, col); P(1, 2, 2, 1, brand.ink); }
}

/** Poz küçük resmi (düğmeler için): oyuncu o pozda */
function poseThumb(look, poseId, brand) {
  const pose = POSE_BY_ID[poseId];
  const src = playerCanvas(look, 'down', pose.frame);
  const k = 3;
  const cv = document.createElement('canvas');
  cv.width = 22 * k;
  cv.height = 30 * k;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(src, 0, 0, src.width, 30, 2 * k, 0, src.width * k, 30 * k);
  if (poseId === 'product') drawProduct(c, brand.product, 0, 5 * k, brand, k);
  if (poseId === 'kick') { c.fillStyle = '#f8fafc'; c.fillRect(15 * k, 25 * k, 3 * k, 3 * k); c.fillStyle = '#111827'; c.fillRect(16 * k, 26 * k, k, k); }
  return cv;
}

/**
 * Çekim katmanı: tanıtım → 6 kare → sonuç
 * @param {{look:object, brand:{name:string,logo:string,color:string,ink:string,product:string}|null, skill:number, auto?:boolean}} o
 */
export async function runShoot(o) {
  const brand = o.brand || { name: 'Yerel Reklam', logo: 'REKLAM', color: '#0ea5e9', ink: '#fff', product: 'can' };
  const layer = el(`
    <div class="game-layer shoot-layer">
      <div class="game-hud"><div class="grow"><div class="t">Reklam Çekimi · ${esc(brand.name)}</div><div class="s">Yönetmenin istediği pozu çabuk ver</div></div><span class="chip">${icon('bolt', 'ico sm')} −12</span></div>
      <div class="game-stage"></div>
      <div class="game-intro"><div class="card">
        <h3 style="margin-top:4px">${esc(brand.name)} çekimi</h3>
        <p class="lead" style="margin:6px 0 10px;color:var(--muted);line-height:1.45">Yönetmen megafonla bir poz söyleyecek. Alttaki dört pozdan doğrusuna süre bitmeden bas: ne kadar çabuk, o kadar iyi kare. Yanlış poz kareyi bozar. ${SHOOT.takes} kare çekilecek.</p>
        <button class="btn primary lg block" data-go>${icon('camera')} ÇEKİME BAŞLA</button>
        <button class="btn ghost block" style="margin-top:8px" data-cancel>Vazgeç</button>
      </div></div>
    </div>`);
  root().appendChild(layer);
  const go = await new Promise((res) => {
    if (o.auto) return res(true);
    layer.querySelector('[data-go]').addEventListener('click', () => { unlock(); sfx('click'); res(true); }, { once: true });
    layer.querySelector('[data-cancel]').addEventListener('click', () => { sfx('click'); res(false); }, { once: true });
  });
  if (!go) { layer.remove(); return null; }
  layer.querySelector('.game-intro').remove();
  duckMusic(true);
  const host = layer.querySelector('.game-stage');
  let result;
  if (o.auto) {
    await sleep(200);
    const q = 0.5 + Math.random() * 0.4;
    result = { q, score: Math.round(q * 100), label: `%${Math.round(q * 100)}` };
  } else result = await play(host, o, brand);
  duckMusic(false);
  layer.style.transition = 'opacity .25s';
  layer.style.opacity = '0';
  await sleep(250);
  layer.remove();
  return result;
}

function play(host, o, brand) {
  return new Promise((resolve) => {
    const look = { ...o.look };
    const S = createShoot(shootParams(o.skill ?? 0.4), Math.random, { product: true });
    const big = new BigText();
    const V = { ended: false, flash: 0, lastI: -1, shown: null, rec: 0, photos: [] };
    const bubble = el('<div class="shoot-call"><span class="mega">📣</span><b data-call></b></div>');
    host.appendChild(bubble);
    const grid = el('<div class="pose-btns"></div>');
    host.appendChild(grid);
    const thumbs = {};
    const thumbOf = (id) => (thumbs[id] ||= poseThumb(look, id, brand));
    const renderButtons = () => {
      const tk = currentTake(S);
      grid.innerHTML = '';
      for (const id of tk.options) {
        const b = el(`<button data-pose="${id}"><span class="pt"></span><span class="pl">${esc(POSE_BY_ID[id].name)}</span></button>`);
        grid.appendChild(b); // önce belgeye eklenmeli (şablon belgesindeki tuval çizilmez)
        const src = thumbOf(id);
        const cv = document.createElement('canvas');
        cv.width = src.width;
        cv.height = src.height;
        b.querySelector('.pt').appendChild(cv);
        cv.getContext('2d').drawImage(src, 0, 0);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); pickPose(id, b); });
      }
    };
    const pickPose = (id, b) => {
      const v = shootPick(S, id);
      if (!v) return;
      V.shown = id;
      b.classList.add(v === 'wrong' ? 'bad' : 'ok');
      sfx('camera');
      buzz(v === 'wrong' ? [30, 30] : 14);
      V.flash = 1;
      big.show(v === 'perfect' ? 'MÜKEMMEL KARE!' : v === 'good' ? 'GÜZEL!' : 'YANLIŞ POZ!', v === 'wrong' ? '#ff5d6c' : v === 'perfect' ? '#c6ff3d' : '#7dd3fc', 44);
    };
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) { const tk = currentTake(S); const id = tk.options[n - 1]; const b = grid.querySelector(`[data-pose="${id}"]`); if (b) pickPose(id, b); }
    };
    window.addEventListener('keydown', onKey);
    const stage = createStage(host, {
      update(dt) {
        const prevPhase = S.phase;
        shootStep(S, dt);
        if (S.i !== V.lastI) {
          V.lastI = S.i;
          V.shown = null;
          bubble.querySelector('[data-call]').textContent = POSE_BY_ID[currentTake(S).pose].call;
          bubble.classList.remove('pop');
          void bubble.offsetWidth;
          bubble.classList.add('pop');
          renderButtons();
          sfx('tick');
        }
        if (prevPhase === 'pick' && S.phase === 'flash' && currentTake(S).verdict === 'late') {
          sfx('miss');
          big.show('GEÇ KALDIN!', '#ff9f43', 40);
          V.flash = 0.6;
        }
        if (prevPhase !== 'review' && S.phase === 'review') V.photos.push({ pose: V.shown || 'idle', verdict: currentTake(S).verdict, t: 0 });
        V.photos.forEach((p) => { p.t += dt; });
        V.flash = Math.max(0, V.flash - dt * 2.6);
        V.rec += dt;
        big.update(dt);
        grid.classList.toggle('locked', S.phase !== 'pick');
        if (S.done && !V.ended) {
          V.ended = true;
          const r = shootResult(S);
          sfx(r.q > 0.6 ? 'goal' : 'whistle');
          const box = el(`<div class="gym-done"><b>${r.good}/${SHOOT.takes} KARE</b><span>${r.perfect} mükemmel · başarı %${r.score}</span></div>`);
          host.appendChild(box);
          setTimeout(() => { cleanup(); resolve(r); }, 1800);
        }
      },
      render(ctx, W, H, t) {
        const L = lowRes(V, W, H, 120);
        const { c, LW, LH } = L;
        const floorY = Math.round(LH * 0.5);
        // fon (cyclorama): marka rengi, ortası aydınlık
        const g = c.createRadialGradient(LW / 2, floorY * 0.55, 4, LW / 2, floorY * 0.55, LW * 0.75);
        g.addColorStop(0, shadeHex(brand.color, 0.35));
        g.addColorStop(1, shadeHex(brand.color, -0.35));
        c.fillStyle = g;
        c.fillRect(0, 0, LW, floorY + 8);
        for (let y = 2; y < floorY; y += 6) R(c, 0, y, LW, 1, 'rgba(255,255,255,0.05)');
        const sc = LW >= 110 ? 2 : 1;
        const tw = pixelTextWidth(brand.logo) * sc;
        R(c, Math.round(LW / 2 - tw / 2 - 4), 19, tw + 8, 5 * sc + 6, 'rgba(0,0,0,0.25)');
        drawPixelText(c, brand.logo, LW / 2, 22, brand.ink, { scale: sc, align: 'center', shadow: 'rgba(0,0,0,0.35)' });
        // zemin (fonun devamı) + bant işareti
        const fg = c.createLinearGradient(0, floorY, 0, LH);
        fg.addColorStop(0, shadeHex(brand.color, 0.15));
        fg.addColorStop(0.25, '#cfd5de');
        fg.addColorStop(1, '#9aa3b2');
        c.fillStyle = fg;
        c.fillRect(0, floorY, LW, LH - floorY);
        const px = Math.round(LW / 2);
        const standY = Math.round(LH * 0.66);
        const crewY = Math.round(LH * 0.76);
        R(c, px - 6, standY + 1, 12, 1, '#facc15');
        R(c, px - 1, standY - 2, 2, 7, '#facc15');
        // softbox ışıklar
        for (const [sx, dir] of [[10, 1], [LW - 22, -1]]) {
          R(c, sx + 5, floorY - 40, 2, 52, '#1f2937');
          R(c, sx - 1, floorY + 10, 14, 2, '#1f2937');
          R(c, sx, floorY - 58, 12, 20, '#f8fafc');
          R(c, sx, floorY - 58, 12, 1, '#94a3b8');
          R(c, sx, floorY - 39, 12, 1, '#94a3b8');
          c.fillStyle = 'rgba(255,255,240,0.10)';
          c.beginPath();
          c.moveTo(sx + (dir > 0 ? 12 : 0), floorY - 58);
          c.lineTo(px + dir * 2, standY - 10);
          c.lineTo(sx + (dir > 0 ? 12 : 0), floorY - 39);
          c.fill();
        }
        // yönetmen (sol önde) ve kamera + kameraman (sağ önde)
        const k = sc;
        blitSprite(c, DIRECTOR, 'down', S.phase === 'call' ? 'point' : S.phase === 'review' && currentTake(S).verdict !== 'wrong' && currentTake(S).verdict !== 'late' ? 'clap' : 'cross', Math.round(LW * 0.13), crewY, k);
        // megafon
        if (S.phase === 'call') { R(c, Math.round(LW * 0.13) + 5 * k, crewY - 24 * k, 3 * k, 2 * k, '#f97316'); R(c, Math.round(LW * 0.13) + 8 * k, crewY - 25 * k, 2 * k, 4 * k, '#fb923c'); }
        const camX = Math.round(LW * 0.8);
        const camY = crewY;
        R(c, camX - 1, camY - 26, 2, 26, '#111827');
        R(c, camX - 8, camY - 2, 16, 2, '#111827');
        R(c, camX - 7, camY - 36, 14, 10, '#0b0f17');
        R(c, camX - 12, camY - 34, 6, 6, '#1f2937');
        R(c, camX - 13, camY - 33, 2, 4, '#38bdf8');
        if (Math.floor(V.rec * 2) % 2 === 0) R(c, camX + 4, camY - 35, 2, 2, '#ef4444');
        blitSprite(c, CAMERAMAN, 'side', 'idle', camX + 10, camY, k, { flip: true });
        // oyuncu
        const tk = currentTake(S);
        const poseId = S.phase === 'flash' || S.phase === 'review' ? V.shown : null;
        const frame = poseId ? POSE_BY_ID[poseId].frame : Math.floor(t * 1.2) % 3 === 0 ? 'ready' : 'idle';
        blitSprite(c, look, 'down', frame, px, standY, k);
        const top = standY - 33 * k;
        if (poseId === 'product') drawProduct(c, brand.product, px - 9 * k - 2 * k, top + 7 * k, brand, k);
        if (poseId === 'kick') { R(c, px + 4 * k, standY - 6 * k, 3 * k, 3 * k, '#f8fafc'); R(c, px + 5 * k, standY - 5 * k, k, k, '#111827'); }
        // fotoğraf şeridi (çekilen kareler)
        V.photos.slice(-6).forEach((ph, i) => {
          const x = 3 + i * 14;
          const y = Math.round(LH * 0.22);
          R(c, x, y, 12, 15, '#f8fafc');
          R(c, x + 1, y + 1, 10, 10, shadeHex(brand.color, 0.2));
          const f = ph.pose && ph.pose !== 'idle' ? POSE_BY_ID[ph.pose].frame : 'idle';
          const src = playerCanvas(look, 'down', f);
          c.drawImage(src, 0, 0, src.width, 20, x + 1, y + 1, 10, 11);
          R(c, x + 2, y + 12, 8, 2, ph.verdict === 'perfect' ? '#4ade80' : ph.verdict === 'good' ? '#38bdf8' : '#ef4444');
        });
        if (V.flash > 0) { c.fillStyle = `rgba(255,255,255,${V.flash * 0.85})`; c.fillRect(0, 0, LW, LH); }
        L.blit(ctx);
        // süre çubuğu
        if (S.phase === 'pick') {
          const frac = 1 - S.t / tk.window;
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(14, H * 0.735, W - 28, 8);
          ctx.fillStyle = frac > 0.55 ? '#c6ff3d' : frac > 0.25 ? '#ffcf3d' : '#ff5d6c';
          ctx.fillRect(14, H * 0.735, (W - 28) * frac, 8);
        }
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(`KARE ${S.i + 1}/${SHOOT.takes}`, W - 12, 92);
        big.render(ctx, W, H);
      },
    });
    function cleanup() { window.removeEventListener('keydown', onKey); stage.stop(); grid.remove(); bubble.remove(); }
  });
}
