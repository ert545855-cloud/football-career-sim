// @ts-check
// CHIRP — oyun içi sosyal medya. Oyun akışı (game.js) sadece bu dosyadaki fonksiyonları çağırır.
import { ChirpTriggerEngine } from './triggers.js';
import { PlayerPostService } from './posts.js';
import { RelationshipService } from './relationships.js';
import { Timeline, ensureChirp } from './timeline.js';
import { FeedEngine } from './feed.js';
import { followersOnMatch, followersOnWeek } from './followers.js';

export { ensureChirp, Timeline } from './timeline.js';
export { TweetModel, AuthorModel, CommentModel, JOURNALISTS, FABRICIO, YAGIZ, MAGAZIN, playerAuthor } from './models.js';
export { POST_STYLES, PlayerPostService } from './posts.js';
export { RELATIONS, RELATION_DEFAULTS, RelationshipService } from './relationships.js';
export { ChirpTriggerEngine, TEMPLATES, FORM_DIP_RULE } from './triggers.js';
export { analyzeSentiment, moodOf } from './sentiment.js';
export { FeedEngine, marketValue, moneyShort } from './feed.js';
export { PERSONAS } from './personas.js';
export { FOLLOWER_MILESTONES, VERIFIED_AT, followerTarget, followersOnMatch, followersOnWeek, isVerified, milestoneLabel, popularityOf, riseFactors, riseScore } from './followers.js';
export { GALLERY_CAP, SNAPS_PER_MATCH, addFrame, deleteFrame, frameById, frameLabel, framesOfMatch, galleryOf, lifestyleOptions, photoStore, picLikeMult } from './photos.js';
export { genitive, dative, accusative, fillTemplate } from './turkish.js';

/** Maç bitti: paylaşım kartını hazırla, gazeteci tweetlerini tetikle. */
export function chirpOnMatch(state, ctx) {
  ensureChirp(state);
  // maçtaki performans takipçi getirir (gol, asist, yüksek not; büyük maçta daha çok)
  ctx.summary.followers = followersOnMatch(state, ctx.summary, ctx.match);
  new PlayerPostService(state).createPending(ctx.summary, ctx.match);
  const tweets = new ChirpTriggerEngine(state).onMatchFinished(ctx);
  // Haber akışı: kulübün maç sonucu kartı, taraftar tepkisi, yorumcular
  tweets.push(...new FeedEngine(state).afterMatch(ctx.summary, ctx.match));
  return tweets;
}

/** Yeni hafta: maç önü kartı, sakatlık açıklamaları, dünya futbolu, capsler, trendler */
export const chirpWeekStart = (state) => new FeedEngine(state).weekStart();
export const chirpOnEurope = (state, europe) => new FeedEngine(state).europe(europe?.cups, europe?.my);
export const chirpWelcome = (state, offer) => new FeedEngine(state).welcome(offer);
export const chirpNationalSquad = (state, call) => new FeedEngine(state).nationalSquad(call);
export const chirpFeedSeasonEnd = (state, report) => new FeedEngine(state).seasonEnd(report);
/** Sanal piyasa: olaylar, rejim değişimi, takım arkadaşı dedikodusu, taraftar tokeni */
export const chirpOnMarket = (state, inv) => (inv ? new FeedEngine(state).market(inv) : []);

export const chirpOnOffers = (state, offers) => new ChirpTriggerEngine(state).onOffers(offers);
export const chirpOnTransfer = (state, offer, fromClubId) => new ChirpTriggerEngine(state).onTransferComplete(offer, fromClubId);
export const chirpOnInjury = (state, weeks) => new ChirpTriggerEngine(state).onInjury(weeks);
/** Hafta sonu: disiplin kararı + takipçilerin kariyer yükselişine göre güncellenmesi */
export function chirpOnWeekEnd(state) {
  const out = new ChirpTriggerEngine(state).onWeekEnd();
  out.followers = followersOnWeek(state);
  return out;
}
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
