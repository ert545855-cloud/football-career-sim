import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/game.js';
import { setRandom, seeded } from '../src/core/rng.js';
import { ATT_RULES, attitudeKind, attitudeOnMatch, planTension, resolveTension, shiftAttitude, tensionOptions } from '../src/core/attitude.js';

const mkState = () => { setRandom(seeded(11)); const s = newGame({ name: 'Deniz Kaya', position: 'FW' }); setRandom(Math.random); return s; };
const mkMatch = () => ({ isHome: true, discipline: 50, score: { my: 0, opp: 0 }, tally: { rating: 0 }, moments: [{ minute: 70 }], events: [] });

test('karakter barı: azar azar kayar, haftalık sınır var, uçlara yaklaştıkça yavaşlar', () => {
  const s = mkState();
  assert.equal(s.player.attitude ?? 0, 0);
  for (let i = 0; i < 6; i++) shiftAttitude(s, 'press_provoke');
  assert.ok(s.player.attitude <= ATT_RULES.weekLimit + 0.01, `bir haftada en fazla ${ATT_RULES.weekLimit}: ${s.player.attitude}`);
  // 15 hafta boyunca her hafta 3 kışkırtıcı cevap
  const gains = [];
  for (let w = 1; w <= 15; w++) {
    s.calendar.week = w + 1;
    const before = s.player.attitude;
    for (let i = 0; i < 3; i++) shiftAttitude(s, 'press_provoke');
    gains.push(s.player.attitude - before);
  }
  assert.ok(s.player.attitude < 100 && s.player.attitude > 55, `uzun vadede egoist ama tavana yapışmaz: ${s.player.attitude}`);
  assert.ok(gains[gains.length - 1] < gains[0], 'uçta kayma yavaşlar');
  assert.equal(attitudeKind(s.player.attitude), 'ego');
  // merkeze dönüş daha kolay
  s.calendar.week = 40;
  const v0 = s.player.attitude;
  shiftAttitude(s, 'press_humble');
  assert.ok(v0 - s.player.attitude >= 2.9, 'mütevazı cevap tam güçle geri çeker');
});

test('karakter barı: seçenekler kişiliğe göre değişir', () => {
  assert.deepEqual(tensionOptions('shove', 'ego').map((o) => o.id), ['provoke', 'jab', 'ignore']);
  assert.deepEqual(tensionOptions('shove', 'humble').map((o) => o.id), ['peace', 'ref', 'ignore']);
  assert.deepEqual(tensionOptions('shove', 'balanced').map((o) => o.id), ['jab', 'calm', 'ignore']);
});

test('gerginlik: egoist daha çok gerginlik yaşar', () => {
  const s = mkState();
  const count = (att) => {
    s.player.attitude = att;
    let n = 0;
    for (let w = 1; w <= 60; w++) { s.calendar.week = w; n += planTension(s, { role: 'starter', isHome: w % 2 === 0, id: `x${w}`, oppNames: ['Ali'] }).length; }
    return n;
  };
  const ego = count(90);
  const humble = count(-90);
  assert.ok(ego > humble * 1.4, `egoist ${ego} > mütevazı ${humble}`);
  assert.equal(planTension(s, { role: 'bench', isHome: true, id: 'b' }).length, 0, 'kulübede gerginlik yok');
});

test('gerginlik: centilmenlik kart getirmez, kışkırtma kart riski ve kalıcı etki taşır', () => {
  const s = mkState();
  const m = mkMatch();
  const t = { minute: 40, kind: 'fight', opp: 'Ali', done: false };
  const out = resolveTension(s, m, t, 'peace', () => 0.99);
  assert.equal(out.card, null);
  assert.ok(m.focus > 0);
  const m2 = mkMatch();
  const out2 = resolveTension(s, m2, { minute: 50, kind: 'fight', opp: 'Ali', done: false }, 'provoke', () => 0);
  assert.equal(out2.card, 'red', 'arbedede kafa tutmak kırmızı getirebilir');
  assert.equal(m2.sentOff, 50);
  assert.ok(m2.moments[0].skipped, 'atılınca kalan anlar iptal');
  const fed0 = s.player.rel.federation;
  const r = attitudeOnMatch(s, m2);
  assert.ok(r.shift > 0, 'kışkırtma barı egoiste iter');
  assert.ok(s.player.rel.federation < fed0);
  const m3 = mkMatch();
  m3.celebs = ['heart'];
  assert.ok(attitudeOnMatch(s, m3).shift < 0, 'kalp sevinci mütevazı yöne');
});
