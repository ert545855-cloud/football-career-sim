// KAVİSLİ PAS YOLU (2B, kuşbakışı) — çizilen hattan kübik Bezier.
// Unity'deki PassPath.cs'in JavaScript karşılığı:
//  • Eğri çizimin başından (top), 1/3'ünden, 2/3'ünden ve ucundan GEÇER.
//  • Yay uzunluğu tablosu (LUT) ile top eğri boyunca SABİT hızla ilerler.
//  • turn: başlangıç ve bitiş yönleri arasındaki açı (derece). Ekranda saat yönü (sağa kıvrılma) pozitif.
//  • Yükseklik (h) yalnızca görseldir: uzun paslar havadan gider, yüksekteyken rakip araya giremez.
// Bellek ayırmaz: aynı nesne her karede yeniden build() edilir.

export const LUT_SAMPLES = 48;

export function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** Kırık çizgi üzerinde, toplam uzunluğun f oranındaki nokta. */
export function pointAtFraction(pts, f) {
  const target = polylineLength(pts) * Math.max(0, Math.min(1, f));
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= target && seg > 1e-6) {
      const k = (target - acc) / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
    acc += seg;
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
}

function clampAround(p, c, max) {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d <= max || d < 1e-9) return p;
  return { x: c.x + (dx / d) * max, y: c.y + (dy / d) * max };
}

