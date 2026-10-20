// BASIN TOPLANTISI — büyük maçlardan önce, hoca değişince, formsuzlukta ya da gol yağmurunda mikrofon önüne çıkarsın.
// Her soruya üç ton: Mütevazı / Özgüvenli / Kışkırtıcı. Ün, taraftar, hoca ve takım ilişkileri ile maçtaki heyecan etkilenir.
import { clamp, pick, shuffle, chance } from './rng.js';
import { changeFame, changeMorale, changeRel, form } from './player.js';
import { CLUB_BY_ID } from './data.js';
import { changePersona } from './character.js';
import { shiftAttitude } from './attitude.js';

const TONES = {
  humble: { label: 'Mütevazı', icon: 'smile' },
  confident: { label: 'Özgüvenli', icon: 'star' },
  provoke: { label: 'Kışkırtıcı', icon: 'fire' },
};
export { TONES };

/** Soru bankası. {opp}: rakip, {club}: kulüp, {coach}: hoca */
const BANK = {
  big: [
    {
      q: '{opp} maçı öncesi rakibe bir mesajın var mı?',
      a: {
        humble: ['Rakibimize saygı duyuyoruz. Sahada konuşacağız.', { manager: 2, fans: 1 }],
        confident: ['Bu maçı kazanmak için geldik. Favori biziz.', { fans: 3, fame: 1, nerves: -0.06 }],
        provoke: ['Onları kendi sahalarında sileceğiz!', { fans: 5, fame: 2, manager: -3, nerves: 0.08, headline: true }],
      },
    },
    {
      q: 'Bu tarz büyük maçlarda baskı hissediyor musun?',
      a: {
        humble: ['Herkes hisseder. Takım arkadaşlarıma güveniyorum.', { teammates: 3, nerves: -0.03 }],
        confident: ['Baskı benim yakıtım. Büyük maç oyuncusuyum.', { fame: 1.5, nerves: -0.05 }],
        provoke: ['Baskıyı onlar hissetsin, biz değil.', { fans: 3, nerves: 0.04, headline: true }],
      },
    },
  ],
  form: [
    {
      q: 'Son maçlarda formsuzsun. Eleştirilere cevabın ne?',
      a: {
        humble: ['Haklılar. Daha çok çalışıp geri döneceğim.', { manager: 3, fans: 2, morale: -1 }],
        confident: ['Formsuzluk geçicidir, kalite kalıcıdır.', { fame: 1, morale: 2 }],
        provoke: ['Beni eleştirenler önce kendi işine baksın!', { fans: -4, manager: -2, fame: 1.5, headline: true }],
      },
    },
  ],
  hot: [
    {
      q: 'Gol yağdırıyorsun! Gol krallığı hedefin mi?',
      a: {
        humble: ['Önemli olan takımın kazanması. Gollerim bonus.', { teammates: 4, manager: 2 }],
        confident: ['Evet, gol kralı olmak istiyorum. Saklamıyorum.', { fame: 2, fans: 2 }],
        provoke: ['Bu ligde beni durdurabilecek defans yok.', { fame: 3, fans: 3, teammates: -2, headline: true }],
      },
    },
    {
      q: 'Avrupa\'dan teklifler konuşuluyor. {club}\'da kalacak mısın?',
      a: {
        humble: ['Şu an tek düşüncem {club}. Sözleşmeme saygılıyım.', { fans: 5, manager: 2 }],
        confident: ['Büyük hedeflerim var; zamanı gelince konuşuruz.', { fame: 2, fans: -1 }],
        provoke: ['Bu kulüp benim için küçük gelmeye başladı.', { fame: 3, fans: -8, manager: -4, headline: true }],
      },
    },
  ],
  coach: [
    {
      q: 'Yeni hocanız {coach} hakkında ne düşünüyorsun?',
      a: {
        humble: ['Kendisinden öğrenecek çok şeyim var. Hazırım.', { manager: 6 }],
        confident: ['Fikirleri net. Benim oyunumla uyuşacağına eminim.', { manager: 3, fame: 1 }],
        provoke: ['Eski hocamızı özleyeceğiz, bakalım nasıl olacak.', { manager: -6, fans: 2, headline: true }],
      },
    },
  ],
  general: [
    {
      q: 'Takımın bu sezonki hedefi ne?',
      a: {
        humble: ['Maç maç gidiyoruz, hedefleri büyük konuşmayalım.', { manager: 2 }],
        confident: ['Şampiyonluk için savaşacağız.', { fans: 3, fame: 1 }],
        provoke: ['Ligi biz domine edeceğiz, diğerleri ikinciliği oynasın.', { fans: 4, fame: 1.5, manager: -2, headline: true }],
      },
    },
    {
      q: 'Hakem kararları hakkında ne düşünüyorsun?',
      a: {
        humble: ['Hakemler de insan. Biz işimize bakalım.', { manager: 2 }],
        confident: ['Kararlar ne olursa olsun kazanacak kalitedeyiz.', { fans: 2 }],
        provoke: ['Bazı kararlar çok ilginç. Herkes gördü.', { fans: 4, fame: 1, discipline: true, headline: true }],
      },
    },
  ],
};

