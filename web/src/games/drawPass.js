// PAS — TEK PAS SİSTEMİ (seçmeler, antrenman, maç). Kuşbakışı, piksel oyuncular, fizik motoru.
//
//  1) AĞIR ÇEKİM: Topa dokunup sürüklemeye başlayınca zaman yavaşlar (pas statı yüksekse daha çok).
//  2) ÇİZİM + KAVİS: Parmağın izlediği hattan Bezier uydurulur; çizgi rengi: yeşil temiz, turuncu rakip yolda,
//     beyaz ucunda arkadaş yok.
//  3) FİZİK: Bırakınca top fizikle vurulur: çizginin başı çıkış yönü, kavis falso (Magnus), uzunluk yükselme.
//  4) RAKİPLER topun gideceği yere KOŞMAZ: bölgesini tutar, adamını markajlar; biri pasöre baskı yapar.
//     Top yanından geçerse refleksle ayağını uzatır (yerinden en çok ~1 m).
//  5) ARKADAŞ topa koşar ve kontrol eder; çok sert pas ilk dokunuşta kaçabilir.
// Senaryolar: 'buildup' (orta saha), 'final' (son bölge, 10 numaraya markaj), 'tryout' (seçme: koşan arkadaşın önüne).
import { createStage, Particles, BigText, drawPitchTop, drawTimer, roundRect, clamp, lerp, dist } from './engine.js';
import { CurvePath } from './curvePath.js';
import { passSkill, kickFromPath } from './drawPassLogic.js';
import { FixedStep, createBall, kick, stepBall, createBody, steer, stepBody, bodySpeed, interceptBall, restPoint, collideBodies, firstTouch, groundSpeed, predict, ENV } from './physics.js';
import { drawPixelPlayer, drawMovingPlayer, drawPixelBall } from './pixel/sprites.js';
import { npcLook, lookFromAvatar } from './pixel/looks.js';
import { sfx, buzz } from '../audio.js';

