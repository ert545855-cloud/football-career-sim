// SEÇMELER · ÇALIM İSTASYONU — kuşbakışı, yukarı akan parkur. Her sırada dubalar ve tek bir boşluk var.
// Parmağını sağa-sola sürükleyerek boşluktan geç; dubaya çarpmak bir hak götürür.
import { createStage, Particles, BigText, drawBall, drawTopPlayer, clamp, lerp } from './engine.js';
import { drawSprite, spritePattern } from '../assets/sprites.js';
import { sfx, buzz } from '../audio.js';

/**
 * @param {HTMLElement} host
 * @param {{onAttempt:(success:boolean)=>{stationOver:boolean, warmup:boolean}, isWarmup:()=>boolean, myKit:object, number?:number, rows:number}} opts
 *   rows: puanlanan sıra sayısı (+1 ısınma sırası)
 * @returns {Promise<void>}
 */
export function playTryoutDribble(host, opts) {
  return new Promise((resolve) => {
    const myKit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const particles = new Particles();
    const big = new BigText();
    let L = null;
    const S = { t: 0, y: 0, x: 0, targetX: null, speed: 0, stumble: 0, rows: [], next: 0, over: false, endT: 0, done: false, ph: 0 };

    function layout(W, H) {
      const k = Math.min(W / 390, H / 700);
      const first = !L;
      L = { W, H, k, py: H * 0.76, pr: 13 * k, cr: 10 * k, spacing: 46 * k, v0: 175 * k };
      if (first) build();
    }

    /** Parkur: ısınma sırası + puanlanan sıralar. Boşluklar sırayla sağ/sol yapar, giderek daralır. */
    function build() {
      const { W, k } = L;
      S.x = W / 2;
      S.speed = L.v0;
      const total = (opts.rows || 7) + 1;
      let y = 300 * k;
      let side = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < total; i++) {
        const level = i === 0 ? 0 : (i - 1) / Math.max(1, total - 2);
        const gap = lerp(130, 82, level) * k;
        const gx = clamp(W / 2 + side * lerp(0.12, 0.3, Math.random()) * W, gap / 2 + 18 * k, W - gap / 2 - 18 * k);
        side *= -1;
        const cones = [];
        for (let x = 14 * k; x < W - 8 * k; x += L.spacing) {
          if (Math.abs(x - gx) < gap / 2) continue;
          cones.push({ x, hit: false, fall: 0 });
        }
        S.rows.push({ y, gx, gap, cones, hit: false, resolved: false, warm: i === 0 });
        y += lerp(240, 175, level) * k;
      }
      S.finishY = y + 40 * k;
    }

    function resolveRow(row) {
      row.resolved = true;
      const success = !row.hit;
      const res = opts.onAttempt(success);
      if (success) {
        big.show(row.warm ? 'SÜPER!' : 'TEMİZ!', '#c6ff3d', 46);
        sfx('swish');
        buzz('dribble');
      }
      if (res.stationOver) S.over = true;
    }

    const stage = createStage(host, {
      update(dt) {
        if (!L || L.W !== stage.W || L.H !== stage.H) layout(stage.W, stage.H);
        S.t += dt;
        S.ph += dt * 12;
        particles.update(dt);
        big.update(dt);
        if (S.over) {
          S.endT += dt;
          S.speed = lerp(S.speed, 0, 0.05);
          S.y += S.speed * dt;
          if (S.endT > 1.4 && !S.done) {
            S.done = true;
            setTimeout(() => { stage.stop(); resolve(); }, 60);
          }
          return;
        }
        // ileri koşu (çarpınca kısa süre yavaşlar), parmağı takip eden yan hareket
        S.stumble = Math.max(0, S.stumble - dt);
        const target = L.v0 * (1 + Math.min(0.35, S.y / (3000 * L.k)));
        S.speed = lerp(S.speed, S.stumble > 0 ? target * 0.45 : target, 0.08);
        S.y += S.speed * dt;
        if (S.targetX != null) {
          const maxV = 430 * L.k;
          S.x += clamp(S.targetX - S.x, -maxV * dt, maxV * dt);
        }
        S.x = clamp(S.x, L.pr, L.W - L.pr);
        // çarpışma ve sıra sonucu
        for (const row of S.rows) {
          if (row.resolved) continue;
          const dy = row.y - S.y; // sıra oyuncunun ne kadar önünde
          if (Math.abs(dy) < L.pr + L.cr) {
            for (const c of row.cones) {
              if (!c.hit && Math.abs(c.x - S.x) < L.pr + L.cr * 0.9) {
                c.hit = true;
                c.dir = Math.sign(c.x - S.x) || 1;
                if (!row.hit) {
                  row.hit = true;
                  S.stumble = 0.55;
                  big.show(row.warm ? 'DİKKAT!' : 'ÇARPTIN!', '#ff5d6c', 48);
                  sfx('tackle');
                  buzz('bump');
                  stage.shake(9);
                  particles.burst(c.x, L.py - dy, { n: 12, colors: ['#f97316', '#fff'], speed: 180, life: 0.5 });
                }
              }
            }
          }
          if (dy < -(L.pr + L.cr)) resolveRow(row);
          break; // sırayla: yalnızca en yakın çözülmemiş sıra
        }
        for (const row of S.rows) for (const c of row.cones) if (c.hit) c.fall = Math.min(1, c.fall + dt * 4);
        if (S.y > S.finishY && !S.over) S.over = true;
      },

      render(ctx, W, H, t) {
        if (!L) return;
        const k = L.k;
        // Kayan çim (parkur hareketi hissi)
        const grass = spritePattern(ctx, 'grass', 72);
        ctx.save();
        const off = (S.y % (72)) ;
        ctx.translate(0, off);
        ctx.fillStyle = grass || '#1f7a3a';
        ctx.fillRect(0, -80, W, H + 160);
        ctx.restore();
        ctx.fillStyle = 'rgba(6, 46, 22, 0.42)';
        ctx.fillRect(0, 0, W, H);
        const band = 70 * k;
        for (let y = -band + ((S.y % (band * 2)) - band); y < H; y += band * 2) {
          ctx.fillStyle = 'rgba(0,0,0,.1)';
          ctx.fillRect(0, y, W, band);
        }
        // Yan çizgiler
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(6, -10, W - 12, H + 20);
        // Bitiş çizgisi
        const fy = L.py - (S.finishY - S.y);
        if (fy > -20 && fy < H + 20) {
          for (let i = 0; i < 14; i++) {
            ctx.fillStyle = i % 2 ? '#111' : '#fff';
            ctx.fillRect((i * W) / 14, fy - 6, W / 14, 6);
            ctx.fillStyle = i % 2 ? '#fff' : '#111';
            ctx.fillRect((i * W) / 14, fy, W / 14, 6);
          }
        }
        // Dubalar
        for (const row of S.rows) {
          const y = L.py - (row.y - S.y);
          if (y < -40 || y > H + 40) continue;
          if (row.warm && !row.resolved) {
            // Isınma: boşluğu göster
            ctx.fillStyle = 'rgba(255,207,61,.18)';
            ctx.fillRect(row.gx - row.gap / 2, y - 18 * k, row.gap, 36 * k);
            ctx.fillStyle = 'rgba(255,207,61,.95)';
            ctx.font = `800 ${Math.round(12 * k)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('BOŞLUKTAN GEÇ', row.gx, y - 22 * k);
          }
          for (const c of row.cones) {
            ctx.save();
            ctx.translate(c.x, y);
            if (c.fall) ctx.rotate(c.dir * c.fall * 1.4);
            if (!drawSprite(ctx, 'cone', 0, 4 * k, { h: 24 * k, anchor: 'bottom' })) {
              ctx.fillStyle = '#f97316';
              ctx.beginPath();
              ctx.moveTo(0, -16 * k);
              ctx.lineTo(9 * k, 4 * k);
              ctx.lineTo(-9 * k, 4 * k);
              ctx.fill();
            }
            ctx.restore();
          }
        }
        // Oyuncu ve top
        const bob = Math.sin(S.ph) * 2 * k;
        drawTopPlayer(ctx, S.x, L.py, 17 * k, { colors: myKit }, { number: opts.number ?? 8, highlight: true, phase: S.ph, skin: '#d9a57b', facing: 0 });
        drawBall(ctx, S.x, L.py - 22 * k + bob, 7 * k, S.t * 12);
        if (S.targetX == null && !S.over) {
          ctx.font = `800 ${Math.round(14 * k)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,.92)';
          ctx.fillText('Parmağını sürükleyerek yön ver', W / 2, H - 22);
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (!L) return;
        if (kind === 'down' || kind === 'move') S.targetX = p.x;
      },
    });
  });
}
