// OYUN AKIŞI — hafta, aksiyonlar, maç günü, sezon sonu. Arayüz sadece bu fonksiyonları çağırır.
import {
  CLUBS, CLUB_BY_ID, GAME_WEIGHTS, LEAGUES, MAX_TRAININGS_PER_WEEK, MID_WINDOW_WEEK,
  SEASON_WEEKS, START_MONEY, STATS, TRAINING, WEEK_SLOTS,
} from './data.js';
import { chance, pick, randInt, round1, roundTo } from './rng.js';
import {
  addProgress, ageUp, changeEnergy, changeFame, changeMorale, changeRel, createPlayer, effectiveSkill, form, ovr, trainingAmount,
} from './player.js';
import { DEFAULT_FOCUS, addFocus, aiTopScorerGoals, clubRating, createWorld, evolveRatings, leagueIdIn, leagueOf, positionOf, simulateWeek, sortedTable, useWorld } from './league.js';
import { acceptOffer, generateOffers, itemEffects, wageFor, weeklyFinance } from './economy.js';
import { finalizeMatch, planMatch, selection } from './match.js';
import { pickEvent, resolveEvent } from './events.js';
import {
  RelationshipService, chirpOnInjury, chirpOnMatch, chirpOnOffers, chirpOnSeasonEnd, chirpOnTransfer, chirpOnWeekEnd, ensureChirp,
  chirpFeedSeasonEnd, chirpNationalSquad, chirpOnEurope, chirpWeekStart, chirpWelcome,
} from './chirp/index.js';
import {
  ensureMentor, gainInfluence, mentorBonus, mentorOnAction, mentorOnMatch, mentorOnSeasonEnd, mentorOnSeasonStart, mentorOnTransfer, mentorOnWeekEnd,
} from './mentor/index.js';
import {
  applyStarterOffer, assignYouthNumber, ensureNumberAfterMove, isTransferLocked, resolveStartTerms, squadClubId,
} from './onboarding/index.js';
import { random } from './rng.js';
import { agentNetworkOffers, agentSponsorMult, ensureAgent } from './agent.js';
import { NATIONAL_WEEKS, ensureNational, nationalWindow } from './national.js';
import { ballonOnEurope, ballonOnMatch, ballonRank, ballonSeasonEnd, ensureBallon } from './ballondor.js';
import { ChirpTriggerEngine, FABRICIO } from './chirp/index.js';
import { achievementsOnMatch, achievementsOnTraining, checkAchievements, ensureAchievements } from './achievements.js';
import { ensureSocial, homeScore, socialOnWeekEnd } from './social/index.js';
import { ensureGarage, garageOnWeekEnd } from './garage.js';
import { dative } from './chirp/turkish.js';
import { CUPS, STAGE_LABEL, createEurope, europeWeek, europeWinners } from './world/europe.js';
import { DIFFICULTY, coachTip, difficultyGain, ensureTraining, fatigueFactor, recordDrill, starsFor, trainingSkill } from './training.js';
import { cosmeticFame, ensureCosmetics } from './cosmetics.js';

export const SAVE_VERSION = 1;

export const emptySeasonStats = () => ({ apps: 0, starts: 0, goals: 0, assists: 0, ratingSum: 0, motm: 0 });

/**
 * Yeni kariyer.
 * setup.start: seçme kampından seçilen başlangıç teklifi (A/B/C). Yoksa eski davranış: 1. Lig'in en zayıf
 * 4 kulübünden biri. setup.number verilmezse kulüp boştaki genç numaralarından birini atar.
 * @param {{name:string, position:string, avatar?:object, number?:number, statBonus?:object, start?:import('./onboarding/offers.js').StarterOffer, tryout?:object}} setup
 */