const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export class CurvePath {
  constructor() {
    this.p0 = { x: 0, y: 0 };
    this.p1 = { x: 0, y: 0 };
    this.p2 = { x: 0, y: 0 };
    this.p3 = { x: 0, y: 0 };
    /** Ortadaki görsel yükseklik (0–1+; 1 ≈ oyuncu boyunun üstü). */
    this.loft = 0;
    this.length = 0;
    /** Derece; + = ekranda sağa (saat yönü) kıvrılma. */
    this.turn = 0;
    this.lut = new Float64Array(LUT_SAMPLES + 1);
  }

  /** Falso: + sola, − sağa (|1| ≈ 90°). */
  get curve() { return -this.turn / 90; }
  get valid() { return this.length > 0.5; }

  /**
   * @param {{x:number,y:number}[]} pts pts[0] = topun konumu, son = hedef (en az 2 nokta)
   * @param {{loftPerPx?:number, maxLoft?:number}} [o]
   */
  build(pts, { loftPerPx = 0, maxLoft = 0 } = {}) {
    const n = pts.length;
    this.p0 = { x: pts[0].x, y: pts[0].y };
    this.p3 = { x: pts[n - 1].x, y: pts[n - 1].y };
    const chord = Math.hypot(this.p3.x - this.p0.x, this.p3.y - this.p0.y);
    const s1 = lerpPt(this.p0, this.p3, 1 / 3);
    const s2 = lerpPt(this.p0, this.p3, 2 / 3);
    if (n < 4 || polylineLength(pts) < 8 || chord < 0.5) {
      this.p1 = s1;
      this.p2 = s2;
    } else {
      // B(1/3) = Q1, B(2/3) = Q2 denklemlerinin P1, P2 için çözümü
      const q1 = pointAtFraction(pts, 1 / 3);
      const q2 = pointAtFraction(pts, 2 / 3);
      const P0 = this.p0;
      const P3 = this.p3;
      let p1 = { x: (-5 * P0.x + 18 * q1.x - 9 * q2.x + 2 * P3.x) / 6, y: (-5 * P0.y + 18 * q1.y - 9 * q2.y + 2 * P3.y) / 6 };
      let p2 = { x: (2 * P0.x - 9 * q1.x + 18 * q2.x - 5 * P3.x) / 6, y: (2 * P0.y - 9 * q1.y + 18 * q2.y - 5 * P3.y) / 6 };
      // Aşırı ilmekli çizimlerde kontrol noktalarını sınırla
      const lim = Math.max(10, chord * 0.9);
      p1 = clampAround(p1, s1, lim);
      p2 = clampAround(p2, s2, lim);
      this.p1 = p1;
      this.p2 = p2;
    }
    this.loft = Math.min(maxLoft, chord * loftPerPx);
    this.finish();
    return this;
  }

  /** Kavisi k ile ölçekler (0 = dümdüz, 1 = çizildiği gibi). Falso ustalığı (statlar). */
  scaleCurve(k) {
    k = Math.max(0, Math.min(1, k));
    if (k >= 0.999) return this;
    this.p1 = lerpPt(lerpPt(this.p0, this.p3, 1 / 3), this.p1, k);
    this.p2 = lerpPt(lerpPt(this.p0, this.p3, 2 / 3), this.p2, k);
    this.finish();
    return this;
  }

  /** Bitişi kaydırır (isabet sapması); eğrinin şekli korunur. */
  shiftEnd(dx, dy) {
    this.p1 = { x: this.p1.x + dx / 3, y: this.p1.y + dy / 3 };
    this.p2 = { x: this.p2.x + (dx * 2) / 3, y: this.p2.y + (dy * 2) / 3 };
    this.p3 = { x: this.p3.x + dx, y: this.p3.y + dy };
    this.finish();
    return this;
  }

  finish() {
    const lut = this.lut;
    lut[0] = 0;
    let prev = this.evalT(0);
    for (let i = 1; i <= LUT_SAMPLES; i++) {
      const p = this.evalT(i / LUT_SAMPLES);
      lut[i] = lut[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    this.length = lut[LUT_SAMPLES];
    const a = this.derivT(0);
    const b = this.derivT(1);
    const la = Math.hypot(a.x, a.y);
    const lb = Math.hypot(b.x, b.y);
    if (la < 1e-6 || lb < 1e-6) this.turn = 0;
    else {
      const cross = a.x * b.y - a.y * b.x;
      const dot = a.x * b.x + a.y * b.y;
      this.turn = (Math.atan2(cross, dot) * 180) / Math.PI;
    }
  }

  /** t (0–1) için konum ve görsel yükseklik h. */
  evalT(t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * this.p0.x + b * this.p1.x + c * this.p2.x + d * this.p3.x,
      y: a * this.p0.y + b * this.p1.y + c * this.p2.y + d * this.p3.y,
      h: 4 * this.loft * t * u,
    };
  }

  derivT(t) {
    const u = 1 - t;
    return {
      x: 3 * u * u * (this.p1.x - this.p0.x) + 6 * u * t * (this.p2.x - this.p1.x) + 3 * t * t * (this.p3.x - this.p2.x),
      y: 3 * u * u * (this.p1.y - this.p0.y) + 6 * u * t * (this.p2.y - this.p1.y) + 3 * t * t * (this.p3.y - this.p2.y),
    };
  }

  /** Yol üzerindeki mesafeyi (s) Bezier parametresine çevirir (ikili arama). */
  distanceToT(s) {
    if (s <= 0) return 0;
    if (s >= this.length) return 1;
    let lo = 0;
    let hi = LUT_SAMPLES;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.lut[mid] <= s) lo = mid;
      else hi = mid;
    }
    const seg = this.lut[hi] - this.lut[lo];
    return (lo + (seg > 1e-9 ? (s - this.lut[lo]) / seg : 0)) / LUT_SAMPLES;
  }

  at(s) { return this.evalT(this.distanceToT(s)); }

  tangentAt(s) {
    const d = this.derivT(this.distanceToT(s));
    const l = Math.hypot(d.x, d.y);
    if (l > 1e-9) return { x: d.x / l, y: d.y / l };
    const cx = this.p3.x - this.p0.x;
    const cy = this.p3.y - this.p0.y;
    const cl = Math.hypot(cx, cy) || 1;
    return { x: cx / cl, y: cy / cl };
  }

  /** n eşit aralıklı nokta (önizleme çizgisi). */
  sample(n, out = []) {
    out.length = n;
    for (let i = 0; i < n; i++) out[i] = this.at((this.length * i) / Math.max(1, n - 1));
    return out;
  }

  /** Bir noktaya en yakın yol noktası: {d, along}. */
  closest(px, py) {
    let best = Infinity;
    let along = 0;
    for (let i = 0; i <= LUT_SAMPLES; i++) {
      const p = this.evalT(i / LUT_SAMPLES);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < best) {
        best = d;
        along = this.lut[i];
      }
    }
    return { d: best, along };
  }
}
