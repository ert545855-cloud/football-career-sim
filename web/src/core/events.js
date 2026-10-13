// METİN OLAYLARI — NSS tarzı seçimli olaylar. Her hafta sonu bir olay çıkabilir.
import { CLUB_BY_ID, STAT_KEYS, STATS } from './data.js';
import { chance, clamp, pick, roundTo, weightedPick } from './rng.js';
import { changeEnergy, changeFame, changeMorale, changeRel, form, ovr } from './player.js';
import { positionOf } from './league.js';
import { publishTabloid } from './social/events.js';
import { PERSON_BY_ID } from './social/data.js';
import { carStats } from './garage.js';

const partnerName = (s) => PERSON_BY_ID[s.social?.partner]?.name || '';
const nameOf = (s) => s.player.name.split(' ')[0];
/** Sevgiliyle ilişki puanını değiştir */
const partnerRel = (s, d) => {
  const r = s.social?.rel?.[s.social?.partner];
  if (r) r.v = clamp(r.v + d, 0, 100);
};

const club = (s) => CLUB_BY_ID[s.career.clubId];

/**
 * fx alanları: money, morale, energy, manager, teammates, fans, fame,
 * stat: {speed: +1}, injuredWeeks, trainBoostWeeks
 * Bir seçeneğin fx'i fonksiyon olabilir: (state) => ({ fx, note })
 */