const fill = (s, m) => s.replace(/\{(\w+)\}/g, (_, k) => m[k] ?? '');

/**
 * Maç öncesi basın toplantısı gerekiyor mu? Büyük maç, yeni hoca, form durumu.
 * @returns {null|{kind:string, qs:Array<{q:string, a:Object}>, ctx:Object}}
 */
export function planPress(state, match) {
  if (!match || match.role === 'out') return null;
  const p = state.player;
  const fm = form(p);
  const goals = state.career.season?.goals || 0;
  const cc = state.pendingCoachPress;
  let kind = null;
  if (cc) kind = 'coach';
  else if (match.big && chance(0.7)) kind = 'big';
  else if (fm < 6.0 && p.ratings.length >= 3 && chance(0.4)) kind = 'form';
  else if ((goals >= 6 || (p.fame || 0) >= 55) && chance(0.2)) kind = 'hot';
  else if (chance(0.06)) kind = 'general';
  if (!kind) return null;
  const pool = shuffle([...BANK[kind]]);
  const qs = [pool[0], kind === 'big' || kind === 'hot' ? pool[1] : pick(BANK.general)].filter(Boolean).slice(0, 2);
  const ctx = { opp: CLUB_BY_ID[match.oppId]?.name || 'rakip', club: CLUB_BY_ID[state.career.clubId]?.short || '', coach: state.coach?.name || 'hoca' };
  if (kind === 'coach') state.pendingCoachPress = null;
  return {
    kind,
    title: { big: 'Maç Öncesi Basın Toplantısı', form: 'Basın Toplantısı', hot: 'Basın Toplantısı', coach: 'Basın Toplantısı · Yeni Hoca', general: 'Basın Toplantısı' }[kind],
    qs: qs.map((x) => ({ q: fill(x.q, ctx), a: Object.fromEntries(Object.entries(x.a).map(([tone, [text, fx]]) => [tone, { text: fill(text, ctx), fx }])) })),
  };
}

/**
 * Cevapları uygular. answers: ['humble'|'confident'|'provoke', …]
 * @returns {{changes:Array, headline:string|null, nerves:number, discipline:boolean}}
 */
export function answerPress(state, press, answers, match = null) {
  const p = state.player;
  const tot = { fame: 0, fans: 0, manager: 0, teammates: 0, morale: 0, nerves: 0 };
  let headline = null;
  let discipline = false;
  press.qs.forEach((q, i) => {
    const tone = answers[i] || 'humble';
    const a = q.a[tone];
    for (const [k, v] of Object.entries(a.fx)) if (k in tot) tot[k] += v;
    if (a.fx.headline && !headline) headline = a.text;
    if (a.fx.discipline) discipline = true;
  });
  if (tot.fame) changeFame(p, tot.fame);
  if (tot.fans) changeRel(p, 'fans', tot.fans);
  if (tot.manager) changeRel(p, 'manager', tot.manager);
  if (tot.teammates) changeRel(p, 'teammates', tot.teammates);
  if (tot.morale) changeMorale(p, tot.morale);
  // Maçtaki heyecan: özgüvenli cevaplar sakinleştirir, kışkırtıcı olanlar ateşler
  if (match?.big && tot.nerves) match.big.nerves = clamp(match.big.nerves + tot.nerves, 0, 0.9);
  if (discipline) state.flags.pressWarn = (state.flags.pressWarn || 0) + 1;
  // Kişilik: kibirli/kışkırtıcı cevaplar hırsı körükler ama disiplini düşürür; alçakgönüllülük disiplini artırır
  let attShift = 0;
  for (const tone of answers) attShift += shiftAttitude(state, `press_${tone}`);
  for (const tone of answers) {
    if (tone === 'provoke') { changePersona(state, 'ambition', 0.8); changePersona(state, 'discipline', -0.7); }
    else if (tone === 'confident') { changePersona(state, 'ambition', 0.4); changePersona(state, 'leadership', 0.3); }
    else if (tone === 'humble') changePersona(state, 'discipline', 0.3);
  }
  state.career.pressLog = [{ s: state.calendar.season, w: state.calendar.week, kind: press.kind, tones: answers, headline }, ...(state.career.pressLog || [])].slice(0, 20);
  const labels = { fame: 'Ün', fans: 'Taraftar', manager: 'Hoca', teammates: 'Takım', morale: 'Moral' };
  const changes = Object.entries(tot).filter(([k, v]) => v && labels[k]).map(([k, v]) => ({ key: k, label: labels[k], delta: Math.round(v * 10) / 10 }));
  return { changes, headline, nerves: tot.nerves, discipline, attShift: Math.round(attShift * 10) / 10 };
}