export function playDrawPass(host, opts) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const sk = passSkill(skill);
    const nerves = clamp(opts.nerves ?? 0, 0, 1);
    const scenario = opts.context === 'final' ? 'final' : opts.context === 'tryout' ? 'tryout' : 'buildup';
    const final = scenario === 'final';
    const tryout = scenario === 'tryout';
    const level = clamp(opts.level ?? 0, 0, 1);
    const myClub = opts.myKit || { colors: ['#2563eb', '#ffffff'] };
    const oppClub = opts.oppKit || { colors: ['#b91c1c', '#ffffff'] };
    const meLook = opts.me || lookFromAvatar({}, myClub, { number: String(opts.number ?? 8) });
    const particles = new Particles();
    const big = new BigText();
    const path = new CurvePath();
    const preview = [];
    const IDLE_PRESS = 4.5; // hiç çizmeden bu kadar beklenirse baskı başlar (oyun saniyesi)
    const TS = 1.9; // fizik saniyesi / oyun saniyesi
    const fixed = new FixedStep(1 / 120, 30);

    let L = null;
    const S = {
      phase: 'idle', // idle → draw (→ aim) → flight → after
      t: 0, ts: 1, tsTarget: 1, pts: [], pressure: false, pressStartD: 1, pressLevel: 0,
      target: -1, contested: false, ball: null, outcome: null, afterT: 0, hint: 0, done: false, clearance: 0,
      pb: null, trail: [], flightT: 0, heavy: false, runner: -1,
    };

    // ─────────────── Diziliş ───────────────
    function layout(W, H) {
      const k = W / 390;
      const ppm = W / 34; // ekran ≈ 34 m genişlik
      const me = { x: W / 2, y: H * 0.84 };
      const j = () => (Math.random() - 0.5) * W * 0.08;
      const body = (x, y, o) => createBody(x / ppm, y / ppm, o);
      let mates;
      let defs;
      if (tryout) {
        // seçme: üst tarafta yatay koşan tek arkadaş; seviye arttıkça hızlanır, bir rakip bölge tutar
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y = H * lerp(0.28, 0.42, Math.random());
        const x = dir > 0 ? -20 * k : W + 20 * k;
        mates = [{ x, y, hx: x, hy: y, ph: 0, num: 10, run: null, lane: { dir, v: lerp(3.2, 6.8, level) * (opts.warm ? 0.85 : 1) } }];
        defs = level > 0.25 ? [{ x: W * lerp(0.35, 0.65, Math.random()), y: lerp(me.y, y, lerp(0.45, 0.6, Math.random())) }] : [];
      } else {
        const spots = final ? [[0.2, 0.32], [0.5, 0.17], [0.8, 0.3]] : [[0.18, 0.5], [0.5, 0.3], [0.82, 0.47]];
        mates = spots.map(([fx, fy], i) => {
          const x = W * fx + j();
          const y = H * fy + j();
          return { x, y, hx: x, hy: y, ph: Math.random() * 6, num: [7, 10, 11][i], run: null };
        });
        // Koridorlar: biri tam kapalı (kavis şart), biri çekişmeli, biri açık; son bölgede 10 numaraya markaj
        const order = [0, 1, 2].sort(() => Math.random() - 0.5);
        const lane = (m, t, perp) => {
          const dx = m.x - me.x;
          const dy = m.y - me.y;
          const len = Math.hypot(dx, dy) || 1;
          return { x: me.x + dx * t + (-dy / len) * perp, y: me.y + dy * t + (dx / len) * perp };
        };
        const sign = () => (Math.random() < 0.5 ? -1 : 1);
        defs = [
          lane(mates[order[0]], lerp(0.5, 0.6, Math.random()), sign() * Math.random() * 6 * k),
          lane(mates[order[1]], lerp(0.55, 0.68, Math.random()), sign() * lerp(24, 34, Math.random()) * k),
          lane(mates[order[2]], lerp(0.4, 0.5, Math.random()), sign() * lerp(70, 92, Math.random()) * k),
        ];
        if (final) defs.push({ x: mates[1].x + sign() * 22 * k, y: mates[1].y - 26 * k, mark: 1 });
      }
      mates.forEach((m, i) => {
        m.body = body(m.x, m.y, { maxSpeed: 7.4, accel: 7, mass: 74 });
        m.look = npcLook(myClub, 11 + i * 7 + (opts.seed || 0), m.num);
        m.st = { ph: Math.random() * 4, last: 'down' };
      });
      L = {
        W, H, k, me, mates, ppm,
        defs: defs.map((p, i) => ({
          x: p.x, y: p.y, hx: p.x, hy: p.y, ph: Math.random() * 6, mode: p.mark != null ? 'mark' : 'hold', mark: p.mark,
          body: body(p.x, p.y, { maxSpeed: sk.defSpeed, accel: 6.6, mass: 78 }), lunge: null, scan: 0,
          zone: mates.reduce((best, m, j) => (Math.hypot(m.x - p.x, m.y - p.y) < Math.hypot(mates[best].x - p.x, mates[best].y - p.y) ? j : best), 0),
          look: npcLook(oppClub, 101 + i * 13 + (opts.seed || 0), [4, 5, 6, 8][i]), st: { ph: Math.random() * 4, last: 'down' },
        })),
        spacing: 6 * k,
        startR: 70 * k, // çizim topa bu kadar yakın başlamalı
        minLen: 40 * k,
        stealR: 22 * k * sk.steal,
        targetR: 42 * k,
        contestR: 24 * k,
        ph: 44 * k, // oyuncu boyu (piksel)
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
      pts[last] = { x: p.x, y: p.y };
      if (Math.hypot(pts[last - 1].x - p.x, pts[last - 1].y - p.y) >= L.spacing) {
        pts.push({ x: p.x, y: p.y });
        if (pts.length > 160) {
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
      let best = -1;
      let bestD = L.targetR * (tryout ? 1.6 : 1);
      L.mates.forEach((m, i) => {
        // seçmede koşan arkadaş: çizginin ucu onun koşu yolunun üstündeyse hedef sayılır
        const d = tryout ? Math.abs(m.y - path.p3.y) + Math.max(0, (path.p3.x - m.x) * -m.lane.dir) * 0.2 : dist(m.x, m.y, path.p3.x, path.p3.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      S.target = best;
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
      if (!S.pressure && !tryout) startPressure();
      buzz('touch');
      sfx('tick');
    }

    // ─────────────── Baskı: yalnız EN YAKIN rakip pasöre basar; diğerleri yerini korur ───────────────
    function startPressure() {
      if (!L.defs.length) return;
      S.pressure = true;
      const free = L.defs.filter((d) => d.mode !== 'mark');
      const sorted = (free.length ? free : L.defs).sort((a, b) => dist(a.x, a.y, L.me.x, L.me.y) - dist(b.x, b.y, L.me.x, L.me.y));
      sorted[0].mode = 'press';
      S.pressStartD = Math.max(L.stealR + 10, dist(sorted[0].x, sorted[0].y, L.me.x, L.me.y));
    }

    // ─────────────── Pas ───────────────
    function release() {
      if (!path.valid || Math.hypot(path.p3.x - path.p0.x, path.p3.y - path.p0.y) < L.minLen) {
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
      S.ball.x = L.me.x;
      S.ball.y = L.me.y - 14 * L.k;
      const len = Math.hypot(path.p3.x - path.p0.x, path.p3.y - path.p0.y);
      const err = (sk.error + nerves * 18) * L.k * clamp(len / (300 * L.k), 0.3, 1.5);
      if (err > 0.01) {
        const nx = -(path.p3.y - path.p0.y) / len;
        const ny = (path.p3.x - path.p0.x) / len;
        const e = (Math.random() - Math.random()) * err;
        path.shiftEnd(nx * e, ny * e);
      }
      const sol = kickFromPath(path, L.ppm, sk, ENV);
      S.kick = sol;
      S.pb = kick(createBall(S.ball.x / L.ppm, S.ball.y / L.ppm, 0), sol);
      S.ball.spin = clamp(sol.spin / 4, -22, 22);
      S.flightT = 0;
      S.heavy = false;
      S.trail = [];
      S.phase = 'flight';
      S.kickT = 0.25;
      // pasör baskısı biter; baskıcı geri bölgesine döner
      for (const d of L.defs) if (d.mode === 'press') d.mode = 'hold';
      let runner = S.target;
      if (runner < 0) {
        let bd = 90 * L.k;
        L.mates.forEach((m, i) => {
          const d = dist(m.x, m.y, path.p3.x, path.p3.y);
          if (d < bd) { bd = d; runner = i; }
        });
      }
      S.runner = runner;
      L.mates.forEach((m) => { m.run = null; m.plan = 0; });
      if (runner >= 0 && !tryout) L.mates[runner].run = { x: path.p3.x / L.ppm, y: path.p3.y / L.ppm };
      sfx('kick');
      buzz('kick');
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
      if (opts.warm && outcome !== 'success') {
        big.show('ISINMA · CAN GİTMEDİ', '#ffcf3d', 40);
        sfx('miss');
        return;
      }
      if (outcome === 'success') {
        big.show(curved ? 'FALSOLU PAS!' : 'İSABETLİ PAS!', '#c6ff3d', 50);
        particles.burst(S.ball.x, S.ball.y, { n: curved ? 34 : 24, colors: ['#c6ff3d', '#fff'], speed: 220, life: 0.8 });
        sfx('levelup');
        buzz(curved ? 'passCurve' : 'pass');
      } else if (outcome === 'intercept') {
        big.show('ARAYA GİRDİ!', '#ff5d6c', 50);
        sfx('tackle');
        buzz('intercept');
        stage.shake(8);
      } else if (outcome === 'stolen') {
        big.show('TOP KAPTIRILDI', '#ff5d6c', 44);
        sfx('tackle');
        buzz('bump');
        stage.shake(6);
      } else if (outcome === 'out') {
        big.show('TOP DIŞARIDA', '#ff5d6c', 46);
        sfx('miss');
        buzz('miss');
      } else if (outcome === 'timeout') {
        big.show('GEÇ KALDIN', '#ff5d6c', 46);
        sfx('miss');
        buzz('miss');
      } else {
        big.show('BOŞA GİTTİ', '#ff5d6c', 46);
        sfx('miss');
        buzz('miss');
      }
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      const success = S.outcome === 'success';
      let accuracy = 0;
      if (success) {
        const c = Number.isFinite(S.clearance) ? clamp(S.clearance / (50 * L.k), 0, 1) : 1;
        accuracy = clamp(0.45 + 0.3 * c + 0.25 * Math.min(1, Math.abs(path.curve) * 1.5) - (S.heavy ? 0.25 : 0), 0, 1);
      }
      setTimeout(() => {
        stage.stop();
        resolve({ success, accuracy, outcome: S.outcome, curve: path.valid ? path.curve : 0 });
      }, 50);
    }

    // ─────────────── Oyuncular (fizik adımı) ───────────────
    function aiStep(h) {
      const ppm = L.ppm;
      const flying = S.phase === 'flight' && S.pb;
      L.mates.forEach((m, i) => {
        const bd = m.body;
        if (m.cool > 0) m.cool -= h;
        if (m.lane) {
          // seçme koşucusu: koşu yolunu sürdürür; top yakına gelirse ona doğru küçük düzeltme
          let ty = m.hy / ppm;
          let tx = bd.x + m.lane.dir * 5;
          let speed = m.lane.v;
          if (flying) {
            // top koşu yoluna yaklaşıyorsa koşucu temposunu ayarlar (yolunu değiştirmez): öne atılan pasa yetişir
            m.plan -= h;
            if (!(m.plan > 0)) {
              m.plan = 0.12;
              const pathAhead = predict(S.pb, { T: 3, h: 1 / 30, env: ENV });
              let best = null;
              for (const q of pathAhead) {
                if (q.z > 1.7) continue;
                const dy = Math.abs(q.y - ty);
                if (!best || dy < best.dy) best = { dy, x: q.x, t: q.t };
              }
              m.meet = best && best.dy < 2.5 && best.t > 0.05 ? { x: best.x, at: S.flightT + best.t } : null;
            }
            if (m.meet) {
              const need = (m.meet.x - bd.x) / Math.max(0.15, m.meet.at - S.flightT);
              if (Math.sign(need) === m.lane.dir || Math.abs(need) < 1.5) {
                tx = m.meet.x;
                speed = clamp(Math.abs(need), 1.5, m.lane.v * 1.35);
              }
            }
            if (Math.hypot(S.pb.x - bd.x, S.pb.y - bd.y) < 3.2 && S.pb.z < 1.7) {
              tx = bd.x + (S.pb.x - bd.x) * 0.6 + m.lane.dir * 0.8;
              ty = S.pb.y;
              speed = m.lane.v * 1.2;
            }
          }
          if (S.phase === 'after') steer(bd, bd.x + m.lane.dir * 0.5, bd.y, h, { speed: 2 });
          else steer(bd, tx, ty, h, { speed, arrive: 0.05 });
        } else if (m.run && flying && i === S.runner) {
          m.plan -= h;
          if (m.plan <= 0) {
            m.plan = 0.12;
            const ip = interceptBall(bd, S.pb, { reaction: 0, reach: 0.7, maxZ: 1.7, T: 4, env: ENV });
            m.run = ip ? { x: ip.x, y: ip.y } : restPoint(S.pb, { env: ENV });
          }
          steer(bd, m.run.x, m.run.y, h, { arrive: 0.5 });
        } else if (S.phase === 'after') {
          steer(bd, bd.x, bd.y, h);
        } else {
          // boşa çıkma koşuları: arkadaşlar yerinde durmaz, rakipten uzaklaşan kısa koşular yapar
          m.wander = (m.wander ?? Math.random() * 1.5) - h;
          if (m.wander <= 0 || !m.spot) {
            m.wander = lerp(1.3, 2.6, Math.random());
            const near = L.defs.reduce((a, d) => (!a || Math.hypot(d.body.x - bd.x, d.body.y - bd.y) < Math.hypot(a.body.x - bd.x, a.body.y - bd.y) ? d : a), null);
            const ax = near ? Math.sign(bd.x - near.body.x) || 1 : (Math.random() < 0.5 ? -1 : 1);
            m.spot = { x: clamp(m.hx / ppm + ax * lerp(1, 3.2, Math.random()), 1.5, L.W / ppm - 1.5), y: m.hy / ppm + lerp(-2.5, 1.5, Math.random()) };
          }
          steer(bd, m.spot.x, m.spot.y, h, { speed: 3.6, arrive: 0.6 });
        }
        stepBody(bd, h);
      });
      const meX = L.me.x / ppm;
      const meY = L.me.y / ppm;
      for (const d of L.defs) {
        const bd = d.body;
        // Refleks: top yakından geçecekse ayağını uzat (yalnız yakın çevre; topun gideceği yere koşmaz)
        if (flying) {
          d.scan -= h;
          if (d.scan <= 0) {
            d.scan = 0.06;
            const pathAhead = predict(S.pb, { T: 0.45, h: 1 / 120, env: ENV });
            let best = null;
            for (const q of pathAhead) {
              if (q.z > 2.2) continue;
              const dd = Math.hypot(q.x - bd.x, q.y - bd.y);
              if (dd < 1.7 && (!best || dd < best.d)) best = { x: q.x, y: q.y, d: dd };
            }
            if (best && !d.lunge) d.lunge = { ax: bd.x, ay: bd.y, t: 0 };
            if (best && d.lunge) {
              const ox = best.x - d.lunge.ax;
              const oy = best.y - d.lunge.ay;
              const ol = Math.hypot(ox, oy) || 1;
              const lim = Math.min(ol, 1.1);
              d.lunge.tx = d.lunge.ax + (ox / ol) * lim;
              d.lunge.ty = d.lunge.ay + (oy / ol) * lim;
            }
          }
        }
        if (S.phase === 'after') steer(bd, bd.x, bd.y, h);
        else if (d.lunge && d.lunge.tx != null && flying) {
          d.lunge.t += h;
          steer(bd, d.lunge.tx, d.lunge.ty, h, { arrive: 0.2 });
          if (d.lunge.t > 0.7) d.lunge = null;
        } else if (d.mode === 'press') steer(bd, meX, meY - 0.55, h, { arrive: 0.3 });
        else if (d.mode === 'mark' && L.mates[d.mark]) {
          // adamını takip eder: kaleye dönük tarafında (üstünde) 1.2 m
          const m = L.mates[d.mark].body;
          steer(bd, m.x + (d.hx / ppm - m.x) * 0.15, m.y - 1.2, h, { speed: bd.maxSpeed * 0.9, arrive: 0.4 });
        } else {
          if (d.lunge && !flying) d.lunge = null;
          // bölge savunması: kendi bölgesindeki arkadaşın pas koridorunu gölgeler (topun gideceği yere koşmaz)
          const mate = L.mates[d.zone ?? 0];
          let tx = d.hx / ppm;
          let ty = d.hy / ppm;
          if (mate) {
            const cx = meX + (mate.body.x - meX) * 0.58;
            const cy = meY + (mate.body.y - meY) * 0.58;
            tx = lerp(tx, cx, 0.35) + Math.sin(d.ph * 0.25) * 0.6;
            ty = lerp(ty, cy, 0.35) + Math.cos(d.ph * 0.2) * 0.4;
          }
          steer(bd, tx, ty, h, { speed: 3.4, arrive: 0.8 });
        }
        stepBody(bd, h);
      }
      for (let i = 0; i < L.defs.length; i++) {
        for (let j = i + 1; j < L.defs.length; j++) collideBodies(L.defs[i].body, L.defs[j].body);
        for (const m of L.mates) collideBodies(L.defs[i].body, m.body);
      }
    }

    /** Top temasları (metre). Rakip: ayak ≈1 m, göğüs ≈0.6 m, kafa ≈0.45 m (2.45 m'ye kadar). */
    function ballContacts() {
      const pb = S.pb;
      for (const d of L.defs) {
        const r = pb.z < 0.9 ? 0.95 : pb.z < 1.8 ? 0.6 : 0.45;
        if (pb.z <= 2.45 && Math.hypot(pb.x - d.body.x, pb.y - d.body.y) <= r) {
          S.ball.x = d.body.x * L.ppm;
          S.ball.y = d.body.y * L.ppm - 10 * L.k;
          S.ball.h = 0;
          end('intercept');
          return true;
        }
      }
      for (let i = 0; i < L.mates.length; i++) {
        const m = L.mates[i];
        if (m.cool > 0 || pb.z > 1.7 || Math.hypot(pb.x - m.body.x, pb.y - m.body.y) > 1.0) continue;
        const ft = firstTouch(pb, m.body, sk.control);
        if (ft.clean || S.heavy) {
          S.received = i;
          S.ball.x = m.body.x * L.ppm;
          S.ball.y = m.body.y * L.ppm - 4 * L.k;
          S.ball.h = 0;
          end('success');
          return true;
        }
        S.heavy = true;
        pb.vx = ft.bounce.vx;
        pb.vy = ft.bounce.vy;
        pb.vz = Math.max(0, pb.vz) * 0.2;
        pb.spin = 0;
        m.cool = 0.28;
        m.run = { x: pb.x, y: pb.y };
        m.plan = 0;
        S.runner = i;
        big.show('AĞIR DOKUNUŞ!', '#ff9e26', 34);
        buzz('bump');
        sfx('kick');
      }
      return false;
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        if (!L || L.W !== stage.W || L.H !== stage.H) layout(stage.W, stage.H);
        S.ts += (S.tsTarget - S.ts) * (1 - Math.exp(-12 * dt));
        if (Math.abs(S.ts - S.tsTarget) < 0.004) S.ts = S.tsTarget;
        const g = dt * S.ts;
        S.t += g;
        S.hint = Math.max(0, S.hint - dt);
        if (S.kickT > 0) S.kickT -= dt;
        particles.update(dt);
        big.update(dt);
        for (const m of L.mates) { m.ph += g; m.st.ph += bodySpeed(m.body) * g * TS * 1.1; }
        for (const d of L.defs) { d.ph += g * 6; d.st.ph += bodySpeed(d.body) * g * TS * 1.1; }

        const b = S.ball;
        fixed.run(g * TS, (h) => {
          aiStep(h);
          if (S.phase !== 'flight') return true;
          const pb = S.pb;
          S.flightT += h;
          stepBall(pb, h, ENV);
          if (ballContacts()) return false;
          const px = pb.x * L.ppm;
          const py = pb.y * L.ppm;
          if (px < -4 || px > L.W + 4 || py < -4 || py > L.H + 4) {
            b.x = px;
            b.y = py;
            end('out');
            return false;
          }
          if ((!pb.air && groundSpeed(pb) < 0.35) || S.flightT > 7) {
            end('missed');
            return false;
          }
          return true;
        });
        for (const o of [...L.mates, ...L.defs]) { o.x = o.body.x * L.ppm; o.y = o.body.y * L.ppm; }

        if (S.phase === 'idle' || S.phase === 'draw' || S.phase === 'aim') {
          b.x = L.me.x;
          b.y = L.me.y - 14 * L.k;
          if (tryout) {
            // seçme: koşucu ekrandan çıkarsa geç kalınmıştır
            const m = L.mates[0];
            if ((m.lane.dir > 0 && m.x > L.W + 30 * L.k) || (m.lane.dir < 0 && m.x < -30 * L.k)) end('timeout');
          } else {
            if (S.phase === 'idle' && S.t > IDLE_PRESS && !S.pressure) startPressure();
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
          }
          if (S.phase === 'draw') rebuild();
        } else if (S.phase === 'flight') {
          const pb = S.pb;
          b.x = pb.x * L.ppm;
          b.y = pb.y * L.ppm;
          b.h = clamp(pb.z / 3, 0, 1.5);
          b.rot += (groundSpeed(pb) / 6) * dt * 6;
          S.trail.push({ x: b.x, y: b.y, h: b.h });
          if (S.trail.length > 26) S.trail.shift();
        } else if (S.phase === 'after') {
          S.afterT += dt;
          if (S.afterT > 1.5) finish();
        }
      },

      render(ctx, W, H, t) {
        if (!L) return;
        drawPitchTop(ctx, W, H, { box: final || tryout ? 'top' : 'none', circle: !final && !tryout });
        const k = L.k;
        // ham çizim + Bezier önizleme
        if ((S.phase === 'draw' || S.phase === 'flight') && S.pts.length > 1) {
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
          const alpha = S.phase === 'draw' ? 0.95 : 0.3;
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
        // seçme: koşu yolu
        if (tryout && S.phase !== 'after') {
          const m = L.mates[0];
          ctx.setLineDash([4, 8]);
          ctx.strokeStyle = 'rgba(255,255,255,.18)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, m.hy);
          ctx.lineTo(W, m.hy);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // oyuncular: y sırasına göre (arkadaki önce)
        const drawables = [];
        L.defs.forEach((d) => drawables.push({ y: d.y, fn: () => drawMovingPlayer(ctx, d.x, d.y, L.ph, d.look, d.body.vx, d.body.vy, d.st, { face: 'down', ring: d.mode === 'press' ? '#ff9e26' : 'rgba(255,93,108,.7)', frame: d.lunge && d.lunge.tx != null && S.phase === 'flight' ? 'lunge' : undefined }) }));
        L.mates.forEach((m, i) => {
          const targeted = i === S.target && (S.phase === 'draw' || S.phase === 'flight');
          drawables.push({ y: m.y, fn: () => {
            if (targeted) {
              ctx.strokeStyle = `rgba(255,230,80,${0.6 + 0.3 * Math.sin(t * 9)})`;
              ctx.lineWidth = 3 * k;
              ctx.beginPath();
              ctx.ellipse(m.x, m.y, 20 * k, 9 * k, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            drawMovingPlayer(ctx, m.x, m.y, L.ph, m.look, m.body.vx, m.body.vy, m.st, { face: 'down', ring: 'rgba(224,242,254,.55)' });
          } });
        });
        const kicking = S.kickT > 0;
        drawables.push({ y: L.me.y, fn: () => drawPixelPlayer(ctx, L.me.x, L.me.y, L.ph * 1.05, meLook, { dir: 'up', frame: kicking ? 'kick' : S.phase === 'draw' ? 'idle' : `run${Math.floor(t * 2) % 2 ? 1 : 3}`, marker: '#c6ff3d' }) });
        drawables.sort((a, b) => a.y - b.y).forEach((d) => d.fn());

        // top izi + top
        if (S.trail.length > 2 && S.phase === 'flight') {
          ctx.lineCap = 'round';
          for (let i = 1; i < S.trail.length; i++) {
            const p0 = S.trail[i - 1];
            const p1 = S.trail[i];
            ctx.strokeStyle = `rgba(255,255,255,${(i / S.trail.length) * 0.4})`;
            ctx.lineWidth = (2 + (i / S.trail.length) * 3) * k;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y - p0.h * 18 * k);
            ctx.lineTo(p1.x, p1.y - p1.h * 18 * k);
            ctx.stroke();
          }
        }
        const b = S.ball;
        drawPixelBall(ctx, b.x, b.y, 13 * k * (1 + 0.3 * b.h), b.rot, { lift: b.h * 18 * k });

        if (S.phase === 'idle' || S.phase === 'aim') {
          const pulse = 1 + 0.12 * Math.sin(t * 6);
          ctx.strokeStyle = 'rgba(198,255,61,.75)';
          ctx.lineWidth = 2.5 * k;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 20 * k * pulse, 0, Math.PI * 2);
          ctx.stroke();
        }
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
        if (!tryout) {
          if (S.phase === 'idle' && !S.pressure) drawTimer(ctx, W, H - 16, S.t / IDLE_PRESS);
          else if (S.pressure && (S.phase === 'draw' || S.phase === 'aim' || S.phase === 'idle')) {
            ctx.fillStyle = 'rgba(0,0,0,.45)';
            roundRect(ctx, 16, H - 16, W - 32, 8, 4);
            ctx.fill();
            ctx.fillStyle = S.pressLevel > 0.7 ? '#ff5d6c' : '#ff9e26';
            roundRect(ctx, 16, H - 16, Math.max(8, (W - 32) * S.pressLevel), 8, 4);
            ctx.fill();
          }
        }
        ctx.font = '800 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        const hint = S.hint > 0
          ? 'Çizgiye topun üstünden başla'
          : S.phase === 'idle' || S.phase === 'aim'
            ? (tryout ? 'Topa dokun, arkadaşının KOŞU YOLUNUN ÖNÜNE çiz' : 'Topa dokun, arkadaşına doğru çiz')
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

/**
 * Seçme istasyonu: aynı pas sistemiyle art arda denemeler. Her denemenin sonucu onAttempt'e gider;
 * istasyon bitene kadar sürer (ısınma denemesi puan almaz).
 * @param {{onAttempt:(success:boolean)=>{stationOver:boolean,warmup:boolean}, isWarmup:()=>boolean, myKit:object, me?:object, number?:number, skill?:number}} opts
 */
export async function playPassStation(host, opts) {
  let rep = 0;
  for (;;) {
    const warm = opts.isWarmup();
    const level = warm ? 0 : Math.min(1, rep / 4);
    const r = await playDrawPass(host, { skill: opts.skill ?? 0.45, context: 'tryout', level, warm, myKit: opts.myKit, me: opts.me, number: opts.number ?? 8, seed: rep });
    if (!warm) rep++;
    const st = opts.onAttempt(!!r.success);
    if (st?.stationOver) return;
  }
}
