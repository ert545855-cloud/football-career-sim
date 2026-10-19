// HAFTALIK GÖREVLER — her hafta 3 görev: biri maçla ilgili (mevkiye ve forma durumuna göre), biri gelişim
// (antrenman / spor salonu), biri yaşam (taraftar, takım, sosyal, sponsor, yatırım, vakıf).
// Görevi bitirince ödülü al: para (+ bazen ün). Üçü de biterse haftanın sandığı: kozmetik ürün.
// Alınmayan ödüller hafta dönünce kendiliğinden kasaya geçer. Görevler kendi tohumuyla üretilir.
import { seeded } from './rng.js';
import { COSMETICS, ensureCosmetics } from './cosmetics.js';
import { changeFame } from './player.js';

const roundTo = (v, n) => Math.round(v / n) * n;

/** Görev tanımları. check(ev, data, q) → ilerleme artışı; target: hedef */
export const QUESTS = {
  // ── maç ──
  goals: { cat: 'match', icon: 'ball', text: (n) => (n > 1 ? `Bu hafta ${n} gol at` : 'Bu hafta gol at'), on: { match: (d) => d.goals || 0 } },
  assist: { cat: 'match', icon: 'swap', text: () => 'Bir asist yap', on: { match: (d) => d.assists || 0 } },
  rating: { cat: 'match', icon: 'star', text: (n) => `Maçta ${String(n).replace('.', ',')} ve üzeri not al`, binary: true, on: { match: (d, q) => (d.played && d.rating >= q.target ? 1 : 0) } },
  win: { cat: 'match', icon: 'trophy', text: () => 'Maçı kazan', on: { match: (d) => (d.result === 'W' ? 1 : 0) } },
  clean: { cat: 'match', icon: 'shield', text: () => 'Gol yemeden maçı bitir', on: { match: (d) => (d.played && d.score && d.score.opp === 0 ? 1 : 0) } },
  play: { cat: 'match', icon: 'run', text: () => 'Maçta forma giy', on: { match: (d) => (d.played ? 1 : 0) } },
  motm: { cat: 'match', icon: 'medal', text: () => 'Maçın oyuncusu seçil', hard: true, on: { match: (d) => (d.motm ? 1 : 0) } },
  // ── gelişim ──
  train: { cat: 'grow', icon: 'dumbbell', text: (n) => `${n} antrenman yap`, on: { train: () => 1 } },
  stars3: { cat: 'grow', icon: 'star', text: () => 'Bir antrenmanda 3 yıldız al', on: { train: (d) => (d.stars >= 3 ? 1 : 0) } },
  gym: { cat: 'grow', icon: 'dumbbell', text: (n) => (n > 1 ? `Spor salonunda ${n} seans yap` : 'Spor salonunda çalış'), on: { gym: (d) => (d.station !== 'stretch' ? 1 : 0) } },
  tread: { cat: 'grow', icon: 'run', text: () => 'Koşu bandında %70 başarı yakala', on: { gym: (d) => (d.station === 'treadmill' && d.q >= 0.7 ? 1 : 0) } },
  lift: { cat: 'grow', icon: 'dumbbell', text: () => 'Halterde %60 başarı yakala', on: { gym: (d) => (d.station === 'barbell' && d.q >= 0.6 ? 1 : 0) } },
  drill: { cat: 'grow', icon: 'target', text: () => 'Özel çalışma yap', on: { action: (d) => (d.id === 'drill' ? 1 : 0) } },
  // ── yaşam ──
  media: { cat: 'life', icon: 'mic', text: () => 'Taraftar & Medya etkinliğine katıl', on: { action: (d) => (d.id === 'media' ? 1 : 0) } },
  team: { cat: 'life', icon: 'users', text: () => 'Takımla yemeğe çık', on: { action: (d) => (d.id === 'team' ? 1 : 0) } },
  manager: { cat: 'life', icon: 'clipboard', text: () => 'Hocayla görüş', on: { action: (d) => (d.id === 'manager' ? 1 : 0) } },
  social: { cat: 'life', icon: 'coffee', text: () => 'Bir arkadaşınla buluş', on: { social: () => 1 } },
  shoot: { cat: 'life', icon: 'camera', text: () => 'Reklam çekimini tamamla', minFame: 20, on: { shoot: () => 1, action: (d) => (d.id === 'sponsor' ? 1 : 0) } },
  invest: { cat: 'life', icon: 'chart', text: () => 'Bir yatırım yap', on: { invest: () => 1 } },
  charity: { cat: 'life', icon: 'heart', text: () => 'Vakfınla bir iyilik yap', needs: (s) => !!s.foundation?.name, on: { charity: () => 1 } },
  chirp: { cat: 'life', icon: 'chirp', text: () => "Chirp'te paylaşım yap", on: { chirp: () => 1 } },
};

