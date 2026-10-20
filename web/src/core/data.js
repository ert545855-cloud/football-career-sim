// OYUN VERİSİ — denge ve içerik tek yerde. (Unity sürümündeki PositionPresets'in karşılığı)

export const STAT_KEYS = ['speed', 'shooting', 'passing', 'defending', 'stamina'];

export const STATS = {
  speed: { name: 'Hız', short: 'HIZ', color: '#38bdf8' },
  shooting: { name: 'Şut', short: 'ŞUT', color: '#fb923c' },
  passing: { name: 'Pas', short: 'PAS', color: '#a3e635' },
  defending: { name: 'Defans', short: 'DEF', color: '#c084fc' },
  stamina: { name: 'Dayanıklılık', short: 'DAY', color: '#facc15' },
};

export const POSITIONS = {
  FW: {
    id: 'FW',
    name: 'Forvet',
    short: 'FV',
    desc: 'Golcü. Şut ve hız öne çıkar; maçlarda daha çok şut pozisyonu gelir.',
    stats: { speed: 20, shooting: 25, passing: 12, defending: 5, stamina: 15 },
    primary: 'shooting',
    secondary: 'speed',
    ovr: { shooting: 0.4, speed: 0.3, passing: 0.15, stamina: 0.1, defending: 0.05 },
    moments: { shot: 0.44, pass: 0.28, attack: 0.18, tackle: 0.1 },
  },
  MF: {
    id: 'MF',
    name: 'Orta Saha',
    short: 'OS',
    desc: 'Oyun kurucu. Pas ve dayanıklılık öne çıkar; maçlarda daha çok pas pozisyonu gelir.',
    stats: { speed: 15, shooting: 12, passing: 25, defending: 10, stamina: 20 },
    primary: 'passing',
    secondary: 'stamina',
    ovr: { passing: 0.4, stamina: 0.25, speed: 0.15, shooting: 0.12, defending: 0.08 },
    moments: { pass: 0.46, shot: 0.2, attack: 0.16, tackle: 0.18 },
  },
  DF: {
    id: 'DF',
    name: 'Defans',
    short: 'DF',
    desc: 'Duvar. Defans ve dayanıklılık öne çıkar; maçlarda daha çok müdahale pozisyonu gelir.',
    stats: { speed: 12, shooting: 5, passing: 15, defending: 25, stamina: 22 },
    primary: 'defending',
    secondary: 'stamina',
    ovr: { defending: 0.45, stamina: 0.2, speed: 0.15, passing: 0.15, shooting: 0.05 },
    moments: { tackle: 0.6, pass: 0.3, shot: 0.1 },
  },
};

/** Mevki gelişim çarpanları: ana stat ×1.5, yan stat ×1.25. */
export const GROWTH = { primary: 1.5, secondary: 1.25, other: 1.0 };

/** Mini oyunların hangi statlarla oynandığı (ağırlıklar). */
export const GAME_WEIGHTS = {
  shot: { shooting: 1 },
  pass: { passing: 1 },
  tackle: { defending: 0.75, speed: 0.25 },
  dribble: { speed: 1 },
  attack: { passing: 0.35, speed: 0.3, shooting: 0.35 },
  shuttle: { stamina: 1 },
  interval: { stamina: 0.85, speed: 0.15 },
};

/** Antrenmanda hangi stat hangi mini oyunla çalışılır. */
export const TRAINING = {
  shooting: { game: 'shot', title: 'Şut Antrenmanı', hint: 'Topu kaleye doğru kaydır. Uzun kaydırma = sert ve yüksek şut.' },
  passing: { game: 'pass', title: 'Pas Antrenmanı', hint: 'Topa dokun ve arkadaşına doğru çiz; zaman yavaşlar. Kavis falsoya döner, uzun çizgi havadan gider. Rakibin etrafından dolaş ama oyalanma!' },
  defending: { game: 'tackle', title: 'Pas Arası Antrenmanı', hint: 'Rakipler paslaşıyor. Top sahibinin bakış çizgisi pasın nereye gideceğini gösterir (bazen sahte!). Sürükleyerek koridoru kapat, top yanından geçerken dokun: ayağını uzat.' },
  speed: { game: 'dribble', title: 'Adamı Geç', hint: 'Top ayağında ileri koşuyorsun. Sürükleyerek dubaların arasındaki boşluktan geç; rakip gelince bir yana yüklen, o gelince öbür yana kır!' },
  stamina: { game: 'interval', title: 'Kondisyon Parkuru (Nabız Koşusu)', hint: 'KOŞ\'a basılı tut: hızlan, bırak: yavaşla. Nabzını bölümün aralığında tut: TEMPO 115–145, SPRİNT 158–182. Kondisyonun düşükse nabız çabuk yükselir; sprintte tam gaz gidersen nefesin kesilir. Engellerde ZIPLA!' },
};

