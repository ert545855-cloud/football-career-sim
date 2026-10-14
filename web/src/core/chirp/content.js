// @ts-check
// CHIRP İÇERİK HAVUZLARI — kulüp hesabı, taraftar grupları, yorumcular, capsler, rastgele kullanıcılar
// ve zengin yorumlar. Hafif futbol argosu var; küfür yok. Tüm kişiler kurgusaldır.
// {player} {first} {club} {opp} {mate} {league} {week} gibi yer tutucular fillTemplate ile dolar.

// ─────────────────────────── Kulüp resmi hesabı ───────────────────────────
export const CLUB_LINES = {
  ready: [
    'Maça hazırız! 💪 {opp} karşısında tek hedef 3 puan. Eksiğimiz yok!',
    'Hafta {week} | Son antrenmanı tamamladık. Kadro tam, morallerimiz yüksek. Haydi {clubShort}! ⚔️',
    'Biletler tükendi, tribünler dolu! {opp} maçına hazırız. 🏟️',
    'Hocamız: "Rakibe saygı duyuyoruz ama sahaya kazanmak için çıkacağız." Maça hazırız! 🔥',
    'Formalar asıldı, kramponlar boyandı. {opp} maçı için geri sayım başladı! ⏳',
  ],
  missing: [
    '{opp} maçı öncesi son durum: {missing} sakatlıkları nedeniyle kafilede yer almıyor. Diğer oyuncularımız maça hazır. 💪',
    'Hafta {week} | {opp} maçı kadromuz açıklandı. Eksikler: {missing}. Kalanlar savaşmaya hazır!',
  ],
  derby: [
    'DERBİ GÜNÜ! 🔥 {opp} karşısında şehrin rengi belli olacak. Haydi {clubShort}!',
    'Büyük maç, büyük heyecan! {title} için her şey hazır. Tribünler, sesinizi duyalım! 📣',
  ],
  win: [
    'MAÇ SONUCU | {score} ✅ 3 puan bizim! {scorers}',
    'GALİBİYET! 👏 {score}. Taraftarımıza teşekkürler. {scorers}',
    'Üç puan, üç gülümseme! {score} 💚 {scorers}',
  ],
  draw: [
    'MAÇ SONUCU | {score}. Bir puanla dönüyoruz. {scorers}',
    'Mücadele ettik, 1 puan aldık: {score}. Önümüzdeki maçlara bakıyoruz.',
  ],
  loss: [
    'MAÇ SONUCU | {score}. Kafamızı kaldırıp önümüze bakacağız.',
    '{score}. İstediğimiz sonucu alamadık. Toparlanıp güçlü döneceğiz.',
  ],
  injury: [
    'SAĞLIK AÇIKLAMASI | {name}, {part} nedeniyle tedavi altına alınmıştır. Oyuncumuzun yaklaşık {weeks} hafta sahalardan uzak kalması bekleniyor. Geçmiş olsun {first}! 🙏',
    'Oyuncumuz {name} dünkü antrenmanda sakatlandı. Yapılan MR sonucunda {part} tespit edildi. Tahmini dönüş: {weeks} hafta. 🏥',
  ],
  welcome: [
    '🖊️ HOŞ GELDİN {name}! {age} yaşındaki {pos} {years} yıllık sözleşmeye imza attı. Forması hazır: #{number}',
    'İmzalar atıldı! ✍️ {name} artık {club} oyuncusu. Sözleşme {years} yıl. Ailemize hoş geldin! 🤝',
  ],
};
export const INJURY_PARTS = ['arka adale zorlanması', 'ayak bileği burkulması', 'kasık ağrısı', 'menisküs yırtığı', 'diz bağı zedelenmesi',
  'baldır kasında yırtık', 'omuz çıkığı', 'kaburga çatlağı', 'kas yorgunluğu', 'uyluk ön adalesinde gerilme'];

