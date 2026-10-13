import { POSITIONS, CLUB_BY_ID, LEAGUES } from './data.js';
import { clamp, chance, pick, poisson, rand, randInt, round1, weightedPick } from './rng.js';
import { clubRating, fixtureFor, goalLambda, leagueOf } from './league.js';
import { addProgress, changeEnergy, changeFame, changeMorale, changeRel, form, ovr } from './player.js';
import { bigMatchSetup } from './mentor/index.js';

/** İlk 11 kararı: OVR + hoca ilişkisi + form + moral, rakip oyuncuya karşı. */
export function selection(state) {
  const { player, career, world, flags } = state;
  const o = ovr(player);
  const competitor = clubRating(world, career.clubId) - 3 + (flags.rivalOffset || 0);
  if (flags.injuredWeeks > 0) return { role: 'out', reason: 'injured', competitor, score: 0, gap: -99 };
  if (flags.suspendedWeeks > 0) return { role: 'out', reason: 'suspended', competitor, score: 0, gap: -99 };
  let score = o + (player.rel.manager - 50) * 0.2 + (form(player) - 6.5) * 3 + (player.morale - 50) * 0.04;
  let reason = null;
  if (player.energy < 30) {
    score -= 12;
    reason = 'tired';
  }
  const gap = Math.round(score - competitor);
  // Başlangıç sözleşmesindeki ilk 11 garantisi (alt lig / kiralık forma şartı / altyapı)
  const g = career.guarantee;
  if (g && state.calendar.season <= g.untilSeason) return { role: 'starter', reason: 'guarantee', competitor, score, gap };
  return { role: score >= competitor ? 'starter' : 'bench', reason, competitor, score, gap };
}

export const MOMENT_INTRO = {
  shot: {
    box: 'Ceza sahasında top ayağında! Kaleye doğru kaydırarak şut çek.',
    edge: 'Ceza sahası dışından fırsat! Önünde bir savunmacı var, iyi nişan al.',
    penalty: 'PENALTI! Topun başına sen geçtin. Kaleciyi avla.',
  },
  pass: {
    buildup: 'Orta sahada top sende. Topa dokun, arkadaşına doğru çiz: zaman yavaşlar. Rakip yoldaysa kavisle dolaş.',
    final: 'Son bölgede top sende! Gol pası için çiz: rakiplerin etrafından kavisli bir pas.',
  },
  tackle: {
    threat: 'Kontra atak! Rakip forvet hızla kalene geliyor.',
    duel: 'Rakip kanat oyuncusu üzerine geliyor, topu kap!',
  },
};

export const MOMENT_TITLE = { shot: 'Şut Fırsatı', pass: 'Pas Anı', tackle: 'Savunma Anı' };

function spreadMinutes(count, from, to) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const m = randInt(from, to);
    if (out.every((x) => Math.abs(x - m) >= 6)) out.push(m);
  }
  return out.sort((a, b) => a - b);
}

function makeMoment(position, minute) {
  const type = weightedPick(Object.entries(POSITIONS[position].moments));
  let context;
  if (type === 'shot') context = weightedPick([['box', 0.55], ['edge', 0.35], ['penalty', position === 'FW' ? 0.1 : 0.04]]);
  else if (type === 'pass') context = weightedPick([['buildup', 0.45], ['final', 0.55]]);
  else context = weightedPick([['threat', 0.6], ['duel', 0.4]]);
  return { minute, type, context, done: false, outcome: null };
}

