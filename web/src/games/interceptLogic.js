// DEFANS — PAS ARASI (araya girme). Saf mantık, fizik motoru üstünde (Node testlerinde çalışır). Birimler metre.
//
// Rakipler kendi aralarında paslaşarak kalene ilerler. Top sahibinin BAKIŞI pası ele verir (bakış çizgisi);
// doğru koridora koşup pası kes. Dokun: ayağını uzat (menzil kısa süre artar). Top sahibine yapışırsan
// aceleye getirir; dibindeyken uzanırsan topu da alabilirsin. Uzak durursan top sahibi topu sürüp kaleye girer.
// Yetenek: hızın, menzilin; rakiplerin bakış süresi ve çalım/aldatma (sahte bakış) oranı.
import { createBall, kick, stepBall, groundSpeed, createBody, steer, stepBody, bodySpeed, interceptBall, solveKick, collideBodies, ENV, applyGrip } from './physics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;

export function interceptSkill(skill = 0.3) {
  const e = 0.25 + 0.75 * clamp(skill, 0, 1);
  return {
    e,
    defSpeed: lerp(6.6, 8.2, e),
    defAccel: lerp(6.4, 8.6, e),
    reach: lerp(0.75, 0.95, e),
    lungeReach: lerp(1.3, 1.65, e),
    look: lerp(0.58, 0.8, e), // top sahibinin pas öncesi bakış süresi (sn) — iyi savunmacı daha erken okur
    decoy: lerp(0.32, 0.15, e), // sahte bakış olasılığı
    passSpeed: lerp(17, 15, e),
    tackleWin: lerp(0.22, 0.42, e),
  };
}

/**
 * @param {{context?:'duel'|'threat', skill?:number, rnd?:()=>number, Wm?:number, Hm?:number}} o
 */
export function createDefense({ context = 'duel', skill = 0.3, rnd = Math.random, Wm = 30, Hm = 54, env = ENV, fatigue = 0 } = {}) {
  const sk = interceptSkill(skill);
  const threat = context === 'threat';
  const att = [
    { x: Wm * lerp(0.4, 0.6, rnd()), y: Hm * 0.2 },
    { x: Wm * lerp(0.12, 0.25, rnd()), y: Hm * lerp(0.32, 0.4, rnd()) },
    { x: Wm * lerp(0.75, 0.88, rnd()), y: Hm * lerp(0.3, 0.4, rnd()) },
  ].map((p, i) => ({
    body: applyGrip(createBody(p.x, p.y, { maxSpeed: threat ? 7.6 : 7, accel: 6.5, mass: 74 }), env),
    hx: p.x,
    hy: p.y,
    id: i,
    look: null,
  }));
  // Maç içi yorgunluk: savunmacı (sen) yavaşlar; kaygan zemin herkesi etkiler
  const tired = 1 - Math.max(0, Math.min(0.65, fatigue)) * 0.22;
  const me = applyGrip(createBody(Wm / 2, Hm * 0.5, { maxSpeed: sk.defSpeed * tired, accel: sk.defAccel * tired, turn: 16, mass: 80 }), env);
  const ball = createBall(att[0].body.x, att[0].body.y + 0.6);
  const D = {
    Wm, Hm, sk, rnd, context, threat, att, me, ball, env,
    carrier: 0,
    t: 0,
    passes: 0,
    limit: threat ? 3 : 4,
    advance: threat ? 1.5 : 0.9,
    goalY: Hm,
    boxY: Hm * 0.85,
    phase: 'hold', // hold → look → pass → hold …
    nextPass: lerp(1.8, 2.4, rnd()),
    look: null, // {to, fake, t, dur}
    pass: null, // {to, t}
    target: null,
    lunge: 0,
    lungeCd: 0,
    events: [],
    result: null,
  };
  return D;
}

