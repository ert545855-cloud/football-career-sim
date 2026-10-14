// @ts-check
// Türkçe hal ekleri: "Yılmaz'ın", "Arda'nın", "Boğaziçi SK'ya", "Başkent Gücü'ne".
// Şablonlarda isimler değiştiği için ekin ünlü uyumuna göre seçilmesi gerekir.

const VOWELS = 'aeıioöuü';
/** Kısaltma harflerinin okunuşu (SK → "se-ka" → son ses "a"). */
const LETTER_SOUND = {
  a: 'a', b: 'be', c: 'ce', ç: 'çe', d: 'de', e: 'e', f: 'fe', g: 'ge', ğ: 'ğe', h: 'ha', ı: 'ı', i: 'i', j: 'je', k: 'ka', l: 'le',
  m: 'me', n: 'ne', o: 'o', ö: 'ö', p: 'pe', r: 're', s: 'se', ş: 'şe', t: 'te', u: 'u', ü: 'ü', v: 've', y: 'ye', z: 'ze',
};

const lower = (s) => s.toLocaleLowerCase('tr');

/** Son kelimenin "okunuşu": kısaltmaysa (SK, FK) harf harf okunur. */
function spoken(name) {
  const last = String(name).trim().split(/\s+/).pop() || '';
  const isAbbr = last.length >= 2 && last.length <= 4 && last === last.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(last);
  if (isAbbr) return lower(last).split('').map((ch) => LETTER_SOUND[ch] || ch).join('');
  // Yabancı aksanlı ünlüler (División, Série) Türkçe okunuşa çevrilir
  return lower(last).replace(/[áàâ]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íìî]/g, 'i').replace(/[óòô]/g, 'o').replace(/[úùû]/g, 'u');
}

function lastVowel(word) {
  for (let i = word.length - 1; i >= 0; i--) if (VOWELS.includes(word[i])) return word[i];
  return 'e';
}
const endsWithVowel = (word) => VOWELS.includes(word[word.length - 1]);

/** Büyük ünlü uyumu: a/e */
const twoWay = (v) => ('aıou'.includes(v) ? 'a' : 'e');
/** Küçük ünlü uyumu: ı/i/u/ü */
const fourWay = (v) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }[v] || 'i');

/**
 * Tamlayan (-ın/-nın): "Arda" → "Arda'nın", "Yılmaz" → "Yılmaz'ın", "Boğaziçi SK" → "Boğaziçi SK'nın"
 * @param {string} name
 */
export function genitive(name) {
  const w = spoken(name);
  return `${name}'${endsWithVowel(w) ? 'n' : ''}${fourWay(lastVowel(w))}n`;
}

/**
 * Belirtme (-ı/-yı): "Arda" → "Arda'yı", "Yılmaz" → "Yılmaz'ı"
 * @param {string} name
 */
export function accusative(name) {
  const w = spoken(name);
  return `${name}'${endsWithVowel(w) ? 'y' : ''}${fourWay(lastVowel(w))}`;
}

/**
 * Bulunma (-da/-de/-ta/-te): "Premier Lig" → "Premier Lig'de", "Serie A" → "Serie A'da", "Botola Pro" → "Botola Pro'da"
 * @param {string} name
 */
export function locative(name) {
  const w = spoken(name);
  const hard = 'çfhkpsşt'.includes(w[w.length - 1]);
  return `${name}'${hard ? 't' : 'd'}${twoWay(lastVowel(w))}`;
}

/**
 * Yönelme (-a/-ya/-na): "Datça Spor" → "Datça Spor'a", "Boğaziçi SK" → "Boğaziçi SK'ya",
 * "Başkent Gücü" → "Başkent Gücü'ne" (iyelik ekli tamlama "n" kaynaştırması alır)
 * @param {string} name
 */
export function dative(name) {
  const w = spoken(name);
  const last = String(name).trim().split(/\s+/).pop() || '';
  const isAbbr = last === last.toLocaleUpperCase('tr') && last.length <= 4;
  const v = lastVowel(w);
  if (!endsWithVowel(w)) return `${name}'${twoWay(v)}`;
  // Kartalları, Fırtınası, Gücü gibi iyelik ekli kelimeler (ı/i/u/ü ile biten, kısaltma olmayan) → -na/-ne
  if (!isAbbr && 'ıiuü'.includes(w[w.length - 1]) && w.length > 3) return `${name}'n${twoWay(v)}`;
  return `${name}'y${twoWay(v)}`;
}

/** {player}, {club} gibi yer tutucuları doldurur. Ekli biçimler: {player:gen}, {club:dat}, {player:acc} */
export function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)(?::(gen|dat|acc|loc))?\}/g, (_, key, suffix) => {
    const v = vars[key];
    if (v == null) return '';
    if (suffix === 'gen') return genitive(String(v));
    if (suffix === 'dat') return dative(String(v));
    if (suffix === 'acc') return accusative(String(v));
    if (suffix === 'loc') return locative(String(v));
    return String(v);
  });
}
