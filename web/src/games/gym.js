// SPOR SALONU MİNİ OYUNLARI — çizim ve girdi (mantık: gymLogic.js).
// Sahne düşük çözünürlüklü tuvale mantıksal pikselle çizilir, ekranda keskin büyütülür (yayınla aynı piksel dili).
import { BigText, Particles, createStage } from './engine.js';
import { el, esc, root, sleep } from '../ui/dom.js';
import { icon } from '../ui/art.js';
import { buzz, sfx, unlock } from '../audio.js';
import { duckMusic } from '../music/player.js';
import { playerCanvas } from './pixel/sprites.js';
import { drawPixelText } from './pixel/font.js';
import {
  R, drawBarbell, drawBench, drawDumbbellRack, drawGymRoom, drawMat, drawPlateTree, drawPoster, drawSquatRack, drawTreadmill, drawWaterCooler, lowRes, shadeHex,
} from './pixel/gymArt.js';
import {
  BAR, TREAD, TREAD_PROGRAM, barbellParams, barbellPress, barbellResult, barbellStep, beltKmh, createBarbell, createCurl, createTread,
  curlParams, curlPress, curlResult, curlStep, treadParams, treadResult, treadStep, treadTap,
} from './gymLogic.js';
import { GYM_STATIONS } from '../core/gym.js';

const COACH_LOOK = {
  skin: '#d9a07a', hair: 'short', hairColor: '#2a1a10', beard: true, longSleeve: true, pants: true, stripes: true, zip: true,
  kit: { body: '#161a24', accent: '#e5e7eb', pattern: 'solid', shorts: '#161a24', socks: '#161a24' }, boots: { main: '#f4f4f0', accent: '#16181d' },
};

/** Sprite'ı düşük çözünürlüklü tuvale çizer; (x, y) ayak noktası, k tam sayı ölçek */
export function blitSprite(c, look, dir, frame, x, y, k = 1, { flip = false, alpha = 1 } = {}) {
  const src = playerCanvas(look, dir, frame);
  c.save();
  c.globalAlpha = alpha;
  c.translate(Math.round(x), Math.round(y));
  if (flip) c.scale(-1, 1);
  c.drawImage(src, Math.round((-src.width * k) / 2), Math.round(-33 * k), src.width * k, src.height * k);
  c.restore();
  // gölge
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.fillRect(Math.round(x - 6 * k), Math.round(y), Math.round(12 * k), Math.max(1, Math.round(k)));
}

/** Salon kıyafeti: kulüp renginde atlet, siyah şort, beyaz spor ayakkabı */
export function gymLook(base = {}) {
  const kit = base.kit || {};
  return { ...base, kit: { ...kit, pattern: 'solid', shorts: '#16181d', socks: '#e5e7eb' }, boots: { main: '#f4f4f0', accent: kit.accent && kit.accent !== '#ffffff' ? kit.accent : '#2563eb' }, longSleeve: false, gloves: null, number: '' };
}

/**
 * Salon mini oyunu: tanıtım kartı → oyun → sonuç
 * @returns {Promise<{q:number, score:number, label:string}>}
 */
export async function runGymGame(station, o = {}) {
  const st = GYM_STATIONS[station];
  const layer = el(`
    <div class="game-layer gym-layer">
      <div class="game-hud"><div class="grow"><div class="t">${esc(st.full)}</div><div class="s">${esc(st.gains)}</div></div>
        <span class="chip">${icon('bolt', 'ico sm')} −${st.energy}</span></div>
      <div class="game-stage"></div>
      <div class="game-intro"><div class="card">
        <h3 style="margin-top:4px">${esc(st.full)}</h3>
        <p class="lead" style="margin:6px 0 10px;color:var(--muted);line-height:1.45">${esc(st.how)}</p>
        <div class="chips" style="margin-bottom:12px"><span class="chip accent">${esc(st.gains)}</span>${o.sore > 40 ? `<span class="chip warn">Kas ağrısı %${Math.round(o.sore)}</span>` : ''}</div>
        <button class="btn primary lg block" data-go>${icon('play')} BAŞLA</button>
        <button class="btn ghost block" style="margin-top:8px" data-cancel>Vazgeç</button>
      </div></div>
    </div>`);
  root().appendChild(layer);
  const go = await new Promise((res) => {
    if (o.auto) return res(true);
    layer.querySelector('[data-go]').addEventListener('click', () => { unlock(); sfx('click'); res(true); }, { once: true });
    layer.querySelector('[data-cancel]').addEventListener('click', () => { sfx('click'); res(false); }, { once: true });
  });
  if (!go) {
    layer.remove();
    return null;
  }
  layer.querySelector('.game-intro').remove();
  duckMusic(true);
  const host = layer.querySelector('.game-stage');
  let result;
  if (o.auto) {
    await sleep(200);
    const q = 0.4 + Math.random() * 0.5;
    result = { q, score: Math.round(q * 100), label: `%${Math.round(q * 100)}` };
  } else if (station === 'barbell') result = await playBarbell(host, o);
  else if (station === 'dumbbell') result = await playCurl(host, o);
  else result = await playTread(host, o);
  duckMusic(false);
  layer.style.transition = 'opacity .25s';
  layer.style.opacity = '0';
  await sleep(250);
  layer.remove();
  return result;
}

