// MAÇ İÇİ GERGİNLİK — rakip seni itti / laf attı / üstüne yürüdü / tribün ıslıklıyor.
// Yayın kutusunun içinde süreli seçim: seçenekler karakter barına göre (Egoist kışkırtır, Mütevazı yatıştırır,
// Dengeli ikisini de hafif yapar). Süre dolarsa "oyuna dön".
import { ATT_KINDS, attitudeKind, attitudeLabel } from '../core/attitude.js';
import { esc } from './dom.js';

export const TENSION_MS = 7000;

export function pickTension(host, { title, text, options, att = 0, ms = TENSION_MS, onPick = null }) {
  return new Promise((resolve) => {
    const kind = attitudeKind(att);
    const box = document.createElement('div');
    box.className = 'tn-pick';
    box.innerHTML = `<div class="tn-h"><span class="tn-ic">!</span><b>${esc(title)}</b><span class="tn-sec" data-sec></span></div>
      <p class="tn-tx">${esc(text)}</p>
      <div class="cel-bar tn-bar"><i></i></div>
      <div class="tn-opts">${options.map((o, i) => `<button class="tn-opt ${o.id}" data-tn="${o.id}" data-i="${i}"><b>${esc(o.label)}</b><small>${esc(o.hint || '')}</small></button>`).join('')}</div>
      <div class="tn-att">Karakterin: <b style="color:${ATT_KINDS[kind].color}">${esc(attitudeLabel(att))}</b></div>`;
    host.appendChild(box);
    host.classList.add('bc-tense');
    const bar = box.querySelector('.tn-bar i');
    const sec = box.querySelector('[data-sec]');
    const t0 = performance.now();
    let done = false;
    let raf = 0;
    const fallback = options.find((o) => o.id === 'ignore')?.id || options[options.length - 1].id;
    const finish = (id, btn) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      btn?.classList.add('on');
      onPick?.(id, !!btn);
      host.classList.remove('bc-tense');
      setTimeout(() => box.classList.add('done'), btn ? 260 : 40);
      setTimeout(() => box.remove(), btn ? 620 : 400);
      resolve(id);
    };
    const tick = () => {
      if (!box.isConnected) return finish(fallback, null);
      const left = Math.max(0, ms - (performance.now() - t0));
      bar.style.width = `${(left / ms) * 100}%`;
      sec.textContent = `${Math.ceil(left / 1000)} sn`;
      if (left <= 0) return finish(fallback, null);
      raf = requestAnimationFrame(tick);
    };
    const onKey = (e) => {
      const b = box.querySelector(`[data-i="${Number(e.key) - 1}"]`);
      if (b) { e.preventDefault(); finish(b.dataset.tn, b); }
    };
    window.addEventListener('keydown', onKey);
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('[data-tn]');
      if (b) finish(b.dataset.tn, b);
    });
    tick();
  });
}
