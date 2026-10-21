// SOSYAL YAŞAM — kafe, bar, ev partisi; arkadaşlar, takım arkadaşları ve (18+) romantik ilişkiler.
//
// Akış: mekân + seviye + kişi seç → 3 diyalog anı (açılış + 2 konu), her birinde 4 cevap →
// karşındakinin kişiliğine göre ilişki puanı değişir → çıkış sonunda para, enerji, moral ve ilişkiler işlenir;
// rastgele sosyal olaylar (paparazzi, hayran, kavga, yeni biriyle tanışma…) socialEvents.js'ten gelir.
import { questsOn } from '../quests.js';
import { shiftAttitude } from '../attitude.js';
import { CLUB_BY_ID } from '../data.js';
import { chance, clamp, pick, round1, shuffle } from '../rng.js';
import { changeEnergy, changeFame, changeMorale, changeRel } from '../player.js';
import { MentorManager } from '../mentor/index.js';
import {
  FRIEND_STAGES, PEOPLE, PERSON_BY_ID, ROMANCE_STAGES, SOCIAL_RULES, TONES, VENUES, localizePeople,
} from './data.js';
import { BEATS, OPENERS } from './dialogues.js';
import { BEATS2, CLOSERS2, CONTEXT_BEATS, OPENER_SETS, OPENERS2, REACTIONS2 } from './dialogues2.js';
import { isWinterWeek, monthName, weekWeather } from '../weather.js';
import { ensureHome, homeOf, homeScore } from './home.js';
import { rollSocialEvents } from './events.js';
import { changePersona } from '../character.js';
import { brainNote } from '../brain/ledger.js';

export * from './data.js';
export * from './home.js';
export { BEATS } from './dialogues.js';

const weekIndex = (s) => (s.calendar.season - 1) * 100 + s.calendar.week;

export function ensureSocial(state) {
  localizePeople(state.player?.nationality || 'tr', String(state.player?.name || '').split(' ')[0]);
  const s = state.social || (state.social = {});
  s.rel = s.rel || {};
  for (const p of PEOPLE) {
    if (!s.rel[p.id]) s.rel[p.id] = { v: p.start, met: p.kind === 'friend', last: 0 };
  }
  s.partner = s.partner ?? null;
  s.week = s.week || { key: '', n: 0 };
  s.log = s.log || [];
  s.outings = s.outings || 0;
  ensureHome(state);
  return s;
}

export const romanceAllowed = (state) => (state.player.age || 0) >= SOCIAL_RULES.romanceMinAge;

const stageOf = (kind, v) => {
  const list = kind === 'romance' ? ROMANCE_STAGES : FRIEND_STAGES;
  let st = list[0];
  for (const x of list) if (v >= x.min) st = x;
  return st;
};

/** Takım arkadaşı kişileri: kadrodan 3 kişi (en yakın yaştakiler) */
function teammates(state) {
  let squad = [];
  try {
    squad = new MentorManager(state).squad();
  } catch {
    return [];
  }
  const age = state.player.age;
  const club = CLUB_BY_ID[state.career.clubId];
  return squad
    .slice()
    .sort((a, b) => Math.abs(a.age - age) - Math.abs(b.age - age))
    .slice(0, 3)
    .map((p) => ({
      id: `tm:${p.id}`,
      kind: 'teammate',
      name: p.name.split(' ')[0],
      full: p.name,
      job: `Takım arkadaşın · ${p.age} yaş · #${p.number}`,
      look: p.avatar,
      clothes: club?.colors || ['#1e293b', '#e2e8f0'],
      number: p.number,
      likes: ['humble', 'funny'],
      dislikes: ['cocky'],
      venues: ['cafe', 'bar', 'home'],
      start: 35,
    }));
}

function personById(state, id) {
  if (id?.startsWith('tm:')) return teammates(state).find((t) => t.id === id) || null;
  return PERSON_BY_ID[id] || null;
}

