// @ts-check
// OLAY TABANLI TWEET MOTORU — oyun içi olaylar oldukça gazeteciler zaman tüneline tweet düşer.
import { CLUBS, CLUB_BY_ID, LEAGUES } from '../data.js';
import { midWindowWeek } from '../calendar.js';
import { clubRating, leagueOf } from '../league.js';
import { TweetModel, FABRICIO, YAGIZ } from './models.js';
import { CommentGenerator } from './comments.js';
import { RelationshipService } from './relationships.js';
import { Timeline, weekIndex } from './timeline.js';
import { fillTemplate } from './turkish.js';

/** Formsuzluk kuralı: son N maçta gol katkısı yok VEYA ortalama not eşik altında. */
export const FORM_DIP_RULE = {
  matches: 3,
  maxAvgRating: 6.0,
  // Defansta gol/asist beklenmediği için bu ölçüt sadece forvet ve orta sahaya uygulanır
  requireGoalInvolvement: { FW: true, MF: true, DF: false },
};

/** Bekleme süreleri (hafta): aynı haber sürekli tekrarlanmasın. */
export const COOLDOWNS = { form_dip: 4, great_game: 3, bench: 5, board: 8, transfer_offer: 1 };

/** Gazeteci şablonları. A ve B şartnamedeki metinlerdir. */
export const TEMPLATES = {
  form_dip: '{club}, {player:gen} son haftalardaki performansından memnun değil. {when} kiralık gönderilmesi gündemde.',
  transfer_offer: '{bigClub}, {player} için resmi teklifini yaptı. Taraflar prensipte anlaşıyor. Detaylar netleşiyor.',
  transfer_done: '{player} resmen {newClub:dat} transfer oldu. {years} yıllık sözleşme imzalandı, {oldClub} ile yollar ayrıldı. ✅',
  renewal: '{club}, {player} ile sözleşme yeniledi. Yeni anlaşma {years} yıllık.',
  great_game: 'Kulislerde konuşulan: {bigClub} gözlemcileri {player:acc} yakından izliyor. Rapor çok olumlu.',
  injury: '{club} cephesinde kötü haber! {player} antrenmanda sakatlandı. {weeks} hafta sahalardan uzak kalacak.',
  bench: '{club} soyunma odasında soğuk rüzgarlar. {player} üst üste {n} maçtır forma şansı bulamıyor, hocayla arası gergin.',
  board: '{club} yönetimi {player:acc} satış listesine koydu. Kulüp uygun teklif gelirse bırakmaya hazır.',
  discipline_ban: 'PFDK, {player:gen} hakem açıklamaları nedeniyle 1 maç men cezası aldığını duyurdu.',
  discipline_fine: 'PFDK, {player:gen} hakem açıklamaları nedeniyle {fine} para cezasına çarptırıldığını açıkladı.',
  discipline_clear: 'PFDK, {player:gen} hakem açıklamalarıyla ilgili dosyayı ceza vermeden kapattı.',
  award: 'Sezonun ödülleri belli oldu! {player}: {awards}. Büyük kulüplerin radarında.',
};

export class ChirpTriggerEngine {
  /** @param {any} state @param {() => number} [rnd] */
  constructor(state, rnd = Math.random) {
    this.state = state;
    this.rnd = rnd;
    this.timeline = new Timeline(state);
    this.comments = new CommentGenerator(rnd);
    this.rel = new RelationshipService(state);
  }

  // ── yardımcılar ──
  get club() {
    return CLUB_BY_ID[this.state.career.clubId];
  }

  baseVars() {
    return { player: this.state.player.name, club: this.club.name, clubShort: this.club.short, fansRel: this.state.player.rel.fans };
  }

  cooldownOk(key) {
    const last = this.timeline.data.cooldowns[key];
    return last == null || weekIndex(this.state) - last >= (COOLDOWNS[key] ?? 1);
  }

  markCooldown(key) {
    this.timeline.data.cooldowns[key] = weekIndex(this.state);
  }

