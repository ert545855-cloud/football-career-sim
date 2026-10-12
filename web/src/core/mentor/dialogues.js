// @ts-check
// MENTOR DİYALOG HAVUZU — her buluşmada bağlama uygun havuzlardan rastgele bir metin seçilir.
// Bağlam: sıradaki maç büyük maç mı, ün, form, sakatlık, yedek kalma, transfer söylentisi, mentorun karakteri, ilişki düzeyi.
import { fillTemplate } from '../chirp/turkish.js';

/**
 * @typedef {{bigMatch:null|{title:string, label:string}, fame:number, form:number, ratings:number, injured:boolean,
 *   benchStreak:number, rumor:boolean, trait:import('./models.js').TraitId, relationship:number, kind:'coffee'|'dinner',
 *   player:string, mentor:string, club:string}} DialogueContext
 * @typedef {{id:string, weight:(c:DialogueContext)=>number, lines:string[]}} DialoguePoolDef
 */

/** Buluşma sahneleri (kahve / yemek) */
export const SCENES = {
  coffee: [
    'Antrenmandan sonra {mentor} ile sahildeki küçük kafede buluştunuz.',
    'Tesislerin kafeteryasında iki Türk kahvesi söylediniz. {mentor} fincanı çevirip konuşmaya başladı.',
    'Sabah erkenden, şehrin en eski kahvecisinde {mentor} seni bekliyordu.',
    '{mentor} soyunma odasından çıkarken "Bir kahve içelim mi?" dedi.',
  ],
  dinner: [
    '{mentor} seni ailesiyle birlikte akşam yemeğine çağırdı.',
    'Esnaf lokantasında tepsi tepsi yemek geldi. {mentor} herkesi tanıyordu.',
    'Balıkçıda uzun bir akşam yemeği. {mentor} telefonunu masaya ters çevirdi.',
    '{mentor} yıllardır gittiği ocakbaşına götürdü seni.',
  ],
};

/** Örnek 1 ve Örnek 2: tasarım belgesindeki metinler (birebir) */
export const EXAMPLE_BIG_MATCH = 'Büyük maçlardan önce heyecanını nasıl yenersin evlat? Unutma, ilk düdükten sonra sadece topa odaklan.';
export const EXAMPLE_FAME = 'Medyada adını çok görüyorum. Şöhret seni bozmasın, her zaman ilk giren ve son çıkan sen olmalısın.';

