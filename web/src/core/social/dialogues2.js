// SOSYAL DİYALOGLAR (geniş havuz) — her buluşma farklı geçsin diye:
//  • Duruma bağlı anlar (son maç, gol, sakatlık, transfer, milli takım, hoca değişimi, kupa, hava, rakip…)
//  • Büyük genel havuz (arkadaş, takım arkadaşı, flört) + mekâna özel açılışlar ve cevap setleri
//  • Kişi başına son görülen anlar tutulur, tükenene kadar tekrar edilmez.
// Yer tutucular: {name} karşındaki, {me} oyuncu, {club} kulüp, {venue} mekân, {opp} son rakip, {score} son skor,
// {goals} sezon golü, {coach} hoca, {rival} rakip oyuncu, {month} ay, {weather} hava, {pos} sıra.

const O = (humble, deep, cocky, funny, extra = null) => [
  { tone: 'humble', text: humble },
  { tone: 'deep', text: deep },
  { tone: 'cocky', text: cocky },
  extra ? { tone: extra[0], text: extra[1] } : { tone: 'funny', text: funny },
];

/** Mekâna göre geniş açılış havuzu */
export const OPENERS2 = {
  cafe: [
    'Burası gerçekten çok güzel… Daha önce gelmiş miydin buraya?',
    'Kahveler benden, itiraz yok!',
    'Manzaraya bak, insan maçı falan unutuyor.',
    'Garson seni tanıdı galiba, iki kere baktı.',
    'Bu mekânın cheesecake\'i efsane diyorlar, deneyelim mi?',
    'Sonunda bir boş günün oldu ha! Telefonunu kapat bugün.',
    'Kahveni şekerli mi içiyorsun? Sporculara yasak değil mi o?',
    'Masayı cam kenarında ayarladım, güneş tam bize vuruyor.',
    'Az önce iki çocuk senin formanla geçti, gördün mü?',
    'Bugün havalar {weather}, iyi ki içeride oturduk.',
  ],
  bar: [
    'Müzik çok iyi bu akşam! Ne içiyorsun?',
    'Herkes sana bakıyor, farkında mısın?',
    'Uzun zamandır böyle bir gece yapmamıştık!',
    'DJ az önce {club} marşını çaldı, sana selam yolladı bence!',
    'Şu köşedeki masa boşaldı, oraya geçelim mi?',
    'Bu kalabalıkta seni kimse tanımaz sanıyordum, yanılmışım.',
    'Bugün kafanı dağıtmak lazım, hafta zor geçti ha?',
    'Barmen sana özel bir kokteyl hazırlıyormuş, alkolsüz tabii!',
  ],
  home: [
    'Evin çok güzel olmuş! Kim dekore etti?',
    'Vay, kupa dolabı da varmış!',
    'Rahat bir ev, insan hemen kendini evinde hissediyor.',
    'Ayakkabıları kapıda mı çıkarıyoruz? Halın çok beyaz!',
    'Mutfaktan güzel kokular geliyor, sen mi yaptın?',
    'Konsolu kurmuşsun, bu akşam turnuva var o zaman!',
    'Duvardaki forma çerçevesi harika olmuş.',
    'Balkondan manzara efsane, akşam burada oturalım.',
  ],
};

