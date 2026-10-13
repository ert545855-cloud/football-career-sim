import './styles/main.css';
import { createApp } from './ui/app.js';
import { configureAudio, unlock } from './audio.js';
import * as chirp from './core/chirp/index.js';
import * as mentor from './core/mentor/index.js';
import { runMiniGame } from './games/index.js';
import { loadSprites } from './assets/sprites.js';

// Sprite atlası (≈180 KB) ilk ekranla paralel yüklenir; hazır olana kadar SVG/çizim yedekleri görünür
loadSprites();

const root = document.getElementById('app');
const app = createApp(root);
configureAudio(app.settings);

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
window.__krampon = app;
// Test modu (?autoplay=1): Chirp/mentor tetikleyicilerini ve mini oyunları testten çağırabilmek için
if (app.autoplay) {
  window.__chirp = chirp;
  window.__mentor = mentor;
  window.__games = { runMiniGame };
}
