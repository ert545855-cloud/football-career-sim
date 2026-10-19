// KARAKTER — kişilik (profesyonellik, liderlik, hırs, disiplin), zayıf ayak ve beceri yıldızları, oyun tarzı,
// gizli potansiyel ve yeni kulübe/lige/ülkeye uyum. Kararlar ve alışkanlıklar kişiliği zamanla değiştirir;
// kişilik de antrenman verimini, sakatlık riskini, kartları, nüfuzu ve moral tepkilerini etkiler.
import { clamp, chance, rand, round1 } from './rng.js';

export const PERSONA_KEYS = ['professionalism', 'leadership', 'ambition', 'discipline'];
export const PERSONA = {
  professionalism: { name: 'Profesyonellik', short: 'PRO', color: '#38bdf8', desc: 'Antrenman verimi, sakatlık direnci' },
  leadership: { name: 'Liderlik', short: 'LİD', color: '#fbbf24', desc: 'Kulüp nüfuzu, takım arkadaşları' },
  ambition: { name: 'Hırs', short: 'HIR', color: '#fb7185', desc: 'Büyük maç morali, büyük kulüplerin ilgisi' },
  discipline: { name: 'Disiplin', short: 'DİS', color: '#a3e635', desc: 'Kart ve ceza riski, hocanın güveni' },
};

/** Mevkiye göre oyun tarzları: maç anlarında küçük etkin yetenek bonusu + ilgili statlarda gelişim bonusu */
export const PLAYSTYLES = {
  FW: [
    { id: 'finisher', name: 'Bitirici', desc: 'Şut anlarında +%5 · şut gelişimi +%10', skill: { shot: 0.05 }, growth: { shooting: 0.1 } },
    { id: 'speedster', name: 'Hızlı Kanat', desc: 'Atak ve çalımda +%5 · hız gelişimi +%10', skill: { attack: 0.05, dribble: 0.05 }, growth: { speed: 0.1 } },
    { id: 'target', name: 'Hedef Forvet', desc: 'Korner ve kafa toplarında +%8 · pas/dayanıklılık +%5', skill: { corner: 0.08 }, growth: { passing: 0.05, stamina: 0.05 } },
  ],
  MF: [
    { id: 'playmaker', name: 'Oyun Kurucu', desc: 'Pas anlarında +%5 · pas gelişimi +%10', skill: { pass: 0.05 }, growth: { passing: 0.1 } },
    { id: 'boxtobox', name: 'Box-to-box', desc: 'Atak anlarında +%4 · dayanıklılık +%10', skill: { attack: 0.04, tackle: 0.02 }, growth: { stamina: 0.1 } },
    { id: 'anchor', name: 'Ön Libero', desc: 'Müdahalede +%5 · defans gelişimi +%10', skill: { tackle: 0.05 }, growth: { defending: 0.1 } },
  ],
  DF: [
    { id: 'rock', name: 'Stoper Kaya', desc: 'Müdahalede +%6 · defans gelişimi +%10', skill: { tackle: 0.06 }, growth: { defending: 0.1 } },
    { id: 'wingback', name: 'Bindiren Bek', desc: 'Atak ve pasta +%4 · hız/dayanıklılık +%6', skill: { attack: 0.04, pass: 0.04 }, growth: { speed: 0.06, stamina: 0.06 } },
    { id: 'libero', name: 'Libero', desc: 'Pas anlarında +%5 · pas gelişimi +%10', skill: { pass: 0.05 }, growth: { passing: 0.1 } },
  ],
};
export const styleById = (pos, id) => (PLAYSTYLES[pos] || []).find((s) => s.id === id) || null;

