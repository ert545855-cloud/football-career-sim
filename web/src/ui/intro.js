// GİRİŞ HİKÂYESİ — animasyonlu piksel sahneler: mahallede top peşinde bir çocuk, babasıyla kavga,
// gece verilen karar, şafakta gizlice evden çıkış, sokaklarda koşu ve stadyum kapısında seçmeler.
// Dokun: yazıyı tamamla / sonraki repliğe geç. "Atla" ile doğrudan isim ekranına.
// Mantıksal tuval 180×320 birim; her şey tam sayı birimlerle çizilir (piksel sanat görünümü).
import { el } from './dom.js';
import { drawPixelPlayer, drawPixelBall, crispScale, SPRITE_SCALE, SPRITE_W, SPRITE_H } from '../games/pixel/sprites.js';
import { defaultLook } from '../games/pixel/playerPixels.js';
import { npcLook } from '../games/pixel/looks.js';
import { drawSprite } from '../assets/sprites.js';
import { playMusic, setMusicIntensity } from '../music/player.js';
import { sfx, unlock } from '../audio.js';

const VW = 180;
const VH = 320;

const KID = defaultLook({ skin: '#e8b58f', hair: 'short', hairColor: '#2a1a10', kit: { body: '#d63a3a', accent: '#f4f4f0', pattern: 'solid', shorts: '#35507a', socks: '#e5e7eb' }, boots: { main: '#f4f4f0', accent: '#d63a3a' } });
const LITTLE = defaultLook({ ...KID, kit: { body: '#f2b632', accent: '#f2b632', pattern: 'solid', shorts: '#35507a', socks: '#f4f4f0' }, boots: { main: '#6b4a2b', accent: '#6b4a2b' } });
const DAD = defaultLook({ skin: '#dca37c', hair: 'short', hairColor: '#4a423c', kit: { body: '#6d7f95', accent: '#6d7f95', pattern: 'solid', shorts: '#30343c', socks: '#30343c' }, boots: { main: '#2a221d', accent: '#2a221d' }, longSleeve: true });
const COACH = defaultLook({ skin: '#c98e62', hair: 'buzz', hairColor: '#1f1309', kit: { body: '#1f3b73', accent: '#f4f4f0', pattern: 'solid', shorts: '#1f3b73', socks: '#1f3b73' }, boots: { main: '#111', accent: '#f4f4f0' }, longSleeve: true });

/** Sahneler: süre (sn), müzik yoğunluğu, altyazılar ve konuşmalar (zaman, kim, metin) */
const EDGE = {
  street: ['#141a3a', '#4c4d55'], home: ['#4a3b34', '#6a4a32'], room: ['#2a3048', '#3b2f2a'],
  dawn: ['#352c3a', '#4a382c'], run: ['#f39a5c', '#6c6a72'], gate: ['#7fb3e6', '#8b8f99'],
};

const SCENES = [
  {
    id: 'street', dur: 8, music: 1,
    captions: [[0.3, 'Mahallede herkes onu tanırdı…'], [4, '…topu ayağından hiç düşürmeyen çocuk.']],
  },
  {
    id: 'home', dur: 17, music: 0,
    captions: [[0, 'Yıllar sonra. 17 yaşında.']],
    lines: [
      [1.2, 'kid', 'Baba… Cumartesi seçmeler var. Gitmek istiyorum.'],
      [4.8, 'dad', 'Seçme mi?! Sınavına iki ay kaldı oğlum!'],
      [8.4, 'kid', 'Ben futbolcu olacağım baba. Hep bunu istedim.'],
      [12, 'dad', 'Futbol karın doyurmaz! Bu evde top lafı istemiyorum!', 'angry'],
    ],
  },
  {
    id: 'room', dur: 9, music: 1,
    captions: [[0.3, 'O gece gözüne uyku girmedi.'], [4.5, 'Kararını vermişti.']],
  },
  {
    id: 'dawn', dur: 8, music: 2,
    captions: [[0.3, 'Şafak sökerken, babasından gizli…']],
  },
  {
    id: 'run', dur: 8.5, music: 3,
    captions: [[0.3, 'Kalbi yerinden çıkacak gibiydi.'], [4.2, 'Ama geri dönmeyecekti.']],
  },
  {
    id: 'gate', dur: 7.5, music: 2,
    captions: [[0.2, 'Şehir Stadı · Seçmeler']],
    lines: [[2.4, 'coach', 'Sıradaki! Adın ne, evlat?']],
  },
];

