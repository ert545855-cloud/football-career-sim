// @ts-check
// FORMA NUMARASI — oyuncu numara seçmez; kulüp boştaki genç oyuncu numaralarından birini verir.
// Kayıt: player.number (güncel) + career.numberHistory (kulüp/sezon geçmişi).
// İleride: performansla "efsane" numaralarını (7, 9, 10…) kazanma mekaniği ICONIC_NUMBERS üzerinden eklenecek.
import { MentorManager } from '../mentor/MentorManager.js';

/** Genç oyunculara verilen numaralar (A takım düzenine girmeyen yüksek numaralar) */
export const YOUTH_NUMBERS = [33, 48, 99, 77, 61, 88, 45, 34, 26, 58, 66, 71, 92, 38, 42, 53, 64, 70, 81, 95, 37, 44, 55, 68];

/** Performansla kazanılacak numaralar ve hangi mevkiyle özdeşleştikleri (gelecek mekanik için veri) */
export const ICONIC_NUMBERS = { 7: ['FW', 'MF'], 9: ['FW'], 10: ['MF', 'FW'], 8: ['MF'], 4: ['DF'], 5: ['DF'] };

/** Kulüp kadrosunda kullanılan numaralar (yapay zekâ oyuncuları) */
export function takenNumbers(state) {
  try {
    return new Set(new MentorManager(state).squad().map((p) => p.number));
  } catch {
    return new Set();
  }
}

export const isNumberFree = (state, n) => !takenNumbers(state).has(n);

/**
 * Boştaki genç oyuncu numaralarından birini rastgele atar ve geçmişe yazar.
 * @param {any} state
 * @param {() => number} [rnd]
 * @param {string} [reason]
 */
export function assignYouthNumber(state, rnd = Math.random, reason = 'Kulüp tarafından verildi') {
  const taken = takenNumbers(state);
  const free = YOUTH_NUMBERS.filter((n) => !taken.has(n));
  const pool = free.length ? free : YOUTH_NUMBERS;
  const number = pool[Math.floor(rnd() * pool.length)];
  setNumber(state, number, reason);
  return number;
}

/** Kulüp değişince: numara yeni kadroda doluysa yeni genç numarası verilir. */
export function ensureNumberAfterMove(state, rnd = Math.random) {
  if (isNumberFree(state, state.player.number)) {
    setNumber(state, state.player.number, 'Numarasını korudu');
    return { changed: false, number: state.player.number };
  }
  const number = assignYouthNumber(state, rnd, 'Eski numarası doluydu');
  return { changed: true, number };
}

function setNumber(state, number, reason) {
  state.player.number = number;
  const h = (state.career.numberHistory ||= []);
  const last = h[h.length - 1];
  if (!last || last.number !== number || last.clubId !== state.career.clubId) {
    h.push({ season: state.calendar.season, clubId: state.career.clubId, number, reason });
  }
}
