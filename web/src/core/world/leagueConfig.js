// LİG YAPISI — her ülkenin lig piramidi tek yerde (gerçek hayattaki takım sayıları, 2025–26 / 2026–27 sezonları).
// Kodun hiçbir yerinde takım ya da lig sayısı sabit yazılmaz: lig üretimi, fikstür, takvim, küme düşme/çıkma
// ve kupa biçimi bu tablodan hesaplanır. Yeni bir lig, grup ya da takım sayısı eklemek için yalnız burası değişir.
//
// Her ülke: kademeler dizisi (üstten alta). Kademe alanları:
//   name    lig adı                     short  kısa ad (Türkiye'de SL, 1L…; boşsa ülke kısaltması + kademe)
//   teams   takım sayısı (tek grup)     groups [[grup adı, takım sayısı, tam ad?], …] — gruplu ligler (her grup ayrı tablo)
//   legs    her rakiple kaç maç (varsayılan 2 = çift devre; 3–4: bölünmüş/dört devreli ligler)
//   down    her gruptan bir alt kademeye düşen takım sayısı
//   up      bir üst kademeye çıkış: { direct: her gruptan doğrudan, playoff: [ilk, son] sıralar, spots: toplam play-off kontenjanı }
//           (spots verilmezse her grubun play-off galibi çıkar; daha azsa grup galipleri kendi aralarında eşleşir)
//   closed  true: üst kademeyle arasında küme düşme/çıkma yok (ABD, Kanada)
// Tutarlılık: üst kademenin (down × grup sayısı) = alt kademenin (direct × grup sayısı + play-off kontenjanı).

const G = (prefix, list) => list.map(([label, teams]) => [`${prefix}${label}`, teams]);
const many = (n, teams, label = (i) => `${i + 1}. Grup`) => Array.from({ length: n }, (_, i) => [label(i), teams]);

