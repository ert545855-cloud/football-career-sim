import { POSITIONS, CLUB_BY_ID, LEAGUES } from './data.js';
import { clamp, chance, pick, poisson, rand, randInt, round1, weightedPick } from './rng.js';
import { clubRating, fixtureFor, goalLambda, leagueOf, leaguePrestige } from './league.js';
import { addProgress, changeEnergy, changeFame, changeMorale, changeRel, form, ovr } from './player.js';
import { bigMatchSetup } from './mentor/index.js';
import { fatigueAt, weatherFor } from './weather.js';
import { contextWeights, momentWeights, styleGoals } from './coach.js';
import { matchInjuryRoll } from './injury.js';
import { goalBonusFor } from './clauses.js';
import { clubLineup, pickScorer, shortName } from './lineups.js';

/** İlk 11 kararı: OVR + hoca ilişkisi + form + moral, rakip oyuncuya karşı. */
export function selection(state) {
  const { player, career, world, flags } = state;
  const o = ovr(player);
  const competitor = clubRating(world, career.clubId) - 3 + (flags.rivalOffset || 0);
  if (flags.injuredWeeks > 0) return { role: 'out', reason: 'injured', competitor, score: 0, gap: -99 };
  if (flags.suspendedWeeks > 0) return { role: 'out', reason: 'suspended', competitor, score: 0, gap: -99 };
  // Hocanın sana bakışı (iyi notlar, rolüne uyum) ilk 11 kararını etkiler
  let score = o + (player.rel.manager - 50) * 0.2 + (form(player) - 6.5) * 3 + (player.morale - 50) * 0.04 + (state.coach?.clubId === career.clubId ? (state.coach.likes || 0) * 0.35 : 0);
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
    penalty: 'PENALTI! Topun başına sen geçtin. Kaleciyi avla. Cesursan kısa ve yavaş kaydır: Panenka!',
    freekick: 'Ceza sahası önünde serbest vuruş! Barajın üstünden aşırt ya da parmağını kıvırarak falsolu vur.',
    corner: 'Korner! Topun ineceği noktaya koş, markajdan kurtul; halka kapanınca dokun ve kafayı vur.',
  },
  pass: {
    buildup: 'Orta sahada top sende. Topa dokun, arkadaşına doğru çiz: zaman yavaşlar. Rakip yoldaysa kavisle dolaş.',
    final: 'Son bölgede top sende! Gol pası için çiz: rakiplerin etrafından kavisli bir pas.',
  },
  attack: {
    counter: 'Kontra atak! Ver-kaç pasıyla başla (ofsayta dikkat), son adamı geç ve kaleciyle karşı karşıya vur.',
    build: 'Hücum organizasyonu! Savunma çizgisinin arkasına pası tam zamanında at, dönen topla kaleyi bul.',
  },
  tackle: {
    threat: 'Kontra atak! Üç rakip paslaşarak kalene geliyor. Top sahibinin bakışını oku, koridoru kapat, pası kes!',
    duel: 'Rakipler orta sahada paslaşıyor. Bakış çizgisini izle; sürükleyerek koridoru kapat, top yanından geçerken dokun.',
  },
};

export const MOMENT_TITLE = { shot: 'Şut Fırsatı', pass: 'Pas Anı', tackle: 'Savunma Anı', attack: 'Hücum Anı' };
const CONTEXT_TITLE = { penalty: 'Penaltı', freekick: 'Serbest Vuruş', corner: 'Korner · Kafa Düellosu' };
/** Anın başlığı (duran toplarda özel) */
export const momentTitle = (m) => CONTEXT_TITLE[m.context] || MOMENT_TITLE[m.type];

function spreadMinutes(count, from, to) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const m = randInt(from, to);
    if (out.every((x) => Math.abs(x - m) >= 6)) out.push(m);
  }
  return out.sort((a, b) => a - b);
}

