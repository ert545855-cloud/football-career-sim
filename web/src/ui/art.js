// ÇİZİM GÖRSELLER — avatar, arma, forma, ikonlar ve mağaza görselleri (hepsi SVG, dış dosya yok).
import { AVATAR, CLUB_BY_ID } from '../core/data.js';

let uid = 0;
const nid = (p) => `${p}${++uid}`;

// ─────────────────────────────────────────────────────────────
// DESEN: forma ve armalarda ortak
// ─────────────────────────────────────────────────────────────
function patternFill(pattern, [c1, c2], x, y, w, h) {
  switch (pattern) {
    case 'stripes': {
      const n = 7;
      const sw = w / n;
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c1}"/>`;
      for (let i = 1; i < n; i += 2) s += `<rect x="${x + i * sw}" y="${y}" width="${sw}" height="${h}" fill="${c2}"/>`;
      return s;
    }
    case 'hoops': {
      const n = 7;
      const sh = h / n;
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c1}"/>`;
      for (let i = 1; i < n; i += 2) s += `<rect x="${x}" y="${y + i * sh}" width="${w}" height="${sh}" fill="${c2}"/>`;
      return s;
    }
    case 'half':
      return `<rect x="${x}" y="${y}" width="${w / 2}" height="${h}" fill="${c1}"/><rect x="${x + w / 2}" y="${y}" width="${w / 2}" height="${h}" fill="${c2}"/>`;
    case 'sash':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c1}"/><path d="M${x} ${y + h * 0.15} L${x + w * 0.15} ${y} L${x + w} ${y + h * 0.85} L${x + w * 0.85} ${y + h} Z" fill="${c2}"/>`;
    default:
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c1}"/><rect x="${x}" y="${y + h * 0.78}" width="${w}" height="${h * 0.08}" fill="${c2}" opacity="0.9"/>`;
  }
}

// ─────────────────────────────────────────────────────────────
// ARMA
// ─────────────────────────────────────────────────────────────
export function crestSVG(clubOrId, cls = 'crest') {
  const club = typeof clubOrId === 'string' ? CLUB_BY_ID[clubOrId] : clubOrId;
  if (!club) return '';
  const id = nid('cr');
  const shield = 'M50 4 L93 15 V56 C93 86 74 104 50 117 C26 104 7 86 7 56 V15 Z';
  const [c1, c2] = club.colors;
  const light = isLight(c1);
  const textColor = light ? '#0b0f0d' : '#ffffff';
  return `<svg class="${cls}" viewBox="0 0 100 121" aria-label="${club.name} arması">
    <defs>
      <clipPath id="${id}"><path d="${shield}"/></clipPath>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
    </defs>
    <g clip-path="url(#${id})">${patternFill(club.pattern, club.colors, 0, 0, 100, 121)}
      <rect x="0" y="44" width="100" height="30" fill="${light ? '#0b0f0d' : '#000'}" opacity="${light ? 0.12 : 0.35}"/>
      <rect x="0" y="0" width="100" height="121" fill="url(#${id}g)"/>
    </g>
    <path d="${shield}" fill="none" stroke="${c2}" stroke-width="5"/>
    <path d="${shield}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.5"/>
    <text x="50" y="66" text-anchor="middle" font-size="21" font-weight="900" fill="${light ? textColor : '#fff'}" font-family="system-ui, sans-serif" letter-spacing="1" style="paint-order:stroke" stroke="${light ? 'none' : '#000'}" stroke-opacity=".35" stroke-width="2">${club.short}</text>
    <path d="M38 20 l12 -7 l12 7" fill="none" stroke="${c2}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function isLight(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 170;
}

// ─────────────────────────────────────────────────────────────
// AVATAR (büst + forma)
// ─────────────────────────────────────────────────────────────
function shade(hex, amt) {
  const h = hex.replace('#', '');
  const f = (i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * (1 + amt))));
  return `#${[0, 2, 4].map((i) => f(i).toString(16).padStart(2, '0')).join('')}`;
}

