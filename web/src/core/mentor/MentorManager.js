// @ts-check
// MENTOR YÖNETİCİSİ — mentorluk ve rol model sisteminin tek giriş noktası.
//
//  1) Aday filtreleme   : candidates()      → yaş ≥ 32, Kaptan/Yıldız Oyuncu, nüfuz > 75, en fazla 3
//  2) Sezon başı seçim  : canChooseMentor() / chooseMentor() → yalnızca 1. hafta, oyuncu ≤ 26 yaş, sezonda 1 mentor
//  3) Haftalık buluşma  : canMeet() / meet() → −20 enerji, +10 mentor ilişkisi, bağlama göre diyalog
//  4) Rol değişimi      : mode() → 26 yaşa kadar 'mentee', sonra 'mentor'; nüfuz > 80 ise ≤ 20 yaş gençler talep eder
//     Kabul edilirse    : her hafta kulüp nüfuzu +2, kulüp sadakati, hoca ve yönetim ilişkisi artar
//  5) Bonuslar          : bonuses() → Çalışkan / Lider / Soğukkanlı etkileri; sync() oyuncuya yazar
import { random } from '../rng.js';
import { CLUB_BY_ID } from '../data.js';
import { MENTOR_RULES, MENTOR_TRAITS, Mentorship, NO_BONUS, SquadPlayer, TEAM_ROLES, traitBonus } from './models.js';
import { advanceSquad, generateSquad, windowSigning } from './squad.js';
import { DialoguePool, FAREWELL_LINES, INTRO_LINES, MENTEE_WEEK_LINES, REQUEST_LINES, fill } from './dialogues.js';
import { upcomingBigMatch } from './bigMatch.js';

/** @typedef {import('./models.js').MentorBonus} MentorBonus */
/** @typedef {import('./models.js').MenteeRequest} MenteeRequest */
/** @typedef {import('./models.js').MenteeLink} MenteeLink */
/** @typedef {ReturnType<Mentorship['toJSON']>} MentorshipData */
/** @typedef {{label:string, delta:number, key?:string}} Change */

