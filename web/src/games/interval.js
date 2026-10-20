// KONDİSYON PARKURU (NABIZ KOŞUSU) — yandan kayan piksel atletizm pisti (mantık: intervalLogic.js).
//   KOŞ'a basılı tut: hızlan, bırak: yavaşla. Nabzı bölümün aralığında tut (TEMPO 115–145, SPRİNT 158–182).
//   Kondisyonun düşükse nabız çabuk yükselir. Sprintte engellerin üstünden ZIPLA.
import { createStage, Particles, BigText, clamp } from './engine.js';
import { sfx, buzz } from '../audio.js';
import { weatherFx } from './weatherFx.js';
import { lookFromAvatar, npcLook } from './pixel/looks.js';
import { drawPixelText } from './pixel/font.js';
import { R as rect, lowRes, shadeHex } from './pixel/gymArt.js';
import { blitSprite } from './gym.js';
import { IV_PROGRAM, IV_RED, IV_TOTAL, IV_ZONES, createInterval, intervalParams, intervalResult, intervalStep, jump, nextHurdle, segmentAt, setRun } from './intervalLogic.js';

const SEG_NAME = { jog: 'TEMPO', sprint: 'SPRİNT', cool: 'SOĞUMA' };
const SEG_COL = { jog: '#38bdf8', sprint: '#fb923c', cool: '#a78bfa' };

