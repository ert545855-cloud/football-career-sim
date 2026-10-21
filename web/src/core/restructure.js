// YAPI GEÇİŞİ — eski kayıtların (12 takımlı v2 dünya) süren sezonu, yüklendiği anda gerçek lig yapısına geçer.
// Kulüpler bulundukları kademede kalır (küme düşme/çıkma yok); her lig yapılandırmadaki takım sayısına
// tamamlanır ya da fazlası bir alt kademeye iner. Hafta, sezonun yeni uzunluğuna orantılı taşınır; geçmiş turlar
// yeni fikstürle simüle edilir, böylece bütün ligler aynı haftada ve tutarlı tablolarla devam eder.
import { BASE_WEEKS } from './calendar.js';
import { LEAGUES } from './data.js';
import { countryFocus, createWorld, leagueIdIn, setWorldWeeks, simulateWeek, useWorld } from './league.js';
import { createCup } from './cup.js';
import { ensureEurope, playEuropeWeek } from './world/europe.js';

/** Bu kayıt şimdi geçebilir mi? (yalnızca sezon içinde, planlanmış maç yokken) */
export function canRestructure(state) {
  const w = state?.world;
  return !!(w && (w.v || 0) < 3 && state.calendar?.phase === 'week' && !state.pending?.match && state.career?.clubId);
}

/**
 * Eski dünyayı yerinde yeni yapıya geçirir.
 * @returns {null|{fromWeek:number, week:number, weeks:number, leagueId:string, teams:number}}
 */
export function restructureLegacyWorld(state) {
  if (!canRestructure(state)) return null;
  const old = state.world;
  const clubId = state.career.clubId;
  const season = state.calendar.season;
  const oldWeeks = old.weeks || BASE_WEEKS;
  const fromWeek = state.calendar.week || 1;
  const focus = [...new Set([...(old.focus || []), ...countryFocus(LEAGUES[leagueIdIn(old, clubId)]?.country || 'tr', state.player?.nationality)])];

  const world = createWorld(old.season ?? season, old.ratings, { prev: old, noMoves: true, clubId, focus });
  // focus'taki eski lig kimlikleri yeni dünyada yoksa at
  world.focus = world.focus.filter((id) => world.leagues[id] || LEAGUES[id]?.youth);
  world.europe = old.europe || null;
  const W = setWorldWeeks(world, clubId);
  const week = Math.max(1, Math.min(W, 1 + Math.round(((fromWeek - 1) * (W - 1)) / Math.max(1, oldWeeks - 1))));
  for (let w = 1; w < week; w++) simulateWeek(world, w);

  state.world = world;
  useWorld(world);
  state.calendar.week = week;

  // Avrupa: yeni takvimde kaçan turlar oynansın (oynanmış turlar tekrar oynanmaz)
  if (world.europe) for (let w = 1; w < week; w++) playEuropeWeek(world, w);
  else ensureEurope(world, week);

  // eski fikstüre ait bekleyen maçlar geçersiz
  if (state.pending) {
    state.pending.makeups = (state.pending.makeups || []).filter((m) => m.season !== season);
    if (state.pending.cupTie && ['cup', 'makeup'].includes(state.pending.cupTie.kind)) state.pending.cupTie = null;
  }
  // kupa yeni kademelerle yeniden kurulur; oyuncunun kupadaki durumu korunur
  const oldCup = state.cup;
  if (oldCup && oldCup.season === season) createCup(state, { keep: oldCup.out ? 'out' : 'alive' });
  else state.cup = null;

  const leagueId = leagueIdIn(world, clubId);
  const info = { fromWeek, week, weeks: W, leagueId, teams: world.leagues[leagueId]?.teams.length || 0, season };
  state.flags = state.flags || {};
  state.flags.restructured = info;
  return info;
}
