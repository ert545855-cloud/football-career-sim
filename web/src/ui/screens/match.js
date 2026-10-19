// MAÇ EKRANI — canlı anlatım, skor tabelası, oyuncunun anlarında mini oyun.
import { CLUB_BY_ID, GAME_WEIGHTS } from '../../core/data.js';
import { applyAiEvent, MOMENT_INTRO, momentFatigue, momentTitle, resolveMoment } from '../../core/match.js';
import { conditionPct, windArrow } from '../../core/weather.js';
import { effectiveSkill } from '../../core/player.js';
import { clubRating } from '../../core/league.js';
import { runMiniGame } from '../../games/index.js';
import { playerLook } from '../../core/cosmetics.js';
import { buzz, sfx } from '../../audio.js';
import { crestSVG, icon } from '../art.js';
import { confetti, el, esc, sleep } from '../dom.js';
import { sprite } from '../../assets/sprites.js';
import { FEED_SPRITES } from '../spriteMap.js';
import { nationalCrest } from '../nationalView.js';
import { createBroadcast } from '../broadcast.js';
import { playerCanvas } from '../../games/pixel/sprites.js';
import { shortName as shortOf } from '../../core/lineups.js';

const CHANTS = [
  (t) => `Ooo ${t} ooo! Ooo ${t} ooo!`,
  (t) => `Sonuna kadar ${t}, sonuna kadar!`,
  () => 'Hep beraber, hep birlikte, bu maçı kazanmaya!',
  (t) => `${t}! (alkış alkış alkış) ${t}!`,
  () => 'Bu tribün susmaz, bu tribün yorulmaz!',
  () => 'Kalk ayağa, kalk ayağa, yürü yürü!',
];

/** Oyuncunun piksel portresi (kafa + omuzlar) */
function drawFace(cnv, look) {
  try {
    const src = playerCanvas(look, 'down', 'idle');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const size = cnv.clientWidth || 26;
    cnv.width = Math.round(size * dpr);
    cnv.height = Math.round(size * dpr);
    const g = cnv.getContext('2d');
    g.imageSmoothingEnabled = false;
    // ızgara satır 0–14: saç, yüz, boyun, omuz
    const rows = 15;
    const k = cnv.height / rows;
    g.drawImage(src, 0, 0, src.width, rows, (cnv.width - src.width * k) / 2, 0, src.width * k, rows * k);
  } catch { /* portre olmadan da çalışır */ }
}

const pickLine = (a) => a[Math.floor(Math.random() * a.length)];
const WX_KICKOFF = {
  rain: (w) => `Yağmur altında oynanıyor (${w.temp}°C). Zemin ıslak, top hızlı kayıyor.`,
  storm: (w) => `Sağanak yağış ve sert rüzgâr (${w.windKmh} km/sa)! Uzun toplar sürüklenecek.`,
  snow: (w) => `Lapa lapa kar yağıyor, ${w.temp}°C. Hakem turuncu topu oyuna soktu.`,
  mud: () => 'Saha çamur deryası. Top yerde yavaşlıyor, ayaklar ağır.',
  hot: (w) => `Termometre ${w.temp}°C'yi gösteriyor. Bu sıcakta kondisyon belirleyici olacak.`,
  windy: (w) => `Stadyumda sert rüzgâr var (${w.windKmh} km/sa). Havadan toplar zor kontrol edilecek.`,
};
const WX_MID = {
  rain: ['Yağmur şiddetini artırdı, oyuncular kaymamak için dikkatli.', 'Islak zeminde top hızlı akıyor; uzun pas riskli.'],
  storm: ['Şimşek çaktı, tribünlerden uğultu yükseldi!', 'Rüzgâr ortaları yolundan saptırıyor.'],
  snow: ['Görevliler çizgileri temizlemek için sahaya girdi.', 'Kar kalınlaştı, top zor yuvarlanıyor.'],
  mud: ['Bir oyuncu çamurda kaydı, forması kahverengiye döndü.', 'Ağır zeminde pas trafiği yavaşladı.'],
  hot: ['Hakem su molası verdi. Oyuncular gölgeye koştu.', 'Sıcak bacakları ağırlaştırdı, tempo düştü.'],
  windy: ['Rüzgâr kale vuruşunu geri itti!', 'Uzun top rüzgârla taca gitti.'],
};

