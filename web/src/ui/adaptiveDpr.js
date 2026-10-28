// UYARLANIR ÇÖZÜNÜRLÜK — tuvalin piksel yoğunluğunu cihazın gücüne göre ayarlar. Kareler yavaşsa (ortalama
// kare süresi ~45 fps'nin altı) çözünürlük bir kademe düşer; öğrenilen değer cihazda saklanır, sonraki açılışta
// bir kademe yukarıdan yeniden denenir. Piksel sanat düşük yoğunlukta da net kalır; akıcılık çok daha önemli.

const STEPS = [3, 2.5, 2, 1.75, 1.5, 1.25, 1];
const SLOW_MS = 22; // bu ortalamanın üstü: yavaş (≈45 fps altı)
const WINDOW = 40; // kaç karede bir karar verilir

const read = (key) => {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
};
const write = (key, v) => {
  try { localStorage.setItem(key, String(v)); } catch { /* özel pencere vb. */ }
};

/**
 * @param {string} name saklama adı (ör. 'bc', 'title', 'game')
 * @param {{max?:number, min?:number}} o
 */
export function adaptiveDpr(name, { max = 2, min = 1 } = {}) {
  const key = `krampon.dpr.${name}`;
  const dev = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const top = Math.min(max, dev);
  const stored = read(key);
  // öğrenilmiş değerin bir kademe üstünden başla (cihaz artık daha hızlı olabilir)
  let idx = STEPS.findIndex((s) => s <= top + 1e-6);
  if (stored) {
    const si = STEPS.findIndex((s) => s <= stored + 1e-6);
    if (si > idx) idx = Math.max(idx, si - 1);
  }
  let value = Math.max(min, STEPS[idx] ?? 1);
  let acc = 0;
  let n = 0;
  let last = 0;
  let skip = 20; // ilk kareler (yükleme, ısınma) sayılmaz
  return {
    get value() { return value; },
    /** Her karede çağır; çözünürlük değiştiyse true döner (tuvali yeniden boyutlandır). */
    frame(now) {
      const dt = last ? now - last : 0;
      last = now;
      if (skip > 0) { skip--; return false; }
      if (dt <= 0 || dt > 250) return false; // sekme gizlendi/duraklama
      acc += dt;
      n++;
      if (n < WINDOW) return false;
      const avg = acc / n;
      acc = 0;
      n = 0;
      if (avg > SLOW_MS && value > min) {
        const ni = STEPS.findIndex((s) => s < value - 1e-6);
        value = Math.max(min, STEPS[ni] ?? min);
        write(key, value);
        skip = 15;
        return true;
      }
      if (avg <= 18 && value >= STEPS[idx] - 1e-6) write(key, value); // bu düzeyde akıcı
      return false;
    },
    /** Kare sayacını sıfırla (duraklama sonrası) */
    reset() { last = 0; acc = 0; n = 0; skip = 10; },
  };
}
