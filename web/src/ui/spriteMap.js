// OYUN KAVRAMI → SPRITE eşlemesi. Bir görseli değiştirmek için yalnızca burayı düzenlemek yeterli.
// Sprite adları scripts/atlas/manifest.json'daki adlardır. Sprite yoksa SVG ikonlara düşülür.
import { FRAMES, sprite } from '../assets/sprites.js';
import { icon } from './art.js';

/** Ana ekrandaki haftalık aksiyon kutuları */
export const ACTION_SPRITES = {
  train: 'mini_goal',
  rest: 'bench_wood',
  team: 'bottle_crate',
  media: 'tv_mic',
  manager: 'tactics_board',
  sponsor: 'tv_camera',
};

/** Antrenman seçimi: her özelliğin ekipmanı */
export const TRAINING_SPRITES = {
  shooting: 'mini_goal',
  passing: 'cone',
  defending: 'mannequin',
  speed: 'ladder',
  stamina: 'stopwatch',
};

/** Ödüller (core/game.js'deki award.icon değerleri) */
export const AWARD_SPRITES = {
  trophy: 'cup_gold',
  boot: 'golden_boot',
  star: 'golden_ball',
  medal: 'medal_gold',
};

/** Metin olaylarındaki ikonlar (core/events.js icon alanı) */
export const EVENT_SPRITES = {
  bandage: 'medkit',
  briefcase: 'briefcase',
  megaphone: 'megaphone',
  trophy: 'cup_gold',
  star: 'trophy_star',
  boot: 'boots',
  mic: 'tv_mic',
  camera: 'tv_camera',
  clipboard: 'tactics_board',
  flag: 'fan_flag_1',
  news: 'press_badge',
  tent: 'disc_cones',
  dumbbell: 'cone',
  bolt: 'bottle_energy',
  medal: 'medal_gold',
  whistle: 'whistle',
};

/** Canlı anlatım satırlarının türleri (core/match.js + ui/screens/match.js) */
export const FEED_SPRITES = {
  whistle: 'whistle',
  'goal-my': 'ball',
  'goal-opp': 'ball',
  'goal-me': 'ball',
  chance: 'ball_retro',
  save: 'gloves',
  corner: 'corner_flag',
  card: 'card_yellow',
  post: 'goal_frame',
  offside: 'flag_linesman',
  tackle: 'boots',
  pass: 'cone',
  sub: 'sub_board',
  big: 'megaphone',
};

/** Maç öncesi: forma durumu görseli */
export const ROLE_SPRITES = {
  starter: 'tunnel_players',
  bench: 'bench_covered',
  injured: 'medkit',
  suspended: 'card_red',
};

/** Büyük olay görseli (yuvarlak köşeli kutu). Sprite yoksa SVG ikon. */
export function eventArt(iconName, { spriteName, cls = '', size = 60 } = {}) {
  const name = spriteName || EVENT_SPRITES[iconName];
  if (name && FRAMES[name]) return `<div class="event-art spr-art ${cls}">${sprite(name, { size })}</div>`;
  return `<div class="event-art ${cls}">${icon(iconName)}</div>`;
}

/** Ödül görseli */
export function awardArt(iconName, size = 40) {
  const name = AWARD_SPRITES[iconName];
  if (name && FRAMES[name]) return `<span class="tro spr-tro">${sprite(name, { size })}</span>`;
  return `<span class="tro">${icon(iconName || 'trophy', 'tro')}</span>`;
}

/** Aksiyon kutusu ikonu */
export function actionArt(actionId, fallbackIcon, size = 32) {
  const name = ACTION_SPRITES[actionId];
  return name && FRAMES[name] ? sprite(name, { size }) : icon(fallbackIcon);
}