// Kurgusal kulüpler. rating = kulübün genel gücü (oyuncu OVR'si ile aynı ölçek).
export const CLUBS = [
  // Süper Lig — gerçek kulüpleri çağrıştıran kurgusal adlar ve benzer renkler (gerçek ad/arma kullanılmaz)
  { id: 'bog', name: 'İstanbul Aslan', short: 'ASL', fan: 'Aslan', league: 'super', rating: 79, colors: ['#a90432', '#fdb912'], pattern: 'half', city: 'İstanbul' },
  { id: 'aka', name: 'İstanbul Kartal', short: 'KRT', fan: 'Kartal', league: 'super', rating: 76, colors: ['#111111', '#f8fafc'], pattern: 'stripes', city: 'İstanbul' },
  { id: 'ege', name: 'İstanbul Kanarya', short: 'KNR', fan: 'Kanarya', league: 'super', rating: 72, colors: ['#163962', '#ffed00'], pattern: 'stripes', city: 'İstanbul' },
  { id: 'bas', name: 'İstanbul Baykuş', short: 'BYK', fan: 'Baykuş', league: 'super', rating: 70, colors: ['#f26522', '#1e2b5c'], pattern: 'solid', city: 'İstanbul' },
  { id: 'kfi', name: 'Karadeniz Fırtınası', short: 'KFI', fan: 'Fırtına', league: 'super', rating: 68, colors: ['#7a1e3a', '#4ea8de'], pattern: 'stripes', city: 'Trabzon' },
  { id: 'mun', name: 'Samsun Kırmızı Şimşek', short: 'SAM', fan: 'Şimşek', league: 'super', rating: 65, colors: ['#d6001c', '#ffffff'], pattern: 'solid', city: 'Samsun' },
  { id: 'tor', name: 'İzmir Sarı-Kırmızı', short: 'İZM', fan: 'Göz Göz', league: 'super', rating: 62, colors: ['#ffd200', '#c8102e'], pattern: 'half', city: 'İzmir' },
  { id: 'kap', name: 'Kayseri Anadolu Yıldızı', short: 'KAY', fan: 'Yıldız', league: 'super', rating: 60, colors: ['#ffd200', '#c8102e'], pattern: 'stripes', city: 'Kayseri' },
  { id: 'akd', name: 'Antalya Akrep', short: 'ANT', fan: 'Akrep', league: 'super', rating: 58, colors: ['#d6001c', '#ffffff'], pattern: 'stripes', city: 'Antalya' },
  { id: 'tra', name: 'Konya Selçuklu', short: 'KON', fan: 'Selçuklu', league: 'super', rating: 55, colors: ['#007a3d', '#ffffff'], pattern: 'hoops', city: 'Konya' },
  { id: 'fir', name: 'Sivas Yiğido', short: 'SİV', fan: 'Yiğido', league: 'super', rating: 53, colors: ['#c8102e', '#ffffff'], pattern: 'solid', city: 'Sivas' },
  { id: 'ulu', name: 'Bursa Timsah', short: 'BUR', fan: 'Timsah', league: 'super', rating: 50, colors: ['#00843d', '#ffffff'], pattern: 'stripes', city: 'Bursa' },

  // 1. Lig
  { id: 'pam', name: 'Kocaeli Körfez', short: 'KOC', fan: 'Körfez', league: 'first', rating: 45, colors: ['#007a3d', '#111111'], pattern: 'stripes', city: 'Kocaeli' },
  { id: 'kac', name: 'Rize Çaycılar', short: 'RİZ', fan: 'Çaycılar', league: 'first', rating: 43, colors: ['#00843d', '#1e73be'], pattern: 'half', city: 'Rize' },
  { id: 'efe', name: 'Ankara Gelincik', short: 'ANK', fan: 'Gelincik', league: 'first', rating: 41, colors: ['#c8102e', '#111111'], pattern: 'stripes', city: 'Ankara' },
  { id: 'nem', name: 'Erzurum Dadaş', short: 'ERZ', fan: 'Dadaş', league: 'first', rating: 39, colors: ['#0057b8', '#ffffff'], pattern: 'solid', city: 'Erzurum' },
  { id: 'has', name: 'Antep Şahin', short: 'ANP', fan: 'Şahin', league: 'first', rating: 37, colors: ['#d6001c', '#111111'], pattern: 'solid', city: 'Gaziantep' },
  { id: 'mnz', name: 'Eskişehir Es-Es', short: 'ESK', fan: 'Es-Es', league: 'first', rating: 35, colors: ['#c8102e', '#111111'], pattern: 'hoops', city: 'Eskişehir' },
  { id: 'agr', name: 'Sakarya Yeşil-Siyah', short: 'SAK', fan: 'Sakarya', league: 'first', rating: 34, colors: ['#00843d', '#111111'], pattern: 'hoops', city: 'Sakarya' },
  { id: 'har', name: 'Hatay Defne', short: 'HAT', fan: 'Defne', league: 'first', rating: 33, colors: ['#7a1e3a', '#ffffff'], pattern: 'solid', city: 'Hatay' },
  { id: 'sap', name: 'Manisa Tarzan', short: 'MAN', fan: 'Tarzan', league: 'first', rating: 31, colors: ['#111111', '#ffffff'], pattern: 'stripes', city: 'Manisa' },
  { id: 'dat', name: 'Bodrum Kale', short: 'BOD', fan: 'Bodrum', league: 'first', rating: 30, colors: ['#00843d', '#ffffff'], pattern: 'solid', city: 'Muğla' },
  { id: 'kiz', name: 'Ankara Başkent Gücü', short: 'BAŞ', fan: 'Başkent', league: 'first', rating: 28, colors: ['#ffd200', '#0b1d4f'], pattern: 'solid', city: 'Ankara' },
  { id: 'van', name: 'Diyarbakır Amed', short: 'AMD', fan: 'Amed', league: 'first', rating: 26, colors: ['#00843d', '#c8102e'], pattern: 'half', city: 'Diyarbakır' },
].map((c) => ({ ...c, country: 'tr' }));

