// SİYAH SHOW — maç önü ve devre arası televizyon programı (kurgusal kadro, parodi).
//   Sunucu Kaan masayı yönetir. Eski Hakem Rıza ile Gazeteci Nevzat futbol dışı her şeyi konuşur, arada
//   kurgusal sponsor Dürüm Usta'nın tavuk döner reklamını yapar. Sermet Hoca her fırsatta Bursa frikiğini
//   anlatır; "Ronaldo mu sen mi?" sorusuna cevabı hep aynıdır. Taktik Hoca Cemil gerçekten futbol konuşmak
//   ister (Total Futbol, yarım alan, gegenpres…) ama sözü her seferinde kesilir.
//   Gerçek kişiler kullanılmaz; karakterler yorum programlarının tanıdık tiplerinden esinlenmiş parodilerdir.
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
  ],
  hostHt: [
    'Devre arası, skor {score}. Hocalarım, ilk yarıyı nasıl gördünüz?',
    'İlk 45 dakika bitti: {score}. Hemen yorumlara geçelim, vakit dar!',
    'Siyah Show devre arası! Tabelada {score}. Kim başlıyor?',
  ],
  hostToCemil: ['Cemil Hocam, sizden başlayalım: maçı nasıl görüyorsunuz?', 'Cemil Hocam, kısaca taktik tarafı?', 'Taktik tahtası hazır, Cemil Hocam buyurun.'],
  cemilPre: [
    'Bakın arkadaşlar, {my} bu maçta yarım alanları kullanırsa, Total Futbol\'un o eski prensibi, yani herkesin her yerde oynaması—',
    'Burada asıl mesele ters bek bindirmesi. Altı numara iki stoperin arasına düşerse üçlü savunmaya geçiş—',
    'Pres tetikleyicisi şu: top kanada gittiği an kenar çizgisini bir oyuncu gibi kullanıp üçüncü adamı—',
    'Şimdi tahtaya çiziyorum, bakın: sol iç koridorda üçüncü adam koşusu, sonra derinlik—',
  ],
  cemilHt: [
    'İlk yarıda {my} sağ kanattan pres kurdu ama geçiş anlarında orta saha bloğunun mesafesi—',
    'Arkadaşlar bir dakika, gegenpres dediğimiz şey aslında topu kaybettiğin anki beş saniye—',
    '{myName} yarım alanda topu aldığında, ara pası için ikinci forvetin derin koşusu—',
  ],
  cemilLast: [
    'Son bir cümle: kanat bekleri içeri kat ederse—',
    'Bir saniye, sadece şu oku çizeyim, Total Futbol\'da—',
    'Ama arkadaşlar, alan savunmasında kör nokta—',
  ],
  interrupt: [
    ['riza', 'Hocam pardon, bu sabah pazara gittim, domatesin kilosu ne olmuş biliyor musunuz?'],
    ['nevzat', 'Cemil Hocam bir saniye, benim kayınçonun düğünü var cumartesi, salon bulamadık!'],
    ['riza', 'Bu arada dün akşam balık yedim, levrek mi çupra mı hâlâ tartışıyoruz evde.'],
    ['nevzat', 'Ya hocam bırak taktiği, arabamı yıkattım, ertesi gün yağmur! Bu şehre ne oluyor?'],
    ['riza', 'Hocam o tahtayı nereden aldınız? Benim torun da öyle bir tane istiyor.'],
    ['nevzat', 'Hocam kusura bakma da kediyi veterinere götürecektim, unuttum. Neyse, devam…'],
  ],
  offTopic: [
    ['nevzat', 'Ben kırk yıllık gazeteciyim, hayatımda böyle kuru fasulye yemedim. Dün akşam bir lokanta…'],
    ['riza', 'Hakemliğimde bir maçta yağmur yağdı, şemsiyemi unuttum. O günden beri çantamda iki şemsiye var.'],
    ['nevzat', 'Kedim balkonda güvercin kovaladı, bütün apartman ayaktaydı. Neyse ki kimse düşmedi.'],
    ['riza', 'Yeni gözlük aldım, her şey çok net. Hakemlik yaparken olsaydı bu gözlük var ya…'],
    ['nevzat', 'Sabah çay ocağındaki Hüsnü Abi dedi ki: "Nevzat, bu sezon çaylar zamlanacak." Ben de inandım.'],
  ],
  hostToAd: [
    'Hemen kısa bir reklam arası… Rıza Hocam, Nevzat Abi, söz sizde!',
    'Sponsorumuz bekliyor! Rıza Hocam, Nevzat Abi, buyurun.',
  ],
  ad: [
    ['riza', 'Tavuk döner deyince akan sular durur! Dürüm Usta\'da lavaş çıtır, tavuk bol!'],
    ['nevzat', 'Biz bu akşam stüdyoya on iki dürüm söyledik, on üçüncüsünü de Cemil Hoca\'dan sakladık!'],
    ['riza', 'Maç gecesi menüsü: dürüm, ayran, bir de turşu. Dürüm Usta, kapında!'],
    ['nevzat', 'Acılı mı acısız mı? Dürüm Usta\'da ikisi de var. Ben ikisini birden yiyorum.'],
  ],
  adTag: ['Dürüm Usta Tavuk Döner: maç gecesinin yıldızı!', 'Dürüm Usta: çıtır lavaş, bol tavuk, bedava gülümseme!'],
  hostToSermet: ['Sermet Hocam, {myName} için ne dersiniz?', 'Sermet Hocam, bu akşamın frikik ihtimali?', 'Sermet Hocam, {my} kazanır mı?'],
  sermetPre: [
    'Bak evladım, ben Bursa deplasmanında otuz beş metreden frikiği doksana astım. Kaleci hâlâ topu arıyor.',
    '{myName}\'e söylüyorum: frikik ayakla değil yürekle atılır. Bursa\'da ben öyle attım.',
    'Benim Bursa frikiğim var ya, rüzgâr tersten esiyordu, top yine de döndü girdi. Yazın bunu.',
  ],
  sermetHt: [
    'Bu ilk yarıda bir frikik olsa ben Bursa\'daki gibi atardım, maç biterdi.',
    '{myName} iyi ama frikik tekniği eksik. Bursa\'yı izlesin, kaset bende var.',
    'Benim zamanımda devre arasında soyunma odasında frikik çalışırdık. Bursa\'dan önce de öyle.',
  ],
  ronaldoQ: ['Hocam açık konuşalım: Ronaldo mu, sen mi?', 'Peki Sermet Hocam, Ronaldo mu siz mi?', 'Son soru Hocam: Ronaldo mu, Sermet mi?'],
  ronaldoA: ['Ben.'],
  ronaldoAfter: ['Bursa\'yı izlemeyen bilmez.', 'Sorunun cevabı belli zaten.', 'Ben frikiği ayağımla değil, kafamla düşünürdüm.'],
  playerTalk: [
    ['riza', 'Bu {myName} çocuğu bizim mahallenin fırıncısının oğluna benziyor. O da çok koşardı, fırına geç kalırdı.'],
    ['nevzat', '{myName}\'in annesini tanıyorum, çok güzel sarma yapar. Futbolu da oradan geliyor bence.'],
    ['riza', '{myName} geçen hafta Chirp\'te bir şey yazmış, okumadım ama emojileri güzeldi.'],
  ],
  hostClosePre: ['Maç başlıyor! Siyah Show\'u izlediğiniz için teşekkürler, iyi seyirler!', 'Yayın akışı! Stada bağlanıyoruz, iyi seyirler!'],
  hostCloseHt: ['İkinci yarı başlıyor! Cemil Hocam, sizi bir sonraki programa alalım.', 'Yayın akışı çağırıyor, stada dönüyoruz! Hocam taktik tahtasını bırakın.'],
  hostCutCemil: ['Hocam yayın akışı! Maça gidiyoruz!', 'Cemil Hocam çok güzel ama sürem doldu!', 'Hocam reklama girmemiz lazım!'],
};

