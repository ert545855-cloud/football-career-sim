// @ts-check
// OYUNCU PAYLAŞIMI — maç sonu "Chirp'te Paylaş": 3 üslup, her biri ilişkileri farklı etkiler.
import { questsOn } from '../quests.js';
import { CLUB_BY_ID } from '../data.js';
import { CommentModel, TweetModel, extractTags, playerAuthor } from './models.js';
import { analyzeSentiment } from './sentiment.js';
import { MentorManager } from '../mentor/index.js';
import { CommentGenerator } from './comments.js';
import { RelationshipService } from './relationships.js';
import { Timeline, weekIndex } from './timeline.js';

/** @typedef {'modest'|'ego'|'aggressive'} PostStyleId */

/**
 * Üsluplar. Mütevazı metin sonuca göre uyarlanır (galibiyet metni şartnamedeki metindir).
 * @type {Record<PostStyleId, {id:PostStyleId, label:string, icon:string, text:{W:string,D:string,L:string}|string,
 *   effects:import('./relationships.js').RelationDelta, context:'player_modest'|'player_ego'|'player_aggressive', risk?:boolean, tone:string}>}
 */
export const POST_STYLES = {
  modest: {
    id: 'modest',
    label: 'Mütevazı',
    icon: 'heart',
    tone: 'good',
    text: {
      W: 'Takım olarak harika bir galibiyet aldık, tüm taraftarlarımıza destekleri için teşekkürler!',
      D: 'Zor bir maçtı, takım olarak mücadele ettik. Tüm taraftarlarımıza destekleri için teşekkürler!',
      L: 'Bugün istediğimiz olmadı ama takım olarak daha güçlü döneceğiz. Tüm taraftarlarımıza destekleri için teşekkürler!',
    },
    effects: { coach: 5, fans: 5, team: 2 },
    context: 'player_modest',
  },
  ego: {
    id: 'ego',
    label: 'Egoist',
    icon: 'star',
    tone: 'warn',
    text: 'Ben bu ligin en iyisiyim, beni izlemeye ve eleştirmeye devam edin.',
    effects: { sponsor: 10, team: -5, coach: -3 },
    context: 'player_ego',
  },
  aggressive: {
    id: 'aggressive',
    label: 'Agresif',
    icon: 'megaphone',
    tone: 'bad',
    text: 'Bugün sahada futbol değil başka şeyler oynandı. Hakem kararları tam bir rezaletti!',
    effects: { federation: -15, fans: 10, board: -5 },
    context: 'player_aggressive',
    risk: true,
  },
};

export class PlayerPostService {
  /** @param {any} state @param {() => number} [rnd] */
  constructor(state, rnd = Math.random) {
    this.state = state;
    this.rnd = rnd;
    this.timeline = new Timeline(state);
    this.rel = new RelationshipService(state);
    this.comments = new CommentGenerator(rnd);
  }

  /** Maç bitince çağrılır: ana ekrana "Chirp'te Paylaş" kartı düşer. */
  createPending(summary, match) {
    this.timeline.data.pendingPost = {
      matchId: match.id,
      result: summary.result,
      scoreLine: summary.scoreLine,
      played: summary.played,
      rating: summary.rating,
      opp: CLUB_BY_ID[match.oppId]?.name || '',
    };
    return this.timeline.data.pendingPost;
  }

  get pending() {
    return this.timeline.data.pendingPost;
  }

  /** @param {PostStyleId} styleId */
  textFor(styleId) {
    const st = POST_STYLES[styleId];
    if (typeof st.text === 'string') return st.text;
    return st.text[this.pending?.result || 'W'];
  }

  /** Kartta gösterilecek seçenekler. */
  options() {
    return Object.values(POST_STYLES).map((st) => ({
      id: st.id,
      label: st.label,
      icon: st.icon,
      tone: st.tone,
      text: this.textFor(st.id),
      effects: st.effects,
      risk: !!st.risk,
    }));
  }

