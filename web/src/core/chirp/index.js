// @ts-check
// CHIRP — oyun içi sosyal medya. Oyun akışı (game.js) sadece bu dosyadaki fonksiyonları çağırır.
import { ChirpTriggerEngine } from './triggers.js';
import { PlayerPostService } from './posts.js';
import { RelationshipService } from './relationships.js';
import { Timeline, ensureChirp } from './timeline.js';

export { ensureChirp, Timeline } from './timeline.js';
export { TweetModel, AuthorModel, CommentModel, JOURNALISTS, FABRICIO, YAGIZ, MAGAZIN, playerAuthor } from './models.js';
export { POST_STYLES, PlayerPostService } from './posts.js';
export { RELATIONS, RELATION_DEFAULTS, RelationshipService } from './relationships.js';
export { ChirpTriggerEngine, TEMPLATES, FORM_DIP_RULE } from './triggers.js';
export { analyzeSentiment, moodOf } from './sentiment.js';
export { genitive, dative, accusative, fillTemplate } from './turkish.js';

/** Maç bitti: paylaşım kartını hazırla, gazeteci tweetlerini tetikle. */
export function chirpOnMatch(state, ctx) {
  ensureChirp(state);
  new PlayerPostService(state).createPending(ctx.summary, ctx.match);
  return new ChirpTriggerEngine(state).onMatchFinished(ctx);
}

export const chirpOnOffers = (state, offers) => new ChirpTriggerEngine(state).onOffers(offers);
export const chirpOnTransfer = (state, offer, fromClubId) => new ChirpTriggerEngine(state).onTransferComplete(offer, fromClubId);
export const chirpOnInjury = (state, weeks) => new ChirpTriggerEngine(state).onInjury(weeks);
export const chirpOnWeekEnd = (state) => new ChirpTriggerEngine(state).onWeekEnd();
export const chirpOnSeasonEnd = (state, report) => new ChirpTriggerEngine(state).onSeasonEnd(report);

/** Eski kayıtları Chirp'e hazırlar (yeni ilişki alanları + zaman tüneli). */
export function migrateChirp(state) {
  ensureChirp(state);
  new RelationshipService(state).ensure();
  return state;
}

export const unreadCount = (state) => state.chirp?.unread || 0;
export const hasPendingPost = (state) => !!state.chirp?.pendingPost;
export const timelineOf = (state) => new Timeline(state);
