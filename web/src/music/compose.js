// BESTE — özgün, prosedürel pop parçaları. Saf mantık (WebAudio yok → Node testlerinde çalışır).
// Her parça: tempo, ton, akor dizisi, davul/bas/akor kalıbı ve tohumlu rastgeleyle üretilen nakarat melodisi.
// Melodi kuralı: güçlü vuruşlarda akor notası, aralarda gam içinde küçük adımlar; motif tekrarlanır (akılda kalıcılık).

export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
export const STEPS_PER_BAR = 16;

/** Parçalar (isimler ve melodiler tamamen özgün) */
export const TRACKS = {
  title: { title: 'New Football Stars', mood: 'Ana tema', bpm: 122, root: 50, scale: 'major', prog: [1, 5, 6, 4], drums: 'four', bass: 'pump8', chords: 'stab', lead: 'bright', seed: 7, arp: true, intensity: 3 },
  career: { title: 'Yükseliş', mood: 'Kariyer', bpm: 108, root: 53, scale: 'major', prog: [6, 4, 1, 5], drums: 'pop', bass: 'synco', chords: 'pluck', lead: 'soft', seed: 21, arp: true, intensity: 3 },
  city: { title: 'Mahalle Işıkları', mood: 'Kariyer', bpm: 114, root: 55, scale: 'major', prog: [4, 5, 3, 6], drums: 'pop', bass: 'synco', chords: 'offbeat', lead: 'bright', seed: 33, arp: true, intensity: 3 },
  groove: { title: 'Soyunma Odası', mood: 'Kariyer', bpm: 100, root: 48, scale: 'major', prog: [2, 5, 1, 6], drums: 'pop', bass: 'walk', chords: 'pluck', lead: 'soft', seed: 47, arp: false, intensity: 3 },
  match: { title: '90 Dakika', mood: 'Maç', bpm: 128, root: 52, scale: 'minor', prog: [1, 6, 3, 7], drums: 'four', bass: 'drive16', chords: 'stab', lead: 'hero', seed: 44, arp: true, intensity: 3 },
  story: { title: 'Gizli Seçmeler', mood: 'Hikâye', bpm: 96, root: 57, scale: 'minor', prog: [1, 6, 3, 7], drums: 'pop', bass: 'synco', chords: 'pad', lead: 'hero', seed: 55, arp: true, piano: true, intensity: 0 },
};

/** Kariyer ekranlarında sırayla çalan liste */
export const PLAYLISTS = { career: ['career', 'city', 'groove'] };

/** Bölüm planı (ölçü cinsinden). Döngü 4. ölçüden başlar (giriş bir kez çalar). */
export const SECTIONS = [
  { name: 'intro', bars: 4, cap: 1 },
  { name: 'verse', bars: 8, cap: 2 },
  { name: 'chorus', bars: 8, cap: 3 },
  { name: 'break', bars: 4, cap: 1 },
  { name: 'chorus2', bars: 8, cap: 3 },
];
export const LOOP_BARS = SECTIONS.reduce((a, s) => a + s.bars, 0);
export const LOOP_FROM = SECTIONS[0].bars;

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gam derecesi (0 tabanlı, negatif/büyük olabilir) → MIDI */
export function degreeToMidi(tr, deg) {
  const sc = SCALES[tr.scale] || SCALES.major;
  const o = Math.floor(deg / 7);
  const i = ((deg % 7) + 7) % 7;
  return tr.root + o * 12 + sc[i];
}

/** Ölçünün bölümü ve bölüm içi ölçüsü */
export function sectionAt(bar) {
  let b = bar < LOOP_BARS ? bar : LOOP_FROM + ((bar - LOOP_FROM) % (LOOP_BARS - LOOP_FROM));
  for (const s of SECTIONS) {
    if (b < s.bars) return { ...s, bar: b };
    b -= s.bars;
  }
  return { ...SECTIONS[1], bar: 0 };
}

/** Ölçünün akoru: kök derece (0 tabanlı) */
export function chordDegree(tr, bar) {
  const sec = sectionAt(bar);
  // Ara bölümde akorlar ikişer ölçü sürer (nefes)
  const idx = sec.name === 'break' ? Math.floor(sec.bar / 2) : sec.bar;
  return tr.prog[idx % tr.prog.length] - 1;
}

/** Akor notaları (MIDI), orta oktavda, en yakın çevrim */
export function chordNotes(tr, deg, center = 64) {
  return [deg, deg + 2, deg + 4].map((d) => {
    let m = degreeToMidi(tr, d) + 12;
    while (m < center - 6) m += 12;
    while (m > center + 6) m -= 12;
    return m;
  }).sort((a, b) => a - b);
}

// Nakarat ritim kalıpları (2 ölçü = 32 adım): [başlangıç, süre]
const RHYTHMS = [
  [[0, 2], [2, 2], [4, 4], [10, 2], [12, 2], [14, 2], [16, 2], [18, 2], [20, 6], [28, 4]],
  [[0, 3], [3, 3], [6, 2], [8, 4], [14, 2], [16, 3], [19, 3], [22, 2], [24, 6]],
  [[2, 2], [4, 2], [6, 2], [8, 2], [10, 4], [16, 2], [18, 2], [20, 2], [22, 2], [24, 8]],
  [[0, 4], [4, 2], [6, 2], [8, 6], [16, 4], [20, 2], [22, 2], [24, 8]],
  [[0, 2], [3, 3], [6, 2], [8, 2], [11, 3], [14, 2], [16, 2], [19, 3], [22, 4], [28, 2]],
];

