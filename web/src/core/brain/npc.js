// @ts-check
// ÇEVREDEKİ İNSANLAR — hoca, fizyoterapist, diyetisyen, kaptan ve ailen seni izler. Senin bedenini, alışkanlığını,
// uykunu ve stresini fark eder, konuşur; bazen bir şey ister (hedef ve süre koyar) ve süre dolunca hatırlar:
// tuttuysan güven kazanırsın, tutmadıysan hoca seni kenara çekmeyi düşünür. Aynı şeyi üst üste söylemezler.
import { pick, round1 } from '../rng.js';

const COOLDOWN = 8;

/** Gözlemciler. cx: index.js bağlamı. Her biri {key, who, text, kind, fx?, expect?} döner ya da null. */
const OBSERVERS = [
  (cx) => cx.fx.fat >= 15.5 && !cx.hasExpect('fat') && {
    key: 'coach_fat', who: cx.coach, kind: 'bad',
    text: `${cx.coach}: "Sahada ağır görünüyorsun, yağ oranın %${f1(cx.fx.fat)}. 5 hafta içinde %13,5'in altına in."`,
    fx: { manager: -2 },
    expect: {
      key: 'fat', who: cx.coach, metric: 'fat', dir: -1, target: 13.5, weeks: 5, text: "yağ oranımı %13,5'in altına indirmemi", ok: { manager: 6 }, fail: { manager: -6, doubt: 3 },
      okText: `${cx.coach}: "Hafiflemişsin, sahada fark ediliyor. Aferin."`, failText: `${cx.coach}: "Sana 5 hafta verdim, hâlâ ağırsın. Bir süre kulübeden izleyeceksin."`,
    },
  },
  (cx) => cx.traits.nightowl && !cx.hasExpect('party') && {
    key: 'coach_party', who: cx.coach, kind: 'bad',
    text: `${cx.coach}: "Geceleri dışarıda olduğunu duydum. Bu takımda profesyonel olmayan forma giymez."`,
    fx: { manager: -3 },
    expect: {
      key: 'party', who: cx.coach, metric: 'party', dir: -1, target: 0.3, weeks: 6, text: 'gece hayatını bırakmamı', ok: { manager: 5 }, fail: { manager: -5, doubt: 2 },
      okText: `${cx.coach}: "Gecelerin sakinleşti, antrenmanda farkı görüyorum. Güvenim tazelendi."`, failText: `${cx.coach}: "Sözüne güvenmiştim. Hâlâ geceleri dışarıdasın; forma garantin yok."`,
    },
  },
  (cx) => cx.traits.workhorse && cx.manager < 85 && {
    key: 'coach_work', who: cx.coach, kind: 'good', text: pick([`${cx.coach}: "Tesise ilk gelen, son çıkan sensin. Bu emeği görüyorum."`, `${cx.coach}: "Antrenmanda gösterdiğin istek takıma örnek oluyor."`, `${cx.coach}: "Böyle çalışmaya devam edersen formayı kimse elinden alamaz."`]), fx: { manager: 2 },
  },
  (cx) => cx.dMuscle8 >= 1.5 && cx.position !== 'FW' && {
    key: 'coach_strong', who: cx.coach, kind: 'good', text: `${cx.coach}: "İkili mücadelede duvar gibisin. Salondaki çalışma sahaya yansıyor."`, fx: { manager: 2 },
  },
  (cx) => cx.dMuscle8 <= -1.2 && !cx.injured && {
    key: 'coach_weak', who: cx.coach, kind: 'bad', text: `${cx.coach}: "Omuz omuza mücadelede kolay düşüyorsun. Salonu ihmal etme."`, fx: { manager: -1 },
  },
  (cx) => cx.acwrLive > 1.45 && !cx.injured && {
    key: 'physio_load', who: 'Fizyoterapist', kind: 'bad', text: `Fizyoterapist: "Bu hafta yükün çok arttı (oran ${f1(cx.acwrLive)}). Kas yırtılması riski var; bir seansı dinlenmeye çevir."`, warn: true,
  },
  (cx) => cx.m.sleep < 6.3 && {
    key: 'physio_sleep', who: 'Fizyoterapist', kind: 'bad', text: `Fizyoterapist: "Ortalama ${f1(cx.m.sleep)} saat uyuyorsun. Kaslar uykuda onarılır; böyle sakatlık riskin artıyor."`,
  },
  (cx) => cx.fx.fat >= 14 && cx.diet === 'free' && {
    key: 'diet_free', who: cx.dietitian, kind: 'info', text: `${cx.dietitian}: "Serbest beslenme beline gidiyor (%${f1(cx.fx.fat)}). Yağ yakımı planı öneririm."`,
  },
  (cx) => cx.traits.gymrat && cx.diet === 'balanced' && cx.fx.fat < 13 && {
    key: 'diet_protein', who: cx.dietitian, kind: 'info', text: `${cx.dietitian}: "Bu kadar salona yüksek protein şart, yoksa emeğin yarısı boşa gider."`,
  },
  (cx) => cx.fx.fat < 7 && {
    key: 'diet_lean', who: cx.dietitian, kind: 'bad', text: `${cx.dietitian}: "Yağ oranın %${f1(cx.fx.fat)}: çok düşük. Enerjin ve bağışıklığın düşer, sakatlığa açık olursun."`,
  },
  (cx) => cx.traits.lonewolf && {
    key: 'capt_lonely', who: cx.captain, kind: 'info', text: pick([`${cx.captain}: "Seni hiç göremiyoruz. Bu akşam takımca yemekteyiz, gel."`, `${cx.captain}: "Antrenmandan sonra hemen kaçıyorsun. Takım sahada olduğu kadar masada da kurulur."`, `${cx.captain}: "Gençler sana bakıyor; biraz aramıza karış."`]), fx: { teammates: -1 },
  },
  (cx) => cx.traits.socialite && cx.teammates < 90 && {
    key: 'capt_social', who: cx.captain, kind: 'good', text: pick([`${cx.captain}: "Soyunma odasının neşesi sensin."`, `${cx.captain}: "Takımın havası sen gelince değişti."`]), fx: { teammates: 2 },
  },
  (cx) => cx.m.stress >= 72 && {
    key: 'family_stress', who: 'Annen', kind: 'good', text: 'Annen aradı: "Sesin yorgun geliyor yavrum. Kendini bu kadar sıkma, biz hep yanındayız."', fx: { morale: 3, stress: -6 },
  },
  (cx) => cx.dWeight8 >= 4 && cx.fx.fat >= 13 && {
    key: 'fans_weight', who: 'Taraftar', kind: 'bad', text: `Tribünden ses: "Göbek mi yaptın?" Son haftalarda ${f1(cx.dWeight8)} kg aldın; taraftar fark etti.`, fx: { fans: -2 },
  },
];