/** Uzmanlıklar (gelişim ağacı): mevkiye özel ve ortak yetenekler; her biri 1 uzmanlık puanı */
export const PERKS = {
  fk: { name: 'Frikik Ustası', desc: 'Serbest vuruşlarda +%8', skill: { freekick: 0.08 }, pos: ['FW', 'MF'] },
  header: { name: 'Hava Hakimi', desc: 'Korner ve kafa toplarında +%8', skill: { corner: 0.08 }, pos: ['FW', 'DF'] },
  poacher: { name: 'Fırsatçı', desc: 'Ceza sahası şutlarında +%6', skill: { box: 0.06 }, pos: ['FW'] },
  longshot: { name: 'Uzaktan Füze', desc: 'Ceza sahası dışı şutlarda +%8', skill: { edge: 0.08 }, pos: ['FW', 'MF'] },
  vision: { name: 'Vizyon', desc: 'Son pas (asist) anlarında +%6', skill: { final: 0.06 }, pos: ['MF', 'FW'] },
  press: { name: 'Pres Makinesi', desc: 'Müdahalede +%5', skill: { tackle: 0.05 }, pos: ['MF', 'DF'] },
  slide: { name: 'Kayarak Müdahale', desc: 'Tehlikeli ataklarda müdahale +%6', skill: { threat: 0.06 }, pos: ['DF'] },
  outlet: { name: 'Çıkış Pası', desc: 'Oyun kurma paslarında +%6', skill: { buildup: 0.06 }, pos: ['DF', 'MF'] },
  cool: { name: 'Soğukkanlı', desc: 'Penaltıda +%8', skill: { penalty: 0.08 }, pos: ['FW', 'MF', 'DF'] },
  engine: { name: 'Motor', desc: 'Maç içi yorgunluk −%15', pos: ['FW', 'MF', 'DF'] },
  iron: { name: 'Demir Adam', desc: 'Sakatlık riski −%15', pos: ['FW', 'MF', 'DF'] },
  captain: { name: 'Kaptan Ruhu', desc: 'Kulüp nüfuzu kazanımı +%15', pos: ['FW', 'MF', 'DF'] },
};
export const hasPerk = (player, id) => !!player?.perks?.includes(id);
/** Uzmanlık puanı: başlangıçtan bu yana her 4 OVR artışı + her 2 ödül */
export function perkPoints(state, ovrNow) {
  const p = state.player;
  if (p.ovr0 == null) p.ovr0 = (state.calendar?.season || 1) > 1 ? Math.min(ovrNow, 42) : ovrNow;
  const base = p.ovr0;
  const earned = Math.floor(Math.max(0, ovrNow - base) / 4) + Math.floor((state.career?.awards?.length || 0) / 2);
  return Math.max(0, earned - (p.perks?.length || 0));
}
export function unlockPerk(state, id, ovrNow) {
  const p = ensureCharacter(state);
  const pk = PERKS[id];
  if (!pk || !pk.pos.includes(p.position)) return { ok: false, text: 'Bu uzmanlık mevkine uygun değil.' };
  if (hasPerk(p, id)) return { ok: false, text: 'Zaten açık.' };
  if (perkPoints(state, ovrNow) <= 0) return { ok: false, text: 'Uzmanlık puanın yok. Gelişmeye ve ödül kazanmaya devam et!' };
  p.perks.push(id);
  return { ok: true, text: `${pk.name} açıldı!` };
}

const r0 = (a, b) => Math.round(rand(a, b));

/** Eski kayıtlar ve yeni oyun için karakter alanlarını hazırlar (kulüp değişimini de algılar). */
export function ensureCharacter(state) {
  const p = state.player;
  if (!p) return null;
  if (!p.persona) {
    p.persona = {
      professionalism: r0(44, 60),
      leadership: r0(28, 42),
      ambition: r0(50, 66),
      discipline: r0(48, 62),
    };
  }
  if (p.weakFoot == null) p.weakFoot = 2;
  if (p.skillMoves == null) p.skillMoves = p.position === 'FW' ? 3 : 2;
  p.drill ||= { weakFoot: 0, skillMoves: 0 };
  p.perks ||= [];
  if (!p.potential) {
    const q = clamp((state.career?.tryout?.score ?? 18) / 30, 0, 1);
    p.potential = clamp(Math.round(70 + q * 17 + rand(-3, 4)), 66, 94);
  }
  // Uyum: kulüp değiştiyse yeniden başlar (yurt dışında daha yavaş)
  const clubId = state.career?.clubId;
  if (clubId && (!state.adapt || state.adapt.clubId !== clubId)) {
    const first = !state.adapt;
    state.adapt = { clubId, pct: first ? 72 : 35, abroad: false, s: state.calendar?.season || 1, w: state.calendar?.week || 1 };
  }
  return p;
}

export const setAbroad = (state, abroad) => {
  ensureCharacter(state);
  state.adapt.abroad = !!abroad;
  if (abroad) state.adapt.pct = Math.min(state.adapt.pct, 25);
};

