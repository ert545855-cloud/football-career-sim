// @ts-check
// CHIRP KİŞİLERİ — kurgusal/parodi yorumcular, kurum hesapları, kulüp resmi hesapları, taraftar grupları
// ve rastgele kullanıcılar (Türk ve yabancı). Gerçek kişilerin adı kullanılmaz; karakterler türün
// tanıdık tiplerinden esinlenmiş parodilerdir.
import { CLUB_BY_ID, COUNTRY_BY_ID } from '../data.js';
import { AuthorModel } from './models.js';
import { NAME_POOLS } from '../world/names.js';

/** Eski 10 numara, dobra yorumcu: her fırsatta Bursa deplasmanındaki frikiğini anlatır */
export const SERMET = new AuthorModel({
  id: 'sermet', displayName: 'Sermet Hoca', handle: '@SermetHoca10', kind: 'journalist', followers: 3_100_000, parody: true,
  bio: 'Eski 10 numara. Frikik benim işim, futbol benim hayatım. (Parodi hesap)',
  avatar: { color: '#7c2d12', look: { skin: 1, hair: 'short', hairColor: 4 }, kit: ['#1e293b', '#e2e8f0'] },
});
/** Tribün lideri: kaybedince linç, kazanınca destan */
export const GARDIYAN = new AuthorModel({
  id: 'gardiyan', displayName: 'Tribün Gardiyanı', handle: '@TribunGardiyani', kind: 'journalist', followers: 860_000, parody: true,
  bio: 'Tribünün sesi. Armaya ihanet affedilmez. (Parodi hesap)',
  avatar: { color: '#991b1b', look: { skin: 2, hair: 'buzz', hairColor: 0 }, kit: ['#111827', '#ef4444'] },
});
export const HAKEM = new AuthorModel({
  id: 'hakem', displayName: 'Eski Hakem Rıza', handle: '@PozisyonRiza', kind: 'journalist', followers: 540_000, parody: true,
  bio: 'Pozisyonu ben yorumlarım. VAR odasını en iyi ben bilirim. (Parodi hesap)',
  avatar: { color: '#0f172a', look: { skin: 1, hair: 'bald', hairColor: 4 }, kit: ['#facc15', '#111827'] },
});
export const VERI = new AuthorModel({
  id: 'veri', displayName: 'Veri Futbol', handle: '@VeriFutbol', kind: 'journalist', followers: 1_200_000,
  bio: 'Sayılar yalan söylemez. İstatistik, rekor, ilk.',
  avatar: { color: '#0891b2', initials: '📊' },
});
export const DEGER = new AuthorModel({
  id: 'deger', displayName: 'Piyasa Değeri TR', handle: '@PiyasaDegeriTR', kind: 'journalist', followers: 720_000,
  bio: 'Oyuncu değerleri, bonservisler, rekor transferler.',
  avatar: { color: '#15803d', initials: '€' },
});
export const CAPS = new AuthorModel({
  id: 'caps', displayName: 'Futbol Capsleri', handle: '@FutbolCapsleri', kind: 'journalist', followers: 2_700_000,
  bio: 'Gülmek bedava, ağlamak takımına bağlı. 😂',
  avatar: { color: '#f59e0b', initials: '😂' },
});
export const DUNYA = new AuthorModel({
  id: 'dunya', displayName: 'Dünya Futbolu', handle: '@DunyaFutboluTR', kind: 'journalist', followers: 1_900_000,
  bio: 'Avrupa\'nın ve dünyanın liglerinden sonuçlar, krizler, rekorlar.',
  avatar: { color: '#4338ca', initials: '🌍' },
});
export const AVRUPA = new AuthorModel({
  id: 'avrupa', displayName: 'Avrupa Kupaları', handle: '@AvrupaKupalari', kind: 'journalist', followers: 4_400_000,
  bio: 'Şampiyonlar Ligi, Avrupa Ligi ve Konferans Ligi resmi hesabı (oyun içi).',
  avatar: { color: '#1e3a8a', initials: '⭐' },
});
export const MILLI = new AuthorModel({
  id: 'milli', displayName: 'A Milli Takım', handle: '@AyYildizlilar', kind: 'journalist', followers: 5_200_000,
  bio: 'Milli takımlarımızın resmi hesabı (oyun içi).',
  avatar: { color: '#e30a17', initials: '☾★' },
});
/** İtalyan transfer muhabiri */
export const MATTEO = new AuthorModel({
  id: 'matteo', displayName: 'Matteo Mercato', handle: '@MatteoMercato', kind: 'journalist', signature: 'Affare fatto!', followers: 1_600_000, parody: true,
  bio: 'Calciomercato, sempre. (Parodi hesap)',
  avatar: { color: '#166534', look: { skin: 0, hair: 'curly', hairColor: 1 }, kit: ['#ffffff', '#166534'] },
});
/** İspanyol tartışma programı */
export const TERTULIA = new AuthorModel({
  id: 'tertulia', displayName: 'El Tertuliano', handle: '@ElTertulianoTV', kind: 'journalist', signature: '¡BOMBAZO!', followers: 2_200_000, parody: true,
  bio: 'Gritos, rumores y fútbol. (Parodi hesap)',
  avatar: { color: '#b91c1c', initials: '📺' },
});
/** İngiliz magazin spor sayfası */
export const FOOTY = new AuthorModel({
  id: 'footy', displayName: 'Footy Gossip UK', handle: '@FootyGossipUK', kind: 'journalist', signature: 'EXCLUSIVE:', followers: 3_000_000, parody: true,
  bio: 'Transfer talk & dressing-room drama. (Parodi hesap)',
  avatar: { color: '#1d4ed8', initials: 'FG' },
});