const WORLD = generateWorld({ tr: CLUBS.map((c) => c.short) });

/** Dünyadaki tüm A takımları (Türkiye'nin Süper Lig + 1. Lig kulüpleri yukarıda, diğerleri üretilir) */
CLUBS.push(...WORLD.clubs);
import { generateWorld } from './world/generate.js';
import { COUNTRIES, COUNTRY_BY_ID } from './world/countries.js';

export { COUNTRIES, COUNTRY_BY_ID };


/**
 * Ligler: 28 ülkenin ilk 3 ligi (Türkiye'de 4) + Türkiye U-17 gelişim ligi.
 * tier = ülke içindeki kademe (1 = en üst). country = ülke kimliği.
 */
export const LEAGUES = {
  ...Object.fromEntries(WORLD.leagues.map((l) => [l.id, l])),
  /** Dev kulüplerin altyapı takımlarından oluşan gelişim ligi (Seçenek C) */
  u17: { id: 'u17', name: 'U-17 Gelişim Ligi', short: 'U17', tier: 3, level: 9, youth: true, country: 'tr' },
  // diğer ülkelerin U-17 ligleri (vatandaşlığa göre başlangıçta altyapı seçeneği)
  ...Object.fromEntries(COUNTRIES.filter((c) => c.id !== 'tr').map((c) => [`${c.id}u17`, { id: `${c.id}u17`, name: `${c.name} U-17 Ligi`, short: 'U17', tier: 3, level: 9, youth: true, country: c.id }])),
};

/** Ülkenin n. kademe ligi ve altyapı ligi */
export const leagueAt = (cc, level) => (cc === 'tr' ? ['super', 'first', 'tr2', 'tr3'][level - 1] : `${cc}${level}`);
export const youthLeagueOf = (cc) => (cc === 'tr' ? 'u17' : `${cc}u17`);


