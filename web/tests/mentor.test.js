import { seasonWeeks } from '../src/core/calendar.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame, finishTraining, endSeason, takeOffer, getMatch } from '../src/core/game.js';
import { changeRel } from '../src/core/player.js';
import { CLUBS } from '../src/core/data.js';
import { migrate } from '../src/core/storage.js';
import { RelationshipService } from '../src/core/chirp/index.js';
import {
  MentorManager, MENTOR_RULES, SquadPlayer, DialoguePool, DIALOGUE_POOLS, EXAMPLE_BIG_MATCH, EXAMPLE_FAME,
  bigMatchFor, nervesFor, traitBonus, derbyName, generateSquad, advanceSquad,
} from '../src/core/mentor/index.js';

/** Test için oyun: kadroyu elle kurabilmek için yardımcılar */
function game(seed = 1, position = 'FW') {
  setRandom(seeded(seed));
  return newGame({ name: 'Test Oyuncu', position, number: 9 });
}

let n = 0;
const sp = (o) => new SquadPlayer({ id: `t-${++n}`, name: `Oyuncu ${n}`, age: 30, position: 'MF', role: 'regular', influence: 50, trait: 'hardworker', ovr: 40, ...o }).toJSON();

/** Kulüp kadrosunu verilen oyuncularla değiştirir */
function setSquad(state, players) {
  const clubId = state.career.clubId;
  state.mentor.squads[clubId] = { clubId, season: state.calendar.season, seq: 100, players };
}

test('aday filtresi: yaş ≥ 32, Kaptan/Yıldız, nüfuz > 75 (sınırlar dahil)', () => {
  const E = MentorManager.isEligibleMentor;
  assert.equal(E({ age: 32, role: 'captain', influence: 76 }), true);
  assert.equal(E({ age: 35, role: 'star', influence: 90 }), true);
  assert.equal(E({ age: 31, role: 'captain', influence: 90 }), false, '31 yaş yetmez');
  assert.equal(E({ age: 33, role: 'captain', influence: 75 }), false, 'nüfuz tam 75 yetmez (> 75)');
  assert.equal(E({ age: 34, role: 'regular', influence: 95 }), false, 'As Oyuncu olamaz');
  assert.equal(E({ age: 34, role: 'youngster', influence: 95 }), false);
  assert.deepEqual(MentorManager.eligibilityIssues({ age: 31, role: 'regular', influence: 75 }).length, 3);
});

test('adaylar: kadrodan en fazla 3 kişi, nüfuza göre sıralı, şartsızlar yok', () => {
  const s = game(2);
  setSquad(s, [
    sp({ age: 33, role: 'captain', influence: 80 }),
    sp({ age: 34, role: 'star', influence: 92 }),
    sp({ age: 32, role: 'star', influence: 77 }),
    sp({ age: 36, role: 'star', influence: 99 }),
    sp({ age: 31, role: 'captain', influence: 95 }), // yaş tutmuyor
    sp({ age: 35, role: 'regular', influence: 98 }), // rol tutmuyor
    sp({ age: 33, role: 'star', influence: 75 }), // nüfuz tutmuyor
  ]);
  const c = new MentorManager(s).candidates();
  assert.equal(c.length, MENTOR_RULES.maxCandidates);
  assert.deepEqual(c.map((p) => p.influence), [99, 92, 80]);
  assert.ok(c.every((p) => MentorManager.isEligibleMentor(p)));
});

test('üretilen kadrolarda çoğu sezon 1–3 aday olur', () => {
  const rnd = seeded(77);
  let zero = 0;
  let total = 0;
  for (const c of CLUBS) {
    let sq = generateSquad(c.id, 1, c.rating, rnd);
    for (let k = 0; k < 8; k++) {
      const cnt = sq.players.filter((p) => MentorManager.isEligibleMentor(p)).length;
      if (cnt === 0) zero++;
      total++;
      sq = advanceSquad(sq, c.rating, rnd).squad;
    }
  }
  assert.ok(zero / total < 0.15, `adaysız sezon oranı yüksek: ${zero}/${total}`);
});

