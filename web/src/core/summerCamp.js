// YAZ KAMPI — yeni sezon başında (2. sezondan itibaren) kulüp kampı: odak seç (kondisyon / taktik / teknik),
// kamp boyunca hazırlık maçı oynanır. Etkiler sezonun ilk haftalarına taşınır.
import { gymOnCamp } from './gym.js';
import { CLUBS, CLUB_BY_ID, POSITIONS } from './data.js';
import { chance, pick, randInt } from './rng.js';
import { addProgress, changeEnergy, changeMorale, changeRel } from './player.js';
import { changePersona, ensureCharacter } from './character.js';
import { clubRating } from './league.js';

export const CAMP_FOCUS = [
  { id: 'fitness', name: 'Kondisyon kampı', icon: 'bolt', desc: 'Dayanıklılık ve hız gelişimi, ilk haftalarda daha az sakatlık', fx: 'Dayanıklılık + hız gelişimi · 6 hafta sakatlık riski −%25' },
  { id: 'tactics', name: 'Taktik kampı', icon: 'clipboard', desc: 'Hocanın sistemini öğren: hoca ilişkisi ve uyum', fx: 'Hoca +6 · uyum +15 · liderlik +2' },
  { id: 'technique', name: 'Teknik kamp', icon: 'target', desc: 'Ana özelliğin ve zayıf ayak/beceri çalışmaları', fx: 'Ana özellik gelişimi · özel çalışma ilerlemesi' },
];

const CAMP_PLACES = ['Bolu', 'Erzurum', 'Avusturya Alpleri', 'Slovenya', 'Kartepe', 'Hollanda'];

/** Sezon başı: kamp hakkı (2. sezondan itibaren, sezonda bir kez) */
export function summerCampDue(state) {
  const c = state.calendar;
  if (c.phase !== 'week' || c.week !== 1 || c.season < 2) return false;
  return (state.summerCamp?.season || 0) < c.season;
}

/** Odak seçildi: etkileri uygular, hazırlık maçının sonucunu döner */
export function runSummerCamp(state, focusId) {
  const p = ensureCharacter(state);
  const focus = CAMP_FOCUS.find((f) => f.id === focusId) || CAMP_FOCUS[0];
  const place = pick(CAMP_PLACES);
  const notes = [];
  gymOnCamp(state, focus.id);
  if (focus.id === 'fitness') {
    addProgress(p, 'stamina', 1.3);
    addProgress(p, 'speed', 0.9);
    state.flags.campFitWeeks = 6;
    changeEnergy(p, 10);
    notes.push('Dağ koşuları ve kuvvet antrenmanları: bacakların sezona hazır.');
  } else if (focus.id === 'tactics') {
    changeRel(p, 'manager', 6);
    if (state.adapt) state.adapt.pct = Math.min(100, state.adapt.pct + 15);
    changePersona(state, 'leadership', 2);
    notes.push('Video analizleri ve taktik tahtası: hocanın sistemini ezberledin.');
  } else {
    const pos = POSITIONS[p.position];
    addProgress(p, pos.primary, 1.4);
    p.drill.weakFoot += 0.35;
    p.drill.skillMoves += 0.35;
    notes.push('Birebir teknik çalışmalar: topla aran hiç bu kadar iyi olmamıştı.');
  }
  changePersona(state, 'professionalism', 1);
  changeRel(p, 'teammates', 4);
  changeMorale(p, 4);
  // Hazırlık maçı: yabancı bir kulüple
  const myR = clubRating(state.world, state.career.clubId);
  const pool = CLUBS.filter((c) => c.id !== state.career.clubId && (c.country || 'tr') !== (CLUB_BY_ID[state.career.clubId]?.country || 'tr'));
  const opp = pool.length ? pick(pool) : CLUBS[0];
  const oppR = clubRating(state.world, opp.id);
  const my = Math.max(0, Math.round(randInt(0, 3) + (myR - oppR) / 12));
  const op = Math.max(0, Math.round(randInt(0, 3) - (myR - oppR) / 12));
  const goals = my > 0 && chance(p.position === 'FW' ? 0.5 : p.position === 'MF' ? 0.3 : 0.12) ? 1 : 0;
  state.summerCamp = { season: state.calendar.season, focus: focus.id, place, friendly: { opp: opp.id, my, op, goals } };
  return { focus, place, notes, friendly: { oppName: opp.name, my, op, goals } };
}
