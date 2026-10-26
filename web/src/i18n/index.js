// ÇOK DİLLİ ARAYÜZ — kaynak dil Türkçe. Seçilen dilin sözlüğü (Türkçe metin → çeviri) yüklenir;
//   ekrandaki metinler (DOM metin düğümleri, placeholder/aria-label/title) ve tuval yazıları çevrilir.
//   Sözlük anahtarlarında {0}, {1}… yer tutucuları dinamik parçalardır (sayı, isim, başka bir çeviri).
//   Oluşturulan metinler (anlatım, sosyal medya, diyalog) şablon düzeyinde tl() ile çevrilir.
import { setPixelLang } from '../games/pixel/font.js';

export const LANGS = [
  { id: 'tr', name: 'Türkçe', en: 'Turkish' },
  { id: 'en', name: 'English', en: 'English' },
  { id: 'zh', name: '中文（简体）', en: 'Chinese (Simplified)' },
  { id: 'hi', name: 'हिन्दी', en: 'Hindi' },
  { id: 'es', name: 'Español', en: 'Spanish' },
  { id: 'ar', name: 'العربية', en: 'Arabic', dir: 'rtl' },
  { id: 'fr', name: 'Français', en: 'French' },
  { id: 'bn', name: 'বাংলা', en: 'Bengali' },
  { id: 'pt', name: 'Português', en: 'Portuguese' },
  { id: 'id', name: 'Bahasa Indonesia', en: 'Indonesian' },
  { id: 'ur', name: 'اردو', en: 'Urdu', dir: 'rtl' },
];
export const LANG_BY_ID = Object.fromEntries(LANGS.map((l) => [l.id, l]));

/** Sayfa yazı tipleri: piksel yazının taşıyamadığı yazılar (CJK, Arap, Devanagari, Bengal) için */
export const SCRIPT_FONT = {
  zh: '"PingFang SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif',
  hi: '"Noto Sans Devanagari","Kohinoor Devanagari","Mangal",system-ui,sans-serif',
  bn: '"Noto Sans Bengali","Kohinoor Bangla","Vrinda",system-ui,sans-serif',
  ar: '"Noto Sans Arabic","Geeza Pro","Segoe UI",system-ui,sans-serif',
  ur: '"Noto Nastaliq Urdu","Noto Naskh Arabic","Geeza Pro",system-ui,sans-serif',
};

let LANG = 'tr';
let DICT = null; // { kaynak: çeviri }
let PATTERNS = []; // [{re, out, n, lit}]
let BUCKETS = new Map(); // ilk 3 harf → kalıplar
let WILD = []; // yer tutucuyla başlayan kalıplar
const CACHE = new Map();

export const lang = () => LANG;
export const isRTL = () => LANG_BY_ID[LANG]?.dir === 'rtl';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

function compile(dict) {
  PATTERNS = [];
  BUCKETS = new Map();
  WILD = [];
  for (const [src, out] of Object.entries(dict)) {
    if (!/\{\w+(?::\w+)?\}/.test(src) || !out) continue;
    const parts = src.split(/(\{\w+(?::\w+)?\})/);
    let re = '^';
    const order = [];
    // soldan harfe yapışık yer tutucu ("H{1}", "S{1}"): boşluksuz tek parça yakalar
    const tightAt = (i) => /\p{L}$/u.test(parts[i - 1] || '');
    parts.forEach((p, i) => {
      const m = /^\{(\w+(?::\w+)?)\}$/.exec(p);
      if (m) { re += tightAt(i) ? '(\\S*?)' : '(.*?)'; order.push(m[1]); } else re += esc(p);
    });
    re += '$';
    const lit = parts[0];
    if (!parts.some((p) => !/^\{\w+(?::\w+)?\}$/.test(p) && /\p{L}/u.test(p))) continue; // yalnız yer tutucu: anlamsız
    const toks = parts.map((p, i) => { const m = /^\{(\w+(?::\w+)?)\}$/.exec(p); return m ? { ph: m[1], tight: tightAt(i) } : { lit: p }; }).filter((t) => t.lit !== '');
    const pat = { re: new RegExp(re, 's'), out, order, src, toks };
    PATTERNS.push(pat);
    if (lit.length >= 2) {
      const k = lit.slice(0, 2);
      if (!BUCKETS.has(k)) BUCKETS.set(k, []);
      BUCKETS.get(k).push(pat);
    } else WILD.push(pat);
  }
  // uzun (daha özgül) kalıplar önce
  const byLen = (a, b) => b.src.length - a.src.length;
  WILD.sort(byLen);
  for (const v of BUCKETS.values()) v.sort(byLen);
}