export const LEAGUE_SYSTEM = {
  tr: [
    { name: 'Süper Lig', short: 'SL', teams: 18, down: 3 },
    { name: '1. Lig', short: '1L', teams: 20, up: { direct: 2, playoff: [3, 6] }, down: 4 },
    { name: '2. Lig', short: '2L', groups: [['Beyaz Grup', 18], ['Kırmızı Grup', 18]], up: { direct: 1, playoff: [2, 5] }, down: 3 },
    { name: '3. Lig', short: '3L', groups: many(4, 16), up: { direct: 1, playoff: [2, 5], spots: 2 } },
  ],
  en: [
    { name: 'Premier Lig', teams: 20, down: 3 },
    { name: 'Championship', teams: 24, up: { direct: 2, playoff: [3, 6] }, down: 3 },
    { name: 'League One', teams: 24, up: { direct: 2, playoff: [3, 6] } },
  ],
  es: [
    { name: 'Primera División', teams: 20, down: 3 },
    { name: 'Segunda División', teams: 22, up: { direct: 2, playoff: [3, 6] }, down: 4 },
    { name: 'Primera Federación', groups: [['Grup 1', 20], ['Grup 2', 20]], up: { direct: 1, playoff: [2, 5] } },
  ],
  de: [
    { name: 'Bundesliga', teams: 18, down: 2 },
    { name: '2. Bundesliga', teams: 18, up: { direct: 2 }, down: 2 },
    { name: '3. Liga', teams: 20, up: { direct: 2 } },
  ],
  it: [
    { name: 'Serie A', teams: 20, down: 3 },
    { name: 'Serie B', teams: 20, up: { direct: 2, playoff: [3, 6] }, down: 4 },
    { name: 'Serie C', groups: [['Girone A', 20], ['Girone B', 20], ['Girone C', 20]], up: { direct: 1, playoff: [2, 5], spots: 1 } },
  ],
  fr: [
    { name: 'Ligue 1', teams: 18, down: 3 },
    { name: 'Ligue 2', teams: 18, up: { direct: 2, playoff: [3, 5] }, down: 3 },
    { name: 'National', teams: 17, up: { direct: 2, playoff: [3, 4] } },
  ],
  pt: [
    { name: 'Primeira Liga', teams: 18, down: 3 },
    { name: 'Liga 2', teams: 18, up: { direct: 2, playoff: [3, 4] }, down: 2 },
    { name: 'Liga 3', groups: [['Série A', 10], ['Série B', 10]], up: { direct: 1 } },
  ],
  sc: [
    { name: 'Premiership', teams: 12, legs: 3, down: 1 },
    { name: 'Championship', teams: 10, legs: 4, up: { direct: 1 }, down: 1 },
    { name: 'League One', teams: 10, legs: 4, up: { direct: 1 }, down: 1 },
    { name: 'League Two', teams: 10, legs: 4, up: { direct: 1 } },
  ],
  wa: [
    { name: 'Cymru Premier', teams: 16, down: 2 },
    { name: 'Cymru Championship', groups: [['Cymru North', 16, true], ['Cymru South', 16, true]], up: { direct: 1 }, down: 2 },
    { name: 'Ardal Lig', groups: G('Ardal ', [['Kuzeydoğu', 16], ['Kuzeybatı', 16], ['Güneydoğu', 16], ['Güneybatı', 16]]).map((g) => [...g, true]), up: { direct: 1 } },
  ],
  dk: [
    { name: 'Superliga', teams: 12, legs: 3, down: 2 },
    { name: '1. Division', teams: 12, legs: 3, up: { direct: 2 }, down: 2 },
    { name: '2. Division', teams: 12, legs: 3, up: { direct: 2 } },
  ],
  ru: [
    { name: 'Premier Liga', teams: 16, down: 2 },
    { name: '1. Liga', teams: 18, up: { direct: 2 }, down: 2 },
    { name: '2. Liga', teams: 18, up: { direct: 2 } },
  ],
  ua: [
    { name: 'Premier Liha', teams: 16, down: 2 },
    { name: 'Persha Liha', teams: 16, up: { direct: 2 }, down: 2 },
    { name: 'Druha Liha', groups: [['A Grubu', 11], ['B Grubu', 11]], up: { direct: 1 } },
  ],
  gr: [
    { name: 'Super League', teams: 14, down: 2 },
    { name: 'Super League 2', teams: 16, up: { direct: 2 }, down: 6 },
    { name: 'Gamma Ethniki', groups: many(6, 12), up: { direct: 1 } },
  ],
  ro: [
    { name: 'Liga I', teams: 16, down: 2 },
    { name: 'Liga II', teams: 22, up: { direct: 2 } },
  ],
  ch: [
    { name: 'Super League', teams: 12, legs: 3, down: 1 },
    { name: 'Challenge League', teams: 10, legs: 4, up: { direct: 1 }, down: 1 },
    { name: 'Promotion League', teams: 18, up: { direct: 1 } },
  ],
  pl: [
    { name: 'Ekstraklasa', teams: 18, down: 3 },
    { name: 'I Liga', teams: 18, up: { direct: 2, playoff: [3, 6] }, down: 3 },
    { name: 'II Liga', teams: 18, up: { direct: 2, playoff: [3, 6] } },
  ],
  cn: [
    { name: 'Süper Lig', teams: 16, down: 2 },
    { name: '1. Lig', teams: 16, up: { direct: 2 }, down: 2 },
    { name: '2. Lig', groups: [['A Grubu', 12], ['B Grubu', 12]], up: { direct: 1 } },
  ],
  sa: [
    { name: 'Pro Lig', teams: 18, down: 3 },
    { name: '1. Lig', teams: 18, up: { direct: 2, playoff: [3, 6] }, down: 2 },
    { name: '2. Lig', groups: [['A Grubu', 16], ['B Grubu', 16]], up: { direct: 1 } },
  ],
  jp: [
    { name: 'J1 Lig', teams: 20, down: 3 },
    { name: 'J2 Lig', teams: 20, up: { direct: 2, playoff: [3, 6] }, down: 3 },
    { name: 'J3 Lig', teams: 20, up: { direct: 2, playoff: [3, 6] } },
  ],
  kr: [
    { name: 'K Lig 1', teams: 12, legs: 3, down: 2 },
    { name: 'K Lig 2', teams: 17, up: { direct: 1, playoff: [2, 5] }, down: 1 },
    { name: 'K3 Lig', teams: 16, up: { direct: 1 } },
  ],
  za: [
    { name: 'Premiership', teams: 16, down: 2 },
    { name: '1. Lig', teams: 16, up: { direct: 1, playoff: [2, 4] } },
  ],
  eg: [
    { name: 'Premier Lig', teams: 21, down: 4 },
    { name: '2. Lig', teams: 18, up: { direct: 4 } },
  ],
  ng: [
    { name: 'Professional Lig', teams: 20, down: 4 },
    { name: 'National Lig', groups: [['A Konferansı', 9], ['B Konferansı', 9], ['C Konferansı', 9], ['D Konferansı', 9]], up: { direct: 1 } },
  ],
  ma: [
    { name: 'Botola Pro', teams: 16, down: 2 },
    { name: 'Botola 2', teams: 16, up: { direct: 2 }, down: 2 },
    { name: 'Amatör Lig', teams: 16, up: { direct: 2 } },
  ],
  br: [
    { name: 'Série A', teams: 20, down: 4 },
    { name: 'Série B', teams: 20, up: { direct: 4 }, down: 4 },
    { name: 'Série C', teams: 20, up: { direct: 4 } },
  ],
  ar: [
    { name: 'Primera División', groups: [['A Bölgesi', 15], ['B Bölgesi', 15]], down: 1 },
    { name: 'Primera Nacional', groups: [['A Bölgesi', 18], ['B Bölgesi', 18]], up: { direct: 1 }, down: 1 },
    { name: 'Primera B', teams: 20, up: { direct: 1, playoff: [2, 5] } },
  ],
  us: [
    { name: 'Major Lig', groups: [['Doğu Konferansı', 15], ['Batı Konferansı', 15]] },
    { name: 'Championship', groups: [['Doğu Konferansı', 13], ['Batı Konferansı', 12]], closed: true },
  ],
  ca: [
    { name: 'Premier Lig', teams: 8, legs: 4 },
    { name: 'League1', groups: [['Ontario', 12], ['Québec', 12], ['BC', 10]], closed: true },
  ],
};

