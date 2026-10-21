// Çeviri grubu yazdırır: node scripts/i18n-batch.mjs <aşama> <başlangıç> <bitiş>
import { readFileSync, readdirSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
const [phase, from, to] = process.argv.slice(2).map(Number);
const list = JSON.parse(readFileSync(`${ROOT}src/i18n/phase${phase}.json`, 'utf8'));
const S = JSON.parse(readFileSync(`${ROOT}src/i18n/strings.json`, 'utf8'));
const done = new Set();
for (const f of readdirSync(`${ROOT}src/i18n/src`)) for (const r of JSON.parse(readFileSync(`${ROOT}src/i18n/src/${f}`, 'utf8'))) done.add(r[0]);
for (let i = from; i < Math.min(to, list.length); i++) if (!done.has(list[i])) console.log(i, JSON.stringify(list[i]), `<${S[list[i]][0].replace('src/', '')}>`);
