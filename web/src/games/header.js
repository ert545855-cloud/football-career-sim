// KORNER · KAFA DÜELLOSU — kuşbakışı ceza sahası, kale üstte. Korner kullanılır, top havada süzülür.
//  1) Parmağını sürükle: topun kafa hizasına ineceği noktaya koş (markajdaki savunmacı seni kollar).
//  2) Halka topa kapanırken kalenin istediğin köşesine DOKUN: zıplarsın, kafa o yöne gider.
//  Zamanlama + konum + markaj mesafesi düelloyu belirler; kaleci 6 pas içine düşen topları kaptırmaz.
import { createStage, Particles, BigText, drawPitchTop, clamp, lerp } from './engine.js';
import { createBody, steer, stepBody, applyGrip, envFor } from './physics.js';
import { drawPixelPlayer, drawMovingPlayer, drawPixelBall } from './pixel/sprites.js';
import { npcLook, keeperLook, lookFromAvatar } from './pixel/looks.js';
import { sfx, buzz } from '../audio.js';
import { weatherFx } from './weatherFx.js';
import { headerContest } from './headerLogic.js';

const HEAD_Z = 2.3; // m — kafa vuruşu yüksekliği
const ZMAX = 6.5; // orta yüksekliği

export { headerContest };

/**
 * @param {{skill:number, myKit:object, oppKit:object, me?:object, keeper?:number, weather?:object, fatigue?:number, tempo?:number, expose?:object}} opts
 * @returns {Promise<{success:boolean, accuracy:number, outcome:string, header:true}>}
 */