const hash = (str) => {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const keyOf = (s) => `${s.calendar?.season || 1}-${s.calendar?.week || 1}`;

function rewardFor(state, def, hard) {
  const wage = state.career?.contract?.wage || 500;
  const base = 120 + wage * (def.cat === 'match' ? 0.7 : 0.45);
  return { money: roundTo(base * (hard ? 1.8 : 1), 50), fame: def.cat === 'match' ? (hard ? 1 : 0.5) : 0 };
}

/** Haftanın görevlerini üretir (aynı hafta her zaman aynı görevler) */
export function generateQuests(state) {
  const R = seeded(hash(`${state.player?.name}|${keyOf(state)}|quests`));
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const pos = state.player?.position || 'MF';
  const benchy = state.flags?.injuredWeeks > 0 ? 'out' : (state.career?.lastRole || 'starter');
  const fame = state.player?.fame || 0;
  // maç görevi: mevkiye göre
  let matchIds = pos === 'FW' ? ['goals', 'goals', 'rating', 'win', 'assist'] : pos === 'MF' ? ['assist', 'rating', 'win', 'goals'] : pos === 'DF' ? ['clean', 'rating', 'win'] : ['clean', 'rating', 'win'];
  if (benchy === 'bench') matchIds = ['play', 'play', 'rating'];
  if (R() < 0.12) matchIds = ['motm'];
  const growIds = ['train', 'train', 'gym', 'gym', 'stars3', 'tread', 'lift', 'drill'];
  const lifeIds = ['media', 'team', 'manager', 'social', 'social', 'invest', 'chirp', ...(fame >= 20 ? ['shoot', 'shoot'] : []), ...(state.foundation?.name ? ['charity', 'charity'] : [])];
  const list = [];
  if (benchy !== 'out') list.push(pick(matchIds));
  list.push(pick(growIds.filter((id) => benchy !== 'out' || id === 'gym' || id === 'drill' ? true : true)));
  list.push(pick(lifeIds));
  if (benchy === 'out') list.push(pick(lifeIds.filter((id) => id !== list[list.length - 1])));
  return list.map((id, i) => {
    const def = QUESTS[id];
    let target = 1;
    if (id === 'goals') target = pos === 'FW' && R() < 0.5 ? 2 : 1;
    if (id === 'train') target = R() < 0.5 ? 3 : 2;
    if (id === 'gym') target = R() < 0.35 ? 2 : 1;
    if (id === 'rating') target = Math.min(8, Math.round((6.8 + R() * 0.8) * 2) / 2);
    const hard = !!def.hard || (id === 'goals' && target > 1) || (id === 'rating' && target >= 7.5);
    return { n: i, id, target, progress: 0, done: false, claimed: false, hard, reward: rewardFor(state, def, hard), text: def.text(target) };
  });
}

/** Kayıt alanı; hafta değiştiyse eski haftanın alınmayan ödülleri kasaya geçer, yeni görevler gelir */
export function ensureQuests(state) {
  const q = state.quests || (state.quests = {});
  const key = keyOf(state);
  if (q.key !== key) {
    const carried = q.key ? autoClaim(state) : 0;
    q.key = key;
    q.list = state.calendar?.phase === 'week' ? generateQuests(state) : [];
    q.chest = null;
    q.chestClaimed = false;
    q.carried = carried;
    q.total ||= 0;
    q.chests ||= 0;
  }
  return q;
}

function autoClaim(state) {
  const q = state.quests;
  let money = 0;
  for (const t of q.list || []) if (t.done && !t.claimed) { money += grant(state, t); }
  if (q.chest && !q.chestClaimed) openChest(state);
  return money;
}

function grant(state, t) {
  t.claimed = true;
  state.career.money += t.reward.money;
  if (t.reward.fame) changeFame(state.player, t.reward.fame);
  state.quests.total = (state.quests.total || 0) + 1;
  return t.reward.money;
}

/** Olay kancası: 'match' | 'train' | 'gym' | 'action' | 'social' | 'shoot' | 'invest' | 'charity' | 'chirp' */
export function questsOn(state, ev, data = {}) {
  if (!state?.calendar) return [];
  const q = ensureQuests(state);
  const finished = [];
  for (const t of q.list) {
    if (t.done) continue;
    const fn = QUESTS[t.id]?.on?.[ev];
    if (!fn) continue;
    const inc = fn(data, t);
    if (!inc) continue;
    t.progress = QUESTS[t.id].binary ? 1 : Math.min(t.target, t.progress + inc);
    if ((QUESTS[t.id].binary ? 1 : t.target) <= t.progress) { t.done = true; finished.push(t); }
  }
  if (q.list.length && q.list.every((t) => t.done) && !q.chest) q.chest = chestPick(state);
  return finished;
}

/** Görev ödülünü al */
export function claimQuest(state, n) {
  const q = ensureQuests(state);
  const t = q.list.find((x) => x.n === n);
  if (!t || !t.done || t.claimed) return { ok: false };
  const money = grant(state, t);
  return { ok: true, money, fame: t.reward.fame };
}

/** Haftanın sandığı: henüz sahip olmadığın bir kozmetik; hepsi varsa para */
function chestPick(state) {
  const c = ensureCosmetics(state);
  const pool = COSMETICS.filter((x) => x.price > 0 && x.price < 6000 && !c.owned.includes(x.id) && x.slot !== 'hair' && x.slot !== 'dye');
  const R = seeded(hash(`${state.player?.name}|${keyOf(state)}|chest`));
  const it = pool[Math.floor(R() * pool.length)];
  return it ? { cosmetic: it.id, name: it.name, slot: it.slot } : { money: roundTo(800 + (state.career?.contract?.wage || 500) * 1.5, 50) };
}

export function openChest(state) {
  const q = ensureQuests(state);
  if (!q.chest || q.chestClaimed) return { ok: false };
  q.chestClaimed = true;
  q.chests = (q.chests || 0) + 1;
  if (q.chest.cosmetic) {
    const c = ensureCosmetics(state);
    if (!c.owned.includes(q.chest.cosmetic)) c.owned.push(q.chest.cosmetic);
  } else state.career.money += q.chest.money;
  return { ok: true, ...q.chest };
}
