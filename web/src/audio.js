// SES — tamamen WebAudio ile sentezlenir (dosya indirmez, çevrimdışı çalışır).
// iOS'ta ses ancak ilk dokunuştan sonra açılabilir; unlock() bunu halleder.

import { configureHaptics, haptic } from './haptics.js';

let ctx = null;
let enabled = true;
let vibrateOn = true;
let master = null;

export function configureAudio({ sound, vibrate, haptic: level }) {
  enabled = sound !== false;
  vibrateOn = vibrate !== false;
  configureHaptics({ vibrate, haptic: level });
}

const unlockHooks = [];
/** Ses bağlamı açılınca çağrılır (müzik bekleyen parçayı başlatır). */
export function onUnlock(fn) { unlockHooks.push(fn); }
/** Paylaşılan AudioContext (henüz açılmadıysa null). */
export const audioCtx = () => ctx;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  for (const fn of unlockHooks) { try { fn(ctx); } catch { /* yoksay */ } }
}

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(freq, dur, { type = 'sine', gain = 0.3, attack = 0.005, slide = 0, delay = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { gain = 0.3, freq = 1200, q = 0.8, type = 'bandpass', attack = 0.01, delay = 0, sweep = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.1);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.linearRampToValueAtTime(freq + sweep, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.1);
}

const SFX = {
  click: () => tone(660, 0.06, { type: 'triangle', gain: 0.12 }),
  kick: () => { tone(140, 0.12, { type: 'sine', gain: 0.6, slide: -90 }); noise(0.05, { gain: 0.25, freq: 2500 }); },
  whistle: () => { tone(2900, 0.32, { type: 'sine', gain: 0.18 }); tone(3100, 0.32, { type: 'sine', gain: 0.1 }); tone(2900, 0.5, { type: 'sine', gain: 0.18, delay: 0.38 }); },
  shortWhistle: () => tone(3000, 0.22, { type: 'sine', gain: 0.16 }),
  goal: () => { noise(2.4, { gain: 0.45, freq: 900, q: 0.4, attack: 0.15, sweep: 500 }); noise(1.6, { gain: 0.2, freq: 2400, q: 0.6, attack: 0.2 }); tone(523, 0.18, { type: 'square', gain: 0.07, delay: 0.1 }); tone(659, 0.18, { type: 'square', gain: 0.07, delay: 0.25 }); tone(784, 0.4, { type: 'square', gain: 0.07, delay: 0.4 }); },
  miss: () => noise(1.1, { gain: 0.3, freq: 500, q: 0.5, attack: 0.08, sweep: -250 }),
  save: () => { tone(180, 0.1, { gain: 0.4, slide: -60 }); noise(0.9, { gain: 0.22, freq: 700, attack: 0.08 }); },
  post: () => { tone(1250, 0.5, { type: 'triangle', gain: 0.25 }); tone(1880, 0.35, { type: 'sine', gain: 0.12 }); },
  tackle: () => { noise(0.25, { gain: 0.35, freq: 600, type: 'lowpass', sweep: -300 }); tone(110, 0.15, { gain: 0.4, slide: -40 }); },
  coin: () => { tone(988, 0.08, { type: 'square', gain: 0.08 }); tone(1319, 0.25, { type: 'square', gain: 0.08, delay: 0.08 }); },
  levelup: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.14, delay: i * 0.08 })); },
  error: () => tone(200, 0.18, { type: 'sawtooth', gain: 0.08, slide: -60 }),
  swish: () => noise(0.25, { gain: 0.2, freq: 3000, q: 0.7, sweep: -1500 }),
  step: () => noise(0.05, { gain: 0.08, freq: 400, type: 'lowpass' }),
  tick: () => tone(1200, 0.03, { type: 'square', gain: 0.04 }),
  engine: () => { tone(62, 1.1, { type: 'sawtooth', gain: 0.13, slide: 150, attack: 0.05 }); tone(124, 1.1, { type: 'square', gain: 0.04, slide: 260, attack: 0.05 }); noise(1.1, { gain: 0.16, freq: 260, type: 'lowpass', sweep: 380, attack: 0.05 }); },
  backfire: () => { noise(0.12, { gain: 0.5, freq: 500, type: 'lowpass' }); tone(70, 0.12, { gain: 0.4, slide: -30 }); },
  camera: () => { noise(0.04, { gain: 0.35, freq: 4000 }); tone(1800, 0.05, { type: 'square', gain: 0.05, delay: 0.05 }); noise(0.05, { gain: 0.25, freq: 3000, delay: 0.09 }); },
};

export function sfx(name) {
  if (!enabled || !ctx) return;
  try {
    SFX[name]?.();
  } catch {
    /* ses hatası oyunu durdurmasın */
  }
}

/** Titreşim: Android'de çalışır; iOS Safari desteklemez (sessizce yok sayılır). */
/** Titreşim: desen adı (haptics.js HAPTICS) ya da ham desen. iPhone'da tık geri bildirimine çevrilir. */
export function buzz(pattern = 30) {
  if (!vibrateOn) return;
  haptic(pattern);
}
