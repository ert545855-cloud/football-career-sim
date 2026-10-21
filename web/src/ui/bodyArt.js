// VÜCUT TARAMASI — Beden & Zihin ekranındaki canlı figür. Boy, kas indeksi ve yağ oranından üretilir:
// kas arttıkça omuz, göğüs, kol ve bacaklar kalınlaşır; yağ arttıkça bel ve göbek genişler; yağ düşükse karın
// kasları belirginleşir. 8 hafta önceki beden kesik çizgiyle arkada durur: değişim gözle görülür.
import { shade } from '../games/pixel/playerPixels.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Beden ölçülerinden çizim şekilleri (S: figür boyu px, ox/oy: tepe noktası) */
function shapes(S, p) {
  const mi = clamp(p.mi ?? 10.3, 8.5, 13.5) - 10.3;
  const exc = clamp((p.fat ?? 11) - 12, -6, 18);
  const ex = Math.max(0, exc);
  const lean = Math.max(0, -exc);
  const k = (a) => a * S;
  const sw = k(0.118) * (1 + mi * 0.07 + ex * 0.004);
  const cw = k(0.096) * (1 + mi * 0.055 + ex * 0.018);
  const ww = k(0.074) * (1 + ex * 0.052 + mi * 0.015 - lean * 0.008);
  const hw = k(0.084) * (1 + ex * 0.028 + mi * 0.01);
  const nw = k(0.028) * (1 + mi * 0.08);
  const ua = k(0.031) * (1 + mi * 0.1 + ex * 0.016);
  const fa = k(0.025) * (1 + mi * 0.06 + ex * 0.01);
  const th = k(0.05) * (1 + mi * 0.06 + ex * 0.022);
  const ca = k(0.031) * (1 + mi * 0.05 + ex * 0.01);
  const Y = { head: k(0.066), neck: k(0.125), sh: k(0.178), chest: k(0.25), waist: k(0.4), hip: k(0.5), crotch: k(0.535), knee: k(0.735), ankle: k(0.955), elbow: k(0.385), wrist: k(0.525) };
  return { S, sw, cw, ww, hw, nw, ua, fa, th, ca, Y, ex, lean, mi, belly: ex > 1.5 ? ex : 0 };
}

function torsoPath(g) {
  const { sw, cw, ww, hw, nw, Y, S } = g;
  const p = new Path2D();
  p.moveTo(-nw, Y.neck);
  p.quadraticCurveTo(-sw * 0.55, Y.sh - S * 0.03, -sw, Y.sh);
  p.bezierCurveTo(-sw * 1.03, Y.sh + S * 0.04, -cw * 1.02, Y.chest - S * 0.01, -cw, Y.chest + S * 0.02);
  p.bezierCurveTo(-cw * 0.98, Y.chest + S * 0.08, -ww, Y.waist - S * 0.05, -ww, Y.waist);
  p.bezierCurveTo(-ww, Y.waist + S * 0.04, -hw, Y.hip - S * 0.04, -hw, Y.hip);
  p.lineTo(-hw * 0.96, Y.crotch + S * 0.02);
  p.lineTo(hw * 0.96, Y.crotch + S * 0.02);
  p.lineTo(hw, Y.hip);
  p.bezierCurveTo(hw, Y.hip - S * 0.04, ww, Y.waist + S * 0.04, ww, Y.waist);
  p.bezierCurveTo(ww, Y.waist - S * 0.05, cw * 0.98, Y.chest + S * 0.08, cw, Y.chest + S * 0.02);
  p.bezierCurveTo(cw * 1.02, Y.chest - S * 0.01, sw * 1.03, Y.sh + S * 0.04, sw, Y.sh);
  p.quadraticCurveTo(sw * 0.55, Y.sh - S * 0.03, nw, Y.neck);
  p.closePath();
  return p;
}

/** Konik kapsül (uzuv) */
function limb(x1, y1, r1, x2, y2, r2) {
  const p = new Path2D();
  const a = Math.atan2(y2 - y1, x2 - x1);
  const n = a + Math.PI / 2;
  p.moveTo(x1 + Math.cos(n) * r1, y1 + Math.sin(n) * r1);
  p.lineTo(x2 + Math.cos(n) * r2, y2 + Math.sin(n) * r2);
  p.arc(x2, y2, r2, n, n + Math.PI, true); // uç kapak (ileri tarafta)
  p.lineTo(x1 - Math.cos(n) * r1, y1 - Math.sin(n) * r1);
  p.arc(x1, y1, r1, n + Math.PI, n + Math.PI * 2, true); // baş kapak (geri tarafta)
  p.closePath();
  return p;
}