export function newGame(setup) {
  const player = createPlayer(setup);
  const world = useWorld(createWorld(1));
  world.europe = createEurope(1, world, null);
  const pool = CLUBS.filter((c) => c.league === 'first').sort((a, b) => a.rating - b.rating).slice(0, 4);
  const club = pick(pool);
  const state = {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    player,
    career: {
      clubId: club.id,
      contract: { wage: wageFor(club.rating, ovr(player)), yearsLeft: 2 },
      money: START_MONEY,
      items: [],
      season: emptySeasonStats(),
      totals: { apps: 0, goals: 0, assists: 0, motm: 0 },
      history: [],
      awards: [],
      news: [],
      moves: 0,
      caps: 0,
    },
    calendar: { season: 1, week: 1, slots: WEEK_SLOTS, trainings: 0, phase: 'week' },
    world,
    flags: { cooldowns: {}, benchStreak: 0, rivalOffset: randInt(-3, 3), injuredWeeks: 0, suspendedWeeks: 0, trainBoostWeeks: 0, nationalSeason: 0 },
    pending: { match: null, event: null, offers: null, seasonReport: null, national: null, tournament: null },
  };
  state.career.numberHistory = [];
  state.career.loan = null;
  state.career.academy = null;
  state.career.guarantee = null;
  if (setup.start) {
    state.career.money = START_MONEY;
    applyStarterOffer(state, setup.start);
  }
  if (setup.tryout) state.career.tryout = setup.tryout;
  ensureChirp(state);
  ensureMentor(state);
  ensureAchievements(state);
  ensureAgent(state);
  ensureNational(state);
  ensureBallon(state);
  ensureSocial(state);
  ensureGarage(state);
  ensureCosmetics(state);
  // Forma numarası: seçilmez, kulüp boştaki genç numaralarından verir
  if (!setup.number) assignYouthNumber(state, random);
  else state.career.numberHistory.push({ season: 1, clubId: state.career.clubId, number: player.number, reason: 'Başlangıç' });
  // Chirp boş başlamasın: ilk haftanın maç önü kartı ve gündem
  chirpWeekStart(state);
  return state;
}

export function addNews(state, text, kind = 'info') {
  state.career.news.unshift({ s: state.calendar.season, w: state.calendar.week, text, kind });
  if (state.career.news.length > 40) state.career.news.length = 40;
}

export const currentClub = (state) => CLUB_BY_ID[state.career.clubId];
export const currentLeague = (state) => LEAGUES[leagueOf(state.career.clubId)];

// ─────────────────────────────────────────────────────────────
// HAFTALIK AKSİYONLAR
// ─────────────────────────────────────────────────────────────

export function canDoAction(state, id) {
  const { player, calendar, flags, career } = state;
  if (calendar.phase !== 'week') return { ok: false, reason: 'Sezon arası.' };
  if (calendar.slots <= 0) return { ok: false, reason: 'Bu haftaki tüm zamanını kullandın. Maç gününe geç.' };
  switch (id) {
    case 'train':
      if (flags.injuredWeeks > 0) return { ok: false, reason: 'Sakatsın, antrenman yapamazsın.' };
      if (calendar.trainings >= MAX_TRAININGS_PER_WEEK) return { ok: false, reason: `Haftada en fazla ${MAX_TRAININGS_PER_WEEK} antrenman.` };
      if (player.energy < 18) return { ok: false, reason: 'Enerjin çok düşük. Önce dinlen.' };
      return { ok: true };
    case 'team':
      if (career.money < 150) return { ok: false, reason: 'Yemek için paran yetmiyor.' };
      if (player.energy < 5) return { ok: false, reason: 'Çok yorgunsun.' };
      return { ok: true };
    case 'media':
      if (player.energy < 8) return { ok: false, reason: 'Çok yorgunsun.' };
      return { ok: true };
    case 'sponsor':
      if (player.fame < 20) return { ok: false, reason: 'Reklam çekimi için ünün 20 olmalı.' };
      if (player.energy < 12) return { ok: false, reason: 'Çok yorgunsun.' };
      return { ok: true };
    default:
      return { ok: true };
  }
}

function snapshot(state) {
  const p = state.player;
  return { energy: p.energy, morale: p.morale, manager: p.rel.manager, teammates: p.rel.teammates, fans: p.rel.fans, fame: p.fame, influence: p.influence ?? 0, money: state.career.money };
}

