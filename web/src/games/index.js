// Mini oyun katmanı: tanıtım kartı → oyun → sonuç. Maç ve antrenman ikisi de bunu kullanır.
import { el, esc, root, sleep } from '../ui/dom.js';
import { icon } from '../ui/art.js';
import { sfx, unlock } from '../audio.js';
import { playShot } from './shot.js';
import { playDrawPass } from './drawPass.js';
import { loadSettings } from '../core/storage.js';
import { playIntercept } from './intercept.js';
import { playDribble } from './dribble.js';
import { playShuttle } from './shuttle.js';
import { playHeader } from './header.js';
import { playAttack } from './attack.js';
import { playUnityMoment, unityBuildAvailable } from './unity3d.js';
import { setBallVariant } from './pixel/sprites.js';
import { duckMusic } from '../music/player.js';
import { windArrow } from '../core/weather.js';

/**
 * @param {{type:'shot'|'pass'|'tackle'|'dribble'|'shuttle', skill:number, context?:string, title:string, text:string, me?:object,
 *   minute?:number, myKit:object, oppKit?:object, keeper?:number, number?:number, name?:string, skin?:string, auto?:boolean,
 *   big?:{title:string, nerves:number, tempo:number, cool:boolean}|null}} o
 */
export async function runMiniGame(o) {
  const pct = Math.round(o.skill * 100);
  const big = o.big && o.big.nerves > 0 ? o.big : null;
  const nervesPct = big ? Math.round(big.nerves * 100) : 0;
  // Kalp atışı hızı heyecanla artar; Soğukkanlı mentor yavaşlatır
  const beat = big ? Math.max(0.45, 1.1 / big.tempo - big.nerves) : 1;
  const w = o.weather || null;
  const fat = Math.max(0, Math.min(0.65, o.fatigue || 0));
  const cond = Math.round(100 - fat * 100);
  const wChip = w ? `<span class="chip wx-chip" title="${esc(w.note)}">${w.emoji} ${w.temp}°${w.windKmh >= 12 ? ` · ${windArrow(w.wind)} ${w.windKmh}` : ''}</span>` : '';
  const fChip = fat > 0.04 ? `<span class="chip ${cond < 60 ? 'bad' : cond < 78 ? 'warn' : ''} fat-chip">${icon('bolt', 'ico sm')} %${cond}</span>` : '';
  const layer = el(`
    <div class="game-layer ${big ? 'nervous' : ''}" ${big ? `style="--nerves:${big.nerves};--beat:${beat.toFixed(2)}s"` : ''}>
      ${big ? '<div class="nerves-vignette" aria-hidden="true"></div>' : ''}
      <div class="game-hud">
        <div class="grow">
          <div class="t">${esc(o.title)}</div>
          <div class="s">Etkin yetenek %${pct}${o.minute ? ` · ${o.minute}'` : ''}</div>
        </div>
        ${wChip}${fChip}
        ${big ? `<span class="chip ${big.cool ? 'cool' : 'bad'} nerves-chip">${icon(big.cool ? 'snow' : 'fire', 'ico sm')} Heyecan %${nervesPct}</span>` : ''}
      </div>
      <div class="game-stage"></div>
      <div class="game-intro">
        <div class="card">
          ${o.minute ? `<span class="minute">${o.minute}'</span>` : ''}
          <h3 style="margin-top:8px">${esc(o.title)}</h3>
          <p class="lead" style="margin:6px 0 12px;color:var(--muted);line-height:1.45">${esc(o.text)}</p>
          ${w && w.id !== 'clear' && w.id !== 'cloudy' ? `<div class="wx-note"><span>${w.emoji}</span><div><b>${esc(w.name)} · ${w.temp}°C${w.windKmh >= 12 ? ` · rüzgâr ${windArrow(w.wind)} ${w.windKmh} km/sa` : ''}</b><span>${esc(w.note)}</span></div></div>` : ''}
          ${fat > 0.12 ? `<div class="wx-note fat"><span>🫁</span><div><b>Kondisyon %${cond}</b><span>${cond < 60 ? 'Bacakların ağırlaştı: nişan sallanıyor, adımların yavaş.' : 'Biraz yoruldun: hareketlerin hafif ağırlaştı.'}</span></div></div>` : ''}
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
  duckMusic(true);
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
    const common = { skill: o.skill, context: o.context, myKit: o.myKit, oppKit: o.oppKit, me: o.me, number: o.number, tempo: big ? big.tempo : 1, nerves: big ? big.nerves : 0, weather: w, fatigue: fat };
    // Karlı maçta turuncu top
    setBallVariant(w?.surface === 'snow' ? 'orange' : 'white');
    // 3B mod (Ayarlar): pas ve şut anları Unity WebGL derlemesinde oynanır; yüklenemezse 2B oyuna düşer
    if ((o.type === 'pass' || (o.type === 'shot' && o.context !== 'corner' && o.context !== 'freekick')) && loadSettings().unity3d && (await unityBuildAvailable())) {
      result = await playIn3D(host, o, big).catch(() => null);
    }
    if (!result) switch (o.type) {
      // Korner: kafa düellosu; diğer şutlar (ceza sahası, uzaktan, serbest vuruş, penaltı) şut oyununda
      case 'shot': result = o.context === 'corner' ? await playHeader(host, { ...common, keeper: o.keeper }) : await playShot(host, { ...common, keeper: o.keeper }); break;
      // Kesintisiz atak: pas (ofsayt) → çalım → şut, tek anda
      case 'attack': result = await playAttack(host, common, { context: o.context, keeper: o.keeper }); break;
      // Tek pas sistemi: çizerek kavisli pas (seçmelerde de aynı)
      case 'pass': result = await playDrawPass(host, common); break;
      // Defans: pas arası (maçta ve antrenmanda aynı)
      case 'tackle': result = await playIntercept(host, common); break;
      // Hız: Adamı Geç (seçmelerdeki çalım istasyonu ile aynı oyun)
      case 'dribble': case 'sprint': result = await playDribble(host, { ...common, rows: 8 }); break;
      // Dayanıklılık: mekik koşusu (bip testi)
      case 'shuttle': case 'endurance': result = await playShuttle(host, common); break;
      default: result = { success: false, accuracy: 0, outcome: 'none' };
    }
  }
  setBallVariant('white');
  duckMusic(false);
  layer.style.transition = 'opacity .25s';
  layer.style.opacity = '0';
  await sleep(250);
  layer.remove();
  return result;
}