/** 2 ölçülük motif: her nota için akor köküne göre derece farkı (kontur) */
function makeMotif(r, rhythm, ending) {
  let cur = [0, 2, 4][Math.floor(r() * 3)] + 7; // bir oktav yukarıdan başla
  return rhythm.map(([st, du], i) => {
    const strong = st % 8 === 0;
    const last = i === rhythm.length - 1;
    if (last && ending) cur = 7 + (r() < 0.6 ? 0 : 2);
    else if (strong) {
      // akor notalarından en yakını
      const opts = [0, 2, 4, 7, 9, 11].filter((d) => Math.abs(d - cur) <= 4);
      cur = opts.length ? opts[Math.floor(r() * opts.length)] : 7;
    } else {
      const step = [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)];
      cur = Math.max(2, Math.min(12, cur + step));
    }
    return { st, du, off: cur };
  });
}

/**
 * Parçanın nakarat melodisi: 8 ölçü = 4 motif (A A' A B), akor köküne göre konumlanır.
 * @returns {Array<{bar, st, du, midi}>} bar: nakarat içi ölçü (0-7)
 */
export function composeMelody(tr) {
  const r = seeded(tr.seed * 7919 + 13);
  const rhA = RHYTHMS[Math.floor(r() * RHYTHMS.length)];
  const rhB = RHYTHMS[Math.floor(r() * RHYTHMS.length)];
  const A = makeMotif(r, rhA, false);
  const B = makeMotif(r, rhB, true);
  const out = [];
  const place = (motif, bar0) => {
    for (const n of motif) {
      const bar = bar0 + Math.floor(n.st / 16);
      const deg = tr.prog[bar % tr.prog.length] - 1;
      // ton dışına taşmasın diye kök derece + kontur
      let midi = degreeToMidi(tr, deg + n.off);
      const lo = tr.root + 10;
      const hi = tr.root + 29;
      while (midi < lo) midi += 12;
      while (midi > hi) midi -= 12;
      out.push({ bar, st: n.st % 16, du: n.du, midi });
    }
  };
  place(A, 0);
  place(A, 2);
  place(A, 4);
  place(B, 6);
  return out;
}

// Kalıplar (16 adım). Davul: k=kick, s=snare, c=clap, h=kapalı hihat, o=açık hihat
export const DRUMS = {
  four: {
    1: { k: [0, 8], h: [4, 12] },
    2: { k: [0, 4, 8, 12], c: [4, 12], h: [2, 6, 10, 14] },
    3: { k: [0, 4, 8, 12], c: [4, 12], s: [12], h: [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15], o: [2, 6, 10, 14] },
  },
  pop: {
    1: { k: [0], h: [0, 4, 8, 12] },
    2: { k: [0, 7, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
    3: { k: [0, 7, 8, 10], s: [4, 12], c: [12], h: [0, 1, 2, 4, 6, 8, 9, 10, 12, 14, 15], o: [6, 14] },
  },
};

/** Bas: [adım, süre, derece farkı(0 kök, 4 beşli, 7 oktav)] */
export const BASS = {
  long: [[0, 16, 0]],
  pump8: [[0, 2, 0], [2, 2, 0], [4, 2, 7], [6, 2, 0], [8, 2, 0], [10, 2, 0], [12, 2, 7], [14, 2, 4]],
  synco: [[0, 3, 0], [3, 3, 0], [6, 2, 4], [8, 3, 0], [11, 3, 7], [14, 2, 4]],
  drive16: Array.from({ length: 16 }, (_, i) => [i, 1, i % 8 === 6 ? 7 : 0]),
  walk: [[0, 4, 0], [4, 4, 2], [8, 4, 4], [12, 4, 5]],
};

/** Akor vuruşları: [adım, süre] */
export const CHORDS = {
  stab: [[0, 2], [3, 2], [6, 2], [10, 2], [12, 3]],
  pluck: [[0, 1], [3, 1], [6, 1], [10, 1], [12, 2]],
  offbeat: [[2, 1], [6, 1], [10, 1], [14, 1]],
  pad: [[0, 16]],
};

/** Arpej sırası (akor notaları + oktav) */
export const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 1, 3];

/** Bir parçanın belirli bir ölçüsünde hangi katmanlar çalar (yoğunluk 0..3 ve bölüm sınırı) */
export function layersFor(tr, bar, intensity) {
  const sec = sectionAt(bar);
  const L = Math.min(sec.cap, intensity ?? tr.intensity ?? 2);
  const chorus = sec.name.startsWith('chorus');
  return {
    L,
    section: sec,
    piano: !!tr.piano && L <= 2,
    pad: L <= 1 || tr.chords === 'pad',
    drums: L >= 1 ? Math.min(3, L) : 0,
    bass: L >= 1 ? (L === 1 ? 'long' : tr.bass) : null,
    chords: L >= 2 && tr.chords !== 'pad' ? tr.chords : null,
    arp: tr.arp && L >= 2,
    lead: L >= 3 && chorus,
    crash: L >= 3 && sec.bar === 0,
    fill: L >= 2 && sec.bar === sec.bars - 1,
  };
}
