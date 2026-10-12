// @ts-check
// ZAMAN TÜNELİ — tweetleri kayıt dosyasında (state.chirp) saklar, okunmamış sayısını tutar.
import { TweetModel } from './models.js';

export const TIMELINE_CAP = 80;

/** Chirp verisini kayıtta hazırlar (eski kayıtlarda yoksa oluşturur). */
export function ensureChirp(state) {
  state.chirp = {
    timeline: [],
    seq: 0,
    unread: 0,
    followers: 150,
    pendingPost: null,
    recent: [],
    cooldowns: {},
    discipline: null,
    ...(state.chirp || {}),
  };
  return state.chirp;
}

/** Sezon/hafta → tek sayı (bekleme süreleri için). */
export const weekIndex = (state) => (state.calendar.season - 1) * 100 + state.calendar.week;

export class Timeline {
  constructor(state) {
    this.state = state;
    this.data = ensureChirp(state);
  }

  nextId() {
    this.data.seq += 1;
    return `t${this.data.seq}`;
  }

  /** @param {TweetModel} tweet */
  publish(tweet) {
    this.data.timeline.unshift(tweet.toJSON());
    if (this.data.timeline.length > TIMELINE_CAP) this.data.timeline.length = TIMELINE_CAP;
    this.data.unread += 1;
    return tweet;
  }

  /** @returns {TweetModel[]} */
  list(filter = null) {
    const all = this.data.timeline.map((t) => TweetModel.from(t));
    return filter ? all.filter(filter) : all;
  }

  markRead() {
    this.data.unread = 0;
  }

  /** Beğeni aç/kapa. @returns {{liked:boolean, likes:number}|null} */
  toggleLike(id) {
    const t = this.data.timeline.find((x) => x.id === id);
    if (!t) return null;
    t.liked = !t.liked;
    t.likes += t.liked ? 1 : -1;
    return { liked: t.liked, likes: t.likes };
  }
}