export function defMoveTo(D, x, y) {
  D.target = x == null ? null : { x: clamp(x, 0.6, D.Wm - 0.6), y: clamp(y, D.Hm * 0.25, D.Hm - 0.8) };
}

/** Dokun: ayağını uzat (kısa süre menzil artar; ardından kısa toparlanma). */
export function defLunge(D) {
  if (D.result || D.lungeCd > 0) return false;
  D.lunge = 0.3;
  D.lungeCd = 0.75;
  D.events.push({ type: 'lunge' });
  // top sahibinin dibindeysen topu almayı dene
  const c = D.att[D.carrier].body;
  if (D.phase !== 'pass' && hyp(c.x - D.me.x, c.y - D.me.y) < D.sk.lungeReach * 0.9) {
    if (D.rnd() < D.sk.tackleWin) end(D, 'won', { method: 'tackle', acc: 0.75 });
    else {
      // ıskaladın: top sahibi sıyrılıp ileri atılır, sen dengeni toparlarsın
      D.me.stun = 0.5;
      c.vy += 5;
      c.vx += (c.x < D.me.x ? -2 : 2);
      D.events.push({ type: 'shrug' });
    }
  }
  return true;
}

function end(D, outcome, extra = {}) {
  if (D.result) return;
  D.result = { outcome, success: outcome === 'won', acc: 0, method: null, passes: D.passes, ...extra };
  D.events.push({ type: 'end', ...D.result });
}

/** Pas koridorunun savunmacıya uzaklığı (doğru parçası). */
export function laneGap(D, from, to) {
  const ax = from.x;
  const ay = from.y;
  const dx = to.x - ax;
  const dy = to.y - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((D.me.x - ax) * dx + (D.me.y - ay) * dy) / l2, 0, 1);
  return hyp(D.me.x - (ax + dx * t), D.me.y - (ay + dy * t));
}

/** Son pas: savunmacının arkasındaki boşluğa koşan oyuncuya ara pası (koşucunun tarafında, savunmacının 5 m gerisi). */
function throughSpot(D, i) {
  const a = D.att[i].body;
  const side = a.x < D.me.x ? -1 : 1;
  return { x: clamp(D.me.x + side * 4.5, 2, D.Wm - 2), y: clamp(D.me.y + 5, 0, D.boxY) };
}

function choosePass(D) {
  const c = D.att[D.carrier].body;
  const options = D.att.map((a, i) => ({ i, a })).filter((o) => o.i !== D.carrier);
  const last = D.passes >= D.limit - 1;
  for (const o of options) {
    o.spot = last ? throughSpot(D, o.i) : { x: o.a.body.x, y: o.a.body.y + 1.5 };
    o.gap = laneGap(D, c, o.spot);
  }
  options.sort((p, q) => q.gap - p.gap);
  const best = options[0];
  const fake = D.rnd() < D.sk.decoy && options.length > 1;
  D.look = { to: fake ? options[1].i : best.i, real: best.i, spot: best.spot, fake, t: 0, dur: D.sk.look * lerp(1, 0.85, Math.min(1, D.passes / 3)), through: last };
  D.phase = 'look';
  D.events.push({ type: 'look', to: D.look.to, fake });
}

