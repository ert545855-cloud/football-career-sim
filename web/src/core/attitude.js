// KARAKTER BARI — Mütevazı (−100) … Dengeli … Egoist (+100).
//   Basın toplantısı cevapların, TV röportajları, Chirp paylaşımların, gol sevincin, sosyal sohbetlerin ve
//   maç içi gerginliklerdeki tepkilerin barı azar azar oynatır. Uçlara yaklaştıkça kayma yavaşlar,
//   bir haftada toplam kayma sınırlıdır: bar bir anda bir uca gitmez.
//   Etkiler: Egoist rakip tribünü ve takımı kışkırtır (daha çok gerginlik, hakem daha sert, deplasmanda ıslık,
//   sponsor/ün artar ama takım arkadaşları soğur). Mütevazı saygılıdır (hakem hoşgörülü, hoca ve takım sever).
//   Dengeli ikisini de hafif dozda yapabilir.
import { clamp, round1, seeded } from './rng.js';
import { changeFame, changeMorale, changeRel } from './player.js';
import { ensureDisc, sendOff } from './discipline.js';

export const ATT_RULES = { humbleAt: -34, egoAt: 34, weekLimit: 9, logMax: 14 };

/** Kaynaklar ve temel kayma miktarları (+ egoist yönü) */
export const ATT_SOURCES = {
  press_humble: { d: -3, label: 'Basın: mütevazı cevap' },
  press_confident: { d: 2, label: 'Basın: özgüvenli cevap' },
  press_provoke: { d: 5, label: 'Basın: kışkırtıcı cevap' },
  tv_humble: { d: -3, label: 'TV röportajı: mütevazı' },
  tv_boast: { d: 3, label: 'TV röportajı: kendini övdün' },
  tv_jab: { d: 5, label: 'TV röportajı: rakibe laf' },
  post_modest: { d: -2.5, label: 'Chirp: mütevazı paylaşım' },
  post_ego: { d: 4, label: 'Chirp: egoist paylaşım' },
  post_aggressive: { d: 4.5, label: 'Chirp: agresif paylaşım' },
  cel_shush: { d: 3, label: 'Sevinç: sus işareti' },
  cel_flip: { d: 1.2, label: 'Sevinç: şov takla' },
  cel_dance: { d: 0.6, label: 'Sevinç: dans' },
  cel_plane: { d: 0.4, label: 'Sevinç: uçak' },
  cel_heart: { d: -2, label: 'Sevinç: taraftara kalp' },
  cel_slide: { d: 0.2, label: 'Sevinç: diz kayması' },
  cel_corner: { d: -0.3, label: 'Sevinç: köşe bayrağı' },
  social_cocky: { d: 0.8, label: 'Sohbet: kibirli' },
  social_humble: { d: -0.8, label: 'Sohbet: alçakgönüllü' },
  t_provoke: { d: 4, label: 'Maç: rakibi kışkırttın' },
  t_jab: { d: 2, label: 'Maç: laf soktun' },
  t_ignore: { d: -0.4, label: 'Maç: oyuna döndün' },
  t_calm: { d: -2, label: 'Maç: ortamı yatıştırdın' },
  t_peace: { d: -3.5, label: 'Maç: centilmence el uzattın' },
  t_ref: { d: -1, label: 'Maç: hakeme gösterdin' },
};

export const ATT_KINDS = {
  humble: { label: 'Mütevazı', color: '#38bdf8', desc: 'Saygılı ve takım oyuncusu: hakem hoşgörülü, hoca ve takım arkadaşları seni sever.' },
  balanced: { label: 'Dengeli', color: '#cbd5e1', desc: 'Gerektiğinde laf da sokarsın, el de uzatırsın; hepsi hafif dozda.' },
  ego: { label: 'Egoist', color: '#fb923c', desc: 'Yıldız havası: rakip tribünü ve takımı kışkırtırsın, gerginlik ve kart riski artar; ün ve sponsor ilgisi de.' },
};

