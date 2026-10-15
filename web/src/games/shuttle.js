// DAYANIKLILIK — MEKİK KOŞUSU (bip testi). Yandan görünüm, piksel koşucu (mantık: shuttleLogic.js).
//   KOŞ'a basılı tut: hızlan, bırak: yavaşla. Çizgiye yaklaşınca DÖN: hızlı dönüş.
//   Bip'ten önce çizgiye var; erken varırsan bip'i beklersin (nefes toplanır). Üst üste 2 geç kalış = test biter.
import { createStage, Particles, BigText, clamp, roundRect } from './engine.js';
import { drawSprite, FAN_SPRITES } from '../assets/sprites.js';
import { drawPixelPlayer } from './pixel/sprites.js';
import { lookFromAvatar } from './pixel/looks.js';
import { sfx, buzz } from '../audio.js';
import { SHUTTLE_M, SHUTTLES_PER_LEVEL, createShuttle, deadlineOf, levelOf, levelLabel, pressTurn, setHold, shuttleParams, shuttleResult, shuttleStep } from './shuttleLogic.js';

export function playShuttle(host, opts = {}) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const P = shuttleParams(skill);
    const R = createShuttle(P);
    const myClub = opts.myKit || { colors: ['#2563eb', '#ffffff'] };
    const meLook = opts.me || lookFromAvatar({}, myClub, { number: String(opts.number ?? 8) });
    const particles = new Particles();
    const big = new BigText();
    const S = { phase: 'count', t: 0, count: 3, ph: 0, done: false, afterT: 0, fans: null, beepFlash: 0, lastBeep: -1 };
    const stopAt = (P.targetLevel + 1) * SHUTTLES_PER_LEVEL;
    if (opts.expose) Object.assign(opts.expose, { R, P, S });

    const btns = document.createElement('div');
    btns.className = 'sprint-btns';
    btns.innerHTML = '<button class="l" aria-label="Koş (basılı tut)">KOŞ</button><button class="r" aria-label="Dön">DÖN</button>';
    host.appendChild(btns);
    const [bRun, bTurn] = btns.querySelectorAll('button');
    const runOn = (on) => (e) => {
      e.preventDefault();
      if (S.phase !== 'run') return;
      setHold(R, on);
      bRun.classList.toggle('hit', on);
    };
    bRun.addEventListener('pointerdown', runOn(true));
    bRun.addEventListener('pointerup', runOn(false));
    bRun.addEventListener('pointercancel', runOn(false));
    bRun.addEventListener('pointerleave', runOn(false));
    const turn = (e) => {
      e?.preventDefault?.();
      if (S.phase !== 'run') return;
      bTurn.classList.add('hit');
      setTimeout(() => bTurn.classList.remove('hit'), 90);
      pressTurn(R);
    };
    bTurn.addEventListener('pointerdown', turn);
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.type === 'keydown' && (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'w' || e.key === 'W')) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          // ok tuşları: koşu yönündeki ok = koş, ters ok = dön
          const fwd = (R.dir > 0 && e.key === 'ArrowRight') || (R.dir < 0 && e.key === 'ArrowLeft');
          if (fwd) setHold(R, true); else turn();
        } else setHold(R, true);
      }
      if (e.type === 'keyup' && (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'w' || e.key === 'W')) setHold(R, false);
      if (e.type === 'keydown' && (e.key === 'd' || e.key === 'D' || e.key === 'Enter')) turn();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    function events() {
      for (const ev of R.events) {
        if (ev.type === 'armed') buzz('touch');
        else if (ev.type === 'early') { big.show('ERKEN!', '#ffcf3d', 30); buzz('error'); }
        else if (ev.type === 'turn') { if (ev.perfect) { big.show('SÜPER DÖNÜŞ', '#c6ff3d', 30); buzz('perfect'); } else buzz('step'); }
        else if (ev.type === 'late') { big.show(`GEÇ KALDIN ${ev.warnings}/2`, '#ff5d6c', 40); sfx('error'); buzz('error'); }
        else if (ev.type === 'line') buzz('stride');
        else if (ev.type === 'gassed') { big.show('NEFESİN KESİLDİ!', '#ff5d6c', 36); buzz('heartBreak'); }
        else if (ev.type === 'level' && ev.n % SHUTTLES_PER_LEVEL === 0) {
          const lv = ev.n / SHUTTLES_PER_LEVEL + 1;
          big.show(`SEVİYE ${lv}`, '#38bdf8', 46);
          sfx('levelup');
        }
      }
      R.events.length = 0;
    }

    function end() {
      if (S.phase === 'after') return;
      S.phase = 'after';
      S.afterT = 0;
      setHold(R, false);
      const res = shuttleResult(R);
      if (res.success) {
        big.show(`SEVİYE ${res.level}!`, '#c6ff3d', 56);
        particles.burst(stage.W / 2, stage.H * 0.55, { n: 40, colors: ['#c6ff3d', '#ffcf3d', '#fff'], speed: 300, life: 1.2 });
        sfx('levelup');
        buzz('record');
      } else {
        big.show('TEST BİTTİ', '#ff5d6c', 50);
        sfx('whistle');
      }
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      const res = shuttleResult(R);
      setTimeout(() => {
        stage.stop();
        btns.remove();
        resolve(res);
      }, 50);
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        S.t += dt;
        particles.update(dt);
        big.update(dt);
        S.beepFlash = Math.max(0, S.beepFlash - dt);
        if (S.phase === 'count') {
          const c = 3 - Math.floor(S.t / 0.7);
          if (c !== S.count) { S.count = c; if (c > 0) sfx('tick'); }
          if (S.t >= 2.1) {
            S.phase = 'run';
            sfx('shortWhistle');
            buzz('kick');
          }
          return;
        }
        if (S.phase === 'run') {
          shuttleStep(R, dt);
          S.ph += R.v * dt * 1.25;
          // bip: her mekiğin bitiş anında
          while (R.t >= deadlineOf(S.lastBeep + 1)) {
            S.lastBeep++;
            S.beepFlash = 0.25;
            sfx('shortWhistle');
          }
          events();
          if (R.over || R.n >= stopAt) end();
        } else {
          S.afterT += dt;
          if (S.afterT > 1.8) finish();
        }
      },

      render(ctx, W, H, t) {
        // gökyüzü + tribün (piksel taraftarlar)
        const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
        sky.addColorStop(0, '#0b1730');
        sky.addColorStop(1, '#1d2b4a');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H * 0.5);
        const st = H * 0.27;
        ctx.fillStyle = '#0d1424';
        ctx.fillRect(0, st, W, H * 0.24);
        if (!S.fans) {
          S.fans = [];
          for (let r = 0; r < 3; r++) for (let x = 6 + r * 9; x < W; x += 30) S.fans.push({ x: x + Math.random() * 6, r, name: FAN_SPRITES[Math.floor(Math.random() * Math.max(1, FAN_SPRITES.length))], ph: Math.random() * 6 });
        }
        for (const f of S.fans) {
          const y = st + 22 + f.r * (H * 0.065);
          const jump = S.phase === 'after' && shuttleResult(R).success ? Math.abs(Math.sin(t * 9 + f.ph)) * 5 : Math.abs(Math.sin(t * 1.5 + f.ph)) * 1;
          drawSprite(ctx, f.name, f.x, y - jump, { h: H * 0.06, anchor: 'bottom' });
        }
        drawSprite(ctx, 'light_tower', W * 0.08, st + 2, { h: st * 0.95, anchor: 'bottom' });
        drawSprite(ctx, 'light_tower', W * 0.92, st + 2, { h: st * 0.95, anchor: 'bottom', flip: true });
        // pist / çim
        ctx.fillStyle = '#1f7a3a';
        ctx.fillRect(0, H * 0.51, W, H * 0.49);
        ctx.fillStyle = '#23873f';
        for (let i = 0; i < 6; i++) ctx.fillRect(0, H * 0.51 + i * H * 0.08, W, H * 0.04);
        // iki çizgi + dubalar
        const x0 = W * 0.1;
        const x1 = W * 0.9;
        const ppm = (x1 - x0) / SHUTTLE_M;
        const gy = H * 0.74;
        for (const lx of [x0, x1]) {
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          ctx.fillRect(lx - 2, H * 0.53, 4, H * 0.4);
          drawSprite(ctx, 'cone', lx, H * 0.58, { h: 22, anchor: 'bottom' });
          drawSprite(ctx, 'cone', lx, H * 0.93, { h: 22, anchor: 'bottom' });
        }
        // hayalet: bip'e tam yetişen tempo
        if (S.phase === 'run') {
          const n = R.n;
          const dl = deadlineOf(n);
          const startT = n === 0 ? 0 : deadlineOf(n - 1);
          const f = clamp((R.t - startT) / Math.max(0.01, dl - startT), 0, 1);
          const gx = R.dir > 0 ? x0 + f * (x1 - x0) : x1 - f * (x1 - x0);
          ctx.fillStyle = 'rgba(255,255,255,.18)';
          ctx.fillRect(gx - 2, H * 0.55, 4, H * 0.36);
          ctx.font = '800 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,.55)';
          ctx.fillText('BİP TEMPOSU', gx, H * 0.545);
        }
        // koşucu
        const rx = x0 + R.x * ppm;
        const turning = R.turning > 0;
        drawPixelPlayer(ctx, rx, gy, H * 0.14, meLook, {
          dir: 'side',
          flip: R.dir < 0 ? !turning : turning,
          frame: R.v > 0.4 && !turning ? `run${Math.floor(S.ph) % 4}` : 'idle',
          marker: '#c6ff3d',
        });
        // HUD
        ctx.fillStyle = 'rgba(4,10,8,.66)';
        roundRect(ctx, 8, 66, W - 16, 112, 12);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.font = '900 22px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        const lv = levelOf(R.n);
        ctx.fillText(`Seviye ${lv}`, 18, 94);
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.fillText(`Mekik ${(R.n % SHUTTLES_PER_LEVEL) + 1}/${SHUTTLES_PER_LEVEL}  •  Hedef seviye ${P.targetLevel}  •  Şu an ${levelLabel(R.n)}`, 18, 114);
        ctx.textAlign = 'right';
        ctx.fillStyle = R.warnings ? '#ff5d6c' : 'rgba(255,255,255,.7)';
        ctx.fillText(`Uyarı ${R.warnings}/2`, W - 18, 94);
        ctx.textAlign = 'left';
        // bip sayacı: mekiğin kalan süresi
        const dl = deadlineOf(R.n);
        const startT = R.n === 0 ? 0 : deadlineOf(R.n - 1);
        const frac = S.phase === 'run' ? clamp((R.t - startT) / (dl - startT), 0, 1) : 0;
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        roundRect(ctx, 18, 124, W - 36, 10, 5);
        ctx.fill();
        ctx.fillStyle = frac > 0.8 ? '#ff5d6c' : '#38bdf8';
        roundRect(ctx, 18, 124, Math.max(6, (W - 36) * (1 - frac)), 10, 5);
        ctx.fill();
        // nefes
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.fillText('Nefes', 18, 160);
        roundRect(ctx, 64, 151, W - 82, 10, 5);
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fill();
        roundRect(ctx, 64, 151, Math.max(4, (W - 82) * (R.breath / 100)), 10, 5);
        ctx.fillStyle = R.gassed ? (Math.sin(t * 20) > 0 ? '#ff5d6c' : '#7f1d1d') : R.breath < 35 ? '#ff9e26' : '#facc15';
        ctx.fill();
        const waiting = S.phase === 'run' && R.t < R.leaveAt;
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.fillStyle = waiting ? '#c6ff3d' : R.v > P.easy ? '#ff9e26' : 'rgba(198,255,61,.9)';
        ctx.fillText(waiting ? 'Bip\'i bekle: nefes topla' : R.v > P.easy ? 'Hızlısın: nefes azalıyor' : 'Rahat tempo: nefes toplanıyor', 18, 174);
        if (S.beepFlash > 0) {
          ctx.fillStyle = `rgba(56,189,248,${S.beepFlash})`;
          ctx.fillRect(0, 0, W, 6);
          ctx.font = '900 30px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255,255,255,${S.beepFlash * 3})`;
          ctx.fillText('BİP!', W / 2, H * 0.47);
        }
        // DÖN penceresi göstergesi
        const lineX = R.dir > 0 ? SHUTTLE_M : 0;
        if (S.phase === 'run' && Math.abs(lineX - R.x) <= P.turnWindow && R.turning <= 0) {
          ctx.font = '900 18px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = R.armed ? '#c6ff3d' : `rgba(255,207,61,${0.6 + 0.4 * Math.sin(t * 18)})`;
          ctx.fillText(R.armed ? 'DÖNÜŞ HAZIR' : 'DÖN!', rx, gy - H * 0.2);
        }
        if (S.phase === 'count') {
          const c = Math.max(1, 3 - Math.floor(S.t / 0.7));
          const k = (S.t % 0.7) / 0.7;
          ctx.save();
          ctx.translate(W / 2, H * 0.4);
          ctx.scale(1.4 - k * 0.4, 1.4 - k * 0.4);
          ctx.globalAlpha = 1 - k * 0.6;
          ctx.font = '900 96px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#c6ff3d';
          ctx.fillText(String(c), 0, 0);
          ctx.restore();
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },
    });
  });
}