function makePass(D, rushed = false) {
  const lk = D.look;
  const c = D.att[D.carrier].body;
  // bakış süresince koridor kapandıysa (gerçek hedef de kapalıysa) en açık seçeneğe döner
  let to = lk.real;
  let spot = lk.through ? throughSpot(D, to) : { x: D.att[to].body.x, y: D.att[to].body.y + 1.5 };
  if (!lk.fake && laneGap(D, c, spot) < 1.2) {
    const alt = D.att.map((a, i) => i).filter((i) => i !== D.carrier && i !== to)[0];
    if (alt != null && D.rnd() < 0.5) {
      to = alt;
      spot = lk.through ? throughSpot(D, to) : { x: D.att[to].body.x, y: D.att[to].body.y + 1.5 };
    }
  }
  const err = rushed ? 2.2 : 0.4;
  spot = { x: spot.x + (D.rnd() - 0.5) * err, y: spot.y + (D.rnd() - 0.5) * err };
  // baskı altında top savunmacıdan uzak ayakla oynanır (gövdeyle perdeleyerek)
  const ax = c.x - D.me.x;
  const ay = c.y - D.me.y;
  const al = hyp(ax, ay) || 1;
  const shield = al < 1.8 ? 0.7 : 0;
  D.ball.x = c.x + (ax / al) * shield;
  D.ball.y = c.y + 0.5 * (shield ? 0 : 1) + (ay / al) * shield;
  D.ball.z = 0;
  const sol = solveKick({ x: D.ball.x, y: D.ball.y }, spot, { arrive: lk.through ? 6 : 7, maxSpeed: D.sk.passSpeed + (lk.through ? 3 : 0), env: D.env });
  kick(D.ball, sol);
  D.pass = { to, t: 0, through: lk.through, spot, immune: shield ? 0.12 : 0 };
  D.phase = 'pass';
  D.look = null;
  D.events.push({ type: 'pass', to, through: lk.through, rushed });
}

function attackersStep(D, h) {
  const adv = D.advance * h;
  D.att.forEach((a, i) => {
    const b = a.body;
    a.hy = Math.min(a.hy + adv, D.boxY - 2);
    if (D.phase === 'pass' && i === D.pass.to) {
      // alıcı topa koşar
      const ip = interceptBall(b, D.ball, { reaction: 0, reach: 0.6, maxZ: 1.5, T: 3, h: 1 / 30, env: D.env });
      const tgt = ip || { x: D.ball.x, y: D.ball.y };
      steer(b, tgt.x, tgt.y, h, { arrive: 0.3 });
    } else if (D.look?.through && i === D.look.real) {
      // ara pası koşusu: savunmacının arkasındaki boşluğa depar
      const sp = throughSpot(D, i);
      steer(b, sp.x, sp.y, h, { arrive: 0.2 });
    } else if (i === D.carrier && D.phase !== 'pass') {
      // top sahibi: savunmacı uzaksa topu sürüp kaleye gider
      const far = hyp(D.me.x - b.x, D.me.y - b.y) > 6.5;
      if (far) steer(b, b.x + (D.Wm / 2 - b.x) * 0.2, b.y + 4, h, { speed: b.maxSpeed * 0.7 });
      else steer(b, b.x, b.y, h);
      D.ball.x = b.x + b.vx * 0.06;
      D.ball.y = b.y + 0.55;
      D.ball.vx = D.ball.vy = 0;
    } else {
      // pas seçeneği olmak için boşa kaç: savunmacıdan uzaklaş
      const away = D.me.x < a.hx ? 1.5 : -1.5;
      steer(b, clamp(a.hx + away, 1.5, D.Wm - 1.5), a.hy, h, { speed: 4 });
    }
    stepBody(b, h);
  });
}

