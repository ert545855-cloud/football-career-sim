import { test } from 'node:test';
import assert from 'node:assert/strict';
import { random, setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import {
  BRAND_BY_ID, acceptOffer, canShoot, eligibleBrands, ensureSponsors, feeFor, finishShoot, sponsorSkillMult, sponsorsOnMatch, sponsorsOnWeek,
} from '../src/core/sponsors.js';
import { ensureAgent } from '../src/core/agent.js';
import { POSES, SHOOT, createShoot, currentTake, shootParams, shootPick, shootResult, shootStep } from '../src/games/shootLogic.js';

const fresh = () => { setRandom(seeded(51)); const s = newGame({ name: 'Sponsor Test', position: 'FW' }); s.calendar.slots = 4; s.player.energy = 100; return s; };

test('sponsor: ün ve imaj yetince teklif gelir; oyun rastgeleliği bozulmaz', () => {
  const s = fresh();
  s.player.fame = 10;
  assert.equal(eligibleBrands(s).length, 0);
  s.player.fame = 45;
  s.player.rel.sponsor = 50;
  const ids = eligibleBrands(s).map((b) => b.id);
  assert.ok(ids.includes('volta') && ids.includes('piksel') && !ids.includes('kronos'));
  setRandom(seeded(3));
  const expect = random();
  setRandom(seeded(3));
  let offers = 0;
  for (let w = 1; w <= 20; w++) { s.calendar.week = w; offers += sponsorsOnWeek(s).news.filter((n) => n.text.includes('teklif')).length; }
  assert.equal(random(), expect);
  assert.ok(offers >= 2, `teklif ${offers}`);
});

test('sponsor: ücret ün, imaj ve menajerle artar; sözleşme ödenir, gol primi, avantaj', () => {
  const s = fresh();
  s.player.fame = 40;
  s.player.rel.sponsor = 40;
  const base = feeFor(s, BRAND_BY_ID.volta);
  s.player.rel.sponsor = 80;
  assert.ok(feeFor(s, BRAND_BY_ID.volta) > base);
  ensureAgent(s).id = 'selin';
  assert.ok(feeFor(s, BRAND_BY_ID.volta) > feeFor({ ...s, agent: { id: 'self' } }, BRAND_BY_ID.volta));
  const sp = ensureSponsors(s);
  sp.offers.push({ brandId: 'volta', weekly: 1000, weeks: 3, perGoal: 200, shootsReq: 1, signBonus: 500, expires: 999 });
  const m0 = s.career.money;
  assert.ok(acceptOffer(s, 'volta').ok);
  assert.equal(s.career.money, m0 + 500);
  assert.equal(sponsorSkillMult(s, 'shot'), 1.02);
  assert.equal(sponsorSkillMult(s, 'pass'), 1);
  assert.equal(sponsorsOnMatch(s, { goals: 2 }), 400);
  const r = sponsorsOnWeek(s);
  assert.equal(r.income, 1000);
  // çekim yap: yükümlülük tamam
  assert.ok(canShoot(s).ok);
  const sh = finishShoot(s, 'volta', 0.9);
  assert.ok(sh.ok && sh.money > 0 && sh.rel > 0);
  sponsorsOnWeek(s); sponsorsOnWeek(s);
  assert.equal(sp.active.length, 0, 'süre doldu');
  assert.equal(sp.history[0].end, 'tamam');
});

test('sponsor: çekimi yapmazsan ceza, imaj çökerse fesih', () => {
  const s = fresh();
  s.player.fame = 40;
  s.player.rel.sponsor = 50;
  const sp = ensureSponsors(s);
  sp.offers.push({ brandId: 'simsek', weekly: 500, weeks: 1, perGoal: 0, shootsReq: 2, signBonus: 0, expires: 999 });
  acceptOffer(s, 'simsek');
  const m0 = s.career.money;
  const r = sponsorsOnWeek(s);
  assert.ok(r.energy === 3);
  assert.ok(s.career.money < m0 + 500, 'ceza düşüldü');
  assert.equal(sp.history[0].end, 'ceza');
  sp.offers.push({ brandId: 'nova', weekly: 500, weeks: 10, perGoal: 0, shootsReq: 2, signBonus: 0, expires: 999 });
  acceptOffer(s, 'nova');
  s.player.rel.sponsor = 10;
  sponsorsOnWeek(s);
  assert.equal(sp.active.length, 0);
  assert.equal(sp.history[0].end, 'fesih');
});

function runShoot(strategy) {
  const S = createShoot(shootParams(0.5), seeded(12));
  let guard = 0;
  while (!S.done && guard++ < 6000) {
    shootStep(S, 1 / 60);
    if (S.phase === 'pick') {
      const tk = currentTake(S);
      if (strategy === 'fast') shootPick(S, tk.pose);
      if (strategy === 'slow' && S.t > tk.window * 0.8) shootPick(S, tk.pose);
      if (strategy === 'wrong') shootPick(S, tk.options.find((o) => o !== tk.pose));
    }
  }
  return shootResult(S);
}

test('reklam çekimi: hızlı ve doğru poz yüksek, yavaş orta, yanlış sıfır', () => {
  const S = createShoot(shootParams(0.5), seeded(4));
  assert.equal(S.takes.length, SHOOT.takes);
  for (const t of S.takes) { assert.equal(t.options.length, 4); assert.ok(t.options.includes(t.pose)); }
  assert.ok(S.takes[5].window < S.takes[0].window);
  const fast = runShoot('fast');
  const slow = runShoot('slow');
  const wrong = runShoot('wrong');
  const none = runShoot('none');
  assert.ok(fast.q > 0.9, JSON.stringify(fast));
  assert.ok(slow.q > 0.4 && slow.q < fast.q);
  assert.equal(wrong.q, 0);
  assert.equal(none.q, 0);
  assert.ok(POSES.length >= 6);
});