export function ensureAttitude(state) {
  const p = state.player;
  if (!p) return null;
  if (p.attitude == null) p.attitude = 0;
  p.attLog ||= [];
  return p;
}
export const attitudeOf = (state) => state.player?.attitude ?? 0;
export const attitudeKind = (v) => (v <= ATT_RULES.humbleAt ? 'humble' : v >= ATT_RULES.egoAt ? 'ego' : 'balanced');
export function attitudeLabel(v) {
  if (v <= -75) return 'Çok mütevazı';
  if (v >= 75) return 'Kibirli';
  return ATT_KINDS[attitudeKind(v)].label;
}

const weekKey = (state) => `${state.calendar?.season || 1}-${state.calendar?.week || 0}`;

/**
 * Barı kaydırır. src: ATT_SOURCES anahtarı ya da {d, label}. mult: kaynağın gücü.
 * @returns {number} gerçekleşen kayma
 */
export function shiftAttitude(state, src, mult = 1) {
  const def = typeof src === 'string' ? ATT_SOURCES[src] : src;
  if (!def || !def.d) return 0;
  const p = ensureAttitude(state);
  if (!p) return 0;
  const v = p.attitude;
  let d = def.d * mult;
  // aynı yöne gidiyorsa uçlara yaklaştıkça yavaşlar; merkeze dönüş tam hızda
  if (v === 0 || Math.sign(d) === Math.sign(v)) d *= Math.max(0.05, clamp(1 - Math.abs(v) / 108, 0, 1) ** 1.4);
  // bir haftadaki net kayma sınırı
  const wk = weekKey(state);
  if (!p.attWeek || p.attWeek.k !== wk) p.attWeek = { k: wk, sum: 0 };
  const L = ATT_RULES.weekLimit;
  if (d > 0) d = Math.min(d, Math.max(0, L - p.attWeek.sum));
  else d = Math.max(d, Math.min(0, -L - p.attWeek.sum));
  d = round1(d);
  if (!d) return 0;
  p.attWeek.sum = round1(p.attWeek.sum + d);
  p.attitude = clamp(round1(v + d), -100, 100);
  p.attLog.unshift({ s: state.calendar?.season || 1, w: state.calendar?.week || 0, label: def.label || '', d });
  if (p.attLog.length > ATT_RULES.logMax) p.attLog.length = ATT_RULES.logMax;
  return d;
}

/** Maç öncesi etkiler: rakip husumeti, gerginlik sıklığı, heyecan */
export function attitudeMatchFx(state, { isHome = true, big = null } = {}) {
  const v = attitudeOf(state);
  const e = Math.max(0, v) / 100;
  const h = Math.max(0, -v) / 100;
  const hostility = clamp(0.2 + e * 0.6 - h * 0.25 + (isHome ? -0.05 : 0.1) + (big ? 0.12 : 0), 0.05, 0.95);
  return { v, kind: attitudeKind(v), e, h, hostility, nerves: !isHome ? e * 0.06 : 0 };
}

/** Haftalık etkiler (küçük): egoist ün/sponsor kazanır ama takım soğur; mütevazı hoca ve takımla iyi geçinir */
export function attitudeOnWeek(state) {
  const p = ensureAttitude(state);
  if (!p) return;
  const v = p.attitude;
  if (v >= ATT_RULES.egoAt) {
    const e = v / 100;
    changeRel(p, 'teammates', -0.7 * e);
    changeRel(p, 'sponsor', 0.6 * e);
    changeFame(p, 0.08 * e);
  } else if (v <= ATT_RULES.humbleAt) {
    const h = -v / 100;
    changeRel(p, 'teammates', 0.5 * h);
    changeRel(p, 'manager', 0.4 * h);
    changeRel(p, 'fans', 0.2 * h);
  }
}

/** Chirp takipçi çarpanı: egoist daha çok konuşulur */
export const attitudeFollowerMult = (state) => 1 + attitudeOf(state) / 100 * 0.15;

