// Mini oyun katmanı: tanıtım kartı → oyun → sonuç. Maç ve antrenman ikisi de bunu kullanır.
import { el, esc, root, sleep } from '../ui/dom.js';
import { icon } from '../ui/art.js';
import { sfx, unlock } from '../audio.js';
import { loadSettings } from '../core/storage.js';
import { playUnityMoment, unityBuildAvailable } from './unity3d.js';
import { setBallVariant } from './pixel/sprites.js';
import { duckMusic } from '../music/player.js';
import { windArrow } from '../core/weather.js';
import { ASSISTANT, gameTip } from '../ui/tutorial.js';

// Mini oyunlar ayrı parçalar halinde yüklenir (ilk açılış hafifler); maç ekranında boşta önceden yüklenir.
const GAMES = {
  shot: () => import('./shot.js').then((m) => m.playShot),
  header: () => import('./header.js').then((m) => m.playHeader),
  attack: () => import('./attack.js').then((m) => m.playAttack),
  pass: () => import('./drawPass.js').then((m) => m.playDrawPass),
  tackle: () => import('./intercept.js').then((m) => m.playIntercept),
  dribble: () => import('./dribble.js').then((m) => m.playDribble),
  shuttle: () => import('./shuttle.js').then((m) => m.playShuttle),
  interval: () => import('./interval.js').then((m) => m.playInterval),
};
const gameKey = (o) => ({ shot: o.context === 'corner' ? 'header' : 'shot', sprint: 'dribble', endurance: 'shuttle' }[o.type] || o.type);
/** Tüm mini oyunları arka planda indir (maç başlarken çağrılır) */
export function preloadMiniGames() {
  for (const f of Object.values(GAMES)) f().catch(() => {});
}

/**
 * @param {{type:'shot'|'pass'|'tackle'|'dribble'|'shuttle', skill:number, context?:string, title:string, text:string, me?:object,
 *   minute?:number, myKit:object, oppKit?:object, keeper?:number, number?:number, name?:string, skin?:string, auto?:boolean,
 *   big?:{title:string, nerves:number, tempo:number, cool:boolean}|null}} o
 */
