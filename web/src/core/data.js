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
};

/** Antrenmanda hangi stat hangi mini oyunla çalışılır. */
export const TRAINING = {
  shooting: { game: 'shot', title: 'Şut Antrenmanı', hint: 'Topu kaleye doğru kaydır. Uzun kaydırma = sert ve yüksek şut.' },
  passing: { game: 'pass', title: 'Pas Antrenmanı', hint: 'Topa dokun ve arkadaşına doğru çiz; zaman yavaşlar. Kavis falsoya döner, uzun çizgi havadan gider. Rakibin etrafından dolaş ama oyalanma!' },
  defending: { game: 'tackle', title: 'Pas Arası Antrenmanı', hint: 'Rakipler paslaşıyor. Top sahibinin bakış çizgisi pasın nereye gideceğini gösterir (bazen sahte!). Sürükleyerek koridoru kapat, top yanından geçerken dokun: ayağını uzat.' },
  speed: { game: 'dribble', title: 'Adamı Geç', hint: 'Top ayağında ileri koşuyorsun. Sürükleyerek dubaların arasındaki boşluktan geç; rakip gelince bir yana yüklen, o gelince öbür yana kır!' },
  stamina: { game: 'shuttle', title: 'Mekik Koşusu (Bip Testi)', hint: 'KOŞ\'a basılı tut, bip\'ten önce çizgiye var. Çizgiye yaklaşınca DÖN\'e bas. Hızlı koşmak nefesi bitirir: tempoyu ayarla, erken varırsan bip\'i bekle.' },
};

// Kurgusal kulüpler. rating = kulübün genel gücü (oyuncu OVR'si ile aynı ölçek).
export const CLUBS = [
  { id: 'bog', name: 'Boğaziçi SK', short: 'BOĞ', league: 'super', rating: 79, colors: ['#c8102e', '#ffd200'], pattern: 'stripes', city: 'İstanbul' },
  { id: 'aka', name: 'Anadolu Kartalları', short: 'AKA', league: 'super', rating: 76, colors: ['#111827', '#f8fafc'], pattern: 'stripes', city: 'İstanbul' },
  { id: 'ege', name: 'Ege Yıldızları', short: 'EGE', league: 'super', rating: 72, colors: ['#1d4ed8', '#fbbf24'], pattern: 'solid', city: 'İzmir' },
  { id: 'bas', name: 'Başkent Gücü', short: 'BGÜ', league: 'super', rating: 70, colors: ['#7c2d12', '#facc15'], pattern: 'half', city: 'Ankara' },
  { id: 'kfi', name: 'Karadeniz Fırtınası', short: 'KFI', league: 'super', rating: 68, colors: ['#7f1d1d', '#38bdf8'], pattern: 'hoops', city: 'Trabzon' },
  { id: 'mun', name: 'Marmara United', short: 'MUN', league: 'super', rating: 65, colors: ['#065f46', '#f8fafc'], pattern: 'sash', city: 'Kocaeli' },
  { id: 'tor', name: 'Toros Spor', short: 'TOR', league: 'super', rating: 62, colors: ['#ea580c', '#1e293b'], pattern: 'solid', city: 'Adana' },
  { id: 'kap', name: 'Kapadokya FK', short: 'KAP', league: 'super', rating: 60, colors: ['#b91c1c', '#fde68a'], pattern: 'stripes', city: 'Kayseri' },
  { id: 'akd', name: 'Akdeniz Dalgası', short: 'AKD', league: 'super', rating: 58, colors: ['#0e7490', '#f8fafc'], pattern: 'hoops', city: 'Antalya' },
  { id: 'tra', name: 'Trakya Spor', short: 'TRA', league: 'super', rating: 55, colors: ['#4338ca', '#f8fafc'], pattern: 'half', city: 'Edirne' },
  { id: 'fir', name: 'Fırat FK', short: 'FIR', league: 'super', rating: 53, colors: ['#16a34a', '#111827'], pattern: 'stripes', city: 'Elazığ' },
  { id: 'ulu', name: 'Uludağ SK', short: 'ULU', league: 'super', rating: 50, colors: ['#f8fafc', '#2563eb'], pattern: 'sash', city: 'Bursa' },

  { id: 'pam', name: 'Pamukkale Spor', short: 'PAM', league: 'first', rating: 45, colors: ['#f1f5f9', '#dc2626'], pattern: 'solid', city: 'Denizli' },
  { id: 'kac', name: 'Kaçkar FK', short: 'KAÇ', league: 'first', rating: 43, colors: ['#15803d', '#fde047'], pattern: 'stripes', city: 'Rize' },
  { id: 'efe', name: 'Efes Gençlik', short: 'EFE', league: 'first', rating: 41, colors: ['#0369a1', '#f8fafc'], pattern: 'hoops', city: 'Aydın' },
  { id: 'nem', name: 'Nemrut SK', short: 'NEM', league: 'first', rating: 39, colors: ['#9a3412', '#fcd34d'], pattern: 'half', city: 'Adıyaman' },
  { id: 'has', name: 'Hasandağı FK', short: 'HAS', league: 'first', rating: 37, colors: ['#991b1b', '#f8fafc'], pattern: 'sash', city: 'Aksaray' },
  { id: 'mnz', name: 'Munzur Spor', short: 'MNZ', league: 'first', rating: 35, colors: ['#1e3a8a', '#f59e0b'], pattern: 'stripes', city: 'Tunceli' },
  { id: 'agr', name: 'Ağrı Dağı FK', short: 'AĞR', league: 'first', rating: 34, colors: ['#334155', '#f8fafc'], pattern: 'hoops', city: 'Ağrı' },
  { id: 'har', name: 'Harran SK', short: 'HAR', league: 'first', rating: 33, colors: ['#ca8a04', '#7c2d12'], pattern: 'solid', city: 'Şanlıurfa' },
  { id: 'sap', name: 'Sapanca FK', short: 'SAP', league: 'first', rating: 31, colors: ['#0f766e', '#f8fafc'], pattern: 'half', city: 'Sakarya' },
  { id: 'dat', name: 'Datça Spor', short: 'DAT', league: 'first', rating: 30, colors: ['#2563eb', '#f8fafc'], pattern: 'stripes', city: 'Muğla' },
  { id: 'kiz', name: 'Kızılırmak FK', short: 'KIZ', league: 'first', rating: 28, colors: ['#b91c1c', '#111827'], pattern: 'sash', city: 'Kırşehir' },
  { id: 'van', name: 'Van Gölü SK', short: 'VAN', league: 'first', rating: 26, colors: ['#0ea5e9', '#14532d'], pattern: 'hoops', city: 'Van' },
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
};


/**
 * Altyapı (U-17) takımları: Süper Lig kulüplerinin gençleri. Kendi liglerinde oynarlar,
 * transfer tekliflerine ve büyük kulüp listelerine girmezler (CLUBS yalnızca A takımları içerir).
 */
export const YOUTH_CLUBS = CLUBS.filter((c) => c.league === 'super').map((c) => ({
  ...c,
  id: `${c.id}-u17`,
  name: `${c.name} U-17`,
  league: 'u17',
  rating: Math.round(16 + (c.rating - 50) * 0.35),
  parentId: c.id,
  youth: true,
}));

/** Lig tablosu ve fikstür üretimi için tüm takımlar (A takımları + altyapı) */
export const ALL_CLUBS = [...CLUBS, ...YOUTH_CLUBS];

export const CLUB_BY_ID = Object.fromEntries(ALL_CLUBS.map((c) => [c.id, c]));

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
