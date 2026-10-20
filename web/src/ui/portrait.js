// PİKSEL PORTRE — ana ekran ve oyuncu ekranındaki avatar: oyundaki piksel oyuncunun baş-omuz kesiti.
//   Saç, ten, forma, kol bandı ve numara kozmetiklerle aynı; tarayıcı dışında (testler) SVG avatara düşer.
import { playerCanvas } from '../games/pixel/sprites.js';
import { TW } from '../games/pixel/playerTall.js';

const CACHE = new Map();
const CROP = 17; // satır: baş + omuz + göğüs

/** look → küçük PNG (data URL), önbellekli */
export function portraitURL(look) {
  if (typeof document === 'undefined') return null;
  const key = JSON.stringify(look);
  if (CACHE.has(key)) return CACHE.get(key);
  const src = playerCanvas(look, 'down', 'idle');
  const S = CROP + 2;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, TW, CROP, Math.round((S - TW) / 2), 2, TW, CROP);
  const url = cv.toDataURL('image/png');
  if (CACHE.size > 60) CACHE.clear();
  CACHE.set(key, url);
  return url;
}

export function portraitHTML(look, cls = '') {
  const url = portraitURL(look);
  return url ? `<img class="px-portrait ${cls}" src="${url}" alt="" draggable="false">` : '';
}