/** Açılışa verilen cevap setleri (mekâna göre, her seferinde biri seçilir) */
export const OPENER_SETS = {
  cafe: [
    [{ tone: 'humble', text: 'Daha önce gelmiştim, gerçekten çok iyi bir yer.' }, { tone: 'deep', text: 'Hayır, ilk kez geliyorum. Sen nasıl buldun?' }, { tone: 'cocky', text: 'Burası benim mekânım sayılır.' }, { tone: 'flirty', text: 'Seninle her yer güzel.' }],
    [{ tone: 'humble', text: 'Kahve ısmarlamana gerek yoktu, sağ ol.' }, { tone: 'funny', text: 'Kahve sende, tatlılar bende. Diyet pazartesi!' }, { tone: 'cocky', text: 'Garson beni tanıdıysa hesap belki bizden olmaz!' }, { tone: 'flirty', text: 'Kahve bahane, seni görmek istedim.' }],
    [{ tone: 'deep', text: 'Bazen böyle sakin bir yer insana iyi geliyor.' }, { tone: 'eye', text: 'Şu köşedeki çift bize bakıyor, fark ettin mi?' }, { tone: 'funny', text: 'Telefonu kapattım ama menajerim kapıda bekliyor olabilir!' }, { tone: 'humble', text: 'Boş günümü seninle geçirmek güzel.' }],
  ],
  bar: [
    [{ tone: 'humble', text: 'Maç haftası, ben sadece soda içeceğim.' }, { tone: 'funny', text: 'Kramponlarımı çıkardım, dans pistine hazırım!' }, { tone: 'cocky', text: 'Bana bakmaları normal, gol atan benim sonuçta.' }, { tone: 'flirty', text: 'Ben sadece bir kişiye bakıyorum aslında.' }],
    [{ tone: 'deep', text: 'Bu hafta gerçekten kafamı boşaltmaya ihtiyacım vardı.' }, { tone: 'funny', text: 'DJ\'e gol sevinci şarkımı istedim, bakalım çalacak mı.' }, { tone: 'cocky', text: 'VIP\'ye geçelim, beni orada bekliyorlar.' }, { tone: 'humble', text: 'Erken kalkacağım, bir saat takılıp kaçarım.' }],
    [{ tone: 'eye', text: 'Kapıdaki adam fotoğraf çekiyor, arka masaya geçelim.' }, { tone: 'funny', text: 'Alkolsüz kokteyl mi? Sporcu kaderi!' }, { tone: 'flirty', text: 'Bu ışıklar sana çok yakışmış.' }, { tone: 'cocky', text: 'Bu gece benim gecem!' }],
  ],
  home: [
    [{ tone: 'humble', text: 'Biraz kendim, biraz da internetten fikir aldım.' }, { tone: 'funny', text: 'Mimar ben değilim ama koltukları ben taşıdım!' }, { tone: 'cocky', text: 'Prim paralarının hakkını verdim diyelim.' }, { tone: 'deep', text: 'Burası benim kafamı dinlediğim tek yer.' }],
    [{ tone: 'funny', text: 'Yemeği ben yaptım, tadına bakan ilk kurban sensin!' }, { tone: 'humble', text: 'Gel otur, kendi evin gibi.' }, { tone: 'deep', text: 'Bu evi alınca ailemi düşündüm, bir gün onları da getireceğim.' }, { tone: 'cocky', text: 'Kupa dolabında daha çok yer var, doldurmaya geldim.' }],
  ],
};

