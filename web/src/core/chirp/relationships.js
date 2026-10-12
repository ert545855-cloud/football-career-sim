// @ts-check
// İLİŞKİ SERVİSİ — Coach, Fans, Team, Sponsor, Federation, Board.
// Oyundaki karşılıkları player.rel altında tutulur; tüm değerler 0–100 arasındadır.

/** @typedef {'coach'|'fans'|'team'|'sponsor'|'federation'|'board'} RelationKey */
/** @typedef {Partial<Record<RelationKey, number>>} RelationDelta */

/** Sistem anahtarı → kayıttaki alan ve Türkçe etiket */
export const RELATIONS = {
  coach: { field: 'manager', label: 'Teknik Direktör', short: 'Hoca', icon: 'clipboard', color: 'var(--blue)', effect: 'İlk 11 kararını etkiler.' },
  fans: { field: 'fans', label: 'Taraftar', short: 'Taraftar', icon: 'flag', color: 'var(--gold)', effect: 'Moral ve ün kazanımını etkiler.' },
  team: { field: 'teammates', label: 'Takım Uyumu', short: 'Takım', icon: 'users', color: 'var(--good)', effect: 'Soyunma odası olaylarını etkiler.' },
  sponsor: { field: 'sponsor', label: 'Sponsor', short: 'Sponsor', icon: 'briefcase', color: '#f472b6', effect: 'Reklam çekimi kazancını ve sponsor tekliflerini artırır.' },
  federation: { field: 'federation', label: 'Federasyon', short: 'Federasyon', icon: 'shield', color: '#94a3b8', effect: 'Düşükse disiplin cezası riski artar.' },
  board: { field: 'board', label: 'Kulüp Yönetimi', short: 'Yönetim', icon: 'briefcase', color: '#fb923c', effect: 'Sözleşme yenileme ve maaşı etkiler; çok düşükse satış listesine konursun.' },
};

/** Yeni kayıtlarda ve eski kayıt göçünde kullanılan başlangıç değerleri. */
export const RELATION_DEFAULTS = { manager: 50, teammates: 45, fans: 25, sponsor: 30, federation: 60, board: 50 };

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

export class RelationshipService {
  /** @param {{player:{rel:Record<string, number>}}} state */
  constructor(state) {
    this.state = state;
    this.ensure();
  }

  /** Eski kayıtlarda eksik ilişki alanlarını tamamlar. */
  ensure() {
    const rel = this.state.player.rel;
    for (const [k, v] of Object.entries(RELATION_DEFAULTS)) if (typeof rel[k] !== 'number') rel[k] = v;
  }

  /** @param {RelationKey} key */
  get(key) {
    return this.state.player.rel[RELATIONS[key].field];
  }

  /**
   * Değişimi uygular, gerçekleşen farkları döner (sınırda kırpılanlar dahil).
   * @param {RelationDelta} delta
   * @returns {Array<{key:RelationKey, label:string, delta:number}>}
   */
  apply(delta) {
    const out = [];
    for (const [key, d] of /** @type {[RelationKey, number][]} */ (Object.entries(delta))) {
      if (!d || !RELATIONS[key]) continue;
      const f = RELATIONS[key].field;
      const before = this.state.player.rel[f];
      // Lider mentor: Takım Uyumu kayıpları yarıya iner
      const mult = key === 'team' && d < 0 ? (this.state.player.mentorBonus?.teamLossMult ?? 1) : 1;
      this.state.player.rel[f] = clamp(before + d * mult);
      const real = this.state.player.rel[f] - before;
      out.push({ key, label: RELATIONS[key].short, delta: real });
    }
    return out;
  }

  /** Reklam çekimi kazanç çarpanı (Sponsor 0 → ×0.6, 100 → ×1.6). */
  sponsorMultiplier() {
    return 0.6 + this.get('sponsor') / 100;
  }

  /** Agresif paylaşım sonrası disiplin cezası olasılığı. */
  disciplineRisk() {
    return Math.max(0.1, Math.min(0.85, 0.25 + (50 - this.get('federation')) / 100));
  }

  /** Sözleşme yenilemede yönetimin maaş çarpanı (Yönetim 0 → ×0.9, 100 → ×1.1). */
  boardWageMultiplier() {
    return 0.9 + this.get('board') / 500;
  }

  /** Yönetim yenileme teklifi yapar mı? */
  boardWillRenew() {
    return this.get('board') >= 25 && this.get('coach') >= 35;
  }

  /** Yönetim oyuncuyu satış listesine koydu mu? */
  onTransferList() {
    return this.get('board') < 20;
  }
}
