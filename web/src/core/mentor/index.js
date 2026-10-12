// @ts-check
// Mentorluk sisteminin oyun akışına bağlandığı ince katman (game.js, match.js, storage.js buradan çağırır).
import { MentorManager, ensureMentorState } from './MentorManager.js';
import { NO_BONUS } from './models.js';
import { bigMatchFor, nervesFor } from './bigMatch.js';

export * from './models.js';
export * from './bigMatch.js';
export { MentorManager, ensureMentorState } from './MentorManager.js';
export { DialoguePool, DIALOGUE_POOLS, EXAMPLE_BIG_MATCH, EXAMPLE_FAME } from './dialogues.js';
export { generateSquad, advanceSquad, assignRoles } from './squad.js';

/** Yeni oyun / eski kayıt: alanları tamamlar, kadroyu üretir, bonusu eşitler. */
export function ensureMentor(state) {
  ensureMentorState(state);
  const mm = new MentorManager(state);
  mm.ensureSquad();
  mm.sync();
  return state;
}

/** Oyuncunun aktif mentor bonusu (etkisiz değerler 1). */
export function mentorBonus(state) {
  return { ...NO_BONUS, ...(state.player.mentorBonus || {}) };
}

/** Kulüp nüfuzu kazanımı (Lider mentor ×1.2). */
export function gainInfluence(state, amount, opts) {
  return new MentorManager(state).gainInfluence(amount, opts);
}

/** Maç sonu nüfuz: oynadıkça ve iyi oynadıkça kulüpte sözün geçer. */
export function mentorOnMatch(state, summary) {
  if (!summary.played) return 0;
  let amount = summary.role === 'starter' ? 0.8 : 0.4;
  if (summary.rating >= 7.5) amount += 0.5;
  if (summary.motm) amount += 0.3;
  return gainInfluence(state, amount);
}

/** Haftalık aksiyonların nüfuz etkisi */
export function mentorOnAction(state, id) {
  if (id === 'team') return gainInfluence(state, 1.2);
  if (id === 'manager') return gainInfluence(state, 0.4);
  return 0;
}

export const mentorOnWeekEnd = (state) => new MentorManager(state).onWeekEnd();
export const mentorOnSeasonEnd = (state) => new MentorManager(state).onSeasonEnd();
export const mentorOnSeasonStart = (state) => new MentorManager(state).onSeasonStart();
export const mentorOnTransfer = (state, fromClubId) => new MentorManager(state).onTransfer(fromClubId);

/**
 * Maç planı için büyük maç bilgisi + heyecan ayarları.
 * @returns {null | (import('./bigMatch.js').BigMatch & ReturnType<typeof nervesFor> & {cool:boolean})}
 */
export function bigMatchSetup(state, m) {
  const big = bigMatchFor(state, m);
  if (!big) return null;
  const bonus = mentorBonus(state);
  return { ...big, ...nervesFor(big, state.career.totals, bonus), cool: bonus.nervesMult < 1 };
}
