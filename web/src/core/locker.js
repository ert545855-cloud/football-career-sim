// SOYUNMA ODASI — takım arkadaşlarıyla birebir ilişkiler, takım havası, kaptanlık ve haftalık soyunma odası olayları.
// Takım arkadaşları mentor sistemindeki kulüp kadrosundan gelir (isim, mevki, yaş, nüfuz, karakter).
import { clamp, chance, pick } from './rng.js';
import { changeEnergy, changeMorale, changeRel } from './player.js';
import { MentorManager, gainInfluence } from './mentor/index.js';

export function ensureLocker(state) {
  const l = (state.locker ||= { rels: {}, log: [], chat: null, mood: [], clubId: state.career?.clubId });
  if (l.clubId !== state.career?.clubId) {
    // yeni kulüp: yeni soyunma odası
    l.rels = {};
    l.mood = [];
    l.clubId = state.career?.clubId;
    l.log = [];
  }
  return l;
}

/** Takım arkadaşları (kadro) + seninle ilişkileri */
export function teammates(state) {
  const l = ensureLocker(state);
  let squad = [];
  try { squad = new MentorManager(state).squad(); } catch { squad = []; }
  return squad.map((p) => {
    if (l.rels[p.id] == null) l.rels[p.id] = clamp(Math.round(45 + (state.player.rel.teammates - 50) * 0.4 + (p.age <= 20 ? 5 : 0)), 10, 90);
    return { id: p.id, name: p.name, position: p.position, age: p.age, influence: p.influence, trait: p.trait, role: p.role, roleLabel: p.roleLabel, number: p.number, avatar: p.avatar, rel: l.rels[p.id], origin: p.origin };
  }).sort((a, b) => b.influence - a.influence);
}

/** Takım havası (0-100): son sonuçlar + genel takım ilişkisi */
export function teamMood(state) {
  const l = ensureLocker(state);
  const recent = l.mood.slice(-5);
  const score = recent.reduce((a, r) => a + (r === 'W' ? 9 : r === 'D' ? 1 : -8), 0);
  return clamp(Math.round(55 + score + (state.player.rel.teammates - 50) * 0.3), 0, 100);
}
export const moodLabel = (m) => (m >= 75 ? 'Şampiyonluk havası' : m >= 58 ? 'Keyifli' : m >= 42 ? 'Normal' : m >= 25 ? 'Gergin' : 'Kriz');

/** Kaptanlık durumu: yüksek nüfuz → yardımcı kaptan / kaptan */
export function armband(state) {
  const inf = state.player.influence ?? state.mentor?.influence ?? 0;
  let captain = false;
  try { captain = new MentorManager(state).isPlayerCaptain(); } catch { captain = false; }
  if (captain) return 'captain';
  if (inf >= 62) return 'vice';
  return null;
}

const weekKey = (state) => `${state.calendar.season}-${state.calendar.week}`;
export const canChat = (state) => ensureLocker(state).chat !== weekKey(state);

const CHAT_LINES = {
  hardworker: ['Sabah 7\'de birlikte koşuya çıkmayı teklif etti.', 'Antrenman sonrası ekstra şut çalıştınız.'],
  leader: ['Takımın hedeflerini konuştunuz; seni dinledi.', 'Sahada nasıl daha çok konuşman gerektiğini anlattı.'],
  calm: ['Maç öncesi nefes egzersizlerini gösterdi.', 'Heyecanla nasıl baş ettiğini anlattı.'],
  showman: ['Gol sevinci için birlikte bir dans çalıştınız.', 'Sosyal medya taktiklerini paylaştı.'],
  default: ['Kahve eşliğinde uzun bir sohbet ettiniz.', 'Ailelerinizden, hayallerinizden konuştunuz.', 'Birlikte PlayStation\'da FIFA turnuvası yaptınız.'],
};

/** Haftada bir: bir takım arkadaşıyla sohbet (zaman hakkı harcamaz) */
export function chatWith(state, id) {
  const l = ensureLocker(state);
  if (!canChat(state)) return { ok: false, text: 'Bu hafta zaten bir sohbet ettin.' };
  const tm = teammates(state).find((t) => t.id === id);
  if (!tm) return { ok: false, text: 'Takım arkadaşı bulunamadı.' };
  l.chat = weekKey(state);
  const gain = tm.rel < 40 ? 9 : tm.rel < 75 ? 6 : 3;
  l.rels[id] = clamp(tm.rel + gain, 0, 100);
  changeRel(state.player, 'teammates', 1);
  changeMorale(state.player, 1);
  if (tm.influence >= 70) gainInfluence(state, 1);
  const line = pick(CHAT_LINES[tm.trait] || CHAT_LINES.default);
  return { ok: true, text: `${tm.name}: ${line}`, gain, tm };
}

