// ŞUT — oyuncunun arkasından kaleye bakış. Kaydır: yön + güç. Kaleci tepki verir.
import { createStage, Particles, BigText, drawBall, drawShadow, makeCrowd, drawCrowd, drawTimer, ease, clamp, lerp, gaussian, roundRect } from './engine.js';
import { sfx, buzz } from '../audio.js';

const persp = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 1.5);

/**
 * @param {HTMLElement} host
 * @param {{skill:number, context:'box'|'edge'|'penalty', keeper:number, myKit:object, oppKit:object, timeLimit?:number}} opts
 * @returns {Promise<{success:boolean, accuracy:number, outcome:string}>}
 */
export function playShot(host, opts) {
  return new Promise((resolve) => {
    const type = opts.context || 'box';
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const kq = clamp(opts.keeper ?? 0.5, 0, 1);
    const sigma = lerp(0.3, 0.05, skill) * (type === 'edge' ? 1.25 : type === 'penalty' ? 0.7 : 1);
    const timeLimit = opts.timeLimit ?? (type === 'penalty' ? 0 : 6);
    const myKit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const oppKit = opts.oppKit?.colors || ['#b91c1c', '#fff'];
    const keeperColor = opts.keeperColor || '#22d3ee';
    const ballOffset = type === 'penalty' ? 0 : (Math.random() - 0.5) * 0.3;
    const defOffset = (Math.random() - 0.5) * 0.7;
    const penaltySide = [-0.68, 0, 0.68][Math.floor(Math.random() * 3)];

    const particles = new Particles();
    const big = new BigText();
    let L = null;
    let crowd = null;
    const S = {
      phase: 'aim', t: 0, drag: null, shot: null, outcome: null, afterT: 0, excite: 0,
      k: { u: 0, from: 0, to: 0, angle: 0, lift: 0, idle: Math.random() * 6 },
      net: null, rot: 0, done: false, ball: null, hintA: 1,
    };

    function layout(W, H) {
      const hy = H * 0.19;
      const gl = H * 0.37;
      const gw = Math.min(W * 0.68, 340);
      const gh = gw * 0.34;
      const by = type === 'edge' ? H * 0.87 : type === 'penalty' ? H * 0.7 : H * 0.78;
      const r0 = W * (type === 'edge' ? 0.05 : type === 'penalty' ? 0.04 : 0.045);
      L = { W, H, hy, gl, gw, gh, cx: W / 2, by, bx: W / 2 + ballOffset * W, r0, r1: gw * 0.034, boxY: H * 0.83 };
      crowd = makeCrowd(W, 0, hy - 14, [myKit[0], myKit[1], oppKit[0], '#e2e8f0', '#94a3b8', '#fde68a']);
      S.ball = { x: L.bx, y: L.by, r: L.r0, alt: 0 };
      if (type === 'edge') {
        const fd = 0.42;
        const pp = persp(fd);
        L.def = {
          fd,
          x: lerp(L.bx, L.cx, pp) + defOffset * gw * 0.5,
          y: lerp(L.by, L.gl, pp),
          h: lerp(H * 0.22, gh * 1.05, pp),
          jump: 0,
        };
      }
    }

    const gx = (u) => L.cx + (u * L.gw) / 2;
    const gy = (v) => L.gl - v * L.gh;
    const backY = (y) => y - (y - L.hy) * 0.16;
    const backX = (x) => L.cx + (x - L.cx) * 0.9;

    // Büyük maç heyecanı: nişangah titrer. Salınım oyun zamanıyla (tempo) ilerler,
    // bu yüzden Soğukkanlı mentorla nişangah daha yavaş ve daha az sallanır.
    const nerves = clamp(opts.nerves ?? 0, 0, 1);
    const sway = () => (nerves > 0 ? { u: Math.sin(S.t * 2.6) * nerves * 0.34 + Math.sin(S.t * 6.1) * nerves * 0.06, v: Math.sin(S.t * 3.3 + 1.2) * nerves * 0.2 } : { u: 0, v: 0 });

    function aimFromDrag(d) {
      const dx = d.x - d.x0;
      const dy = d.y - d.y0;
      if (dy > -14) return null;
      const xg = L.bx + (dx * (L.by - L.gl)) / -dy;
      const sw = sway();
      const u = (xg - L.cx) / (L.gw / 2) + sw.u;
      const power = clamp(Math.hypot(dx, dy) / (L.H * 0.38), 0.05, 1.45);
      const v = clamp((power - 0.2) / 0.85 + sw.v, 0, 1.7);
      return { u, v, power };
    }

    function shoot(aim) {
      const u = aim.u + gaussian() * sigma;
      const v = Math.max(0, aim.v + gaussian() * sigma * 0.8);
      const T = lerp(1.0, 0.42, clamp(aim.power / 1.1, 0, 1));
      const absU = Math.abs(u);
      const ballU = L.r1 / (L.gw / 2);
      let outcome;

      // Ön savunmacı bloğu (ceza sahası dışı)
      let blocked = false;
      if (L.def) {
        const pp = persp(L.def.fd);
        const bxAt = lerp(L.bx, gx(u), pp);
        const altAt = v * L.gh * pp + Math.sin(Math.PI * L.def.fd) * L.gh * 0.25 * aim.power;
        const width = L.def.h * 0.42;
        if (Math.abs(bxAt - L.def.x) < width / 2 + L.r0 * 0.6 && altAt < L.def.h * 0.92) blocked = true;
      }

      const k = S.k;
      k.from = k.u;
      if (blocked) outcome = 'block';
      else if ((absU > 0.965 && absU < 1.05 && v <= 1.04) || (v > 0.96 && v < 1.07 && absU <= 1.0)) outcome = 'post';
      else if (v > 1.0 || absU > 1.0 + ballU * 0.4) outcome = v > 1.0 ? 'over' : 'wide';
      else {
        const rd = lerp(0.32, 0.18, kq) + skill * 0.06;
        const vk = lerp(1.7, 2.7, kq);
        let guess = u + gaussian() * lerp(0.35, 0.12, kq);
        const wrongP = lerp(0.32, 0.1, kq) * (type === 'penalty' ? 1.6 : 1);
        if (Math.random() < wrongP) guess = -guess * 0.7;
        let available = Math.max(0, T - rd);
        if (type === 'penalty') {
          guess = penaltySide;
          available = T;
        }
        const move = clamp(guess - k.u, -vk * available, vk * available);
        k.to = clamp(k.u + move, -1.05, 1.05);
        let reach = 0.3 + 0.12 * kq;
        if (v > 0.75 && absU > 0.55) reach *= 0.7;
        if (v < 0.25 && absU > 0.6) reach *= 0.85;
        outcome = Math.abs(u - k.to) <= reach ? 'save' : 'goal';
        k.reactAt = rd;
        k.diveV = v;
      }
      if (outcome !== 'save' && outcome !== 'goal') {
        // Kaleci yine de bir yöne hamle yapar (görsel)
        k.to = clamp(u * 0.8 + gaussian() * 0.2, -1, 1);
        k.reactAt = 0.25;
        k.diveV = Math.min(v, 0.9);
      }
      S.shot = { u, v, T, power: aim.power, t: 0, xg: gx(clamp(u, -1.6, 1.6)) };
      S.outcome = outcome;
      S.phase = 'flight';
      sfx('kick');
      buzz(15);
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      const o = S.outcome;
      const success = o === 'goal';
      const sh = S.shot;
      const accuracy = success ? clamp(0.35 + Math.abs(sh.u) * 0.5 + (sh.v > 0.6 ? 0.15 : 0), 0, 1) : 0;
      setTimeout(() => {
        stage.stop();
        resolve({ success, accuracy, outcome: o });
      }, 50);
    }

    function startAfter() {
      S.phase = 'after';
      S.afterT = 0;
      const b = S.ball;
      const o = S.outcome;
      if (o === 'goal') {
        S.net = { x: b.x, y: b.y, t: 0 };
        S.excite = 1;
        big.show('GOOOL!', '#c6ff3d', 76);
        particles.burst(b.x, b.y, { n: 40, colors: ['#c6ff3d', '#ffcf3d', '#fff', myKit[0]], speed: 380, gravity: 500, life: 1.4, size: 5 });
        stage.shake(14);
        sfx('goal');
        buzz([60, 40, 140]);
        S.after = { vx: (b.x - L.cx) * 0.1, vy: -20, shrink: 0.996 };
      } else if (o === 'save') {
        big.show('KURTARDI!', '#38bdf8', 60);
        sfx('save');
        buzz(40);
        const caught = S.shot.v < 0.55 && Math.abs(S.shot.u - S.k.to) < 0.12;
        S.after = caught ? { caught: true } : { vx: (b.x < gx(S.k.u) ? -1 : 1) * 260, vy: 160, grow: 1.01 };
        particles.burst(b.x, b.y, { n: 14, colors: ['#fff', keeperColor], speed: 200, life: 0.6 });
      } else if (o === 'post') {
        big.show('DİREK!', '#ffcf3d', 64);
        sfx('post');
        buzz([30, 30, 30]);
        stage.shake(8);
        S.after = { vx: (b.x < L.cx ? 1 : -1) * 120, vy: 300, grow: 1.012 };
      } else if (o === 'block') {
        big.show('BLOK!', '#ff5d6c', 60);
        sfx('tackle');
        S.after = { vx: (Math.random() - 0.5) * 400, vy: 260, grow: 1.01 };
        if (L.def) L.def.jump = 1;
      } else {
        big.show(o === 'over' ? 'ÜSTTEN!' : 'AUT!', '#ff5d6c', 60);
        sfx('miss');
        S.after = { vx: (S.shot.xg - L.bx) * 0.9, vy: -L.H * 0.35, shrink: 0.985 };
      }
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        if (!L || L.W !== stage.W || L.H !== stage.H) layout(stage.W, stage.H);
        S.t += dt;
        particles.update(dt);
        big.update(dt);
        S.excite *= 0.995;
        S.k.idle += dt;
        if (S.phase === 'aim') {
          S.k.u = Math.sin(S.k.idle * 1.3) * 0.1;
          if (timeLimit && S.t > timeLimit) {
            S.outcome = 'timeout';
            S.shot = { u: 0, v: 0, T: 0, power: 0, t: 0, xg: L.cx };
            big.show('KAPTIRDIN!', '#ff5d6c', 56);
            sfx('miss');
            S.phase = 'after';
            S.after = { vx: 340, vy: 80 };
          }
        } else if (S.phase === 'flight') {
          const sh = S.shot;
          sh.t += dt;
          const p = clamp(sh.t / sh.T, 0, 1);
          const pp = persp(p);
          const b = S.ball;
          b.x = lerp(L.bx, sh.xg, pp);
          b.gy = lerp(L.by, L.gl, pp);
          b.alt = sh.v * L.gh * pp + Math.sin(Math.PI * p) * L.gh * 0.25 * sh.power;
          b.y = b.gy - b.alt;
          b.r = lerp(L.r0, L.r1, pp);
          S.rot += dt * 14;
          // kaleci hareketi
          const k = S.k;
          if (sh.t > (k.reactAt ?? 0.25)) {
            const kp = clamp((sh.t - k.reactAt) / Math.max(0.12, sh.T - k.reactAt), 0, 1);
            const e = ease.outCubic(kp);
            k.u = lerp(k.from, k.to, e);
            const diveAmt = clamp((k.to - k.from) / 0.9, -1, 1);
            k.angle = diveAmt * 1.2 * e;
            k.lift = (k.diveV ?? 0) * L.gh * 0.55 * Math.sin(Math.PI * Math.min(1, kp * 0.9)) * Math.abs(diveAmt);
          }
          if (L.def && p > L.def.fd - 0.15 && p < L.def.fd + 0.1) L.def.jump = Math.max(L.def.jump, 0.6);
          if (S.outcome === 'block' && p >= L.def.fd) startAfter();
          else if (p >= 1) startAfter();
        } else if (S.phase === 'after') {
          S.afterT += dt;
          const b = S.ball;
          const a = S.after || {};
          if (a.caught) {
            b.x = gx(S.k.u) + Math.sin(S.k.angle) * L.gh * 0.6;
            b.y = L.gl - L.gh * 0.55 - S.k.lift;
          } else {
            b.x += (a.vx || 0) * dt;
            b.y += (a.vy || 0) * dt;
            if (a.vy !== undefined && S.outcome !== 'goal' && S.outcome !== 'over' && S.outcome !== 'wide') a.vy += 600 * dt;
            if (a.shrink) b.r *= Math.pow(a.shrink, dt * 60);
            if (a.grow) b.r *= Math.pow(a.grow, dt * 60);
            if (S.outcome === 'goal') {
              // ağlara gömülür
              const backBottom = backY(L.gl);
              b.y = Math.min(b.y, backBottom - b.r);
              a.vx *= 0.9;
            }
          }
          S.rot += dt * 6;
          if (L.def) L.def.jump *= 0.95;
          if (S.net) S.net.t += dt;
          if (S.afterT > 1.7) finish();
        }
        if (S.drag) S.hintA = Math.max(0, S.hintA - dt * 3);
      },

      render(ctx, W, H, t) {
        if (!L) return;
        // ── Tribün ──
        const sky = ctx.createLinearGradient(0, 0, 0, L.hy);
        sky.addColorStop(0, '#05080d');
        sky.addColorStop(1, '#16212c');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, L.hy);
        drawCrowd(ctx, crowd, t, S.excite);
        for (const fx of [W * 0.08, W * 0.92]) {
          const g = ctx.createRadialGradient(fx, 0, 2, fx, 0, W * 0.5);
          g.addColorStop(0, 'rgba(255,255,240,.35)');
          g.addColorStop(1, 'rgba(255,255,240,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, L.hy);
        }
        if (S.excite > 0.3) {
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = `rgba(255,255,255,${Math.random() * S.excite})`;
            ctx.fillRect(Math.random() * W, Math.random() * L.hy * 0.9, 2.5, 2.5);
          }
        }
        // reklam panoları
        ctx.fillStyle = '#0c1a12';
        ctx.fillRect(0, L.hy - 14, W, 14);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, L.hy - 14, W, 14);
        ctx.clip();
        ctx.font = '800 10px system-ui, sans-serif';
        ctx.fillStyle = '#c6ff3d';
        const msg = 'KRAMPON  •  FUTBOL KARİYERİ  •  ';
        const mw = ctx.measureText(msg).width;
        for (let x = -((t * 30) % mw); x < W; x += mw) ctx.fillText(msg, x, L.hy - 4);
        ctx.restore();

        // ── Çim (perspektif şeritler) ──
        const n = 12;
        for (let i = 0; i < n; i++) {
          const y0 = L.hy + (H - L.hy) * Math.pow(i / n, 1.8);
          const y1 = L.hy + (H - L.hy) * Math.pow((i + 1) / n, 1.8);
          ctx.fillStyle = i % 2 ? '#1d7a39' : '#22893f';
          ctx.fillRect(0, y0, W, y1 - y0 + 1);
        }
        const vig = ctx.createRadialGradient(W / 2, H * 0.6, 20, W / 2, H * 0.6, H * 0.8);
        vig.addColorStop(0, 'rgba(255,255,255,.04)');
        vig.addColorStop(1, 'rgba(0,0,0,.4)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, L.hy, W, H - L.hy);

        // ── Saha çizgileri ──
        ctx.strokeStyle = 'rgba(255,255,255,.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, L.gl); ctx.lineTo(W, L.gl);
        const bxw = L.gw * 1.25;
        ctx.moveTo(L.cx - bxw, L.gl); ctx.lineTo(L.cx - W * 0.78, L.boxY); ctx.lineTo(L.cx + W * 0.78, L.boxY); ctx.lineTo(L.cx + bxw, L.gl);
        const sy = L.gl + (L.boxY - L.gl) * 0.33;
        ctx.moveTo(L.cx - L.gw * 0.62, L.gl); ctx.lineTo(L.cx - L.gw * 0.74, sy); ctx.lineTo(L.cx + L.gw * 0.74, sy); ctx.lineTo(L.cx + L.gw * 0.62, L.gl);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(L.cx, L.boxY, W * 0.2, H * 0.03, 0, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.beginPath();
        ctx.ellipse(L.cx, H * 0.7 + 6, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        const ballBehind = S.outcome === 'goal' && S.phase === 'after';
        drawNet(ctx, t);
        if (ballBehind) drawBallAll(ctx);
        drawPosts(ctx);
        drawKeeper(ctx);
        if (L.def) drawDefender(ctx);
        if (!ballBehind) drawBallAll(ctx);

        // ── Nişan önizleme ──
        if (S.phase === 'aim' && S.drag) {
          const aim = aimFromDrag(S.drag);
          if (aim) {
            const tx = gx(clamp(aim.u, -1.8, 1.8));
            const ty = gy(Math.min(aim.v, 1.6));
            const ok = Math.abs(aim.u) < 1 && aim.v <= 1;
            ctx.setLineDash([6, 8]);
            ctx.strokeStyle = ok ? 'rgba(198,255,61,.85)' : 'rgba(255,93,108,.85)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(L.bx, L.by);
            ctx.quadraticCurveTo((L.bx + tx) / 2, Math.min(L.by, ty) - L.gh * 0.4 * aim.power, tx, ty);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(tx, ty, Math.max(6, (sigma * L.gw) / 2), 0, Math.PI * 2);
            ctx.fillStyle = ok ? 'rgba(198,255,61,.18)' : 'rgba(255,93,108,.18)';
            ctx.fill();
            ctx.stroke();
            if (nerves > 0) {
              // Titreyen nişangah (büyük maç heyecanı)
              const rr = Math.max(10, (sigma * L.gw) / 2) + 6;
              ctx.strokeStyle = 'rgba(255,207,61,.9)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(tx - rr - 6, ty); ctx.lineTo(tx - rr + 6, ty);
              ctx.moveTo(tx + rr - 6, ty); ctx.lineTo(tx + rr + 6, ty);
              ctx.moveTo(tx, ty - rr - 6); ctx.lineTo(tx, ty - rr + 6);
              ctx.moveTo(tx, ty + rr - 6); ctx.lineTo(tx, ty + rr + 6);
              ctx.stroke();
            }
            // güç çubuğu
            const ph = H * 0.28;
            const px = W - 26;
            const py = H * 0.55;
            ctx.fillStyle = 'rgba(0,0,0,.45)';
            roundRect(ctx, px, py, 12, ph, 6);
            ctx.fill();
            const pw = clamp(aim.power / 1.45, 0, 1);
            const grad = ctx.createLinearGradient(0, py + ph, 0, py);
            grad.addColorStop(0, '#c6ff3d');
            grad.addColorStop(0.7, '#ffcf3d');
            grad.addColorStop(1, '#ff5d6c');
            ctx.fillStyle = grad;
            roundRect(ctx, px, py + ph * (1 - pw), 12, ph * pw, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.7)';
            ctx.lineWidth = 2;
            const barMark = py + ph * (1 - 1.05 / 1.45);
            ctx.beginPath(); ctx.moveTo(px - 4, barMark); ctx.lineTo(px + 16, barMark); ctx.stroke();
          }
        }

        // ── İpucu & süre ──
        if (S.phase === 'aim') {
          if (S.hintA > 0.02) {
            ctx.globalAlpha = S.hintA * (0.6 + 0.4 * Math.sin(t * 5));
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            const hy0 = L.by - L.r0 * 2;
            const off = ((t * 60) % 60);
            ctx.beginPath();
            ctx.moveTo(L.bx, hy0 - off);
            ctx.lineTo(L.bx - 10, hy0 - off + 12);
            ctx.moveTo(L.bx, hy0 - off);
            ctx.lineTo(L.bx + 10, hy0 - off + 12);
            ctx.stroke();
            ctx.font = '800 15px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText('Kaleye doğru kaydır', L.cx, Math.min(H - 24, L.by + L.r0 * 2.6));
            ctx.globalAlpha = 1;
          }
          if (timeLimit) drawTimer(ctx, W, H - 14, S.t / timeLimit);
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (!L || S.phase !== 'aim') return;
        if (kind === 'down') {
          if (p.y < L.gl) return;
          S.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y };
        } else if (kind === 'move' && S.drag) {
          S.drag.x = p.x;
          S.drag.y = p.y;
        } else if (kind === 'up' && S.drag) {
          S.drag.x = p.x;
          S.drag.y = p.y;
          const aim = aimFromDrag(S.drag);
          S.drag = null;
          if (aim && aim.power > 0.12) shoot(aim);
          else {
            S.hintA = 1;
            sfx('error');
          }
        }
      },
    });

    // ── Çizim parçaları ──
    function drawBallAll(ctx) {
      const b = S.ball;
      if (!b) return;
      const shadowY = b.gy ?? L.by;
      if (S.phase !== 'after' || S.outcome === 'save' || S.outcome === 'post' || S.outcome === 'block') {
        drawShadow(ctx, b.x + (b.alt || 0) * 0.05, shadowY + b.r * 0.6, b.r * clamp(1.1 - (b.alt || 0) / (L.gh * 3), 0.3, 1.1), b.r * 0.35, 0.35);
      }
      drawBall(ctx, b.x, b.y, b.r, S.rot);
    }

    function drawPosts(ctx) {
      const x0 = gx(-1);
      const x1 = gx(1);
      const top = gy(1);
      const pw = Math.max(3, L.gw * 0.018);
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 6;
      ctx.fillRect(x0 - pw / 2, top - pw / 2, pw, L.gl - top + pw / 2);
      ctx.fillRect(x1 - pw / 2, top - pw / 2, pw, L.gl - top + pw / 2);
      ctx.fillRect(x0 - pw / 2, top - pw / 2, x1 - x0 + pw, pw);
      ctx.shadowBlur = 0;
    }

    function netOffset(x, y, t) {
      if (!S.net) return 0;
      const d = Math.hypot(x - S.net.x, y - S.net.y);
      const a = Math.max(0, 1 - d / (L.gw * 0.4));
      return a * a * 10 * Math.sin(S.net.t * 22) * Math.exp(-S.net.t * 2.5);
    }

    function drawNet(ctx, t) {
      const x0 = gx(-1);
      const x1 = gx(1);
      const top = gy(1);
      const bx0 = backX(x0);
      const bx1 = backX(x1);
      const btop = backY(top);
      const bbot = backY(L.gl);
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.beginPath();
      ctx.moveTo(x0, L.gl); ctx.lineTo(bx0, bbot); ctx.lineTo(bx0, btop); ctx.lineTo(bx1, btop); ctx.lineTo(bx1, bbot); ctx.lineTo(x1, L.gl); ctx.lineTo(x1, top); ctx.lineTo(x0, top);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.32)';
      ctx.lineWidth = 1;
      const cols = 16;
      for (let i = 0; i <= cols; i++) {
        const x = lerp(bx0, bx1, i / cols);
        ctx.beginPath();
        for (let j = 0; j <= 8; j++) {
          const y = lerp(btop, bbot, j / 8);
          const o = netOffset(x, y, t);
          if (j === 0) ctx.moveTo(x, y - o); else ctx.lineTo(x, y - o);
        }
        ctx.stroke();
      }
      const rows = 6;
      for (let j = 0; j <= rows; j++) {
        const y = lerp(btop, bbot, j / rows);
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const x = lerp(bx0, bx1, i / 16);
          const o = netOffset(x, y, t);
          if (i === 0) ctx.moveTo(x, y - o); else ctx.lineTo(x, y - o);
        }
        ctx.stroke();
      }
      // yan ve üst paneller
      for (let j = 0; j <= rows; j++) {
        const f = j / rows;
        ctx.beginPath();
        ctx.moveTo(x0, lerp(top, L.gl, f)); ctx.lineTo(bx0, lerp(btop, bbot, f));
        ctx.moveTo(x1, lerp(top, L.gl, f)); ctx.lineTo(bx1, lerp(btop, bbot, f));
        ctx.stroke();
      }
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        ctx.moveTo(lerp(x0, x1, i / cols), top);
        ctx.lineTo(lerp(bx0, bx1, i / cols), btop);
        ctx.stroke();
      }
    }

    function drawKeeper(ctx) {
      const k = S.k;
      const kh = L.gh * 0.9;
      const x = gx(k.u);
      ctx.save();
      drawShadow(ctx, x, L.gl + 3, kh * 0.3, kh * 0.06, 0.4);
      ctx.translate(x, L.gl - k.lift);
      ctx.rotate(k.angle);
      const w = kh * 0.34;
      // bacaklar
      ctx.fillStyle = '#111827';
      ctx.fillRect(-w * 0.42, -kh * 0.42, w * 0.32, kh * 0.42);
      ctx.fillRect(w * 0.1, -kh * 0.42, w * 0.32, kh * 0.42);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-w * 0.5, -kh * 0.52, w, kh * 0.14);
      // gövde
      ctx.fillStyle = keeperColor;
      roundRect(ctx, -w / 2, -kh * 0.84, w, kh * 0.36, w * 0.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(-w / 2, -kh * 0.62, w, kh * 0.05);
      // kollar (hazır pozisyonu: yukarı/yana açık)
      const armUp = S.phase === 'aim' ? 0.55 + Math.sin(k.idle * 4) * 0.05 : 1.2;
      ctx.strokeStyle = keeperColor;
      ctx.lineCap = 'round';
      ctx.lineWidth = w * 0.24;
      ctx.beginPath();
      ctx.moveTo(-w * 0.45, -kh * 0.78);
      ctx.lineTo(-w * 0.45 - Math.cos(armUp) * kh * 0.3, -kh * 0.78 - Math.sin(armUp) * kh * 0.3);
      ctx.moveTo(w * 0.45, -kh * 0.78);
      ctx.lineTo(w * 0.45 + Math.cos(armUp) * kh * 0.3, -kh * 0.78 - Math.sin(armUp) * kh * 0.3);
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sgn * (w * 0.45 + Math.cos(armUp) * kh * 0.3), -kh * 0.78 - Math.sin(armUp) * kh * 0.3, w * 0.17, 0, Math.PI * 2);
        ctx.fill();
      }
      // kafa
      ctx.fillStyle = '#c98e62';
      ctx.beginPath();
      ctx.arc(0, -kh * 0.93, w * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f1309';
      ctx.beginPath();
      ctx.arc(0, -kh * 0.96, w * 0.26, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawDefender(ctx) {
      const d = L.def;
      const h = d.h;
      const w = h * 0.36;
      const lift = Math.sin(Math.min(1, d.jump) * Math.PI * 0.5) * h * 0.25 * d.jump;
      drawShadow(ctx, d.x, d.y + 2, w * 0.7, w * 0.16, 0.35);
      ctx.save();
      ctx.translate(d.x, d.y - lift);
      ctx.fillStyle = '#0b0f0d';
      ctx.fillRect(-w * 0.38, -h * 0.4, w * 0.3, h * 0.4);
      ctx.fillRect(w * 0.08, -h * 0.4, w * 0.3, h * 0.4);
      ctx.fillStyle = oppKit[1];
      ctx.fillRect(-w * 0.48, -h * 0.52, w * 0.96, h * 0.15);
      ctx.fillStyle = oppKit[0];
      roundRect(ctx, -w / 2, -h * 0.86, w, h * 0.38, w * 0.2);
      ctx.fill();
      ctx.fillStyle = oppKit[1];
      ctx.font = `900 ${w * 0.45}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('4', 0, -h * 0.6);
      ctx.strokeStyle = oppKit[0];
      ctx.lineWidth = w * 0.2;
      ctx.lineCap = 'round';
      const arm = 0.25 + d.jump * 0.9;
      ctx.beginPath();
      ctx.moveTo(-w * 0.42, -h * 0.8); ctx.lineTo(-w * 0.42 - Math.cos(arm) * h * 0.2, -h * 0.8 + Math.sin(-arm) * h * 0.2);
      ctx.moveTo(w * 0.42, -h * 0.8); ctx.lineTo(w * 0.42 + Math.cos(arm) * h * 0.2, -h * 0.8 + Math.sin(-arm) * h * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#9a6440';
      ctx.beginPath();
      ctx.arc(0, -h * 0.94, w * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f1309';
      ctx.beginPath();
      ctx.arc(0, -h * 0.95, w * 0.25, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      ctx.restore();
    }
  });
}
