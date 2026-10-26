// Çeviri sözlüklerini derler: src/i18n/src/*.json satırları [tr, en, zh, hi, es, ar, fr, bn, pt, id, ur]
//   → src/i18n/dict/{dil}.js. Yer tutucu uyuşmazlıklarını ve eksikleri raporlar.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
export const ORDER = ['en', 'zh', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'id', 'ur'];
const dicts = Object.fromEntries(ORDER.map((l) => [l, {}]));
const ph = (s) => (String(s).match(/\{\w+(?::\w+)?\}/g) || []).sort().join(',');
let rows = 0;
const problems = [];
for (const f of readdirSync(`${ROOT}src/i18n/src`).filter((x) => x.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(`${ROOT}src/i18n/src/${f}`, 'utf8'));
  for (const row of data) {
    const [tr, ...tx] = row;
    rows++;
    ORDER.forEach((l, i) => {
      const v = tx[i];
      if (v == null || v === '') return;
      if (ph(v) !== ph(tr)) problems.push(`${f} [${l}] yer tutucu: ${tr} → ${v}`);
      dicts[l][tr.replace(/\s+/g, ' ').trim()] = v;
    });
  }
}
for (const l of ORDER) writeFileSync(`${ROOT}src/i18n/dict/${l}.js`, `// Otomatik derlendi (scripts/i18n-build.mjs) — düzenleme için src/i18n/src/*.json\nexport default ${JSON.stringify(dicts[l])};\n`);
const phases = [1, 2, 3].map((p) => { try { return JSON.parse(readFileSync(`${ROOT}src/i18n/phase${p}.json`, 'utf8')); } catch { return []; } });
const norm = (s) => s.replace(/\s+/g, ' ').trim();
console.log('satır', rows);
phases.forEach((list, i) => {
  const miss = list.filter((k) => dicts.en[norm(k)] == null);
  console.log(`aşama ${i + 1}: ${list.length - miss.length}/${list.length} (en)`);
});
for (const l of ORDER) console.log(l, Object.keys(dicts[l]).length);
if (problems.length) console.log('SORUNLAR\n' + problems.slice(0, 40).join('\n'));