export function playHeader(host, opts = {}) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.4, 0.02, 1);
    const kq = clamp(opts.keeper ?? 0.5, 0, 1);
    const myClub = opts.myKit || { colors: ['#2563eb', '#ffffff'] };
    const oppClub = opts.oppKit || { colors: ['#b91c1c', '#ffffff'] };
    const meLook = opts.me || lookFromAvatar({}, myClub, { number: String(opts.number ?? 9) });
    const defLook = npcLook(oppClub, 61, 5);
    const gkLook = keeperLook('#22d3ee', 7);
    const env = envFor(opts.weather);
    const wfx = weatherFx(opts.weather);
    const particles = new Particles();
    const big = new BigText();
    const side = Math.random() < 0.5 ? -1 : 1; // korner hangi taraftan
    let L = null;
    const S = {
      phase: 'setup', t: 0, ts: 1, target: null, tapAt: null, tapX: null, result: null, done: false, afterT: 0,
      ball: { x: 0, y: 0, z: 0 }, flight: null, head: null, gk: { u: 0, to: 0, dive: 0 }, extras: [],
    };

    function layout(W, H) {
      const ppm = W / 19;
      const gy = H * 0.2;
      const first = !L;
      L = { W, H, ppm, gy, gw: 7.32 * ppm, k: W / 390, cx: W / 2 / ppm, wm: W / ppm };
      if (first) {
        const P = (x, y, o) => applyGrip(createBody(x, y, o), env);
        const mx = L.cx + (Math.random() - 0.5) * 4;
        const tired = 1 - clamp(opts.fatigue ?? 0, 0, 0.65) * 0.2;
        S.me = P(mx, 13.5, { maxSpeed: lerp(5.6, 7.6, skill) * tired, accel: lerp(9, 13, skill) * tired });
        S.def = P(mx + 0.7, S.me.y - 0.6, { maxSpeed: lerp(7.2, 6.4, skill), accel: 10 });
        S.aim = { x: S.me.x, y: S.me.y };
        // Diğer oyuncular (atmosfer + engel)
        for (let i = 0; i < 4; i++) {
          const x = L.cx - 7 + i * 4.6 + Math.random();
          const y = 5 + Math.random() * 7;
          S.extras.push({ body: P(x, y, { maxSpeed: 4, accel: 6 }), hx: x, hy: y, look: i % 2 ? npcLook(oppClub, 70 + i, 3 + i) : npcLook(myClub, 80 + i, 6 + i), st: {} });
        }
        // Korner: 1,4 sn sonra vurulur; topun düşeceği bölge baştan belli (oyuncu koşuya erken başlayabilir)
        S.cornerAt = 1.4;
        planCross();
      }
    }

    const X = (m) => m * L.ppm;
    const Y = (m) => L.gy + m * L.ppm;

    function planCross() {
      // İniş noktası: penaltı noktası ile altı pas arası, rastgele
      const land = { x: L.cx + (Math.random() - 0.5) * 9, y: lerp(4.5, 11.5, Math.random()) };
      const from = { x: side < 0 ? -1 : L.wm + 1, y: 0.4 };
      const T = lerp(1.55, 1.3, Math.random());
      // Kafa hizasından geçtiği an: z(s) = 4·ZMAX·s(1−s) = HEAD_Z (inişte)
      const sh = (1 + Math.sqrt(1 - HEAD_Z / ZMAX)) / 2;
      const hp = { x: lerp(from.x, land.x, sh), y: lerp(from.y, land.y, sh) };
      S.flight = { from, land, T, t: 0, sh, hp, tHead: T * sh };
    }

    function strike() {
      S.phase = 'cross';
      S.ts = 0.55; // ağır çekim
      sfx('kick');
      buzz('pass');
    }

    function ballAt(s) {
      const f = S.flight;
      return { x: lerp(f.from.x, f.land.x, s), y: lerp(f.from.y, f.land.y, s), z: 4 * ZMAX * s * (1 - s) };
    }

    function tap(px, py) {
      if (S.phase !== 'cross' || S.tapAt != null) return;
      S.tapAt = S.flight.t;
      S.tapX = px;
      S.jumpT = 0;
      sfx('swish');
      // Düello sonucu dokunduğun anda belli olur; kafa topa değdiğinde uygulanır
      const f = S.flight;
      const dtHead = S.tapAt - f.tHead; // − erken, + geç
      const dist = Math.hypot(S.me.x - f.hp.x, S.me.y - f.hp.y);
      const defDist = Math.hypot(S.def.x - f.hp.x, S.def.y - f.hp.y);
      // Altı pas içine düşen orta: kaleci çıkıp yumruklayabilir
      const inSix = f.hp.y < 5.5 && Math.abs(f.hp.x - L.cx) < 9.2;
      const claim = inSix && Math.random() < lerp(0.25, 0.55, kq) * (1 - skill * 0.4);
      S.duel = claim ? { won: false, why: 'claim' } : headerContest({ dt: dtHead, dist, defDist, skill });
      S.duel.dtHead = dtHead;
      void py;
    }

    function resolveHeader() {
      const d = S.duel || { won: false, why: 'late' };
      const f = S.flight;
      if (!d.won) {
        S.result = d.why === 'claim' ? 'claimed' : d.why === 'duel' ? 'cleared' : 'missed';
        big.show({ claimed: 'KALECİ KAPTI!', cleared: 'DEFANS KAZANDI!', missed: d.why === 'early' ? 'ERKEN ZIPLADIN!' : d.why === 'far' ? 'YETİŞEMEDİN!' : 'GEÇ KALDIN!' }[S.result], '#ff5d6c', 50);
        sfx('miss');
        buzz('miss');
        S.phase = 'after';
        // top uzaklaşır
        S.head = { x0: f.hp.x, y0: f.hp.y, x1: f.hp.x + (Math.random() - 0.5) * 20, y1: f.hp.y + 14, t: 0, T: 0.9, out: true };
        if (S.result === 'claimed') S.gk.claim = 1;
        return;
      }
      // Kafa yönü: dokunduğun x (ekranın solu = sol köşe, sağı = sağ köşe)
      let u = (S.tapX / L.W - 0.5) * 2.6;
      const sigma = lerp(0.42, 0.14, skill) + Math.abs(d.dtHead) * 0.6;
      u = clamp(u, -1.4, 1.4) + (Math.random() - 0.5) * 2 * sigma;
      // Yükseklik: erken = yüksek (üstten), geç = yere vurur (kaleci için zor)
      const v = clamp(0.45 - d.dtHead * 2.2 + (Math.random() - 0.5) * 0.4, 0, 1.4);
      const T = 0.42 + Math.hypot(f.hp.x - L.cx, f.hp.y) / 40;
      let outcome;
      if (Math.abs(u) > 1.02) outcome = 'wide';
      else if (v > 1.05) outcome = 'over';
      else {
        // Kaleci: tepki süresi, hız ve uzanma
        const rd = lerp(0.3, 0.18, kq);
        const reachT = Math.max(0, T - rd);
        const guess = u + (Math.random() - 0.5) * lerp(0.6, 0.25, kq);
        const to = clamp(guess, S.gk.u - lerp(1.4, 2.2, kq) * reachT, S.gk.u + lerp(1.4, 2.2, kq) * reachT);
        let reach = 0.28 + 0.1 * kq;
        if (v < 0.25) reach *= 0.8; // yere vuran kafa
        outcome = Math.abs(u - to) <= reach ? 'save' : 'goal';
        S.gk.to = clamp(to, -1.05, 1.05);
      }
      S.head = { x0: f.hp.x, y0: f.hp.y, x1: L.cx + u * 3.66, y1: -0.2, z0: HEAD_Z + 0.4, z1: v * 2.44, t: 0, T, u, v, outcome };
      S.phase = 'header';
      S.ts = 0.8;
      sfx('kick');
      buzz('shot');
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      const o = S.result;
      const success = o === 'goal';
      setTimeout(() => {
        stage.stop();
        resolve({ success, accuracy: success ? clamp(0.4 + (S.duel?.timing || 0) * 0.4 + Math.abs(S.head?.u || 0) * 0.2, 0, 1) : 0, outcome: o, header: true });
      }, 50);
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dtRaw) {
        if (!L || L.W !== stage.W || L.H !== stage.H) layout(stage.W, stage.H);
        const dt = dtRaw * S.ts;
        S.t += dtRaw;
        particles.update(dtRaw);
        big.update(dtRaw);
        // Oyuncular
        steer(S.me, S.aim.x, S.aim.y, dt, { arrive: 0.7 });
        stepBody(S.me, dt);
        // Savunmacı: seni topun tarafından markajlar
        const bx = S.flight ? S.flight.hp.x : L.cx;
        const by = S.flight ? S.flight.hp.y : 6;
        const ax = bx - S.me.x;
        const ay = by - S.me.y;
        const al = Math.hypot(ax, ay) || 1;
        const lag = S.phase === 'cross' ? 0.75 : 0.5;
        steer(S.def, S.me.x + (ax / al) * lag, S.me.y + (ay / al) * lag, dt, { arrive: 0.6 });
        stepBody(S.def, dt);
        for (const e of S.extras) { steer(e.body, e.hx + Math.sin(S.t * 1.3 + e.hx) * 0.8, e.hy + Math.cos(S.t + e.hy) * 0.5, dt, { speed: 2.5 }); stepBody(e.body, dt); }
        // Kaleci idle
        if (S.phase === 'setup' || S.phase === 'cross') S.gk.u = lerp(S.gk.u, clamp((bx - L.cx) / 10, -0.5, 0.5), dt * 2);

        if (S.phase === 'setup') {
          if (S.t > S.cornerAt) strike();
        } else if (S.phase === 'cross') {
          const f = S.flight;
          f.t += dt;
          const sNow = clamp(f.t / f.T, 0, 1);
          Object.assign(S.ball, ballAt(sNow));
          if (S.tapAt != null) S.jumpT += dt;
          // kafa anı: dokunduysan ve top kafa hizasına geldiyse (ya da hiç dokunmadıysan geçer)
          if (S.tapAt != null && f.t >= Math.max(f.tHead, S.tapAt)) resolveHeader();
          else if (sNow >= 1) { S.duel = { won: false, why: 'late', dtHead: 1 }; resolveHeader(); }
        } else if (S.phase === 'header') {
          const h = S.head;
          h.t += dt;
          const p = clamp(h.t / h.T, 0, 1);
          S.ball.x = lerp(h.x0, h.x1, p);
          S.ball.y = lerp(h.y0, h.y1, p);
          S.ball.z = lerp(h.z0, h.z1, p) + Math.sin(Math.PI * p) * 0.6;
          const kp = clamp((h.t - 0.15) / Math.max(0.1, h.T - 0.15), 0, 1);
          S.gk.u = lerp(S.gk.u, S.gk.to, kp);
          S.gk.dive = clamp((S.gk.to - S.gk.u) * 2, -1, 1);
          if (p >= 1) {
            S.result = h.outcome;
            S.phase = 'after';
            S.afterT = 0;
            S.ts = 1;
            if (h.outcome === 'goal') {
              big.show('KAFA GOLÜ!', '#c6ff3d', 70);
              particles.burst(X(S.ball.x), Y(0), { n: 40, colors: ['#c6ff3d', '#ffcf3d', '#fff', myClub.colors[0]], speed: 360, gravity: 500, life: 1.3, size: 5 });
              stage.shake(12);
              sfx('goal');
              buzz('goal');
            } else if (h.outcome === 'save') {
              big.show('KURTARDI!', '#38bdf8', 60);
              sfx('save');
              buzz('save');
            } else {
              big.show(h.outcome === 'over' ? 'ÜSTTEN!' : 'AUT!', '#ff5d6c', 58);
              sfx('miss');
              buzz('miss');
            }
          }
        } else if (S.phase === 'after') {
          S.afterT += dtRaw;
          const h = S.head;
          if (h?.out) {
            h.t += dtRaw;
            const p = clamp(h.t / h.T, 0, 1);
            S.ball.x = lerp(h.x0, h.x1, p);
            S.ball.y = lerp(h.y0, h.y1, p);
            S.ball.z = Math.sin(Math.PI * p) * 3;
          }
          if (S.afterT > 1.6) finish();
        }
      },

      render(ctx, W, H, t) {
        if (!L) return;
        drawPitchTop(ctx, W, H, {});
        wfx.ground(ctx, W, H);
        const k = L.k;
        // Ceza sahası çizgileri (kale üstte)
        ctx.strokeStyle = 'rgba(255,255,255,.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, L.gy); ctx.lineTo(W, L.gy); ctx.stroke();
        ctx.strokeRect(X(L.cx - 9.16), L.gy, X(18.32), 5.5 * L.ppm);
        ctx.strokeRect(X(L.cx - 20.15), L.gy, X(40.3), 16.5 * L.ppm);
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.beginPath(); ctx.arc(X(L.cx), Y(11), 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(X(L.cx), Y(11), 9.15 * L.ppm, 0.22 * Math.PI, 0.78 * Math.PI); ctx.stroke();
        // Kale: file (üstte) + direkler
        const gx0 = X(L.cx) - L.gw / 2;
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ctx.fillRect(gx0, L.gy - 2 * L.ppm, L.gw, 2 * L.ppm);
        ctx.strokeStyle = 'rgba(255,255,255,.22)';
        ctx.lineWidth = 1;
        for (let x = gx0; x <= gx0 + L.gw; x += 6 * k) { ctx.beginPath(); ctx.moveTo(x, L.gy - 2 * L.ppm); ctx.lineTo(x, L.gy); ctx.stroke(); }
        for (let y = L.gy - 2 * L.ppm; y <= L.gy; y += 6 * k) { ctx.beginPath(); ctx.moveTo(gx0, y); ctx.lineTo(gx0 + L.gw, y); ctx.stroke(); }
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(gx0 - 3, L.gy - 2 * L.ppm, 4, 2 * L.ppm + 3);
        ctx.fillRect(gx0 + L.gw - 1, L.gy - 2 * L.ppm, 4, 2 * L.ppm + 3);
        ctx.fillRect(gx0 - 3, L.gy - 1, L.gw + 6, 4);

        // Hedef halkası: topun kafa hizasına ineceği nokta + kapanan zamanlama halkası
        if (S.flight && (S.phase === 'cross' || S.phase === 'setup')) {
          const f = S.flight;
          const hx = X(f.hp.x);
          const hy = Y(f.hp.y);
          ctx.setLineDash([5, 6]);
          ctx.strokeStyle = 'rgba(198,255,61,.85)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(hx, hy, 1.2 * L.ppm, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          const rem = S.phase === 'setup' ? 1 : clamp((f.tHead - f.t) / f.tHead, 0, 1);
          const near = Math.abs(f.tHead - f.t) < 0.14;
          ctx.strokeStyle = near ? '#c6ff3d' : 'rgba(255,255,255,.75)';
          ctx.lineWidth = near ? 4 : 2.5;
          ctx.beginPath(); ctx.arc(hx, hy, 1.2 * L.ppm + rem * 70 * k, 0, Math.PI * 2); ctx.stroke();
        }

        // Oyuncular (y'ye göre sırala)
        const people = [
          ...S.extras.map((e) => ({ y: e.body.y, draw: () => drawMovingPlayer(ctx, X(e.body.x), Y(e.body.y), 48 * k, e.look, e.body.vx, e.body.vy, e.st, { face: 'up' }) })),
          { y: S.def.y, draw: () => drawMovingPlayer(ctx, X(S.def.x), Y(S.def.y), 52 * k, defLook, S.def.vx, S.def.vy, S.dst || (S.dst = {}), { face: 'down', lift: S.phase === 'header' || (S.tapAt != null && S.phase === 'cross') ? 10 * k : 0 }) },
          { y: S.me.y, draw: () => {
            const jump = S.tapAt != null && (S.phase === 'cross' || S.phase === 'header') ? Math.sin(clamp((S.jumpT || 0) / 0.45, 0, 1) * Math.PI) * 18 * k : 0;
            drawMovingPlayer(ctx, X(S.me.x), Y(S.me.y), 54 * k, meLook, S.me.vx, S.me.vy, S.mst || (S.mst = {}), { face: 'up', marker: '#c6ff3d', lift: jump, ring: 'rgba(198,255,61,.8)' });
          } },
        ].sort((a, b) => a.y - b.y);
        // Kaleci
        const gkx = X(L.cx) + S.gk.u * (L.gw / 2);
        drawPixelPlayer(ctx, gkx, L.gy + 16 * k, 50 * k, gkLook, { dir: 'down', frame: S.phase === 'header' || S.gk.claim ? 'lunge' : 'ready', rot: S.gk.dive * 0.9, lift: S.gk.claim ? 10 * k : 0 });
        for (const p of people) p.draw();
        // Top (gölgesi yerde, kendisi yükseklik kadar yukarıda)
        if ((S.flight && S.phase !== 'setup') || S.head) {
          const b = S.ball;
          const sz = (12 + b.z * 1.4) * k;
          drawPixelBall(ctx, X(b.x), Y(b.y), sz, t * 9, { lift: b.z * L.ppm * 0.55 });
        } else {
          // köşede bekleyen top
          drawPixelBall(ctx, side < 0 ? 10 * k : W - 10 * k, L.gy + 4 * k, 12 * k, 0);
        }
        // İpuçları
        ctx.textAlign = 'center';
        ctx.font = `800 ${Math.round(14 * Math.min(1.2, k))}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        const hint = S.phase === 'setup' ? 'Korner geliyor! Sürükle: topun ineceği yere koş'
          : S.phase === 'cross' && S.tapAt == null ? (S.flight.t > S.flight.tHead - 0.55 ? 'ŞİMDİ! Dokun ya da bırak · sol/sağ = köşe' : 'Halkaya koş, halka kapanınca zıpla') : '';
        if (hint) ctx.fillText(hint, W / 2, H - 34);
        wfx.sky(ctx, W, H, t);
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (!L) return;
        // Halka evresi (kafa anına ~0,55 sn kala): dokunuş ya da parmağı kaldırmak = zıpla; x konumu = kafanın yönü
        const ring = S.phase === 'cross' && S.flight.t > S.flight.tHead - 0.55;
        if (ring && S.tapAt == null && (kind === 'down' || (kind === 'up' && S.dragging))) {
          S.dragging = false;
          tap(p.x, p.y);
          return;
        }
        if (kind === 'down' || (kind === 'move' && S.dragging)) {
          if (S.phase === 'setup' || S.phase === 'cross') {
            const ax = p.x / L.ppm;
            const ay = (p.y - L.gy) / L.ppm - 1.2;
            if (Number.isFinite(ax) && Number.isFinite(ay)) S.aim = { x: clamp(ax, 0.8, L.wm - 0.8), y: clamp(ay, 1.5, 24) };
            S.dragging = true;
          }
        } else if (kind === 'up') S.dragging = false;
      },
    });
    if (opts.expose) {
      Object.assign(opts.expose, { S });
      Object.defineProperty(opts.expose, 'L', { get: () => L, configurable: true });
    }
  });
}