// ─────────────────────────── Maç içi gerginlik ───────────────────────────
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const TENSION_KINDS = {
  shove: { title: 'Rakip seni itti!', text: (o) => `${o} topsuz alanda seni sertçe itti. Bugünkü performansını hazmedemiyor.` },
  trash: { title: 'Laf atıyor', text: (o) => `${o} kulağına laf atıyor: "Çok konuşuyorsun, maç daha bitmedi!"` },
  fight: { title: 'Arbede!', text: (o) => `${o} son pozisyondan sonra üstüne yürüdü! Oyuncular araya giriyor.` },
  crowd: { title: 'Rakip tribün', text: () => 'Rakip tribün seni ıslıklıyor, isminle tezahürat yapıyor. Kenara bir çakmak düştü.' },
  grudge: { title: 'Yediremedi', text: (o) => `Golünü yediremeyen ${o} topun olmadığı yerde ayağına bastı ve yüzüne bağırıyor.` },
};

/** Seçenekler karakter barına göre değişir */
export function tensionOptions(kind, attKind) {
  const fight = kind === 'fight' || kind === 'grudge';
  const crowd = kind === 'crowd';
  if (attKind === 'ego') {
    return [
      { id: 'provoke', label: crowd ? 'Tribüne sus işareti yap' : fight ? 'Sen de üstüne yürü' : 'Kafa kafaya gel', hint: 'Adrenalin · kart riski yüksek' },
      { id: 'jab', label: crowd ? 'Skor tabelasını göster' : 'Gülüp laf sok', hint: 'Biraz gaz · kart riski' },
      { id: 'ignore', label: 'Boş ver, oyuna dön', hint: 'Risk yok' },
    ];
  }
  if (attKind === 'humble') {
    return [
      { id: 'peace', label: crowd ? 'Tribünü alkışla' : 'Elini uzat, sakinleştir', hint: 'Centilmenlik · odak' },
      { id: 'ref', label: crowd ? 'Hakeme durumu bildir' : 'Hakeme göster', hint: 'Rakibe kart çıkabilir' },
      { id: 'ignore', label: 'Boş ver, oyuna dön', hint: 'Risk yok' },
    ];
  }
  return [
    { id: 'jab', label: crowd ? 'Göz kırp, gülümse' : 'Kısa bir laf sok', hint: 'Hafif gaz · küçük kart riski' },
    { id: 'calm', label: crowd ? 'Elini kaldırıp selamla' : 'Sakin ol, ayır', hint: 'Hafif odak' },
    { id: 'ignore', label: 'Boş ver, oyuna dön', hint: 'Risk yok' },
  ];
}

/**
 * Maç öncesi gerginlik planı (kendi tohumuyla). Sahada olduğun dakikalara yerleşir.
 * @returns {Array<{minute:number, kind:string, opp:string|null, done:boolean}>}
 */
export function planTension(state, { role, subMinute, subOff, isHome, big, oppNames = [], id = '' }) {
  if (role !== 'starter' && !subMinute) return [];
  const R = seeded(hash(`${state.player?.name}|${id}|${state.calendar?.week}|tension`));
  const fx = attitudeMatchFx(state, { isHome, big });
  const from = role === 'starter' ? 18 : subMinute + 4;
  const to = (subOff || 90) - 3;
  if (to - from < 6) return [];
  const out = [];
  let p = 0.16 + fx.hostility * 0.42;
  for (let i = 0; i < 2 && R() < p; i++) {
    const minute = Math.round(from + R() * (to - from));
    if (out.some((t) => Math.abs(t.minute - minute) < 12)) break;
    const kinds = [['shove', 1], ['trash', 1.1], ['fight', 0.35 + fx.e * 0.5], ['crowd', isHome ? 0.15 : 0.6 + fx.e * 0.6]];
    let r = R() * kinds.reduce((a, [, w]) => a + w, 0);
    let kind = 'trash';
    for (const [k, w] of kinds) { r -= w; if (r <= 0) { kind = k; break; } }
    const opp = oppNames.length ? oppNames[Math.floor(R() * oppNames.length)] : null;
    out.push({ minute, kind, opp, done: false });
    p *= 0.45;
  }
  return out.sort((a, b) => a.minute - b.minute);
}

