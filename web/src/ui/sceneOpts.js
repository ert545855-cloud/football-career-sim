// Sahne çizim seçenekleri: kulüp renkleri, ev partisinde evin duvarı/zemini/manzarası ve kupalar.
import { CLUB_BY_ID } from '../core/data.js';
import { WALLS, ensureHome, homeOf } from '../core/social/home.js';
import { playerLook } from '../core/cosmetics.js';

/** Sahne çizim seçenekleri (ev partisinde evin duvarı, zemini, manzarası ve kupaları) */
/** Giyili serbest stil kıyafetinin [üst, yaka] renkleri */
function casualColors(s) {
  try {
    const k = playerLook(s, { offPitch: true })?.kit;
    return k?.body ? [k.body, k.accent || k.body] : null;
  } catch { return null; }
}

export function sceneOptsFor(s, venueId, palette, person) {
  const club = CLUB_BY_ID[s.career.clubId];
  const h = ensureHome(s);
  const wall = WALLS.find((w) => w.id === h.wall);
  return {
    scene: venueId,
    palette,
    npc: person ? { look: person.look, clothes: person.clothes } : null,
    // maç dışı sahne: serbest stil kıyafeti (dolaptan); yoksa kulüp renkleri
    me: { look: s.player.avatar || {}, colors: casualColors(s) || [club.colors[0], club.colors[1]] },
    wall: wall?.color || club.colors[0],
    floor: h.floor,
    view: ['penthouse', 'villa'].includes(homeOf(s).id) ? 'sea' : 'city',
    trophies: h.placed.some((p) => p.id === 'trophy') ? (s.career.awards || []).length : 0,
    jersey: club.colors[0],
  };
}