// ─────────────────────────── Taraftar grubu + Tribün Gardiyanı ───────────────────────────
export const FAN_LINES = {
  lynch: [
    '{player} bu formayı hak etmiyor! Pazartesi antrenman tesislerinde konuşacağız. 😤',
    'Yönetime sesleniyoruz: {opp} karşısında sahada yürüyen {player} derhal kulübeye!',
    'Bu ne rezalet! {player} topa bir kere düzgün vuramadı. Arma ağır, taşıyamayan gitsin!',
    '{player} yatarak oynadı. Taraftar her şeyi affeder, isteksizliği affetmez!',
  ],
  lynchBanner: ['BU FORMA TER İSTER', 'SAHADA YÜRÜYENİ AFFETMEYİZ', 'YA TER YA KADRO DIŞI', 'ARMA BÜYÜK, SEN KÜÇÜK KALDIN'],
  hype: [
    '{player} için 150 milyon dolar verseler satmayız! 💎 Bu çocuk bizim gururumuz!',
    '{opp} savunmasını darmaduman etti! KRAL {PLAYER} 👑',
    '{player} adına haftaya dev koreografi hazırlıyoruz! 🎆 Tribünler senin!',
    'Avrupa devleri sıraya girsin, {player} satılık değil! 🔒',
  ],
  hypeBanner: ['KRAL {PLAYER}', '{PLAYER} SATILIK DEĞİLDİR', '150 MİLYON DOLAR? GÜLDÜRMEYİN', 'BU ŞEHİR SENİ SEVİYOR {PLAYER}'],
  gardiyanBad: [
    'ARMA HER ŞEYDEN ÜSTÜNDÜR! {PLAYER} KENDİNE GEL! BU TRİBÜN SAHADA YÜRÜYENİ SEVMEZ!',
    'BU TAKIMDA OYNAMAK ŞEREFTİR. HAK EDEMEYEN KAPIYI BİLİR. {CLUB} BÜYÜKTÜR!',
    'YÖNETİM UYUMASIN! {OPP} KARŞISINDA ALINAN SONUÇ KABUL EDİLEMEZ!',
  ],
  gardiyanGood: [
    'BÖYLE OYUNCUYA CANIMIZ FEDA! {PLAYER} BU ARMANIN GURURUDUR! 🔥',
    'TRİBÜNLER AYAKTA! {PLAYER} {PLAYER} {PLAYER}! 📣',
    'AVRUPA DUYSUN: {PLAYER} 150 MİLYON DOLARA BİLE SATILMAZ!',
  ],
};

