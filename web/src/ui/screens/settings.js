import { setSocialLang } from '../../core/chirp/lang.js';
import { clearSave, exportSave, importSave, saveSettings } from '../../core/storage.js';
import { buzz, configureAudio, sfx } from '../../audio.js';
import { hapticSupport } from '../../haptics.js';
import { icon } from '../art.js';
import { toast } from '../dom.js';
import { cloudSectionPlaceholder, mountCloudSection } from '../cloudView.js';
import { unityBuildAvailable } from '../../games/unity3d.js';
import { configureMusic, nowPlaying, onNowPlaying } from '../../music/player.js';
import { resetTutorial } from '../tutorial.js';
import { LANGS, setLang } from '../../i18n/index.js';

const npText = () => { const n = nowPlaying(); return n ? `♪ Şu an çalıyor: <b>${n.title}</b> · ${n.mood}` : '♪ Müzik ilk dokunuşta başlar.'; };

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
        <div class="li"><span class="ic" style="color:var(--accent)">🌐</span><div class="grow"><b>Dil</b> <span class="muted small" data-noi18n>· Language</span><div class="lang-grid" style="margin-top:8px" data-noi18n>${LANGS.map((l) => `<button class="${(st.lang || 'tr') === l.id ? 'on' : ''}" data-lang="${l.id}" lang="${l.id}" dir="${l.dir || 'ltr'}">${l.name}</button>`).join('')}</div><div class="muted small" style="margin-top:6px" data-noi18n>Beta: çeviriler tamamlanıyor, bazı metinler henüz Türkçe · Beta: translations in progress</div></div></div>
        ${toggle('sound', 'Ses efektleri', 'sound', 'Vuruş, düdük, tribün sesleri')}
        ${toggle('music', 'Müzik', 'music', 'Oyuna özel bestelenmiş hareketli pop parçalar')}
        ${st.music !== false ? `<div class="li"><span class="ic"></span><div class="grow"><b>Müzik sesi</b><div class="seg" style="margin-top:8px">${[[0.25, 'Kısık'], [0.5, 'Orta'], [0.85, 'Yüksek']].map(([k, l]) => `<button class="${Math.abs((st.musicVol ?? 0.5) - k) < 0.05 ? 'on' : ''}" data-mvol="${k}">${l}</button>`).join('')}</div><div class="muted small" style="margin-top:6px" data-np>${npText()}</div></div></div>` : ''}
        ${toggle('vibrate', 'Titreşim', 'vibrate', hapticSupport() === 'none' ? 'Bu cihaz/tarayıcı titreşimi desteklemiyor.' : hapticSupport() === 'ios' ? 'Golü, pası, kurtarışı hisset (iPhone: dokunsal tıklar)' : 'Golü, pası, kurtarışı ve müdahaleyi elinde hisset')}
        ${st.vibrate ? `<div class="li"><span class="ic"></span><div class="grow"><b>Titreşim gücü</b><div class="seg" style="margin-top:8px">${[['soft', 'Hafif'], ['normal', 'Normal'], ['strong', 'Güçlü']].map(([k, l]) => `<button class="${(st.haptic || 'normal') === k ? 'on' : ''}" data-haptic-level="${k}">${l}</button>`).join('')}</div><div class="muted small" style="margin-top:6px">Seçince gol titreşimini dener.</div></div></div>` : ''}
        <div class="li"><span class="ic" style="color:#bfdbfe">❄️</span><div class="grow"><b>Kış teması</b><div class="muted small">Otomatik: giriş ekranında ve takvimde Aralık–Şubat haftalarında kar yağar.</div><div class="seg" style="margin-top:8px">${[['auto', 'Otomatik'], ['on', 'Hep açık'], ['off', 'Kapalı']].map(([k, l]) => `<button class="${(st.winter || 'auto') === k ? 'on' : ''}" data-winter="${k}">${l}</button>`).join('')}</div></div></div>
        <div class="li"><span class="ic" style="color:#38bdf8">${icon('chirp')}</span><div class="grow"><b>Sosyal medya dili</b><div class="muted small">Türkçe: tüm gönderi ve yorumlar Türkçe. Orijinal: yabancı taraftarlar kendi dillerinde yazar.</div><div class="seg" style="margin-top:8px">${[['tr', 'Türkçe'], ['orig', 'Orijinal']].map(([k, l]) => `<button class="${(st.socialLang || 'tr') === k ? 'on' : ''}" data-social-lang="${k}">${l}</button>`).join('')}</div></div></div>
        <div class="li"><span class="ic" style="color:#a78bfa">📺</span><div class="grow"><b>Siyah Show</b><div class="muted small">Maç önü ve devre arası yorum programı (kurgusal parodi). Otomatik: büyük maçlarda ve bazı maçlarda.</div><div class="seg" style="margin-top:8px">${[['auto', 'Otomatik'], ['on', 'Her maçta'], ['off', 'Kapalı']].map(([k, l]) => `<button class="${(st.siyahShow || 'auto') === k ? 'on' : ''}" data-siyah="${k}">${l}</button>`).join('')}</div></div></div>
        <div class="li"><span class="ic" style="color:var(--accent)">${icon('user')}</span><div class="grow"><b>Eğitici asistan</b><div class="muted small">Asistan Hoca Selin ekranları ve mini oyunları ilk seferde anlatır.</div></div><button class="btn sm ${st.tutorial?.off ? 'ghost' : 'primary'}" data-act="tut-toggle">${st.tutorial?.off ? 'Kapalı' : 'Açık'}</button></div>
        <div class="li"><span class="ic"></span><div class="grow"><b>Eğitimi baştan başlat</b><div class="muted small">Tüm anlatımlar yeniden gösterilir.</div></div><button class="btn sm ghost" data-act="tut-reset">Başlat</button></div>
        <div class="li"><span class="ic" style="color:var(--accent)">${icon('play')}</span><div class="grow"><b>Giriş hikâyesi</b><div class="muted small">Babandan gizli seçmelere gittiğin o sabah.</div></div><button class="btn sm ghost" data-act="story">İzle</button></div>
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
      <p class="muted small center" style="margin-top:18px">New Football Stars v1.1 · Kulüpler, sponsorlar ve isimler kurgusaldır.</p>`,
    mount(el) {
      mountCloudSection(app, el);
      const np = el.querySelector('[data-np]');
      if (np) { const off = onNowPlaying(() => { if (!np.isConnected) return off(); np.innerHTML = npText(); }); }
      // 3B mod yalnızca sunucuda Unity derlemesi varsa görünür
      unityBuildAvailable().then((ok) => {
        const row = el.querySelector('[data-unity-toggle]');
        if (ok && row) row.hidden = false;
      });
      el.addEventListener('click', async (e) => {
        const t = e.target.closest('button');
        if (!t || t.dataset.cloudAct) return;
        app.click();
        if (t.dataset.lang) {
          st.lang = t.dataset.lang;
          saveSettings(st);
          await setLang(st.lang);
          app.go('settings');
          return;
        }
        if (t.dataset.mvol) {
          st.musicVol = Number(t.dataset.mvol);
          saveSettings(st);
          configureMusic(st);
          app.go('settings');
          return;
        }
        if (t.dataset.siyah) {
          st.siyahShow = t.dataset.siyah;
          saveSettings(st);
          app.go('settings');
          return;
        }
        if (t.dataset.winter) {
          st.winter = t.dataset.winter;
          saveSettings(st);
          app.go('settings');
          return;
        }
        if (t.dataset.hapticLevel) {
          st.haptic = t.dataset.hapticLevel;
          saveSettings(st);
          configureAudio(st);
          buzz('goal');
          app.go('settings');
          return;
        }
        if (t.dataset.toggle) {
          st[t.dataset.toggle] = !st[t.dataset.toggle];
          saveSettings(st);
          configureAudio(st);
          configureMusic(st);
          if (t.dataset.toggle === 'sound' && st.sound) sfx('coin');
          if (t.dataset.toggle === 'vibrate' && st.vibrate) buzz('pass');
          app.go('settings');
        } else if (t.dataset.socialLang) {
          app.settings.socialLang = t.dataset.socialLang;
          setSocialLang(app.settings.socialLang);
          app.saveSettings();
          app.go('settings');
        } else if (t.dataset.act === 'tut-toggle') {
          app.click();
          const tu = (app.settings.tutorial ||= { done: {}, games: {}, off: false });
          tu.off = !tu.off;
          app.saveSettings();
          app.go('settings');
        } else if (t.dataset.act === 'tut-reset') {
          app.click();
          resetTutorial(app);
          toast('Eğitim baştan başlayacak. Ana ekrana dönünce Asistan Hoca Selin anlatacak.');
          app.go('settings');
        } else if (t.dataset.act === 'story') {
          const { playIntro } = await import('../intro.js');
          await playIntro(document.getElementById('app'));
          app.go('settings');
          const { playMusic } = await import('../../music/player.js');
          playMusic(app.state ? 'career' : 'title');
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