export const EVENTS = [
  {
    id: 'tv_interview', icon: 'mic', title: 'TV Röportajı',
    when: () => true, weight: 1.2,
    text: (s) => `Spor kanalı ${club(s).name} hakkında seninle röportaj yapmak istiyor.`,
    choices: [
      { label: 'Kabul et', fx: { fans: 4, fame: 1, energy: -5, money: 400 }, note: 'Kameraların önünde rahattın, taraftar sevdi.' },
      { label: 'Kibarca reddet', fx: { fans: -2, energy: 3 }, note: 'Dinlenmeyi seçtin, bazı taraftarlar burun kıvırdı.' },
    ],
  },
  {
    id: 'birthday_party', icon: 'cake', title: 'Doğum Günü Partisi',
    when: () => true, weight: 1,
    text: () => 'Takım arkadaşın doğum günü partisine seni de çağırdı. Parti geç saate kadar sürecek.',
    choices: [
      { label: 'Git, eğlen', fx: { teammates: 6, morale: 5, energy: -15 }, note: 'Soyunma odasında artık daha çok seviliyorsun.' },
      { label: 'Kısa uğra', fx: { teammates: 3, energy: -5 }, note: 'Hediyeni verdin, erkenden çıktın.' },
      { label: 'Gitme', fx: { teammates: -4, energy: 5 }, note: 'Bazıları gelmemene bozuldu.' },
    ],
  },
  {
    id: 'nightclub', icon: 'moon', title: 'Gece Kulübü Daveti',
    when: () => true, weight: 0.9,
    text: () => 'Arkadaşların maçtan sonra seni şehrin en popüler gece kulübüne çağırıyor.',
    choices: [
      {
        label: 'Takıl', fx: (s) => chance(0.4)
          ? { fx: { morale: 6, energy: -25, manager: -8, fans: -3, board: -4 }, note: 'Fotoğrafların sabah gazetelerdeydi. Hoca ve yönetim hiç memnun değil.', press: s.social ? publishTabloid(s, { tone: 'bad', venueId: 'bar', palette: 'neon', headline: 'GECE KULÜBÜNDEN SABAHA KARŞI ÇIKTI!', sub: `${nameOf(s)}, maçtan sonra arkadaşlarıyla şehrin en popüler kulübünde sabahladı.`, tweet: `${nameOf(s)} gece kulübünden sabaha karşı çıktı! 🍸📸` }) : null }
          : { fx: { morale: 8, energy: -20 }, note: 'Harika bir geceydi ve kimse görmedi.' },
      },
      { label: 'Evde kal', fx: { energy: 6, manager: 1 }, note: 'Erken yattın, sabah dinç uyandın.' },
    ],
  },
  {
    id: 'extra_training', icon: 'dumbbell', title: 'Ekstra Antrenman',
    when: () => true, weight: 1,
    text: () => 'Hoca, antrenman sonrası seninle bireysel çalışmak istiyor.',
    choices: [
      { label: 'Kabul et', fx: (s) => ({ fx: { manager: 5, energy: -15, stat: { [randomStat(s)]: 1 } }, note: 'Hoca çalışkanlığını not etti.' }) },
      { label: 'Yorgunum hocam', fx: { manager: -3, energy: 4 }, note: 'Hoca omuz silkti.' },
    ],
  },
  {
    id: 'drink_sponsor', icon: 'briefcase', title: 'Sponsor Teklifi',
    when: (s) => s.player.fame >= 30, weight: (s) => 0.5 + (s.player.rel.sponsor ?? 30) / 100,
    text: () => 'Bir spor içeceği markası seninle reklam anlaşması yapmak istiyor.',
    choices: [
      { label: 'İmzala', fx: (s) => ({ fx: { money: roundTo((2000 + s.player.fame * 180) * (0.6 + (s.player.rel.sponsor ?? 30) / 100), 100), energy: -10, fame: 2, sponsor: 8 }, note: 'Yüzün artık otobüs duraklarında.' }) },
      { label: 'Reddet', fx: { manager: 2 }, note: 'Futbola odaklanmayı seçtin.' },
    ],
  },
  {
    id: 'social_criticism', icon: 'phone', title: 'Sosyal Medya Eleştirisi',
    when: (s, ctx) => ctx?.summary?.played && ctx.summary.rating < 6.0, weight: 3,
    text: () => 'Son maçtaki performansın sonrası sosyal medyada ağır eleştiriler var.',
    choices: [
      { label: 'Sert cevap ver', fx: { fans: -6, morale: 3, manager: -2, federation: -3 }, note: 'Tartışma büyüdü, taraftar ikiye bölündü.' },
      { label: 'Özür dile, söz ver', fx: { fans: 3, morale: -2 }, note: 'Olgun tavrın takdir topladı.' },
      { label: 'Görmezden gel', fx: { morale: -3 }, note: 'Telefonu kapattın ama aklın hep orada.' },
    ],
  },
  {
    id: 'transfer_rumor', icon: 'news', title: 'Transfer Dedikodusu',
    when: (s) => form(s.player) >= 7, weight: 1.4,
    text: () => 'Bir gazeteci büyük bir kulübün seninle ilgilendiğini soruyor.',
    choices: [
      { label: '"Kulübümde mutluyum"', fx: { manager: 4, fans: 4, board: 4 }, note: 'Taraftarlar ve yönetim sadakatini alkışladı.' },
      { label: '"Her teklifi dinlerim"', fx: { manager: -6, fans: -3, fame: 3, board: -6 }, note: 'Adın manşetlerde, ama hoca ve yönetim soğuk bakıyor.' },
    ],
  },
  {
    id: 'charity', icon: 'heart', title: 'Hastane Ziyareti',
    when: () => true, weight: 0.9,
    text: () => 'Kulüp, çocuk hastanesi ziyareti düzenliyor ve senden de katılmanı istiyor.',
    choices: [
      { label: 'Katıl', fx: { fans: 6, morale: 5, energy: -8 }, note: 'Çocukların gülümsemesi sana da iyi geldi.' },
      { label: 'Bağış yap', fx: (s) => ({ fx: { money: -Math.min(1000, Math.max(200, Math.round(s.career.money * 0.05))), fans: 4 }, note: 'Bağışın sessizce ulaştı.' }) },
      { label: 'Katılma', fx: { fans: -2 }, note: 'Bu sefer olmadı.' },
    ],
  },
  {
    id: 'family_visit', icon: 'home', title: 'Ailen Ziyarete Geliyor',
    when: () => true, weight: 1,
    text: () => 'Ailen hafta sonu seni görmeye geliyor.',
    choices: [
      { label: 'Onlara vakit ayır', fx: { morale: 10, energy: 5 }, note: 'Annenin yemekleri gibisi yok.' },
      { label: 'Antrenmana odaklan', fx: { manager: 2, morale: -4 }, note: 'Ailen anlayışla karşıladı ama biraz buruldun.' },
    ],
  },
  {
    id: 'captain_argument', icon: 'bolt', title: 'Kaptanla Tartışma',
    when: (s) => s.player.rel.teammates < 55, weight: 1,
    text: () => 'Antrenmanda kaptanla pozisyon yüzünden sert bir tartışma yaşadın.',
    choices: [
      { label: 'Özür dile', fx: { teammates: 5, morale: -2 }, note: 'Ortam yumuşadı.' },
      { label: 'Geri adım atma', fx: { teammates: -7, morale: 3, manager: -2 }, note: 'Haklı olabilirsin ama soyunma odası gergin.' },
    ],
  },
  {
    id: 'custom_boots', icon: 'boot', title: 'Özel Tasarım Krampon',
    when: (s) => s.career.money >= 700, weight: 0.8,
    text: () => 'Üzerinde ismin yazan, özel renklerde bir krampon tasarımı teklif edildi. Fiyatı €600.',
    choices: [
      { label: 'Al (€600)', fx: { money: -600, morale: 5, fans: 1 }, note: 'Yeni kramponlarla sahaya çıkmak için sabırsızsın.' },
      { label: 'Gerek yok', fx: {}, note: 'Eskiler de iş görüyor.' },
    ],
  },
  {
    id: 'investment', icon: 'chart', title: 'Yatırım Teklifi',
    when: (s) => s.career.money >= 6000, weight: 0.7,
    text: () => 'Bir tanıdığın restoran zincirine €5.000 yatırım yapmanı öneriyor. Riskli ama kazançlı olabilir.',
    choices: [
      {
        label: 'Yatır (€5.000)', fx: () => chance(0.5)
          ? { fx: { money: 7000, morale: 4 }, note: 'Restoranlar tuttu! €12.000 geri aldın.' }
          : { fx: { money: -5000, morale: -6 }, note: 'Zincir battı, paran gitti.' },
      },
      { label: 'Uzak dur', fx: {}, note: 'Para sende kalsın.' },
    ],
  },
  {
    id: 'knock', icon: 'bandage', title: 'Hafif Sakatlık',
    when: (s) => s.flags.injuredWeeks <= 0, weight: 0.6,
    text: () => 'Antrenmanda baldırında bir gerginlik hissettin.',
    choices: [
      { label: 'Sağlık ekibine söyle', fx: { injuredWeeks: 1, energy: 15, manager: 1 }, note: '1 hafta dinlenmen gerekiyor.' },
      {
        label: 'Sakla, oynamaya devam', fx: () => chance(0.4)
          ? { fx: { injuredWeeks: 3, morale: -8, manager: -3 }, note: 'Sakatlık büyüdü! 3 hafta yoksun.' }
          : { fx: { morale: 2 }, note: 'Ağrı geçti, şanslıydın.' },
      },
    ],
  },
  {
    id: 'youth_mentor', icon: 'users', title: 'Altyapıdan Genç',
    when: (s) => s.player.age >= 20, weight: 0.8,
    text: () => 'Altyapıdan bir genç, antrenman sonrası senden tavsiye istiyor.',
    choices: [
      { label: 'Yardım et', fx: { teammates: 4, fans: 2, energy: -5, morale: 3 }, note: 'Genç oyuncu sana hayran kaldı.' },
      { label: 'Vaktim yok', fx: { teammates: -2 }, note: 'Genç oyuncu biraz bozuldu.' },
    ],
  },
  {
    id: 'derby_fans', icon: 'flag', title: 'Taraftar Buluşması',
    when: () => true, weight: 0.9,
    text: (s) => `${club(s).name} taraftar grubu seninle buluşmak istiyor.`,
    choices: [
      { label: 'Katıl', fx: { fans: 7, energy: -10, morale: 3 }, note: 'Tribünler adını daha yüksek sesle haykıracak.' },
      { label: 'Video mesaj gönder', fx: { fans: 2 }, note: 'Fena fikir değildi.' },
    ],
  },
  {
    id: 'ask_playtime', icon: 'clipboard', title: 'Forma Şansı',
    when: (s) => (s.flags.benchStreak || 0) >= 2, weight: 3,
    text: () => 'Üst üste maçları kenarda geçirdin. Hocayla konuşmak ister misin?',
    choices: [
      {
        label: 'Kibarca iste', fx: () => chance(0.6)
          ? { fx: { manager: 5, morale: 4 }, note: 'Hoca "Sıranı bekle, yakında" dedi.' }
          : { fx: { manager: -2, morale: -2 }, note: 'Hoca kararında net: önce antrenmanda göster.' },
      },
      { label: 'Sitem et', fx: { manager: -8, morale: 3, fans: 2 }, note: 'İçini döktün ama hoca bunu unutmayacak.' },
      { label: 'Sabret', fx: { morale: -2, manager: 1 }, note: 'Çalışmaya devam.' },
    ],
  },
  {
    id: 'agent', icon: 'briefcase', title: 'Menajer Teklifi',
    when: (s) => s.player.fame >= 15, weight: 0.7,
    text: () => 'Tanınmış bir menajerlik ajansı seni temsil etmek istiyor. Komisyonu var ama ünün artar.',
    choices: [
      { label: 'Anlaş', fx: { fame: 4, money: -800, fans: 2 }, note: 'Artık profesyonel bir ekibin var.' },
      { label: 'Kendi işimi yaparım', fx: {}, note: 'Kontrol sende.' },
    ],
  },
  {
    id: 'rain_off', icon: 'cloud', title: 'Antrenman İptal',
    when: () => true, weight: 0.6,
    text: () => 'Şiddetli yağmur yüzünden yarınki antrenman iptal edildi.',
    choices: [{ label: 'Harika, dinlen', fx: { energy: 15, morale: 2 }, note: 'Bir gün daha uyku!' }],
  },
  {
    id: 'team_dinner', icon: 'utensils', title: 'Takım Yemeği',
    when: (s) => s.career.money >= 900, weight: 0.9,
    text: () => 'Takım yemeğinde hesap geldiğinde herkes sana bakıyor.',
    choices: [
      { label: 'Hesabı öde (€800)', fx: { money: -800, teammates: 8 }, note: 'Cömertliğin konuşuluyor.' },
      { label: 'Bölüşelim', fx: { teammates: 1 }, note: 'Adil olan buydu.' },
    ],
  },
  {
    id: 'provocation', icon: 'megaphone', title: 'Rakip Provokasyonu',
    when: () => true, weight: 0.8,
    text: () => 'Bir sonraki rakibin oyuncusu basına senin hakkında küçümseyici konuştu.',
    choices: [
      { label: 'Sert cevap ver', fx: { fans: 5, manager: -5, morale: 2, federation: -5 }, note: 'Taraftar coştu, hoca "sahada konuş" dedi. Federasyon da not aldı.' },
      { label: '"Sahada görüşürüz"', fx: { manager: 3, fans: 2 }, note: 'Olgun ve iddialı.' },
    ],
  },
  {
    id: 'camp', icon: 'tent', title: 'Yetenek Kampı',
    when: (s) => s.career.money >= 1600, weight: 0.8,
    text: () => 'Ünlü bir eski futbolcunun bireysel gelişim kampına katılabilirsin. Ücret €1.500.',
    choices: [
      { label: 'Katıl (€1.500)', fx: { money: -1500, trainBoostWeeks: 3, energy: -10 }, note: '3 hafta boyunca antrenman verimin +%25.' },
      { label: 'Gerek yok', fx: {}, note: 'Kendi yöntemlerinle devam.' },
    ],
  },
  {
    id: 'psych', icon: 'brain', title: 'Moral Bozukluğu',
    when: (s) => s.player.morale < 32, weight: 3,
    text: () => 'Son zamanlarda kendini mutsuz ve motivasyonsuz hissediyorsun.',
    choices: [
      { label: 'Spor psikoloğuyla görüş (€500)', fx: { money: -500, morale: 16 }, note: 'Konuşmak iyi geldi.' },
      { label: 'Kendi başına atlat', fx: { morale: 5 }, note: 'Zaman her şeyin ilacı... belki.' },
    ],
  },
  {
    id: 'viral_goal', icon: 'star', title: 'Golün Viral Oldu!',
    when: (s, ctx) => ctx?.summary?.goals > 0, weight: 2.5,
    text: () => 'Son maçtaki golün sosyal medyada milyonlarca kez izlendi.',
    choices: [{ label: 'Harika!', fx: { fans: 6, fame: 3, morale: 5 }, note: 'Takipçi sayın patladı.' }],
  },
  {
    id: 'documentary', icon: 'camera', title: 'Belgesel Teklifi',
    when: (s) => s.player.fame >= 55, weight: 0.8,
    text: () => 'Bir dijital platform hayatını anlatan bir belgesel çekmek istiyor.',
    choices: [
      { label: 'Kabul et', fx: (s) => ({ fx: { money: roundTo(15000 + s.player.fame * 400, 1000), fame: 5, energy: -15, teammates: -3 }, note: 'Kameralar her yerde, bazı takım arkadaşların rahatsız.' }) },
      { label: 'Reddet', fx: { teammates: 2 }, note: 'Özel hayatın sende kalsın.' },
    ],
  },
  {
    id: 'league_leader', icon: 'trophy', title: 'Zirve Yarışı',
    when: (s) => s.calendar.week >= 8 && positionOf(s.world, s.career.clubId) <= 2, weight: 1.2,
    text: (s) => `${club(s).name} zirve yarışında! Şehirde futbol ateşi yükseliyor.`,
    choices: [{ label: 'Bu sene bizim yılımız!', fx: { morale: 6, fans: 3 }, note: 'Herkes şampiyonluğu konuşuyor.' }],
  },
  {
    id: 'relegation_fear', icon: 'cloud', title: 'Kötü Gidişat',
    when: (s) => s.calendar.week >= 8 && positionOf(s.world, s.career.clubId) >= 10, weight: 1.2,
    text: (s) => `${club(s).name} ligin dibinde. Taraftar sabırsız.`,
    choices: [
      { label: 'Takımı topla', fx: { teammates: 5, morale: -2, energy: -5 }, note: 'Bir oyuncular toplantısı düzenledin.' },
      { label: 'Kendi oyununa odaklan', fx: { morale: -3 }, note: 'Herkes kendi işine baksın.' },
    ],
  },
  {
    id: 'boot_deal', icon: 'boot', title: 'Krampon Sponsorluğu',
    when: (s) => s.player.fame >= 45, weight: 0.8,
    text: () => 'Büyük bir spor markası seninle krampon sözleşmesi imzalamak istiyor.',
    choices: [
      { label: 'İmzala', fx: (s) => ({ fx: { money: roundTo(8000 + s.player.fame * 300, 1000), fame: 3, morale: 4, sponsor: 10 }, note: 'Yeni imza kramponların vitrinlerde.' }) },
      { label: 'Teklifi yükselt', fx: (s) => chance(0.5) ? { fx: { money: roundTo(12000 + s.player.fame * 400, 1000), fame: 3 }, note: 'Pazarlık işe yaradı!' } : { fx: { fame: -1 }, note: 'Marka geri çekildi.' } },
    ],
  },
];

