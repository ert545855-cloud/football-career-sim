// ŞUT — oyuncunun arkasından kaleye bakış. Kaydır: yön + güç. Kaleci tepki verir.
import { createStage, Particles, BigText, drawShadow, makeCrowd, drawCrowd, drawTimer, ease, clamp, lerp, gaussian, roundRect } from './engine.js';
import { sfx, buzz } from '../audio.js';
import { FAN_SPRITES, FLAG_SPRITES, drawSprite, spriteSize } from '../assets/sprites.js';
import { drawPixelPlayer, drawPixelBall } from './pixel/sprites.js';
import { keeperLook, npcLook } from './pixel/looks.js';
import { weatherFx } from './weatherFx.js';

const persp = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 1.5);

/**
 * @param {HTMLElement} host
 * @param {{skill:number, context:'box'|'edge'|'penalty', keeper:number, myKit:object, oppKit:object, timeLimit?:number}} opts
 * @returns {Promise<{success:boolean, accuracy:number, outcome:string}>}
 */
export function playShot(host, opts) {
  return new Promise((resolve) => {
    const type = opts.context || 'box';
    /** Hedef modu (seçme kampı): {u, v, r} kale koordinatlarında; kaleci çıkmaz */
    const target = opts.target || null;
    const skill = clamp(opts.skill ?? 0.3, 0.02, 1);
    const kq = clamp(opts.keeper ?? 0.5, 0, 1);
    const fk = type === 'freekick';
    const sigma = lerp(0.3, 0.05, skill) * (type === 'edge' ? 1.25 : type === 'penalty' ? 0.7 : fk ? 1.1 : 1);
    const timeLimit = opts.timeLimit ?? (type === 'penalty' || fk ? 0 : 6);
    const myKit = opts.myKit?.colors || ['#2563eb', '#fff'];
    const oppKit = opts.oppKit?.colors || ['#b91c1c', '#fff'];
    const keeperColor = opts.keeperColor || '#22d3ee';
    const keeperPx = keeperLook(keeperColor, 9);
    const defPx = npcLook(opts.oppKit || { colors: oppKit }, 41, 4);
    const ballOffset = type === 'penalty' ? 0 : fk ? (Math.random() < 0.5 ? -1 : 1) * lerp(0.08, 0.2, Math.random()) : (Math.random() - 0.5) * 0.3;
    /** Dönen top (kaleci çeldi, top ceza sahasında kaldı) şansı: ıslak zeminde daha yüksek */
    const reboundP = type === 'penalty' || opts.target ? 0 : 0.42 + (opts.weather?.surface === 'wet' ? 0.15 : 0);
    const defOffset = (Math.random() - 0.5) * 0.7;
    const penaltySide = [-0.68, 0, 0.68][Math.floor(Math.random() * 3)];

    const particles = new Particles();
    const big = new BigText();
    // Hava: rüzgâr şutu yana iter, ıslak top kalecinin elinden kayabilir, karda top yavaşlar
    const weather = opts.weather || null;
    const windX = weather?.wind?.x || 0;
    const wArea = { y0: 0 };
    const wfx = weatherFx(weather, wArea);
    const fatigue = clamp(opts.fatigue ?? 0, 0, 0.65);
    let L = null;
    let crowd = null;
    let fans = [];
    let flags = [];
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
      const by = type === 'edge' ? H * 0.87 : type === 'penalty' ? H * 0.7 : fk ? H * 0.9 : H * 0.78;
      const r0 = W * (type === 'edge' ? 0.05 : type === 'penalty' ? 0.04 : fk ? 0.05 : 0.045);
      L = { W, H, hy, gl, gw, gh, cx: W / 2, by, bx: W / 2 + ballOffset * W, r0, r1: gw * 0.034, boxY: H * 0.83 };
      wArea.y0 = Math.round(hy);
      crowd = makeCrowd(W, 0, hy - 14, [myKit[0], myKit[1], oppKit[0], '#e2e8f0', '#94a3b8', '#fde68a']);
      // Ön sıra piksel taraftarlar (atlas) — gol olunca zıplarlar
      const fanH = Math.max(22, Math.min(34, hy * 0.27));
      const fanW = spriteSize(FAN_SPRITES[0] || '', { h: fanH }).w || fanH * 0.65;
      fans = [];
      for (let x = fanW * 0.4, i = 0; x < W; x += fanW * 0.82, i++) {
        fans.push({ name: FAN_SPRITES[Math.floor(Math.random() * FAN_SPRITES.length)], x: x + (Math.random() - 0.5) * 4, ph: Math.random() * 6.28, flip: Math.random() < 0.5, h: fanH * (0.92 + Math.random() * 0.12) });
      }
      // Taraftarların tuttuğu birkaç bayrak / atkı
      flags = Array.from({ length: Math.max(2, Math.round(W / 130)) }, (_, k) => ({
        name: FLAG_SPRITES[Math.floor(Math.random() * FLAG_SPRITES.length)],
        x: ((k + 0.5) / Math.max(2, Math.round(W / 130))) * W + (Math.random() - 0.5) * 30,
        ph: Math.random() * 6.28,
      }));
      S.ball = { x: L.bx, y: L.by, r: L.r0, alt: 0 };
      if (fk) {
        // BARAJ: topla kale arasında, yakın direği kapatan 4 kişilik duvar
        const fd = 0.36;
        const pp = persp(fd);
        const h = lerp(H * 0.16, gh, pp);
        const near = ballOffset > 0 ? 1 : -1; // top sağdaysa sağ direk yakın
        const cx0 = lerp(L.bx, gx(near * 0.42), pp);
        const n = 4;
        const wpx = h * 0.36;
        L.wall = { fd, h, jump: 0, xs: Array.from({ length: n }, (_, i) => cx0 + (i - (n - 1) / 2) * wpx), w: wpx, look: Array.from({ length: n }, (_, i) => npcLook(opts.oppKit || { colors: oppKit }, 50 + i, 2 + i)) };
        S.kOff = -near * 0.28; // kaleci açık tarafa yakın durur
      }
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
    // Yorgunluk: yavaş, geniş bir salınım (nefes nefese)
    const sway = () => {
      const o = nerves > 0 ? { u: Math.sin(S.t * 2.6) * nerves * 0.34 + Math.sin(S.t * 6.1) * nerves * 0.06, v: Math.sin(S.t * 3.3 + 1.2) * nerves * 0.2 } : { u: 0, v: 0 };
      if (fatigue > 0.05) { o.u += Math.sin(S.t * 1.4 + 0.5) * fatigue * 0.3; o.v += Math.sin(S.t * 1.9) * fatigue * 0.16; }
      return o;
    };

    /** Kaydırma yolunun eğriliği → falso (−1 sola … +1 sağa kıvrılır) */
    function curlFromDrag(d) {
      const pts = d.pts || [];
      if (pts.length < 4) return 0;
      const ax = d.x0; const ay = d.y0; const bx = d.x; const by = d.y;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      let best = 0;
      for (const q of pts) {
        const dev = ((bx - ax) * (q.y - ay) - (by - ay) * (q.x - ax)) / len; // işaretli dik uzaklık
        if (Math.abs(dev) > Math.abs(best)) best = dev;
      }
      return clamp(best / (len * 0.28), -1, 1);
    }

    function aimFromDrag(d) {
      const dx = d.x - d.x0;
      const dy = d.y - d.y0;
      if (dy > -14) return null;
      const xg = L.bx + (dx * (L.by - L.gl)) / -dy;
      const sw = sway();
      const u = (xg - L.cx) / (L.gw / 2) + sw.u;
      const power = clamp(Math.hypot(dx, dy) / (L.H * 0.38), 0.05, 1.45);
      const v = clamp((power - 0.2) / 0.85 + sw.v, 0, 1.7);
      return { u, v, power, curl: fk || S.rebound ? curlFromDrag(d) : 0 };
    }

    /** Top barajın hizasında duvara çarpar mı? (önizleme ve şut aynı hesabı kullanır) */
    function wallBlocks(u, v, curl) {
      const w = L.wall;
      if (!w) return false;
      const pp = persp(w.fd);
      const xAt = lerp(L.bx, gx(u), pp) + curl * 0.55 * (L.gw / 2) * Math.sin(Math.PI * w.fd);
      const altAt = v * L.gh * pp + Math.sin(Math.PI * w.fd) * L.gh * (0.35 + 0.9 * clamp(v, 0, 1.2));
      const wallTop = w.h * 1.04;
      const inWall = w.xs.some((x) => Math.abs(xAt - x) < w.w / 2 + L.r0 * 0.5);
      return inWall && altAt < wallTop;
    }

    function shoot(aim) {
      // PANENKA: penaltıda kısa ve yavaş, ortaya doğru kaydırma → yumuşak aşırtma
      const panenka = type === 'penalty' && aim.power < 0.4 && Math.abs(aim.u) < 0.35;
      S.panenka = panenka;
      let T = lerp(1.0, 0.42, clamp(aim.power / 1.1, 0, 1)) * (weather?.surface === 'snow' ? 1.08 : weather?.surface === 'heavy' ? 1.05 : 1);
      if (fk) T *= 1.25;
      if (panenka) T = 1.25;
      // Rüzgâr: uçuş süresi ve yükseklikle artan yan sapma
      const drift = windX * 0.016 * T * (0.6 + Math.min(1, aim.v));
      const curl = aim.curl || 0;
      let u = aim.u + gaussian() * sigma * (1 + Math.abs(curl) * 0.25) + drift + curl * 0.1;
      let v = Math.max(0, aim.v + gaussian() * sigma * 0.8);
      if (panenka) { u = aim.u * 0.3 + gaussian() * 0.05; v = 0.5 + Math.random() * 0.15; }
      const absU = Math.abs(u);
      const ballU = L.r1 / (L.gw / 2);
      let outcome;

      // Ön savunmacı bloğu (ceza sahası dışı)
      let blocked = false;
      // Baraj: top barajın hizasındayken yeterince yüksekte değilse ya da kıvrılıp dolanmadıysa çarpar
      if (wallBlocks(u, v, curl)) blocked = true;
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
      else if (target) {
        // Seçme kampı: kaleci yok; top kale içinde, hedef halkasına isabet ölçülür
        outcome = 'goal';
        S.targetHit = Math.hypot((u - target.u) / target.r, (v - target.v) / (target.r * 1.15)) <= 1;
        k.to = k.u;
      } else {
        // Baraj görüşü kapatır (geç tepki); dönen topta kaleci yerde (yavaş, kısa uzanma)
        const rd = lerp(0.32, 0.18, kq) + skill * 0.06 + (fk ? 0.14 : 0) + (S.rebound ? 0.28 : 0);
        const vk = lerp(1.7, 2.7, kq) * (S.rebound ? 0.55 : 1);
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
        let reach = (0.3 + 0.12 * kq) * (weather?.surface === 'wet' ? 0.93 : weather?.surface === 'snow' ? 0.95 : 1) * (S.rebound ? 0.75 : 1);
        if (Math.abs(curl) > 0.35) reach *= 0.9; // falsolu top kaleciyi yanıltır
        if (fk) reach *= 0.88; // baraj görüşü kapattı
        if (v > 0.75 && absU > 0.55) reach *= 0.7;
        if (v < 0.25 && absU > 0.6) reach *= 0.85;
        outcome = Math.abs(u - k.to) <= reach ? 'save' : 'goal';
        if (panenka) {
          // Kaleci bir köşeye atlarsa top ortadan süzülür; yerinde kalırsa kucağına
          outcome = penaltySide === 0 || v > 1 ? 'save' : 'goal';
          k.to = penaltySide;
        }
        k.reactAt = rd;
        k.diveV = v;
      }
      if (outcome !== 'save' && outcome !== 'goal') {
        // Kaleci yine de bir yöne hamle yapar (görsel)
        k.to = clamp(u * 0.8 + gaussian() * 0.2, -1, 1);
        k.reactAt = 0.25;
        k.diveV = Math.min(v, 0.9);
      }
      S.shot = { u, v, T, power: aim.power, t: 0, xg: gx(clamp(u, -1.6, 1.6)), curl, arc: fk ? 0.35 + 0.9 * clamp(v, 0, 1.2) : panenka ? 0.55 : 0.25 * aim.power };
      S.outcome = outcome;
      S.phase = 'flight';
      sfx('kick');
      buzz('shot');
    }

    function finish() {
      if (S.done) return;
      S.done = true;
      let o = S.outcome;
      if (target && o === 'goal') o = S.targetHit ? 'target' : 'miss';
      const success = target ? o === 'target' : o === 'goal';
      const sh = S.shot;
      const accuracy = success ? clamp(0.35 + Math.abs(sh.u) * 0.5 + (sh.v > 0.6 ? 0.15 : 0), 0, 1) : 0;
      setTimeout(() => {
        stage.stop();
        resolve({ success, accuracy, outcome: o, panenka: !!S.panenka && success, panenkaTry: !!S.panenka, rebound: !!S.rebound, freekick: fk, curl: S.shot?.curl || 0 });
      }, 50);
    }

    function startAfter() {
      S.phase = 'after';
      S.afterT = 0;
      const b = S.ball;
      const o = S.outcome;
      if (o === 'goal' && target && !S.targetHit) {
        netHit(b.x, b.y, 1);
        big.show('ISKA!', '#ff5d6c', 64);
        sfx('miss');
        buzz('miss');
        S.after = { vx: (b.x - L.cx) * 0.1, vy: -20, shrink: 0.996 };
      } else if (o === 'goal' && target) {
        netHit(b.x, b.y, 1);
        S.excite = 0.6;
        big.show('HEDEF!', '#c6ff3d', 70);
        particles.burst(b.x, b.y, { n: 36, colors: ['#c6ff3d', '#ffcf3d', '#fff'], speed: 340, gravity: 500, life: 1.2, size: 5 });
        stage.shake(8);
        sfx('levelup');
        buzz('goal');
        S.after = { vx: (b.x - L.cx) * 0.1, vy: -20, shrink: 0.996 };
      } else if (o === 'goal') {
        netHit(b.x, b.y, 1);
        S.excite = 1;
        big.show(S.panenka ? 'PANENKA!' : S.rebound ? 'DÖNEN TOPTA GOL!' : fk && Math.abs(S.shot.curl) > 0.3 ? 'FALSOLU GOL!' : 'GOOOL!', '#c6ff3d', S.rebound ? 58 : 76);
        particles.burst(b.x, b.y, { n: 40, colors: ['#c6ff3d', '#ffcf3d', '#fff', myKit[0]], speed: 380, gravity: 500, life: 1.4, size: 5 });
        stage.shake(14);
        sfx('goal');
        buzz('goal');
        S.after = { vx: (b.x - L.cx) * 0.1, vy: -20, shrink: 0.996 };
      } else if (o === 'save') {
        big.show(S.panenka ? 'YERİNDE KALDI!' : 'KURTARDI!', '#38bdf8', 60);
        sfx('save');
        buzz('save');
        const caught = S.panenka || (S.shot.v < 0.55 && Math.abs(S.shot.u - S.k.to) < 0.12);
        // Çelinen top ceza sahasında kalabilir: ikinci şans (bir kez)
        S.reboundNext = !caught && !S.rebound && Math.random() < reboundP;
        S.after = caught ? { caught: true } : { vx: (b.x < gx(S.k.u) ? -1 : 1) * 260, vy: 160, grow: 1.01 };
        particles.burst(b.x, b.y, { n: 14, colors: ['#fff', keeperColor], speed: 200, life: 0.6 });
      } else if (o === 'post') {
        big.show('DİREK!', '#ffcf3d', 64);
        sfx('post');
        buzz('post');
        stage.shake(8);
        S.after = { vx: (b.x < L.cx ? 1 : -1) * 120, vy: 300, grow: 1.012 };
      } else if (o === 'block') {
        big.show(L.wall ? 'BARAJ!' : 'BLOK!', '#ff5d6c', 60);
        if (L.wall) L.wall.jump = 1;
        sfx('tackle');
        buzz('bump');
        S.after = { vx: (Math.random() - 0.5) * 400, vy: 260, grow: 1.01 };
        if (L.def) L.def.jump = 1;
      } else {
        big.show(o === 'over' ? 'ÜSTTEN!' : 'AUT!', '#ff5d6c', 60);
        sfx('miss');
        buzz('miss');
        S.after = { vx: (S.shot.xg - L.bx) * 0.9, vy: -L.H * 0.35, shrink: 0.985 };
      }
    }

    /** Dönen top: kaleci yerde, top ceza sahasında; 1,8 sn içinde ikinci şut */
    function startRebound() {
      S.rebound = true;
      S.reboundNext = false;
      S.phase = 'aim';
      S.t = 0;
      S.reboundT = 1.8;
      S.outcome = null;
      S.drag = null;
      S.after = null;
      S.excite = 0.2;
      S.hintA = 1;
      S.kOff = 0;
      S.k.u = clamp(S.k.to, -1, 1);
      S.k.lift = 0;
      L.wall = null;
      L.def = null;
      L.bx = L.cx + (Math.random() - 0.5) * L.gw * 1.1;
      L.by = lerp(L.gl, L.by, 0.55);
      L.r0 *= 0.85;
      S.ball = { x: L.bx, y: L.by, r: L.r0, alt: 0, gy: L.by };
      big.show('DÖNEN TOP!', '#ffcf3d', 52);
      sfx('swish');
      buzz('bump');
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
        if (S.phase === 'aim' && S.rebound) {
          // Kaleci yerden kalkmaya çalışıyor; süre dolarsa savunma uzaklaştırır
          S.k.angle *= Math.pow(0.4, dt);
          S.k.u += (0 - S.k.u) * Math.min(1, dt * 0.5);
          if (S.t > S.reboundT) {
            S.outcome = 'save';
            S.cleared = true;
            S.shot = { u: 0, v: 0, T: 0, power: 0, t: 0, xg: L.cx, curl: 0, arc: 0 };
            big.show('UZAKLAŞTIRDILAR!', '#ff5d6c', 50);
            sfx('tackle');
            S.phase = 'after';
            S.afterT = 0;
            S.after = { vx: (Math.random() < 0.5 ? -1 : 1) * 420, vy: 260, grow: 1.01 };
          }
        } else if (S.phase === 'aim') {
          S.k.u = Math.sin(S.k.idle * 1.3) * 0.1 + (S.kOff || 0);
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
          b.x = lerp(L.bx, sh.xg, pp) + (sh.curl || 0) * 0.55 * (L.gw / 2) * Math.sin(Math.PI * p);
          b.gy = lerp(L.by, L.gl, pp);
          b.alt = sh.v * L.gh * pp + Math.sin(Math.PI * p) * L.gh * (sh.arc ?? 0.25 * sh.power);
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
          if (L.wall && p > 0.02 && p < L.wall.fd + 0.12) L.wall.jump = Math.max(L.wall.jump, 0.85);
          const blockAt = L.wall ? L.wall.fd : L.def?.fd;
          if (S.outcome === 'block' && p >= blockAt) startAfter();
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
            if (S.outcome === 'goal' && net.hit) {
              // ağlara gömülür ve fileyle birlikte sallanır
              const kk = nIdx(net.hit.i, net.hit.j);
              b.x = net.hit.x + net.d[kk] * 0.95;
              b.y = net.hit.y + net.d[kk + 1] * 0.95 - b.r * 0.2;
            } else if (S.outcome === 'goal') {
              const backBottom = backY(L.gl);
              b.y = Math.min(b.y, backBottom - b.r);
              a.vx *= 0.9;
            }
          }
          S.rot += dt * 6;
          if (L.def) L.def.jump *= 0.95;
          if (L.wall) L.wall.jump *= 0.93;
          netStep(dt);
          if (S.reboundNext && S.afterT > 0.75) startRebound();
          else if (S.afterT > 1.7) finish();
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
        // Işık kuleleri (tribünün arkasında)
        const towerH = L.hy * 0.9;
        drawSprite(ctx, 'light_tower', W * 0.06, L.hy - 10, { h: towerH, anchor: 'bottom', alpha: 0.95 });
        drawSprite(ctx, 'light_tower', W * 0.94, L.hy - 10, { h: towerH, anchor: 'bottom', alpha: 0.95, flip: true });
        drawCrowd(ctx, crowd, t, S.excite);
        // Ön sıra taraftarlar + bayraklar
        for (const f of flags) {
          const lift = S.excite > 0.2 ? Math.abs(Math.sin(t * 7 + f.ph)) * 6 * S.excite : Math.sin(t * 2 + f.ph) * 1.5;
          drawSprite(ctx, f.name, f.x, L.hy - 14 - L.hy * 0.24 - lift, { h: L.hy * 0.16, alpha: 0.95 });
        }
        for (const f of fans) {
          const jump = S.excite > 0.05 ? Math.abs(Math.sin(t * 9 + f.ph)) * 7 * S.excite : Math.abs(Math.sin(t * 1.6 + f.ph)) * 0.8;
          drawSprite(ctx, f.name, f.x, L.hy - 12 - jump, { h: f.h, anchor: 'bottom', flip: f.flip });
        }
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

        // Köşe bayrakları (kale çizgisinin uçlarında, uzakta olduğu için küçük)
        drawSprite(ctx, 'corner_flag', 10, L.gl + 2, { h: L.gh * 0.62, anchor: 'bottom' });
        drawSprite(ctx, 'corner_flag', W - 10, L.gl + 2, { h: L.gh * 0.62, anchor: 'bottom', flip: true });
        wfx.ground(ctx, W, H);

        const ballBehind = S.outcome === 'goal' && S.phase === 'after';
        drawNet(ctx, t);
        if (ballBehind) drawBallAll(ctx);
        drawPosts(ctx);
        if (target) drawTargets(ctx, t);
        else drawKeeper(ctx);
        if (L.def) drawDefender(ctx);
        if (L.wall) drawWall(ctx);
        if (!ballBehind) drawBallAll(ctx);

        // ── Nişan önizleme ──
        if (S.phase === 'aim' && S.drag) {
          const aim = aimFromDrag(S.drag);
          if (aim) {
            const tx = gx(clamp(aim.u, -1.8, 1.8));
            const ty = gy(Math.min(aim.v, 1.6));
            const ok = Math.abs(aim.u) < 1 && aim.v <= 1 && !wallBlocks(aim.u, aim.v, aim.curl || 0);
            ctx.setLineDash([6, 8]);
            ctx.strokeStyle = ok ? 'rgba(198,255,61,.85)' : 'rgba(255,93,108,.85)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(L.bx, L.by);
            const bend = (aim.curl || 0) * 0.55 * L.gw;
            ctx.quadraticCurveTo((L.bx + tx) / 2 + bend, Math.min(L.by, ty) - L.gh * (fk ? 0.9 + 0.9 * clamp(aim.v, 0, 1.2) : 0.4 * aim.power), tx, ty);
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
            ctx.fillText(S.rebound ? 'ÇABUK! Dönen topa vur' : fk ? 'Barajın üstünden aşırt ya da kavisli kaydır' : type === 'penalty' ? 'Kaydır · kısa ve yavaş = Panenka' : 'Kaleye doğru kaydır', L.cx, Math.min(H - 24, L.by + L.r0 * 2.6));
            ctx.globalAlpha = 1;
          }
          if (S.rebound) drawTimer(ctx, W, H - 14, S.t / S.reboundT, '#ffcf3d');
          else if (timeLimit) drawTimer(ctx, W, H - 14, S.t / timeLimit);
        }
        wfx.sky(ctx, W, H, t);
        particles.render(ctx);
        big.render(ctx, W, H);
      },

      pointer(kind, p) {
        if (!L || S.phase !== 'aim') return;
        if (kind === 'down') {
          if (p.y < L.gl) return;
          S.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, pts: [] };
        } else if (kind === 'move' && S.drag) {
          S.drag.x = p.x;
          S.drag.y = p.y;
          if (S.drag.pts.length < 80) S.drag.pts.push({ x: p.x, y: p.y });
          // Güç dolarken her kademede hafif tık: şutun gerildiğini hisset
          const a = aimFromDrag(S.drag);
          const lv = a ? Math.floor(Math.min(a.power, 1.44) / 0.36) : 0;
          if (lv > (S.chargeLv || 0)) buzz('charge');
          S.chargeLv = lv;
        } else if (kind === 'up' && S.drag) {
          S.chargeLv = 0;
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
      drawPixelBall(ctx, b.x, b.y, b.r * 2.1, S.rot, { shadow: false });
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

    // ── FİLE: yay-kütle ağı. Gol olunca top çarptığı yerde file geriye şişer, dalga yayılır, sallanıp durulur ──
    const NC = 16;
    const NR = 8;
    const net = { d: new Float32Array((NC + 1) * (NR + 1) * 2), v: new Float32Array((NC + 1) * (NR + 1) * 2), t: 0, active: 0 };
    const nIdx = (i, j) => (j * (NC + 1) + i) * 2;
    function netRest(i, j) {
      const x0 = gx(-1);
      const x1 = gx(1);
      const top = gy(1);
      return { x: lerp(backX(x0), backX(x1), i / NC), y: lerp(backY(top), backY(L.gl), j / NR) };
    }
    /** Topun çarptığı noktaya darbe: düğümler geriye (yukarı-içe) ve dışa itilir. */
    function netHit(x, y, power = 1) {
      net.active = 2.6;
      // topun gömüleceği düğüm
      let best = null;
      for (let j = 1; j < NR; j++) for (let i = 1; i < NC; i++) {
        const r = netRest(i, j);
        const d = Math.hypot(r.x - x, r.y - y);
        if (!best || d < best.d) best = { i, j, d, x: r.x, y: r.y };
      }
      net.hit = best;
      for (let j = 0; j <= NR; j++) {
        for (let i = 0; i <= NC; i++) {
          const r = netRest(i, j);
          const dx = r.x - x;
          const dy = r.y - y;
          const d = Math.hypot(dx, dy);
          const R = L.gw * 0.32;
          const f = Math.max(0, 1 - d / R);
          if (!f) continue;
          const k = nIdx(i, j);
          const push = f * f * 520 * power;
          // geriye şişme: perspektifte arka = biraz yukarı ve kalenin ortasına doğru; çevrede dalga
          const cx = L.cx - r.x;
          net.v[k] += (dx / (d || 1)) * push * 0.45 + cx * f * 0.6 * power;
          net.v[k + 1] += -push * 0.45 + (dy / (d || 1)) * push * 0.3;
        }
      }
    }
    function netStep(dt) {
      if (net.active <= 0) return;
      net.active -= dt;
      const h = Math.min(dt, 1 / 30);
      const KS = 90; // yerine dönme yayı
      const KN = 140; // komşu bağı
      const DAMP = 3.2;
      for (let j = 0; j <= NR; j++) {
        for (let i = 0; i <= NC; i++) {
          const k = nIdx(i, j);
          const edge = i === 0 || i === NC || j === 0 || j === NR;
          if (edge) {
            net.d[k] *= 0.5;
            net.d[k + 1] *= 0.5;
            continue;
          }
          for (let c = 0; c < 2; c++) {
            const lap = net.d[nIdx(i - 1, j) + c] + net.d[nIdx(i + 1, j) + c] + net.d[nIdx(i, j - 1) + c] + net.d[nIdx(i, j + 1) + c] - 4 * net.d[k + c];
            const a = -KS * net.d[k + c] + KN * lap - DAMP * net.v[k + c];
            net.v[k + c] += a * h;
          }
        }
      }
      for (let n = 0; n < net.d.length; n++) net.d[n] += net.v[n] * h;
    }
    const nP = (i, j, t) => {
      const r = netRest(i, j);
      const k = nIdx(i, j);
      // hafif rüzgâr dalgası
      const w = Math.sin(t * 1.7 + i * 0.6 + j * 0.4) * 0.4;
      return { x: r.x + net.d[k], y: r.y + net.d[k + 1] + w };
    };

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
      ctx.strokeStyle = 'rgba(255,255,255,.36)';
      ctx.lineWidth = 1;
      // arka ağ (şişen kısım)
      for (let i = 0; i <= NC; i++) {
        ctx.beginPath();
        for (let j = 0; j <= NR; j++) {
          const p = nP(i, j, t);
          if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      for (let j = 0; j <= NR; j++) {
        ctx.beginPath();
        for (let i = 0; i <= NC; i++) {
          const p = nP(i, j, t);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      // yan ve üst paneller: kale çerçevesinden arka ağın kenar düğümlerine
      for (let j = 0; j <= NR; j++) {
        const f = j / NR;
        const pl = nP(0, j, t);
        const pr = nP(NC, j, t);
        ctx.beginPath();
        ctx.moveTo(x0, lerp(top, L.gl, f)); ctx.lineTo(pl.x, pl.y);
        ctx.moveTo(x1, lerp(top, L.gl, f)); ctx.lineTo(pr.x, pr.y);
        ctx.stroke();
      }
      for (let i = 0; i <= NC; i++) {
        const p = nP(i, 0, t);
        ctx.beginPath();
        ctx.moveTo(lerp(x0, x1, i / NC), top);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    /** Seçme kampı: dört köşede hedef halkaları, aktif olan parlar */
    function drawTargets(ctx, t) {
      const corners = opts.corners || [];
      const rx = (target.r * L.gw) / 2;
      const ry = target.r * 1.15 * L.gh;
      for (const c of corners) {
        const active = c.u === target.u && c.v === target.v;
        const x = gx(c.u);
        const y = gy(c.v);
        const pulse = active ? 1 + Math.sin(t * 6) * 0.06 : 1;
        ctx.save();
        ctx.globalAlpha = active ? 1 : 0.28;
        for (let i = 3; i >= 1; i--) {
          ctx.beginPath();
          ctx.ellipse(x, y, (rx * i * pulse) / 3, (ry * i * pulse) / 3, 0, 0, Math.PI * 2);
          ctx.fillStyle = i % 2 ? (active ? '#ff5d6c' : '#94a3b8') : '#ffffff';
          ctx.fill();
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath();
        ctx.ellipse(x, y, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawKeeper(ctx) {
      const k = S.k;
      const kh = L.gh * 0.95;
      const x = gx(k.u);
      drawShadow(ctx, x, L.gl + 3, kh * 0.3, kh * 0.06, 0.4);
      drawPixelPlayer(ctx, x, L.gl + 2, kh, keeperPx, { dir: 'down', frame: 'ready', rot: k.angle, lift: k.lift, shadow: false });
    }

    if (opts.expose) {
      Object.assign(opts.expose, { S, startRebound: () => startRebound() });
      Object.defineProperty(opts.expose, 'L', { get: () => L, configurable: true });
    }

    function drawWall(ctx) {
      const w = L.wall;
      const y = lerp(L.by, L.gl, persp(w.fd));
      const lift = Math.sin(Math.min(1, w.jump) * Math.PI * 0.5) * w.h * 0.22 * w.jump;
      w.xs.forEach((x, i) => drawPixelPlayer(ctx, x, y + 2, w.h, w.look[i], { dir: 'down', frame: w.jump > 0.15 ? 'ready' : 'idle', lift: lift * (0.85 + (i % 2) * 0.15) }));
    }

    function drawDefender(ctx) {
      const d = L.def;
      const h = d.h;
      const lift = Math.sin(Math.min(1, d.jump) * Math.PI * 0.5) * h * 0.25 * d.jump;
      drawPixelPlayer(ctx, d.x, d.y + 2, h, defPx, { dir: 'down', frame: d.jump > 0.15 ? 'ready' : 'idle', lift });
    }
  });
}