// ───────────────────────── Çizim yardımcıları ─────────────────────────
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function bands(c, y0, y1, cols) {
  const h = (y1 - y0) / cols.length;
  cols.forEach((col, i) => R(c, 0, y0 + i * h, VW, Math.ceil(h) + 1, col));
}

function stars(c, n, seed, h = 140, tw = 0) {
  let a = seed;
  const r = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const x = r() * VW;
    const y = r() * h;
    const on = Math.sin(tw * 2 + i) > -0.6;
    if (on) R(c, x, y, 1, 1, i % 5 ? '#cfd8ff' : '#fff6c8');
  }
}

function moon(c, x, y, r = 7, col = '#fff3c4') {
  for (let j = -r; j <= r; j++) {
    const w = Math.round(Math.sqrt(r * r - j * j));
    R(c, x - w, y + j, w * 2, 1, col);
  }
  R(c, x - 2, y - 2, 2, 2, '#e8dba4');
  R(c, x + 2, y + 2, 2, 1, '#e8dba4');
}

function house(c, x, y, w, h, wall, roof, lit, t = 0) {
  R(c, x, y, w, h, wall);
  for (let i = 0; i < 5; i++) R(c, x - 2 + i, y - 1 - i, w + 4 - i * 2, 1, roof);
  R(c, x - 2, y - 1, w + 4, 2, roof);
  const cols = Math.max(1, Math.floor((w - 4) / 8));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < Math.floor((h - 6) / 10); j++) {
      const on = lit && ((i * 7 + j * 3 + Math.floor(t * 0.3)) % 4 !== 0);
      R(c, x + 3 + i * 8, y + 4 + j * 10, 5, 6, on ? '#ffd76a' : '#2b3550');
      R(c, x + 3 + i * 8, y + 4 + j * 10 + 3, 5, 1, on ? '#e9b949' : '#1d2438');
    }
  }
}

function lamp(c, x, y, on = true) {
  R(c, x, y, 2, 46, '#2b2f3a');
  R(c, x - 3, y - 2, 8, 3, '#2b2f3a');
  if (on) {
    R(c, x - 2, y + 1, 6, 2, '#ffe9a0');
    c.fillStyle = 'rgba(255, 220, 140, 0.12)';
    c.beginPath(); c.moveTo(x - 2, y + 3); c.lineTo(x - 16, y + 46); c.lineTo(x + 18, y + 46); c.lineTo(x + 4, y + 3); c.fill();
  }
}

/** Piksel oyuncu + bıyık (baba); x,y ayak noktası; h birim boy */
function person(c, look, x, y, h, o = {}) {
  drawPixelPlayer(c, x, y, h, look, { dir: 'side', shadow: true, ...o });
  if (o.mustache) {
    const s = crispScale(c, (h * SPRITE_SCALE) / SPRITE_H);
    const left = x - (SPRITE_W * s) / 2;
    const top = y - SPRITE_H * s + s * 0.5 - (o.lift || 0);
    for (const col of [9, 10, 11]) {
      const gx = o.flip ? SPRITE_W - 1 - col : col;
      R(c, left + gx * s, top + 5 * s, Math.ceil(s), Math.ceil(s), '#2a201b');
    }
  }
}

function angerMark(c, x, y, t) {
  const p = 1 + Math.round(Math.sin(t * 18));
  const col = '#ff3b3b';
  R(c, x - 3 - p, y, 2, 2, col); R(c, x + 2 + p, y, 2, 2, col);
  R(c, x, y - 3 - p, 2, 2, col); R(c, x, y + 2 + p, 2, 2, col);
}