const clamp = (/** @type {number} */ v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const r1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;

/** Kayıttaki mentorluk verisi (eski kayıtlarda yoksa oluşturulur). */
export function ensureMentorState(state) {
  const p = state.player;
  if (typeof p.influence !== 'number') {
    // Eski kayıt: kulüpte geçen süre ve ünden makul bir başlangıç tahmini
    const seasonsHere = (state.career.history || []).filter((h) => h.clubId === state.career.clubId).length;
    p.influence = clamp(Math.round(5 + seasonsHere * 12 + (p.fame || 0) * 0.2));
  }
  if (typeof p.loyalty !== 'number') p.loyalty = 20;
  if (p.mentorBonus === undefined) p.mentorBonus = null;
  const m = state.mentor || (state.mentor = {});
  m.squads = m.squads || {};
  m.current = m.current ?? null;
  m.history = m.history || [];
  m.selection = m.selection || { season: state.calendar.season, skipped: false, prompted: false };
  m.legacy = m.legacy || { shifted: false, shiftShown: false, mentees: [], requests: [], declined: [], notes: [] };
  m.recent = m.recent || [];
  return m;
}

export class MentorManager {
  /**
   * @param {any} state oyun durumu
   * @param {() => number} [rnd] rastgele sayı üreteci (testlerde tohumlu)
   */
  constructor(state, rnd = random) {
    this.state = state;
    this.rnd = rnd;
    this.data = ensureMentorState(state);
    this.dialogues = new DialoguePool(rnd);
  }

  // ───────────────────────── Kadro ─────────────────────────

  /** Kadro/mentor kulübü: altyapıdayken A takımın kadrosu (U-17 oyuncusu A takım tecrübelilerinden öğrenir) */
  get clubId() {
    const c = this.state.career;
    return c.academy?.parentId || c.clubId;
  }

  get season() {
    return this.state.calendar.season;
  }

  clubRating(clubId = this.clubId) {
    return this.state.world?.ratings?.[clubId] ?? CLUB_BY_ID[clubId]?.rating ?? 40;
  }

  /** Kulübün kadrosu yoksa üretir, eskiyse sezon sayısı kadar yaşlandırır. */
  ensureSquad(clubId = this.clubId) {
    const avoidNames = [this.state.player.name];
    let sq = this.data.squads[clubId];
    if (!sq) sq = this.data.squads[clubId] = generateSquad(clubId, this.season, this.clubRating(clubId), this.rnd, { avoidNames });
    while (sq.season < this.season) sq = this.data.squads[clubId] = advanceSquad(sq, this.clubRating(clubId), this.rnd, { avoidNames }).squad;
    return sq;
  }

  /** @returns {SquadPlayer[]} */
  squad(clubId = this.clubId) {
    return this.ensureSquad(clubId).players.map((p) => SquadPlayer.from(p));
  }

  member(id) {
    return this.squad().find((p) => p.id === id) || null;
  }

  // ───────────────────── 1) Aday filtreleme ─────────────────────

  /**
   * Mentor adayı şartları: Yaş >= 32, Takım Rolü = Kaptan veya Yıldız Oyuncu, Kulüp Nüfuzu > 75.
   * @param {{age:number, role:string, influence:number}} p
   */
  static isEligibleMentor(p) {
    return p.age >= MENTOR_RULES.minMentorAge
      && MENTOR_RULES.mentorRoles.includes(/** @type {any} */ (p.role))
      && p.influence > MENTOR_RULES.minMentorInfluence;
  }

  /** Arayüz için: bir oyuncunun neden aday olmadığı. */
  static eligibilityIssues(/** @type {{age:number, role:string, influence:number}} */ p) {
    const out = [];
    if (p.age < MENTOR_RULES.minMentorAge) out.push(`${p.age} yaş (en az ${MENTOR_RULES.minMentorAge})`);
    if (!MENTOR_RULES.mentorRoles.includes(/** @type {any} */ (p.role))) out.push(`${TEAM_ROLES[p.role]?.label || p.role} (Kaptan/Yıldız gerekli)`);
    if (p.influence <= MENTOR_RULES.minMentorInfluence) out.push(`Nüfuz ${p.influence} (75 üstü gerekli)`);
    return out;
  }

  /** Şartları sağlayan en fazla 3 tecrübeli oyuncu (nüfuza göre sıralı). */
  candidates() {
    return this.squad()
      .filter((p) => MentorManager.isEligibleMentor(p))
      .sort((a, b) => b.influence - a.influence || b.age - a.age)
      .slice(0, MENTOR_RULES.maxCandidates);
  }

  // ───────────────────── 2) Sezon başı seçim ─────────────────────

  /** 'mentee': mentor seçebilir (≤ 26) · 'mentor': gençlere akıl hocası olur (> 26) */
  mode() {
    return this.state.player.age <= MENTOR_RULES.maxMenteeAge ? 'mentee' : 'mentor';
  }

  selectionWindowOpen() {
    const c = this.state.calendar;
    return c.phase === 'week' && c.week === 1;
  }

  /** @returns {{ok:boolean, reason?:string}} */
  canChooseMentor() {
    if (this.mode() !== 'mentee') return { ok: false, reason: `${MENTOR_RULES.maxMenteeAge} yaşını geçtin; mentor seçme dönemi kapandı.` };
    if (this.data.current && this.data.current.season === this.season) return { ok: false, reason: 'Bir sezonda yalnızca bir mentor seçebilirsin.' };
    if (!this.selectionWindowOpen()) return { ok: false, reason: 'Mentor yalnızca sezonun ilk haftasında seçilebilir.' };
    if (this.data.selection.season === this.season && this.data.selection.skipped) return { ok: false, reason: 'Bu sezon mentorsuz devam etmeye karar verdin.' };
    if (!this.candidates().length) return { ok: false, reason: 'Kadroda şartları sağlayan tecrübeli oyuncu yok.' };
    return { ok: true };
  }

  /**
   * Adaylardan birini bu sezonun resmi mentoru yapar.
   * @param {string} id
   * @returns {{ok:false, reason:string} | {ok:true, mentorship:MentorshipData, intro:string}}
   */
  chooseMentor(id) {
    const check = this.canChooseMentor();
    if (!check.ok) return { ok: false, reason: check.reason || '' };
    const pick = this.candidates().find((p) => p.id === id);
    if (!pick) return { ok: false, reason: 'Bu oyuncu mentor adayı değil.' };
    // Geçen sezonun mentoruyla devam: ilişki sıfırdan başlamaz
    const prev = this.data.history[this.data.history.length - 1];
    const start = prev && prev.mentor.id === id && prev.relationship >= 50 ? Math.round(prev.relationship * 0.6) : MENTOR_RULES.startRelationship;
    const ms = new Mentorship({ season: this.season, clubId: this.clubId, mentor: pick.toJSON(), relationship: start, startedWeek: this.state.calendar.week });
    this.data.current = ms.toJSON();
    this.data.selection = { season: this.season, skipped: false, prompted: true };
    this.sync();
    const intro = fill(INTRO_LINES[Math.floor(this.rnd() * INTRO_LINES.length)], this.dialogueContext('coffee'));
    return { ok: true, mentorship: this.data.current, intro };
  }

  /** "Bu sezon mentor istemiyorum" */
  skipSelection() {
    this.data.selection = { season: this.season, skipped: true, prompted: true };
  }

  /** Seçim ekranı otomatik gösterilmeli mi? (sezon başında bir kez) */
  shouldPromptSelection() {
    const sel = this.data.selection;
    return this.canChooseMentor().ok && !(sel.season === this.season && sel.prompted);
  }

  markPrompted() {
    this.data.selection = { ...this.data.selection, season: this.season, prompted: true };
  }

  /** Bu sezonun devam eden mentorluğu (yoksa null). @returns {MentorshipData|null} */
  active() {
    const c = this.data.current;
    return c && c.season === this.season && !c.ended ? c : null;
  }

  /** Aktif mentorun kadrodaki güncel hâli (yoksa kayıt anındaki bilgileri). */
  activeMentor() {
    const a = this.active();
    if (!a) return null;
    return this.member(a.mentor.id) || SquadPlayer.from(a.mentor);
  }

  // ───────────────────── 5) Bonuslar ─────────────────────

  /** @returns {MentorBonus} */
  bonuses() {
    const a = this.active();
    return a ? traitBonus(a.mentor.trait) : { ...NO_BONUS };
  }

  /** Aktif bonusu oyuncu kaydına yazar (antrenman, ilişki ve maç kodu buradan okur). */
  sync() {
    const a = this.active();
    this.state.player.mentorBonus = a ? { trait: a.mentor.trait, ...traitBonus(a.mentor.trait) } : null;
    return this.state.player.mentorBonus;
  }

  /**
   * Kulüp nüfuzu kazandırır. Lider mentor kazancı %20 artırır; nüfuz yükseldikçe artış yavaşlar.
   * raw: kural gereği sabit artış (gençlere mentorluk +2) — çarpan ve yavaşlama uygulanmaz.
   */
  gainInfluence(amount, { raw = false } = {}) {
    const p = this.state.player;
    const before = p.influence;
    const mult = raw ? 1 : this.bonuses().influenceGrowth * Math.max(0.3, 1 - before / 140);
    p.influence = clamp(r1(before + amount * (amount > 0 ? mult : 1)));
    return r1(p.influence - before);
  }

  /** Oyuncu kaptan mı? (nüfuzu ≥ 85 ve kadrodaki herkesten yüksek) */
  isPlayerCaptain() {
    const inf = this.state.player.influence;
    return inf >= 85 && this.squad().every((p) => p.influence < inf);
  }

  // ───────────────────── 3) Haftalık buluşma ─────────────────────

  weekKey() {
    return this.season * 100 + this.state.calendar.week;
  }

  /** @param {'coffee'|'dinner'} kind @returns {{ok:boolean, reason?:string}} */
  canMeet(kind = 'coffee') {
    const { calendar, player } = this.state;
    if (kind !== 'coffee' && kind !== 'dinner') return { ok: false, reason: 'Bilinmeyen buluşma.' };
    if (this.mode() !== 'mentee') return { ok: false, reason: 'Artık sen bir akıl hocasısın.' };
    const a = this.active();
    if (!a) return { ok: false, reason: 'Bu sezon bir mentorun yok.' };
    if (calendar.phase !== 'week') return { ok: false, reason: 'Sezon arası.' };
    if (calendar.slots <= 0) return { ok: false, reason: 'Bu haftaki tüm zamanını kullandın.' };
    if (a.lastMeeting === this.weekKey()) return { ok: false, reason: `${a.mentor.name.split(' ')[0]} bu hafta seninle zaten buluştu.` };
    if (player.energy < MENTOR_RULES.meetingEnergy) return { ok: false, reason: `Buluşma için en az ${MENTOR_RULES.meetingEnergy} enerji gerekir.` };
    return { ok: true };
  }

  /** Diyalog seçimi için bağlam */
  dialogueContext(/** @type {'coffee'|'dinner'} */ kind) {
    const { player, flags, chirp } = this.state;
    const a = this.active();
    const ratings = player.ratings || [];
    const last = ratings.slice(-5);
    const form = last.length ? last.reduce((x, y) => x + y, 0) / last.length : 6.5;
    const nowKey = this.weekKey();
    const rumor = !!this.state.pending?.offers || (chirp?.timeline || []).some((t) => t.topic === 'transfer_offer' && nowKey - (t.season * 100 + t.week) <= 2);
    return {
      bigMatch: upcomingBigMatch(this.state),
      fame: player.fame || 0,
      form,
      ratings: ratings.length,
      injured: (flags.injuredWeeks || 0) > 0,
      benchStreak: flags.benchStreak || 0,
      rumor,
      trait: a?.mentor.trait || 'hardworker',
      relationship: a?.relationship || 0,
      kind,
      player: player.name.split(' ')[0],
      mentor: a ? a.mentor.name : '',
      club: CLUB_BY_ID[this.clubId]?.name || '',
    };
  }

  /**
   * Mentoru kahveye ya da yemeğe davet eder: −20 enerji, +10 mentor ilişkisi, bir zaman hakkı.
   * Bağlama uygun havuzdan rastgele bir diyalog tetiklenir.
   * @param {'coffee'|'dinner'} kind
   */
  meet(kind = 'coffee') {
    const check = this.canMeet(kind);
    if (!check.ok) return { ok: false, reason: check.reason };
    const { player, calendar } = this.state;
    const a = /** @type {MentorshipData} */ (this.active());
    const ctx = this.dialogueContext(kind);
    const energyBefore = player.energy;
    player.energy = clamp(Math.round(player.energy - MENTOR_RULES.meetingEnergy));
    const relBefore = a.relationship;
    a.relationship = clamp(a.relationship + MENTOR_RULES.meetingRelationship);
    a.meetings += 1;
    a.lastMeeting = this.weekKey();
    calendar.slots -= 1;
    const scene = this.dialogues.scene(ctx);
    const dialogue = this.dialogues.pick(ctx, this.data.recent);
    this.data.recent = [...this.data.recent, dialogue.id].slice(-8);
    a.log = [...(a.log || []), { week: calendar.week, kind, dialogueId: dialogue.id, text: dialogue.text }].slice(-12);
    /** @type {Change[]} */
    const changes = [
      { key: 'energy', label: 'Enerji', delta: player.energy - energyBefore },
      { key: 'mentor', label: 'Mentor İlişkisi', delta: a.relationship - relBefore },
    ];
    return {
      ok: true,
      kind,
      title: kind === 'coffee' ? 'Kahve Molası' : 'Akşam Yemeği',
      scene,
      speaker: a.mentor.name,
      dialogue,
      bigMatch: ctx.bigMatch,
      relationship: a.relationship,
      changes,
    };
  }

  // ───────────────────── 4) Rol değişimi (Legacy Shift) ─────────────────────

  /** Gençler talepte bulunabilir mi? 26 yaşını geçmiş ve nüfuzu > 80 */
  canReceiveRequests() {
    return this.mode() === 'mentor' && this.state.player.influence > MENTOR_RULES.legacyMinInfluence;
  }

  /** Talep edebilecek gençler: ≤ 20 yaş, zaten bağlı/bekleyen/reddedilmiş olmayan */
  eligibleYouth() {
    const L = this.data.legacy;
    const busy = new Set([...L.mentees.map((m) => m.id), ...L.requests.map((r) => r.id), ...L.declined]);
    return this.squad().filter((p) => p.age <= MENTOR_RULES.maxYouthAge && !busy.has(p.id));
  }

  /**
   * Gençlerden yeni mentorluk talepleri üretir.
   * @param {number} probability her uygun genç için talep olasılığı
   * @returns {MenteeRequest[]}
   */
  generateRequests(probability = 1) {
    if (!this.canReceiveRequests()) return [];
    const L = this.data.legacy;
    const out = [];
    for (const y of this.eligibleYouth()) {
      if (L.requests.length + L.mentees.length >= MENTOR_RULES.maxMentees + 1 || L.requests.length >= 2) break;
      if (this.rnd() >= probability) continue;
      const pool = REQUEST_LINES[y.origin === 'academy' ? 'academy' : 'transfer'];
      /** @type {MenteeRequest} */
      const req = {
        id: y.id,
        name: y.name,
        age: y.age,
        origin: y.origin,
        position: y.position,
        message: pool[Math.floor(this.rnd() * pool.length)],
        season: this.season,
        week: this.state.calendar.week,
      };
      L.requests.push(req);
      out.push(req);
    }
    return out;
  }

  /**
   * Gencin talebini kabul eder: hoca ve yönetim gözünde değerin (kulüp sadakati) yükselir.
   * @returns {{ok:boolean, reason?:string, mentee?:MenteeLink, changes?:Change[]}}
   */
  acceptRequest(id) {
    const L = this.data.legacy;
    const req = L.requests.find((r) => r.id === id);
    if (!req) return { ok: false, reason: 'Talep bulunamadı.' };
    if (L.mentees.length >= MENTOR_RULES.maxMentees) return { ok: false, reason: `Aynı anda en fazla ${MENTOR_RULES.maxMentees} gence mentorluk yapabilirsin.` };
    L.requests = L.requests.filter((r) => r.id !== id);
    /** @type {MenteeLink} */
    const link = { id: req.id, name: req.name, age: req.age, origin: req.origin, position: req.position, since: { season: this.season, week: this.state.calendar.week }, weeks: 0, growth: 0, clubId: this.clubId };
    L.mentees.push(link);
    const changes = this.applyLoyalty({ loyalty: 3, manager: 3, board: 3 });
    return { ok: true, mentee: link, changes };
  }

  declineRequest(id) {
    const L = this.data.legacy;
    const had = L.requests.some((r) => r.id === id);
    L.requests = L.requests.filter((r) => r.id !== id);
    if (had) L.declined.push(id);
    return had;
  }

  /** Kulüp sadakati + hoca/yönetim ilişkisi */
  applyLoyalty(/** @type {{loyalty?:number, manager?:number, board?:number}} */ d) {
    const p = this.state.player;
    /** @type {Change[]} */
    const out = [];
    if (d.loyalty) {
      const b = p.loyalty;
      p.loyalty = clamp(p.loyalty + d.loyalty);
      out.push({ key: 'loyalty', label: 'Kulüp Sadakati', delta: p.loyalty - b });
    }
    for (const [k, label] of /** @type {const} */ ([['manager', 'Hoca'], ['board', 'Yönetim']])) {
      if (!d[k]) continue;
      const b = p.rel[k] ?? 50;
      p.rel[k] = clamp(Math.round(b + d[k]));
      out.push({ key: k, label, delta: p.rel[k] - b });
    }
    return out.filter((c) => c.delta);
  }

  // ───────────────────── Takvim kancaları ─────────────────────

  /**
   * Hafta sonu (hafta numarası artmadan önce çağrılır).
   * Mentee: buluşmasız geçen haftada ilişki azalır. Akıl hocası: gençler varsa nüfuz +2/hafta.
   */
  onWeekEnd() {
    const out = { decay: 0, legacy: /** @type {null|{influence:number, changes:Change[], note:string}} */ (null), requests: /** @type {MenteeRequest[]} */ ([]), signing: /** @type {SquadPlayer|null} */ (null) };
    const a = this.active();
    if (a && a.lastMeeting !== this.weekKey()) {
      const b = a.relationship;
      a.relationship = clamp(a.relationship - MENTOR_RULES.weeklyDecay);
      out.decay = a.relationship - b;
    }
    const L = this.data.legacy;
    if (this.mode() === 'mentor' && L.mentees.length) {
      const influence = this.gainInfluence(MENTOR_RULES.legacyInfluencePerWeek, { raw: true });
      const changes = [{ key: 'influence', label: 'Kulüp Nüfuzu', delta: influence }, ...this.applyLoyalty({ loyalty: MENTOR_RULES.legacyLoyaltyPerWeek, manager: 1, board: 1 })];
      for (const m of L.mentees) {
        m.weeks += 1;
        m.growth = r1(m.growth + 0.3 + this.rnd() * 0.3);
      }
      const who = L.mentees[Math.floor(this.rnd() * L.mentees.length)];
      const note = fill(MENTEE_WEEK_LINES[Math.floor(this.rnd() * MENTEE_WEEK_LINES.length)], { mentee: who.name.split(' ')[0] });
      L.notes = [...(L.notes || []), { season: this.season, week: this.state.calendar.week, text: note }].slice(-6);
      out.legacy = { influence, changes, note };
    }
    // Devre arası: kulübe genç transfer gelebilir
    if (this.state.calendar.week === 11) out.signing = windowSigning(this.ensureSquad(), this.clubRating(), this.rnd, { avoidNames: [this.state.player.name] });
    out.requests = this.generateRequests(out.signing ? 0.8 : 0.12);
    return out;
  }

  /** Sezon sonu (yaşlanmadan sonra, yeni sezona geçmeden önce): mentorluk biter, veda. */
  onSeasonEnd() {
    const a = this.active();
    let farewell = null;
    if (a) {
      a.ended = 'season';
      this.data.history.push({ ...a });
      const strong = a.relationship >= 70;
      farewell = { mentor: a.mentor.name, relationship: a.relationship, strong, text: fill(strong ? FAREWELL_LINES.strong : FAREWELL_LINES.weak, { mentor: a.mentor.name }), influence: 0 };
      if (strong) farewell.influence = this.gainInfluence(3, { raw: true }); // mentorun mirası
      if (this.data.history.length > 12) this.data.history.shift();
    }
    // Kulüpte geçen her sezon sadakati artırır
    this.applyLoyalty({ loyalty: 3 });
    this.sync();
    return { farewell };
  }

  /**
   * Yeni sezonun ilk haftası: kadro yaşlanır, seçim penceresi açılır ya da (26 yaş sonrası) rol değişimi olur.
   */
  onSeasonStart() {
    // Yaşlanmadan önceki kadro (emekli olanları haber yapmak için)
    const raw = this.data.squads[this.clubId];
    const before = new Map((raw?.players || []).map((p) => [p.id, SquadPlayer.from(p)]));
    this.ensureSquad();
    const now = new Map(this.squad().map((p) => [p.id, p]));
    const L = this.data.legacy;
    const graduated = [];
    L.mentees = L.mentees.filter((m) => {
      const p = now.get(m.id);
      if (!p) return false;
      m.age = p.age;
      if (p.age > MENTOR_RULES.maxYouthAge) {
        graduated.push({ ...m, ovr: p.ovr });
        return false;
      }
      return true;
    });
    L.requests = [];
    L.declined = [];
    this.data.selection = { season: this.season, skipped: false, prompted: false };
    let legacyShift = false;
    if (this.mode() === 'mentor' && !L.shifted) {
      L.shifted = true;
      legacyShift = true;
    }
    const requests = this.generateRequests(1);
    this.sync();
    const retired = [...before.values()].filter((p) => !now.has(p.id) && p.age >= 33).map((p) => p.name);
    return { legacyShift, graduated, requests, retired, candidates: this.mode() === 'mentee' ? this.candidates() : [] };
  }

  /** Kulüp değişikliği: mentor eski kulüpte kalır, gençler de; nüfuz yeni kulüpte sıfıra yakın başlar. */
  onTransfer(fromClubId) {
    const a = this.data.current;
    let ended = null;
    if (a && !a.ended && a.clubId === fromClubId) {
      a.ended = 'transfer';
      this.data.history.push({ ...a });
      ended = a.mentor.name;
    }
    const L = this.data.legacy;
    const lostMentees = L.mentees.map((m) => m.name);
    L.mentees = [];
    L.requests = [];
    const p = this.state.player;
    // Nüfuz kulübe özgüdür: yeni kulüpte %35'i kalır (ünlü oyuncu biraz daha saygı görür)
    p.influence = r1(Math.max(p.influence * 0.35, Math.min(40, (p.fame || 0) * 0.4)));
    p.loyalty = Math.round(p.loyalty * 0.3);
    this.ensureSquad();
    this.sync();
    return { ended, lostMentees };
  }

  /** Mentor ekranı için özet */
  view() {
    const a = this.active();
    const mentor = this.activeMentor();
    return {
      mode: this.mode(),
      age: this.state.player.age,
      influence: this.state.player.influence,
      loyalty: this.state.player.loyalty,
      captain: this.isPlayerCaptain(),
      active: a,
      mentor,
      trait: mentor ? MENTOR_TRAITS[mentor.trait] : null,
      selection: this.canChooseMentor(),
      candidates: this.mode() === 'mentee' ? this.candidates() : [],
      squad: this.squad(),
      legacy: this.data.legacy,
      canReceive: this.canReceiveRequests(),
      history: this.data.history,
    };
  }
}