// ─────────────────────────── Yorumcular ───────────────────────────
export const SERMET_LINES = {
  goal: [
    'Güzel gol, eyvallah. Ama 1998\'de Bursa deplasmanında 35 metreden attığım frikiği gören bilir. O başka.',
    '{player} topa iyi vuruyor. Ben de vururdum. Bursa\'da duvarın üstünden, doksana. Hâlâ konuşuluyor.',
    'Bu çocukta bir şey var kardeşim. Ama frikik çalışsın! Ben her antrenmandan sonra 200 frikik atardım.',
    '{player} golü attı, stadyum ayağa kalktı. Benim Bursa frikiğinde de böyle olmuştu. Kaleci hâlâ topu arıyor.',
  ],
  bad: [
    '{player} bugün yoktu. Futbol basit oyun, siz zorlaştırıyorsunuz.',
    'Hocam bu takımda 10 numara yok! 10 numarasız futbol tuzsuz yemek gibi.',
    '{club} bugün top oynamadı, top kovaladı. Ben olsam devre arasında 3 değişiklik yapardım.',
  ],
  general: [
    'Bu ligde frikik atan kalmadı. Bizim zamanımızda duvar topu görünce korkardı.',
    'Ben Bursa\'da o frikiği attığımda bu çocukların çoğu doğmamıştı bile. Futbol yetenek işidir.',
    'Taktik, analiz, veri… Futbol 22 kişinin bir topun peşinden koşmasıdır kardeşim. Gerisi laf.',
    '{league:loc} bu hafta tek bir güzel pas görmedim. Pas dediğin ayağa gelir, top dediğin yere bakmaz!',
  ],
};
export const HAKEM_LINES = [
  'Pozisyon net penaltı. Temas var, rakip topu oynamıyor. VAR\'ın bunu görmemesi mümkün değil.',
  'Ofsayt değil, omuz hizası aynı. Gol geçerli sayılmalıydı.',
  'Hakem ilk sarı kartı geç çıkardı, maçın kontrolünü kaybetti.',
  'Bu pozisyonda kırmızı kart çıkmalıydı. Kural kitabı çok açık.',
  'Hakem iyi yönetti, iki kritik kararda da doğru. Tebrik ederim.',
];
export const VERI_LINES = {
  form: [
    '📊 {player} son {n} maçta {ga} gol katkısı yaptı. Ligin en formda oyuncularından biri ({posName}).',
    '📊 {player} bu sezon {apps} maçta {goals} gol, {assists} asist. Maç başına not ortalaması {avg}.',
  ],
  team: [
    '📊 {club}, ligde {pos}. sırada; son 5 maçta {form}.',
    '📊 {club} bu sezon {gf} gol attı, {ga} gol yedi.',
  ],
};
export const DEGER_LINES = [
  '📈 {player} ({age}) — güncel piyasa değeri {value}. Son haftalardaki performansıyla değeri hızla yükseliyor. Taraftarlar "{hype} bile az" diyor 😅',
  '📈 Değer güncellemesi: {player} {value}. {league:gen} en değerli oyuncuları arasına girdi.',
];

// ─────────────────────────── Capsler (mizah) ───────────────────────────
export const CAPS_LINES = [
  'Hafta {week} özeti: {loser} savunması = 🧀',
  '{player} gol atınca ben: 🕺💃\nKuponum: ❌',
  'Pazartesi sabahı {loser} taraftarı: 😶‍🌫️',
  'Hoca değişikliği 89. dakikada yapınca tribün: ⏰🤡',
  'Hakem düdüğü çalınca 40 bin kişi aynı anda: "VAR\'a gitsin!" 📺',
  '{loser} – {winner} maçında kaleciler: 🧱 / 🚪',
  'Sermet Hoca, bir maç yorumunda Bursa frikiğinden bahsetmeyince: 😳 (henüz olmadı)',
  'Kuponu {loser} yatırdı. Kupon: 🪦',
];

// ─────────────────────────── Dünya futbolu ───────────────────────────
export const DUNYA_LINES = {
  leader: [
    '{flag} {league}: Lider {leader} {pts} puanla zirvede. {crisis} ise kötü gidişini sürdürüyor; teknik direktörün koltuğu sallanıyor. 🪑',
    '{flag} {league:loc} zirve yarışı kızışıyor! {leader} ile {second} arasında {gap} puan fark var.',
  ],
  bigScore: [
    '{flag} Haftanın skoru: {home} {hg}-{ag} {away}! 🤯',
    '{flag} {league:loc} gol yağmuru: {home} {hg}-{ag} {away}',
  ],
  crisis: [
    '{flag} {club} {n} maçtır kazanamıyor. Taraftar stadı erken terk etti. Yönetim acil toplantı yapacak.',
    '{flag} {club:loc} kriz büyüyor! Teknik direktörün görevden alınması an meselesi.',
  ],
};