// ───────────────────────── Sahne çizimleri ─────────────────────────
const DRAW = {
  street(c, t) {
    bands(c, 0, 210, ['#141a3a', '#1c2350', '#2a2c63', '#3f3473', '#5c3c78', '#7d4776']);
    stars(c, 40, 7, 120, t);
    moon(c, 140, 40);
    house(c, -4, 120, 52, 92, '#3a3550', '#5a2f3a', true, t);
    house(c, 54, 136, 44, 76, '#43405e', '#6b3434', true, t + 3);
    house(c, 104, 112, 80, 100, '#383450', '#52303b', true, t + 5);
    // Duvar (top sektirilen)
    R(c, 0, 198, VW, 18, '#8a7d70');
    for (let i = 0; i < 12; i++) R(c, i * 16 + (i % 2) * 4, 202 + (i % 2) * 6, 12, 1, '#6f6459');
    R(c, 0, 216, VW, 104, '#4c4d55');
    for (let i = 0; i < 9; i++) R(c, i * 22 - ((t * 0) % 22), 262, 12, 2, '#6d6e78');
    lamp(c, 26, 168);
    // Çocuk top sektiriyor (juggle)
    const ph = (t * 2.4) % 1;
    const bh = Math.sin(ph * Math.PI) * 26;
    const kx = 92;
    const ky = 286;
    person(c, LITTLE, kx, ky, 40, { frame: ph < 0.18 ? 'kick' : 'idle', flip: false });
    drawPixelBall(c, kx + 8, ky - 6 - bh, 9, t * 6, { lift: 0 });
    // Pencereden bakan komşu, kedi
    R(c, 150, 196, 8, 2, '#222'); R(c, 151, 192, 3, 4, '#222'); R(c, 156, 191, 2, 2, '#222');
  },

  home(c, t, S) {
    // Duvar kâğıdı + zemin
    R(c, 0, 0, VW, 236, '#4a3b34');
    for (let x = 0; x < VW; x += 12) R(c, x, 0, 1, 236, '#55443c');
    R(c, 0, 236, VW, 84, '#6a4a32');
    for (let x = 0; x < VW; x += 20) R(c, x, 236, 1, 84, '#5b3f2a');
    R(c, 0, 234, VW, 3, '#2e2420');
    // Pencere (gece)
    R(c, 20, 60, 46, 54, '#2b221d'); R(c, 23, 63, 40, 48, '#1a2148'); for (const [sx, sy] of [[27, 92], [50, 68], [57, 80], [48, 98], [30, 100]]) R(c, sx, sy, 1, 1, '#cfd8ff'); R(c, 42, 63, 2, 48, '#2b221d'); R(c, 23, 86, 40, 2, '#2b221d');
    moon(c, 33, 74, 4);
    // Duvarda çerçeveli fotoğraf (çocukken takım fotoğrafı) ve saat
    R(c, 110, 70, 30, 22, '#c9a96e'); R(c, 112, 72, 26, 18, '#7aa3c9'); R(c, 112, 84, 26, 6, '#3f8a46');
    for (let i = 0; i < 4; i++) R(c, 115 + i * 6, 79, 3, 6, i % 2 ? '#f2b632' : '#d63a3a');
    R(c, 152, 54, 14, 14, '#2e2420'); R(c, 154, 56, 10, 10, '#efe6d2'); R(c, 158, 57, 1, 5, '#222'); R(c, 158, 61, 4, 1, '#222');
    // Lamba
    R(c, 89, 0, 2, 40, '#2e2420'); R(c, 82, 40, 16, 6, '#e8c26a'); c.fillStyle = 'rgba(255, 214, 120, 0.08)'; c.fillRect(40, 46, 100, 190);
    // Masa (baba yumruğunu vurunca sarsılır)
    const slam = S.angryT != null && t - S.angryT < 0.5 ? Math.round(Math.sin((t - S.angryT) * 60) * 1.5) : 0;
    R(c, 96, 238 + slam, 70, 6, '#8b5a3c'); R(c, 100, 244 + slam, 4, 30, '#6d452e'); R(c, 158, 244 + slam, 4, 30, '#6d452e');
    R(c, 104, 232 + slam, 10, 6, '#efe6d2'); R(c, 106, 230 + slam, 6, 2, '#c8b89a'); // çay bardağı
    R(c, 130, 233 + slam, 22, 5, '#d8d2c4'); R(c, 132, 234 + slam, 18, 1, '#9a948a'); // gazete
    // Karakterler
    const angry = S.angryT != null && t >= S.angryT;
    const shake = angry && t - S.angryT < 1.6 ? Math.round(Math.sin(t * 40)) : 0;
    const dadX = 140 + shake;
    person(c, DAD, dadX, 294, 62, { flip: true, frame: angry && t - S.angryT < 0.6 ? 'lunge' : 'idle', mustache: true });
    if (angry) angerMark(c, dadX - 12, 222, t);
    // Çocuk: topu kucağında; baba bağırınca başı önde (biraz geri çekilir)
    const kidX = 54 - (angry ? Math.min(8, (t - S.angryT) * 10) : 0);
    person(c, KID, kidX, 294, 50, { flip: false });
    if (!angry || t - S.angryT < 0.4) drawPixelBall(c, kidX + 11, 266, 10, 0);
    else drawPixelBall(c, kidX + 22 + Math.min(30, (t - S.angryT) * 40), 292 - Math.abs(Math.sin((t - S.angryT) * 7)) * 10 * Math.max(0, 1 - (t - S.angryT) / 2), 9, t * 4);
  },

  room(c, t) {
    R(c, 0, 0, VW, 250, '#2a3048');
    for (let x = 0; x < VW; x += 10) R(c, x, 0, 1, 250, '#2f3652');
    R(c, 0, 250, VW, 70, '#3b2f2a');
    // Pencere ve ay ışığı
    R(c, 104, 40, 56, 66, '#1a1f33'); R(c, 107, 43, 50, 60, '#0f1430');
    for (const [sx, sy] of [[112, 50], [122, 88], [150, 92], [114, 96], [126, 56]]) R(c, sx, sy, 1, 1, '#cfd8ff');
    moon(c, 144, 58, 6);
    R(c, 131, 43, 2, 60, '#1a1f33'); R(c, 107, 72, 50, 2, '#1a1f33');
    c.fillStyle = 'rgba(200, 215, 255, 0.07)';
    c.beginPath(); c.moveTo(107, 103); c.lineTo(157, 103); c.lineTo(120, 250); c.lineTo(40, 250); c.fill();
    // Duvarda forma posteri ve seçme ilanı (titreşerek odak)
    R(c, 14, 40, 34, 46, '#ece4d0'); R(c, 18, 46, 26, 26, '#d63a3a'); R(c, 26, 52, 10, 3, '#f4f4f0'); R(c, 29, 55, 4, 12, '#f4f4f0');
    R(c, 18, 76, 26, 2, '#555'); R(c, 18, 80, 18, 2, '#888');
    const glow = 0.5 + Math.sin(t * 4) * 0.5;
    R(c, 56, 52, 36, 48, '#fff8e1');
    c.fillStyle = `rgba(255, 230, 120, ${0.15 + glow * 0.2})`; c.fillRect(53, 49, 42, 54);
    R(c, 56, 52, 36, 48, '#fff8e1');
    R(c, 60, 56, 28, 8, '#1f3b73'); R(c, 62, 58, 24, 1, '#f4f4f0'); R(c, 62, 61, 18, 1, '#f4f4f0');
    R(c, 60, 68, 28, 2, '#333'); R(c, 60, 72, 22, 2, '#333'); R(c, 60, 76, 26, 2, '#333');
    R(c, 66, 84, 16, 10, '#2e7d32'); R(c, 70, 86, 8, 6, '#f4f4f0');
    R(c, 72, 49, 4, 4, '#d63a3a'); // raptiye
    // Yatak, masa
    R(c, 10, 226, 92, 26, '#7a5136'); R(c, 12, 214, 88, 14, '#d8dde8'); R(c, 12, 210, 22, 8, '#f4f4f0');
    R(c, 128, 210, 44, 6, '#7a5136'); R(c, 132, 216, 4, 34, '#5e3d28'); R(c, 164, 216, 4, 34, '#5e3d28');
    R(c, 136, 202, 14, 8, '#5b8bd6'); R(c, 138, 199, 10, 3, '#e05d5d'); // kitaplar
    // Çocuk yatağın kenarında oturuyor → kalkıp kramponları çantaya koyuyor
    const up = t > 4.5;
    if (!up) person(c, KID, 70, 238, 46, { flip: true });
    else {
      person(c, KID, 110, 298, 48, { flip: false, frame: Math.floor(t * 3) % 2 ? 'idle' : 'kick' });
      // Spor çanta + kramponlar
      R(c, 124, 286, 34, 12, '#1f3b73'); R(c, 126, 282, 30, 5, '#2b4f94'); R(c, 136, 279, 10, 3, '#111');
      const by = Math.max(270, 286 - (t - 4.5) * 10);
      drawSprite(c, 'boots', 140, by, { h: 12 });
    }
  },

  dawn(c, t) {
    // Koridor, kapı aralığından şafak ışığı
    R(c, 0, 0, VW, 250, '#352c3a');
    for (let x = 0; x < VW; x += 14) R(c, x, 0, 1, 250, '#3c3242');
    R(c, 0, 250, VW, 70, '#4a382c');
    // Kanepede uyuyan baba (Zzz)
    R(c, 6, 222, 78, 24, '#5b4a6b'); R(c, 4, 210, 82, 14, '#6a5880'); R(c, 6, 246, 6, 8, '#3a2e44'); R(c, 78, 246, 6, 8, '#3a2e44');
    R(c, 18, 214, 50, 10, '#6d7f95'); R(c, 66, 212, 12, 10, DAD.skin); R(c, 68, 211, 9, 3, DAD.hairColor); R(c, 68, 218, 6, 1, '#2a201b');
    const z = (t * 0.8) % 1;
    c.font = '700 8px monospace'; c.fillStyle = `rgba(220, 220, 255, ${1 - z})`;
    c.fillText('z', 80 + z * 6, 206 - z * 14); c.fillText('Z', 86 + z * 8, 198 - z * 18);
    // TV karıncalanma ışığı
    R(c, 6, 170, 30, 22, '#222'); for (let i = 0; i < 24; i++) R(c, 8 + Math.random() * 26, 172 + Math.random() * 18, 2, 1, Math.random() < 0.5 ? '#999' : '#555');
    // Kapı: açılır, şafak ışığı
    const open = Math.min(1, Math.max(0, (t - 3) / 1.5));
    R(c, 122, 120, 46, 130, '#ffb46b');
    c.save(); c.beginPath(); c.rect(124, 122, 42, 128); c.clip();
    R(c, 124, 122, 42, 128, '#f6a35c'); R(c, 124, 122, 42, 40, '#f58b5a'); R(c, 124, 200, 42, 50, '#e7c07a');
    R(c, 140, 190, 14, 10, '#ffe29a');
    c.restore();
    R(c, 124 + open * 34, 122, 42 * (1 - open), 128, '#6e4b33');
    if (open < 1) R(c, 124 + open * 34 + 34 * (1 - open), 184, 3, 4, '#d9b56a');
    R(c, 120, 118, 50, 4, '#3d2a1f'); R(c, 120, 118, 4, 132, '#3d2a1f'); R(c, 166, 118, 4, 132, '#3d2a1f');
    if (open > 0.2) { c.fillStyle = `rgba(255, 190, 120, ${0.12 * open})`; c.beginPath(); c.moveTo(124, 250); c.lineTo(166, 250); c.lineTo(180, 320); c.lineTo(70, 320); c.fill(); }
    // Çocuk parmak ucunda kapıya ilerler
    const kx = Math.min(146, 20 + t * 22);
    const sneak = Math.floor(t * 3) % 2;
    person(c, KID, kx, 298 - (sneak ? 1 : 0), 48, { frame: kx < 146 ? (sneak ? 'run1' : 'run3') : 'idle', alpha: t > 6.6 ? Math.max(0, 1 - (t - 6.6) * 1.5) : 1 });
    R(c, kx - 14, 276, 10, 9, '#1f3b73');
  },

  run(c, t) {
    bands(c, 0, 220, ['#f39a5c', '#f6ad62', '#f8c06b', '#f9d27b', '#fbe39a']);
    // Güneş
    const sy = 150 - Math.min(40, t * 6);
    for (let j = -12; j <= 12; j++) { const w = Math.round(Math.sqrt(144 - j * j)); R(c, 110 - w, sy + j, w * 2, 1, '#fff2b0'); }
    // Uzak silüet: kubbe ve minareler
    const far = -(t * 8) % 180;
    for (const off of [far, far + 180]) {
      R(c, off + 20, 176, 60, 50, '#c7765a'); for (let j = 0; j < 14; j++) { const w = Math.round(Math.sqrt(196 - j * j)); R(c, off + 50 - w, 176 - j, w * 2, 1, '#c7765a'); }
      R(c, off + 14, 140, 4, 86, '#c7765a'); R(c, off + 13, 136, 6, 4, '#c7765a'); R(c, off + 15, 128, 2, 8, '#c7765a');
      R(c, off + 84, 146, 4, 80, '#c7765a'); R(c, off + 85, 138, 2, 8, '#c7765a');
      R(c, off + 110, 186, 50, 40, '#b8694f'); R(c, off + 150, 170, 26, 56, '#b8694f');
    }
    // Yakın evler
    const mid = -(t * 30) % 200;
    for (const off of [mid, mid + 200]) {
      house(c, off + 0, 196, 46, 60, '#a8604a', '#7a3a32', false);
      house(c, off + 58, 184, 52, 72, '#9c5a48', '#6e3530', false);
      house(c, off + 122, 204, 60, 52, '#b0674e', '#7a3a32', false);
    }
    R(c, 0, 256, VW, 64, '#6c6a72');
    R(c, 0, 256, VW, 4, '#8a8890');
    const lane = -(t * 90) % 40;
    for (let x = lane; x < VW; x += 40) R(c, x, 290, 20, 3, '#e8e4d8');
    // Simitçi tezgâhı geçer
    const cart = 200 - ((t * 90) % 420);
    R(c, cart, 238, 26, 14, '#d9a35b'); R(c, cart + 2, 234, 22, 4, '#c08a44');
    for (let i = 0; i < 4; i++) R(c, cart + 4 + i * 5, 232, 4, 3, '#a8662a');
    R(c, cart + 4, 252, 4, 4, '#333'); R(c, cart + 18, 252, 4, 4, '#333');
    // Koşan çocuk
    const fr = ['run0', 'run1', 'run2', 'run3'][Math.floor(t * 10) % 4];
    person(c, KID, 70, 288, 50, { frame: fr });
    R(c, 55, 260, 10, 10, '#1f3b73');
  },

  gate(c, t) {
    bands(c, 0, 200, ['#7fb3e6', '#93c2ea', '#a9d0ee', '#c3def2']);
    drawSprite(c, 'light_tower', 22, 150, { h: 110, anchor: 'bottom' });
    drawSprite(c, 'light_tower', 158, 150, { h: 110, anchor: 'bottom', flip: true });
    // Stadyum duvarı ve kapı kemeri
    R(c, 0, 120, VW, 130, '#c9cbd3');
    for (let y = 124; y < 250; y += 8) R(c, 0, y, VW, 1, '#b7b9c2');
    R(c, 54, 150, 72, 100, '#3b4152');
    for (let j = 0; j < 14; j++) { const w = Math.round(Math.sqrt(196 - j * j) * 2.6); R(c, 90 - w, 150 - j, w * 2, 1, '#3b4152'); }
    for (let x = 58; x < 124; x += 8) R(c, x, 152, 2, 98, '#596178');
    // Tabela
    R(c, 40, 110, 100, 22, '#1f3b73'); R(c, 42, 112, 96, 18, '#2b4f94');
    c.font = '900 10px system-ui, sans-serif'; c.fillStyle = '#f4f4f0'; c.textAlign = 'center';
    c.fillText('ŞEHİR STADI', 90, 125);
    // Seçmeler bayrağı
    const wave = Math.sin(t * 4) * 2;
    R(c, 136, 160 + wave, 36, 16, '#c6ff3d'); c.font = '900 7px system-ui, sans-serif'; c.fillStyle = '#10200a'; c.fillText('SEÇMELER', 154, 171 + wave);
    R(c, 134, 156, 2, 70, '#555');
    R(c, 0, 250, VW, 70, '#8b8f99');
    // Sırada bekleyen çocuklar
    const kits = [{ colors: ['#2e7d32', '#fff'] }, { colors: ['#f2b632', '#1d1d1d'] }, { colors: ['#6a1b9a', '#fff'] }, { colors: ['#00897b', '#fff'] }];
    kits.forEach((k, i) => person(c, npcLook(k, 30 + i, ''), 18 + i * 14, 274 + (i % 2) * 2, 30, { flip: false, frame: Math.floor(t * 2 + i) % 3 === 0 ? 'ready' : 'idle' }));
    drawSprite(c, 'cone', 120, 290, { h: 8 });
    drawSprite(c, 'cone', 160, 296, { h: 8 });
    // Antrenör (panolu) ve bizim çocuk (yaklaşır)
    person(c, COACH, 148, 294, 56, { flip: true, frame: 'idle' });
    drawSprite(c, 'clipboard', 134, 266, { h: 13 });
    const kx = Math.min(104, 60 + t * 18);
    person(c, KID, kx, 302, 50, { frame: kx < 104 ? ['run0', 'run1', 'run2', 'run3'][Math.floor(t * 9) % 4] : 'idle' });
    R(c, kx - 15, 272, 10, 10, '#1f3b73');
  },
};