export function changePersona(state, key, delta) {
  const p = ensureCharacter(state);
  if (!p || !(key in p.persona)) return;
  const v = p.persona[key];
  // uçlara yaklaştıkça değişim yavaşlar (kişilik kolay kolay 100'e ya da 0'a gitmez)
  const k = delta > 0 ? clamp((100 - v) / 55, 0.05, 1) : clamp(v / 55, 0.05, 1);
  p.persona[key] = clamp(round1(v + delta * k), 0, 100);
}

// ─────────────────────────── Etkiler ───────────────────────────
/** Antrenman gelişim çarpanı (profesyonellik) */
export const trainingPersonaMult = (state) => 0.92 + ((state.player?.persona?.professionalism ?? 50) / 100) * 0.18;
/** Sakatlık riski çarpanı (profesyonel oyuncu vücuduna iyi bakar) */
export const injuryPersonaMult = (state) => (1.15 - ((state.player?.persona?.professionalism ?? 50) / 100) * 0.3) * (hasPerk(state.player, 'iron') ? 0.85 : 1);
/** Nüfuz kazanımı çarpanı (liderlik) */
export const influencePersonaMult = (state) => 0.85 + ((state.player?.persona?.leadership ?? 40) / 100) * 0.4;
/** Faulde karttan kurtulma şansı (disiplin) */
export const cardEscapeChance = (discipline = 50) => clamp((discipline - 40) / 200, 0, 0.3);

/** Potansiyele göre gelişim çarpanı: tavana yaklaştıkça yavaşlar, aşınca daha da yavaşlar */
export function potentialMult(player, ovrNow) {
  if (!player?.potential) return 1;
  return clamp(1 + (player.potential - ovrNow - 6) / 40, 0.55, 1.15);
}

/** Oyun tarzının stat gelişim bonusu */
export function styleGrowth(player, stat) {
  const st = styleById(player?.position, player?.style);
  return 1 + (st?.growth?.[stat] || 0);
}

/**
 * Maç anı etkin yetenek çarpanı: oyun tarzı + zayıf ayak + beceri + uyum.
 * type: shot | pass | tackle | attack | dribble · context: corner, penalty …
 */
export function characterSkillMult(state, type, context) {
  const p = ensureCharacter(state);
  if (!p) return 1;
  let m = 1;
  const st = styleById(p.position, p.style);
  if (st) m += (st.skill[type] || 0) + (st.skill[context] || 0);
  for (const id of p.perks || []) { const sk = PERKS[id]?.skill; if (sk) m += (sk[type] || 0) + (sk[context] || 0); }
  if (type === 'shot' && context !== 'penalty') m += (p.weakFoot - 3) * 0.02;
  if (type === 'pass') m += (p.weakFoot - 3) * 0.012;
  if (type === 'attack' || type === 'dribble') m += (p.skillMoves - 3) * 0.025;
  const ad = state.adapt?.pct ?? 100;
  m *= 0.92 + 0.08 * (ad / 100);
  return clamp(m, 0.8, 1.25);
}

// ─────────────────────────── Özel çalışma (zayıf ayak / beceri) ───────────────────────────
export const DRILLS = {
  weakFoot: { name: 'Zayıf ayak', icon: 'boot', desc: 'Zayıf ayakla şut ve pas tekrarları', energy: 10 },
  skillMoves: { name: 'Beceri hareketleri', icon: 'bolt', desc: 'Çalım, top sürme ve ayak oyunları', energy: 12 },
};
/** Bir sonraki yıldız için gereken çalışma (yıldız arttıkça zorlaşır) */
export const drillNeed = (stars) => 0.9 + stars * 0.45;

export function doDrill(state, kind) {
  const p = ensureCharacter(state);
  const d = DRILLS[kind];
  if (!d) return { ok: false, text: 'Bilinmeyen çalışma.' };
  const key = kind;
  if (p[key] >= 5) return { ok: false, text: `${d.name} zaten 5 yıldız!` };
  // profesyonellik ve kişisel antrenör hızı artırır
  const trainer = (state.career?.items || []).includes('coach') ? 0.25 : 0;
  const gain = (0.32 + rand(0, 0.12)) * trainingPersonaMult(state) * (1 + trainer) * (p.age <= 23 ? 1.15 : p.age >= 30 ? 0.8 : 1);
  p.drill[key] += gain;
  let up = false;
  if (p.drill[key] >= drillNeed(p[key])) {
    p.drill[key] = 0;
    p[key] = Math.min(5, p[key] + 1);
    up = true;
  }
  changePersona(state, 'professionalism', 0.4);
  return { ok: true, up, stars: p[key], prog: p.drill[key] / drillNeed(p[key]), energy: d.energy, name: d.name };
}

