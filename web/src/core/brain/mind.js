// @ts-check
// ZİHİN — stres, özgüven, odak ve uyku; bir de ihtiyaçlar (dinlenme, sosyallik, başarı, tanınma, güvence).
// Hepsi haftanın yaşanmışlığından türetilir: yük, sonuçlar, kenarda kalmak, para, sakatlık, gece hayatı,
// sevgili, takım yemekleri... İhtiyaç uzun süre karşılanmazsa moral erir ve iç ses onu dile getirir.
// Sahaya etkisi: özgüven ve odak yeteneği yukarı, stres ve uykusuzluk aşağı çeker; baskı anlarında (penaltı,
// büyük maç) stresin etkisi ikiye katlanır.
import { clamp, round1 } from '../rng.js';

export const NEED_KEYS = ['rest', 'social', 'achieve', 'recog', 'security'];
export const NEEDS = {
  rest: { name: 'Dinlenme', icon: '😴', hint: 'Dinlen, uyu, yükü azalt' },
  social: { name: 'Sosyallik', icon: '🫂', hint: 'Takımla yemek, arkadaşlar, sevgili' },
  achieve: { name: 'Başarı', icon: '🏆', hint: 'İyi maç, iyi antrenman, rekor' },
  recog: { name: 'Tanınma', icon: '📣', hint: 'Taraftar, medya, ödül' },
  security: { name: 'Güvence', icon: '🛡️', hint: 'Birikim, sözleşme' },
};

export function createMind() {
  return { stress: 24, conf: 55, focus: 62, sleep: 7.8 };
}
export function createNeeds() {
  return { rest: 20, social: 25, achieve: 30, recog: 20, security: 15 };
}

/**
 * Haftalık zihin güncellemesi.
 * @param {{stress:number, conf:number, focus:number, sleep:number}} m
 * @param {Record<string, number>} needs
 * @param {any} w haftanın defteri
 * @param {any} c bağlam: { energy, rating, played, result, goals, motm, red, bench, money, weekCost, injured, managerRel, partner,
 *   professionalism, homeSleep, load, ego, fameGain, awards, contractEnding, traitSleep, traitFocus, memoryAffect, big }
 */