// ─────────────────────────── Haftalık olaylar ───────────────────────────
/** Olay tanımları: metin, seçenekler ve etkiler. {a},{b}: takım arkadaşları, {c}: kaptan, {y}: genç */
export const LOCKER_EVENTS = [
  {
    id: 'fight', title: 'Antrenmanda Kavga',
    text: '{a} ile {b} antrenmanda birbirine girdi. Herkes sana bakıyor.',
    choices: [
      { label: 'Araya gir, barıştır', fx: { teammates: 4, influence: 2, energy: -3, relA: 3, relB: 3 }, note: 'İkisini de sakinleştirdin. Soyunma odasında sözün daha çok geçiyor.' },
      { label: '{a}\'nın tarafını tut', fx: { relA: 10, relB: -12, teammates: -2 }, note: '{a} sana minnettar, {b} ise artık selam vermiyor.' },
      { label: 'Karışma, kaptana bırak', fx: { relC: 2 }, note: 'Kaptan durumu halletti. Sen uzak durdun.' },
    ],
  },
  {
    id: 'advice', title: 'Gençten Rica', need: 'young',
    text: 'Genç {y}, idmandan sonra yanına geldi: "Abi, bana da şu vuruşu öğretir misin?"',
    choices: [
      { label: 'Ekstra antrenmanda birlikte çalış', fx: { relY: 12, influence: 3, energy: -8 }, note: '{y} gözlerinin içine bakarak dinledi. Yeni bir hayranın var.' },
      { label: 'Moral ver, sonra bakarız', fx: { relY: 5 }, note: '{y} biraz hayal kırıklığına uğradı ama sözlerin cesaret verdi.' },
      { label: 'Kendi işime bakayım', fx: { relY: -8, teammates: -1 }, note: '{y} başını öne eğip gitti.' },
    ],
  },
  {
    id: 'bonus', title: 'Prim Krizi',
    text: 'Primler gecikti. Kaptan {c} oyuncular adına yönetimle konuşacak ve senin desteğini istiyor.',
    choices: [
      { label: 'Takımın yanında dur', fx: { teammates: 6, relC: 8, manager: -3 }, note: 'Takım bir bütün oldu; yönetim ve hoca pek memnun değil.' },
      { label: 'Yönetimin tarafını tut', fx: { manager: 4, teammates: -6, relC: -10 }, note: 'Yönetim seni takdir etti ama soyunma odası sana mesafeli.' },
      { label: 'Tarafsız kal', fx: {}, note: 'Kriz senin dışında çözüldü.' },
    ],
  },
  {
    id: 'prank', title: 'Soyunma Odası Şakası',
    text: '{a} kramponlarını buzdolabına koymuş! Bütün takım gülüyor.',
    choices: [
      { label: 'Rövanşı al: forma çantasına tavuk!', fx: { relA: 7, morale: 4, teammates: 2 }, note: 'Kahkahalar koridorda yankılandı. Takım havası harika.' },
      { label: 'Gül geç', fx: { morale: 2, relA: 2 }, note: 'Esprili tavrın herkesin hoşuna gitti.' },
      { label: 'Hocaya şikayet et', fx: { manager: 2, teammates: -5, relA: -12 }, note: 'Hoca uyarı yaptı ama artık "ispiyoncu" diye anılıyorsun.' },
    ],
  },
  {
    id: 'birthday', title: 'Doğum Günü',
    text: 'Bugün {a}\'nın doğum günü. Soyunma odasına kocaman bir pasta geldi.',
    choices: [
      { label: 'Kısa bir konuşma yap', fx: { teammates: 3, influence: 2, relA: 5 }, note: 'Konuşman alkış aldı.' },
      { label: 'Pastayı yüzüne bas!', fx: { relA: 6, morale: 3, manager: -1 }, note: 'Kremalı yüzüyle fotoğraf sosyal medyada patladı.' },
    ],
  },
  {
    id: 'meeting', title: 'Takım Toplantısı', need: 'losing',
    text: 'Kötü sonuçlardan sonra kaptan {c} soyunma odasında takım toplantısı yapıyor. Söz alacak mısın?',
    choices: [
      { label: 'Takımı ateşle', fx: { leaderTalk: 1 }, note: '' },
      { label: 'Sessizce dinle', fx: { relC: 3 }, note: 'Kaptanın sözleri herkese dokundu.' },
    ],
  },
  {
    id: 'newcomer', title: 'Yeni Gelen',
    text: 'Kadroya yeni katılan {a} kimseyi tanımıyor, yemekte tek başına oturuyor.',
    choices: [
      { label: 'Masana davet et', fx: { relA: 12, teammates: 2 }, note: '{a} çok mutlu oldu; ilk dostu sensin.' },
      { label: 'Zamanla alışır', fx: {}, note: 'Bir süre yalnız kaldı.' },
    ],
  },
  {
    id: 'extra', title: 'Ekstra Antrenman', need: 'coach',
    text: 'Hoca antrenmandan sonra kalanları not ediyor. Bacakların yorgun.',
    choices: [
      { label: 'Kal ve çalış', fx: { manager: 5, energy: -10, coachLikes: 2 }, note: 'Hoca omzuna dokunup "aferin" dedi.' },
      { label: 'Eve git, dinlen', fx: { energy: 4 }, note: 'Bacakların rahatladı.' },
    ],
  },
];

