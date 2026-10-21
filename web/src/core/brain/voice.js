// @ts-check
// İÇ SES ve ÖNERİ MOTORU — beyin her hafta durumu tarar ve "şu an en çok neyi dert ediyorum?" sorusuna
// fayda puanıyla cevap verir: yorgunluk, kilo, kas, uyku, stres, yalnızlık, rakip, anılar, hocanın isteği…
// En yüksek puanlı düşünce iç sese dönüşür (aynı şeyi üst üste tekrarlamaz). Öneri motoru ise haftanın
// aksiyonlarını beklenen faydaya göre sıralar ve gerekçesini söyler. Kişisel hedefler: beyin zayıf noktayı
// seçer, kendine bir hedef koyar ve takip eder.
import { clamp, pick, round1 } from '../rng.js';
import { DIETS } from './body.js';
import { TRAITS } from './traits.js';

const f1 = (v) => String(round1(v)).replace('.', ',');
const pct = (v) => `%${f1(v)}`;

/**
 * Aday düşünceler. cx: index.js'in kurduğu bağlam.
 * @returns {{key:string, score:number, mood:'good'|'bad'|'info', text:string}[]}
 */
function candidates(cx) {
  const out = [];
  const add = (key, score, mood, texts) => { if (score > 0) out.push({ key, score, mood, text: Array.isArray(texts) ? pick(texts) : texts }); };
  const { fx, m, needs, energy } = cx;
  if (cx.injuredWeeks > 0) add('injured', 62, 'bad', [`Sahaya dönmek için gün sayıyorum. ${cx.injuredWeeks} hafta kaldı.`, `Tribünden izlemek çok zor. ${cx.injuredWeeks} hafta daha sabır.`, 'Fizyoterapi sıkıcı ama dönüşüm daha güçlü olacak.']);
  if (energy < 40 && cx.matchSoon) add('tired', 70 + (40 - energy), 'bad', [`Bacaklarım kurşun gibi. Enerjim ${energy}; maçtan önce dinlenmeliyim.`, 'Böyle yorgun çıkarsam sahada sürünürüm. Biraz dinlenme şart.']);
  if (cx.acwr > 1.4) add('load', 55 + (cx.acwr - 1.4) * 60, 'bad', [`Bu hafta vücuduma çok yüklendim (yük oranı ${f1(cx.acwr)}). Sakatlık kapıda olabilir.`, 'Kaslarım alarm veriyor. Bu hafta yükü biraz azaltsam iyi olur.']);
  if (fx.fat >= 14.5) add('fat', 45 + (fx.fat - 14.5) * 10, 'bad', [`Şortum dar gelmeye başladı. Yağ oranım ${pct(fx.fat)}; sprintlerde ağırlaştığımı hissediyorum.`, `Tartı yalan söylemiyor: ${pct(fx.fat)} yağ. Beslenmeme dikkat etmeliyim.`]);
  if (cx.dMuscle >= 0.8) add('muscleUp', 40 + cx.dMuscle * 8, 'good', [`Aynaya baktım: omuzlar genişlemiş. Son haftalarda +${f1(cx.dMuscle)} kg kas!`, `Salondaki emek görünüyor (+${f1(cx.dMuscle)} kg kas). İkili mücadelede artık kolay düşmüyorum.`]);
  if (cx.dMuscle <= -0.6) add('muscleDown', 38 + -cx.dMuscle * 8, 'bad', [`Kaslarım eriyor gibi (${f1(cx.dMuscle)} kg). Salona dönmeliyim.`, 'Omuz omuza mücadelede eskisi kadar güçlü değilim. Kas kaybediyorum.']);
  if (cx.dFat <= -1.2 && fx.fat < 14) add('fatDown', 34, 'good', `Belim inceldi; yağ oranım ${pct(fx.fat)}. Hafiflemiş gibiyim.`);
  if (cx.dHeight >= 0.3 && cx.age < 21) add('grow', 22, 'info', [`Eşofmanım kısaldı! Hâlâ uzuyorum: ${f1(cx.height)} cm.`, `Boyum ${f1(cx.height)} cm oldu. Kafa toplarında işime yarar.`]);
  if (m.stress >= 65) add('stress', 50 + (m.stress - 65), 'bad', ['Kafam çok dolu. Biraz nefes almalıyım.', 'Uyurken bile maçı düşünüyorum. Bu stres beni yiyor.']);
  if (m.sleep < 6.6) add('sleep', 45 + (6.6 - m.sleep) * 20, 'bad', [`Gece ${f1(m.sleep)} saat uyudum. Gözlerim kapanıyor…`, 'Uykusuzluk antrenmanda bile belli oluyor; dikkatim dağılıyor.']);
  if (needs.social >= 70) add('lonely', 40 + (needs.social - 70), 'bad', ['Ne zamandır kimseyle oturup gülmedim. Takımla bir akşam yemeği iyi gelir.', 'Biraz yalnız hissediyorum. Arkadaşlarımı aramalıyım.']);
  if (needs.recog >= 75) add('recog', 30 + (needs.recog - 75) * 0.6, 'info', ['Kimse adımı konuşmuyor. Kendimi göstermeliyim.', 'Taraftarla daha çok buluşmalıyım; beni tanısınlar.']);
  if (needs.achieve >= 75) add('achieve', 42 + (needs.achieve - 75) * 0.6, 'info', ['Kendime bir şey kanıtlamam lazım. Bir gol, bir iyi maç…', 'İçimde bir ateş var: sahada iz bırakmalıyım.']);
  if (needs.security >= 70) add('money', 35 + (needs.security - 70) * 0.5, 'bad', 'Hesaptaki para eriyor. Harcamalarıma dikkat etmeliyim.');
  if (needs.rest >= 75) add('restNeed', 40 + (needs.rest - 75) * 0.6, 'bad', 'Bir gün hiçbir şey yapmadan dinlenmeye ihtiyacım var.');
  if (m.conf >= 78) add('confHigh', 35 + (m.conf - 78), 'good', ['Kendimi durdurulamaz hissediyorum. Kale gözüme kocaman görünüyor.', 'Şu an topa ne yapsam oluyor. Bu formu bırakmamalıyım.']);
  if (m.conf <= 32) add('confLow', 48 + (32 - m.conf) * 0.6, 'bad', ['Son maçlarda hiçbir şey tutmuyor. Kafamı toplamam lazım.', 'Kendime güvenim azaldı. Küçük bir başarı bile iyi gelirdi.']);
  if (cx.rival && cx.rival.goals > cx.goals + 2) add('rival', 30, 'info', `${cx.rival.name} bu sezon ${cx.rival.goals} gol attı, ben ${cx.goals}. Onu geçmeliyim.`);
  if (cx.bigNext) add('bigNext', 44, 'good', [`Bu hafta ${cx.bigNext} maçı var. Bu maçlar için oynuyorum!`, `${cx.bigNext} maçı yaklaşıyor. Şimdiden heyecanlıyım.`]);
  if (cx.newTrait) {
    const t = TRAITS[cx.newTrait];
    if (t) add('trait', 66, t.tone === 'bad' ? 'bad' : 'good', `Fark ettim ki artık "${t.name}" oldum. ${cx.traitHow || ''}`.trim());
  }
  if (cx.expect) add('expect', 50, 'info', `${cx.expect.who} benden ${cx.expect.text} istedi. ${cx.expect.left > 0 ? `${cx.expect.left} hafta kaldı.` : 'Süre doldu.'}`);
  if (cx.goal) add('goal', 26, 'info', `Kendime söz verdim: ${cx.goal.text}. ${cx.goal.progress != null ? `%${cx.goal.progress} tamam.` : ''}`.trim());
  if (cx.memory) {
    const mm = cx.memory;
    const s = 22 + Math.abs(mm.val) * mm.int * 40;
    add(`mem_${mm.id}`, s, mm.val > 0 ? 'good' : 'bad', mm.val > 0 ? [`Hâlâ şunu düşünüyorum: ${mm.text}. O his geri gelsin.`, `${mm.text}… Bu anıyı hiç unutmayacağım.`] : [`${mm.text}… Bunu kafamdan atmalıyım.`, `Aklım hâlâ şurada: ${mm.text}. Bir sonraki maçta telafi edeceğim.`]);
  }
  if (cx.diet === 'free' && fx.fat >= 13) add('diet', 32, 'info', 'Serbest beslenme keyifli ama belimde iz bırakıyor.');
  add('calm', 10, 'good', ['Her şey yolunda. Çalışmaya devam.', 'Bugün kendimi iyi hissediyorum. Adım adım.', 'Rutinim oturdu. Sabır ve emek.']);
  return out;
}