/** Geniş genel havuz */
export const BEATS2 = [
  // ── Arkadaş ──
  { id: 'g_school', kinds: ['friend'], line: 'Okuldaki beden hocası seni hâlâ anlatıyormuş, "ben keşfettim" diyormuş.', options: O('Ona çok şey borçluyum, gerçekten.', 'O günleri hatırlayınca duygulanıyorum.', 'Keşfetmek kolay, ben zaten parlıyordum!', 'Beni hep kaleye koyardı, haksızlık!') },
  { id: 'g_money', kinds: ['friend'], line: 'Paran çok olunca insanlar değişiyor diyorlar. Sen değişmedin, değil mi?', options: O('Aynıyım. Sadece arabam değişti.', 'Bazen kimin gerçek dost olduğunu sorguluyorum.', 'Değiştim tabii, daha iyi oldum!', 'Değiştim, artık simit yerine iki simit yiyorum.') },
  { id: 'g_wedding', kinds: ['friend'], line: 'Bizim mahalleden eski bir arkadaşımız evleniyor, düğüne gelirsin değil mi?', options: O('Maç yoksa kesin gelirim.', 'Eski arkadaşlarla bir arada olmak çok güzel olur.', 'Gelirim ama herkes fotoğraf isteyecek, hazırlıklı olsunlar.', 'Halay başı bende, söz!') },
  { id: 'g_game', kinds: ['friend', 'teammate'], line: 'Yeni çıkan futbol oyununda senin reytingini gördün mü?', options: O('Gördüm, hak etmem lazım daha.', 'Çocukken o oyunda kendimi yaratırdım, şimdi gerçekten içindeyim.', 'Düşük vermişler! Şikâyet edeceğim.', 'Hızımı yüksek vermişler, gerçek hayatta merdivende nefes nefese kalıyorum.') },
  { id: 'g_advice', kinds: ['friend'], line: 'Benim küçük kardeş de futbolcu olmak istiyor. Ona ne tavsiye edersin?', options: O('Okulu bırakmasın, çalışmayı da bırakmasın.', 'Hayallerinden vazgeçmesin. Benim babam da başta istemedi.', 'Beni örnek alsın, yeter!', 'Ayakkabı bağlamayı öğrensin önce, ben 12 yaşına kadar bilmiyordum.') },
  { id: 'g_phone', kinds: ['friend'], line: 'Telefonun hiç susmuyor. Kim arıyor bu kadar?', options: O('Menajer, kulüp, annem… sırayla.', 'Bazen her şeyi kapatıp kaybolmak istiyorum.', 'Ünlü olmanın bedeli, kardeşim.', 'Annem. "Kazağını giydin mi" diye.') },
  { id: 'g_derby', kinds: ['friend', 'teammate'], line: 'Bu sezonun en önemli maçı hangisi sence?', options: O('Her maç önemli, sıradakine bakıyoruz.', 'Kendimi kanıtlayacağım maç, hangisi olursa.', 'Benim attığım gol hangi maçtaysa o.', 'Annemin izlemeye geldiği maç; o gün kırmızı kart yasak!') },
  { id: 'g_holiday', kinds: ['friend'], line: 'Sezon bitince tatile nereye gidiyorsun?', options: O('Önce memlekete, aileye.', 'Kafamı dinleyeceğim sessiz bir yer arıyorum.', 'Yat kiralayacağım, herkes davetli!', 'Hiçbir yere; on gün uyuyacağım.') },

  // ── Takım arkadaşı ──
  { id: 't_rookie', kinds: ['teammate'], line: 'Yeni gelen genç seni idol olarak görüyormuş, haberin var mı?', options: O('Ona elimden geldiğince yardım ederim.', 'Ben de böyleydim, bir abinin sözü çok şey değiştirir.', 'Doğru adamı seçmiş!', 'Krampon bağlamayı öğretirim, gerisi yetenek.') },
  { id: 't_tactics', kinds: ['teammate'], line: '{coach} yeni dizilişte seni farklı oynatmak istiyormuş.', options: O('Takıma nasıl faydası olacaksa öyle oynarım.', 'Yeni bir rol beni geliştirir belki.', 'Ben nerede oynasam fark yaratırım.', 'Kalede oynatmazsa sorun yok!') },
  { id: 't_fitness', kinds: ['teammate'], line: 'Kondisyoner yarın sabah ekstra koşu koymuş, sende de var.', options: O('Varım, ihtiyacım var zaten.', 'Bu koşular zor ama sezon sonunda farkını görüyorsun.', 'Ben en önde bitiririm, merak etme.', 'Yarın sabah hasta olacağım galiba… şaka şaka!') },
  { id: 't_captain', kinds: ['teammate'], line: 'Kaptanın sözleşmesi bitiyor, yeni kaptan kim olur sence?', options: O('Kıdemlilerden biri olmalı.', 'Kaptanlık bir sorumluluk, hazır olan alsın.', 'Bence kollukta benim adım yazıyor.', 'Pazubendi kim alırsa alsın, yemek ısmarlasın!') },
  { id: 't_fans', kinds: ['teammate'], line: 'Tribünler son maçta ismini haykırdı, tüylerim diken diken oldu.', options: O('Taraftarımız müthiş, onlar için oynuyoruz.', 'O an hayatımın en güzel anlarından biriydi.', 'Alışsınlar, daha çok haykıracaklar.', 'Ben de duydum ama soyadımı yanlış söylediler!') },
  { id: 't_away', kinds: ['teammate'], line: 'Deplasman otobüsünde müziği kim seçecek bu sefer?', options: O('Ben karışmam, kaptan seçsin.', 'Sakin bir şeyler olsun, maça odaklanalım.', 'Benim listem tabii, en iyi o.', 'Kaleci seçerse yine arabesk çalacak!') },
  { id: 't_rival', kinds: ['teammate'], line: '{rival} yine manşetlerde. Senin rakibin gibi yazıyorlar.', options: O('Herkesin kendi yolu var, ben kendime bakarım.', 'Rekabet iyidir, beni daha çok çalıştırır.', 'Rakip mi? Benim seviyemde değil.', 'Onunla rakip değiliz, sadece aynı saç kremini kullanıyoruz.') },
  { id: 't_injury', kinds: ['teammate'], line: 'Sağlık ekibi bu hafta herkesi kas testine soktu. Senin değerlerin nasıl çıktı?', options: O('İyi çıktı, ama dikkat etmem lazım.', 'Vücudumu dinlemeyi yeni yeni öğreniyorum.', 'Makine gibi, test cihazı şaşırdı.', 'Doktor "sende kas var mı" diye sordu, kırıldım.') },

  // ── Flört ──
  { id: 'r_firstdate', kinds: ['romance'], line: 'İlk buluşmamızda çok gergindin, hatırlıyor musun?', options: O('Penaltıdan daha zordu, inan.', 'O gün bir şeylerin değişeceğini hissetmiştim.', 'Gergin miydim? Hiç hatırlamıyorum!', 'Kahveyi gömleğime dökmüştüm, unutmak mümkün mü?', ['flirty', 'Hâlâ gerginim aslında, sen yanımdayken.']) },
  { id: 'r_cook', kinds: ['romance'], venues: ['home', 'cafe'], line: 'Yemek yapmayı biliyor musun, yoksa hep dışarıda mı?', options: O('Makarna ve menemen, ustasıyım.', 'Annemin tariflerini öğrenmeye çalışıyorum.', 'Diyetisyenim yapıyor, ben şef gibi tadıyorum.', 'Suyu bile yakarım, dürüst olayım.', ['flirty', 'Senin için bir şey denerim, söz.']) },
  { id: 'r_jealous', kinds: ['romance'], line: 'Sosyal medyada sana yazan çok kişi var. Kıskanmalı mıyım?', options: O('Mesajlara hiç bakmıyorum bile.', 'Benim için önemli olan bu masadaki kişi.', 'Ünlüyüm, bu doğal.', 'Çoğu teyzeler, "evlen artık" diyorlar.', ['flirty', 'Sen dışında kimseyi görmüyorum.']) },
  { id: 'r_movie', kinds: ['romance'], venues: ['home', 'cafe'], line: 'En son hangi filmi izledin?', options: O('Belgesel izledim, eski bir futbolcunun hayatı.', 'Ağlatan bir film, kimseye söyleme.', 'Kendi maç özetlerimi izliyorum, en iyi film o.', 'Kampta korku filmi izledik, kaleci uyuyamadı.', ['flirty', 'Bir sonrakini seninle izlemek isterim.']) },
  { id: 'r_travel', kinds: ['romance'], line: 'Hayalindeki tatil nasıl bir yer?', options: O('Sakin bir köy, deniz ve kitap.', 'Telefonun çekmediği bir dağ evi.', 'Lüks bir otel, her şey dahil!', 'Kampsız, antrenmansız herhangi bir yer!', ['flirty', 'Sen neredeysen orası.']) },
  { id: 'r_family', kinds: ['romance'], line: 'Ailen beni tanısa sever mi sence?', options: O('Annem hemen yemeğe davet eder.', 'Babamla ilk tanışma biraz zor olabilir, onu ben de zor ikna ettim.', 'Benimle olan herkesi severler.', 'Babam önce ofsayt kuralını soracak, hazırlan!', ['flirty', 'Benim kadar severler, emin ol.']) },
  { id: 'r_secret', kinds: ['romance'], line: 'Kimsenin bilmediği bir şeyini söyle bana.', options: O('Her maçtan önce aynı şarkıyı dinlerim.', 'Seçmelere babamdan gizli gitmiştim.', 'Aslında her şeyimi herkes biliyor, açık kitabım!', 'Örümcekten korkarım. Kimseye söyleme.', ['flirty', 'Bu akşamı çok beklediğimi.']) },
  { id: 'r_matchday', kinds: ['romance'], line: 'Maç günleri seni aramalı mıyım, yoksa rahatsız mı olursun?', options: O('Bir mesaj yeter, maçtan sonra ararım.', 'Sesini duymak beni sakinleştirir aslında.', 'Ara, ben baskı altında daha iyi oynarım.', 'Ara ama gol atarsam ilk seni ararım!', ['flirty', 'Her gol sevincimi sana yapacağım.']) },
  { id: 'r_dance', kinds: ['romance'], venues: ['bar'], line: 'Şu çifte bak, nasıl dans ediyorlar! Biz de yapalım mı?', options: O('Ayağına basarsam affet.', 'Bu şarkı bize çok yakışıyor.', 'Pistin en iyisi biz oluruz.', 'Gol sevinci dansımı yaparsam güvenlik çıkarır bizi.', ['flirty', 'Seninle her şarkıya varım.']) },
  { id: 'r_stars', kinds: ['romance'], venues: ['home', 'bar'], line: 'Balkondan yıldızlar ne güzel görünüyor bu gece…', options: O('Şehrin ışıklarından zor görünüyor ama güzel.', 'Çocukken yıldızlara bakıp futbolcu olmayı dilerdim.', 'Ben de yıldızım ama sahada.', 'Şuradaki yıldız bence uçak, iniş yapıyor.', ['flirty', 'Benim için en parlak olan yanımda.']) },
];

