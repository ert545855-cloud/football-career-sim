import { clearSave, exportSave, importSave, saveSettings } from '../../core/storage.js';
import { configureAudio, sfx } from '../../audio.js';
import { icon } from '../art.js';
import { toast } from '../dom.js';
import { cloudSectionPlaceholder, mountCloudSection } from '../cloudView.js';
import { unityBuildAvailable } from '../../games/unity3d.js';

export function settingsScreen(app) {
  const st = app.settings;
  const toggle = (key, label, ico, desc) => `
    <div class="li">
      <span class="ic" style="color:var(--accent)">${icon(ico)}</span>
      <div class="grow"><b>${label}</b><div class="muted small">${desc}</div></div>
      <button class="btn sm ${st[key] ? 'primary' : 'ghost'}" data-toggle="${key}">${st[key] ? 'Açık' : 'Kapalı'}</button>
    </div>`;

  return {
    tabs: false,
    html: `
      <div class="row" style="margin-bottom:12px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Ayarlar</h1>
      </div>
      <div class="card list">
        ${toggle('sound', 'Ses efektleri', 'sound', 'Vuruş, düdük, tribün sesleri')}
        ${toggle('vibrate', 'Titreşim', 'vibrate', 'Gol ve müdahalede titreşim (Android)')}
        ${toggle('easyPass', 'Kolay pas', 'target', 'Pas anlarında çizmek yerine arkadaşa dokun')}
        <div data-unity-toggle hidden>${toggle('unity3d', '3B mod (Unity)', 'ball', 'Maçtaki pas ve şut anları 3B sahnede oynanır (ilk açılışta indirme yapar)')}</div>
      </div>

      <div class="h-sec">Kayıt</div>
      <div class="card list">
        <div class="li"><div class="grow"><b>Kaydı dışa aktar</b><div class="muted small">Kodu kopyala; başka cihazda içe aktararak devam et.</div></div><button class="btn sm ghost" data-act="export" ${app.state ? '' : 'disabled'}>${icon('download')}</button></div>
        <div class="li"><div class="grow"><b>Kaydı içe aktar</b><div class="muted small">Kopyaladığın kodu yapıştır.</div></div><button class="btn sm ghost" data-act="import">${icon('upload')}</button></div>
        <div class="li"><div class="grow"><b>Kariyeri sil</b><div class="muted small">Geri alınamaz.</div></div><button class="btn sm danger" data-act="reset" ${app.state ? '' : 'disabled'}>Sil</button></div>
      </div>
      ${cloudSectionPlaceholder}

      <div class="h-sec">Uygulama olarak yükle</div>
      <div class="card small" style="line-height:1.55">
        <b>iPhone / iPad:</b> Safari'de <b>Paylaş</b> → <b>Ana Ekrana Ekle</b>.<br>
        <b>Android:</b> Chrome menüsü (⋮) → <b>Ana ekrana ekle</b> veya <b>Uygulamayı yükle</b>.<br>
        <span class="muted">Yükledikten sonra tam ekran açılır ve internet olmadan da oynanır.</span>
        ${app.installPrompt ? '<button class="btn primary block" style="margin-top:10px" data-act="install">Şimdi yükle</button>' : ''}
      </div>
      <p class="muted small center" style="margin-top:18px">Krampon v1.0 · Kulüpler ve isimler kurgusaldır.</p>`,
    mount(el) {
      mountCloudSection(app, el);
      // 3B mod yalnızca sunucuda Unity derlemesi varsa görünür
      unityBuildAvailable().then((ok) => {
        const row = el.querySelector('[data-unity-toggle]');
        if (ok && row) row.hidden = false;
      });
      el.addEventListener('click', async (e) => {
        const t = e.target.closest('button');
        if (!t || t.dataset.cloudAct) return;
        app.click();
        if (t.dataset.toggle) {
          st[t.dataset.toggle] = !st[t.dataset.toggle];
          saveSettings(st);
          configureAudio(st);
          if (t.dataset.toggle === 'sound' && st.sound) sfx('coin');
          app.go('settings');
        } else if (t.dataset.act === 'back') {
          app.back();
        } else if (t.dataset.act === 'export') {
          const code = exportSave(app.state);
          try {
            await navigator.clipboard.writeText(code);
            toast('Kayıt kodu panoya kopyalandı.', 'good');
          } catch {
            await app.showText('Kayıt kodun', code);
          }
        } else if (t.dataset.act === 'import') {
          const code = window.prompt('Kayıt kodunu yapıştır:');
          if (!code) return;
          const st2 = importSave(code);
          if (!st2) return toast('Kod geçersiz.', 'bad');
          app.state = st2;
          app.save();
          toast('Kariyer yüklendi!', 'good');
          app.resume();
        } else if (t.dataset.act === 'reset') {
          const ok = await app.confirm('Kariyeri sil', 'Tüm ilerlemen silinecek. Emin misin?', 'Evet, sil');
          if (!ok) return;
          clearSave();
          app.state = null;
          app.go('title');
        } else if (t.dataset.act === 'install' && app.installPrompt) {
          app.installPrompt.prompt();
          app.installPrompt = null;
        }
      });
    },
  };
}