/** Haftanın düşüncesi (son düşünce anahtarlarını tekrarlamaz) */
export function pickThought(cx, recentKeys = []) {
  const list = candidates(cx).map((c) => ({ ...c, score: c.score * (recentKeys.includes(c.key) ? 0.45 : 1) }));
  list.sort((a, b) => b.score - a.score);
  return list[0];
}

/**
 * Öneri motoru: haftanın aksiyonlarını beklenen faydaya göre sıralar.
 * can(id) → boolean; @returns {{id:string, score:number, why:string}[]}
 */
export function advise(cx, can) {
  const { fx, m, needs, energy } = cx;
  const A = [];
  const add = (id, score, why) => { if (score > 0 && can(id)) A.push({ id, score: Math.round(score), why }); };
  add('rest', (60 - energy) * 1.2 + needs.rest * 0.45 + (m.sleep < 7 ? 15 : 0) + (cx.matchSoon && energy < 55 ? 22 : 0) + (cx.acwr > 1.35 ? 20 : 0),
    energy < 50 ? `Enerjin ${energy}: maça dinç çık` : m.sleep < 7 ? 'Uykunu toparla' : cx.acwr > 1.35 ? 'Yük oranın yüksek' : 'Toparlan');
  add('train', 42 + needs.achieve * 0.25 - (energy < 35 ? 60 : 0) + (m.focus >= 60 ? 6 : 0) - (cx.acwr > 1.45 ? 25 : 0),
    m.focus >= 60 ? `Odağın iyi (${m.focus}): verim yüksek` : 'Gelişim ana kaynağın');
  add('gym', 26 + (fx.fat > 13.5 ? 20 : 0) + (cx.musclePush ? 16 : 0) - (cx.sore > 40 ? 26 : 0) - (energy < 35 ? 40 : 0) - (cx.acwr > 1.45 ? 22 : 0),
    fx.fat > 13.5 ? 'Koşu bandı yağ yakar' : cx.musclePush ? 'Kas kütlen gelişmeye açık' : 'Güç ve kondisyon');
  add('team', needs.social * 0.6 + (cx.teammates < 50 ? 16 : 0) - (cx.money < 600 ? 30 : 0),
    needs.social >= 60 ? 'Yalnız hissediyorsun' : 'Takımla bağ kur');
  add('media', needs.recog * 0.5 + (cx.fans < 50 ? 10 : 0) - (m.focus < 45 ? 12 : 0), 'Taraftar ve tanınma');
  add('manager', (cx.manager < 45 ? 30 : 4) + (cx.selectionGap != null && cx.selectionGap < 3 && cx.selectionGap > -6 ? 14 : 0), cx.manager < 45 ? 'Hocayla aran soğuk' : 'Forma durumunu öğren');
  add('drill', 18 + needs.achieve * 0.12 - (energy < 30 ? 30 : 0), 'Zayıf ayak / beceri yıldızı');
  return A.sort((a, b) => b.score - a.score);
}

