// SOSYAL OLAYLAR — buluşma sonrası rastgele anlar: paparazzi → magazin, skandal, hayranlar, kavga, hız cezası…
//
// Her olay: {id, icon, title, text, short, changes, tone, tabloid?, met?, choices?}
//   tabloid: {headline, sub, tone, venueId, palette, personId} → magazin manşeti (gazete sayfası + Chirp gönderisi)
//   choices: oyuncu seçer → resolveSocialChoice() sonucu uygular
// Olasılıklar mekâna, ününe, kiminle olduğuna, arabanın dikkat/gizlilik puanına göre değişir.
import { chance, clamp, pick } from '../rng.js';
import { changeFame, changeMorale, changeRel } from '../player.js';
import { PEOPLE, PERSON_BY_ID, ROMANCE_STAGES, SOCIAL_RULES } from './data.js';
import { carStats, CARS } from '../garage.js';
import { ChirpTriggerEngine } from '../chirp/triggers.js';
import { MAGAZIN } from '../chirp/models.js';

const first = (s) => s.player.name.split(' ')[0];

/** Değişimi uygular ve değişim listesine ekler */
function fx(state, list, key, delta, label) {
  if (!delta) return;
  const p = state.player;
  if (key === 'money') state.career.money += delta;
  else if (key === 'morale') changeMorale(p, delta);
  else if (key === 'fame') changeFame(p, delta);
  else changeRel(p, key, delta);
  list.push({ key, label, delta });
}

/** Magazin: basın arşivine ekle + Chirp'te Flaş Magazin paylaşsın */
export function publishTabloid(state, tab) {
  const s = state.social;
  s.press = s.press || [];
  const entry = { s: state.calendar.season, w: state.calendar.week, ...tab };
  s.press.unshift(entry);
  s.press.length = Math.min(s.press.length, 12);
  try {
    const eng = new ChirpTriggerEngine(state);
    eng.post(MAGAZIN, tab.tone === 'bad' ? 'scandal' : 'gossip', tab.tweet || tab.headline, {}, { photo: { venueId: tab.venueId, palette: tab.palette, personId: tab.personId || null } });
  } catch {
    /* Chirp yoksa sadece arşiv */
  }
  return entry;
}

/** Paparazzi olasılığı: ün, mekân, prestij, arabanın dikkat/gizlilik puanı, skandal kokusu */
export function paparazziOdds(state, outing, tier) {
  const fame = state.player.fame || 0;
  if (fame < 15 || outing.venueId === 'home') return 0;
  const venue = outing.venueId === 'bar' ? 0.3 : 0.1;
  const prestige = 1 + ((tier?.prestige || 1) - 1) * 0.35;
  const famef = clamp(fame / 45, 0.35, 1.8);
  const car = carStats(state);
  const hide = 1 - Math.min(0.45, car.stealth * 0.15);
  const show = 1 + car.flash * 0.04;
  let p = venue * prestige * famef * hide * show;
  if (outing.cheating || isCheating(state, outing)) p *= 2.2;
  return clamp(p, 0, 0.85);
}

function isCheating(state, outing) {
  const partner = state.social?.partner;
  return outing.kind === 'romance' && partner && partner !== outing.companionId;
}