/** Türkçe hal ekini ayıkla: "Kocaeli Körfez'e" → "Kocaeli Körfez" (yalnız özel adlarda) */
const stripSuffix = (v) => v.replace(/^(\p{Lu}[^']*?)['’](?:[a-zçğıöşü]{1,5})$/u, '$1');

let DEPTH = 0;
function fill(pat, vals) {
  return pat.out.replace(/\{(\w+(?::\w+)?)\}/g, (all, i) => {
    if (!(i in vals)) return all;
    const v = vals[i] ?? '';
    if (!v.trim()) return v;
    // iç içe şablon: yakalanan parça da çevrilir (en fazla 3 kat)
    if (DEPTH < 3) {
      DEPTH++;
      try {
        const t = tx(v);
        if (t !== v) return t;
        const s = stripSuffix(v.trim());
        if (s !== v.trim()) { const t2 = tx(s); return withSpace(v, t2); }
      } finally { DEPTH--; }
    }
    return v;
  });
}

/** Yakalanan parçanın puanı: çevrilebilir > sayı > özel ad > çevrilemeyen Türkçe */
function capScore(v) {
  const t = v.trim();
  if (!t) return 0;
  if (DICT[norm(t)] != null || DICT[norm(stripSuffix(t))] != null) return 3;
  if (/^[\d.,%+−\-:/€$£#()× ]+$/.test(t)) return 2;
  if (/^(\p{Lu}[\p{L}\d.'’-]*)(\s+(\p{Lu}[\p{L}\d.'’-]*|\d+))*$/u.test(t)) return 1;
  return /\s/.test(t) ? -1 : 0;
}

/**
 * Kalıp eşleşmesi: yer tutucuların olası bölünmelerini dener, çevrilebilir parçası en çok olanı seçer
 * (ör. "{0} {1}{2} yükseldi" → kulüp adı / ara cümle / lig adı doğru ayrılır).
 */
function matchPattern(pat, s) {
  if (!pat.re.test(s)) return null;
  const toks = pat.toks;
  let best = null;
  let bestScore = -Infinity;
  let budget = 3000;
  const caps = {};
  const rec = (ti, pos, score) => {
    if (--budget < 0) return;
    if (ti === toks.length) {
      if (pos === s.length && score > bestScore) { bestScore = score; best = { ...caps }; }
      return;
    }
    const tk = toks[ti];
    if (tk.lit != null) {
      if (s.startsWith(tk.lit, pos)) rec(ti + 1, pos + tk.lit.length, score);
      return;
    }
    const next = toks[ti + 1];
    const ok = (v) => !tk.tight || !/\s/.test(v);
    if (!next) { caps[tk.ph] = s.slice(pos); if (ok(caps[tk.ph])) rec(ti + 1, s.length, score + capScore(caps[tk.ph])); return; }
    if (next.lit != null) {
      for (let i = s.indexOf(next.lit, pos); i >= 0; i = s.indexOf(next.lit, i + 1)) {
        caps[tk.ph] = s.slice(pos, i);
        if (!ok(caps[tk.ph])) break;
        rec(ti + 1, i, score + capScore(caps[tk.ph]));
      }
      return;
    }
    // iki yer tutucu bitişik: kelime sınırlarında böl
    for (let i = pos; i <= s.length; i++) {
      if (i !== pos && i !== s.length && !/[\s'’]/.test(s[i - 1])) continue;
      caps[tk.ph] = s.slice(pos, i);
      if (!ok(caps[tk.ph])) break;
      rec(ti + 1, i, score + capScore(caps[tk.ph]));
    }
  };
  rec(0, 0, 0);
  if (!best) {
    const a = pat.re.exec(s);
    if (!a) return null;
    best = {};
    pat.order.forEach((idx, j) => { best[idx] = a[j + 1]; });
  }
  return fill(pat, best);
}

/** Tam metin çevirisi (yoksa aynen döner) */
export function tx(s) {
  if (LANG === 'tr' || !DICT || s == null) return s;
  const str = String(s);
  const key = norm(str);
  if (!key || !/\p{L}/u.test(key)) return str;
  const hit = CACHE.get(key);
  if (hit !== undefined) return hit === null ? str : withSpace(str, hit);
  let out = DICT[key];
  if (out == null) {
    const cands = [...(BUCKETS.get(key.slice(0, 2)) || []), ...WILD];
    for (const p of cands) {
      const r = matchPattern(p, key);
      if (r != null) { out = r; break; }
    }
  }
  if (CACHE.size > 4000) CACHE.clear();
  CACHE.set(key, out ?? null);
  return out == null ? str : withSpace(str, out);
}
const withSpace = (orig, out) => {
  const lead = /^\s*/.exec(orig)[0];
  const trail = /\s*$/.exec(orig)[0];
  return lead + out + trail;
};

/** Şablon çevirisi (adlandırılmış yer tutucular korunur: {player}, {club}…) — yalnız tam eşleşme */
export function tl(template) {
  if (LANG === 'tr' || !DICT || template == null) return template;
  const out = DICT[norm(String(template))];
  return out == null ? template : out;
}

/** Bu metnin çevirisi var mı? */
export const hasTx = (s) => !!DICT && DICT[norm(String(s))] != null;

// ─────────────────────────── DOM ───────────────────────────

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'svg', 'SVG']);
const DONE = new WeakMap(); // düğüm → son yazılan çeviri

function skipNode(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName) || e.hasAttribute?.('data-noi18n')) return true;
  }
  return false;
}

