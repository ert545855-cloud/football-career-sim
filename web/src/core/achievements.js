// BAŞARIMLAR — kariyer boyunca açılan rozetler.
//
// Her başarım bir "ölçü" (value) ve bir hedef (goal) tanımlar: value(state) >= goal olunca açılır.
// Böylece kilitli rozetlerde ilerleme çubuğu gösterilebilir (ör. 37/50 gol).
// Maç içi anlar gibi durumdan okunamayan şeyler için sayaçlar (state.achievements.c) tutulur;
// sayaçlar achievementsOnMatch / achievementsOnTraining kancalarında güncellenir.
//
// Açılan başarımlar kuyruğa (queue) eklenir; arayüz kuyruğu boşaltıp bildirim gösterir.
import { CLUB_BY_ID, ITEM_BY_ID, LEAGUES, STAT_KEYS } from './data.js';
import { leagueIdIn } from './league.js';
import { changeFame, changeMorale, ovr } from './player.js';
import { hardMasters } from './training.js';

/** Rozet seviyeleri: renk, ödül */
export const TIERS = {
  bronze: { name: 'Bronz', color: '#d08a4f', morale: 2, fame: 0 },
  silver: { name: 'Gümüş', color: '#cbd5e1', morale: 3, fame: 0.5 },
  gold: { name: 'Altın', color: '#fbbf24', morale: 5, fame: 1 },
  platinum: { name: 'Platin', color: '#a5f3fc', morale: 8, fame: 2 },
};

export const CATEGORIES = {
  career: 'Kariyer',
  match: 'Maç',
  skill: 'Yetenek',
  honors: 'Onur',
  life: 'Yaşam',
};

const tot = (s, k) => (s.career.totals?.[k] || 0) + (s.career.season?.[k] || 0);
const awardCount = (s, word) => (s.career.awards || []).filter((a) => a.title.includes(word)).length;
const c = (s, k) => s.achievements?.c?.[k] || 0;
const ownsCat = (s, cat, kind) => (s.career.items || []).some((id) => ITEM_BY_ID[id]?.cat === cat && (!kind || ITEM_BY_ID[id].kind === kind));
const clubsPlayed = (s) => new Set([...(s.career.history || []).map((h) => h.clubId), s.career.clubId].map((id) => CLUB_BY_ID[id]?.parentId || id)).size;
const isTop = (lid) => LEAGUES[lid] && !LEAGUES[lid].youth && LEAGUES[lid].tier === 1;
const playedTopFlight = (s) => (s.career.history || []).some((h) => isTop(h.leagueId) && h.apps > 0) || (isTop(leagueIdIn(s.world, s.career.clubId)) && s.career.season.apps > 0);
const seasonsAtOneClub = (s) => {
  const counts = {};
  for (const h of s.career.history || []) counts[h.clubId] = (counts[h.clubId] || 0) + 1;
  return Math.max(0, ...Object.values(counts));
};

/**
 * @typedef {{id:string, cat:keyof CATEGORIES, tier:keyof TIERS, title:string, desc:string, icon:string, sprite?:string,
 *   goal:number, value:(s:any)=>number, hidden?:boolean}} Achievement
 */

