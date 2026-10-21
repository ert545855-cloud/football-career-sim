// DÜNYA — 28 ülke. Lig piramidi (kademe, grup, takım sayısı) leagueConfig.js'te. Kulüpler ve kasaba adları kurgusaldır.
//
// range: üst ligdeki kulüp gücü aralığı [en zayıf, en güçlü] (oyuncu OVR'si ile aynı ölçek).
//        Alt ligler bundan türetilir (generate.js).
// wage:  maaş çarpanı (zengin ligler daha çok öder).
// euro:  Avrupa kupalarına katılır mı.
// lang:  oyuncu isim havuzu (names.js).
// towns: kurgusal kasaba/mahalle adları; patterns: kulüp adı kalıpları ({T} = kasaba).

const L = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export const COUNTRIES = [
  {
    id: 'tr', name: 'Türkiye', short: 'TÜR', flag: '🇹🇷', conf: 'UEFA', euro: true, lang: 'tr', wage: 1, range: [50, 79],
    // Süper Lig ve 1. Lig kulüpleri data.js'te elle yazılıdır; 2. ve 3. Lig buradan üretilir
    towns: L('Ilgaz,Abant,Salda,Zigana,Palandöken,Bozcaada,Gökçeada,Assos,Olimpos,Likya,Sümela,Ihlara,Nallıhan,Safranbolu,Amasra,Kapıdağ,Eğirdir,Beyşehir,Köprülü,Göksu,Aspendos,Hattuşa,Zeugma,Ağva'),
    patterns: L('{T} SK,{T} FK,{T} Spor,{T} Gençlik,{T} Belediyespor,{T} İdman Yurdu,{T} Gücü'),
  },
  {
    id: 'en', name: 'İngiltere', short: 'İNG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', conf: 'UEFA', euro: true, lang: 'en', wage: 1.8, range: [70, 90],
    towns: L('Ashcombe,Blackmere,Kingsbridge,Harrowby,Elmstead,Northwold,Redcliffe,Stonebury,Westerby,Thornfield,Marlowe,Wyndham,Ravensworth,Castlebrook,Greywater,Oakhurst,Fairhaven,Hollingford,Ellesborough,Tidemouth,Lowther,Saltmarsh,Whitcombe,Brackenvale'),
    patterns: L('{T} United,{T} City,{T} Rovers,{T} Athletic,{T} Town,{T} Wanderers,AFC {T},{T} Albion,{T} County'),
  },
  {
    id: 'es', name: 'İspanya', short: 'İSP', flag: '🇪🇸', conf: 'UEFA', euro: true, lang: 'es', wage: 1.4, range: [67, 90],
    towns: L('Valdoria,Monteluz,Sierrablanca,Castroviejo,Villamar,Almenara,Rocaverde,Peñascal,Torreluna,Fuentesol,Aldeamar,Campoalto,Robledal,Mirasierra,Valleseco,Cuevarroja,Lomanegra,Navalcruz,Alcazarén,Riberabaja,Santalba,Montenebro,Calablanca,Puertolargo'),
    patterns: L('Real {T},Atlético {T},CD {T},UD {T},SD {T},Racing {T},{T} CF,Deportivo {T},CF {T}'),
  },
  {
    id: 'de', name: 'Almanya', short: 'ALM', flag: '🇩🇪', conf: 'UEFA', euro: true, lang: 'de', wage: 1.4, range: [66, 88],
    towns: L('Eichenbrück,Falkenstadt,Waldbrunn,Hohenwart,Sonnenfeld,Kronenburg,Lindenau,Adlerhorst,Grünwalde,Moosbach,Ostermark,Rosenthal,Tannheim,Weißenstein,Ulmenhof,Burgwald,Kaltenbrunn,Seehausen,Hirschau,Brückenfeld,Altmühl,Nordheide,Elbtal,Schwarzbach'),
    patterns: L('FC {T},SV {T},VfB {T},TSV {T},Borussia {T},Eintracht {T},1. FC {T},SpVgg {T},VfL {T},SC {T}'),
  },
  {
    id: 'it', name: 'İtalya', short: 'İTA', flag: '🇮🇹', conf: 'UEFA', euro: true, lang: 'it', wage: 1.3, range: [66, 88],
    towns: L('Valmonte,Castelrocca,Montealto,Roccaserra,Torrebianca,Fiumara,Sanvitale,Collebello,Lagoverde,Borgo Alto,Marinella,Villabruna,Castelfiore,Rivabella,Poggioverde,Campolungo,Selvanera,Fontanella,Ripalta,Santa Corona,Acquachiara,Montebruno,Portosole,Cervarola'),
    patterns: L('AC {T},US {T},{T} Calcio,SS {T},AS {T},Virtus {T},Sporting {T},FC {T},Pro {T}'),
  },
  {
    id: 'fr', name: 'Fransa', short: 'FRA', flag: '🇫🇷', conf: 'UEFA', euro: true, lang: 'fr', wage: 1.25, range: [63, 86],
    towns: L('Beauvallon,Montclair,Saint-Aubrac,Rochemaure,Villerande,Clairmarais,Pontaven,Loursac,Belcastel,Montavel,Fontrieux,Castelvieil,Sainte-Orne,Vaudrange,Mirevaux,Brévaux,Champsaurin,Port-Malo,Givrecourt,Alvernes,Mercœur,Lanvallec,Rivesaltine,Hautebrise'),
    patterns: L('FC {T},AS {T},Olympique {T},Stade {T},RC {T},US {T},SC {T},En Avant {T},AJ {T}'),
  },
  {
    id: 'pt', name: 'Portekiz', short: 'POR', flag: '🇵🇹', conf: 'UEFA', euro: true, lang: 'pt', wage: 0.9, range: [57, 82],
    towns: L('Vilaverde,Montemar,Ribafria,Serralta,Castelo Novo,Pinhalinho,Torre Alva,Valdouro,Alcaravela,Portomar,Sambucal,Rio Claro,Aldeia Nova,Fontelas,Lagoaça,Barrocal,Santa Luzia,Ervedal,Covelinhas,Alvorada,Calçadinha,Oliveirinha,Penaverde,Marvila Alta'),
    patterns: L('SC {T},FC {T},Académico de {T},Desportivo de {T},União de {T},CD {T},Sporting de {T},GD {T}'),
  },
  {
    id: 'sc', name: 'İskoçya', short: 'İSK', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', conf: 'UEFA', euro: true, lang: 'sc', wage: 0.8, range: [48, 76],
    towns: L('Glenmorie,Kilbrannan,Strathloch,Inverbrae,Dunmarrow,Ardcraig,Lochaven,Ballindrum,Craigmuir,Kirkhaven,Rosslyth,Bannockmere,Auchterlee,Glencarra,Fennoch,Lismorran,Torranbay,Carnmoor,Ellenmuir,Drumlithe,Port Ardan,Blairgowan,Kinbrae,Muirhaven'),
    patterns: L('{T} FC,{T} Thistle,{T} United,{T} Rovers,{T} Athletic,{T} Academicals,{T} Albion'),
  },
  {
    id: 'wa', name: 'Galler', short: 'GAL', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', conf: 'UEFA', euro: true, lang: 'wa', wage: 0.4, range: [30, 50],
    towns: L('Aberfelin,Penhallow,Caerwyn,Llanderyn,Bryngarth,Pontyrhys,Cwmdewi,Glynhafod,Rhosgoch,Penrhos,Llanfair Isaf,Aberllyn,Pencader,Bryncoed,Morfa Bay,Dinas Cerrig,Cefnmawr,Hafodwen,Llyswen,Rhydlewis,Caerhafod,Porth Eirias,Tregwyn,Nantmor'),
    patterns: L('{T} Town,{T} FC,CPD {T},{T} Athletic,{T} United,{T} Rovers'),
  },
  {
    id: 'dk', name: 'Danimarka', short: 'DAN', flag: '🇩🇰', conf: 'UEFA', euro: true, lang: 'dk', wage: 0.9, range: [50, 72],
    towns: L('Bølgeby,Havnsø,Kløvermark,Fjordholm,Ravnsø,Egelund,Bakkelund,Nørreby,Østerlund,Mølleby,Engvang,Højslev,Sandholt,Kildebro,Bøgely,Lindved,Rosvang,Askehave,Tornby,Vindholm,Strandvig,Lyngbro,Skovhøj,Ålehus'),
    patterns: L('{T} BK,{T} IF,FC {T},{T} FF,{T} Boldklub,B.{T}'),
  },
  {
    id: 'ru', name: 'Rusya', short: 'RUS', flag: '🇷🇺', conf: 'UEFA', euro: true, lang: 'ru', wage: 1, range: [56, 77],
    towns: L('Severograd,Volzhansk,Belozyorsk,Kamensk,Zarechny,Krasnoborsk,Novolipovsk,Ozyorsk,Lesnoy,Sosnovka,Pribrezhny,Gornoye,Medvedevo,Yasnogorsk,Kedrovy,Polyarny,Tikhoretsk,Ugolny,Rechnoy,Stepnoye,Zaozyorny,Berezniki Novye,Solnechny,Ledovsk'),
    patterns: L('FK {T},Dinamo {T},Torpedo {T},Spartak {T},Lokomotiv {T},Metallurg {T},Zvezda {T},Krylya {T}'),
  },
  {
    id: 'ua', name: 'Ukrayna', short: 'UKR', flag: '🇺🇦', conf: 'UEFA', euro: true, lang: 'ua', wage: 0.7, range: [53, 76],
    towns: L('Lyman,Bilohirsk,Sonyachne,Krasnohirka,Dniprovka,Stepove,Lisove,Pivdenne,Zoriane,Berezivka,Kalynivka,Vyshneve,Sosnivka,Ozerne,Horodok,Medove,Pryberezhne,Chervonohirka,Zlatopil,Snizhne,Dubrovka,Yablunivka,Kvitneve,Zelenyi Hai'),
    patterns: L('FK {T},Metalurh {T},Naftovyk {T},Avanhard {T},Kolos {T},Dynamo {T},Shakhtar {T},Zirka {T}'),
  },
  {
    id: 'gr', name: 'Yunanistan', short: 'YUN', flag: '🇬🇷', conf: 'UEFA', euro: true, lang: 'gr', wage: 0.8, range: [52, 75],
    towns: L('Kalamaki,Neoxori,Ampelonas,Kastri,Limnochori,Petralona,Mylopotamos,Kipoi,Agia Marina,Stavros,Elaionas,Dafni,Kryoneri,Psathi,Neapoli Ano,Lefkochori,Asprochori,Kalliroi,Megalochori,Asterochori,Fengari,Thalassini,Lithari,Pefkochori'),
    patterns: L('AE {T},PAS {T},Asteras {T},Apollon {T},Iraklis {T},Ethnikos {T},Atromitos {T},AO {T}'),
  },
  {
    id: 'ro', name: 'Romanya', short: 'ROM', flag: '🇷🇴', conf: 'UEFA', euro: true, lang: 'ro', wage: 0.6, range: [48, 68],
    towns: L('Valea Verde,Râul Lung,Piatra Albă,Câmpia Nouă,Lunca Mare,Codrii Noi,Satu Vechi,Izvorul Rece,Poiana Lungă,Valea Sării,Dealu Florilor,Cetatea Nouă,Malu Roșu,Pădureni,Fântâna Mare,Muntenii,Brazii,Sălcioara,Stejaru,Movila Albă,Sfântu Râu,Colinele,Ulmeni Noi,Vârful Alb'),
    patterns: L('FC {T},CS {T},Universitatea {T},Gloria {T},Unirea {T},Viitorul {T},Sportul {T},Petrolul {T},Metalul {T}'),
  },
  {
    id: 'ch', name: 'İsviçre', short: 'İSV', flag: '🇨🇭', conf: 'UEFA', euro: true, lang: 'de', wage: 1.2, range: [52, 72],
    towns: L('Bergdorf,Seewald,Alpenrath,Rheinegg,Sonnmatt,Talwil,Steinach,Mattenhof,Grünau,Hochfluh,Seefeld,Bachtal,Lac-Doré,Montchoisi,Val-Fleuri,Castagnola,Monte Lupo,Pierrefeu,Bellerive,Gletschbach,Föhnwil,Edelsee,Rotsee,Silberhorn'),
    patterns: L('FC {T},SC {T},{T} FC,BSC {T},AC {T},FC {T} Sport'),
  },
  {
    id: 'pl', name: 'Polonya', short: 'POL', flag: '🇵🇱', conf: 'UEFA', euro: true, lang: 'pl', wage: 0.7, range: [50, 70],
    towns: L('Białogóra,Zielony Gaj,Srebrnica,Jeziorko,Wiśniowo,Dębowiec,Lipowa Wola,Borowiec,Złote Pole,Kamieniec,Brzegowo,Leśna Polana,Orzeszkowo,Grabówka,Modrzewie,Słoneczne,Wierzbno,Bursztyn,Stawiska,Olszyna,Topolin,Rzeczka,Gorzkowo,Krzemień'),
    patterns: L('MKS {T},Wisła {T},Górnik {T},Stal {T},Polonia {T},Zagłębie {T},Odra {T},Pogoń {T},Warta {T},KS {T},Ruch {T}'),
  },
  {
    id: 'cn', name: 'Çin', short: 'ÇİN', flag: '🇨🇳', conf: 'AFC', euro: false, lang: 'cn', wage: 1.3, range: [46, 68],
    towns: L('Jinhai,Longquan,Baishan,Qinghe,Huayang,Xiangshan,Yunling,Haifeng,Taibai,Lanxi,Shuangfeng,Fengcheng,Lingshui,Dongjiang,Nanhu,Pingshan,Chunxi,Mingyue,Songbai,Yuquan,Hexi,Tianmu,Wuyuan,Lushan'),
    patterns: L('{T} FC,{T} Dragons,{T} Tigers,{T} Phoenix,{T} Golden Eagles,{T} Red Stars'),
  },
  {
    id: 'sa', name: 'Suudi Arabistan', short: 'SUU', flag: '🇸🇦', conf: 'AFC', euro: false, lang: 'sa', wage: 1.9, range: [55, 80],
    towns: L('Sahel,Waha,Rimal,Faris,Nujoom,Bayraq,Qamar,Shams,Sahra,Majd,Nour,Badr,Kawkab,Safa,Marjan,Rawda,Jabal,Wadi,Burj,Saqr,Thuraya,Yamama,Hamra,Dana'),
    patterns: L('Al-{T},Al-{T} FC,{T} Club,Nadi {T}'),
  },
  {
    id: 'jp', name: 'Japonya', short: 'JAP', flag: '🇯🇵', conf: 'AFC', euro: false, lang: 'jp', wage: 0.9, range: [52, 72],
    towns: L('Asahigawa,Minamisawa,Kurosaki,Higashino,Takamine,Nishihara,Midorigaoka,Hoshizora,Kitahama,Umimachi,Yamabuki,Sakuragi,Akagane,Hanazono,Tsubasa,Kazemachi,Mizuho,Kirigaoka,Hinode,Amagase,Shiokaze,Kiyosato,Momiji,Shirakaba'),
    patterns: L('{T} FC,FC {T},{T} Blaze,{T} Sakura,{T} Wave,{T} Thunder,{T} Stallions,{T} Gale'),
  },
  {
    id: 'kr', name: 'Güney Kore', short: 'KOR', flag: '🇰🇷', conf: 'AFC', euro: false, lang: 'kr', wage: 0.8, range: [52, 72],
    towns: L('Hanbit,Daesan,Seorim,Cheongsan,Haeun,Mirae,Gangbyeon,Saebyeok,Bitgaram,Namsan,Yeongdo,Geumgang,Baeksan,Haneul,Sinseong,Ohak,Garam,Nuri,Dasol,Areum,Saemmul,Byeolbit,Hanul,Sorae'),
    patterns: L('{T} FC,{T} United,{T} Tigers,{T} Dragons,{T} Citizen,{T} Warriors'),
  },
  {
    id: 'za', name: 'Güney Afrika', short: 'GAF', flag: '🇿🇦', conf: 'CAF', euro: false, lang: 'za', wage: 0.5, range: [44, 64],
    towns: L('Kwaleni,Sunvale,Goldridge,Thornvale,Highveld,Bluegum,Marula Bay,Ironwood,Lionspark,Kloofrand,Seaview Cape,Umhlali,Ezweni,Kwanele,Masizakhe,Ilanga,Sondela,Ubuntu Park,Maluti,Karoo Vale,Protea Hill,Baobab,Amanzi,Thandeka'),
    patterns: L('{T} FC,{T} City,{T} Stars,{T} United,{T} Lions,{T} Rangers'),
  },
  {
    id: 'eg', name: 'Mısır', short: 'MIS', flag: '🇪🇬', conf: 'CAF', euro: false, lang: 'eg', wage: 0.5, range: [46, 69],
    towns: L('El Obour,Badr,Sinai,Port Fouad,Kafr Nour,Minya Gedida,Wadi Natrun,Abu Simbel,Siwa,Dahab,Marsa Alam,Rashid,El Tor,Edfu,Qena,Esna,Akhmim,Dakhla,Farafra,Bahariya,Nuweiba,Kharga,Safaga,Bilbeis'),
    patterns: L('{T} SC,{T} FC,Al-{T},Nasr {T},Ittihad {T},Ghazl {T}'),
  },
  {
    id: 'ng', name: 'Nijerya', short: 'NİJ', flag: '🇳🇬', conf: 'CAF', euro: false, lang: 'ng', wage: 0.35, range: [38, 58],
    towns: L('Ogbomoso,Ikire,Ijebu,Oyo,Ondo,Ekiti,Nsukka,Awka,Abakaliki,Lokoja,Makurdi,Bauchi,Gombe,Yola,Calabar,Uyo,Asaba,Owerri,Umuahia,Minna,Sokoto,Katsina,Zaria,Ilesa'),
    patterns: L('{T} United,{T} Stars,{T} Warriors,{T} Sharks,{T} Rangers,{T} Pillars,{T} Tornadoes'),
  },
  {
    id: 'ma', name: 'Fas', short: 'FAS', flag: '🇲🇦', conf: 'CAF', euro: false, lang: 'ma', wage: 0.5, range: [46, 68],
    towns: L('Ifrane,Chefchaouen,Essaouira,Ouarzazate,Tiznit,Taroudant,Azrou,Midelt,Errachidia,Zagora,Larache,Asilah,Taza,Guelmim,Sefrou,Khenifra,Imouzzer,Tafraout,Merzouga,Erfoud,Tinghir,Oualidia,Martil,Mirleft'),
    patterns: L('{T} AC,Ittihad {T},Chabab {T},Olympique {T},Renaissance {T},Maghreb {T},Kawkab {T},Hassania {T}'),
  },
  {
    id: 'br', name: 'Brezilya', short: 'BRE', flag: '🇧🇷', conf: 'CONMEBOL', euro: false, lang: 'br', wage: 0.8, range: [62, 82],
    towns: L('Serra Azul,Vale do Sol,Porto Sereno,Campo Alegre,Lagoa Dourada,Morro Alto,Pedra Branca,Ribeirão Novo,Santa Aurora,Vila Esperança,Monte Verde,Três Pontes,Cachoeira Alta,Recanto,Brisamar,Terra Nova,Juruá,Itaquara,Mangueiral,Coqueiral,Cajueiro,Areia Branca,Bom Retiro,Rio Manso'),
    patterns: L('{T} EC,Atlético {T},Esporte Clube {T},{T} FC,Grêmio {T},União {T},Sport {T},América de {T}'),
  },
  {
    id: 'ar', name: 'Arjantin', short: 'ARJ', flag: '🇦🇷', conf: 'CONMEBOL', euro: false, lang: 'ar', wage: 0.7, range: [59, 80],
    towns: L('Villa Serrana,Puerto Esperanza,Cerro Azul,Laguna Blanca,Los Pinares,Valle Hermoso,San Ramiro,Santa Brisa,Pampa Alta,Río Dorado,Bahía Clara,Cañada Honda,Los Aromos,Médanos,Sierra Chica,Villa Alegre,Piedra Buena,Quebrada Linda,Tres Arroyos Sur,Ñandú,Las Toscas,Cerro Negro,Viento Sur,Monte Lindo'),
    patterns: L('Club Atlético {T},Deportivo {T},{T} Juniors,Sportivo {T},Racing de {T},Gimnasia de {T},Unión {T},Independiente de {T},Ferro {T}'),
  },
  {
    id: 'us', name: 'ABD', short: 'ABD', flag: '🇺🇸', conf: 'CONCACAF', euro: false, lang: 'us', wage: 1.2, range: [54, 74],
    towns: L('Silver Lake,Redwood Bay,Iron Valley,Lakeshore,Pine Ridge,Bluewater,Stone Harbor,Eagle Crest,Copper Hills,Golden Plains,Harbor City,Riverbend,Prairie View,Canyon Springs,Coastline,Bay Harbor,Highpoint,Twin Rivers,Granite Peak,Oak Bluff,Bridgewater,Mesa Verde,Lone Pine,Sunridge'),
    patterns: L('{T} FC,{T} SC,{T} United,{T} City,Sporting {T},{T} Athletic,{T} Hawks,{T} Storm,Real {T}'),
  },
  {
    id: 'ca', name: 'Kanada', short: 'KAN', flag: '🇨🇦', conf: 'CONCACAF', euro: false, lang: 'ca', wage: 0.9, range: [42, 60],
    towns: L('Maple Bay,Northshore,Pinecrest,Lakehead,Rivière-Bleue,Mont-Clair,Cedarbrook,Glacier Point,Hudson Ridge,Prairie Rose,Timberline,Aurora Falls,Bear Creek,Silverbirch,Fort Granite,Sainte-Lune,Westerlake,Kingsport,Redriver,Iceberg Bay,Caribou Lake,Ptarmigan,Spruce Hollow,Beaumarais'),
    patterns: L('{T} FC,{T} United,{T} City,Atlético {T},{T} Wanderers,{T} SC,{T} Pacific'),
  },
];

