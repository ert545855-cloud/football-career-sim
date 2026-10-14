// MÜDAHALE — saf oyun mantığı (fizik motoru üstünde; tuval yok → Node testlerinde çalışır). Birimler metre/saniye.
//
// Hücumcu topu önüne sürerek gelir (her dokunuşta top ayağından açılır), yaklaşınca çalım atar (gövde çalımı → topu
// yanından vurup depar). Savunmacı:
//   • Pozisyon: parmakla sürükler; bırakınca otomatik "jokey" yapar (top ile kale arasında durur, gecikmeli takip).
//   • Dürtme (dokun): kısa menzil, hızlı toparlanma. Top açıkken temiz; ayağa yapışıkken şans işi.
//   • Kayarak (hızlı kaydır): uzun menzil; önce topa değersen temiz, önce adama değersen FAUL (kart riski);
//     ıskalarsan yerde kalırsın.
//   • Gövde: top gövdene çarparsa kesersin; omuz omuza çarpışmada güçlü olan dengeyi korur.
import { createBall, kick, stepBall, groundSpeed, createBody, steer, stepBody, bodySpeed, accelerate, collideBodies, ENV } from './physics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;

export function tackleSkill(skill) {
  const e = 0.25 + 0.75 * clamp(skill ?? 0.3, 0, 1);
  return {
    e,
    defSpeed: lerp(6.7, 8.3, e),
    defAccel: lerp(6.2, 8.8, e),
    defTurn: lerp(13, 20, e),
    defMass: lerp(74, 84, e),
    reach: lerp(1.15, 1.5, e), // dürtme menzili (gövde merkezinden)
    slideReach: lerp(0.6, 0.82, e),
    react: lerp(0.45, 0.24, e), // jokey takibindeki gecikme (sn): otomatik jokey kusursuz değil
    tightWin: lerp(0.2, 0.5, e), // top ayağa yapışıkken dürtmenin tutma şansı
    feint: lerp(0.75, 0.35, e), // hücumcunun çalım atma olasılığı
    push: 2.2, // hücumcunun top sürme itişi (m/s, hızının üstüne)
  };
}

/**
 * @param {{Wm?:number,Hm?:number,skill?:number,threat?:boolean,rnd?:()=>number}} o
 */
export function createDuel({ Wm = 30, Hm = 54, skill = 0.3, threat = false, rnd = Math.random } = {}) {
  const sk = tackleSkill(skill);
  const att = createBody(Wm * lerp(0.3, 0.7, rnd()), Hm * 0.26, { maxSpeed: threat ? 8.1 : 7.5, accel: 6.8, turn: 15, mass: 74, radius: 0.42 });
  att.vy = 5;
  att.facing = Math.PI;
  const def = createBody(Wm / 2, Hm * 0.68, { maxSpeed: sk.defSpeed, accel: sk.defAccel, turn: sk.defTurn, mass: sk.defMass, radius: 0.44 });
  const ball = createBall(att.x, att.y + 0.6);
  ball.vy = 6.5;
  return {
    Wm, Hm, sk, threat, rnd, att, def, ball,
    t: 0,
    goal: { x: Wm / 2, y: Hm },
    boxY: Hm * 0.86,
    ai: { state: 'carry', t: 0, weave: 0, nextWeave: 0.4, side: 1, fakeDur: 0.3, knocked: false, cool: 0, lastTouch: 0, burst: 0 },
    hist: [], // topun geçmiş konumları (gecikmeli jokey)
    line: Hm * 0.68, // savunma çizgisi
    target: null, // parmak hedefi (m) ya da null
    hold: 0,
    act: null, // {kind:'poke'|'slide', ...}
    lastMiss: null,
    events: [],
    result: null,
  };
}

/** Top hücumcunun ayağından açık mı (dokunuş sonrası ileri gitmiş)? */
export function ballLoose(D) {
  const { att, ball, ai } = D;
  return ball.z < 0.6 && (hyp(ball.x - att.x, ball.y - att.y) > 0.78 || D.t - ai.lastTouch > 0.32 || att.stun > 0);
}

export function inPokeReach(D) {
  return D.ball.z < 0.6 && hyp(D.ball.x - D.def.x, D.ball.y - D.def.y) <= D.sk.reach;
}

