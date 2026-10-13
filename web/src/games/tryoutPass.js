// SEÇMELER · PAS İSTASYONU — kuşbakışı. Takım arkadaşı yatay koşar; dokunduğun noktaya pas gider.
// Top vardığında arkadaşın halkanın içindeyse isabet. Öğretir: koşu yolunun ÖNÜNE pas atmak.
import { createStage, Particles, BigText, drawBall, drawTopPlayer, drawPitchTop, clamp, lerp, dist } from './engine.js';
import { sfx, buzz } from '../audio.js';

/**
 * @param {HTMLElement} host
 * @param {{onAttempt:(success:boolean)=>{stationOver:boolean, warmup:boolean}, isWarmup:()=>boolean, myKit:object, number?:number, reps?:number}} opts
 * @returns {Promise<void>} istasyon bitince
 */
export function playTryoutPass(host, opts) {
  return new Promise((resolve) => {
    const myKit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const particles = new Particles();
    const big = new BigText();
    let L = null;
    let rep = 0;
    const S = { phase: 'aim', t: 0, ball: null, pass: null, runner: null, afterT: 0, done: false, ok: false, warm: true };

    function layout(W, H) {
      const k = Math.min(W / 390, H / 700);
      L = { W, H, k, me: { x: W / 2, y: H * 0.84 }, R: 34 * k, vb: 560 * k };
      if (!S.runner) newRep();
    }

    function newRep() {
      const { W, H, k } = L;
      S.warm = opts.isWarmup();
      const level = S.warm ? 0 : Math.min(1, rep / 4);
      const dir = Math.random() < 0.5 ? 1 : -1;
      S.runner = {
        x: dir > 0 ? -30 * k : W + 30 * k,
        y: H * lerp(0.26, 0.44, Math.random()),
        v: dir * lerp(95, 215, level) * k * (S.warm ? 0.85 : 1),
        ph: 0,
        hasBall: false,
      };
      S.ball = { x: L.me.x, y: L.me.y - 16 * k, r: 7 * k, rot: 0 };
      S.pass = null;
      S.phase = 'aim';
      S.afterT = 0;
    }

    /** Topun dokunulan noktaya varacağı anda koşucunun nerede olacağı (ısınmada ipucu olarak gösterilir) */
    function leadPoint() {
      const r = S.runner;
      // sabit nokta yinelemesi: t = mesafe / hız
      let x = r.x;
      for (let i = 0; i < 4; i++) x = r.x + r.v * (dist(L.me.x, L.me.y, x, r.y) / L.vb);
      return { x, y: r.y };
    }

    function resolveRep(success, text) {
      S.phase = 'after';
      S.afterT = 0;
      S.ok = success;
      big.show(text, success ? '#c6ff3d' : '#ff5d6c', success ? 54 : 48);
      if (success) {
        particles.burst(S.ball.x, S.ball.y, { n: 22, colors: ['#c6ff3d', '#fff'], speed: 220, life: 0.8 });
        sfx('levelup');
        buzz(25);
      } else {
        sfx('miss');
        buzz([40, 30, 40]);
      }
      const res = opts.onAttempt(success);
      rep += res.warmup ? 0 : 1;
      S.stationOver = res.stationOver;
    }

    const stage = createStage(host, {
      update(dt) {
        if (!L || L.W !== stage.W || L.H !== stage.H) layout(stage.W, stage.H);
        S.t += dt;
        particles.update(dt);
        big.update(dt);
        const r = S.runner;
        r.ph += dt * 10;
        r.x += r.v * dt;
        if (S.phase === 'aim') {
          // Koşucu ekrandan çıktı: pas atılmadı
          if ((r.v > 0 && r.x > L.W + 40 * L.k) || (r.v < 0 && r.x < -40 * L.k)) resolveRep(false, 'GEÇ KALDIN!');
        } else if (S.phase === 'flight') {
          const p = S.pass;
          p.t += dt;
          const f = clamp(p.t / p.T, 0, 1);
          S.ball.x = lerp(p.x0, p.tx, f);
          S.ball.y = lerp(p.y0, p.ty, f);
          S.ball.rot += dt * 14;
          if (f >= 1) {
            const hit = dist(r.x, r.y, p.tx, p.ty) <= L.R;
            if (hit) r.hasBall = true;
            resolveRep(hit, hit ? 'İSABETLİ PAS!' : 'PAS KAÇTI!');
          }
        } else if (S.phase === 'after') {
          S.afterT += dt;
          if (r.hasBall) {
            S.ball.x = r.x + Math.sign(r.v) * 10 * L.k;
            S.ball.y = r.y + 6 * L.k;
          } else if (S.pass) {
            S.ball.x += (S.pass.tx - S.pass.x0) * dt * 0.35;
            S.ball.y += (S.pass.ty - S.pass.y0) * dt * 0.35;
          }
          if (S.afterT > 1.25) {
            if (S.stationOver) {
              if (!S.done) {
                S.done = true;
                setTimeout(() => { stage.stop(); resolve(); }, 60);
              }
            } else newRep();
          }
        }
      },

      render(ctx, W, H, t) {
        if (!L) return;
        drawPitchTop(ctx, W, H, { box: 'none', circle: true });
        const r = S.runner;
        // Koşu yolu
        ctx.setLineDash([4, 10]);
        ctx.strokeStyle = 'rgba(255,255,255,.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, r.y);
        ctx.lineTo(W, r.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Isınma ipucu: nereye atmalısın
        if (S.phase === 'aim' && S.warm) {
          const lp = leadPoint();
          const pulse = 1 + Math.sin(t * 6) * 0.08;
          ctx.strokeStyle = 'rgba(255,207,61,.9)';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.arc(lp.x, lp.y, L.R * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,207,61,.95)';
          ctx.font = `800 ${Math.round(12 * L.k)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('BURAYA DOKUN', lp.x, lp.y - L.R - 8 * L.k);
        }
        // Hedef halkası koşucunun etrafında
        ctx.strokeStyle = S.phase === 'after' ? (S.ok ? 'rgba(198,255,61,.9)' : 'rgba(255,93,108,.9)') : 'rgba(224,242,254,.75)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, L.R, 0, Math.PI * 2);
        ctx.stroke();
        // yön oku
        ctx.fillStyle = 'rgba(224,242,254,.85)';
        const ax = r.x + Math.sign(r.v) * (L.R + 10 * L.k);
        ctx.beginPath();
        ctx.moveTo(ax + Math.sign(r.v) * 8 * L.k, r.y);
        ctx.lineTo(ax, r.y - 6 * L.k);
        ctx.lineTo(ax, r.y + 6 * L.k);
        ctx.fill();
        const s = 17 * L.k;
        drawTopPlayer(ctx, r.x, r.y, s, { colors: myKit }, { number: 10, facing: r.v > 0 ? Math.PI / 2 : -Math.PI / 2, phase: r.ph, skin: '#c98e62', ring: '#e0f2fe' });
        drawTopPlayer(ctx, L.me.x, L.me.y, s * 1.1, { colors: myKit }, { number: opts.number ?? 8, highlight: true, phase: t * 2, skin: '#d9a57b' });
        if (S.pass) {
          ctx.strokeStyle = 'rgba(255,255,255,.35)';
          ctx.setLineDash([3, 7]);
          ctx.beginPath();
          ctx.moveTo(S.pass.x0, S.pass.y0);
          ctx.lineTo(S.pass.tx, S.pass.ty);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        drawBall(ctx, S.ball.x, S.ball.y, S.ball.r, S.ball.rot);
        if (S.phase === 'aim') {
          ctx.font = `800 ${Math.round(14 * L.k)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,.92)';
          ctx.fillText(S.warm ? 'Isınma: koşunun önüne dokun (kalp gitmez)' : 'Koşunun önüne pas at', W / 2, H - 22);
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (kind !== 'down' || !L || S.phase !== 'aim') return;
        const tx = clamp(p.x, 10, L.W - 10);
        const ty = clamp(p.y, 20, L.me.y - 60 * L.k);
        const d = dist(S.ball.x, S.ball.y, tx, ty);
        S.pass = { x0: S.ball.x, y0: S.ball.y, tx, ty, t: 0, T: Math.max(0.18, d / L.vb) };
        S.phase = 'flight';
        sfx('kick');
        buzz(12);
      },
    });
  });
}
