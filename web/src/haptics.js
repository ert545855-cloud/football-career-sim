// DOKUNSAL GERİ BİLDİRİM — oyuncu attığı golü, verdiği pası, yediği müdahaleyi elinde hissetsin.
//
// • Android / Chrome: navigator.vibrate desenleri ([titreşim, ara, titreşim, …] milisaniye).
// • iPhone (Safari 17.4+): vibrate API yok; gizli bir "switch" onay kutusuna dokunmak sistem
//   titreşimini (Taptic Engine 'tık') tetikler. Desendeki her titreşim parçası bir ya da birkaç tık olur.
// • Güç ayarı: hafif / normal / güçlü — titreşim sürelerini ölçekler (aralar değişmez).

/** Anlamlı desenler: mini oyunlar ve ekranlar isimle çağırır */
export const HAPTICS = {
  tap: [8], // arayüz dokunuşu
  touch: [6], // çizim / sürükleme izi
  kick: [16], // topa vuruş anı
  charge: [5], // şut gücü dolarken her kademe
  pass: [14, 55, 26], // vuruş … top arkadaşının ayağında
  passCurve: [14, 40, 10, 40, 10, 40, 30], // kavisli pas: topun dönüşü
  assist: [18, 50, 18, 50, 70],
  receive: [22],
  intercept: [30, 30, 30, 30, 30], // araya girdiler: kesik kesik
  shot: [26],
  goal: [30, 70, 45, 60, 70, 60, 120, 80, 280], // ağlar dalgalanır … tribün patlar
  target: [40, 30, 90], // hedef köşe
  post: [95], // direğin sert çınlaması
  save: [55, 35, 20], // kaleci topu kucakladı
  miss: [22, 80, 10],
  tackle: [50, 25, 40],
  tackleLost: [70],
  dribble: [10, 45, 10],
  bump: [45, 30, 45],
  slide: [35, 20, 70], // kayarak müdahale: çimde kayış … temas
  shoulder: [55, 15, 35], // omuz omuza
  foul: [80, 40, 80], // düdük: faul
  stride: [7], // koşuda ritimli adım
  perfect: [12, 25, 6], // tam ritim adımı
  falseStart: [90, 50, 90],
  step: [6],
  record: [40, 30, 80],
  whistle: [60, 60, 60, 60, 220],
  heart: [18, 120, 38], // kalp atışı (sosyal)
  heartBreak: [60, 40, 60],
  coin: [10, 40, 10],
  levelup: [20, 40, 20, 40, 80],
  error: [40, 30, 40],
  celebrate: [30, 50, 30, 50, 30, 50, 160],
  rev: [40, 25, 60, 25, 90, 25, 140, 40, 60], // motor gazı
  flash: [12, 60, 12, 60, 12], // flaş patlamaları (paparazzi)
};

const LEVELS = { soft: 0.6, normal: 1, strong: 1.6 };
let enabled = true;
let mult = 1;

export function configureHaptics({ vibrate, haptic } = {}) {
  enabled = vibrate !== false;
  mult = LEVELS[haptic] ?? 1;
}

const nav = typeof navigator !== 'undefined' ? navigator : null;
const canVibrate = () => typeof nav?.vibrate === 'function';
const isIOS = () => !!nav && (/iP(hone|ad|od)/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));

/** Deseni güç ayarına göre ölçekler (çift indisler titreşim, tekler ara) */
export function scalePattern(pattern, m = mult) {
  const p = Array.isArray(pattern) ? pattern : [pattern];
  return p.map((v, i) => (i % 2 === 0 ? Math.max(1, Math.round(v * m)) : v));
}

// ── iPhone: switch onay kutusu hilesi ──
let iosLabel = null;
function iosTick() {
  try {
    if (!iosLabel || !iosLabel.isConnected) {
      iosLabel = document.createElement('label');
      iosLabel.setAttribute('aria-hidden', 'true');
      iosLabel.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-9px;top:-9px';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      iosLabel.appendChild(input);
      document.body.appendChild(iosLabel);
    }
    iosLabel.click();
  } catch {
    /* desteklenmiyor */
  }
}

/** Deseni iPhone tıklarına çevirir: uzun titreşim parçası birkaç ardışık tık olur (en fazla 10 tık) */
export function iosSchedule(pattern) {
  const out = [];
  let t = 0;
  pattern.forEach((v, i) => {
    if (i % 2 === 0) {
      const n = Math.max(1, Math.min(4, Math.round(v / 55)));
      for (let k = 0; k < n; k++) out.push(t + k * 55);
      t += v;
    } else t += v;
  });
  return out.slice(0, 10);
}

let iosTimers = [];

/**
 * Titreşim. name: HAPTICS anahtarı ya da ham desen (sayı / dizi).
 * @param {keyof HAPTICS | number | number[]} name
 */
export function haptic(name) {
  if (!enabled || !nav) return;
  const base = typeof name === 'string' ? HAPTICS[name] : name;
  if (base == null) return;
  const pattern = scalePattern(base);
  if (canVibrate()) {
    try {
      nav.vibrate(pattern.length === 1 ? pattern[0] : pattern);
    } catch {
      /* yok */
    }
    return;
  }
  if (!isIOS()) return;
  iosTimers.forEach(clearTimeout);
  iosTimers = iosSchedule(pattern).map((ms) => (ms === 0 ? (iosTick(), 0) : setTimeout(iosTick, ms)));
}

/** Bu cihaz titreşim verebilir mi? (ayarlar ekranında bilgi için) */
export function hapticSupport() {
  if (canVibrate()) return 'vibrate';
  if (isIOS()) return 'ios';
  return 'none';
}