// Konuşmacı konumu (birim): balon kuyruğu buraya
const SPEAKERS = {
  home: { kid: [54, 236], dad: [140, 224] },
  gate: { coach: [146, 232] },
};

/**
 * Hikâyeyi oynatır. Bitince (veya atlanınca) çözülür.
 * @param {HTMLElement} rootEl
 */
export function playIntro(rootEl) {
  return new Promise((resolve) => {
    const layer = el(`<div class="intro-layer">
      <canvas></canvas>
      <button class="intro-skip" data-skip>Atla ›</button>
      <div class="intro-tap">Dokun: devam</div>
    </div>`);
    rootEl.appendChild(layer);
    const cv = layer.querySelector('canvas');
    const c = cv.getContext('2d');
    let W = 0; let H = 0; let dpr = 1;
    const resize = () => {
      const r = layer.getBoundingClientRect();
      dpr = Math.min(2.5, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    playMusic('story');
    let si = 0;
    let st = 0; // sahne zamanı
    let S = { angryT: null };
    let last = performance.now();
    let raf = 0;
    let done = false;
    let fade = 1; // sahne geçişi karartması (1 → 0)

    const events = (sc) => [
      ...(sc.captions || []).map(([at, text]) => ({ at, kind: 'cap', text })),
      ...(sc.lines || []).map(([at, who, text, mood]) => ({ at, kind: 'line', who, text, mood })),
    ].sort((a, b) => a.at - b.at);

    function enter(i) {
      si = i;
      st = 0;
      S = { angryT: null };
      fade = 1;
      const sc = SCENES[si];
      setMusicIntensity(sc.music);
      if (sc.id === 'dawn') sfx('step');
    }
    enter(0);

    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      layer.classList.add('out');
      setMusicIntensity(3);
      setTimeout(() => { layer.remove(); resolve(); }, 450);
    }

    function advance() {
      const sc = SCENES[si];
      const evs = events(sc);
      // Yazı hâlâ akıyorsa tamamla, değilse sonraki olaya / sahneye atla
      const cur = evs.filter((e) => e.at <= st).pop();
      if (cur) {
        const shown = (st - cur.at) * 32;
        if (shown < cur.text.length) { st = cur.at + cur.text.length / 32 + 0.01; return; }
      }
      const nxt = evs.find((e) => e.at > st + 0.05);
      if (nxt) st = nxt.at;
      else if (si < SCENES.length - 1) enter(si + 1);
      else finish();
    }

    layer.addEventListener('pointerdown', (e) => {
      unlock();
      if (e.target.closest('[data-skip]')) { sfx('click'); finish(); return; }
      advance();
    });

    function bubble(text, who, mood, sx, sy, k) {
      // Ekran koordinatlarında konuşma balonu (metin keskin kalsın)
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fs = Math.max(13, Math.min(16, W / 26));
      c.font = `800 ${fs}px system-ui, sans-serif`;
      const maxW = Math.min(W * 0.72, 300);
      const words = text.split(' ');
      const linesOut = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (c.measureText(test).width > maxW && line) { linesOut.push(line); line = w; } else line = test;
      }
      if (line) linesOut.push(line);
      const lh = fs * 1.3;
      const bw = Math.max(...linesOut.map((l) => c.measureText(l).width)) + 22;
      const bh = linesOut.length * lh + 16;
      const tx = sx;
      let bx = Math.max(10, Math.min(W - bw - 10, sx - bw / 2));
      const by = Math.max(10, sy - bh - 26 * k);
      const angry = mood === 'angry';
      c.fillStyle = angry ? '#fff1f1' : '#ffffff';
      c.strokeStyle = angry ? '#d32f2f' : '#14110f';
      c.lineWidth = 3;
      const shake = angry ? Math.sin(performance.now() / 30) * 1.5 : 0;
      bx += shake;
      c.beginPath();
      c.rect(bx, by, bw, bh);
      c.fill(); c.stroke();
      c.beginPath();
      c.moveTo(Math.max(bx + 12, Math.min(bx + bw - 22, tx - 8)), by + bh - 1.5);
      c.lineTo(tx, by + bh + 14);
      c.lineTo(Math.max(bx + 22, Math.min(bx + bw - 10, tx + 6)), by + bh - 1.5);
      c.fill(); c.stroke();
      c.fillStyle = angry ? '#b71c1c' : '#14110f';
      c.textAlign = 'left';
      c.textBaseline = 'top';
      linesOut.forEach((l, i) => c.fillText(l, bx + 11, by + 9 + i * lh));
      c.font = `700 ${fs * 0.72}px system-ui, sans-serif`;
      c.fillStyle = '#7a7a7a';
      c.fillText(who === 'kid' ? 'SEN' : who === 'dad' ? 'BABAN' : 'ANTRENÖR', bx + 2, by - fs * 0.9);
      c.restore();
    }

    function frame(now) {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      st += dt;
      fade = Math.max(0, fade - dt * 2.2);
      const sc = SCENES[si];
      // Babanın patlaması (yumruk masaya)
      const angryLine = (sc.lines || []).find((l) => l[3] === 'angry');
      if (angryLine && S.angryT == null && st >= angryLine[0]) { S.angryT = st; sfx('tackle'); }
      if (st >= sc.dur) { if (si < SCENES.length - 1) enter(si + 1); else { finish(); return; } }

      // Ölçek: 180×320 mantıksal alan ekrana sığar (kenarlarda sahne rengi)
      const P = Math.min(W / VW, H / VH);
      const ox = (W - VW * P) / 2;
      const oy = Math.max(0, (H - VH * P) * 0.62);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [top, bot] = EDGE[sc.id] || ['#05070c', '#05070c'];
      c.fillStyle = top;
      c.fillRect(0, 0, W, oy + 2);
      c.fillStyle = bot;
      c.fillRect(0, oy + VH * P - 2, W, H);
      c.setTransform(dpr * P, 0, 0, dpr * P, dpr * ox, dpr * oy);
      c.imageSmoothingEnabled = false;
      c.save();
      c.beginPath(); c.rect(0, 0, VW, VH); c.clip();
      DRAW[sc.id](c, st, S);
      c.restore();

      // Altyazı + konuşma
      const evs = events(sc);
      let cap = evs.filter((e) => e.kind === 'cap' && e.at <= st).pop();
      if (cap && sc.lines && st - cap.at > 3.6) cap = null; // konuşma başlayınca altyazı çekilir
      const line = evs.filter((e) => e.kind === 'line' && e.at <= st).pop();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (line) {
        const n = Math.floor((st - line.at) * 32);
        const sp = SPEAKERS[sc.id]?.[line.who] || [90, 200];
        bubble(line.text.slice(0, n), line.who, line.mood, ox + sp[0] * P, oy + sp[1] * P, P / 2);
      }
      if (cap) {
        const n = Math.floor((st - cap.at) * 32);
        const txt = cap.text.slice(0, n);
        const fs = Math.max(15, Math.min(19, W / 22));
        c.font = `italic 700 ${fs}px Georgia, 'Times New Roman', serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const y = Math.min(H - 70, oy + VH * P - 40);
        const tw = c.measureText(cap.text).width + 30;
        c.fillStyle = 'rgba(5, 7, 12, 0.72)';
        c.fillRect(W / 2 - tw / 2, y - fs, tw, fs * 2);
        c.fillStyle = '#f4ecd8';
        c.fillText(txt, W / 2, y);
      }
      // Sahne geçişi (karartma) + ilerleme noktaları
      if (fade > 0) { c.fillStyle = `rgba(5, 7, 12, ${fade})`; c.fillRect(0, 0, W, H); }
      SCENES.forEach((_, i) => {
        c.fillStyle = i === si ? '#c6ff3d' : i < si ? 'rgba(198,255,61,.45)' : 'rgba(255,255,255,.25)';
        c.fillRect(W / 2 - SCENES.length * 9 + i * 18, H - 24, 12, 4);
      });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
}
