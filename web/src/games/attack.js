// KESİNTİSİZ ATAK — tek bir hücum anı, art arda üç aşama: ver-kaç pası (ofsayta dikkat) → son adamı geç → şut.
// Aşamalar arasında tanıtım kartı yok; üstte zincir göstergesi (PAS › ÇALIM › ŞUT) ilerler.
// Bir aşama başarısız olursa atak orada biter (sonuç hangi aşamada koptuğunu söyler).
import { el, sleep } from '../ui/dom.js';
import { sfx, buzz } from '../audio.js';
import { playDrawPass } from './drawPass.js';
import { playDribble } from './dribble.js';
import { playShot } from './shot.js';

const LABEL = { pass: 'PAS', dribble: 'ÇALIM', shot: 'ŞUT' };
const NEXT = {
  dribble: 'Pas tuttu, top geri sende! Son adamı geç',
  shot: 'Kaleciyle karşı karşıyasın. Vur!',
};

/**
 * @param {HTMLElement} host
 * @param {object} common runMiniGame ortak ayarları (skill, myKit, oppKit, me, weather, fatigue …)
 * @param {{context?:'counter'|'build', keeper?:number}} o
 */
export async function playAttack(host, common, o = {}) {
  const steps = o.context === 'build' ? ['pass', 'shot'] : ['pass', 'dribble', 'shot'];
  const bar = el(`<div class="chain-bar">${steps.map((s, i) => `${i ? '<i>›</i>' : ''}<span data-step="${s}">${LABEL[s]}</span>`).join('')}</div>`);
  host.appendChild(bar);
  const mark = (s, cls) => bar.querySelector(`[data-step="${s}"]`)?.classList.add(cls);
  const stages = [];
  let last = null;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    mark(step, 'on');
    const stageHost = el('<div class="chain-stage"></div>');
    host.appendChild(stageHost);
    // Zincir ilerledikçe tempo hafif artar (kontra atağın heyecanı)
    const tempo = (common.tempo || 1) * (1 + i * 0.05);
    let r;
    if (step === 'pass') r = await playDrawPass(stageHost, { ...common, tempo, context: 'final', offside: true });
    else if (step === 'dribble') r = await playDribble(stageHost, { ...common, tempo, rows: 3, warmup: false, attack: true, passRatio: 0.6 });
    else r = await playShot(stageHost, { ...common, tempo, context: 'box', keeper: o.keeper });
    stageHost.remove();
    stages.push({ step, success: !!r.success, outcome: r.outcome });
    last = r;
    if (!r.success) {
      mark(step, 'fail');
      await sleep(250);
      bar.remove();
      return { success: false, accuracy: 0, outcome: r.outcome, chain: true, stage: step, stages, offside: r.outcome === 'offside' };
    }
    mark(step, 'done');
    if (i < steps.length - 1) {
      const nxt = steps[i + 1];
      const card = el(`<div class="chain-next"><b>${LABEL[step]} ✓</b><span>${NEXT[nxt]}</span></div>`);
      host.appendChild(card);
      sfx('levelup');
      buzz('pass');
      await sleep(900);
      card.remove();
    }
  }
  bar.remove();
  const passStage = stages[0];
  return {
    success: !!last.success,
    accuracy: last.accuracy || 0,
    outcome: last.outcome,
    chain: true,
    stage: 'shot',
    stages,
    through: passStage?.success,
    panenka: false,
    rebound: !!last.rebound,
  };
}
