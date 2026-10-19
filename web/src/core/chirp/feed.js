// @ts-check
// CHIRP HABER AKIŞI — her hafta zaman tüneline sürekli içerik pompalar:
//   • Kulüp resmi hesabı: maç önü "Maça hazırız" kartı, maç sonucu, sakatlık açıklaması, transfer karşılama
//   • Taraftar grubu + Tribün Gardiyanı: kötü oyunda linç, iyi oyunda "150 milyon dolar" coşkusu
//   • Sermet Hoca (Bursa frikiği), Eski Hakem Rıza, Veri Futbol, Piyasa Değeri, Futbol Capsleri
//   • Dünya futbolu (büyük takımlar), Avrupa kupaları sonuçları, milli takım kadrosu, yapay transferler
//   • Trendler (#etiketler) — Keşfet sekmesi için
import { CLUBS, CLUB_BY_ID, COUNTRY_BY_ID, LEAGUES, MID_WINDOW_WEEK, POSITIONS } from '../data.js';
import { clubRating, fixtureFor, leagueOf, positionOf, sortedTable, weekResults } from '../league.js';
import { MentorManager } from '../mentor/index.js';
import { upcomingBigMatch } from '../mentor/bigMatch.js';
import { randomName } from '../world/names.js';
import { CUPS, STAGE_LABEL } from '../world/europe.js';
import { AuthorModel, FABRICIO, TweetModel, extractTags } from './models.js';
import { CommentGenerator } from './comments.js';
import { Timeline, weekIndex } from './timeline.js';
import { fillTemplate } from './turkish.js';
import {
  CAPS_LINES, CLUB_LINES, DEGER_LINES, DUNYA_LINES, EVERGREEN_TAGS, FAN_LINES, HAKEM_LINES, INJURY_PARTS, SERMET_LINES, USER_POSTS, VERI_LINES,
} from './content.js';
import {
  AVRUPA, CAPS, DEGER, DUNYA, FOOTY, GARDIYAN, HAKEM, MATTEO, MILLI, SERMET, TERTULIA, VERI, clubAuthor, fanAuthor, randomUser,
} from './personas.js';

const upper = (s) => String(s || '').toLocaleUpperCase('tr');
const tagOf = (s) => `#${String(s || '').replace(/[^\p{L}\p{N}]+/gu, '')}`;
const BIG5 = ['en1', 'es1', 'de1', 'it1', 'fr1'];

/** Piyasa değeri (€): güç, yaş, ün ve lig prestijine göre */
export function marketValue(state) {
  const p = state.player;
  const o = (POSITIONS[p.position] ? Object.entries(POSITIONS[p.position].ovr).reduce((n, [k, w]) => n + p.stats[k] * w, 0) : 50);
  const ageF = p.age <= 21 ? 1.5 : p.age <= 24 ? 1.3 : p.age <= 28 ? 1 : p.age <= 31 ? 0.65 : 0.35;
  const v = Math.exp((o - 40) / 9.5) * 25_000 * ageF * (1 + (p.fame || 0) / 80);
  return Math.max(50_000, Math.round(v / 50_000) * 50_000);
}
export function moneyShort(v, cur = '€') {
  if (v >= 1_000_000) return `${cur}${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace('.', ',')}M`;
  return `${cur}${Math.round(v / 1000)}K`;
}

export class FeedEngine {
  /** @param {any} state @param {() => number} [rnd] */
  constructor(state, rnd = Math.random) {
    this.state = state;
    this.rnd = rnd;
    this.tl = new Timeline(state);
    this.cg = new CommentGenerator(rnd);
  }

  get club() {
    return CLUB_BY_ID[this.state.career.clubId];
  }

  pick(arr) {
    return arr[Math.floor(this.rnd() * arr.length)];
  }

  chance(p) {
    return this.rnd() < p;
  }

  vars(extra = {}) {
    const p = this.state.player;
    const c = this.club;
    return {
      player: p.name, first: p.name.split(' ')[0], PLAYER: upper(p.name), club: c.name, clubShort: c.short, CLUB: upper(c.name),
      league: LEAGUES[leagueOf(c.id)]?.name || '', week: this.state.calendar.week, ...extra,
    };
  }