/**
 * Altyapı (U-17) takımları: Süper Lig kulüplerinin gençleri. Kendi liglerinde oynarlar,
 * transfer tekliflerine ve büyük kulüp listelerine girmezler (CLUBS yalnızca A takımları içerir).
 */
export const YOUTH_CLUBS = CLUBS.filter((c) => LEAGUES[c.league]?.tier === 1).map((c) => ({
  ...c,
  id: `${c.id}-u17`,
  name: `${c.name} U-17`,
  league: youthLeagueOf(c.country),
  rating: Math.round(16 + (c.rating - 50) * 0.35),
  parentId: c.id,
  youth: true,
}));

/** Lig tablosu ve fikstür üretimi için tüm takımlar (A takımları + altyapı) */
export const ALL_CLUBS = [...CLUBS, ...YOUTH_CLUBS];

export const CLUB_BY_ID = Object.fromEntries(ALL_CLUBS.map((c) => [c.id, c]));

/**
 * Bölgesel Amatör Lig (BAL) kulüpleri: yalnızca Türkiye Kupası'nın ön eleme turlarında oynarlar.
 * Lig tablolarına, transfer tekliflerine ve sıralamalara girmezler (CLUBS/ALL_CLUBS'ta değil, yalnız CLUB_BY_ID'de).
 */
export const AMATEUR_CLUBS = [
  ['akc', 'Akçakoca Dalga', 'AKC', 'Düzce', ['#0369a1', '#ffffff'], 'hoops'],
  ['ayv', 'Ayvalık Zeytin', 'AYV', 'Balıkesir', ['#4d7c0f', '#f8fafc'], 'solid'],
  ['baf', 'Bafra Ovası', 'BAF', 'Samsun', ['#b91c1c', '#facc15'], 'stripes'],
  ['byp', 'Beypazarı Gümüş', 'BYP', 'Ankara', ['#64748b', '#0f172a'], 'half'],
  ['bir', 'Birecik Kelaynak', 'BİR', 'Şanlıurfa', ['#111827', '#f97316'], 'solid'],
  ['bzy', 'Bozüyük Demiryolu', 'BZY', 'Bilecik', ['#1e3a8a', '#ef4444'], 'hoops'],
  ['cid', 'Cide Kayalar', 'CİD', 'Kastamonu', ['#0f766e', '#ffffff'], 'stripes'],
  ['dtc', 'Datça Badem', 'DAT', 'Muğla', ['#f8fafc', '#16a34a'], 'half'],
  ['dev', 'Devrek Baston', 'DEV', 'Zonguldak', ['#7c2d12', '#fde68a'], 'solid'],
  ['did', 'Didim Apollon', 'DİD', 'Aydın', ['#38bdf8', '#ffffff'], 'stripes'],
  ['elm', 'Elmalı Yayla', 'ELM', 'Antalya', ['#dc2626', '#16a34a'], 'half'],
  ['eme', 'Emet Bor', 'EME', 'Kütahya', ['#1d4ed8', '#e2e8f0'], 'solid'],
  ['erd', 'Erdek Martı', 'ERD', 'Balıkesir', ['#ffffff', '#0284c7'], 'hoops'],
  ['fin', 'Finike Portakal', 'FİN', 'Antalya', ['#f97316', '#14532d'], 'solid'],
  ['ger', 'Gerze Ayyıldız', 'GER', 'Sinop', ['#dc2626', '#ffffff'], 'stripes'],
  ['goy', 'Göynük Kartalkaya', 'GÖY', 'Bolu', ['#166534', '#f8fafc'], 'half'],
  ['hlf', 'Halfeti Gül', 'HLF', 'Şanlıurfa', ['#111111', '#be123c'], 'solid'],
  ['ine', 'İnebolu Liman', 'İNE', 'Kastamonu', ['#1e40af', '#facc15'], 'hoops'],
  ['kmy', 'Kemaliye Taşyol', 'KMY', 'Erzincan', ['#78350f', '#ffffff'], 'stripes'],
  ['kul', 'Kula Volkan', 'KUL', 'Manisa', ['#18181b', '#ef4444'], 'half'],
  ['kum', 'Kumluca Sera', 'KUM', 'Antalya', ['#22c55e', '#ffffff'], 'solid'],
  ['mud', 'Mudurnu Vadi', 'MUD', 'Bolu', ['#065f46', '#fbbf24'], 'stripes'],
  ['nik', 'Niksar Kale', 'NİK', 'Tokat', ['#7f1d1d', '#e2e8f0'], 'solid'],
  ['ort', 'Ortaca Kaplumbağa', 'ORT', 'Muğla', ['#0e7490', '#fde047'], 'hoops'],
  ['ode', 'Ödemiş Bozdağ', 'ÖDE', 'İzmir', ['#1f2937', '#22d3ee'], 'half'],
  ['sav', 'Şavşat Karagöl', 'ŞAV', 'Artvin', ['#0f172a', '#4ade80'], 'solid'],
  ['sef', 'Seferihisar Mandalina', 'SEF', 'İzmir', ['#fb923c', '#1e3a8a'], 'stripes'],
  ['sil', 'Silifke Kızkalesi', 'SİL', 'Mersin', ['#e11d48', '#f8fafc'], 'half'],
  ['snp', 'Sinop Burun', 'SİN', 'Sinop', ['#1d4ed8', '#ffffff'], 'stripes'],
  ['tas', 'Taşköprü Sarımsak', 'TAŞ', 'Kastamonu', ['#f8fafc', '#7c3aed'], 'solid'],
  ['tir', 'Tirebolu Fındık', 'TİR', 'Giresun', ['#15803d', '#a16207'], 'hoops'],
  ['uzk', 'Uzunköprü Kemer', 'UZU', 'Edirne', ['#991b1b', '#fef3c7'], 'stripes'],
  ['ylv', 'Yalvaç Antiokheia', 'YAL', 'Isparta', ['#9333ea', '#ffffff'], 'half'],
  ['zar', 'Zara Kızılırmak', 'ZAR', 'Sivas', ['#b91c1c', '#111827'], 'solid'],
  ['arh', 'Arhavi Horon', 'ARH', 'Artvin', ['#0c4a6e', '#f43f5e'], 'stripes'],
  ['kah', 'Kâhta Nemrut', 'KAH', 'Adıyaman', ['#a16207', '#0f172a'], 'hoops'],
].map(([id, name, short, city, colors, pattern], i) => ({ id: `bal-${id}`, name, short, city, colors, pattern, rating: 12 - Math.round((i * 7) / 35), country: 'tr', league: 'bal', tier: 5, amateur: true }));
for (const c of AMATEUR_CLUBS) CLUB_BY_ID[c.id] = c;

