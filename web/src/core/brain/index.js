// @ts-check
// BEYİN — oyuncunun içindeki "dinamik zekâ". Kodda "salona git → +1 güç" gibi sabit kurallar yerine,
// bir beden (boy, kilo, kas, yağ), bir zihin (stres, özgüven, odak, uyku), ihtiyaçlar, alışkanlıklar,
// anılar ve çevredeki insanların gözlemleri birbirini etkileyerek haftadan haftaya evrilir:
//   yaşadıkların → deftere yazılır → beden ve zihin hesaplanır → alışkanlık özelliğe dönüşür → iç ses konuşur
//   → hoca/fizyoterapist/diyetisyen fark eder, ister, hatırlar → sahadaki yeteneğin, yorulman, sakatlık riskin değişir.
import { CLUB_BY_ID, ITEM_BY_ID, LIVING_COST } from '../data.js';
import { changeFame, changeMorale, changeRel, ovr } from '../player.js';
import { changePersona, ensureCharacter } from '../character.js';
import { ensureGym, gymQuality } from '../gym.js';
import { fixtureFor } from '../league.js';
import { upcomingBigMatch } from '../mentor/bigMatch.js';
import { teammates } from '../locker.js';
import { clamp, round1 } from '../rng.js';
import { DIETS, bodyFx, bodyOnWeek, bodyType, createBody, fatPctOf, muscleCap, muscleIndex, recordBody, spriteBuild, weightOf } from './body.js';
import { NEEDS, NEED_KEYS, createMind, createNeeds, mindInjuryMult, mindOnWeek, mindSkillMult, mindTrainMult, moodOf } from './mind.js';
import { TRAITS, createHabits, evaluateTraits, habitsOnWeek, nearTraits, traitFx } from './traits.js';
import { addMemory, experienceCounts, memoriesOnWeek, salientMemory } from './memory.js';
import { advise, chooseGoal, dietAdvice, goalProgress, pickThought } from './voice.js';
import { checkExpectations, observe } from './npc.js';
import { brainNote, newLedger } from './ledger.js';

export { DIETS, NEEDS, NEED_KEYS, TRAITS, bodyFx, bodyType, fatPctOf, muscleIndex, muscleCap, weightOf, moodOf, brainNote, spriteBuild, nearTraits, goalProgress };

const keyOf = (state) => `${state.calendar?.season || 1}-${state.calendar?.week || 1}`;
const at = (state) => ({ s: state.calendar?.season || 1, w: state.calendar?.week || 1 });

/** Beyni kurar (eski kayıtlarda yaşa ve salon geçmişine göre beden tahmini) */
export function ensureBrain(state) {
  const b = state.brain || (state.brain = {});
  const p = state.player;
  if (!p) return b;
  if (!b.body) {
    b.body = createBody(p.position, p.age || 17);
    // eski kayıt: yaş ve salon gücü kası belirler
    const pw = state.gym?.power ?? 42;
    const extra = clamp((pw - 42) / 300, -0.05, 0.12) + clamp(((p.age || 17) - 17) * 0.012, 0, 0.09);
    if (extra) { b.body.muscle = round2(b.body.muscle * (1 + extra)); b.body.muscle0 = b.body.muscle; }
  }
  b.mind ||= createMind();
  b.needs ||= createNeeds();
  b.habits ||= createHabits();
  b.traits ||= {};
  b.memories ||= [];
  b.npc ||= { said: {}, expect: [] };
  b.diet ||= 'balanced';
  b.week ||= newLedger();
  b.load ||= { acute: 4.6, chronic: 4.6, acwr: 1 };
  b.t ??= 0;
  b.recent ||= [];
  b.log ||= [];
  b.pens ||= [];
  b.fearWeeks ??= 0;
  if (!b.body.hist.length) recordBody(b.body, keyOf(state));
  return b;
}
const round2 = (v) => Math.round(v * 100) / 100;