/** Golünden sonra rakibin "yediremeyip" gerginlik çıkarma ihtimali */
export function grudgeChance(state, match) {
  const fx = attitudeMatchFx(state, { isHome: match.isHome, big: match.big });
  return clamp(0.12 + fx.e * 0.3 + (match.hostile || 0) * 0.25, 0, 0.6);
}

/** Sonuç tablosu: [kartım (sarı p, kırmızı p), rakibe kart p, odak, momentum] */
const OUT = {
  provoke: { y: 0.3, r: 0.06, oy: 0.25, focus: 0.03, mom: 9, hostile: 0.25 },
  jab: { y: 0.12, r: 0, oy: 0.12, focus: 0.015, mom: 4, hostile: 0.12 },
  ignore: { y: 0, r: 0, oy: 0.15, focus: 0, mom: -2, hostile: 0 },
  calm: { y: 0, r: 0, oy: 0.2, focus: 0.01, mom: 1, hostile: -0.08 },
  peace: { y: 0, r: 0, oy: 0.18, focus: 0.02, mom: 2, hostile: -0.15 },
  ref: { y: 0.04, r: 0, oy: 0.5, focus: 0.005, mom: 0, hostile: 0.05 },
};

/**
 * Gerginlikte seçimini uygular (maç nesnesi üzerinde; ilişki etkileri maç sonunda işlenir).
 * @returns {{lines:Array<{minute,text,kind}>, card:string|null, oppCard:boolean}}
 */