/** Pankart ve tezahüratlarda kulübün adı (kısaltma değil): taraftar adı ya da ekleri atılmış kulüp adı */
const NAME_AFFIX = /^(FC|SC|AC|AS|US|SS|CF|CD|UD|SD|RC|AJ|GD|SV|TSV|VfB|VfL|SpVgg|1\.|AFC|CPD|FK|SK|BK|IF|FF|B\.)$/i;
const NAME_SUFFIX = /\s+(FK|SK|FC|Spor|Gençlik|Belediyespor|İdman Yurdu|Gücü|United|City|Rovers|Athletic|Town|Wanderers|Albion|County|Thistle|Academicals|Calcio|CF|BK|IF|FF|Boldklub|U-17)$/i;
export function fanName(club) {
  if (!club) return '';
  if (club.fan) return club.fan;
  let n = String(club.name || '').replace(NAME_SUFFIX, '');
  const words = n.split(/\s+/);
  while (words.length > 1 && NAME_AFFIX.test(words[0])) words.shift();
  n = words.join(' ');
  for (const p of ['Real ', 'Atlético ', 'Racing ', 'Deportivo ', 'Borussia ', 'Eintracht ', 'Virtus ', 'Sporting ', 'Pro ', 'Olympique ', 'Stade ', 'En Avant ', 'Académico de ', 'Desportivo de ', 'União de ', 'Sporting de ', 'Dinamo ', 'Torpedo ', 'Spartak ', 'Lokomotiv ', 'Metallurg ', 'Zvezda ', 'Krylya ']) if (n.startsWith(p)) n = n.slice(p.length);
  return n || club.short;
}

export const SEASON_WEEKS = 22;
export const MID_WINDOW_WEEK = 11;
export const WEEK_SLOTS = 4;
export const LIVING_COST = 220;
export const START_MONEY = 1500;