  /**
   * Paylaşımı yapar: ilişkileri değiştirir, tweeti ve taraftar yorumlarını zaman tüneline ekler.
   * @param {PostStyleId} styleId
   */
  publish(styleId) {
    const st = POST_STYLES[styleId];
    if (!st || !this.pending) return null;
    const { player, calendar, career } = this.state;
    const club = CLUB_BY_ID[career.clubId];
    const changes = this.rel.apply(st.effects);

    const id = this.timeline.nextId();
    const followers = this.timeline.data.followers;
    const likes = Math.round((20 + followers * (0.02 + this.rnd() * 0.04)) * (styleId === 'aggressive' ? 1.8 : styleId === 'ego' ? 1.4 : 1));
    const tweet = new TweetModel({
      id,
      authorId: 'me',
      text: this.textFor(styleId),
      topic: 'player_post',
      season: calendar.season,
      week: calendar.week,
      likes,
      retweets: Math.round(likes * (0.1 + this.rnd() * 0.15)),
      meta: { style: styleId, matchId: this.pending.matchId, scoreLine: this.pending.scoreLine },
      comments: this.comments.generate(st.context, {
        player: player.name.split(' ')[0],
        club: club.name,
        clubShort: club.short,
        fansRel: player.rel.fans,
        idPrefix: id,
      }),
    });
    this.timeline.publish(tweet);
    this.timeline.data.unread = Math.max(0, this.timeline.data.unread - 1); // kendi paylaşımın okunmamış sayılmaz

    // Taraftar tepkisi küçük bir moral etkisi yaratır
    const mood = tweet.fanMood;
    const moraleDelta = mood >= 0.5 ? 2 : -2;
    player.morale = Math.max(0, Math.min(100, player.morale + moraleDelta));
    changes.push({ key: /** @type any */ ('morale'), label: 'Moral', delta: moraleDelta });

    this.timeline.data.followers += Math.round(10 + player.fame * 3 + likes / 15);

    let discipline = null;
    if (st.risk) {
      discipline = { risk: this.rel.disciplineRisk(), postedAt: weekIndex(this.state) };
      this.timeline.data.discipline = discipline;
    }
    this.timeline.data.pendingPost = null;
    questsOn(this.state, 'chirp', {});
    return { tweet, changes, discipline, mood };
  }

  dismiss() {
    this.timeline.data.pendingPost = null;
  }

  /** Kadro arkadaşlarının isimleri */
  mates() {
    try {
      return new MentorManager(this.state).squad().map((p) => p.name);
    } catch {
      return [];
    }
  }

  /**
   * Serbest metni çözümler: üslup, kimden bahsediyor, ilişki etkileri.
   * @param {string} text
   */
  analyze(text) {
    const lower = text.toLocaleLowerCase('tr');
    const sent = analyzeSentiment(text);
    const mates = this.mates();
    const mate = mates.find((n) => n.split(' ').some((w) => w.length > 2 && lower.includes(w.toLocaleLowerCase('tr'))));
    const lineup = /(oynamal|ilk 11|ilk on bir|kadroda olmal|olmalı|oynasın|forma şansı)/.test(lower);
    const aggr = /(hakem|\bvar\b|federasyon|pfdk|şike|torpil|rezalet|skandal)/.test(lower) && sent.score <= 0;
    const thanks = /(taraftar|tribün|teşekkür|sağ ?olun|destek)/.test(lower) && sent.score >= 0;
    const ego = /\bben\b|benim/.test(lower) && /(en iyi|kral|yıldız|efsane|bir numara)/.test(lower);
    const funny = /(😂|🤣|haha|xd|kdkd)/i.test(text);
    const style = aggr ? 'aggr' : lineup ? 'lineup' : ego ? 'ego' : funny ? 'funny' : sent.score < 0 ? 'neg' : 'pos';
    return { sent, mate, mates, lineup, aggr, thanks, ego, funny, style };
  }

