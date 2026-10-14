import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { FeedEngine, PlayerPostService, Timeline, fillTemplate } from '../src/core/chirp/index.js';
import { COMMENT_POOLS, CommentGenerator } from '../src/core/chirp/comments.js';
import { RICH_COMMENTS } from '../src/core/chirp/content.js';
import { extractTags } from '../src/core/chirp/models.js';
import { randomName, NAME_BLOCK } from '../src/core/world/names.js';
import { getMatch } from '../src/core/game.js';

const fresh = (seed = 3) => {
  setRandom(seeded(seed));
  return newGame({ name: 'Arda Yılmaz', position: 'FW' });
};

test('yeni kariyerde akış boş başlamaz: kulübün maç önü kartı ve gündem', () => {
  const s = fresh();
  const tl = new Timeline(s).list();
  const pre = tl.find((t) => t.card?.kind === 'preview');
  assert.ok(pre, 'maç önü kartı');
  assert.equal(pre.authorId, `club:${s.career.clubId}`);
  assert.ok(pre.author.verified);
  assert.ok(s.chirp.trends.length >= 3);
});

test('kötü maç → taraftar linci (pankart), iyi maç → 150 milyon dolar coşkusu + değer kartı + transfer ilgisi', () => {
  const s = fresh(5);
  const m = getMatch(s);
  const feed = new FeedEngine(s, seeded(6));
  const morale = s.player.morale;
  const bad = feed.afterMatch({ played: true, rating: 4.8, goals: 0, assists: 0, result: 'L', motm: false }, { ...m, score: { my: 0, opp: 3 } });
  const lynch = bad.find((t) => t.authorId === `fans:${s.career.clubId}`);
  assert.ok(lynch && lynch.card.kind === 'banner' && lynch.card.tone === 'bad');
  assert.ok(s.player.morale < morale);
  const good = feed.afterMatch({ played: true, rating: 9.1, goals: 2, assists: 1, result: 'W', motm: true }, { ...m, score: { my: 3, opp: 0 } });
  const hype = good.find((t) => t.authorId === `fans:${s.career.clubId}`);
  assert.ok(hype && hype.card.tone === 'good');
  assert.ok(good.some((t) => t.card?.kind === 'value' && t.card.hype === '$150M'));
  assert.ok(s.chirp.hype > 0, 'birkaç hafta transfer ilgisi');
  const res = good.find((t) => t.card?.kind === 'result');
  assert.ok(res && res.card.hg + res.card.ag === 3);
});

test('serbest gönderi: üslup analizi, ilişki etkileri, ceza riski ve gündem', () => {
  const s = fresh(7);
  s.player.fame = 80;
  const svc = new PlayerPostService(s, seeded(8));
  const fed = s.player.rel.federation;
  const a = svc.publishText('Hakem bugün rezaletti, VAR nerede?! #VARNerede');
  assert.ok(s.player.rel.federation < fed);
  assert.ok(a.discipline && a.discipline.risk > 0);
  assert.deepEqual(a.tweet.tags, ['#VARNerede']);
  const mate = svc.mates()[0];
  const coach = s.player.rel.manager;
  const b = svc.publishText(`${mate} ilk 11'de olmalı, çok çalışıyor 👏`);
  assert.ok(s.player.rel.manager < coach, 'hocanın kararını sorgulamak');
  assert.ok(b.tweet.comments.length >= 2);
  let trended = 0;
  for (let i = 0; i < 6; i++) if (svc.publishText(`Bu akşam stat dolsun #Gece${i}`).trending) trended++;
  assert.ok(trended >= 1, 'ünlü oyuncunun etiketi gündeme oturur');
  assert.ok(s.chirp.trends.some((t) => t.kind === 'mine'));
});

test('yanıt: oyuncunun yorumu en üste eklenir, taraftar cevap verir', () => {
  const s = fresh(9);
  const svc = new PlayerPostService(s, seeded(10));
  const tw = s.chirp.timeline[0];
  const n = tw.comments.length;
  const r = svc.reply(tw.id, 'Taraftarımıza teşekkürler 🙏');
  assert.ok(r);
  assert.equal(tw.comments[0].me, true);
  assert.ok(tw.comments.length >= n + 2);
});

test('yorumlar: zengin havuz, yabancı kullanıcılar ve "şu oyuncu oynamalı"', () => {
  const g = new CommentGenerator(seeded(11));
  let lineup = 0;
  let foreign = 0;
  for (let i = 0; i < 60; i++) {
    const cs = g.generateRich('preview', { vars: { first: 'Arda', opp: 'Van', clubShort: 'SAP' }, mates: ['Kerem Kaya', 'Emir Demir'], foreign: 0.3, lineup: 0.3, idPrefix: `t${i}` });
    assert.ok(cs.length >= 2 && cs.length <= 5);
    assert.equal(new Set(cs.map((c) => c.author.handle)).size, cs.length);
    for (const c of cs) {
      assert.ok(!c.text.includes('{'), c.text);
      if (/Kerem Kaya|Emir Demir/.test(c.text)) lineup++;
      if (c.author.lang) foreign++;
    }
  }
  assert.ok(lineup > 10 && foreign > 10, `${lineup} / ${foreign}`);
  for (const [k, pool] of Object.entries(RICH_COMMENTS)) assert.ok(pool.length >= 3, k);
  assert.ok(Object.keys(COMMENT_POOLS).includes('gossip'));
});

test('Türkçe ekler ve etiketler; gerçek ünlü isim birleşimleri üretilmez', () => {
  assert.equal(fillTemplate('{x:loc}', { x: 'Premier Lig' }), "Premier Lig'de");
  assert.equal(fillTemplate('{x:loc}', { x: 'Serie A' }), "Serie A'da");
  assert.equal(fillTemplate('{x:loc}', { x: 'Primera División' }), "Primera División'da");
  assert.deepEqual(extractTags('Hadi #ŞampiyonlukYakın &#39; #VAR'), ['#ŞampiyonlukYakın', '#VAR']);
  const rnd = seeded(12);
  for (let i = 0; i < 3000; i++) assert.ok(!NAME_BLOCK.has(randomName('pt', rnd)));
});

test('milli takım kadrosu kartı (çağrıldıysan adın vurgulu) ve Avrupa sonuç kartı', () => {
  const s = fresh(13);
  const feed = new FeedEngine(s, seeded(14));
  const t = feed.nationalSquad({ level: 'U21' });
  assert.equal(t.card.kind, 'squad');
  assert.equal(t.card.highlight, s.player.name);
  const all = Object.values(t.card.groups).flat();
  assert.equal(all.length, 23);
  assert.ok(all.includes(s.player.name));
  const cup = s.world.europe.cups.cl;
  const posts = feed.europe([{ cup: 'cl', stage: 'group', md: 1, matches: [{ h: cup.groups[0][0], a: cup.groups[0][1], hg: 2, ag: 1, w: cup.groups[0][0] }] }], null);
  assert.equal(posts[0].authorId, 'avrupa');
  assert.equal(posts[0].card.kind, 'cup');
});