function makeMoment(position, minute, o = {}) {
  const type = weightedPick(Object.entries(o.weights || POSITIONS[position].moments));
  let context;
  if (type === 'shot') {
    // Duran toplar: serbest vuruş (orta saha ustası), korner kafası (forvet ve stoper), penaltı
    const w = {
      FW: [['box', 0.42], ['edge', 0.24], ['freekick', 0.1], ['corner', 0.14], ['penalty', 0.1]],
      MF: [['box', 0.3], ['edge', 0.36], ['freekick', 0.24], ['corner', 0.06], ['penalty', 0.04]],
      DF: [['box', 0.16], ['edge', 0.12], ['freekick', 0.06], ['corner', 0.62], ['penalty', 0.04]],
    }[position] || [['box', 0.55], ['edge', 0.35], ['penalty', 0.1]];
    context = weightedPick(o.ctx ? w.map(([k, v]) => [k, v * (o.ctx[k] ?? 1)]) : w);
  }
  else if (type === 'pass') context = weightedPick([['buildup', 0.45], ['final', 0.55]]);
  else if (type === 'attack') context = weightedPick([['counter', 0.6], ['build', 0.4]]);
  else context = weightedPick([['threat', 0.6], ['duel', 0.4]]);
  return { minute, type, context, done: false, outcome: null };
}

/** Yapay maç olayları: goller (Poisson) + 5-8 renk olayı (fırsat, kurtarış, korner, kart, direk, ofsayt) */
export function buildEvents(lMy, lOpp, myShare = 0.5) {
  const events = [];
  const myGoals = poisson(lMy);
  const oppGoals = poisson(lOpp);
  for (let i = 0; i < myGoals; i++) events.push({ minute: randInt(2, 90), side: 'my', kind: 'goal' });
  for (let i = 0; i < oppGoals; i++) events.push({ minute: randInt(2, 90), side: 'opp', kind: 'goal' });
  const extras = randInt(5, 8);
  for (let i = 0; i < extras; i++) {
    events.push({
      minute: randInt(3, 89),
      side: chance(myShare) ? 'my' : 'opp',
      kind: pick(['chance', 'chance', 'save', 'corner', 'card', 'post', 'offside']),
    });
  }
  return events.sort((a, b) => a.minute - b.minute);
}

/** Oyuncunun kritik anları: ilk 11'de 3-5, yedekten girince 1-2 (oyundan alınırsa o dakikaya kadar) */
export function buildMoments(position, role, subMinute = null, subOff = null, o = {}) {
  let count = 0;
  let from = 5;
  if (role === 'starter') count = randInt(3, 4) + (chance(0.3) ? 1 : 0);
  else if (subMinute) {
    count = randInt(1, 2);
    from = subMinute + 3;
  }
  return spreadMinutes(count, from, subOff ? subOff - 2 : 88).map((m) => makeMoment(position, m, o));
}

/**
 * Maç planı. o: kupa/özel maç için {homeId, awayId, id, cup, knockout, big} (verilmezse lig fikstürü)
 */
