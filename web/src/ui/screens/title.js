import { icon, playerAvatar } from '../art.js';
import { hasSave, saveSettings } from '../../core/storage.js';
import { CLUB_BY_ID } from '../../core/data.js';
import { ovr } from '../../core/player.js';
import { leagueLabel, leagueOf } from '../../core/league.js';
import { playerLook } from '../../core/cosmetics.js';
import { checkCloudOnStart } from '../cloudView.js';
import { playIntro } from '../intro.js';
import { esc, sheet } from '../dom.js';
import { mountTitleScene } from '../titleScene.js';
import { LANGS, LANG_BY_ID, setLang } from '../../i18n/index.js';

/** Devam kartı: kayıttaki oyuncu, kulüp ve takvim */
function saveCard(s, primary) {
  const p = s.player;
  const club = CLUB_BY_ID[s.career?.clubId];
  const cal = s.calendar || {};
  const when = s.career?.retired || cal.phase === 'retired' ? 'Emekli efsane' : cal.phase === 'seasonEnd' ? `Sezon ${cal.season} · sezon sonu` : `Sezon ${cal.season || 1} · Hafta ${cal.week || 1}`;
  let lg = '';
  try { lg = club ? leagueLabel(leagueOf(club.id)) : ''; } catch { lg = ''; }
  return `<button class="title-save ${primary ? 'primary' : ''}" data-act="continue">
    <span class="ts-av">${playerAvatar(s)}</span>
    <span class="ts-info">
      <b class="ellipsis">${esc(p.name)}</b>
      <span class="ellipsis">${esc(club?.name || '')}${lg ? ` · ${esc(lg)}` : ''}</span>
      <small>${esc(when)} · ${p.age} yaş</small>
    </span>
    <span class="ts-ovr">${ovr(p)}<small>OVR</small></span>
    <span class="ts-play">${icon('play')}</span>
  </button>`;
}

async function langSheet(app) {
  const st = app.settings;
  const cur = st.lang || 'tr';
  const pickId = await sheet({
    html: `<h3>🌐 Dil · Language</h3>
      <div class="lang-grid" data-noi18n>${LANGS.map((l) => `<button class="${cur === l.id ? 'on' : ''}" data-close="${l.id}" lang="${l.id}" dir="${l.dir || 'ltr'}">${l.name}</button>`).join('')}</div>
      <p class="muted small" data-noi18n style="margin:10px 0 0">Beta: çeviriler tamamlanıyor · Beta: translations in progress</p>`,
  });
  if (!pickId || pickId === cur || !LANG_BY_ID[pickId]) return false;
  st.lang = pickId;
  saveSettings(st);
  await setLang(pickId);
  return true;
}

async function installSheet(app, isIOS) {
  if (app.installPrompt) {
    app.installPrompt.prompt();
    app.installPrompt = null;
    return;
  }
  await sheet({
    html: `<h3>${icon('download')} Uygulama gibi oyna</h3>
      <p class="muted" style="margin:0 0 10px">${isIOS
        ? 'Safari\'de alttaki <b>Paylaş</b> düğmesine, ardından <b>Ana Ekrana Ekle</b>\'ye dokun.'
        : 'Tarayıcı menüsünden (⋮) <b>Ana ekrana ekle</b> ya da <b>Uygulamayı yükle</b>\'yi seç.'} Oyun tam ekran açılır ve internet olmadan da çalışır.</p>
      <button class="btn primary block" data-close="">Tamam</button>`,
  });
}

export function titleScreen(app) {
  const canContinue = hasSave() && app.state;
  const s = canContinue ? app.state : null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  const curLang = LANG_BY_ID[app.settings?.lang || 'tr'] || LANGS[0];
  return {
    tabs: false,
    raw: true,
    html: `
      <div class="title-screen">
        <canvas class="title-bg" aria-hidden="true"></canvas>
        <div class="title-top">
          <div class="logo">
            <div class="logo-wrap"><img class="logo-img" src="./logo.webp" alt="New Football Stars" /><span class="logo-shine" aria-hidden="true"></span></div>
            <div class="tag"><i></i><span>Futbol Kariyeri</span><i></i></div>
          </div>
        </div>
        <div class="title-stage" aria-hidden="true"></div>
        <div class="title-actions">
          ${app.draft ? `<button class="btn primary lg block" data-act="tryouts">${icon('play')} Seçmelere Devam Et</button>` : ''}
          ${s ? saveCard(s, !app.draft) : ''}
          <button class="btn ${canContinue || app.draft ? 'ghost' : 'primary'} lg block" data-act="new">${icon('plus')} Yeni Kariyer</button>
          <div class="title-row">
            <button class="btn ghost" data-act="settings">${icon('gear')} Ayarlar</button>
            <button class="btn ghost" data-act="lang" data-noi18n><span aria-hidden="true">🌐</span> ${esc(curLang.name)}</button>
          </div>
          ${standalone ? '' : `<button class="title-install" data-act="install">${icon('download', 'ico sm')} Ana ekrana ekle: uygulama gibi oyna</button>`}
        </div>
      </div>`,
    mount(el) {
      // Bulut: başka cihazda daha yeni bir kayıt varsa (oturumda bir kez) sor
      if (!app.cloudChecked) {
        app.cloudChecked = true;
        checkCloudOnStart(app);
      }
      const root = el.querySelector('.title-screen') || el;
      const cv = root.querySelector('.title-bg');
      const stage = root.querySelector('.title-stage');
      const club = s ? CLUB_BY_ID[s.career?.clubId] : null;
      let look = null;
      try { look = s ? playerLook(s) : null; } catch { look = null; }
      if (cv) {
        mountTitleScene(cv, {
          look,
          colors: club?.colors,
          board: club ? `${club.short || club.name}  -  NEW FOOTBALL STARS` : 'NEW FOOTBALL STARS  -  FUTBOL KARİYERİ',
          anchor: () => {
            const r = stage.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom };
          },
          winter: () => !!root.closest('.app')?.classList.contains('winter'),
        });
      }
      root.addEventListener('click', async (e) => {
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
          // Giriş hikâyesi (atlanabilir), sonra isim ekranı
          await playIntro(el.closest('.app') || document.getElementById('app'));
          app.go('create');
        }
        if (act === 'settings') app.go('settings');
        if (act === 'lang' && (await langSheet(app))) app.go('title');
        if (act === 'install') await installSheet(app, isIOS);
      });
    },
  };
}