/** Unity 3B: yükleme çubuğu gösterir, anı oynatır, sonucu web biçiminde döndürür. */
async function playIn3D(host, o, big) {
  const bar = el('<div class="unity-loading"><b>3B sahne yükleniyor…</b><div class="bar"><i style="--c:var(--accent);width:0%"></i></div></div>');
  host.appendChild(bar);
  const fill = bar.querySelector('i');
  const s = Math.max(0, Math.min(1, o.skill ?? 0.5));
  try {
    const r = await playUnityMoment(host, {
      type: o.type,
      context: o.type === 'shot' ? (o.context === 'penalty' ? 'penalty' : 'box') : o.context === 'final' ? 'final' : 'buildup',
      passing: o.type === 'pass' ? s : s * 0.9,
      shooting: o.type === 'shot' ? s : s * 0.9,
      speed: s,
      nerves: big ? big.nerves : 0,
      keeper: o.keeper ?? 0.5,
      myColor: o.myKit?.colors?.[0],
      oppColor: o.oppKit?.colors?.[0],
    }, (p) => {
      fill.style.width = `${Math.round(p * 100)}%`;
      if (p >= 1) bar.remove();
    });
    bar.remove();
    return { success: !!r.success, accuracy: Number(r.accuracy) || 0, outcome: r.outcome || (r.success ? 'success' : 'missed'), curve: Number(r.curve) || 0 };
  } catch (e) {
    bar.remove();
    throw e;
  }
}