export function planMatch(state, o = {}) {
  const { player, career, world, calendar } = state;
  const week = calendar.week;
  const [homeId, awayId] = o.homeId ? [o.homeId, o.awayId] : fixtureFor(world, career.clubId, week);
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

  // Hava ve zemin: ev sahibinin şehrinde, takvimdeki aya göre
  const weather = weatherFor({ season: calendar.season, week, homeId });
  // Maç içi yorgunluk: ilk 11'de başlayıp kondisyonu çok düşerse hoca oyundan alır
  let subOff = null;
  if (role === 'starter') {
    const f75 = fatigueAt({ minute: 75, energy: player.energy, stamina: player.stats.stamina, weather });
    if (f75 > 0.36 && chance(clamp((f75 - 0.36) * 2.6, 0, 0.8))) subOff = randInt(64, 80);
  }

  const onShare = role === 'starter' ? (subOff ? subOff / 90 : 1) : subMinute ? (90 - subMinute) / 90 : 0;
  const myR = clubRating(world, myId) + (role === 'starter' ? clamp((ovr(player) - sel.competitor) * 0.15, -3, 4) : 0);
  const oppR = clubRating(world, oppId);
  // Hocanın oyun anlayışı: hücumcu daha çok atar ve yer, savunmacı az
  const sg = state.coach?.clubId === career.clubId ? styleGoals(state) : { my: 1, opp: 1 };
  let lMy = goalLambda(myR, oppR, isHome) * (1 - 0.24 * onShare) * weather.goals * sg.my;
  let lOpp = goalLambda(oppR, myR, !isHome) * weather.goals * sg.opp;
  if (player.position === 'DF') lOpp *= 1 - 0.14 * onShare;
  if (player.position === 'MF') lOpp *= 1 - 0.06 * onShare;

  const myShare = clamp(0.5 + (myR - oppR) / 120, 0.2, 0.8);
  const events = buildEvents(lMy, lOpp, myShare);

  const tactic = state.coach?.clubId === career.clubId ? { weights: momentWeights(state, POSITIONS[player.position].moments), ctx: contextWeights(state) } : {};
  const moments = buildMoments(player.position, role, subMinute, subOff, tactic);

  return {
    id: o.id || `${calendar.season}-${week}`,
    cup: o.cup || null,
    knockout: !!o.knockout,
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
    subOff,
    weather,
    energy0: player.energy,
    stoppage: randInt(1, 5),
    /** Derbi / final / zirve / kader maçı: heyecan, etkin yetenek çarpanı ve mini oyun temposu */
    big: o.big || bigMatchSetup(state, { myId, oppId, week }),
    events,
    moments,
    /** Maç kadroları (golcü/asist isimleri) ve gol listesi (skor tabelasında gösterilir) */
    lineups: { my: clubLineup(state, myId, { mine: true }), opp: clubLineup(state, oppId) },
    goals: [],
    score: { my: 0, opp: 0 },
    tally: { rating: 0, goals: 0, assists: 0, won: 0, lost: 0, progress: [] },
  };
}

/**
 * Gol kaydı: golcü ve asist isimleri. o.me → golü oyuncu attı; o.meAssist → asist oyuncunun.
 * İsim verilmezse kadrodan mevkiye göre ağırlıklı seçilir.
 */
export function recordGoal(match, side, minute, o = {}) {
  const xi = match.lineups?.[side] || [];
  const rnd = () => rand(0, 1);
  let scorer = o.scorer || null;
  let assist = o.assist;
  if (!scorer) {
    const pk = pickScorer(xi, rnd, { assistP: o.assistP ?? 0.62 });
    scorer = pk.scorer?.name || null;
    if (assist === undefined) assist = pk.assist?.name || null;
  } else if (assist === undefined) {
    const others = xi.filter((p) => p.pos !== 'GK' && p.name !== scorer);
    assist = others.length && rnd() < (o.assistP ?? 0.55) ? others[Math.floor(rnd() * others.length)].name : null;
  }
  if (assist === scorer) assist = null;
  const g = { side, minute, scorer, assist: assist || null, me: !!o.me, meAssist: !!o.meAssist, kind: o.kind || null };
  (match.goals ||= []).push(g);
  return g;
}