/**
 * Duruma bağlı anlar: when(ctx) doğruysa havuza girer (öncelikli).
 * ctx: {last:{res,score,opp,goals}, injured, offers, national, coachNew, cup, winter, rival, form, fame}
 */
export const CONTEXT_BEATS = [
  { id: 'c_goal', kinds: ['friend', 'teammate', 'romance'], when: (c) => c.last?.goals > 0, line: '{opp} maçındaki golünü kaç kere izledim bilmiyorum!', options: O('Takımın golüydü, ben son dokunuşu yaptım.', 'O an her şeyin karşılığını aldım gibi hissettim.', 'Kolay goldü, daha güzelleri gelecek.', 'Sevinçte ayağım kaydı, onu kesmişler neyse ki!', ['flirty', 'O golü sana armağan etmiştim aslında.']) },
  { id: 'c_win', kinds: ['friend', 'teammate'], when: (c) => c.last?.res === 'W' && !c.last?.goals, line: 'Son maçı {score} kazandınız, bütün mahalle kutladı!', options: O('Takım çok iyi oynadı.', 'Böyle anlar için oynuyorum.', 'Benim olduğum takım kazanır.', 'Kutlamaya ben de gelecektim, uyuyakalmışım.') },
  { id: 'c_loss', kinds: ['friend', 'teammate', 'romance'], when: (c) => c.last?.res === 'L', line: '{opp} maçı kötü geçti… İyi misin?', options: O('Toparlanacağız, bir maç her şey değil.', 'Açıkçası hâlâ kafamda dönüyor.', 'Hakem yüzünden kaybettik, net.', 'Moralim bozuk ama bu tatlı iyi geldi.', ['flirty', 'Seni görünce hepsi unutuldu.']) },
  { id: 'c_injury', kinds: ['friend', 'teammate', 'romance'], when: (c) => c.injured, line: 'Sakatlığın nasıl? Topallamıyorsun ama iyi misin?', options: O('Fizyoterapistler harika, iyiye gidiyor.', 'Sahadan uzak kalmak zihnen çok zor.', 'Bir haftaya sahadayım, kimse beni durduramaz.', 'Buz torbasıyla aramızda bir ilişki başladı.') },
  { id: 'c_offers', kinds: ['friend', 'teammate', 'romance'], when: (c) => c.offers, line: 'Gazeteler teklif aldığını yazıyor. Doğru mu?', options: O('Önce kulübümle konuşacağım.', 'Doğru karar vermek istiyorum, kafam karışık.', 'Herkes beni istiyor, normal.', 'Teklif var ama en iyisi annemin dolması.') },
  { id: 'c_national', kinds: ['friend', 'teammate', 'romance'], when: (c) => c.national, line: 'Milli takım formasıyla seni görmek inanılmazdı!', options: O('Ay-yıldızlı forma çok ağır, gurur verici.', 'Marşta gözlerim doldu, saklamayacağım.', 'Daha bir sürü maça çıkacağım.', 'Kampta oda arkadaşım horluyordu, uyuyamadım!') },
  { id: 'c_coach', kinds: ['friend', 'teammate'], when: (c) => c.coachNew, line: 'Yeni hoca {coach} nasıl biri? Disiplinli diyorlar.', options: O('Ondan öğrenecek çok şey var.', 'Kendimi baştan kanıtlamam lazım.', 'Beni görünce sevecek, merak etme.', 'Disiplin derken ilk gün tatlıyı yasakladı!') },
  { id: 'c_cup', kinds: ['friend', 'teammate'], when: (c) => c.cup, line: 'Kupada yolunuz uzun görünüyor. Final hayali var mı?', options: O('Tur tur gidiyoruz.', 'Kupa kaldırmak çocukluk hayalim.', 'Kupayı müzeye koyacağız.', 'Kupayı kaldırırsak ilk ben içinden su içeceğim.') },
  { id: 'c_winter', kinds: ['friend', 'teammate', 'romance'], when: (c) => c.winter, line: 'Bu {month} soğuğunda antrenman yapmak zor olmalı.', options: O('Alışıyoruz, ısınma uzun sürüyor.', 'Kar yağarken top oynamak çocukluğumu hatırlatıyor.', 'Soğuk beni durduramaz.', 'Eldivenle ayakkabı bağlamaya çalıştım, olmadı.') },
  { id: 'c_bench', kinds: ['friend', 'teammate'], when: (c) => c.bench, line: 'Son maçlarda kenarda kaldın. Hoca ne diyor?', options: O('Sabırlı olacağım, sıram gelecek.', 'Kendime dürüst olmam lazım, daha çok çalışmalıyım.', 'Hoca yanlış yapıyor, net.', 'Kulübede en iyi çekirdek çitleyen benim.') },
  { id: 'c_fame', kinds: ['friend', 'romance'], when: (c) => c.fame >= 50, line: 'Billboardlarda yüzünü görmek garip. Nasıl hissettiriyor?', options: O('Hâlâ alışamadım açıkçası.', 'Bazen o yüz bana yabancı geliyor.', 'Bence daha büyük olmalıydı!', 'Sivilcemi photoshoplamışlar, minnettarım.') },
  { id: 'c_rival', kinds: ['friend', 'teammate'], when: (c) => !!c.rival, line: '{rival} geçen hafta yine gol atmış. Seninle kıyaslıyorlar.', options: O('Herkes kendi yolunda.', 'Kıyaslanmak beni hırslandırıyor.', 'Kıyas bile kabul etmem.', 'Kıyaslasınlar, saçım daha güzel.') },
  { id: 'c_snowmatch', kinds: ['friend', 'teammate'], when: (c) => c.last?.weather === 'snow', line: 'Karlı maçta turuncu topla oynamak nasıldı?', options: O('Zemin çok zordu ama keyifliydi.', 'Çocukluğumda mahallede karda oynardık, aynı his.', 'Kar bana yarıyor.', 'Topu karın içinde iki kere kaybettim.') },
];

