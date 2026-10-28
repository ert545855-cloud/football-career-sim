// Kayıt: tarayıcının localStorage'ı (iOS Safari, Android Chrome ve masaüstünde çalışır).
import { SAVE_VERSION, emptySeasonStats } from './game.js';
import { migrateChirp } from './chirp/index.js';
import { ensureMentor } from './mentor/index.js';
import { ensureAchievements } from './achievements.js';
import { ensureAgent } from './agent.js';
import { ensureNational } from './national.js';
import { ensureBallon } from './ballondor.js';
import { ensureSocial } from './social/index.js';
import { ensureGarage } from './garage.js';
import { ensureCosmetics } from './cosmetics.js';
import { ensureRanking } from './world/ranking.js';
import { ensureCoach } from './coach.js';
import { ensureLocker } from './locker.js';
import { ensureMedical } from './injury.js';
import { ensureCup } from './cup.js';
import { ensureCharacter } from './character.js';
import { ensureMarket } from './market.js';
import { ensureArchive } from './archive.js';
import { ensurePresident, ensureRival } from './living.js';
import { addFocus, leagueIdIn, upgradeWorld, useWorld } from './league.js';
import { restructureLegacyWorld } from './restructure.js';
import { ensureEurope } from './world/europe.js';

const KEY = 'krampon.save.v1';
const SETTINGS_KEY = 'krampon.settings';

function storage() {
  try {
    const s = window.localStorage;
    const t = '__k';
    s.setItem(t, '1');
    s.removeItem(t);
    return s;
  } catch {
    return null;
  }
}

/**
 * Kayıt sıkıştırma: lig tabloları (gerçek takım sayılarıyla ~2200 satır) dizi olarak yazılır.
 * {id,p,w,d,l,gf,ga,pts,last:[…]} → [id,p,w,d,l,gf,ga,pts,"GMB"] (canlı durum değişmez, kopya üzerinde)
 */
export function packState(state) {
  const w = state?.world;
  if (!w?.leagues) return state;
  const leagues = {};
  for (const [id, lg] of Object.entries(w.leagues)) {
    if (!lg?.table) { leagues[id] = lg; continue; }
    const { table, ...rest } = lg;
    leagues[id] = { ...rest, tz: Object.values(table).map((r) => [r.id, r.p, r.w, r.d, r.l, r.gf, r.ga, r.pts, (r.last || []).join('')]) };
  }
  return { ...state, world: { ...w, leagues } };
}

/** packState'in tersi (eski, sıkıştırılmamış kayıtlar olduğu gibi geçer) */
export function unpackState(state) {
  const w = state?.world;
  if (!w?.leagues) return state;
  for (const lg of Object.values(w.leagues)) {
    if (!lg?.tz) continue;
    lg.table = Object.fromEntries(lg.tz.map(([id, p, w2, d, l, gf, ga, pts, last]) => [id, { id, p, w: w2, d, l, gf, ga, pts, last: String(last || '').split('') }]));
    delete lg.tz;
  }
  return state;
}

export function saveGame(state) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify(packState(state)));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    return raw ? migrate(unpackState(JSON.parse(raw))) : null;
  } catch {
    return null;
  }
}

export const hasSave = () => !!storage()?.getItem(KEY);

export function clearSave() {
  storage()?.removeItem(KEY);
}

/** Eski veya eksik kayıtları güvenli hale getirir. */
export function migrate(state) {
  if (!state || !state.player || !state.career) return null;
  unpackState(state);
  state.version = SAVE_VERSION;
  state.flags = { cooldowns: {}, benchStreak: 0, rivalOffset: 0, injuredWeeks: 0, trainBoostWeeks: 0, nationalSeason: 0, ...(state.flags || {}) };
  state.pending = { match: null, event: null, offers: null, seasonReport: null, national: null, tournament: null, ...(state.pending || {}) };
  state.career.items = state.career.items || [];
  state.career.news = state.career.news || [];
  state.career.awards = state.career.awards || [];
  state.career.history = state.career.history || [];
  state.career.season = state.career.season || emptySeasonStats();
  state.career.numberHistory = state.career.numberHistory || [{ season: state.calendar?.season || 1, clubId: state.career.clubId, number: state.player.number, reason: 'Eski kayıt' }];
  state.career.loan = state.career.loan ?? null;
  state.career.academy = state.career.academy ?? null;
  state.career.guarantee = state.career.guarantee ?? null;
  migrateChirp(state);
  ensureMentor(state);
  ensureAchievements(state);
  ensureAgent(state);
  ensureNational(state);
  ensureBallon(state);
  ensureSocial(state);
  ensureGarage(state);
  ensureCosmetics(state);
  // Dünya ligleri (eski kayıtlarda sadece Türkiye vardı)
  upgradeWorld(state.world, state.calendar?.week || 1);
  ensureEurope(state.world, state.calendar?.week || 1);
  useWorld(state.world);
  // 12 takımlı eski yapı: süren sezon hemen gerçek lig yapısına geçer (sezon sonunu beklemeden)
  restructureLegacyWorld(state);
  addFocus(state.world, leagueIdIn(state.world, state.career.clubId));
  ensureRanking(state);
  ensureCoach(state);
  ensureLocker(state);
  ensureMedical(state);
  if (state.calendar?.phase === 'week') ensureCup(state);
  ensureCharacter(state);
  ensureMarket(state);
  ensureArchive(state);
  if (state.calendar?.phase === 'week') { ensureRival(state); ensurePresident(state); }
  state.pending.locker = state.pending.locker ?? null;
  return state;
}

// ── Seçmeler taslağı: kamp yarıda kalırsa kaldığı yerden devam etmek için ──
const DRAFT_KEY = 'krampon.draft.v1';

export function saveDraft(draft) {
  try {
    storage()?.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* yoksay */
  }
}

export function loadDraft() {
  try {
    const raw = storage()?.getItem(DRAFT_KEY);
    const d = raw ? JSON.parse(raw) : null;
    return d && typeof d.name === 'string' && d.tryout ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  storage()?.removeItem(DRAFT_KEY);
}

/** Kaydı panoya kopyalanabilir metne çevirir (cihaz değiştirmek için). */
export function exportSave(state) {
  const json = JSON.stringify(packState(state));
  return btoa(unescape(encodeURIComponent(json)));
}

export function importSave(code) {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    return migrate(unpackState(JSON.parse(json)));
  } catch {
    return null;
  }
}

export function loadSettings() {
  const defaults = { sound: true, vibrate: true, haptic: 'normal', speed: 1, unity3d: false, winter: 'auto', music: true, musicVol: 0.5 };
  try {
    return { ...defaults, ...(JSON.parse(storage()?.getItem(SETTINGS_KEY) || '{}')) };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* yoksay */
  }
}
