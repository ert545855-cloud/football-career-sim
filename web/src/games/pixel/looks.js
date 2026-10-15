// GÖRÜNÜŞLER — kulüp formasından piksel oyuncu görünüşü; takım arkadaşı/rakip/kaleci için rastgele ama tutarlı yüzler.
import { defaultLook, HAIR_STYLES, shade } from './playerPixels.js';

export const SKINS = ['#f6d3b3', '#e8b58f', '#c98e62', '#9a6440', '#6b4329'];
export const HAIR_COLORS = ['#1f1309', '#4a2c17', '#8b5a2b', '#d4a35a', '#e8e2d0', '#b23a1d'];
const NPC_BOOTS = [
  { main: '#16181d', accent: '#e5e7eb' },
  { main: '#f4f4f0', accent: '#2563eb' },
  { main: '#16181d', accent: '#c6ff3d' },
  { main: '#b91c1c', accent: '#f4f4f0' },
  { main: '#0ea5e9', accent: '#16181d' },
];

const lum = (hex) => {
  let h = String(hex || '#888').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Kulüp (ya da {colors:[c1,c2], pattern}) → forma; şort ikinci renk, tozluk ana renk. */
export function kitFrom(club) {
  const [c1, c2] = club?.colors || ['#2563eb', '#ffffff'];
  const pattern = ['stripes', 'hoops', 'half', 'sash', 'solid'].includes(club?.pattern) ? club.pattern : 'solid';
  // şort: koyu forma → açık şort olmasın diye ikinci renk; ikinci renk forma ile aynı tondaysa koyulaştır
  const shorts = Math.abs(lum(c1) - lum(c2)) < 0.12 ? shade(c1, -0.45) : c2;
  return { body: c1, accent: c2, pattern, shorts, socks: pattern === 'solid' ? c1 : c1 };
}

function seeded(seed) {
  let a = (Math.abs(Math.floor(seed)) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Takım arkadaşı / rakip: tohuma göre hep aynı yüz. */
export function npcLook(club, seed = 1, number = '') {
  const r = seeded(seed * 9973 + 17);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const styles = HAIR_STYLES.filter((h) => h !== 'mohawk' || r() < 0.3);
  return defaultLook({
    skin: pick(SKINS),
    hair: pick(styles),
    hairColor: pick(HAIR_COLORS.slice(0, 4)),
    kit: kitFrom(club),
    boots: pick(NPC_BOOTS),
    band: r() < 0.08 ? '#f4f4f0' : null,
    number: number === '' ? '' : String(number),
  });
}

/** Kaleci: kendine özgü forma + eldiven */
export function keeperLook(color = '#22d3ee', seed = 3) {
  const base = npcLook({ colors: [color, '#14110f'] }, seed);
  return { ...base, kit: { body: color, accent: shade(color, -0.35), pattern: 'solid', shorts: '#14110f', socks: color }, gloves: '#f4f4f0', longSleeve: true, number: '1' };
}

/** Sahibinin avatarından (ten/saç indeksleri) + kulüp formasından oyuncunun görünüşü. */
export function lookFromAvatar(avatar = {}, club, extra = {}) {
  return defaultLook({
    skin: SKINS[avatar.skin ?? 1] || SKINS[1],
    hair: HAIR_STYLES.includes(avatar.hair) ? avatar.hair : 'short',
    hairColor: HAIR_COLORS[avatar.hairColor ?? 0] || HAIR_COLORS[0],
    kit: kitFrom(club),
    ...extra,
  });
}
