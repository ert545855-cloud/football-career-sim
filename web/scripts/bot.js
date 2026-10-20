// Otomatik oyuncu: denge testleri ve simülasyon için oyunu baştan sona oynar.
import { GAME_WEIGHTS, POSITIONS, SHOP_ITEMS } from '../src/core/data.js';
import { chance, rand } from '../src/core/rng.js';
import { canDoAction, chooseEvent, completeMatch, declineOffers, doAction, endSeason, finishTraining, getMatch, postponeMatch, takeOffer, trainingSetup } from '../src/core/game.js';
import { applyAiEvent, resolveMoment } from '../src/core/match.js';
import { getEvent } from '../src/core/events.js';
import { chooseLocker } from '../src/core/locker.js';
import { completeCupMatch, planCupMatch } from '../src/core/cup.js';
import { chooseTreatment } from '../src/core/injury.js';
import { buyItem } from '../src/core/economy.js';
import { clubRating } from '../src/core/league.js';
import { MentorManager } from '../src/core/mentor/index.js';
import { finishTournament, playNationalMatch, startTournament, tournamentEligible } from '../src/core/national.js';
import { resolveElection } from '../src/core/living.js';
import { runSummerCamp, summerCampDue } from '../src/core/summerCamp.js';

/** Mentorluk kararları: sezon başı en iyi adayı seç (Çalışkan öncelikli), haftada bir buluş, gençleri kabul et. */
export function playMentor(state) {
  const mm = new MentorManager(state);
  if (mm.canChooseMentor().ok) {
    const c = mm.candidates();
    const best = c.find((p) => p.trait === 'hardworker') || c[0];
    mm.chooseMentor(best.id);
  }
  if (state.player.energy >= 60 && mm.canMeet('coffee').ok) mm.meet(state.calendar.week % 2 ? 'coffee' : 'dinner');
  for (const r of [...state.mentor.legacy.requests]) mm.acceptRequest(r.id);
}

/** İnsan benzeri mini oyun sonucu: yetenek arttıkça başarı artar. */
export function fakeGame(skill, humanSkill = 0.5) {
  const p = Math.min(0.85, 0.18 + 0.4 * skill + 0.25 * humanSkill);
  const success = chance(p);
  return { success, accuracy: success ? rand(0.3, 1) : 0, outcome: success ? 'goal' : pickFail() };
}
const pickFail = () => ['save', 'wide', 'over', 'post', 'block'][Math.floor(Math.random() * 5)];

export function playWeek(state, humanSkill = 0.5) {
  const pos = POSITIONS[state.player.position];
  playMentor(state);
  // Aksiyonlar
  let guard = 0;
  while (state.calendar.slots > 0 && guard++ < 10) {
    const e = state.player.energy;
    if (e < 50 && canDoAction(state, 'rest').ok) { doAction(state, 'rest'); continue; }
    if (canDoAction(state, 'train').ok) {
      const stat = state.calendar.trainings === 1 ? pos.secondary : pos.primary;
      const setup = trainingSetup(state, stat);
      finishTraining(state, stat, fakeGame(setup.skill, humanSkill));
      continue;
    }
    if (state.player.rel.manager < 60 && canDoAction(state, 'manager').ok) { doAction(state, 'manager'); continue; }
    if (state.player.fame >= 20 && canDoAction(state, 'sponsor').ok) { doAction(state, 'sponsor'); continue; }
    if (canDoAction(state, 'media').ok) { doAction(state, 'media'); continue; }
    doAction(state, 'rest');
  }
  // Alışveriş: paranın %20'sinden ucuz en iyi eşyayı al
  const affordable = SHOP_ITEMS.filter((i) => i.kind !== 'use' && !state.career.items.includes(i.id) && i.price <= state.career.money * 0.2 && i.weekly <= state.career.contract.wage * 0.1);
  if (affordable.length) buyItem(state, affordable.sort((a, b) => b.price - a.price)[0].id);

  // Maç
  const match = getMatch(state);
  const timeline = [
    ...match.events.map((ev) => ({ minute: ev.minute, ev })),
    ...match.moments.map((m) => ({ minute: m.minute, m })),
  ].sort((a, b) => a.minute - b.minute);
  for (const item of timeline) {
    if (item.ev) applyAiEvent(match, item.ev);
    else {
      const w = GAME_WEIGHTS[item.m.type] || { shooting: 1 };
      let s = 0; let tw = 0;
      for (const [k, v] of Object.entries(w)) { s += state.player.stats[k] * v; tw += v; }
      resolveMoment(match, item.m, fakeGame((s / tw / 100) * (match.big?.skillMult ?? 1), humanSkill), state.player.name);
    }
  }
  const out = match.postponed ? postponeMatch(state, match) : completeMatch(state, match);

  if (state.pending.event) {
    const ev = getEvent(state.pending.event.id);
    chooseEvent(state, Math.floor(Math.random() * ev.choices.length));
  }
  // Milli ara: her çağrıya katıl (enerji çok düşükse reddetmez; bot basit)
  if (state.pending.national) playNationalMatch(state, fakeGame(0.5, humanSkill));
  if (state.pending.locker) chooseLocker(state, Math.floor(Math.random() * 2));
  if (state.pending.injury) chooseTreatment(state, 'rest');
  // Kupa maçı (hafta içi): kulüp maçı gibi oynanır
  if (state.pending.cupTie && state.calendar.phase === 'week') {
    const cm = planCupMatch(state);
    const tl = [...cm.events.map((ev) => ({ minute: ev.minute, ev })), ...cm.moments.map((m) => ({ minute: m.minute, m }))].sort((a, b) => a.minute - b.minute);
    for (const item of tl) {
      if (item.ev) applyAiEvent(cm, item.ev);
      else {
        const w = GAME_WEIGHTS[item.m.type] || { shooting: 1 };
        let sk = 0; let tw = 0;
        for (const [k, v] of Object.entries(w)) { sk += state.player.stats[k] * v; tw += v; }
        resolveMoment(cm, item.m, fakeGame(sk / tw / 100, humanSkill), state.player.name);
      }
    }
    completeCupMatch(state, cm, fakeGame(0.6, humanSkill));
    if (state.pending.injury) chooseTreatment(state, 'rest');
  }
  state.pending.coachChange = null;
  state.pending.monthAward = null;
  handleOffers(state);
  if (out.weekEnd.seasonOver) {
    if (tournamentEligible(state)) {
      startTournament(state);
      finishTournament(state, fakeGame(0.5, humanSkill));
    }
    const report = endSeason(state);
    if (state.pending.election) resolveElection(state, 'neutral');
    handleOffers(state);
    if (summerCampDue(state)) runSummerCamp(state, ['fitness', 'tactics', 'technique'][Math.floor(Math.random() * 3)]);
    return { out, report };
  }
  return { out };
}

export function handleOffers(state) {
  const p = state.pending.offers;
  if (!p) return;
  const cur = clubRating(state.world, state.career.clubId);
  const benched = state.career.season.starts < 6 || (state.flags.benchStreak || 0) >= 3;
  const sensible = p.list.filter((o) => o.outlook?.id !== 'bench');
  const best = [...(sensible.length ? sensible : p.list)].sort((a, b) => clubRating(state.world, b.clubId) - clubRating(state.world, a.clubId))[0];
  const better = clubRating(state.world, best.clubId) > cur && best.outlook?.id !== 'bench';
  if (p.mandatory || better || (benched && best.outlook?.id === 'starter')) takeOffer(state, best);
  else declineOffers(state);
}
