// HAVA EFEKTLERİ (mini oyunlar) — zemin katmanı (ıslak parlama, su birikintisi, çamur, kar örtüsü) ve
// gök katmanı (yağmur çizgileri, kar taneleri, şimşek). Durumsuz: parçacık konumları zamandan hesaplanır.
// Piksel stili: kare taneler, tamsayı koordinatlar.

const NONE = { ground() {}, sky() {}, tint() {}, kind: 'clear' };

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Zemin dokusu: boyuta göre bir kez çizilip önbelleğe alınır. */
function groundLayer(kind, W, H, area) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W));
  c.height = Math.max(1, Math.round(H));
  const g = c.getContext('2d');
  const r = seeded(Math.round(W * 7 + H * 13) + kind.length * 101);
  const y0 = area?.y0 ?? 0;
  const span = H - y0;
  if (kind === 'wet') {
    g.fillStyle = 'rgba(12, 32, 60, 0.16)';
    g.fillRect(0, y0, W, span);
    // Su birikintileri: koyu elips + gökyüzü yansıması
    for (let i = 0; i < 7; i++) {
      const x = r() * W;
      const y = y0 + r() * span;
      const rx = 14 + r() * 34;
      const ry = rx * (0.3 + r() * 0.2);
      g.fillStyle = 'rgba(20, 40, 70, 0.38)';
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(190, 215, 255, 0.22)';
      g.fillRect(Math.round(x - rx * 0.5), Math.round(y - ry * 0.3), Math.round(rx * 0.6), 2);
      g.fillRect(Math.round(x - rx * 0.1), Math.round(y + ry * 0.15), Math.round(rx * 0.4), 1);
    }
  } else if (kind === 'heavy') {
    // Çamur: orta koridor ve rastgele lekeler
    for (let i = 0; i < 26; i++) {
      const x = W * 0.5 + (r() - 0.5) * W * (i < 14 ? 0.5 : 1.1);
      const y = y0 + r() * span;
      const rx = 10 + r() * 30;
      g.fillStyle = `rgba(${92 + r() * 20}, ${62 + r() * 12}, ${34 + r() * 8}, ${0.35 + r() * 0.3})`;
      g.beginPath(); g.ellipse(x, y, rx, rx * (0.45 + r() * 0.3), r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 90; i++) { // krampon izleri
      g.fillStyle = 'rgba(60, 38, 18, 0.45)';
      g.fillRect(Math.round(r() * W), Math.round(y0 + r() * span), 2, 2);
    }
  } else if (kind === 'snow') {
    // Kar örtüsü: düzgün beyaz örtü + ince doku; çizgiler soluk seçilir; ezilmiş koridorlarda yeşil görünür
    // örtü hafif: saha ve oyuncular okunur kalsın (yer yer kar birikintileri daha yoğun)
    g.fillStyle = 'rgba(232, 241, 252, 0.34)';
    g.fillRect(0, y0, W, span);
    for (let i = 0; i < 9; i++) {
      const x = r() * W;
      const y = y0 + r() * span;
      g.fillStyle = 'rgba(245, 249, 255, 0.28)';
      g.beginPath(); g.ellipse(x, y, W * (0.06 + r() * 0.08), span * (0.03 + r() * 0.04), 0, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 5; i++) { // oyuncuların ezdiği koridorlar
      const x = W * (0.2 + r() * 0.6);
      g.fillStyle = 'rgba(90, 130, 95, 0.09)';
      g.beginPath(); g.ellipse(x, y0 + span * (0.3 + r() * 0.5), W * 0.08, span * 0.3, (r() - 0.5) * 0.6, 0, Math.PI * 2); g.fill();
    }
    const dots = Math.round((W * span) / 420);
    for (let i = 0; i < dots; i++) {
      const v = r();
      g.fillStyle = v < 0.55 ? 'rgba(255,255,255,0.6)' : v < 0.85 ? 'rgba(196, 212, 236, 0.45)' : 'rgba(120, 150, 125, 0.3)';
      g.fillRect(Math.round(r() * W), Math.round(y0 + r() * span), v < 0.85 ? 2 : 1, 2);
    }
  }
  return c;
}

/**
 * @param {object|null} weather core/weather.js nesnesi
 * @param {{y0?:number}} area zemin katmanının başladığı y (şut sahnesinde ufuk çizgisi)
 */
export function weatherFx(weather, area = {}) {
  if (!weather || typeof document === 'undefined') return NONE;
  const id = weather.id;
  const surface = weather.surface;
  const wind = weather.wind || { x: 0, y: 0 };
  const rain = id === 'rain' || id === 'storm';
  const snow = id === 'snow';
  const storm = id === 'storm';
  let layer = null;
  let key = '';
  const drops = [];
  const r = seeded(97 + (weather.temp || 0) * 3);
  const n = storm ? 170 : rain ? 110 : snow ? 130 : id === 'windy' ? 26 : 0;
  for (let i = 0; i < n; i++) drops.push({ x: r(), y: r(), z: 0.4 + r() * 0.6, ph: r() * 6.28 });
  let flash = 0;
  let nextFlash = 3 + r() * 5;

  return {
    kind: id,
    ground(ctx, W, H) {
      if (surface === 'dry') {
        if (id === 'hot') { ctx.fillStyle = 'rgba(255, 196, 80, 0.07)'; ctx.fillRect(0, area.y0 || 0, W, H); }
        return;
      }
      const k = `${surface}|${Math.round(W)}|${Math.round(H)}|${area.y0 || 0}`;
      if (k !== key) { layer = groundLayer(surface, W, H, area); key = k; }
      ctx.drawImage(layer, 0, 0, W, H);
    },
    /** Kayan sahneler için düz zemin tonu (birikinti çizmeden) */
    tint(ctx, W, H) {
      const c = { wet: 'rgba(12, 32, 60, 0.18)', heavy: 'rgba(96, 64, 30, 0.2)', snow: 'rgba(236, 244, 255, 0.26)' }[surface];
      if (c) { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }
    },
    sky(ctx, W, H, t) {
      if (rain) {
        // Yağmur: rüzgârla eğik çizgiler, yakındakiler uzun ve parlak
        const slant = Math.max(-0.6, Math.min(0.6, wind.x * 0.06));
        ctx.save();
        ctx.lineCap = 'square';
        for (const d of drops) {
          const v = (storm ? 1.9 : 1.5) * d.z;
          const y = ((d.y + t * v) % 1) * (H + 40) - 20;
          const x = (((d.x + t * slant * v * 0.5) % 1) + 1) % 1 * W;
          const len = 8 + d.z * 12;
          ctx.strokeStyle = `rgba(200, 220, 255, ${0.18 + d.z * 0.3})`;
          ctx.lineWidth = d.z > 0.8 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(Math.round(x), Math.round(y));
          ctx.lineTo(Math.round(x + slant * len), Math.round(y + len));
          ctx.stroke();
          // Yere çarpan damla halkası
          if (d.z > 0.85 && y > H * 0.3) {
            const p = ((t * 2.2 + d.ph) % 1);
            ctx.strokeStyle = `rgba(210, 230, 255, ${0.35 * (1 - p)})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.round(d.x * W - p * 5), Math.round(((d.ph / 6.28) * H) - p * 2), Math.round(p * 10), Math.round(p * 4));
          }
        }
        ctx.restore();
        ctx.fillStyle = storm ? 'rgba(10, 18, 34, 0.2)' : 'rgba(18, 28, 46, 0.1)';
        ctx.fillRect(0, 0, W, H);
      } else if (snow) {
        // Kar: yavaş düşen, rüzgârla sürüklenen, salınan kare taneler
        for (const d of drops) {
          const v = 0.08 + d.z * 0.1;
          const y = ((d.y + t * v) % 1) * (H + 10) - 5;
          const sway = Math.sin(t * (0.8 + d.z) + d.ph) * 10 * d.z;
          const x = ((((d.x + (t * wind.x * 0.012 * d.z)) % 1) + 1) % 1) * W + sway;
          const s = d.z > 0.8 ? 3 : 2;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + d.z * 0.45})`;
          ctx.fillRect(Math.round(x), Math.round(y), s, s);
        }
        ctx.fillStyle = 'rgba(200, 220, 255, 0.06)';
        ctx.fillRect(0, 0, W, H);
      } else if (id === 'windy') {
        // Rüzgâr: uçuşan yaprak/toz çizgileri
        const dir = Math.sign(wind.x || 1);
        for (const d of drops) {
          const x = ((((d.x + t * 0.35 * dir * d.z) % 1) + 1) % 1) * W;
          const y = d.y * H + Math.sin(t * 2 + d.ph) * 8;
          ctx.fillStyle = `rgba(235, 240, 220, ${0.12 + d.z * 0.18})`;
          ctx.fillRect(Math.round(x), Math.round(y), Math.round(10 + d.z * 18), 1);
        }
      }
      if (storm) {
        nextFlash -= 1 / 60;
        if (nextFlash <= 0) { flash = 1; nextFlash = 5 + Math.random() * 7; }
        if (flash > 0.02) {
          ctx.fillStyle = `rgba(235, 240, 255, ${flash * 0.35})`;
          ctx.fillRect(0, 0, W, H);
          flash *= 0.86;
        }
      }
    },
  };
}