/** Üstteki HTML başlık şeridinin altında kalan tuval HUD'u */
const TOP = 66;

const finishOverlay = (host, lines) => {
  const box = el(`<div class="gym-done"><b>${esc(lines[0])}</b><span>${esc(lines[1] || '')}</span></div>`);
  host.appendChild(box);
  return box;
};

// ─────────────────────────── HALTER ───────────────────────────
function playBarbell(host, o) {
  return new Promise((resolve) => {
    const look = gymLook(o.look);
    const B = createBarbell(barbellParams(o.power ?? 40));
    const big = new BigText();
    const parts = new Particles();
    const S = { shake: 0, flash: 0, sweat: [], ended: false, endT: 0, pop: [] };
    const btn = el('<div class="gym-btns one"><button class="lift">KALDIR!</button></div>');
    host.appendChild(btn);
    const press = (e) => {
      e?.preventDefault?.();
      if (B.done) return;
      const r = barbellPress(B);
      if (!r) return;
      if (r === 'miss') { sfx('error'); buzz([30, 30, 30]); S.shake = 6; big.show('KAÇTI!', '#ff5d6c', 52); }
      else {
        sfx(r === 'perfect' ? 'levelup' : 'tackle');
        buzz(r === 'perfect' ? [12, 20, 12] : 14);
        S.flash = r === 'perfect' ? 0.35 : 0.18;
        big.show(r === 'perfect' ? 'MÜKEMMEL!' : 'İYİ!', r === 'perfect' ? '#c6ff3d' : '#7dd3fc', 50);
        S.pop.push({ t: 0, text: `+1` });
      }
      btn.querySelector('button').classList.add('hit');
      setTimeout(() => btn.querySelector('button').classList.remove('hit'), 90);
    };
    btn.querySelector('button').addEventListener('pointerdown', press);
    const onKey = (e) => { if (!e.repeat && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp')) press(e); };
    window.addEventListener('keydown', onKey);
    let prevSet = 1;
    const stage = createStage(host, {
      pointer: (type) => { if (type === 'down') press(); },
      update(dt) {
        barbellStep(B, dt);
        if (B.set !== prevSet) { prevSet = B.set; big.show(`SET ${B.set} · ${B.kg} KG`, '#ffcf3d', 40); sfx('whistle'); }
        if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 20);
        if (S.flash > 0) S.flash -= dt;
        S.pop.forEach((p) => { p.t += dt; });
        S.pop = S.pop.filter((p) => p.t < 0.9);
        if (B.phase === 'gauge' && Math.random() < dt * 3) S.sweat.push({ x: (Math.random() - 0.5) * 8, y: 0, vy: 0, t: 0 });
        S.sweat.forEach((d) => { d.t += dt; d.vy += 60 * dt; d.y += d.vy * dt; });
        S.sweat = S.sweat.filter((d) => d.t < 0.8);
        big.update(dt);
        parts.update(dt);
        if (B.done && !S.ended) {
          S.ended = true;
          const r = barbellResult(B);
          sfx(r.q > 0.6 ? 'goal' : 'whistle');
          finishOverlay(host, [`${r.reps} TEKRAR`, `${r.maxKg} kg · ${r.perfect} mükemmel`]);
          setTimeout(() => { cleanup(); resolve(r); }, 1700);
        }
      },
      render(ctx, W, H, t) {
        const L = lowRes(S, W, H, 150);
        const { c, LW, LH } = L;
        const floorY = Math.round(LH * 0.58);
        drawGymRoom(c, LW, LH, t, { floorY, sign: o.sign || 'KUVVET', mirror: true });
        drawDumbbellRack(c, LW - 64, floorY, 56);
        const gaugeW = 16;
        const cx = Math.round((LW - gaugeW) / 2 + (S.shake ? (Math.random() - 0.5) * S.shake : 0));
        const standY = Math.round(LH * 0.8);
        const k = LW >= 120 ? 2 : 1;
        const barHalf = Math.min(46, Math.floor((LW - gaugeW) / 2) - 6);
        drawSquatRack(c, cx, standY, { half: barHalf - 12, h: 50 * k, hookY: standY - 36 * k });
        // spotter (antrenör) lifterin hemen arkasında
        const spotFrame = B.phase === 'fail' ? 'barUp' : B.last === 'perfect' && B.phase === 'up' ? 'cheer' : B.phase === 'rest' ? 'clap' : 'point';
        blitSprite(c, COACH_LOOK, 'down', spotFrame, cx + 9 * k, standY - 7, k, { alpha: 0.9 });
        // oyuncu + bar (bar ensede, eller barın üstünde)
        const frame = B.lift > 0.5 ? 'barUp' : 'barDown';
        blitSprite(c, look, 'down', frame, cx, standY, k);
        const top = standY - 33 * k;
        const barY = top + (frame === 'barUp' ? 7 : 11) * k;
        const bend = B.phase === 'gauge' ? Math.min(2, B.kg / 70) : B.phase === 'fail' ? 3 : 0.5;
        drawBarbell(c, cx, barY, B.kg, { half: barHalf, bend });
        for (const d of S.sweat) R(c, cx + d.x * k, top + 4 * k + d.y, 1, 2, '#7dd3fc');
        // güç göstergesi (pikselli dikey bar)
        const gx = LW - 11;
        const gy0 = Math.round(LH * 0.24);
        const gh = Math.round(LH * 0.5);
        R(c, gx - 2, gy0 - 2, 10, gh + 4, '#0b0e14');
        R(c, gx, gy0, 6, gh, '#2a303d');
        const zy = gy0 + Math.round((1 - B.zoneC - B.zoneW / 2) * gh);
        const zh = Math.max(2, Math.round(B.zoneW * gh));
        R(c, gx, zy, 6, zh, '#3fbf5f');
        R(c, gx, zy + Math.round(zh * 0.35), 6, Math.max(1, Math.round(zh * 0.3)), '#a3ff7a');
        if (B.phase === 'gauge') {
          const my = gy0 + Math.round((1 - B.g) * gh);
          R(c, gx - 5, my - 1, 4, 3, '#ffcf3d');
          R(c, gx - 6, my, 1, 1, '#ffcf3d');
          R(c, gx, my, 6, 1, '#fff');
        }
        drawPixelText(c, 'GÜÇ', gx + 3, gy0 + gh + 4, '#93aa9f', { align: 'center' });
        if (S.flash > 0) { c.fillStyle = `rgba(198,255,61,${S.flash * 0.6})`; c.fillRect(0, 0, LW, LH); }
        L.blit(ctx);
        // HUD (ekran çözünürlüğünde)
        ctx.font = '900 15px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(`SET ${B.set}/${BAR.setsMax} · ${B.kg} KG`, 14, TOP + 8);
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.fillStyle = '#c6ff3d';
        ctx.fillText(`${'●'.repeat(B.rep)}${'○'.repeat(Math.max(0, BAR.repsPerSet - B.rep))}  Toplam ${B.reps} · Mükemmel ${B.perfect}`, 14, TOP + 28);
        ctx.fillStyle = B.misses ? '#ff5d6c' : '#93aa9f';
        ctx.fillText(`Kaçan ${B.misses}/2`, 14, TOP + 46);
        for (const p of S.pop) {
          ctx.globalAlpha = 1 - p.t / 0.9;
          ctx.fillStyle = '#c6ff3d';
          ctx.font = '900 22px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.text, W / 2, H * 0.3 - p.t * 40);
          ctx.globalAlpha = 1;
        }
        big.render(ctx, W, H);
        parts.render(ctx);
      },
    });
    function cleanup() { window.removeEventListener('keydown', onKey); stage.stop(); btn.remove(); }
  });
}

// ─────────────────────────── DAMBIL ───────────────────────────
function playCurl(host, o) {
  return new Promise((resolve) => {
    const look = { ...gymLook(o.look), dumbbell: true };
    const C = createCurl(curlParams(o.power ?? 40));
    const big = new BigText();
    const S = { ended: false, armL: 0, armR: 0, judge: [], beat: 0 };
    const btns = el('<div class="sprint-btns gym-lr"><button class="l">SOL</button><button class="r">SAĞ</button></div>');
    host.appendChild(btns);
    const [bL, bR] = btns.querySelectorAll('button');
    const press = (side) => (e) => {
      e?.preventDefault?.();
      const r = curlPress(C, side);
      const b = side === 'L' ? bL : bR;
      b.classList.add('hit');
      setTimeout(() => b.classList.remove('hit'), 90);
      if (!r) return;
      if (r === 'perfect' || r === 'good') {
        sfx('tick');
        buzz(10);
        if (side === 'L') S.armL = 0.3; else S.armR = 0.3;
        if (C.combo > 0 && C.combo % 8 === 0) big.show(`${C.combo} SERİ!`, '#ffcf3d', 44);
      } else { sfx('error'); buzz(30); }
      S.judge.push({ side, r, t: 0 });
    };
    bL.addEventListener('pointerdown', press('L'));
    bR.addEventListener('pointerdown', press('R'));
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') press('L')(e);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') press('R')(e);
    };
    window.addEventListener('keydown', onKey);
    const LEAD = 1.3; // notanın düşüş süresi
    const stage = createStage(host, {
      update(dt) {
        curlStep(C, dt);
        S.armL = Math.max(0, S.armL - dt);
        S.armR = Math.max(0, S.armR - dt);
        S.judge.forEach((j) => { j.t += dt; });
        S.judge = S.judge.filter((j) => j.t < 0.6);
        // kaçan notalar için yargı
        for (const b of C.beats) if (b.hit === 'miss' && !b.shown) { b.shown = true; S.judge.push({ side: b.side, r: 'miss', t: 0 }); }
        big.update(dt);
        if (C.done && !S.ended) {
          S.ended = true;
          const r = curlResult(C);
          sfx(r.q > 0.6 ? 'goal' : 'whistle');
          finishOverlay(host, [`${r.good}/${C.beats.length} İSABET`, `En uzun seri ${r.maxCombo} · ${r.perfect} mükemmel`]);
          setTimeout(() => { cleanup(); resolve(r); }, 1700);
        }
      },
      render(ctx, W, H, t) {
        const L = lowRes(S, W, H, 120);
        const { c, LW, LH } = L;
        const floorY = Math.round(LH * 0.5);
        drawGymRoom(c, LW, LH, t, { floorY, sign: o.sign || 'KUVVET', window: false });
        drawDumbbellRack(c, Math.round(LW / 2 - 36), floorY, 72, { empty: 9 });
        drawBench(c, 8, floorY + 18, 26);
        const cx = Math.round(LW / 2);
        const standY = Math.round(LH * 0.66);
        const k = LW >= 110 ? 2 : 1;
        const frame = S.armL > 0 && S.armR > 0 ? (S.armL > S.armR ? 'curlL' : 'curlR') : S.armL > 0 ? 'curlL' : S.armR > 0 ? 'curlR' : 'curl0';
        blitSprite(c, look, 'down', frame, cx, standY, k);
        // ritim şeritleri
        const hitY = Math.round(LH * 0.74);
        const lanes = { L: Math.round(LW * 0.2), R: Math.round(LW * 0.8) };
        for (const [side, lx] of Object.entries(lanes)) {
          R(c, lx - 7, 0, 14, hitY + 6, 'rgba(0,0,0,0.35)');
          R(c, lx - 7, hitY - 1, 14, 3, side === 'L' ? '#c6ff3d' : '#38bdf8');
          const active = S.judge.find((j) => j.side === side && j.t < 0.15 && j.r !== 'miss');
          if (active) R(c, lx - 8, hitY - 3, 16, 7, 'rgba(255,255,255,0.5)');
        }
        for (const b of C.beats) {
          if (b.hit && b.hit !== 'miss') continue;
          const dtB = b.t - C.t;
          if (dtB > LEAD || dtB < -0.3) continue;
          const y = Math.round(hitY - (dtB / LEAD) * hitY);
          const lx = lanes[b.side];
          const col = b.hit === 'miss' ? '#5b6475' : b.side === 'L' ? '#c6ff3d' : '#38bdf8';
          R(c, lx - 5, y - 1, 10, 2, shadeHex(col, -0.2));
          R(c, lx - 6, y - 3, 3, 6, col);
          R(c, lx + 3, y - 3, 3, 6, col);
        }
        // nabız: ritim ışığı
        const next = C.beats.find((b) => !b.hit);
        const pulse = next ? Math.max(0, 1 - Math.abs(next.t - C.t) * 6) : 0;
        if (pulse > 0) { c.fillStyle = `rgba(255,207,61,${pulse * 0.18})`; c.fillRect(0, 0, LW, LH); }
        L.blit(ctx);
        ctx.font = '900 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(`SERİ ${C.combo}`, W / 2, TOP + 8);
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.fillStyle = '#93aa9f';
        ctx.fillText(`İsabet ${C.good} · Kaçan ${C.missed + C.wrong}`, W / 2, TOP + 28);
        for (const j of S.judge) {
          const lx = (j.side === 'L' ? 0.2 : 0.8) * W;
          ctx.globalAlpha = 1 - j.t / 0.6;
          ctx.font = '900 16px system-ui, sans-serif';
          ctx.fillStyle = j.r === 'perfect' ? '#c6ff3d' : j.r === 'good' ? '#7dd3fc' : '#ff5d6c';
          ctx.fillText({ perfect: 'MÜKEMMEL', good: 'İYİ', wrong: 'YANLIŞ KOL', miss: 'KAÇTI', early: 'ERKEN' }[j.r] || '', lx, H * 0.62 - j.t * 30);
          ctx.globalAlpha = 1;
        }
        big.render(ctx, W, H);
      },
    });
    function cleanup() { window.removeEventListener('keydown', onKey); stage.stop(); btns.remove(); }
  });
}