export function planMatch(state) {
  const { player, career, world, calendar } = state;
  const week = calendar.week;
  const [homeId, awayId] = fixtureFor(world, career.clubId, week);
  const isHome = homeId === career.clubId;
  const myId = career.clubId;
  const oppId = isHome ? awayId : homeId;
  const sel = selection(state);

  let role = sel.role;
  let subMinute = null;
  if (role === 'bench') {
    const p = clamp(0.55 + (player.rel.manager - 50) / 150, 0.3, 0.85);
    if (chance(p)) subMinute = randInt(55, 74);
  }

  const onShare = role === 'starter' ? 1 : subMinute ? (90 - subMinute) / 90 : 0;
  const myR = clubRating(world, myId) + (role === 'starter' ? clamp((ovr(player) - sel.competitor) * 0.15, -3, 4) : 0);
  const oppR = clubRating(world, oppId);
  let lMy = goalLambda(myR, oppR, isHome) * (1 - 0.24 * onShare);
  let lOpp = goalLambda(oppR, myR, !isHome);
  if (player.position === 'DF') lOpp *= 1 - 0.14 * onShare;
  if (player.position === 'MF') lOpp *= 1 - 0.06 * onShare;

  const events = [];
  const myGoals = poisson(lMy);
  const oppGoals = poisson(lOpp);
  for (let i = 0; i < myGoals; i++) events.push({ minute: randInt(2, 90), side: 'my', kind: 'goal' });
  for (let i = 0; i < oppGoals; i++) events.push({ minute: randInt(2, 90), side: 'opp', kind: 'goal' });
  const extras = randInt(5, 8);
  const myShare = clamp(0.5 + (myR - oppR) / 120, 0.2, 0.8);
  for (let i = 0; i < extras; i++) {
    events.push({
      minute: randInt(3, 89),
      side: chance(myShare) ? 'my' : 'opp',
      kind: pick(['chance', 'chance', 'save', 'corner', 'card', 'post', 'offside']),
    });
  }
  events.sort((a, b) => a.minute - b.minute);

  let count = 0;
  let from = 5;
  if (role === 'starter') count = randInt(3, 4) + (chance(0.3) ? 1 : 0);
  else if (subMinute) {
    count = randInt(1, 2);
    from = subMinute + 3;
  }
  const moments = spreadMinutes(count, from, 88).map((m) => makeMoment(player.position, m));

  return {
    id: `${calendar.season}-${week}`,
    season: calendar.season,
    week,
    homeId,
    awayId,
    isHome,
    myId,
    oppId,
    myR: Math.round(myR),
    oppR,
    role,
    reason: sel.reason,
    subMinute,
    stoppage: randInt(1, 5),
    /** Derbi / final / zirve / kader maçı: heyecan, etkin yetenek çarpanı ve mini oyun temposu */
    big: bigMatchSetup(state, { myId, oppId, week }),
    events,
    moments,
    score: { my: 0, opp: 0 },
    tally: { rating: 0, goals: 0, assists: 0, won: 0, lost: 0, progress: [] },
  };
}

// ─────────────────────────────────────────────────────────────
// ANLATIM
// ─────────────────────────────────────────────────────────────

const T = {
  goal: [
    '{team} ağları sarstı!',
    'Köşeye nefis bir vuruş, {team} golü buldu!',
    'Kafa vuruşu, top ağlarda! {team} sevinç içinde.',
    'Karambolde top ağlarda! {team} golü attı.',
    'Uzaktan füze! {team} adına harika bir gol.',
    'Hızlı kontra atak! {team} rakibini cezalandırdı.',
  ],
  chance: ['{team} tehlikeli geldi, top az farkla auta çıktı.', '{team} pozisyona girdi ama vuruş zayıf kaldı.', '{team} baskı kuruyor, şut kalenin üstünden.'],
  save: ['{opp} kalecisi devleşti, {team} gol sevincini yarıda bıraktı.', 'Müthiş kurtarış! {team} golü kaçırdı.'],
  corner: ['{team} korner kazandı.', '{team} baskıyı artırıyor, korner kullanılacak.'],
  card: ['{team} oyuncusu sert müdahale sonrası sarı kart gördü.', 'Hakem {team} cephesine sarı kart gösterdi.'],
  post: ['DİREK! {team} golü kıl payı kaçırdı.', 'Top direkten döndü! {team} şanssız.'],
  offside: ['{team} golü buldu ama ofsayt bayrağı kalktı.', 'Ofsayt! {team} atağı kesildi.'],
};

const fill = (s, map) => s.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? '');

export function teamName(id) {
  return CLUB_BY_ID[id]?.name || id;
}

export function scoreLine(match) {
  const h = match.isHome ? match.score.my : match.score.opp;
  const a = match.isHome ? match.score.opp : match.score.my;
  return `${CLUB_BY_ID[match.homeId].short} ${h}-${a} ${CLUB_BY_ID[match.awayId].short}`;
}

/** Yapay olayı işler (gol ise skoru günceller) ve anlatım satırı döner. */
export function applyAiEvent(match, ev) {
  const team = teamName(ev.side === 'my' ? match.myId : match.oppId);
  const opp = teamName(ev.side === 'my' ? match.oppId : match.myId);
  if (ev.kind === 'goal') {
    match.score[ev.side] += 1;
    return { minute: ev.minute, kind: ev.side === 'my' ? 'goal-my' : 'goal-opp', text: `GOL! ${fill(pick(T.goal), { team, opp })} ${scoreLine(match)}` };
  }
  return { minute: ev.minute, kind: ev.kind, text: fill(pick(T[ev.kind] || T.chance), { team, opp }) };
}

