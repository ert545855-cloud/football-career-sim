// MÜDAHALE — kuşbakışı, fizik motoru üstünde (mantık: tackleLogic.js).
//   Sürükle: pozisyon al (oyuncun parmağının biraz üstünde durur) · bırakınca otomatik jokey.
//   Dokun: topa uzan (dürtme) · Hızlı kaydır: o yöne kayarak müdahale.
// Top hücumcunun ayağından açıldığında menzil halkası yeşile döner: en temiz an.
import { createStage, Particles, BigText, drawBall, drawTopPlayer, drawPitchTop, drawShadow, roundRect, clamp } from './engine.js';
import { FixedStep, bodySpeed } from './physics.js';
import { createDuel, duelStep, duelPoke, duelSlide, duelMoveTo, ballLoose, inPokeReach } from './tackleLogic.js';
import { sfx, buzz } from '../audio.js';

const TS = 1.6; // fizik saniyesi / oyun saniyesi
// Sabit dünya (metre): oynanış her ekran oranında aynı; ekrana sığdırılır (alta hizalı, yatayda ortalı)
const WM = 30;
const HM = 54;

export function playTackle(host, opts) {
  return new Promise((resolve) => {
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const threat = opts.context === 'threat';
    const myKit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const oppKit = opts.oppKit?.colors || ['#b91c1c', '#fff'];
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
    const S = { t: 0, afterT: 0, done: false, hint: 3.2, touch: null, slideFrom: null, attPh: 0, defPh: 0, flash: 0, cardT: 0 };

    function fit(W, H) {
      ppm = Math.min(W / WM, H / HM);
      k = (WM * ppm) / 390;
      ox = (W - WM * ppm) / 2;
      oy = H - HM * ppm;
      lastW = W;
      lastH = H;
      if (opts.expose) Object.assign(opts.expose, { ppm, ox, oy });
    }
    function layout(W, H) {
      fit(W, H);
      D = createDuel({ Wm: WM, Hm: HM, skill, threat });
      if (opts.expose) Object.assign(opts.expose, { D });
    }

    function onEvents() {
      for (const e of D.events) {
        if (e.type === 'touch') buzz('step');
        else if (e.type === 'knock') { sfx('kick'); buzz('dribble'); }
        else if (e.type === 'poke') { sfx('swish'); buzz('kick'); S.hint = 0; }
        else if (e.type === 'slide') {
          sfx('swish');
          buzz('slide');
          S.hint = 0;
          S.slideFrom = { x: D.def.x, y: D.def.y };
        } else if (e.type === 'miss') { big.show(e.kind === 'slide' ? 'ISKA!' : 'BOŞA UZANDIN', '#ff9e26', 34); buzz('tackleLost'); }
        else if (e.type === 'shrug') { big.show('SIYRILDI!', '#ff9e26', 34); buzz('bump'); }
        else if (e.type === 'shoulder') {
          big.show(e.won ? 'OMUZ OMUZA!' : 'DENGEN BOZULDU', e.won ? '#c6ff3d' : '#ff9e26', 32);
          buzz('shoulder');
          stage.shake(e.won ? 7 : 4);
          sfx('tackle');
        } else if (e.type === 'deflect') { sfx('kick'); buzz('bump'); }
        else if (e.type === 'feint') buzz('touch');
        else if (e.type === 'end') endFx(e);
      }
      D.events.length = 0;
    }

    function endFx(r) {
      const bx = ox + D.ball.x * ppm;
      const by = oy + D.ball.y * ppm;
      if (r.outcome === 'won') {
        const label = { slide: 'KAYARAK ALDI!', poke: 'TOPU KAPTIN!', block: 'ARAYA GİRDİN!', out: 'TOP DIŞARIDA', time: 'OYALADIN!' }[r.method] || 'TOPU KAPTIN!';
        big.show(label, '#c6ff3d', 52);
        particles.burst(bx, by, { n: r.method === 'slide' ? 40 : 28, colors: ['#c6ff3d', '#fff', '#3a2a1a'], speed: 260, life: 0.9 });
        sfx('tackle');
        buzz(r.method === 'slide' ? 'slide' : 'tackle');
        stage.shake(r.method === 'slide' ? 12 : 8);
      } else if (r.outcome === 'foul') {
        big.show('FAUL!', '#ff5d6c', 58);
        sfx('whistle');
        buzz('foul');
        stage.shake(6);
        if (r.card) S.cardT = 0.001;
      } else {
        big.show(r.outcome === 'early' ? 'ERKEN DALDIN!' : 'GEÇİLDİN!', '#ff5d6c', 48);
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
        resolve({ success: r.outcome === 'won', accuracy: r.acc || 0, outcome: r.outcome, method: r.method, card: r.card || null });
      }, 50);
    }

    const stage = createStage(host, {
      tempo: opts.tempo ?? 1,
      update(dt) {
        if (!D) layout(stage.W, stage.H);
        else if (stage.W !== lastW || stage.H !== lastH) fit(stage.W, stage.H); // ekran döndü: oyun sürer, yalnız ölçek değişir
        S.t += dt;
        S.hint = Math.max(0, S.hint - dt);
        particles.update(dt);
        big.update(dt);
        fixed.run(dt * TS, (h) => { duelStep(D, h); });
        S.attPh += bodySpeed(D.att) * dt * 2.2;
        S.defPh += bodySpeed(D.def) * dt * 2.2;
        if (S.cardT > 0) S.cardT += dt;
        onEvents();
        if (D.result) {
          S.afterT += dt;
          if (S.afterT > (D.result.card ? 2.1 : 1.6)) finish();
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
        const a = P(D.att);
        const d = P(D.def);
        const b = P(D.ball);
        const s = 18 * k;
        // dürtme menzili: top açık + menzilde = yeşil (şimdi!)
        if (!D.result && D.def.stun <= 0 && D.act?.kind !== 'slide') {
          const ready = ballLoose(D) && inPokeReach(D);
          const inR = inPokeReach(D);
          ctx.beginPath();
          ctx.arc(d.x, d.y, D.sk.reach * ppm, 0, Math.PI * 2);
          ctx.fillStyle = ready ? 'rgba(198,255,61,.2)' : inR ? 'rgba(255,158,38,.12)' : 'rgba(255,255,255,.05)';
          ctx.fill();
          ctx.lineWidth = ready ? 3 : 1.5;
          ctx.strokeStyle = ready ? 'rgba(198,255,61,.95)' : inR ? 'rgba(255,158,38,.75)' : 'rgba(255,255,255,.35)';
          ctx.stroke();
        }
        // parmak hedefi
        if (S.touch && D.target) {
          ctx.strokeStyle = 'rgba(255,255,255,.35)';
          ctx.setLineDash([4, 6]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(D.target.x * ppm, D.target.y * ppm);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // kayma izi
        if (D.act?.kind === 'slide' && S.slideFrom) {
          ctx.strokeStyle = 'rgba(255,255,255,.4)';
          ctx.lineWidth = 7 * k;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(S.slideFrom.x * ppm, S.slideFrom.y * ppm);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
        }
        // kaleci
        drawTopPlayer(ctx, WW / 2, H * 0.95 - oy, 14 * k, { colors: ['#f59e0b', '#111'] }, { phase: t * 2, ring: '#e0f2fe' });
        // hücumcu (yerdeyse yatık)
        const attDown = D.result?.outcome === 'foul' || D.att.stun > 0.5;
        drawTopPlayer(ctx, a.x, a.y, s, { colors: oppKit }, { facing: D.att.facing + (attDown ? 1.3 : 0), phase: S.attPh, skin: '#9a6440', ring: '#ff5d6c' });
        // savunmacı (sen)
        const sliding = D.act?.kind === 'slide';
        const face = sliding ? Math.atan2(D.act.ux, -D.act.uy) : D.def.stun > 0 ? D.def.facing + 1.4 : Math.atan2(D.ball.x - D.def.x, -(D.ball.y - D.def.y));
        drawTopPlayer(ctx, d.x, d.y, s * 1.08, { colors: myKit }, { number: opts.number ?? 4, facing: face, phase: sliding ? 0 : S.defPh, highlight: true, skin: opts.skin || '#d9a57b' });
        // dürtme: uzanan bacak
        if (D.act?.kind === 'poke') {
          const p = Math.sin(clamp(D.act.t / D.act.dur, 0, 1) * Math.PI);
          const ux = D.ball.x - D.def.x;
          const uy = D.ball.y - D.def.y;
          const l = Math.hypot(ux, uy) || 1;
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 5 * k;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + (ux / l) * D.sk.reach * ppm * p, d.y + (uy / l) * D.sk.reach * ppm * p);
          ctx.stroke();
        }
        // top (yükseklik: gölge + büyüme)
        const bh = clamp(D.ball.z / 2.5, 0, 1.2);
        if (bh > 0.02) drawShadow(ctx, b.x + bh * 8 * k, b.y + bh * 10 * k, 6 * k, 3.5 * k, 0.3);
        drawBall(ctx, b.x, b.y - bh * 16 * k, 7 * k * (1 + 0.3 * bh), D.ball.rot * 4);
        ctx.restore();

        if (threat && !D.result) {
          ctx.font = '900 13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255,93,108,${0.6 + 0.4 * Math.sin(t * 8)})`;
          ctx.fillText('KONTRA ATAK!', W / 2, 74);
        }
        if (!D.result && S.hint > 0) {
          ctx.font = '800 13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(4,10,8,.55)';
          roundRect(ctx, W / 2 - 170, H * 0.82 - 22, 340, 50, 10);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.95)';
          ctx.fillText('Sürükle: pozisyon al  •  Dokun: topa uzan', W / 2, H * 0.82 - 2);
          ctx.fillStyle = 'rgba(198,255,61,.95)';
          ctx.fillText('Hızlı kaydır: kayarak müdahale (halka yeşilken!)', W / 2, H * 0.82 + 18);
        }
        // sarı kart
        if (S.cardT > 0.35) {
          const p = clamp((S.cardT - 0.35) / 0.25, 0, 1);
          ctx.save();
          ctx.translate(W / 2, H * 0.3);
          ctx.rotate(-0.12);
          ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p);
          ctx.globalAlpha = p;
          ctx.fillStyle = '#facc15';
          roundRect(ctx, -26, -38, 52, 76, 6);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.35)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.font = '900 15px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff';
          ctx.fillText('SARI KART', 0, 62);
          ctx.restore();
        }
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (!D || D.result) return;
        const OFF = 58 * k; // savunmacı parmağın biraz üstünde dursun (parmak onu kapatmasın)
        if (kind === 'down') {
          S.touch = { sx: p.x, sy: p.y, t0: p.time, moved: 0, lx: p.x, ly: p.y, drag: false };
        } else if (kind === 'move' && S.touch) {
          const tc = S.touch;
          tc.moved += Math.hypot(p.x - tc.lx, p.y - tc.ly);
          tc.lx = p.x;
          tc.ly = p.y;
          // sürükleme: hızlı kaydırmadan ayırmak için kısa bir eşik (dokunma/kaydırma hedefi değiştirmez)
          const el = p.time - tc.t0;
          if (!tc.drag && ((el > 160 && tc.moved / el < 0.5) || el > 330)) tc.drag = true;
          if (tc.drag) duelMoveTo(D, (p.x - ox) / ppm, (p.y - oy - OFF) / ppm);
        } else if (kind === 'up' && S.touch) {
          const tc = S.touch;
          S.touch = null;
          const dur = p.time - tc.t0;
          const dx = p.x - tc.sx;
          const dy = p.y - tc.sy;
          if (tc.drag) duelMoveTo(D, null);
          else if (dur < 330 && Math.hypot(dx, dy) >= 38 * k) duelSlide(D, dx, dy);
          else if (dur < 280 && tc.moved < 16 * k) duelPoke(D);
        }
      },
    });
  });
}
