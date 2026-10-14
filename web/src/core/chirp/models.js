// @ts-check
// CHIRP VERİ MODELLERİ — Yazar (gazeteci / taraftar botu / oyuncu), Tweet ve Yorum.
// Kayıt JSON olduğu için modeller düz nesneye çevrilip (toJSON) zaman tünelinde saklanır.

/** @typedef {'journalist'|'bot_user'|'player'} AuthorKind */
/** @typedef {'positive'|'negative'|'neutral'} SentimentLabel */
/**
 * @typedef {'form_dip'|'transfer_offer'|'transfer_done'|'renewal'|'great_game'|'injury'|'discipline'
 *   |'award'|'bench'|'board'|'player_post'|'ballon'|'gossip'|'scandal'} TweetTopic
 */

/** Metindeki #etiketler (Türkçe harfler dahil) */
export function extractTags(text) {
  // En az bir harf içermeli; "&#39;" gibi HTML varlıkları etiket sayılmaz
  const out = [];
  const re = /(^|[^&\p{L}\p{N}_])(#[\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu;
  let m;
  while ((m = re.exec(String(text || '')))) out.push(m[2]);
  return [...new Set(out)];
}

export class AuthorModel {
  /**
   * @param {{id:string, displayName:string, handle:string, kind:AuthorKind, signature?:string, bio?:string,
   *   followers?:number, avatar?:{color:string, initials?:string, look?:object}, parody?:boolean, beats?:TweetTopic[]}} p
   */
  constructor(p) {
    this.id = p.id;
    this.displayName = p.displayName;
    this.handle = p.handle;
    this.kind = p.kind;
    /** Gazetecinin imza etiketi; her tweet bununla başlar. */
    this.signature = p.signature || '';
    this.bio = p.bio || '';
    this.followers = p.followers ?? 0;
    this.avatar = p.avatar || { color: '#475569' };
    this.parody = !!p.parody;
    /** Hangi konuları haberleştirir */
    this.beats = p.beats || [];
  }

  /** İmza etiketini metnin başına ekler (zaten varsa tekrar eklemez). */
  sign(text) {
    if (!this.signature || text.startsWith(this.signature)) return text;
    return `${this.signature} ${text}`;
  }

  toJSON() {
    return { id: this.id, displayName: this.displayName, handle: this.handle, kind: this.kind, signature: this.signature, avatar: this.avatar, parody: this.parody };
  }
}

export class CommentModel {
  /**
   * @param {{id:string, author:{displayName:string, handle:string, avatar:{color:string, initials:string}}, text:string,
   *   sentiment:{label:SentimentLabel, score:number}, likes?:number}} p
   */
  constructor(p) {
    this.id = p.id;
    this.author = p.author;
    this.text = p.text;
    this.sentiment = p.sentiment;
    this.likes = p.likes ?? 0;
    /** Oyuncunun kendi yanıtı */
    this.me = !!p.me;
  }

  toJSON() {
    return { id: this.id, author: this.author, text: this.text, sentiment: this.sentiment, likes: this.likes, ...(this.me ? { me: true } : {}) };
  }
}

export class TweetModel {
  /**
   * @param {{id:string, authorId:string, text:string, topic:TweetTopic, season:number, week:number,
   *   comments?:CommentModel[]|object[], likes?:number, retweets?:number, liked?:boolean, meta?:object}} p
   */
  constructor(p) {
    this.id = p.id;
    this.authorId = p.authorId;
    this.text = p.text;
    this.topic = p.topic;
    this.season = p.season;
    this.week = p.week;
    this.comments = (p.comments || []).map((c) => (c instanceof CommentModel ? c : new CommentModel(/** @type any */ (c))));
    this.likes = p.likes ?? 0;
    this.retweets = p.retweets ?? 0;
    this.liked = !!p.liked;
    this.meta = p.meta || {};
    /** Dinamik yazarlar (kulüp, taraftar grubu, rastgele kullanıcı): tweet içinde anlık görüntü */
    this.author = p.author || null;
    /** Görselli kart (maç önü, sonuç, transfer, sakatlık, kadro, kupa…) */
    this.card = p.card || null;
    /** Hashtag'ler (trend ve keşfet için) */
    this.tags = p.tags || extractTags(p.text);
    this.reposted = !!p.reposted;
  }

  /** Yorumların olumlu payı (0–1). */
  get fanMood() {
    if (!this.comments.length) return 0.5;
    return this.comments.filter((c) => c.sentiment.label === 'positive').length / this.comments.length;
  }

  toJSON() {
    return {
      id: this.id, authorId: this.authorId, text: this.text, topic: this.topic, season: this.season, week: this.week,
      comments: this.comments.map((c) => c.toJSON()), likes: this.likes, retweets: this.retweets, liked: this.liked, meta: this.meta,
      ...(this.author ? { author: this.author } : {}),
      ...(this.card ? { card: this.card } : {}),
      ...(this.tags?.length ? { tags: this.tags } : {}),
      ...(this.reposted ? { reposted: true } : {}),
    };
  }

  static from(obj) {
    return new TweetModel(obj);
  }
}

// ─────────────────────────────────────────────────────────────
// SABİT YAZARLAR (parodi gazeteciler)
// ─────────────────────────────────────────────────────────────

export const FABRICIO = new AuthorModel({
  id: 'fabricio',
  displayName: 'Fabricio Romana',
  handle: '@FabricioRomana_',
  kind: 'journalist',
  signature: "It's a deal!",
  bio: 'Transfer haberleri ve büyük dedikodular. (Parodi hesap)',
  followers: 2_400_000,
  parody: true,
  beats: ['transfer_offer', 'transfer_done', 'great_game'],
  avatar: { color: '#0f766e', look: { skin: 1, hair: 'short', hairColor: 0 }, kit: ['#111827', '#e2e8f0'] },
});

export const YAGIZ = new AuthorModel({
  id: 'yagiz',
  displayName: 'Yağız Sapanca',
  handle: '@YagizSapanca_',
  kind: 'journalist',
  signature: 'Flaş Gelişme:',
  bio: 'Yerel lig, sakatlıklar, kulis. (Parodi hesap)',
  followers: 640_000,
  parody: true,
  beats: ['form_dip', 'injury', 'discipline', 'bench', 'board', 'award', 'renewal'],
  avatar: { color: '#b91c1c', look: { skin: 2, hair: 'buzz', hairColor: 1 }, kit: ['#7c2d12', '#fde68a'] },
});

export const MAGAZIN = new AuthorModel({
  id: 'magazin',
  displayName: 'Flaş Magazin',
  handle: '@FlasMagazinTV',
  kind: 'journalist',
  signature: 'ÖZEL:',
  bio: 'Ünlülerin gece hayatı, aşkları, ayrılıkları. Objektifimizden kaçamazsınız. (Parodi hesap)',
  followers: 1_800_000,
  parody: true,
  beats: ['gossip', 'scandal'],
  avatar: { color: '#db2777', look: { skin: 0, hair: 'long', hairColor: 3, fem: true }, kit: ['#be185d', '#fbcfe8'] },
});

export const JOURNALISTS = { fabricio: FABRICIO, yagiz: YAGIZ, magazin: MAGAZIN };

/** Oyuncunun kendi hesabı (durumdan üretilir). */
export function playerAuthor(state) {
  const p = state.player;
  const handle = `@${p.name.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '')}${p.number}`;
  return new AuthorModel({
    id: 'me',
    displayName: p.name,
    handle,
    kind: 'player',
    followers: state.chirp?.followers ?? 0,
    avatar: { color: '#c6ff3d', look: p.avatar },
  });
}

// ─────────────────────────────────────────────────────────────
// TARAFTAR BOTLARI (bot_user)
// ─────────────────────────────────────────────────────────────

const BOT_NAMES = [
  ['Tribün Sesi', 'tribun_sesi'], ['Ofsayt Bayrağı', 'ofsayt_bayragi'], ['Kale Arkası', 'kale_arkasi'], ['Taktik Defteri', 'taktik_defteri'],
  ['Eski Futbolcu Hasan', 'eski10numara'], ['Analizci Mert', 'mert_analiz'], ['Penaltı Noktası', 'penalti_noktasi'],
  ['Korner Bayrağı', 'kornerden_gol'], ['Futbolsever Ayşe', 'aysefutbol'], ['Maraton Tribünü', 'maraton_tribun'],
  ['Kırmızı Kart', 'direkt_kirmizi'], ['Forvet Avcısı', 'golcu_avcisi'], ['Gol Makinesi', 'gol_makinesi35'],
  ['Saha İçi', 'sahaici_yorum'], ['Uzatma Dakikaları', 'uzatma_90'], ['Yan Hakem', 'yanhakem_bayrak'],
];
const BOT_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#f43f5e', '#22c55e', '#eab308', '#14b8a6', '#ec4899'];

/**
 * Rastgele taraftar botu. clubShort verilirse bazen kulübe özel bir hesap üretir.
 * @param {() => number} rnd
 * @param {string} [clubShort]
 */
export function makeBotUser(rnd, clubShort) {
  if (clubShort && rnd() < 0.3) {
    const s = clubShort.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
    return { displayName: `${clubShort} Tribünü`, handle: `@${s}_tribun`, avatar: { color: BOT_COLORS[Math.floor(rnd() * BOT_COLORS.length)], initials: clubShort.slice(0, 2) } };
  }
  const [name, handle] = BOT_NAMES[Math.floor(rnd() * BOT_NAMES.length)];
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  return { displayName: name, handle: `@${handle}`, avatar: { color: BOT_COLORS[Math.floor(rnd() * BOT_COLORS.length)], initials } };
}