/**
 * Oyuncunun anını sonuca bağlar. result: mini oyundan {success, accuracy, outcome}
 * @returns {Array<{minute,kind,text}>} anlatım satırları
 */
export function resolveMoment(match, moment, result, playerName) {
  const lines = [];
  const t = match.tally;
  const m = moment.minute;
  moment.done = true;
  moment.outcome = result.outcome;
  moment.success = !!result.success;
  moment.curve = result.curve || 0;
  const acc = clamp(result.accuracy || 0, 0, 1);

  if (moment.type === 'shot') {
    t.progress.push(['shooting', result.success ? 0.3 : 0.08]);
    if (result.success) {
      match.score.my += 1;
      t.goals += 1;
      t.won++;
      t.rating += t.goals === 1 ? 1.0 : 0.8;
      lines.push({ minute: m, kind: 'goal-me', text: `GOOOL! ${playerName} ${moment.context === 'penalty' ? 'penaltıyı gole çevirdi' : 'filelere gönderdi'}! ${scoreLine(match)}` });
    } else {
      t.lost++;
      const o = result.outcome;
      const pen = moment.context === 'penalty';
      if (o === 'save') { t.rating += pen ? -0.6 : -0.1; lines.push({ minute: m, kind: 'save', text: `${playerName} vurdu, kaleci kurtardı!` }); }
      else if (o === 'post') { lines.push({ minute: m, kind: 'post', text: `${playerName} direğe nişanladı... DİREK!` }); }
      else if (o === 'block') { t.rating -= 0.15; lines.push({ minute: m, kind: 'chance', text: `${playerName} şutunu çekti, savunma bloke etti.` }); }
      else if (o === 'timeout') { t.rating -= 0.3; lines.push({ minute: m, kind: 'chance', text: `${playerName} çok bekledi, top elinden alındı.` }); }
      else { t.rating += pen ? -0.6 : -0.25; lines.push({ minute: m, kind: 'chance', text: `${playerName} vurdu ama top ${o === 'over' ? 'üstten' : 'yandan'} auta gitti.` }); }
    }
  } else if (moment.type === 'pass') {
    t.progress.push(['passing', result.success ? 0.3 : 0.08]);
    if (result.success) {
      t.won++;
      t.rating += 0.3;
      const pGoal = moment.context === 'final' ? 0.3 + 0.25 * acc : 0.08 + 0.06 * acc;
      if (chance(pGoal)) {
        match.score.my += 1;
        t.assists += 1;
        t.rating += 0.7;
        lines.push({ minute: m, kind: 'goal-my', text: `${playerName} ölçülü bir pas çıkardı, takım arkadaşı golü attı! ASİST! ${scoreLine(match)}` });
      } else {
        const curved = Math.abs(result.curve || 0) >= 0.25;
        if (curved) t.rating += 0.1;
        lines.push({ minute: m, kind: 'pass', text: curved ? `${playerName} falsolu bir pasla savunmayı deldi.` : `${playerName} isabetli bir pasla oyunu yönlendirdi.` });
      }
    } else {
      t.lost++;
      t.rating -= moment.context === 'final' ? 0.3 : 0.4;
      const why = {
        stolen: `${playerName} çok bekledi, rakip topu ayağından aldı.`,
        out: `${playerName} pası çok sert attı, top taca çıktı.`,
        missed: `${playerName} pası boşluğa attı, kimse yetişemedi.`,
      }[result.outcome];
      lines.push({ minute: m, kind: 'chance', text: why || `Pas rakipte kaldı: ${playerName} topu kaptırdı.` });
      if (moment.context === 'buildup' && chance(0.15)) {
        match.score.opp += 1;
        lines.push({ minute: m + 1, kind: 'goal-opp', text: `Top kaybı pahalıya patladı, rakip golü buldu. ${scoreLine(match)}` });
      }
    }
  } else {
    t.progress.push(['defending', result.success ? 0.3 : 0.08]);
    if (result.success) {
      t.won++;
      t.rating += moment.context === 'threat' ? 0.55 : 0.45;
      lines.push({ minute: m, kind: 'tackle', text: `${playerName} kayarak müthiş bir müdahale yaptı, tehlike geçti!` });
    } else {
      t.lost++;
      t.rating -= 0.45;
      if (moment.context === 'threat' && chance(0.42)) {
        match.score.opp += 1;
        lines.push({ minute: m, kind: 'goal-opp', text: `${playerName} rakibini durduramadı ve top ağlarda. ${scoreLine(match)}` });
      } else {
        lines.push({ minute: m, kind: 'chance', text: `${playerName} geçildi ama kaleci gole izin vermedi.` });
      }
    }
  }
  return lines;
}