/** Beslenme önerisi (gerekirse) */
export function dietAdvice(cx) {
  const { fx } = cx;
  if (fx.fat >= 14.5 && cx.diet !== 'cut' && cx.diet !== 'chef') return { id: 'cut', why: `Yağ oranın ${pct(fx.fat)}: Yağ yakımı planına geç` };
  if (cx.gymrat && cx.diet === 'balanced' && fx.fat < 13) return { id: 'protein', why: 'Bu kadar salona yüksek protein şart' };
  if (cx.diet === 'cut' && fx.fat <= 9.5) return { id: 'balanced', why: `Yağ oranın ${pct(fx.fat)}: yeterince kuru, dengeliye dön` };
  if (cx.diet === 'free' && fx.fat >= 12.5) return { id: 'balanced', why: 'Serbest beslenme beline gidiyor' };
  return null;
}

// ─────────────────────────── kişisel hedefler ───────────────────────────
/** Beyin zayıf noktayı seçer ve bir hedef koyar */
export function chooseGoal(cx, now) {
  const { fx, m } = cx;
  const at = (weeks) => now + weeks;
  if (fx.fat > 14) return { id: 'fat', metric: 'fat', dir: -1, target: round1(fx.fat - 1.5), start: round1(fx.fat), due: at(5), text: `yağ oranını ${pct(fx.fat - 1.5)} altına indirmek` };
  if (cx.musclePush && cx.position !== 'MF') return { id: 'muscle', metric: 'muscle', dir: 1, target: round1(cx.muscle + 1), start: round1(cx.muscle), due: at(8), text: '1 kg kas kazanmak' };
  if (m.sleep < 7) return { id: 'sleep', metric: 'sleep', dir: 1, target: 7.5, start: m.sleep, due: at(4), text: 'uykumu 7,5 saate çıkarmak' };
  if (cx.teammates < 45) return { id: 'mates', metric: 'teammates', dir: 1, target: Math.min(100, cx.teammates + 12), start: cx.teammates, due: at(6), text: 'takımla aramı düzeltmek' };
  if (cx.habitTrain < 2) return { id: 'train', metric: 'trainCount', dir: 1, target: 8, start: 0, due: at(4), text: '4 haftada 8 antrenman yapmak', count: true };
  if (m.conf < 45 && cx.position !== 'DF') return { id: 'contrib', metric: 'contrib', dir: 1, target: 3, start: 0, due: at(5), text: '5 haftada 3 gol ya da asist', count: true };
  return { id: 'stars', metric: 'stars', dir: 1, target: 7, start: 0, due: at(4), text: '4 haftada antrenmanda 7 yıldız toplamak', count: true };
}

/** Hedef ilerlemesi (0–100) */
export function goalProgress(g, v) {
  if (!g) return 0;
  if (g.count) return clamp(Math.round(((g.acc || 0) / g.target) * 100), 0, 100);
  const span = g.target - g.start;
  if (Math.abs(span) < 1e-6) return 100;
  return clamp(Math.round(((v - g.start) / span) * 100), 0, 100);
}

export { DIETS };
