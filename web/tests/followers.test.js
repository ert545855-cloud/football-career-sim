import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { PlayerPostService } from '../src/core/chirp/posts.js';
import { followerTarget, followersOnMatch, followersOnWeek, popularityOf, riseScore, VERIFIED_AT } from '../src/core/chirp/followers.js';
import { GALLERY_CAP, addFrame, framesOfMatch, galleryOf, lifestyleOptions, photoStore } from '../src/core/chirp/photos.js';
import { ensureNational } from '../src/core/national.js';

const fresh = (seed = 41) => {
  setRandom(seeded(seed));
  return newGame({ name: 'Takipçi Test', position: 'FW' });
};

test('takipçi hedefi kariyer yükselişiyle büyür (güç, lig, milli forma, kupalar)', () => {
  const s = fresh();
  const t0 = followerTarget(s);
  assert.ok(t0 >= 300 && t0 <= 5000, `yeni oyuncu ~1 bin (${t0})`);
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = 80;
  const t1 = followerTarget(s);
  assert.ok(t1 > t0 * 5, 'güç arttıkça hedef büyür');
  ensureNational(s).caps.A = 40;
  s.career.awards.push(...Array.from({ length: 12 }, (_, i) => ({ season: i + 1, title: 'Şampiyon', icon: 'trophy' })));
  s.player.fame = 100;
  const t2 = followerTarget(s);
  assert.ok(t2 > t1 * 3, 'milli forma + kupalar + ün katlar');
  assert.ok(riseScore(s) > 0.6);
  s.ballon = { history: [{ season: 5, rank: 1 }] };
  assert.ok(followerTarget(s) >= t2 * 2.5, 'Altın Top takipçiyi katlar');
});

test('haftalık güncelleme hedefe yaklaşır; kilometre taşı ve onaylı hesap', () => {
  const s = fresh(42);
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = 88;
  ensureNational(s).caps.A = 60;
  s.player.fame = 100;
  const target = followerTarget(s);
  assert.ok(target > VERIFIED_AT);
  let hits = [];
  for (let i = 0; i < 80; i++) {
    s.calendar.week = 1 + (i % 30);
    hits = hits.concat(followersOnWeek(s, () => 0.5).milestones);
  }
  assert.ok(s.chirp.followers > target * 0.95, 'hedefe ulaştı');
  assert.ok(hits.includes(VERIFIED_AT) && s.chirp.verified, '100 bin: onaylı hesap');
  assert.ok(s.chirp.followerHistory.length > 1);
  assert.ok(popularityOf(1_000_000) > popularityOf(10_000));
});

test('maç sıçraması: gol ve not takipçi getirir, oynamayana yok', () => {
  const s = fresh(43);
  const f0 = s.chirp.followers;
  assert.equal(followersOnMatch(s, { played: false }).delta, 0);
  const r = followersOnMatch(s, { played: true, goals: 3, assists: 1, rating: 9.2, motm: true }, { big: { kind: 'derby' } });
  assert.ok(r.delta > 0 && s.chirp.followers === f0 + r.delta);
});

test('maç kareleri: galeri sınırı, maçın en iyi karesi, fotoğraflı gönderi daha çok beğeni alır', () => {
  const s = fresh(44);
  for (let i = 0; i < GALLERY_CAP + 6; i++) addFrame(s, { kind: 'snap', minute: i, score: '0-0', opp: 'Rakip', matchId: 'm0' }, `data:image/jpeg;base64,${i}`);
  assert.equal(galleryOf(s).length, GALLERY_CAP);
  const g = addFrame(s, { kind: 'goal', minute: 77, score: '2-1', opp: 'Rakip', matchId: 'm1' }, 'data:image/jpeg;base64,goal');
  addFrame(s, { kind: 'celebration', minute: 77, score: '2-1', opp: 'Rakip', matchId: 'm1' }, null);
  assert.equal(framesOfMatch(s, 'm1')[0].id, g.id, 'gol karesi önce');
  assert.equal(photoStore.get(g.id), 'data:image/jpeg;base64,goal');
  // aynı durumda fotoğraflı ve fotoğrafsız gönderi
  const svcA = new PlayerPostService(s, () => 0.5);
  const plain = svcA.publishText('Harika maç!');
  const svcB = new PlayerPostService(s, () => 0.5);
  const withPic = svcB.publishText('Harika maç!', { pic: { t: 'frame', id: g.id } });
  assert.ok(withPic.tweet.likes > plain.tweet.likes * 1.5, 'gol karesi beğeniyi artırır');
  assert.equal(withPic.tweet.meta.pic.id, g.id);
  assert.ok(galleryOf(s).find((x) => x.id === g.id).used, 'paylaşılan kare işaretlenir');
  // yaşam fotoğrafı
  const life = lifestyleOptions(s);
  assert.ok(life.some((o) => o.scene === 'selfie') && life.some((o) => o.scene === 'training'));
  const lp = new PlayerPostService(s, () => 0.5).publishText('', { pic: { t: 'scene', scene: 'selfie', seed: 3 } });
  assert.ok(lp && lp.tweet.meta.pic.scene === 'selfie', 'yalnız fotoğrafla gönderi');
});
