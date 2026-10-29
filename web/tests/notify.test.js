// Bildirim merkezi: haber kimlikleri, okunmamış sayısı, uyarılar, eski kayıt uyumu
import test from 'node:test';
import assert from 'node:assert/strict';
import { addNews, newGame } from '../src/core/game.js';
import { markNotifsRead, notifList, reminderText, unreadNotifs } from '../src/core/notify.js';

test('yeni haberler okunmamış sayılır, açınca okundu olur', () => {
  const s = newGame({ name: 'Test Oyuncu', position: 'FW' });
  markNotifsRead(s);
  assert.equal(unreadNotifs(s) - (s.chirp?.unread ? 1 : 0) - (s.sponsors?.offers?.length ? 1 : 0), 0);
  addNews(s, 'Gol attın!', 'good');
  addNews(s, 'Sakatlandın.', 'bad');
  const base = unreadNotifs(s);
  assert.ok(base >= 2);
  const list = notifList(s);
  assert.equal(list.find((x) => x.text === 'Gol attın!').unread, true);
  markNotifsRead(s);
  assert.equal(unreadNotifs(s), base - 2);
  assert.equal(notifList(s).find((x) => x.text === 'Gol attın!').unread, false);
});

test('eski kayıt: kimliksiz haberler okunmuş sayılır; uyarılar listede önce gelir', () => {
  const s = newGame({ name: 'Eski Kayıt', position: 'MF' });
  s.career.news = [{ s: 1, w: 3, text: 'Eski haber', kind: 'info' }];
  delete s.career.newsSeq;
  delete s.career.newsSeen;
  s.chirp = { ...(s.chirp || {}), unread: 4 };
  s.sponsors = { ...(s.sponsors || {}), offers: [{ brandId: 'x' }] };
  const list = notifList(s);
  assert.equal(list[0].go, 'chirp');
  assert.equal(list[1].go, 'sponsors');
  assert.equal(list.find((x) => x.text === 'Eski haber').unread, false);
  assert.equal(unreadNotifs(s), 2);
  assert.match(reminderText(s, 'Rakip FK'), /Rakip FK/);
});
