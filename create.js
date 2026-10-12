import { AVATAR, FIRST_NAMES, LAST_NAMES, POSITIONS, STATS, STAT_KEYS } from '../../core/data.js';
import { isValidName } from '../../core/player.js';
import { avatarSVG, icon } from '../art.js';
import { esc, animateBars } from '../dom.js';

const STEP_TITLES = ['Kimsin?', 'Mevkin', 'Görünüşün'];
const PREVIEW_KIT = { colors: ['#16a34a', '#f8fafc'], pattern: 'stripes' };

export function createScreen(app) {
  const d = (app.draft ||= {
    step: 0,
    name: '',
    number: 9,
    position: null,
    avatar: { skin: 1, hair: 'short', hairColor: 1 },
  });

  const stepper = `<div class="stepper">${[0, 1, 2].map((i) => `<i class="${i <= d.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  let canNext = false;

  if (d.step === 0) {
    canNext = isValidName(d.name);
    body = `
      <p class="muted" style="margin:0 0 14px">17 yaşındasın ve ilk profesyonel sözleşmeni imzalamak üzeresin.</p>
      <label class="small muted" for="nm">Adın ve soyadın</label>
      <div class="row" style="margin:6px 0 16px">
        <input id="nm" class="field grow" maxlength="20" autocomplete="off" placeholder="Örn. Arda Yılmaz" value="${esc(d.name)}">
        <button class="icon-btn" data-act="rand" aria-label="Rastgele isim">${icon('refresh')}</button>
      </div>
      <label class="small muted">Forma numaran</label>
      <div class="chips" style="margin-top:8px">${[7, 9, 10, 11, 4, 5, 6, 8, 17, 23].map((n) => `<button class="opt ${d.number === n ? 'on' : ''}" data-num="${n}">${n}</button>`).join('')}</div>`;
  } else if (d.step === 1) {
    canNext = !!d.position;
    body = Object.values(POSITIONS)
      .map((p) => `
        <button class="pos-card ${d.position === p.id ? 'on' : ''}" data-pos="${p.id}">
          <div class="row"><span class="pos-tag">${p.short}</span><div class="grow"><b style="font-size:16px">${p.name}</b><div class="muted small" style="margin-top:2px">${p.desc}</div></div></div>
          <div class="mini-bars">${STAT_KEYS.map((k) => `<div><div class="vbar"><i style="--c:${STATS[k].color}" data-h="${p.stats[k] * 3}"></i></div>${STATS[k].short}<b style="color:var(--text)">${p.stats[k]}</b></div>`).join('')}</div>
        </button>`)
      .join('');
  } else {
    canNext = true;
    const a = d.avatar;
    body = `
      <div class="avatar-big">${avatarSVG(a, PREVIEW_KIT, d.number)}</div>
      <p class="center" style="font-weight:800;font-size:18px;margin:12px 0 2px">${esc(d.name)}</p>
      <p class="center muted small" style="margin:0 0 14px">${POSITIONS[d.position].name} · #${d.number}</p>
      <div class="h-sec" style="margin-top:6px">Ten rengi</div>
      <div class="swatches">${AVATAR.skins.map((c, i) => `<button class="swatch ${a.skin === i ? 'on' : ''}" style="background:${c}" data-skin="${i}" aria-label="Ten ${i + 1}"></button>`).join('')}</div>
      <div class="h-sec">Saç modeli</div>
      <div class="chips">${AVATAR.hairStyles.map((h) => `<button class="opt ${a.hair === h ? 'on' : ''}" data-hair="${h}">${AVATAR.hairStyleNames[h]}</button>`).join('')}</div>
      <div class="h-sec">Saç rengi</div>
      <div class="swatches">${AVATAR.hairColors.map((c, i) => `<button class="swatch ${a.hairColor === i ? 'on' : ''}" style="background:${c}" data-hc="${i}" aria-label="Saç rengi ${i + 1}"></button>`).join('')}</div>`;
  }

  return {
    tabs: false,
    html: `
      <div class="row" style="margin-bottom:6px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <div class="grow"><div class="muted small">Adım ${d.step + 1}/3</div><h1 class="h-title">${STEP_TITLES[d.step]}</h1></div>
      </div>
      ${stepper}
      ${body}
      <div class="spacer"></div>
      <button class="btn primary lg block" data-act="next" ${canNext ? '' : 'disabled'}>${d.step === 2 ? `${icon('play')} Kariyere Başla` : `Devam ${icon('chev')}`}</button>`,
    mount(el) {
      animateBars(el);
      const input = el.querySelector('#nm');
      const nextBtn = el.querySelector('[data-act="next"]');
      input?.addEventListener('input', () => {
        d.name = input.value;
        nextBtn.disabled = !isValidName(d.name);
      });
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && isValidName(d.name)) nextBtn.click();
      });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        app.click();
        if (t.dataset.act === 'back') {
          if (d.step === 0) {
            app.draft = null;
            app.go('title');
          } else {
            d.step--;
            app.go('create');
          }
        } else if (t.dataset.act === 'rand') {
          d.name = `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
          input.value = d.name;
          nextBtn.disabled = false;
        } else if (t.dataset.num) {
          d.number = Number(t.dataset.num);
          el.querySelectorAll('[data-num]').forEach((b) => b.classList.toggle('on', b === t));
        } else if (t.dataset.pos) {
          d.position = t.dataset.pos;
          el.querySelectorAll('[data-pos]').forEach((b) => b.classList.toggle('on', b === t));
          nextBtn.disabled = false;
        } else if (t.dataset.skin || t.dataset.hair || t.dataset.hc) {
          const key = t.dataset.skin ? 'skin' : t.dataset.hair ? 'hair' : 'hc';
          if (key === 'skin') d.avatar.skin = Number(t.dataset.skin);
          if (key === 'hair') d.avatar.hair = t.dataset.hair;
          if (key === 'hc') d.avatar.hairColor = Number(t.dataset.hc);
          el.querySelectorAll(`[data-${key}]`).forEach((b) => b.classList.toggle('on', b === t));
          el.querySelector('.avatar-big').innerHTML = avatarSVG(d.avatar, PREVIEW_KIT, d.number);
        } else if (t.dataset.act === 'next') {
          if (d.step < 2) {
            d.step++;
            app.go('create');
          } else {
            app.startCareer(d);
          }
        }
      });
    },
  };
}
