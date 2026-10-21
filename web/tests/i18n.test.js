import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tx, tl, useDict } from '../src/i18n/index.js';

test('çeviri: tam eşleşme, kalıp, iç içe şablon ve hal eki ayıklama', () => {
  useDict('en', {
    'Maç Gününe Geç': 'Go to Match Day',
    '{0} · Hafta {1}/{2}': '{0} · Week {1}/{2}',
    'Eylül': 'September',
    '{0} {1}{2} yükseldi! 🎉': '{0} {1}promoted to {2}! 🎉',
    'play-off finalini kazandı ve': 'won the play-off final and',
    'Süper Lig': 'Super League',
    'Nabız bölgesinde %{0}. {1}tempoyu iyi yönettin; kondisyonun arttı.': 'In the heart-rate zone {0}%. {1}you managed the tempo well; your fitness improved.',
    '{0} engele takıldın ama': 'you clipped {0} hurdles but',
    '{0} – {1} {2} hava muhalefeti yüzünden gelecek hafta oynanacak.': '{0} – {1}: {2} will be played next week due to bad weather.',
    'kupa maçı': 'cup match',
    'Merhaba {player}!': 'Hello {player}!',
    '{0} · H{1}': '{0} · Wk{1}',
  });
  assert.equal(tx('Sponsor +10 · Takım -5 · Hoca -3'), 'Sponsor +10 · Takım -5 · Hoca -3', 'harfe yapışık yer tutucu boşluk yakalamaz');
  assert.equal(tx('Kupa · H12'), 'Kupa · Wk12');
  assert.equal(tx('Maç Gününe Geç'), 'Go to Match Day');
  assert.equal(tx('  Maç Gününe Geç '), '  Go to Match Day ');
  assert.equal(tx('Eylül · Hafta 4/22'), 'September · Week 4/22');
  assert.equal(tx('Kocaeli Körfez play-off finalini kazandı ve Süper Lig\'e yükseldi! 🎉'), 'Kocaeli Körfez won the play-off final and promoted to Super League! 🎉');
  assert.equal(tx('Kocaeli Körfez Süper Lig\'e yükseldi! 🎉'), 'Kocaeli Körfez promoted to Super League! 🎉');
  assert.equal(tx('Nabız bölgesinde %70. 2 engele takıldın ama tempoyu iyi yönettin; kondisyonun arttı.'), 'In the heart-rate zone 70%. you clipped 2 hurdles but you managed the tempo well; your fitness improved.');
  assert.equal(tx('Seferihisar Mandalina – Bodrum Kale kupa maçı hava muhalefeti yüzünden gelecek hafta oynanacak.'), 'Seferihisar Mandalina – Bodrum Kale: cup match will be played next week due to bad weather.');
  assert.equal(tx('Bilinmeyen metin'), 'Bilinmeyen metin');
  assert.equal(tl('Merhaba {player}!'), 'Hello {player}!');
  useDict('tr', {});
});
