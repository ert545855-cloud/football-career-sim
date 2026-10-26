// FİZİK SESLERİ — @audiorective/core ile. Fizik motorundaki her çarpma (vuruş, sekme, direk, file, gövde,
// eldiven) çarpma hızına göre ses üretir: hızlı vuruş daha yüksek, daha parlak ve daha kısa; yavaş sekme boğuk.
// Zemin (kuru/ıslak/çamur/kar) sekme sesinin tınısını değiştirir. Ses kodu bu sınıfta, oyun yalnız yöntem çağırır.
import { AudioProcessor, createEngine } from '@audiorective/core';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Zemine göre sekme tınısı: süzgeç frekansı, sönüm süresi, gürültü payı */
const SURFACE_TONE = {
  dry: { freq: 900, decay: 0.09, noise: 0.5 },
  wet: { freq: 1500, decay: 0.07, noise: 0.9 }, // ıslak: şapırtı
  heavy: { freq: 420, decay: 0.06, noise: 0.35 }, // çamur: tok
  snow: { freq: 300, decay: 0.05, noise: 0.25 }, // kar: boğuk
};

export class ImpactSynth extends AudioProcessor {
  constructor(ctx) {
    const bus = new GainNode(ctx);
    const comp = new DynamicsCompressorNode(ctx, { threshold: -16, knee: 8, ratio: 5, attack: 0.002, release: 0.15 });
    const out = new GainNode(ctx, { gain: 0.9 });
    const len = Math.floor(ctx.sampleRate * 0.6);
    const noise = new AudioBuffer({ length: len, sampleRate: ctx.sampleRate });
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    super(ctx, ({ param }) => ({
      params: {
        volume: param({ default: 0.9, bind: out.gain }), // AudioParam → zamanlanabilir (kısma/açma rampası)
        surface: param({ default: 'dry' }), // sekme tınısı
      },
      latency: 0,
    }));
    this._bus = bus;
    this._out = out;
    this._noise = noise;
    this.defineGraph(() => [[bus, comp], [comp, out]]);
  }

  get output() {
    return this._out;
  }

  /** Kısa süreli ses kaynağı: tek seferlik yaprak düğüm, işi bitince kendiliğinden kopar. */
  _tone(freq, dur, { type = 'sine', gain = 0.3, slide = 0, delay = 0 } = {}) {
    const ctx = this.context;
    const t = ctx.currentTime + delay;
    const o = new OscillatorNode(ctx, { type, frequency: freq });
    const g = new GainNode(ctx, { gain: 0.0001 });
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this._bus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  _hit(dur, { gain = 0.3, freq = 1200, q = 0.8, type = 'bandpass', delay = 0, sweep = 0 } = {}) {
    const ctx = this.context;
    const t = ctx.currentTime + delay;
    const src = new AudioBufferSourceNode(ctx, { buffer: this._noise, playbackRate: 0.8 + Math.random() * 0.4 });
    const f = new BiquadFilterNode(ctx, { type, frequency: freq, Q: q });
    if (sweep) f.frequency.linearRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    const g = new GainNode(ctx, { gain: 0.0001 });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this._bus);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.03);
  }

  /** Vuruş: hız (m/s) arttıkça tok gövde sesi güçlenir, deri şaklaması parlaklaşır */
  kick(speed) {
    const k = clamp(speed / 32, 0.15, 1.2);
    this._tone(110 + 50 * k, 0.1 + 0.05 * k, { gain: 0.35 + 0.35 * k, slide: -70 });
    this._hit(0.03 + 0.03 * k, { gain: 0.12 + 0.22 * k, freq: 1800 + 1600 * k, q: 0.9 });
  }

  /** Sekme: dikey çarpma hızına göre; çok yavaş sekmeler sessiz */
  bounce(vz) {
    if (vz < 1.2) return;
    const k = clamp(vz / 9, 0.08, 1);
    const tone = SURFACE_TONE[this.params.surface.value] || SURFACE_TONE.dry;
    this._tone(70 + 40 * k, tone.decay + 0.05 * k, { gain: 0.25 * k + 0.04, slide: -25 });
    this._hit(tone.decay, { gain: 0.14 * k * tone.noise + 0.02, freq: tone.freq, q: 0.7, type: 'lowpass' });
  }

  /** Direk / üst direk: metalik çınlama, hızlı topta daha uzun */
  post(speed) {
    const k = clamp(speed / 25, 0.2, 1.2);
    this._tone(1180 + Math.random() * 80, 0.25 + 0.45 * k, { type: 'triangle', gain: 0.18 + 0.12 * k });
    this._tone(1830 + Math.random() * 90, 0.18 + 0.3 * k, { gain: 0.08 + 0.06 * k });
    this._tone(2960, 0.12 + 0.15 * k, { gain: 0.04 * k });
    this._hit(0.04, { gain: 0.2 * k, freq: 3200, q: 1.2 });
  }

  /** File: hışırtı, top ağlara ne kadar sert girerse o kadar uzun */
  net(speed) {
    const k = clamp(speed / 25, 0.1, 1);
    this._hit(0.25 + 0.35 * k, { gain: 0.1 + 0.18 * k, freq: 2600, q: 0.5, sweep: -1400 });
  }

  /** Gövde / baraj: tok, boğuk darbe */
  body(speed) {
    const k = clamp(speed / 25, 0.2, 1.1);
    this._tone(95, 0.14, { gain: 0.3 + 0.25 * k, slide: -40 });
    this._hit(0.12, { gain: 0.15 + 0.15 * k, freq: 500, type: 'lowpass', sweep: -250 });
  }

  /** Eldiven: kısa, kuru şaklama */
  glove(speed) {
    const k = clamp(speed / 25, 0.2, 1);
    this._hit(0.06, { gain: 0.16 + 0.2 * k, freq: 1400, q: 1.4 });
    this._tone(220, 0.07, { gain: 0.15 * k, slide: -80 });
  }
}

/** Var olan AudioContext ve ana ses düğümü üzerine çarpma sesi motorunu kurar. */
export function startImpacts(ctx, master) {
  return createEngine(
    (c, { defineGraph }) => {
      const impacts = new ImpactSynth(c);
      defineGraph(() => [[impacts, master]]);
      return { impacts };
    },
    { context: ctx },
  );
}