// ─────────────────────────── yük (akut : kronik) ───────────────────────────
/** Haftanın antrenman yükü (spor bilimi: akut/kronik yük oranı) */
export function weekLoad(w) {
  const gym = (w.gym || []).reduce((n, g) => n + (g.station === 'treadmill' ? 1.1 : g.station === 'stretch' ? 0 : 1), 0);
  return (w.train || 0) + (w.drill || 0) * 0.4 + gym + ((w.minutes || 0) / 90) * 1.6 + (w.extraStim || 0);
}
/** Şu anki (haftanın içinde) yük oranı — maç öncesi bu hafta yapılanlara göre */
export function acwrLive(state, { withMatch = true } = {}) {
  const b = ensureBrain(state);
  const acute = weekLoad(b.week) + (withMatch && b.week.minutes === 0 ? 1.6 : 0);
  return round2(acute / Math.max(3.2, b.load.chronic));
}
/** Yük oranı > 1,5: ani yüklenme riski; kronik yük çok düşükse (uzun ara) vücut maça hazırlıksız */
const acwrInjuryMult = (r, chronic) => (r > 1.5 ? 1 + Math.min(0.35, (r - 1.5) * 0.6) : 1) * (chronic < 2.5 ? 1.08 : 1);

// ─────────────────────────── sahaya etkiler ───────────────────────────
/** Maç anı etkin yetenek çarpanı (beden × zihin × deneyim özellikleri) */
export function brainSkillMult(state, type, context, match = null) {
  const b = state.brain;
  if (!b?.body) return 1;
  const fx = bodyFx(b.body);
  const tf = traitFx(b.traits);
  let body = 1;
  if (type === 'dribble' || type === 'attack') body = fx.speed;
  else if (type === 'tackle') body = fx.power ** 0.7 * fx.speed ** 0.3 * tf.tackle;
  else if (type === 'shot') body = context === 'corner' ? fx.aerial : context === 'penalty' || context === 'freekick' ? 1 : fx.power ** 0.25 * fx.speed ** 0.2;
  const pressure = context === 'penalty' || context === 'freekick' || !!match?.big;
  let mind = mindSkillMult(b.mind, { pressure });
  if (match?.big) mind *= tf.big;
  if (context === 'penalty') mind *= tf.pen;
  return clamp(body * mind, 0.82, 1.12);
}
/** Maç içi yorulma hızı çarpanı */
export function brainFatigueMult(state) {
  const b = state.brain;
  if (!b?.body) return 1;
  return clamp(bodyFx(b.body).fatigue * (b.mind.sleep < 6.5 ? 1.05 : 1), 1, 1.35);
}
/** Sakatlık riski çarpanı (yağ/kas, uyku/stres, yük oranı, özellikler) */
export function brainInjuryMult(state) {
  const b = state.brain;
  if (!b?.body) return 1;
  return clamp(bodyFx(b.body).injury * mindInjuryMult(b.mind) * traitFx(b.traits).injury * acwrInjuryMult(acwrLive(state, { withMatch: false }), b.load?.chronic ?? 4.6), 0.85, 1.7);
}
/** Antrenman gelişim çarpanı */
export function brainTrainMult(state) {
  const b = state.brain;
  if (!b?.mind) return 1;
  return clamp(mindTrainMult(b.mind) * traitFx(b.traits).train, 0.8, 1.15);
}
/** Hocanın kadro kararına beden ve güven etkisi (puan) */
export function brainSelectionAdj(state) {
  const b = state.brain;
  if (!b?.body) return 0;
  const fat = fatPctOf(b.body);
  return round1(-(fat > 15.5 ? (fat - 15.5) * 1.2 : 0) - (b.doubt > 0 ? 3 : 0) + (b.mind.conf >= 75 ? 1 : 0));
}

// ─────────────────────────── beslenme ───────────────────────────
export function canDiet(state, id) {
  const d = DIETS[id];
  if (!d) return { ok: false, reason: 'Böyle bir plan yok.' };
  if (d.minWage && (state.career?.contract?.wage || 0) < d.minWage) return { ok: false, reason: `Kişisel şef için haftalık maaşın en az €${d.minWage.toLocaleString('tr-TR')} olmalı.` };
  return { ok: true };
}
export function setDiet(state, id) {
  const c = canDiet(state, id);
  if (!c.ok) return c;
  ensureBrain(state).diet = id;
  return { ok: true };
}
export const dietCost = (state) => DIETS[state.brain?.diet]?.cost || 0;