export const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map((c) => [c.id, c]));

/** Avrupa kupaları dağılımı (Şampiyonlar Ligi / Avrupa Ligi / Konferans Ligi), ülke başına takım sayısı */
export const EURO_SLOTS = {
  cl: { en: 4, es: 4, de: 4, it: 4, fr: 3, pt: 2, tr: 2, sc: 1, ru: 1, ua: 1, gr: 1, dk: 1, ch: 1, pl: 1, ro: 1, wa: 1 },
  el: { en: 2, es: 2, de: 2, it: 2, fr: 2, pt: 2, tr: 2, sc: 2, ru: 2, ua: 2, gr: 2, dk: 2, ch: 2, pl: 2, ro: 2, wa: 2 },
  ecl: { en: 1, es: 1, de: 1, it: 1, fr: 1, pt: 2, tr: 2, sc: 3, ru: 2, ua: 2, gr: 3, dk: 3, ch: 3, pl: 3, ro: 3, wa: 1 },
};

/** Ülke liginin dünya sahnesindeki görünürlüğü (Altın Top, ün kazanımı). Türkiye Süper Lig = 0.85 */
export const COUNTRY_PRESTIGE = {
  en: 1.25, es: 1.2, de: 1.15, it: 1.15, fr: 1.05, pt: 0.9, tr: 0.85, br: 0.8, ar: 0.75, sa: 0.7, ru: 0.7, ua: 0.65,
  sc: 0.6, gr: 0.6, ch: 0.6, dk: 0.6, us: 0.6, pl: 0.55, jp: 0.55, kr: 0.55, ro: 0.5, cn: 0.5, eg: 0.45, ma: 0.45,
  za: 0.4, ca: 0.4, ng: 0.35, wa: 0.3,
};

