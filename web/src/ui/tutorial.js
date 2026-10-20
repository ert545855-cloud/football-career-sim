// EĞİTİCİ ASİSTAN — "Asistan Hoca Selin" oyunu adım adım öğretir: ekranın ilgili yerini ışıkla gösterir,
// konuşma balonunda anlatır. Her bölüm (ana ekran, maç, oyuncu, sosyal…) ilk ziyarette bir kez çıkar.
// İlerleme cihazda saklanır (ayarlar); Ayarlar'dan kapatılabilir ya da baştan başlatılabilir.
import { el, esc } from './dom.js';
import { defaultLook } from '../games/pixel/playerPixels.js';
import { playerCanvas } from '../games/pixel/sprites.js';
import { sfx } from '../audio.js';

export const ASSISTANT = 'Asistan Hoca Selin';
const LOOK = defaultLook({
  skin: '#e8b58f', hair: 'long', hairColor: '#4a2c17', longSleeve: true, pants: true, stripes: true, zip: true,
  kit: { body: '#0b1d3a', accent: '#ffd23f', pattern: 'solid', shorts: '#0b1d3a', socks: '#0b1d3a' }, boots: { main: '#f4f4f0', accent: '#0b1d3a' },
});

/** Bölümler: sel → ışıklandırılacak öğe (yoksa ortada konuşur) */
export const FLOWS = {
  hub: [
    { title: 'Hoş geldin!', text: 'Ben asistan hocan Selin. Kariyerinin ilk günlerinde yanındayım; oyunu birlikte öğrenelim. İstersen "Geç" ile atlayabilirsin.' },
    { sel: '.topbar', title: 'Bu sensin', text: 'Adın, kulübün, yaşın ve sağda genel gücün (OVR). Antrenman ve maçlarla OVR yükselir.' },
    { sel: '[data-tut="meters"]', title: 'Enerji, moral, form', text: 'Enerji düşükse mini oyunlarda zorlanırsın: dinlen. Moral yüksekse daha iyi oynarsın. Form son 5 maçının ortalamasıdır.' },
    { sel: '[data-tut="invest"]', title: 'Yatırım', text: 'Kasandaki parayı buradan kurgusal kripto paralara, fona, altına ya da vadeli hesaba yatırabilirsin. Menajerin portföyünü takip eder.' },
    { sel: '[data-tut="fixture"]', title: 'Sıradaki maç', text: 'Rakibin, iç saha/deplasman ve hava durumu. Kupa maçın varsa hemen üstünde ayrı bir kart çıkar ve önce o oynanır.' },
    { sel: '.actions', title: 'Haftalık zamanın', text: 'Her hafta 4 zaman hakkın var (sağ üstteki kutucuklar). Antrenman yap, dinlen, takımla yemeğe çık, Özel Çalışma ile zayıf ayağını ve becerilerini geliştir.' },
    { sel: '[data-act="match"]', title: 'Maç günü', text: 'Hazır olunca maç gününe geç. Maç canlı yayında oynanır; kritik anlarda (şut, pas, savunma) oyunu sen oynarsın.' },
    { sel: '.tabbar', title: 'Menü', text: 'Oyuncu: özelliklerin ve karakterin. Sosyal: buluşmalar ve evin. Lig: puan durumu ve kupa. Chirp: sosyal medya. Mağaza ve Kariyer de burada.' },
  ],
  match: [
    { sel: '[data-bc]', title: 'Canlı yayın', text: 'Maç 90 saniye sürer. Goller, kaçan pozisyonlar ve sevinçler ayrıca canlandırılır; o sırada saat durur. Sol altta teknik direktörün tepki verir.' },
    { sel: '.bc-sb', title: 'Skor ve dakika', text: 'Dakika, uzatmalar (45+2, 90+3), devre arası (İY) ve maç sonu (MS) burada. Skor, top ağlara girdiği anda değişir.' },
    { sel: '[data-fs]', title: 'Tam ekran', text: 'Bu düğme yayını yatay tam ekrana alır: stadyum, taraftarlar ve oyuncular çok daha büyük görünür.' },
    { sel: '.match-controls', title: 'Hız ve sıradaki an', text: 'Hızı 1x/2x/4x yapabilir ya da doğrudan sıradaki kritik anına geçebilirsin. Kritik anda mini oyun açılır: dikkatle oku, sonra BAŞLA.' },
  ],
  player: [
    { sel: '.ovr-badge', title: 'Oyuncu ekranı', text: 'Özelliklerin, durumun, sözleşmen ve eşyaların burada. Ana ve yan özelliğin daha hızlı gelişir.' },
    { sel: '[data-playstyle]', title: 'Karakter', text: 'Kişiliğin alışkanlıklarınla değişir. Oyun tarzı seç, uzmanlık puanlarınla yeni yetenekler aç.' },
  ],
  social: [{ title: 'Sosyal hayat', text: 'Takım arkadaşlarınla ve sevdiklerinle buluş. Konuşmalarında verdiğin cevaplar ilişkini ve moralini etkiler; gece hayatı profesyonelliğini düşürebilir.' }],
  league: [{ title: 'Lig ve kupa', text: 'Puan durumu, fikstür ve Kupa sekmesi burada. Kupa ön eleme ile başlar: son 32, son 16, çeyrek final, yarı final ve final.' }],
  chirp: [{ title: 'Chirp', text: 'Futbol dünyasının sosyal medyası. Maçlarından sonra paylaşım yap, taraftarlarınla etkileş; ün ve taraftar ilişkin buna göre değişir.' }],
  shop: [{ title: 'Mağaza', text: 'Araba, ev, gelişim ürünleri ve dolap (krampon, gol sevinci…). Kişisel antrenör antrenman verimini artırır.' }],
  gym: [
    { sel: '.gym-scene', title: 'Spor salonu', text: 'Ekipmana dokun: halter ve dambıl gücünü, koşu bandı kondisyonunu artırır. Esneme kas ağrısını alır. Haftada 2 ağırlık/kardiyo seansı yapabilirsin.' },
    { sel: '.gym-meters', title: 'Maça etkisi', text: 'Kondisyon yüksekse maçta geç yorulursun ve sakatlık riskin düşer. Güç top kapmayı ve kafa toplarını kolaylaştırır. Maç gününe kas ağrısıyla çıkma: dinlen ya da esneme yap.' },
  ],
  sponsors: [
    { sel: '.sp-board', title: 'Sponsorlar', text: 'Ünün ve marka imajın arttıkça markalar sana teklif getirir: haftalık ücret, gol primi ve sahaya katkısı olan avantajlar (krampon, enerji içeceği…).' },
    { sel: '#sp-shoot', title: 'Reklam çekimi', text: 'Her sözleşmede zorunlu çekimler var. Yönetmen pozu söyler, doğru poza hızlıca bas. Çekimi yapmazsan ceza ödersin ve imajın düşer.' },
  ],
  wealth: [
    { sel: '.w-street', title: 'Senin sokağın', text: 'Kurduğun işletmeler, aldığın mülkler ve vakfın bu sokakta yükselir. Sağ üstte toplam servetin.' },
    { sel: '.w-tabs', title: 'Servet sekmeleri', text: 'İşletmeler: kafe, spor salonu, krampon markası (her hafta kâr/zarar, iflas riski). Emlak: kiralık mülkler. Vakıf: hayır projeleri; miras iç saha maçlarında taraftar desteği verir.' },
  ],
  invest: [
    { sel: '.inv-hero', title: 'Yatırım', text: 'Kazandığın parayı burada değerlendirirsin. Toplam servetin nakit ve portföyünden oluşur. Fiyatlar her hafta sonu değişir.' },
    { sel: '.inv-agent', title: 'Menajerin takipte', text: 'Menajerin portföyünü izler: düşüşte, aşırı riskte ya da kasan azalınca seni uyarır. İstersen "Menajer yönetsin" ile parayı bir plana göre o yönetir (yıllık ~%2 ücret).' },
    { sel: '.inv-market', title: 'Piyasa', text: 'Vadeli hesap risksizdir; fon ve altın daha dengeli; kripto ve meme coin çok dalgalı. Ünün artınca kendi taraftar tokenin çıkar: fiyatı maçlardaki performansına bağlı. Hepsi oyun içi, kurgusal varlıklardır.' },
  ],
  career: [{ title: 'Kariyer', text: 'Ödüllerin, rekorların, transfer geçmişin, kariyer rakibin ve kulüp başkanın burada. Başarımları da buradan görebilirsin.' }],
};