const fill = (s, m) => s.replace(/\{(\w)\}/g, (_, k) => m[k] || '');

/** Haftalık olay üret (maç sonrası, başka olay yoksa) */
export function maybeLockerEvent(state, { force = false } = {}) {
  const tms = teammates(state);
  if (tms.length < 3) return null;
  if (!force && !chance(0.32)) return null;
  const l = ensureLocker(state);
  const losing = l.mood.slice(-3).filter((r) => r === 'L').length >= 2;
  const young = tms.filter((t) => t.age <= 20);
  const pool = LOCKER_EVENTS.filter((e) => (e.need === 'young' ? young.length : e.need === 'losing' ? losing : true));
  const ev = pick(pool);
  const others = tms.filter((t) => t.role !== 'captain');
  const a = pick(others.length ? others : tms);
  const b = pick(tms.filter((t) => t.id !== a.id));
  const c = tms.find((t) => t.role === 'captain') || tms[0];
  const y = young.length ? pick(young) : a;
  const names = { a: a.name, b: b.name, c: c.name, y: y.name };
  const p = { id: ev.id, title: ev.title, text: fill(ev.text, names), choices: ev.choices.map((ch) => fill(ch.label, names)), ids: { a: a.id, b: b.id, c: c.id, y: y.id }, names, s: state.calendar.season, w: state.calendar.week };
  state.pending.locker = p;
  return p;
}

/** Seçimi uygular */
export function chooseLocker(state, idx) {
  const p = state.pending.locker;
  if (!p) return null;
  state.pending.locker = null;
  const ev = LOCKER_EVENTS.find((e) => e.id === p.id);
  const ch = ev?.choices[idx] || ev?.choices[0];
  const l = ensureLocker(state);
  const pl = state.player;
  const changes = [];
  const fx = ch.fx || {};
  const rel = (key, id, d) => {
    if (!d || !id) return;
    l.rels[id] = clamp((l.rels[id] ?? 50) + d, 0, 100);
    changes.push({ key: 'rel', label: p.names[key], delta: d });
  };
  rel('a', p.ids.a, fx.relA);
  rel('b', p.ids.b, fx.relB);
  rel('c', p.ids.c, fx.relC);
  rel('y', p.ids.y, fx.relY);
  if (fx.teammates) { changeRel(pl, 'teammates', fx.teammates); changes.push({ key: 'teammates', label: 'Takım', delta: fx.teammates }); }
  if (fx.manager) { changeRel(pl, 'manager', fx.manager); changes.push({ key: 'manager', label: 'Hoca', delta: fx.manager }); }
  if (fx.morale) { changeMorale(pl, fx.morale); changes.push({ key: 'morale', label: 'Moral', delta: fx.morale }); }
  if (fx.energy) { changeEnergy(pl, fx.energy); changes.push({ key: 'energy', label: 'Enerji', delta: fx.energy }); }
  if (fx.influence) { gainInfluence(state, fx.influence); changes.push({ key: 'influence', label: 'Nüfuz', delta: fx.influence }); }
  if (fx.coachLikes && state.coach) state.coach.likes = clamp((state.coach.likes || 0) + fx.coachLikes, -12, 12);
  let note = fill(ch.note || '', p.names);
  if (fx.leaderTalk) {
    const inf = pl.influence ?? 0;
    if (inf >= 45) {
      l.mood.push('W');
      changeRel(pl, 'teammates', 5);
      gainInfluence(state, 3);
      changes.push({ key: 'teammates', label: 'Takım', delta: 5 });
      note = 'Sözlerin soyunma odasını ateşledi! Takım havası yükseldi.';
    } else {
      changeRel(pl, 'teammates', -3);
      changes.push({ key: 'teammates', label: 'Takım', delta: -3 });
      note = 'Kıdemliler "daha çok erken" diye mırıldandı. Önce sahada kendini kanıtla.';
    }
  }
  l.log.unshift({ s: p.s, w: p.w, title: p.title, text: note });
  l.log.length = Math.min(l.log.length, 12);
  return { note, changes, title: p.title };
}

/** Maç sonucu takım havasına işlenir */
export function lockerOnMatch(state, summary) {
  const l = ensureLocker(state);
  l.mood.push(summary.result);
  l.mood = l.mood.slice(-8);
}
