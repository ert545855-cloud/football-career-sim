// SÜRAT / DAYANIKLILIK KOŞUSU — yandan görünüm, adım fiziği + ritim (mantık: sprintLogic.js).
//   SOL-SAĞ sırayla, RİTİMLE bas: ritim çubuğundaki yeşil bölgede basılan adım "MÜKEMMEL" (en çok hız).
//   Deli gibi basmak (spam) kısa, verimsiz adımlar; aynı ayak iki kez = tökezleme. "BAŞLA!" demeden basma: hatalı çıkış.
//   Dayanıklılıkta nefes çubuğunu izle: hızlı ritim nefesi tüketir, yavaş ritim toparlar; son düzlükte depar.
import { createStage, Particles, BigText, clamp, roundRect } from './engine.js';
import { drawSprite } from '../assets/sprites.js';
import { sfx, buzz } from '../audio.js';
import { sprintParams, createRun, runStep, runTick, targetTime, ghostTrace } from './sprintLogic.js';

const LABELS = {
  perfect: ['MÜKEMMEL', '#c6ff3d'],
  early: ['ERKEN', '#ffcf3d'],
  late: ['GEÇ', '#ffcf3d'],
  spam: ['ÇOK HIZLI', '#ff9e26'],
  stumble: ['TÖKEZLEDİN', '#ff5d6c'],
  false: ['HATALI ÇIKIŞ +0.3', '#ff5d6c'],
};