export function playInterval(host, opts = {}) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const P = intervalParams(skill, opts.cond ?? 60);
    const Rn = createInterval(P);
    const myClub = opts.myKit || { colors: ['#2563eb', '#ffffff'] };
    const meLook = opts.me || lookFromAvatar({}, myClub, { number: String(opts.number ?? 8) });
    const mateLook = npcLook(myClub, 77, 6);
    const particles = new Particles();
    const big = new BigText();
    const wfx = weatherFx(opts.weather);
    const S = { phase: 'count', t: 0, count: 3, ph: 0, matePh: 0, mateX: 0, done: false, afterT: 0, beat: 0, crowd: null };
    if (opts.expose) Object.assign(opts.expose, { R: Rn, P, S });

    const btns = document.createElement('div');
    btns.className = 'sprint-btns';
    btns.innerHTML = '<button class="l" aria-label="Koş (basılı tut)">KOŞ</button><button class="r" aria-label="Zıpla">ZIPLA</button>';
    host.appendChild(btns);
    const [bRun, bJump] = btns.querySelectorAll('button');
    const runOn = (on) => (e) => {
      e.preventDefault();
      if (S.phase !== 'run') return;
      setRun(Rn, on);
      bRun.classList.toggle('hit', on);
    };
    bRun.addEventListener('pointerdown', runOn(true));
    bRun.addEventListener('pointerup', runOn(false));
    bRun.addEventListener('pointercancel', runOn(false));
    bRun.addEventListener('pointerleave', runOn(false));
    const doJump = (e) => {
      e?.preventDefault?.();
      if (S.phase !== 'run') return;
      bJump.classList.add('hit');
      setTimeout(() => bJump.classList.remove('hit'), 90);
      if (jump(Rn)) { sfx('swish'); buzz('step'); }
    };
    bJump.addEventListener('pointerdown', doJump);
    const onKey = (e) => {
      if (e.repeat) return;
      const runKey = e.key === ' ' || e.key === 'ArrowRight' || e.key === 'w' || e.key === 'W';
      if (e.type === 'keydown' && runKey) setRun(Rn, true);
      if (e.type === 'keyup' && runKey) setRun(Rn, false);
      if (e.type === 'keydown' && (e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'j' || e.key === 'J')) doJump(e);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    function events() {
      for (const ev of Rn.events) {
        if (ev.type === 'seg') {
          if (Rn.t > 0.2) {
            big.show(ev.kind === 'sprint' ? 'SPRİNT!' : ev.kind === 'cool' ? 'SOĞUMA' : 'TEMPO KOŞUSU', SEG_COL[ev.kind], ev.kind === 'sprint' ? 46 : 34);
            sfx(ev.kind === 'sprint' ? 'shortWhistle' : 'tick');
            buzz(ev.kind === 'sprint' ? 'kick' : 'touch');
          }
        } else if (ev.type === 'gasp') { big.show('NEFESİN KESİLDİ!', '#ff5d6c', 36); sfx('error'); buzz('heartBreak'); }
        else if (ev.type === 'hit') { big.show('ENGELE TAKILDIN', '#ff5d6c', 30); sfx('miss'); buzz([30, 30, 30]); }
        else if (ev.type === 'clear') { buzz('perfect'); particles.burst(stage.W * 0.3, stage.H * 0.7, { n: 10, colors: ['#c6ff3d', '#fff'], speed: 160, life: 0.5 }); }
      }
      Rn.events.length = 0;
    }

    function end() {
      if (S.phase === 'after') return;
      S.phase = 'after';
      S.afterT = 0;
      setRun(Rn, false);
      const res = intervalResult(Rn);
      if (res.success) {
        big.show(`BÖLGEDE %${res.zone}`, '#c6ff3d', 52);
        particles.burst(stage.W / 2, stage.H * 0.5, { n: 40, colors: ['#c6ff3d', '#38bdf8', '#fff'], speed: 300, life: 1.2 });
        sfx('levelup');
        buzz('record');
      } else {
        big.show(`BÖLGEDE %${res.zone}`, '#ff9e26', 48);
        sfx('whistle');
      }
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      const res = intervalResult(Rn);
      setTimeout(() => { stage.stop(); btns.remove(); resolve(res); }, 50);
    }

    // ideal tempo (hayalet koşucu): bölgenin ortasına denk gelen hız
    const idealV = (kind) => { const [lo, hi] = IV_ZONES[kind]; return clamp(((lo + hi) / 2 - 78) / P.hrGain, P.vmin, P.vmax); };

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        S.t += dt;
        particles.update(dt);
        big.update(dt);
        if (S.phase === 'count') {
          const c = 3 - Math.floor(S.t / 0.7);
          if (c !== S.count) { S.count = c; if (c > 0) sfx('tick'); }
          if (S.t >= 2.1) { S.phase = 'run'; sfx('shortWhistle'); buzz('kick'); }
          return;
        }
        if (S.phase === 'run') {
          intervalStep(Rn, dt);
          S.ph += Rn.v * dt * 1.15;
          const seg = segmentAt(Rn.t);
          const mv = idealV(seg.kind);
          S.mateX += mv * dt;
          S.matePh += mv * dt * 1.15;
          S.beat += dt * (Rn.hr / 60);
          events();
          if (Rn.done) end();
        } else {
          S.afterT += dt;
          S.beat += dt * (Rn.hr / 60);
          Rn.v = Math.max(0, Rn.v - dt * 3);
          Rn.hr += (100 - Rn.hr) * dt * 0.6;
          S.ph += Rn.v * dt * 1.15;
          if (S.afterT > 2) finish();
        }
      },

      render(ctx, W, H, t) {
        const L = lowRes(S, W, H, 150);
        const { c, LW, LH } = L;
        const ppm = LW / 26; // metre başına mantıksal piksel
        const camX = Rn.x;
        const sx = (mx) => Math.round(LW * 0.3 + (mx - camX) * ppm);
        // dikey yerleşim: alttan yukarı (düğmelerin üstünde pist, sonra çim, tribün, gökyüzü)
        const tBot = LH - Math.round(122 / L.u);
        const laneH = 12;
        const lanes = 4;
        const tTop = tBot - laneH * lanes;
        const gTop = tTop - 12;
        const stTop = gTop - 62;
        // gökyüzü
        for (let y = 0; y < stTop; y++) rect(c, 0, y, LW, 1, y < stTop * 0.55 ? '#0b1730' : y < stTop * 0.85 ? '#13264a' : '#1d375e');
        for (let i = 0; i < 26; i++) { const x = (i * 53) % LW; const y = (i * 29) % Math.max(10, stTop - 30); if (Math.sin(t * 2 + i) > -0.3) rect(c, x, y + 4, 1, 1, '#94a3b8'); }
        // ışık direkleri
        for (const lx of [Math.round(LW * 0.1), Math.round(LW * 0.9)]) {
          rect(c, lx, stTop - 24, 1, 26, '#475569');
          rect(c, lx - 5, stTop - 29, 11, 5, '#1e293b');
          for (let k = 0; k < 3; k++) rect(c, lx - 4 + k * 3, stTop - 28, 2, 3, '#fef9c3');
        }
        // tribün: basamaklar ve sıra sıra taraftar (yavaş kayar)
        const par = Math.round(camX * ppm * 0.25);
        const tiers = 6;
        const tierH = Math.floor((gTop - stTop - 6) / tiers);
        rect(c, 0, stTop - 2, LW, 2, '#0a0f1c');
        for (let r = 0; r < tiers; r++) {
          const y0 = stTop + r * tierH;
          rect(c, 0, y0, LW, tierH, r % 2 ? '#162036' : '#1a2540');
          rect(c, 0, y0 + tierH - 1, LW, 1, '#0d1424');
        }
        if (!S.crowd) {
          const cols = [myClub.colors[0], myClub.colors[1] || '#fff', '#e2e8f0', '#fbbf24', '#38bdf8', myClub.colors[0]];
          const skins = ['#f1c27d', '#d9a07a', '#a26b4a', '#7a4b2e'];
          S.crowd = [];
          for (let r = 0; r < tiers; r++) for (let i = 0; i < 70; i++) if (Math.random() < 0.78) S.crowd.push({ r, i, col: cols[(i * 7 + r * 3) % cols.length], skin: skins[(i + r) % 4], ph: Math.random() * 6 });
        }
        const won = S.phase === 'after' && intervalResult(Rn).success;
        for (const f of S.crowd) {
          const span = 70 * 4;
          const x = ((f.i * 4 + (f.r % 2) * 2 - par) % span + span) % span - 4;
          if (x > LW + 2) continue;
          const jump = won || (S.phase === 'run' && Rn.cleared && Math.sin(t * 3 + f.ph) > 0.92) ? Math.round(Math.abs(Math.sin(t * 9 + f.ph)) * 2) : 0;
          const y = stTop + f.r * tierH + tierH - 5 - jump;
          rect(c, x, y, 2, 2, f.skin);
          rect(c, x, y + 2, 2, 2, f.col);
        }
        // reklam panosu
        rect(c, 0, gTop - 9, LW, 9, '#0f172a');
        for (let i = 0; i < 6; i++) {
          const x = ((i * 46 - Math.round(camX * ppm * 0.6)) % 276 + 276) % 276 - 20;
          rect(c, x, gTop - 8, 42, 7, i % 2 ? '#c6ff3d' : '#38bdf8');
          drawPixelText(c, i % 2 ? 'KOŞ' : 'NABIZ', x + 21, gTop - 7, '#0b1220', { align: 'center' });
        }
        // dev ekran: kondisyon ve nabız
        {
          const jw = 64;
          const jh = 20;
          const jx = Math.round(LW / 2 - jw / 2);
          const jy = Math.max(Math.round(170 / L.u), stTop - jh - 10);
          rect(c, jx + jw / 2 - 1, jy + jh, 2, stTop - jy - jh, '#334155');
          rect(c, jx - 2, jy - 2, jw + 4, jh + 4, '#000');
          rect(c, jx, jy, jw, jh, '#0b1220');
          drawPixelText(c, `KONDİSYON ${Math.round(opts.cond ?? 60)}`, jx + jw / 2, jy + 3, '#c6ff3d', { align: 'center' });
          const beatOn = Math.sin(S.beat * Math.PI * 2) > 0.2;
          drawPixelText(c, `NABIZ ${Math.round(Rn.hr)}`, jx + jw / 2, jy + 11, Rn.hr >= IV_RED ? '#f87171' : beatOn ? '#fda4af' : '#f43f5e', { align: 'center' });
        }
        // çim iç saha
        rect(c, 0, gTop, LW, tTop - gTop, '#1f7a3a');
        for (let i = 0; i < LW + 8; i += 8) rect(c, ((i - Math.round(camX * ppm)) % (LW + 8) + LW + 8) % (LW + 8) - 4, gTop, 4, tTop - gTop, '#23873f');
        // pist (tartan) ve kulvarlar
        rect(c, 0, tTop, LW, tBot - tTop, '#a8472a');
        for (let y = tTop + 1; y < tBot; y += 3) rect(c, 0, y, LW, 1, '#b4532a');
        for (let i = 0; i <= lanes; i++) rect(c, 0, tTop + i * laneH, LW, 1, '#f1f5f9');
        rect(c, 0, tBot + 1, LW, LH - tBot - 1, '#4b5563');
        for (let i = 0; i < LW; i += 10) rect(c, i, tBot + 1, 5, 1, '#6b7280');
        // mesafe çizgileri (her 10 m)
        for (let m = Math.floor((camX - 12) / 10) * 10; m < camX + 30; m += 10) {
          const x = sx(m);
          if (x < -4 || x > LW + 4 || m < 0) continue;
          rect(c, x, tTop, 1, tBot - tTop, 'rgba(255,255,255,0.35)');
          drawPixelText(c, `${m}M`, x + 2, tBot + 3, '#cbd5e1');
        }
        // oyuncunun kulvarı (2.) ve hayalet tempo koşucusu (3.)
        const myY = tTop + laneH * 3 - 2;
        const mateY = tTop + laneH * 2 - 2;
        // engeller (benim kulvarım)
        for (const h of Rn.hurdles) {
          const x = sx(h.x);
          if (x < -6 || x > LW + 6) continue;
          const fall = h.hit ? 1 : 0;
          if (fall) { rect(c, x - 5, myY - 2, 11, 2, '#f8fafc'); rect(c, x - 5, myY - 2, 3, 2, '#dc2626'); continue; }
          rect(c, x - 5, myY - 9, 1, 9, '#cbd5e1');
          rect(c, x + 5, myY - 9, 1, 9, '#cbd5e1');
          rect(c, x - 5, myY - 10, 11, 2, '#f8fafc');
          rect(c, x - 2, myY - 10, 3, 2, '#dc2626');
          rect(c, x + 4, myY - 10, 2, 2, '#dc2626');
        }
        // hayalet koşucu (yarı saydam): ideal tempo
        if (S.phase !== 'count') {
          // hayalet hep görünür: önde/arkada en fazla 7 m
          const gx = sx(Rn.x + clamp(S.mateX - Rn.x, -7, 7));
          if (gx > -10 && gx < LW + 10) blitSprite(c, mateLook, 'side', `run${Math.floor(S.matePh) % 4}`, gx, mateY, 1, { alpha: 0.45 });
          if (gx > -10 && gx < LW + 10) drawPixelText(c, 'TEMPO', gx, mateY - 38, 'rgba(255,255,255,0.6)', { align: 'center' });
        }
        // koşucu (ben)
        const px = sx(Rn.x);
        const airK = Rn.air > 0 ? Math.sin(Math.PI * (1 - Rn.air / P.airT)) : 0;
        const lift = Math.round(airK * 12);
        const frame = Rn.air > 0 ? 'lunge' : Rn.stumble > 0 ? 'idle' : Rn.v > 0.4 ? `run${Math.floor(S.ph) % 4}` : 'idle';
        blitSprite(c, meLook, 'side', frame, px, myY - lift, 1);
        if (lift) rect(c, px - 5, myY, 10, 1, 'rgba(0,0,0,0.25)');
        // ZIPLA ipucu
        const nh = nextHurdle(Rn);
        if (S.phase === 'run' && nh && nh.x - Rn.x < P.jumpWindow + 1.2 && nh.x - Rn.x > 0 && Rn.air <= 0) {
          const blink = Math.sin(t * 18) > 0;
          drawPixelText(c, 'ZIPLA!', px, myY - 44, blink ? '#fde047' : '#f97316', { align: 'center' });
        }
        L.blit(ctx);
        wfx.sky(ctx, W, H, t);

        // ── HUD (ekran pikselleri) ──
        const u = L.u;
        const top = 70;
        const seg = segmentAt(Rn.t);
        const [lo, hi] = IV_ZONES[seg.kind];
        ctx.fillStyle = 'rgba(4,8,16,.78)';
        ctx.fillRect(8, top, W - 16, 90);
        ctx.fillStyle = '#000';
        ctx.fillRect(8, top + 90, W - 16, 2);
        // program şeridi: bölümler ve ilerleme
        {
          const px0 = 18;
          const pw = W - 36;
          const py = top + 74;
          let acc = 0;
          for (const [kind, d] of IV_PROGRAM) {
            const x0 = px0 + Math.round((acc / IV_TOTAL) * pw);
            const x1 = px0 + Math.round(((acc + d) / IV_TOTAL) * pw);
            ctx.fillStyle = SEG_COL[kind];
            ctx.globalAlpha = Rn.t >= acc + d ? 0.35 : seg.t0 === acc ? 1 : 0.7;
            ctx.fillRect(x0, py, Math.max(2, x1 - x0 - 2), 8);
            acc += d;
          }
          ctx.globalAlpha = 1;
          const pxm = px0 + Math.round((clamp(Rn.t, 0, IV_TOTAL) / IV_TOTAL) * pw);
          ctx.fillStyle = '#fff';
          ctx.fillRect(pxm - 1, py - 3, 3, 14);
        }
        drawPixelText(ctx, SEG_NAME[seg.kind], 18, top + 8, SEG_COL[seg.kind], { scale: 3 });
        drawPixelText(ctx, S.phase === 'run' ? `${Math.ceil(seg.left)} SN` : '', W - 18, top + 8, '#e2e8f0', { scale: 3, align: 'right' });
        drawPixelText(ctx, `HEDEF ${lo}-${hi}`, 18 + 3 * 4 * (SEG_NAME[seg.kind].length + 1), top + 12, 'rgba(226,232,240,.75)', { scale: 2 });
        // nabız şeridi 100–200
        const mx0 = 18;
        const mw = W - 36 - 70;
        const my0 = top + 32;
        const toX = (bpm) => mx0 + clamp((bpm - 100) / 100, 0, 1) * mw;
        ctx.fillStyle = '#05080f';
        ctx.fillRect(mx0 - 2, my0 - 2, mw + 4, 16);
        const cells = 25;
        for (let i = 0; i < cells; i++) {
          const b = 100 + (i + 0.5) * (100 / cells);
          const x = mx0 + (i / cells) * mw;
          const inZ = b >= lo && b <= hi;
          ctx.fillStyle = b >= IV_RED ? '#991b1b' : inZ ? SEG_COL[seg.kind] : '#334155';
          ctx.globalAlpha = inZ || b >= IV_RED ? 0.95 : 0.6;
          ctx.fillRect(Math.round(x) + 1, my0, Math.max(2, Math.round(mw / cells) - 2), 12);
        }
        ctx.globalAlpha = 1;
        const hx = Math.round(toX(Rn.hr));
        ctx.fillStyle = '#fff';
        ctx.fillRect(hx - 1, my0 - 5, 3, 22);
        ctx.fillStyle = '#000';
        ctx.fillRect(hx - 2, my0 - 7, 5, 2);
        // kalp + BPM
        const pulse = 1 + Math.max(0, Math.sin(S.beat * Math.PI * 2)) * 0.25;
        const hcx = W - 64;
        const hcy = my0 + 6;
        ctx.save();
        ctx.translate(hcx, hcy);
        ctx.scale(pulse, pulse);
        const HEART = ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000'];
        ctx.fillStyle = Rn.hr >= IV_RED ? '#ef4444' : '#f43f5e';
        HEART.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '1') ctx.fillRect((rx - 4) * 2, (ry - 3) * 2, 2, 2); }));
        ctx.restore();
        drawPixelText(ctx, `${Math.round(Rn.hr)}`, W - 18, my0 - 1, Rn.hr >= IV_RED ? '#f87171' : '#fff', { scale: 3, align: 'right' });
        // durum yazısı
        const inZone = Rn.hr >= lo && Rn.hr <= hi;
        const msg = S.phase !== 'run' ? '' : Rn.gasp > 0 ? 'NEFESİN KESİLDİ: YAVAŞLA' : Rn.hr >= IV_RED ? 'KIRMIZI BÖLGE!' : inZone ? 'BÖLGEDESİN' : Rn.hr > hi ? 'NABIZ YÜKSEK: YAVAŞLA' : 'NABIZ DÜŞÜK: HIZLAN';
        drawPixelText(ctx, msg, 18, top + 56, inZone ? '#c6ff3d' : Rn.hr >= IV_RED ? '#f87171' : '#fbbf24', { scale: 2 });
        drawPixelText(ctx, `BÖLGE %${Rn.total ? Math.round((Rn.inZone / Rn.total) * 100) : 0}  ENGEL ${Rn.cleared}/${Rn.cleared + Rn.hits}`, W - 18, top + 56, 'rgba(226,232,240,.8)', { scale: 2, align: 'right' });
        void u;
        if (S.phase === 'count') {
          const cnum = Math.max(1, 3 - Math.floor(S.t / 0.7));
          const k = (S.t % 0.7) / 0.7;
          ctx.save();
          ctx.globalAlpha = 1 - k * 0.6;
          drawPixelText(ctx, String(cnum), W / 2, H * 0.42 - 30, '#c6ff3d', { scale: Math.round(12 - k * 4), align: 'center', shadow: '#000' });
          ctx.restore();
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },
    });
  });
}
