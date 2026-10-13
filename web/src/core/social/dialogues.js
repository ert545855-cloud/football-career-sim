// SOSYAL DİYALOGLAR — buluşmalarda karşındakinin sözü ve 4 cevap seçeneği.
// Her seçeneğin bir üslubu (tone) var; karşındakinin kişiliği bazı üslupları sever, bazılarını sevmez.
// Yer tutucular: {name} karşındaki, {me} oyuncunun adı, {club} kulüp, {venue} mekân.

/** @typedef {{tone:string, text:string}} Option */
/** @typedef {{id:string, kinds:string[], venues?:string[], line:string, options:Option[]}} Beat */

/** Açılış cümleleri (mekâna göre) */
export const OPENERS = {
  cafe: ['Burası gerçekten çok güzel… Daha önce gelmiş miydin buraya?', 'Kahveler benden, itiraz yok!', 'Manzaraya bak, insan maçı falan unutuyor.'],
  bar: ['Müzik çok iyi bu akşam! Ne içiyorsun?', 'Herkes sana bakıyor, farkında mısın?', 'Uzun zamandır böyle bir gece yapmamıştık!'],
  home: ['Evin çok güzel olmuş! Kim dekore etti?', 'Vay, kupa dolabı da varmış!', 'Rahat bir ev, insan hemen kendini evinde hissediyor.'],
};

/** Açılışa verilen 4 cevap (mekâna göre; görseldeki örnekteki gibi) */
export const OPENER_OPTIONS = {
  cafe: [
    { tone: 'humble', text: 'Daha önce gelmiştim, gerçekten çok iyi bir yer.' },
    { tone: 'deep', text: 'Hayır, ilk kez geliyorum. Sen nasıl buldun?' },
    { tone: 'cocky', text: 'Evet, sık sık geliyorum. Burası benim mekânım sayılır.' },
    { tone: 'flirty', text: 'Seninle her yer güzel.' },
  ],
  bar: [
    { tone: 'humble', text: 'Maç haftası, ben sadece soda içeceğim.' },
    { tone: 'funny', text: 'Kramponlarımı çıkardım, dans pistine hazırım!' },
    { tone: 'cocky', text: 'Bana bakmaları normal, gol atan benim sonuçta.' },
    { tone: 'flirty', text: 'Ben sadece bir kişiye bakıyorum aslında.' },
  ],
  home: [
    { tone: 'humble', text: 'Biraz kendim, biraz da internetten fikir aldım.' },
    { tone: 'funny', text: 'Mimar ben değilim ama koltukları ben taşıdım!' },
    { tone: 'cocky', text: 'Prim paralarının hakkını verdim diyelim.' },
    { tone: 'deep', text: 'Burası benim kafamı dinlediğim tek yer.' },
  ],
};

