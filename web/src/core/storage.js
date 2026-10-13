// Kayıt: tarayıcının localStorage'ı (iOS Safari, Android Chrome ve masaüstünde çalışır).
import { SAVE_VERSION, emptySeasonStats } from './game.js';
import { migrateChirp } from './chirp/index.js';
import { ensureMentor } from './mentor/index.js';
import { ensureAchievements } from './achievements.js';
import { ensureAgent } from './agent.js';
import { ensureNational } from './national.js';
import { ensureBallon } from './ballondor.js';
import { ensureSocial } from './social/index.js';

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
  const defaults = { sound: true, vibrate: true, haptic: 'normal', speed: 1, easyPass: false, unity3d: false };
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
