// SOSYAL MEDYA DİLİ — 'tr': her şey Türkçe (yabancı taraftar yorumu ve gönderisi yok, eski kayıtlardaki
// yabancı yorumlar gizlenir); 'orig': yabancı taraftarlar kendi dillerinde yazar. Ayarlar'dan seçilir.
let MODE = 'tr';
export const setSocialLang = (m) => { MODE = m === 'orig' ? 'orig' : 'tr'; };
export const socialLang = () => MODE;
export const allTurkish = () => MODE === 'tr';

/** Eski kayıtlarda kalmış yabancı imzaları Türkçeye çevirir */
const SIGS = [["It's a deal!", 'İşte oldu!'], ['Affare fatto!', 'Anlaşma tamam!'], ['¡BOMBAZO!', 'BOMBA!'], ['EXCLUSIVE:', 'ÖZEL:']];
export function localizeText(text) {
  if (MODE !== 'tr' || !text) return text;
  let t = String(text);
  for (const [a, b] of SIGS) if (t.includes(a)) t = t.split(a).join(b);
  return t;
}
/** Yorum gösterilsin mi (Türkçe modda yabancı dildeki yorumlar gizlenir) */
export const showComment = (c) => MODE !== 'tr' || !c?.author?.lang || c.author.lang === 'tr';