/** @type {Beat[]} */
export const BEATS = [
  // ── Arkadaş / takım arkadaşı ──
  {
    id: 'f_pressure', kinds: ['friend', 'teammate'],
    line: 'Son maçlarda üstünde çok baskı var gibi. Nasıl gidiyor gerçekten?',
    options: [
      { tone: 'deep', text: 'Açıkçası zorlanıyorum. Konuşmak iyi geldi.' },
      { tone: 'humble', text: 'Takım iyi oldukça ben de iyiyim.' },
      { tone: 'cocky', text: 'Baskı mı? Ben baskıyı severim.' },
      { tone: 'funny', text: 'Tek baskı, annemin "yemeğini ye" baskısı.' },
    ],
  },
  {
    id: 'f_oldtimes', kinds: ['friend'],
    line: 'Mahalledeki halı saha günlerini hatırlıyor musun? Topu hep komşunun bahçesine kaçırırdın.',
    options: [
      { tone: 'funny', text: 'Teyze topu hâlâ vermedi bence!' },
      { tone: 'deep', text: 'O günler olmasa bugün burada olmazdım.' },
      { tone: 'humble', text: 'Sen kalede olmasan o golleri atamazdım.' },
      { tone: 'cocky', text: 'Yeteneğim o zamandan belliydi zaten.' },
    ],
  },
  {
    id: 'f_coach', kinds: ['teammate'],
    line: 'Hoca bu hafta antrenmanda seni çok övdü. Bizim yaşlılar kıskandı!',
    options: [
      { tone: 'humble', text: 'Sizin sayenizde. Her gün sizden öğreniyorum.' },
      { tone: 'funny', text: 'Kıskanmasınlar, ben de onların dizlerini kıskanıyorum.' },
      { tone: 'cocky', text: 'Hak ettiğim övgü. Sırada kaptanlık var.' },
      { tone: 'eye', text: 'Asıl dikkat ettiğim, hocanın yeni dizilişi.' },
    ],
  },
  {
    id: 'f_transfer', kinds: ['friend', 'teammate'],
    line: 'Transfer dedikoduları dönüyor. Gidiyor musun yoksa?',
    options: [
      { tone: 'deep', text: 'Kafam karışık. Burada mutluyum ama hayallerim de var.' },
      { tone: 'humble', text: 'Önümdeki maçlara bakıyorum, gerisi menajerimin işi.' },
      { tone: 'cocky', text: 'Büyük kulüpler sıraya girdi, bakalım.' },
      { tone: 'funny', text: 'Sadece bu masadan kalkıp tuvalete transfer oluyorum.' },
    ],
  },
  {
    id: 'f_party', kinds: ['friend', 'teammate'], venues: ['bar', 'home'],
    line: 'Bu gece sabaha kadar mı? Yarın idman yok sonuçta!',
    options: [
      { tone: 'humble', text: 'Gece yarısı ben kaçarım, vücut önemli.' },
      { tone: 'funny', text: 'Sabaha kadar ama sadece meyve suyuyla!' },
      { tone: 'cocky', text: 'Sabaha kadar! Benim kondisyonum yeter.' },
      { tone: 'deep', text: 'Asıl özlediğim böyle sohbetlerdi.' },
    ],
  },
  {
    id: 'f_family', kinds: ['friend'],
    line: 'Annen geçen gün aradı, maçlarını kaçırmıyormuş. Gururlu kadın.',
    options: [
      { tone: 'deep', text: 'Her şeyi onlar için yapıyorum aslında.' },
      { tone: 'humble', text: 'Bu hafta yemeğe gideyim bari.' },
      { tone: 'funny', text: 'Kırmızı kart görünce TV\'yi kapatıyormuş ama.' },
      { tone: 'eye', text: 'Babam hâlâ ofsaytı anlamadı ama.' },
    ],
  },
  {
    id: 't_locker', kinds: ['teammate'],
    line: 'Soyunma odasında biraz gerginlik var, fark ettin mi?',
    options: [
      { tone: 'eye', text: 'Fark ettim. Sağ bek ile stoper arasında bir şey var.' },
      { tone: 'deep', text: 'Bir yemek ayarlayalım, herkes rahatlasın.' },
      { tone: 'humble', text: 'Ben sadece işime bakıyorum, büyükler halleder.' },
      { tone: 'cocky', text: 'Gol atan rahattır, gerisi beni ilgilendirmez.' },
    ],
  },

  // ── Flört ──
  {
    id: 'r_dream', kinds: ['romance'],
    line: 'Futbol olmasaydı ne olurdun sence?',
    options: [
      { tone: 'deep', text: 'Belki öğretmen. Çocuklara bir şey öğretmek güzel olurdu.' },
      { tone: 'funny', text: 'Barista! Bak, köpükten kalp de yapabilirim.' },
      { tone: 'cocky', text: 'Futbolsuz bir ben düşünemiyorum.' },
      { tone: 'flirty', text: 'Bilmem ama şu an tam olmak istediğim yerdeyim.' },
    ],
  },
  {
    id: 'r_fame', kinds: ['romance'],
    line: 'Ünlü biriyle oturmak garip. İnsanlar dönüp bakıyor.',
    options: [
      { tone: 'humble', text: 'Ben sadece top koşturan biriyim, rahat ol.' },
      { tone: 'funny', text: 'Bence sana bakıyorlar, ben arka plandayım.' },
      { tone: 'cocky', text: 'Alışırsın, benimle bu hep böyle.' },
      { tone: 'eye', text: 'Köşedeki adam fotoğraf çekiyor, yer değiştirelim mi?' },
    ],
  },
  {
    id: 'r_work', kinds: ['romance'],
    line: 'Bugün iş çok yoğundu. Senin günün nasıl geçti?',
    options: [
      { tone: 'deep', text: 'Önce sen anlat, ne oldu bugün?' },
      { tone: 'humble', text: 'İdman, buz banyosu, video analiz… her zamanki.' },
      { tone: 'funny', text: 'Kaleciye üç tane caka sattım, iyi geçti.' },
      { tone: 'flirty', text: 'Seni görene kadar sıradan geçti.' },
    ],
  },
  {
    id: 'r_music', kinds: ['romance'], venues: ['bar', 'home'],
    line: 'Bu şarkıyı çok seviyorum! Dans eder misin?',
    options: [
      { tone: 'funny', text: 'Ayaklarım topla iyidir, dansla… bakalım!' },
      { tone: 'flirty', text: 'Seninle her şarkıya varım.' },
      { tone: 'humble', text: 'Pek beceremem ama deneyelim.' },
      { tone: 'cocky', text: 'Gol sevinci dansımı görmedin mi?' },
    ],
  },
  {
    id: 'r_future', kinds: ['romance'],
    line: 'Bir gün yurt dışında oynamak ister misin? Hiç gitmeyi düşündün mü?',
    options: [
      { tone: 'deep', text: 'İsterim ama yalnız gitmek istemem.' },
      { tone: 'eye', text: 'Önce dil kursuna başlamam lazım, İngilizcem berbat.' },
      { tone: 'cocky', text: 'Avrupa devleri beni bekliyor zaten.' },
      { tone: 'flirty', text: 'Sen gelirsen her yere giderim.' },
    ],
  },
  {
    id: 'r_hobby', kinds: ['romance'], venues: ['cafe', 'home'],
    line: 'Maç dışında neyle uğraşıyorsun? Bir hobin var mı?',
    options: [
      { tone: 'deep', text: 'Kitap okuyorum, özellikle biyografiler.' },
      { tone: 'funny', text: 'Konsolda kendimi oynuyorum, kendime hep 99 veriyorum.' },
      { tone: 'humble', text: 'Köpeğimle yürüyüş. Bir de yemek yapmayı öğreniyorum.' },
      { tone: 'eye', text: 'İnsanları izlemek. Mesela sen kahveni hep karıştırıyorsun.' },
    ],
  },
];