const DIFF_LABELS = { energy: 'Enerji', morale: 'Moral', manager: 'Hoca', teammates: 'Takım', fans: 'Taraftar', fame: 'Ün', influence: 'Nüfuz', money: 'Para' };

export function diffChanges(before, after) {
  return Object.keys(before)
    .map((k) => ({ key: k, label: DIFF_LABELS[k], delta: round1(after[k] - before[k]) }))
    .filter((c) => c.delta !== 0);
}

/** Anlık sonuçlu aksiyonlar (antrenman hariç). */
export function doAction(state, id) {
  const check = canDoAction(state, id);
  if (!check.ok) return { ok: false, text: check.reason };
  const { player, career } = state;
  const before = snapshot(state);
  let title = '';
  let text = '';

  switch (id) {
    case 'rest':
      changeEnergy(player, 30);
      changeMorale(player, 3);
      title = 'Dinlendin';
      text = pick(['Uzun bir uyku ve hafif bir yürüyüş. Bacakların yenilendi.', 'Evde film maratonu yaptın. Kafan dağıldı.', 'Masaj ve havuz: vücudun teşekkür ediyor.']);
      break;
    case 'team':
      career.money -= 150;
      changeRel(player, 'teammates', player.rel.teammates < 80 ? 6 : 3);
      changeMorale(player, 4);
      changeEnergy(player, -5);
      title = 'Takımla Yemek';
      text = pick(['Kaptan, eski maç hikâyeleriyle herkesi güldürdü.', 'Kalecinin karaoke performansı unutulmazdı.', 'Ortam harikaydı; soyunma odasında yerin sağlamlaşıyor.']);
      break;
    case 'media': {
      changeEnergy(player, -8);
      if (chance(0.15)) {
        changeRel(player, 'fans', -3);
        title = 'Yanlış Anlaşılma';
        text = 'Bir sözün bağlamından koparıldı, sosyal medyada tartışma çıktı.';
      } else {
        changeRel(player, 'fans', 5);
        changeFame(player, 1);
        changeMorale(player, 2);
        title = 'Taraftar & Medya';
        text = pick(['İmza gününde kuyruk köşeyi dönüyordu!', 'Paylaştığın antrenman videosu çok beğenildi.', 'Okul ziyaretinde çocuklarla maç yaptın.']);
      }
      break;
    }
    case 'manager': {
      changeEnergy(player, -3);
      const sel = selection(state);
      changeRel(player, 'manager', form(player) >= 6.8 ? 4 : 2);
      title = 'Hocayla Görüşme';
      if (sel.role === 'out') text = 'Hoca: "Önce iyileş, sonra konuşuruz."';
      else if (sel.gap >= 5) text = 'Hoca: "İlk 11\'in değişmez parçasısın. Böyle devam."';
      else if (sel.gap >= 0) text = 'Hoca: "Formunu koru, bu hafta oynuyorsun."';
      else if (sel.gap >= -5) text = `Hoca: "Çok yakınsın. Antrenmanda biraz daha göster." (Fark: ${-sel.gap} puan)`;
      else text = `Hoca: "Şu an rakibin önde. Gelişmen lazım." (Fark: ${-sel.gap} puan)`;
      if (sel.reason === 'tired') text += ' Ayrıca çok yorgun görünüyorsun.';
      break;
    }
    case 'sponsor': {
      const earned = roundTo((150 + player.fame * 70) * new RelationshipService(state).sponsorMultiplier() * agentSponsorMult(state), 50);
      career.money += earned;
      changeEnergy(player, -12);
      title = 'Reklam Çekimi';
      text = pick(['Bir şampuan reklamında rol aldın.', 'Spor ayakkabı kataloğu için poz verdin.', 'Bir mobil oyunun reklam yüzü oldun.']);
      break;
    }
    default:
      return { ok: false, text: 'Bilinmeyen aksiyon.' };
  }
  mentorOnAction(state, id); // takım yemeği ve hocayla görüşme kulüp nüfuzunu artırır
  state.calendar.slots -= 1;
  return { ok: true, title, text, changes: diffChanges(before, snapshot(state)) };
}