/** "X (asist: Y)" */
const byLine = (g) => (g?.scorer ? `${shortName(g.scorer)}${g.assist ? ` (asist: ${shortName(g.assist)})` : ''}` : '');

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
  goalS: [
    ['{scorer} ağları sarstı! {team} sevinç içinde.', 'solo'],
    ['{scorer} köşeye nefis bir vuruş yaptı, top ağlarda!', 'solo'],
    ['{scorer} uzaktan füzeyi ateşledi, top doksana!', 'long'],
    ['Karambolde en hızlı {scorer} davrandı, {team} golü buldu.', 'solo'],
    ['{scorer} savunmadan sıyrıldı, kaleciyi de geçip topu ağlara yuvarladı.', 'counter'],
    ['{scorer} penaltı noktasından affetmedi, {team} golü buldu.', 'penalty'],
    ['{scorer} serbest vuruşu barajın üstünden aşırttı, kaleci çaresiz!', 'freekick'],
  ],
  goalA: [
    ['{assist} ortaladı, {scorer} kafayla filelere gönderdi! {team} golü buldu.', 'cross'],
    ['{assist} ara pasını verdi, {scorer} kaleciyle karşı karşıya affetmedi.', 'open'],
    ['{assist} çizgiye indi, geri pas; {scorer} tek vuruşta ağlara gönderdi.', 'cross'],
    ['{assist} kornerden kesti, {scorer} yükseldi ve gol!', 'corner'],
    ['Kontra atak! {assist} topu taşıdı, {scorer} bitirdi. {team} sevinç içinde.', 'open'],
    ['{assist} topuğuyla aktardı, {scorer} plaseyle köşeye bıraktı.', 'open'],
    ['{assist} ile {scorer} duvar pası yaptı, {scorer} vuruşunda top ağlarda!', 'open'],
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

/** Takım adı (milli maçlarda match.names kullanılır) */
const sideName = (match, side) => match.names?.[side] || teamName(side === 'my' ? match.myId : match.oppId);
const sideShort = (match, side) => match.shorts?.[side] || CLUB_BY_ID[side === 'my' ? match.myId : match.oppId]?.short || '';

export function scoreLine(match) {
  const h = match.isHome ? match.score.my : match.score.opp;
  const a = match.isHome ? match.score.opp : match.score.my;
  const hs = sideShort(match, match.isHome ? 'my' : 'opp');
  const as = sideShort(match, match.isHome ? 'opp' : 'my');
  return `${hs} ${h}-${a} ${as}`;
}

/** Yapay olayı işler (gol ise skoru günceller) ve anlatım satırı döner. */
export function applyAiEvent(match, ev) {
  const team = sideName(match, ev.side);
  const opp = sideName(match, ev.side === 'my' ? 'opp' : 'my');
  if (ev.kind === 'goal') {
    match.score[ev.side] += 1;
    const g = recordGoal(match, ev.side, ev.minute);
    const scorer = g.scorer ? shortName(g.scorer) : team;
    const [tpl, kind] = g.assist ? pick(T.goalA) : pick(T.goalS);
    g.kind = kind;
    const text = g.scorer ? fill(tpl, { team, opp, scorer, assist: shortName(g.assist || '') }) : fill(pick(T.goal), { team, opp });
    return { minute: ev.minute, kind: ev.side === 'my' ? 'goal-my' : 'goal-opp', scorer: g.scorer, text: `GOL! ${text} ${scoreLine(match)}` };
  }
  return { minute: ev.minute, kind: ev.kind, text: fill(pick(T[ev.kind] || T.chance), { team, opp }) };
}

/** Anın oynandığı dakikadaki yorgunluk (0..0.65) */
export function momentFatigue(state, match, minute) {
  if (!match) return 0;
  return fatigueAt({ minute, energy: match.energy0 ?? state.player.energy, stamina: state.player.stats.stamina, weather: match.weather, from: match.role === 'starter' ? 0 : match.subMinute || 0 });
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
      const how = result.panenka ? 'Panenka vuruşuyla kaleciyi avladı, top ağlarda süzüldü'
        : moment.context === 'penalty' ? 'penaltıyı gole çevirdi'
          : moment.context === 'corner' ? 'kornerden gelen topa yükseldi ve kafayla filelere gönderdi'
            : moment.context === 'freekick' ? (Math.abs(result.curl || 0) > 0.3 ? 'serbest vuruşu barajın yanından kıvırarak ağlara gönderdi' : 'serbest vuruşu barajın üstünden aşırttı, top doksana') 
              : result.rebound ? 'kalecinin çeldiği topu boş kaleye gönderdi' : 'filelere gönderdi';
      if (result.panenka) t.rating += 0.3;
      if (moment.context === 'freekick') t.rating += 0.25;
      const set = moment.context === 'penalty' || moment.context === 'freekick' || result.panenka;
      const g = recordGoal(match, 'my', m, { me: true, scorer: playerName, assist: set ? null : undefined, assistP: moment.context === 'corner' ? 1 : 0.55, kind: moment.context });
      g.kind = { penalty: 'penalty', freekick: 'freekick', corner: 'corner', edge: 'long' }[moment.context] || (g.assist ? 'open' : 'solo');
      lines.push({ minute: m, kind: 'goal-me', scorer: playerName, text: `GOOOL! ${playerName} ${how}!${g.assist ? ` Asist: ${shortName(g.assist)}.` : ''} ${scoreLine(match)}` });
    } else {
      t.lost++;
      const o = result.outcome;
      const pen = moment.context === 'penalty';
      if (o === 'save') {
        t.rating += pen ? (result.panenkaTry ? -0.9 : -0.6) : -0.1;
        const txt = result.panenkaTry ? `${playerName} Panenka denedi ama kaleci yerinde kaldı ve topu kucakladı! Tribünler şokta.` : '';
        lines.push({ minute: m, kind: 'save', text: txt || (result.rebound ? `${playerName} vurdu, kaleci çeldi; dönen topta da gol çıkmadı!` : moment.context === 'freekick' ? `${playerName} serbest vuruşu çerçeveye gönderdi, kaleci uçarak çıkardı!` : `${playerName} vurdu, kaleci kurtardı!`) });
      } else if (o === 'claimed') { t.rating -= 0.05; lines.push({ minute: m, kind: 'save', text: `Korner kullanıldı, kaleci ${playerName}'ın önünde topu havada kontrol etti.` }); }
      else if (o === 'cleared') { t.rating -= 0.1; lines.push({ minute: m, kind: 'chance', text: `${playerName} kafa topuna yükseldi ama savunma düelloyu kazandı.` }); }
      else if (o === 'missed') { t.rating -= 0.15; lines.push({ minute: m, kind: 'chance', text: `Korner ${playerName}'ın üstünden geçti, zamanlama tutmadı.` }); }
      else if (o === 'post') { lines.push({ minute: m, kind: 'post', text: `${playerName} direğe nişanladı... DİREK!` }); }
      else if (o === 'block') { t.rating -= 0.15; lines.push({ minute: m, kind: 'chance', text: moment.context === 'freekick' ? `${playerName} serbest vuruşu kullandı, top baraja takıldı.` : `${playerName} şutunu çekti, savunma bloke etti.` }); }
      else if (o === 'timeout') { t.rating -= 0.3; lines.push({ minute: m, kind: 'chance', text: `${playerName} çok bekledi, top elinden alındı.` }); }
      else { t.rating += pen ? -0.6 : -0.25; lines.push({ minute: m, kind: 'chance', text: `${playerName} vurdu ama top ${o === 'over' ? 'üstten' : 'yandan'} auta gitti.` }); }
    }
  } else if (moment.type === 'attack') {
    t.progress.push(['passing', result.stages?.[0]?.success ? 0.15 : 0.05]);
    t.progress.push(['speed', result.stages?.some((x) => x.step === 'dribble' && x.success) ? 0.15 : 0.05]);
    t.progress.push(['shooting', result.success ? 0.2 : 0.05]);
    const st = result.stage;
    if (result.success) {
      match.score.my += 1;
      t.goals += 1;
      t.won += 2;
      t.rating += 1.2;
      const g = recordGoal(match, 'my', m, { me: true, scorer: playerName, assistP: 1, kind: moment.context === 'counter' ? 'counter' : 'open' });
      lines.push({ minute: m, kind: 'goal-me', scorer: playerName, text: `GOOOL! ${playerName} ${g.assist ? `${shortName(g.assist)} ile ` : ''}ver-kaçla başladı, ${moment.context === 'counter' ? 'son adamı da geçip' : 'savunmanın arkasına sarkıp'} topu ağlara gönderdi! Muhteşem bir atak! ${scoreLine(match)}` });
    } else if (st === 'pass') {
      t.lost++;
      t.rating -= result.outcome === 'offside' ? 0.15 : 0.3;
      lines.push({ minute: m, kind: result.outcome === 'offside' ? 'offside' : 'chance', text: result.outcome === 'offside' ? `${playerName} ara pasını verdi ama arkadaşı ofsayttaydı. Yan hakemin bayrağı havada.` : `${playerName} atağı başlatamadı, pas rakipte kaldı.` });
    } else if (st === 'dribble') {
      t.won++;
      t.lost++;
      t.rating += 0.05;
      lines.push({ minute: m, kind: 'chance', text: `${playerName} ver-kaçla sıyrıldı ama son adamı geçemedi, atak söndü.` });
    } else {
      t.won += 2;
      t.lost++;
      t.rating += 0.25;
      const o = result.outcome;
      lines.push({ minute: m, kind: o === 'save' ? 'save' : o === 'post' ? 'post' : 'chance', text: `${playerName} harika bir atakla kaleciyle karşı karşıya kaldı... ${o === 'save' ? 'kaleci son anda kurtardı!' : o === 'post' ? 'top direkten döndü!' : 'ama vuruş auta gitti.'}` });
    }
  } else if (moment.type === 'pass') {
    t.progress.push(['passing', result.success ? 0.3 : 0.08]);
    if (result.success) {
      t.won++;
      t.rating += 0.3;
      // ASİST KURALI: pas ancak pozisyon tamamen bitip gol olursa asist sayılır.
      // Mini oyun son pası oynatıp bitirişi de gösterir (assistGoal); otomatik/3B modda olasılıkla belirlenir.
      const finalBall = moment.context === 'final';
      const played = result.assistGoal !== undefined;
      const goal = finalBall && (played ? !!result.assistGoal : chance(0.16 + 0.18 * acc));
      const xi = match.lineups?.my || [];
      const shooter = (played && result.shooterNum && xi.find((p) => p.num === result.shooterNum && p.pos !== 'GK'))
        || pick(xi.filter((p) => p.pos === 'FW').length ? xi.filter((p) => p.pos === 'FW') : [{ name: null }]);
      const sn = shooter?.name ? shortName(shooter.name) : 'takım arkadaşı';
      const curved = Math.abs(result.curve || 0) >= 0.25;
      if (goal) {
        match.score.my += 1;
        t.assists += 1;
        t.rating += 0.7;
        recordGoal(match, 'my', m, { scorer: shooter?.name || null, assist: playerName, meAssist: true, kind: curved ? 'cross' : 'open' });
        lines.push({ minute: m, kind: 'goal-my', assist: true, scorer: shooter?.name, text: `${playerName} ${curved ? 'falsolu' : 'ölçülü'} bir pas çıkardı, ${sn} vuruşu yaptı ve GOL! ASİST ${playerName}'ın. ${scoreLine(match)}` });
      } else if (finalBall) {
        // Pas tuttu ama pozisyon golle bitmedi: asist yok, sadece kilit pas
        t.rating += curved ? 0.15 : 0.1;
        const fin = result.finish || pick(['save', 'miss']);
        lines.push({ minute: m, kind: fin === 'save' ? 'save' : 'chance', text: `${playerName} kilit pası verdi, ${sn} ${fin === 'save' ? 'vurdu ama kaleci kurtardı' : 'vurdu ama top auta gitti'}. Gol olmadığı için asist yok.` });
      } else {
        if (curved) t.rating += 0.1;
        // Oyun kurma pası: asla asist sayılmaz; bazen atak sürer ve başkası gol atar
        if (chance(0.05 + 0.04 * acc)) {
          match.score.my += 1;
          t.rating += 0.15;
          const g = recordGoal(match, 'my', m + 1, { kind: 'open' });
          lines.push({ minute: m, kind: 'pass', text: curved ? `${playerName} falsolu bir pasla savunmayı deldi.` : `${playerName} isabetli bir pasla oyunu kurdu.` });
          lines.push({ minute: m + 1, kind: 'goal-my', scorer: g.scorer, text: `Atak sürdü ve GOL! ${byLine(g)}. Hücumu ${playerName} başlattı ama son pas onun değil. ${scoreLine(match)}` });
        } else {
          lines.push({ minute: m, kind: 'pass', text: curved ? `${playerName} falsolu bir pasla savunmayı deldi.` : `${playerName} isabetli bir pasla oyunu yönlendirdi.` });
        }
      }
    } else {
      t.lost++;
      t.rating -= moment.context === 'final' ? 0.3 : 0.4;
      const why = {
        stolen: `${playerName} çok bekledi, rakip topu ayağından aldı.`,
        out: `${playerName} pası çok sert attı, top taca çıktı.`,
        missed: `${playerName} pası boşluğa attı, kimse yetişemedi.`,
        offside: `${playerName} ara pasını verdi ama arkadaşı ofsayttaydı. Yan hakem bayrağı kaldırdı.`,
      }[result.outcome];
      lines.push({ minute: m, kind: 'chance', text: why || `Pas rakipte kaldı: ${playerName} topu kaptırdı.` });
      if (moment.context === 'buildup' && chance(0.15)) {
        match.score.opp += 1;
        const g = recordGoal(match, 'opp', m + 1, { kind: 'counter' });
        lines.push({ minute: m + 1, kind: 'goal-opp', scorer: g.scorer, text: `Top kaybı pahalıya patladı: GOL! ${byLine(g)}. ${scoreLine(match)}` });
      }
    }
  } else {
    t.progress.push(['defending', result.success ? 0.3 : 0.08]);
    if (result.success) {
      t.won++;
      t.rating += moment.context === 'threat' ? 0.55 : 0.45;
      const how = {
        lunge: `${playerName} pası okudu, ayağını uzatıp araya girdi! Tehlike geçti.`,
        intercept: `${playerName} koridoru kapattı, pas ayağına geldi.`,
        tackle: `${playerName} top sahibine yapıştı ve topu kaptı!`,
        loose: `${playerName} baskıyla rakibin pasını boşa çıkardı.`,
        time: `${playerName} rakibini oyaladı, takım savunmaya döndü.`,
        slide: `${playerName} kayarak müthiş bir müdahale yaptı, tehlike geçti!`,
      }[result.method];
      lines.push({ minute: m, kind: 'tackle', text: how || `${playerName} araya girip topu kaptı!` });
    } else if (result.outcome === 'foul') {
      // Faul: kart riski + tehlikeli bölgede serbest vuruş
      t.lost++;
      t.rating -= result.card ? 0.55 : 0.3;
      if (result.card) t.yellow = (t.yellow || 0) + 1;
      lines.push({ minute: m, kind: 'chance', text: result.card ? `${playerName} rakibini düşürdü, hakem sarı kartını çıkardı!` : `${playerName} faul yaptı, hakem düdüğü çaldı.` });
      if (moment.context === 'threat' && chance(0.12)) {
        match.score.opp += 1;
        const g = recordGoal(match, 'opp', m + 1, { assist: null, kind: 'freekick' });
        lines.push({ minute: m + 1, kind: 'goal-opp', scorer: g.scorer, text: `Serbest vuruşu ${g.scorer ? shortName(g.scorer) : 'rakip'} kullandı, top ağlarda. ${scoreLine(match)}` });
      }
    } else {
      t.lost++;
      t.rating -= 0.45;
      if (moment.context === 'threat' && chance(0.42)) {
        match.score.opp += 1;
        const g = recordGoal(match, 'opp', m, { kind: result.method === 'through' ? 'open' : 'solo' });
        const who = g.scorer ? shortName(g.scorer) : 'rakip forvet';
        lines.push({ minute: m, kind: 'goal-opp', scorer: g.scorer, text: result.method === 'through' ? `${playerName} ara pasını kesemedi, ${who} golü buldu.${g.assist ? ` Pas: ${shortName(g.assist)}.` : ''} ${scoreLine(match)}` : `${playerName} rakibini durduramadı: ${who} topu ağlara gönderdi. ${scoreLine(match)}` });
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
  const prestige = leaguePrestige(leagueOf(career.clubId));
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
    bonuses.goals = Math.round(t.goals * wage * 0.15) + goalBonusFor(state, t.goals); // sözleşmedeki gol primi dahil
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
  changeFame(player, t.goals * (0.45 + 0.85 * prestige) + (rating && rating >= 8 ? 1 : 0) + (played ? 0.2 : -0.1));

  // Enerji: dayanıklılık yüksekse maç daha az yorar
  if (played) {
    const base = match.role === 'starter' ? 25 * (match.subOff ? Math.max(0.7, match.subOff / 90) : 1) : 12;
    changeEnergy(player, -base * (1.2 - player.stats.stamina / 250) * (match.weather?.fatigue || 1));
  }

  // Sakatlık zarı: yorgunluk, zemin, geçmiş sakatlıklar
  const injury = matchInjuryRoll(state, match, played);

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
    injury,
  };
}