// ─────────────────────────── Haftalık değişim ───────────────────────────
/**
 * Haftanın alışkanlıkları kişiliği şekillendirir.
 * ctx: {trainings, played, rating, yellow, red, outings, captain}
 */
export function characterOnWeek(state, ctx = {}) {
  const p = ensureCharacter(state);
  if (!p) return [];
  const notes = [];
  const t = ctx.trainings ?? 0;
  changePersona(state, 'professionalism', t >= 3 ? 0.3 : t >= 2 ? 0.15 : t === 0 ? -0.6 : -0.1);
  if ((ctx.outings || 0) > 0 && ctx.nightlife) changePersona(state, 'professionalism', -0.6);
  if (ctx.yellow) changePersona(state, 'discipline', -1.6 * ctx.yellow);
  else changePersona(state, 'discipline', 0.08);
  if ((p.influence ?? 0) >= 55) changePersona(state, 'leadership', 0.35);
  if (ctx.played && ctx.rating >= 7.5) changePersona(state, 'ambition', 0.2);
  else if (ctx.played && ctx.rating < 6) changePersona(state, 'ambition', -0.15);
  if (!ctx.played) changePersona(state, 'ambition', 0.1);
  // uyum
  const a = state.adapt;
  if (a && a.pct < 100) {
    const before = a.pct;
    const rel = (p.rel?.teammates ?? 50) - 50;
    const inc = (a.abroad ? 4.5 : 6.5) + rel / 18 + (ctx.played ? 2 : 0) + (p.persona.leadership - 40) / 40;
    a.pct = clamp(Math.round(a.pct + Math.max(1.5, inc)), 0, 100);
    if (before < 100 && a.pct >= 100) notes.push('Yeni kulübüne tamamen uyum sağladın: takım arkadaşlarınla aranız su sızmıyor.');
    else if (before < 60 && a.pct >= 60) notes.push('Yeni ortamına alışıyorsun: oyun sistemini ve takım arkadaşlarını artık daha iyi tanıyorsun.');
  }
  return notes;
}

/** Hırsın moral tepkisi (kenarda kalmaya tahammül, büyük maçlarda coşku) */
export function ambitionMorale(state, { played, big, result }) {
  const amb = state.player?.persona?.ambition ?? 50;
  let d = 0;
  if (!played && amb >= 65) d -= 2;
  if (played && big && result === 'W' && amb >= 60) d += 2;
  return d;
}

/** Potansiyel aralığı (izci tahmini; genç oyuncuda belirsizlik daha fazla) */
export function potentialRange(player) {
  const pot = player.potential || 75;
  const u = player.age <= 19 ? 4 : player.age <= 22 ? 3 : player.age <= 26 ? 2 : 1;
  return [clamp(pot - u, 40, 99), clamp(pot + u, 40, 99)];
}

/** Sezon sonu: üst üste iyi sezon potansiyeli bir tık artırabilir ("beklentileri aştı") */
export function potentialSeasonEnd(state, { avg, apps }) {
  const p = ensureCharacter(state);
  if (!p) return null;
  if (apps >= 15 && avg >= 7.4 && p.age <= 24 && chance(0.6)) {
    p.potential = Math.min(96, p.potential + 1 + (avg >= 7.8 ? 1 : 0));
    return 'İzciler potansiyelini yeniden değerlendirdi: beklentileri aşıyorsun!';
  }
  return null;
}

/** Kişilik özeti için tek kelimelik etiket */
export function personaLabel(persona) {
  if (!persona) return '';
  const best = PERSONA_KEYS.slice().sort((a, b) => persona[b] - persona[a])[0];
  return { professionalism: 'Çalışkan', leadership: 'Doğal lider', ambition: 'Hırslı', discipline: 'Disiplinli' }[best];
}
