// SİYAH SHOW — maç önü ve devre arası televizyon programı (kurgusal kadro, parodi).
//   Sunucu Kaan masayı yönetir. Eski Hakem Rıza ile Gazeteci Nevzat futbol dışı her şeyi konuşur, arada
//   kurgusal sponsor Dürüm Usta'nın tavuk döner reklamını yapar. Sermet Hoca her fırsatta Bursa frikiğini
//   anlatır; "Ronaldo mu sen mi?" sorusuna cevabı hep aynıdır. Taktik Hoca Cemil gerçekten futbol konuşmak
//   ister (Total Futbol, yarım alan, gegenpres…) ama sözü her seferinde kesilir.
//   Gerçek kişiler kullanılmaz; karakterler yorum programlarının tanıdık tiplerinden esinlenmiş parodilerdir.
//   Son programlarda geçen replikler (recent) tekrar seçilmez; havuz bitince yeniden başlar.
import { seeded } from './rng.js';

export const CAST = {
  host: { name: 'Kaan', role: 'Sunucu' },
  riza: { name: 'Eski Hakem Rıza', role: 'Yorumcu' },
  nevzat: { name: 'Gazeteci Nevzat', role: 'Yorumcu' },
  sermet: { name: 'Sermet Hoca', role: 'Eski 10 numara' },
  cemil: { name: 'Taktik Hoca Cemil', role: 'Teknik analiz' },
};

