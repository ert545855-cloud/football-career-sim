// YEREL KÜLTÜR — ülkeye göre stadyum dili (pankartlar, reklam panoları), arkadaş/sevgili adları ve mekânlar.
//   Maçta pankart ve panolar EV SAHİBİ kulübün ülkesine göre; sosyal hayattaki kişiler oyuncunun yaşadığı ülkeye göre.
//   Markalar kurgusaldır (gerçek şirket adı kullanılmaz); renkler her dilde aynı sırada.
import { COUNTRY_BY_ID } from './countries.js';
import { poolFor } from './names.js';

/** Ülke → stadyum dili */
export const STADIUM_LANG = {
  tr: 'tr', en: 'en', sc: 'en', wa: 'en', us: 'en', ca: 'en', za: 'en', ng: 'en',
  es: 'es', ar: 'es', de: 'de', ch: 'de', it: 'it', fr: 'fr', pt: 'pt', br: 'br',
  dk: 'da', ru: 'ru', ua: 'uk', gr: 'el', ro: 'ro', pl: 'pl', cn: 'zh', sa: 'ar', eg: 'ar', ma: 'ar', jp: 'ja', kr: 'ko',
};

/**
 * Pankartlar: [sonuna kadar, hep seninleyiz, şampiyon {fan}, {city} burada, bu tribün susmaz, {fan} deplasmanda]
 */
const BANNERS = {
  tr: ['SONUNA KADAR', 'HEP SENİNLEYİZ', 'ŞAMPİYON {fan}', '{city} BURADA', 'BU TRİBÜN SUSMAZ', '{fan} DEPLASMANDA'],
  en: ['UNTIL THE END', 'ALWAYS WITH YOU', '{fan} CHAMPIONS', '{city} IS HERE', 'THIS STAND NEVER SLEEPS', '{fan} ON THE ROAD'],
  es: ['HASTA EL FINAL', 'SIEMPRE CONTIGO', '{fan} CAMPEÓN', '{city} PRESENTE', 'ESTA GRADA NO SE CALLA', '{fan} DE VISITANTE'],
  de: ['BIS ZUM SCHLUSS', 'IMMER AN DEINER SEITE', '{fan} MEISTER', '{city} IST DA', 'DIESE KURVE SCHWEIGT NIE', '{fan} AUSWÄRTS'],
  it: ['FINO ALLA FINE', 'SEMPRE CON TE', '{fan} CAMPIONE', '{city} È QUI', 'QUESTA CURVA NON TACE', '{fan} IN TRASFERTA'],
  fr: ['JUSQU\'AU BOUT', 'TOUJOURS AVEC TOI', '{fan} CHAMPION', '{city} EST LÀ', 'CETTE TRIBUNE NE SE TAIT JAMAIS', '{fan} EN DÉPLACEMENT'],
  pt: ['ATÉ AO FIM', 'SEMPRE CONTIGO', '{fan} CAMPEÃO', '{city} PRESENTE', 'ESTA BANCADA NÃO SE CALA', '{fan} FORA DE CASA'],
  br: ['ATÉ O FIM', 'SEMPRE COM VOCÊ', '{fan} CAMPEÃO', '{city} PRESENTE', 'ESSA TORCIDA NÃO SE CALA', '{fan} FORA DE CASA'],
  da: ['TIL DET SIDSTE', 'ALTID MED JER', '{fan} ER MESTRE', '{city} ER HER', 'DENNE TRIBUNE TIER ALDRIG', '{fan} PÅ UDEBANE'],
  ru: ['ДО КОНЦА', 'ВСЕГДА С ТОБОЙ', '{fan} – ЧЕМПИОН', '{city} ЗДЕСЬ', 'ЭТА ТРИБУНА НЕ МОЛЧИТ', '{fan} НА ВЫЕЗДЕ'],
  uk: ['ДО КІНЦЯ', 'ЗАВЖДИ З ТОБОЮ', '{fan} – ЧЕМПІОН', '{city} ТУТ', 'ЦЯ ТРИБУНА НЕ МОВЧИТЬ', '{fan} НА ВИЇЗДІ'],
  el: ['ΩΣ ΤΟ ΤΕΛΟΣ', 'ΠΑΝΤΑ ΜΑΖΙ ΣΟΥ', '{fan} ΠΡΩΤΑΘΛΗΤΗΣ', '{city} ΠΑΡΩΝ', 'Η ΚΕΡΚΙΔΑ ΔΕ ΣΩΠΑΙΝΕΙ', '{fan} ΕΚΤΟΣ ΕΔΡΑΣ'],
  ro: ['PÂNĂ LA CAPĂT', 'MEREU CU TINE', '{fan} CAMPIONII', '{city} E AICI', 'PELUZA NU TACE', '{fan} ÎN DEPLASARE'],
  pl: ['DO KOŃCA', 'ZAWSZE Z TOBĄ', '{fan} MISTRZ', '{city} JEST TU', 'TA TRYBUNA NIE MILCZY', '{fan} NA WYJEŹDZIE'],
  zh: ['坚持到底', '永远支持你', '{fan} 冠军', '{city} 在此', '看台永不沉默', '{fan} 客场助威'],
  ar: ['حتى النهاية', 'معك دائماً', '{fan} البطل', '{city} هنا', 'المدرجات لا تصمت', '{fan} خارج الديار'],
  ja: ['最後まで', 'いつも共に', '{fan} 王者', '{city} ここにあり', 'このスタンドは黙らない', '{fan} アウェー遠征'],
  ko: ['끝까지', '언제나 함께', '{fan} 챔피언', '{city} 여기 있다', '이 함성은 멈추지 않는다', '{fan} 원정 응원'],
};

