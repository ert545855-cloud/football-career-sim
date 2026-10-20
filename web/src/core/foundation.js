// VAKIF VE HAYIR İŞLERİ — kendi vakfını kur (ün 20+), kasadan vakfa bağış yap, projeleri fonla.
// Projeler: forma bağışı, saha yenileme, altyapı bursu, kış kampanyası, hastane ziyareti, futbol okulu,
// afet yardımı (ara sıra çıkan acil çağrı), sezon sonu yardım maçı.
// Etkiler: taraftar ilişkisi, marka imajı (Sponsor), ün, moral ve "miras" puanı. Miras, emeklilik sonrası
// efsane puanını artırır (daha iyi teknik direktörlük / yorumculuk teklifleri) ve iç saha maçlarında
// taraftar desteği verir (etkin yetenek +%3'e kadar). Zarlar kendi tohumuyla.
import { clamp, roundTo, seeded } from './rng.js';
import { changeFame, changeMorale, changeRel } from './player.js';

export const FOUNDATION_RULES = { minFame: 20, cost: 25000 };

export const PROJECTS = {
  kits: { id: 'kits', name: 'Mahalle takımlarına forma', cost: 8000, weeks: 1, fans: 3, image: 2, fame: 0.5, legacy: 1, kids: 120, icon: 'jersey', desc: 'Mahalle liglerindeki 8 takıma forma ve top.' },
  hospital: { id: 'hospital', name: 'Çocuk hastanesi ziyareti', cost: 0, weeks: 0, slot: true, fans: 2, image: 3, fame: 0.5, morale: 6, legacy: 1, kids: 40, icon: 'heart', desc: 'Bir öğleden sonra çocuklarla oyun, imza ve hediye. 1 zaman hakkı.' },
  winter: { id: 'winter', name: 'Kış kampanyası', cost: 15000, weeks: 2, fans: 3, image: 3, fame: 0.6, legacy: 2, kids: 300, icon: 'snow', desc: 'Köy okullarına mont, bot ve kırtasiye.' },
  scholar: { id: 'scholar', name: 'Altyapı bursu', cost: 25000, weeks: 3, fans: 2, image: 4, fame: 0.6, legacy: 5, kids: 10, icon: 'sprout', desc: 'Yetenekli 10 gence bir sezonluk eğitim ve futbol bursu.' },
  pitch: { id: 'pitch', name: 'Mahalle sahası yenileme', cost: 40000, weeks: 4, fans: 6, image: 5, fame: 1, legacy: 4, kids: 600, icon: 'flag', desc: 'Toprak sahayı sentetik çime, ışıklandırma ve soyunma odasıyla yenile.' },
  academy: { id: 'academy', name: 'Ücretsiz futbol okulu', cost: 150000, weeks: 8, fans: 8, image: 8, fame: 2, legacy: 12, kids: 1500, minLegacy: 10, icon: 'ball', desc: 'Adını taşıyan ücretsiz futbol okulu. Kalıcı bir miras.' },
  disaster: { id: 'disaster', name: 'Afet bölgesine yardım', cost: 30000, weeks: 1, fans: 6, image: 6, fame: 1.5, legacy: 5, kids: 2000, urgent: true, icon: 'megaphone', desc: 'Afet bölgesine acil yardım tırları ve çadır kent desteği.' },
  match: { id: 'match', name: 'Yardım maçı', cost: 0, weeks: 0, slot: true, fans: 5, image: 4, fame: 2, legacy: 3, kids: 0, raise: 20000, seasonal: true, icon: 'trophy', desc: 'Eski yıldızlar ve takım arkadaşlarınla dostluk maçı; bilet geliri vakfa.' },
};