export const PERSONAS = { sermet: SERMET, gardiyan: GARDIYAN, hakem: HAKEM, veri: VERI, deger: DEGER, caps: CAPS, dunya: DUNYA, avrupa: AVRUPA, milli: MILLI, matteo: MATTEO, tertulia: TERTULIA, footy: FOOTY };

const slug = (s) => s.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

/** Kulübün resmi hesabı (tweet içinde anlık görüntü olarak saklanır) */
export function clubAuthor(clubId) {
  const c = CLUB_BY_ID[clubId];
  return { id: `club:${clubId}`, displayName: c.name, handle: `@${slug(c.short)}${c.country === 'tr' ? 'resmi' : 'official'}`, kind: 'club', verified: true, avatar: { crest: clubId } };
}

/** Kulübün taraftar grubu */
export function fanAuthor(clubId) {
  const c = CLUB_BY_ID[clubId];
  const names = c.country === 'tr' ? [`${c.short} Ultras`, `Kapalı Tribün ${c.short}`, `${c.city} Tayfa`] : [`${c.short} Ultras`, `${c.city} Supporters`, `Curva ${c.short}`];
  const name = names[[...c.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % names.length];
  return { id: `fans:${clubId}`, displayName: name, handle: `@${slug(name)}`, kind: 'fans', avatar: { color: c.colors[0], initials: c.short.slice(0, 2), ring: c.colors[1] } };
}

// ─────────────────────────── Rastgele kullanıcılar ───────────────────────────
const TR_HANDLES = ['tribun_sesi', 'ofsayt_bayragi', 'kale_arkasi', 'taktik_defteri', 'eski10numara', 'mert_analiz', 'penalti_noktasi', 'kornerden_gol',
  'aysefutbol', 'maraton_tribun', 'direkt_kirmizi', 'golcu_avcisi', 'uzatma_90', 'yanhakem_bayrak', 'cayci_hasan', 'dayi_futbol', 'futbolfilozofu',
  'kanka_takimi', 'sahaici_yorum', 'gece_yarisi_mac', 'emekli_forvet', 'statdan_selam', 'misli_dayi', 'kahveci_yorumcu', 'tv_karsisi'];
const TR_NAMES = ['Tribün Sesi', 'Ofsayt Bayrağı', 'Kale Arkası', 'Taktik Defteri', 'Eski Futbolcu Hasan', 'Analizci Mert', 'Penaltı Noktası', 'Korner Bayrağı',
  'Futbolsever Ayşe', 'Maraton Tribünü', 'Kırmızı Kart', 'Forvet Avcısı', 'Uzatma Dakikaları', 'Yan Hakem', 'Çaycı Hasan', 'Futbol Dayısı', 'Futbol Filozofu',
  'Kanka', 'Saha İçi', 'Gece Yarısı Maçı', 'Emekli Forvet', 'Stattan Selam', 'Kupon Dayı', 'Kahveci Yorumcu', 'TV Karşısı'];
const COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#f43f5e', '#22c55e', '#eab308', '#14b8a6', '#ec4899', '#64748b', '#0ea5e9'];
/** Yabancı kullanıcıların dilleri (yorum havuzu) ve bayrakları */
export const FOREIGN_LANGS = { en: '🇬🇧', es: '🇪🇸', pt: '🇧🇷', de: '🇩🇪', it: '🇮🇹', fr: '🇫🇷', ar: '🇸🇦', ru: '🇷🇺', jp: '🇯🇵', kr: '🇰🇷', ng: '🇳🇬' };
const LANG_POOL = { en: 'en', es: 'es', pt: 'br', de: 'de', it: 'it', fr: 'fr', ar: 'sa', ru: 'ru', jp: 'jp', kr: 'kr', ng: 'ng' };

/**
 * Rastgele kullanıcı. lang: 'tr' ya da yabancı dil kodu.
 * @param {() => number} rnd
 * @param {string} [lang]
 * @param {string} [clubShort]
 */
export function randomUser(rnd, lang = 'tr', clubShort = '') {
  const color = COLORS[Math.floor(rnd() * COLORS.length)];
  if (lang === 'tr') {
    if (clubShort && rnd() < 0.25) {
      return { displayName: `${clubShort} Tribünü`, handle: `@${slug(clubShort)}_tribun`, avatar: { color, initials: clubShort.slice(0, 2) } };
    }
    const i = Math.floor(rnd() * TR_NAMES.length);
    const num = rnd() < 0.4 ? String(Math.floor(rnd() * 90) + 10) : '';
    return { displayName: TR_NAMES[i], handle: `@${TR_HANDLES[i]}${num}`, avatar: { color, initials: TR_NAMES[i].split(' ').map((w) => w[0]).join('').slice(0, 2) } };
  }
  const pool = NAME_POOLS[LANG_POOL[lang] || 'en'];
  const first = pool.first[Math.floor(rnd() * pool.first.length)];
  const last = pool.last[Math.floor(rnd() * pool.last.length)];
  const name = pool.order === 'lf' ? `${last} ${first}` : `${first} ${last[0]}.`;
  return { displayName: `${name} ${FOREIGN_LANGS[lang] || ''}`.trim(), handle: `@${slug(first)}${slug(last).slice(0, 4)}${Math.floor(rnd() * 99)}`, avatar: { color, initials: `${first[0]}${last[0]}` }, lang };
}

/** Ülke bayrağı (kulüp hesabının yanında) */
export const flagOfClub = (clubId) => COUNTRY_BY_ID[CLUB_BY_ID[clubId]?.country]?.flag || '';