function parts(g) {
  const { sw, cw, hw, ua, fa, th, ca, Y, S, belly, ww } = g;
  const out = [];
  out.push({ id: 'torso', path: torsoPath(g) });
  if (belly) {
    const b = new Path2D();
    b.ellipse(0, Y.waist + S * 0.03, ww * (1 + belly * 0.022), S * (0.06 + belly * 0.004), 0, 0, Math.PI * 2);
    out.push({ id: 'belly', path: b });
  }
  // kollar (omuzdan dirseğe, dirsekten bileğe; hafif açık)
  for (const sd of [-1, 1]) {
    const shX = sd * (sw - ua * 0.6);
    const elX = sd * (Math.max(cw, ww) + ua * 1.15);
    const wrX = sd * (Math.max(cw, ww) + ua * 1.25 + S * 0.012);
    out.push({ id: 'uarm', path: limb(shX, Y.sh + ua * 0.4, ua * 1.08, elX, Y.elbow, ua * 0.82), sd });
    out.push({ id: 'farm', path: limb(elX, Y.elbow, fa, wrX, Y.wrist, fa * 0.7), sd });
    const h = new Path2D();
    h.ellipse(wrX, Y.wrist + S * 0.024, fa * 0.85, S * 0.03, 0, 0, Math.PI * 2);
    out.push({ id: 'hand', path: h, sd });
    // bacaklar
    const hx = sd * hw * 0.52;
    const kx = sd * hw * 0.5;
    const ax = sd * hw * 0.46;
    out.push({ id: 'thigh', path: limb(hx, Y.crotch - S * 0.02, th, kx, Y.knee, th * 0.6), sd });
    out.push({ id: 'calf', path: limb(kx, Y.knee, ca, ax, Y.ankle, ca * 0.55), sd });
    const f = new Path2D();
    f.ellipse(ax + sd * S * 0.012, Y.ankle + S * 0.025, S * 0.03, S * 0.018, 0, 0, Math.PI * 2);
    out.push({ id: 'foot', path: f, sd });
  }
  const nk = new Path2D();
  nk.rect(-g.nw, Y.neck - S * 0.02, g.nw * 2, S * 0.07);
  out.push({ id: 'neck', path: nk });
  const hd = new Path2D();
  hd.ellipse(0, Y.head, S * 0.05, S * 0.064, 0, 0, Math.PI * 2);
  out.push({ id: 'head', path: hd });
  return out;
}

/** Bir figürün sadece dış hattı (hayalet) */
function ghostCanvas(w, h, ps, toPx) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.setTransform(toPx);
  x.lineWidth = 2.4 / toPx.a;
  x.strokeStyle = '#7dd3fc';
  x.setLineDash([5 / toPx.a, 4 / toPx.a]);
  for (const q of ps) x.stroke(q.path);
  x.globalCompositeOperation = 'destination-out';
  for (const q of ps) x.fill(q.path);
  return c;
}

/**
 * Figürü çizer ve tarama çizgisini canlandırır.
 * @param {HTMLCanvasElement} cv
 * @param {{height:number, mi:number, fat:number, skin:string, hairColor:string, shorts:string, ghost?:{height:number, mi:number, fat:number}|null}} o
 */
