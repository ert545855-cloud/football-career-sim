// MÜZİK ÇALAR — compose.js'teki parçaları WebAudio ile sentezler (dosya yok, çevrimdışı).
// Zamanlayıcı: 25 ms'de bir, önümüzdeki 0,12 sn'nin notaları planlanır (kare hızından bağımsız, kaymaz).
// Pop sesi: four-on-the-floor davul, pompalanan akorlar (kick'te kısılır), detune saw akor, kare dalga arpej, gecikmeli lead.
import { audioCtx, onUnlock } from '../audio.js';
import {
  TRACKS, PLAYLISTS, STEPS_PER_BAR, DRUMS, BASS, CHORDS, ARP, LOOP_BARS,
  chordDegree, chordNotes, composeMelody, degreeToMidi, layersFor,
} from './compose.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const LOOKAHEAD = 0.12;

const M = {
  ctx: null, out: null, comp: null, bus: null, chordBus: null, delay: null, noise: null,
  enabled: true, vol: 0.5, duck: false,
  want: null, // istenen parça / liste
  track: null, id: null, list: null, listIdx: 0, loops: 0,
  step: 0, next: 0, timer: 0, intensity: null, melody: null,
  listeners: new Set(),
};

function setup(ctx) {
  if (M.ctx) return;
  M.ctx = ctx;
  M.out = ctx.createGain();
  M.out.gain.value = 0;
  M.comp = ctx.createDynamicsCompressor();
  M.comp.threshold.value = -16;
  M.comp.ratio.value = 4;
  M.comp.attack.value = 0.005;
  M.comp.release.value = 0.2;
  M.out.connect(M.comp).connect(ctx.destination);
  M.bus = ctx.createGain();
  M.bus.connect(M.out);
  M.chordBus = ctx.createGain();
  M.chordBus.connect(M.bus);
  // Geri besleme gecikmesi (lead/arpej için)
  M.delay = ctx.createDelay(1.5);
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  const dlp = ctx.createBiquadFilter();
  dlp.type = 'lowpass';
  dlp.frequency.value = 2400;
  M.delay.connect(dlp).connect(fb).connect(M.delay);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  dlp.connect(wet).connect(M.bus);
  // Paylaşılan gürültü tamponu
  const len = ctx.sampleRate;
  M.noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = M.noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  document.addEventListener('visibilitychange', () => {
    if (!M.ctx) return;
    if (document.hidden) stopTimer();
    else if (M.track && M.enabled) { M.next = M.ctx.currentTime + 0.08; startTimer(); }
  });
}

// ───────────────────────── Enstrümanlar ─────────────────────────
function gainEnv(t, peak, attack, decay, sustain = 0.0001, hold = 0, release = 0.06) {
  const g = M.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  if (hold > 0) {
    g.gain.setTargetAtTime(Math.max(0.0001, peak * sustain), t + attack, decay / 3);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sustain), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  return g;
}

function noiseSrc(t, dur) {
  const s = M.ctx.createBufferSource();
  s.buffer = M.noise;
  s.start(t, Math.random() * 0.5, dur + 0.05);
  return s;
}

function kick(t, v = 1) {
  const o = M.ctx.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
  const g = gainEnv(t, 0.95 * v, 0.003, 0.3);
  o.connect(g).connect(M.bus);
  o.start(t);
  o.stop(t + 0.35);
  // Pompa: akorlar kick'te kısılıp geri gelir (pop/house hissi)
  const cg = M.chordBus.gain;
  cg.cancelScheduledValues(t);
  cg.setValueAtTime(0.32, t);
  cg.linearRampToValueAtTime(1, t + 0.22);
}

function snare(t, v = 1) {
  const n = noiseSrc(t, 0.2);
  const f = M.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1900;
  f.Q.value = 0.7;
  n.connect(f).connect(gainEnv(t, 0.32 * v, 0.002, 0.17)).connect(M.bus);
  const o = M.ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(190, t);
  o.connect(gainEnv(t, 0.22 * v, 0.002, 0.08)).connect(M.bus);
  o.start(t);
  o.stop(t + 0.12);
}