  /** Takım arkadaşlarının isimleri (yorumlarda "şu oynamalı") */
  mates(n = 4) {
    let squad = [];
    try {
      squad = new MentorManager(this.state).squad().map((x) => x.name);
    } catch {
      squad = [];
    }
    const out = [];
    const pool = squad.slice();
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(this.rnd() * pool.length), 1)[0]);
    return out;
  }

  /**
   * Gönderi yayımla.
   * @param {{author:any, text:string, topic:string, card?:any, meta?:any, ctx?:string, count?:number, lineup?:number, foreign?:number, vars?:object, likes?:[number,number], comments?:any[]}} o
   */
  publish(o) {
    const id = this.tl.nextId();
    const fixed = o.author instanceof AuthorModel;
    const text = fixed ? o.author.sign(fillTemplate(o.text, o.vars || this.vars())) : fillTemplate(o.text, o.vars || this.vars());
    const fame = this.state.player.fame || 0;
    const [lo, hi] = o.likes || [400, 4000];
    const likes = Math.round((lo + this.rnd() * (hi - lo)) * (1 + fame / 60));
    const comments = o.comments || (o.ctx ? this.cg.generateRich(o.ctx, {
      vars: o.vars || this.vars(), fansRel: this.state.player.rel.fans, mates: this.mates(), foreign: o.foreign ?? Math.min(0.35, fame / 220),
      idPrefix: id, clubShort: this.club.short, lineup: o.lineup, count: o.count,
    }) : []);
    const tweet = new TweetModel({
      id,
      authorId: o.author.id,
      author: fixed ? null : o.author,
      text,
      topic: /** @type any */ (o.topic),
      season: this.state.calendar.season,
      week: this.state.calendar.week,
      likes,
      retweets: Math.round(likes * (0.06 + this.rnd() * 0.12)),
      meta: o.meta || {},
      card: o.card || null,
      comments,
    });
    this.tl.publish(tweet);
    return tweet;
  }

  // ─────────────────────────── Hafta başı ───────────────────────────

  /** Yeni hafta: sakatlıklar, maç önü kartı, dünya futbolu, caps, yapay transferler, trendler */
  weekStart() {
    const s = this.state;
    if (s.calendar.phase !== 'week') return [];
    const out = [];
    // Takipçi sayısı ünle orantılı (ünlü oyuncunun on binlerce takipçisi olur)
    const fame = s.player.fame || 0;
    this.tl.data.followers = Math.max(this.tl.data.followers || 0, Math.round(150 + fame * fame * 40));
    out.push(...this.squadInjuries());
    const pre = this.preview();
    if (pre) out.push(pre);
    if (s.calendar.week === 1 || s.calendar.week === MID_WINDOW_WEEK + 1) out.push(...this.aiTransfers(s.calendar.week === 1 ? 3 : 2));
    out.push(...this.worldDigest());
    if (s.calendar.week > 1 && this.chance(0.55)) out.push(this.meme());
    if (this.chance(0.3)) out.push(this.publish({ author: SERMET, text: this.pick(SERMET_LINES.general), topic: 'pundit', ctx: 'sermet', likes: [3000, 12000] }));
    if (this.chance(0.5)) out.push(this.userPost());
    this.updateTrends();
    return out.filter(Boolean);
  }

  /** Sanal piyasa haberleri (Kripto Tribün parodi hesabı): olaylar, boğa/ayı, soyunma odası dedikodusu, taraftar tokeni */
  market(inv) {
    const out = [];
    const author = { id: 'u:@KriptoTribun', kind: 'user', displayName: 'Kripto Tribün (Parodi)', handle: '@KriptoTribun', avatar: { color: '#b45309', initials: '📈' } };
    const pct = (x) => `${x >= 0 ? '+' : '−'}%${Math.abs(Math.round((x || 0) * 100))}`;
    const LINES = {
      crash: ['📉 Kara hafta! Endeks {ENDX}, GolCoin {GOLC}. Soyunma odasında telefonlar kapalı. #Piyasa', '📉 Piyasalar çöktü: GolCoin {GOLC}. Futbolcular bugün antrenmanda ekrana bakmadı. #KaraHafta'],
      etf: ['🚀 GolCoin {GOLC}! Fon onayı geldi, tribünler bayram yapıyor. #GolCoin'],
      regul: ['⚠️ Kripto düzenlemesi kapıda: GolCoin {GOLC}. #Regülasyon'],
      listing: ['📈 PixelChain büyük borsada: {PXC}! Oyuncu kartı koleksiyoncuları sevinçten havalara uçtu. #PixelChain'],
      hack: ['🔓 PixelChain köprüsü hacklendi, fiyat {PXC}. Yatırımcılar şokta. #PixelChain'],
      pump: ['🐱🚀 Kale Kedisi bu hafta {KEDI}! Mahalle maçında bile kedi coin konuşuluyor. #KaleKedisi'],
      rug: ['🙀 Kale Kedisi geliştiricileri kayıp, fiyat {KEDI}. Tribün sessiz. #KaleKedisi', '🙀 "Kedi kaçtı": Kale Kedisi {KEDI}. Şakadan çıkan para şakayla gitti. #KaleKedisi'],
    };
    const MATE = {
      pump: ['Duyumlarımıza göre {club} oyuncusu {mate} Kale Kedisi\'nden köşeyi döndü 😎 Soyunma odasında baklava dağıtmış.'],
      rug: ['{club}\'de {mate}\'in Kale Kedisi\'nde ciddi para kaybettiği konuşuluyor. Antrenmanda pek konuşmamış 😶'],
      etf: ['{club} soyunma odasında {mate} herkese GolCoin anlatıyormuş. Hoca telefonları topladı 📵'],
      crash: ['{club} kaptanı {mate}: "Kardeşler, maaşın hepsini kriptoya koymayın." 🧓'],
    };
    for (const ev of inv.events || []) {
      const vars = Object.fromEntries(Object.entries(inv.chg || {}).map(([k, x]) => [k, pct(x)]));
      const line = LINES[ev.id];
      if (!line) continue;
      out.push(this.publish({ author, text: this.pick(line).replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? ''), topic: 'user', vars: this.vars(), ctx: 'user', count: 2, likes: [800, 9000] }));
      const mate = this.mates(3)[0];
      if (MATE[ev.id] && mate && this.chance(0.35)) {
        out.push(this.publish({ author, text: this.pick(MATE[ev.id]).replace('{club}', this.club.short).replace('{mate}', mate), topic: 'user', vars: this.vars(), ctx: 'user', count: 2, likes: [400, 5000] }));
      }
    }
    if (inv.regimeChanged === 'bull') out.push(this.publish({ author, text: '🐂 Boğa sezonu açıldı! Kripto piyasası yeşile boyandı. Unutmayın: yükselen her şey bir gün iner. #BoğaSezonu', topic: 'user', vars: this.vars(), ctx: 'user', count: 2, likes: [600, 7000] }));
    if (inv.regimeChanged === 'bear') out.push(this.publish({ author, text: '🐻 Ayı piyasası geldi. Kripto kırmızı, yatırımcılar temkinli. #AyıPiyasası', topic: 'user', vars: this.vars(), ctx: 'user', count: 2, likes: [600, 7000] }));
    if (inv.fanLaunch) {
      out.push(this.publish({ author, text: `🪙 {player} adına taraftar tokeni piyasada! Fiyatı sahadaki performansına bağlı. Taraftarlar ilk gün kapıştı. #{first}Token`, topic: 'user', vars: this.vars(), ctx: 'user', count: 3, likes: [1500, 12000] }));
    } else if (Math.abs(inv.chg?.FAN || 0) >= 0.18) {
      const up = inv.chg.FAN > 0;
      out.push(this.publish({ author, text: `${up ? '📈' : '📉'} {first} Token bu hafta ${pct(inv.chg.FAN)}! ${up ? 'Sahada ne görüyorsak tokende de onu görüyoruz.' : 'Taraftar tokeni de formla birlikte düştü.'} #{first}Token`, topic: 'user', vars: this.vars(), ctx: 'user', count: 2, likes: [700, 8000] }));
    }
    return out;
  }

  /** Kadrodaki sakatlıklar: iyileşenler çıkar, bazen yeni sakatlık + resmi açıklama */
  squadInjuries() {
    const data = this.tl.data;
    data.squadInjuries = (data.squadInjuries || []).map((x) => ({ ...x, weeks: x.weeks - 1 })).filter((x) => x.weeks > 0 && x.clubId === this.club.id);
    if (!this.chance(0.22)) return [];
    const taken = new Set(data.squadInjuries.map((x) => x.name));
    const name = this.mates(8).find((n) => !taken.has(n));
    if (!name) return [];
    const weeks = 1 + Math.floor(this.rnd() * 6);
    const part = this.pick(INJURY_PARTS);
    data.squadInjuries.push({ name, weeks, part, clubId: this.club.id });
    const vars = this.vars({ name, first: name.split(' ')[0], part, weeks });
    return [this.publish({
      author: clubAuthor(this.club.id), text: this.pick(CLUB_LINES.injury), topic: 'club', vars, ctx: 'injury', count: 3,
      card: { kind: 'injury', clubId: this.club.id, name, part, weeks },
    })];
  }

  /** Maç önü: "Maça hazırız, eksiğimiz yok" görselli kart */
  preview() {
    const s = this.state;
    const fx = fixtureFor(s.world, this.club.id, s.calendar.week);
    if (!fx) return null;
    const [h, a] = fx;
    const opp = CLUB_BY_ID[h === this.club.id ? a : h];
    const missing = (this.tl.data.squadInjuries || []).filter((x) => x.clubId === this.club.id).map((x) => x.name);
    if ((s.flags.injuredWeeks || 0) > 0 || (s.flags.suspendedWeeks || 0) > 0) missing.unshift(s.player.name);
    let big = null;
    try {
      big = upcomingBigMatch(s);
    } catch {
      big = null;
    }
    const vars = this.vars({ opp: opp.name, missing: missing.join(', '), title: big?.title || '' });
    const text = big?.kind === 'derby' ? this.pick(CLUB_LINES.derby) : missing.length ? this.pick(CLUB_LINES.missing) : this.pick(CLUB_LINES.ready);
    return this.publish({
      author: clubAuthor(this.club.id), text: `${text} ${tagOf(`${this.club.short}vs${opp.short}`)}`, topic: 'club', vars, ctx: 'preview', lineup: 0.35,
      card: { kind: 'preview', home: h, away: a, week: s.calendar.week, league: leagueOf(this.club.id), missing, ready: missing.length === 0 },
      likes: [800, 6000],
    });
  }

  /** Dünya futbolu: büyük liglerden lider/kriz/skor + puan durumu kartı */
  worldDigest() {
    const s = this.state;
    const w = s.world;
    const out = [];
    const myCountry = LEAGUES[leagueOf(this.club.id)]?.country;
    const others = Object.values(LEAGUES).filter((l) => l.tier === 1 && !l.youth && !BIG5.includes(l.id) && l.country !== myCountry).map((l) => l.id);
    const picks = [this.pick(BIG5), this.pick(others)];
    const lastWeek = s.calendar.week - 1;
    for (const lid of picks) {
      const lg = w.leagues[lid];
      if (!lg || lastWeek < 1) continue;
      const meta = LEAGUES[lid];
      const flag = COUNTRY_BY_ID[meta.country]?.flag || '';
      const table = sortedTable(lg);
      const leader = CLUB_BY_ID[table[0].id];
      const second = CLUB_BY_ID[table[1].id];
      // Kriz: güçlü ama alt yarıda olan kulüp
      const crisisRow = table.slice(6).sort((x, y) => clubRating(w, y.id) - clubRating(w, x.id))[0];
      const crisis = CLUB_BY_ID[crisisRow.id];
      const res = weekResults(w, lid, lastWeek);
      const bigScore = res.slice().sort((x, y) => y.hg + y.ag - (x.hg + x.ag))[0];
      let text;
      let vars;
      if (bigScore && bigScore.hg + bigScore.ag >= 5 && this.chance(0.6)) {
        text = this.pick(DUNYA_LINES.bigScore);
        vars = { flag, league: meta.name, home: CLUB_BY_ID[bigScore.h].name, away: CLUB_BY_ID[bigScore.a].name, hg: bigScore.hg, ag: bigScore.ag };
      } else if (crisisRow && crisisRow.last.filter((x) => x === 'M').length >= 3 && this.chance(0.5)) {
        text = this.pick(DUNYA_LINES.crisis);
        vars = { flag, league: meta.name, club: crisis.name, n: crisisRow.last.filter((x) => x !== 'G').length };
      } else {
        text = this.pick(DUNYA_LINES.leader);
        vars = { flag, league: meta.name, leader: leader.name, pts: table[0].pts, crisis: crisis.name, second: second.name, gap: table[0].pts - table[1].pts };
      }
      out.push(this.publish({
        author: DUNYA, text: `${text} ${tagOf(meta.name)}`, topic: 'world', vars: { ...this.vars(), ...vars }, ctx: 'dunya', count: 3, foreign: 0.2,
        card: { kind: 'table', league: lid, rows: table.slice(0, 5).map((r) => ({ id: r.id, pts: r.pts, p: r.p })), results: res.slice(0, 3) },
        likes: [1500, 9000],
      }));
    }
    return out;
  }

  meme() {
    const s = this.state;
    const res = weekResults(s.world, leagueOf(this.club.id), s.calendar.week - 1);
    const m = res.length ? this.pick(res) : null;
    const loser = m ? CLUB_BY_ID[m.hg < m.ag ? m.h : m.a].name : this.club.name;
    const winner = m ? CLUB_BY_ID[m.hg < m.ag ? m.a : m.h].name : 'Rakip';
    return this.publish({ author: CAPS, text: this.pick(CAPS_LINES), topic: 'meme', vars: this.vars({ loser, winner }), ctx: 'meme', likes: [4000, 30000] });
  }

  userPost() {
    const trends = this.tl.data.trends || [];
    const tag = trends.length ? this.pick(trends).tag : this.pick(EVERGREEN_TAGS);
    const mates = this.mates(2);
    const author = randomUser(this.rnd, 'tr', this.club.short);
    return this.publish({
      author: { id: `u:${author.handle}`, kind: 'user', ...author }, text: this.pick(USER_POSTS), topic: 'user',
      vars: this.vars({ tag, mate: mates[0] || 'yedek kaleci' }), ctx: 'user', count: 2, likes: [5, 300],
    });
  }

  /** Transfer pencereleri: büyük kulüplerden yapay transferler (gazeteci + kulüp karşılama kartı) */
  aiTransfers(n = 2) {
    const out = [];
    const w = this.state.world;
    const buyers = CLUBS.filter((c) => LEAGUES[c.league]?.tier === 1 && clubRating(w, c.id) >= 72 && c.id !== this.club.id);
    for (let i = 0; i < n && buyers.length; i++) {
      const buyer = this.pick(buyers);
      const sellerPool = CLUBS.filter((c) => c.id !== buyer.id && c.country !== buyer.country && clubRating(w, c.id) >= 55);
      const seller = this.pick(sellerPool);
      const lang = COUNTRY_BY_ID[seller.country]?.lang || 'en';
      const name = randomName(lang, this.rnd);
      const age = 19 + Math.floor(this.rnd() * 10);
      const fee = Math.round((5 + this.rnd() * 70) * (clubRating(w, buyer.id) / 75)) * 1_000_000;
      const pos = this.pick(['Forvet', 'Orta saha', 'Defans', 'Kanat']);
      const journo = buyer.country === 'it' ? MATTEO : buyer.country === 'es' ? TERTULIA : buyer.country === 'en' ? FOOTY : FABRICIO;
      const tag = tagOf(`${buyer.short}Transfer`);
      out.push(this.publish({
        author: clubAuthor(buyer.id), text: `${this.pick(CLUB_LINES.welcome)} ${tag}`, topic: 'transfer',
        vars: { ...this.vars(), name, first: name.split(' ')[0], age, pos, years: 3 + Math.floor(this.rnd() * 3), number: 2 + Math.floor(this.rnd() * 40), club: buyer.name },
        ctx: 'welcome', count: 3, foreign: 0.4, likes: [2000, 15000],
        card: { kind: 'welcome', clubId: buyer.id, name, look: { skin: Math.floor(this.rnd() * 5), hair: this.pick(['short', 'curly', 'buzz', 'long']), hairColor: Math.floor(this.rnd() * 4) }, number: 2 + Math.floor(this.rnd() * 40), years: 4, fee: moneyShort(fee), from: seller.id },
      }));
      out.push(this.publish({
        author: journo, text: `${name} → ${buyer.name}. ${seller.name} ile ${moneyShort(fee)} bonservis bedelinde anlaşma sağlandı. Sağlık kontrolü bu hafta. ${tag}`, topic: 'transfer_done',
        ctx: 'welcome', count: 3, foreign: 0.5, likes: [6000, 26000], vars: { ...this.vars(), first: name.split(' ')[0] },
      }));
    }
    return out;
  }

  // ─────────────────────────── Maç sonrası ───────────────────────────

  /**
   * @param {any} summary finalizeMatch özeti
   * @param {any} match maç planı
   */
  afterMatch(summary, match) {
    const s = this.state;
    const out = [];
    const my = this.club;
    const opp = CLUB_BY_ID[match.oppId];
    const hg = match.isHome ? match.score.my : match.score.opp;
    const ag = match.isHome ? match.score.opp : match.score.my;
    const scorers = this.scorers(summary, match);
    const score = `${CLUB_BY_ID[match.homeId].short} ${hg}-${ag} ${CLUB_BY_ID[match.awayId].short}`;
    const lines = summary.result === 'W' ? CLUB_LINES.win : summary.result === 'D' ? CLUB_LINES.draw : CLUB_LINES.loss;
    const myScorers = (match.isHome ? scorers.home : scorers.away).map((x) => `⚽ ${x}`).join(' ');
    out.push(this.publish({
      author: clubAuthor(my.id), text: `${this.pick(lines)} ${tagOf(`${my.short}vs${opp.short}`)}`, topic: 'club',
      vars: this.vars({ score, scorers: myScorers, opp: opp.name }), ctx: summary.result === 'L' ? 'match_bad' : 'match_good', lineup: 0.3, likes: [1000, 8000],
      card: { kind: 'result', home: match.homeId, away: match.awayId, hg, ag, scorers, motm: summary.motm ? s.player.name : null, week: match.week },
    }));

    const played = summary.played;
    const rating = summary.rating || 0;
    const lynch = played && (rating <= 5.4 || (summary.result === 'L' && rating < 6.0 && hg + ag >= 3));
    const hype = played && (rating >= 8.2 || summary.goals >= 2 || (summary.motm && summary.result === 'W'));
    const vars = this.vars({ opp: opp.name, OPP: upper(opp.name) });
    if (lynch) {
      const banner = fillTemplate(this.pick(FAN_LINES.lynchBanner), vars);
      out.push(this.publish({ author: fanAuthor(my.id), text: this.pick(FAN_LINES.lynch), topic: 'fans', vars, ctx: 'lynch', card: { kind: 'banner', text: banner, tone: 'bad', clubId: my.id }, likes: [500, 5000] }));
      if (this.chance(0.55)) out.push(this.publish({ author: GARDIYAN, text: this.pick(FAN_LINES.gardiyanBad), topic: 'fans', vars, ctx: 'lynch', likes: [2000, 9000] }));
      s.player.morale = Math.max(0, s.player.morale - 2);
      this.tl.data.lastFanMood = { s: s.calendar.season, w: s.calendar.week, kind: 'lynch' };
    } else if (hype) {
      const banner = fillTemplate(this.pick(FAN_LINES.hypeBanner), vars);
      out.push(this.publish({ author: fanAuthor(my.id), text: this.pick(FAN_LINES.hype), topic: 'fans', vars, ctx: 'hype', foreign: 0.3, card: { kind: 'banner', text: banner, tone: 'good', clubId: my.id }, likes: [1500, 12000] }));
      if (this.chance(0.5)) out.push(this.publish({ author: GARDIYAN, text: this.pick(FAN_LINES.gardiyanGood), topic: 'fans', vars, ctx: 'hype', likes: [3000, 14000] }));
      // Değer güncellemesi (3 haftada bir)
      const data = this.tl.data;
      if (!data.cooldowns.value || weekIndex(s) - data.cooldowns.value >= 3) {
        data.cooldowns.value = weekIndex(s);
        const value = marketValue(s);
        out.push(this.publish({
          author: DEGER, text: this.pick(DEGER_LINES), topic: 'value', ctx: 'value', foreign: 0.3, likes: [2000, 10000],
          vars: this.vars({ age: s.player.age, value: moneyShort(value), hype: '150 milyon dolar' }),
          card: { kind: 'value', value: moneyShort(value), hype: '$150M', clubId: my.id, age: s.player.age, pos: s.player.position },
        }));
      }
      // İlgi: birkaç hafta transfer teklif şansı artar
      data.hype = weekIndex(s) + 3;
      s.player.fame = Math.min(100, (s.player.fame || 0) + 0.5);
      data.lastFanMood = { s: s.calendar.season, w: s.calendar.week, kind: 'hype' };
    }
    // Sermet Hoca
    if (played && summary.goals > 0 && this.chance(0.45)) out.push(this.publish({ author: SERMET, text: this.pick(SERMET_LINES.goal), topic: 'pundit', vars, ctx: 'sermet', likes: [4000, 15000] }));
    else if (played && rating < 5.6 && this.chance(0.4)) out.push(this.publish({ author: SERMET, text: this.pick(SERMET_LINES.bad), topic: 'pundit', vars, ctx: 'sermet', likes: [3000, 12000] }));
    // Eski Hakem Rıza: büyük maçlarda ya da rastgele
    if (match.big || this.chance(0.15)) out.push(this.publish({ author: HAKEM, text: `${this.pick(HAKEM_LINES)} ${tagOf(`${my.short}vs${opp.short}`)}`, topic: 'pundit', vars, ctx: 'hakem', count: 3, likes: [1500, 7000] }));
    // Veri Futbol: 4 haftada bir sezon özeti
    if (s.calendar.week % 4 === 0 && s.career.season.apps >= 3) {
      const se = s.career.season;
      const recent = (this.tl.data.recent || []).slice(-3);
      out.push(this.publish({
        author: VERI, text: this.pick(VERI_LINES.form), topic: 'stats', ctx: 'match_good', count: 3, likes: [800, 5000],
        vars: this.vars({ n: recent.length || 3, ga: recent.reduce((n, r) => n + r.goals + r.assists, 0), posName: POSITIONS[s.player.position].name.toLocaleLowerCase('tr'), apps: se.apps, goals: se.goals, assists: se.assists, avg: (se.ratingSum / Math.max(1, se.apps)).toFixed(1).replace('.', ',') }),
      }));
    }
    this.updateTrends({ match, hype, lynch });
    return out;
  }

  /** Gol atanlar (oyuncunun golleri + kadrodan / rakip ülkeden isimler) */
  scorers(summary, match) {
    const mine = match.score.my;
    const theirs = match.score.opp;
    const mates = this.mates(6);
    const myList = [];
    for (let i = 0; i < summary.goals && myList.length < mine; i++) myList.push(this.state.player.name);
    while (myList.length < mine) myList.push(this.pick(mates.length ? mates : ['Takım arkadaşı']));
    const oppLang = COUNTRY_BY_ID[CLUB_BY_ID[match.oppId]?.country]?.lang || 'tr';
    const oppList = Array.from({ length: theirs }, () => randomName(oppLang, this.rnd));
    const short = (n) => n.split(' ').slice(-1)[0];
    const fmt = (list) => list.map(short);
    return match.isHome ? { home: fmt(myList), away: fmt(oppList) } : { home: fmt(oppList), away: fmt(myList) };
  }

  // ─────────────────────────── Avrupa ───────────────────────────

  /** Kupa maç günü sonuçları (resmi hesap) */
  europe(cups, my) {
    const out = [];
    for (const r of cups || []) {
      const cup = CUPS[r.cup];
      const best = r.matches.slice().sort((x, y) => y.hg + y.ag - (x.hg + x.ag))[0];
      const stage = `${STAGE_LABEL[r.stage]}${r.md ? ` · ${r.md}. maç günü` : ''}`;
      const winner = r.stage === 'f' ? CLUB_BY_ID[r.matches[0].w] : null;
      const text = winner
        ? `🏆 ${cup.name.toLocaleUpperCase('tr')} ŞAMPİYONU: ${winner.name}! Final: ${CLUB_BY_ID[r.matches[0].h].short} ${r.matches[0].hg}-${r.matches[0].ag} ${CLUB_BY_ID[r.matches[0].a].short}${r.matches[0].pen ? ` (pen. ${r.matches[0].pen[0]}-${r.matches[0].pen[1]})` : ''} ${tagOf(cup.name)}`
        : `${cup.name} | ${stage} sonuçları. Gecenin skoru: ${CLUB_BY_ID[best.h].name} ${best.hg}-${best.ag} ${CLUB_BY_ID[best.a].name} ${tagOf(cup.name)}`;
      out.push(this.publish({
        author: AVRUPA, text, topic: 'europe', ctx: 'europe', foreign: 0.45, count: 3, likes: [5000, 30000],
        card: { kind: 'cup', cup: r.cup, stage: r.stage, md: r.md || null, matches: r.matches.slice(0, 16) },
      }));
    }
    if (my) {
      const m = my.match;
      const score = `${CLUB_BY_ID[m.h].short} ${m.hg}-${m.ag} ${CLUB_BY_ID[m.a].short}`;
      const txt = my.stage === 'f' && my.won ? `KUPA BİZİM! 🏆🏆🏆 ${CUPS[my.cup].name} şampiyonuyuz! ${score}`
        : my.won ? `Avrupa'da galibiyet! 🌍 ${score}` : my.out ? `${CUPS[my.cup].name} macerası sona erdi. ${score}. Teşekkürler taraftarımız.` : `${CUPS[my.cup].name} | ${score}`;
      out.push(this.publish({ author: clubAuthor(this.club.id), text: `${txt} ${tagOf(CUPS[my.cup].name)}`, topic: 'club', ctx: my.won ? 'europe' : 'match_bad', likes: [3000, 20000] }));
    }
    return out;
  }

  // ─────────────────────────── Transfer / milli takım / sezon sonu ───────────────────────────

  /** Oyuncu transfer oldu: yeni kulübün "Hoş geldin" kartı (sözleşme detaylarıyla) */
  welcome(offer) {
    const s = this.state;
    const club = CLUB_BY_ID[offer.clubId];
    const p = s.player;
    const vars = this.vars({ name: p.name, age: p.age, pos: POSITIONS[p.position].name.toLocaleLowerCase('tr'), years: offer.years, number: p.number, club: club.name });
    return this.publish({
      author: clubAuthor(club.id), text: `${this.pick(CLUB_LINES.welcome)} ${tagOf(`HoşGeldin${p.name.split(' ')[0]}`)}`, topic: 'transfer', vars, ctx: 'welcome', foreign: 0.25, likes: [3000, 20000],
      card: { kind: 'welcome', clubId: club.id, name: p.name, look: p.avatar || {}, number: p.number, years: offer.years, wage: offer.wage, me: true, from: offer.from || null },
    });
  }

  /** Milli takım kadrosu açıklandı (görselli kadro kartı) */
  nationalSquad(call) {
    const s = this.state;
    const level = call?.level || 'A';
    const title = { A: 'A Milli Takım', U21: 'U-21 Milli Takım', U19: 'U-19 Milli Takım' }[level] || 'A Milli Takım';
    const groups = { K: [], D: [], O: [], F: [] };
    const posKey = { FW: 'F', MF: 'O', DF: 'D' }[s.player.position] || 'O';
    const sizes = { K: 3, D: 8, O: 7, F: 5 };
    const taken = new Set();
    if (call) { groups[posKey].push(s.player.name); taken.add(s.player.name); }
    // Türk kulüplerinde oynayan takım arkadaşları + kurgusal isimler
    const mates = this.club.country === 'tr' ? this.mates(6) : [];
    for (const k of Object.keys(groups)) {
      while (groups[k].length < sizes[k]) {
        const n = mates.length && this.chance(0.3) ? mates.pop() : randomName('tr', this.rnd);
        if (taken.has(n)) continue;
        taken.add(n);
        groups[k].push(n);
      }
    }
    const text = call ? `${title} aday kadrosu açıklandı! 🇹🇷 Kampa çağrılan isimler arasında ${s.player.name} de var. #MilliTakım` : `${title} aday kadrosu açıklandı 🇹🇷 #MilliTakım`;
    return this.publish({
      author: MILLI, text, topic: 'national', ctx: call ? 'squad_in' : 'squad_out', count: 4, likes: [8000, 40000],
      card: { kind: 'squad', title, groups, highlight: call ? s.player.name : null, week: s.calendar.week },
    });
  }

  /** Sezon sonu: büyük liglerin şampiyonları + kendi ülkenden yükselenler */
  seasonEnd(report) {
    const out = [];
    const champs = BIG5.map((lid) => [lid, report.champions?.[lid]]).filter(([, id]) => id);
    if (champs.length) {
      out.push(this.publish({
        author: DUNYA, text: 'Avrupa\'nın 5 büyük liginde şampiyonlar belli oldu! 🏆 #Şampiyonlar', topic: 'world', ctx: 'dunya', count: 3, likes: [5000, 20000],
        card: { kind: 'champs', items: champs.map(([lid, id]) => ({ league: lid, id })) },
      }));
    }
    const myCountry = LEAGUES[report.leagueId]?.country || 'tr';
    const ups = (report.moves || []).filter((m) => m.up && LEAGUES[m.to]?.country === myCountry && LEAGUES[m.to].tier === 1);
    if (ups.length) {
      out.push(this.publish({
        author: DUNYA, text: `${LEAGUES[ups[0].to].name}'e yükselen takımlar: ${ups.map((m) => CLUB_BY_ID[m.clubId].name).join(', ')} 🎉`, topic: 'world', ctx: 'table', count: 3, likes: [2000, 9000],
      }));
    }
    return out;
  }

  // ─────────────────────────── Trendler ───────────────────────────

  /** Gündem: oyuncu, maç, olaylar, oyuncunun kendi etiketleri + her zaman gündemde olanlar */
  updateTrends(ctx = {}) {
    const s = this.state;
    const data = this.tl.data;
    const fame = s.player.fame || 0;
    const list = [];
    const add = (tag, count, kind = 'tr') => list.push({ tag, count: Math.round(count), kind });
    // Önceki maç/oyuncu trendleri hemen kaybolmaz, söner
    for (const t of data.trends || []) if (['me', 'match', 'event'].includes(t.kind) && t.count * 0.6 > 1500) add(t.tag, t.count * 0.6, t.kind);
    if (fame >= 25 || ctx.hype || ctx.lynch) add(tagOf(s.player.name), 1500 + fame * 260 + (ctx.hype ? 18000 : 0) + (ctx.lynch ? 12000 : 0), 'me');
    if (ctx.match) add(tagOf(`${this.club.short}vs${CLUB_BY_ID[ctx.match.oppId].short}`), 2000 + fame * 120 + (ctx.match.big ? 15000 : 0), 'match');
    if (ctx.match?.big?.kind === 'derby') add('#Derbi', 40000, 'event');
    const w = s.calendar.week;
    if ([3, 5, 7, 9, 12, 14, 16, 18, 20, 22].includes(w)) add('#ŞampiyonlarLigi', 30000 + this.rnd() * 20000, 'world');
    if (w === 6 || w === 16) add('#MilliTakım', 25000);
    if (w === 1 || w === MID_WINDOW_WEEK || w === MID_WINDOW_WEEK + 1) add('#TransferBombası', 22000 + this.rnd() * 9000);
    if ((s.social?.press || []).some((p) => p.s === s.calendar.season && p.w >= w - 1)) add('#Magazin', 18000);
    for (const [tag, n] of Object.entries(data.myTags || {})) add(tag, n, 'mine');
    for (const tag of [...EVERGREEN_TAGS].sort(() => this.rnd() - 0.5).slice(0, 5)) add(tag, 2000 + this.rnd() * 20000, 'tr');
    const best = new Map();
    for (const t of list) if (!best.has(t.tag) || best.get(t.tag).count < t.count) best.set(t.tag, t);
    data.trends = [...best.values()].sort((a, b) => b.count - a.count).slice(0, 10);
    // Oyuncunun etiketleri zamanla söner
    for (const k of Object.keys(data.myTags || {})) {
      data.myTags[k] = Math.round(data.myTags[k] * 0.6);
      if (data.myTags[k] < 500) delete data.myTags[k];
    }
    return data.trends;
  }
}

export { extractTags };
