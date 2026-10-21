// Çeviri aşamaları: strings.json'daki metinleri dosyalarına göre 3 aşamaya ayırır → src/i18n/phase{1,2,3}.json
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
const S = JSON.parse(readFileSync(`${ROOT}src/i18n/strings.json`, 'utf8'));
const P2 = [/core\/match\.js/, /ui\/screens\/match\.js/, /ui\/broadcast\.js/, /^src\/games\//, /core\/lineups\.js/];
const P3 = [/core\/chirp\//, /core\/social\//, /core\/events\.js/, /mentor\/dialogues\.js/, /siyahShow\.js/, /core\/press\.js/, /mentor\/bigMatch\.js/, /ui\/tabloidView\.js/, /ui\/chirpCards\.js/];
const phaseOf = (ref) => (P3.some((r) => r.test(ref)) ? 3 : P2.some((r) => r.test(ref)) ? 2 : 1);
const out = { 1: [], 2: [], 3: [] };
for (const [k, refs] of Object.entries(S)) out[Math.min(...refs.map(phaseOf))].push(k);
for (const p of [1, 2, 3]) {
  writeFileSync(`${ROOT}src/i18n/phase${p}.json`, JSON.stringify(out[p], null, 0).replace(/","/g, '",\n"'));
  console.log(`phase${p}`, out[p].length, out[p].join('').length);
}
