// @ts-check
// TARAFTAR YORUM SİSTEMİ — her ana tweetin altına 3–4 bot yorumu.
// Yorumun olumlu/olumsuz olması bağlama ve taraftar ilişkisine göre seçilir,
// etiketi ise duygu analizinden gelir (analyzeSentiment).
import { allTurkish } from './lang.js';
import { CommentModel, makeBotUser } from './models.js';
import { FOREIGN_COMMENTS, RICH_COMMENTS } from './content.js';
import { FOREIGN_LANGS, randomUser } from './personas.js';
import { analyzeSentiment } from './sentiment.js';
import { fillTemplate } from './turkish.js';

/** @typedef {import('./models.js').TweetTopic | 'player_modest' | 'player_ego' | 'player_aggressive'} CommentContext */

/** Bağlama göre yorum havuzları. {player}, {bigClub:dat} gibi yer tutucular doldurulur. */
export const COMMENT_POOLS = {
  form_dip: {
    pos: ['Sabırlı olun, {player} daha çok genç. İnancımız tam!', 'Herkesin kötü dönemi olur, {player} güçlü dönecek 💪', 'Bence kalmalı, çalışkan ve yetenekli bir çocuk.'],
    neg: ['Bu çocuk balon çıktı zaten', 'Her maç aynı hikaye, sıfır üretkenlik.', 'Kiralık gitsin, takıma yük oluyor.', 'Hocam bunu neden oynatıyorsun? Rezalet.'],
  },
  transfer_offer: {
    pos: ['Hadi inşallah {bigClub:dat} gidiyoruz!', 'Yeteneği oraya layık, başarılar {player} 🙌', 'Bu transfer olursa efsane olur!'],
    neg: ['Bir sezon iyi oynadı diye abartmayın.', 'Oraya gider, yedek kulübesini ısıtır.', 'Para için armayı satan sevilmez.'],
  },
  transfer_done: {
    pos: ['Hoş geldin {player}! Formayı terlet 🔥', 'Yönetimden çok akıllıca bir hamle.', 'Harika transfer, sezonun bombası!'],
    neg: ['Bu paraya bu oyuncu? Şaka gibi.', 'Gereksiz transfer, kadroda daha iyisi var.', 'Hayal kırıklığı, bekleneni vermez.'],
  },
  renewal: {
    pos: ['Harika haber, {player} bizim değerimiz!', 'Sadakat budur, gurur duyuyoruz.', 'Bravo yönetim, doğru karar 👏'],
    neg: ['Bu maaşa bu performans? Şaka gibi.', 'Gereksiz bir uzatma, yetersiz bir oyuncu.'],
  },
  great_game: {
    pos: ['Bu performans dünya yıldızı performansı! 🔥', '{player} başka seviye, gitmesin!', 'Muhteşem oynadı, maçın adamı!'],
    neg: ['Bir maçla yıldız olunmaz, sakin olun.', 'Zayıf rakibe attı, büyük maçta görelim.', 'Abartmayın, daha çok eksiği var.'],
  },
  injury: {
    pos: ['Geçmiş olsun {player}, çabuk dön 🙏', 'Sağlığın her şeyden önemli, güçlü dön!', 'Takım seni bekliyor, geçmiş olsun.'],
    neg: ['Cam adam çıktı, sürekli sakat.', 'Sağlık ekibi ne iş yapıyor? Rezalet.', 'Kötü haber, sezon bitti bizim için.'],
  },
  discipline: {
    pos: ['Ceza yese de arkandayız {player}!', 'Doğruları söyledi, desteğimiz tam!', 'Cesur duruş, helal olsun 👏'],
    neg: ['Hak etti, ağzına sahip olsun.', 'Takımı yarı yolda bıraktı, bencil davranış.', 'Bu ceza ders olur umarım, saygısızlık bitsin.'],
  },
  ballon: {
    pos: ['Dünya sahnesinde bir Türk yıldızı! Gurur duyuyoruz 🇹🇷', '{player} Altın Top\'u hak ediyor, başka aday yok!', 'Tarih yazılıyor, helal olsun {player}!'],
    neg: ['Abartmayın, Avrupa\'da oynamadan Altın Top olmaz.', 'Sıralama torpilli, o kadar da değil.', 'Abartılmış bir aday, haksızlık bu.'],
  },
  award: {
    pos: ['Hak edilmiş bir ödül, tebrikler! 🏆', 'Efsane sezon, gurur duyuyoruz!', 'Bravo {player}, devamı gelsin!'],
    neg: ['Ödülü başkası almalıydı, haksızlık.', 'Torpil, şike, ne derseniz deyin.', 'Abartılmış bir ödül, ligde daha iyisi var.'],
  },
  bench: {
    pos: ['Sabret {player}, sıran gelecek 💪', '{player} oynamayı hak ediyor, şans verin!', 'Kulübede bekleyen en yetenekli oyuncumuz.'],
    neg: ['Kulübe onun yeri, performansı yetersiz.', 'Antrenmanda tembel, kulübede kalsın.', 'Oynamayı hak etmiyor.'],
  },
  board: {
    pos: ['{player} bu kulübün değeri, desteğimiz tam!', 'Yönetim değil oyuncu haklı, arkandayız!'],
    neg: ['Yönetim doğru yapıyor, bu performans yetersiz.', 'Satın gitsin, artık yeter.', 'Kulübe zarar veriyor, satılmalı.'],
  },
  gossip: {
    pos: ['Çok yakışıyorlar, mutluluklar {player} 😍', 'Özel hayatı onu ilgilendirir, sahada harika oynuyor!', 'Aşk yaramış, son maçlarda müthiş formda 🔥', 'Mutlu oyuncu sahada da mutlu olur 👏'],
    neg: ['Magazinle değil futbolla gündeme gelsin, yazık.', 'Sahada sıfır, gece hayatında bir numara.', 'Bu kadar gezme yorgunluk yapar, performans düştü.', 'Kafası futbolda değil, disiplinsiz davranıyor.'],
  },
  scandal: {
    pos: ['Özel hayatı onu ilgilendirir, arkandayız {player}!', 'Magazinin yalanlarına inanmayın, desteğimiz tam 💪', 'Sahada cevabını verecek, arkandayız!'],
    neg: ['Rezalet, kulübün adını magazine düşürdü.', 'Maç öncesi gece kulübü mü? Profesyonellik sıfır.', 'Ayıp, taraftara saygısızlık bu.', 'Bu disiplinsizlik cezasız kalmamalı.', 'Yönetim derhal ceza kesmeli, yazık.'],
  },
  player_modest: {
    pos: ['İşte örnek profesyonel! Gurur duyuyoruz.', 'Alçakgönüllü oyuncu her zaman kazanır 👏', 'Seninle gurur duyuyoruz {player}!'],
    neg: ['Klişe cümleler, sahada göster.', 'PR ekibi yazmış belli, samimiyetsiz.'],
  },
  player_ego: {
    pos: ['Haklı, ligin en iyisi o! 👑', 'Özgüven budur, kral konuşmuş.', 'Yıldız gibi konuşuyor, yıldız gibi oynuyor 🔥'],
    neg: ['Bu kadar kibir iyi değil.', 'Ego tavan, performans yerlerde.', 'Takım arkadaşlarına saygısızlık bu.'],
  },
  player_aggressive: {
    pos: ['Sonunda biri söyledi! Arkandayız {player}.', 'Haklısın, cesur bir duruş 👏', 'Helal olsun, susmadın!'],
    neg: ['Ceza yiyecek, takımı zor durumda bırakıyor.', 'Kaybedince suçu hakeme atmak kolay, ayıp.', 'Profesyonellik bu mu? Rezalet bir açıklama.'],
  },
};

