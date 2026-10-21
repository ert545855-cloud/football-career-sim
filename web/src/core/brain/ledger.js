// @ts-check
// BEYNİN HAFTALIK DEFTERİ — oyunun her köşesi (antrenman, salon, maç, sosyal hayat, olaylar, sakatlık) ne
// yaşandığını buraya not eder. Hafta sonunda beden ve zihin bu defterden hesaplanır. Bağımlılığı yok:
// her modül döngüsel içe aktarma olmadan çağırabilir.
import { addMemory } from './memory.js';
import { EXTRA_KCAL } from './body.js';

export function newLedger() {
  return { train: 0, drill: 0, gym: [], rest: 0, team: 0, media: 0, manager: 0, sponsor: 0, posts: 0, outings: 0, outBar: 0, outHome: 0, party: 0, family: 0, trip: 0, minutes: 0, matches: 0, kcal: 0, stars: 0, extraStim: 0, dates: 0 };
}

/** Defter (beyin henüz kurulmadıysa en küçük hâliyle) */
export function ledgerOf(state) {
  const b = state.brain || (state.brain = {});
  return b.week || (b.week = newLedger());
}

const at = (state) => ({ s: state.calendar?.season || 1, w: state.calendar?.week || 1 });

/** Anı ekler (beyin kurulmamış olsa da) */
export function noteMemory(state, m) {
  const b = state.brain || (state.brain = {});
  return addMemory(b, m, at(state));
}

/** Penaltı geçmişi (özellikler için) */
function notePenalty(state, scored) {
  const b = state.brain || (state.brain = {});
  const p = b.pens || (b.pens = []);
  p.push(scored ? 1 : 0);
  if (p.length > 12) p.splice(0, p.length - 12);
}

/**
 * Not al. kind: action | train | gym | match | outing | event | post | injury | return | transfer | award | trophy | partner | breakup | item
 */
export function brainNote(state, kind, data = {}) {
  if (!state?.player) return;
  const w = ledgerOf(state);
  const b = state.brain;
  switch (kind) {
    case 'action': {
      const id = data.id;
      if (id === 'rest') w.rest++;
      else if (id === 'team') { w.team++; w.kcal += EXTRA_KCAL.team; }
      else if (id === 'media') w.media++;
      else if (id === 'manager') w.manager++;
      else if (id === 'sponsor') w.sponsor++;
      else if (id === 'drill') w.drill++;
      break;
    }
    case 'train':
      w.train++;
      w.stars += data.stars || 0;
      break;
    case 'gym':
      w.gym.push({ station: data.station, q: Math.round((data.q ?? 0.6) * 100) / 100 });
      break;
    case 'post':
      w.posts++;
      break;
    case 'outing': {
      w.outings++;
      if (data.venueId === 'bar') { w.outBar++; w.kcal += EXTRA_KCAL.bar; }
      else if (data.venueId === 'home') { w.outHome++; w.kcal += EXTRA_KCAL.home; }
      else w.kcal += EXTRA_KCAL.cafe;
      if (data.kind === 'romance') w.dates++;
      break;
    }
    case 'event': {
      const id = data.id;
      const energy = data.energy ?? 0;
      if ((id === 'nightclub' || id === 'birthday_party') && energy <= -12) { w.party++; w.kcal += EXTRA_KCAL.party; }
      else if (id === 'team_dinner' && energy <= 0) { w.team++; w.kcal += EXTRA_KCAL.dinner; }
      else if (id === 'family_visit' && (data.morale ?? 0) > 0) w.family++;
      else if (id === 'extra_training' && energy < 0) { w.extraStim += 0.35; w.train += 0.5; }
      break;
    }
    case 'item':
      if (data.id === 'trip') w.trip++;
      if (data.id === 'spa') w.rest += 0.5;
      break;
    case 'match': {
      const sm = data.summary || {};
      const match = data.match || {};
      w.matches++;
      if (!sm.played) break;
      const mins = match.role === 'starter' ? match.subOff || 90 : Math.max(0, 90 - (match.subMinute || 90));
      w.minutes += mins;
      const big = !!match.big;
      const opp = data.opp || 'rakip';
      const career = state.career || {};
      const total = (career.totals?.goals || 0) + (career.season?.goals || 0);
      if (sm.goals > 0 && total === sm.goals) noteMemory(state, { kind: 'first_goal', text: `${opp} maçındaki ilk profesyonel golüm`, val: 0.95, int: 1 });
      if (sm.goals >= 3) noteMemory(state, { kind: 'hattrick', text: `${opp} karşısında hat-trick`, val: 0.9, int: 0.95, tag: big ? 'big' : null });
      else if (big && sm.result === 'W' && (sm.rating || 0) >= 7) noteMemory(state, { kind: 'big_win', text: `${match.big.title || 'Büyük maç'}: ${opp} zaferi${sm.goals ? `, ${sm.goals} gol` : ''}`, val: 0.75, int: 0.85, tag: 'big' });
      else if (big && (sm.result === 'L' || (sm.rating || 7) < 6)) noteMemory(state, { kind: 'big_loss', text: `${match.big.title || 'Büyük maç'}: ${opp} hezimeti`, val: -0.6, int: 0.75, tag: 'big' });
      else if ((sm.rating || 0) >= 8.5) noteMemory(state, { kind: 'great_game', text: `${opp} maçında ${String(sm.rating).replace('.', ',')} not`, val: 0.6, int: 0.65 });
      else if ((sm.rating || 7) <= 5.2) noteMemory(state, { kind: 'bad_game', text: `${opp} maçındaki kötü performansım`, val: -0.5, int: 0.6 });
      if (match.tally?.red) noteMemory(state, { kind: 'red', text: `${opp} maçında gördüğüm kırmızı kart`, val: -0.65, int: 0.75 });
      for (const m of match.moments || []) {
        if (m.done && m.type === 'shot' && m.context === 'penalty') {
          notePenalty(state, !!m.success);
          if (!m.success) noteMemory(state, { kind: 'pen_miss', text: `${opp} maçında kaçırdığım penaltı`, val: -0.55, int: big ? 0.85 : 0.65, tag: big ? 'big' : 'pen' });
        }
      }
      break;
    }
    case 'injury':
      if ((data.weeks || 0) >= 6) noteMemory(state, { kind: 'injury_long', text: `${data.name || 'Sakatlık'}: ${data.weeks} hafta sahalardan uzak`, val: -0.7, int: 0.85 });
      if (b.physioWarnT != null && (b.t || 0) - b.physioWarnT <= 2) noteMemory(state, { kind: 'ignored_physio', text: 'Fizyoterapistin uyarısını dinlemedim', val: -0.5, int: 0.6 });
      b.lastInjury = { weeks: data.weeks || 0 };
      break;
    case 'return':
      if ((b.lastInjury?.weeks || 0) >= 6) b.fearWeeks = 8;
      break;
    case 'transfer':
      noteMemory(state, { kind: 'transfer', text: `${data.club || 'Yeni kulübe'} imza attım`, val: 0.6, int: 0.8 });
      break;
    case 'award':
      noteMemory(state, { kind: data.trophy ? 'trophy' : 'award', text: data.title || 'Ödül', val: 0.85, int: 0.95 });
      break;
    case 'partner':
      noteMemory(state, { kind: 'partner', text: `${data.name || 'O'} ile birlikteyiz`, val: 0.6, int: 0.7 });
      break;
    case 'breakup':
      noteMemory(state, { kind: 'breakup', text: `${data.name || 'Sevgilim'} ile ayrıldık`, val: -0.7, int: 0.8 });
      break;
    default:
      break;
  }
}