function hairSVG(style, c) {
  const dark = shade(c, -0.25);
  switch (style) {
    case 'buzz':
      return `<path d="M37 51 C36 32 47 23 60 23 C73 23 84 32 83 51 C80 42 73 36 60 36 C47 36 40 42 37 51 Z" fill="${c}" opacity=".85"/>`;
    case 'curly': {
      let s = '';
      const pts = [[40, 42], [44, 33], [51, 27], [60, 25], [69, 27], [76, 33], [80, 42], [47, 37], [56, 32], [65, 32], [73, 37], [38, 50], [82, 50]];
      for (const [x, y] of pts) s += `<circle cx="${x}" cy="${y}" r="7.5" fill="${c}"/>`;
      return `${s}<path d="M42 36 q18 -8 36 0" stroke="${dark}" stroke-width="2" fill="none" opacity=".5"/>`;
    }
    case 'long':
      return `<path d="M35 60 C30 30 45 19 60 19 C76 19 90 30 85 60 C85 70 83 78 80 84 L78 50 C74 39 67 34 60 34 C52 34 45 39 42 50 L40 84 C37 78 35 70 35 60 Z" fill="${c}"/><path d="M48 24 q12 -4 24 2" stroke="${shade(c, 0.3)}" stroke-width="2" fill="none" opacity=".6"/>`;
    case 'mohawk':
      return `<path d="M38 50 C37 36 46 27 60 27 C74 27 83 36 82 50 C79 42 72 38 60 38 C48 38 41 42 38 50 Z" fill="${c}" opacity=".35"/><path d="M53 14 C56 10 64 10 67 14 L67 40 C64 37 56 37 53 40 Z" fill="${c}"/>`;
    case 'bald':
      return `<ellipse cx="52" cy="34" rx="8" ry="4" fill="#fff" opacity=".18"/>`;
    default:
      return `<path d="M36 50 C35 29 47 20 60 20 C75 20 86 29 84 50 C81 40 75 33 61 33 C55 38 45 40 36 50 Z" fill="${c}"/><path d="M60 21 C66 24 74 27 79 35" stroke="${shade(c, 0.35)}" stroke-width="2" fill="none" opacity=".5"/>`;
  }
}

export function avatarSVG(avatar = {}, kit = {}, number = 9, cls = '') {
  const skin = AVATAR.skins[avatar.skin ?? 1] || AVATAR.skins[1];
  const hairC = AVATAR.hairColors[avatar.hairColor ?? 1] || AVATAR.hairColors[1];
  const style = avatar.hair || 'short';
  const colors = kit.colors || ['#1d4ed8', '#f8fafc'];
  const pattern = kit.pattern || 'solid';
  const id = nid('av');
  const skinD = shade(skin, -0.18);
  const numColor = isLight(colors[0]) ? '#0b0f0d' : '#ffffff';
  return `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="M6 122 C8 98 28 87 60 87 C92 87 112 98 114 122 Z"/></clipPath>
    <radialGradient id="${id}f" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></radialGradient></defs>
    <g clip-path="url(#${id})">${patternFill(pattern, colors, 0, 80, 120, 42)}<rect x="0" y="80" width="120" height="42" fill="#000" opacity=".12"/></g>
    <path d="M47 87 L60 100 L73 87" fill="none" stroke="${colors[1]}" stroke-width="4" stroke-linejoin="round"/>
    <text x="60" y="117" text-anchor="middle" font-size="14" font-weight="900" fill="${numColor}" font-family="system-ui,sans-serif">${number}</text>
    <rect x="51" y="68" width="18" height="22" rx="7" fill="${skinD}"/>
    <circle cx="38" cy="55" r="5.5" fill="${skinD}"/><circle cx="82" cy="55" r="5.5" fill="${skinD}"/>
    <ellipse cx="60" cy="52" rx="22.5" ry="26.5" fill="${skin}"/>
    <ellipse cx="60" cy="52" rx="22.5" ry="26.5" fill="url(#${id}f)"/>
    <path d="M45 46 q6 -4 12 -1" stroke="${shade(hairC, -0.1)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M63 45 q6 -3 12 1" stroke="${shade(hairC, -0.1)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="51" cy="54" rx="3.2" ry="3.7" fill="#1b1410"/><ellipse cx="69" cy="54" rx="3.2" ry="3.7" fill="#1b1410"/>
    <circle cx="52.1" cy="52.8" r="1" fill="#fff"/><circle cx="70.1" cy="52.8" r="1" fill="#fff"/>
    <path d="M60 57 Q56.5 64 60 66" stroke="${skinD}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M52.5 70 Q60 76 67.5 70" stroke="#8a3d2f" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="46" cy="64" rx="4" ry="2.5" fill="#ff8a7a" opacity=".18"/><ellipse cx="74" cy="64" rx="4" ry="2.5" fill="#ff8a7a" opacity=".18"/>
    ${hairSVG(style, hairC)}
  </svg>`;
}

