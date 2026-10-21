import { midWindowWeek } from '../src/core/calendar.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame, endSeason, getMatch, completeMatch, takeOffer } from '../src/core/game.js';
import { selection } from '../src/core/match.js';
import { CLUB_BY_ID, CLUBS, LEAGUES } from '../src/core/data.js';
import { createWorld, leagueOf } from '../src/core/league.js';
import { MentorManager } from '../src/core/mentor/index.js';
import { migrate } from '../src/core/storage.js';
import {
  TryoutSession, STATIONS, MAX_SCORE, unlockedOptions, buildStarterOffers, offerPools, recommendPosition, tryoutStatBonus,
  simulateStation, YOUTH_NUMBERS, isTransferLocked,
} from '../src/core/onboarding/index.js';
import { playWeek } from '../scripts/bot.js';

/** Bir istasyonu verilen sonuç dizisiyle oynatır (ilk eleman ısınma) */
function playStation(session, results) {
  const out = [];
  for (const r of results) {
    if (session.state().done) break;
    out.push(session.record(r));
  }
  return { out, summary: session.finishStation() };
}

test('hak sistemi: her istasyonda 3 kalp, hata 1 kalp götürür, ısınma götürmez', () => {
  const s = new TryoutSession();
  assert.equal(s.current.id, 'pass');
  assert.equal(s.isWarmup(), true);
  const w = s.record(false);
  assert.equal(w.warmup, true);
  assert.equal(w.hearts, 3, 'ısınmada kalp gitmez');
  const r1 = s.record(false);
  assert.equal(r1.lostHeart, true);
  assert.equal(r1.hearts, 2);
  s.record(true);
  assert.equal(s.state().hearts, 2, 'başarı kalp götürmez');
});

test('istasyon: kalpler bitince ya da denemeler bitince kapanır, kalan kalp kaydedilir', () => {
  const s = new TryoutSession();
  // Pas: ısınma + 3 hata → 0 kalp, deneme hakkı kalsa da istasyon biter
  const a = playStation(s, [true, false, false, false, true, true]);
  assert.equal(a.out.length, 4);
  assert.equal(a.out[3].stationOver, true);
  assert.equal(a.summary.hearts, 0);
  assert.equal(a.summary.eliminated, true);
  // Şut: ısınma + 5 deneme, 1 hata → 2 kalp
  assert.equal(s.current.id, 'shot');
  const b = playStation(s, [false, true, true, false, true, true]);
  assert.equal(b.summary.hearts, 2);
  assert.equal(b.summary.attempts, 5);
  // Çalım: kusursuz → 3 kalp
  const c = playStation(s, [true, true, true, true, true, true, true, true]);
  assert.equal(c.summary.hearts, 3);
  assert.equal(s.finished, true);
  assert.equal(s.score(), 5);
  assert.throws(() => s.record(true), /bitti/);
});

test('seçme skoru en fazla 9; oturum kayıttan devam eder', () => {
  const s = new TryoutSession();
  for (let i = 0; i < STATIONS.length; i++) simulateStation(s, 1);
  assert.equal(s.score(), MAX_SCORE);
  assert.equal(MAX_SCORE, 9);
  const mid = new TryoutSession();
  mid.record(true);
  mid.record(false);
  const restored = new TryoutSession(JSON.parse(JSON.stringify(mid.toJSON())));
  assert.equal(restored.current.id, 'pass');
  assert.equal(restored.state().hearts, 2);
  assert.equal(restored.isWarmup(), false);
});

test('teklif kademeleri: 9–7 → A,B,C · 6–4 → A,B · 3 ve altı → A', () => {
  for (const sc of [9, 8, 7]) assert.deepEqual(unlockedOptions(sc), ['A', 'B', 'C']);
  for (const sc of [6, 5, 4]) assert.deepEqual(unlockedOptions(sc), ['A', 'B']);
  for (const sc of [3, 2, 1, 0]) assert.deepEqual(unlockedOptions(sc), ['A']);
});