function clap(t, v = 1) {
  const n = noiseSrc(t, 0.25);
  const f = M.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1300;
  f.Q.value = 1.2;
  const g = M.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (const dt of [0, 0.011, 0.023]) {
    g.gain.setValueAtTime(0.42 * v, t + dt);
    g.gain.exponentialRampToValueAtTime(0.05, t + dt + 0.009);
  }
  g.gain.setValueAtTime(0.3 * v, t + 0.034);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  n.connect(f).connect(g).connect(M.bus);
}

function hat(t, open = false, v = 1) {
  const n = noiseSrc(t, open ? 0.2 : 0.05);
  const f = M.ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7600;
  n.connect(f).connect(gainEnv(t, (open ? 0.13 : 0.09) * v, 0.001, open ? 0.17 : 0.035)).connect(M.bus);
}

function crash(t) {
  const n = noiseSrc(t, 1.3);
  const f = M.ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 5200;
  n.connect(f).connect(gainEnv(t, 0.12, 0.002, 1.2)).connect(M.bus);
}

function bass(t, midi, dur, v = 1) {
  const f = M.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 5;
  f.frequency.setValueAtTime(1300, t);
  f.frequency.exponentialRampToValueAtTime(260, t + Math.max(0.08, dur * 0.8));
  const g = gainEnv(t, 0.36 * v, 0.004, dur, 0.75, Math.max(0.02, dur - 0.04), 0.05);
  const a = M.ctx.createOscillator();
  a.type = 'sawtooth';
  a.frequency.value = mtof(midi);
  const b = M.ctx.createOscillator();
  b.type = 'sine';
  b.frequency.value = mtof(midi - 12);
  const bg = M.ctx.createGain();
  bg.gain.value = 0.9;
  a.connect(f);
  b.connect(bg).connect(g);
  f.connect(g).connect(M.bus);
  for (const o of [a, b]) { o.start(t); o.stop(t + dur + 0.1); }
}

function stab(t, notes, dur, v = 1, bright = 2600) {
  const f = M.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(bright, t);
  f.frequency.exponentialRampToValueAtTime(bright * 0.45, t + dur + 0.05);
  const g = gainEnv(t, 0.11 * v, 0.004, dur + 0.06, 0.55, Math.max(0.03, dur - 0.03), 0.07);
  f.connect(g).connect(M.chordBus);
  for (const m of notes) {
    for (const det of [-7, 7]) {
      const o = M.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.15);
    }
  }
}

function pad(t, notes, dur, v = 1) {
  const g = M.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05 * v, t + Math.min(0.4, dur * 0.3));
  g.gain.setValueAtTime(0.05 * v, t + dur * 0.8);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
  const f = M.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1500;
  f.connect(g).connect(M.chordBus);
  for (const m of notes) {
    const o = M.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(m);
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.35);
  }
}

function piano(t, midi, v = 1) {
  const g = gainEnv(t, 0.16 * v, 0.003, 1.5);
  const f = M.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2600;
  f.connect(g).connect(M.bus);
  [[1, 'sine', 1], [2, 'triangle', 0.28], [3, 'sine', 0.09]].forEach(([h, type, a]) => {
    const o = M.ctx.createOscillator();
    o.type = type;
    o.frequency.value = mtof(midi) * h;
    const og = M.ctx.createGain();
    og.gain.value = a;
    o.connect(og).connect(f);
    o.start(t);
    o.stop(t + 1.6);
  });
}

function arp(t, midi, v = 1) {
  const o = M.ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = mtof(midi);
  const f = M.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2300;
  const g = gainEnv(t, 0.05 * v, 0.002, 0.13);
  o.connect(f).connect(g);
  g.connect(M.bus);
  g.connect(M.delay);
  o.start(t);
  o.stop(t + 0.2);
}