export function playerAvatar(state, cls = '') {
  const club = CLUB_BY_ID[state.career.clubId];
  return avatarSVG(state.player.avatar, club, state.player.number, cls);
}

// ─────────────────────────────────────────────────────────────
// TOP
// ─────────────────────────────────────────────────────────────
export function ballSVG() {
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <defs><radialGradient id="ballg" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e6ece8"/><stop offset="1" stop-color="#9fb0a7"/></radialGradient></defs>
    <circle cx="50" cy="50" r="47" fill="url(#ballg)" stroke="#0b1a12" stroke-width="2"/>
    <g fill="#111a15">
      <polygon points="50,34 64,44 59,60 41,60 36,44"/>
      <path d="M50 3 L60 10 L56 21 L44 21 L40 10 Z"/>
      <path d="M90 32 L96 46 L86 56 L76 48 L79 35 Z"/>
      <path d="M78 84 L66 94 L56 88 L60 76 L72 74 Z"/>
      <path d="M22 84 L28 74 L40 76 L44 88 L34 94 Z"/>
      <path d="M10 32 L21 35 L24 48 L14 56 L4 46 Z"/>
    </g>
    <g stroke="#111a15" stroke-width="2" fill="none" opacity=".75">
      <path d="M50 34 L50 21"/><path d="M64 44 L76 48"/><path d="M59 60 L66 74"/><path d="M41 60 L34 74"/><path d="M36 44 L24 48"/>
    </g>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// İKONLAR (24×24, çizgi)
// ─────────────────────────────────────────────────────────────
const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  table: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17M3.5 14h17M9 4v16"/>',
  bag: '<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M16 5.5h3.5V7a3.5 3.5 0 0 1-3.5 3.5M8 5.5H4.5V7A3.5 3.5 0 0 0 8 10.5"/><path d="M12 13v3.5M8.5 20h7M10 16.5h4l.5 3.5h-5z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5c1 1.4 2.4 2 4 2s3-.6 4-2"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5 7 18.5M8 10 3.5 8.5"/>',
  dumbbell: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10.5" r="1.8"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.3c1.8.8 3 2.6 3.5 5.2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
  camera: '<path d="M3.5 8.5h3.5L8.5 6h7l1.5 2.5h3.5V19h-17z"/><circle cx="12" cy="13" r="3.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.7 0-2.8.9-2.8 2s1 1.6 2.8 2 2.9.9 2.9 2.1-1.2 2-2.9 2c-1.3 0-2.4-.5-3-1.3M12 6.5v1.5M12 16v1.5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  flag: '<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>',
  news: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7 9h10M7 12.5h10M7 16h6"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  cake: '<path d="M4 20.5h16M5.5 20.5v-7h13v7M5.5 16.5c2 1 4 1 6.5 0s4.5-1 6.5 0"/><path d="M12 13.5v-3M12 7.5a1.5 1.5 0 0 1-1.5-1.5c0-1.2 1.5-2.5 1.5-2.5s1.5 1.3 1.5 2.5A1.5 1.5 0 0 1 12 7.5z"/>',
  briefcase: '<rect x="3.5" y="7" width="17" height="13" rx="2"/><path d="M9 7V5h6v2M3.5 12.5h17"/>',
  bandage: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M10.5 11h.01M13.5 13h.01M12 9.5h.01M12 14.5h.01" stroke-width="2.6"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18.5z"/>',
  utensils: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 3.5-3 6.5V13h3V21"/>',
  megaphone: '<path d="M4 10v4h3l7 4.5V5.5L7 10z"/><path d="M18 9a3.5 3.5 0 0 1 0 6M7 14l1.5 5.5h2.5L10 15"/>',
  tent: '<path d="M3 20h18M12 4 3.5 20M12 4l8.5 16M12 4v3M9.5 20 12 14l2.5 6"/>',
  brain: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 4.5 3 3 0 0 0 5 1V5.5a2.5 2.5 0 0 0-2-1zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 4.5 3 3 0 0 1-5 1V5.5a2.5 2.5 0 0 1 2-1z"/>',
  boot: '<path d="M4 6.5h6.5l.5 5 6 2c2.2.7 3.5 2 3.5 3.5V18.5H4z"/><path d="M4 15.5h16.5M7 18.5v2M11 18.5v2M15 18.5v2"/>',
  medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="M8.5 9.8 6 3.5h4l2 4 2-4h4l-2.5 6.3"/><path d="m12 12 .9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z"/>',
  sound: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  vibrate: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4 9v6M2 10.5v3M20 9v6M22 10.5v3"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4.5v4.5h-4.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01" stroke-width="2.6"/>',
  whistle: '<circle cx="9" cy="14" r="5"/><path d="M13 11.5l7.5-4.5V11L14 14"/><path d="M9 14h.01" stroke-width="3"/>',
  fire: '<path d="M12 21c-4 0-6.5-2.7-6.5-6 0-4 3.5-5.5 3.5-9.5 2.5 1.2 4.5 3.7 4.5 6.5.8-.6 1.3-1.6 1.5-2.7 2 1.6 3.5 3.6 3.5 6.2 0 3-2.5 5.5-6.5 5.5z"/>',
  swap: '<path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5"/>',
  share: '<path d="M12 3.5v11M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v7h14v-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  run: '<circle cx="14.5" cy="4.5" r="2"/><path d="M8 21l3-6 3 2.5V21M6.5 11.5 9 8.5l4 1 2.5 3.5 3 .5M11 15l-1-4.5"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6z"/>',
  chirp: '<path d="M4 18.5V7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v5a3.5 3.5 0 0 1-3.5 3.5H9z"/><path d="M9.5 9.5c1.2-1.4 3.6-1.6 5 .2l1.8-.5-1 1.6c0 2-1.7 3.2-3.6 3.2-1 0-1.9-.3-2.5-.9 1 0 1.8-.3 2.3-.8-1-.2-1.8-1-2-1.8z" fill="currentColor" stroke="none"/>',
  reply: '<path d="M4.5 18.5v-3A6 6 0 0 1 10.5 9.5h9"/><path d="M15.5 5.5l4 4-4 4"/>',
  comment: '<path d="M4 18.5V7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v5a3.5 3.5 0 0 1-3.5 3.5H9z"/>',
  repost: '<path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="M18 7v4M6 17v-4"/>',
  heartFill: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
};

