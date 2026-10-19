// GERÇEK SAKATLIK SİSTEMİ — maçta yorgunluk, zemin ve geçmiş sakatlıklara bağlı risk; sakatlık türü, süre,
// tedavi seçimi (dinlen / hızlandırılmış tedavi / ameliyat / yurt dışı klinik / ağrı kesiciyle oyna),
// dönüşte tekrar sakatlanma riski ve sakatlık geçmişi. Haftalık sayaç: state.flags.injuredWeeks.
import { clamp, chance, randInt, weightedPick } from './rng.js';
import { changeEnergy, changeMorale, changeRel } from './player.js';
import { injuryPersonaMult } from './character.js';
import { gymInjuryMult } from './gym.js';

export const INJURIES = {
  knock: { name: 'Darbe', part: 'Kaval kemiği', weeks: [0, 1], w: 0.26, minor: true },
  ankle: { name: 'Ayak bileği burkulması', part: 'Ayak bileği', weeks: [1, 3], w: 0.2, minor: true, recur: 0.1 },
  hamstring: { name: 'Arka adale zorlanması', part: 'Arka adale', weeks: [2, 4], w: 0.18, recur: 0.2 },
  groin: { name: 'Kasık ağrısı', part: 'Kasık', weeks: [2, 4], w: 0.1, recur: 0.14 },
  calf: { name: 'Baldır yırtığı', part: 'Baldır', weeks: [3, 6], w: 0.09, recur: 0.12 },
  shoulder: { name: 'Omuz çıkığı', part: 'Omuz', weeks: [3, 6], w: 0.05 },
  meniscus: { name: 'Menisküs yırtığı', part: 'Diz', weeks: [6, 10], w: 0.04, surgery: true },
  fracture: { name: 'Ayak kırığı', part: 'Ayak', weeks: [8, 12], w: 0.02, surgery: true },
  acl: { name: 'Ön çapraz bağ kopması', part: 'Diz', weeks: [18, 26], w: 0.012, surgery: true, lasting: { speed: -2 } },
};

export function ensureMedical(state) {
  const m = (state.medical ||= { current: null, history: [], fragile: 0, prone: 0 });
  return m;
}

/** Bu maçta sakatlanma olasılığı */
export function injuryRisk(state, match) {
  const m = ensureMedical(state);
  const e0 = match?.energy0 ?? state.player.energy;
  let p = 0.034 + Math.max(0, 45 - e0) / 700;
  if (match?.weather?.surface === 'heavy' || match?.weather?.surface === 'snow') p += 0.008;
  if (match?.subOff) p += 0.012; // kondisyonu biten oyuncu
  if (m.fragile > 0) p += 0.035; // dönüşteki kırılgan dönem
  if (state.flags?.painkiller) p += 0.12; // ağrı kesiciyle oynuyor
  p += (m.prone || 0) * 0.03;
  if (match?.role !== 'starter') p *= 0.5;
  // Profesyonellik: vücuduna iyi bakan oyuncu daha az sakatlanır
  p *= injuryPersonaMult(state);
  if (state.flags?.campFitWeeks > 0) p *= 0.75; // yaz kampında kondisyon çalıştın
  p *= gymInjuryMult(state); // kondisyon, kas ağrısı, esneme
  return clamp(p, 0, 0.3);
}

/** Maç sonu: sakatlık zarı (oynadıysa). Sakatlanırsa state.pending.injury ayarlanır. */
export function matchInjuryRoll(state, match, played) {
  const m = ensureMedical(state);
  const painkiller = !!state.flags?.painkiller;
  if (state.flags) state.flags.painkiller = false;
  if (!played) return null;
  if (!chance(injuryRisk(state, match))) return null;
  const id = weightedPick(Object.entries(INJURIES).map(([k, v]) => [k, v.w * (k === m.lastId && v.recur ? 3 : 1)]));
  const def = INJURIES[id];
  let weeks = randInt(def.weeks[0], def.weeks[1]);
  if (painkiller) weeks = Math.max(weeks + 1, Math.round(weeks * 1.8)); // ağrı kesiciyle oynarken kötüleşti
  if (m.fragile > 0 && def.recur) weeks += 1;
  return startInjury(state, id, weeks, { painkiller, source: 'match' });
}

export function startInjury(state, id, weeks, { painkiller = false, source = 'match' } = {}) {
  const m = ensureMedical(state);
  const def = INJURIES[id];
  const inj = { id, name: def.name, part: def.part, weeks, total: weeks, s: state.calendar.season, w: state.calendar.week, source, painkiller, treatment: null, minor: !!def.minor, surgery: !!def.surgery };
  m.lastId = id;
  if (weeks <= 0) {
    // sadece darbe: maç kaçırmaz
    changeEnergy(state.player, -6);
    m.history.unshift({ ...inj, treatment: 'none' });
    m.history.length = Math.min(m.history.length, 20);
    return { ...inj, light: true };
  }
  state.flags.injuredWeeks = Math.max(state.flags.injuredWeeks || 0, weeks);
  m.current = inj;
  state.pending.injury = inj;
  return inj;
}

