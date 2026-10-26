import test from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { planMatch, resolveMoment } from '../src/core/match.js';
import { GAME_WEIGHTS } from '../src/core/data.js';
import { fakeGame, momentDifficulty } from '../scripts/bot.js';

/** İlk 11'de maç başına gol: insan becerisi ve statlara göre gerçekçi aralıkta mı */
function goalsPerStart(pos, stat, human, n = 260) {
  setRandom(seeded(stat * 7 + Math.round(human * 100)));
  const s = newGame({ name: 'Denge', position: pos });
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = stat;
  let starts = 0;
  let goals = 0;
  for (let i = 0; i < n * 2 && starts < n; i++) {
    s.calendar.week = 1 + (i % 30);
    s.pending.match = null;
    const m = planMatch(s);
    if (m.role !== 'starter') continue;
    starts++;
    for (const x of m.moments) {
      const w = GAME_WEIGHTS[x.type] || { shooting: 1 };
      let a = 0; let tw = 0;
      for (const [k, v] of Object.entries(w)) { a += s.player.stats[k] * v; tw += v; }
      resolveMoment(m, x, fakeGame(a / tw / 100, human, momentDifficulty(x, m)), 'Denge');
    }
    goals += m.tally.goals;
  }
  setRandom(Math.random);
  return goals / starts;
}

test('forvet sezonda 50-90 gol atmaz: maç başına gol gerçekçi aralıkta', () => {
  const avg = goalsPerStart('FW', 75, 0.5);
  const weak = goalsPerStart('FW', 60, 0.2);
  assert.ok(avg > 0.45 && avg < 0.95, `ortalama forvet ${avg.toFixed(2)}`);
  assert.ok(weak < avg, `zayıf ${weak.toFixed(2)} < ortalama ${avg.toFixed(2)}`);
  assert.ok(weak < 0.75, `zayıf forvet ${weak.toFixed(2)}`);
});

test('orta saha forvetten az gol atar', () => {
  const mf = goalsPerStart('MF', 75, 0.5);
  assert.ok(mf < 0.5, `orta saha ${mf.toFixed(2)}`);
});