const POOL = {
  hostPre: [
    'Siyah Show\'da iyi akşamlar! Bu akşam {home} ile {away} karşı karşıya. Masada her zamanki gibi kalabalığız!',
    'Ve yayındayız! Siyah Show maç önü özel: {home} – {away}. Önce değerli hocalarımız…',
    'Hoş geldiniz! Stat doldu, stüdyo doldu, dürümler geldi. {home} – {away} öncesi Siyah Show başlıyor!',
    'İyi akşamlar sevgili seyirciler! {home} – {away} maçına dakikalar kala Siyah Show sizinle.',
    'Kameralar hazır, hocalar hazır, çaylar soğumadan başlayalım: {home} – {away}!',
    'Siyah Show\'a hoş geldiniz! Bu akşam herkesin konuştuğu maç: {home} – {away}.',
  ],
  hostHt: [
    'Devre arası, skor {score}. Hocalarım, ilk yarıyı nasıl gördünüz?',
    'İlk 45 dakika bitti: {score}. Hemen yorumlara geçelim, vakit dar!',
    'Siyah Show devre arası! Tabelada {score}. Kim başlıyor?',
    'Devre arasındayız, skor {score}. On beş dakikamız var, bunu iyi kullanalım!',
    'Soyunma odasına gidildi, biz stüdyodayız. {score}! Hocalarım?',
  ],
  hostToCemil: [
    'Cemil Hocam, sizden başlayalım: maçı nasıl görüyorsunuz?',
    'Cemil Hocam, kısaca taktik tarafı?',
    'Taktik tahtası hazır, Cemil Hocam buyurun.',
    'Cemil Hocam, bu akşam kimin oyun planı ağır basar?',
    'Cemil Hocam, otuz saniyede analiz alabilir miyiz?',
  ],
  cemilPre: [
    'Bakın arkadaşlar, {my} bu maçta yarım alanları kullanırsa, Total Futbol\'un o eski prensibi, yani herkesin her yerde oynaması—',
    'Burada asıl mesele ters bek bindirmesi. Altı numara iki stoperin arasına düşerse üçlü savunmaya geçiş—',
    'Pres tetikleyicisi şu: top kanada gittiği an kenar çizgisini bir oyuncu gibi kullanıp üçüncü adamı—',
    'Şimdi tahtaya çiziyorum, bakın: sol iç koridorda üçüncü adam koşusu, sonra derinlik—',
    '{my} topa sahip olduğunda 2-3-5\'e dönüyor, kanat bekleri içeri kat ediyor ve böylece—',
    'Rakibin orta saha bloğu çok dar, o yüzden geniş oynayıp topu hızlı değiştirirsek—',
    'Duran toplarda alan savunması mı adam adama mı, işte tüm maç burada—',
    'Bakın, geçiş oyununda ilk pasın yönü her şeyi belirler; eğer {myName} ters koşu yaparsa—',
  ],
  cemilHt: [
    'İlk yarıda {my} sağ kanattan pres kurdu ama geçiş anlarında orta saha bloğunun mesafesi—',
    'Arkadaşlar bir dakika, gegenpres dediğimiz şey aslında topu kaybettiğin anki beş saniye—',
    '{myName} yarım alanda topu aldığında, ara pası için ikinci forvetin derin koşusu—',
    'İkinci yarıda bir değişiklik şart: altı numarayı stoperlerin arasına indirip—',
    'İlk yarının özeti şu: savunma çizgisi çok geride kaldı, bu da ara bölgede—',
  ],
  cemilLast: [
    'Son bir cümle: kanat bekleri içeri kat ederse—',
    'Bir saniye, sadece şu oku çizeyim, Total Futbol\'da—',
    'Ama arkadaşlar, alan savunmasında kör nokta—',
    'Hocam bir dakika, asıl kritik nokta ikinci top—',
    'Tahtayı kapatmadan söyleyeyim: rakip sol beki—',
  ],
  interrupt: [
    ['riza', 'Hocam pardon, bu sabah pazara gittim, domatesin kilosu ne olmuş biliyor musunuz?'],
    ['nevzat', 'Cemil Hocam bir saniye, benim kayınçonun düğünü var cumartesi, salon bulamadık!'],
    ['riza', 'Bu arada dün akşam balık yedim, levrek mi çupra mı hâlâ tartışıyoruz evde.'],
    ['nevzat', 'Ya hocam bırak taktiği, arabamı yıkattım, ertesi gün yağmur! Bu şehre ne oluyor?'],
    ['riza', 'Hocam o tahtayı nereden aldınız? Benim torun da öyle bir tane istiyor.'],
    ['nevzat', 'Hocam kusura bakma da kediyi veterinere götürecektim, unuttum. Neyse, devam…'],
    ['riza', 'Cemil Hocam bir dakika, telefonum titriyor, hanım arıyor. Ekmek almamı istiyor herhalde.'],
    ['nevzat', 'Pardon pardon, stüdyonun kliması mı bozuk? Ben üşüdüm, siz üşümediniz mi?'],
    ['riza', 'Hocam bu kravat yeni mi? Çok yakışmış, nereden aldınız?'],
    ['nevzat', 'Bir saniye Cemil Hoca, dürümüm soğuyor. Kusura bakmayın, bir ısırık alıp dinliyorum.'],
  ],
  offTopic: [
    ['nevzat', 'Ben kırk yıllık gazeteciyim, hayatımda böyle kuru fasulye yemedim. Dün akşam bir lokanta…'],
    ['riza', 'Hakemliğimde bir maçta yağmur yağdı, şemsiyemi unuttum. O günden beri çantamda iki şemsiye var.'],
    ['nevzat', 'Kedim balkonda güvercin kovaladı, bütün apartman ayaktaydı. Neyse ki kimse düşmedi.'],
    ['riza', 'Yeni gözlük aldım, her şey çok net. Hakemlik yaparken olsaydı bu gözlük var ya…'],
    ['nevzat', 'Sabah çay ocağındaki Hüsnü Abi dedi ki: "Nevzat, bu sezon çaylar zamlanacak." Ben de inandım.'],
    ['riza', 'Dün torunumla parka gittim, salıncakta sıra bekledik. Disiplin orada başlıyor, ben söyleyeyim.'],
    ['nevzat', 'Geçen hafta balkona domates ektim. Üç tane çıktı, üçü de kırmızı kart gibi kırmızı!'],
    ['riza', 'Ben her sabah altıda kalkarım. Hakemlik bıraktım ama düdük hâlâ boynumda, eşim kızıyor.'],
    ['nevzat', 'Benim arabanın kornası bozuldu, sabah trafikte herkese el sallayarak geldim.'],
    ['riza', 'Bu akşam stüdyoya gelirken taksici beni tanıdı, "Hocam o penaltı yoktu" dedi. Yirmi yıl oldu!'],
  ],
  hostToAd: [
    'Hemen kısa bir reklam arası… Rıza Hocam, Nevzat Abi, söz sizde!',
    'Sponsorumuz bekliyor! Rıza Hocam, Nevzat Abi, buyurun.',
    'Reklamdan önce son söz yine sizin: Rıza Hocam, Nevzat Abi!',
    'Kısa bir mola veriyoruz. Ama önce sponsorumuzu ağırlayalım!',
  ],
  ad: [
    ['riza', 'Tavuk döner deyince akan sular durur! Dürüm Usta\'da lavaş çıtır, tavuk bol!'],
    ['nevzat', 'Biz bu akşam stüdyoya on iki dürüm söyledik, on üçüncüsünü de Cemil Hoca\'dan sakladık!'],
    ['riza', 'Maç gecesi menüsü: dürüm, ayran, bir de turşu. Dürüm Usta, kapında!'],
    ['nevzat', 'Acılı mı acısız mı? Dürüm Usta\'da ikisi de var. Ben ikisini birden yiyorum.'],
    ['riza', 'Hakem gibi adil porsiyon: Dürüm Usta\'da herkese aynı bol tavuk!'],
    ['nevzat', 'Devre arası on beş dakika, Dürüm Usta\'nın kuryesi on dakika. Hesabı siz yapın!'],
    ['riza', 'Dürüm Usta\'nın sosu var ya, VAR\'a gerek yok, tadı her şeyi açıklıyor!'],
  ],
  adTag: [
    'Dürüm Usta Tavuk Döner: maç gecesinin yıldızı!',
    'Dürüm Usta: çıtır lavaş, bol tavuk, bedava gülümseme!',
    'Dürüm Usta Tavuk Döner: kodu SİYAH, ayran bizden!',
  ],
  hostToSermet: [
    'Sermet Hocam, {myName} için ne dersiniz?',
    'Sermet Hocam, bu akşamın frikik ihtimali?',
    'Sermet Hocam, {my} kazanır mı?',
    'Sermet Hocam, genç oyunculara bir tavsiye?',
    'Sermet Hocam, sizce bu maçın yıldızı kim olur?',
  ],
  sermetPre: [
    'Bak evladım, ben Bursa deplasmanında otuz beş metreden frikiği doksana astım. Kaleci hâlâ topu arıyor.',
    '{myName}\'e söylüyorum: frikik ayakla değil yürekle atılır. Bursa\'da ben öyle attım.',
    'Benim Bursa frikiğim var ya, rüzgâr tersten esiyordu, top yine de döndü girdi. Yazın bunu.',
    'Gençlere tavsiyem: her gün yüz frikik. Ben Bursa\'dan önce bin tane atmıştım.',
    'Bu maçın yıldızı frikiği atan olur. Bursa\'da da öyle olmuştu, hatırlarsınız.',
    'Kaleci barajı kötü dizerse biter. Bursa\'da kaleci barajı dört kişi dizdi, ben beşinciyi buldum.',
  ],
  sermetHt: [
    'Bu ilk yarıda bir frikik olsa ben Bursa\'daki gibi atardım, maç biterdi.',
    '{myName} iyi ama frikik tekniği eksik. Bursa\'yı izlesin, kaset bende var.',
    'Benim zamanımda devre arasında soyunma odasında frikik çalışırdık. Bursa\'dan önce de öyle.',
    'Bu ilk yarı bana Bursa deplasmanını hatırlattı. Orada da ilk yarı sıkıcıydı, sonra ben frikiği attım.',
  ],
  ronaldoQ: [
    'Hocam açık konuşalım: Ronaldo mu, sen mi?',
    'Peki Sermet Hocam, Ronaldo mu siz mi?',
    'Son soru Hocam: Ronaldo mu, Sermet mi?',
    'Hocam bunu herkes merak ediyor: Ronaldo mu daha iyi frikikçi, siz mi?',
  ],
  ronaldoA: ['Ben.'],
  ronaldoAfter: [
    'Bursa\'yı izlemeyen bilmez.',
    'Sorunun cevabı belli zaten.',
    'Ben frikiği ayağımla değil, kafamla düşünürdüm.',
    'O da iyi çocuk ama Bursa\'da yoktu.',
    'Kaseti getirseydim tartışma bitmişti.',
  ],
  playerTalk: [
    ['riza', 'Bu {myName} çocuğu bizim mahallenin fırıncısının oğluna benziyor. O da çok koşardı, fırına geç kalırdı.'],
    ['nevzat', '{myName}\'in annesini tanıyorum, çok güzel sarma yapar. Futbolu da oradan geliyor bence.'],
    ['riza', '{myName} geçen hafta Chirp\'te bir şey yazmış, okumadım ama emojileri güzeldi.'],
    ['nevzat', '{myName}\'in saç modeli var ya, benim gençliğime benziyor. O zaman ben de çok yakışıklıydım.'],
    ['riza', '{myName}\'i bir kafede gördüm, çayını kendisi taşıyordu. Mütevazı çocuk, ama dürüm yemiyor, olmaz!'],
  ],
  goalTalk: [
    'Güzel gol ama Bursa\'daki benimki daha güzeldi.',
    'Bu golü ben Bursa\'da sol ayağımla atmıştım.',
    'Fena değil. Kaleci benim zamanımda olsa kurtarırdı.',
  ],
  hostClosePre: [
    'Maç başlıyor! Siyah Show\'u izlediğiniz için teşekkürler, iyi seyirler!',
    'Yayın akışı! Stada bağlanıyoruz, iyi seyirler!',
    'Hakem düdüğü çalmak üzere. Siyah Show devre arasında yine sizinle!',
  ],
  hostCloseHt: [
    'İkinci yarı başlıyor! Cemil Hocam, sizi bir sonraki programa alalım.',
    'Yayın akışı çağırıyor, stada dönüyoruz! Hocam taktik tahtasını bırakın.',
    'İkinci yarı için stada bağlanıyoruz. Maç sonunda görüşmek üzere!',
  ],
  hostCutCemil: [
    'Hocam yayın akışı! Maça gidiyoruz!',
    'Cemil Hocam çok güzel ama sürem doldu!',
    'Hocam reklama girmemiz lazım!',
    'Cemil Hocam bunu bir sonraki programda konuşalım!',
  ],
};

