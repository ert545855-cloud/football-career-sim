// @ts-check
// ZAMAN TÜNELİ — tweetleri kayıt dosyasında (state.chirp) saklar, okunmamış sayısını tutar.
import { TweetModel } from './models.js';

export const TIMELINE_CAP = 160;

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
    trends: [],
    myTags: {},
    hype: 0,
    squadInjuries: [],
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

  /**
   * Yorum beğenisi aç/kapa. Ünlü bir oyuncunun beğenisi taraftarı çıldırtır: bazen yorumun sahibi sevinçle yanıt yazar.
   * @returns {{liked:boolean, likes:number, thanks?:object}|null}
   */
  toggleCommentLike(tweetId, commentId, rnd = Math.random) {
    const t = this.data.timeline.find((x) => x.id === tweetId);
    const c = t?.comments?.find((x) => x.id === commentId);
    if (!c) return null;
    c.liked = !c.liked;
    c.likes = Math.max(0, (c.likes || 0) + (c.liked ? 1 : -1));
    let thanks = null;
    if (c.liked && !c.me && !c.thanked && rnd() < 0.35) {
      c.thanked = true;
      const lines = ['BEĞENDİ!!! Ekran görüntüsü aldım 😭❤️', 'Yorumumu beğendi, bugün okula gitmiyorum 😂', 'Kral beğendi, çerçeveletip duvara asıyorum', 'Abi beğendin ya, ölsem gam yemem 🙏', 'Bunu torunlarıma anlatacağım'];
      thanks = { id: `${c.id}-t`, author: c.author, text: lines[Math.floor(rnd() * lines.length)], sentiment: { label: 'positive', score: 0.9 }, likes: Math.round(5 + rnd() * 60) };
      const i = t.comments.indexOf(c);
      t.comments.splice(i + 1, 0, thanks);
    }
    return { liked: c.liked, likes: c.likes, thanks };
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
