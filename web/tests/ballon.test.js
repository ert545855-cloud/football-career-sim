import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { migrate } from '../src/core/storage.js';
import { BALLON_RULES, ballonOnMatch, ballonRank, ballonSeasonEnd, ballonStandings, visibility } from '../src/core/ballondor.js';

test('altın top: aday havuzu ve haftalık puanlar', () => {
  setRandom(seeded(41));
  const s = newGame({ name: 'Test', position: 'FW' });
  assert.equal(ballonStandings(s).length, BALLON_RULES.nominees);
  ballonOnMatch(s, { played: true, goals: 2, assists: 1, rating: 8.5, motm: true, result: 'W' });
  assert.ok(s.ballon.me > 0, 'oyuncu puan alır');
  assert.ok(s.ballon.pool.every((p) => p.pts > 0), 'yıldızlar her hafta puan toplar');
  const before = s.ballon.me;
  ballonOnMatch(s, { played: false });
  assert.equal(s.ballon.me, before, 'oynamayan puan almaz');
});

test('altın top: görünürlük lig ve güçle artar', () => {
  setRandom(seeded(42));
  const s = newGame({ name: 'Test', position: 'FW' });
  const low = visibility(s);
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = 85;
  const high1 = visibility(s);
  s.career.clubId = 'bog';
  const high2 = visibility(s);
  assert.ok(low < high1 && high1 < high2);
});

test('altın top: tören sonucu, ödül ve yeni sezon sıfırlaması', () => {
  setRandom(seeded(43));
  const s = newGame({ name: 'Test', position: 'FW' });
  s.ballon.me = 9999;
  const r = ballonSeasonEnd(s, { awards: [], season: 1 });
  assert.equal(r.rank, 1);
  assert.ok(r.won && r.podium[0].me);
  assert.ok(s.career.awards.some((a) => a.ballon));
  assert.equal(s.ballon.me, 0);
  assert.ok(s.ballon.pool.every((p) => p.pts === 0));
  assert.equal(s.ballon.history.length, 1);
  const r2 = ballonSeasonEnd(s, { awards: [], season: 2 });
  assert.equal(r2.rank, BALLON_RULES.nominees, 'puansız oyuncu sonda');
  assert.equal(ballonRank(s), BALLON_RULES.nominees);
  const old = JSON.parse(JSON.stringify(s));
  delete old.ballon;
  assert.ok(migrate(old).ballon.pool.length > 0);
});