/** Bağlamın taban olumlu yorum oranı. */
const BASE_POSITIVE = {
  form_dip: 0.3, transfer_offer: 0.6, transfer_done: 0.65, renewal: 0.7, great_game: 0.75, injury: 0.7, discipline: 0.45,
  award: 0.75, bench: 0.5, board: 0.4, player_modest: 0.75, player_ego: 0.4, player_aggressive: 0.6, gossip: 0.55, scandal: 0.25,
};

export class CommentGenerator {
  /** @param {() => number} [rnd] */
  constructor(rnd = Math.random) {
    this.rnd = rnd;
  }

  /**
   * Olumlu yorum olasılığı: bağlam tabanı + taraftar ilişkisinin etkisi.
   * @param {CommentContext} context
   * @param {number} fansRel 0–100
   */
  positiveChance(context, fansRel) {
    const base = BASE_POSITIVE[context] ?? 0.5;
    return Math.max(0.1, Math.min(0.9, base + (fansRel - 50) / 200));
  }

  /**
   * @param {CommentContext} context
   * @param {{player:string, club?:string, bigClub?:string, clubShort?:string, fansRel?:number, count?:number, idPrefix:string}} o
   * @returns {CommentModel[]}
   */
  generate(context, o) {
    const pool = COMMENT_POOLS[context] || COMMENT_POOLS.great_game;
    const count = o.count ?? (this.rnd() < 0.5 ? 3 : 4);
    const pPos = this.positiveChance(context, o.fansRel ?? 50);
    const used = new Set();
    const out = [];
    for (let i = 0; i < count; i++) {
      const wantPos = this.rnd() < pPos;
      let list = wantPos ? pool.pos : pool.neg;
      let free = list.filter((t) => !used.has(t));
      if (!free.length) {
        list = wantPos ? pool.neg : pool.pos;
        free = list.filter((t) => !used.has(t));
      }
      if (!free.length) break;
      const template = free[Math.floor(this.rnd() * free.length)];
      used.add(template);
      const sentiment = analyzeSentiment(template); // isim etkilemesin diye şablon üzerinden
      // Aynı tweetin altında aynı hesap iki kez yorum yapmasın
      let author = makeBotUser(this.rnd, o.clubShort);
      for (let k = 0; k < 8 && out.some((c) => c.author.handle === author.handle); k++) author = makeBotUser(this.rnd, o.clubShort);
      out.push(new CommentModel({
        id: `${o.idPrefix}-c${i}`,
        author,
        text: fillTemplate(template, o),
        sentiment: { label: sentiment.label, score: sentiment.score },
        likes: Math.floor(this.rnd() * 400),
      }));
    }
    return out;
  }