export function duelMoveTo(D, x, y) {
  if (x == null) {
    D.target = null;
    D.hold = 0.7; // bırakınca son hedefte kısa süre kal
    return;
  }
  D.target = { x: clamp(x, 0.8, D.Wm - 0.8), y: clamp(y, D.Hm * 0.3, D.Hm * 0.92) };
}

export function duelPoke(D) {
  if (D.result || D.act || D.def.stun > 0) return false;
  const d = hyp(D.ball.x - D.def.x, D.ball.y - D.def.y);
  D.act = { kind: 'poke', t: 0, dur: 0.24, startDist: d, resolved: false };
  D.events.push({ type: 'poke' });
  return true;
}

export function duelSlide(D, dx, dy) {
  if (D.result || D.act || D.def.stun > 0) return false;
  const l = hyp(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const sp = Math.max(bodySpeed(D.def), 0) * 0.5 + lerp(7.2, 8.6, D.sk.e);
  D.def.vx = ux * sp;
  D.def.vy = uy * sp;
  const d = hyp(D.ball.x - D.def.x, D.ball.y - D.def.y);
  D.act = { kind: 'slide', t: 0, dur: 0.55, ux, uy, fx: D.def.x, fy: D.def.y, startDist: d, manFirst: false };
  D.events.push({ type: 'slide' });
  return true;
}

function end(D, outcome, extra = {}) {
  if (D.result) return;
  D.result = { outcome, success: outcome === 'won', acc: 0, method: null, card: null, ...extra };
  D.events.push({ type: 'end', ...D.result });
}

function win(D, method, acc, kickDir = null) {
  const b = D.ball;
  const d = kickDir || { x: (b.x - D.def.x) || 0.01, y: (b.y - D.def.y) - 0.6 };
  const l = hyp(d.x, d.y) || 1;
  kick(b, { dirX: d.x / l, dirY: d.y / l, speed: method === 'slide' ? 10 : 7, loft: method === 'block' ? 0.15 : 0.05 });
  D.att.stun = Math.max(D.att.stun, 0.6);
  end(D, 'won', { method, acc: clamp(acc, 0, 1) });
}

function foul(D, behind) {
  const card = behind || D.threat ? (D.rnd() < (behind ? 0.75 : 0.45) ? 'yellow' : null) : D.rnd() < 0.2 ? 'yellow' : null;
  D.att.stun = 1.2;
  D.att.vx *= 0.3;
  D.att.vy *= 0.3;
  end(D, 'foul', { method: D.act?.kind || 'body', card, behind });
}

// ─────────────────────────────────────────────────────────────
// HÜCUMCU
// ─────────────────────────────────────────────────────────────
function attackerStep(D, h) {
  const { att: a, def: d, ball: b, ai, sk, rnd } = D;
  ai.t += h;
  ai.cool -= h;
  ai.burst = Math.max(0, ai.burst - h);
  const gap = hyp(d.x - a.x, d.y - a.y);
  const passed = a.y > d.y + 0.9 || d.stun > 0.2;
  let tx;
  let ty;
  let spd = a.maxSpeed * 0.88;
  if (passed) {
    tx = D.goal.x + (a.x - D.goal.x) * 0.5;
    ty = D.goal.y;
    spd = a.maxSpeed;
  } else if (ai.state === 'carry') {
    ai.nextWeave -= h;
    if (ai.nextWeave <= 0) {
      ai.weave = (rnd() - 0.5) * 9;
      ai.nextWeave = lerp(0.55, 1.1, rnd());
    }
    tx = clamp(D.goal.x + ai.weave + (a.x - D.goal.x) * 0.4, 2, D.Wm - 2);
    ty = a.y + 8;
    if (gap < lerp(5, 6.5, rnd()) && a.y < d.y) {
      // savunmacının zayıf tarafı: onun gövdesinin uzağı (ya da sürpriz)
      ai.side = (d.x > a.x ? -1 : 1) * (rnd() < 0.3 ? -1 : 1);
      if (a.x + ai.side * 4 < 1.5 || a.x + ai.side * 4 > D.Wm - 1.5) ai.side *= -1;
      ai.state = rnd() < sk.feint ? 'feint' : 'takeon';
      ai.t = 0;
      ai.fakeDur = lerp(0.22, 0.4, rnd());
      ai.knocked = false;
    }
  } else if (ai.state === 'feint') {
    // gövde çalımı: önce ters tarafa yüklen
    tx = a.x - ai.side * 4;
    ty = a.y + 2.5;
    spd = a.maxSpeed * 0.62;
    if (ai.t > ai.fakeDur) {
      ai.state = 'takeon';
      ai.t = 0;
      D.events.push({ type: 'feint' });
    }
  } else {
    // takeon: savunmacının yanından geç
    tx = d.x + ai.side * 3.4;
    ty = d.y + 3;
    spd = a.maxSpeed;
    if (ai.t > 2.4) {
      ai.state = 'carry';
      ai.t = 0;
    }
  }
  // savunmacıya yaklaşınca yavaşla (topu yakın tut, çalıma hazırlan); burnunun dibindeyse gövdeyle perdele
  if (!passed && gap < 6.5) spd = Math.min(spd, a.maxSpeed * 0.58);
  if (!passed && gap < 1.7 && d.y > a.y) spd *= 0.6;
  if (ai.burst > 0) spd = a.maxSpeed;
  // Koşu: top ayağından açıksa topun gideceği yere, değilse niyet ettiği yöne
  const bd = hyp(b.x - a.x, b.y - a.y);
  if (bd > 0.35) steer(a, b.x + b.vx * 0.2, b.y + b.vy * 0.2, h, { speed: Math.max(spd, Math.min(a.maxSpeed, groundSpeed(b) + 1)), arrive: 0.05 });
  else steer(a, tx, ty, h, { speed: spd, arrive: 0.1 });
  stepBody(a, h);

  // Top sürme: ayağa yakın ve yere yakınsa dokun
  if (a.stun > 0 || ai.cool > 0 || b.z > 0.5 || bd > 0.62) return;
  const sp = bodySpeed(a);
  let dx = tx - a.x;
  let dy = ty - a.y;
  // savunmacıya yaklaştıkça top ayağa yakın sürülür (yumuşak dokunuş)
  let push = passed ? sk.push + 0.5 : sk.push * clamp((gap - 4) / 8, 0.12, 1) + 0.25;
  let base = Math.min(sp, spd);
  if (ai.state === 'takeon' && !ai.knocked && gap >= 4.4 && !passed) {
    // çalım öncesi: topu yana, kısa it (savunmacıya doğru değil)
    dx = ai.side * 1.6;
    dy = 1;
    push = 0.6;
  }
  if (ai.state === 'takeon' && !ai.knocked && gap < 4.4 && !passed) {
    // topu savunmacının yanından ileri vur ve depar
    const bdD = hyp(b.x - d.x, b.y - d.y);
    if (bdD < 2.6) {
      // çok yakın: neredeyse yana vur (gövdesine çarpmasın)
      dx = ai.side;
      dy = 0.9;
      push = lerp(2.6, 3.6, rnd());
      base = sp * 0.6;
    } else {
      dx = d.x + ai.side * 3.3 - b.x;
      dy = d.y + 2.2 - b.y;
      push = lerp(3.6, 5.2, rnd());
      base = sp;
    }
    ai.knocked = true;
    ai.burst = 1.2;
    D.events.push({ type: 'knock' });
  }
  const l = hyp(dx, dy) || 1;
  kick(b, { dirX: dx / l, dirY: dy / l, speed: base + push });
  ai.cool = 0.2;
  ai.lastTouch = D.t;
  D.events.push({ type: 'touch' });
}

// ─────────────────────────────────────────────────────────────
// SAVUNMACI
// ─────────────────────────────────────────────────────────────
function defenderStep(D, h) {
  const { def: d, sk } = D;
  const act = D.act;
  if (act?.kind === 'slide') {
    act.t += h;
    const s = bodySpeed(d);
    if (s > 0) {
      const ns = Math.max(0, s - 8.5 * h);
      d.vx *= ns / s;
      d.vy *= ns / s;
    }
    stepBody(d, h, 0);
    if (act.t >= act.dur) {
      D.act = null;
      d.stun = 0.65;
      D.lastMiss = { t: D.t, kind: 'slide', early: act.startDist > sk.reach * 2.6 };
      D.events.push({ type: 'miss', kind: 'slide' });
    }
  } else {
    if (act?.kind === 'poke') {
      act.t += h;
      if (act.t >= act.dur) {
        D.act = null;
        if (!act.resolved) {
          d.stun = 0.28;
          D.lastMiss = { t: D.t, kind: 'poke', early: act.startDist > sk.reach * 1.6 };
          D.events.push({ type: 'miss', kind: 'poke' });
        }
      }
    }
    // hedef: parmak; yoksa jokey (top ile kale arasında, gecikmeli takip)
    let tx;
    let ty;
    let speed = d.maxSpeed;
    if (D.target) {
      tx = D.target.x;
      ty = D.target.y;
    } else if (D.hold > 0 && D.lastTarget) {
      D.hold -= h;
      tx = D.lastTarget.x;
      ty = D.lastTarget.y;
    } else {
      const lag = D.hist.find((p) => p.t >= D.t - sk.react) || { x: D.ball.x, y: D.ball.y };
      const gx = D.goal.x - lag.x;
      const gy = D.goal.y - lag.y;
      const gl = hyp(gx, gy) || 1;
      const keep = 3.1;
      tx = lag.x + (gx / gl) * keep;
      ty = Math.max(D.Hm * 0.32, lag.y + (gy / gl) * keep);
      // jokey öne atılmaz: geri geri ya da yan yan çekilir (öne en çok yavaş adım)
      if (ty < d.y) ty = d.y - Math.min(d.y - ty, 0.35);
      ty = Math.min(ty, D.line + 3.5); // en çok bu kadar geri çekilir, sonra durup karşılar
      if (hyp(D.att.x - d.x, D.att.y - d.y) < 7) speed *= 0.55; // jokey adımı (yan yan, dikkatli)
    }
    if (D.target) D.lastTarget = D.target;
    if (act?.kind === 'poke') speed *= 0.4;
    steer(d, tx, ty, h, { speed, arrive: 0.6 });
    stepBody(d, h);
  }
  d.x = clamp(d.x, 0.5, D.Wm - 0.5);
  d.y = clamp(d.y, D.Hm * 0.25, D.Hm - 0.5);
}

// ─────────────────────────────────────────────────────────────
// TEMAS
// ─────────────────────────────────────────────────────────────
function contacts(D) {
  const { att: a, def: d, ball: b, sk, act } = D;
  const db = hyp(b.x - d.x, b.y - d.y);
  const behind = d.y < a.y - 0.25; // hücumcu aşağı (kaleye) koşuyor: savunmacı üstteyse arkadan geliyor
  if (act?.kind === 'slide') {
    const fx = d.x + act.ux * 0.55;
    const fy = d.y + act.uy * 0.55;
    const touchBall = b.z < 0.6 && (hyp(b.x - fx, b.y - fy) < sk.slideReach || db < d.radius + 0.3);
    const touchMan = hyp(a.x - fx, a.y - fy) < a.radius + 0.35 || hyp(a.x - d.x, a.y - d.y) < a.radius + d.radius;
    if (touchBall && !act.manFirst) {
      const loose = ballLoose(D);
      // top ayağa yapışıkken adamla birlikte topa da girdiysen: hakem çoğu zaman faul der
      if (touchMan && !loose && D.rnd() < 0.55) {
        act.manFirst = true;
        foul(D, behind);
        return;
      }
      const clean = loose ? 1 : 0.55;
      win(D, 'slide', 0.55 + 0.45 * clean, { x: act.ux + (b.x - d.x) * 0.3, y: act.uy - 0.4 });
      return;
    }
    if (touchMan && !touchBall) {
      act.manFirst = true;
      foul(D, behind);
      return;
    }
    return;
  }
  if (act?.kind === 'poke' && !act.resolved && act.t >= 0.06) {
    if (db <= sk.reach && b.z < 0.6) {
      act.resolved = true;
      if (ballLoose(D)) win(D, 'poke', 0.85);
      else if (behind && D.rnd() < 0.35) foul(D, true);
      else if (D.rnd() < sk.tightWin) win(D, 'poke', 0.55);
      else {
        // top ayağa yapışıktı: hücumcu sıyırıp geçer
        d.stun = 0.35;
        D.ai.state = 'takeon';
        D.ai.knocked = false;
        D.ai.burst = 0.8;
        D.lastMiss = { t: D.t, kind: 'poke', early: false };
        D.events.push({ type: 'shrug' });
      }
      return;
    }
  }
  // gövde: top savunmacıya çarptı. Yavaş top kesilir; hızlı top bacağa çarpıp sekebilir (şans + yetenek)
  if (!act && d.stun <= 0 && b.z < 0.7 && db < d.radius + 0.2 && D.t - (D.lastDeflect || -9) > 0.4) {
    const rel = hyp(b.vx - d.vx, b.vy - d.vy);
    const p = rel < 3 ? 0.68 : clamp(0.46 - (rel - 3) * 0.1 + sk.e * 0.15, 0.12, 0.65);
    if (D.rnd() < p) {
      win(D, 'block', 0.68);
      return;
    }
    // sekti: top yön değiştirip yavaşlar, hücumcu kovalar
    const a2 = (D.rnd() - 0.5) * 1.6;
    const c = Math.cos(a2);
    const s2 = Math.sin(a2);
    const vx = b.vx * 0.55;
    const vy = b.vy * 0.55;
    b.vx = vx * c - vy * s2;
    b.vy = vx * s2 + vy * c;
    D.lastDeflect = D.t;
    D.events.push({ type: 'deflect' });
  }
  // omuz omuza
  const j = collideBodies(a, d, 0.1);
  if (j > 60) {
    const defPow = d.mass * (0.85 + 0.35 * sk.e) * (0.85 + D.rnd() * 0.3);
    const attPow = a.mass * (0.9 + D.rnd() * 0.35);
    if (defPow > attPow) {
      a.stun = Math.max(a.stun, 0.4);
      D.events.push({ type: 'shoulder', won: true });
    } else {
      d.stun = Math.max(d.stun, 0.3);
      D.events.push({ type: 'shoulder', won: false });
    }
  }
}

/** Bir fizik adımı. */
export function duelStep(D, h) {
  if (D.result) {
    // sonuçtan sonra dünya yavaşça durur
    stepBall(D.ball, h, ENV);
    for (const p of [D.att, D.def]) {
      accelerate(p, p.vx * 0.9, p.vy * 0.9, h);
      stepBody(p, h);
    }
    return;
  }
  D.t += h;
  // jokey bunu izler: hücumcunun gövdesi + top (gövde çalımı savunmacıyı da kandırır)
  D.hist.push({ t: D.t, x: D.att.x * 0.55 + D.ball.x * 0.45, y: D.att.y * 0.55 + D.ball.y * 0.45 });
  while (D.hist.length && D.hist[0].t < D.t - 0.6) D.hist.shift();
  attackerStep(D, h);
  defenderStep(D, h);
  stepBall(D.ball, h, ENV);
  contacts(D);
  if (D.result) return;
  const { att: a, def: d, ball: b } = D;
  // top oyun dışı (hücumcunun kontrolü dışında)
  if ((b.x < 0 || b.x > D.Wm || b.y > D.Hm) && hyp(b.x - a.x, b.y - a.y) > 1.2) {
    end(D, 'won', { method: 'out', acc: 0.5 });
    return;
  }
  // geçildin: hücumcu topla savunmacının arkasına sarktı
  const withBall = hyp(b.x - a.x, b.y - a.y) < 3.2;
  if (withBall && ((a.y > d.y + 3.2 && b.y > d.y + 1.5) || a.y > D.boxY)) {
    const early = D.lastMiss && D.t - D.lastMiss.t < 1.4 && D.lastMiss.early;
    end(D, early ? 'early' : 'beaten');
    return;
  }
  if (D.t > 14) end(D, 'won', { method: 'time', acc: 0.35 });
  if (groundSpeed(b) < 0.05 && hyp(b.x - a.x, b.y - a.y) > 6) end(D, 'won', { method: 'out', acc: 0.5 });
}