/** Reklam panoları (kurgusal markalar) — SPONSORS ile aynı sıra ve renkler */
const BRANDS = {
  tr: ['NEW FOOTBALL STARS', 'TURBO KOLA', 'YILDIZ BANK', 'PİKSEL TELEKOM', 'GOL TV', 'ATLAS LASTİK', 'MAVİ HAVAYOLU', 'KRAMPON SPOR', 'ŞİMŞEK ENERJİ', 'DEV MARKET'],
  en: ['NEW FOOTBALL STARS', 'TURBO COLA', 'STAR BANK', 'PIXEL TELECOM', 'GOAL TV', 'ATLAS TYRES', 'BLUE AIRWAYS', 'KRAMPON SPORT', 'BOLT ENERGY', 'GIANT MARKET'],
  es: ['NEW FOOTBALL STARS', 'TURBO COLA', 'BANCO ESTRELLA', 'PÍXEL TELECOM', 'GOL TV', 'NEUMÁTICOS ATLAS', 'AEROLÍNEAS CIELO', 'KRAMPON SPORT', 'ENERGÍA RAYO', 'SÚPER GIGANTE'],
  de: ['NEW FOOTBALL STARS', 'TURBO COLA', 'STERN BANK', 'PIXEL TELEKOM', 'TOR TV', 'ATLAS REIFEN', 'BLAU AIR', 'KRAMPON SPORT', 'BLITZ ENERGIE', 'RIESEN MARKT'],
  it: ['NEW FOOTBALL STARS', 'TURBO COLA', 'BANCA STELLA', 'PIXEL TELECOM', 'GOL TV', 'PNEUMATICI ATLAS', 'CIELO AIRLINES', 'KRAMPON SPORT', 'ENERGIA FULMINE', 'SUPER GIGANTE'],
  fr: ['NEW FOOTBALL STARS', 'TURBO COLA', 'BANQUE ÉTOILE', 'PIXEL TÉLÉCOM', 'BUT TV', 'PNEUS ATLAS', 'AIR CIEL', 'KRAMPON SPORT', 'ÉCLAIR ÉNERGIE', 'GÉANT MARCHÉ'],
  pt: ['NEW FOOTBALL STARS', 'TURBO COLA', 'BANCO ESTRELA', 'PIXEL TELECOM', 'GOLO TV', 'PNEUS ATLAS', 'AÉREA CELESTE', 'KRAMPON SPORT', 'ENERGIA RAIO', 'SUPER GIGANTE'],
  br: ['NEW FOOTBALL STARS', 'TURBO COLA', 'BANCO ESTRELA', 'PIXEL TELECOM', 'GOL TV', 'PNEUS ATLAS', 'AÉREA CELESTE', 'KRAMPON SPORT', 'ENERGIA RAIO', 'SUPER GIGANTE'],
  da: ['NEW FOOTBALL STARS', 'TURBO COLA', 'STJERNE BANK', 'PIXEL TELE', 'MÅL TV', 'ATLAS DÆK', 'BLÅ AIR', 'KRAMPON SPORT', 'LYN ENERGI', 'KÆMPE MARKED'],
  ru: ['NEW FOOTBALL STARS', 'ТУРБО КОЛА', 'ЗВЕЗДА БАНК', 'ПИКСЕЛЬ ТЕЛЕКОМ', 'ГОЛ ТВ', 'АТЛАС ШИНЫ', 'СИНИЕ АВИАЛИНИИ', 'KRAMPON SPORT', 'МОЛНИЯ ЭНЕРДЖИ', 'ГИГАНТ МАРКЕТ'],
  uk: ['NEW FOOTBALL STARS', 'ТУРБО КОЛА', 'ЗІРКА БАНК', 'ПІКСЕЛЬ ТЕЛЕКОМ', 'ГОЛ ТБ', 'АТЛАС ШИНИ', 'СИНІ АВІАЛІНІЇ', 'KRAMPON SPORT', 'БЛИСКАВКА ЕНЕРДЖІ', 'ГІГАНТ МАРКЕТ'],
  el: ['NEW FOOTBALL STARS', 'TURBO COLA', 'ΤΡΑΠΕΖΑ ΑΣΤΕΡΙ', 'PIXEL TELECOM', 'ΓΚΟΛ TV', 'ΕΛΑΣΤΙΚΑ ATLAS', 'ΜΠΛΕ ΑΕΡΟΓΡΑΜΜΕΣ', 'KRAMPON SPORT', 'ΚΕΡΑΥΝΟΣ ENERGY', 'ΓΙΓΑΣ ΜΑΡΚΕΤ'],
  ro: ['NEW FOOTBALL STARS', 'TURBO COLA', 'BANCA ASTRU', 'PIXEL TELECOM', 'GOL TV', 'ANVELOPE ATLAS', 'AER ALBASTRU', 'KRAMPON SPORT', 'ENERGIE FULGER', 'GIGANT MARKET'],
  pl: ['NEW FOOTBALL STARS', 'TURBO COLA', 'BANK GWIAZDA', 'PIKSEL TELEKOM', 'GOL TV', 'OPONY ATLAS', 'NIEBIESKIE LINIE', 'KRAMPON SPORT', 'ENERGIA PIORUN', 'MEGA MARKET'],
  zh: ['NEW FOOTBALL STARS', '涡轮可乐', '星辰银行', '像素电信', '进球电视', '阿特拉斯轮胎', '蓝天航空', 'KRAMPON SPORT', '闪电能量', '巨人超市'],
  ar: ['NEW FOOTBALL STARS', 'توربو كولا', 'بنك النجمة', 'بيكسل للاتصالات', 'قناة جول', 'إطارات أطلس', 'الطيران الأزرق', 'KRAMPON SPORT', 'طاقة البرق', 'هايبر العملاق'],
  ja: ['NEW FOOTBALL STARS', 'ターボコーラ', 'スター銀行', 'ピクセル通信', 'ゴールTV', 'アトラスタイヤ', 'ブルー航空', 'KRAMPON SPORT', 'イナズマエナジー', 'ジャイアントマート'],
  ko: ['NEW FOOTBALL STARS', '터보콜라', '스타은행', '픽셀텔레콤', '골TV', '아틀라스타이어', '블루항공', 'KRAMPON SPORT', '번개에너지', '자이언트마트'],
};

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const UP = { tr: 'tr', el: 'el', ru: 'ru', uk: 'uk', ro: 'ro', pl: 'pl', de: 'de', da: 'da' };
export const upLocal = (s, lang) => String(s || '').toLocaleUpperCase(UP[lang] || 'en');