// ─────────────────────────── Rastgele kullanıcı gönderileri (keşfet) ───────────────────────────
export const USER_POSTS = [
  'Bu hafta {player} kesin gol atar, buraya yazıyorum {tag}',
  'Kahvem hazır, maç başlasın ☕ {tag}',
  '{club} şampiyon olmazsa saçımı kazıtacağım. Ciddiyim. {tag}',
  'Taktik defterime yeni sayfa ekledim: "Kaos 4-4-2" 📓 {tag}',
  'Arkadaşlar bu sezon {league} gerçekten çok zevkli {tag}',
  'Babam 1998\'de Bursa\'daki o frikiği canlı izlemiş, hâlâ anlatıyor 😂 {tag}',
  'Hakem bugün yine formundaydı (!) {tag}',
  'Bu {mate} denen çocuk niye oynamıyor ya, anlayan anlatsın {tag}',
  'Pazartesi sendromu + yenilgi = 🫠 {tag}',
  'Statta kaybettiğim sesimi arıyorum, bulan haber versin 📣 {tag}',
  'Kombine aldım, bu sezon her maçtayım 🎟️ {tag}',
  'Yeni forma çıkmış, para yetmiyor ama alacağım 😭 {tag}',
];
export const FOREIGN_POSTS = {
  en: ['Who is this Turkish kid?? Unreal touch {tag}', 'Turkish league is so underrated fr {tag}', 'Someone sign {player} already {tag}'],
  es: ['¿Quién es {player}? Vaya crack {tag}', 'Que venga a España ya {tag}'],
  pt: ['Que jogador é esse {player}! {tag}', 'Esse menino joga muito {tag}'],
  de: ['Was für ein Spieler, dieser {player} {tag}'],
  it: ['{player} è un fenomeno, lo vogliamo in Serie A {tag}'],
  fr: ['Quel joueur ce {player} ! {tag}'],
  ar: ['ما شاء الله {player} 🔥 {tag}'],
};

// ─────────────────────────── Trendler ───────────────────────────
export const EVERGREEN_TAGS = ['#PazartesiSendromu', '#VARNerede', '#FrikikUstası', '#HocaGitsin', '#BuSeneBizimYılımız', '#KuponYattı',
  '#TribündeyizBuGece', '#Ofsayt', '#KramponuAsıyorum', '#ŞampiyonlukYakın', '#BursaFrikiği', '#DerbiAteşi', '#Transfer', '#GolGolGol'];

// ─────────────────────────── Zengin yorum havuzları (açık etiketli) ───────────────────────────
// s: 'p' olumlu, 'n' olumsuz, 'z' nötr. Etiketler arayüzde gösterilmez; taraftar nabzı için kullanılır.
const P = (t) => ({ t, s: 'p' });
const N = (t) => ({ t, s: 'n' });
const Z = (t) => ({ t, s: 'z' });

