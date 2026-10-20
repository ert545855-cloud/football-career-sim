import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame, completeMatch, getMatch, takeOffer } from '../src/core/game.js';
import { applyAiEvent, resolveMoment } from '../src/core/match.js';
import { CLUBS } from '../src/core/data.js';
import {
  genitive, dative, accusative, analyzeSentiment, ChirpTriggerEngine, PlayerPostService, POST_STYLES, RelationshipService,
  Timeline, TEMPLATES, FABRICIO, YAGIZ, migrateChirp,
} from '../src/core/chirp/index.js';
import { COMMENT_POOLS, CommentGenerator } from '../src/core/chirp/comments.js';
import { TIMELINE_CAP } from '../src/core/chirp/timeline.js';

test('Türkçe ekler: tamlayan, belirtme, yönelme', () => {
  assert.equal(genitive('Arda Yılmaz'), "Arda Yılmaz'ın");
  assert.equal(genitive('Arda'), "Arda'nın");
  assert.equal(genitive('Kerem'), "Kerem'in");
  assert.equal(genitive('Umut Koç'), "Umut Koç'un");
  assert.equal(genitive('Emir Öztürk'), "Emir Öztürk'ün");
  assert.equal(genitive('Efe Kaya'), "Efe Kaya'nın");
  assert.equal(genitive('Boğaziçi SK'), "Boğaziçi SK'nın");
  assert.equal(accusative('Arda Yılmaz'), "Arda Yılmaz'ı");
  assert.equal(accusative('Efe Kaya'), "Efe Kaya'yı");
  assert.equal(dative('Boğaziçi SK'), "Boğaziçi SK'ya");
  assert.equal(dative('Fırat FK'), "Fırat FK'ya");
  assert.equal(dative('Toros Spor'), "Toros Spor'a");
  assert.equal(dative('Efes Gençlik'), "Efes Gençlik'e");
  assert.equal(dative('Başkent Gücü'), "Başkent Gücü'ne");
  assert.equal(dative('Anadolu Kartalları'), "Anadolu Kartalları'na");
  assert.equal(dative('Karadeniz Fırtınası'), "Karadeniz Fırtınası'na");
});

test('duygu analizi: havuzdaki her yorum niyetiyle aynı etiketi alır', () => {
  for (const [ctx, pool] of Object.entries(COMMENT_POOLS)) {
    for (const t of pool.pos) assert.equal(analyzeSentiment(t).label, 'positive', `${ctx} +: "${t}" → ${JSON.stringify(analyzeSentiment(t))}`);
    for (const t of pool.neg) assert.equal(analyzeSentiment(t).label, 'negative', `${ctx} -: "${t}" → ${JSON.stringify(analyzeSentiment(t))}`);
  }
  assert.equal(analyzeSentiment('Bu çocuk balon çıktı zaten').label, 'negative');
  assert.equal(analyzeSentiment('Hadi inşallah Real Madrid\'e gidiyoruz!').label, 'positive');
  assert.equal(analyzeSentiment('Bu kadar kibir iyi değil.').label, 'negative', '"değil" olumsuzluğu çevirmeli');
});

test('yorum üretici: 3-4 yorum, tekrar yok, taraftar ilişkisi olumlu oranı artırır', () => {
  setRandom(seeded(11));
  const gen = new CommentGenerator(seeded(12));
  let posLow = 0;
  let posHigh = 0;
  for (let i = 0; i < 200; i++) {
    const a = gen.generate('transfer_offer', { player: 'Arda', bigClub: 'Boğaziçi SK', fansRel: 10, idPrefix: 'x' });
    const b = gen.generate('transfer_offer', { player: 'Arda', bigClub: 'Boğaziçi SK', fansRel: 95, idPrefix: 'y' });
    for (const set of [a, b]) {
      assert.ok(set.length >= 3 && set.length <= 4);
      assert.equal(new Set(set.map((c) => c.text)).size, set.length);
      assert.equal(new Set(set.map((c) => c.author.handle)).size, set.length, 'aynı hesap iki kez yorum yapmamalı');
    }
    posLow += a.filter((c) => c.sentiment.label === 'positive').length;
    posHigh += b.filter((c) => c.sentiment.label === 'positive').length;
  }
  assert.ok(posHigh > posLow * 1.3, `yüksek ilişki daha olumlu olmalı (${posHigh} vs ${posLow})`);
  const one = gen.generate('transfer_offer', { player: 'Arda', bigClub: 'Boğaziçi SK', fansRel: 100, idPrefix: 'z', count: 4 });
  assert.ok(one.every((c) => !c.text.includes('{')), 'yer tutucu kalmamalı');
});

