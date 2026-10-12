// Mini oyun katmanı: tanıtım kartı → oyun → sonuç. Maç ve antrenman ikisi de bunu kullanır.
import { el, esc, root, sleep } from '../ui/dom.js';
import { icon } from '../ui/art.js';
import { sfx, unlock } from '../audio.js';
import { playShot } from './shot.js';
import { playPass } from './pass.js';
import { playTackle } from './tackle.js';
import { playSprint } from './sprint.js';

/**
 * @param {{type:'shot'|'pass'|'tackle'|'sprint'|'endurance', skill:number, context?:string, title:string, text:string,
 *   minute?:number, myKit:object, oppKit?:object, keeper?:number, number?:number, name?:string, skin?:string, auto?:boolean,
 *   big?:{title:string, nerves:number, tempo:number, cool:boolean}|null}} o
 */
export async function runMiniGame(o) {
  const pct = Math.round(o.skill * 100);
  const big = o.big && o.big.nerves > 0 ? o.big : null;
  const nervesPct = big ? Math.round(big.nerves * 100) : 0;
  // Kalp atışı hızı heyecanla artar; Soğukkanlı mentor yavaşlatır
  const beat = big ? Math.max(0.45, 1.1 / big.tempo - big.nerves) : 1;
  const layer = el(`
    <div class="game-layer ${big ? 'nervous' : ''}" ${big ? `style="--nerves:${big.nerves};--beat:${beat.toFixed(2)}s"` : ''}>
      ${big ? '<div class="nerves-vignette" aria-hidden="true"></div>' : ''}
      <div class="game-hud">
        <div class="grow">
          <div class="t">${esc(o.title)}</div>
          <div class="s">Etkin yetenek %${pct}${o.minute ? ` · ${o.minute}'` : ''}</div>
        </div>
        ${big ? `<span class="chip ${big.cool ? 'cool' : 'bad'} nerves-chip">${icon(big.cool ? 'snow' : 'fire', 'ico sm')} Heyecan %${nervesPct}</span>` : ''}
      </div>
      <div class="game-stage"></div>
      <div class="game-intro">
        <div class="card">
          ${o.minute ? `<span class="minute">${o.minute}'</span>` : ''}
          <h3 style="margin-top:8px">${esc(o.title)}</h3>
          <p class="lead" style="margin:6px 0 12px;color:var(--muted);line-height:1.45">${esc(o.text)}</p>
          ${big ? `<div class="nerves-note ${big.cool ? 'cool' : ''}">${icon(big.cool ? 'snow' : 'fire', 'ico sm')}<div><b>${esc(big.title)}: heyecan %${nervesPct}</b><span>${big.cool ? 'Soğukkanlı mentorun sayesinde heyecanın %20 az, nişangah daha yavaş.' : 'Kalbin hızlı atıyor: nişangah titriyor, oyun daha hızlı akıyor.'}</span></div></div>` : ''}
          <div class="meter" style="margin-bottom:14px">
            <div class="meter-top"><span class="lbl">${icon('target')} Etkin yetenek</span><span>%${pct}</span></div>
            <div class="bar"><i style="width:${pct}%"></i></div>
          </div>
          <button class="btn primary lg block" data-go>${icon('play')} BAŞLA</button>
        </div>
      </div>
    </div>`);
  root().appendChild(layer);
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

  let result;
  if (o.auto) {
    // Otomatik test modu (?autoplay=1): oyunu oynamadan yeteneğe göre sonuç üretir
    await sleep(300);
    const success = Math.random() < 0.3 + o.skill * 0.5;
    result = { success, accuracy: success ? Math.random() : 0, outcome: success ? 'goal' : 'save' };
  } else {
    const common = { skill: o.skill, context: o.context, myKit: o.myKit, oppKit: o.oppKit, number: o.number, skin: o.skin, tempo: big ? big.tempo : 1, nerves: big ? big.nerves : 0 };
    switch (o.type) {
      case 'shot': result = await playShot(host, { ...common, keeper: o.keeper }); break;
      case 'pass': result = await playPass(host, common); break;
      case 'tackle': result = await playTackle(host, common); break;
      case 'sprint': result = await playSprint(host, { ...common, mode: 'sprint', name: o.name }); break;
      case 'endurance': result = await playSprint(host, { ...common, mode: 'endurance', name: o.name }); break;
      default: result = { success: false, accuracy: 0, outcome: 'none' };
    }
  }
  layer.style.transition = 'opacity .25s';
  layer.style.opacity = '0';
  await sleep(250);
  layer.remove();
  return result;
}
