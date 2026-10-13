// PAS — kuşbakışı. Süre dolmadan pas yolu açık arkadaşına dokun; rakipler koridorları kapatır ve yer değiştirir.
import { createStage, Particles, BigText, drawBall, drawTopPlayer, drawPitchTop, drawTimer, clamp, lerp, dist } from './engine.js';
import { sfx, buzz } from '../audio.js';

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return { d: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t };
}

export function playPass(host, opts) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const final = opts.context === 'final';
    const T = lerp(2.0, 3.6, skill) * (final ? 0.9 : 1);
    const myKit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const oppKit = opts.oppKit?.colors || ['#b91c1c', '#fff'];
    const particles = new Particles();
    const big = new BigText();
    let L = null;
    const S = { phase: 'play', t: 0, ball: null, pass: null, outcome: null, afterT: 0, switchAt: 0, done: false, press: null };

    function lanePoint(mate, t, perp) {
      const dx = mate.x - L.me.x;
      const dy = mate.y - L.me.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: L.me.x + dx * t + (-dy / len) * perp, y: L.me.y + dy * t + (dx / len) * perp };
    }

    function assign(openIdx) {
      L.open = openIdx;
      let di = 0;
      L.mates.forEach((m, i) => {
        if (i === openIdx) return;
        const d = L.defs[di++];
        const p = lanePoint(m, lerp(0.55, 0.78, Math.random()), (Math.random() - 0.5) * 18 * L.k);
        d.tx = p.x;
        d.ty = p.y;
      });
      for (; di < L.defs.length; di++) {
        const d = L.defs[di];
        const side = Math.random() < 0.5 ? -1 : 1;
        const p = lanePoint(L.mates[openIdx], 0.62, side * lerp(58, 74, Math.random()) * L.k);
        d.tx = p.x;
        d.ty = p.y;
        d.closing = { mate: openIdx, side };
      }
    }

    function layout(W, H) {
      const k = W / 390;
      const me = { x: W / 2, y: H * 0.84 };
      const jitter = () => (Math.random() - 0.5) * W * 0.1;
      const mates = [
        { bx: W * 0.18 + jitter(), by: H * 0.47 + jitter(), ph: Math.random() * 6 },
        { bx: W * 0.5 + jitter(), by: H * 0.3 + jitter(), ph: Math.random() * 6 },
        { bx: W * 0.82 + jitter(), by: H * 0.45 + jitter(), ph: Math.random() * 6 },
      ].map((m) => ({ ...m, x: m.bx, y: m.by }));
      const nDef = final ? 3 : 2;
      const defs = Array.from({ length: nDef }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: H * 0.5, tx: 0, ty: 0, ph: Math.random() * 6 }));
      L = { W, H, k, me, mates, defs, ri: lerp(24, 15, skill) * k, vb: lerp(420, 820, skill) * (H / 700), vd: lerp(170, 110, skill) * k, open: 0 };
      assign(Math.floor(Math.random() * 3));
      defs.forEach((d) => { d.x = d.tx + (Math.random() - 0.5) * 40; d.y = d.ty - 30; });
      S.ball = { x: me.x, y: me.y - 14 * k, r: 7 * k, rot: 0 };
      S.switchAt = lerp(1.2, 1.9, Math.random());
    }

    function passTo(i) {
      const m = L.mates[i];
      const clearance = Math.min(...L.defs.map((d) => segDist(d.x, d.y, L.me.x, L.me.y, m.x, m.y).d));
      S.pass = { i, tx: m.x, ty: m.y - 8 * L.k, clearance, t0: S.t };
      S.phase = 'flight';
      sfx('kick');
      buzz('kick');
    }

    function end(outcome) {
      if (S.phase === 'after') return;
      S.outcome = outcome;
      S.phase = 'after';
      S.afterT = 0;
      if (outcome === 'success') {
        big.show('İSABETLİ PAS!', '#c6ff3d', 52);
        particles.burst(S.ball.x, S.ball.y, { n: 24, colors: ['#c6ff3d', '#fff'], speed: 220, life: 0.8 });
        sfx('levelup');
        buzz('pass');
      } else if (outcome === 'intercept') {
        big.show('ARAYA GİRDİ!', '#ff5d6c', 50);
        sfx('tackle');
        buzz('intercept');
        stage.shake(8);
      } else {
        big.show('TOP KAPTIRILDI', '#ff5d6c', 44);
        sfx('miss');
      }
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      const success = S.outcome === 'success';
      let accuracy = 0;
      if (success) {
        const c = clamp((S.pass.clearance - L.ri) / (L.ri * 3), 0, 1);
        const timeBonus = 1 - clamp(S.pass.t0 / T, 0, 1);
        accuracy = clamp(c * 0.7 + timeBonus * 0.3, 0, 1);
      }
      setTimeout(() => {
        stage.stop();
        resolve({ success, accuracy, outcome: S.outcome });
      }, 50);
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        if (!L || L.W !== stage.W || L.H !== stage.H) layout(stage.W, stage.H);
        S.t += dt;
        particles.update(dt);
        big.update(dt);
        // arkadaşlar hafif hareket eder
        for (const m of L.mates) {
          m.ph += dt;
          m.x = m.bx + Math.sin(m.ph * 1.3) * 10 * L.k;
          m.y = m.by + Math.cos(m.ph * 0.9) * 8 * L.k;
        }
        if (S.phase === 'play') {
          if (S.t > S.switchAt) {
            let next = Math.floor(Math.random() * 3);
            if (next === L.open) next = (next + 1) % 3;
            assign(next);
            S.switchAt = S.t + lerp(1.3, 2.2, Math.random());
          }
          // pres yapan rakip
          if (S.t > T * 0.55 && !S.press) S.press = { x: Math.random() < 0.5 ? -20 : L.W + 20, y: L.H * 0.66 };
          if (S.press) {
            const k = clamp((S.t - T * 0.55) / (T * 0.45), 0, 1);
            S.press.x = lerp(S.press.x, L.me.x + 14 * L.k, k * 0.08);
            S.press.y = lerp(S.press.y, L.me.y - 10 * L.k, k * 0.08);
          }
          if (S.t >= T) end('timeout');
        }
        const speed = 120 * L.k;
        for (const d of L.defs) {
          d.ph += dt * 6;
          let tx = d.tx;
          let ty = d.ty;
          if (d.closing && S.phase === 'play') {
            // açık arkadaşın koridoruna yavaşça yaklaşır (baskı)
            const p = lanePoint(L.mates[d.closing.mate], 0.62, d.closing.side * Math.max(8, 70 - S.t * lerp(26, 14, skill)) * L.k);
            tx = p.x;
            ty = p.y;
          }
          if (S.phase === 'flight' && S.pass) {
            // pas çizgisine atılır
            const sd = segDist(d.x, d.y, L.me.x, L.me.y, S.pass.tx, S.pass.ty);
            if (S.t - S.pass.t0 > 0.12) {
              const px = L.me.x + (S.pass.tx - L.me.x) * sd.t;
              const py = L.me.y + (S.pass.ty - L.me.y) * sd.t;
              const v = L.vd * dt;
              const dd = Math.hypot(px - d.x, py - d.y) || 1;
              d.x += ((px - d.x) / dd) * Math.min(v, dd);
              d.y += ((py - d.y) / dd) * Math.min(v, dd);
            }
            continue;
          }
          const dd = Math.hypot(tx - d.x, ty - d.y);
          if (dd > 1) {
            const v = Math.min(dd, speed * dt);
            d.x += ((tx - d.x) / dd) * v;
            d.y += ((ty - d.y) / dd) * v;
          }
        }
        if (S.phase === 'flight') {
          const b = S.ball;
          const dx = S.pass.tx - b.x;
          const dy = S.pass.ty - b.y;
          const dd = Math.hypot(dx, dy);
          const v = L.vb * dt;
          b.rot += dt * 18;
          if (dd <= v + 4) {
            b.x = S.pass.tx;
            b.y = S.pass.ty;
            end('success');
          } else {
            b.x += (dx / dd) * v;
            b.y += (dy / dd) * v;
            for (const d of L.defs) {
              if (dist(b.x, b.y, d.x, d.y) < L.ri) {
                b.x = d.x;
                b.y = d.y - 10 * L.k;
                end('intercept');
                break;
              }
            }
          }
        } else if (S.phase === 'after') {
          S.afterT += dt;
          if (S.outcome === 'timeout' && S.press) {
            S.ball.x = lerp(S.ball.x, S.press.x, 0.2);
            S.ball.y = lerp(S.ball.y, S.press.y - 12 * L.k, 0.2);
          }
          if (S.afterT > 1.5) finish();
        }
      },

      render(ctx, W, H, t) {
        if (!L) return;
        drawPitchTop(ctx, W, H, { box: final ? 'top' : 'none', circle: !final });
        // koridor çizgileri
        if (S.phase === 'play') {
          ctx.setLineDash([5, 9]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255,255,255,.22)';
          for (const m of L.mates) {
            ctx.beginPath();
            ctx.moveTo(L.me.x, L.me.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }
        if (S.pass && S.phase !== 'play') {
          ctx.strokeStyle = S.outcome === 'intercept' ? 'rgba(255,93,108,.6)' : 'rgba(198,255,61,.6)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(L.me.x, L.me.y);
          ctx.lineTo(S.ball.x, S.ball.y);
          ctx.stroke();
        }
        const s = 17 * L.k;
        for (const d of L.defs) {
          const face = Math.atan2(L.me.x - d.x, -(L.me.y - d.y)) + Math.PI;
          drawTopPlayer(ctx, d.x, d.y, s, { colors: oppKit }, { facing: face, phase: d.ph, skin: '#9a6440', ring: '#ff5d6c' });
        }
        if (S.press) drawTopPlayer(ctx, S.press.x, S.press.y, s, { colors: oppKit }, { facing: Math.PI, phase: t * 12, skin: '#c98e62', ring: '#ff5d6c' });
        L.mates.forEach((m, i) => {
          drawTopPlayer(ctx, m.x, m.y, s, { colors: myKit }, { number: [7, 10, 11][i], phase: m.ph * 3, skin: ['#e8b58f', '#c98e62', '#6b4329'][i], ring: '#e0f2fe' });
        });
        drawTopPlayer(ctx, L.me.x, L.me.y, s * 1.1, { colors: myKit }, { number: opts.number ?? 8, highlight: true, phase: t * 2, skin: opts.skin || '#d9a57b' });
        drawBall(ctx, S.ball.x, S.ball.y, S.ball.r, S.ball.rot);
        if (S.phase === 'play') {
          drawTimer(ctx, W, H - 16, S.t / T);
          ctx.font = '800 14px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.fillText('Pas yolu açık arkadaşına dokun', W / 2, H - 30);
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (kind !== 'down' || !L || S.phase !== 'play') return;
        let best = -1;
        let bestD = 60 * L.k;
        L.mates.forEach((m, i) => {
          const d = dist(p.x, p.y, m.x, m.y);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        if (best >= 0) passTo(best);
      },
    });
  });
}
