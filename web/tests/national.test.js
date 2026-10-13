import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import {
  NATIONAL_WEEKS, callUpLevel, declineCallUp, finishTournament, nationalWindow, playNationalMatch, startTournament, tournamentEligible,
} from '../src/core/national.js';
import { playWeek } from '../scripts/bot.js';

const setStats = (s, v) => { for (const k of Object.keys(s.player.stats)) s.player.stats[k] = v; };

test('milli: çağrı seviyesi yaşa ve güce göre', () => {
  setRandom(seeded(31));
  const s = newGame({ name: 'Test', position: 'FW' });
  s.player.ratings = [7, 7, 7];
  setStats(s, 20);
  assert.equal(callUpLevel(s), null, 'zayıf oyuncu çağrılmaz');
  s.player.age = 18;
  setStats(s, 32);
  assert.equal(callUpLevel(s), 'U19');
  setStats(s, 45);
  assert.equal(callUpLevel(s), 'U21');
  s.player.age = 25;
  assert.equal(callUpLevel(s), null, '21 yaş üstü U-21\'e çağrılmaz');
  setStats(s, 66);
  assert.equal(callUpLevel(s), 'A');
  s.player.rel.federation = 10;
  assert.equal(callUpLevel(s), null, 'federasyonla arası bozuksa çağrı yok');
});

test('milli: pencere yalnızca milli ara haftalarında; maç ve ret etkileri', () => {
  setRandom(seeded(32));
  const s = newGame({ name: 'Test', position: 'MF' });
  s.player.age = 24;
  s.player.ratings = [7.5, 7.5];
  setStats(s, 70);
  s.calendar.week = 3;
  assert.equal(nationalWindow(s), null);
  s.calendar.week = NATIONAL_WEEKS[0];
  const call = nationalWindow(s);
  assert.ok(call && call.level === 'A' && s.pending.national);
  const r = playNationalMatch(s, { success: true, accuracy: 1 });
  assert.ok(r && ['W', 'D', 'L'].includes(r.res));
  assert.equal(s.national.caps.A, 1);
  assert.equal(s.career.caps, 1);
  assert.equal(s.pending.national, null);

  s.calendar.week = NATIONAL_WEEKS[1];
  nationalWindow(s);
  const fed = s.player.rel.federation;
  declineCallUp(s);
  assert.equal(s.player.rel.federation, fed - 8);
  assert.equal(s.national.declined, 1);
  assert.equal(s.national.caps.A, 1);
});

test('milli: turnuva yalnızca çift sezonda, final sonucu ödüle yansır', () => {
  setRandom(seeded(33));
  const s = newGame({ name: 'Test', position: 'FW' });
  s.player.age = 26;
  s.player.ratings = [8, 8];
  setStats(s, 80);
  s.calendar.season = 3;
  assert.equal(tournamentEligible(s), false);
  s.calendar.season = 4;
  assert.equal(tournamentEligible(s), true);
  let champion = 0;
  for (let i = 0; i < 30; i++) {
    const t = startTournament(s);
    assert.ok(t.stages.length >= 1 && t.stages[0].matches.length === 3);
    const out = finishTournament(s, { success: true, accuracy: 1 });
    assert.ok(['group', 'qf', 'sf', 'final', 'champion'].includes(out.t.result));
    if (out.t.result === 'champion') {
      champion++;
      assert.ok(out.award && s.career.awards.some((a) => a.national));
    }
  }
  assert.ok(champion > 0, 'güçlü bir takımla en az bir kez şampiyon olunmalı');
  assert.equal(tournamentEligible(s), false, 'aynı sezonda ikinci turnuva yok');
});

test('milli: uzun otomatik kariyerde milli maçlar birikir, sayılar geçerli', () => {
  setRandom(seeded(34));
  const s = newGame({ name: 'Bot', position: 'FW' });
  let seasons = 0;
  for (let w = 0; w < 400 && seasons < 6; w++) {
    const { report } = playWeek(s, 0.8);
    if (report) seasons++;
    assert.ok(s.player.energy >= 0 && s.player.energy <= 100);
  }
  const caps = s.national.caps;
  assert.ok(caps.U19 + caps.U21 + caps.A > 0, `milli forma giyilmeli: ${JSON.stringify(caps)}`);
  assert.equal(s.career.caps, caps.A);
});

test('milli: turnuva maçlarında rakip kodu ve skor ayrı alanlarda', () => {
  setRandom(seeded(35));
  const s = newGame({ name: 'Test', position: 'MF' });
  for (const k of Object.keys(s.player.stats)) s.player.stats[k] = 85;
  s.calendar.season = 2;
  const t = startTournament(s);
  for (const st of t.stages) for (const m of st.matches) {
    assert.equal(typeof m.vs, 'string');
    assert.equal(typeof m.my, 'number');
    assert.equal(typeof m.opp, 'number');
  }
  const out = finishTournament(s, { success: true });
  if (out.final) assert.equal(typeof out.final.vs, 'string');
});