// ─────────────────────────── KOŞU BANDI ───────────────────────────
function playTread(host, o) {
  return new Promise((resolve) => {
    const look = gymLook(o.look);
    const P = treadParams(o.cond ?? 58);
    const T = createTread(P);
    const big = new BigText();
    const S = { ended: false, ph: 0, belt: 0, fallT: 0, lastInt: -1 };
    const btns = el('<div class="sprint-btns gym-lr"><button class="l">SOL</button><button class="r">SAĞ</button></div>');
    host.appendChild(btns);
    const [bL, bR] = btns.querySelectorAll('button');
    const tap = (foot) => (e) => {
      e?.preventDefault?.();
      const r = treadTap(T, foot);
      const b = foot === 'L' ? bL : bR;
      b.classList.add('hit');
      setTimeout(() => b.classList.remove('hit'), 70);
      if (r === 'stumble') { sfx('error'); buzz(25); }
      else if (r) { if (T.steps % 2 === 0) sfx('step'); }
    };
    bL.addEventListener('pointerdown', tap('L'));
    bR.addEventListener('pointerdown', tap('R'));
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') tap('L')(e);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') tap('R')(e);
    };
    window.addEventListener('keydown', onKey);
    const stage = createStage(host, {
      update(dt) {
        const was = T.done;
        treadStep(T, dt);
        const kmh = beltKmh(T.t, P);
        S.belt += kmh * dt * 2.2;
        S.ph += Math.max(1.5, T.v) * dt * 0.55;
        const idx = TREAD_PROGRAM.filter(([t0]) => T.t >= t0).length - 1;
        if (idx !== S.lastInt && !T.done) {
          S.lastInt = idx;
          if (idx > 0) { big.show(kmh > TREAD_PROGRAM[idx - 1][1] * P.scale ? `HIZLAN! ${Math.round(kmh)} KM/S` : `YAVAŞLA · ${Math.round(kmh)} KM/S`, kmh > 13 ? '#ff9f43' : '#7dd3fc', 34); sfx('tick'); }
        }
        if (T.fell) S.fallT += dt;
        big.update(dt);
        if (T.done && !was) {
          const r = treadResult(T);
          if (T.fell) { sfx('miss'); buzz([40, 30, 40]); big.show('BANTTAN DÜŞTÜN!', '#ff5d6c', 40); }
          setTimeout(() => {
            sfx(r.q > 0.6 ? 'goal' : 'whistle');
            finishOverlay(host, [`BÖLGEDE %${r.zone}`, r.label]);
          }, T.fell ? 700 : 0);
          setTimeout(() => { cleanup(); resolve(r); }, T.fell ? 2300 : 1700);
        }
      },
      render(ctx, W, H, t) {
        const L = lowRes(S, W, H, 120);
        const { c, LW, LH } = L;
        const floorY = Math.round(LH * 0.58);
        drawGymRoom(c, LW, LH, t, { floorY, sign: '', mirror: false, window: true });
        drawPoster(c, Math.round(LW * 0.4), Math.round(LH * 0.3), 'KOŞ', '#38bdf8');
        drawPoster(c, Math.round(LW * 0.62), Math.round(LH * 0.3), 'GÜÇ', '#c6ff3d');
        drawWaterCooler(c, LW - 14, floorY + 4);
        // ana bant
        const len = Math.round(LW * 0.62);
        const x0 = Math.round(LW * 0.14);
        const deckY = Math.round(LH * 0.78);
        const center = x0 + len * 0.45;
        const span = len * 0.32;
        const zone = [center - TREAD.zone * span, center + TREAD.zone * span];
        const kmh = beltKmh(T.t, P);
        const k = LW >= 110 ? 2 : 1;
        drawTreadmill(c, x0, deckY, len, S.belt, { screen: `${Math.round(kmh)}`, screen2: String(Math.round((T.hr - 90) / 6)), zone, warn: T.x < -0.6, ch: k === 2 ? 50 : 38 });
        const px = center + T.x * span;
        if (T.fell) {
          c.save();
          c.translate(Math.round(px - S.fallT * 30), Math.round(deckY + Math.min(10, S.fallT * 22)));
          c.rotate(-Math.min(1.4, S.fallT * 3));
          blitSprite(c, look, 'side', 'lunge', 0, 0, k);
          c.restore();
        } else {
          const frame = T.v < 1.5 ? 'idle' : `run${Math.floor(S.ph) % 4}`;
          blitSprite(c, look, 'side', frame, px, deckY - 1, k);
        }
        L.blit(ctx);
        // HUD: program çizelgesi
        const bx = 14;
        const bw = W - 28;
        const by = TOP - 6;
        TREAD_PROGRAM.forEach(([t0, v], i) => {
          const t1 = TREAD_PROGRAM[i + 1]?.[0] ?? TREAD.duration;
          const x = bx + (t0 / TREAD.duration) * bw;
          const w = ((Math.min(t1, TREAD.duration) - t0) / TREAD.duration) * bw;
          const hh = 6 + (v / 18) * 14;
          ctx.fillStyle = v >= 15 ? '#ff9f43' : v >= 11 ? '#ffcf3d' : '#38bdf8';
          ctx.globalAlpha = T.t >= t0 && T.t < t1 ? 1 : 0.45;
          ctx.fillRect(x + 1, by + 22 - hh, Math.max(1, w - 2), hh);
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.fillRect(bx + (T.t / TREAD.duration) * bw, by - 2, 2, 28);
        ctx.font = '900 15px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Bant ${kmh.toFixed(1).replace('.', ',')} km/s · Sen ${T.v.toFixed(1).replace('.', ',')}`, 14, by + 46);
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.fillStyle = '#ff5d6c';
        ctx.fillText(`♥ ${Math.round(T.hr)}`, 14, by + 66);
        ctx.fillStyle = '#c6ff3d';
        ctx.textAlign = 'right';
        ctx.fillText(`Bölgede %${Math.round((T.zoneT / TREAD.duration) * 100)} · ${Math.max(0, Math.ceil(TREAD.duration - T.t))} sn`, W - 14, by + 66);
        big.render(ctx, W, H);
      },
    });
    function cleanup() { window.removeEventListener('keydown', onKey); stage.stop(); btns.remove(); }
  });
}

export { drawMat };
