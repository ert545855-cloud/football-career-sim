import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, SCALES, composeMelody, chordNotes, chordDegree, layersFor, sectionAt, LOOP_BARS, LOOP_FROM } from '../src/music/compose.js';

const inScale = (tr, m) => SCALES[tr.scale].includes((((m - tr.root) % 12) + 12) % 12);

test('müzik: her parçanın melodisi deterministik, tonda ve aralıkta', () => {
  for (const [id, tr] of Object.entries(TRACKS)) {
    const a = composeMelody(tr);
    assert.deepEqual(a, composeMelody(tr), id);
    assert.ok(a.length >= 24, id);
    for (const n of a) {
      assert.ok(inScale(tr, n.midi), `${id} ${n.midi}`);
      assert.ok(n.midi >= tr.root + 10 && n.midi <= tr.root + 29, `${id} aralık`);
      assert.ok(n.bar >= 0 && n.bar < 8 && n.st >= 0 && n.st < 16 && n.du > 0);
    }
    // motif tekrarı: 1-2. ölçüler ile 5-6. ölçüler aynı (akılda kalıcılık)
    const sig = (b0) => a.filter((n) => n.bar === b0 || n.bar === b0 + 1).map((n) => `${n.bar - b0}:${n.st}:${n.midi}`).join();
    assert.equal(sig(0), sig(4), id);
  }
  // parçalar birbirinin aynısı değil
  const sigs = new Set(Object.values(TRACKS).map((t) => composeMelody(t).map((n) => n.midi - t.root).join()));
  assert.ok(sigs.size >= 5);
});

test('müzik: akorlar tonda, bölümler döngüde, yoğunluk katmanları', () => {
  const tr = TRACKS.title;
  for (let bar = 0; bar < 40; bar++) for (const m of chordNotes(tr, chordDegree(tr, bar))) assert.ok(inScale(tr, m));
  assert.equal(sectionAt(0).name, 'intro');
  assert.equal(sectionAt(LOOP_BARS).name, sectionAt(LOOP_FROM).name);
  const chorusBar = 12;
  assert.equal(sectionAt(chorusBar).name, 'chorus');
  assert.ok(layersFor(tr, chorusBar, 3).lead);
  assert.ok(!layersFor(tr, 0, 3).lead); // girişte lead yok
  const st = TRACKS.story;
  assert.ok(layersFor(st, chorusBar, 0).piano && !layersFor(st, chorusBar, 0).drums);
  assert.ok(layersFor(st, chorusBar, 3).drums === 3);
});