test('seçim: yalnızca 1. hafta, ≤ 26 yaş, sezonda tek mentor', () => {
  const s = game(3);
  setSquad(s, [sp({ age: 33, role: 'captain', influence: 85 }), sp({ age: 34, role: 'star', influence: 80, trait: 'leader' })]);
  const mm = new MentorManager(s);
  assert.equal(mm.mode(), 'mentee');
  assert.equal(mm.canChooseMentor().ok, true);
  const [a, b] = mm.candidates();
  const r = mm.chooseMentor(a.id);
  assert.equal(r.ok, true);
  assert.equal(mm.active().mentor.id, a.id);
  assert.equal(mm.active().relationship, MENTOR_RULES.startRelationship);
  // Aynı sezonda ikinci mentor yok
  const r2 = mm.chooseMentor(b.id);
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /bir mentor/);

  // 2. haftada pencere kapalı
  const s2 = game(4);
  setSquad(s2, [sp({ age: 33, role: 'captain', influence: 85 })]);
  s2.calendar.week = 2;
  assert.equal(new MentorManager(s2).canChooseMentor().ok, false);

  // 27 yaşında seçim kapalı (rol değişimi)
  const s3 = game(5);
  setSquad(s3, [sp({ age: 33, role: 'captain', influence: 85 })]);
  s3.player.age = 27;
  const mm3 = new MentorManager(s3);
  assert.equal(mm3.mode(), 'mentor');
  assert.equal(mm3.canChooseMentor().ok, false);
  s3.player.age = 26;
  assert.equal(mm3.canChooseMentor().ok, true, '26 yaş hâlâ seçebilir');
});

test('haftalık buluşma: −20 enerji, +10 ilişki, diyalog, haftada bir', () => {
  const s = game(6);
  setSquad(s, [sp({ age: 33, role: 'captain', influence: 85 })]);
  const mm = new MentorManager(s, seeded(9));
  mm.chooseMentor(mm.candidates()[0].id);
  s.player.energy = 70;
  const slots = s.calendar.slots;
  const r = mm.meet('coffee');
  assert.equal(r.ok, true);
  assert.equal(s.player.energy, 50);
  assert.equal(r.relationship, MENTOR_RULES.startRelationship + 10);
  assert.equal(s.calendar.slots, slots - 1);
  assert.ok(r.dialogue.text.length > 10 && r.scene.length > 10);
  assert.deepEqual(r.changes.map((c) => c.delta), [-20, 10]);
  // aynı hafta ikinci buluşma yok
  assert.equal(mm.meet('dinner').ok, false);
  // yeni hafta: enerji yetersizse olmaz
  s.calendar.week = 2;
  s.player.energy = 19;
  const r3 = mm.meet('dinner');
  assert.equal(r3.ok, false);
  assert.match(r3.reason, /enerji/);
  s.player.energy = 20;
  assert.equal(mm.meet('dinner').ok, true);
  assert.equal(s.player.energy, 0);
});

test('diyalog havuzu: büyük maç öncesi Örnek 1, şöhrette Örnek 2 metni birebir çıkar', () => {
  const base = { bigMatch: null, fame: 0, form: 6.5, ratings: 0, injured: false, benchStreak: 0, rumor: false, trait: 'hardworker', relationship: 30, kind: 'coffee', player: 'Arda', mentor: 'Taner Güneş', club: 'Sapanca FK' };
  const only = (id) => DIALOGUE_POOLS.filter((p) => p.id === id);
  const seen1 = new Set();
  const seen2 = new Set();
  const pool1 = new DialoguePool(seeded(1), only('big_match'));
  const pool2 = new DialoguePool(seeded(2), only('fame'));
  for (let i = 0; i < 40; i++) {
    seen1.add(pool1.pick({ ...base, bigMatch: { title: 'Doğu Derbisi', label: 'Derbi' } }).text);
    seen2.add(pool2.pick({ ...base, fame: 40 }).text);
  }
  assert.ok(seen1.has(EXAMPLE_BIG_MATCH));
  assert.ok(seen2.has(EXAMPLE_FAME));
  assert.equal(EXAMPLE_BIG_MATCH, 'Büyük maçlardan önce heyecanını nasıl yenersin evlat? Unutma, ilk düdükten sonra sadece topa odaklan.');
  assert.equal(EXAMPLE_FAME, 'Medyada adını çok görüyorum. Şöhret seni bozmasın, her zaman ilk giren ve son çıkan sen olmalısın.');

  // Bağlam ağırlıkları: büyük maç haftasında büyük maç havuzu baskın
  const pool = new DialoguePool(seeded(3));
  let big = 0;
  for (let i = 0; i < 300; i++) if (pool.pick({ ...base, bigMatch: { title: 'Derbi', label: 'Derbi' } }).pool === 'big_match') big++;
  assert.ok(big > 120, `büyük maç diyaloğu az çıktı: ${big}`);
  // Büyük maç yoksa o havuz hiç seçilmez
  for (let i = 0; i < 100; i++) assert.notEqual(pool.pick(base).pool, 'big_match');
});

