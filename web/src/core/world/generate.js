// DÜNYA ÜRETİCİ — ülke verisinden ligleri ve kurgusal kulüpleri her açılışta aynı şekilde üretir
// (tohumlu rastgelelik: kayıt dosyasına kulüp listesi yazılmaz, sadece güçler ve tablolar).
//
// Lig yapısı (kademe, grup, takım sayısı) leagueConfig.js'ten gelir; burada hiçbir sayı sabit değildir.
// Eski sürümün kulüpleri (her kademede 12) aynı kimlik, ad ve renklerle korunur: eski tohum dizisi aynen
// yeniden oynatılır, gerçek takım sayısına kadar eksik kalan yerler ikinci bir tohumla üretilen yeni kulüplerle dolar.
// Bir kademe eskisinden küçükse fazla kulüpler bir alt kademeye kayar; en alttan da taşanlar "pasif" olur
// (eski kayıtlarda adları görünsün diye kulüp dizininde kalır, yeni sezonlarda lige alınmaz).
import { COUNTRIES, TOWN_PARTS } from './countries.js';
import { PARODY_TOP } from './clubs.js';
import { PARODY_EXTRA, PARODY_GROUP } from './clubsExtra.js';
import { LEAGUE_SYSTEM, baseLeagueId, divisionGroups, groupLeagueId, leagueEntries } from './leagueConfig.js';

/** Basit 32-bit karma + mulberry32: tohumlu, tekrarlanabilir rastgelelik */
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededShuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Forma renk çiftleri */
const PALETTE = [
  ['#c8102e', '#ffffff'], ['#1d4ed8', '#ffffff'], ['#111827', '#f8fafc'], ['#16a34a', '#ffffff'], ['#f59e0b', '#111827'],
  ['#7c3aed', '#fde68a'], ['#0e7490', '#f8fafc'], ['#b91c1c', '#111827'], ['#0f766e', '#fde047'], ['#1e3a8a', '#fbbf24'],
  ['#be123c', '#1e293b'], ['#ea580c', '#ffffff'], ['#65a30d', '#111827'], ['#0369a1', '#f97316'], ['#9d174d', '#f8fafc'],
  ['#334155', '#facc15'], ['#f8fafc', '#dc2626'], ['#f8fafc', '#1d4ed8'], ['#fde047', '#1e3a8a'], ['#7f1d1d', '#38bdf8'],
  ['#047857', '#fbbf24'], ['#581c87', '#f8fafc'], ['#0c4a6e', '#e0f2fe'], ['#a16207', '#111827'], ['#dc2626', '#facc15'],
  ['#2563eb', '#dc2626'], ['#000000', '#16a34a'], ['#e11d48', '#38bdf8'], ['#15803d', '#dc2626'], ['#6b21a8', '#22d3ee'],
];
const KITS = ['solid', 'stripes', 'hoops', 'half', 'sash'];

/** Ülkedeki lig kimliği (kademe → temel lig; gruplu kademelerde ilk grup) */
export const leagueIdFor = (countryId, level) => baseLeagueId(countryId, level);

/** Kademeye göre güç aralığı [en zayıf, en güçlü] */
export function tierRange(country, level) {
  if (country.id === 'tr') return [[50, 79], [24, 45], [16, 30], [10, 22]][level - 1] || [8, 16];
  const [lo, hi] = country.range;
  if (level === 1) return [lo, hi];
  if (level === 2) return [Math.max(10, lo - 22), Math.max(14, lo - 1)];
  if (level === 3) return [Math.max(8, lo - 34), Math.max(12, lo - 13)];
  return [Math.max(6, lo - 42), Math.max(10, lo - 24)];
}

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '');

function shortCode(town, name, taken) {
  const base = strip(town).toUpperCase() || 'XXX';
  const words = name.split(/\s+/).filter((w) => !town.includes(w));
  const tries = [base.slice(0, 3), `${(strip(words[0] || '') || 'X')[0].toUpperCase()}${base.slice(0, 2)}`, `${base[0]}${base.slice(-2)}`, `${base.slice(0, 2)}${(strip(words[0] || 'X')[0] || 'X').toUpperCase()}`, `${base[0]}${base[2] || 'X'}${base[4] || base[1] || 'X'}`];
  for (const t of tries) if (t.length === 3 && !taken.has(t)) return t;
  for (let i = 2; i < 10; i++) {
    const t = `${base.slice(0, 2)}${i}`;
    if (!taken.has(t)) return t;
  }
  for (let i = 10; i < 100; i++) {
    const t = `${base[0]}${i}`;
    if (!taken.has(t)) return t;
  }
  return base.slice(0, 3);
}

/** Eski sürümün kademe başına ürettiği kulüp sayısı (yalnızca eski kimliklerin aynen yeniden üretilmesi için; lig boyutu değildir) */
const LEGACY_CLUBS_PER_LEVEL = 12;