/** Ev sahibi ülkenin dili */
export const stadiumLang = (cc) => STADIUM_LANG[cc] || 'en';

/** Tribün pankartları (ev sahibi ülkesinin dilinde) */
export function bannerTexts(cc, { home = '', fan = '', city = '' } = {}) {
  const lang = stadiumLang(cc);
  const B = BANNERS[lang] || BANNERS.en;
  const v = { fan: upLocal(fan, lang), city: upLocal(city, lang) };
  return [upLocal(home, lang), B[0], fill(B[2], v).trim(), B[1], fill(B[3], v), B[4]];
}

/** Deplasman tribünü pankartı: deplasman taraftarının ülkesinin dilinde */
export function awayBanner(cc, fan) {
  const lang = stadiumLang(cc);
  const B = BANNERS[lang] || BANNERS.en;
  return fill(B[5], { fan: upLocal(fan, lang) });
}

/** Reklam panosu metinleri (ev sahibi ülkesinin dilinde) */
export const brandTexts = (cc) => BRANDS[stadiumLang(cc)] || BRANDS.en;

// ─────────────────────────── Sosyal hayat: kişiler ───────────────────────────

/** Kadın adları (sevgili adayları); erkek adları oyuncu havuzundan */
const FEMALE = {
  tr: ['Zeynep', 'Elif', 'Melis', 'Ece', 'Defne', 'Selin'],
  en: ['Emily', 'Sophie', 'Chloe', 'Grace', 'Hannah', 'Lucy'],
  sc: ['Isla', 'Eilidh', 'Kirsty', 'Morag', 'Fiona', 'Ailsa'],
  wa: ['Cerys', 'Seren', 'Ffion', 'Megan', 'Nia', 'Carys'],
  us: ['Madison', 'Ashley', 'Kayla', 'Taylor', 'Brooke', 'Jenna'],
  ca: ['Chloé', 'Léa', 'Avery', 'Brooklyn', 'Camille', 'Maya'],
  za: ['Thandi', 'Lerato', 'Naledi', 'Zanele', 'Ayanda', 'Palesa'],
  ng: ['Chiamaka', 'Adaeze', 'Funmi', 'Ngozi', 'Temitope', 'Amara'],
  es: ['Lucía', 'Carmen', 'Paula', 'Marta', 'Alba', 'Elena'],
  ar: ['Sofía', 'Valentina', 'Camila', 'Martina', 'Lucía', 'Florencia'],
  de: ['Lena', 'Hannah', 'Lea', 'Anna', 'Leonie', 'Johanna'],
  it: ['Giulia', 'Chiara', 'Francesca', 'Martina', 'Sara', 'Alessia'],
  fr: ['Camille', 'Léa', 'Manon', 'Chloé', 'Inès', 'Juliette'],
  pt: ['Beatriz', 'Inês', 'Mariana', 'Leonor', 'Carolina', 'Matilde'],
  br: ['Ana Clara', 'Larissa', 'Juliana', 'Gabriela', 'Fernanda', 'Bianca'],
  dk: ['Freja', 'Ida', 'Emma', 'Clara', 'Sofie', 'Laura'],
  ru: ['Anastasia', 'Daria', 'Polina', 'Ksenia', 'Alina', 'Yekaterina'],
  ua: ['Oksana', 'Iryna', 'Olena', 'Yulia', 'Sofiia', 'Khrystyna'],
  gr: ['Eleni', 'Maria', 'Katerina', 'Despina', 'Georgia', 'Ioanna'],
  ro: ['Ioana', 'Andreea', 'Elena', 'Bianca', 'Alexandra', 'Diana'],
  pl: ['Zuzanna', 'Julia', 'Maja', 'Natalia', 'Aleksandra', 'Wiktoria'],
  cn: ['Mei', 'Xiu', 'Lan', 'Yun', 'Ting', 'Jing'],
  sa: ['Noura', 'Reem', 'Lama', 'Sara', 'Hala', 'Dana'],
  eg: ['Nour', 'Mariam', 'Salma', 'Farida', 'Yasmin', 'Habiba'],
  ma: ['Salma', 'Imane', 'Kawtar', 'Hajar', 'Nisrine', 'Yasmine'],
  jp: ['Yui', 'Sakura', 'Haruka', 'Misaki', 'Aoi', 'Rin'],
  kr: ['Ji-woo', 'Seo-yeon', 'Min-ji', 'Ha-eun', 'Su-bin', 'Ye-jin'],
};

/** Ülkenin isim havuzu (country.lang) */
export const nameLangOf = (cc) => COUNTRY_BY_ID[cc]?.lang || 'tr';

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/**
 * Kişinin bu ülkedeki adı (tekrarlanabilir). Türkiye'de kişinin kendi adı korunur.
 * @returns {{name:string, full:string}}
 */
export function localPerson(person, cc, idx = 0) {
  if (!cc || cc === 'tr') return { name: person.baseName || person.name, full: person.baseFull || person.full };
  const lang = nameLangOf(cc);
  const pool = poolFor(lang);
  const h = hash(`${person.id}|${cc}`);
  const first = person.fem ? (FEMALE[lang] || FEMALE.en)[(idx + h) % (FEMALE[lang] || FEMALE.en).length] : pool.first[(h + idx * 7) % pool.first.length];
  const last = pool.last[(h >>> 7) % pool.last.length];
  return { name: first, full: pool.order === 'lf' ? `${last} ${first}` : `${first} ${last}` };
}