/** @type {DialoguePoolDef[]} */
export const DIALOGUE_POOLS = [
  {
    id: 'big_match',
    weight: (c) => (c.bigMatch ? 6 : 0),
    lines: [
      EXAMPLE_BIG_MATCH,
      '{matchTitle} haftası şehir başka türlü uyanır. Sen ritmini bozma; ısınmada ilk üç pası basit ver, gerisi gelir.',
      'Bu hafta gece uyuyamayacaksın, biliyorum. Ben ilk derbimde hiç uyumadım. Sabah kalkınca telefonu kapat, kafanı boşalt.',
      'Tribünün sesi seni ya büyütür ya küçültür. Ben o uğultuyu hep kendi adımmış gibi duydum. Sen de öyle yap.',
    ],
  },
  {
    id: 'fame',
    weight: (c) => (c.fame >= 12 ? 3 + Math.min(3, c.fame / 20) : 0),
    lines: [
      EXAMPLE_FAME,
      'Bir gecede ünlü olunur ama bir gecede futbolcu olunmaz. Röportajları kısa tut, antrenmanı uzun.',
      'Telefonundaki bildirimleri say, sonra antrenmandaki tekrarlarını say. İkincisi hep daha büyük olmalı.',
    ],
  },
  {
    id: 'form_dip',
    weight: (c) => (c.ratings >= 3 && c.form < 6.2 ? 5 : 0),
    lines: [
      'Herkes düşer {player}. Önemli olan yerde ne kadar kaldığın. Bu hafta sadece basit işleri kusursuz yap.',
      'Bana da otuz yaşımda "bitti" dediler. Gazete manşetlerini değil, antrenman sahasını dinle.',
      'Kötü maçtan sonra videoyu bir kez izle, sonra kapat. Hatayı bir kez öğrenirsin, yüz kez değil.',
    ],
  },
  {
    id: 'injury',
    weight: (c) => (c.injured ? 6 : 0),
    lines: [
      'Sakatlık bedenini değil sabrını sınar. Fizyoterapistin dediğinden bir gün bile erken dönme.',
      'Ben çapraz bağ ameliyatından sonra dokuz ay sahadan uzak kaldım. Döndüğümde daha akıllı bir oyuncuydum.',
    ],
  },
  {
    id: 'bench',
    weight: (c) => (c.benchStreak >= 2 ? 4 : 0),
    lines: [
      'Kulübede oturmak ayıp değil. Isınırken bile hocaya "hazırım" de; ağzınla değil, koşunla.',
      'Hoca seni görmüyor mu sanıyorsun? Görüyor. Antrenmanda onu seçmek zorunda bırak.',
    ],
  },
  {
    id: 'good_form',
    weight: (c) => (c.ratings >= 3 && c.form >= 7.3 ? 3 : 0),
    lines: [
      'İyi gidiyorsun ama asıl sınav bundan sonra. Rakipler seni artık tanıyor, oyununa yeni bir şey ekle.',
      'Övgüyü de eleştiri gibi dinle: kısa süre ve mesafeli. Sonra işine dön.',
    ],
  },
  {
    id: 'rumor',
    weight: (c) => (c.rumor ? 3 : 0),
    lines: [
      'Menajerler kapını çalacak. Parayı değil, forma giyeceğin dakikaları say.',
      'Büyük kulüp adı insanın başını döndürür. Kulübede oturacaksan büyük kulübün ne anlamı var?',
    ],
  },
  {
    id: 'trait_hardworker',
    weight: (c) => (c.trait === 'hardworker' ? 2 : 0),
    lines: [
      'Yeteneği olan çok, her gün aynı işi yapabilen az. Bugün fazladan yirmi şut çek, kimse görmese bile.',
      'Ben yirmi yıl boyunca antrenmana hep ilk geldim. Yorgunluk alışkanlığa yenilir.',
    ],
  },
  {
    id: 'trait_leader',
    weight: (c) => (c.trait === 'leader' ? 2 : 0),
    lines: [
      'Kaptanlık pazubantla olmaz. Soyunma odasında en son konuşan değil, en çok dinleyen ol.',
      'Takım arkadaşının kötü gününde yanında olursan, senin kötü gününde o yanında olur.',
    ],
  },
  {
    id: 'trait_coolheaded',
    weight: (c) => (c.trait === 'coolheaded' ? 2 : 0),
    lines: [
      'Penaltıdan önce üç nefes al. Kaleciye bakma; topun nereye gideceğine sen zaten karar verdin.',
      'Hakem yanlış düdük çaldığında bile omzunu düşürme. Sakin kalan kazanır.',
    ],
  },
  {
    id: 'deep',
    weight: (c) => (c.relationship >= 70 ? 2 : 0),
    lines: [
      'Seninle konuştukça kendi gençliğimi hatırlıyorum. Sezon bitince de beni aramayı unutma.',
      'Emekliliğim yaklaşıyor. Bu kulübün yükünü bir gün sen taşıyacaksın, bunu biliyorsun değil mi?',
    ],
  },
  {
    id: 'dinner_life',
    weight: (c) => (c.kind === 'dinner' ? 1.5 : 0),
    lines: [
      'Ailene vakit ayırıyor musun? Futbol uzun bir yolculuk, yanında kimlerin olduğu önemli.',
      'Paranı ilk yıllarda harcama. Bacakların sonsuza kadar koşmayacak.',
    ],
  },
  {
    id: 'general',
    weight: () => 1,
    lines: [
      'Ben senin yaşındayken hep acele ederdim. Futbolda en zor şey beklemeyi öğrenmek.',
      '{club} formasını ilk giydiğimde ellerim titriyordu. O heyecanı kaybettiğin gün bırakmalısın.',
      'Her maçtan sonra kendine üç soru sor: Ne iyi gitti, ne kötü gitti, yarın neyi farklı yapacağım?',
    ],
  },
];