/**
 * Maç sonu: not, istatistik, para, ilişki, moral, enerji ve gelişim.
 * Durumu (state) değiştirir; arayüz için özet döner.
 */
export function finalizeMatch(state, match) {
  const { player, career } = state;
  const played = match.role === 'starter' || !!match.subMinute;
  const { my, opp } = match.score;
  const res = my > opp ? 'W' : my < opp ? 'L' : 'D';
  const t = match.tally;
  const wage = career.contract.wage;
  const tier = LEAGUES[leagueOf(career.clubId)].tier;
  const before = {
    morale: player.morale,
    energy: player.energy,
    manager: player.rel.manager,
    teammates: player.rel.teammates,
    fans: player.rel.fans,
    fame: player.fame,
  };

  let rating = null;
  if (played) {
    rating = 6.0 + t.rating + (res === 'W' ? 0.3 : res === 'L' ? -0.3 : 0);
    if (opp === 0) rating += player.position === 'DF' ? 0.4 : player.position === 'MF' ? 0.15 : 0;
    rating = clamp(round1(rating + rand(-0.2, 0.2)), 3.5, 10);
    player.ratings.push(rating);
    if (player.ratings.length > 10) player.ratings.shift();
  }

  const s = career.season;
  const bonuses = { win: 0, goals: 0, assists: 0 };
  if (played) {
    s.apps++;
    if (match.role === 'starter') s.starts++;
    s.goals += t.goals;
    s.assists += t.assists;
    s.ratingSum += rating;
    if (rating >= 8) s.motm++;
    bonuses.win = res === 'W' ? Math.round(wage * 0.1) : 0;
    bonuses.goals = Math.round(t.goals * wage * 0.15);
    bonuses.assists = Math.round(t.assists * wage * 0.08);
    state.flags.benchStreak = 0;
  } else {
    state.flags.benchStreak = (state.flags.benchStreak || 0) + 1;
  }
  const bonusTotal = bonuses.win + bonuses.goals + bonuses.assists;
  career.money += bonusTotal;

  // Moral, ilişki, ün
  changeMorale(player, (res === 'W' ? 6 : res === 'D' ? 1 : -5) + (played ? (rating - 6.5) * 3 : -5));
  if (played) changeRel(player, 'manager', (rating - 6.5) * 4);
  else changeRel(player, 'manager', -1);
  changeRel(player, 'teammates', (res === 'W' ? 2 : res === 'L' ? -1 : 0) + t.assists * 2);
  changeRel(player, 'fans', t.goals * 4 + (played ? (rating - 6.5) * 2 : -1) + (res === 'W' ? 1 : 0));
  changeFame(player, t.goals * (tier === 1 ? 1.2 : 0.7) + (rating && rating >= 8 ? 1 : 0) + (played ? 0.2 : -0.1));

  // Enerji: dayanıklılık yüksekse maç daha az yorar
  if (played) {
    const base = match.role === 'starter' ? 25 : 12;
    changeEnergy(player, -base * (1.2 - player.stats.stamina / 250));
  }

  // Maç içi gelişim
  const gained = {};
  for (const [stat, amount] of t.progress) {
    const g = addProgress(player, stat, amount);
    if (g) gained[stat] = (gained[stat] || 0) + g;
  }

  return {
    played,
    role: match.role,
    result: res,
    rating,
    goals: t.goals,
    assists: t.assists,
    score: { my, opp },
    scoreLine: scoreLine(match),
    bonuses,
    bonusTotal,
    gained,
    deltas: {
      morale: player.morale - before.morale,
      energy: player.energy - before.energy,
      manager: player.rel.manager - before.manager,
      teammates: player.rel.teammates - before.teammates,
      fans: player.rel.fans - before.fans,
      fame: round1(player.fame - before.fame),
    },
    motm: !!(rating && rating >= 8),
  };
}
