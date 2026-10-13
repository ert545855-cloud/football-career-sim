// SPRITE ATLASI — "Football Championship Megapack" paketinden üretilen tek doku.
//
// Dosyalar (scripts/atlas/build_atlas.py üretir, Vite paketler ve adlarına içerik özeti ekler):
//   src/assets/sprites/atlas.webp   → yayında: /assets/atlas-<hash>.webp  (~180 KB, paletli kayıpsız)
//   src/assets/sprites/atlas.png    → yayında: /assets/atlas-<hash>.png   (WebP açılamazsa yedek)
//   src/assets/sprites/atlas.json   → JS paketine gömülür (ad → x, y, w, h)
//
// Kullanım:
//   DOM   : sprite('cup_gold', { size: 40 })      → <span class="spr" …> (CSS arka plan konumu)
//   Canvas: drawSprite(ctx, 'light_tower', x, y, { h: 120, anchor: 'bottom' })
//   Doku  : spritePattern(ctx, 'grass', 64)       → createPattern ile çim dolgusu
// Atlas yüklenmeden ya da yüklenemezse fonksiyonlar boş döner; çağıranlar SVG / çizim yedeğine düşer.
import atlasWebp from './sprites/atlas.webp';
import atlasPng from './sprites/atlas.png';
import ATLAS from './sprites/atlas.json';

/** @typedef {{x:number, y:number, w:number, h:number, group:string}} Frame */

/** @type {Record<string, Frame>} */
export const FRAMES = ATLAS.frames;
export const ATLAS_W = ATLAS.image.w;
export const ATLAS_H = ATLAS.image.h;

let image = /** @type {HTMLImageElement|null} */ (null);
let url = '';
let loading = /** @type {Promise<HTMLImageElement|null>|null} */ (null);
const listeners = new Set();

export const spritesReady = () => !!image;
export const hasSprite = (name) => !!FRAMES[name];

/** Atlas yüklenince (bir kez) çağrılır — tuval oyunları yeniden çizim için kullanabilir. */
export function onSpritesReady(fn) {
  if (image) fn(image);
  else listeners.add(fn);
}

/**
 * Atlası yükler: önce WebP, açılamazsa PNG. CSS'teki --atlas değişkenini ayarlar.
 * @returns {Promise<HTMLImageElement|null>}
 */
export function loadSprites() {
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const attempt = (src, fallback) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        image = img;
        url = src;
        document.documentElement.style.setProperty('--atlas', `url("${src}")`);
        document.documentElement.classList.add('sprites-ready');
        for (const fn of listeners) fn(img);
        listeners.clear();
        resolve(img);
      };
      img.onerror = () => (fallback ? attempt(fallback, null) : resolve(null));
      img.src = src;
    };
    attempt(atlasWebp, atlasPng);
  });
  return loading;
}

/** Kutuya sığan ölçek (en-boy oranı korunur). */
function fitScale(f, w, h) {
  if (w && h) return Math.min(w / f.w, h / f.h);
  if (w) return w / f.w;
  if (h) return h / f.h;
  return 1;
}

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * DOM için sprite: atlası arka plan olarak kullanan, verilen kutuya sığdırılmış <span>.
 * @param {string} name
 * @param {{size?:number, w?:number, h?:number, cls?:string, label?:string, style?:string}} [o]
 *   size: kare kutu (px). w/h: tek kenar ya da kutu. label: ekran okuyucu metni.
 */
export function sprite(name, o = {}) {
  const f = FRAMES[name];
  if (!f) return '';
  const s = fitScale(f, o.w ?? o.size, o.h ?? o.size);
  const style = `width:${r2(f.w * s)}px;height:${r2(f.h * s)}px;background-size:${r2(ATLAS_W * s)}px ${r2(ATLAS_H * s)}px;background-position:${r2(-f.x * s)}px ${r2(-f.y * s)}px;${o.style || ''}`;
  const a11y = o.label ? `role="img" aria-label="${o.label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<span class="spr ${o.cls || ''}" style="${style}" ${a11y}></span>`;
}

/** Sprite ya da (yoksa) verilen yedek HTML. */
export const spriteOr = (name, fallback, o) => (FRAMES[name] ? sprite(name, o) : fallback);

/**
 * Tuvale sprite çizer. anchor: 'center' | 'bottom' (ayak noktası) | 'top-left'.
 * @returns {boolean} çizildi mi (atlas hazır değilse false → çağıran yedeğini çizer)
 */
export function drawSprite(ctx, name, x, y, { w, h, anchor = 'center', alpha = 1, flip = false } = {}) {
  const f = FRAMES[name];
  if (!image || !f) return false;
  const s = fitScale(f, w, h);
  const dw = f.w * s;
  const dh = f.h * s;
  let dx = x - dw / 2;
  let dy = y - dh / 2;
  if (anchor === 'bottom') dy = y - dh;
  else if (anchor === 'top-left') {
    dx = x;
    dy = y;
  }
  const prevA = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = prevA * alpha;
  if (flip) {
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(image, f.x, f.y, f.w, f.h, 0, 0, dw, dh);
    ctx.restore();
  } else ctx.drawImage(image, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
  ctx.globalAlpha = prevA;
  return true;
}

/** Sprite'ın verilen yükseklik/genişlikteki boyutu (yerleşim hesapları için). */
export function spriteSize(name, { w, h } = {}) {
  const f = FRAMES[name];
  if (!f) return { w: 0, h: 0 };
  const s = fitScale(f, w, h);
  return { w: f.w * s, h: f.h * s };
}

const patterns = new WeakMap();

/**
 * Döşeme dokusu (ör. çim). tile: CSS piksel cinsinden bir karonun boyu.
 * Retina ekranlarda net kalsın diye karo cihaz çözünürlüğünde hazırlanır.
 * @returns {CanvasPattern|null}
 */
export function spritePattern(ctx, name, tile = 64) {
  const f = FRAMES[name];
  if (!image || !f) return null;
  let byCtx = patterns.get(ctx);
  if (!byCtx) patterns.set(ctx, (byCtx = new Map()));
  const dpr = ctx.getTransform ? ctx.getTransform().a || 1 : 1;
  const key = `${name}@${tile}@${dpr}`;
  if (byCtx.has(key)) return byCtx.get(key);
  const px = Math.max(8, Math.round(tile * dpr));
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, f.x, f.y, f.w, f.h, 0, 0, px, px);
  const pat = ctx.createPattern(c, 'repeat');
  if (pat && typeof DOMMatrix !== 'undefined' && pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / dpr));
  byCtx.set(key, pat);
  return pat;
}

/** Atlasın aktif URL'si (önyükleme / hata ayıklama için). */
export const spriteUrl = () => url;

/** Tribün taraftarları ve bayraklar (rastgele seçim için listeler). */
export const FAN_SPRITES = Object.keys(FRAMES).filter((k) => k.startsWith('fan_') && !k.startsWith('fan_flag'));
export const FLAG_SPRITES = Object.keys(FRAMES).filter((k) => k.startsWith('fan_flag_') || k.startsWith('scarf_'));