/** Paparazzi sahnesinin sonucu (kiminle, nerede, ne yaparken) */
function paparazzi(state, outing, tier) {
  const s = state.social;
  const me = first(state);
  const changes = [];
  const base = { venueId: outing.venueId, palette: outing.palette, personId: outing.person && !outing.companionId.startsWith('tm:') ? outing.companionId : null };
  const where = tier?.name || 'mekân';

  // 1) Aldatma skandalı
  if (isCheating(state, outing)) {
    const partner = PERSON_BY_ID[s.partner];
    const other = outing.person;
    const r = s.rel[s.partner];
    r.v = clamp(r.v - 30, 0, 100);
    let breakup = false;
    if (r.v < ROMANCE_STAGES[2].min - 10) {
      s.partner = null;
      breakup = true;
    }
    fx(state, changes, 'fans', -4, 'Taraftar');
    fx(state, changes, 'sponsor', -5, 'Sponsor');
    fx(state, changes, 'morale', -6, 'Moral');
    fx(state, changes, 'fame', 1, 'Ün');
    changes.unshift({ key: 'rel', label: `${partner.name} ilişkisi`, delta: -30 });
    return {
      id: 'paparazzi', icon: 'camera', tone: 'bad', title: 'Skandal! Magazine düştün',
      text: `${where} çıkışında paparazziler seni ${other.name} ile görüntüledi. Fotoğraflar sabah tüm magazin sitelerindeydi. ${breakup ? `${partner.name} ilişkinizi bitirdi.` : `${partner.name} çok kırgın.`}`,
      short: 'Aldatma skandalı', changes,
      tabloid: { ...base, tone: 'bad', headline: `${me.toLocaleUpperCase('tr')} İKİ ARADA!`, sub: `${partner.name} evde beklerken ${me}, ${where} çıkışında ${other.name} ile objektiflerimize yakalandı.`, tweet: `${me} ${where} çıkışında ${other.name} ile görüntülendi! Sevgilisi ${partner.name} ne diyecek? 📸` },
      breakup: breakup ? partner.name : null,
    };
  }

  // 2) Sevgiliyle: aşk belgelendi
  if (outing.kind === 'romance' && s.partner === outing.companionId) {
    const p = outing.person;
    const firstTime = !(s.press || []).some((x) => x.personId === p.id && x.tone !== 'bad');
    s.rel[p.id].v = clamp(s.rel[p.id].v + (p.likes.includes('cocky') ? 4 : 1), 0, 100);
    fx(state, changes, 'fans', 1, 'Taraftar');
    fx(state, changes, 'fame', 0.6, 'Ün');
    return {
      id: 'paparazzi', icon: 'camera', tone: 'good', title: firstTime ? 'Aşkınız magazinde' : 'Yine objektiflerde',
      text: firstTime ? `Paparazziler ${p.name} ile seni ${where} çıkışında görüntüledi. İlişkiniz artık herkesin gündeminde.` : `${p.name} ile ${where} çıkışında yine görüntülendiniz. Taraftarlar çifti çok sevdi.`,
      short: 'Paparazzi: aşk belgelendi', changes,
      tabloid: { ...base, tone: 'good', headline: firstTime ? 'AŞKLARINI İLAN ETTİLER!' : 'EL ELE GÖRÜNTÜLENDİLER', sub: `${me} ve ${p.full}, ${where} çıkışında el ele. Mutlulukları gözlerinden okunuyor.`, tweet: `${me} ve ${p.name} aşkı belgelendi! ${where} çıkışında el ele görüntülendiler. 💘` },
    };
  }

  // 3) Flört (henüz sevgili değil): gizemli kadın
  if (outing.kind === 'romance') {
    const p = outing.person;
    const likesFame = p.likes.includes('cocky');
    s.rel[p.id].v = clamp(s.rel[p.id].v + (likesFame ? 3 : -3), 0, 100);
    changes.push({ key: 'rel', label: `${p.name} ilişkisi`, delta: likesFame ? 3 : -3 });
    fx(state, changes, 'fame', 0.4, 'Ün');
    return {
      id: 'paparazzi', icon: 'camera', tone: 'warn', title: 'Paparazzi peşinde',
      text: `${where} çıkışında bir paparazzi ikinizi görüntüledi. ${likesFame ? `${p.name} bu ilgiden hoşlandı, fotoğrafı hikâyesinde paylaştı.` : `${p.name} bu ilgiden hiç hoşlanmadı.`}`,
      short: 'Paparazzi: gizemli flört', changes,
      tabloid: { ...base, tone: 'warn', headline: 'GİZEMLİ GÜZELLE KİM BU?', sub: `${me}, ${where} çıkışında bir güzelle görüntülendi. Yakın arkadaşları "Sadece arkadaşlar" diyor.`, tweet: `${me} gizemli bir güzelle ${where} çıkışında! Yeni aşk mı? 👀` },
    };
  }

  // 4) Barda: maç haftasında gece hayatı (soda içtiysen yumuşar)
  if (outing.venueId === 'bar') {
    const soda = (outing.picks || []).includes('humble');
    if (soda) {
      fx(state, changes, 'fans', 1, 'Taraftar');
      fx(state, changes, 'manager', 1, 'Hoca');
      return {
        id: 'paparazzi', icon: 'camera', tone: 'good', title: 'Soda içerken yakalandın',
        text: `Paparazziler seni ${where}'da görüntüledi ama elinde sadece soda vardı. Taraftarlar "örnek profesyonel" diye paylaştı.`,
        short: 'Paparazzi: sadece soda', changes,
        tabloid: { ...base, tone: 'good', headline: 'GECE KULÜBÜNDE SODA İÇTİ!', sub: `${me}, maç haftasında arkadaşlarıyla ${where}'daydı ama alkole dokunmadı.`, tweet: `${me} maç haftasında ${where}'da görüntülendi ama dikkat: elinde sadece soda vardı! 🥤` },
      };
    }
    fx(state, changes, 'manager', -5, 'Hoca');
    fx(state, changes, 'fans', -2, 'Taraftar');
    fx(state, changes, 'board', -3, 'Yönetim');
    fx(state, changes, 'fame', 0.5, 'Ün');
    return {
      id: 'paparazzi', icon: 'camera', tone: 'bad', title: 'Magazine düştün',
      text: `Bara gittin, paparazzi yakaladı! Maç haftasında gece hayatı fotoğrafların sabah magazin sayfalarındaydı. Hoca ve yönetim hiç memnun değil.`,
      short: 'Paparazzi: gece hayatı', changes,
      tabloid: { ...base, tone: 'bad', headline: 'MAÇ ÖNCESİ GECE KULÜBÜNDE!', sub: `${me}, kritik maçtan günler önce ${where}'da sabaha kadar eğlendi. Taraftar tepkili.`, tweet: `${me} maç haftasında ${where}'da sabaha kadar eğlendi! Hocası ne diyecek? 🍸📸` },
    };
  }

  // 5) Kafede arkadaşla: sempatik haber
  fx(state, changes, 'fans', 1, 'Taraftar');
  if (outing.kind === 'teammate') fx(state, changes, 'teammates', 1, 'Takım');
  return {
    id: 'paparazzi', icon: 'camera', tone: 'good', title: 'Kahve molası magazinde',
    text: `${where}'da ${outing.person?.name || 'kahveni içerken'} görüntülendin. Samimi kareler taraftarın hoşuna gitti.`,
    short: 'Paparazzi: kahve molası', changes,
    tabloid: { ...base, tone: 'good', headline: 'YILDIZIN SADE HAYATI', sub: `${me}, ${where}'da ${outing.person ? `${outing.person.name} ile` : 'tek başına'} kahve keyfi yaparken görüntülendi.`, tweet: `${me} ${where}'da kahve keyfinde. Ne kadar da sade bir yıldız! ☕` },
  };
}