/** Görünür kişiler (rehber) */
export function socialContacts(state) {
  const s = ensureSocial(state);
  const list = [...PEOPLE.filter((p) => p.kind === 'friend'), ...teammates(state)];
  if (romanceAllowed(state)) list.push(...PEOPLE.filter((p) => p.kind === 'romance' && s.rel[p.id]?.met));
  return list.map((p) => {
    const r = s.rel[p.id] || (s.rel[p.id] = { v: p.start, met: true, last: 0 });
    return { ...p, value: Math.round(r.v), stage: stageOf(p.kind, r.v), partner: s.partner === p.id };
  });
}

function weekKey(state) {
  return `${state.calendar.season}-${state.calendar.week}`;
}

export function outingsLeft(state) {
  const s = ensureSocial(state);
  if (s.week.key !== weekKey(state)) return SOCIAL_RULES.maxOutingsPerWeek;
  return Math.max(0, SOCIAL_RULES.maxOutingsPerWeek - s.week.n);
}

/** Mekân seviyesi + ev partisinin ücreti (ev büyüdükçe artar) */
export function venueTier(state, venueId, tierId) {
  const v = VENUES[venueId];
  const t = v?.tiers.find((x) => x.id === tierId) || v?.tiers[0];
  if (!t) return null;
  if (venueId === 'home') {
    const hs = homeScore(state);
    return { ...t, name: homeOf(state).name, prestige: Math.min(3, 1 + Math.floor(hs.prestige / 12)), price: t.price + hs.prestige * 20 };
  }
  return t;
}

export function canGoOut(state, venueId, tierId, companionId) {
  const { calendar, player, career } = state;
  if (calendar.phase !== 'week') return { ok: false, reason: 'Sezon arası.' };
  if (calendar.slots <= 0) return { ok: false, reason: 'Bu hafta zamanın kalmadı.' };
  if (outingsLeft(state) <= 0) return { ok: false, reason: `Haftada en fazla ${SOCIAL_RULES.maxOutingsPerWeek} sosyal etkinlik.` };
  const t = venueTier(state, venueId, tierId);
  if (!t) return { ok: false, reason: 'Mekân bulunamadı.' };
  if (player.energy < Math.abs(t.energy) + 5) return { ok: false, reason: 'Çok yorgunsun, önce dinlen.' };
  if (career.money < t.price) return { ok: false, reason: 'Paran yetmiyor.' };
  if (companionId && companionId !== 'alone') {
    const p = personById(state, companionId);
    if (!p) return { ok: false, reason: 'Kişi bulunamadı.' };
    if (p.kind === 'romance' && !romanceAllowed(state)) return { ok: false, reason: 'Bu buluşma 18 yaşından sonra açılır.' };
    if (!p.venues.includes(venueId)) return { ok: false, reason: `${p.name} ${VENUES[venueId].name.toLocaleLowerCase('tr')} pek sevmez.` };
  }
  return { ok: true };
}

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

/**
 * Buluşmayı hazırlar (durumu değiştirmez). companionId 'alone' olabilir (yalnız çıkış: tanışma şansı).
 */
/** Sohbet bağlamı: son maç, sakatlık, teklifler, milli takım, hoca, kupa, kış, rakip… */
export function talkContext(state) {
  const lm = state.career.lastMatch || null;
  const wk = weekWeather(state);
  const cup = state.cup;
  const ctx = {
    last: lm,
    injured: (state.flags.injuredWeeks || 0) > 0,
    offers: !!state.pending.offers?.list?.length,
    national: (state.national?.log?.[0]?.s === state.calendar.season) && state.calendar.week - (state.national.log[0].w || 0) <= 3,
    coachNew: state.coach?.reason === 'sacked' && state.coach.since?.s === state.calendar.season && state.calendar.week - state.coach.since.w <= 6,
    cup: !!cup && !cup.out && !cup.winner && ['qf', 'sf', 'f'].includes(cup.stage),
    winter: isWinterWeek(state.calendar.week),
    bench: (state.flags.benchStreak || 0) >= 2,
    fame: state.player.fame || 0,
    rival: state.rival?.name || null,
  };
  ctx.vars = {
    opp: lm?.opp || 'son', score: lm?.score || '', goals: String(state.career.season?.goals || 0), coach: state.coach?.name || 'hoca',
    rival: state.rival?.name || 'rakibin', month: monthName(state.calendar.week), weather: (wk?.name || 'güzel').toLocaleLowerCase('tr'), pos: '',
  };
  return ctx;
}