// ─────────────────────────── bağlam ───────────────────────────
function histAgo(hist, n) {
  return hist.length > 1 ? hist[Math.max(0, hist.length - 1 - n)] : null;
}

/** Beynin kendini ve çevresini gördüğü bağlam (iç ses, öneri, gözlemciler, arayüz) */
export function brainContext(state, extra = {}) {
  const b = ensureBrain(state);
  const p = state.player;
  const body = b.body;
  const fx = bodyFx(body);
  const hist = body.hist;
  const h4 = histAgo(hist, 4);
  const h8 = histAgo(hist, 8);
  const cal = state.calendar || {};
  let captain = 'Kaptan';
  try { captain = teammates(state).find((t) => t.role === 'captain')?.name || 'Kaptan'; } catch { captain = 'Kaptan'; }
  let bigNext = null;
  try { const big = upcomingBigMatch(state); bigNext = big ? big.title : null; } catch { bigNext = null; }
  let matchSoon = true;
  try { matchSoon = !!fixtureFor(state.world, state.career.clubId, cal.week) || !!state.pending?.cupTie; } catch { matchSoon = true; }
  const items = state.career?.items || [];
  const now = b.t;
  const exp = (b.npc.expect || [])[0];
  const g = b.goal;
  const cx = {
    p, b, fx, m: b.mind, needs: b.needs, habits: b.habits, traits: b.traits,
    energy: p.energy, morale: p.morale, age: p.age, position: p.position, height: body.height, muscle: body.muscle,
    dMuscle: h4 ? body.muscle - h4.m : 0, dFat: h4 ? fatPctOf(body) - h4.f : 0, dHeight: h4 ? body.height - (h4.h || body.height) : 0,
    dMuscle8: h8 ? body.muscle - h8.m : 0, dWeight8: h8 ? weightOf(body) - h8.w : 0,
    musclePush: muscleIndex(body) < 10.9 && body.muscle < muscleCap(body) * 0.9,
    injuredWeeks: state.flags?.injuredWeeks || 0, injured: (state.flags?.injuredWeeks || 0) > 0,
    matchSoon, bigNext,
    acwr: b.load.acwr, acwrLive: acwrLive(state),
    sore: ensureGym(state).sore,
    rival: state.rival && !state.rival.retired ? { name: state.rival.name, goals: state.rival.season?.goals || 0 } : null,
    goals: state.career?.season?.goals || 0,
    coach: state.coach?.name ? `Hoca ${state.coach.name}` : 'Hoca',
    captain: `Kaptan ${captain}`.replace('Kaptan Kaptan', 'Kaptan'),
    dietitian: items.includes('nutrition') ? 'Beslenme koçun' : 'Kulüp diyetisyeni',
    diet: b.diet, gymrat: !!b.traits.gymrat,
    manager: p.rel?.manager ?? 50, teammates: p.rel?.teammates ?? 50, fans: p.rel?.fans ?? 50,
    money: state.career?.money ?? 0,
    habitTrain: b.habits.train,
    memory: salientMemory(b),
    hasExpect: (k) => (b.npc.expect || []).some((e) => e.key === k),
    expect: exp ? { who: exp.who, text: exp.text, left: exp.due - now } : null,
    goal: g ? { text: g.text, progress: goalProgress(g, goalValue(state, g)) } : null,
    ...extra,
  };
  return cx;
}

function goalValue(state, g) {
  const b = state.brain;
  if (g.metric === 'fat') return fatPctOf(b.body);
  if (g.metric === 'muscle') return b.body.muscle;
  if (g.metric === 'sleep') return b.mind.sleep;
  if (g.metric === 'teammates') return state.player.rel.teammates;
  return g.acc || 0;
}

// ─────────────────────────── haftalık döngü ───────────────────────────
/**
 * Hafta sonu: defterden beden ve zihni hesaplar, alışkanlıkları ve özellikleri günceller, insanlar konuşur.
 * ctx: { summary, match, red }
 * @returns {{news:{text:string, kind:string}[], report:any}}
 */