/** Olay tanımları: when(ctx) → olasılık; apply(ctx) → olay */
export const SOCIAL_EVENTS = [
  { id: 'paparazzi', when: ({ state, outing, tier }) => paparazziOdds(state, outing, tier), apply: ({ state, outing, tier }) => paparazzi(state, outing, tier) },
  {
    id: 'provoke',
    when: ({ state, outing }) => (outing.venueId === 'bar' && state.player.fame >= 10 ? 0.1 + ((outing.picks || []).includes('cocky') ? 0.08 : 0) : 0),
    apply: ({ outing }) => ({
      id: 'provoke', icon: 'megaphone', tone: 'warn', title: 'Rakip taraftar sataşıyor',
      text: 'Yan masadaki rakip taraftar yüksek sesle seninle dalga geçiyor, telefonlar kayıtta…',
      short: 'Sataşma', changes: [], venueId: outing.venueId, palette: outing.palette,
      choices: [
        { id: 'calm', label: 'Gülümse ve uzaklaş', icon: 'smile' },
        { id: 'sign', label: 'Formasını imzala, gönlünü al', icon: 'handshake' },
        { id: 'fight', label: 'Karşılık ver', icon: 'bolt' },
      ],
    }),
  },
  {
    id: 'speeding',
    when: ({ state }) => {
      const st = carStats(state);
      return st.carId && st.power >= 2 ? 0.04 + st.power * 0.015 : 0;
    },
    apply: ({ state, outing }) => {
      const st = carStats(state);
      const changes = [];
      const fine = 400 * (CARS[st.carId]?.mult || 1);
      fx(state, changes, 'money', -fine, 'Para');
      fx(state, changes, 'morale', -2, 'Moral');
      const famous = state.player.fame >= 35;
      if (famous) fx(state, changes, 'fans', -1, 'Taraftar');
      return {
        id: 'speeding', icon: 'car', tone: 'bad', title: 'Radara yakalandın',
        text: `Dönüşte modifiyeli motorun fazla gaz istedi; trafik polisi durdurdu. €${fine.toLocaleString('tr-TR')} hız cezası.${famous ? ' Polisle fotoğrafın sosyal medyaya düştü.' : ''}`,
        short: 'Hız cezası', changes,
        tabloid: famous ? { tone: 'bad', venueId: outing.venueId, palette: outing.palette, headline: 'RADARA TAKILDI!', sub: `${first(state)}, gece yarısı modifiyeli arabasıyla hız sınırını aştı.`, tweet: `${first(state)} gece yarısı modifiyeli arabasıyla radara takıldı! 🚓` } : null,
      };
    },
  },
  {
    id: 'meet',
    when: ({ state, outing }) => {
      if ((state.player.age || 0) < SOCIAL_RULES.romanceMinAge || outing.kind === 'romance') return 0;
      if (!unmetFor(state, outing.venueId).length) return 0;
      return outing.companionId === 'alone' ? 0.5 : 0.15;
    },
    apply: ({ state, outing }) => {
      const p = pick(unmetFor(state, outing.venueId));
      const r = state.social.rel[p.id];
      r.met = true;
      r.v = Math.max(r.v, 12);
      return {
        id: 'meet', icon: 'sparkle', tone: 'good', title: 'Yeni biriyle tanıştın',
        text: `${p.full} ile tanıştınız. ${p.job}. Numaralarınızı değiştiniz; artık Sosyal Yaşam'da onu davet edebilirsin.`,
        short: `${p.name} ile tanışma`, changes: [], met: p,
      };
    },
  },
  {
    id: 'viral',
    when: ({ outing }) => (outing.companionId === 'melis' ? 0.35 : 0),
    apply: ({ state }) => {
      const changes = [];
      fx(state, changes, 'fame', 1, 'Ün');
      fx(state, changes, 'sponsor', 2, 'Sponsor');
      if (state.chirp) state.chirp.followers = (state.chirp.followers || 0) + 2500;
      return { id: 'viral', icon: 'phone', tone: 'good', title: 'Viral oldun', text: `${PERSON_BY_ID.melis.name} buluşmanızdan kısa bir video paylaştı; bir gecede milyonlarca izlendi. Chirp takipçilerin +2.500!`, short: 'Viral video', changes };
    },
  },
  {
    id: 'car_fans',
    when: ({ state }) => (carStats(state).flash >= 4 ? 0.2 : 0),
    apply: ({ state }) => {
      const changes = [];
      fx(state, changes, 'fans', 1, 'Taraftar');
      fx(state, changes, 'fame', 0.2, 'Ün');
      return { id: 'car_fans', icon: 'car', tone: 'good', title: 'Araban olay oldu', text: 'Mekânın önüne park ettiğin modifiyeli arabanın etrafında kalabalık toplandı; herkes fotoğraf çekiyor.', short: 'Araba hayranları', changes };
    },
  },
  {
    id: 'party_leak',
    when: ({ state, outing }) => (outing.venueId === 'home' && state.player.fame >= 25 ? 0.22 : 0),
    apply: ({ state, outing }) => {
      const changes = [];
      fx(state, changes, 'fame', 0.5, 'Ün');
      fx(state, changes, 'manager', -2, 'Hoca');
      return {
        id: 'party_leak', icon: 'camera', tone: 'warn', title: 'Parti fotoğrafları sızdı',
        text: 'Misafirlerden biri ev partisinden kareler paylaştı. Lüks evin konuşuluyor; hoca biraz rahatsız.',
        short: 'Parti fotoğrafları', changes,
        tabloid: { tone: 'warn', venueId: 'home', palette: outing.palette, headline: 'YILDIZIN EVİNDE ÇILGIN PARTİ', sub: `${first(state)} evinde takım arkadaşlarına parti verdi. Kareler sosyal medyayı salladı.`, tweet: `${first(state)} evinde çılgın parti! Sızan kareler gündem oldu. 🎉` },
      };
    },
  },
  {
    id: 'fan_drawing',
    when: ({ state, outing }) => (outing.venueId === 'cafe' && state.player.fame >= 15 ? 0.12 : 0),
    apply: ({ state }) => {
      const changes = [];
      fx(state, changes, 'morale', 3, 'Moral');
      fx(state, changes, 'fans', 1, 'Taraftar');
      return { id: 'fan_drawing', icon: 'heart', tone: 'good', title: 'Küçük hayranın', text: 'Yan masadaki küçük bir çocuk seni formanla çizdiği resmi utana sıkıla getirdi. Resmi imzalayıp ona geri verdin.', short: 'Küçük hayran', changes };
    },
  },
  {
    id: 'selfie',
    when: ({ state }) => (state.player.fame >= 25 ? 0.25 : 0),
    apply: ({ state }) => {
      const changes = [];
      fx(state, changes, 'fans', 2, 'Taraftar');
      fx(state, changes, 'fame', 0.3, 'Ün');
      return {
        id: 'selfie', icon: 'camera', tone: 'good', title: 'Hayranlar seni tanıdı',
        text: pick(['Yan masadaki çocuklar fotoğraf istedi; formanı imzaladın.', 'Bir grup taraftar şarkını söyledi, birlikte fotoğraf çektiniz.', 'Garson kardeşi için imza istedi.']),
        short: 'Hayran fotoğrafı', changes,
      };
    },
  },
];