export function startOuting(state, { venueId, tierId, companionId }) {
  const s0 = ensureSocial(state);
  s0.seen ||= {};
  const check = canGoOut(state, venueId, tierId, companionId);
  if (!check.ok) return { ok: false, reason: check.reason };
  const t = venueTier(state, venueId, tierId);
  const alone = !companionId || companionId === 'alone';
  const p = alone ? null : personById(state, companionId);
  const kind = p?.kind || 'alone';
  const vars = { name: p?.name || '', me: state.player.name.split(' ')[0], club: CLUB_BY_ID[state.career.clubId]?.name || '', venue: t.name };

  const beats = [];
  if (!alone) {
    const ctx = talkContext(state);
    Object.assign(vars, ctx.vars);
    // Kişi başına son görülen anlar ve açılışlar: tükenene kadar tekrar yok
    const seen = (s0.seen[p.id] ||= []);
    const fresh = (b) => !seen.includes(b.id);
    // Açılış: mekâna göre geniş havuzdan (son kullanılan hariç) + rastgele cevap seti
    const recentOpen = ((s0.lastOpener ||= {})[p.id] = [].concat(s0.lastOpener[p.id] || []));
    const allOpen = OPENERS2[venueId] || OPENERS[venueId];
    const openers = allOpen.filter((l) => !recentOpen.includes(l));
    const line = pick(openers.length ? openers : allOpen);
    s0.lastOpener[p.id] = [...recentOpen, line].slice(-5);
    let opts = pick(OPENER_SETS[venueId]).slice();
    if (kind !== 'romance') opts = opts.map((o) => (o.tone === 'flirty' ? { tone: venueId === 'bar' ? 'deep' : 'funny', text: pick(venueId === 'bar' ? ['Seninle böyle oturmayı özlemişim.', 'Bu akşam tam ihtiyacım olan şeydi.'] : ['Kahvesi güzel ama asıl tatlıları efsane!', 'Sohbet ilaç gibi geldi.']) } : o));
    beats.push({ id: `open_${venueId}`, line: fill(line, vars), options: shuffle(opts.map((o) => ({ ...o, text: fill(o.text, vars) }))) });
    const fits = (b) => b.kinds.includes(kind) && (!b.venues || b.venues.includes(venueId));
    // Önce duruma bağlı bir an (son maç, sakatlık, transfer…), sonra geniş havuz
    const ctxPool = shuffle(CONTEXT_BEATS.filter((b) => fits(b) && b.when(ctx) && fresh(b)));
    let genPool = shuffle([...BEATS, ...BEATS2].filter((b) => fits(b) && fresh(b)));
    if (genPool.length < SOCIAL_RULES.beatsPerOuting) {
      // hepsi görüldüyse geçmişi sıfırla
      s0.seen[p.id] = seen.slice(-4);
      genPool = shuffle([...BEATS, ...BEATS2].filter((b) => fits(b) && !s0.seen[p.id].includes(b.id)));
    }
    const chosen = [...ctxPool.slice(0, 1), ...genPool].slice(0, SOCIAL_RULES.beatsPerOuting - 1);
    for (const b of chosen) {
      beats.push({ id: b.id, line: fill(b.line, vars), options: shuffle(b.options.map((o) => ({ ...o, text: fill(o.text, vars) }))) });
      s0.seen[p.id].push(b.id);
    }
    s0.seen[p.id] = s0.seen[p.id].slice(-24);
  }
  return {
    ok: true,
    outing: { venueId, tierId: t.id, venueName: t.name, palette: t.palette, companionId: alone ? 'alone' : p.id, kind, person: p, beats, i: 0, score: 0, picks: [], vars },
  };
}

