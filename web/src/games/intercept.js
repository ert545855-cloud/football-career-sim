// DEFANS — PAS ARASI. Kuşbakışı, piksel oyuncular, fizik (mantık: interceptLogic.js). Maçta ve antrenmanda aynı oyun.
//   Sürükle: koşu yolunu kapat (savunmacın parmağının biraz üstünde durur) · Dokun: ayağını uzat.
//   Top sahibinin bakış çizgisi pasın nereye gideceğini ele verir; bazen sahte bakar!
import { createStage, Particles, BigText, drawPitchTop, roundRect, clamp } from './engine.js';
import { FixedStep, bodySpeed } from './physics.js';
import { createDefense, defenseStep, defMoveTo, defLunge } from './interceptLogic.js';
import { drawPixelPlayer, drawMovingPlayer, drawPixelBall } from './pixel/sprites.js';
import { npcLook, keeperLook, lookFromAvatar } from './pixel/looks.js';
import { sfx, buzz } from '../audio.js';

const TS = 1.35; // fizik saniyesi / oyun saniyesi
const WM = 30;
const HM = 54;

export function playIntercept(host, opts = {}) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const context = opts.context === 'threat' ? 'threat' : 'duel';
    const myClub = opts.myKit || { colors: ['#2563eb', '#ffffff'] };
    const oppClub = opts.oppKit || { colors: ['#b91c1c', '#ffffff'] };
    const meLook = opts.me || lookFromAvatar({}, myClub, { number: String(opts.number ?? 4) });
    const keeper = keeperLook('#22d3ee', 5);
    const particles = new Particles();
    const big = new BigText();
    const fixed = new FixedStep(1 / 120, 30);
    let D = null;
    let ppm = 13;
    let k = 1;
    let ox = 0;
    let oy = 0;
    let lastW = 0;
    let lastH = 0;
    const S = { t: 0, afterT: 0, done: false, hint: 3.5, touch: null, sts: [], meSt: { ph: 0, last: 'up' } };

    function fit(W, H) {
      ppm = Math.min(W / WM, H / HM);
      k = (WM * ppm) / 390;
      ox = (W - WM * ppm) / 2;
      oy = H - HM * ppm;
      lastW = W;
      lastH = H;
    }
    function layout(W, H) {
      fit(W, H);
      D = createDefense({ context, skill, Wm: WM, Hm: HM });
      D.att.forEach((a, i) => { a.look = npcLook(oppClub, 500 + i * 17, [9, 7, 11][i]); });
      S.sts = D.att.map(() => ({ ph: Math.random() * 4, last: 'down' }));
      if (opts.expose) Object.assign(opts.expose, { D, get ppm() { return ppm; }, get ox() { return ox; }, get oy() { return oy; } });
    }

    function onEvents() {
      for (const e of D.events) {
        if (e.type === 'look') buzz('touch');
        else if (e.type === 'pass') { sfx('kick'); buzz('kick'); if (e.through) big.show('ARA PASI!', '#ff9e26', 34); }
        else if (e.type === 'received') buzz('step');
        else if (e.type === 'lunge') { sfx('swish'); buzz('kick'); S.hint = 0; }
        else if (e.type === 'shrug') { big.show('SIYRILDI!', '#ff9e26', 34); buzz('bump'); }
        else if (e.type === 'end') endFx(e);
      }
      D.events.length = 0;
    }

    function endFx(r) {
      big.items = []; // önceki yazılar (ARA PASI! gibi) sonucun üstüne binmesin
      const bx = ox + D.ball.x * ppm;
      const by = oy + D.ball.y * ppm;
      if (r.outcome === 'won') {
        const label = { lunge: 'PAS ARASI!', intercept: 'PAS ARASI!', tackle: 'TOPU KAPTIN!', loose: 'PAS BOŞA GİTTİ', time: 'OYALADIN!' }[r.method] || 'TOPU KAPTIN!';
        big.show(label, '#c6ff3d', 52);
        particles.burst(bx, by, { n: 30, colors: ['#c6ff3d', '#fff'], speed: 240, life: 0.9 });
        sfx('tackle');
        buzz('tackle');
        stage.shake(8);
      } else {
        big.show(r.method === 'dribble' ? 'CEZA SAHASINA GİRDİ!' : 'GEÇİLDİN!', '#ff5d6c', 48);
        sfx('miss');
        buzz('tackleLost');
      }
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      const r = D.result;
      setTimeout(() => {
        stage.stop();
        resolve({ success: r.outcome === 'won', accuracy: r.acc || 0, outcome: r.outcome, method: r.method, passes: r.passes });
      }, 50);
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        if (!D) layout(stage.W, stage.H);
        else if (stage.W !== lastW || stage.H !== lastH) fit(stage.W, stage.H);
        S.t += dt;
        S.hint = Math.max(0, S.hint - dt);
        particles.update(dt);
        big.update(dt);
        fixed.run(dt * TS, (h) => { defenseStep(D, h); });
        D.att.forEach((a, i) => { S.sts[i].ph += bodySpeed(a.body) * dt * TS * 1.1; });
        S.meSt.ph += bodySpeed(D.me) * dt * TS * 1.1;
        onEvents();
        if (D.result) {
          S.afterT += dt;
          if (S.afterT > 1.6) finish();
        }
      },

      render(ctx, W, H, t) {
        if (!D) return;
        const WW = WM * ppm;
        if (ox > 1) {
          ctx.fillStyle = '#0b2a17';
          ctx.fillRect(0, 0, W, H);
        }
        ctx.save();
        ctx.translate(ox, 0);
        drawPitchTop(ctx, WW, H, { box: 'bottom' });
        ctx.translate(0, oy);
        const P = (o) => ({ x: o.x * ppm, y: o.y * ppm });
        const ph = 44 * k;
        // bakış çizgisi: pasın gideceği yer (sahte de olabilir)
        if (D.phase === 'look' && D.look && !D.result) {
          const c = P(D.att[D.carrier].body);
          const to = D.look.through ? { x: (D.me.x + (D.att[D.look.to].body.x < D.me.x ? -4.5 : 4.5)) * ppm, y: (D.me.y + 5) * ppm } : P(D.att[D.look.to].body);
          const a = clamp(D.look.t / D.look.dur, 0, 1);
          ctx.setLineDash([5, 7]);
          ctx.lineWidth = 2.5 * k;
          ctx.strokeStyle = `rgba(255,207,61,${0.25 + 0.6 * a})`;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y - ph * 0.6);
          ctx.lineTo(to.x, to.y - ph * 0.3);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = `900 ${Math.round(16 * k)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255,207,61,${0.5 + 0.5 * Math.sin(t * 14)})`;
          ctx.fillText('!', to.x, to.y - ph * 1.15);
        }
        // menzil halkası (top pas halindeyken uzanma menzilindeyse yeşil)
        if (!D.result) {
          const m = P(D.me);
          const inLunge = D.phase === 'pass' && Math.hypot(D.ball.x - D.me.x, D.ball.y - D.me.y) <= D.sk.lungeReach * 1.15;
          const r = (D.lunge > 0 ? D.sk.lungeReach : D.sk.reach) * ppm;
          ctx.beginPath();
          ctx.ellipse(m.x, m.y - 2 * k, r, r * 0.55, 0, 0, Math.PI * 2);
          ctx.fillStyle = inLunge ? 'rgba(198,255,61,.2)' : 'rgba(255,255,255,.05)';
          ctx.fill();
          ctx.lineWidth = inLunge ? 3 : 1.5;
          ctx.strokeStyle = inLunge ? 'rgba(198,255,61,.95)' : 'rgba(255,255,255,.35)';
          ctx.stroke();
        }
        // parmak hedefi
        if (S.touch?.drag && D.target) {
          const m = P(D.me);
          ctx.strokeStyle = 'rgba(255,255,255,.35)';
          ctx.setLineDash([4, 6]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(D.target.x * ppm, D.target.y * ppm);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // oyuncular (y sırasıyla)
        const items = [];
        items.push({ y: HM * ppm * 0.985, fn: () => drawPixelPlayer(ctx, WW / 2, HM * ppm * 0.985, ph * 0.95, keeper, { dir: 'up', frame: 'idle' }) });
        D.att.forEach((a, i) => {
          const p = P(a.body);
          items.push({ y: p.y, fn: () => drawMovingPlayer(ctx, p.x, p.y, ph, a.look, a.body.vx, a.body.vy, S.sts[i], { face: 'down', ring: i === D.carrier && D.phase !== 'pass' ? '#ff9e26' : 'rgba(255,93,108,.55)' }) });
        });
        const m = P(D.me);
        const lunging = D.lunge > 0;
        items.push({ y: m.y, fn: () => {
          if (lunging) drawPixelPlayer(ctx, m.x, m.y, ph * 1.05, meLook, { dir: 'side', frame: 'lunge', flip: D.ball.x < D.me.x, marker: '#c6ff3d' });
          else drawMovingPlayer(ctx, m.x, m.y, ph * 1.05, meLook, D.me.vx, D.me.vy, S.meSt, { face: 'up', marker: '#c6ff3d', rot: D.me.stun > 0 ? 0.3 : 0 });
        } });
        items.sort((a, b) => a.y - b.y).forEach((it) => it.fn());
        const b = P(D.ball);
        drawPixelBall(ctx, b.x, b.y - 2 * k, 12 * k, D.ball.rot * 2);
        ctx.restore();

        // HUD
        if (!D.result) {
          ctx.fillStyle = 'rgba(4,10,8,.6)';
          roundRect(ctx, 10, 66, 220, 28, 10);
          ctx.fill();
          ctx.font = '800 13px system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillStyle = '#fff';
          ctx.fillText(`Pas ${Math.min(D.passes + 1, D.limit)}/${D.limit}  •  ${D.passes >= D.limit - 1 ? 'SON PAS: ARA PASI!' : 'Bakışı oku'}`, 20, 85);
        }
        if (context === 'threat' && !D.result) {
          ctx.font = '900 13px system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillStyle = `rgba(255,93,108,${0.6 + 0.4 * Math.sin(t * 8)})`;
          ctx.fillText('KONTRA ATAK!', W - 14, 85);
        }
        if (!D.result && S.hint > 0) {
          ctx.font = '800 13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(4,10,8,.6)';
          roundRect(ctx, W / 2 - 170, H * 0.8 - 22, 340, 50, 10);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.95)';
          ctx.fillText('Sürükle: pas koridorunu kapat', W / 2, H * 0.8 - 2);
          ctx.fillStyle = 'rgba(198,255,61,.95)';
          ctx.fillText('Dokun: top yanından geçerken ayağını uzat', W / 2, H * 0.8 + 18);
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (!D || D.result) return;
        const OFF = 58 * k;
        if (kind === 'down') {
          S.touch = { sx: p.x, sy: p.y, t0: p.time, moved: 0, lx: p.x, ly: p.y, drag: false };
        } else if (kind === 'move' && S.touch) {
          const tc = S.touch;
          tc.moved += Math.hypot(p.x - tc.lx, p.y - tc.ly);
          tc.lx = p.x;
          tc.ly = p.y;
          if (!tc.drag && (tc.moved > 14 * k || p.time - tc.t0 > 260)) tc.drag = true;
          if (tc.drag) defMoveTo(D, (p.x - ox) / ppm, (p.y - oy - OFF) / ppm);
        } else if (kind === 'up' && S.touch) {
          const tc = S.touch;
          S.touch = null;
          if (!tc.drag && p.time - tc.t0 < 300) defLunge(D);
        }
      },
    });
  });
}