test('teklif havuzları: A en alt lig, B Süper Lig + 1. Lig kiralık, C dev kulüp U-17', () => {
  const world = createWorld(1);
  const pools = offerPools(world);
  const rnd = seeded(5);
  for (let i = 0; i < 30; i++) {
    const [A, B, C] = buildStarterOffers(world, 9, { ovr: 22 }, rnd);
    assert.equal(A.kind, 'A');
    assert.ok(pools.lower.includes(A.clubId));
    assert.equal(CLUB_BY_ID[A.clubId].league, 'first');
    assert.equal(B.kind, 'B');
    assert.equal(CLUB_BY_ID[B.parentId].league, 'super');
    assert.equal(CLUB_BY_ID[B.clubId].league, 'first');
    assert.notEqual(B.clubId, A.clubId);
    assert.equal(B.loanSeasons, 1);
    assert.equal(C.kind, 'C');
    assert.equal(CLUB_BY_ID[C.clubId].league, 'u17');
    assert.equal(CLUB_BY_ID[C.clubId].parentId, C.parentId);
    assert.ok(pools.giants.includes(C.parentId));
  }
  const low = buildStarterOffers(world, 5, { ovr: 22 }, rnd);
  assert.deepEqual(low.map((o) => o.locked), [false, false, true]);
  const lowest = buildStarterOffers(world, 2, { ovr: 22 }, rnd);
  assert.deepEqual(lowest.map((o) => o.locked), [false, true, true]);
});

test('mevki önerisi ve başlangıç özellik katkısı', () => {
  assert.equal(recommendPosition([{ id: 'pass', hearts: 3, successes: 5 }, { id: 'shot', hearts: 1, successes: 3 }, { id: 'dribble', hearts: 2, successes: 6 }]), 'MF');
  assert.equal(recommendPosition([{ id: 'pass', hearts: 1, successes: 3 }, { id: 'shot', hearts: 3, successes: 5 }, { id: 'dribble', hearts: 3, successes: 5 }]), 'FW');
  const s = new TryoutSession();
  simulateStation(s, 1);
  simulateStation(s, 0);
  simulateStation(s, 1);
  assert.deepEqual(tryoutStatBonus(s.report()), { passing: 3, shooting: 0, speed: 3 });
});

function startWith(kind, seed = 3) {
  setRandom(seeded(seed));
  const world = createWorld(1);
  const offer = buildStarterOffers(world, 9, { ovr: 22 }, seeded(seed + 1)).find((o) => o.kind === kind);
  return newGame({ name: 'Arda Yılmaz', position: 'MF', start: offer, statBonus: { passing: 2 } });
}

test('numara: seçilmez, boştaki genç numaralarından atanır ve kadroda çakışmaz', () => {
  for (let seed = 1; seed < 15; seed++) {
    const s = startWith('A', seed);
    assert.ok(YOUTH_NUMBERS.includes(s.player.number), `${s.player.number} genç numarası değil`);
    const taken = new MentorManager(s).squad().map((p) => p.number);
    assert.ok(!taken.includes(s.player.number), 'kadroda başka oyuncunun numarası');
    assert.equal(s.career.numberHistory[0].number, s.player.number);
  }
  // Eski davranış (testler/bot): numara verilirse korunur
  setRandom(seeded(2));
  assert.equal(newGame({ name: 'Bot', position: 'FW', number: 9 }).player.number, 9);
});

test('A: alt lig takımı, düşük OVR ile bile ilk sezon ilk 11 garantisi', () => {
  const s = startWith('A');
  assert.equal(CLUB_BY_ID[s.career.clubId].league, 'first');
  assert.equal(s.player.stats.passing, 27, 'seçme katkısı (+2) işlendi');
  s.player.energy = 10;
  assert.equal(selection(s).role, 'starter');
  assert.equal(selection(s).reason, 'guarantee');
  s.flags.injuredWeeks = 1;
  assert.equal(selection(s).role, 'out', 'sakatlık garantiyi aşar');
  s.flags.injuredWeeks = 0;
  s.calendar.season = 2;
  assert.notEqual(selection(s).reason, 'guarantee', 'garanti yalnızca ilk sezon');
});