/** Antrenman başlangıcı: hangi mini oyun, hangi zorluk (Kolay/Normal/Zor etkin yeteneği kaydırır). */
export function trainingSetup(state, stat, diff = state.training?.diff || 'normal') {
  const t = TRAINING[stat];
  const base = effectiveSkill(state.player, GAME_WEIGHTS[t.game]);
  return { stat, game: t.game, title: t.title, hint: t.hint, diff, baseSkill: base, skill: trainingSkill(base, diff) };
}

export function finishTraining(state, stat, result, diff = state.training?.diff || 'normal') {
  ensureTraining(state).diff = diff;
  const { player, flags } = state;
  // Altyapı (Seçenek C): dev kulübün tesisleri antrenman gelişimini artırır
  const academyBonus = state.career.academy && state.calendar.season <= state.career.academy.untilSeason ? state.career.academy.trainingBonus || 0 : 0;
  // Evdeki spor aleti (Ev dizaynı) küçük bir antrenman bonusu verir
  const homeTrain = state.social ? homeScore(state).train : 0;
  const bonus = itemEffects(state).train + (flags.trainBoostWeeks > 0 ? 0.25 : 0) + academyBonus + homeTrain;
  const before = player.stats[stat];
  const progressBefore = player.progress[stat];
  // Çalışkan mentor: antrenman gelişim hızı ×1.2
  const mentorMult = mentorBonus(state).trainingGrowth;
  // Zorluk ve yorgunluk: zor antrenman daha çok geliştirir; yorgunken verim düşer
  const diffMult = difficultyGain(diff, result.success);
  const fatigue = fatigueFactor(player.energy);
  const gained = addProgress(player, stat, trainingAmount(result, bonus) * mentorMult * diffMult * fatigue);
  const stars = starsFor(result);
  const rec = recordDrill(state, stat, diff, stars);
  const game = TRAINING[stat].game;
  changeEnergy(player, -18);
  if (result.success) changeMorale(player, 1);
  state.calendar.slots -= 1;
  state.calendar.trainings += 1;
  achievementsOnTraining(state);
  return {
    stat, name: STATS[stat].name, before, after: player.stats[stat], gained, progress: player.progress[stat], progressBefore, success: result.success, mentorMult,
    diff, diffName: DIFFICULTY[diff]?.name || 'Normal', diffMult, fatigue, stars, best: rec.best, newBest: rec.newBest, tip: coachTip(game, result), result,
  };
}

// ─────────────────────────────────────────────────────────────
// MAÇ GÜNÜ
// ─────────────────────────────────────────────────────────────

export function getMatch(state) {
  const id = `${state.calendar.season}-${state.calendar.week}`;
  if (!state.pending.match || state.pending.match.id !== id) state.pending.match = planMatch(state);
  return state.pending.match;
}