/** Haftalık aksiyonlar. Antrenman mini oyunla oynanır; diğerleri anında sonuç verir. */
export const ACTIONS = [
  { id: 'train', name: 'Antrenman', icon: 'dumbbell', desc: 'Mini oyunla bir özelliğini geliştir', cost: '−18 enerji' },
  { id: 'rest', name: 'Dinlen', icon: 'bed', desc: '+30 enerji, +3 moral', cost: 'Bedava' },
  { id: 'team', name: 'Takımla Yemek', icon: 'users', desc: 'Takım arkadaşı ilişkisi ve moral', cost: '−€150 · −5 enerji' },
  { id: 'media', name: 'Taraftar & Medya', icon: 'mic', desc: 'İmza günü, sosyal medya: taraftar ve ün', cost: '−8 enerji' },
  { id: 'manager', name: 'Hocayla Görüş', icon: 'clipboard', desc: 'Forma durumunu öğren, ilişkini güçlendir', cost: '−3 enerji' },
  { id: 'sponsor', name: 'Reklam Çekimi', icon: 'camera', desc: 'Ün 20+ gerekir; para kazandırır', cost: '−12 enerji', minFame: 20 },
  { id: 'drill', name: 'Özel Çalışma', icon: 'target', desc: 'Zayıf ayak ya da beceri hareketleri (yıldız kazan)', cost: '−10 enerji' },
  { id: 'gym', name: 'Spor Salonu', icon: 'dumbbell', desc: 'Halter, dambıl, koşu bandı: kondisyon ve güç', cost: 'Kondisyon · Güç' },
];

export const MAX_TRAININGS_PER_WEEK = 3;

/**
 * Mağaza. cat: vehicle ve home kategorilerinde sadece en iyi eşya etki eder.
 * price: satın alma, weekly: haftalık gider (kira/abonelik/bakım).
 * kind: 'own' (sahip ol), 'sub' (abonelik), 'use' (tek kullanımlık).
 */
export const SHOP_CATEGORIES = [
  { id: 'style', name: 'Dolap' },
  { id: 'vehicle', name: 'Araçlar' },
  { id: 'home', name: 'Ev' },
  { id: 'health', name: 'Gelişim' },
  { id: 'life', name: 'Yaşam' },
];

