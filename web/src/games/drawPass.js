// PAS (ÇİZEREK) — Score! Hero / New Star Soccer tarzı. Unity'deki PasManager'ın tarayıcı (2B, kuşbakışı) karşılığı.
//
//  1) AĞIR ÇEKİM: Topa dokunup sürüklemeye başlayınca zaman yumuşakça yavaşlar (pas statı yüksekse daha çok).
//  2) ÇİZİM + KAVİS: Parmağın izlediği hattan kübik Bezier uydurulur (CurvePath) ve canlı gösterilir.
//     Çizgi rengi: yeşil = temiz, turuncu = rakip yolda, beyaz = ucunda arkadaş yok.
//  3) BASKI: Çizim başladığı an en yakın iki rakip koşar: biri sana, biri pasın düşeceği yere. Ağır çekimde
//     yavaşlar ama durmazlar; oyalanırsan top kapılır. Hiç çizmeden beklersen de baskı başlar.
//  4) SONUÇ: Parmak kalkınca zaman normale döner, top çizilen kavisle (falsolu) gider. Arkadaşa ulaşırsa
//     isabetli; rakibe çarparsa/araya girerse ya da dışarı çıkarsa başarısız. Uzun paslar havadan gider:
//     top yüksekteyken rakip araya giremez.
// Statlar: etkin yetenek (pas statı × yorgunluk) ağır çekimi, falso ustalığını, isabeti ve pas hızını belirler.
import { createStage, Particles, BigText, drawBall, drawTopPlayer, drawPitchTop, drawShadow, drawTimer, roundRect, clamp, lerp, dist } from './engine.js';
import { CurvePath } from './curvePath.js';
import { passSkill, interceptPoint } from './drawPassLogic.js';
import { sfx, buzz } from '../audio.js';

