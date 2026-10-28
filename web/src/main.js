import './styles/main.css';
import './styles/features.css';
import { createApp } from './ui/app.js';
import { configureAudio, unlock } from './audio.js';
import { configureMusic } from './music/player.js';
import * as chirp from './core/chirp/index.js';
import * as mentor from './core/mentor/index.js';
import { runMiniGame } from './games/index.js';
import { loadSprites } from './assets/sprites.js';
import { setLang } from './i18n/index.js';
import { playStudioIntro } from './ui/studioIntro.js';

// Sprite atlası (≈180 KB) ilk ekranla paralel yüklenir; hazır olana kadar SVG/çizim yedekleri görünür
loadSprites();

const root = document.getElementById('app');
const app = createApp(root);
// Arayüz dili (Türkçe dışında sözlük tembel yüklenir; ekran çevirisi DOM ve tuval katmanında)
setLang(app.settings.lang || 'tr');
configureAudio(app.settings);
configureMusic(app.settings);

// iOS: ses ilk dokunuşta açılır
document.addEventListener('pointerdown', unlock, { passive: true });
// iOS Safari'de iki parmakla yakınlaştırmayı engelle (oyun ekranı bozulmasın)
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Android/Chrome: "Ana ekrana ekle" istemini yakala
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  app.installPrompt = e;
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

app.go('title');
// ilk ekran çizildikten sonra, tarayıcı boşta kalınca diğer ekran parçalarını indir
(window.requestIdleCallback || ((f) => setTimeout(f, 1200)))(() => app.preload(), { timeout: 4000 });
// Açılış: stüdyo introsu (oturum başına bir kez, dokununca atlanır); giriş ekranı altında hazır bekler
playStudioIntro(root.closest('.app') || root.querySelector('.app') || root);
window.__krampon = app;
// Test modu (?autoplay=1): Chirp/mentor tetikleyicilerini ve mini oyunları testten çağırabilmek için
if (app.autoplay) {
  window.__chirp = chirp;
  window.__mentor = mentor;
  window.__games = { runMiniGame };
}