/** Yapıdan kaldırılmış eski ligler: eski kayıtların süren sezonu için ad bilgisi (yeni dünyada oluşturulmaz) */
export const LEGACY_LEAGUES = {
  ro3: { name: 'Liga III', level: 3 }, za3: { name: '2. Lig', level: 3 }, eg3: { name: '3. Lig', level: 3 },
  ng3: { name: 'Amatör Lig', level: 3 }, us3: { name: 'League One', level: 3 }, ca3: { name: 'Amatör Lig', level: 3 },
};

const LETTERS = 'abcdefghijklmnop';

/** Ülkenin n. kademesinin temel lig kimliği (Türkiye eski kayıtlarla uyumlu: super, first, tr2 = 2. Lig, tr3 = 3. Lig) */
export const baseLeagueId = (cc, level) => (cc === 'tr' ? (['super', 'first'][level - 1] || `tr${level - 1}`) : `${cc}${level}`);
/** Grup lig kimliği: ilk grup temel kimliği taşır, sonrakiler harf eki alır (tr2, tr2b, tr2c…) */
export const groupLeagueId = (cc, level, gi) => `${baseLeagueId(cc, level)}${gi ? LETTERS[gi] : ''}`;

/** Bir kademenin grupları: [{label, teams, full}] */
export function divisionGroups(div) {
  if (div.groups?.length) return div.groups.map(([label, teams, full]) => ({ label, teams, full: !!full }));
  return [{ label: '', teams: div.teams, full: false }];
}

/** Tek kademedeki toplam takım */
export const divisionSize = (div) => divisionGroups(div).reduce((s, g) => s + g.teams, 0);

/** Play-off ile çıkan toplam takım (kademe için) */
export function playoffSpots(div) {
  if (!div.up?.playoff) return 0;
  return div.up.spots ?? divisionGroups(div).length;
}

/** Kademeden yukarı çıkan toplam takım */
export const promotedCount = (div) => (div.closed || !div.up ? 0 : (div.up.direct || 0) * divisionGroups(div).length + playoffSpots(div));
/** Kademeden aşağı düşen toplam takım */
export const relegatedCount = (div) => (div.down || 0) * divisionGroups(div).length;

/** Lig kaydı listesi: [{id, name, short, tier, level, country, div, group, groupIdx, groups, size, legs, up, down, closed}] */
export function leagueEntries(countryShort = {}) {
  const out = [];
  for (const [cc, divs] of Object.entries(LEAGUE_SYSTEM)) {
    divs.forEach((div, i) => {
      const level = i + 1;
      const groups = divisionGroups(div);
      groups.forEach((g, gi) => {
        const base = div.short || `${countryShort[cc] || cc.toUpperCase()}${level}`;
        out.push({
          id: groupLeagueId(cc, level, gi),
          name: g.full ? g.label : g.label ? `${div.name} ${g.label}` : div.name,
          div: div.name,
          group: g.label || null,
          groupIdx: gi,
          groups: groups.length,
          short: groups.length > 1 ? `${base}${String.fromCharCode(65 + gi)}` : base,
          tier: level,
          level,
          country: cc,
          size: g.teams,
          legs: div.legs || 2,
          up: div.closed ? null : div.up || null,
          down: div.down || 0,
          closed: !!div.closed,
          bottom: i === divs.length - 1,
        });
      });
    });
  }
  return out;
}

/** Ülkenin kademe sayısı */
export const tiersOf = (cc) => LEAGUE_SYSTEM[cc]?.length || 0;