const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
const keyOf = (x) => (Array.isArray(x) ? x[1] : x);

/**
 * Program akışı. ctx: {phase:'pre'|'ht', home, away, my, myName, score, id, myGoals}
 * o.recent: son programlarda kullanılan replik anahtarları (tekrar seçilmez)
 * @returns {Array<{who:string, text:string, key:string, cut?:boolean, ad?:boolean, laugh?:boolean, cam?:string}>}
 */
export function showScript(ctx, o = {}) {
  const R = seeded(hash(`${ctx.id || ''}|${ctx.phase}|siyah|${(o.recent || []).length}`));
  const recent = o.recent || [];
  const avoid = new Set(recent);
  const lastUse = (x) => recent.lastIndexOf(keyOf(x));
  const pick = (a) => {
    const fresh = a.filter((x) => !avoid.has(keyOf(x)));
    // havuz tükendiyse en uzun süredir kullanılmayanlar arasından seç
    const pool = fresh.length ? fresh : [...a].sort((x, y) => lastUse(x) - lastUse(y)).slice(0, Math.max(1, Math.ceil(a.length / 2)));
    const v = pool[Math.floor(R() * pool.length)];
    avoid.add(keyOf(v));
    return v;
  };
  const v = { home: ctx.home, away: ctx.away, my: ctx.my, myName: ctx.myName, score: ctx.score || '0-0', g: ctx.myGoals || 0 };
  const L = [];
  const say = (who, text, opt = {}) => L.push({ who, text: fill(text, v), key: text, ...opt });
  const ht = ctx.phase === 'ht';
  say('host', pick(ht ? POOL.hostHt : POOL.hostPre), { cam: 'wide' });
  if (ht && ctx.myGoals > 0) {
    say('host', ctx.myGoals > 1 ? '{myName} ilk yarıda {g} gol attı! Hocalarım?' : '{myName}\'in golünü konuşalım!');
    say('sermet', pick(POOL.goalTalk), { cam: 'close' });
  }
  // Cemil denemesi 1 → sözü kesilir
  say('host', pick(POOL.hostToCemil));
  say('cemil', pick(ht ? POOL.cemilHt : POOL.cemilPre), { cut: true });
  const [iw, it] = pick(POOL.interrupt);
  say(iw, it, { cam: 'close' });
  const [ow, ot] = pick(POOL.offTopic.filter(([w]) => w !== iw));
  say(ow, ot);
  if (R() < 0.6) { const [pw, pt] = pick(POOL.playerTalk); say(pw, pt); }
  // reklam: Rıza ve Nevzat sırayla
  say('host', pick(POOL.hostToAd), { cam: 'wide' });
  const a1 = pick(POOL.ad);
  const a2 = pick(POOL.ad.filter(([w]) => w !== a1[0]));
  say(a1[0], a1[1], { ad: true });
  say(a2[0], a2[1], { ad: true });
  say('all', pick(POOL.adTag), { ad: true, tag: true });
  // Sermet ve Bursa frikiği
  say('host', pick(POOL.hostToSermet));
  say('sermet', pick(ht ? POOL.sermetHt : POOL.sermetPre), { cam: 'close' });
  say('host', pick(POOL.ronaldoQ));
  say('sermet', POOL.ronaldoA[0], { cam: 'close', ben: true });
  L.push({ who: 'all', text: '(stüdyoda kahkahalar)', key: 'laugh', laugh: true, cam: 'wide' });
  say('sermet', pick(POOL.ronaldoAfter));
  // Cemil son deneme → kapanış
  say('cemil', pick(POOL.cemilLast), { cut: true });
  say('host', pick(POOL.hostCutCemil), { cam: 'wide' });
  say('host', pick(ht ? POOL.hostCloseHt : POOL.hostClosePre));
  return L;
}

/**
 * Program bu maçta yayında mı? mode: 'auto' (büyük maçlar + maçların ~%40'ı), 'on', 'off'
 */
export function showAirs(match, phase, mode = 'auto') {
  if (mode === 'off' || !match) return false;
  if (mode === 'on') return true;
  if (match.big) return true;
  const r = seeded(hash(`${match.id}|${phase}|airs`))();
  return r < (phase === 'pre' ? 0.4 : 0.3);
}
