// MÜDAHALE — kuşbakışı. Parmağını sürükleyerek rakibi karşıla, top menzile girince dokun: kayarak müdahale.
import { createStage, Particles, BigText, drawBall, drawTopPlayer, drawPitchTop, clamp, lerp, dist } from './engine.js';
import { sfx, buzz } from '../audio.js';

export function playTackle(host, opts) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const threat = opts.context === 'threat';
    const myKit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const oppKit = opts.oppKit?.colors || ['#b91c1c', '#fff'];
    const particles = new Particles();
    const big = new BigText();
    let L = null;
    const S = { phase: 'play', t: 0, slide: null, down: 0, outcome: null, afterT: 0, feinted: false, touch: null, done: false, acc: 0, hint: 1 };

    function layout(W, H) {
      const k = W / 390;
      L = {
        W, H, k,
        att: { x: W * lerp(0.3, 0.7, Math.random()), y: H * 0.13, tx: W / 2, nextTurn: 0.5, ph: 0, vx: 0 },
        def: { x: W / 2, y: H * 0.7, tx: W / 2, ph: 0 },
        ball: { x: W / 2, y: H * 0.16, r: 7 * k, rot: 0, vx: 0, vy: 0 },
        vy: lerp(175, 125, skill) * (H / 700) * (threat ? 1.1 : 1),
        vxMax: lerp(240, 170, skill) * k,
        vdef: lerp(220, 380, skill) * k,
        reach: lerp(46, 84, skill) * k,
        feintP: lerp(0.6, 0.25, skill),
      };
    }

    function tackle() {
      if (S.slide || S.down > 0 || S.phase !== 'play') return;
      const d = L.def;
      const b = L.ball;
      const dx = b.x - d.x;
      const dy = b.y - d.y;
      const len = Math.hypot(dx, dy) || 1;
      S.slide = { t: 0, dur: 0.3, fx: d.x, fy: d.y, dx: dx / len, dy: dy / len, hit: false, startDist: len };
      sfx('swish');
      S.hint = 0;
    }

    function end(outcome) {
      if (S.phase !== 'play') return;
      S.outcome = outcome;
      S.phase = 'after';
      S.afterT = 0;
      if (outcome === 'won') {
        big.show('TOPU KAPTIN!', '#c6ff3d', 54);
        particles.burst(L.ball.x, L.ball.y, { n: 30, colors: ['#c6ff3d', '#fff', '#3a2a1a'], speed: 260, life: 0.9 });
        sfx('tackle');
        buzz([40, 20, 60]);
        stage.shake(10);
        L.ball.vx = (Math.random() - 0.5) * 500;
        L.ball.vy = -380;
      } else {
        big.show(outcome === 'early' ? 'ERKEN DALDIN!' : 'GEÇİLDİN!', '#ff5d6c', 48);
        sfx('miss');
        buzz(60);
      }
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      setTimeout(() => {
        stage.stop();
        resolve({ success: S.outcome === 'won', accuracy: S.outcome === 'won' ? S.acc : 0, outcome: S.outcome });
      }, 50);
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        if (!L || L.W !== stage.W || L.H !== stage.H) layout(stage.W, stage.H);
        S.t += dt;
        particles.update(dt);
        big.update(dt);
        const a = L.att;
        const d = L.def;
        const b = L.ball;
        a.ph += dt * 12;
        d.ph += dt * 8;

        if (S.phase === 'play' || (S.phase === 'after' && S.outcome !== 'won')) {
          // Hücumcu: aşağı koşar, zikzak ve çalım
          a.nextTurn -= dt;
          if (a.nextTurn <= 0) {
            a.tx = L.W * lerp(0.15, 0.85, Math.random());
            a.nextTurn = lerp(0.45, 0.9, Math.random());
          }
          const gap = d.y - a.y;
          if (!S.feinted && S.phase === 'play' && gap < 150 * L.k && gap > 40 * L.k && Math.random() < L.feintP * dt * 6) {
            S.feinted = true;
            a.tx = clamp(d.x + (a.x < d.x ? 1 : -1) * 95 * L.k, L.W * 0.1, L.W * 0.9);
          }
          const want = clamp((a.tx - a.x) * 4, -L.vxMax, L.vxMax);
          a.vx = lerp(a.vx, want, clamp(dt * 6, 0, 1));
          a.x = clamp(a.x + a.vx * dt, L.W * 0.08, L.W * 0.92);
          a.y += L.vy * dt * (S.phase === 'after' ? 1.3 : 1);
          // top ayağının önünde, sektirerek
          const lead = 16 * L.k + Math.abs(Math.sin(a.ph * 0.5)) * 7 * L.k;
          b.x = a.x + a.vx * 0.05;
          b.y = a.y + lead;
          b.rot += dt * 10;
        } else if (S.outcome === 'won') {
          b.vy += 900 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.rot += dt * 20;
          a.y += 30 * dt;
        }

        if (S.phase === 'play') {
          if (S.down > 0) S.down -= dt;
          else if (!S.slide) {
            const dd = d.tx - d.x;
            d.x += clamp(dd, -L.vdef * dt, L.vdef * dt);
          }
          if (S.slide) {
            const s = S.slide;
            s.t += dt;
            const p = clamp(s.t / s.dur, 0, 1);
            const e = 1 - Math.pow(1 - p, 2);
            d.x = s.fx + s.dx * L.reach * e;
            d.y = s.fy + s.dy * L.reach * e;
            const footX = d.x + s.dx * 10 * L.k;
            const footY = d.y + s.dy * 10 * L.k;
            if (dist(footX, footY, b.x, b.y) < b.r + 12 * L.k) {
              S.acc = clamp(1 - (s.startDist - L.reach * 0.5) / L.reach, 0.2, 1);
              d.y = s.fy;
              S.slide = null;
              end('won');
            } else if (p >= 1) {
              S.slide = null;
              S.down = 0.7;
              S.missed = s.startDist > L.reach * 1.25 ? 'early' : 'miss';
            }
          } else if (S.down <= 0) {
            d.y = lerp(d.y, L.H * 0.7, dt * 4);
          }
          if (a.y > d.y + 26 * L.k) end(S.missed === 'early' ? 'early' : 'beaten');
        } else {
          S.afterT += dt;
          if (S.afterT > 1.5) finish();
        }
      },

      render(ctx, W, H, t) {
        if (!L) return;
        drawPitchTop(ctx, W, H, { box: 'bottom' });
        const a = L.att;
        const d = L.def;
        const b = L.ball;
        // menzil halkası
        if (S.phase === 'play') {
          const inRange = dist(d.x, d.y, b.x, b.y) <= L.reach;
          ctx.beginPath();
          ctx.arc(d.x, d.y, L.reach, 0, Math.PI * 2);
          ctx.fillStyle = inRange ? 'rgba(198,255,61,.16)' : 'rgba(255,255,255,.05)';
          ctx.fill();
          ctx.lineWidth = inRange ? 3 : 1.5;
          ctx.strokeStyle = inRange ? 'rgba(198,255,61,.9)' : 'rgba(255,255,255,.35)';
          ctx.stroke();
        }
        // kaleci
        drawTopPlayer(ctx, W / 2, H * 0.95, 14 * L.k, { colors: ['#f59e0b', '#111'] }, { phase: t * 2, ring: '#e0f2fe' });
        const s = 18 * L.k;
        const slideRot = S.slide ? Math.atan2(S.slide.dx, -S.slide.dy) : S.down > 0 ? 1.4 : 0;
        drawTopPlayer(ctx, a.x, a.y, s, { colors: oppKit }, { facing: Math.PI + a.vx * 0.002, phase: a.ph, skin: '#9a6440', ring: '#ff5d6c' });
        drawTopPlayer(ctx, d.x, d.y, s * 1.08, { colors: myKit }, { number: opts.number ?? 4, facing: slideRot, phase: S.slide ? 0 : d.ph * (Math.abs(d.tx - d.x) > 4 ? 1 : 0.2), highlight: true, skin: opts.skin || '#d9a57b' });
        if (S.slide) {
          ctx.strokeStyle = 'rgba(255,255,255,.4)';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(S.slide.fx, S.slide.fy);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
        }
        drawBall(ctx, b.x, b.y, b.r, b.rot);
        if (threat && S.phase === 'play') {
          ctx.font = '900 13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255,93,108,${0.6 + 0.4 * Math.sin(t * 8)})`;
          ctx.fillText('KONTRA ATAK!', W / 2, 74);
        }
        if (S.phase === 'play' && S.hint > 0) {
          ctx.font = '800 14px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,.92)';
          ctx.fillText('Sürükle: karşıla  •  Dokun: kayarak müdahale', W / 2, H * 0.84);
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (!L || S.phase !== 'play') return;
        if (kind === 'down') {
          S.touch = { x: p.x, y: p.y, t: p.time, moved: 0 };
        } else if (kind === 'move' && S.touch) {
          S.touch.moved += Math.abs(p.x - S.touch.x);
          S.touch.x = p.x;
          L.def.tx = clamp(p.x, L.W * 0.08, L.W * 0.92);
        } else if (kind === 'up' && S.touch) {
          const quick = p.time - S.touch.t < 300 && S.touch.moved < 14;
          S.touch = null;
          if (quick) tackle();
        }
      },
    });
  });
}