/** Mini oyunların ilk açılışında kısa ipucu */
export const GAME_TIPS = {
  shot: 'Topu kaleye doğru kaydır. Kaleci hangi köşeye yatıyor, ona dikkat et; uzak köşe genelde açıktır.',
  pass: 'Topa dokun ve arkadaşına doğru çiz. Rakipler çizdiğin koridoru okumaya çalışır: kavisli çizgiyle onları atlat.',
  tackle: 'Sürükleyerek pas koridorunu kapat, top yanından geçerken dokun. Hızlı kaydırırsan kayarak girersin ama adama girersen faul!',
  attack: 'Önce ver-kaç pası (ofsayta dikkat), sonra son adamı geç, en son şut. Bir aşama koparsa atak biter.',
  dribble: 'Rakip gelince bir yana yüklen, öbür yana kır. Parmağını sürükleyerek yön ver.',
  corner: 'Topun ineceği halkaya koş, halka kapanınca zıpla ve kafayı vur.',
  shuttle: 'Bip sesiyle koş; çizgiye geç kalırsan elenirsin. Temponu koru.',
};

function prog(app) {
  const t = (app.settings.tutorial ||= { done: {}, games: {}, off: false });
  t.done ||= {};
  t.games ||= {};
  return t;
}

let APP = null;
/** Uygulama nesnesini kaydeder (mini oyun ipuçları için) */
export const registerTutorialApp = (a) => { APP = a; };
export const tutorialOn = (app) => !!app && !app.autoplay && !prog(app).off;
export const needsTutorial = (app, key) => tutorialOn(app) && !!FLOWS[key] && !prog(app).done[key];