  /**
   * Zengin yorumlar: bağlam havuzu + "şu oyuncu oynamalı" yorumları + yabancı kullanıcılar.
   * @param {string} context RICH_COMMENTS anahtarı
   * @param {{vars?:object, fansRel?:number, count?:number, mates?:string[], foreign?:number, idPrefix:string, clubShort?:string, lineup?:number}} o
   */
  generateRich(context, o) {
    const pool = RICH_COMMENTS[context] || RICH_COMMENTS.user;
    const count = o.count ?? 3 + Math.floor(this.rnd() * 3);
    const pPos = Math.max(0.1, Math.min(0.9, 0.5 + ((o.fansRel ?? 50) - 50) / 120));
    const mates = (o.mates || []).filter(Boolean);
    const used = new Set();
    const handles = new Set();
    const out = [];
    const langs = Object.keys(FOREIGN_LANGS);
    for (let i = 0; i < count; i++) {
      let item = null;
      let lang = 'tr';
      const r = this.rnd();
      if (mates.length && r < (o.lineup ?? 0.18)) {
        item = RICH_COMMENTS.lineup[Math.floor(this.rnd() * RICH_COMMENTS.lineup.length)];
      } else if (!allTurkish() && r < (o.lineup ?? 0.18) + (o.foreign || 0)) {
        lang = langs[Math.floor(this.rnd() * langs.length)];
        const fp = FOREIGN_COMMENTS[lang] || FOREIGN_COMMENTS.en;
        item = fp[Math.floor(this.rnd() * fp.length)];
      } else {
        // Olumlu/olumsuz ağırlık: taraftar ilişkisine göre
        const weighted = pool.filter((x) => !used.has(x.t)).map((x) => [x, x.s === 'p' ? pPos : x.s === 'n' ? 1 - pPos : 0.45]);
        const total = weighted.reduce((n, [, w]) => n + w, 0);
        let roll = this.rnd() * total;
        for (const [x, w] of weighted) {
          roll -= w;
          if (roll <= 0) { item = x; break; }
        }
        item = item || weighted[0]?.[0];
      }
      if (!item || used.has(item.t)) continue;
      used.add(item.t);
      let author = randomUser(this.rnd, lang, o.clubShort);
      for (let k = 0; k < 8 && handles.has(author.handle); k++) author = randomUser(this.rnd, lang, o.clubShort);
      handles.add(author.handle);
      const mate = mates[Math.floor(this.rnd() * mates.length)] || '';
      const mate2 = mates.filter((m) => m !== mate)[0] || mate;
      const text = fillTemplate(item.t, { ...(o.vars || {}), mate, mate2 });
      const label = item.s === 'p' ? 'positive' : item.s === 'n' ? 'negative' : 'neutral';
      out.push(new CommentModel({
        id: `${o.idPrefix}-c${i}`,
        author,
        text,
        sentiment: { label, score: label === 'positive' ? 1 : label === 'negative' ? -1 : 0 },
        likes: Math.floor(this.rnd() * (item.s === 'z' ? 900 : 500)),
      }));
    }
    return out;
  }
}
