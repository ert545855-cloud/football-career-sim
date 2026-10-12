// SÜRAT / DAYANIKLILIK KOŞUSU — yandan görünüm. SOL-SAĞ tuşlarına sırayla bas; hedef koşucuyu geç.
import { createStage, Particles, BigText, clamp, lerp, roundRect } from './engine.js';
import { sfx, buzz } from '../audio.js';

export function playSprint(host, opts) {
  return new Promise((resolve) => {
    const endurance = opts.mode === 'endurance';
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const distance = endurance ? 120 : 60;
    const target = endurance ? lerp(26, 17.5, skill) : lerp(10.4, 7.4, skill);
    const kit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const particles = new Particles();
    const big = new BigText();
    const S = { phase: 'count', t: 0, count: 3, x: 0, v: 0, last: null, stam: 100, stumble: 0, time: 0, ph: 0, ghost: 0, done: false, outcome: null, afterT: 0, steps: 0 };
    const IMP = 1.35;
    const K = 1.2;

    const btns = document.createElement('div');
    btns.className = 'sprint-btns';
    btns.innerHTML = '<button class="l" aria-label="Sol adım">SOL</button><button class="r" aria-label="Sağ adım">SAĞ</button>';
    host.appendChild(btns);
    const [bl, br] = btns.querySelectorAll('button');

    function step(side) {
      if (S.phase !== 'run') return;
      const btn = side === 'L' ? bl : br;
      btn.classList.add('hit');
      setTimeout(() => btn.classList.remove('hit'), 70);
      if (S.last === side) {
        S.v *= 0.55;
        S.stumble = 0.35;
        sfx('error');
        buzz(25);
      } else {
        let imp = IMP;
        if (endurance) {
          S.stam = Math.max(0, S.stam - lerp(2.4, 1.4, skill));
          if (S.stam < 15) imp *= 0.45;
        }
        if (S.stumble > 0) imp *= 0.5;
        S.v += imp;
        S.steps++;
        if (S.steps % 2 === 0) sfx('step');
      }
      S.last = side;
    }

    const down = (side) => (e) => { e.preventDefault(); step(side); };
    bl.addEventListener('pointerdown', down('L'));
    br.addEventListener('pointerdown', down('R'));
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') step('L');
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') step('R');
    };
    window.addEventListener('keydown', onKey);

    function end(success) {
      S.phase = 'after';
      S.outcome = success ? 'win' : 'lose';
      S.afterT = 0;
      if (success) {
        big.show('REKOR!', '#c6ff3d', 64);
        particles.burst(stage.W * 0.32, stage.H * 0.55, { n: 40, colors: ['#c6ff3d', '#ffcf3d', '#fff'], speed: 300, life: 1.2 });
        sfx('levelup');
        buzz([40, 30, 80]);
      } else {
        big.show('YAKALAYAMADIN', '#ff5d6c', 44);
        sfx('miss');
      }
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      window.removeEventListener('keydown', onKey);
      const success = S.outcome === 'win';
      const accuracy = success ? clamp(0.5 + (target - S.time) / (target * 0.2), 0, 1) : 0;
      setTimeout(() => {
        stage.stop();
        btns.remove();
        resolve({ success, accuracy, outcome: S.outcome, time: S.time });
      }, 50);
    }

    const stage = createStage(host, {
      update(dt) {
        S.t += dt;
        particles.update(dt);
        big.update(dt);
        if (S.phase === 'count') {
          const c = 3 - Math.floor(S.t / 0.7);
          if (c !== S.count) {
            S.count = c;
            if (c > 0) sfx('tick');
          }
          if (S.t >= 2.1) {
            S.phase = 'run';
            S.time = 0;
            sfx('shortWhistle');
          }
          return;
        }
        if (S.phase === 'run') {
          S.time += dt;
          S.v -= K * S.v * dt;
          S.v = Math.max(0, S.v);
          S.x += S.v * dt;
          S.ph += S.v * dt * 1.7;
          if (S.stumble > 0) S.stumble -= dt;
          if (endurance) S.stam = Math.min(100, S.stam + 9 * dt);
          // hedef koşucu: sabit tempo, hızlı kalkış
          const gv = distance / target;
          S.ghost = Math.min(distance, gv * Math.max(0, S.time - 0.4) + (S.time < 0.4 ? 0 : 0));
          if (S.x >= distance) {
            S.x = distance;
            end(S.time <= target);
          } else if (S.time > target * 1.6) end(false);
        } else {
          S.afterT += dt;
          S.v *= 0.97;
          S.x += S.v * dt;
          S.ph += S.v * dt * 1.7;
          if (S.afterT > 1.6) finish();
        }
      },

      render(ctx, W, H, t) {
        const ppm = W / 9; // metre başına piksel
        const camX = S.x * ppm - W * 0.32;
        // gökyüzü
        const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
        sky.addColorStop(0, '#0b1730');
        sky.addColorStop(1, '#f97316');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H * 0.55);
        // tribün (paralaks): basamaklar + seyirci noktaları + ışık direkleri
        const st = H * 0.3;
        ctx.fillStyle = '#0d1424';
        ctx.fillRect(0, st, W, H * 0.2);
        ctx.fillStyle = '#141e33';
        ctx.fillRect(0, st - H * 0.02, W, H * 0.02);
        const par = camX * 0.25;
        for (let r = 0; r < 7; r++) {
          const y = st + 8 + r * (H * 0.026);
          ctx.fillStyle = 'rgba(255,255,255,.04)';
          ctx.fillRect(0, y + 6, W, 1);
          for (let i = 0; i < 40; i++) {
            const x = ((i * 37 + r * 13 - par) % (W + 40) + W + 40) % (W + 40) - 20;
            const hue = (i * 47 + r * 31) % 5;
            ctx.fillStyle = ['#e2e8f0', '#f97316', '#38bdf8', '#c6ff3d', '#fde68a'][hue];
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 3 + i + r);
            ctx.fillRect(x, y + Math.abs(Math.sin(t * 6 + i)) * (S.phase === 'after' && S.outcome === 'win' ? 3 : 0.6), 3, 3);
          }
          ctx.globalAlpha = 1;
        }
        const poleOff = -(camX * 0.25) % 180;
        for (let x = poleOff - 180; x < W + 180; x += 180) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x + 88, H * 0.12, 4, st - H * 0.12);
          ctx.fillStyle = 'rgba(255,255,220,.9)';
          roundRect(ctx, x + 74, H * 0.1, 32, 10, 3);
          ctx.fill();
          const g = ctx.createRadialGradient(x + 90, H * 0.11, 2, x + 90, H * 0.11, 70);
          g.addColorStop(0, 'rgba(255,255,220,.35)');
          g.addColorStop(1, 'rgba(255,255,220,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x + 20, H * 0.02, 140, 140);
        }
        // pist
        ctx.fillStyle = '#b4532a';
        ctx.fillRect(0, H * 0.5, W, H * 0.5);
        ctx.strokeStyle = 'rgba(255,255,255,.65)';
        ctx.lineWidth = 2;
        for (const ly of [0.56, 0.68, 0.8]) {
          ctx.beginPath();
          ctx.moveTo(0, H * ly);
          ctx.lineTo(W, H * ly);
          ctx.stroke();
        }
        // metre çizgileri
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        for (let m = 0; m <= distance; m += 10) {
          const x = m * ppm - camX;
          if (x < -20 || x > W + 20) continue;
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          ctx.fillRect(x - 1, H * 0.5, 2, H * 0.06);
          ctx.fillText(`${m}m`, x, H * 0.49);
        }
        // bitiş çizgisi
        const fx = distance * ppm - camX;
        if (fx > -30 && fx < W + 30) {
          for (let i = 0; i < 16; i++) {
            ctx.fillStyle = i % 2 ? '#111' : '#fff';
            ctx.fillRect(fx - 6, H * 0.5 + i * (H * 0.5 / 16), 6, H * 0.5 / 16);
            ctx.fillStyle = i % 2 ? '#fff' : '#111';
            ctx.fillRect(fx, H * 0.5 + i * (H * 0.5 / 16), 6, H * 0.5 / 16);
          }
        }
        // koşucular
        const gx = S.ghost * ppm - camX;
        drawRunner(ctx, gx, H * 0.62, H * 0.16, ['#94a3b8', '#e2e8f0'], S.time * 14, 0.45, 'HEDEF');
        drawRunner(ctx, W * 0.32, H * 0.74, H * 0.18, kit, S.ph, 1, opts.name || 'SEN', S.stumble > 0);
        // HUD (okunabilirlik için koyu zemin)
        const left = Math.max(0, distance - S.x);
        ctx.fillStyle = 'rgba(4,10,8,.6)';
        roundRect(ctx, 8, 68, Math.max(230, W * 0.46), endurance ? 96 : 76, 12);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.font = '900 22px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${S.time.toFixed(2)} sn`, 16, 96);
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.fillText(`Hedef ${target.toFixed(1)} sn  •  Kalan ${left.toFixed(0)} m`, 16, 116);
        // hız göstergesi
        roundRect(ctx, 16, 126, W * 0.4, 8, 4);
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        ctx.fill();
        roundRect(ctx, 16, 126, W * 0.4 * clamp(S.v / 10, 0, 1), 8, 4);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        if (endurance) {
          ctx.fillStyle = 'rgba(255,255,255,.8)';
          ctx.fillText('Nefes', 16, 152);
          roundRect(ctx, 60, 143, W * 0.4 - 44, 8, 4);
          ctx.fillStyle = 'rgba(0,0,0,.4)';
          ctx.fill();
          roundRect(ctx, 60, 143, (W * 0.4 - 44) * (S.stam / 100), 8, 4);
          ctx.fillStyle = S.stam < 15 ? (Math.sin(t * 20) > 0 ? '#ff5d6c' : '#7f1d1d') : '#facc15';
          ctx.fill();
        }
        if (S.phase === 'count') {
          const c = Math.max(1, 3 - Math.floor(S.t / 0.7));
          const k = (S.t % 0.7) / 0.7;
          ctx.save();
          ctx.translate(W / 2, H * 0.36);
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

    function drawRunner(ctx, x, y, h, colors, ph, alpha, label, stumble) {
      if (x < -60 || x > stage.W + 60) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      if (stumble) ctx.rotate(0.35);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.ellipse(0, 4, h * 0.28, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      const lw = h * 0.1;
      ctx.lineCap = 'round';
      const leg = (a, c) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.45);
        const kx = Math.sin(a) * h * 0.22;
        const ky = -h * 0.22;
        ctx.lineTo(kx, ky);
        ctx.lineTo(kx - Math.max(0, Math.sin(a + 0.8)) * h * 0.12 - h * 0.04, 0);
        ctx.stroke();
      };
      leg(ph, '#1f2937');
      leg(ph + Math.PI, '#111827');
      // gövde
      ctx.fillStyle = colors[0];
      roundRect(ctx, -h * 0.13, -h * 0.82, h * 0.26, h * 0.4, h * 0.08);
      ctx.fill();
      ctx.fillStyle = colors[1];
      ctx.fillRect(-h * 0.13, -h * 0.5, h * 0.26, h * 0.06);
      // kollar
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = lw * 0.8;
      for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.75);
        ctx.lineTo(Math.sin(ph * s) * h * 0.2, -h * 0.55);
        ctx.stroke();
      }
      // kafa
      ctx.fillStyle = '#d9a57b';
      ctx.beginPath();
      ctx.arc(h * 0.03, -h * 0.92, h * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `800 ${Math.max(10, h * 0.09)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 0, -h * 1.1);
      ctx.restore();
    }
  });
}
