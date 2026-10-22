// STÜDYO İNTROSU — uygulama açılışında (oturum başına bir kez) Odd Sparrow Studios logosu:
// kuş kırık parçalar gibi çaprazdan belirir, üstünden altın bir parıltı geçer, piksel kıvılcımlar dağılır,
// yazı soldan sağa açılır, "STUDIOS" ve altın çizgi gelir; sonra giriş ekranına yumuşakça geçer.
// Dokununca atlanır. Otomatik testlerde (webdriver / ?autoplay) ve "hareketi azalt" ayarında kısalır ya da atlanır.

const KEY = 'nfs.studioIntro';
const GOLD = '#cbaa6a';

function seen() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* yok */ }
}

/**
 * @param {HTMLElement} root uygulama kökü
 * @param {{force?:boolean}} [o]
 * @returns {Promise<void>}
 */
export function playStudioIntro(root, o = {}) {
  const auto = typeof navigator !== 'undefined' && navigator.webdriver;
  if (!o.force && (seen() || auto || /[?&]autoplay=1/.test(location.search))) return Promise.resolve();
  markSeen();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const layer = document.createElement('div');
  layer.className = `studio-intro${reduced ? ' reduced' : ''}`;
  layer.setAttribute('role', 'img');
  layer.setAttribute('aria-label', 'Odd Sparrow Studios');
  layer.dataset.noi18n = '';
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.4;
    const d = 70 + (i * 37) % 90;
    return `<i style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d * 0.8)}px;--d:${(0.55 + (i % 5) * 0.06).toFixed(2)}s;--s:${3 + (i % 3) * 2}px"></i>`;
  }).join('');
  layer.innerHTML = `
    <div class="si-glow"></div>
    <div class="si-stage">
      <div class="si-bird"><img src="./studio/bird.webp" alt="" draggable="false"/><span class="si-shine"></span><span class="si-sparks">${sparks}</span></div>
      <img class="si-word" src="./studio/word.webp" alt="ODD SPARROW" draggable="false"/>
      <img class="si-sub" src="./studio/sub.webp" alt="STUDIOS" draggable="false"/>
      <span class="si-line" style="background:${GOLD}"></span>
    </div>`;
  root.appendChild(layer);
  return new Promise((resolve) => {
    let done = false;
    const total = reduced ? 1400 : 3700;
    const finish = (fast = false) => {
      if (done) return;
      done = true;
      layer.classList.add('out');
      setTimeout(() => { layer.remove(); resolve(); }, fast ? 260 : 620);
    };
    // görseller yüklenmeden başlama (yavaş bağlantıda boş siyah ekran kalmasın: en fazla 1,2 sn bekle)
    const imgs = [...layer.querySelectorAll('img')];
    const ready = Promise.race([
      Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = r; im.onerror = r; })))),
      new Promise((r) => setTimeout(r, 1200)),
    ]);
    ready.then(() => {
      if (done) return;
      layer.classList.add('play');
      setTimeout(() => finish(false), total);
    });
    layer.addEventListener('pointerdown', () => finish(true), { once: true });
  });
}