export function playSprint(host, opts) {
  return new Promise((resolve) => {
    const endurance = opts.mode === 'endurance';
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const P = sprintParams(skill, endurance ? 'endurance' : 'sprint');
    const target = targetTime(P);
    const ghostAt = ghostTrace(P);
    const distance = P.distance;
    const kit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const particles = new Particles();
    const big = new BigText();
    const R = createRun();
    // count: 3-2-1 → set (hazır, rastgele bekleme) → run → after
    const S = { phase: 'count', t: 0, count: 3, setAt: 2.1, goAt: 2.1 + 0.5 + Math.random() * 0.8, ph: 0, done: false, outcome: null, afterT: 0, pops: [], gassedShown: false, flash: 0 };
    if (opts.expose) Object.assign(opts.expose, { R, P, S, target });

    const btns = document.createElement('div');
    btns.className = 'sprint-btns';
    btns.innerHTML = '<button class="l" aria-label="Sol adım">SOL</button><button class="r" aria-label="Sağ adım">SAĞ</button>';
    host.appendChild(btns);
    const [bl, br] = btns.querySelectorAll('button');

    function pop(label) {
      const L = LABELS[label];
      if (!L) return;
      S.pops.push({ text: L[0], color: L[1], t: 0 });
      if (S.pops.length > 4) S.pops.shift();
    }

    function step(side) {
      if (S.phase === 'after') return;
      const btn = side === 'L' ? bl : br;
      btn.classList.add('hit');
      setTimeout(() => btn.classList.remove('hit'), 70);
      if (S.phase === 'count' || S.phase === 'set') {
        // BAŞLA'dan önce: hatalı çıkış (yalnızca bir kez cezalandırılır, sonra kilitli)
        if (!R.falseStarts) {
          runStep(R, P, side, 0);
          pop('false');
          S.flash = 0.4;
          sfx('error');
          buzz('falseStart');
        }
        return;
      }
      const r = runStep(R, P, side, R.t);
      if (!r) return;
      if (r.label === 'stumble') {
        sfx('error');
        buzz('error');
      } else {
        buzz(r.label === 'perfect' ? 'perfect' : 'stride');
        if (R.steps % 2 === 0) sfx('step');
      }
      if (r.label !== 'start') pop(r.label);
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
        big.show(R.time < target * 0.96 ? 'REKOR!' : 'GEÇTİN!', '#c6ff3d', 64);
        particles.burst(stage.W * 0.32, stage.H * 0.55, { n: 40, colors: ['#c6ff3d', '#ffcf3d', '#fff'], speed: 300, life: 1.2 });
        sfx('levelup');
        buzz('record');
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
      const time = R.time ?? R.t;
      const accuracy = success ? clamp(0.5 + (target - time) / (target * 0.08), 0, 1) : 0;
      setTimeout(() => {
        stage.stop();
        btns.remove();
        resolve({
          success,
          accuracy,
          outcome: S.outcome,
          time,
          target,
          react: R.react,
          topSpeed: R.topV * 3.6,
          rhythm: R.steps ? R.perfect / R.steps : 0,
          falseStart: R.falseStarts > 0,
          gassed: !!S.gassedShown,
        });
      }, 50);
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        S.t += dt;
        particles.update(dt);
        big.update(dt);
        for (const p of S.pops) p.t += dt;
        S.pops = S.pops.filter((p) => p.t < 0.7);
        S.flash = Math.max(0, S.flash - dt);
        if (S.phase === 'count') {
          const c = 3 - Math.floor(S.t / 0.7);
          if (c !== S.count) {
            S.count = c;
            if (c > 0) sfx('tick');
          }
          if (S.t >= S.setAt) S.phase = 'set';
          return;
        }
        if (S.phase === 'set') {
          if (S.t >= S.goAt) {
            S.phase = 'run';
            R.go = true;
            sfx('shortWhistle');
            buzz('kick');
          }
          return;
        }
        if (S.phase === 'run') {
          const fin = runTick(R, P, dt);
          S.ph += R.v * dt * 1.7;
          if (endurance && R.gassed && !S.gassedShown) {
            S.gassedShown = true;
            big.show('NEFESİN KESİLDİ!', '#ff5d6c', 38);
            buzz('heartBreak');
          }
          if (fin) end(R.time <= target);
          else if (R.t > target * 1.6) end(false);
        } else {
          S.afterT += dt;
          R.v *= 0.97;
          R.x += R.v * dt * 0.3;
          S.ph += R.v * dt * 1.7;
          if (S.afterT > 1.6) finish();
        }
      },

      render(ctx, W, H, t) {
        const ppm = W / 9; // metre başına piksel
        const camX = R.x * ppm - W * 0.32;
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
          // Piksel ışık direği (atlas); yoksa basit çizim
          if (!drawSprite(ctx, 'light_panel', x + 90, st + 2, { h: st - H * 0.15, anchor: 'bottom', alpha: 0.92 })) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x + 88, H * 0.12, 4, st - H * 0.12);
            ctx.fillStyle = 'rgba(255,255,220,.9)';
            roundRect(ctx, x + 74, H * 0.1, 32, 10, 3);
            ctx.fill();
          }
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
          drawSprite(ctx, 'cone', x + 10, H * 0.5 + 4, { h: 16, anchor: 'bottom' });
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
        const gx = ghostAt(Math.max(0, R.t)) * ppm - camX;
        drawRunner(ctx, gx, H * 0.62, H * 0.16, ['#94a3b8', '#e2e8f0'], R.t * 14, 0.45, 'HEDEF');
        drawRunner(ctx, W * 0.32, H * 0.74, H * 0.18, kit, S.ph, 1, opts.name || 'SEN', R.stumble > 0, R.v / P.vmax);
        // adım etiketleri
        S.pops.forEach((p, i) => {
          ctx.globalAlpha = clamp(1 - p.t / 0.7, 0, 1);
          ctx.font = `900 ${p.text.length > 9 ? 15 : 18}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(0,0,0,.6)';
          const y = H * 0.5 - p.t * 40 - i * 4;
          ctx.strokeText(p.text, W * 0.32, y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, W * 0.32, y);
          ctx.globalAlpha = 1;
        });
        // HUD
        const left = Math.max(0, distance - R.x);
        const hudW = Math.max(250, W * 0.5);
        ctx.fillStyle = 'rgba(4,10,8,.62)';
        roundRect(ctx, 8, 68, hudW, endurance ? 128 : 108, 12);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.font = '900 22px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${(R.time ?? R.t).toFixed(2)} sn`, 16, 96);
        ctx.font = '800 15px system-ui, sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'right';
        ctx.fillText(`${(R.v * 3.6).toFixed(1)} km/sa`, 8 + hudW - 10, 95);
        ctx.textAlign = 'left';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.fillText(`Hedef ${target.toFixed(2)} sn  •  Kalan ${left.toFixed(0)} m`, 16, 116);
        // ritim çubuğu: son adımdan bu yana geçen süre; yeşil = ideal pencere
        const bx = 16;
        const bw = hudW - 16;
        const by = 128;
        const span = 0.55;
        roundRect(ctx, bx, by, bw, 12, 6);
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fill();
        ctx.fillStyle = 'rgba(198,255,61,.55)';
        ctx.fillRect(bx + (P.win[0] / span) * bw, by, ((P.win[1] - P.win[0]) / span) * bw, 12);
        ctx.fillStyle = 'rgba(255,158,38,.4)';
        ctx.fillRect(bx, by, (0.085 / span) * bw, 12);
        if (S.phase === 'run' && R.lastT != null) {
          const e = clamp((R.t - R.lastT) / span, 0, 1);
          const inWin = R.t - R.lastT >= P.win[0] && R.t - R.lastT <= P.win[1];
          ctx.fillStyle = inWin ? '#fff' : 'rgba(255,255,255,.75)';
          ctx.fillRect(bx + e * bw - 2, by - 3, 4, 18);
        }
        ctx.font = '700 10.5px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillText('RİTİM', bx, by + 26);
        ctx.textAlign = 'right';
        ctx.fillText(`Mükemmel adım %${R.steps ? Math.round((R.perfect / R.steps) * 100) : 0}`, bx + bw, by + 26);
        ctx.textAlign = 'left';
        if (endurance) {
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          ctx.font = '700 12px system-ui, sans-serif';
          ctx.fillText('Nefes', 16, 172);
          const nw = hudW - 70;
          roundRect(ctx, 60, 163, nw, 10, 5);
          ctx.fillStyle = 'rgba(0,0,0,.4)';
          ctx.fill();
          roundRect(ctx, 60, 163, Math.max(4, nw * (R.stam / 100)), 10, 5);
          ctx.fillStyle = R.gassed ? (Math.sin(t * 20) > 0 ? '#ff5d6c' : '#7f1d1d') : R.stam < 35 ? '#ff9e26' : '#facc15';
          ctx.fill();
          // eşik: bu hızın üstü nefes tüketir
          const over = R.v / P.vmax > P.thresh;
          ctx.font = '700 10.5px system-ui, sans-serif';
          ctx.fillStyle = over ? '#ff9e26' : 'rgba(198,255,61,.9)';
          ctx.fillText(R.gassed ? 'Yavaşla, toparlan!' : over ? 'Tempo yüksek: nefes azalıyor' : 'Tempo iyi: nefes toplanıyor', 16, 190);
        }
        if (S.phase === 'count' || S.phase === 'set') {
          ctx.save();
          ctx.translate(W / 2, H * 0.36);
          if (S.phase === 'count') {
            const c = Math.max(1, 3 - Math.floor(S.t / 0.7));
            const k = (S.t % 0.7) / 0.7;
            ctx.scale(1.4 - k * 0.4, 1.4 - k * 0.4);
            ctx.globalAlpha = 1 - k * 0.6;
            ctx.font = '900 96px system-ui, sans-serif';
            ctx.fillStyle = '#c6ff3d';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(c), 0, 0);
          } else {
            ctx.font = '900 46px system-ui, sans-serif';
            ctx.fillStyle = '#ffcf3d';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('HAZIR…', 0, 0);
          }
          ctx.restore();
        } else if (S.phase === 'run' && R.t < 0.5) {
          ctx.font = '900 52px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(198,255,61,${1 - R.t / 0.5})`;
          ctx.fillText('BAŞLA!', W / 2, H * 0.36);
        }
        if (S.phase === 'after' && R.react != null) {
          ctx.font = '800 13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.fillText(`Tepki ${R.react.toFixed(2)} sn  •  Zirve ${(R.topV * 3.6).toFixed(1)} km/sa`, W / 2, H * 0.46);
        }
        if (S.flash > 0) {
          ctx.fillStyle = `rgba(255,93,108,${S.flash * 0.5})`;
          ctx.fillRect(0, 0, W, H);
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },
    });

    function drawRunner(ctx, x, y, h, colors, ph, alpha, label, stumble, lean = 0) {
      if (x < -60 || x > stage.W + 60) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      if (stumble) ctx.rotate(0.35);
      else if (lean) ctx.rotate(Math.min(0.22, lean * 0.2)); // hızlandıkça öne eğilir
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
