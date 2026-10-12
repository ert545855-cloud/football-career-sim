// Kayıt: tarayıcının localStorage'ı (iOS Safari, Android Chrome ve masaüstünde çalışır).
import { SAVE_VERSION, emptySeasonStats } from './game.js';
import { migrateChirp } from './chirp/index.js';
import { ensureMentor } from './mentor/index.js';

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

export function saveGame(state) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify(state));
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
    return raw ? migrate(JSON.parse(raw)) : null;
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
  state.version = SAVE_VERSION;
  state.flags = { cooldowns: {}, benchStreak: 0, rivalOffset: 0, injuredWeeks: 0, trainBoostWeeks: 0, nationalSeason: 0, ...(state.flags || {}) };
  state.pending = { match: null, event: null, offers: null, seasonReport: null, ...(state.pending || {}) };
  state.career.items = state.career.items || [];
  state.career.news = state.career.news || [];
  state.career.awards = state.career.awards || [];
  state.career.history = state.career.history || [];
  state.career.season = state.career.season || emptySeasonStats();
  migrateChirp(state);
  ensureMentor(state);
  return state;
}

/** Kaydı panoya kopyalanabilir metne çevirir (cihaz değiştirmek için). */
export function exportSave(state) {
  const json = JSON.stringify(state);
  return btoa(unescape(encodeURIComponent(json)));
}

export function importSave(code) {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    return migrate(JSON.parse(json));
  } catch {
    return null;
  }
}

export function loadSettings() {
  const defaults = { sound: true, vibrate: true, speed: 1 };
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