export function brainOnWeek(state, ctx = {}) {
  const b = ensureBrain(state);
  const p = state.player;
  const w = b.week;
  const news = [];
  const injured = (state.flags?.injuredWeeks || 0) > 0;
  const tf0 = traitFx(b.traits);
  const items = state.career?.items || [];
  const sm = ctx.summary || null;
  const persona = ensureCharacter(state)?.persona || {};
  const homeEnergy = items.map((id) => ITEM_BY_ID[id]).filter((it) => it && it.cat === 'home').reduce((n, it) => Math.max(n, it.fx?.energy || 0), 0);

  // ── yük ──
  const acute = weekLoad(w);
  const chronicPrev = b.load.chronic;
  b.load = { acute: round2(acute), chronic: round2(chronicPrev + (acute - chronicPrev) * 0.25), acwr: round2(acute / Math.max(3.2, chronicPrev)) };

  // ── anılar → zihin ──
  syncAwards(state, b);
  const mem = memoriesOnWeek(b);
  const fin = { money: state.career?.money ?? 0, weekCost: LIVING_COST + (state.career?.items || []).reduce((n, id) => n + (ITEM_BY_ID[id]?.weekly || 0), 0) };
  const r = mindOnWeek(b.mind, b.needs, w, {
    energy: p.energy, rating: sm?.played ? sm.rating : null, played: !!sm?.played, result: sm?.result || null, goals: sm?.goals || 0, motm: (sm?.rating || 0) >= 8,
    red: !!ctx.red, bench: !!(sm && !sm.played && !injured && !(state.flags?.suspendedWeeks > 0)), money: fin.money, weekCost: fin.weekCost, injured,
    managerRel: p.rel?.manager ?? 50, partner: !!state.social?.partner, professionalism: persona.professionalism ?? 50, homeSleep: homeEnergy / 20,
    load: acute, ego: state.attitude?.v ?? 0, fameGain: 0, awards: 0,
    contractEnding: (state.career?.contract?.yearsLeft ?? 2) <= 0, traitSleep: tf0.sleep, traitFocus: tf0.focus, traitSocial: tf0.social,
    memoryAffect: mem.affect, memoryStress: mem.stress, big: !!ctx.match?.big,
  });

  // ── beden ──
  const before = { w: weightOf(b.body), m: b.body.muscle, f: fatPctOf(b.body), h: b.body.height };
  const bodyR = bodyOnWeek(b.body, w, {
    age: p.age, diet: b.diet, sleep: b.mind.sleep, stress: b.mind.stress, injured,
    gymQ: gymQuality(state), muscleMult: tf0.muscle, lossMult: tf0.loss, nutrition: items.includes('nutrition'),
  });

  // ── alışkanlıklar → özellikler ──
  habitsOnWeek(b.habits, w, { injured, diet: b.diet, sleep: b.mind.sleep });
  if (!injured && b.fearWeeks > 0) b.fearWeeks -= 1;
  const tr = evaluateTraits(b.traits, b.habits, experienceCounts(b), keyOf(state));
  for (const id of tr.gained) {
    const t = TRAITS[id];
    news.push({ text: `Yeni bir yanın ortaya çıktı: ${t.icon} ${t.name}. ${b.traits[id].how}`, kind: t.tone === 'bad' ? 'bad' : 'good' });
    log(b, state, `${t.icon} ${t.name} oldun · ${t.desc}`, t.tone);
  }
  for (const id of tr.lost) {
    const t = TRAITS[id];
    news.push({ text: `${t.icon} ${t.name} artık sen değilsin: alışkanlığın değişti.`, kind: t.tone === 'bad' ? 'good' : 'info' });
    log(b, state, `${t.icon} ${t.name} özelliği kayboldu`, 'info');
  }
  const tf = traitFx(b.traits);
  for (const [k, v] of Object.entries(tf.rel)) changeRel(p, k, v);
  for (const [k, v] of Object.entries(tf.persona)) changePersona(state, k, v);
  if (tf.fame) changeFame(p, tf.fame);
  changeMorale(p, Math.round(r.morale + tf.morale + (DIETS[b.diet]?.morale || 0)));

  // ── çevredeki insanlar: beklentiler ve gözlemler ──
  const now = b.t + 1;
  const cx = brainContext(state, { acwrLive: b.load.acwr });
  const ex = checkExpectations(b.npc, cx, now);
  for (const e of ex.done) {
    applyFx(state, b, e.ok);
    news.push({ text: e.okText || `${e.who} istediğini yaptığını fark etti. Güveni arttı.`, kind: 'good' });
    log(b, state, `${e.who}: istediğini yaptın`, 'good');
    addMemory(b, { kind: 'kept', text: `${e.who} benden istediğini yaptım`, val: 0.5, int: 0.6 }, at(state));
  }
  for (const e of ex.failed) {
    applyFx(state, b, e.fail);
    news.push({ text: e.failText || `${e.who} hayal kırıklığında: istediği olmadı.`, kind: 'bad' });
    log(b, state, `${e.who}: istediği olmadı`, 'bad');
    addMemory(b, { kind: 'let_down', text: `${e.who} beni uyardı, dinlemedim`, val: -0.45, int: 0.55 }, at(state));
  }
  const talks = observe(b.npc, cx, now);
  for (const t of talks) {
    applyFx(state, b, t.fx);
    if (t.expect) b.npc.expect.push({ ...t.expect, due: now + t.expect.weeks, from: now });
    if (t.warn) b.physioWarnT = now;
    news.push({ text: t.text, kind: t.kind });
    log(b, state, t.text, t.kind);
  }
  if (b.doubt > 0) b.doubt -= 1;

  // ── kişisel hedef ──
  const goalNews = updateGoal(state, b, w, sm, now);
  if (goalNews) news.push(goalNews);

  // ── iç ses ──
  const cx2 = brainContext(state, { newTrait: tr.gained[0] || null, traitHow: tr.gained[0] ? b.traits[tr.gained[0]].how : '' });
  const th = pickThought(cx2, b.recent);
  b.thought = { text: th.text, mood: th.mood, key: th.key, t: now };
  b.recent = [th.key, ...b.recent].slice(0, 4);

  // ── kayıt ──
  b.t = now;
  recordBody(b.body, keyOf(state));
  b.week = newLedger();
  const after = { w: weightOf(b.body), m: b.body.muscle, f: fatPctOf(b.body), h: b.body.height };
  const report = {
    dWeight: round1(after.w - before.w), dMuscle: round2(after.m - before.m), dFat: round1(after.f - before.f), dHeight: round1(after.h - before.h),
    weight: round1(after.w), muscle: round1(after.m), fat: round1(after.f), surplus: bodyR.surplus,
    gained: tr.gained, lost: tr.lost, talks: talks.map((t) => t.text), thought: b.thought.text, acwr: b.load.acwr,
  };
  b.lastReport = report;
  return { news, report };
}