function unmetFor(state, venueId) {
  return PEOPLE.filter((p) => p.kind === 'romance' && !state.social.rel[p.id]?.met && (p.meetAt || []).includes(venueId));
}

/**
 * Buluşma sonrası olaylar (en fazla 2; paparazzi önceliklidir). Magazin manşetleri yayımlanır.
 * @returns {Array<object>}
 */
export function rollSocialEvents(state, outing, tier) {
  const out = [];
  const ctx = { state, outing, tier };
  for (const ev of SOCIAL_EVENTS) {
    if (out.length >= 2) break;
    let p = 0;
    try {
      p = ev.when(ctx);
    } catch {
      p = 0;
    }
    if (p > 0 && chance(p)) {
      const e = ev.apply(ctx);
      if (!e) continue;
      if (e.tabloid) e.press = publishTabloid(state, e.tabloid);
      out.push(e);
    }
  }
  return out;
}

/** Seçimli olayın sonucu (ör. sataşma) */
export function resolveSocialChoice(state, ev, choiceId) {
  const changes = [];
  const me = first(state);
  if (ev.id === 'provoke') {
    if (choiceId === 'calm') {
      fx(state, changes, 'morale', -1, 'Moral');
      fx(state, changes, 'fans', 1, 'Taraftar');
      return { text: 'Gülümseyip masana döndün. Video "olgun davranış" başlığıyla paylaşıldı.', changes, tone: 'good' };
    }
    if (choiceId === 'sign') {
      fx(state, changes, 'fans', 3, 'Taraftar');
      fx(state, changes, 'fame', 0.3, 'Ün');
      return { text: 'Rakip taraftarın formasını imzaladın; masadakiler alkışladı. Video viral oldu!', changes, tone: 'good' };
    }
    fx(state, changes, 'morale', 2, 'Moral');
    fx(state, changes, 'fans', -3, 'Taraftar');
    fx(state, changes, 'manager', -5, 'Hoca');
    fx(state, changes, 'federation', -6, 'Federasyon');
    fx(state, changes, 'money', -2000, 'Para');
    const press = publishTabloid(state, { tone: 'bad', venueId: ev.venueId || 'bar', palette: ev.palette, headline: 'BARDA OLAY ÇIKTI!', sub: `${me}, kendisine sataşan bir taraftarla tartıştı. Güvenlik araya girdi.`, tweet: `${me} barda bir taraftarla kavgaya karıştı! Kulüp disiplin soruşturması açtı. 😳` });
    return { text: 'Tartışma büyüdü, güvenlik araya girdi. Video her yerde; kulüp €2.000 disiplin cezası kesti.', changes, tone: 'bad', press };
  }
  return { text: '', changes };
}