/** Bir cevabın ilişki etkisi */
export function toneDelta(person, kind, tone, relValue = 0) {
  let d = TONES[tone]?.base ?? 0;
  if (person?.likes?.includes(tone)) d += 4;
  if (person?.dislikes?.includes(tone)) d -= 5;
  if (tone === 'flirty') {
    if (kind !== 'romance') d = -2;
    else if (relValue < 15) d -= 1; // ilk buluşmada fazla flört
  }
  return d;
}

/**
 * Cevap seçimi: ilişki puanı + karşındakinin tepkisi. Buluşmayı bir sonraki ana taşır.
 * @returns {{tone:string, delta:number, mood:'positive'|'neutral'|'negative', reply:string, done:boolean}}
 */
export function answerOuting(state, outing, optIndex) {
  const s = ensureSocial(state);
  const beat = outing.beats[outing.i];
  const opt = beat?.options[optIndex];
  if (!opt) return null;
  const rel = s.rel[outing.companionId]?.v ?? 0;
  const delta = toneDelta(outing.person, outing.kind, opt.tone, rel);
  outing.score += delta;
  outing.picks.push(opt.tone);
  if (opt.tone === 'cocky' || opt.tone === 'humble') shiftAttitude(state, `social_${opt.tone}`);
  const mood = delta >= 4 ? 'positive' : delta >= 0 ? 'neutral' : 'negative';
  const pool = REACTIONS2[outing.kind] || REACTIONS2.friend;
  outing.i += 1;
  // aynı buluşmada aynı tepki iki kez çıkmasın
  outing.used ||= [];
  const options = pool[mood].filter((r) => !outing.used.includes(r));
  const reply = pick(options.length ? options : pool[mood]);
  outing.used.push(reply);
  return { tone: opt.tone, delta, mood, reply: fill(reply, outing.vars), done: outing.i >= outing.beats.length };
}

/**
 * Buluşmayı bitirir: para, enerji, moral, ilişkiler, aşama değişimi ve rastgele olaylar.
 * @returns {{changes:Array<{key:string,label:string,delta:number}>, closer:string, mood:string, stage:{from:string,to:string}|null, events:Array, met:object|null}}
 */
