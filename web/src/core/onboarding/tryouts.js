// @ts-check
// SEÇMELER KAMPI — eğitim (tutorial) + yetenek ölçümü.
//
// 3 istasyon (Pas, Şut, Çalım) sırayla oynanır. Her istasyonda 3 hak (kalp) vardır:
//   • Her hata (pas kaçırma, şutu dışarı / hedef dışına atma, dubaya çarpma) 1 hak götürür.
//   • İstasyon, deneme sayısı bitince ya da haklar sıfırlanınca kapanır; kalan haklar kaydedilir.
//   • İlk deneme "ısınma"dır: mekaniği öğretir, hak götürmez.
// Seçme Skoru = üç istasyonda kalan hakların toplamı (0–9).

/** @typedef {'pass'|'shot'|'dribble'} StationId */
/**
 * @typedef {{id:StationId, name:string, short:string, sprite:string, teaches:string, attempts:number, failLabel:string,
 *   successLabel:string, statKey:'passing'|'shooting'|'speed', tutorial:string[]}} StationDef
 * @typedef {{hearts:number, attempts:number, successes:number, fails:number, warmupDone:boolean, done:boolean, log:boolean[]}} StationState
 */

export const TRYOUT_RULES = Object.freeze({
  heartsPerStation: 3,
  /** Isınma denemesi hak götürmez */
  warmup: true,
});

/** @type {StationDef[]} */
export const STATIONS = [
  {
    id: 'pass',
    name: 'Pas İstasyonu',
    short: 'Pas',
    sprite: 'cone',
    teaches: 'Hareketli hedeflere pas atmak',
    attempts: 5,
    failLabel: 'Pas kaçtı',
    successLabel: 'İsabetli pas',
    statKey: 'passing',
    tutorial: [
      'Arkadaşın sahanın üst tarafında koşuyor.',
      'Ekrana dokunduğun noktaya pas gider.',
      'Koştuğu yönün biraz önüne at: top oraya vardığında o da orada olsun.',
    ],
  },
  {
    id: 'shot',
    name: 'Şut İstasyonu',
    short: 'Şut',
    sprite: 'mini_goal',
    teaches: 'Kalenin köşelerindeki hedefleri vurmak',
    attempts: 5,
    failLabel: 'Hedef ıskalandı',
    successLabel: 'Hedef vuruldu',
    statKey: 'shooting',
    tutorial: [
      'Kalenin köşelerinden birinde parlayan bir hedef var.',
      'Topu hedefe doğru kaydır: yön kaydırma açısından, yükseklik kaydırma uzunluğundan gelir.',
      'Dışarı, direğe ya da hedefin dışına giden şut 1 hak götürür.',
    ],
  },
  {
    id: 'dribble',
    name: 'Çalım İstasyonu',
    short: 'Çalım',
    sprite: 'disc_cones',
    teaches: 'Dubaların arasından çarpmadan geçmek',
    attempts: 7,
    failLabel: 'Dubaya çarptın',
    successLabel: 'Temiz geçiş',
    statKey: 'speed',
    tutorial: [
      'Top ayağında, kendiliğinden ileri koşuyorsun.',
      'Parmağını sağa sola sürükleyerek yön ver.',
      'Her dubalı sıradaki boşluktan geç. Dubaya çarpmak 1 hak götürür.',
    ],
  },
];

export const STATION_BY_ID = /** @type {Record<StationId, StationDef>} */ (Object.fromEntries(STATIONS.map((s) => [s.id, s])));
export const MAX_SCORE = STATIONS.length * TRYOUT_RULES.heartsPerStation;

const fresh = () => /** @type {StationState} */ ({ hearts: TRYOUT_RULES.heartsPerStation, attempts: 0, successes: 0, fails: 0, warmupDone: !TRYOUT_RULES.warmup, done: false, log: [] });

/**
 * Seçme oturumu: istasyon sırası, hak kontrolü, skor. Kayıt (JSON) ile kaldığı yerden sürer.
 */
export class TryoutSession {
  /** @param {{index?:number, stations?:Record<string, StationState>}} [data] */
  constructor(data = {}) {
    this.index = data.index ?? 0;
    /** @type {Record<StationId, StationState>} */
    this.stations = /** @type {any} */ (Object.fromEntries(STATIONS.map((s) => [s.id, { ...fresh(), ...(data.stations?.[s.id] || {}) }])));
  }

  /** Şu anki istasyon (bittiyse null) */
  get current() {
    return STATIONS[this.index] || null;
  }

  get finished() {
    return this.index >= STATIONS.length;
  }

  /** @param {StationId} [id] */
  state(id = this.current?.id) {
    return id ? this.stations[id] : null;
  }

  /** Isınma denemesi mi? (hak götürmez, sayılmaz) */
  isWarmup(id = this.current?.id) {
    const st = this.state(id);
    return !!st && !st.warmupDone;
  }