function txText(node) {
  const v = node.nodeValue;
  if (!v || DONE.get(node) === v) return;
  if (node.parentElement && skipNode(node.parentElement)) return;
  const out = tx(v);
  if (out !== v) { DONE.set(node, out); node.nodeValue = out; }
}

function txAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (v && DONE.get(el) !== `${a}=${v}`) {
      const out = tx(v);
      if (out !== v) { el.setAttribute(a, out); DONE.set(el, `${a}=${out}`); }
    }
  }
}

export function translateTree(root) {
  if (LANG === 'tr' || !DICT || !root) return;
  if (root.nodeType === 3) { txText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1 && skipNode(root)) return;
  if (root.nodeType === 1) txAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1 && SKIP_TAGS.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) txText(n);
    else if (n.hasAttribute('data-noi18n')) continue;
    else txAttrs(n);
  }
}

let OBS = null;
function observe() {
  if (OBS || typeof MutationObserver === 'undefined') return;
  OBS = new MutationObserver((list) => {
    if (LANG === 'tr') return;
    for (const m of list) {
      if (m.type === 'characterData') txText(m.target);
      else if (m.type === 'attributes') txAttrs(m.target);
      else for (const n of m.addedNodes) translateTree(n);
    }
  });
  OBS.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// ─────────────────────────── Tuval ───────────────────────────

let CANVAS_PATCHED = false;
function patchCanvas() {
  if (CANVAS_PATCHED || typeof CanvasRenderingContext2D === 'undefined') return;
  CANVAS_PATCHED = true;
  for (const C of [CanvasRenderingContext2D, typeof OffscreenCanvasRenderingContext2D !== 'undefined' ? OffscreenCanvasRenderingContext2D : null]) {
    if (!C) continue;
    for (const fn of ['fillText', 'strokeText', 'measureText']) {
      const orig = C.prototype[fn];
      C.prototype[fn] = function (text, ...rest) {
        return orig.call(this, typeof text === 'string' && LANG !== 'tr' ? tx(text) : text, ...rest);
      };
    }
  }
}

// ─────────────────────────── Dil seçimi ───────────────────────────

let LOADERS = {};
try { LOADERS = import.meta.glob('./dict/*.js'); } catch { /* Node testleri: sözlükler useDict ile */ }

/** Dili ayarla: sözlüğü yükle, belgeyi çevir. */
export async function setLang(id = 'tr') {
  const L = LANG_BY_ID[id] ? id : 'tr';
  CACHE.clear();
  if (L === 'tr') {
    LANG = 'tr';
    DICT = null;
  } else {
    const load = LOADERS[`./dict/${L}.js`];
    const mod = load ? await load() : { default: {} };
    DICT = Object.fromEntries(Object.entries(mod.default || {}).map(([k, v]) => [norm(k), v]));
    compile(DICT);
    LANG = L;
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = L === 'zh' ? 'zh-CN' : L;
    document.documentElement.dir = LANG_BY_ID[L]?.dir || 'ltr';
    document.documentElement.style.setProperty('--script-font', SCRIPT_FONT[L] || 'inherit');
    document.documentElement.dataset.lang = L;
    setPixelLang(L, tx);
    patchCanvas();
    observe();
    translateTree(document.body);
  }
  return L;
}

/** Testler ve araçlar için: sözlüğü doğrudan ver */
export function useDict(id, dict) {
  LANG = id;
  DICT = Object.fromEntries(Object.entries(dict).map(([k, v]) => [norm(k), v]));
  compile(DICT);
  CACHE.clear();
}

/** Cihaz dilinden öneri */
export function guessLang() {
  const nav = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'tr';
  const base = nav.toLowerCase().split('-')[0];
  return LANG_BY_ID[base] ? base : 'tr';
}
