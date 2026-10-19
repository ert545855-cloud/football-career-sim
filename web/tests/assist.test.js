import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import { applyAiEvent, planMatch, resolveMoment } from '../src/core/match.js';
import { clubLineup, pickScorer } from '../src/core/lineups.js';

const fresh = () => {
  setRandom(seeded(7));
  const s = newGame({ name: 'Asist Test', position: 'MF' });
  const m = planMatch(s);
  m.score = { my: 0, opp: 0 };
  m.goals = [];
  return { s, m };
};

test('asist: pas tutsa bile pozisyon golle bitmezse asist sayılmaz', () => {
  const { m } = fresh();
  const mo = ({ type: 'pass', context: 'final', minute: 70 });
  resolveMoment(m, mo, { success: true, accuracy: 0.9, assistGoal: false, finish: 'save' }, 'Ali');
  assert.equal(m.tally.assists, 0);
  assert.equal(m.score.my, 0);
});

test('asist: son pas golle biterse asist ve golcü ismi', () => {
  const { m } = fresh();
  const mo = ({ type: 'pass', context: 'final', minute: 70 });
  const lines = resolveMoment(m, mo, { success: true, accuracy: 0.9, assistGoal: true, finish: 'goal', shooterNum: 9 }, 'Ali');
  assert.equal(m.tally.assists, 1);
  assert.equal(m.score.my, 1);
  assert.equal(m.goals.length, 1);
  assert.ok(m.goals[0].meAssist);
  assert.ok(m.goals[0].scorer, 'golcü ismi var');
  assert.ok(lines.some((l) => /ASİST/.test(l.text)));
});

test('asist: oyun kurma pası hiçbir zaman asist değildir', () => {
  const { m } = fresh();
  for (let i = 0; i < 200; i++) {
    const mo = ({ type: 'pass', context: 'buildup', minute: 30 });
    resolveMoment(m, mo, { success: true, accuracy: 1 }, 'Ali');
  }
  assert.equal(m.tally.assists, 0);
});

test('rakip golleri golcü isimleriyle yazılır', () => {
  const { m } = fresh();
  const ln = applyAiEvent(m, { minute: 33, kind: 'goal', side: 'opp' });
  assert.equal(m.score.opp, 1);
  assert.equal(m.goals[0].side, 'opp');
  assert.ok(m.goals[0].scorer && ln.text.includes(m.goals[0].scorer.split(' ').slice(1).join(' ')));
});

test('kadrolar: kulübe ve sezona göre sabit, golcü çoğunlukla forvet', () => {
  const { s } = fresh();
  const opp = Object.keys(s.world.leagues).length && planMatch(s).oppId;
  const a = clubLineup(s, opp);
  const b = clubLineup(s, opp);
  assert.equal(a.length, 11);
  assert.deepEqual(a.map((p) => p.name), b.map((p) => p.name));
  const mine = clubLineup(s, s.career.clubId, { mine: true });
  assert.equal(mine.length, 10, 'oyuncunun kendisi kadroda değil');
  let fw = 0;
  for (let i = 0; i < 400; i++) if (pickScorer(a).scorer.pos === 'FW') fw++;
  assert.ok(fw > 200, `forvet golleri ${fw}`);
  for (let i = 0; i < 200; i++) assert.notEqual(pickScorer(a).scorer.pos, 'GK');
});