const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));

/**
 * Program akışı. ctx: {phase:'pre'|'ht', home, away, my, myName, score, id}
 * @returns {Array<{who:string, text:string, cut?:boolean, ad?:boolean, laugh?:boolean, cam?:'wide'|'close'}>}
 */
export function showScript(ctx) {
  const R = seeded(hash(`${ctx.id || ''}|${ctx.phase}|siyah`));
  const pick = (a) => a[Math.floor(R() * a.length)];
  const v = { home: ctx.home, away: ctx.away, my: ctx.my, myName: ctx.myName, score: ctx.score || '0-0', g: ctx.myGoals || 0 };
  const L = [];
  const say = (who, text, o = {}) => L.push({ who, text: fill(text, v), ...o });
  const ht = ctx.phase === 'ht';
  say('host', pick(ht ? POOL.hostHt : POOL.hostPre), { cam: 'wide' });
  if (ht && ctx.myGoals > 0) {
    say('host', ctx.myGoals > 1 ? '{myName} ilk yarıda {g} gol attı! Hocalarım?' : '{myName}\'in golünü konuşalım!');
    say('sermet', pick(['Güzel gol ama Bursa\'daki benimki daha güzeldi.', 'Bu golü ben Bursa\'da sol ayağımla atmıştım.', 'Fena değil. Kaleci benim zamanımda olsa kurtarırdı.']), { cam: 'close' });
  }
  // Cemil denemesi 1 → sözü kesilir
  say('host', pick(POOL.hostToCemil));
  say('cemil', pick(ht ? POOL.cemilHt : POOL.cemilPre), { cut: true });
  const [iw, it] = pick(POOL.interrupt);
  say(iw, it, { cam: 'close' });
  const [ow, ot] = pick(POOL.offTopic.filter(([w]) => w !== iw));
  say(ow, ot);
  if (R() < 0.6) { const [pw, pt] = pick(POOL.playerTalk); say(pw, pt); }
  // reklam
  say('host', pick(POOL.hostToAd), { cam: 'wide' });
  const ads = [...POOL.ad].sort(() => R() - 0.5);
  say(ads[0][0], ads[0][1], { ad: true });
  say(ads[1][0] === ads[0][0] ? (ads[0][0] === 'riza' ? 'nevzat' : 'riza') : ads[1][0], ads[1][1], { ad: true });
  say('all', pick(POOL.adTag), { ad: true, tag: true });
  // Sermet ve Bursa frikiği
  say('host', pick(POOL.hostToSermet));
  say('sermet', pick(ht ? POOL.sermetHt : POOL.sermetPre), { cam: 'close' });
  say('host', pick(POOL.ronaldoQ));
  say('sermet', POOL.ronaldoA[0], { cam: 'close', ben: true });
  L.push({ who: 'all', text: '(stüdyoda kahkahalar)', laugh: true, cam: 'wide' });
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