export function icon(name, cls = 'ico') {
  const d = P[name] || P.info;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

// ─────────────────────────────────────────────────────────────
// MAĞAZA GÖRSELLERİ (64×64, dolgulu)
// ─────────────────────────────────────────────────────────────
const wheel = (cx, cy, r = 6) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1f2937"/><circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="#cbd5e1"/>`;
const ground = '<ellipse cx="32" cy="52" rx="26" ry="3.5" fill="#000" opacity=".25"/>';

const ART = {
  bike: () => `${ground}<g stroke="#e2e8f0" stroke-width="2.2" fill="none" stroke-linecap="round"><circle cx="18" cy="42" r="9"/><circle cx="46" cy="42" r="9"/><path d="M18 42 27 28h14l5 14M27 28l7 14h-7M41 28l-2-5h-5M24 24h6"/></g><circle cx="34" cy="42" r="2" fill="#c6ff3d"/>`,
  car: (t = '#60a5fa') => `${ground}<path d="M7 42v-6c0-2 1.5-3.5 3.5-4l6-1.5 6-7c1-1.2 2.5-1.5 4-1.5h11c1.5 0 3 .6 4 1.8l6 6.7 5 1c2 .4 3.5 2 3.5 4V42z" fill="${t}"/><path d="M24.5 24.5h7v7H19zM34 24.5h5.5l6 7H34z" fill="#bae6fd" opacity=".85"/><rect x="7" y="38" width="50" height="4" fill="#000" opacity=".15"/>${wheel(18, 43)}${wheel(46, 43)}<rect x="52" y="35" width="4" height="2.5" rx="1" fill="#fde68a"/>`,
  suv: (t = '#111827') => `${ground}<path d="M6 43V28c0-2 1.5-3.5 3.5-3.5H18l5-6h20l6 6h6c2 0 3.5 1.5 3.5 3.5V43z" fill="${t}" stroke="#475569" stroke-width="1"/><path d="M24 20.5h8v6H19.5zM35 20.5h7l5 6H35z" fill="#7dd3fc" opacity=".8"/>${wheel(17, 44, 7)}${wheel(47, 44, 7)}<rect x="55" y="31" width="3" height="3" rx="1" fill="#fde68a"/>`,
  supercar: (t = '#ef4444') => `${ground}<path d="M4 42c0-3 1.5-5 4-6l13-5 9-6c1.5-1 3.5-1.5 5.5-1.5H44c3 0 6 1.5 8 4l5 6c1.5 1.5 2.5 3.5 2.5 5.5V42z" fill="${t}"/><path d="M28 27l4-2.5h11c2 0 3.5 1 4.5 2.5l2.5 4H25z" fill="#0f172a" opacity=".85"/><path d="M8 38h50" stroke="#000" stroke-opacity=".25" stroke-width="2"/>${wheel(16, 43, 6.5)}${wheel(48, 43, 6.5)}<path d="M55 35h4" stroke="#fde68a" stroke-width="2.5" stroke-linecap="round"/>`,
  flat: () => `${ground}<rect x="14" y="16" width="36" height="36" rx="2" fill="#94a3b8"/><rect x="14" y="13" width="36" height="5" fill="#64748b"/>${win(19, 22)}${win(35, 22)}${win(19, 34)}${win(35, 34)}<rect x="28" y="42" width="8" height="10" fill="#7c2d12"/>`,
  building: () => `${ground}<rect x="10" y="20" width="22" height="32" fill="#a5b4fc"/><rect x="30" y="10" width="24" height="42" fill="#818cf8"/>${[14, 22].map((y) => [13, 21].map((x) => win(x, y + 6, 6, 5)).join('')).join('')}${[14, 22, 30, 38].map((y) => [34, 44].map((x) => win(x, y, 6, 5)).join('')).join('')}<rect x="8" y="48" width="48" height="4" fill="#38bdf8" opacity=".6"/>`,
  tower: () => `${ground}<path d="M22 52V12l10-5 10 5v40z" fill="#e0f2fe"/><path d="M22 12l10-5 10 5" fill="#7dd3fc"/>${[16, 23, 30, 37, 44].map((y) => `<rect x="25" y="${y}" width="14" height="3.5" fill="#38bdf8" opacity=".85"/>`).join('')}<path d="M4 52c6-3 10-3 16 0s10 3 16 0 10-3 16 0 8 2 8 2" stroke="#0ea5e9" stroke-width="3" fill="none"/>`,
  house: () => `${ground}<path d="M10 30 32 13l22 17" fill="#b91c1c"/><rect x="14" y="29" width="36" height="23" fill="#fef3c7"/><rect x="28" y="38" width="8" height="14" fill="#92400e"/>${win(18, 34, 7, 6)}${win(39, 34, 7, 6)}<circle cx="9" cy="44" r="6" fill="#16a34a"/><circle cx="56" cy="45" r="5" fill="#16a34a"/><rect x="40" y="16" width="5" height="9" fill="#7f1d1d"/>`,
  massage: () => `${ground}<path d="M20 18h22a5 5 0 0 1 5 5v5a5 5 0 0 1-5 5H32v15a4 4 0 0 1-8 0V33h-4a5 5 0 0 1-5-5v-5a5 5 0 0 1 5-5z" fill="#334155"/><circle cx="50" cy="25.5" r="6" fill="#c6ff3d"/><rect x="24" y="24" width="14" height="3" rx="1.5" fill="#94a3b8"/>`,
  tablet: () => `${ground}<rect x="12" y="12" width="40" height="38" rx="5" fill="#1e293b"/><rect x="16" y="16" width="32" height="28" rx="2" fill="#0f172a"/><path d="M19 38l7-8 6 5 7-10 6 6" stroke="#c6ff3d" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="47" r="1.5" fill="#475569"/>`,
  apple: () => `${ground}<path d="M32 22c-4-3-14-3-16 7-2 9 4 21 10 21 3 0 4-1.5 6-1.5s3 1.5 6 1.5c6 0 12-12 10-21-2-10-12-10-16-7z" fill="#22c55e"/><path d="M32 22c0-5 2-8 6-10" stroke="#65a30d" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="24" cy="30" rx="3" ry="5" fill="#fff" opacity=".25"/>`,
  whistle: () => `${ground}<circle cx="26" cy="36" r="13" fill="#e2e8f0"/><path d="M34 26l18-8v10l-16 8z" fill="#cbd5e1"/><circle cx="26" cy="36" r="4" fill="#475569"/><path d="M14 30c-4-6-2-12 4-14" stroke="#c6ff3d" stroke-width="2.5" fill="none"/>`,
  snow: () => `${ground}<g stroke="#7dd3fc" stroke-width="3" stroke-linecap="round"><path d="M32 10v38M14 19l36 20M50 19 14 39"/><path d="M26 13l6 5 6-5M26 45l6-5 6 5M13 27l8-1-3-7M51 27l-8-1 3-7M13 31l8 1-3 7M51 31l-8 1 3 7" fill="none"/></g>`,
  gamepad: () => `${ground}<path d="M20 22h24c7 0 11 8 12 16 1 7-4 11-9 8l-6-5H23l-6 5c-5 3-10-1-9-8 1-8 5-16 12-16z" fill="#1e293b"/><path d="M20 29v8M16 33h8" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/><circle cx="43" cy="30" r="2.5" fill="#f43f5e"/><circle cx="48" cy="35" r="2.5" fill="#c6ff3d"/><circle cx="38" cy="35" r="2.5" fill="#38bdf8"/>`,
  dog: () => `${ground}<ellipse cx="34" cy="38" rx="15" ry="10" fill="#d97706"/><circle cx="18" cy="27" r="9" fill="#d97706"/><path d="M12 21l-3-9 8 5zM22 19l3-9 2 9z" fill="#92400e"/><circle cx="15" cy="27" r="1.5" fill="#111"/><circle cx="10.5" cy="30" r="2" fill="#111"/><rect x="22" y="44" width="4" height="8" rx="2" fill="#b45309"/><rect x="40" y="44" width="4" height="8" rx="2" fill="#b45309"/><path d="M48 33c4-4 6-8 5-12" stroke="#d97706" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M14 34h8" stroke="#ef4444" stroke-width="3"/>`,
  watch: () => `${ground}<rect x="26" y="6" width="12" height="52" rx="4" fill="#a16207"/><circle cx="32" cy="32" r="13" fill="#fde68a"/><circle cx="32" cy="32" r="10" fill="#0f172a"/><path d="M32 25v7l5 3" stroke="#fde68a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  heart: () => `${ground}<path d="M32 50S12 38 12 24a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 14-20 26-20 26z" fill="#f43f5e"/><circle cx="32" cy="27" r="7" fill="#fff"/><path d="m32 22.5 2.6 1.9-1 3.1h-3.2l-1-3.1z" fill="#111"/>`,
  spa: () => `${ground}<path d="M32 50c-10 0-16-6-16-12 6 0 12 3 16 8 4-5 10-8 16-8 0 6-6 12-16 12z" fill="#2dd4bf"/><path d="M32 46c-5-6-6-15 0-24 6 9 5 18 0 24z" fill="#5eead4"/><path d="M22 18c2-3 2-6 0-8M30 14c2-3 2-6 0-8M38 18c2-3 2-6 0-8" stroke="#99f6e4" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  plane: () => `${ground}<path d="M8 34l14-1 12-15h6l-6 15 14-1 5-6h4l-3 9 3 9h-4l-5-6-14-1 6 15h-6L22 37l-14-1z" fill="#e2e8f0"/><circle cx="52" cy="14" r="6" fill="#fbbf24"/>`,
};

function win(x, y, w = 9, h = 7) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="#e0f2fe"/><rect x="${x}" y="${y}" width="${w}" height="${h / 2}" fill="#fff" opacity=".35"/>`;
}

export function itemArt(item) {
  const fn = ART[item.art] || ART.heart;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${fn(item.tint)}</svg>`;
}

// ─────────────────────────────────────────────────────────────
// CHIRP AVATARLARI
// ─────────────────────────────────────────────────────────────
/** Gazeteci / oyuncu / taraftar botu avatarı (daire içinde). */
export function chirpAvatar(author, size = 44) {
  const a = author.avatar || {};
  if (a.look) {
    return `<span class="tw-av" style="width:${size}px;height:${size}px;border-color:${a.color || '#475569'}">${avatarSVG(a.look, { colors: a.kit || ['#1e293b', '#e2e8f0'], pattern: 'solid' }, '')}</span>`;
  }
  return `<span class="tw-av init" style="width:${size}px;height:${size}px;background:${a.color || '#475569'};font-size:${Math.round(size * 0.36)}px">${(a.initials || '?').replace(/[<>&]/g, '')}</span>`;
}