export async function runMiniGame(o) {
  const gameLoad = !o.auto && GAMES[gameKey(o)] ? GAMES[gameKey(o)]().catch(() => null) : null; // giriş ekranı okunurken yüklenir
  const pct = Math.round(o.skill * 100);
  const big = o.big && o.big.nerves > 0 ? o.big : null;
  const nervesPct = big ? Math.round(big.nerves * 100) : 0;
  // Kalp atışı hızı heyecanla artar; Soğukkanlı mentor yavaşlatır
  const beat = big ? Math.max(0.45, 1.1 / big.tempo - big.nerves) : 1;
  const w = o.weather || null;
  const fat0 = Math.max(0, Math.min(0.65, o.fatigue || 0));
  // Kondisyon (spor salonu) düşükse maçın ilk dakikasından itibaren ağırlık: koşu yavaş, şut dairesi büyük, pas hata payı
  const gymCond = o.cond ?? 62;
  const condPen = Math.max(0, 62 - gymCond) / 62 * 0.32;
  const fat = Math.min(0.8, fat0 + condPen);
  const cond = Math.round(100 - fat0 * 100);
  // Kar/eksi derece: topa tam vuramama riski
  const frozen = !!o.weather && (o.weather.surface === 'snow' || (o.weather.temp ?? 10) <= 0);
  const wChip = w ? `<span class="chip wx-chip" title="${esc(w.note)}">${w.emoji} ${w.temp}°${w.windKmh >= 12 ? ` · ${windArrow(w.wind)} ${w.windKmh}` : ''}</span>` : '';
  const tip = o.auto ? null : gameTip(o.type, o.context);
  const fChip = fat > 0.04 ? `<span class="chip ${fat > 0.4 ? 'bad' : fat > 0.22 ? 'warn' : ''} fat-chip">${icon('bolt', 'ico sm')} %${Math.round(100 - fat * 100)}</span>` : '';
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
          ${tip ? `<div class="tut-tip"><b>💡 ${esc(ASSISTANT)}</b><span>${esc(tip)}</span></div>` : ''}
          ${w && w.id !== 'clear' && w.id !== 'cloudy' ? `<div class="wx-note"><span>${w.emoji}</span><div><b>${esc(w.name)} · ${w.temp}°C${w.windKmh >= 12 ? ` · rüzgâr ${windArrow(w.wind)} ${w.windKmh} km/sa` : ''}</b><span>${esc(w.note)}</span></div></div>` : ''}
          ${fat > 0.12 ? `<div class="wx-note fat"><span>🫁</span><div><b>${condPen > 0.06 ? `Kondisyon düşük (salon %${Math.round(gymCond)})` : `Kondisyon %${cond}`}</b><span>${fat > 0.4 ? 'Bacakların ağırlaştı: koşun yavaş, şut dairen büyük, paslarında hata payı var.' : 'Biraz ağırsın: koşu biraz yavaş, şut dairesi geniş, pas sapabilir.'}</span></div></div>` : ''}
          ${frozen && ['shot', 'pass', 'attack'].includes(o.type) ? `<div class="wx-note fat"><span>🥶</span><div><b>Buz gibi zemin</b><span>Ayağın kayabilir: topa tam vuramama riski var.</span></div></div>` : ''}
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
  duckMusic(true); // yalnız oyun sırasında hafifçe kıs
  const host = layer.querySelector('.game-stage');

  let result;
  if (o.auto) {
    // Otomatik test modu (?autoplay=1): oyunu oynamadan yeteneğe göre sonuç üretir
    await sleep(300);
    const success = Math.random() < 0.3 + o.skill * 0.5;
    result = { success, accuracy: success ? Math.random() : 0, outcome: success ? 'goal' : 'save' };
  } else {
    const common = { skill: o.skill, context: o.context, myKit: o.myKit, oppKit: o.oppKit, me: o.me, number: o.number, tempo: big ? big.tempo : 1, nerves: big ? big.nerves : 0, weather: w, fatigue: fat, heavy: fat, frozen };
    // Maçın topu (core/matchBall.js: kar → turuncu, yağmur, akşam, turnuva, ülke); verilmezse karda turuncu
    setBallVariant(o.ball || (w?.surface === 'snow' ? 'orange' : 'white'));
    // 3B mod (Ayarlar): pas ve şut anları Unity WebGL derlemesinde oynanır; yüklenemezse 2B oyuna düşer
    if ((o.type === 'pass' || (o.type === 'shot' && o.context !== 'corner' && o.context !== 'freekick')) && loadSettings().unity3d && (await unityBuildAvailable())) {
      result = await playIn3D(host, o, big).catch(() => null);
    }
    const play = result ? null : await gameLoad;
    if (!result && !play) result = { success: false, accuracy: 0, outcome: 'none' };
    if (!result) switch (gameKey(o)) {
      // Korner: kafa düellosu; diğer şutlar (ceza sahası, uzaktan, serbest vuruş, penaltı) şut oyununda
      case 'shot': case 'header': result = await play(host, { ...common, keeper: o.keeper }); break;
      // Kesintisiz atak: pas (ofsayt) → çalım → şut, tek anda
      case 'attack': result = await play(host, common, { context: o.context, keeper: o.keeper }); break;
      // Hız: Adamı Geç (seçmelerdeki çalım istasyonu ile aynı oyun)
      case 'dribble': result = await play(host, { ...common, rows: 8 }); break;
      // Kondisyon parkuru: nabız bölgesi + engeller (kondisyon seviyesi nabzı etkiler)
      case 'interval': result = await play(host, { ...common, cond: gymCond }); break;
      // Pas (çizerek), defans (pas arası), dayanıklılık (mekik)
      default: result = await play(host, common);
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