  /** Büyük kulüp: oyuncunun kulübünden belirgin şekilde güçlü ya da Süper Lig'in ilk 4'ü. */
  isBigClub(clubId) {
    const w = this.state.world;
    // Oyuncunun ülkesindeki en üst ligin ilk 4'ü
    const country = LEAGUES[leagueOf(this.state.career.clubId)]?.country || 'tr';
    const topId = Object.values(LEAGUES).find((l) => l.country === country && l.tier === 1 && !l.youth)?.id || 'super';
    const top4 = (w.leagues[topId]?.teams || []).slice().sort((a, b) => clubRating(w, b) - clubRating(w, a)).slice(0, 4);
    return clubId !== this.state.career.clubId && (clubRating(w, clubId) >= clubRating(w, this.state.career.clubId) + 6 || top4.includes(clubId));
  }

  randomBigClub() {
    const w = this.state.world;
    const list = CLUBS.filter((c) => c.id !== this.state.career.clubId && clubRating(w, c.id) >= clubRating(w, this.state.career.clubId) + 6);
    const pool = list.length ? list : CLUBS.filter((c) => LEAGUES[c.league]?.tier === 1 && c.id !== this.state.career.clubId);
    return pool[Math.floor(this.rnd() * pool.length)];
  }

  /**
   * Gazeteci tweeti üretir, yorumlarıyla zaman tüneline ekler.
   * @param {import('./models.js').AuthorModel} author
   * @param {import('./models.js').TweetTopic} topic
   * @param {string} template
   * @param {object} vars
   */
  post(author, topic, template, vars = {}, meta = {}) {
    const all = { ...this.baseVars(), ...vars };
    const id = this.timeline.nextId();
    const fame = this.state.player.fame;
    const [lo, hi] = author.id === 'fabricio' ? [6000, 26000] : author.id === 'magazin' ? [9000, 34000] : [1200, 7000];
    const likes = Math.round((lo + this.rnd() * (hi - lo)) * (1 + fame / 40));
    const tweet = new TweetModel({
      id,
      authorId: author.id,
      text: author.sign(fillTemplate(template, all)),
      topic,
      season: this.state.calendar.season,
      week: this.state.calendar.week,
      likes,
      retweets: Math.round(likes * (0.08 + this.rnd() * 0.14)),
      meta,
      comments: this.comments.generate(/** @type any */ (topic), {
        player: this.state.player.name.split(' ')[0],
        club: all.club,
        bigClub: all.bigClub,
        clubShort: all.clubShort,
        fansRel: this.state.player.rel.fans,
        idPrefix: id,
      }),
    });
    this.timeline.publish(tweet);
    this.timeline.data.followers += Math.round(5 + fame * 2);
    return tweet;
  }

  // ── tetikleyiciler ──

  /** Son maçlarda formsuz mu? (FORM_DIP_RULE) */
  isFormDip() {
    const recent = this.timeline.data.recent.slice(-FORM_DIP_RULE.matches);
    if (recent.length < FORM_DIP_RULE.matches) return false;
    const avg = recent.reduce((s, m) => s + m.rating, 0) / recent.length;
    const needGA = FORM_DIP_RULE.requireGoalInvolvement[this.state.player.position];
    const noGA = recent.every((m) => m.goals + m.assists === 0);
    return avg < FORM_DIP_RULE.maxAvgRating || (needGA && noGA);
  }

