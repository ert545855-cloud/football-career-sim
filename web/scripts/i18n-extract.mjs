// ÇEVİRİ KAYNAKLARI — kaynak koddaki Türkçe metinleri (dize ve şablon dizeler) çıkarır.
//   node scripts/i18n-extract.mjs [klasör...]  →  src/i18n/strings.json  { "metin": ["dosya:satır", ...] }
//   Şablonlardaki ${...} ifadeleri {0}, {1}… yer tutucusu olur; HTML etiketleri arasındaki parçalar ayrı metinlerdir.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseAst } from 'rolldown/parseAst';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP_FILES = [/world\/clubs\.js$/, /world\/names\.js$/, /world\/locale\.js$/, /world\/countries\.js$/, /i18n\//, /music\//, /assets\//];
const TR = /[çğıöşüÇĞİÖŞÜâîû]/;
const PH = '\u0001';

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Bu metin çevrilecek bir doğal dil parçası mı? */
export function isText(s) {
  const t = s.replace(/\{\d+\}/g, '').trim();
  if (!/\p{L}/u.test(t)) return false;
  if (/^(https?:|\/|\.\/|#[0-9a-f]{3,8}$|data:)/i.test(t)) return false;
  if (/^[\w.-]+\.(js|css|png|svg|mp3|json)$/.test(t)) return false;
  if (/[{};]\s*$/.test(t) && /:\s*[^ ]+;/.test(t)) return false; // CSS
  if (/^(rgba?|hsl|var|calc|translate|scale|rotate|linear-gradient|radial-gradient)\(/.test(t)) return false;
  if (/\dpx\b|\{\d+\}px\b|system-ui|sans-serif/.test(t)) return false;
  if (TR.test(t)) return true;
  if (/^[a-z0-9\s-]+$/.test(t)) return false; // küçük harf ASCII: sınıf adları, kimlikler
  // Türkçe karakter yoksa: büyük harfle başlayan ya da boşluk içeren kelime grupları (kod tanımlayıcıları değil)
  if (/^[a-z][\w-]*$/.test(t)) return false; // tanımlayıcı, sınıf, kimlik
  if (/^[A-Z0-9_]+$/.test(t) && t.length <= 3) return false;
  if (/^[\w-]+(\s+[\w-]+)*$/.test(t) && !/[A-ZÇĞİÖŞÜ]/.test(t[0]) && !/\s/.test(t)) return false;
  if (/[=<>]|=>|\(\)|\.\w+\(/.test(t)) return false;
  return /^[A-ZÇĞİÖŞÜ0-9"'(«%+€·–—•!?¡¿]/.test(t) || /\s/.test(t);
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const HTML_EXPR = /<[a-zA-Z/]|\b(icon|crestSVG|spriteOr|sprite|playerAvatar|avatarSVG|nationalCrest|nationBadge|meter|heartsHTML|attitudeBar|attitudeCard|groupCard|bracketHTML|cupSection|cupSteps|portraitHTML|changeChips|starsHTML|golden|flagOf|cupContext|hubMentorCard|hubLockerCard|questsCard|bigMatchChip|shareCard|actionArt|chipHTML|weatherChip|tweetHTML|cardHTML|renderCard|statRow|bar)\(/;

function segments(raw) {
  // HTML: etiketler arası metin + placeholder/aria-label/title/alt öznitelikleri
  const out = [];
  if (/<[a-zA-Z/!]/.test(raw)) {
    for (const m of raw.matchAll(/(?:placeholder|aria-label|title|alt|data-tip)="([^"]*)"/g)) out.push(m[1]);
    for (const part of raw.split(/<[^>]*>/)) out.push(part);
  } else out.push(raw);
  return out;
}

function renumber(s) {
  // \u0001N\u0001 → {0},{1} (parça içinde sıfırdan)
  let i = 0;
  const map = new Map();
  return s.replace(new RegExp(`${PH}(\\d+)${PH}`, 'g'), (_, n) => { if (!map.has(n)) map.set(n, i++); return `{${map.get(n)}}`; });
}

function extract(file, acc) {
  const code = readFileSync(file, 'utf8');
  let ast;
  try { ast = parseAst(code, { lang: 'js' }); } catch (e) { console.error('parse', file, e.message); return; }
  const lineOf = (pos) => code.slice(0, pos).split('\n').length;
  const rel = relative(ROOT, file);
  const add = (raw, pos) => {
    for (const seg of segments(raw)) {
      // tek parça içinde kalan yer tutucular
      const s = norm(renumber(seg));
      if (!s || !isText(s)) continue;
      if (/^\{\d+\}$/.test(s)) continue;
      (acc[s] ||= []).push(`${rel}:${lineOf(pos)}`);
    }
  };
  const keyName = (prop) => prop?.key?.name ?? prop?.key?.value;
  const isClubObj = (obj) => obj?.type === 'ObjectExpression' && obj.properties.some((p) => ['rating', 'league', 'colors'].includes(keyName(p)));
  const visit = (node, parent, key) => {
    if (!node || typeof node.type !== 'string') return;
    // özel adlar: isim havuzları, kulüp adları/kısaltmaları (çevrilmez)
    if (node.type === 'VariableDeclarator' && /(^|_)(FIRST|LAST|NAMES?|SURNAMES?|TENANTS)(_|$)|NAMES$|FIRST$/.test(node.id?.name || '')) return;
    if (node.type === 'Property' && ['name', 'short', 'fan', 'city', 'full'].includes(keyName(node)) && isClubObj(parent)) return;
    if (node.type === 'ArrayExpression' && node.elements.length >= 5 && node.elements.some((e) => e?.type === 'ArrayExpression' && e.elements.every((x) => x?.type === 'Literal' && /^#/.test(String(x.value))))) return;
    if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' && node.source) { if (node.type === 'ImportDeclaration') return; }
    if (node.type === 'Literal' && typeof node.value === 'string') {
      // nesne anahtarları ve karşılaştırma/seçici olarak kullanılan dizeler hariç
      if (parent?.type === 'Property' && key === 'key') return;
      if (parent?.type === 'CallExpression' && /querySelector|closest|getElementById|addEventListener|setAttribute|toggle|contains|getItem|setItem|import/.test(parent.callee?.property?.name || parent.callee?.name || '')) return;
      if (parent?.type === 'BinaryExpression' && /^[!=]==?$/.test(parent.operator)) return;
      add(node.value, node.start);
      return;
    }
    if (node.type === 'TemplateLiteral') {
      let raw = '';
      node.quasis.forEach((q, i) => {
        raw += q.value.cooked ?? q.value.raw;
        if (i < node.expressions.length) {
          // HTML üreten ifade (ikon, arma, şablon) metni böler: yer tutucu değil etiket sınırı
          const ex = node.expressions[i];
          const src = code.slice(ex.start, ex.end);
          raw += HTML_EXPR.test(src) ? '<x>' : `${PH}${i}${PH}`;
        }
      });
      add(raw, node.start);
      for (const e of node.expressions) visit(e, node, 'expr');
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'parent') continue;
      if (Array.isArray(v)) v.forEach((c) => c && typeof c === 'object' && visit(c, node, k));
      else if (v && typeof v === 'object' && typeof v.type === 'string') visit(v, node, k);
    }
  };
  visit(ast.program || ast, null, null);
}

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['src'];
const acc = {};
for (const d of dirs) for (const f of walk(join(ROOT, d))) if (!SKIP_FILES.some((r) => r.test(f))) extract(f, acc);
const keys = Object.keys(acc).sort((a, b) => a.localeCompare(b, 'tr'));
const out = Object.fromEntries(keys.map((k) => [k, acc[k]]));
writeFileSync(join(ROOT, 'src/i18n/strings.json'), JSON.stringify(out, null, 1));
const byDir = {};
for (const [k, refs] of Object.entries(out)) { const d = refs[0].split('/').slice(0, 3).join('/'); byDir[d] = (byDir[d] || 0) + 1; }
console.log('strings', keys.length, 'chars', keys.join('').length);
console.log(Object.entries(byDir).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d}: ${n}`).join('\n'));