/**
 * Ek kurgusal kasaba adları için hece/sözcük parçaları: [önekler, sonekler, ayraç].
 * Gerçek takım sayılarına geçince alt liglerde çok daha fazla kulüp var; adlar bu parçalardan tohumlu üretilir.
 * Sonek boşlukla başlıyorsa iki sözcüklü ad olur ("Silver Springs").
 */
export const TOWN_PARTS = {
  tr: [L('Kara,Ak,Yeşil,Sarı,Kızıl,Gök,Demir,Altın,Çam,Taş,Kum,Ilıca,Yayla,Dere,Göl,Bağ,Kaya,Elma,Ceviz,İnci,Kır,Yaz,Gül,Karaca,Çınar,Söğüt,Ardıç,Kavak,Meşe,Değirmen'), L('köy,dere,pınar,ova,tepe,yurt,kent,hisar,kale,çay,bel,yaka,ören,alan,oba,bük,burun,yazı,gözü,çeşme,dağ,yamaç,koru,lı'), ''],
  en: [L('Ash,Black,King,Harrow,Elm,North,Red,Stone,West,Thorn,Marl,Wynd,Raven,Castle,Grey,Oak,Fair,Holl,Ell,Tide,Low,Salt,Whit,Bracken,Brook,Cold,Market,Long,Shep,Wold'), L('combe,mere,bridge,by,stead,wold,cliffe,bury,field,ford,ham,worth,brook,water,hurst,haven,mouth,marsh,vale,ton,ley,wick,thorpe,minster,well,borough'), ''],
  es: [L('Villa,Monte,Torre,Fuente,Roca,Valde,Castro,Campo,Alba,Peña,Sierra,Cala,Mira,Navas,Riba,Soto,Alde,Bena,Cerro,Vega,Lora'), L('rrubia,luz,nueva,mayor,verde,blanca,flores,sol,mar,real,seca,fría,hermosa,alta,dorada,clara,roja,serena,brava,fresno,pinar'), ''],
  de: [L('Eichen,Falken,Wald,Hohen,Sonnen,Kronen,Linden,Adler,Grün,Moos,Oster,Rosen,Tann,Weiß,Ulmen,Burg,Kalten,See,Hirsch,Brücken,Alt,Nord,Elb,Schwarz,Birken,Fichten'), L('brück,stadt,brunn,wart,feld,burg,au,horst,walde,bach,mark,thal,heim,stein,hof,wald,hausen,dorf,berg,ingen,hagen,rode'), ''],
  it: [L('Val,Castel,Monte,Rocca,Torre,Fiume,Colle,Lago,Borgo,Villa,Riva,Poggio,Campo,Selva,Fonte,Porto,Acqua,Ripa,Prato'), L('monte,rocca,alto,verde,bianca,fiore,bella,nero,lungo,chiaro,sole,franco,mare,piano,luce,ombrosa,secca,rosa,dorato,vecchio'), ''],
  fr: [L('Beau,Mont,Saint-,Roche,Ville,Clair,Pont,Bel,Font,Castel,Mire,Champ,Port-,Val,Bois,Bourg,Neuf'), L('vallon,clair,maure,rande,marais,aven,castel,lieu,mont,rieux,vieil,orne,drange,vaux,saurin,brise,court,ville,fort,val,pré,lac'), ''],
  pt: [L('Vila,Monte,Ribeira,Serra,Castelo,Pinhal,Torre,Vale,Porto,Rio,Aldeia,Fonte,Lagoa,Barro,Alto'), L(' Verde, do Mar, do Sol, da Serra, dos Pinhos, de Baixo, de Cima, do Vale, da Ponte, das Flores, Grande, da Luz, do Norte, do Sul, de Ouro'), ''],
  sc: [L('Glen,Kil,Strath,Inver,Dun,Ard,Loch,Bal,Craig,Kirk,Ross,Auch,Fenn,Lis,Torr,Carn,Drum,Blair,Kin,Muir,Ben,Tullie'), L('more,brannan,loch,brae,marrow,craig,aven,lindrum,muir,haven,lyth,mere,terlee,carra,och,morran,bay,moor,lithe,gowan,ross,kenny,ford'), ''],
  wa: [L('Aber,Pen,Caer,Llan,Bryn,Pont,Cwm,Glyn,Rhos,Dinas,Cefn,Hafod,Rhyd,Porth,Tre,Nant,Maes,Coed,Bettws,Ystrad'), L('felin,hallow,wyn,deryn,garth,rhys,dewi,hafod,goch,rhos,llyn,cader,coed,mawr,wen,lewis,eirias,gwyn,mor,fach,gelli,du,isaf,uchaf'), ''],
  dk: [L('Bølge,Havn,Kløver,Fjord,Ravn,Ege,Bakke,Nørre,Øster,Mølle,Eng,Høj,Sand,Kilde,Bøge,Lind,Ros,Aske,Torn,Vind,Strand,Lyng,Skov,Ål'), L('by,sø,mark,holm,lund,vang,slev,holt,bro,ly,ved,have,vig,høj,hus,rup,sted,borg,bæk,løse'), ''],
  ru: [L('Severo,Volzh,Belo,Kamen,Zarech,Krasno,Novo,Ozyor,Les,Sosnov,Pribrezh,Gor,Medved,Yasno,Kedrov,Polyar,Tikho,Ugol,Rech,Step,Solnech,Ledov,Bereg,Zlato'), L('grad,sk,borsk,lipovsk,ny,noye,evo,gorsk,ovy,yarsk,ovka,ovo,insk,ovsk'), ''],
  ua: [L('Bilo,Sonyach,Krasno,Dnipro,Stepo,Liso,Pivden,Zori,Berez,Kalyn,Vyshn,Sosn,Ozer,Horod,Med,Zlato,Snizh,Dubr,Yablun,Kvit,Zelen'), L('hirsk,ne,hirka,vka,ve,ivka,ok,ove,pil,ivske,ynets,ytsia,yn'), ''],
  gr: [L('Neo,Paleo,Lefko,Aspro,Megalo,Mikro,Kryo,Petro,Kalo,Ampelo,Elaio,Dafno,Pefko,Mylo,Kastro,Limno,Astero,Thalasso,Litho,Agio'), L('chori,polis,kampos,nas,kastro,neri,vrysi,petra,lofos,limani,potamos,pyrgos,longos,thea'), ''],
  ro: [L('Valea,Lunca,Poiana,Piatra,Câmpia,Fântâna,Movila,Cetatea,Dumbrava,Livada'), L(' Verde, Mare, Albă, Nouă, Lungă, Rece, Roșie, Neagră, Înaltă, Seacă, Frumoasă, Dulce'), ''],
  ch: [L('Berg,See,Alpen,Rhein,Sonn,Tal,Stein,Matten,Grün,Hoch,Bach,Föhn,Edel,Rot,Silber,Wald,Linden,Mühle'), L('dorf,wald,rath,egg,matt,wil,ach,hof,au,fluh,feld,tal,see,horn,ikon,bach,berg,stetten'), ''],
  pl: [L('Biało,Zielono,Srebrno,Wiśnio,Dębo,Lipo,Boro,Złoto,Kamieno,Brzego,Leśno,Orzecho,Grabo,Modrzewio,Wierzbo,Bursztyno,Stawo,Olszy,Topolo,Krzemieno'), L('góra,wola,wiec,pole,gaj,lin,brzeg,dół,las,ka,no,sko,wo,niec'), ''],
  cn: [L('Jin,Long,Bai,Qing,Hua,Xiang,Yun,Hai,Tai,Lan,Feng,Ling,Dong,Nan,Ping,Chun,Ming,Song,Yu,He,Tian,Wu,Lu,Shuang,An,Fu'), L('shan,he,yang,ling,feng,cheng,shui,jiang,hu,xi,quan,men,zhou,tai,gang,an,ping,ning,yuan,lin,tang'), ''],
  sa: [L('Wadi,Ain,Ras,Jabal,Bir,Umm,Dar,Qasr,Tal,Khor,Nakheel,Rawd'), L(' Qamar, Shams, Nour, Badr, Safa, Marjan, Ward, Yasmin, Fajr, Najm, Hilal, Rimal, Sahra, Majd, Wafa, Thuraya, Sahil, Raha, Diyar'), ''],
  jp: [L('Asahi,Minami,Kuro,Higashi,Taka,Nishi,Midori,Hoshi,Kita,Umi,Yama,Sakura,Aka,Hana,Kaze,Mizu,Kiri,Hino,Ama,Shio,Kiyo,Momo,Shira,Ao,Kawa,Ishi,Matsu'), L('gawa,sawa,saki,no,mine,hara,gaoka,zora,hama,machi,buki,gi,gane,zono,sato,mura,oka,yama,shima,ta,kubo,dai,mori,ura'), ''],
  kr: [L('Han,Dae,Seo,Cheong,Hae,Mi,Gang,Sae,Bit,Nam,Yeong,Geum,Baek,Sin,O,Ga,Nu,Da,Byeol,Hwa,Jin,Song,Dong,Ok'), L('bit,san,rim,eun,rae,byeon,byeok,garam,do,gang,neul,seong,hak,ri,sol,reum,mul,chon,dong,ju,pyeong,cheon,po,gok'), ''],
  za: [L('Kwa,Sun,Gold,Thorn,High,Blue,Iron,Lion,Kloof,Sea,Umh,Masi,Ilan,Sond,Malu,Karoo,Protea,Riet,Wit,Bosch,Doring'), L('vale,ridge,veld,gum,wood,park,rand,view,lali,weni,nele,zakhe,ela,fontein,kop,dal,spruit,berg,stad'), ''],
  eg: [L('Kafr,Mit,Ezbet,Beni,Tel,Deir,Nag,Sidi,Minyet,Gezira,Abu,Kom,Shubra,Sahel,Bahr'), L(' Salam, Nour, Hadi, Gamal, Fayrouz, Nakheel, Sabah, Rahma, Amal, Khair, Fath, Zahra, Bahar, Nasr, Saada, Hana'), ''],
  ng: [L('Ogbo,Iki,Ije,Ondo,Nsu,Awka,Loko,Maku,Bau,Gom,Cala,Uyo,Asa,Owe,Umu,Min,Soko,Kat,Zari,Ile,Ilo,Oso,Ada,Ibi'), L('moso,re,bu,kka,ja,rdi,chi,be,la,ri,sa,gbo,ko,de,mi,shi,nna,wa,ta,dun'), ''],
  ma: [L('Ait,Sidi,Ain,Oued,Douar,Tizi,Bni,Ras,Dar,Ksar,Souk,Bab'), L(' Ourika, Atlas, Zitoun, Ghaba, Nour, Tafilalt, Amazir, Imlil, Tazrout, Aghbal, Lalla, Oumnas, Tinmel, Assif, Agdal, Tamri'), ''],
  br: [L('Vila,Monte,Serra,Porto,Campo,Lagoa,Pedra,Ribeirão,Morro,Vale,Barra,Cachoeira,Ponte,Rio,Alto'), L(' Verde, do Sul, do Norte, dos Ventos, da Mata, do Sertão, das Palmeiras, do Cerrado, Grande, da Serra, do Mar, das Pedras, dos Coqueiros, da Prata'), ''],
  ar: [L('Villa,Puerto,Cerro,Laguna,Pampa,Bahía,Cañada,Sierra,Valle,Colonia,Arroyo,Paso,Monte,Loma'), L(' Esperanza, del Sur, del Norte, Grande, Alegre, Verde, de Oro, de Piedra, del Valle, de los Lobos, del Sol, Azul, de la Cruz, del Plata'), ''],
  us: [L('Silver,Redwood,Iron,Lake,Pine,Blue,Stone,Eagle,Copper,Golden,Harbor,River,Prairie,Canyon,Bay,High,Twin,Granite,Oak,Bridge,Mesa,Lone,Sun,Cedar,Maple,Clear,Fox,Elk,Bear,Cotton'), L(' Springs,water,field,ridge,view,crest,point,brook,ville,ton,dale,port,haven,wood,falls,grove,ford, Hills, Valley, Creek, Bluff'), ''],
  ca: [L('Maple,North,Pine,Lake,Cedar,Glacier,Hudson,Prairie,Timber,Aurora,Bear,Silver,Fort,Wester,King,Red,Iceberg,Caribou,Spruce,Beaver,Elk,Moose'), L(' Bay,shore,crest,head,brook, Point, Ridge,line, Falls, Creek,birch,port,river,lake, Hollow,field,ton, Harbour'), ''],
};