/** Yeni ödüller, kupalar ve milli forma anılara yazılır */
function syncAwards(state, b) {
  const aw = state.career?.awards || [];
  if (b.awardsSeen == null) { b.awardsSeen = aw.length; return; }
  for (const a of aw.slice(b.awardsSeen)) addMemory(b, { kind: a.icon === 'trophy' ? 'trophy' : 'award', text: a.title, val: 0.85, int: 0.95 }, at(state));
  b.awardsSeen = aw.length;
  if (!b.natDebut && (state.national?.caps?.A || 0) > 0) {
    b.natDebut = true;
    addMemory(b, { kind: 'national_debut', text: 'A Milli Takım formasını ilk kez giydim', val: 0.9, int: 1 }, at(state));
  }
}

/** Sezon sonu: ödüller anılara; bedenin sezon özeti (sezon başına göre) */
export function brainSeasonEnd(state) {
  const b = ensureBrain(state);
  syncAwards(state, b);
  const hist = b.body.hist;
  const season = state.calendar?.season || 1;
  const first = hist.find((h) => String(h.k).startsWith(`${season}-`)) || hist[0];
  const now = { w: weightOf(b.body), m: b.body.muscle, f: fatPctOf(b.body), h: b.body.height };
  return first ? { dWeight: round1(now.w - first.w), dMuscle: round1(now.m - first.m), dFat: round1(now.f - first.f), dHeight: round1(now.h - (first.h || now.h)), traits: Object.keys(b.traits) } : null;
}