// ── Magazin olayları (sosyal yaşam) ──
EVENTS.push(
  {
    id: 'tabloid_doorstep', icon: 'camera', title: 'Kapında Magazinciler',
    when: (s) => !!s.social?.partner && s.player.fame >= 20, weight: 1.1,
    text: (s) => `Magazin muhabirleri ${partnerName(s)} ile evinin önünde bekliyor. Mikrofonlar uzatıldı: "Evlilik ne zaman?"`,
    choices: [
      {
        label: 'Birlikte poz verin',
        fx: (s) => {
          partnerRel(s, 4);
          const press = publishTabloid(s, { tone: 'good', venueId: 'home', palette: 'home', personId: s.social.partner, headline: 'MUTLULUK POZU!', sub: `${nameOf(s)} ve ${partnerName(s)} objektiflerimize gülümsedi. "Acelemiz yok" dediler.`, tweet: `${nameOf(s)} ve ${partnerName(s)} kapı önünde poz verdi: "Acelemiz yok!" 💍` });
          return { fx: { fame: 1, fans: 2, morale: 2 }, note: `${partnerName(s)} çok mutlu oldu; fotoğraflar sevimli bulundu.`, press };
        },
      },
      {
        label: 'Arabaya binip uzaklaşın',
        fx: (s) => (carStats(s).stealth >= 3
          ? { fx: { morale: 1 }, note: 'Koyu cam filmi sayesinde kimse ikinizi göremedi.' }
          : { fx: { fans: -1 }, note: 'Kaçarken çekilen bulanık kareler yine de yayımlandı.', press: publishTabloid(s, { tone: 'warn', venueId: 'home', palette: 'home', personId: s.social.partner, headline: 'KAMERALARDAN KAÇTILAR', sub: `${nameOf(s)} ve ${partnerName(s)} soruları yanıtlamadan arabaya bindi.`, tweet: `${nameOf(s)} ve ${partnerName(s)} kameralardan kaçtı! Bir şey mi saklıyorlar? 🤔` }) }),
      },
      {
        label: 'Muhabire çıkış',
        fx: (s) => {
          partnerRel(s, -2);
          const press = publishTabloid(s, { tone: 'bad', venueId: 'home', palette: 'home', headline: 'MUHABİRE SERT TEPKİ!', sub: `${nameOf(s)}, sorulara sinirlenip muhabirimizin mikrofonunu itti.`, tweet: `${nameOf(s)} muhabirimize sert çıktı! Görüntüler bizde. 🎥` });
          return { fx: { morale: 2, fans: -3, sponsor: -3 }, note: 'Görüntüler akşam haberlerindeydi.', press };
        },
      },
    ],
  },
  {
    id: 'breakup_rumor', icon: 'news', title: 'Ayrılık Dedikodusu',
    when: (s) => !!s.social?.partner, weight: 0.9,
    text: (s) => `Flaş Magazin, ${partnerName(s)} ile ayrıldığınızı iddia ediyor. Telefonun susmuyor.`,
    choices: [
      {
        label: 'Chirp\'te birlikte fotoğraf paylaş',
        fx: (s) => {
          partnerRel(s, 3);
          if (s.chirp) s.chirp.followers = (s.chirp.followers || 0) + 500;
          return { fx: { fans: 1, morale: 2 }, note: 'Tek fotoğrafla dedikoduyu bitirdin. Takipçilerin arttı.' };
        },
      },
      { label: 'Sessiz kal', fx: (s) => (partnerRel(s, -4), { fx: { morale: -2 }, note: `${partnerName(s)} sessizliğine biraz kırıldı.` }) },
      { label: 'Yalanla ve dava aç (€3.000)', fx: { money: -3000, morale: 1, fans: 1 }, note: 'Avukatın sert bir açıklama yaptı; magazin geri adım attı.' },
    ],
  },
  {
    id: 'car_meet', icon: 'car', title: 'Otomobil Kulübü Buluşması',
    when: (s) => carStats(s).flash >= 5, weight: 0.8,
    text: () => 'Modifiyeli araban sosyal medyada çok konuşuldu. Bir otomobil kulübü seni hafta sonu buluşmasına davet ediyor.',
    choices: [
      { label: 'Katıl', fx: { fans: 3, fame: 1, energy: -10, morale: 3 }, note: 'Yüzlerce kişi arabanın etrafında toplandı; günün yıldızı sendin.' },
      { label: 'Teşekkür et, katılma', fx: { energy: 4 }, note: 'Hafta sonunu dinlenerek geçirdin.' },
    ],
  },
);