test('Çalışkan: antrenman gelişimi %20 hızlı', () => {
  const run = (trait) => {
    const s = game(7);
    if (trait) {
      setSquad(s, [sp({ age: 33, role: 'captain', influence: 85, trait })]);
      const mm = new MentorManager(s);
      mm.chooseMentor(mm.candidates()[0].id);
    }
    const before = s.player.progress.shooting + s.player.stats.shooting;
    const r = finishTraining(s, 'shooting', { success: true, accuracy: 0.5 });
    return { gain: s.player.progress.shooting + s.player.stats.shooting - before, mult: r.mentorMult };
  };
  const base = run(null);
  const hw = run('hardworker');
  const other = run('coolheaded');
  assert.equal(hw.mult, 1.2);
  assert.ok(Math.abs(hw.gain / base.gain - 1.2) < 1e-9, `oran ${hw.gain / base.gain}`);
  assert.ok(Math.abs(other.gain - base.gain) < 1e-9);
});

test('Lider: nüfuz kazancı %20 fazla, Takım Uyumu kayıpları yarıya iner', () => {
  const s = game(8);
  setSquad(s, [sp({ age: 33, role: 'captain', influence: 85, trait: 'leader' })]);
  const plain = game(8);
  const mm = new MentorManager(s);
  mm.chooseMentor(mm.candidates()[0].id);
  const g1 = mm.gainInfluence(5);
  const g0 = new MentorManager(plain).gainInfluence(5);
  assert.ok(Math.abs(g1 / g0 - 1.2) < 0.05, `oran ${g1 / g0}`);

  s.player.rel.teammates = 50;
  changeRel(s.player, 'teammates', -8);
  assert.equal(s.player.rel.teammates, 46, 'kayıp yarıya inmeli');
  changeRel(s.player, 'teammates', 6);
  assert.equal(s.player.rel.teammates, 52, 'kazanç etkilenmez');
  new RelationshipService(s).apply({ team: -10 });
  assert.equal(s.player.rel.teammates, 47, 'Chirp paylaşımı kaybı da yarıya iner');
  plain.player.rel.teammates = 50;
  changeRel(plain.player, 'teammates', -8);
  assert.equal(plain.player.rel.teammates, 42);
});

test('Soğukkanlı: büyük maçta heyecan %20 az, nişangah (tempo) yavaş', () => {
  const big = { kind: 'derby', label: 'Derbi', title: 'Doğu Derbisi', base: 0.3 };
  const none = nervesFor(big, { apps: 0 }, traitBonus(null));
  const cool = nervesFor(big, { apps: 0 }, traitBonus('coolheaded'));
  assert.equal(none.nerves, 0.3);
  assert.ok(Math.abs(cool.nerves - 0.24) < 1e-9);
  assert.ok(cool.skillMult > none.skillMult);
  assert.ok(cool.tempo < none.tempo && cool.tempo < 1, 'nişangah ve oyun normalden yavaş');
  assert.deepEqual(nervesFor(null, { apps: 0 }, traitBonus('coolheaded')).tempo, 1, 'normal maçta etki yok');
  // tecrübe heyecanı azaltır
  assert.ok(nervesFor(big, { apps: 200 }, traitBonus(null)).nerves < none.nerves);
});

test('büyük maç tespiti: derbi ve sezon finali', () => {
  const s = game(9);
  assert.equal(derbyName('van', 'agr'), 'Doğu Derbisi');
  assert.equal(derbyName('agr', 'van'), 'Doğu Derbisi');
  assert.equal(bigMatchFor(s, { myId: 'van', oppId: 'agr', week: 3 }).kind, 'derby');
  assert.equal(bigMatchFor(s, { myId: 'van', oppId: 'kiz', week: seasonWeeks() }).kind, 'final');
  assert.equal(bigMatchFor(s, { myId: 'van', oppId: 'kiz', week: 2 }), null);
  // Planlanan maça işlenir
  const m = getMatch(s);
  assert.ok('big' in m);
});