/** Tepkiler: positive / neutral / negative (kişiye özel yoksa bunlar) */
export const REACTIONS = {
  friend: {
    positive: ['Hah! İşte benim tanıdığım {me}!', 'Seninle konuşmak hep iyi geliyor.', 'Bunu duymak güzel, kardeşim.'],
    neutral: ['Hmm, olabilir.', 'Anladım.', 'Peki, sen bilirsin.'],
    negative: ['Ünlü oldun diye değişme ama…', 'Biraz havalara girmişsin gibi.', 'Bu biraz kırıcı oldu.'],
  },
  teammate: {
    positive: ['Takımın kalbi sensin, biliyorsun değil mi?', 'Hah! Soyunma odasında anlatacağım bunu.', 'Seninle aynı formayı giymek gurur.'],
    neutral: ['Neyse, idmanda görüşürüz.', 'Olabilir…', 'Bakalım.'],
    negative: ['Bunu kaptana söyleme bence.', 'Biraz fazla kaptırmışsın.', 'Takım oyunu, unutma.'],
  },
  romance: {
    positive: ['Bunu duymak çok hoş… 😊', 'Seni tanıdıkça daha çok hoşlanıyorum.', 'İyi ki bu akşam buradayız.'],
    neutral: ['Hmm, ilginç.', 'Öyle mi?', 'Anlıyorum.'],
    negative: ['Bu biraz fazla oldu galiba.', 'Hmm… bunu beklemiyordum.', 'Konuyu değiştirelim mi?'],
  },
};

/** Kapanış cümleleri */
export const CLOSERS = {
  positive: ['Harika bir akşamdı, yine yapalım!', 'Bunu sık sık yapmalıyız.', 'İyi ki geldin.'],
  neutral: ['Güzeldi, görüşürüz.', 'Hadi bakalım, iyi geceler.', 'Kendine iyi bak.'],
  negative: ['Biraz yorgunum, kalkayım ben.', 'Neyse… sonra konuşuruz.', 'Bir dahakine belki.'],
};
