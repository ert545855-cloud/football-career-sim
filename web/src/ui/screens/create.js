// KARAKTER OLUŞTURMA — yalnızca isim. Mevki seçmelerden sonra (scout önerisiyle), forma numarası
// kulüp tarafından verilir, görünüş rastgele oluşturulur.
import { FIRST_NAMES, LAST_NAMES } from '../../core/data.js';
import { isValidName } from '../../core/player.js';
import { icon } from '../art.js';
import { esc } from '../dom.js';
import { sprite } from '../../assets/sprites.js';

export function createScreen(app) {
  const d = (app.nameDraft ||= { name: '' });
  return {
    tabs: false,
    html: `
      <div class="row" style="margin-bottom:6px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <div class="grow"><div class="muted small">Yeni kariyer</div><h1 class="h-title">Kimsin?</h1></div>
      </div>
      <div class="create-hero">${sprite('tunnel_players', { h: 96, w: 180 })}</div>
      <p class="muted" style="margin:0 0 14px;line-height:1.5">17 yaşındasın ve babandan gizli buradasın. Bugün <b style="color:var(--text)">Seçmeler Kampı</b>'nda scoutların önüne çıkacaksın. Kamptaki performansın, sana hangi kulüplerin teklif yapacağını belirleyecek.</p>
      <label class="small muted" for="nm">Adın ve soyadın</label>
      <div class="row" style="margin:6px 0 14px">
        <input id="nm" class="field grow" maxlength="20" autocomplete="off" placeholder="Örn. Arda Yılmaz" value="${esc(d.name)}">
        <button class="icon-btn" data-act="rand" aria-label="Rastgele isim">${icon('refresh')}</button>
      </div>
      <div class="card small muted" style="display:grid;gap:6px;line-height:1.45">
        <div class="row" style="gap:8px">${icon('user', 'ico sm')} Forma numaranı kulübün verecek; büyük numaralar performansla kazanılır.</div>
        <div class="row" style="gap:8px">${icon('target', 'ico sm')} Mevkin, seçmelerdeki performansına göre scout önerisiyle belirlenir.</div>
      </div>
      <div class="spacer"></div>
      <button class="btn primary lg block" data-act="start" ${isValidName(d.name) ? '' : 'disabled'}>${icon('play')} Oyuna Başla</button>`,
    mount(el) {
      const input = el.querySelector('#nm');
      const startBtn = el.querySelector('[data-act="start"]');
      input.addEventListener('input', () => {
        d.name = input.value;
        startBtn.disabled = !isValidName(d.name);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && isValidName(d.name)) startBtn.click();
      });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        app.click();
        if (t.dataset.act === 'back') {
          app.nameDraft = null;
          app.go('title');
        } else if (t.dataset.act === 'rand') {
          d.name = `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
          input.value = d.name;
          startBtn.disabled = false;
        } else if (t.dataset.act === 'start' && isValidName(d.name)) {
          app.startTryouts(d.name);
        }
      });
    },
  };
}