export function resolveTension(state, match, t, choice, roll = Math.random) {
  t.done = true;
  t.choice = choice;
  const o = OUT[choice] || OUT.ignore;
  const fight = t.kind === 'fight' || t.kind === 'grudge';
  const crowd = t.kind === 'crowd';
  const disc = (match.discipline ?? 50) / 100;
  const nm = state.player.name.split(' ')[0];
  const opp = t.opp || 'Rakip oyuncu';
  const lines = [];
  // kart riski: kavgada artar, disiplin azaltır; tribüne yapılan hareketlerde daha düşük
  const yP = clamp(o.y * (fight ? 1.5 : crowd ? 0.7 : 1) * (1.25 - disc * 0.5), 0, 0.7);
  const rP = clamp(o.r * (fight ? 1.6 : crowd ? 0.3 : 1) * (1.25 - disc * 0.5), 0, 0.25);
  let card = null;
  const r1 = roll();
  if (r1 < rP) card = 'red';
  else if (r1 < rP + yP) card = 'yellow';
  const oppCard = !crowd && roll() < o.oy * (fight ? 1.4 : 1);
  const tf = (match.tensionFx ||= { focus: 0, fans: 0, federation: 0, teammates: 0, manager: 0, fame: 0, sources: [] });
  tf.sources.push(`t_${choice}`);
  match.hostile = clamp((match.hostile || 0) + o.hostile, 0, 1);
  const TXT = {
    provoke: crowd ? `${nm} rakip tribüne dönüp sus işareti yaptı! Tribün çıldırdı.` : fight ? `${nm} geri adım atmadı, ${opp} ile burun buruna geldi!` : `${nm} ${opp} ile kafa kafaya geldi, gerginlik tırmanıyor!`,
    jab: crowd ? `${nm} skor tabelasını işaret etti, rakip tribün iyice kızdı.` : `${nm} gülümseyerek ${opp}'a laf soktu.`,
    ignore: crowd ? `${nm} ıslıkları duymazdan geldi.` : `${nm} tahrike kapılmadı, oyuna döndü.`,
    calm: crowd ? `${nm} elini kaldırıp tribünleri selamladı.` : `${nm} araya girip ortamı yatıştırdı.`,
    peace: crowd ? `${nm} rakip tribünü alkışladı. Centilmence bir hareket!` : `${nm} ${opp}'a elini uzattı; hakem başparmağını kaldırdı.`,
    ref: crowd ? `${nm} durumu hakeme bildirdi, anons yapıldı.` : `${nm} olayı hakeme gösterdi.`,
  };
  lines.push({ minute: t.minute, text: TXT[choice] || TXT.ignore, kind: choice === 'provoke' || choice === 'jab' ? 'tension' : 'fairplay' });
  if (oppCard) lines.push({ minute: t.minute, text: `Hakem ${opp}'a sarı kart gösterdi.`, kind: 'card-opp' });
  if (card) {
    const d = ensureDisc(match);
    const tl = match.tally;
    if (card === 'yellow' && d.yellow) card = 'second';
    if (card === 'yellow') { d.yellow += 1; tl.yellow = (tl.yellow || 0) + 1; tl.rating -= 0.4; lines.push({ minute: t.minute, text: `Sarı kart! ${nm} gerginlik yüzünden kartı gördü.`, kind: 'card' }); }
    else {
      d.yellow += card === 'second' ? 1 : 0;
      d.red = card === 'second' ? 'second' : 'red';
      tl.red = d.red;
      tl.rating -= 1.2;
      if (card === 'second') tl.yellow = (tl.yellow || 0) + 1;
      lines.push({ minute: t.minute, text: card === 'second' ? `İkinci sarıdan KIRMIZI! ${nm} kavga yüzünden oyundan atıldı.` : `KIRMIZI KART! ${nm} arbede yüzünden doğrudan atıldı.`, kind: 'red' });
      sendOff(match, t.minute);
    }
  }
  // odak: egoist adrenalinle güçlenir; kart görürsen dağılır
  const kindNow = attitudeKind(attitudeOf(state));
  let focus = o.focus;
  if (choice === 'provoke' && kindNow !== 'ego') focus = -0.01;
  if (card) focus = -0.03;
  match.focus = clamp((match.focus || 0) + focus, -0.06, 0.06);
  // maç sonu ilişki etkileri
  if (choice === 'provoke') { tf.fans += match.isHome ? 2 : 0.5; tf.federation -= 1.5; tf.fame += 0.3; tf.manager -= 0.5; }
  if (choice === 'jab') { tf.fans += match.isHome ? 1 : 0; tf.federation -= 0.5; tf.fame += 0.1; }
  if (choice === 'peace') { tf.fans += 1; tf.manager += 1; tf.federation += 1; tf.teammates += 0.5; }
  if (choice === 'calm') { tf.manager += 0.5; tf.teammates += 0.5; }
  if (choice === 'ref') { tf.federation += 0.5; tf.teammates -= 0.3; }
  if (card) tf.manager -= card === 'yellow' ? 1.5 : 0;
  return { lines, card, oppCard };
}

/** Gerginlik ve sevinç seçimlerinin kalıcı etkileri (maç sonunda) */
export function attitudeOnMatch(state, match) {
  const p = ensureAttitude(state);
  if (!p) return { shift: 0 };
  let shift = 0;
  const tf = match.tensionFx;
  if (tf) {
    if (tf.fans) changeRel(p, 'fans', tf.fans);
    if (tf.federation) changeRel(p, 'federation', tf.federation);
    if (tf.teammates) changeRel(p, 'teammates', tf.teammates);
    if (tf.manager) changeRel(p, 'manager', tf.manager);
    if (tf.fame) changeFame(p, tf.fame);
    for (const src of tf.sources) shift += shiftAttitude(state, src);
  }
  for (const st of match.celebs || []) shift += shiftAttitude(state, `cel_${st}`);
  // kışkırttığın maçı kaybetmek moral bozar
  if (tf?.sources.includes('t_provoke') && match.score.my < match.score.opp) changeMorale(p, -2);
  return { shift: round1(shift) };
}

/** Odaklanma çarpanı (maç anlarında etkin yetenek) */
export const tensionSkillMult = (match) => 1 + (match?.focus || 0);