  /**
   * Bir denemenin sonucunu işler. HAK KONTROLÜ burada:
   *   başarısız → hak 1 azalır; haklar 0 olursa ya da denemeler biterse istasyon kapanır.
   * @param {boolean} success
   * @returns {{warmup:boolean, success:boolean, hearts:number, lostHeart:boolean, attempt:number, attemptsLeft:number, stationOver:boolean}}
   */
  record(success) {
    const def = this.current;
    if (!def) throw new Error('Seçmeler bitti.');
    const st = this.stations[def.id];
    if (st.done) throw new Error(`${def.name} zaten tamamlandı.`);
    if (!st.warmupDone) {
      st.warmupDone = true;
      return { warmup: true, success, hearts: st.hearts, lostHeart: false, attempt: 0, attemptsLeft: def.attempts, stationOver: false };
    }
    st.attempts += 1;
    st.log.push(success);
    let lostHeart = false;
    if (success) st.successes += 1;
    else {
      st.fails += 1;
      if (st.hearts > 0) {
        st.hearts -= 1;
        lostHeart = true;
      }
    }
    st.done = st.hearts <= 0 || st.attempts >= def.attempts;
    return { warmup: false, success, hearts: st.hearts, lostHeart, attempt: st.attempts, attemptsLeft: def.attempts - st.attempts, stationOver: st.done };
  }

  /** İstasyonu kapatır (kalan haklar kaydedilir) ve sıradakine geçer. */
  finishStation() {
    const def = this.current;
    if (!def) return null;
    const st = this.stations[def.id];
    st.done = true;
    st.warmupDone = true;
    this.index += 1;
    return { id: def.id, name: def.name, hearts: st.hearts, successes: st.successes, attempts: st.attempts, eliminated: st.hearts === 0 };
  }

  /** Seçme Skoru: kalan hakların toplamı (0–9) */
  score() {
    return STATIONS.reduce((sum, s) => sum + (this.stations[s.id].done ? this.stations[s.id].hearts : 0), 0);
  }

  /** Seçme raporu: istasyon sonuçları, skor, not, mevki önerisi */
  report() {
    const stations = STATIONS.map((s) => {
      const st = this.stations[s.id];
      return { id: s.id, name: s.name, hearts: st.hearts, successes: st.successes, attempts: st.attempts, fails: st.fails, statKey: s.statKey };
    });
    const score = this.score();
    return { stations, score, max: MAX_SCORE, grade: gradeFor(score), position: recommendPosition(stations) };
  }

  toJSON() {
    return { index: this.index, stations: this.stations };
  }
}

/** Skora göre scout notu */
export function gradeFor(score) {
  if (score >= 9) return { label: 'Kusursuz', text: 'Kamptaki herkes senin adını konuşuyor.' };
  if (score >= 7) return { label: 'Çok iyi', text: 'Dev kulüplerin scoutları not defterlerini çıkardı.' };
  if (score >= 4) return { label: 'İyi', text: 'Üst lig kulüpleri seninle ilgileniyor.' };
  if (score >= 1) return { label: 'Gelişmeli', text: 'Ham bir yetenek. Alt ligde forma şansı seni bekliyor.' };
  return { label: 'Zor bir gün', text: 'Yine de bir kulüp sana şans vermeye hazır.' };
}

/**
 * Scout'un mevki önerisi: en iyi istasyona göre.
 * Şut → Forvet, Pas → Orta Saha, Çalım → Forvet (kanat). Eşitlikte sıra: şut, pas, çalım.
 * Kampta savunma istasyonu olmadığı için Defans öneri olarak çıkmaz; oyuncu yine de seçebilir.
 * @param {Array<{id:string, hearts:number, successes:number}>} stations
 * @returns {'FW'|'MF'}
 */
export function recommendPosition(stations) {
  const by = Object.fromEntries(stations.map((s) => [s.id, s.hearts * 10 + s.successes]));
  const best = ['shot', 'pass', 'dribble'].reduce((a, b) => ((by[b] ?? 0) > (by[a] ?? 0) ? b : a));
  return best === 'pass' ? 'MF' : 'FW';
}

/**
 * Seçme performansının başlangıç özelliklerine katkısı: her istasyonda kalan hak = ilgili özellikte +1.
 * @returns {Record<string, number>}
 */
export function tryoutStatBonus(report) {
  const out = {};
  for (const s of report.stations) out[s.statKey] = (out[s.statKey] || 0) + s.hearts;
  return out;
}

/** Test/otomatik oynatma: istasyonu verilen başarı olasılığıyla oynatır. */
export function simulateStation(session, pSuccess, rnd = Math.random) {
  if (session.isWarmup()) session.record(rnd() < pSuccess);
  while (!session.state()?.done) session.record(rnd() < pSuccess);
  return session.finishStation();
}