const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

function randomStat(s) {
  return pick(STAT_KEYS.filter((k) => s.player.stats[k] < 99));
}

/** Haftalık olay seçimi (yaklaşık %60 ihtimal), son 6 haftada çıkanlar hariç. */
export function pickEvent(state, ctx) {
  if (!chance(0.62)) return null;
  const week = (state.calendar.season - 1) * 100 + state.calendar.week;
  const cooldowns = state.flags.cooldowns || (state.flags.cooldowns = {});
  const pool = EVENTS.filter((e) => {
    if (cooldowns[e.id] && week - cooldowns[e.id] < 6) return false;
    try {
      return e.when(state, ctx);
    } catch {
      return false;
    }
  });
  if (!pool.length) return null;
  const ev = weightedPick(pool.map((e) => [e, typeof e.weight === 'function' ? e.weight(state, ctx) : e.weight]));
  cooldowns[ev.id] = week;
  return { id: ev.id, text: ev.text(state, ctx) };
}

export function getEvent(id) {
  return EVENT_BY_ID[id];
}

/** Seçimi uygular. @returns {{note:string, changes:Array<{key,label,delta}>}} */
export function resolveEvent(state, eventId, choiceIndex) {
  const ev = EVENT_BY_ID[eventId];
  const choice = ev?.choices[choiceIndex];
  if (!choice) return { note: '', changes: [] };
  let fx = choice.fx;
  let note = choice.note || '';
  let press = null;
  if (typeof fx === 'function') {
    const out = fx(state);
    fx = out.fx;
    note = out.note || note;
    press = out.press || null;
  }
  return { note, changes: applyFx(state, fx || {}), press };
}