  /**
   * MAÇ SONU: performans kaydı, paylaşım kartı ve olası gazeteci tweetleri.
   * @returns {TweetModel[]}
   */
  onMatchFinished({ summary }) {
    const out = [];
    const data = this.timeline.data;
    if (summary.played) {
      data.recent.push({ rating: summary.rating, goals: summary.goals, assists: summary.assists });
      if (data.recent.length > 6) data.recent.shift();
    }
    const { player, calendar, flags } = this.state;

    // A) Formsuzluk → Yağız Sapanca
    if (summary.played && this.isFormDip() && this.cooldownOk('form_dip')) {
      const when = calendar.week < midWindowWeek() ? 'Devre arasında' : 'Sezon sonunda';
      out.push(this.post(YAGIZ, 'form_dip', TEMPLATES.form_dip, { when }));
      this.markCooldown('form_dip');
      // Medya baskısı: küçük moral ve yönetim etkisi
      player.morale = Math.max(0, player.morale - 3);
      this.rel.apply({ board: -2 });
    } else if (summary.played && (summary.goals >= 2 || summary.rating >= 8.5) && this.cooldownOk('great_game')) {
      // Büyük performans → Fabricio Romana dedikodusu
      out.push(this.post(FABRICIO, 'great_game', TEMPLATES.great_game, { bigClub: this.randomBigClub().name }));
      this.markCooldown('great_game');
    }

    if ((flags.benchStreak || 0) >= 3 && this.cooldownOk('bench')) {
      out.push(this.post(YAGIZ, 'bench', TEMPLATES.bench, { n: flags.benchStreak }));
      this.markCooldown('bench');
    }
    if (this.rel.onTransferList() && this.cooldownOk('board')) {
      out.push(this.post(YAGIZ, 'board', TEMPLATES.board));
      this.markCooldown('board');
    }
    return out;
  }

  /** B) TRANSFER TEKLİFİ: büyük kulüpten resmi teklif → Fabricio Romana. */
  onOffers(offers) {
    const big = (offers || []).filter((o) => !o.renewal && this.isBigClub(o.clubId));
    if (!big.length || !this.cooldownOk('transfer_offer')) return [];
    const best = big.sort((a, b) => clubRating(this.state.world, b.clubId) - clubRating(this.state.world, a.clubId))[0];
    this.markCooldown('transfer_offer');
    return [this.post(FABRICIO, 'transfer_offer', TEMPLATES.transfer_offer, { bigClub: CLUB_BY_ID[best.clubId].name }, { clubId: best.clubId })];
  }

  /** Transfer kesinleşti / sözleşme yenilendi. */
  onTransferComplete(offer, fromClubId) {
    if (offer.renewal) return [this.post(YAGIZ, 'renewal', TEMPLATES.renewal, { years: offer.years })];
    return [this.post(FABRICIO, 'transfer_done', TEMPLATES.transfer_done, {
      newClub: CLUB_BY_ID[offer.clubId].name,
      oldClub: CLUB_BY_ID[fromClubId]?.name || '',
      years: offer.years,
      club: CLUB_BY_ID[offer.clubId].name,
    }, { clubId: offer.clubId })];
  }

  onInjury(weeks) {
    return [this.post(YAGIZ, 'injury', TEMPLATES.injury, { weeks })];
  }

  /**
   * HAFTA SONU: agresif paylaşımın disiplin dosyasını sonuçlandırır.
   * @returns {{tweets:TweetModel[], outcome:null|'ban'|'fine'|'clear', fine?:number}}
   */
  onWeekEnd() {
    const d = this.timeline.data.discipline;
    if (!d) return { tweets: [], outcome: null };
    this.timeline.data.discipline = null;
    const { career, flags } = this.state;
    if (this.rnd() < d.risk) {
      if (this.rnd() < 0.4) {
        flags.suspendedWeeks = Math.max(flags.suspendedWeeks || 0, 1);
        return { tweets: [this.post(YAGIZ, 'discipline', TEMPLATES.discipline_ban)], outcome: 'ban' };
      }
      const fine = Math.max(200, Math.round((career.contract.wage * 0.5) / 50) * 50);
      career.money -= fine;
      return { tweets: [this.post(YAGIZ, 'discipline', TEMPLATES.discipline_fine, { fine: `€${fine.toLocaleString('tr-TR')}` })], outcome: 'fine', fine };
    }
    this.rel.apply({ federation: 3 });
    return { tweets: [this.post(YAGIZ, 'discipline', TEMPLATES.discipline_clear)], outcome: 'clear' };
  }

  onSeasonEnd(report) {
    if (!report.awards?.length) return [];
    const awards = report.awards.map((a) => a.title).join(', ');
    return [this.post(YAGIZ, 'award', TEMPLATES.award, { awards, league: LEAGUES[leagueOf(this.state.career.clubId)]?.name })];
  }
}
