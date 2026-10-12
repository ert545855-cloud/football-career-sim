import './styles/main.css';
import { createApp } from './ui/app.js';
import { configureAudio, unlock } from './audio.js';

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
