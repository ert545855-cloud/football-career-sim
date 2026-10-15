import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setRandom, seeded } from '../src/core/rng.js';
import { newGame, getMatch } from '../src/core/game.js';
import { CLUBS, POSITIONS } from '../src/core/data.js';
import { ROLES, coachOnMatch, ensureCoach, momentWeights, requestRole } from '../src/core/coach.js';
import { chooseLocker, maybeLockerEvent, teamMood, teammates, chatWith, canChat } from '../src/core/locker.js';
import { answerPress, planPress } from '../src/core/press.js';
import { migrate } from '../src/core/storage.js';

test('hoca: rol ve stil, kötü seride kovulma, transferde yeni hoca', () => {
  setRandom(seeded(91));
  const s = newGame({ name: 'Hoca Test', position: 'FW' });
  const c = ensureCoach(s);
  assert.ok(c.name && ROLES.FW[c.role]);
  c.role = 'winger';
  c.style = 'balance';
  const w = momentWeights(s, POSITIONS.FW.moments);
  assert.ok(w.attack > POSITIONS.FW.moments.attack * 1.5);
  s.calendar.week = 8;
  const rel0 = s.player.rel.manager;
  let sacked = null;
  for (let i = 0; i < 20 && !sacked; i++) sacked = coachOnMatch(s, { result: 'L', played: true, rating: 5.5 })?.sacked;
  assert.ok(sacked, 'üst üste yenilgilerde hoca gider');
  assert.notEqual(s.coach.name, c.name);
  assert.ok(s.pending.coachChange);
  assert.ok(s.coachHistory.length >= 1);
  assert.ok(Number.isFinite(s.player.rel.manager) && rel0 >= 0);
  const r = requestRole(s, Object.keys(ROLES.FW).find((k) => k !== s.coach.role));
  assert.ok(r.ok && typeof r.accepted === 'boolean');
  // transfer: yeni kulübün hocası
  const hist = s.coachHistory.length;
  s.career.clubId = CLUBS.find((x) => x.id !== s.career.clubId).id;
  const nc = ensureCoach(s);
  assert.equal(nc.clubId, s.career.clubId);
  assert.equal(s.coachHistory.length, hist + 1);
  setRandom(Math.random);
});

test('soyunma odası: olay, seçim, sohbet ve takım havası', () => {
  setRandom(seeded(92));
  const s = newGame({ name: 'Takım Test', position: 'MF' });
  const tms = teammates(s);
  assert.ok(tms.length >= 3 && tms.every((t) => t.rel >= 0 && t.rel <= 100));
  const ev = maybeLockerEvent(s, { force: true });
  assert.ok(ev && s.pending.locker && ev.choices.length >= 2);
  const out = chooseLocker(s, 0);
  assert.ok(out.note !== undefined && s.pending.locker === null);
  assert.ok(canChat(s));
  const ch = chatWith(s, tms[0].id);
  assert.ok(ch.ok && !canChat(s));
  assert.ok(teamMood(s) >= 0 && teamMood(s) <= 100);
  const m = migrate(JSON.parse(JSON.stringify(s)));
  assert.ok(m.coach && m.locker);
  setRandom(Math.random);
});

test('basın: büyük maç öncesi sorular; kışkırtıcı cevap manşet olur, heyecanı artırır', () => {
  setRandom(seeded(93));
  const s = newGame({ name: 'Basın Test', position: 'FW' });
  const match = getMatch(s);
  match.big = { kind: 'derby', title: 'Derbi', nerves: 0.3, tempo: 1.1, skillMult: 0.95 };
  match.role = 'starter';
  let press = null;
  for (let i = 0; i < 20 && !press; i++) press = planPress(s, match);
  assert.ok(press && press.qs.length === 2);
  const fame0 = s.player.fame;
  const out = answerPress(s, press, ['provoke', 'provoke'], match);
  assert.ok(out.headline);
  assert.ok(s.player.fame > fame0);
  assert.ok(match.big.nerves > 0.3);
  setRandom(Math.random);
});