/** Maç bittiğinde: sonuçları işler, haftayı kapatır. */
export function completeMatch(state, match) {
  const summary = finalizeMatch(state, match);
  const hg = match.isHome ? match.score.my : match.score.opp;
  const ag = match.isHome ? match.score.opp : match.score.my;
  const results = simulateWeek(state.world, match.week, { h: match.homeId, a: match.awayId, hg, ag });
  state.pending.match = null;
  // Avrupa kupaları (bu haftanın maç günü varsa); oyuncunun kulübü oynuyorsa katkısı
  const europe = europeWeek(state, match.week);
  if (europe.my) {
    const m = europe.my;
    ballonOnEurope(state, m);
    const line = `${CUPS[m.cup].name} · ${STAGE_LABEL[m.stage]}${m.md ? ` ${m.md}. maç` : ''}: ${CLUB_BY_ID[m.match.h].short} ${m.match.hg}-${m.match.ag} ${CLUB_BY_ID[m.match.a].short}${m.match.pen ? ` (pen. ${m.match.pen[0]}-${m.match.pen[1]})` : ''}`;
    addNews(state, `${line}${m.goals ? ` · ${m.goals} gol` : ''}${m.assists ? ` · ${m.assists} asist` : ''}${m.stage === 'f' && m.won ? ' · KUPA BİZİM! 🏆' : m.out ? ' · Elendik.' : ''}`, m.won ? 'good' : m.out ? 'bad' : 'info');
    if (m.stage === 'f' && m.won) state.career.awards.push({ season: state.calendar.season, title: `${CUPS[m.cup].name} Şampiyonu`, icon: 'trophy', club: state.career.clubId });
  }
  const euroTweets = chirpOnEurope(state, europe);

  // Chirp: paylaşım kartı + gazeteci tweetleri (formsuzluk, büyük performans, kulübe, yönetim)
  const chirp = chirpOnMatch(state, { summary, match });
  // Kulüp nüfuzu: oynadıkça ve iyi oynadıkça soyunma odasında sözün geçer
  summary.influence = mentorOnMatch(state, summary);

  const opp = CLUB_BY_ID[match.oppId].name;
  const resTxt = { W: 'Galibiyet', D: 'Beraberlik', L: 'Mağlubiyet' }[summary.result];
  let news = `${resTxt}: ${summary.scoreLine}`;
  if (summary.played) news += ` · Not ${summary.rating.toFixed(1)}`;
  if (summary.goals) news += ` · ${summary.goals} gol`;
  if (summary.assists) news += ` · ${summary.assists} asist`;
  addNews(state, news, summary.result === 'W' ? 'good' : summary.result === 'L' ? 'bad' : 'info');
  if (!summary.played) addNews(state, `${opp} maçında forma giymedin.`, 'bad');

  // Altın Krampon gibi kozmetiklerin küçük ün etkisi
  const cf = cosmeticFame(state);
  if (cf && summary.played) changeFame(state.player, cf);
  achievementsOnMatch(state, summary, match);
  ballonOnMatch(state, summary);
  // Devre arası: Altın Top yarışında ilk 10'daysan transfer gazetecisi yazar
  if (state.calendar.week === MID_WINDOW_WEEK) {
    const rank = ballonRank(state);
    if (rank <= 10) chirp.push(new ChirpTriggerEngine(state).post(FABRICIO, 'ballon', 'Altın Top yarışında ara sıralama: {player} {rank}. sırada! Avrupa devleri gözlerini Türkiye\'ye çevirdi.', { rank }));
  }
  const weekEnd = endWeek(state, { summary });
  return { summary, results, weekEnd, europe, chirp: [...chirp, ...euroTweets, ...weekEnd.chirp] };
}

