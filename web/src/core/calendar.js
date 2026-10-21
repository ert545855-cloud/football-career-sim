// SEZON TAKVİMİ — sezonun hafta sayısı oyuncunun liginden gelir (çift devre: 2 × (takım − 1); tek sayıda takımda
// her tur bir takım bay geçer). Diğer liglerin turları bu takvime yayılır (az turlu ligde boş hafta, çok turluda
// hafta içi maç). Eskiden 22 haftaya göre yazılmış olaylar (kupa, Avrupa, milli ara, devre arası) buradan ölçeklenir.

/** Tasarım takviminin uzunluğu (12 takımlı eski ligler) ve en kısa sezon */
export const BASE_WEEKS = 22;

let WEEKS = BASE_WEEKS;

/** Etkin dünyanın sezon uzunluğu (useWorld çağırır) */
export function setSeasonWeeks(n) {
  WEEKS = Number.isFinite(n) && n > 0 ? Math.round(n) : BASE_WEEKS;
  return WEEKS;
}

/** Bu sezonun hafta sayısı */
export const seasonWeeks = () => WEEKS;

/** 22 haftalık tasarım takvimindeki bir haftayı bu sezonun uzunluğuna ölçekler (sıra korunur) */
export function scaleWeek(w, W = WEEKS) {
  if (W === BASE_WEEKS) return w;
  return Math.max(1, Math.min(W, Math.round(1 + ((w - 1) * (W - 1)) / (BASE_WEEKS - 1))));
}

/** Devre arası transfer penceresinin haftası */
export const midWindowWeek = (W = WEEKS) => Math.round(W / 2);

/** Sezonun ilerleyişi (0 → 1) */
export const seasonProgress = (week, W = WEEKS) => Math.max(0, Math.min(1, (week - 1) / Math.max(1, W - 1)));

/**
 * Gelişim temposu: uzun sezonlarda (daha çok hafta, daha çok antrenman) hafta başına gelişim azalır,
 * böylece bir sezonluk toplam gelişim lig büyüklüğünden bağımsız kalır.
 */
export const seasonPace = (W = WEEKS) => Math.min(1, BASE_WEEKS / Math.max(BASE_WEEKS, W));

/** Bir ligin tur sayısı: her rakiple `legs` maç; tek sayıda takımda her turda bir takım bay geçer */
export const roundsFor = (teams, legs = 2) => (teams < 2 ? 0 : legs * (teams % 2 ? teams : teams - 1));

/** Tur → takvim haftası: turlar sezona eşit yayılır; tur sayısı hafta sayısına eşitse birebir */
export function roundWeek(r, R, W = WEEKS) {
  if (R <= 1) return 1;
  return 1 + Math.round((r * (W - 1)) / (R - 1));
}