export const RICH_COMMENTS = {
  match_good: [P('Adam yaktı geçti 🔥'), P('Kral sensin {first} 👑'), P('Bu çocuk başka beyler'), P('Yürü be {first}, kim tutar seni!'), P('Sezonun bombası geliyor 💣'),
    P('Gözlerim yaşardı, ne futbol 😭'), P('Dünya yıldızı olacak, not alın'), P('Avrupa\'ya gidecek bu, kaçırmayın izleyin'), P('Topu ayağına yapıştırıyor resmen'),
    N('Bir maçla yıldız olunmaz, sakin olun'), N('Abartmayın, rakip zaten zayıftı'), Z('Haftaya görelim bakalım'), Z('Hakem de bize çaldı ama 😅')],
  match_bad: [N('Bu ne biçim futbol kardeşim 🤦'), N('Ayakları birbirine dolandı resmen'), N('Pazar ligi oyuncusu bu'), N('Hocam bu adamı neden oynatıyorsun allasen'),
    N('Kulübede otursun biraz, kafası dinlensin'), N('Bırak futbolu, git balık tut'), N('Topu 3 metre öteye bile atamadı'), N('Maaşını hak etmiyor'),
    P('Herkesin kötü günü olur, arkandayız'), P('Sabır, genç oyuncu bu'), P('Kalkacak bu çocuk, inanıyorum 💪'), Z('Takımın tamamı kötüydü, tek suçlu o değil')],
  lineup: [Z('{mate} ilk 11\'de olmalı, başka söze gerek yok'), Z('{mate} oynamazsa maçı izlemem'), Z('Hoca {mate}\'i neden kesiyor anlamadım'),
    Z('{first} forvette, {mate} kanatta. Bitti bu iş!'), Z('{mate} kulübede çürüyor, yazık'), Z('Bence {mate} ile {first} birlikte oynamalı'),
    Z('{mate} gelsin, {mate2} kulübeye. Net.'), Z('Orta saha {mate} olmadan dönmüyor')],
  preview: [P('Hadi bakalım, 3 puan şart 💪'), P('Bu maç kazanılır, yazıyorum buraya'), Z('{opp}\'u yenmezsek sezon biter'), P('Kupon hazır: {clubShort} kazanır 😎'),
    Z('Tribünde olacağım, sesimiz yetecek mi?'), N('Hocam lütfen 4-4-2 deneme artık'), Z('Kadroda {mate} var mı?'), P('Haydi {clubShort}! 📣'), Z('Skor tahminim 2-1')],
  injury: [P('Geçmiş olsun {first} 🙏'), P('Çabuk dön kardeşim'), N('Bu sağlık ekibi değişsin artık'), N('Yine mi sakatlık? Cam adam mı bunlar'),
    N('Sezonun en kritik döneminde ya…'), P('Daha güçlü dön 💪')],
  welcome: [P('Hoş geldin {first}! 🔥'), P('Bu transferi sevdim, yönetim helal'), Z('Kim bu? Hiç duymadım'), Z('Bonservis ne kadar acaba'),
    P('Videolarını izledim, çok iyi'), P('Formanı aldım bile 😂'), N('Bu paraya bu oyuncu mu? Ayıp'), Z('Ayağı nasıl, sağ mı sol mu?')],
  europe: [P('Avrupa\'da da varız! 🌍'), Z('Bu skor ne böyle'), P('Gruptan çıkarız inşallah'), Z('Gecenin sürprizi bu'), P('Avrupa gecelerini özlemişiz 🔥'), N('Avrupa\'da rezil olduk yine')],
  table: [Z('Bu sene şampiyonluk yarışı çok zevkli'), N('Hoca gidecek bu gidişle'), Z('Lider bu sefer bırakmaz'), P('Kim tutar bunları'), N('Kriz var, kriz!'), Z('Daha çok maç var, erken konuşmayın')],
  meme: [Z('😂😂😂'), Z('Ağladım 😂'), Z('Ben de oradaydım 😭'), P('Bunu yazan efsane'), Z('Tam olarak ben'), Z('Kaydettim 😂'), Z('Admin yine döktürmüş')],
  squad_in: [P('{first} kadroda, gurur duyduk 🇹🇷'), P('Bu kadro bir şeyler yapar'), Z('Neden {mate} yok anlamadım'), P('Hoca kadroyu iyi kurmuş'), N('Kaleci tercihi yanlış bence')],
  squad_out: [N('{first} nerede?! Skandal!'), N('Bu formda {first} kadroda yok, ayıp'), Z('{first} bir dahaki sefere kesin'), N('Federasyon yine torpil yaptı')],
  sermet: [Z('Hocam yine Bursa frikiği 😂'), Z('Sermet Hoca o frikiği 25 yıldır anlatıyor'), P('Efsane hocam, haklısın'), Z('"Bizim zamanımızda" diye başlayınca bitti 😂'),
    Z('O frikik YouTube\'da var mı? Kimse bulamadı'), P('Hocam bir tane daha atar mısın 😄')],
  hakem: [Z('Net penaltı!'), P('Rıza hoca yine haklı'), N('VAR odası uyuyor'), N('Hakem maçı katletti'), Z('Penaltı değil abi, abartma')],
  lynch: [N('Haklısınız, bu böyle gitmez'), N('Kadro dışı kalsın'), P('Bu kadar da yüklenmeyin, genç çocuk'), N('Bir sezon daha böyle oynarsa gider'), P('Arkandayız {first}, takma kafana')],
  hype: [P('150 milyon az bile 😂'), P('KRAL!'), P('Satmayın sakın'), Z('Bir maçla mı 150 milyon? 😅'), P('Koreografide ben de varım 🎆'), P('Formasını aldım, adını yazdırdım')],
  value: [P('Daha çok artar bu'), Z('Bu değer az, gerçek değeri çok daha fazla'), N('Abartılmış bir değer'), Z('Satılırsa kulüp ihya olur')],
  dunya: [Z('Bu lig çok zevkli'), Z('Hoca gidiyor kesin'), P('Lider bırakmaz bu sene'), Z('Bu takımı FIFA\'da hep alırdım 😂'), N('Kriz var kriz')],
  user: [Z('😂'), P('Katılıyorum'), Z('Bence de'), N('Saçmalama'), Z('Kaydettim'), P('Efsane'), Z('Kesinlikle'), Z('Hahaha')],
  my_pos: [P('Seni seviyoruz {first} ❤️'), P('Kral konuşmuş 👑'), P('İşte bu! 🔥'), Z('Sahada da göster bunu'), P('En büyük sensin'), Z('Admin yazmış bunu 😂'), P('Formanı aldım bile')],
  my_neg: [N('Bu kadar sinirlenme kral'), Z('Haklısın ama dikkat et'), N('Önce sahada göster'), P('Arkandayız, söyle ne söyleyeceksen'), N('Bu paylaşım ceza getirir bak')],
  my_aggr: [P('Helal olsun, susmadın! 👏'), N('Ceza yiyeceksin bak'), Z('PFDK yolda 😅'), P('Sonunda biri söyledi'), N('Profesyonellik bu mu?'), Z('Ekran görüntüsünü aldım, silersin diye 😂')],
  my_lineup: [Z('Hocaya laf mı atıyorsun? 😳'), P('Haklısın, {mate} oynamalı'), N('İlk 11\'i hoca belirler kardeşim'), P('Takım arkadaşına sahip çıkıyor, adam'), Z('Soyunma odası karışacak 🍿')],
  my_ego: [P('Kral sensin zaten 👑'), N('Bu kadar kibir iyi değil'), Z('Ego tavan 😂'), N('Takım arkadaşların ne düşünür acaba'), P('Özgüven budur')],
  my_funny: [Z('😂😂😂'), Z('Admin kim bu hesabın'), P('Sosyal medyanın en iyisi'), Z('Bu ne şimdi 😂'), Z('Ekran görüntüsünü aldım')],
  me_reply: [P('@{handle} haklısın kral 👑'), P('@{handle} helal olsun 🔥'), Z('@{handle} bunu SS aldım 😂'), N('@{handle} sen önce sahada göster'), Z('@{handle} cevap verdi beyler!')],
};

/** Yabancı yorumlar: dil → [{t, s}] */
export const FOREIGN_COMMENTS = {
  en: [P('What a player! 🔥'), P('Who is this guy?? Unreal'), P('Sign him already!'), N('Overrated tbh'), Z('Turkish league is underrated fr')],
  es: [P('¡Qué jugador!'), P('Este chico es un crack'), Z('Que venga a España ya'), N('Sobrevalorado')],
  pt: [P('Que golaço!'), P('Craque demais'), P('Joga muito esse cara')],
  de: [P('Was für ein Spieler!'), P('Stark!'), Z('Ab in die Bundesliga')],
  it: [P('Che giocatore!'), P('Fenomeno'), Z('Lo vogliamo in Serie A!')],
  fr: [P('Quel joueur !'), P('Incroyable'), P('Il est trop fort')],
  ar: [P('ما شاء الله 🔥'), P('لاعب رائع'), Z('Yalla to Saudi! 🇸🇦')],
  ru: [P('Красавчик!'), P('Сильно!')],
  jp: [P('すごい！'), P('天才だ')],
  kr: [P('대박!'), P('와 미쳤다')],
  ng: [P('Na wa o! This guy too sabi'), P('Correct player!')],
};