export function matchScreen(app, { match }) {
  const s = app.state;
  // Milli maçlarda takımlar match.teams içinde gelir (kulüp kimliği yok)
  const home = match.teams?.home || CLUB_BY_ID[match.homeId];
  const away = match.teams?.away || CLUB_BY_ID[match.awayId];
  const my = match.myKit || CLUB_BY_ID[match.myId];
  const opp = match.oppKit || CLUB_BY_ID[match.oppId];
  const crest = (t, cls = 'crest') => (t.national ? nationalCrest(cls, t.national) : crestSVG(t, cls));
  const hs = home.short || (home.name || '').slice(0, 3).toUpperCase();
  const as = away.short || (away.name || '').slice(0, 3).toUpperCase();
  const name = s.player.name;
  const shortName = name.split(' ')[0];

  const timeline = [{ minute: 0, order: 0, kind: 'kickoff' }];
  match.events.forEach((ev) => timeline.push({ minute: ev.minute, order: 2, ev }));
  match.moments.forEach((m) => timeline.push({ minute: m.minute, order: 3, m }));
  if (match.subMinute) timeline.push({ minute: match.subMinute, order: 1, kind: 'sub' });
  if (match.subOff) timeline.push({ minute: match.subOff, order: 5, kind: 'subOff' });
  const w = match.weather;
  if (w && w.id !== 'clear' && w.id !== 'cloudy') timeline.push({ minute: 20 + Math.floor(Math.random() * 45), order: 1, kind: 'wx' });
  timeline.push({ minute: 45, order: 4, kind: 'ht' });
  // Tribün tezahüratları
  [8 + Math.floor(Math.random() * 12), 30 + Math.floor(Math.random() * 12), 58 + Math.floor(Math.random() * 12), 80 + Math.floor(Math.random() * 6)].forEach((m) => timeline.push({ minute: m, order: 1, kind: 'chant' }));
  timeline.push({ minute: 90 + match.stoppage, order: 9, kind: 'ft' });
  timeline.sort((a, b) => a.minute - b.minute || a.order - b.order);

  const roleText = match.role === 'starter' ? 'İlk 11\'desin' : match.role === 'out' ? (match.reason === 'suspended' ? 'Cezalısın, tribündesin' : 'Sakatsın, tribündesin') : 'Yedek kulübesindesin';

  return {
    tabs: false,
    html: `
      <div class="bc-wrap">
        <div class="bc" data-bc>
          <canvas class="bc-cv"></canvas>
          <div class="bc-sb">
            <span class="bc-time" data-min>00:00</span>
            <span class="bc-tm" style="--tc:${home.colors?.[0] || '#fff'}">${crest(home, 'crest bc-crest')}<b>${esc(hs)}</b></span>
            <span class="bc-sc" data-score>0 - 0</span>
            <span class="bc-tm r" style="--tc:${away.colors?.[0] || '#fff'}"><b>${esc(as)}</b>${crest(away, 'crest bc-crest')}</span>
          </div>
          <div class="bc-card ${match.role === 'starter' ? '' : 'off'}" data-card>
            <canvas class="bc-face"></canvas>
            <div class="bc-card-t"><b><em>${s.player.number}</em>${esc(shortName.toUpperCase())}</b><i class="bc-cond" data-cond><u></u></i></div>
          </div>
          <span class="bc-tag live" data-tag>CANLI</span>
          <canvas class="bc-mini"></canvas>
          <div class="bc-goal" data-goalbanner></div>
          <button class="bc-btn bc-fs" data-fs aria-label="Tam ekran">⛶</button>
          <button class="bc-btn bc-fs-skip" data-fs-skip aria-label="Sıradaki an">»</button>
        </div>
        <div class="bc-goals"><div data-gl-h></div><div data-gl-a></div></div>
      </div>
      <div class="row between" style="margin-top:10px">
        <span class="chip ${match.role === 'starter' ? 'accent' : 'warn'}" data-role>${icon('user')} ${roleText}</span>
        <span class="chip">${match.moments.length ? `${match.moments.length} kritik an` : 'Kritik an yok'}</span>
      </div>
      ${w ? `<div class="wx-strip wx-${w.id}"><span class="wx-e">${w.emoji}</span><b>${esc(w.name)}</b><span>${w.temp}°C</span>${w.windKmh >= 12 ? `<span>${windArrow(w.wind)} ${w.windKmh} km/sa</span>` : ''}<span class="grow"></span><span class="cond-txt" data-condtxt>${match.role !== 'out' ? '%100' : ''}</span></div>` : ''}
      ${match.big ? `<div class="big-banner ${match.big.cool ? 'cool' : ''}">${icon(match.big.kind === 'derby' ? 'fire' : match.big.kind === 'final' ? 'trophy' : match.big.kind === 'national' ? 'flag' : 'star', 'ico sm')}<b>${esc(match.big.title)}</b><span>Heyecan %${Math.round(match.big.nerves * 100)}${match.big.cool ? ' · Soğukkanlı' : ''}</span></div>` : ''}
      <div class="mom-bar"><i data-mom></i></div>
      <div class="feed" data-feed></div>
      <div style="height:90px"></div>
      <div class="match-controls">
        <button class="btn ghost" data-speed>${icon('play')} ${app.settings.speed || 1}x</button>
        <button class="btn primary grow" data-skip>${icon('chev')} ${match.moments.length ? 'Sıradaki ana' : 'Sona atla'}</button>
      </div>`,
    mount(el0, screenEl) {
      const scoreEl = el0.querySelector('[data-score]');
      const minEl = el0.querySelector('[data-min]');
      const feed = el0.querySelector('[data-feed]');
      const mom = el0.querySelector('[data-mom]');
      const roleEl = el0.querySelector('[data-role]');
      const speedBtn = el0.querySelector('[data-speed]');
      const skipBtn = el0.querySelector('[data-skip]');
      let minute = 0;
      let idx = 0;
      let busy = false;
      let finished = false;
      let skipTo = null;
      let momentum = 50;
      let offPitch = false;
      const condEl = el0.querySelector('[data-cond] u');
      const condTxt = el0.querySelector('[data-condtxt]');
      const updateCond = () => {
        if (!condEl || match.role === 'out') return;
        const on = match.role === 'starter' || (match.subMinute && minute >= match.subMinute);
        const f = on && !offPitch ? momentFatigue(s, match, Math.min(90, minute)) : momentFatigue(s, match, Math.min(90, match.subOff || minute));
        const pct = match.role === 'bench' && !on ? 100 : conditionPct(f);
        condEl.style.width = `${pct}%`;
        condEl.style.background = pct < 60 ? 'var(--bad)' : pct < 78 ? '#f59e0b' : '#22c55e';
        if (condTxt) condTxt.textContent = `Kondisyon %${pct}`;
      };
      // ── Canlı yayın ──
      const bcEl = el0.querySelector('[data-bc]');
      const meLook = playerLook(s, { club: my });
      const bc = createBroadcast(bcEl, {
        myKit: my, oppKit: opp, homeIsMy: match.isHome,
        lineups: match.lineups || {},
        me: { look: meLook, num: s.player.number, name: shortName, pos: s.player.position, onPitch: match.role === 'starter' },
        weather: match.weather,
        speed: () => app.settings.speed || 1,
        auto: app.autoplay,
        names: { home: home.name, away: away.name, homeShort: hs, awayShort: as, city: CLUB_BY_ID[match.homeId]?.city || '' },
      });
      bc.onSfx((n) => sfx(n));
      if (import.meta.env?.DEV) window.__bc = bc;
      drawFace(el0.querySelector('.bc-face'), meLook);
      const glH = el0.querySelector('[data-gl-h]');
      const glA = el0.querySelector('[data-gl-a]');
      const renderGoals = () => {
        const homeSide = match.isHome ? 'my' : 'opp';
        const fmt = (g) => `<span class="${g.me ? 'me' : ''}">⚽ ${esc(g.me ? shortName : shortOf(g.scorer || '') || '?')} ${g.minute}'${g.meAssist ? ' <i>(A: sen)</i>' : ''}</span>`;
        glH.innerHTML = (match.goals || []).filter((g) => g.side === homeSide).map(fmt).join('');
        glA.innerHTML = (match.goals || []).filter((g) => g.side !== homeSide).map(fmt).join('');
      };
      let chanceAnims = 0;
      const animate = async (ln, g) => {
        if (skipTo !== null || app.autoplay) return;
        const goal = ln.kind === 'goal-my' || ln.kind === 'goal-me' || ln.kind === 'goal-opp';
        if (goal) {
          const side = ln.kind === 'goal-opp' ? 'opp' : 'my';
          const me = ln.kind === 'goal-me';
          const meAssist = !!g?.meAssist;
          await bc.play({
            side, outcome: 'goal', kind: g?.kind || (me ? 'solo' : 'open'),
            scorer: me ? shortName : g?.scorer, me,
            assist: meAssist ? shortName : g?.assist ?? undefined, meAssist,
            assistLabel: meAssist ? shortName : g?.assist ? shortOf(g.assist) : '',
            replay: me || meAssist,
          });
        } else if (ln.ai && ['save', 'post', 'chance'].includes(ln.kind) && (app.settings.speed || 1) === 1 && chanceAnims < 4) {
          chanceAnims++;
          await bc.play({ side: ln.side || 'my', outcome: ln.kind === 'save' ? 'save' : ln.kind === 'post' ? 'post' : 'miss', kind: Math.random() < 0.5 ? 'open' : 'long' });
        }
      };
      let last = performance.now();
      let raf = 0;

      const scoreText = () => {
        const h = match.isHome ? match.score.my : match.score.opp;
        const a = match.isHome ? match.score.opp : match.score.my;
        return `${h} - ${a}`;
      };
      const pop = () => {
        scoreEl.textContent = scoreText();
        scoreEl.classList.remove('score-pop');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('score-pop');
      };
      const clock = (mm) => {
        const m0 = Math.floor(mm);
        if (m0 >= 90) return `90+${Math.max(1, m0 - 89)}`;
        return `${String(m0).padStart(2, '0')}:${String(Math.floor((mm % 1) * 60)).padStart(2, '0')}`;
      };
      const line = (minuteN, text, kind = '') => {
        const n = el(`<div class="ln ${kind}"><span class="m">${minuteN}'</span><span class="ln-ic">${FEED_SPRITES[kind] ? sprite(FEED_SPRITES[kind], { size: 22 }) : ''}</span><span class="tx"></span></div>`);
        n.querySelector('.tx').textContent = (kind === 'goal-me' ? '⭐ ' : '') + text;
        feed.prepend(n);
        if (feed.children.length > 40) feed.lastElementChild.remove();
      };
      const push = (ln) => {
        line(ln.minute, ln.text, ln.kind);
        if (ln.kind?.startsWith('goal')) renderGoals();
        if (ln.kind === 'goal-my' || ln.kind === 'goal-me') {
          momentum = Math.min(85, momentum + 18);
          pop();
          sfx('goal');
          // Golün mini oyunda 'gol' desenini zaten verdi; burada tribün kutlaması. Asist: pas+gol. Takım golü: kısa.
          buzz(ln.kind === 'goal-me' ? 'celebrate' : ln.assist ? 'assist' : [30, 50, 60]);
        } else if (ln.kind === 'goal-opp') { momentum = Math.max(15, momentum - 18); pop(); sfx('miss'); buzz('heartBreak'); }
        else if (ln.kind === 'save' || ln.kind === 'chance' || ln.kind === 'post') sfx('swish');
      };
      const setMom = () => {
        momentum += (Math.random() - 0.5) * 6;
        momentum = Math.max(10, Math.min(90, momentum + (50 - momentum) * 0.02));
        mom.style.left = `${momentum - 15}%`;
      };

      line(0, `Hakemin düdüğüyle maç başladı! ${home.name} - ${away.name}.`, 'whistle');
      if (match.big) line(0, `${match.big.title}! Tribünler ayakta, atmosfer elektrik yüklü.`, 'big');
      else if (match.cup) line(0, `${match.cup.name}: tek maç, kaybeden veda ediyor!`, 'big');
      if (w && w.id !== 'clear' && w.id !== 'cloudy') line(0, WX_KICKOFF[w.id]?.(w) || `Hava: ${w.name.toLowerCase()}, ${w.temp}°C.`, '');
      sfx('whistle');
      if (match.role !== 'starter') {
        line(0, match.role === 'out' ? (match.reason === 'suspended' ? `${shortName} PFDK cezası nedeniyle bu maçta yok.` : `${shortName} sakatlığı nedeniyle bu maçta yok.`) : `${shortName} maça yedek kulübesinde başlıyor.`, '');
      }

      async function playMoment(m) {
        busy = true;
        bc.pause();
        const type = m.type;
        const weights = GAME_WEIGHTS[type];
        // Büyük maç heyecanı etkin yeteneği düşürür (Soğukkanlı mentor %20 azaltır)
        // Maç içi yorgunluk: dakika ilerledikçe etkin yetenek düşer
        const fatigue = momentFatigue(s, match, m.minute);
        const skill = effectiveSkill(s.player, weights) * (match.big?.skillMult ?? 1) * (1 - fatigue * 0.3);
        await sleep(350);
        const result = await runMiniGame({
          type,
          skill,
          context: m.context,
          title: momentTitle(m),
          text: MOMENT_INTRO[type][m.context],
          minute: m.minute,
          myKit: my,
          me: playerLook(s, { club: my }),
          oppKit: opp,
          keeper: match.oppKeeper ?? Math.min(0.95, clubRating(s.world, match.oppId) / 90),
          number: s.player.number,
          name: shortName.toUpperCase(),
          auto: app.autoplay,
          big: match.big,
          weather: match.weather,
          fatigue,
        });
        bc.resume();
        const g0 = (match.goals || []).length;
        const lines = resolveMoment(match, m, result, shortName);
        const newGoals = (match.goals || []).slice(g0);
        if (lines.some((l) => l.kind === 'goal-me')) confetti();
        for (const ln of lines) {
          push(ln);
          if (ln.kind?.startsWith('goal')) await animate(ln, newGoals.shift());
        }
        busy = false;
        last = performance.now();
      }

      async function process(item) {
        if (item.kind === 'kickoff') return;
        if (item.kind === 'ht') { line(45, `İlk yarı sona erdi. ${scoreText()}`, 'whistle'); sfx('shortWhistle'); if (skipTo === null) await bc.halfTime(); return; }
        if (item.kind === 'chant') {
          const awayEnd = Math.random() < 0.3;
          line(item.minute, `📣 ${awayEnd ? 'Deplasman tribünü' : 'Tribünler'}: "${pickLine(CHANTS)(awayEnd ? as : hs)}"`, 'chant');
          sfx('chant');
          return;
        }
        if (item.kind === 'wx') { line(item.minute, pickLine(WX_MID[w.id] || ['Hava şartları oyunu zorluyor.']), ''); return; }
        if (item.kind === 'subOff') {
          offPitch = true;
          line(item.minute, `${shortName} kramp girdi, bacakları ağırlaştı. Hoca onu oyundan aldı; tribünler ayakta alkışlıyor.`, 'sub');
          roleEl.innerHTML = `${icon('user')} Oyundan çıktın (${item.minute}')`;
          bc.setOnPitch(false);
          el0.querySelector('[data-card]')?.classList.add('off');
          roleEl.className = 'chip warn';
          sfx('shortWhistle');
          return;
        }
        if (item.kind === 'sub') {
          line(item.minute, `Oyuncu değişikliği: ${shortName} oyuna giriyor!`, 'sub');
          roleEl.innerHTML = `${icon('user')} Oyundasın (${item.minute}')`;
          bc.setOnPitch(true);
          el0.querySelector('[data-card]')?.classList.remove('off');
          roleEl.className = 'chip accent';
          sfx('shortWhistle');
          return;
        }
        if (item.kind === 'ft') {
          finished = true;
          line(item.minute, `Maç sona erdi! ${scoreText()}`, 'whistle');
          const hg = match.isHome ? match.score.my : match.score.opp;
          const ag = match.isHome ? match.score.opp : match.score.my;
          bc.fullTime(hg > ag ? 'home' : ag > hg ? 'away' : null);
          sfx('whistle');
          buzz('whistle');
          cancelAnimationFrame(raf);
          await sleep(900);
          if (match.national) app.finishCampMatch(match);
          else if (match.cup) app.finishCupMatch(match);
          else app.finishMatch(match);
          return;
        }
        if (item.ev) {
          const g0 = (match.goals || []).length;
          const ln = applyAiEvent(match, item.ev);
          push(ln);
          await animate({ ...ln, ai: true, side: item.ev.side }, (match.goals || [])[g0]);
          return;
        }
        if (item.m) {
          skipTo = null;
          await playMoment(item.m);
        }
      }

      const tick = async (now) => {
        if (!screenEl.isConnected) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (!busy && !finished) {
          const speed = app.settings.speed || 1;
          minute += dt * 4.2 * speed;
          if (skipTo !== null) minute = Math.max(minute, skipTo);
          minEl.textContent = clock(Math.min(90 + match.stoppage, minute));
          updateCond();
          if (Math.random() < 0.1) setMom();
          while (idx < timeline.length && timeline[idx].minute <= minute && !busy && !finished) {
            const item = timeline[idx++];
            if (item.m) minEl.textContent = clock(item.minute);
            await process(item);
          }
        }
        if (!finished) raf = requestAnimationFrame(tick);
      };
      bc.start();
      // Tünel çıkışı → başlama vuruşu
      busy = true;
      bc.intro().catch(() => {}).finally(() => { busy = false; last = performance.now(); raf = requestAnimationFrame(tick); });

      // Tam ekran yatay yayın (dikey telefonda 90° döner)
      const fsBtn = el0.querySelector('[data-fs]');
      const setFull = (on) => {
        bcEl.classList.toggle('bc-full', on);
        fsBtn.textContent = on ? '✕' : '⛶';
      };
      fsBtn.addEventListener('click', (e) => { e.stopPropagation(); app.click(); setFull(!bcEl.classList.contains('bc-full')); });
      el0.querySelector('[data-fs-skip]').addEventListener('click', (e) => { e.stopPropagation(); skipBtn.click(); });

      speedBtn.addEventListener('click', () => {
        app.click();
        const sp = { 1: 2, 2: 4, 4: 1 }[app.settings.speed || 1];
        app.settings.speed = sp;
        app.saveSettings();
        speedBtn.innerHTML = `${icon('play')} ${sp}x`;
      });
      skipBtn.addEventListener('click', () => {
        app.click();
        const rest = timeline.slice(idx).filter((t) => t.m);
        skipTo = rest.length ? rest[0].minute : 90 + match.stoppage;
        if (rest.length <= 1) skipBtn.innerHTML = `${icon('chev')} Sona atla`;
      });
    },
  };
}