function lead(t, midi, dur, style, v = 1) {
  const f = M.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = style === 'soft' ? 2200 : 3400;
  const g = gainEnv(t, (style === 'soft' ? 0.075 : 0.09) * v, 0.012, dur, 0.75, Math.max(0.04, dur - 0.05), 0.09);
  f.connect(g);
  g.connect(M.bus);
  g.connect(M.delay);
  const lfo = M.ctx.createOscillator();
  lfo.frequency.value = 5.6;
  const lg = M.ctx.createGain();
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(dur > 0.25 ? 14 : 0, t + 0.3);
  lfo.connect(lg);
  const types = style === 'hero' ? ['sawtooth', 'square'] : style === 'soft' ? ['triangle', 'square'] : ['square', 'square'];
  types.forEach((type, i) => {
    const o = M.ctx.createOscillator();
    o.type = type;
    o.frequency.value = mtof(midi);
    o.detune.value = i ? 6 : -4;
    lg.connect(o.detune);
    const og = M.ctx.createGain();
    og.gain.value = i ? 0.5 : 1;
    o.connect(og).connect(f);
    o.start(t);
    o.stop(t + dur + 0.15);
  });
  lfo.start(t);
  lfo.stop(t + dur + 0.15);
}

// ───────────────────────── Sıralayıcı ─────────────────────────
function scheduleStep(step, t) {
  const tr = M.track;
  const sd = 60 / tr.bpm / 4;
  const bar = Math.floor(step / STEPS_PER_BAR);
  const s = step % STEPS_PER_BAR;
  const lay = layersFor(tr, bar, M.intensity ?? tr.intensity);
  const deg = chordDegree(tr, bar);
  const notes = chordNotes(tr, deg);

  // Davul
  if (lay.drums) {
    const p = DRUMS[tr.drums][lay.drums];
    const swing = s % 2 === 1 ? sd * 0.08 : 0;
    if (p.k?.includes(s)) kick(t);
    if (p.s?.includes(s)) snare(t, 0.9);
    if (p.c?.includes(s)) clap(t);
    if (p.o?.includes(s)) hat(t + swing, true);
    else if (p.h?.includes(s)) hat(t + swing, false, s % 4 === 0 ? 1 : 0.7);
    if (lay.fill && s >= 12) snare(t, 0.45 + (s - 12) * 0.15);
  }
  if (lay.crash && s === 0) crash(t);

  // Bas
  if (lay.bass) {
    for (const [st, du, off] of BASS[lay.bass]) {
      if (st !== s) continue;
      const m = degreeToMidi(tr, deg + off) - 12;
      bass(t, m, du * sd * 0.95);
    }
  }

  // Akorlar
  if (lay.pad && s === 0) pad(t, notes, sd * STEPS_PER_BAR, lay.L === 0 ? 0.8 : 1);
  if (lay.chords) {
    for (const [st, du] of CHORDS[lay.chords]) if (st === s) stab(t, notes, du * sd, lay.L >= 3 ? 1 : 0.8);
  }

  // Piyano arpeji (hikâye)
  if (lay.piano && s % 2 === 0) {
    const pn = [...notes, notes[0] + 12];
    piano(t, pn[ARP[s] % pn.length] - (s === 0 ? 12 : 0), lay.L === 0 ? 1 : 0.7);
  }
  // Arpej
  if (lay.arp && !lay.piano) {
    const an = [...notes, notes[0] + 12].map((m) => m + 12);
    arp(t, an[ARP[s]], lay.L >= 3 ? 1 : 0.75);
  }
  // Lead (nakarat)
  if (lay.lead) {
    const cb = lay.section.bar % 8;
    for (const n of M.melody) if (n.bar === cb && n.st === s) lead(t, n.midi, n.du * sd * 0.92, tr.lead);
  }
}

function tick() {
  if (!M.ctx || !M.track) return;
  const now = M.ctx.currentTime;
  if (M.next < now - 0.2) M.next = now + 0.05; // uzun duraklama sonrası yetiş
  const sd = 60 / M.track.bpm / 4;
  while (M.next < now + LOOKAHEAD) {
    try { scheduleStep(M.step, M.next); } catch { /* ses hatası oyunu durdurmasın */ }
    M.next += sd;
    M.step++;
    if (M.step % (LOOP_BARS * STEPS_PER_BAR) === 0) onLoop();
  }
}