test('rol değişimi: 26 sonrası, nüfuz > 80 ise ≤ 20 yaş gençler talep eder; kabul → haftalık +2 nüfuz', () => {
  const s = game(10);
  setSquad(s, [
    sp({ age: 33, role: 'captain', influence: 85 }),
    sp({ age: 19, role: 'youngster', influence: 10, origin: 'academy' }),
    sp({ age: 18, role: 'youngster', influence: 8, origin: 'transfer' }),
    sp({ age: 21, role: 'regular', influence: 12 }),
  ]);
  s.player.age = 27;
  s.player.influence = 80;
  const mm = new MentorManager(s, seeded(4));
  assert.equal(mm.canReceiveRequests(), false, 'nüfuz tam 80 yetmez');
  assert.deepEqual(mm.generateRequests(1), []);
  s.player.influence = 81;
  const reqs = mm.generateRequests(1);
  assert.equal(reqs.length, 2);
  assert.ok(reqs.every((r) => r.age <= 20), '21 yaşındaki talep edemez');

  // 26 yaşında (mentee) talep yok
  s.player.age = 26;
  assert.equal(mm.canReceiveRequests(), false);
  s.player.age = 27;

  const before = { manager: s.player.rel.manager, board: s.player.rel.board, loyalty: s.player.loyalty };
  const acc = mm.acceptRequest(reqs[0].id);
  assert.equal(acc.ok, true);
  assert.ok(s.player.rel.manager > before.manager && s.player.rel.board > before.board && s.player.loyalty > before.loyalty);
  mm.declineRequest(reqs[1].id);
  assert.equal(s.mentor.legacy.requests.length, 0);

  const inf = s.player.influence;
  const loy = s.player.loyalty;
  const w = mm.onWeekEnd();
  assert.equal(s.player.influence, Math.round((inf + MENTOR_RULES.legacyInfluencePerWeek) * 10) / 10);
  assert.equal(s.player.loyalty, loy + MENTOR_RULES.legacyLoyaltyPerWeek);
  assert.ok(w.legacy && w.legacy.note.length > 5);
  // reddedilen genç bu sezon tekrar istemez
  assert.ok(!mm.generateRequests(1).some((r) => r.id === reqs[1].id));
});

test('sezon geçişi: mentorluk biter, kadro yaşlanır, 27 yaşında rol değişimi bir kez', () => {
  const s = game(11);
  const mm = new MentorManager(s);
  const c = mm.candidates();
  if (c.length) mm.chooseMentor(c[0].id);
  s.player.age = 26;
  s.calendar.week = 22;
  s.calendar.phase = 'seasonEnd';
  const ages = Object.fromEntries(s.mentor.squads[s.career.clubId].players.map((p) => [p.id, p.age]));
  const report = endSeason(s);
  assert.equal(s.player.age, 27);
  assert.equal(report.mentor.start.legacyShift, true);
  assert.equal(new MentorManager(s).active(), null, 'yeni sezonda mentor yok');
  assert.equal(new MentorManager(s).canChooseMentor().ok, false);
  if (c.length) assert.equal(s.mentor.history.length, 1);
  const now = s.mentor.squads[s.career.clubId].players.filter((p) => ages[p.id] !== undefined);
  assert.ok(now.every((p) => p.age === ages[p.id] + 1), 'kalanlar 1 yaş büyür');
  // ikinci kez tetiklenmez
  s.calendar.phase = 'seasonEnd';
  assert.equal(endSeason(s).mentor.start.legacyShift, false);
});

test('transfer: mentorluk biter, nüfuz büyük ölçüde sıfırlanır, gençler eski kulüpte kalır', () => {
  const s = game(12);
  setSquad(s, [sp({ age: 33, role: 'captain', influence: 85 })]);
  const mm = new MentorManager(s);
  mm.chooseMentor(mm.candidates()[0].id);
  s.player.influence = 60;
  s.player.fame = 10;
  const other = CLUBS.find((c) => c.id !== s.career.clubId && c.league === 'first');
  takeOffer(s, { clubId: other.id, wage: 1000, years: 2, renewal: false, signingBonus: 0 });
  assert.equal(new MentorManager(s).active(), null);
  assert.equal(s.mentor.history[s.mentor.history.length - 1].ended, 'transfer');
  assert.equal(s.player.influence, 21);
  assert.equal(s.player.mentorBonus, null);
  assert.ok(s.mentor.squads[other.id], 'yeni kulübün kadrosu oluşur');
});

test('eski kayıt göçü: mentorluk alanları eklenir', () => {
  const s = game(13);
  delete s.mentor;
  delete s.player.influence;
  delete s.player.loyalty;
  delete s.player.mentorBonus;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(typeof m.player.influence, 'number');
  assert.equal(typeof m.player.loyalty, 'number');
  assert.ok(m.mentor.squads[m.career.clubId].players.length >= 8);
  assert.ok(Array.isArray(m.mentor.legacy.mentees));
});