export function finishOuting(state, outing) {
  const s = ensureSocial(state);
  const p = state.player;
  const t = venueTier(state, outing.venueId, outing.tierId);
  const before = { money: state.career.money, energy: p.energy, morale: p.morale, teammates: p.rel.teammates, fame: p.fame };
  state.career.money -= t.price;
  changeEnergy(p, t.energy);
  const avg = outing.beats.length ? outing.score / outing.beats.length : 2;
  changeMorale(p, t.morale + clamp(Math.round(avg), -3, 4));
  if (t.prestige >= 3) changeFame(p, 0.5);
  if (outing.venueId === 'home') changeRel(p, 'teammates', 2);
  // Kişilik: gece hayatı profesyonelliği, takımla vakit liderliği etkiler
  if (outing.venueId === 'bar') changePersona(state, 'professionalism', -0.5);
  if (outing.personKind === 'teammate' || outing.kind === 'teammate') changePersona(state, 'leadership', 0.3);

  let stage = null;
  let mood = avg >= 3 ? 'positive' : avg >= 0 ? 'neutral' : 'negative';
  if (outing.companionId !== 'alone') {
    const r = s.rel[outing.companionId] || (s.rel[outing.companionId] = { v: outing.person.start, met: true, last: 0 });
    const prev = stageOf(outing.kind, r.v);
    r.v = clamp(round1(r.v + outing.score * 0.8 + 1), 0, 100);
    r.last = weekIndex(state);
    r.met = true;
    const next = stageOf(outing.kind, r.v);
    if (next.id !== prev.id) stage = { from: prev.label, to: next.label, up: next.min > prev.min };
    if (outing.kind === 'teammate') changeRel(p, 'teammates', clamp(Math.round(outing.score / 2) + 2, -3, 6));
    if (outing.kind === 'romance') {
      if (next.id === 'partner' || next.id === 'serious') {
        if (s.partner && s.partner !== outing.companionId) {
          // Başka biriyle birlikteyken flört: magazin riski (olaylar)
          outing.cheating = true;
        } else if (!s.partner) {
          s.partner = outing.companionId;
          stage = { from: prev.label, to: next.label, up: true, partner: true };
        }
      }
      if (s.partner === outing.companionId && r.v < ROMANCE_STAGES[2].min - 10) {
        s.partner = null;
        stage = { from: 'Sevgili', to: 'Ayrıldınız', up: false };
      }
    }
  }

  // Hafta sayacı ve zaman
  if (s.week.key !== weekKey(state)) s.week = { key: weekKey(state), n: 0 };
  s.week.n += 1;
  s.outings += 1;
  state.calendar.slots -= 1;
  questsOn(state, 'social', { kind: outing?.kind });
  brainNote(state, 'outing', { venueId: outing.venueId, kind: outing.kind }); // beyin: uyku, kalori, sosyallik
  if (stage?.partner) brainNote(state, 'partner', { name: outing.person?.name });

  const events = rollSocialEvents(state, outing, t);
  const met = events.find((e) => e.met)?.met || null;
  s.log.unshift({ s: state.calendar.season, w: state.calendar.week, text: `${t.name}${outing.person ? ` · ${outing.person.name}` : ''}${events.length ? ` · ${events.map((e) => e.short).join(', ')}` : ''}` });
  s.log.length = Math.min(s.log.length, 15);

  const changes = [
    { key: 'money', label: 'Para', delta: state.career.money - before.money },
    { key: 'energy', label: 'Enerji', delta: p.energy - before.energy },
    { key: 'morale', label: 'Moral', delta: p.morale - before.morale },
    { key: 'teammates', label: 'Takım', delta: p.rel.teammates - before.teammates },
    { key: 'fame', label: 'Ün', delta: round1(p.fame - before.fame) },
  ].filter((c) => c.delta);
  if (outing.companionId !== 'alone' && outing.score) changes.unshift({ key: "rel", label: outing.person.name, delta: round1(outing.score * 0.8 + 1) });
  return { changes, closer: fill(pick(CLOSERS2[mood]), outing.vars), mood, stage, events, met };
}

/** Hafta sonu: görüşülmeyen sevgili ilişkisi soğur; evin konforu enerji/moral verir */
export function socialOnWeekEnd(state) {
  const s = ensureSocial(state);
  const out = { decay: 0, home: null };
  if (s.partner) {
    const r = s.rel[s.partner];
    if (r && weekIndex(state) - (r.last || 0) >= 2) {
      r.v = clamp(r.v - SOCIAL_RULES.weeklyDecay, 0, 100);
      out.decay = -SOCIAL_RULES.weeklyDecay;
      if (r.v < ROMANCE_STAGES[2].min - 10) {
        out.breakup = PERSON_BY_ID[s.partner]?.name;
        s.partner = null;
      }
    }
    // Sevgili moral verir
    if (s.partner) changeMorale(state.player, 1.5);
  }
  const hs = homeScore(state);
  if (hs.weekly.energy) changeEnergy(state.player, hs.weekly.energy);
  if (hs.weekly.morale) changeMorale(state.player, hs.weekly.morale);
  out.home = hs.weekly;
  return out;
}

export function personFor(state, id) {
  return personById(state, id);
}

export const partnerOf = (state) => (state.social?.partner ? PERSON_BY_ID[state.social.partner] : null);
export { stageOf };