/** Bir fizik adımı. */
export function defenseStep(D, h) {
  if (D.result) {
    stepBall(D.ball, h, D.env);
    return;
  }
  D.t += h;
  D.lunge = Math.max(0, D.lunge - h);
  D.lungeCd = Math.max(0, D.lungeCd - h);
  // savunmacı
  if (D.target) steer(D.me, D.target.x, D.target.y, h, { arrive: 0.5 });
  else steer(D.me, D.me.x, D.me.y, h);
  stepBody(D.me, h);
  D.me.x = clamp(D.me.x, 0.5, D.Wm - 0.5);
  D.me.y = clamp(D.me.y, D.Hm * 0.2, D.Hm - 0.5);
  attackersStep(D, h);
  for (const a of D.att) collideBodies(D.me, a.body, 0.1);

  const c = D.att[D.carrier].body;
  if (D.phase === 'hold') {
    // baskı: savunmacı dibindeyse top sahibi aceleyle pas arar
    const close = hyp(D.me.x - c.x, D.me.y - c.y) < 1.6;
    if (D.t >= D.nextPass || close) choosePass(D);
  } else if (D.phase === 'look') {
    D.look.t += h;
    const close = hyp(D.me.x - c.x, D.me.y - c.y) < 1.3;
    if (D.look.t >= D.look.dur || (close && D.look.t > 0.15)) makePass(D, close);
  } else if (D.phase === 'pass') {
    D.pass.t += h;
    stepBall(D.ball, h, D.env);
    const reach = D.lunge > 0 ? D.sk.lungeReach : D.sk.reach;
    const db = hyp(D.ball.x - D.me.x, D.ball.y - D.me.y);
    if (db <= reach && D.pass.t >= D.pass.immune) {
      end(D, 'won', { method: D.lunge > 0 ? 'lunge' : 'intercept', acc: clamp(0.95 - D.passes * 0.12 - (D.lunge > 0 ? 0.1 : 0), 0.4, 1) });
      // top savunmacının ayağında
      D.ball.vx = D.ball.vy = 0;
      return;
    }
    const r = D.att[D.pass.to].body;
    if (hyp(D.ball.x - r.x, D.ball.y - r.y) <= 1.0) {
      D.passes++;
      D.carrier = D.pass.to;
      D.pass = null;
      D.phase = 'hold';
      D.nextPass = D.t + lerp(0.9, 1.5, D.rnd());
      D.events.push({ type: 'received', passes: D.passes });
      if (D.passes >= D.limit) end(D, 'beaten', { method: 'through' });
      return;
    }
    // ara pası savunmacının arkasına geçtiyse ve koşucu topa senden yakınsa: geçildin
    if (D.pass.through && D.ball.y > D.me.y + 1.5 && hyp(D.ball.x - r.x, D.ball.y - r.y) < hyp(D.ball.x - D.me.x, D.ball.y - D.me.y) && D.pass.t > 0.4) {
      D.passes++;
      end(D, 'beaten', { method: 'through' });
      return;
    }
    if (groundSpeed(D.ball) < 0.4 || D.pass.t > 4 || D.ball.x < -1 || D.ball.x > D.Wm + 1 || D.ball.y > D.Hm + 1) {
      // pas boşa gitti: savunma kazandı (taç/aut ya da kimse yetişemedi)
      end(D, 'won', { method: 'loose', acc: 0.5 });
      return;
    }
  }
  if (D.phase !== 'pass' && c.y > D.boxY) end(D, 'beaten', { method: 'dribble' });
  if (D.t > 25) end(D, 'won', { method: 'time', acc: 0.35 });
}

/** Simülasyon yardımcıları (testler). */
export function simulateDefense(policy, opts = {}) {
  const D = createDefense(opts);
  let n = 0;
  while (!D.result && n++ < 60 * 40) {
    policy(D);
    defenseStep(D, 1 / 60);
    D.events.length = 0;
  }
  return D;
}

/** İyi okuyan savunmacı: bakılan koridorun ortasına koşar, top yaklaşınca uzanır. */
export function readingPolicy(delay = 0.15) {
  return (D) => {
    const c = D.att[D.carrier].body;
    if (D.phase === 'look' && D.look.t >= delay) {
      const to = D.look.through ? throughSpot(D, D.look.to) : D.att[D.look.to].body;
      defMoveTo(D, lerp(c.x, to.x, 0.45), lerp(c.y, to.y, 0.45));
    } else if (D.phase === 'hold') {
      // top sahibine yaklaş ama dibine girme
      defMoveTo(D, c.x, c.y + 4.5);
    }
    if (D.phase === 'pass' && hyp(D.ball.x - D.me.x, D.ball.y - D.me.y) < D.sk.lungeReach * 1.1) defLunge(D);
  };
}
