// KARAKTER OLUŞTURMA — yalnızca isim. Mevki seçmelerden sonra (scout önerisiyle), forma numarası
// kulüp tarafından verilir, görünüş rastgele oluşturulur.
import { COUNTRIES } from '../../core/data.js';
import { isValidName } from '../../core/player.js';
import { randomName } from '../../core/world/names.js';
import { icon } from '../art.js';
import { esc } from '../dom.js';
import { sprite } from '../../assets/sprites.js';

export function createScreen(app) {
  const d = (app.nameDraft ||= { name: '', nationality: 'tr' });
  d.nationality ||= 'tr';
  const nat = () => COUNTRIES.find((c) => c.id === d.nationality) || COUNTRIES[0];
  const natGrid = () => COUNTRIES.map((c) => `<button class="nat-opt ${c.id === d.nationality ? 'on' : ''}" data-nat="${c.id}" aria-pressed="${c.id === d.nationality}"><span class="fl">${c.flag}</span><span>${esc(c.name)}</span></button>`).join('');
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
        <input id="nm" class="field grow" maxlength="20" autocomplete="off" placeholder="Örn. ${esc(randomName(nat().lang, () => 0.37))}" value="${esc(d.name)}">
        <button class="icon-btn" data-act="rand" aria-label="Rastgele isim">${icon('refresh')}</button>
      </div>
      <div class="row between" style="margin:0 0 6px"><span class="small muted">Vatandaşlık</span><b class="small" data-natlabel>${nat().flag} ${esc(nat().name)}</b></div>
      <div class="nat-grid" data-natgrid>${natGrid()}</div>
      <p class="muted small" style="margin:6px 0 14px;line-height:1.45">Kariyerin bu ülkede başlar: ligler, kulüpler, hocalar, arkadaşların ve stattaki pankartlar bu ülkeden. Milli formayı da bu ülke için giyersin.</p>
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
        } else if (t.dataset.nat) {
          d.nationality = t.dataset.nat;
          el.querySelectorAll('[data-nat]').forEach((b) => { const on = b.dataset.nat === d.nationality; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
          el.querySelector('[data-natlabel]').textContent = `${nat().flag} ${nat().name}`;
          input.placeholder = `Örn. ${randomName(nat().lang, () => 0.37)}`;
        } else if (t.dataset.act === 'rand') {
          d.name = randomName(nat().lang).slice(0, 20);
          input.value = d.name;
          startBtn.disabled = !isValidName(d.name);
        } else if (t.dataset.act === 'start' && isValidName(d.name)) {
          app.startTryouts(d.name, d.nationality);
        }
      });
    },
  };
}
