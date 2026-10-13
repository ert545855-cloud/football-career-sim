// SOSYAL YAŞAM VERİSİ — mekânlar, kişiler (arkadaş, takım arkadaşı, flört), mobilyalar.
// Mekân ve kişi isimleri kurgusaldır.

/** Mekân türleri ve seviyeleri. price: tek çıkış ücreti; energy: enerji maliyeti; morale: taban moral. */
export const VENUES = {
  cafe: {
    id: 'cafe', name: 'Kafe', icon: 'coffee', scene: 'cafe',
    desc: 'Sakin bir sohbet. Az yorar, ilişkileri güçlendirir.',
    tiers: [
      { id: 'cafe1', name: 'Köşe Kahvecisi', price: 20, prestige: 1, energy: -3, morale: 3, palette: 'warm' },
      { id: 'cafe2', name: 'Moon & Bean', price: 70, prestige: 2, energy: -3, morale: 4, palette: 'bosphorus' },
      { id: 'cafe3', name: 'Bebek Teras', price: 220, prestige: 3, energy: -3, morale: 5, palette: 'terrace' },
    ],
  },
  bar: {
    id: 'bar', name: 'Bar', icon: 'glass', scene: 'bar',
    desc: 'Eğlence ve müzik. Moral yükselir ama yorar; paparazzi de orada.',
    tiers: [
      { id: 'bar1', name: 'Tribün Pub', price: 80, prestige: 1, energy: -9, morale: 6, palette: 'pub' },
      { id: 'bar2', name: 'Neon Lounge', price: 300, prestige: 2, energy: -11, morale: 7, palette: 'neon' },
      { id: 'bar3', name: 'Rooftop 34', price: 1000, prestige: 3, energy: -12, morale: 9, palette: 'rooftop' },
    ],
  },
  home: {
    id: 'home', name: 'Ev Partisi', icon: 'sofa', scene: 'home',
    desc: 'Evine davet et. Evinin konforu ve prestiji sonucu etkiler.',
    tiers: [{ id: 'home1', name: 'Evim', price: 350, prestige: 0, energy: -6, morale: 5, palette: 'home' }],
  },
};

/** Kişilik: hangi üslubu sever / sevmez */
export const TONES = {
  humble: { label: 'Alçakgönüllü', icon: 'smile', base: 2 },
  funny: { label: 'Esprili', icon: 'sparkle', base: 2 },
  deep: { label: 'Samimi', icon: 'chat', base: 3 },
  flirty: { label: 'Flörtöz', icon: 'heart', base: 3 },
  cocky: { label: 'Kendinden emin', icon: 'crown', base: -1 },
  eye: { label: 'Gözlemci', icon: 'eye', base: 1 },
};

/**
 * Sabit kişiler. kind: friend | romance. look: avatar (art.js avatarSVG). clothes: [üst, yaka].
 * Takım arkadaşları kadrodan (mentor/squad) gelir.
 */
export const PEOPLE = [
  {
    id: 'emre', kind: 'friend', name: 'Emre', full: 'Emre Aydın', job: 'Çocukluk arkadaşın · mahalle maçlarının kalecisi',
    look: { skin: 2, hair: 'curly', hairColor: 0 }, clothes: ['#334155', '#94a3b8'],
    likes: ['funny', 'humble'], dislikes: ['cocky'], venues: ['cafe', 'bar', 'home'], start: 55,
  },
  {
    id: 'selim', kind: 'friend', name: 'Selim', full: 'Selim Kara', job: 'Kuzenin · üniversitede spor yönetimi okuyor',
    look: { skin: 1, hair: 'short', hairColor: 1 }, clothes: ['#1e3a8a', '#e0e7ff'],
    likes: ['deep', 'eye'], dislikes: ['cocky'], venues: ['cafe', 'home'], start: 45,
  },
  {
    id: 'zeynep', kind: 'romance', name: 'Zeynep', full: 'Zeynep Arslan', job: 'İç mimar · Boğaz manzaralı kafeleri sever',
    look: { skin: 1, hair: 'wavy', hairColor: 0, fem: true }, clothes: ['#3f3f46', '#a1a1aa'],
    likes: ['deep', 'humble'], dislikes: ['cocky'], venues: ['cafe', 'home'], start: 10, meetAt: ['cafe'],
  },
  {
    id: 'elif', kind: 'romance', name: 'Elif', full: 'Elif Demir', job: 'Spor muhabiri · maç sonrası röportajlarda tanıdık bir yüz',
    look: { skin: 2, hair: 'bob', hairColor: 1, fem: true }, clothes: ['#7c2d12', '#fed7aa'],
    likes: ['funny', 'eye'], dislikes: ['flirty'], venues: ['cafe', 'bar'], start: 10, meetAt: ['cafe', 'bar'],
  },
  {
    id: 'melis', kind: 'romance', name: 'Melis', full: 'Melis Yalın', job: 'Sosyal medya fenomeni · 2 milyon takipçi',
    look: { skin: 0, hair: 'long', hairColor: 3, fem: true }, clothes: ['#be185d', '#fbcfe8'],
    likes: ['cocky', 'funny', 'flirty'], dislikes: ['deep'], venues: ['bar'], start: 10, meetAt: ['bar'],
  },
  {
    id: 'ece', kind: 'romance', name: 'Ece', full: 'Ece Korkmaz', job: 'Fizyoterapist · koşu kulübünde tanıştınız',
    look: { skin: 3, hair: 'ponytail', hairColor: 0, fem: true }, clothes: ['#065f46', '#a7f3d0'],
    likes: ['humble', 'deep', 'funny'], dislikes: ['cocky'], venues: ['cafe', 'home'], start: 10, meetAt: ['cafe'],
  },
];
export const PERSON_BY_ID = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

/** Romantik ilişki aşamaları (eşikler) */
export const ROMANCE_STAGES = [
  { id: 'met', min: 0, label: 'Yeni tanıştınız' },
  { id: 'flirt', min: 25, label: 'Flört' },
  { id: 'partner', min: 60, label: 'Sevgili' },
  { id: 'serious', min: 85, label: 'Ciddi ilişki' },
];
export const FRIEND_STAGES = [
  { id: 'acq', min: 0, label: 'Tanıdık' },
  { id: 'friend', min: 40, label: 'Arkadaş' },
  { id: 'close', min: 70, label: 'Yakın dost' },
];

export const SOCIAL_RULES = {
  /** Romantik içerik bu yaştan önce açılmaz */
  romanceMinAge: 18,
  /** Hafta başına en fazla çıkış */
  maxOutingsPerWeek: 2,
  beatsPerOuting: 3,
  /** Görüşülmeyen haftalarda ilişki düşüşü (romantik) */
  weeklyDecay: 1.5,
};
