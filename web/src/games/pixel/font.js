// 3×5 PİKSEL YAZI — sahne tabelaları, konsol ekranları, marka panoları. Türkçe büyük harfler dahil.
// drawPixelText(ctx, 'SPOR SALONU', x, y, renk, { scale, align, shadow })
const G = {
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'], N: ['110', '101', '101', '101', '101'], O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'], Q: ['010', '101', '101', '011', '001'], R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'], W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'],
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '.': ['000', '000', '000', '000', '010'], ':': ['000', '010', '000', '010', '000'], '/': ['001', '001', '010', '100', '100'],
  '-': ['000', '000', '111', '000', '000'], '+': ['000', '010', '111', '010', '000'], '%': ['101', '001', '010', '100', '101'],
  '!': ['010', '010', '010', '000', '010'], '?': ['110', '001', '010', '000', '010'], "'": ['010', '010', '000', '000', '000'],
  '&': ['010', '101', '010', '101', '011'], '€': ['011', '110', '100', '110', '011'], '#': ['101', '111', '101', '111', '101'],
  ' ': ['000', '000', '000', '000', '000'],
};
// Türkçe harfler: taban harf + işaret
const MARK = { Ç: ['C', 'cedilla'], Ş: ['S', 'cedilla'], Ğ: ['G', 'breve'], Ü: ['U', 'dots'], Ö: ['O', 'dots'], İ: ['I', 'dot'] };

const norm = (s) => String(s).toLocaleUpperCase('tr');

/** Yazının piksel genişliği (ölçek 1) */
export const pixelTextWidth = (str) => Math.max(0, norm(str).length * 4 - 1);

export function drawPixelText(ctx, str, x, y, color = '#fff', { scale = 1, align = 'left', shadow = null } = {}) {
  const s = norm(str);
  const w = pixelTextWidth(s) * scale;
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const cy = Math.round(y);
  const plot = (px, py, col) => { ctx.fillStyle = col; ctx.fillRect(px, py, scale, scale); };
  for (const ch of s) {
    const mark = MARK[ch];
    const glyph = G[mark ? mark[0] : ch] || G['?'];
    const draw = (col, ox, oy) => {
      glyph.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '1') plot(cx + ox + i * scale, cy + oy + j * scale, col); });
      if (mark) {
        const m = mark[1];
        if (m === 'cedilla') plot(cx + ox + scale, cy + oy + 5 * scale, col);
        else if (m === 'breve') { plot(cx + ox, cy + oy - 2 * scale, col); plot(cx + ox + 2 * scale, cy + oy - 2 * scale, col); }
        else if (m === 'dots') { plot(cx + ox, cy + oy - 2 * scale, col); plot(cx + ox + 2 * scale, cy + oy - 2 * scale, col); }
        else if (m === 'dot') plot(cx + ox + scale, cy + oy - 2 * scale, col);
      }
    };
    if (shadow) draw(shadow, scale, scale);
    draw(color, 0, 0);
    cx += 4 * scale;
  }
}
