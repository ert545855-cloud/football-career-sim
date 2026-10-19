import { test } from 'node:test';
import assert from 'node:assert/strict';
import { random, setRandom, seeded } from '../src/core/rng.js';
import { newGame } from '../src/core/game.js';
import {
  ASSET_BY_ID, addToPlan, buy, canManage, ensureInvest, investOnWeek, listedAssets, planWeights, portfolioSummary,
  portfolioValue, sell, setMode, withdrawPlan,
} from '../src/core/invest.js';
import { ensureAgent } from '../src/core/agent.js';

const fresh = (name = 'Yatırım Test') => { setRandom(seeded(21)); const s = newGame({ name, position: 'FW' }); s.career.money = 100_000; return s; };
const weeks = (s, n, ctx = {}) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    s.calendar.week = (i % 34) + 1;
    out.push(investOnWeek(s, ctx));
  }
  return out;
};

test('yatırım: kayıt alanı ve 26 haftalık geçmiş hazır; taraftar tokeni ünle açılır', () => {
  const s = fresh();
  const v = ensureInvest(s);
  for (const id of ['VADE', 'ENDX', 'ALTN', 'GOLC', 'PXC', 'KEDI']) {
    assert.ok(v.prices[id] > 0, id);
    assert.equal(v.hist[id].length, 26);
  }
  assert.equal(v.prices.FAN, undefined);
  assert.ok(!listedAssets(s).some((a) => a.id === 'FAN'));
  s.player.fame = 40;
  const r = investOnWeek(s, {});
  assert.equal(r.fanLaunch, true);
  assert.ok(listedAssets(s).some((a) => a.id === 'FAN'));
});

test('al-sat: komisyon düşülür, maliyet ve gerçekleşen kâr doğru hesaplanır', () => {
  const s = fresh();
  const v = ensureInvest(s);
  const r = buy(s, 'GOLC', 10_000);
  assert.ok(r.ok, r.text);
  assert.equal(s.career.money, 90_000);
  assert.ok(Math.abs(r.fee - 10_000 * ASSET_BY_ID.GOLC.fee) < 1e-6);
  assert.ok(Math.abs(portfolioValue(s) - (10_000 - r.fee)) < 0.01);
  v.prices.GOLC *= 1.5; // fiyat %50 yükseldi
  const sold = sell(s, 'GOLC', 0.5);
  assert.ok(sold.ok);
  assert.ok(sold.pnl > 0);
  assert.ok(Math.abs(v.holdings.GOLC.cost - 5000) < 0.01);
  assert.ok(!buy(s, 'GOLC', 10).ok, 'en az tutar');
  assert.ok(!buy(s, 'GOLC', 10_000_000).ok, 'kasa yetmez');
  assert.ok(sell(s, 'GOLC', 1).ok);
  assert.equal(v.holdings.GOLC, undefined);
});

test('piyasa: kendi üretecini kullanır, oyunun rastgeleliğini bozmaz ve tekrar üretilebilir', () => {
  const a = fresh('Aynı İsim');
  const b = fresh('Aynı İsim');
  setRandom(seeded(5));
  const expect = [random(), random(), random()];
  setRandom(seeded(5));
  weeks(a, 10);
  assert.deepEqual([random(), random(), random()], expect);
  weeks(b, 10);
  assert.deepEqual(a.invest.prices, b.invest.prices);
});

test('uzun vade: vadeli hesap hep artar, fiyatlar pozitif kalır, fon ortalamada büyür', () => {
  let fundUp = 0;
  for (let k = 0; k < 6; k++) {
    const s = fresh(`Uzun ${k}`);
    const v = ensureInvest(s);
    const start = { ...v.prices };
    weeks(s, 150);
    assert.ok(v.prices.VADE > start.VADE * 1.2);
    for (const id of Object.keys(v.prices)) assert.ok(v.prices[id] > 0 && Number.isFinite(v.prices[id]), id);
    if (v.prices.ENDX > start.ENDX) fundUp++;
    assert.ok(v.hist.GOLC.length <= 52);
  }
  assert.ok(fundUp >= 4, `fon 6 dünyanın ${fundUp} tanesinde yükseldi`);
});

test('taraftar tokeni oyuncunun performansıyla oynar', () => {
  const good = fresh('Token İyi');
  const bad = fresh('Token İyi');
  good.player.fame = 50;
  bad.player.fame = 50;
  weeks(good, 1);
  weeks(bad, 1);
  weeks(good, 8, { summary: { played: true, rating: 8.6, goals: 2, assists: 1, motm: true } });
  weeks(bad, 8, { summary: { played: true, rating: 5.2, goals: 0, assists: 0 } });
  assert.ok(good.invest.prices.FAN > bad.invest.prices.FAN * 1.5, `${good.invest.prices.FAN} / ${bad.invest.prices.FAN}`);
});

test('menajer yönetimi: ajan şart, plan ağırlıkları uygulanır, para ekle/çek çalışır', () => {
  const s = fresh();
  assert.equal(canManage(s).ok, false);
  assert.equal(setMode(s, 'managed', 'balanced').ok, false);
  ensureAgent(s).id = 'selin';
  buy(s, 'KEDI', 5000);
  assert.ok(setMode(s, 'managed', 'safe').ok);
  const w = planWeights(s);
  const sum = portfolioSummary(s);
  assert.equal(s.invest.holdings.KEDI, undefined, 'temkinli plan meme coin taşımaz');
  for (const r of sum.rows) assert.ok(Math.abs(r.w - (w[r.id] || 0)) < 0.01, r.id);
  assert.ok(!buy(s, 'GOLC', 1000).ok, 'yönetilen portföyde elle alım yok');
  const before = portfolioValue(s);
  assert.ok(addToPlan(s, 20_000).ok);
  assert.ok(portfolioValue(s) > before + 19_000);
  const cash = s.career.money;
  const wd = withdrawPlan(s, 10_000);
  assert.ok(wd.ok && s.career.money > cash + 9_000);
  // mahalle menajeri kriptoya para koymaz
  ensureAgent(s).id = 'kemal';
  const kw = planWeights(s, 'bold');
  assert.ok(!kw.GOLC && !kw.PXC && !kw.KEDI);
  assert.ok(Math.abs(Object.values(kw).reduce((n, x) => n + x, 0) - 1) < 1e-9);
  // menajer ayrılırsa yönetim kapanır
  ensureAgent(s).id = 'self';
  const r = investOnWeek(s, {});
  assert.equal(s.invest.mode, 'advice');
  assert.ok(r.news.some((n) => n.text.includes('portföy yönetimi kapandı')));
});

test('maaştan otomatik yatırım ve menajer notları', () => {
  const s = fresh();
  const v = ensureInvest(s);
  v.auto = { pct: 0.2, target: 'ENDX' };
  investOnWeek(s, { fin: { net: 10_000 } });
  assert.equal(s.career.money, 98_000);
  assert.ok(v.holdings.ENDX.qty > 0);
  // servetin çoğu kriptoda: menajer uyarır
  ensureAgent(s).id = 'vitali';
  buy(s, 'GOLC', 90_000);
  let warned = false;
  for (let i = 0; i < 6 && !warned; i++) {
    const r = investOnWeek(s, {});
    warned = r.notes.some((n) => ['concentration', 'cash', 'drop', 'event', 'gain'].includes(n.kind));
  }
  assert.ok(warned, 'menajer portföyü yorumladı');
  assert.ok(v.log.length > 0);
});
