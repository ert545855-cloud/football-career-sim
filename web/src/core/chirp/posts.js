// @ts-check
// OYUNCU PAYLAŞIMI — maç sonu "Chirp'te Paylaş": 3 üslup, her biri ilişkileri farklı etkiler.
import { CLUB_BY_ID } from '../data.js';
import { TweetModel, playerAuthor } from './models.js';
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
    return { tweet, changes, discipline, mood };
  }

  dismiss() {
    this.timeline.data.pendingPost = null;
  }
}