/** Eski sürümün kulüpleri: eski tohum dizisi aynen oynatılır → kimlik, ad, renk, desen korunur */
function legacyClubs(country, reserved) {
  const rnd = seededRng(hashStr(`krampon-${country.id}`));
  const levels = country.id === 'tr' ? [3, 4] : [1, 2, 3];
  const need = levels.length * LEGACY_CLUBS_PER_LEVEL;
  const towns = seededShuffle(country.towns, rnd);
  const entries = [];
  const usedNames = new Set();
  let ti = 0;
  while (entries.length < need && ti < towns.length * 3) {
    const town = towns[ti % towns.length];
    const pats = seededShuffle(country.patterns, rnd);
    const pattern = pats.find((p) => !usedNames.has(p.replace('{T}', town)));
    ti += 1;
    if (!pattern) continue;
    const name = pattern.replace('{T}', town);
    usedNames.add(name);
    entries.push({ town, name });
  }
  const order = seededShuffle(entries, rnd);
  const taken = new Set(reserved);
  const parody = country.id !== 'tr' ? PARODY_TOP[country.id] || [] : [];
  for (const p of parody) taken.add(p.short);
  const out = [];
  levels.forEach((level, li) => {
    const group = order.slice(li * 12, li * 12 + 12);
    group.forEach((e, k) => {
      const noise = rnd() - 0.5; // eski güç gürültüsü (sıra korunsun diye tüketilir)
      const P = level === 1 ? parody[k] : null;
      const short = P ? P.short : shortCode(e.town, e.name, taken);
      taken.add(short);
      const colors = PALETTE[Math.floor(rnd() * PALETTE.length)];
      const flip = rnd() < 0.2;
      const pattern = KITS[Math.floor(rnd() * KITS.length)];
      // eski kimlik: Türkiye'de 3. kademe 'tr2', 4. kademe 'tr3'; diğerlerinde ülke + kademe
      const oldLeague = country.id === 'tr' ? ['super', 'first', 'tr2', 'tr3'][level - 1] : `${country.id}${level}`;
      out.push({
        id: `${oldLeague}-${String(k + 1).padStart(2, '0')}`,
        level,
        name: P ? P.name : e.name,
        short,
        colors: P ? P.colors : flip ? [colors[1], colors[0]] : colors,
        pattern: P ? P.pattern : pattern,
        city: P ? P.city : e.town,
        country: country.id,
        noise,
        ...(P ? { fan: P.fan, parody: k } : {}),
        town: e.town,
      });
    });
  });
  return { clubs: out, taken, usedNames, towns: new Set(country.towns) };
}

/** Ek kasaba adları: parçalardan tohumlu, benzersiz */
function townSource(country, rnd, known) {
  const [pre, suf] = TOWN_PARTS[country.id] || [[], []];
  const combos = [];
  for (const a of pre) {
    for (const b of suf) {
      const joined = a.endsWith('-') ? `${a}${b.trim()[0].toUpperCase()}${b.trim().slice(1)}` : `${a}${b}`;
      if (b.trim().toLowerCase() === a.toLowerCase() || known.has(joined)) continue;
      combos.push(joined);
    }
  }
  const list = seededShuffle(combos, rnd);
  let i = 0;
  return () => {
    while (i < list.length) {
      const t = list[i++];
      if (!known.has(t)) { known.add(t); return t; }
    }
    // parçalar biterse numaralı yedek
    const t = `${country.towns[i % country.towns.length]} ${Math.floor(i / country.towns.length) + 2}`;
    i += 1;
    known.add(t);
    return t;
  };
}

/**
 * Ligler ve kulüpler. Türkiye'nin Süper Lig ve 1. Lig kulüpleri data.js'te elle yazılıdır; buradan alt ligleri gelir.
 * @param {Object<string,string[]>} reserved ülke → önceden alınmış kısaltmalar
 * @returns {{leagues:Array<object>, clubs:Array<object>, inactive:Array<object>}}
 */
