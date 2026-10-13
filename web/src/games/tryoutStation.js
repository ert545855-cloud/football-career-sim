// SEÇME İSTASYONU KATMANI — öğretici kart → oyun → her denemede hak (kalp) kontrolü.
// Kurallar core/onboarding/tryouts.js'teki TryoutSession'dadır; buradaki oyunlar yalnızca
// "başarılı mı?" bilgisini bildirir (onAttempt) ve dönen sonuca göre devam eder ya da biter.
import { el, esc, root, sleep } from '../ui/dom.js';
import { icon } from '../ui/art.js';
import { sprite } from '../assets/sprites.js';
import { sfx, buzz, unlock } from '../audio.js';
import { TRYOUT_RULES } from '../core/onboarding/tryouts.js';
import { playTryoutPass } from './tryoutPass.js';
import { playTryoutDribble } from './tryoutDribble.js';
import { playShot } from './shot.js';

/** Şut istasyonu hedefleri: kalenin dört köşesi (kale koordinatı: u −1…1, v 0…1) */
const CORNERS = [
  { u: -0.7, v: 0.78 },
  { u: 0.7, v: 0.78 },
  { u: -0.7, v: 0.22 },
  { u: 0.7, v: 0.22 },
];

export function heartsHTML(n, max = TRYOUT_RULES.heartsPerStation) {
  return Array.from({ length: max }, (_, i) => `<i class="heart ${i < n ? 'on' : 'off'}">${icon('heartFill', 'ico')}</i>`).join('');
}

/**
 * Bir istasyonu baştan sona oynatır.
 * @param {{station:import('../core/onboarding/tryouts.js').StationDef, session:import('../core/onboarding/tryouts.js').TryoutSession,
 *   myKit:object, number?:number, auto?:boolean, onProgress?:(session:any)=>void}} o
 *   onProgress: her denemeden sonra çağrılır (kayıt: sayfa yenilense de kaybedilen hak geri gelmez)
 * @returns {Promise<ReturnType<import('../core/onboarding/tryouts.js').TryoutSession['finishStation']>>}
 */
export async function runTryoutStation(o) {
  const { station, session } = o;
  const st = () => session.state(station.id);
  // Kayıttan dönüş: istasyon bitmiş ama kapatılmamışsa doğrudan kapat
  if (st().done) return session.finishStation();
  const layer = el(`
    <div class="game-layer tryout-layer">
      <div class="game-hud">
        <div class="grow">
          <div class="t">${esc(station.name)}</div>
          <div class="s" data-attempt></div>
        </div>
        <div class="hearts" data-hearts>${heartsHTML(st().hearts)}</div>
      </div>
      <div class="game-stage"></div>
      <div class="game-intro">
        <div class="card">
          <div class="row" style="gap:12px;align-items:center">
            <span class="station-art">${sprite(station.sprite, { size: 52 })}</span>
            <div class="grow"><span class="chip accent">EĞİTİM</span><h3 style="margin:6px 0 0">${esc(station.name)}</h3><div class="muted small">${esc(station.teaches)}</div></div>
          </div>
          <ol class="tut-steps">${station.tutorial.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
          <div class="rule-box">
            <div class="hearts big">${heartsHTML(3)}</div>
            <div class="small"><b>3 hakkın var.</b> Her hata 1 hak götürür. İstasyon sonunda kalan hakların seçme skoruna eklenir.<br><span class="muted">İlk deneme ısınmadır, hak götürmez.</span></div>
          </div>
          <button class="btn primary lg block" data-go>${icon('play')} Başla</button>
        </div>
      </div>
    </div>`);
  root().appendChild(layer);
  const heartsEl = layer.querySelector('[data-hearts]');
  const attemptEl = layer.querySelector('[data-attempt]');
  const label = () => {
    const s = st();
    attemptEl.textContent = session.isWarmup(station.id) ? 'Isınma denemesi · hak gitmez' : `Deneme ${Math.min(s.attempts + 1, station.attempts)}/${station.attempts}`;
  };
  label();

  await new Promise((res) => {
    if (o.auto) return res();
    layer.querySelector('[data-go]').addEventListener('click', () => {
      unlock();
      sfx('click');
      res();
    }, { once: true });
  });
  layer.querySelector('.game-intro').remove();
  const host = layer.querySelector('.game-stage');

  /** HAK KONTROLÜ: sonucu oturuma yazar, HUD'u günceller */
  const onAttempt = (success) => {
    const r = session.record(success);
    o.onProgress?.(session);
    if (r.lostHeart) {
      const hearts = heartsEl.querySelectorAll('.heart');
      const lost = hearts[r.hearts];
      lost?.classList.remove('on');
      lost?.classList.add('off', 'break');
      buzz('heartBreak');
    }
    label();
    return r;
  };

  if (o.auto) {
    // Otomatik test modu: oynamadan, %70 başarıyla
    while (!st().done) {
      await sleep(90);
      onAttempt(Math.random() < 0.7);
    }
  } else if (station.id === 'pass') {
    await playTryoutPass(host, { onAttempt, isWarmup: () => session.isWarmup(station.id), myKit: o.myKit, number: o.number });
  } else if (station.id === 'dribble') {
    await playTryoutDribble(host, { onAttempt, isWarmup: () => session.isWarmup(station.id), myKit: o.myKit, number: o.number, rows: station.attempts });
  } else {
    let last = -1;
    while (!st().done) {
      let i = Math.floor(Math.random() * CORNERS.length);
      if (i === last) i = (i + 1) % CORNERS.length;
      last = i;
      const result = await playShot(host, {
        skill: 0.66,
        context: 'box',
        keeper: 0,
        timeLimit: 8,
        myKit: o.myKit,
        oppKit: { colors: ['#334155', '#f8fafc'] },
        target: { ...CORNERS[i], r: 0.25 },
        corners: CORNERS,
      });
      onAttempt(result.success);
      await sleep(250);
    }
  }
  await sleep(300);
  layer.style.transition = 'opacity .25s';
  layer.style.opacity = '0';
  await sleep(250);
  layer.remove();
  return session.finishStation();
}