function endWeek(state, ctx) {
  const { player, career, calendar, flags } = state;
  const fin = weeklyFinance(state);
  career.money += fin.net;
  if (fin.agent && state.agent) state.agent.paid = (state.agent.paid || 0) + fin.agent;
  const fx = itemEffects(state);
  const before = snapshot(state);

  changeEnergy(player, 35 + fx.energy);
  changeMorale(player, (55 - player.morale) * 0.1 + fx.morale);
  if (fx.fans) changeRel(player, 'fans', fx.fans);
  if (fx.fame) changeFame(player, fx.fame * 0.3);
  if (career.money < 0) {
    changeMorale(player, -4);
    addNews(state, 'Hesabın ekside! Harcamalarını azalt.', 'bad');
  }
  if (flags.injuredWeeks > 0) flags.injuredWeeks -= 1;
  if (flags.suspendedWeeks > 0) flags.suspendedWeeks -= 1;
  if (flags.trainBoostWeeks > 0) flags.trainBoostWeeks -= 1;
  const chirpTweets = [];
  const discipline = chirpOnWeekEnd(state);
  chirpTweets.push(...discipline.tweets);
  if (discipline.outcome === 'ban') addNews(state, 'PFDK: 1 maç men cezası aldın.', 'bad');
  if (discipline.outcome === 'fine') addNews(state, `PFDK: €${discipline.fine} para cezası aldın.`, 'bad');

  // Mentorluk: buluşmasız hafta ilişkiyi düşürür; akıl hocası isen nüfuz +2; gençlerden talepler
  const mentor = mentorOnWeekEnd(state);
  if (mentor.signing) addNews(state, `${currentClub(state).short} kadrosuna genç transfer: ${mentor.signing.name} (${mentor.signing.age}).`, 'info');

  // Sosyal yaşam: sevgili ilişkisi, ev konforu (haftalık enerji/moral)
  const social = socialOnWeekEnd(state);
  if (social.breakup) addNews(state, `${social.breakup} ile yollarınız ayrıldı. Uzun süre görüşmediniz.`, 'bad');
  garageOnWeekEnd(state); // modifiyeli araba: moral, taraftar ilgisi

  const event = pickEvent(state, ctx);
  state.pending.event = event;

  let offers = null;
  // Kiralıkta / altyapıdayken devre arası transfer penceresi kapalı
  if (calendar.week === MID_WINDOW_WEEK && !isTransferLocked(state)) {
    offers = agentNetworkOffers(state, generateOffers(state, 'mid'), 'mid');
    state.pending.offers = offers.length ? { kind: 'mid', list: offers, mandatory: false } : null;
    chirpTweets.push(...chirpOnOffers(state, offers));
  }

  // Milli ara: bu hafta çağrı varsa kulüp maçından sonra kampa gidilir
  const national = nationalWindow(state);
  // Milli ara: kadro açıklaması (çağrılsan da çağrılmasan da)
  if (NATIONAL_WEEKS.includes(calendar.week)) chirpTweets.push(chirpNationalSquad(state, national));
  if (national) addNews(state, `Milli takım çağrısı: ${national.level === 'A' ? 'A Milli Takım' : national.level === 'U21' ? 'U-21' : 'U-19'} kadrosundasın!`, 'good');

  const seasonOver = calendar.week >= SEASON_WEEKS;
  if (seasonOver) calendar.phase = 'seasonEnd';
  else {
    calendar.week += 1;
    calendar.slots = WEEK_SLOTS;
    calendar.trainings = 0;
    // Chirp: yeni haftanın maç önü kartı, sakatlıklar, dünya futbolu, trendler
    chirpTweets.push(...chirpWeekStart(state));
  }
  return { finance: fin, changes: diffChanges(before, snapshot(state)), event, offers: state.pending.offers, seasonOver, discipline, chirp: chirpTweets, mentor, national, social };
}

// ─────────────────────────────────────────────────────────────
// SEZON SONU
// ─────────────────────────────────────────────────────────────

