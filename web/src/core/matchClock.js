/** Formats the live match clock without locale-dependent digit grouping. */
export function formatMatchClock(minutes) {
  const safe = Math.max(0, Number(minutes) || 0);
  return `${String(Math.floor(safe)).padStart(2, '0')}:${String(Math.floor((safe % 1) * 60)).padStart(2, '0')}`;
}
