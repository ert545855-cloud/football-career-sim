import { ballSVG, icon } from '../art.js';
import { hasSave } from '../../core/storage.js';
import { sprite } from '../../assets/sprites.js';

export function titleScreen(app) {
  const canContinue = hasSave() && app.state;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return {
    tabs: false,
    raw: true,
    html: `
      <div class="title-screen">
        <div class="floodlight l"></div><div class="floodlight r"></div>
        <div class="title-tower l">${sprite('light_tower', { h: 190 })}</div>
        <div class="title-tower r">${sprite('light_tower', { h: 190 })}</div>
        <div class="logo">
          <div class="word">KRAMPON</div>
          <div class="tag">Futbol Kariyeri</div>
          <div class="hero-ball">${ballSVG()}</div>
          <div class="hero-shadow"></div>
        </div>
        <div class="title-actions">
          ${app.draft ? `<button class="btn primary lg block" data-act="tryouts">${icon('play')} Seçmelere Devam Et</button>` : ''}
          ${canContinue ? `<button class="btn ${app.draft ? 'ghost' : 'primary'} lg block" data-act="continue">${icon('play')} Devam Et</button>` : ''}
          <button class="btn ${canContinue || app.draft ? 'ghost' : 'primary'} lg block" data-act="new">${icon('plus')} Yeni Kariyer</button>
          <button class="btn ghost block" data-act="settings">${icon('gear')} Ayarlar</button>
          ${standalone ? '' : `<p class="install-tip">${isIOS
            ? 'Uygulama gibi oynamak için Safari\'de <b>Paylaş</b> → <b>Ana Ekrana Ekle</b>.'
            : app.installPrompt ? '<button class="btn sm ghost" data-act="install">Ana ekrana ekle</button>' : 'Tarayıcı menüsünden <b>Ana ekrana ekle</b> ile uygulama gibi oynayabilirsin.'}</p>`}
        </div>
      </div>`,
    mount(el) {
      el.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        app.click();
        if (act === 'continue') app.resume();
        if (act === 'tryouts') app.go('tryouts');
        if (act === 'new') {
          if (canContinue) {
            const ok = await app.confirm('Yeni kariyer', 'Mevcut kariyerin silinecek. Emin misin?', 'Evet, baştan başla');
            if (!ok) return;
          }
          app.go('create');
        }
        if (act === 'settings') app.go('settings');
        if (act === 'install' && app.installPrompt) {
          app.installPrompt.prompt();
          app.installPrompt = null;
        }
      });
    },
  };
}