function playMatch(state, outcome) {
  const m = getMatch(state);
  for (const ev of m.events) applyAiEvent(m, ev);
  for (const mo of m.moments) resolveMoment(m, mo, outcome, 'Test');
  return completeMatch(state, m);
}

test('A) formsuzluk: son 3 maç kötü → Kulis Muhabiri tweeti (şablon + imza)', () => {
  setRandom(seeded(21));
  const s = newGame({ name: 'Arda Yılmaz', position: 'FW' });
  s.player.stats.shooting = 70; // ilk 11'de oynasın
  s.player.stats.speed = 70;
  const tweets = [];
  for (let i = 0; i < 3; i++) tweets.push(...playMatch(s, { success: false, accuracy: 0, outcome: 'save' }).chirp);
  const dip = tweets.find((t) => t.topic === 'form_dip');
  assert.ok(dip, 'formsuzluk tweeti atılmalı');
  assert.equal(dip.authorId, 'yagiz');
  assert.ok(dip.text.startsWith('Flaş Gelişme:'));
  assert.match(dip.text, /Arda Yılmaz'ın son haftalardaki performansından memnun değil\. Devre arasında kiralık gönderilmesi gündemde\./);
  assert.ok(dip.comments.length >= 3 && dip.comments.length <= 4);
});

test('B) büyük kulüpten teklif → Transfer Masası "İşte oldu!" tweeti', () => {
  setRandom(seeded(31));
  const s = newGame({ name: 'Kerem Demir', position: 'MF' });
  const big = CLUBS.find((c) => c.id === 'bog');
  const engine = new ChirpTriggerEngine(s, seeded(32));
  const [t] = engine.onOffers([{ clubId: 'bog', wage: 9000, years: 3, signingBonus: 50000 }]);
  assert.equal(t.authorId, 'fabricio');
  assert.equal(t.text, `İşte oldu! ${big.name}, Kerem Demir için resmi teklifini yaptı. Taraflar prensipte anlaşıyor. Detaylar netleşiyor.`);
  // Küçük kulüp teklifi haber olmaz
  const s2 = newGame({ name: 'Kerem Demir', position: 'MF' });
  const small = CLUBS.filter((c) => c.league === 'first').sort((a, b) => a.rating - b.rating)[0];
  assert.equal(new ChirpTriggerEngine(s2).onOffers([{ clubId: small.id, wage: 500, years: 2 }]).length, 0);
});

test('transfer kesinleşince Transfer Masası, yenilemede Kulis Muhabiri yazar', () => {
  setRandom(seeded(41));
  const s = newGame({ name: 'Efe Kaya', position: 'DF' });
  takeOffer(s, { clubId: 'pam', wage: 2000, years: 3, signingBonus: 5000 });
  const tl = new Timeline(s).list();
  const romana = tl.find((t) => t.authorId === 'fabricio' && t.topic === 'transfer_done');
  assert.ok(romana, 'Romana transferi duyurur');
  assert.match(romana.text, /^İşte oldu! Efe Kaya resmen Kocaeli Körfez'e transfer oldu\. 3 yıllık/);
  // Yeni kulübün resmi hesabı "Hoş geldin" kartı paylaşır (sözleşme detaylarıyla)
  const welcome = tl.find((t) => t.authorId === 'club:pam' && t.card?.kind === 'welcome');
  assert.ok(welcome && welcome.card.me && welcome.card.years === 3);
  takeOffer(s, { clubId: 'pam', wage: 2500, years: 2, renewal: true });
  assert.equal(new Timeline(s).list()[0].authorId, 'yagiz');
});

test('oyuncu paylaşımı: 3 üslubun ilişki etkileri şartnameyle birebir', () => {
  const expected = {
    modest: { manager: 5, fans: 5, teammates: 2 },
    ego: { sponsor: 10, teammates: -5, manager: -3 },
    aggressive: { federation: -15, fans: 10, board: -5 },
  };
  for (const [style, exp] of Object.entries(expected)) {
    setRandom(seeded(51));
    const s = newGame({ name: 'Test', position: 'FW' });
    const svc = new PlayerPostService(s, seeded(52));
    svc.createPending({ result: 'W', scoreLine: 'A 2-0 B', played: true, rating: 7.5 }, { id: '1-1', oppId: 'van' });
    const before = { ...s.player.rel };
    const out = svc.publish(style);
    for (const [k, d] of Object.entries(exp)) assert.equal(s.player.rel[k] - before[k], d, `${style}: ${k}`);
    const untouched = Object.keys(before).filter((k) => !(k in exp));
    for (const k of untouched) assert.equal(s.player.rel[k], before[k], `${style}: ${k} değişmemeli`);
    assert.equal(out.tweet.authorId, 'me');
    assert.equal(s.chirp.pendingPost, null, 'paylaşım sonrası kart kapanır');
    if (style === 'modest') assert.equal(out.tweet.text, POST_STYLES.modest.text.W);
    if (style === 'aggressive') assert.ok(out.discipline && out.discipline.risk > 0.25, 'agresif paylaşım ceza riski açar');
    else assert.equal(out.discipline, null);
  }
});

test('disiplin: düşük federasyon ilişkisi riski artırır, sonuç bir sonraki hafta sonunda gelir', () => {
  setRandom(seeded(61));
  const s = newGame({ name: 'Test', position: 'FW' });
  const rel = new RelationshipService(s);
  s.player.rel.federation = 80;
  const low = rel.disciplineRisk();
  s.player.rel.federation = 5;
  const high = rel.disciplineRisk();
  assert.ok(high > low);
  let bans = 0;
  let fines = 0;
  let clears = 0;
  for (let i = 0; i < 300; i++) {
    const st = newGame({ name: 'Test', position: 'FW' });
    st.chirp.discipline = { risk: 0.6, postedAt: 1 };
    const r = new ChirpTriggerEngine(st).onWeekEnd();
    if (r.outcome === 'ban') { bans++; assert.equal(st.flags.suspendedWeeks, 1); }
    if (r.outcome === 'fine') fines++;
    if (r.outcome === 'clear') clears++;
    assert.equal(r.tweets[0].authorId, 'yagiz');
    assert.equal(st.chirp.discipline, null);
  }
  assert.ok(bans > 30 && fines > 50 && clears > 60, `${bans}/${fines}/${clears}`);
});

test('men cezalı oyuncu maçta forma giyemez', () => {
  setRandom(seeded(71));
  const s = newGame({ name: 'Test', position: 'FW' });
  s.flags.suspendedWeeks = 1;
  assert.equal(getMatch(s).role, 'out');
});

test('zaman tüneli sınırı ve beğeni', () => {
  const s = newGame({ name: 'Test', position: 'FW' });
  const engine = new ChirpTriggerEngine(s, seeded(81));
  for (let i = 0; i < TIMELINE_CAP + 15; i++) engine.post(i % 2 ? FABRICIO : YAGIZ, 'injury', TEMPLATES.injury, { weeks: 2 });
  const tl = new Timeline(s);
  assert.equal(tl.list().length, TIMELINE_CAP);
  const id = tl.list()[0].id;
  const before = tl.list()[0].likes;
  assert.deepEqual(tl.toggleLike(id), { liked: true, likes: before + 1 });
  assert.equal(tl.toggleLike(id).liked, false);
});

test('eski kayıt göçü: yeni ilişkiler ve zaman tüneli eklenir', () => {
  const s = newGame({ name: 'Test', position: 'FW' });
  delete s.chirp;
  delete s.player.rel.sponsor;
  delete s.player.rel.federation;
  delete s.player.rel.board;
  migrateChirp(s);
  assert.equal(typeof s.player.rel.sponsor, 'number');
  assert.equal(typeof s.player.rel.federation, 'number');
  assert.equal(typeof s.player.rel.board, 'number');
  assert.ok(Array.isArray(s.chirp.timeline));
});
