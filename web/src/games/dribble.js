// ADAMI GEÇ — top ayağında ileri koşu (seçmelerdeki çalım istasyonu + hız antrenmanı; tek oyun).
// Parmağını sağa-sola sürükle: dubalı sıralarda boşluktan geç; RAKİP sıralarında savunmacı seni kollar:
// bir yana yüklen, o gelince öbür yana kır (gövde çalımı). Koşu giderek hızlanır.
// Sürat statı ileri hızı ve yana çevikliği belirler. Piksel oyuncular.
import { createStage, Particles, BigText, clamp, lerp } from './engine.js';
import { drawSprite, spritePattern } from '../assets/sprites.js';
import { drawPixelPlayer, drawPixelBall } from './pixel/sprites.js';
import { npcLook, lookFromAvatar } from './pixel/looks.js';
import { sfx, buzz } from '../audio.js';

/** Parkur üretimi (saf): sıra tipleri ve boşluklar. Testlerde de kullanılır. */
export function buildCourse({ rows = 8, warmup = true, men = true, rnd = Math.random, k = 1, W = 390 } = {}) {
  const out = [];
  let y = 300 * k;
  let side = rnd() < 0.5 ? -1 : 1;
  const total = rows + (warmup ? 1 : 0);
  for (let i = 0; i < total; i++) {
    const warm = warmup && i === 0;
    const level = warm ? 0 : (i - (warmup ? 1 : 0)) / Math.max(1, rows - 1);
    // ilk iki sıra hep duba; sonra duba/rakip dönüşümlü, sona doğru çift rakip
    const idx = i - (warmup ? 1 : 0);
    const type = !men || warm || idx < 2 ? 'cones' : idx % 2 === 0 ? 'man' : level > 0.6 ? 'pair' : 'cones';
    const gap = lerp(130, 84, level) * k;
    const gx = clamp(W / 2 + side * lerp(0.12, 0.3, rnd()) * W, gap / 2 + 18 * k, W - gap / 2 - 18 * k);
    side *= -1;
    out.push({ i, y, type, gx, gap, warm, level });
    y += lerp(250, 185, level) * k;
  }
  return { rows: out, finishY: y + 40 * k };
}

/**
 * @param {{skill?:number, rows?:number, onAttempt?:(success:boolean)=>{stationOver:boolean}, isWarmup?:()=>boolean,
 *   myKit?:object, oppKit?:object, me?:object, number?:number, tempo?:number, expose?:object}} opts
 * @returns {Promise<{success:boolean, accuracy:number, outcome:string, clean:number, rows:number, topSpeed:number}>}
 */
