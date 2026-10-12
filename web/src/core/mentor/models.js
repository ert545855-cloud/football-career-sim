// @ts-check
// MENTORLUK VERİ MODELLERİ — kadro oyuncusu (yapay zekâ), karakter özellikleri, kurallar, mentorluk kaydı.
// Kayıt JSON olduğu için modeller düz nesneye çevrilip (toJSON) state.mentor altında saklanır.

/** @typedef {'captain'|'star'|'regular'|'youngster'} TeamRole */
/** @typedef {'hardworker'|'leader'|'coolheaded'} TraitId */
/** @typedef {'GK'|'DF'|'MF'|'FW'} SquadPosition */
/** @typedef {'academy'|'transfer'|'veteran'|'core'} Origin */

/**
 * Mentorun oyuncuya verdiği bonuslar. Etkisiz değerler 1'dir (çarpan).
 * @typedef {{trainingGrowth:number, influenceGrowth:number, teamLossMult:number, nervesMult:number, aimTempo:number}} MentorBonus
 */

/** Kurallar tek yerde: testler ve arayüz buradan okur. */
export const MENTOR_RULES = Object.freeze({
  /** Mentor adayı: yaş >= 32 */
  minMentorAge: 32,
  /** Mentor adayı: rol Kaptan veya Yıldız Oyuncu */
  mentorRoles: /** @type {TeamRole[]} */ (['captain', 'star']),
  /** Mentor adayı: kulüp nüfuzu > 75 (eşit olması yetmez) */
  minMentorInfluence: 75,
  /** Sezon başında listelenecek en fazla aday */
  maxCandidates: 3,
  /** Oyuncu mentor seçebilir: yaş <= 26 */
  maxMenteeAge: 26,
  /** Haftalık buluşma: enerji maliyeti ve ilişki kazancı */
  meetingEnergy: 20,
  meetingRelationship: 10,
  /** Buluşma haftada bir (mentor programı yoğun) */
  meetingsPerWeek: 1,
  /** Mentor ilişkisi: seçimde başlangıç, buluşmasız geçen haftada düşüş */
  startRelationship: 30,
  weeklyDecay: 2,
  /** Rol değişimi: 26'yı geçince, nüfuz > 80 ise gençler talep eder */
  legacyMinInfluence: 80,
  /** Talep edebilecek gençler: yaş <= 20 */
  maxYouthAge: 20,
  /** Aynı anda en fazla yetiştirilecek genç */
  maxMentees: 2,
  /** Gençlere mentorluk: haftalık kulüp nüfuzu artışı */
  legacyInfluencePerWeek: 2,
  /** Gençlere mentorluk: haftalık kulüp sadakati artışı (yönetim + hoca gözündeki değer) */
  legacyLoyaltyPerWeek: 2,
});

/** Takım rolleri (Türkçe etiketler) */
export const TEAM_ROLES = {
  captain: { label: 'Kaptan', short: 'KPT', tone: 'gold' },
  star: { label: 'Yıldız Oyuncu', short: 'YLD', tone: 'accent' },
  regular: { label: 'As Oyuncu', short: 'AS', tone: '' },
  youngster: { label: 'Genç Yetenek', short: 'GNÇ', tone: 'good' },
};

export const SQUAD_POSITIONS = { GK: 'Kaleci', DF: 'Defans', MF: 'Orta Saha', FW: 'Forvet' };

export const ORIGINS = { academy: 'Altyapıdan', transfer: 'Transferle', veteran: 'Tecrübeli transfer', core: 'Kadro' };

/** Etkisiz bonus (mentor yokken). */
export const NO_BONUS = Object.freeze({ trainingGrowth: 1, influenceGrowth: 1, teamLossMult: 1, nervesMult: 1, aimTempo: 1 });

/**
 * Mentor karakter özellikleri ve gelişim bonusları.
 * @type {Record<TraitId, {id:TraitId, name:string, en:string, icon:string, color:string, desc:string, bonus:Partial<MentorBonus>}>}
 */
export const MENTOR_TRAITS = {
  hardworker: {
    id: 'hardworker',
    name: 'Çalışkan',
    en: 'Hardworker',
    icon: 'dumbbell',
    color: '#facc15',
    desc: 'Antrenman gelişim hızın %20 artar.',
    bonus: { trainingGrowth: 1.2 },
  },
  leader: {
    id: 'leader',
    name: 'Lider',
    en: 'Leader',
    icon: 'flag',
    color: '#38bdf8',
    desc: 'Kaptanlık/Nüfuz gelişim hızın %20 artar, Takım Uyumu kayıpların yarıya iner.',
    bonus: { influenceGrowth: 1.2, teamLossMult: 0.5 },
  },
  coolheaded: {
    id: 'coolheaded',
    name: 'Soğukkanlı',
    en: 'Cool-headed',
    icon: 'snow',
    color: '#a5f3fc',
    desc: 'Büyük maçlarda (Derbi, Final) heyecanın %20 azalır, mini oyun nişangahı yavaşlar.',
    bonus: { nervesMult: 0.8, aimTempo: 0.8 },
  },
};

