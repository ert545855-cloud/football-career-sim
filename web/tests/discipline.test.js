import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeded } from '../src/core/rng.js';
import { DISC_RULES, disciplineOnMatch, ensureDisc, refDecision, sendOff } from '../src/core/discipline.js';

const mk = () => ({ moments: [{ minute: 30, done: true }, { minute: 60 }, { minute: 80 }], events: [{ minute: 70, side: 'my', kind: 'goal' }], tally: {} });
const never = () => 0.99;
const always = () => 0;

test('hakem: yandan ilk faul sözlü uyarı, ikincisi sarı, sarılıyken kırmızı', () => {
  const m = mk();
  assert.equal(refDecision(m, { foulType: 'side' }, {}, never).card, 'warning');
  assert.equal(refDecision(m, { foulType: 'side' }, {}, never).card, 'yellow');
  assert.equal(refDecision(m, { foulType: 'side' }, {}, never).card, 'second');
  assert.equal(ensureDisc(m).red, 'second');
});

test('hakem: arkadan doğrudan sarı; son adamsa ve sertse kırmızı', () => {
  const m = mk();
  assert.equal(refDecision(m, { foulType: 'behind' }, {}, never).card, 'yellow');
  const m2 = mk();
  assert.equal(refDecision(m2, { foulType: 'behind', reckless: true, lastMan: true }, {}, always).card, 'red');
  const m3 = mk();
  assert.equal(refDecision(m3, { foulType: 'side', reckless: true }, {}, never).card, 'yellow', 'sert yandan faul uyarısız sarı');
});

test('hakem: egoist oyuncuya sert, disiplinli oyuncuya hoşgörülü', () => {
  let egoYellow = 0;
  let calmWarn = 0;
  const r = seeded(4);
  for (let i = 0; i < 300; i++) {
    if (refDecision(mk(), { foulType: 'side' }, { attitude: 90 }, r).card === 'yellow') egoYellow++;
    const m = mk();
    refDecision(m, { foulType: 'side' }, { discipline: 90, attitude: -80 }, r);
    if (refDecision(m, { foulType: 'side' }, { discipline: 90, attitude: -80 }, r).card === 'warning') calmWarn++;
  }
  assert.ok(egoYellow > 20, `egoist sarı ${egoYellow}`);
  assert.ok(calmWarn > 30, `disiplinli ikinci uyarı ${calmWarn}`);
});

test('kırmızı kart: kalan anlar iptal, cezalar ve sarı birikimi', () => {
  const m = mk();
  sendOff(m, 50);
  assert.equal(m.sentOff, 50);
  assert.ok(m.moments[1].skipped && m.moments[2].skipped);
  assert.ok(!m.moments[0].skipped);
  const s = { career: {}, flags: {} };
  m.disc = { red: 'red', yellow: 0 };
  assert.equal(disciplineOnMatch(s, m).ban, DISC_RULES.redBan);
  assert.equal(s.flags.suspendedWeeks, 2);
  const s2 = { career: {}, flags: {} };
  for (let i = 0; i < DISC_RULES.yellowsForBan - 1; i++) assert.equal(disciplineOnMatch(s2, { disc: { yellow: 1 } }).ban, 0);
  assert.equal(disciplineOnMatch(s2, { disc: { yellow: 1 } }).ban, 1);
  assert.equal(s2.career.yellows, 0);
});
