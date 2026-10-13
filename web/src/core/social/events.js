// SOSYAL OLAYLAR — buluşma sonrası rastgele anlar. Her olay: {id, title, text, short, changes, met?}
// Olaylar mekâna, ünlü olup olmamana, kiminle olduğuna ve yaşına göre seçilir.
import { chance, pick } from '../rng.js';
import { changeFame, changeRel } from '../player.js';
import { PEOPLE, SOCIAL_RULES } from './data.js';

/** Olay tanımları: when(ctx) → olasılık (0 = olmaz); apply(ctx) → olay nesnesi */
export const SOCIAL_EVENTS = [
  {
    id: 'meet',
    when: ({ state, outing }) => {
      if ((state.player.age || 0) < SOCIAL_RULES.romanceMinAge || outing.kind === 'romance') return 0;
      const pool = unmetFor(state, outing.venueId);
      if (!pool.length) return 0;
      return outing.companionId === 'alone' ? 0.5 : 0.15;
    },
    apply: ({ state, outing }) => {
      const p = pick(unmetFor(state, outing.venueId));
      const r = state.social.rel[p.id];
      r.met = true;
      r.v = Math.max(r.v, 12);
      return {
        id: 'meet', icon: 'sparkle', title: 'Yeni biriyle tanıştın',
        text: `${p.full} ile tanıştınız. ${p.job}. Numaralarınızı değiştiniz; artık Sosyal Yaşam'da onu davet edebilirsin.`,
        short: `${p.name} ile tanışma`, changes: [], met: p,
      };
    },
  },
  {
    id: 'selfie',
    when: ({ state }) => (state.player.fame >= 25 ? 0.25 : 0),
    apply: ({ state }) => {
      changeRel(state.player, 'fans', 2);
      changeFame(state.player, 0.3);
      return {
        id: 'selfie', icon: 'camera', title: 'Hayranlar seni tanıdı',
        text: pick(['Yan masadaki çocuklar fotoğraf istedi; formanı imzaladın.', 'Bir grup taraftar şarkını söyledi, birlikte fotoğraf çektiniz.', 'Garson kardeşi için imza istedi.']),
        short: 'Hayran fotoğrafı', changes: [{ key: 'fans', label: 'Taraftar', delta: 2 }],
      };
    },
  },
];

function unmetFor(state, venueId) {
  return PEOPLE.filter((p) => p.kind === 'romance' && !state.social.rel[p.id]?.met && (p.meetAt || []).includes(venueId));
}

/**
 * Buluşma sonrası olaylar (en fazla 2).
 * @returns {Array<object>}
 */
export function rollSocialEvents(state, outing, tier) {
  const out = [];
  const ctx = { state, outing, tier };
  for (const ev of SOCIAL_EVENTS) {
    if (out.length >= 2) break;
    let p = 0;
    try {
      p = ev.when(ctx);
    } catch {
      p = 0;
    }
    if (p > 0 && chance(p)) {
      const e = ev.apply(ctx);
      if (e) out.push(e);
    }
  }
  return out;
}