export const SHOP_ITEMS = [
  { id: 'bike', cat: 'vehicle', kind: 'own', name: 'Şehir Bisikleti', price: 350, weekly: 0, fx: { morale: 1 }, art: 'bike', desc: 'Antrenmana pedal çevirerek git.' },
  { id: 'hatch', cat: 'vehicle', kind: 'own', name: 'İkinci El Hatchback', price: 7500, weekly: 30, fx: { morale: 2 }, art: 'car', tint: '#60a5fa', desc: 'Eski ama sağlam. Yağmurda ıslanmazsın.' },
  { id: 'sedan', cat: 'vehicle', kind: 'own', name: 'Elektrikli Sedan', price: 48000, weekly: 60, fx: { morale: 3, fans: 1 }, art: 'car', tint: '#e2e8f0', desc: 'Sessiz, hızlı, çevreci.' },
  { id: 'suv', cat: 'vehicle', kind: 'own', name: 'Lüks SUV', price: 125000, weekly: 200, fx: { morale: 4, fans: 1 }, art: 'suv', tint: '#111827', desc: 'Antrenman sahasına gösterişli giriş.' },
  { id: 'super', cat: 'vehicle', kind: 'own', name: 'Süper Spor Araba', price: 340000, weekly: 600, fx: { morale: 6, fans: 2, fame: 1 }, art: 'supercar', tint: '#ef4444', desc: 'Taraftar fotoğraf için sıraya girer.' },

  { id: 'studio', cat: 'home', kind: 'sub', name: 'Stüdyo Daire (Kira)', price: 0, weekly: 180, fx: { morale: 2, energy: 3 }, art: 'flat', desc: 'Kendine ait ilk evin. Daha iyi uyku.' },
  { id: 'flat', cat: 'home', kind: 'own', name: 'Site Dairesi', price: 220000, weekly: 150, fx: { morale: 4, energy: 5 }, art: 'building', desc: 'Havuzlu site, güvenlik, sessizlik.' },
  { id: 'penthouse', cat: 'home', kind: 'own', name: 'Deniz Manzaralı Rezidans', price: 750000, weekly: 400, fx: { morale: 6, energy: 7, fans: 1 }, art: 'tower', desc: 'Sabah kahvesi deniz manzarasıyla.' },
  { id: 'villa', cat: 'home', kind: 'own', name: 'Bahçeli Villa', price: 1800000, weekly: 900, fx: { morale: 8, energy: 9, fame: 1 }, art: 'house', desc: 'Özel spor salonu ve bahçe.' },

  { id: 'roller', cat: 'health', kind: 'own', name: 'Masaj Tabancası', price: 280, weekly: 0, fx: { energy: 3 }, art: 'massage', desc: 'Kaslar daha hızlı toparlanır.' },
  { id: 'analysis', cat: 'health', kind: 'own', name: 'Performans Analiz Yazılımı', price: 4500, weekly: 0, fx: { train: 0.1 }, art: 'tablet', desc: 'Antrenman verimi +%10.' },
  { id: 'nutrition', cat: 'health', kind: 'sub', name: 'Beslenme Koçu', price: 0, weekly: 350, fx: { energy: 5, train: 0.08 }, art: 'apple', desc: 'Doğru yakıt, daha çok enerji.' },
  { id: 'coach', cat: 'health', kind: 'sub', name: 'Kişisel Antrenör', price: 0, weekly: 900, fx: { train: 0.2 }, art: 'whistle', desc: 'Antrenman verimi +%20.' },
  { id: 'cryo', cat: 'health', kind: 'own', name: 'Ev Tipi Kriyoterapi', price: 65000, weekly: 50, fx: { energy: 8, morale: 1 }, art: 'snow', desc: 'Profesyonellerin toparlanma sırrı.' },

  { id: 'console', cat: 'life', kind: 'own', name: 'Oyun Konsolu', price: 550, weekly: 0, fx: { morale: 2 }, art: 'gamepad', desc: 'Takım arkadaşlarıyla online maçlar.' },
  { id: 'dog', cat: 'life', kind: 'own', name: 'Köpek Sahiplen', price: 400, weekly: 40, fx: { morale: 3 }, art: 'dog', desc: 'Her gün seni kapıda karşılayan bir dost.' },
  { id: 'watch', cat: 'life', kind: 'own', name: 'İsviçre Saati', price: 18000, weekly: 0, fx: { morale: 2, fans: 1 }, art: 'watch', desc: 'Basın toplantılarında dikkat çeker.' },
  { id: 'academy', cat: 'life', kind: 'own', name: 'Futbol Okulu Vakfı', price: 25000, weekly: 100, fx: { fans: 3, fame: 1, morale: 1 }, art: 'heart', desc: 'Memleketinde çocuklara futbol okulu.' },
  { id: 'spa', cat: 'life', kind: 'use', name: 'Spa Günü', price: 400, weekly: 0, use: { energy: 20 }, art: 'spa', desc: 'Anında +20 enerji.' },
  { id: 'trip', cat: 'life', kind: 'use', name: 'Hafta Sonu Kaçamağı', price: 1200, weekly: 0, use: { morale: 15 }, art: 'plane', desc: 'Anında +15 moral.' },
];

export const ITEM_BY_ID = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));

export const AVATAR = {
  skins: ['#f6d3b3', '#e8b58f', '#c98e62', '#9a6440', '#6b4329'],
  hairStyles: ['short', 'buzz', 'curly', 'long', 'mohawk', 'bald'],
  hairStyleNames: { short: 'Kısa', buzz: 'Asker', curly: 'Kıvırcık', long: 'Uzun', mohawk: 'Mohikan', bald: 'Kel' },
  hairColors: ['#1f1309', '#4a2c17', '#8b5a2b', '#d4a35a', '#e8e2d0', '#b23a1d'],
};

export const FIRST_NAMES = ['Arda', 'Kerem', 'Emir', 'Yusuf', 'Mert', 'Burak', 'Can', 'Efe', 'Barış', 'Ozan', 'Deniz', 'Kaan', 'Umut', 'Eren', 'Tuna', 'Alp'];
export const LAST_NAMES = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Koç', 'Kurt', 'Aksoy', 'Polat', 'Erdem', 'Tekin', 'Güneş'];