test('B: Süper Lig sözleşmesi + kiralık; devre arası transfer kapalı; sezon sonu ana kulübe dönüş', () => {
  const s = startWith('B');
  const parent = s.career.loan.parentId;
  assert.equal(CLUB_BY_ID[parent].league, 'super');
  assert.equal(CLUB_BY_ID[s.career.clubId].league, 'first');
  assert.equal(s.career.contract.yearsLeft, 3);
  assert.equal(isTransferLocked(s), true);
  assert.equal(selection(s).role, 'starter');
  let weeks = 0;
  let checkedWindow = false;
  while (s.calendar.phase === 'week' && weeks++ < 80) {
    const wk = s.calendar.week;
    const { out } = playWeek(s, 0.5);
    if (wk === midWindowWeek()) {
      assert.equal(out.weekEnd.offers, null, 'kiralıkta devre arası teklif yok');
      checkedWindow = true;
    }
    if (s.calendar.season === 2) break;
  }
  assert.ok(checkedWindow);
  assert.equal(s.calendar.season, 2);
  // bot sezon sonu teklifini kabul etmiş olabilir; etmediyse ana kulüpte olmalı
  if (s.career.moves === 0) assert.equal(s.career.clubId, parent);
  assert.equal(s.career.loan, null);
  assert.ok(s.career.news.some((n) => n.text.includes('Kiralık süren bitti')));
});

test('C: altyapı U-17 ligi oynanır; sezon sonunda A takım sözleşmesi', () => {
  const s = startWith('C');
  const parent = s.career.academy.parentId;
  assert.equal(leagueOf(s.career.clubId), 'u17');
  assert.ok(s.world.leagues.u17, 'U-17 ligi dünyada var');
  assert.equal(LEAGUES.u17.youth, true);
  const m = getMatch(s);
  assert.equal(CLUB_BY_ID[m.oppId].league, 'u17');
  // Mentor adayları A takım kadrosundan gelir
  assert.equal(new MentorManager(s).clubId, parent);
  let weeks = 0;
  while (s.calendar.season === 1 && weeks++ < 80) playWeek(s, 0.6);
  assert.equal(s.career.academy, null);
  assert.equal(s.career.contract.yearsLeft >= 2, true);
  const graduated = s.career.news.find((n) => n.text.includes('A takıma yükseldin') || n.text.includes('profesyonel sözleşme'));
  assert.ok(graduated, 'yükselme haberi');
  if (s.career.moves === 0) assert.ok(s.career.clubId === parent || s.career.loan?.parentId === parent);
});

test('U-17 takımları transfer tekliflerine ve kulüp listesine girmez', () => {
  assert.ok(CLUBS.every((c) => !c.youth));
  setRandom(seeded(9));
  const s = startWith('A', 9);
  for (let i = 0; i < 40; i++) {
    s.calendar.phase = 'seasonEnd';
    s.calendar.week = 22;
    const r = endSeason(s);
    for (const o of s.pending.offers?.list || []) assert.ok(!CLUB_BY_ID[o.clubId].youth);
    s.pending.offers = null;
    if (r.mustRetire) break;
  }
});

test('eski kayıt göçü: başlangıç alanları eklenir', () => {
  setRandom(seeded(4));
  const s = newGame({ name: 'Eski', position: 'FW', number: 10 });
  delete s.career.loan;
  delete s.career.academy;
  delete s.career.guarantee;
  delete s.career.numberHistory;
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(m.career.loan, null);
  assert.equal(m.career.guarantee, null);
  assert.equal(m.career.numberHistory[0].number, 10);
});