/** Mentorun ilk tanışma cümlesi (seçimde gösterilir) */
export const INTRO_LINES = [
  '{player}, sana mentorluk yapmak benim için onur. Kuralım basit: sen bana dürüst ol, ben de sana.',
  'Demek beni seçtin. Bu sezon kolay olmayacak ama yanında olacağım.',
  'Hoca senden çok bahsediyor. Bakalım bu sezon ne kadar öğrenmeye açıksın.',
];

/** Sezon sonu veda */
export const FAREWELL_LINES = {
  strong: '{mentor}: "Bu sezon seninle gurur duydum. Kapım her zaman açık."',
  weak: '{mentor}: "Daha çok konuşabilirdik. Yine de yolun açık olsun."',
};

/** Gençlerin mentorluk talepleri (oyuncu 26'yı geçince) */
export const REQUEST_LINES = {
  academy: [
    'Abi, altyapıdan yeni çıktım. Seni yıllardır tribünden izliyorum, bana yol gösterir misin?',
    'Abi, A takımda kimseyi tanımıyorum. Antrenmandan sonra seninle çalışabilir miyim?',
  ],
  transfer: [
    'Abi, şehre yeni geldim. Senden öğrenebileceğim çok şey var, bana mentorluk yapar mısın?',
    'Abi, bu kulübü senden iyi bilen yok. Bana yardım eder misin?',
  ],
};

/** Gençlere mentorluk yaparken haftalık notlar */
export const MENTEE_WEEK_LINES = [
  '{mentee} antrenmandan sonra seninle fazladan şut çalıştı.',
  '{mentee} ilk kez soyunma odasında söz aldı; senin tavsiyeni uyguladı.',
  '{mentee} sana kötü geçen maçını sordu, birlikte videosunu izlediniz.',
  'Hoca, {mentee} ile ilgilenmenden çok memnun.',
];

/**
 * Bağlama göre ağırlıklı havuz seçimi + havuz içinde son görülmeyen satır.
 */
export class DialoguePool {
  /**
   * @param {() => number} rnd
   * @param {DialoguePoolDef[]} [pools]
   */
  constructor(rnd, pools = DIALOGUE_POOLS) {
    this.rnd = rnd;
    this.pools = pools;
  }

  /** Uygulanabilir havuzlar ve ağırlıkları */
  weights(/** @type {DialogueContext} */ ctx) {
    return this.pools.map((p) => ({ pool: p, w: Math.max(0, p.weight(ctx)) })).filter((x) => x.w > 0);
  }

  /**
   * @param {DialogueContext} ctx
   * @param {string[]} [recent] son gösterilen satır kimlikleri (tekrarı azaltmak için)
   * @returns {{id:string, pool:string, text:string}}
   */
  pick(ctx, recent = []) {
    const options = this.weights(ctx);
    const total = options.reduce((a, b) => a + b.w, 0);
    let roll = this.rnd() * total;
    let chosen = options[options.length - 1].pool;
    for (const o of options) {
      roll -= o.w;
      if (roll <= 0) {
        chosen = o.pool;
        break;
      }
    }
    const ids = chosen.lines.map((_, i) => `${chosen.id}#${i}`);
    let free = ids.filter((id) => !recent.includes(id));
    if (!free.length) free = ids;
    const id = free[Math.floor(this.rnd() * free.length)];
    const line = chosen.lines[Number(id.split('#')[1])];
    return { id, pool: chosen.id, text: fill(line, ctx) };
  }

  /** Sahne (kahve/yemek) metni */
  scene(/** @type {DialogueContext} */ ctx) {
    const list = SCENES[ctx.kind];
    return fill(list[Math.floor(this.rnd() * list.length)], ctx);
  }
}

/** @param {string} line @param {any} ctx */
export function fill(line, ctx) {
  return fillTemplate(line, { ...ctx, matchTitle: ctx.bigMatch?.title || 'Derbi' });
}