export function endSeason(state) {
  const { player, career, world, calendar, flags } = state;
  const leagueId = leagueOf(career.clubId);
  const league = LEAGUES[leagueId];
  const position = positionOf(world, career.clubId);
  const champions = Object.fromEntries(Object.values(world.leagues).map((lg) => [lg.id, sortedTable(lg)[0].id]));
  const s = career.season;
  const avg = s.apps ? round1(s.ratingSum / s.apps) : 0;
  const aiTop = aiTopScorerGoals(leagueId);

  const awards = [];
  if (position === 1) awards.push({ season: calendar.season, title: `${league.name} Şampiyonu`, icon: 'trophy', club: career.clubId });
  if (s.goals > 0 && s.goals >= aiTop) awards.push({ season: calendar.season, title: `${league.name} Gol Kralı`, icon: 'boot' });
  if (s.apps >= 14 && avg >= 7.3) awards.push({ season: calendar.season, title: `${league.name} Sezonun Oyuncusu`, icon: 'star' });
  if (player.age <= 21 && s.apps >= 10 && avg >= 7.0) awards.push({ season: calendar.season, title: 'Yılın Genç Oyuncusu', icon: 'medal' });
  for (const a of awards) {
    changeFame(player, 8);
    changeRel(player, 'fans', 5);
    changeMorale(player, 10);
    if (a.title.includes('Şampiyon')) career.money += roundTo(career.contract.wage * 4, 100);
  }
  career.awards.push(...awards);

  const record = {
    season: calendar.season,
    age: player.age,
    clubId: career.clubId,
    leagueId,
    position,
    apps: s.apps,
    starts: s.starts,
    goals: s.goals,
    assists: s.assists,
    avg,
    ovr: ovr(player),
    europe: s.europe || null,
  };
  career.history.push(record);
  career.totals.apps += s.apps;
  career.totals.goals += s.goals;
  career.totals.assists += s.assists;
  career.totals.motm += s.motm;

  // Altın Top töreni (ödüller ve turnuva belli olduktan sonra)
  const ballon = ballonSeasonEnd(state, { awards, season: calendar.season });
  if (ballon.won) {
    awards.push({ season: calendar.season, title: 'Altın Top (Ballon d\'Or)', icon: 'star', ballon: true });
    addNews(state, 'ALTIN TOP SENİN! Dünyanın en iyi oyuncusu seçildin.', 'good');
  } else if (ballon.rank <= 10) addNews(state, `Altın Top sıralamasında ${ballon.rank}. oldun.`, 'good');
  if (ballon.rank <= 10) new ChirpTriggerEngine(state).post(FABRICIO, 'ballon', ballon.won ? 'Altın Top {player:gen}! Türk futbolu için tarihi gece. 🏆' : 'Altın Top sıralaması açıklandı: {player} {rank}. sırada. Kazanan: {winner}.', { rank: ballon.rank, winner: ballon.winner });

  const ageChanges = ageUp(player);
  career.contract.yearsLeft -= 1;
  // Kulüp nüfuzu: kulüpte geçen sezon ve ödüller; mentorluk sezonu kapanır
  const influenceGain = gainInfluence(state, (s.apps >= 8 ? 2 : 0.5) + awards.length * 3);
  const mentorEnd = mentorOnSeasonEnd(state);

  // Başlangıç yolları: kiralık dönüşü / altyapıdan A takıma yükselme (tekliflerden önce)
  const startTerms = resolveStartTerms(state);
  if (startTerms) {
    addNews(state, startTerms.text, 'good');
    if (squadClubId(state) !== startTerms.prevSquadClub) mentorOnTransfer(state, startTerms.prevSquadClub);
  }

  // Yeni bir kiralık dönemi başladıysa (altyapıdan yükselip kiralanma) sezon sonu teklifleri gelmez
  const offers = isTransferLocked({ ...state, calendar: { ...calendar, season: calendar.season + 1 } }) && career.contract.yearsLeft > 0 ? [] : agentNetworkOffers(state, generateOffers(state, 'end'), 'end');
  const mustChoose = career.contract.yearsLeft <= 0;
  state.pending.offers = offers.length ? { kind: 'end', list: offers, mandatory: mustChoose } : null;
  chirpOnSeasonEnd(state, { awards });
  chirpOnOffers(state, offers);

  // Yeni sezon dünyası: küme düşme / çıkma, oyuncunun liginin sonuçları tutulur
  const nextWorld = createWorld(calendar.season + 1, evolveRatings(world), { prev: world, focus: DEFAULT_FOCUS });
  // Avrupa: bu sezonun kazananları, gelecek sezonun katılımcıları (bu sezonun tablolarından)
  const euroWinners = europeWinners(world);
  nextWorld.europe = createEurope(calendar.season + 1, nextWorld, world);
  state.world = useWorld(nextWorld);
  addFocus(nextWorld, leagueIdIn(nextWorld, career.clubId));
  const myMove = nextWorld.moves.find((m) => m.clubId === career.clubId);
  if (myMove) addNews(state, myMove.up ? `${CLUB_BY_ID[career.clubId].name} ${dative(LEAGUES[myMove.to].name)} yükseldi! 🎉` : `${CLUB_BY_ID[career.clubId].name} ${dative(LEAGUES[myMove.to].name)} düştü.`, myMove.up ? 'good' : 'bad');
  const report = {
    season: calendar.season,
    leagueId,
    position,
    champions,
    awards,
    record,
    aiTop,
    ageChanges,
    newAge: player.age,
    canRetire: player.age >= 34,
    mustRetire: player.age >= 38,
    influenceGain,
    startTerms,
    mentor: { ...mentorEnd, start: null },
    ballon,
    promotion: myMove || null,
    europe: euroWinners,
    nextCup: (() => {
      const id = Object.keys(nextWorld.europe.cups).find((k) => nextWorld.europe.cups[k].teams.includes(career.clubId));
      return id || null;
    })(),
    moves: nextWorld.moves,
  };

  calendar.season += 1;
  calendar.week = 1;
  calendar.slots = WEEK_SLOTS;
  calendar.trainings = 0;
  calendar.phase = report.mustRetire ? 'retired' : 'week';
  career.season = emptySeasonStats();
  flags.rivalOffset = randInt(-3, 3);
  flags.benchStreak = 0;
  player.energy = 100;
  state.pending.match = null;
  // Yeni sezon: kadro yaşlanır; ≤ 26 ise mentor seçimi açılır, değilse rol değişimi (gençlere akıl hocalığı)
  report.mentor.start = mentorOnSeasonStart(state);
  state.pending.seasonReport = report;
  checkAchievements(state);
  addNews(state, `Sezon ${report.season} bitti: ${league.name} ${position}. sıra.`, 'info');
  // Chirp: şampiyonlar, yükselenler; yeni sezonun ilk haftası (transferler, maç önü)
  chirpFeedSeasonEnd(state, report);
  if (calendar.phase === 'week') chirpWeekStart(state);
  return report;
}