export function mindOnWeek(m, needs, w, c) {
  const party = (w.party || 0) + (w.outBar || 0) * 0.55 + (w.outHome || 0) * 0.6;
  // ── uyku ──
  let sleepT = 7.9 + (c.homeSleep || 0) + (w.rest || 0) * 0.25 - (w.party || 0) * 0.9 - (w.outBar || 0) * 0.5 - (w.outHome || 0) * 0.55
    - Math.max(0, m.stress - 60) * 0.02 + (c.partner ? 0.1 : 0) + (c.traitSleep || 0) - (c.injured ? 0.2 : 0);
  sleepT = clamp(sleepT, 4.5, 9);
  m.sleep = round1(m.sleep * 0.45 + sleepT * 0.55);

  // ── stres ──
  const lossy = c.result === 'L' ? 6 : c.result === 'W' ? -4 : 0;
  const unmet = Object.values(needs).reduce((n, v) => n + Math.max(0, v - 60), 0);
  const stressT = clamp(22 + Math.max(0, (c.load || 0) - 4.4) * 6 + lossy + (c.bench ? 8 : 0) + (c.money < 0 ? 12 : c.money < (c.weekCost || 0) * 3 ? 5 : 0)
    + (c.injured ? 10 : 0) + (c.managerRel < 35 ? 8 : 0) + (c.big ? 4 : 0) + unmet * 0.15 + (c.memoryStress || 0)
    - (w.rest || 0) * 4 - (w.team || 0) * 3 - (w.outings || 0) * 3 - (c.partner ? 5 : 0) - (w.trip ? 10 : 0) + (m.sleep < 6.5 ? 6 : 0), 5, 98);
  m.stress = Math.round(m.stress + (stressT - m.stress) * 0.35);

  // ── özgüven ──
  let dConf = (50 - m.conf) * 0.06;
  if (c.played && c.rating != null) dConf += (c.rating - 6.6) * 5 + (c.goals || 0) * 2 + (c.motm ? 3 : 0);
  if (c.bench) dConf -= 3;
  if (c.red) dConf -= 4;
  dConf += (w.stars || 0) * 0.12 + (c.memoryAffect || 0);
  m.conf = Math.round(clamp(m.conf + dConf, 3, 99));

  // ── odak ──
  const focusT = clamp(58 + ((c.professionalism ?? 50) - 50) * 0.2 + (w.train || 0) * 3 - party * 8 - (w.media || 0) * 3 - (w.posts || 0) * 1.5
    - Math.max(0, m.stress - 55) * 0.5 - Math.max(0, 7 - m.sleep) * 8 + (c.traitFocus || 0), 5, 98);
  m.focus = Math.round(m.focus + (focusT - m.focus) * 0.4);

  // ── ihtiyaçlar (yüksek = karşılanmamış) ──
  const N = needs;
  N.rest = clamp(N.rest + 8 + Math.max(0, (c.load || 0) - 3.5) * 5 - (w.rest || 0) * 26 - (c.energy > 70 ? 8 : 0) + (m.sleep < 6.8 ? 6 : 0), 0, 100);
  N.social = clamp(N.social + 9 - (w.team || 0) * 28 - (w.outings || 0) * 26 - (w.party || 0) * 34 - (c.partner ? 8 : 0) - (w.family || 0) * 20 + (c.traitSocial || 0), 0, 100);
  N.achieve = clamp(N.achieve + 6 - (c.played && c.rating != null ? (c.rating - 6.5) * 10 : -4) - (w.stars || 0) * 2 - (c.goals || 0) * 4, 0, 100);
  N.recog = clamp(N.recog + 4 + (c.ego > 30 ? 3 : 0) - (w.media || 0) * 18 - (w.posts || 0) * 4 - (c.fameGain || 0) * 3 - (c.awards || 0) * 30, 0, 100);
  N.security = clamp(N.security + (c.money < (c.weekCost || 0) * 4 ? 8 : -10) + (c.contractEnding ? 6 : 0), 0, 100);
  for (const k of NEED_KEYS) N[k] = Math.round(N[k]);

  // ── moral etkisi (sınırlı) ──
  const unmet2 = NEED_KEYS.reduce((n, k) => n + Math.max(0, N[k] - 70), 0);
  const morale = clamp(-unmet2 * 0.06 - Math.max(0, m.stress - 60) * 0.08 + (m.conf - 50) * 0.02, -4, 3);
  return { morale: round1(morale) };
}

/** Maç anı yetenek çarpanı. pressure: penaltı / serbest vuruş / büyük maç */
export function mindSkillMult(m, { pressure = false } = {}) {
  if (!m) return 1;
  const stressPen = Math.max(0, m.stress - (pressure ? 50 : 60)) * (pressure ? 0.0018 : 0.0012);
  return clamp((1 + (m.conf - 50) * 0.0009) * (1 - stressPen) * (1 - Math.max(0, 45 - m.focus) * 0.0012) * (1 - Math.max(0, 7 - m.sleep) * 0.018), 0.88, 1.06);
}

/** Antrenman verimi: odak ve uyku */
export const mindTrainMult = (m) => (m ? clamp(0.86 + m.focus * 0.0024, 0.86, 1.1) * (m.sleep < 6.5 ? 0.92 : 1) : 1);

/** Sakatlık: uykusuzluk ve yüksek stres */
export const mindInjuryMult = (m) => (m ? (m.sleep < 6.5 ? 1.12 : 1) * (m.stress > 70 ? 1.08 : 1) : 1);

/** Ruh hali etiketi */
export function moodOf(m, morale = 60) {
  if (!m) return { id: 'ok', name: 'Dengeli', emoji: '🙂' };
  if (m.stress >= 72) return { id: 'stressed', name: 'Gergin', emoji: '😣' };
  if (m.sleep < 6.3) return { id: 'tired', name: 'Uykusuz', emoji: '🥱' };
  if (m.conf >= 78 && morale >= 65) return { id: 'flying', name: 'Uçuyor', emoji: '🤩' };
  if (m.conf <= 30) return { id: 'doubt', name: 'Kendinden şüpheli', emoji: '😟' };
  if (m.focus >= 75) return { id: 'locked', name: 'Odaklı', emoji: '🎯' };
  if (morale <= 35) return { id: 'down', name: 'Moralsiz', emoji: '😔' };
  return { id: 'ok', name: 'Dengeli', emoji: '🙂' };
}