const hashStr = (str) => {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const rngFor = (state, tag) => seeded(hashStr(`${state.player?.name}|${state.calendar?.season}|${state.calendar?.week}|fnd|${tag}`));

export function ensureFoundation(state) {
  const f = state.foundation || (state.foundation = {});
  f.fund ||= 0;
  f.legacy ||= 0;
  f.active ||= [];
  f.done ||= [];
  f.log ||= [];
  f.donated ||= 0;
  f.kids ||= 0;
  f.urgent ??= null;
  f.matchSeason ??= 0;
  return f;
}

export const foundationName = (state) => `${String(state.player?.name || 'Oyuncu').split(' ').slice(-1)[0]} Vakfı`;

export function canFound(state) {
  const f = ensureFoundation(state);
  if (f.name) return { ok: false, reason: 'Vakfın zaten var.' };
  if ((state.player?.fame || 0) < FOUNDATION_RULES.minFame) return { ok: false, reason: `Vakıf kurmak için ünün en az ${FOUNDATION_RULES.minFame} olmalı.` };
  if (state.career.money < FOUNDATION_RULES.cost) return { ok: false, reason: `Kuruluş için ${FOUNDATION_RULES.cost.toLocaleString('tr-TR')} € gerekiyor (vakfın ilk fonu olur).` };
  return { ok: true };
}

export function found(state) {
  const c = canFound(state);
  if (!c.ok) return c;
  const f = ensureFoundation(state);
  f.name = foundationName(state);
  f.founded = { s: state.calendar.season, w: state.calendar.week };
  state.career.money -= FOUNDATION_RULES.cost;
  f.fund += FOUNDATION_RULES.cost;
  f.donated += FOUNDATION_RULES.cost;
  changeRel(state.player, 'fans', 4);
  changeRel(state.player, 'sponsor', 3);
  changeFame(state.player, 1);
  log(state, `${f.name} kuruldu.`);
  return { ok: true };
}

export function donate(state, amount) {
  const f = ensureFoundation(state);
  amount = Math.floor(amount);
  if (!f.name) return { ok: false, text: 'Önce vakfını kur.' };
  if (amount < 500) return { ok: false, text: 'En az 500 € bağışlayabilirsin.' };
  if (amount > state.career.money) return { ok: false, text: 'Kasanda yeterli para yok.' };
  state.career.money -= amount;
  f.fund += amount;
  f.donated += amount;
  if (amount >= 10000) changeRel(state.player, 'fans', 1);
  return { ok: true };
}

/** Proje başlatılabilir mi */
export function canStart(state, id) {
  const f = ensureFoundation(state);
  const P = PROJECTS[id];
  if (!f.name) return { ok: false, reason: 'Önce vakfını kur.' };
  if (!P) return { ok: false, reason: 'Proje bulunamadı.' };
  if (P.urgent && f.urgent?.id !== id) return { ok: false, reason: 'Şu an acil bir çağrı yok.' };
  if (P.seasonal) {
    if (f.matchSeason === state.calendar.season) return { ok: false, reason: 'Bu sezon yardım maçını yaptın.' };
    if ((state.calendar.week || 1) < 16) return { ok: false, reason: 'Yardım maçı sezonun son haftalarında (16. haftadan sonra) düzenlenir.' };
  }
  if (P.minLegacy && f.legacy < P.minLegacy) return { ok: false, reason: `Futbol okulu için miras puanın ${P.minLegacy} olmalı.` };
  if (f.active.some((a) => a.id === id)) return { ok: false, reason: 'Bu proje zaten sürüyor.' };
  if (P.cost > f.fund) return { ok: false, reason: `Vakıf fonunda ${P.cost.toLocaleString('tr-TR')} € olmalı (şu an ${Math.round(f.fund).toLocaleString('tr-TR')} €).` };
  if (P.slot && (state.calendar.phase !== 'week' || state.calendar.slots <= 0)) return { ok: false, reason: 'Bu hafta zamanın kalmadı.' };
  return { ok: true };
}

function applyProject(state, P) {
  const f = ensureFoundation(state);
  const p = state.player;
  changeRel(p, 'fans', P.fans);
  changeRel(p, 'sponsor', P.image);
  changeFame(p, P.fame);
  if (P.morale) changeMorale(p, P.morale);
  else changeMorale(p, 2);
  f.legacy += P.legacy;
  f.kids += P.kids;
  if (P.raise) f.fund += P.raise + roundTo((p.fame || 0) * 300, 500);
  f.done.unshift({ id: P.id, s: state.calendar.season, w: state.calendar.week });
  if (f.done.length > 30) f.done.length = 30;
  log(state, `${P.name} tamamlandı${P.kids ? `: ${P.kids.toLocaleString('tr-TR')} çocuğa ulaşıldı` : ''}.`);
}

/** Projeyi başlat: anlık olanlar hemen biter, diğerleri haftalar sürer */
export function startProject(state, id) {
  const c = canStart(state, id);
  if (!c.ok) return { ok: false, text: c.reason };
  const f = ensureFoundation(state);
  const P = PROJECTS[id];
  f.fund -= P.cost;
  if (P.slot) state.calendar.slots -= 1;
  if (P.urgent) f.urgent = null;
  if (P.seasonal) f.matchSeason = state.calendar.season;
  if (!P.weeks) { applyProject(state, P); return { ok: true, instant: true, P }; }
  f.active.push({ id, weeksLeft: P.weeks });
  log(state, `${P.name} başladı (${P.weeks} hafta).`);
  return { ok: true, instant: false, P };
}

function log(state, text) {
  const f = ensureFoundation(state);
  f.log.unshift({ s: state.calendar?.season, w: state.calendar?.week, text });
  if (f.log.length > 16) f.log.length = 16;
}

/** İç saha maçlarında taraftar desteği (miras): etkin yetenek çarpanı */
export const foundationHomeMult = (state, isHome) => (isHome && state?.foundation?.legacy ? 1 + Math.min(0.03, state.foundation.legacy / 1000) : 1);

/**
 * Hafta sonu: süren projeler ilerler, biterse etkiler uygulanır; ara sıra acil yardım çağrısı.
 * @returns {{news:{text:string,kind:string}[]}}
 */
export function foundationOnWeek(state) {
  const f = ensureFoundation(state);
  const news = [];
  if (!f.name) return { news };
  for (const a of f.active.slice()) {
    a.weeksLeft -= 1;
    if (a.weeksLeft <= 0) {
      f.active = f.active.filter((x) => x !== a);
      const P = PROJECTS[a.id];
      applyProject(state, P);
      news.push({ text: `${f.name}: ${P.name} tamamlandı!${P.kids ? ` ${P.kids.toLocaleString('tr-TR')} çocuğa ulaştınız.` : ''} Taraftar ve basın çok olumlu.`, kind: 'good' });
    }
  }
  if (f.urgent && f.urgent.until <= (state.calendar.season * 100 + state.calendar.week)) f.urgent = null;
  const R = rngFor(state, 'urgent');
  if (!f.urgent && R() < 0.03) {
    f.urgent = { id: 'disaster', until: state.calendar.season * 100 + state.calendar.week + 2 };
    news.push({ text: `Acil çağrı: afet bölgesi yardım bekliyor. ${f.name} 2 hafta içinde destek olabilir (Servet → Vakıf).`, kind: 'info' });
  }
  return { news };
}
