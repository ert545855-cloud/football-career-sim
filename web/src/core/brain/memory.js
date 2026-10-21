// @ts-check
// ANILAR — kariyerin duygusal izleri: ilk gol, hat-trick, derbi zaferi, kırmızı kart, uzun sakatlık, kupa,
// ayrılık, hocadan övgü… Her anının bir duygusu (val: −1…+1) ve şiddeti (int: 0…1) var; zamanla soluklaşır.
// Taze anılar özgüveni besler ya da kemirir, kötü anılar strese döner; iç ses onları hatırlar.
import { clamp, round1 } from '../rng.js';

const CAP = 24;
/** Kalıcı (yavaş solan) anı türleri */
const CORE = new Set(['trophy', 'debut', 'first_goal', 'national_debut', 'award', 'transfer']);

/**
 * @param {any} brain
 * @param {{kind:string, text:string, val:number, int?:number, tag?:string|null}} m
 * @param {{s:number, w:number}} at
 */
export function addMemory(brain, m, at) {
  const list = brain.memories || (brain.memories = []);
  // aynı hafta aynı tür: güçlendir (tekrar yazma)
  const same = list.find((x) => x.kind === m.kind && x.s === at.s && x.w === at.w);
  if (same) {
    same.int = clamp(round2(same.int + (m.int ?? 0.6) * 0.3), 0, 1);
    return same;
  }
  const rec = { id: `${m.kind}_${at.s}_${at.w}_${list.length}`, kind: m.kind, text: m.text, val: clamp(m.val, -1, 1), int: clamp(m.int ?? 0.6, 0.05, 1), tag: m.tag || null, s: at.s, w: at.w };
  list.unshift(rec);
  if (list.length > CAP) {
    // en soluk anı unutulur (kalıcılar hariç)
    let worst = -1;
    let wv = 9;
    list.forEach((x, i) => { const v = x.int * (CORE.has(x.kind) ? 3 : 1); if (v < wv) { wv = v; worst = i; } });
    if (worst >= 0) list.splice(worst, 1);
  }
  return rec;
}
const round2 = (v) => Math.round(v * 100) / 100;

/** Haftalık solma; özgüven/strese katkı döner */
export function memoriesOnWeek(brain) {
  const list = brain.memories || [];
  let affect = 0;
  let stress = 0;
  for (const m of list) {
    const age = m._age = (m._age || 0) + 1;
    if (age <= 8) affect += m.val * m.int * 1.1;
    if (m.val < -0.4 && m.int > 0.5) stress += m.int * 2.5;
    m.int = round2(m.int * (CORE.has(m.kind) ? 0.99 : 0.965));
  }
  brain.memories = list.filter((m) => m.int >= 0.08);
  return { affect: round1(clamp(affect, -6, 6)), stress: round1(clamp(stress, 0, 10)) };
}

/** Deneyim sayaçları (özellikler için): büyük maç, penaltı */
export function experienceCounts(brain) {
  const list = brain.memories || [];
  const recent = list.filter((m) => (m._age || 0) <= 40);
  const bigPos = recent.filter((m) => m.tag === 'big' && m.val > 0).length;
  const bigNeg = recent.filter((m) => m.tag === 'big' && m.val < 0).length;
  const pens = brain.pens || [];
  const last = pens.slice(-6);
  const penNet = last.reduce((n, p) => n + (p ? 1 : -1), 0);
  return { bigPos, bigNeg, penNet, fearWeeks: brain.fearWeeks || 0 };
}

/** En güçlü taze anı (iç ses için) */
export function salientMemory(brain, { minInt = 0.35 } = {}) {
  const list = (brain.memories || []).filter((m) => m.int >= minInt && (m._age || 0) <= 12);
  return list.sort((a, b) => Math.abs(b.val) * b.int - Math.abs(a.val) * a.int)[0] || null;
}