function applyFx(state, b, fx) {
  if (!fx) return;
  const p = state.player;
  for (const k of ['manager', 'teammates', 'fans']) if (fx[k]) changeRel(p, k, fx[k]);
  if (fx.morale) changeMorale(p, fx.morale);
  if (fx.stress) b.mind.stress = clamp(b.mind.stress + fx.stress, 0, 100);
  if (fx.doubt) b.doubt = Math.max(b.doubt || 0, fx.doubt);
}

function log(b, state, text, kind = 'info') {
  b.log.unshift({ s: state.calendar?.season || 1, w: state.calendar?.week || 1, text, kind });
  if (b.log.length > 24) b.log.length = 24;
}

function updateGoal(state, b, w, sm, now) {
  let out = null;
  const g = b.goal;
  if (g) {
    if (g.count) {
      if (g.metric === 'trainCount') g.acc = (g.acc || 0) + (w.train || 0);
      if (g.metric === 'stars') g.acc = (g.acc || 0) + (w.stars || 0);
      if (g.metric === 'contrib') g.acc = (g.acc || 0) + (sm?.played ? (sm.goals || 0) + (sm.assists || 0) : 0);
    }
    const v = goalValue(state, g);
    const done = g.count ? (g.acc || 0) >= g.target : g.dir < 0 ? v <= g.target : v >= g.target;
    if (done) {
      changeMorale(state.player, 5);
      b.mind.conf = clamp(b.mind.conf + 6, 0, 100);
      addMemory(b, { kind: 'goal_done', text: `Kendime verdiğim sözü tuttum: ${g.text}`, val: 0.55, int: 0.6 }, at(state));
      log(b, state, `🎯 Kişisel hedef tamam: ${g.text}`, 'good');
      out = { text: `Kişisel hedefini tutturdun: ${g.text}. Özgüvenin arttı.`, kind: 'good' };
      b.goal = null;
      b.goalT = now;
    } else if (now >= g.due) {
      b.mind.stress = clamp(b.mind.stress + 5, 0, 100);
      log(b, state, `Kişisel hedef kaçtı: ${g.text}`, 'bad');
      out = { text: `Kendine koyduğun hedef olmadı: ${g.text}. Yeni bir plan zamanı.`, kind: 'info' };
      b.goal = null;
      b.goalT = now;
    }
  } else if (now - (b.goalT ?? -99) >= 3 && now >= 2) {
    const cx = brainContext(state);
    b.goal = chooseGoal(cx, now);
    log(b, state, `Kendine yeni bir hedef koydun: ${b.goal.text}`, 'info');
  }
  return out;
}

// ─────────────────────────── arayüz yardımcıları ───────────────────────────
/** Hub ve Beden & Zihin ekranı için: düşünce, öneriler, beslenme önerisi */
export function brainAdvice(state, can = () => true) {
  const b = ensureBrain(state);
  const cx = brainContext(state);
  if (!b.thought) {
    const th = pickThought(cx, b.recent);
    b.thought = { text: th.text, mood: th.mood, key: th.key, t: b.t };
  }
  return { thought: b.thought, actions: advise(cx, can).slice(0, 3), diet: dietAdvice(cx), cx };
}

/** Kısa özet (hub kartı, oyuncu ekranı) */
export function brainSummary(state) {
  const b = ensureBrain(state);
  const body = b.body;
  const fx = bodyFx(body);
  return {
    height: round1(body.height), weight: round1(weightOf(body)), muscle: round1(body.muscle), fat: round1(fx.fat), mi: round1(fx.mi),
    type: bodyType(body), mood: moodOf(b.mind, state.player.morale), mind: b.mind, needs: b.needs, traits: b.traits, diet: DIETS[b.diet] || DIETS.balanced,
    ovr: ovr(state.player), club: CLUB_BY_ID[state.career?.clubId]?.short || '',
  };
}