export function generateWorld(reserved = {}) {
  const shorts = Object.fromEntries(COUNTRIES.map((c) => [c.id, c.short]));
  const leagues = leagueEntries(shorts);
  const clubs = [];
  const inactive = [];
  for (const country of COUNTRIES) {
    const divs = LEAGUE_SYSTEM[country.id] || [];
    const legacy = legacyClubs(country, reserved[country.id] || []);
    const rnd2 = seededRng(hashStr(`krampon-v3-${country.id}`));
    const nextTown = townSource(country, rnd2, legacy.towns);
    const taken = legacy.taken;
    const townUse = new Map();
    for (const c of legacy.clubs) townUse.set(c.town, (townUse.get(c.town) || 0) + 1);
    const idCount = new Map();
    for (const c of legacy.clubs) {
      const prefix = c.id.slice(0, c.id.lastIndexOf('-'));
      idCount.set(prefix, Math.max(idCount.get(prefix) || 0, Number(c.id.slice(-2))));
    }
    const nextId = (prefix) => {
      const n = (idCount.get(prefix) || 0) + 1;
      idCount.set(prefix, n);
      return `${prefix}-${String(n).padStart(2, '0')}`;
    };
    const firstFree = country.id === 'tr' ? 3 : 1; // Türkiye'nin ilk iki kademesi elle yazılı
    const extraParody = PARODY_EXTRA[country.id] || [];
    let carry = []; // üst kademeden taşan kulüpler
    for (let li = firstFree - 1; li < divs.length; li++) {
      const level = li + 1;
      const div = divs[li];
      const groups = divisionGroups(div);
      const cap = groups.reduce((s, g) => s + g.teams, 0);
      const bottom = li === divs.length - 1;
      // bu kademenin eski kulüpleri (en alt kademe, artık olmayan daha alt kademelerin eskilerini de alır)
      const own = legacy.clubs.filter((c) => c.level === level || (bottom && c.level > level));
      let queue = [...carry, ...own];
      // üst lig: eski 12'den sonra ek parodi kulüpler
      if (level === 1) {
        for (let k = 0; queue.length < cap && k < extraParody.length; k++) {
          const P = extraParody[k];
          const short = taken.has(P.short) ? shortCode(P.city, P.name, taken) : P.short;
          taken.add(short);
          queue.push({ id: null, level, name: P.name, short, colors: P.colors, pattern: P.pattern, city: P.city, country: country.id, fan: P.fan, parody: 12 + k, noise: rnd2() - 0.5 });
        }
      }
      // eksik yerler: yeni kurgusal kulüpler
      while (queue.length < cap) {
        let town = null;
        for (const [t, n] of townUse) if (n < 2 && rnd2() < 0.04) { town = t; break; }
        town = town || nextTown();
        const pats = seededShuffle(country.patterns, rnd2);
        const pattern = pats.find((p) => !legacy.usedNames.has(p.replace('{T}', town))) || pats[0];
        const name = pattern.replace('{T}', town);
        legacy.usedNames.add(name);
        townUse.set(town, (townUse.get(town) || 0) + 1);
        const short = shortCode(town, name, taken);
        taken.add(short);
        const colors = PALETTE[Math.floor(rnd2() * PALETTE.length)];
        queue.push({ id: null, level, name, short, colors: rnd2() < 0.2 ? [colors[1], colors[0]] : colors, pattern: KITS[Math.floor(rnd2() * KITS.length)], city: town, country: country.id, noise: rnd2() - 0.5 });
      }
      carry = queue.slice(cap);
      queue = queue.slice(0, cap);
      // güç sırası: üst ligde parodi sırası, altta taşanlar önde, kalanlar karışık
      const fromAbove = queue.filter((c) => c.level < level);
      const rest = queue.filter((c) => !(c.level < level));
      const ordered = level === 1 ? queue.slice().sort((a, b) => (a.parody ?? 99) - (b.parody ?? 99)) : [...fromAbove, ...seededShuffle(rest, rnd2)];
      const [lo, hi] = tierRange(country, level);
      // gruplara dağıtım: parodi konferans haritası ya da yılan düzeni (gruplar güçte dengeli)
      const gmap = level === 1 ? PARODY_GROUP[country.id] : null;
      const fill = groups.map(() => 0);
      const snake = (k) => {
        const n = groups.length;
        const round = Math.floor(k / n);
        const pos = k % n;
        let gi = round % 2 === 0 ? pos : n - 1 - pos;
        let guard = 0;
        while (fill[gi] >= groups[gi].teams && guard++ < n) gi = (gi + 1) % n;
        return gi;
      };
      ordered.forEach((c, k) => {
        const t = ordered.length > 1 ? k / (ordered.length - 1) : 0;
        const rating = Math.round(hi - (hi - lo) * Math.pow(t, 0.9) + c.noise * 2);
        let gi = gmap && c.parody != null && gmap[c.parody] != null ? gmap[c.parody] : snake(k);
        if (fill[gi] >= groups[gi].teams) gi = snake(k);
        fill[gi] += 1;
        const league = groupLeagueId(country.id, level, gi);
        const { noise, town, level: _l, parody, ...rest2 } = c;
        clubs.push({ ...rest2, id: c.id || nextId(league), league, rating: Math.max(6, rating) });
      });
    }
    // en alttan taşanlar: pasif (yalnız eski kayıtlar için ad bilgisi)
    for (const c of carry) {
      const { noise, town, level, parody, ...rest2 } = c;
      if (c.id) inactive.push({ ...rest2, league: null, rating: 8, inactive: true });
    }
  }
  return { leagues, clubs, inactive };
}