export function takeOffer(state, offer) {
  const fromClubId = state.career.clubId;
  const text = acceptOffer(state, offer);
  chirpOnTransfer(state, offer, fromClubId);
  if (!offer.renewal) {
    const prevSquad = state.career.academy?.parentId || fromClubId;
    state.career.loan = null;
    state.career.academy = null;
    state.career.guarantee = null;
    const m = mentorOnTransfer(state, prevSquad);
    if (m.ended) addNews(state, `Mentorun ${m.ended} ile yolların ayrıldı.`, 'info');
    const n = ensureNumberAfterMove(state);
    if (n.changed) addNews(state, `Yeni kulübünde ${n.number} numaralı formayı giyeceksin.`, 'info');
    chirpWelcome(state, { ...offer, from: fromClubId });
  }
  // Pazarlıkla alınan "ilk 11 garantisi" maddesi: sezon ortasında imzalandıysa gelecek sezonu da kapsar
  if (offer.guarantee) state.career.guarantee = { untilSeason: state.calendar.season + (state.calendar.week > 1 ? 1 : 0), reason: 'contract' };
  state.pending.offers = null;
  state.pending.match = null; // eski kulübün planlanmış maçı geçersiz
  addNews(state, text, 'good');
  return text;
}

export function declineOffers(state) {
  const p = state.pending.offers;
  if (p?.mandatory) return false;
  state.pending.offers = null;
  return true;
}

export function retire(state) {
  state.calendar.phase = 'retired';
  addNews(state, `${state.player.name} futbolu bıraktı.`, 'info');
}

export function chooseEvent(state, choiceIndex) {
  const ev = state.pending.event;
  if (!ev) return null;
  const injuredBefore = state.flags.injuredWeeks || 0;
  const out = resolveEvent(state, ev.id, choiceIndex);
  state.pending.event = null;
  if ((state.flags.injuredWeeks || 0) > injuredBefore) chirpOnInjury(state, state.flags.injuredWeeks);
  return out;
}

/** Arayüz için hızlı özet. */
export function overview(state) {
  const { player, career, world, calendar } = state;
  return {
    ovr: ovr(player),
    form: form(player),
    clubRating: clubRating(world, career.clubId),
    position: positionOf(world, career.clubId),
    league: currentLeague(state),
    club: currentClub(state),
    week: calendar.week,
    season: calendar.season,
  };
}