function portrait() {
  try {
    const src = playerCanvas(LOOK, 'down', 'point');
    const c = document.createElement('canvas');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const size = 52;
    c.width = size * dpr;
    c.height = size * dpr;
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rows = 17;
    const k = c.height / rows;
    g.drawImage(src, 0, 0, src.width, rows, (c.width - src.width * k) / 2, 0, src.width * k, rows * k);
    return c;
  } catch {
    return document.createElement('span');
  }
}

/** Bir adımı gösterir; çözülen değer: 'next' | 'skip' */
function showStep(step, i, n) {
  return new Promise((resolve) => {
    const target = step.sel ? document.querySelector(step.sel) : null;
    const layer = el(`<div class="tut-layer">
      <div class="tut-hole ${target ? '' : 'none'}"></div>
      <div class="tut-card">
        <div class="tut-head"><span class="tut-face"></span><div><b>${esc(step.title)}</b><span>${esc(ASSISTANT)} · ${i + 1}/${n}</span></div></div>
        <p>${esc(step.text)}</p>
        <div class="tut-btns"><button class="btn ghost sm" data-tut-skip>Geç</button><button class="btn primary sm" data-tut-next>${i + 1 < n ? 'İleri' : 'Anladım'}</button></div>
      </div>
    </div>`);
    layer.querySelector('.tut-face').appendChild(portrait());
    document.body.appendChild(layer);
    const hole = layer.querySelector('.tut-hole');
    const card = layer.querySelector('.tut-card');
    const place = () => {
      const vh = window.innerHeight;
      if (target) {
        target.scrollIntoView?.({ block: 'nearest' });
        const r = target.getBoundingClientRect();
        const pad = 6;
        Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
        const below = r.bottom + 14 + card.offsetHeight < vh - 10;
        card.style.top = below ? `${Math.min(vh - card.offsetHeight - 10, r.bottom + 14)}px` : `${Math.max(10, r.top - card.offsetHeight - 14)}px`;
      } else {
        card.style.top = `${Math.max(20, vh / 2 - card.offsetHeight / 2)}px`;
      }
    };
    requestAnimationFrame(place);
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    const done = (v) => {
      window.removeEventListener('resize', onResize);
      layer.classList.add('out');
      setTimeout(() => layer.remove(), 180);
      resolve(v);
    };
    layer.querySelector('[data-tut-next]').addEventListener('click', (e) => { e.stopPropagation(); sfx('click'); done('next'); });
    layer.querySelector('[data-tut-skip]').addEventListener('click', (e) => { e.stopPropagation(); sfx('click'); done('skip'); });
  });
}

const waitFree = async () => {
  // açık bir pencere (sheet) varsa kapanmasını bekle
  for (let i = 0; i < 80 && document.querySelector('.layer:not(.out), .game-layer'); i++) await new Promise((r) => setTimeout(r, 300));
};

/** Bir bölümün eğitimini oynatır (daha önce görüldüyse hiçbir şey yapmaz) */
export async function runTutorial(app, key) {
  if (!needsTutorial(app, key)) return;
  await waitFree();
  if (!needsTutorial(app, key)) return;
  const steps = FLOWS[key];
  const p = prog(app);
  p.done[key] = true;
  app.saveSettings();
  for (let i = 0; i < steps.length; i++) {
    const v = await showStep(steps[i], i, steps.length);
    if (v === 'skip') {
      // "Geç": tüm eğitimi kapatma değil, bu bölümü bitirir; uzun eğitimde (ana ekran) tamamını kapatmayı sorar
      if (key === 'hub') { p.off = true; app.saveSettings(); }
      break;
    }
  }
}

/** Mini oyun ilk açıldığında gösterilecek ipucu (bir kez) */
export function gameTip(type, context, app = APP) {
  if (!app || !tutorialOn(app)) return null;
  const key = context === 'corner' ? 'corner' : type;
  const tip = GAME_TIPS[key];
  const p = prog(app);
  if (!tip || p.games[key]) return null;
  p.games[key] = true;
  app.saveSettings();
  return tip;
}

export function resetTutorial(app) {
  app.settings.tutorial = { done: {}, games: {}, off: false };
  app.saveSettings();
}