export const TRAIT_IDS = /** @type {TraitId[]} */ (Object.keys(MENTOR_TRAITS));

/** Bir özelliğin bonusunu etkisiz değerlerle birleştirir. */
export function traitBonus(/** @type {TraitId|null|undefined} */ trait) {
  return /** @type {MentorBonus} */ ({ ...NO_BONUS, ...(trait ? MENTOR_TRAITS[trait]?.bonus : {}) });
}

/** Kulüp kadrosundaki yapay zekâ oyuncusu. */
export class SquadPlayer {
  /**
   * @param {{id:string, name:string, age:number, position:SquadPosition, role?:TeamRole, influence:number, trait:TraitId,
   *   ovr:number, origin?:Origin, joinedSeason?:number, number?:number, avatar?:{skin:number, hair:string, hairColor:number}}} p
   */
  constructor(p) {
    this.id = p.id;
    this.name = p.name;
    this.age = p.age;
    this.position = p.position;
    /** @type {TeamRole} */
    this.role = p.role || 'regular';
    /** Kulüp Nüfuzu (0–100) */
    this.influence = p.influence;
    /** @type {TraitId} */
    this.trait = p.trait;
    this.ovr = p.ovr;
    /** @type {Origin} */
    this.origin = p.origin || 'core';
    this.joinedSeason = p.joinedSeason ?? 1;
    this.number = p.number ?? 0;
    this.avatar = p.avatar || { skin: 1, hair: 'short', hairColor: 1 };
  }

  get roleLabel() {
    return TEAM_ROLES[this.role].label;
  }

  get traitInfo() {
    return MENTOR_TRAITS[this.trait];
  }

  /** @param {any} o */
  static from(o) {
    return o instanceof SquadPlayer ? o : new SquadPlayer(o);
  }

  toJSON() {
    const { id, name, age, position, role, influence, trait, ovr, origin, joinedSeason, number, avatar } = this;
    return { id, name, age, position, role, influence, trait, ovr, origin, joinedSeason, number, avatar };
  }
}

/**
 * Bir sezonluk resmi mentorluk kaydı. Mentorun o anki bilgileri saklanır (snapshot),
 * böylece mentor emekli olsa ya da oyuncu kulüp değiştirse bile geçmiş okunabilir.
 */
export class Mentorship {
  /**
   * @param {{season:number, clubId:string, mentor:ReturnType<SquadPlayer['toJSON']>, relationship?:number, meetings?:number,
   *   lastMeeting?:number, startedWeek?:number, ended?:string|null, log?:Array<{week:number, kind:string, dialogueId:string, text:string}>}} p
   */
  constructor(p) {
    this.season = p.season;
    this.clubId = p.clubId;
    this.mentor = p.mentor;
    /** Mentor_Relationship (0–100) */
    this.relationship = p.relationship ?? MENTOR_RULES.startRelationship;
    this.meetings = p.meetings ?? 0;
    /** Son buluşmanın hafta anahtarı (sezon*100+hafta) */
    this.lastMeeting = p.lastMeeting ?? 0;
    this.startedWeek = p.startedWeek ?? 1;
    /** Bitiş nedeni: null (devam), 'season', 'transfer' */
    this.ended = p.ended ?? null;
    this.log = p.log || [];
  }

  get active() {
    return !this.ended;
  }

  /** @param {any} o */
  static from(o) {
    return o instanceof Mentorship ? o : new Mentorship(o);
  }

  toJSON() {
    const { season, clubId, mentor, relationship, meetings, lastMeeting, startedWeek, ended, log } = this;
    return { season, clubId, mentor, relationship, meetings, lastMeeting, startedWeek, ended, log };
  }
}

/**
 * Gencin oyuncuya mentorluk talebi / kabul edilmiş mentorluk bağı.
 * @typedef {{id:string, name:string, age:number, origin:Origin, position:SquadPosition, message:string, season:number, week:number}} MenteeRequest
 * @typedef {{id:string, name:string, age:number, origin:Origin, position:SquadPosition, since:{season:number, week:number}, weeks:number, growth:number, clubId:string}} MenteeLink
 */