function onLoop() {
  M.loops++;
  // Kariyer listesi: her iki döngüde bir sonraki parçaya geç
  if (M.list && M.loops >= 2) {
    M.listIdx = (M.listIdx + 1) % M.list.length;
    switchTo(M.list[M.listIdx]);
  }
}

function startTimer() {
  stopTimer();
  M.timer = setInterval(tick, 25);
  tick();
}
function stopTimer() {
  if (M.timer) clearInterval(M.timer);
  M.timer = 0;
}

function level() {
  return M.enabled ? M.vol * 0.42 * (M.duck ? 0.3 : 1) : 0;
}
function applyLevel(time = 0.4) {
  if (!M.ctx) return;
  const t = M.ctx.currentTime;
  M.out.gain.cancelScheduledValues(t);
  M.out.gain.setValueAtTime(M.out.gain.value, t);
  M.out.gain.linearRampToValueAtTime(level(), t + time);
}

function switchTo(id) {
  const tr = TRACKS[id];
  if (!tr || !M.ctx) return;
  const fresh = M.id !== id;
  M.id = id;
  M.track = tr;
  M.melody = composeMelody(tr);
  M.loops = 0;
  if (fresh) {
    M.step = 0;
    M.next = M.ctx.currentTime + 0.12;
    // yumuşak geçiş: kısa kısıp yeni parçayla aç
    const t = M.ctx.currentTime;
    M.out.gain.cancelScheduledValues(t);
    M.out.gain.setValueAtTime(Math.min(M.out.gain.value, level()), t);
    M.out.gain.linearRampToValueAtTime(0.0001, t + 0.1);
    M.out.gain.linearRampToValueAtTime(level(), t + 1.2);
  }
  M.listeners.forEach((fn) => fn(nowPlaying()));
  if (M.enabled) startTimer();
}

function start() {
  const ctx = audioCtx();
  if (!ctx) return;
  setup(ctx);
  if (!M.want || !M.enabled) return;
  const { id, list } = M.want;
  if (list) {
    if (M.list === list && M.track) return;
    M.list = list;
    M.listIdx = Math.max(0, list.indexOf(M.id));
    if (M.listIdx < 0 || !list.includes(M.id)) M.listIdx = Math.floor(Math.random() * list.length);
    switchTo(list[M.listIdx]);
  } else {
    M.list = null;
    if (M.id === id && M.timer) return;
    switchTo(id);
  }
}

onUnlock(() => start());

// ───────────────────────── Dış arayüz ─────────────────────────
/** Ekrana göre parça/liste iste ('title' | 'career' | 'match' | 'story' …). Ses açılmadıysa bekletir. */
export function playMusic(id) {
  const list = PLAYLISTS[id] || null;
  M.want = { id, list };
  if (id !== 'story') M.intensity = null;
  start();
}

/** Hikâye/maç için yoğunluk (0 sakin piyano … 3 tam pop) */
export function setMusicIntensity(n) { M.intensity = n; }

/** Mini oyun / önemli an: müziği kıs */
export function duckMusic(on) {
  M.duck = !!on;
  applyLevel(0.35);
}

export function configureMusic({ music = true, musicVol = 0.5 } = {}) {
  const was = M.enabled;
  M.enabled = music !== false;
  M.vol = Math.max(0, Math.min(1, musicVol ?? 0.5));
  if (!M.ctx) return;
  if (M.enabled && !was) start();
  if (!M.enabled) { applyLevel(0.3); setTimeout(() => { if (!M.enabled) stopTimer(); }, 400); } else applyLevel(0.3);
}

export function stopMusic() {
  M.want = null;
  applyLevel(0.4);
  setTimeout(stopTimer, 450);
  M.id = null;
  M.track = null;
}

export function nowPlaying() {
  return M.track ? { id: M.id, title: M.track.title, mood: M.track.mood } : null;
}
export function onNowPlaying(fn) { M.listeners.add(fn); return () => M.listeners.delete(fn); }
export const MUSIC_TRACKS = TRACKS;