export function mountBodyFigure(cv, o) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  const W = Math.max(120, r.width || 150);
  const H = Math.max(200, r.height || 260);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const ctx = cv.getContext('2d');
  const margin = 14;
  const maxH = H - margin * 2;
  const scaleFor = (hcm) => maxH * clamp(hcm / 200, 0.7, 1.05);
  const S = scaleFor(o.height);
  const g = shapes(S, o);
  const ps = parts(g);
  const cx = W * 0.56;
  const top = H - margin - S;
  const base = new DOMMatrix([dpr, 0, 0, dpr, cx * dpr, top * dpr]);
  let ghost = null;
  if (o.ghost && (Math.abs(o.ghost.mi - o.mi) > 0.05 || Math.abs(o.ghost.fat - o.fat) > 0.4 || Math.abs(o.ghost.height - o.height) > 0.4)) {
    const gS = scaleFor(o.ghost.height);
    const gt = H - margin - gS;
    ghost = ghostCanvas(cv.width, cv.height, parts(shapes(gS, o.ghost)), new DOMMatrix([dpr, 0, 0, dpr, cx * dpr, gt * dpr]));
  }
  const skin = o.skin || '#e8b58f';
  const skinD = shade(skin, -0.28);
  const skinL = shade(skin, 0.18);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  let raf = 0;

  function frame(now) {
    if (!cv.isConnected) return;
    const t = (now - t0) / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    // ızgara + boy cetveli
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = 'rgba(125,211,252,.08)';
    ctx.lineWidth = 1;
    for (let y = margin; y <= H - margin; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(125,211,252,.35)';
    ctx.fillStyle = 'rgba(203,213,225,.75)';
    ctx.font = '600 9px system-ui, sans-serif';
    for (let cm = 0; cm <= 200; cm += 10) {
      const y = H - margin - (maxH * cm) / 200;
      if (y < margin - 1) continue;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(cm % 50 === 0 ? 22 : 16, y);
      ctx.stroke();
      if (cm % 50 === 0 && cm) ctx.fillText(String(cm / 100).replace('.', ','), 24, y + 3);
    }
    // boy çizgisi
    ctx.strokeStyle = 'rgba(198,255,61,.7)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(12, top);
    ctx.lineTo(W - 6, top);
    ctx.stroke();
    ctx.setLineDash([]);
    if (ghost) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.7;
      ctx.drawImage(ghost, 0, 0);
      ctx.globalAlpha = 1;
    }
    // figür: önce dış hat (kalın), sonra dolgu
    ctx.setTransform(base);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b1220';
    ctx.lineWidth = 3.2;
    for (const q of ps) ctx.stroke(q.path);
    const grd = ctx.createLinearGradient(-g.sw * 1.4, 0, g.sw * 1.4, 0);
    grd.addColorStop(0, skinL);
    grd.addColorStop(0.55, skin);
    grd.addColorStop(1, skinD);
    ctx.fillStyle = grd;
    for (const q of ps) ctx.fill(q.path);
    // kas çizgileri: göğüs, karın (yağ düşükse), omuz
    const def = clamp((12.5 - o.fat) / 5, 0, 1) * 0.55;
    ctx.strokeStyle = `rgba(60,30,15,${0.18 + clamp(g.mi, 0, 2) * 0.12})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-g.cw * 0.8, g.Y.chest + S * 0.035);
    ctx.quadraticCurveTo(-g.cw * 0.35, g.Y.chest + S * 0.06, 0, g.Y.chest + S * 0.035);
    ctx.quadraticCurveTo(g.cw * 0.35, g.Y.chest + S * 0.06, g.cw * 0.8, g.Y.chest + S * 0.035);
    ctx.stroke();
    if (def > 0.05) {
      ctx.strokeStyle = `rgba(60,30,15,${def})`;
      ctx.beginPath();
      ctx.moveTo(0, g.Y.chest + S * 0.05);
      ctx.lineTo(0, g.Y.waist + S * 0.05);
      for (let i = 0; i < 3; i++) {
        const y = g.Y.chest + S * (0.085 + i * 0.045);
        ctx.moveTo(-g.ww * 0.55, y);
        ctx.quadraticCurveTo(0, y + S * 0.008, g.ww * 0.55, y);
      }
      ctx.stroke();
    }
    if (g.belly) {
      ctx.strokeStyle = 'rgba(60,30,15,.25)';
      ctx.beginPath();
      ctx.ellipse(0, g.Y.waist + S * 0.07, g.ww * 0.7, S * 0.012, 0, 0, Math.PI);
      ctx.stroke();
      ctx.fillStyle = 'rgba(60,30,15,.35)';
      ctx.beginPath();
      ctx.arc(0, g.Y.waist + S * 0.03, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // şort ve krampon
    ctx.fillStyle = o.shorts || '#1d4ed8';
    ctx.strokeStyle = '#0b1220';
    ctx.lineWidth = 1.6;
    const sh = new Path2D();
    sh.moveTo(-g.hw * 1.04, g.Y.hip - S * 0.018);
    sh.lineTo(g.hw * 1.04, g.Y.hip - S * 0.018);
    sh.lineTo(g.hw * 1.12, g.Y.crotch + S * 0.075);
    sh.lineTo(S * 0.006, g.Y.crotch + S * 0.075);
    sh.lineTo(0, g.Y.crotch + S * 0.03);
    sh.lineTo(-S * 0.006, g.Y.crotch + S * 0.075);
    sh.lineTo(-g.hw * 1.12, g.Y.crotch + S * 0.075);
    sh.closePath();
    ctx.fill(sh);
    ctx.stroke(sh);
    ctx.fillStyle = '#111827';
    for (const q of ps) if (q.id === 'foot') ctx.fill(q.path);
    // saç ve yüz
    ctx.fillStyle = o.hairColor || '#2a1a10';
    ctx.beginPath();
    ctx.ellipse(0, g.Y.head - S * 0.03, S * 0.052, S * 0.04, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1715';
    ctx.beginPath();
    ctx.arc(-S * 0.018, g.Y.head + S * 0.002, 1.3, 0, Math.PI * 2);
    ctx.arc(S * 0.018, g.Y.head + S * 0.002, 1.3, 0, Math.PI * 2);
    ctx.fill();
    // tarama çizgisi
    if (!reduced) {
      const sy = ((t * 0.35) % 1) * (S + 20) - 10;
      ctx.setTransform(dpr, 0, 0, dpr, 0, top * dpr);
      const sg = ctx.createLinearGradient(0, sy - 10, 0, sy + 2);
      sg.addColorStop(0, 'rgba(56,189,248,0)');
      sg.addColorStop(1, 'rgba(56,189,248,.35)');
      ctx.fillStyle = sg;
      ctx.fillRect(28, sy - 10, W - 30, 12);
      ctx.fillStyle = 'rgba(125,211,252,.85)';
      ctx.fillRect(28, sy + 1, W - 30, 1);
      raf = requestAnimationFrame(frame);
    }
  }
  frame(performance.now());
  return () => cancelAnimationFrame(raf);
}