/** Geniş tepki havuzu */
export const REACTIONS2 = {
  friend: {
    positive: ['Hah! İşte benim tanıdığım {me}!', 'Seninle konuşmak hep iyi geliyor.', 'Bunu duymak güzel, kardeşim.', 'Değişmemişsin, buna sevindim.', 'Bu yüzden seni seviyoruz işte!', 'Gel sarılayım, özlemişim.', 'Haha! Aynı eski {me}.', 'Mahalle seninle gurur duyuyor.'],
    neutral: ['Hmm, olabilir.', 'Anladım.', 'Peki, sen bilirsin.', 'Öyle mi diyorsun…', 'Neyse, konu değişsin.', 'Hı hı.', 'Belki de haklısın.'],
    negative: ['Ünlü oldun diye değişme ama…', 'Biraz havalara girmişsin gibi.', 'Bu biraz kırıcı oldu.', 'Eskiden böyle konuşmazdın.', 'Tamam, anlaşıldı.', 'Hmm… bunu beklemiyordum senden.'],
  },
  teammate: {
    positive: ['Takımın kalbi sensin, biliyorsun değil mi?', 'Hah! Soyunma odasında anlatacağım bunu.', 'Seninle aynı formayı giymek gurur.', 'İşte kaptan lafı!', 'Bu enerjiyi sahaya taşı, yeter.', 'Haklısın, takım olarak büyüyoruz.', 'Sende liderlik var, biliyor musun?'],
    neutral: ['Neyse, idmanda görüşürüz.', 'Olabilir…', 'Bakalım.', 'Hoca ne der bilmem.', 'Peki.', 'Sen bilirsin.'],
    negative: ['Bunu kaptana söyleme bence.', 'Biraz fazla kaptırmışsın.', 'Takım oyunu, unutma.', 'Soyunma odasında böyle konuşma.', 'Bu laflar ortamı bozar.'],
  },
  romance: {
    positive: ['Bunu duymak çok hoş… 😊', 'Seni tanıdıkça daha çok hoşlanıyorum.', 'İyi ki bu akşam buradayız.', 'Gülüşün çok güzel, biliyor musun?', 'Böyle anları seviyorum.', 'Sen hep böyle misin? 😊', 'Kalbim biraz hızlandı galiba.'],
    neutral: ['Hmm, ilginç.', 'Öyle mi?', 'Anlıyorum.', 'Peki…', 'Bunu düşünmem lazım.', 'Haha, olabilir.'],
    negative: ['Bu biraz fazla oldu galiba.', 'Hmm… bunu beklemiyordum.', 'Konuyu değiştirelim mi?', 'Biraz kendini beğenmiş gibi oldu.', 'Bunu şaka kabul ediyorum…'],
  },
};

/** Geniş kapanış havuzu */
export const CLOSERS2 = {
  positive: ['Harika bir akşamdı, yine yapalım!', 'Bunu sık sık yapmalıyız.', 'İyi ki geldin.', 'Bugün çok güldüm, sağ ol.', 'Bir dahaki sefere ben ısmarlıyorum!', 'Maçını tribünden izleyeceğim, söz.', 'Kendine iyi bak, haberleşelim.'],
  neutral: ['Güzeldi, görüşürüz.', 'Hadi bakalım, iyi geceler.', 'Kendine iyi bak.', 'Yarın idmanın var, erken yat.', 'Görüşürüz, maçta başarılar.'],
  negative: ['Biraz yorgunum, kalkayım ben.', 'Neyse… sonra konuşuruz.', 'Bir dahakine belki.', 'Benim gitmem lazım.', 'Hesabı ödeyip kalkıyorum.'],
};