const f1 = (v) => String(round1(v)).replace('.', ',');

/**
 * Haftalık gözlem: en fazla 2 konuşma (en yeni olmayan anahtarlar). @returns {any[]}
 */
export function observe(npc, cx, now) {
  const said = npc.said || (npc.said = {});
  const out = [];
  for (const ob of OBSERVERS) {
    if (out.length >= 2) break;
    let r = null;
    try { r = ob(cx); } catch { r = null; }
    if (!r) continue;
    if (said[r.key] != null && now - said[r.key] < COOLDOWN) continue;
    said[r.key] = now;
    out.push(r);
  }
  return out;
}

/** Beklentinin ölçüsü */
function metricValue(cx, metric) {
  if (metric === 'fat') return cx.fx.fat;
  if (metric === 'party') return cx.habits.party;
  if (metric === 'muscle') return cx.muscle;
  return null;
}

/**
 * Süresi dolan ya da erken tutturulan beklentiler. @returns {{done:any[], failed:any[]}}
 */
export function checkExpectations(npc, cx, now) {
  const list = npc.expect || (npc.expect = []);
  const done = [];
  const failed = [];
  npc.expect = list.filter((e) => {
    const v = metricValue(cx, e.metric);
    const ok = v != null && (e.dir < 0 ? v <= e.target : v >= e.target);
    if (ok) { done.push(e); return false; }
    if (now >= e.due) { failed.push(e); return false; }
    return true;
  });
  return { done, failed };
}