/** Tedavi seçenekleri (ücret haftalık maaşa göre) */
export function treatmentOptions(state, inj = state.pending.injury || ensureMedical(state).current) {
  if (!inj) return [];
  const wage = state.career.contract?.wage || 500;
  const opts = [];
  if (inj.surgery) {
    opts.push({ id: 'surgery', name: 'Ameliyat (kulüp doktoru)', desc: `Planlanan süre ${inj.weeks} hafta. Kalıcı iyileşme.`, cost: 0, weeks: inj.weeks });
    opts.push({ id: 'clinic', name: 'Yurt dışında uzman klinik', desc: 'Daha hızlı dönüş, yüksek ücret.', cost: Math.round(wage * 3 + 3000), weeks: Math.max(1, Math.round(inj.weeks * 0.78)) });
  } else {
    opts.push({ id: 'rest', name: 'Dinlen (önerilen)', desc: `${inj.weeks} hafta yoksun. Dönüşte düşük risk.`, cost: 0, weeks: inj.weeks });
    if (inj.weeks >= 2) opts.push({ id: 'fast', name: 'Hızlandırılmış tedavi', desc: 'Fizyoterapi + PRP: 1 hafta erken dönüş ama tekrar riski yüksek.', cost: Math.round(wage * 0.6 + 800), weeks: inj.weeks - 1 });
    if (inj.minor) opts.push({ id: 'play', name: 'Ağrı kesiciyle oyna', desc: 'Hiç maç kaçırmazsın ama bu hafta sakatlığın kötüleşebilir.', cost: 0, weeks: 0 });
  }
  return opts;
}

/** Tedaviyi uygular */
export function chooseTreatment(state, optId) {
  const inj = state.pending.injury;
  if (!inj) return null;
  state.pending.injury = null;
  const m = ensureMedical(state);
  const opt = treatmentOptions(state, inj).find((o) => o.id === optId) || treatmentOptions(state, inj)[0];
  state.career.money -= opt.cost;
  inj.treatment = opt.id;
  let note = '';
  if (opt.id === 'play') {
    state.flags.injuredWeeks = 0;
    state.flags.painkiller = true;
    inj.playing = true;
    changeRel(state.player, 'manager', 2);
    note = 'İğneni olup sahaya çıkacaksın. Hoca fedakârlığını takdir etti ama risk büyük.';
  } else {
    state.flags.injuredWeeks = Math.max(0, opt.weeks);
    inj.weeks = opt.weeks;
    if (opt.id === 'fast') { m.prone = clamp((m.prone || 0) + 0.08, 0, 1); note = 'Tedaviye başladın. Erken döneceksin ama vücudun zorlanacak.'; }
    else if (opt.id === 'clinic') note = 'Yurt dışındaki klinikte uzman ekip seni bekliyor.';
    else if (opt.id === 'surgery') note = 'Ameliyat başarılı geçti. Uzun ve sabırlı bir rehabilitasyon seni bekliyor.';
    else note = 'Sağlık ekibi dinlenme ve rehabilitasyon programı hazırladı.';
    changeMorale(state.player, inj.total >= 8 ? -10 : -4);
  }
  m.current = inj;
  return { note, cost: opt.cost, weeks: opt.weeks, opt };
}

/**
 * Haftalık iyileşme (endWeek, sayaç düşürüldükten sonra).
 * @returns {{returned?:object}|null}
 */
export function medicalOnWeekEnd(state) {
  const m = ensureMedical(state);
  if (m.fragile > 0) m.fragile -= 1;
  m.prone = Math.max(0, (m.prone || 0) - 0.005);
  const cur = m.current;
  if (!cur) return null;
  if (cur.playing) {
    // ağrı kesiciyle oynanan hafta bitti
    m.history.unshift({ ...cur });
    m.history.length = Math.min(m.history.length, 20);
    m.current = null;
    return null;
  }
  if ((state.flags.injuredWeeks || 0) <= 0) {
    m.history.unshift({ ...cur, back: { s: state.calendar.season, w: state.calendar.week } });
    m.history.length = Math.min(m.history.length, 20);
    m.current = null;
    m.fragile = cur.treatment === 'fast' ? 4 : cur.total >= 6 ? 3 : 2;
    // Kalıcı etki (ör. çapraz bağ: biraz hız kaybı)
    const lasting = INJURIES[cur.id]?.lasting;
    if (lasting) for (const [k, v] of Object.entries(lasting)) state.player.stats[k] = Math.max(1, state.player.stats[k] + v);
    // Sık sakatlanan oyuncu: geçmiş arttıkça yatkınlık
    const recent = m.history.filter((h) => h.s >= state.calendar.season - 1 && h.total >= 2).length;
    m.prone = clamp(recent * 0.06, 0, 0.6);
    return { returned: cur, lasting };
  }
  return null;
}

/** Arayüz: iyileşme yüzdesi */
export function recoveryPct(state) {
  const cur = ensureMedical(state).current;
  if (!cur || !cur.total) return 100;
  const left = state.flags.injuredWeeks || 0;
  return clamp(Math.round(((cur.total - left) / cur.total) * 100), 0, 100);
}

export const injuryLabel = (inj) => (inj ? `${inj.name} · ${inj.part}` : '');