const LABELS = {
  money: 'Para', morale: 'Moral', energy: 'Enerji', manager: 'Hoca', teammates: 'Takım', fans: 'Taraftar', fame: 'Ün',
  sponsor: 'Sponsor', federation: 'Federasyon', board: 'Yönetim',
  injuredWeeks: 'Sakatlık (hafta)', trainBoostWeeks: 'Antrenman bonusu (hafta)',
};

export function applyFx(state, fx) {
  const { player, career, flags } = state;
  const changes = [];
  for (const [key, val] of Object.entries(fx)) {
    if (!val && key !== 'stat') continue;
    switch (key) {
      case 'money': career.money += val; break;
      case 'morale': changeMorale(player, val); break;
      case 'energy': changeEnergy(player, val); break;
      case 'manager': case 'teammates': case 'fans': case 'sponsor': case 'federation': case 'board': changeRel(player, key, val); break;
      case 'fame': changeFame(player, val); break;
      case 'injuredWeeks': flags.injuredWeeks = Math.max(flags.injuredWeeks || 0, val); break;
      case 'trainBoostWeeks': flags.trainBoostWeeks = Math.max(flags.trainBoostWeeks || 0, val); break;
      case 'stat':
        for (const [k, d] of Object.entries(val)) {
          player.stats[k] = clamp(player.stats[k] + d, 1, 99);
          changes.push({ key: k, label: STATS[k].name, delta: d });
        }
        continue;
      default: continue;
    }
    changes.push({ key, label: LABELS[key] || key, delta: val });
  }
  return changes;
}