  /**
   * Oyuncunun kendi yazdığı gönderi (#etiket, @bahsetme, serbest metin).
   * @returns {{tweet:TweetModel, changes:Array, discipline:any, trending:string|null, spam:boolean}|null}
   */
  publishText(raw) {
    const text = String(raw || '').replace(/\s+\n/g, '\n').trim().slice(0, 280);
    if (!text) return null;
    const { player, calendar, career } = this.state;
    const data = this.timeline.data;
    const club = CLUB_BY_ID[career.clubId];
    const a = this.analyze(text);
    /** @type {any} */
    const fx = {};
    if (a.aggr) Object.assign(fx, { federation: -6, fans: 3 });
    if (a.lineup) Object.assign(fx, { team: (fx.team || 0) + 2, coach: -3 });
    if (a.thanks) Object.assign(fx, { fans: (fx.fans || 0) + 3, coach: 1 });
    if (a.ego) Object.assign(fx, { sponsor: 3, team: (fx.team || 0) - 2 });
    if (!Object.keys(fx).length && a.sent.score > 0) fx.fans = 1;
    // Haftada 4'ten fazla gönderi: takipçi kaybı (spam)
    const wk = weekIndex(this.state);
    if (data.postWeek?.key !== wk) data.postWeek = { key: wk, n: 0 };
    data.postWeek.n += 1;
    const spam = data.postWeek.n > 4;
    if (spam) fx.fans = (fx.fans || 0) - 1;
    const changes = Object.keys(fx).length ? this.rel.apply(fx) : [];

    const id = this.timeline.nextId();
    const followers = data.followers;
    const likes = Math.round((15 + followers * (0.015 + this.rnd() * 0.05)) * (a.aggr ? 1.8 : a.ego ? 1.3 : a.funny ? 1.5 : 1) * (spam ? 0.4 : 1));
    const ctx = { aggr: 'my_aggr', lineup: 'my_lineup', ego: 'my_ego', funny: 'my_funny', neg: 'my_neg', pos: 'my_pos' }[a.style];
    const tweet = new TweetModel({
      id,
      authorId: 'me',
      text,
      topic: 'player_post',
      season: calendar.season,
      week: calendar.week,
      likes,
      retweets: Math.round(likes * (0.08 + this.rnd() * 0.15)),
      meta: { free: true, style: a.style },
      comments: this.comments.generateRich(ctx, {
        vars: { first: player.name.split(' ')[0], player: player.name, clubShort: club.short },
        fansRel: player.rel.fans, mates: a.mate ? [a.mate] : a.mates.slice(0, 2), foreign: Math.min(0.3, (player.fame || 0) / 220),
        idPrefix: id, clubShort: club.short, lineup: a.lineup ? 0.25 : 0.08,
      }),
    });
    this.timeline.publish(tweet);
    data.unread = Math.max(0, data.unread - 1);
    data.followers = Math.max(0, data.followers + (spam ? -40 : Math.round(5 + (player.fame || 0) * 2 + likes / 20)));

    let discipline = null;
    if (a.aggr) {
      discipline = { risk: this.rel.disciplineRisk() * 0.8, postedAt: wk };
      data.discipline = discipline;
    }
    // Trend: etiketli gönderi ünlü oyuncuda gündeme oturur
    let trending = null;
    const tags = extractTags(text);
    if (tags.length && (player.fame || 0) >= 20) {
      const p = Math.max(0.05, Math.min(0.9, ((player.fame || 0) - 15) / 70 + likes / 60000));
      if (this.rnd() < p) {
        trending = tags[0];
        data.myTags = data.myTags || {};
        data.myTags[trending] = (data.myTags[trending] || 0) + 15000 + Math.round((player.fame || 0) * 900);
        player.fame = Math.min(100, (player.fame || 0) + 0.3);
        const tr = data.trends || (data.trends = []);
        const ex = tr.find((t) => t.tag === trending);
        if (ex) ex.count = Math.max(ex.count, data.myTags[trending]);
        else tr.push({ tag: trending, count: data.myTags[trending], kind: 'mine' });
        tr.sort((x, y) => y.count - x.count);
      }
    }
    return { tweet, changes, discipline, trending, spam };
  }

  /**
   * Bir gönderiye yanıt (ör. "{arkadaşın} ilk 11'de olmalı").
   * @returns {{comment:any, changes:Array, reactions:any[]}|null}
   */
  reply(tweetId, raw) {
    const text = String(raw || '').trim().slice(0, 240);
    const data = this.timeline.data;
    const t = data.timeline.find((x) => x.id === tweetId);
    if (!text || !t) return null;
    const { player } = this.state;
    const a = this.analyze(text);
    /** @type {any} */
    const fx = {};
    if (a.aggr) fx.federation = -3;
    if (a.lineup) Object.assign(fx, { team: 1, coach: -2 });
    if (a.thanks) fx.fans = 2;
    if (a.ego) fx.team = (fx.team || 0) - 1;
    const changes = Object.keys(fx).length ? this.rel.apply(fx) : [];
    const me = playerAuthor(this.state);
    const n = (t.comments || []).filter((c) => c.me).length;
    const mine = new CommentModel({
      id: `${tweetId}-me${n}`,
      author: { displayName: me.displayName, handle: me.handle, avatar: me.avatar },
      text,
      sentiment: { label: a.sent.label, score: a.sent.score },
      likes: Math.round(20 + data.followers * (0.01 + this.rnd() * 0.03)),
      me: true,
    });
    const reactions = this.comments.generateRich('me_reply', {
      vars: { handle: me.handle.replace(/^@/, '') }, fansRel: player.rel.fans, idPrefix: `${tweetId}-r${n}`, count: 1 + Math.floor(this.rnd() * 2),
    });
    t.comments = [mine.toJSON(), ...reactions.map((c) => c.toJSON()), ...(t.comments || [])];
    data.followers += Math.round(2 + (player.fame || 0) * 0.5);
    return { comment: mine, changes, reactions };
  }
}