/** @type {Achievement[]} */
export const ACHIEVEMENTS = [
  // ── Kariyer ──
  { id: 'debut', cat: 'career', tier: 'bronze', title: 'İlk Düdük', desc: 'Profesyonel ilk maçına çık.', icon: 'whistle', sprite: 'whistle', goal: 1, value: (s) => tot(s, 'apps') },
  { id: 'apps50', cat: 'career', tier: 'silver', title: 'Takımın Demirbaşı', desc: '50 maça çık.', icon: 'users', sprite: 'jersey', goal: 50, value: (s) => tot(s, 'apps') },
  { id: 'apps200', cat: 'career', tier: 'gold', title: 'Kariyer Adamı', desc: '200 maça çık.', icon: 'users', sprite: 'jersey', goal: 200, value: (s) => tot(s, 'apps') },
  { id: 'first_goal', cat: 'career', tier: 'bronze', title: 'İlk Gol', desc: 'Profesyonel ilk golünü at.', icon: 'ball', sprite: 'ball', goal: 1, value: (s) => tot(s, 'goals') },
  { id: 'goals50', cat: 'career', tier: 'silver', title: 'Golcü', desc: 'Kariyerinde 50 gol at.', icon: 'ball', sprite: 'ball', goal: 50, value: (s) => tot(s, 'goals') },
  { id: 'goals150', cat: 'career', tier: 'gold', title: 'Gol Makinesi', desc: 'Kariyerinde 150 gol at.', icon: 'fire', sprite: 'golden_boot', goal: 150, value: (s) => tot(s, 'goals') },
  { id: 'first_assist', cat: 'career', tier: 'bronze', title: 'İlk Asist', desc: 'Bir takım arkadaşına gol pası ver.', icon: 'target', sprite: 'boots', goal: 1, value: (s) => tot(s, 'assists') },
  { id: 'assists50', cat: 'career', tier: 'gold', title: 'Oyun Kurucu', desc: 'Kariyerinde 50 asist yap.', icon: 'target', sprite: 'tactics_board', goal: 50, value: (s) => tot(s, 'assists') },
  { id: 'journeyman', cat: 'career', tier: 'silver', title: 'Gezgin', desc: '4 farklı kulüpte oyna.', icon: 'swap', goal: 4, value: clubsPlayed },
  { id: 'loyal', cat: 'career', tier: 'gold', title: 'Bayrak Adam', desc: 'Aynı kulüpte 6 sezon geçir.', icon: 'flag', sprite: 'fan_flag_1', goal: 6, value: seasonsAtOneClub },
  { id: 'top_flight', cat: 'career', tier: 'silver', title: 'Süper Lig\'e Merhaba', desc: 'Süper Lig\'de forma giy.', icon: 'star', sprite: 'tunnel_players', goal: 1, value: (s) => (playedTopFlight(s) ? 1 : 0) },

  // ── Maç ──
  { id: 'motm', cat: 'match', tier: 'bronze', title: 'Maçın Adamı', desc: 'İlk kez maçın oyuncusu seçil.', icon: 'star', sprite: 'medal_silver', goal: 1, value: (s) => tot(s, 'motm') },
  { id: 'motm20', cat: 'match', tier: 'gold', title: 'Büyük Maç Oyuncusu', desc: '20 kez maçın oyuncusu seçil.', icon: 'star', sprite: 'medal_gold', goal: 20, value: (s) => tot(s, 'motm') },
  { id: 'brace', cat: 'match', tier: 'bronze', title: 'Çifte Kavrulmuş', desc: 'Bir maçta 2 gol at.', icon: 'ball', goal: 2, value: (s) => c(s, 'bestGoals') },
  { id: 'hattrick', cat: 'match', tier: 'gold', title: 'Hat-trick!', desc: 'Bir maçta 3 gol at.', icon: 'fire', sprite: 'ball_retro', goal: 3, value: (s) => c(s, 'bestGoals') },
  { id: 'perfect10', cat: 'match', tier: 'platinum', title: 'Kusursuz 10', desc: 'Bir maçta 10 not al.', icon: 'crown', sprite: 'trophy_star', goal: 10, value: (s) => c(s, 'bestRating') },
  { id: 'streak5', cat: 'match', tier: 'silver', title: 'Seri', desc: 'Oynadığın 5 maçı üst üste kazan.', icon: 'bolt', goal: 5, value: (s) => c(s, 'bestWinStreak') },
  { id: 'curve_pass', cat: 'match', tier: 'bronze', title: 'Falso', desc: 'Maçta kavisli (falsolu) isabetli bir pas at.', icon: 'reply', goal: 1, value: (s) => c(s, 'curvedPasses') },
  { id: 'curve_master', cat: 'match', tier: 'gold', title: 'Falso Ustası', desc: 'Maçlarda 25 falsolu isabetli pas at.', icon: 'reply', sprite: 'boots', goal: 25, value: (s) => c(s, 'curvedPasses') },
  { id: 'wall', cat: 'match', tier: 'silver', title: 'Geçit Yok', desc: 'Maçlarda 30 başarılı müdahale yap.', icon: 'shield', goal: 30, value: (s) => c(s, 'tackles') },

  // ── Yetenek ──
  { id: 'ovr60', cat: 'skill', tier: 'bronze', title: 'Gelişen Yetenek', desc: 'Genel güç (OVR) 60 olsun.', icon: 'chart', goal: 60, value: (s) => ovr(s.player) },
  { id: 'ovr75', cat: 'skill', tier: 'silver', title: 'Yıldız Adayı', desc: 'Genel güç (OVR) 75 olsun.', icon: 'chart', goal: 75, value: (s) => ovr(s.player) },
  { id: 'ovr88', cat: 'skill', tier: 'platinum', title: 'Dünya Yıldızı', desc: 'Genel güç (OVR) 88 olsun.', icon: 'crown', sprite: 'golden_ball', goal: 88, value: (s) => ovr(s.player) },
  { id: 'stat90', cat: 'skill', tier: 'gold', title: 'Uzman', desc: 'Herhangi bir özelliğini 90 yap.', icon: 'dumbbell', goal: 90, value: (s) => Math.max(...STAT_KEYS.map((k) => s.player.stats[k])) },
  { id: 'drill_master', cat: 'skill', tier: 'gold', title: 'Antrenman Ustası', desc: '3 farklı antrenmanda Zor seviyede 3 yıldız al.', icon: 'star', sprite: 'disc_cones', goal: 3, value: (s) => hardMasters(s) },
  { id: 'grinder', cat: 'skill', tier: 'silver', title: 'Antrenman Canavarı', desc: '100 antrenman yap.', icon: 'dumbbell', sprite: 'disc_cones', goal: 100, value: (s) => c(s, 'trainings') },
  { id: 'tryout_perfect', cat: 'skill', tier: 'gold', title: 'Kusursuz Seçme', desc: 'Seçme kampını 9/9 hakla bitir.', icon: 'heartFill', goal: 9, value: (s) => s.career.tryout?.score || 0 },

  // ── Onur ──
  { id: 'champion', cat: 'honors', tier: 'gold', title: 'Şampiyon', desc: 'Bir lig şampiyonluğu kazan.', icon: 'trophy', sprite: 'cup_gold', goal: 1, value: (s) => awardCount(s, 'Şampiyon') },
  { id: 'dynasty', cat: 'honors', tier: 'platinum', title: 'Hanedan', desc: '3 lig şampiyonluğu kazan.', icon: 'crown', sprite: 'podium', goal: 3, value: (s) => awardCount(s, 'Şampiyon') },
  { id: 'golden_boot', cat: 'honors', tier: 'gold', title: 'Gol Kralı', desc: 'Ligin gol kralı ol.', icon: 'boot', sprite: 'golden_boot', goal: 1, value: (s) => awardCount(s, 'Gol Kralı') },
  { id: 'player_season', cat: 'honors', tier: 'gold', title: 'Sezonun Yıldızı', desc: 'Sezonun oyuncusu ödülünü kazan.', icon: 'star', sprite: 'golden_ball', goal: 1, value: (s) => awardCount(s, 'Sezonun Oyuncusu') },
  { id: 'young_star', cat: 'honors', tier: 'silver', title: 'Geleceğin Yıldızı', desc: 'Yılın genç oyuncusu seçil.', icon: 'medal', sprite: 'medal_gold', goal: 1, value: (s) => awardCount(s, 'Genç') },
  { id: 'youth_cap', cat: 'honors', tier: 'bronze', title: 'Genç Milli', desc: 'U-19 ya da U-21 milli takımında forma giy.', icon: 'flag', goal: 1, value: (s) => (s.national?.caps?.U19 || 0) + (s.national?.caps?.U21 || 0) },
  { id: 'cap', cat: 'honors', tier: 'silver', title: 'Ay-Yıldızlı Forma', desc: 'Milli takımda forma giy.', icon: 'flag', goal: 1, value: (s) => s.career.caps || 0 },
  { id: 'intl_trophy', cat: 'honors', tier: 'platinum', title: 'Ay-Yıldızlı Zafer', desc: 'Milli takımla büyük bir turnuva kazan.', icon: 'trophy', sprite: 'cup_gold', goal: 1, value: (s) => (s.national?.tournaments || []).filter((t) => t.result === 'champion').length },
  { id: 'ballon_top10', cat: 'honors', tier: 'gold', title: 'Dünyanın En İyileri', desc: 'Altın Top sıralamasında ilk 10\'a gir.', icon: 'star', sprite: 'golden_ball', goal: 1, value: (s) => ((s.ballon?.history || []).some((h) => h.rank <= 10) ? 1 : 0) },
  { id: 'ballon_win', cat: 'honors', tier: 'platinum', title: 'Altın Top', desc: 'Dünyanın en iyi oyuncusu seçil.', icon: 'crown', sprite: 'golden_ball', goal: 1, value: (s) => ((s.ballon?.history || []).some((h) => h.rank === 1) ? 1 : 0) },
  { id: 'caps50', cat: 'honors', tier: 'platinum', title: 'Milli Efsane', desc: 'Milli takımda 50 maça çık.', icon: 'flag', goal: 50, value: (s) => s.career.caps || 0 },

  // ── Yaşam ──
  { id: 'first_car', cat: 'life', tier: 'bronze', title: 'Direksiyon Başında', desc: 'İlk arabanı al.', icon: 'car', goal: 1, value: (s) => (ownsCat(s, 'vehicle') && (s.career.items || []).some((id) => ITEM_BY_ID[id]?.art !== 'bike') ? 1 : 0) },
  { id: 'homeowner', cat: 'life', tier: 'silver', title: 'Ev Sahibi', desc: 'Kendi evini satın al.', icon: 'home', goal: 1, value: (s) => (ownsCat(s, 'home', 'own') ? 1 : 0) },
  { id: 'millionaire', cat: 'life', tier: 'gold', title: 'Milyoner', desc: 'Kasanda €1.000.000 olsun.', icon: 'coin', goal: 1_000_000, value: (s) => Math.max(0, s.career.money) },
  { id: 'famous', cat: 'life', tier: 'silver', title: 'Ünlü', desc: 'Ünün 70 olsun.', icon: 'camera', sprite: 'tv_camera', goal: 70, value: (s) => Math.round(s.player.fame) },
  { id: 'fan_fav', cat: 'life', tier: 'gold', title: 'Tribünlerin Sevgilisi', desc: 'Taraftar ilişkin 95 olsun.', icon: 'heartFill', sprite: 'scarf_1', goal: 95, value: (s) => Math.round(s.player.rel.fans) },
  { id: 'second_act', cat: 'life', tier: 'bronze', title: 'İkinci Perde', desc: 'Emeklilikten sonra teknik direktör ya da yorumcu ol.', icon: 'clipboard', goal: 1, value: (s) => (s.after?.path === 'coach' || s.after?.path === 'pundit' || (s.after?.coach?.seasons?.length || s.after?.pundit?.seasons?.length) ? 1 : 0) },
  { id: 'coach_title', cat: 'honors', tier: 'gold', title: 'Kulübede Şampiyon', desc: 'Teknik direktör olarak lig şampiyonluğu kazan.', icon: 'clipboard', sprite: 'tactics_board', goal: 1, value: (s) => s.after?.coach?.titles || 0 },
  { id: 'pundit_star', cat: 'life', tier: 'silver', title: 'Yılın Yorumcusu', desc: 'TV yorumculuğunda yılın yorumcusu seçil.', icon: 'mic', sprite: 'tv_mic', goal: 1, value: (s) => (s.after?.awards || []).filter((x) => x.role === 'pundit').length },
  { id: 'mentored', cat: 'life', tier: 'bronze', title: 'Çırak', desc: 'Bir mentor seç.', icon: 'mentor', goal: 1, value: (s) => (s.mentor?.current || (s.mentor?.history || []).length ? 1 : 0) },
  { id: 'mentor_others', cat: 'life', tier: 'gold', title: 'Akıl Hocası', desc: 'Bir gence mentorluk yap.', icon: 'sprout', goal: 1, value: (s) => (s.mentor?.legacy?.mentees || []).length },
  { id: 'social10', cat: 'life', tier: 'bronze', title: 'Sosyal Kelebek', desc: 'Kafe, bar ya da ev partisinde 10 kez buluş.', icon: 'coffee', goal: 10, value: (s) => s.social?.outings || 0 },
  { id: 'in_love', cat: 'life', tier: 'silver', title: 'Kalbim Sende', desc: 'Bir sevgilin olsun.', icon: 'heartFill', goal: 1, value: (s) => (s.social?.partner ? 1 : 0) },
  { id: 'interior', cat: 'life', tier: 'gold', title: 'İç Mimar', desc: 'Evine 12 mobilya yerleştir.', icon: 'sofa', goal: 12, value: (s) => s.social?.home?.placed?.length || 0 },
  { id: 'tuner', cat: 'life', tier: 'silver', title: 'Modifiye Ustası', desc: 'Arabana 5 modifiye parçası taktır.', icon: 'wrench', goal: 5, value: (s) => s.garage?.installs || 0 },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Kayıtta başarım alanını hazırlar (eski kayıtlar için mevcut ölçülerden sayaç tahmini yapılmaz; sayaçlar sıfırdan başlar). */
export function ensureAchievements(state) {
  const a = state.achievements || (state.achievements = {});
  a.unlocked = a.unlocked || {};
  a.queue = a.queue || [];
  a.c = { bestGoals: 0, bestRating: 0, winStreak: 0, bestWinStreak: 0, curvedPasses: 0, tackles: 0, trainings: 0, ...(a.c || {}) };
  return a;
}

/** Bir başarımın ilerlemesi: {value, goal, pct, unlocked} */
export function progressOf(state, ach) {
  const A = ensureAchievements(state);
  const unlocked = !!A.unlocked[ach.id];
  let value = 0;
  try {
    value = Number(ach.value(state)) || 0;
  } catch {
    value = 0;
  }
  const v = unlocked ? Math.max(value, ach.goal) : Math.min(value, ach.goal);
  return { value: v, goal: ach.goal, pct: Math.max(0, Math.min(1, v / ach.goal)), unlocked };
}

/**
 * Kilitli başarımları kontrol eder; açılanları kaydeder, ödülünü verir, kuyruğa ekler.
 * @returns {Achievement[]} bu çağrıda açılanlar
 */
export function checkAchievements(state) {
  if (!state?.player || !state?.career) return [];
  const A = ensureAchievements(state);
  const fresh = [];
  for (const ach of ACHIEVEMENTS) {
    if (A.unlocked[ach.id]) continue;
    let v = 0;
    try {
      v = Number(ach.value(state)) || 0;
    } catch {
      continue;
    }
    if (v < ach.goal) continue;
    A.unlocked[ach.id] = { s: state.calendar?.season || 1, w: state.calendar?.week || 1 };
    const tier = TIERS[ach.tier];
    changeMorale(state.player, tier.morale);
    if (tier.fame) changeFame(state.player, tier.fame);
    A.queue.push(ach.id);
    fresh.push(ach);
  }
  return fresh;
}

/** Arayüz: gösterilmemiş açılışları alır ve kuyruğu boşaltır. */
export function drainAchievementQueue(state) {
  const A = ensureAchievements(state);
  const ids = A.queue.splice(0, A.queue.length);
  return ids.map((id) => ACHIEVEMENT_BY_ID[id]).filter(Boolean);
}

/** Maç kancası: maç içi sayaçlar (gol, not, seri, falsolu pas, müdahale). */
export function achievementsOnMatch(state, summary, match) {
  const A = ensureAchievements(state);
  const C = A.c;
  if (summary.played) {
    C.bestGoals = Math.max(C.bestGoals, summary.goals || 0);
    if (summary.rating) C.bestRating = Math.max(C.bestRating, summary.rating);
    C.winStreak = summary.result === 'W' ? C.winStreak + 1 : 0;
    C.bestWinStreak = Math.max(C.bestWinStreak, C.winStreak);
  }
  for (const m of match?.moments || []) {
    if (!m.done) continue;
    if (m.type === 'pass' && m.success && Math.abs(m.curve || 0) >= 0.25) C.curvedPasses++;
    if (m.type === 'tackle' && m.success) C.tackles++;
  }
  return checkAchievements(state);
}

/** Antrenman kancası. */
export function achievementsOnTraining(state) {
  ensureAchievements(state).c.trainings++;
  return checkAchievements(state);
}

/** Özet: açılan / toplam */
export function achievementSummary(state) {
  const A = ensureAchievements(state);
  const unlocked = ACHIEVEMENTS.filter((a) => A.unlocked[a.id]).length;
  return { unlocked, total: ACHIEVEMENTS.length };
}