export function playDrawPass(host, opts) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const sk = passSkill(skill);
    const nerves = clamp(opts.nerves ?? 0, 0, 1);
    const final = opts.context === 'final';
    const myKit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const oppKit = opts.oppKit?.colors || ['#b91c1c', '#fff'];
    const particles = new Particles();
    const big = new BigText();
    const path = new CurvePath();
    const preview = [];
    const IDLE_PRESS = 4.5; // hiç çizmeden bu kadar beklenirse baskı başlar (oyun saniyesi)

    let L = null;
    const S = {
      phase: 'idle', // idle → draw (→ aim) → flight → roll → after
      t: 0,
      ts: 1,
      tsTarget: 1,
      pts: [],
      tailOk: false,
      pressure: false,
      pressStartD: 1,
      pressLevel: 0,
      target: -1,
      contested: false,
      ball: null,
      s: 0,
      speed: 0,
      roll: null,
      outcome: null,
      afterT: 0,
      hint: 0,
      done: false,
      clearance: 0,
    };

    // ─────────────── Diziliş ───────────────
    function layout(W, H) {
      const k = W / 390;
      const me = { x: W / 2, y: H * 0.84 };
      const j = () => (Math.random() - 0.5) * W * 0.08;
      const spots = final
        ? [[0.2, 0.32], [0.5, 0.17], [0.8, 0.3]]
        : [[0.18, 0.5], [0.5, 0.3], [0.82, 0.47]];
      const mates = spots.map(([fx, fy], i) => {
        const x = W * fx + j();
        const y = H * fy + j();
        return { x, y, hx: x, hy: y, ph: Math.random() * 6, num: [7, 10, 11][i], skin: ['#e8b58f', '#c98e62', '#6b4329'][i], run: null };
      });
      // Koridorlar: biri tam kapalı (kavis şart), biri çekişmeli, biri açık; final bölgesinde bir de markaj
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      const lane = (m, t, perp) => {
        const dx = m.x - me.x;
        const dy = m.y - me.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: me.x + dx * t + (-dy / len) * perp, y: me.y + dy * t + (dx / len) * perp };
      };
      const sign = () => (Math.random() < 0.5 ? -1 : 1);
      const defs = [
        lane(mates[order[0]], lerp(0.5, 0.6, Math.random()), sign() * Math.random() * 6 * k),
        lane(mates[order[1]], lerp(0.55, 0.68, Math.random()), sign() * lerp(24, 34, Math.random()) * k),
        lane(mates[order[2]], lerp(0.4, 0.5, Math.random()), sign() * lerp(70, 92, Math.random()) * k),
      ];
      if (final) defs.push({ x: mates[1].x + sign() * 22 * k, y: mates[1].y + 30 * k }); // 10 numarayı markaj
      L = {
        W, H, k, me, mates,
        defs: defs.map((p) => ({ x: p.x, y: p.y, hx: p.x, hy: p.y, ph: Math.random() * 6, mode: 'hold', tx: p.x, ty: p.y })),
        rBall: 7 * k,
        startR: 70 * k, // çizim topa bu kadar yakın başlamalı
        spacing: 6 * k,
        minLen: 40 * k,
        receiveR: 26 * k,
        interceptR: 17 * k,
        stealR: 22 * k * sk.steal,
        targetR: 42 * k,
        contestR: 24 * k,
        vPress: 150 * k,
        vInt: 175 * k,
        vRun: 120 * k,
        reachH: 0.55,
      };
      S.ball = { x: me.x, y: me.y - 14 * k, h: 0, rot: 0, spin: 0 };
      if (opts.expose) Object.assign(opts.expose, { L, S, path }); // uçtan uca testler için
    }

    // ─────────────── Çizim ───────────────
    function addPoint(p) {
      const pts = S.pts;
      if (pts.length === 1) {
        pts.push({ x: p.x, y: p.y });
        return;
      }
      const last = pts.length - 1;
      pts[last] = { x: p.x, y: p.y }; // canlı uç
      if (Math.hypot(pts[last - 1].x - p.x, pts[last - 1].y - p.y) >= L.spacing) {
        pts.push({ x: p.x, y: p.y });
        if (pts.length > 160) {
          // her iki noktadan birini at (yol yalnızca 4 noktayı kullanır)
          const keep = [pts[0]];
          for (let i = 2; i < pts.length - 1; i += 2) keep.push(pts[i]);
          keep.push(pts[pts.length - 1]);
          S.pts = keep;
          L.spacing *= 2;
        }
      }
    }

    function rebuild() {
      if (S.pts.length < 2) return;
      S.pts[0] = { x: S.ball.x, y: S.ball.y };
      path.build(S.pts, { loftPerPx: 1 / (600 * L.k), maxLoft: 1 });
      path.scaleCurve(sk.curveFidelity);
      // hedef arkadaş
      let best = -1;
      let bestD = L.targetR;
      L.mates.forEach((m, i) => {
        const d = dist(m.x, m.y, path.p3.x, path.p3.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      S.target = best;
      // yolda rakip var mı (top alçakken)
      S.contested = false;
      S.clearance = Infinity;
      for (const d of L.defs) {
        const c = path.closest(d.x, d.y);
        if (c.along < 20 * L.k) continue;
        S.clearance = Math.min(S.clearance, c.d);
        if (c.d < L.contestR) S.contested = true;
      }
      path.sample(40, preview);
    }

    function startDraw(p) {
      S.phase = 'draw';
      S.pts = [{ x: S.ball.x, y: S.ball.y }];
      L.spacing = 6 * L.k;
      addPoint(p);
      rebuild();
      S.tsTarget = sk.slow;
      if (!S.pressure) startPressure();
      buzz(8);
      sfx('tick');
    }

    // ─────────────── Baskı ───────────────
    function landingGuess() {
      if (S.pts.length >= 2 && path.valid) return path.p3;
      return { x: L.me.x, y: L.me.y - 200 * L.k };
    }

    function startPressure() {
      S.pressure = true;
      const sorted = [...L.defs].sort((a, b) => dist(a.x, a.y, L.me.x, L.me.y) - dist(b.x, b.y, L.me.x, L.me.y));
      if (sorted[0]) sorted[0].mode = 'press';
      if (sorted[1]) sorted[1].mode = 'landing';
      S.pressStartD = Math.max(L.stealR + 10, dist(sorted[0].x, sorted[0].y, L.me.x, L.me.y));
    }

    // ─────────────── Pas ───────────────
    function release() {
      if (!path.valid || Math.hypot(path.p3.x - path.p0.x, path.p3.y - path.p0.y) < L.minLen) {
        // çok kısa: pas sayılmaz, ağır çekimde yeniden çiz (baskı sürer)
        S.phase = 'aim';
        S.pts = [];
        S.target = -1;
        return;
      }
      launch();
    }

    function launch() {
      S.ts = 1;
      S.tsTarget = 1;
      // isabet sapması (statlar + heyecan): üçgen dağılım, mesafeyle orantılı
      const len = Math.hypot(path.p3.x - path.p0.x, path.p3.y - path.p0.y);
      const err = (sk.error + nerves * 18) * L.k * clamp(len / (300 * L.k), 0.3, 1.5);
      if (err > 0.01) {
        const nx = -(path.p3.y - path.p0.y) / len;
        const ny = (path.p3.x - path.p0.x) / len;
        const e = (Math.random() - Math.random()) * err;
        path.shiftEnd(nx * e, ny * e);
      }
      S.speed = clamp(420 + (1.1 * path.length) / L.k, 420, 820) * L.k * sk.speed;
      S.s = 0;
      S.ball.spin = clamp(-path.curve, -1, 1) * 22; // falso: dönüş hızı
      S.phase = 'flight';
      // rakipler araya girmeye koşar
      for (const d of L.defs) {
        d.mode = 'intercept';
        const p = interceptPoint(path, S.speed, d, { defSpeed: L.vInt, reach: L.interceptR, reaction: 0.15, reachH: L.reachH });
        d.tx = p.x;
        d.ty = p.y;
      }
      // hedef arkadaş (yoksa inişe en yakın olan) topu karşılamaya koşar
      let runner = S.target;
      if (runner < 0) {
        let bd = 90 * L.k;
        L.mates.forEach((m, i) => {
          const d = dist(m.x, m.y, path.p3.x, path.p3.y);
          if (d < bd) { bd = d; runner = i; }
        });
      }
      if (runner >= 0) {
        const m = L.mates[runner];
        const dx = path.p3.x - m.x;
        const dy = path.p3.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        const go = Math.min(d, 60 * L.k);
        m.run = { x: m.x + (dx / d) * go, y: m.y + (dy / d) * go };
      }
      sfx('kick');
      buzz(18);
    }

    // ─────────────── Sonuç ───────────────
    function end(outcome) {
      if (S.phase === 'after') return;
      S.outcome = outcome;
      S.phase = 'after';
      S.afterT = 0;
      S.ts = 1;
      S.tsTarget = 1;
      const curved = Math.abs(path.curve) >= 0.25;
      if (outcome === 'success') {
        big.show(curved ? 'FALSOLU PAS!' : 'İSABETLİ PAS!', '#c6ff3d', 50);
        particles.burst(S.ball.x, S.ball.y, { n: curved ? 34 : 24, colors: ['#c6ff3d', '#fff'], speed: 220, life: 0.8 });
        sfx('levelup');
        buzz(curved ? [14, 40, 14, 40, 30] : [12, 40, 16]);
      } else if (outcome === 'intercept') {
        big.show('ARAYA GİRDİ!', '#ff5d6c', 50);
        sfx('tackle');
        buzz([40, 30, 40]);
        stage.shake(8);
      } else if (outcome === 'stolen') {
        big.show('TOP KAPTIRILDI', '#ff5d6c', 44);
        sfx('tackle');
        buzz([60, 40, 60]);
        stage.shake(6);
      } else if (outcome === 'out') {
        big.show('TOP DIŞARIDA', '#ff5d6c', 46);
        sfx('miss');
        buzz([50, 40, 50]);
      } else {
        big.show('BOŞA GİTTİ', '#ff5d6c', 46);
        sfx('miss');
        buzz([50, 40, 50]);
      }
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      const success = S.outcome === 'success';
      let accuracy = 0;
      if (success) {
        const c = Number.isFinite(S.clearance) ? clamp(S.clearance / (50 * L.k), 0, 1) : 1;
        accuracy = clamp(0.45 + 0.3 * c + 0.25 * Math.min(1, Math.abs(path.curve) * 1.5), 0, 1);
      }
      setTimeout(() => {
        stage.stop();
        resolve({ success, accuracy, outcome: S.outcome, curve: path.valid ? path.curve : 0 });
      }, 50);
    }

    // ─────────────── Döngü ───────────────
    function moveTo(o, tx, ty, v) {
      const dx = tx - o.x;
      const dy = ty - o.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.5) return;
      const step = Math.min(d, v);
      o.x += (dx / d) * step;
      o.y += (dy / d) * step;
    }

    function contacts() {
      const b = S.ball;
      if (b.h > L.reachH) return false;
      for (const d of L.defs) {
        if (dist(b.x, b.y, d.x, d.y) < L.interceptR) {
          b.x = d.x;
          b.y = d.y - 10 * L.k;
          end('intercept');
          return true;
        }
      }
      for (let i = 0; i < L.mates.length; i++) {
        const m = L.mates[i];
        if (dist(b.x, b.y, m.x, m.y) < L.receiveR) {
          S.received = i;
          b.x = m.x;
          b.y = m.y - 12 * L.k;
          b.h = 0;
          end('success');
          return true;
        }
      }
      return false;
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        if (!L || L.W !== stage.W || L.H !== stage.H) layout(stage.W, stage.H);
        // zaman ölçeği: girişte yumuşak, çıkışta anında
        S.ts += (S.tsTarget - S.ts) * (1 - Math.exp(-12 * dt));
        if (Math.abs(S.ts - S.tsTarget) < 0.004) S.ts = S.tsTarget;
        const g = dt * S.ts; // oyun zamanı
        S.t += g;
        S.hint = Math.max(0, S.hint - dt);
        particles.update(dt);
        big.update(dt);

        for (const m of L.mates) {
          m.ph += g;
          if (m.run) moveTo(m, m.run.x, m.run.y, L.vRun * g);
          else {
            m.x = m.hx + Math.sin(m.ph * 1.3) * 8 * L.k;
            m.y = m.hy + Math.cos(m.ph * 0.9) * 6 * L.k;
          }
        }
        for (const d of L.defs) {
          d.ph += g * 6;
          if (d.mode === 'press') moveTo(d, L.me.x, L.me.y - 6 * L.k, L.vPress * g);
          else if (d.mode === 'landing') {
            const p = landingGuess();
            moveTo(d, p.x, p.y, L.vPress * 0.9 * g);
          } else if (d.mode === 'intercept') moveTo(d, d.tx, d.ty, L.vInt * g);
          else {
            d.x = d.hx + Math.sin(d.ph * 0.25) * 5 * L.k;
            d.y = d.hy + Math.cos(d.ph * 0.2) * 4 * L.k;
          }
        }

        const b = S.ball;
        if (S.phase === 'idle' || S.phase === 'draw' || S.phase === 'aim') {
          b.x = L.me.x;
          b.y = L.me.y - 14 * L.k;
          if (S.phase === 'idle' && S.t > IDLE_PRESS && !S.pressure) startPressure();
          if (S.phase === 'draw') rebuild();
          if (S.pressure) {
            let near = Infinity;
            for (const d of L.defs) near = Math.min(near, dist(d.x, d.y, L.me.x, L.me.y));
            S.pressLevel = clamp(1 - (near - L.stealR) / Math.max(1, S.pressStartD - L.stealR), 0, 1);
            if (near < L.stealR) {
              const thief = L.defs.reduce((a, d) => (dist(d.x, d.y, L.me.x, L.me.y) < dist(a.x, a.y, L.me.x, L.me.y) ? d : a));
              b.x = thief.x;
              b.y = thief.y - 10 * L.k;
              end('stolen');
            }
          }
        } else if (S.phase === 'flight') {
          S.s = Math.min(path.length, S.s + S.speed * g);
          const p = path.at(S.s);
          b.x = p.x;
          b.y = p.y;
          b.h = p.h;
          b.rot += (S.speed / L.rBall) * g * 0.02 + b.spin * g;
          if (contacts()) return;
          if (b.x < -4 || b.x > L.W + 4 || b.y < -4 || b.y > L.H + 4) {
            end('out');
            return;
          }
          if (S.s >= path.length - 0.5) {
            const tg = path.tangentAt(path.length);
            S.roll = { vx: tg.x * S.speed * 0.45, vy: tg.y * S.speed * 0.45, t: 0 };
            b.h = 0;
            S.phase = 'roll';
          }
        } else if (S.phase === 'roll') {
          const r = S.roll;
          r.t += g;
          const v = Math.hypot(r.vx, r.vy);
          const nv = Math.max(0, v - 520 * L.k * g);
          if (v > 1e-3) {
            r.vx *= nv / v;
            r.vy *= nv / v;
          }
          b.x += r.vx * g;
          b.y += r.vy * g;
          b.rot += (nv / L.rBall) * g * 0.02;
          if (contacts()) return;
          if (b.x < -4 || b.x > L.W + 4 || b.y < -4 || b.y > L.H + 4) end('out');
          else if (nv < 20 * L.k || r.t > 1.2) end('missed');
        } else if (S.phase === 'after') {
          S.afterT += dt;
          if (S.afterT > 1.5) finish();
        }
      },

      render(ctx, W, H, t) {
        if (!L) return;
        drawPitchTop(ctx, W, H, { box: final ? 'top' : 'none', circle: !final });
        const k = L.k;

        // ham çizim (soluk) + Bezier önizleme
        if ((S.phase === 'draw' || S.phase === 'flight' || S.phase === 'roll') && S.pts.length > 1) {
          if (S.phase === 'draw') {
            ctx.strokeStyle = 'rgba(255,255,255,.18)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 6]);
            ctx.beginPath();
            S.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            ctx.stroke();
            ctx.setLineDash([]);
          }
          const col = S.target < 0 ? '255,255,255' : S.contested ? '255,158,38' : '108,255,120';
          const alpha = S.phase === 'draw' ? 0.95 : 0.35;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = `rgba(${col},${alpha * 0.35})`;
          ctx.lineWidth = 11 * k;
          ctx.beginPath();
          preview.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
          ctx.strokeStyle = `rgba(${col},${alpha})`;
          ctx.lineWidth = 4 * k;
          ctx.stroke();
          // uçta ok
          if (S.phase === 'draw' && path.valid) {
            const e = path.p3;
            const tg = path.tangentAt(path.length);
            const a = 9 * k;
            ctx.fillStyle = `rgba(${col},.95)`;
            ctx.beginPath();
            ctx.moveTo(e.x + tg.x * a, e.y + tg.y * a);
            ctx.lineTo(e.x - tg.x * a * 0.6 - tg.y * a * 0.8, e.y - tg.y * a * 0.6 + tg.x * a * 0.8);
            ctx.lineTo(e.x - tg.x * a * 0.6 + tg.y * a * 0.8, e.y - tg.y * a * 0.6 - tg.x * a * 0.8);
            ctx.closePath();
            ctx.fill();
          }
        }

        const s = 17 * k;
        const drawDefs = () => {
          for (const d of L.defs) {
            const face = Math.atan2(L.me.x - d.x, -(L.me.y - d.y)) + Math.PI;
            const pressing = d.mode === 'press' || d.mode === 'landing';
            drawTopPlayer(ctx, d.x, d.y, s, { colors: oppKit }, { facing: face, phase: d.ph, skin: '#9a6440', ring: pressing ? '#ff9e26' : '#ff5d6c' });
          }
        };
        // Top kapıldıysa rakip, pasörün ÜSTÜNDE çizilir (kapan oyuncu görünsün)
        const stolen = S.outcome === 'stolen';
        if (!stolen) drawDefs();
        L.mates.forEach((m, i) => {
          const targeted = i === S.target && (S.phase === 'draw' || S.phase === 'flight');
          if (targeted) {
            ctx.strokeStyle = `rgba(255,230,80,${0.6 + 0.3 * Math.sin(t * 9)})`;
            ctx.lineWidth = 3 * k;
            ctx.beginPath();
            ctx.ellipse(m.x, m.y + s * 0.2, s * 1.5, s * 0.9, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          drawTopPlayer(ctx, m.x, m.y, s, { colors: myKit }, { number: m.num, phase: m.ph * 3, skin: m.skin, ring: '#e0f2fe' });
        });
        drawTopPlayer(ctx, L.me.x, L.me.y, s * 1.1, { colors: myKit }, { number: opts.number ?? 8, highlight: true, phase: t * 2, skin: opts.skin || '#d9a57b' });
        if (stolen) drawDefs();

        // top: yükseklik = büyüme + gölge kayması
        const b = S.ball;
        if (b.h > 0.02) drawShadow(ctx, b.x + b.h * 10 * k, b.y + b.h * 14 * k, L.rBall * 0.9, L.rBall * 0.5, 0.3);
        drawBall(ctx, b.x, b.y - b.h * 18 * k, L.rBall * (1 + 0.35 * b.h), b.rot);

        // başlangıç: topa dokun işareti
        if (S.phase === 'idle' || S.phase === 'aim') {
          const pulse = 1 + 0.12 * Math.sin(t * 6);
          ctx.strokeStyle = 'rgba(198,255,61,.75)';
          ctx.lineWidth = 2.5 * k;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 20 * k * pulse, 0, Math.PI * 2);
          ctx.stroke();
        }

        // ağır çekim vinyeti
        if (S.ts < 0.95) {
          const a = clamp((1 - S.ts) * 0.55, 0, 0.5);
          const gr = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75);
          gr.addColorStop(0, 'rgba(10,20,40,0)');
          gr.addColorStop(1, `rgba(10,20,40,${a})`);
          ctx.fillStyle = gr;
          ctx.fillRect(0, 0, W, H);
          ctx.font = `900 ${12 * Math.max(1, k)}px system-ui, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillStyle = `rgba(198,255,61,${a * 1.6})`;
          ctx.fillText('AĞIR ÇEKİM', 12, 22);
        }

        // baskı çubuğu / bekleme sayacı
        if (S.phase === 'idle' && !S.pressure) drawTimer(ctx, W, H - 16, S.t / IDLE_PRESS);
        else if (S.pressure && (S.phase === 'draw' || S.phase === 'aim' || S.phase === 'idle')) {
          // rakip baskısı: dolan çubuk (dolunca top kapılır)
          ctx.fillStyle = 'rgba(0,0,0,.45)';
          roundRect(ctx, 16, H - 16, W - 32, 8, 4);
          ctx.fill();
          ctx.fillStyle = S.pressLevel > 0.7 ? '#ff5d6c' : '#ff9e26';
          roundRect(ctx, 16, H - 16, Math.max(8, (W - 32) * S.pressLevel), 8, 4);
          ctx.fill();
        }

        ctx.font = '800 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        const hint = S.hint > 0
          ? 'Çizgiye topun üstünden başla'
          : S.phase === 'idle' || S.phase === 'aim'
            ? 'Topa dokun, arkadaşına doğru çiz'
            : S.phase === 'draw'
              ? (S.target < 0 ? 'Çizgiyi bir arkadaşında bitir' : S.contested ? 'Rakip yolda! Etrafından kavisle dolaş' : 'Bırak: pas gitsin')
              : '';
        if (hint) ctx.fillText(hint, W / 2, H - 30);
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (!L) return;
        if (kind === 'down') {
          if (S.phase !== 'idle' && S.phase !== 'aim') return;
          if (dist(p.x, p.y, S.ball.x, S.ball.y) > L.startR) {
            S.hint = 1.4;
            return;
          }
          startDraw(p);
        } else if (kind === 'move') {
          if (S.phase === 'draw') addPoint(p);
        } else if (kind === 'up') {
          if (S.phase === 'draw') {
            addPoint(p);
            rebuild();
            release();
          }
        }
      },
    });
  });
}
