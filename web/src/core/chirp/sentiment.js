// @ts-check
// Sözlük tabanlı Türkçe duygu analizi (çevrimdışı, hızlı, açıklanabilir).
// Kelime kökleri ön ek eşleşmesiyle aranır (başarı → başarılar), "değil" olumsuzluğu çevirir,
// çok kelimeli ifadeler önce yakalanır ("hak etmiyor", "geçmiş olsun").

/** @typedef {'positive'|'negative'|'neutral'} SentimentLabel */
/** @typedef {{label: SentimentLabel, score: number, hits: string[]}} SentimentResult */

const PHRASES = {
  'hak ediyor': 1.5, 'hak etmiyor': -2, 'hak edilmiş': 2, 'hoş geldin': 2, 'geçmiş olsun': 1, 'çabuk dön': 1.5,
  'başka seviye': 2, 'devamı gelsin': 1.5, 'maçın adamı': 2, 'şans verin': 1, 'helal olsun': 2,
  'para için': -1, 'hayal kırıklığı': -2, 'zor durumda': -1.5, 'cam adam': -2, 'yarı yolda': -1.5,
  'ağzına sahip': -1.5, 'profesyonellik bu mu': -2, 'gurur duyuyoruz': 2,
};

const STEMS = {
  // olumlu
  harika: 2, efsane: 2, gurur: 2, başarı: 1.5, layık: 1.5, haklı: 1.5, kral: 1.5, arkanday: 2, arkasınday: 2,
  destek: 1.5, desteğ: 1.5, inşallah: 1, hadi: 0.5, sabır: 1, sabr: 1, güçlü: 1.5, yıldız: 1, muhteşem: 2,
  bravo: 2, tebrik: 2, helal: 2, cesur: 1.5, özgüven: 1.5, akıllıca: 1.5, örnek: 1, alçakgönüllü: 1.5,
  kazanır: 1, değer: 1, önemli: 0.5, bekliyor: 0.5, çalışkan: 1.5, yetene: 1.5, inanc: 1.5, inanç: 1.5,
  terlet: 0.5, bomba: 1.5, doğru: 1, profesyonel: 1, iyi: 1, süper: 2, mükemmel: 2,
  '🔥': 1, '👑': 1, '💪': 1, '🙌': 1, '👏': 1, '🙏': 1, '🏆': 1,
  // olumsuz
  balon: -2, sıfır: -1.5, yük: -1.5, rezalet: -2.5, abart: -1.5, yedek: -1, ısıtır: -1, sat: -1, şaka: -1.5,
  gereksiz: -1.5, klişe: -1.5, samimiyetsiz: -2, kibir: -2, ego: -1.5, tavan: -0.5, yerlerde: -1.5,
  saygısızlık: -2, ceza: -1, suç: -1, ayıp: -2, sakat: -1, kötü: -1.5, bitti: -1, bencil: -2, zarar: -2,
  yeter: -1.5, tembel: -2, torpil: -2, şike: -2, zayıf: -1.5, eksik: -1, eksiğ: -1, olmaz: -1.5, olunmaz: -1.5,
  hata: -1, yazık: -1.5, sevilmez: -1.5, yetersiz: -2, haksızlık: -2, rezil: -2,
  '😡': -1, '👎': -1, '🤡': -1,
};

const STEM_KEYS = Object.keys(STEMS).sort((a, b) => b.length - a.length);
const NEGATORS = new Set(['değil', 'değildi']);

/**
 * @param {string} text
 * @returns {SentimentResult}
 */
export function analyzeSentiment(text) {
  let s = ` ${String(text).toLocaleLowerCase('tr').replace(/\{[^}]*\}/g, ' ')} `;
  let score = 0;
  const hits = [];
  for (const [phrase, val] of Object.entries(PHRASES)) {
    if (s.includes(phrase)) {
      score += val;
      hits.push(phrase);
      s = s.split(phrase).join(' ');
    }
  }
  const tokens = s
    .replace(/([🔥👑💪🙌👏🙏🏆😡👎🤡])/gu, ' $1 ')
    .split(/[\s.,!?;:"'()…-]+/u)
    .filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const stem = STEM_KEYS.find((k) => tok.startsWith(k));
    if (!stem) continue;
    let v = STEMS[stem];
    if (NEGATORS.has(tokens[i + 1])) v = -v;
    score += v;
    hits.push(stem);
  }
  const label = score > 0.25 ? 'positive' : score < -0.25 ? 'negative' : 'neutral';
  return { label, score: Math.round(score * 10) / 10, hits };
}

/**
 * Bir grup yorumun özet nabzı (yüzde olumlu).
 * @param {Array<{sentiment:{label:SentimentLabel}}>} comments
 */
export function moodOf(comments) {
  if (!comments.length) return { positive: 0, negative: 0, neutral: 0, share: 0.5 };
  const c = { positive: 0, negative: 0, neutral: 0 };
  for (const x of comments) c[x.sentiment.label]++;
  return { ...c, share: c.positive / comments.length };
}
