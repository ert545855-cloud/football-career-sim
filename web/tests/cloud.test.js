import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { LIMITS, createCloud, makeCode, normalizeCode, summarize, validPin, validState } from '../server/cloud.mjs';

test('bulut: kod, PIN ve özet yardımcıları', () => {
  for (let i = 0; i < 50; i++) {
    const c = makeCode();
    assert.match(c, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(normalizeCode(c.toLowerCase().replace('-', ' ')), c);
  }
  assert.equal(normalizeCode('ABCD-EFG0'), null, '0 alfabede yok');
  assert.equal(normalizeCode('kısa'), null);
  assert.ok(validPin('1234') && validPin('123456'));
  assert.ok(!validPin('123') && !validPin('12a4') && !validPin(1234));
  assert.ok(!validState(null) && !validState([]) && validState({ player: {}, career: {} }));
  const s = summarize({ player: { name: 'x'.repeat(80), age: 21, stats: { a: 40, b: 60 } }, career: { clubId: 'bog' }, calendar: { season: 3, week: 7, phase: 'week' } });
  assert.equal(s.name.length, 40);
  assert.equal(s.avg, 50);
  assert.equal(s.season, 3);
});

test('bulut: veritabanı yoksa kapalı döner', async () => {
  const cloud = createCloud({ databaseUrl: '' });
  const srv = createServer(async (req, res) => { if (!(await cloud.handle(req, res))) res.end('static'); });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const st = await (await fetch(`${base}/api/cloud/status`)).json();
  assert.equal(st.enabled, false);
  const cr = await fetch(`${base}/api/cloud/create`, { method: 'POST', body: JSON.stringify({ pin: '1234' }) });
  assert.equal(cr.status, 503);
  assert.equal(await (await fetch(`${base}/`)).text(), 'static');
  srv.close();
});

// Gerçek Postgres ile uçtan uca: TEST_DATABASE_URL verilirse çalışır
const DB = process.env.TEST_DATABASE_URL;
test('bulut: oluştur → yükle → çakışma → bağlan (kilit) → indir → sil', { skip: !DB && 'TEST_DATABASE_URL yok' }, async () => {
  const cloud = createCloud({ databaseUrl: DB });
  const srv = createServer(async (req, res) => { if (!(await cloud.handle(req, res))) res.end(); });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (method, path, body, token) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() };
  };
  try {
    assert.equal((await call('GET', '/api/cloud/status')).json.enabled, true);
    assert.equal((await call('POST', '/api/cloud/create', { pin: '12' })).status, 400);
    const { json: acc } = await call('POST', '/api/cloud/create', { pin: '4321' });
    assert.match(acc.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const A = acc.token;
    const state = { player: { name: 'Arda', age: 19, stats: { s: 50 } }, career: { clubId: 'pam' }, calendar: { season: 2, week: 5 }, big: 'x'.repeat(50000) };
    const up1 = await call('PUT', '/api/cloud/save', { baseRev: 0, state }, A);
    assert.equal(up1.status, 200);
    assert.equal(up1.json.rev, 1);
    assert.equal(up1.json.summary.name, 'Arda');
    assert.equal((await call('GET', '/api/cloud/meta', null, 'f'.repeat(64))).status, 401);

    // İkinci cihaz: yanlış PIN'ler kilitler
    for (let i = 0; i < LIMITS.maxFails - 1; i++) assert.equal((await call('POST', '/api/cloud/link', { code: acc.code, pin: '0000' })).status, 403);
    assert.equal((await call('POST', '/api/cloud/link', { code: acc.code, pin: '0000' })).status, 403);
    const locked = await call('POST', '/api/cloud/link', { code: acc.code.toLowerCase(), pin: '4321' });
    assert.equal(locked.status, 429, 'kilitliyken doğru PIN de reddedilir');
    // kilidi test için kaldır
    const pg = await import('pg');
    const pool = new pg.default.Pool({ connectionString: DB });
    await pool.query('UPDATE krampon_cloud SET locked_until = NULL WHERE code = $1', [acc.code]);
    const linked = await call('POST', '/api/cloud/link', { code: acc.code, pin: '4321' });
    assert.equal(linked.status, 200);
    assert.equal(linked.json.rev, 1);
    const B = linked.json.token;

    // B yükler → A'nın eski sürümü çakışır
    assert.equal((await call('PUT', '/api/cloud/save', { baseRev: 1, state: { ...state, calendar: { season: 2, week: 9 } } }, B)).json.rev, 2);
    const conflict = await call('PUT', '/api/cloud/save', { baseRev: 1, state }, A);
    assert.equal(conflict.status, 409);
    assert.equal(conflict.json.rev, 2);
    assert.equal(conflict.json.summary.week, 9);
    const dl = await call('GET', '/api/cloud/save', null, A);
    assert.equal(dl.json.state.calendar.week, 9);
    assert.equal(dl.json.state.big.length, 50000);
    assert.equal((await call('PUT', '/api/cloud/save', { baseRev: 1, state, force: true }, A)).json.rev, 3, 'zorla üzerine yazma');

    // çıkış: B'nin anahtarı geçersizleşir; silme her şeyi kaldırır
    assert.equal((await call('POST', '/api/cloud/logout', null, B)).status, 200);
    assert.equal((await call('GET', '/api/cloud/meta', null, B)).status, 401);
    assert.equal((await call('DELETE', '/api/cloud', null, A)).status, 200);
    assert.equal((await call('GET', '/api/cloud/meta', null, A)).status, 401);
    await pool.end();
  } finally {
    srv.close();
    await cloud.close();
  }
});