export function playDribble(host, opts = {}) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.4, 0.02, 1);
    const e = 0.25 + 0.75 * skill;
    const station = typeof opts.onAttempt === 'function';
    const myClub = opts.myKit || { colors: ['#2563eb', '#ffffff'] };
    const oppClub = opts.oppKit || { colors: ['#f97316', '#1e293b'] };
    const meLook = opts.me || lookFromAvatar({}, myClub, { number: String(opts.number ?? 8) });
    const particles = new Particles();
    const big = new BigText();
    let L = null;
    const S = { t: 0, y: 0, x: 0, vx: 0, targetX: null, speed: 0, stumble: 0, rows: [], over: false, endT: 0, done: false, ph: 0, clean: 0, scored: 0, topV: 0 };
    const nRows = opts.rows || 8;

    function layout(W, H) {
      const k = Math.min(W / 390, H / 700);
      const first = !L;
      L = { W, H, k, py: H * 0.76, pr: 12 * k, cr: 10 * k, spacing: 46 * k, v0: lerp(165, 205, e) * k, lat: lerp(330, 480, e) * k, ph: 46 * k };
      if (first) {
        S.x = W / 2;
        S.speed = L.v0;
        const c = buildCourse({ rows: nRows, warmup: station ? opts.isWarmup?.() !== false : true, men: true, k, W });
        S.finishY = c.finishY;
        S.rows = c.rows.map((r, i) => {
          const row = { ...r, hit: false, resolved: false };
          if (r.type === 'cones') {
            row.cones = [];
            for (let x = 14 * k; x < W - 8 * k; x += L.spacing) if (Math.abs(x - r.gx) >= r.gap / 2) row.cones.push({ x, hit: false, fall: 0 });
          } else {
            // rakip(ler): boşluğu kapatmaya çalışan savunmacı; çiftte iki savunmacı arası boşluk
            const n = r.type === 'pair' ? 2 : 1;
            row.men = Array.from({ length: n }, (_, j) => ({
              x: n === 1 ? r.gx : r.gx + (j === 0 ? -1 : 1) * (r.gap * 0.5 + 16 * k),
              vx: 0,
              hist: [],
              look: npcLook(oppClub, 300 + i * 11 + j),
              lunge: 0,
              half: 21 * k, // gövde + uzanan bacak yarı genişliği
            }));
            row.react = lerp(0.42, 0.24, r.level) * lerp(1.15, 0.85, 1 - e);
            row.vmax = lerp(150, 235, r.level) * k * lerp(1.1, 0.85, e);
          }
          return row;
        });
      }
      if (opts.expose) Object.assign(opts.expose, { L, S });
    }

    function resolveRow(row) {
      row.resolved = true;
      const success = !row.hit;
      if (!row.warm) {
        S.scored++;
        if (success) S.clean++;
      }
      const res = station ? opts.onAttempt(success) : null;
      if (success) {
        big.show(row.warm ? 'SÜPER!' : row.type === 'cones' ? 'TEMİZ!' : 'GEÇTİN!', '#c6ff3d', 46);
        sfx('swish');
        buzz('dribble');
      }
      if (res?.stationOver) S.over = true;
    }

    function hitRow(row, x, y) {
      if (row.hit) return;
      row.hit = true;
      S.stumble = 0.55;
      big.show(row.warm ? 'DİKKAT!' : row.type === 'cones' ? 'ÇARPTIN!' : 'TOPU KAPTIRDIN!', '#ff5d6c', 44);
      sfx('tackle');
      buzz('bump');
      stage.shake(9);
      particles.burst(x, y, { n: 12, colors: ['#f97316', '#fff'], speed: 180, life: 0.5 });
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      const n = Math.max(1, S.scored);
      const ratio = S.clean / n;
      const success = ratio >= 0.75;
      setTimeout(() => {
        stage.stop();
        resolve({ success, accuracy: success ? clamp((ratio - 0.75) / 0.25 * 0.6 + 0.4, 0, 1) : 0, outcome: success ? 'clean' : 'hit', clean: S.clean, rows: S.scored });
      }, 60);
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        if (!L || L.W !== stage.W || L.H !== stage.H) layout(stage.W, stage.H);
        S.t += dt;
        particles.update(dt);
        big.update(dt);
        if (S.over) {
          S.endT += dt;
          S.speed = lerp(S.speed, 0, 0.05);
          S.y += S.speed * dt;
          S.ph += (S.speed / (40 * L.k)) * dt * 4;
          if (S.endT > 1.4) finish();
          return;
        }
        S.stumble = Math.max(0, S.stumble - dt);
        const target = L.v0 * (1 + Math.min(0.45, S.y / (2600 * L.k)));
        S.speed = lerp(S.speed, S.stumble > 0 ? target * 0.45 : target, 0.08);
        S.y += S.speed * dt;
        S.ph += (S.speed / (40 * L.k)) * dt * 4;
        const prevX = S.x;
        if (S.targetX != null) S.x += clamp(S.targetX - S.x, -L.lat * dt, L.lat * dt);
        S.x = clamp(S.x, L.pr, L.W - L.pr);
        S.vx = (S.x - prevX) / Math.max(dt, 1e-4);
        for (const row of S.rows) {
          if (row.resolved) continue;
          const dy = row.y - S.y; // sıranın oyuncunun ne kadar önünde olduğu
          const sy = L.py - dy;
          if (row.men) {
            // savunmacı: gecikmeli olarak senin x'ini takip eder (yaklaşınca); geçince bırakır
            for (const m of row.men) {
              m.hist.push({ t: S.t, x: S.x });
              while (m.hist.length && m.hist[0].t < S.t - 1) m.hist.shift();
              if (dy < 300 * L.k && dy > -L.pr) {
                const lag = m.hist.find((h) => h.t >= S.t - row.react) || { x: S.x };
                let want = lag.x;
                if (row.men.length === 2) {
                  // çift: her biri kendi yarısını korur, aradaki boşluk daralıp genişler
                  const mid = row.gx;
                  const j = row.men.indexOf(m);
                  want = j === 0 ? Math.min(lag.x, mid - 8 * L.k) : Math.max(lag.x, mid + 8 * L.k);
                }
                m.vx = clamp((want - m.x) * 5, -row.vmax, row.vmax);
                m.x = clamp(m.x + m.vx * dt, 20 * L.k, L.W - 20 * L.k);
                if (Math.abs(dy) < 70 * L.k && Math.abs(m.x - S.x) < m.half * 2.2) m.lunge = Math.min(1, m.lunge + dt * 6);
              }
              if (Math.abs(dy) < L.pr + 10 * L.k && Math.abs(m.x - S.x) < m.half + L.pr * 0.6) hitRow(row, S.x, sy);
            }
          } else if (Math.abs(dy) < L.pr + L.cr) {
            for (const c of row.cones) {
              if (!c.hit && Math.abs(c.x - S.x) < L.pr + L.cr * 0.9) {
                c.hit = true;
                c.dir = Math.sign(c.x - S.x) || 1;
                hitRow(row, c.x, sy);
              }
            }
          }
          if (dy < -(L.pr + L.cr)) resolveRow(row);
          break;
        }
        for (const row of S.rows) if (row.cones) for (const c of row.cones) if (c.hit) c.fall = Math.min(1, c.fall + dt * 4);
        if (S.y > S.finishY && !S.over) S.over = true;
      },

      render(ctx, W, H, t) {
        if (!L) return;
        const k = L.k;
        const grass = spritePattern(ctx, 'grass', 72);
        ctx.save();
        ctx.translate(0, S.y % 72);
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
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(6, -10, W - 12, H + 20);
        const fy = L.py - (S.finishY - S.y);
        if (fy > -20 && fy < H + 20) {
          for (let i = 0; i < 14; i++) {
            ctx.fillStyle = i % 2 ? '#111' : '#fff';
            ctx.fillRect((i * W) / 14, fy - 6, W / 14, 6);
            ctx.fillStyle = i % 2 ? '#fff' : '#111';
            ctx.fillRect((i * W) / 14, fy, W / 14, 6);
          }
        }
        // sıralar: arkadakiler önce (ekranda yukarıdakiler)
        const items = [];
        for (const row of S.rows) {
          const y = L.py - (row.y - S.y);
          if (y < -60 || y > H + 60) continue;
          if (row.warm && !row.resolved) {
            ctx.fillStyle = 'rgba(255,207,61,.18)';
            ctx.fillRect(row.gx - row.gap / 2, y - 18 * k, row.gap, 36 * k);
            ctx.fillStyle = 'rgba(255,207,61,.95)';
            ctx.font = `800 ${Math.round(12 * k)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('BOŞLUKTAN GEÇ', row.gx, y - 22 * k);
          }
          if (row.cones) {
            for (const c of row.cones) items.push({ y, fn: () => {
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
            } });
          } else {
            for (const m of row.men) items.push({ y, fn: () => {
              const moving = Math.abs(m.vx) > 20 * k;
              drawPixelPlayer(ctx, m.x, y + 8 * k, L.ph, m.look, {
                dir: m.lunge > 0.5 ? 'side' : moving ? 'side' : 'down',
                flip: (m.lunge > 0.5 ? S.x < m.x : m.vx < 0),
                frame: m.lunge > 0.5 ? 'lunge' : moving ? `run${Math.floor(t * 10) % 4}` : 'idle',
                ring: row.hit ? '#ff5d6c' : 'rgba(255,93,108,.6)',
              });
            } });
          }
        }
        const bob = Math.abs(Math.sin(S.ph * Math.PI * 0.5)) * 2 * k;
        items.push({ y: L.py, fn: () => {
          const side = Math.abs(S.vx) > 260 * k;
          // top ayağın önünde (sahada daha ileride → oyuncudan önce çizilir)
          drawPixelBall(ctx, S.x + S.vx * 0.02, L.py - 2 * k - bob, 12 * k, S.t * 6, { shadow: true });
          drawPixelPlayer(ctx, S.x, L.py + 8 * k, L.ph * 1.05, meLook, {
            dir: side ? 'side' : 'up',
            flip: S.vx < 0,
            frame: S.stumble > 0 ? 'idle' : `run${Math.floor(S.ph) % 4}`,
            rot: S.stumble > 0 ? 0.25 * Math.sin(S.t * 30) : 0,
            marker: '#c6ff3d',
          });
        } });
        items.sort((a, b) => a.y - b.y).forEach((it) => it.fn());
        // HUD: ilerleme
        if (!station) {
          ctx.font = `800 ${Math.round(13 * k)}px system-ui, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(4,10,8,.6)';
          ctx.fillRect(10, 70, 150 * k, 26 * k);
          ctx.fillStyle = '#fff';
          ctx.fillText(`Temiz ${S.clean}/${S.scored}  •  ${nRows} sıra`, 18, 70 + 18 * k);
        }
        if (S.targetX == null && !S.over) {
          ctx.font = `800 ${Math.round(14 * k)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,.92)';
          ctx.fillText('Parmağını sürükleyerek yön ver', W / 2, H - 22);
          ctx.fillStyle = 'rgba(198,255,61,.95)';
          ctx.fillText('Rakip gelince bir yana yüklen, öbür yana kır!', W / 2, H - 44);
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
