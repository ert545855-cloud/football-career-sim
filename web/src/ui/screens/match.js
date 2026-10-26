// MAÇ EKRANI — canlı anlatım, skor tabelası, oyuncunun anlarında mini oyun.
import { CLUB_BY_ID, GAME_WEIGHTS, fanName } from '../../core/data.js';
import { playSiyahShow } from '../siyahShow.js';
import { showAirs } from '../../core/siyahShow.js';
import { applyAiEvent, MOMENT_INTRO, momentFatigue, momentTitle, resolveMoment } from '../../core/match.js';
import { conditionPct, windArrow } from '../../core/weather.js';
import { effectiveSkill } from '../../core/player.js';
import { characterSkillMult } from '../../core/character.js';
import { condOf, gymSkillMult } from '../../core/gym.js';
import { brainSkillMult } from '../../core/brain/index.js';
import { sponsorSkillMult } from '../../core/sponsors.js';
import { foundationHomeMult } from '../../core/foundation.js';
import { clubRating } from '../../core/league.js';
import { runMiniGame } from '../../games/index.js';
import { celebrationOf, playerLook } from '../../core/cosmetics.js';
import { buzz, sfx } from '../../audio.js';
import { crestSVG, icon } from '../art.js';
import { confetti, el, esc, sleep, toast } from '../dom.js';
import { SNAPS_PER_MATCH, addFrame } from '../../core/chirp/index.js';
import { sprite } from '../../assets/sprites.js';
import { FEED_SPRITES } from '../spriteMap.js';
import { nationalCrest } from '../nationalView.js';
import { COUNTRY_OF_NATION } from '../../core/national.js';
import { createBroadcast } from '../broadcast.js';
import { celebrationChoices, pickCelebration } from '../celebPick.js';
import { pickTension } from '../tensionPick.js';
import { TENSION_KINDS, attitudeKind, grudgeChance, resolveTension, tensionOptions, tensionSkillMult } from '../../core/attitude.js';
import { runTutorial } from '../tutorial.js';
import { playerCanvas } from '../../games/pixel/sprites.js';
import { shortName as shortOf } from '../../core/lineups.js';
import { selectMatchBall } from '../../core/matchBall.js';
import { formatMatchClock } from '../../core/matchClock.js';
import { playGoalCinematic } from '../goalCinematic.js';

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
/** 1x hızda maç saati: 90 dakika = 90 saniye. Gol/pozisyon canlandırmaları ve tekrarlar bu süreye dahil değildir. */
const MATCH_SECONDS = 90;
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
  snow: ['Görevliler çizgileri temizlemek için sahaya girdi.', 'Kar kalınlaştı, top zor yuvarlanıyor.', 'Forvetin ayağı kaydı, topa tam vuramadı! Karlı zemin affetmiyor.', 'Stoper buzlu zeminde kayıp topu kaçırdı, tribünlerden uğultu.', 'Kaleci kar yüzünden topu ayağının altından kaçırıyordu, son anda kurtardı.'],
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
  // Maç içi gerginlikler (karakter barı ve rakip husumetine göre planlandı)
  (match.tension || []).forEach((t) => timeline.push({ minute: t.minute, order: 2.5, tension: t }));
  if (match.subMinute) timeline.push({ minute: match.subMinute, order: 1, kind: 'sub' });
  if (match.subOff) timeline.push({ minute: match.subOff, order: 5, kind: 'subOff' });
  const w = match.weather;
  const ballVariant = selectMatchBall({
    weather: w,
    country: home.country || (match.national ? COUNTRY_OF_NATION[match.homeId] : null),
    league: home.league,
    // turnuva topu yalnız milli maçlarda; yerel kupa ve ertelenen lig maçı ülkenin topuyla oynanır
    tournament: match.national ? match.tournament?.name || 'international' : null,
    night: !!(match.night || match.kickoff?.night),
  });
  match.ball = ballVariant; // kupa penaltı atışları da aynı topla
  const night = !!(match.night || match.kickoff?.night);
  if (w && w.id !== 'clear' && w.id !== 'cloudy') timeline.push({ minute: 20 + Math.floor(Math.random() * 45), order: 1, kind: 'wx' });
  if (w && (w.id === 'snow' || w.temp <= 0)) timeline.push({ minute: 50 + Math.floor(Math.random() * 35), order: 1, kind: 'wx' });
  timeline.push({ minute: 45, order: 4, kind: 'ht' });
  // Tribün tezahüratları
  [8 + Math.floor(Math.random() * 12), 30 + Math.floor(Math.random() * 12), 58 + Math.floor(Math.random() * 12), 80 + Math.floor(Math.random() * 6)].forEach((m) => timeline.push({ minute: m, order: 1, kind: 'chant' }));
  timeline.push({ minute: 90, order: 9, kind: 'ft' });
  timeline.sort((a, b) => a.minute - b.minute || a.order - b.order);

  // İlk yarının uzatması (ikinci yarınınki match.stoppage)
  const stop1 = 1 + Math.floor(Math.random() * 3);

  const roleText = match.role === 'starter' ? 'İlk 11\'desin' : match.role === 'out' ? (match.reason === 'suspended' ? 'Cezalısın, tribündesin' : 'Sakatsın, tribündesin') : 'Yedek kulübesindesin';

  return {
    tabs: false,
    html: `
      <div class="bc-wrap">
        <div class="bc" data-bc>
          <canvas class="bc-cv"></canvas>${night ? '<div class="bc-night" aria-hidden="true"></div>' : ''}
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
          ${match.myId || match.national ? '<button class="bc-btn bc-snap" data-snap aria-label="Kare al (Chirp galerisi)" title="Kare al">📸</button>' : ''}
          <div class="bc-flash" data-snapflash></div>
        </div>
        <div class="bc-goals"><div data-gl-h></div><div data-gl-a></div></div>
      </div>
      <div class="row between" style="margin-top:10px">
        <span class="chip ${match.role === 'starter' ? 'accent' : 'warn'}" data-role>${icon('user')} ${roleText}</span>
        <span class="chip">${match.moments.length ? `${match.moments.length} kritik an` : 'Kritik an yok'}</span>
      </div>
      ${w ? `<div class="wx-strip wx-${w.id}"><span class="wx-e">${w.emoji}</span><b>${esc(w.name)}</b><span>${w.temp}°C</span>${match.kickoff ? `<span class="ko">${night ? '🌙' : '🕑'} ${match.kickoff.time}</span>` : ''}${w.windKmh >= 12 ? `<span>${windArrow(w.wind)} ${w.windKmh} km/sa</span>` : ''}<span class="grow"></span><span class="cond-txt" data-condtxt>${match.role !== 'out' ? '%100' : ''}</span></div>` : ''}
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
        me: { look: meLook, num: s.player.number, name: shortName, pos: s.player.position, onPitch: match.role === 'starter', celebration: celebrationOf(s) },
        weather: match.weather,
        ballVariant,
        speed: () => app.settings.speed || 1,
        auto: app.autoplay,
        names: {
          home: home.name, away: away.name, homeShort: hs, awayShort: as, homeFan: fanName(home), awayFan: fanName(away), city: CLUB_BY_ID[match.homeId]?.city || '',
          // stadyum dili: ev sahibi kulübün (milli maçta ev sahibi ülkenin) ülkesi
          homeCountry: CLUB_BY_ID[match.homeId]?.country || COUNTRY_OF_NATION[match.homeId] || 'tr',
          awayCountry: CLUB_BY_ID[match.awayId]?.country || COUNTRY_OF_NATION[match.awayId] || 'tr',
          myCountry: CLUB_BY_ID[match.myId]?.country || s.player.nationality || 'tr',
        },
        coach: { name: match.national ? 'Milli Takım T.D.' : s.coach?.clubId === match.myId && s.coach?.name ? `T.D. ${s.coach.name}` : 'Teknik Direktör' },
        // golden sonra süreli sevinç seçimi (sahip olduğun en fazla 3 sevinç)
        pickCelebration: () => pickCelebration(bcEl, {
          look: meLook,
          choices: celebrationChoices(s),
          onPick: (style, tapped) => { (match.celebs ||= []).push(style); if (tapped) app.click(); },
        }),
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
      // sahada değilsen (yedek/sakat/cezalı) maçı kulübeden ya da tribünden izlersin: daha çok pozisyon canlandırılır
      const watching = () => match.role === 'out' || offPitch || (match.role === 'bench' && !(match.subMinute && minute >= match.subMinute));
      // Canlandırma: gol satırı, skor ve tribün sesi topun ağlara girdiği anda gelir (önceden skor değişmez)
      const animate = async (ln, g) => {
        let pushed = false;
        const doPush = () => { if (!pushed) { pushed = true; push(ln); } };
        if (skipTo !== null || app.autoplay) { doPush(); return; }
        const goal = ln.kind === 'goal-my' || ln.kind === 'goal-me' || ln.kind === 'goal-opp';
        if (goal) {
          const side = ln.kind === 'goal-opp' ? 'opp' : 'my';
          const me = ln.kind === 'goal-me';
          const meAssist = !!g?.meAssist;
          // Chirp galerisi: senin golün/asistin (şut anı + sevinç) ve takımının golleri (sevinç)
          const capture = side === 'my' ? (kind, url) => {
            if (!me && !meAssist && kind === 'shot') return;
            saveFrame(kind === 'shot' ? (me ? 'goal' : 'assist') : me || meAssist ? 'celebration' : 'team', url, ln.minute);
          } : null;
          await bc.play({
            side, outcome: 'goal', kind: g?.kind || (me ? 'solo' : 'open'),
            scorer: me ? shortName : g?.scorer, me,
            assist: meAssist ? shortName : g?.assist ?? undefined, meAssist,
            assistLabel: meAssist ? shortName : g?.assist ? shortOf(g.assist) : '',
            replay: me || meAssist,
            minute: ln.minute,
            scoreText: () => scoreText(),
            onGoal: doPush,
            capture,
          });
          // maçtaki ilk golünden sonra kısa gol sevinci videosu (sessiz; dokununca geçilir)
          if (me && !match.cinemaShown && (app.settings.speed || 1) === 1 && skipTo === null && app.settings.goalCinema !== false) {
            match.cinemaShown = true;
            await playGoalCinematic(bcEl, { look: meLook, name: s.player.name, number: s.player.number, minute: ln.minute, club: CLUB_BY_ID[match.myId]?.short || '', colors: my?.colors });
          }
        } else if (ln.ai && ['save', 'post', 'chance'].includes(ln.kind) && (app.settings.speed || 1) === 1 && chanceAnims < (watching() ? 4 : 2)) {
          chanceAnims++;
          await bc.play({ side: ln.side || 'my', outcome: ln.kind === 'save' ? 'save' : ln.kind === 'post' ? 'post' : 'miss', kind: Math.random() < 0.5 ? 'open' : 'long', onGoal: doPush });
        }
        doPush();
      };
      let last = performance.now();
      let raf = 0;

      const scoreText = () => {
        const h = match.isHome ? match.score.my : match.score.opp;
        const a = match.isHome ? match.score.opp : match.score.my;
        return `${h} - ${a}`;
      };
      // ── Chirp maç kareleri ──
      const oppName = (match.isHome ? away : home)?.name || '';
      let snaps = 0;
      const saveFrame = (kind, url, mm) => {
        if (app.autoplay || !url) return null;
        return addFrame(s, { kind, minute: Math.max(1, Math.round(mm ?? minute)), score: scoreText(), opp: oppName, oppId: match.oppId || null, matchId: match.id || null }, url);
      };
      const snapBtn = el0.querySelector('[data-snap]');
      const snapFlash = el0.querySelector('[data-snapflash]');
      snapBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (snaps >= SNAPS_PER_MATCH) { toast(`Bu maçta en fazla ${SNAPS_PER_MATCH} kare alabilirsin.`, 'bad'); return; }
        const url = bc.snapshot();
        if (!url) return;
        snaps += 1;
        saveFrame('snap', url, minute);
        sfx('camera');
        buzz(20);
        snapFlash?.classList.remove('go');
        void snapFlash?.offsetWidth;
        snapFlash?.classList.add('go');
        toast(`📸 Kare galeriye eklendi (${snaps}/${SNAPS_PER_MATCH})`, 'good');
      });
      const pop = () => {
        scoreEl.textContent = scoreText();
        scoreEl.classList.remove('score-pop');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('score-pop');
      };
      const clock = formatMatchClock;
      // Maç saati evreleri: ilk yarı → ilk yarı uzatması → devre arası → ikinci yarı → uzatma → bitiş
      let phase = 'h1';
      let stopT = 0;
      const board = () => {
        if (phase === 'st1' || phase === 'htReady') return `45+${Math.min(stop1, Math.floor(stopT) + 1)}`;
        if (phase === 'st2' || phase === 'ftReady') return `90+${Math.min(match.stoppage, Math.floor(stopT) + 1)}`;
        return clock(minute);
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
        if (ln.kind === 'goal-me') maybeGrudge(ln.minute);
        if (ln.kind === 'goal-my' || ln.kind === 'goal-me') {
          momentum = Math.min(85, momentum + 18);
          pop();
          sfx('goal');
          // Golün mini oyunda 'gol' desenini zaten verdi; burada tribün kutlaması. Asist: pas+gol. Takım golü: kısa.
          buzz(ln.kind === 'goal-me' ? 'celebrate' : ln.assist ? 'assist' : [30, 50, 60]);
        } else if (ln.kind === 'goal-opp') { momentum = Math.max(15, momentum - 18); pop(); sfx('miss'); buzz('heartBreak'); }
        else if (ln.kind === 'save' || ln.kind === 'chance' || ln.kind === 'post') sfx('swish');
      };
      // Hakem kartı: büyük kart görseli (sözlü uyarı, sarı, kırmızı)
      const showCard = (kind) => {
        const box = el(`<div class="ref-card ${kind}"><span class="rc-card"></span><b>${kind === 'red' ? 'KIRMIZI KART' : kind === 'card' ? 'SARI KART' : 'SÖZLÜ UYARI'}</b><span>${esc(shortName)}</span></div>`);
        bcEl.appendChild(box);
        sfx(kind === 'warn' ? 'shortWhistle' : 'whistle');
        buzz(kind === 'red' ? [80, 60, 80] : [40, 40]);
        setTimeout(() => box.classList.add('out'), kind === 'red' ? 2600 : 1900);
        setTimeout(() => box.remove(), kind === 'red' ? 3000 : 2300);
      };
      const insertInjected = () => {
        for (const ev of match._inject || []) {
          let j = idx;
          while (j < timeline.length && timeline[j].minute <= ev.minute) j++;
          timeline.splice(j, 0, { minute: ev.minute, order: 2, ev });
        }
        match._inject = [];
      };
      const sentOffUI = (mm) => {
        offPitch = true;
        roleEl.innerHTML = `${icon('user')} Kırmızı kart (${mm}')`;
        roleEl.className = 'chip bad';
        bc.setOnPitch(false);
        el0.querySelector('[data-card]')?.classList.add('off');
        skipBtn.innerHTML = `${icon('chev')} Sona atla`;
      };
      // Golünü yediremeyen rakip: birkaç dakika sonra gerginlik
      const oppNames = (match.lineups?.opp || []).filter((x) => x.pos !== 'GK').map((x) => shortOf(x.name));
      const maybeGrudge = (mm) => {
        const at = Math.min(88, Math.round(mm) + 2 + Math.floor(Math.random() * 4));
        if (match.sentOff != null || at >= 89 || Math.random() >= grudgeChance(s, match)) return;
        if ((match.tension || []).some((t) => Math.abs(t.minute - at) < 6)) return;
        const t = { minute: at, kind: 'grudge', opp: oppNames.length ? oppNames[Math.floor(Math.random() * oppNames.length)] : null, done: false };
        (match.tension ||= []).push(t);
        let j = idx;
        while (j < timeline.length && timeline[j].minute <= at) j++;
        timeline.splice(j, 0, { minute: at, order: 2.5, tension: t });
      };
      // Siyah Show: maç önü ve devre arası (kurgusal parodi yorum programı)
      const siyah = async (phase) => {
        if (app.autoplay || !showAirs(match, phase, app.settings.siyahShow || 'auto', { country: CLUB_BY_ID[match.homeId]?.country || 'tr', nationality: s.player.nationality || 'tr' })) return;
        bc.pause();
        try {
          await playSiyahShow({
            phase, match, state: s, score: scoreText().replace(' - ', '-'),
            names: { home: home.name, away: away.name, hs, as, my: my?.name || my?.short || '' },
            colors: { home: home.colors, away: away.colors },
          });
        } finally { bc.resume(); last = performance.now(); }
      };
      const onPitchNow = () => match.sentOff == null && !offPitch && (match.role === 'starter' || (match.subMinute && minute >= match.subMinute));
      async function playTension(t, auto = false) {
        if (t.done || !onPitchNow()) return;
        busy = true;
        const opts = tensionOptions(t.kind, attitudeKind(match.attitude ?? 0));
        const def = TENSION_KINDS[t.kind] || TENSION_KINDS.trash;
        let choice = 'ignore';
        // ileri sarılırken gerginlik soruları sorulmaz: oyuncu tepki vermeden geçer (görmezden gel)
        if (!app.autoplay && !auto) {
          sfx('whistle');
          buzz([30, 40, 30]);
          choice = await pickTension(bcEl, { title: def.title, text: def.text(t.opp || 'Rakip oyuncu'), options: opts, att: match.attitude ?? 0, onPick: (id, tapped) => { if (tapped) app.click(); } });
        }
        const out = resolveTension(s, match, t, choice);
        const mom0 = { provoke: 9, jab: 4, ignore: -2, calm: 1, peace: 2, ref: 0 }[choice] || 0;
        momentum = Math.max(10, Math.min(90, momentum + mom0));
        for (const l of out.lines) {
          line(l.minute, l.text, l.kind);
          if (l.kind === 'card' || l.kind === 'red') { showCard(l.kind); await sleep(l.kind === 'red' ? 1400 : 700); }
        }
        if (choice === 'provoke' || choice === 'jab') sfx('chant');
        if (match.sentOff != null) { sentOffUI(match.sentOff); insertInjected(); }
        busy = false;
        last = performance.now();
      }
      const setMom = () => {
        momentum += (Math.random() - 0.5) * 6;
        momentum = Math.max(10, Math.min(90, momentum + (50 - momentum) * 0.02));
        mom.style.left = `${momentum - 15}%`;
      };

      line(0, `Hakemin düdüğüyle maç başladı! ${home.name} - ${away.name}.`, 'whistle');
      if (match.big) line(0, `${match.big.title}! Tribünler ayakta, atmosfer elektrik yüklü.`, 'big');
      else if (match.cup?.kind === 'makeup') line(0, `${match.cup.name}: hava muhalefeti yüzünden ertelenen maç bu akşam oynanıyor.`, 'big');
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
        // Oyun tarzı, zayıf ayak, beceri ve yeni kulübe uyum
        const skill = effectiveSkill(s.player, weights) * (match.big?.skillMult ?? 1) * (1 - fatigue * 0.3) * characterSkillMult(s, type, m.context) * gymSkillMult(s, type, m.context) * brainSkillMult(s, type, m.context, match) * sponsorSkillMult(s, type) * foundationHomeMult(s, match.isHome) * tensionSkillMult(match);
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
          // gol attıkça rakip seni yakın markaja alır: sonraki fırsatlarda kaleci ve savunma daha hazırlıklı
          keeper: Math.min(0.97, (match.oppKeeper ?? Math.min(0.95, clubRating(s.world, match.oppId) / 90)) + 0.09 * (match.tally?.goals || 0)),
          number: s.player.number,
          name: shortName.toUpperCase(),
          auto: app.autoplay,
          big: match.big,
          weather: match.weather,
          ball: ballVariant,
          fatigue,
          cond: condOf(s),
        });
        bc.resume();
        const g0 = (match.goals || []).length;
        const lines = resolveMoment(match, m, result, shortName);
        const newGoals = (match.goals || []).slice(g0);
        if (lines.some((l) => l.kind === 'goal-me')) confetti();
        for (const ln of lines) {
          if (ln.kind?.startsWith('goal')) await animate(ln, newGoals.shift());
          else push(ln);
          if (ln.kind === 'card' || ln.kind === 'red' || ln.kind === 'warn') { showCard(ln.kind); await sleep(ln.kind === 'red' ? 1400 : 700); }
        }
        if (match.sentOff != null) { sentOffUI(match.sentOff); insertInjected(); }
        busy = false;
        last = performance.now();
      }

      async function process(item) {
        if (item.kind === 'kickoff') return;
        if (item.kind === 'ht') {
          minEl.textContent = 'İY';
          line(45, `İlk yarı sona erdi. ${scoreText()}`, 'whistle');
          sfx('shortWhistle');
          if (skipTo === null) await bc.halfTime();
          if (skipTo === null) await siyah('ht');
          phase = 'h2';
          minute = 45;
          minEl.textContent = '45:00';
          line(45, 'İkinci yarı başladı!', 'whistle');
          return;
        }
        if (item.kind === 'chant') {
          const awayEnd = Math.random() < 0.3;
          line(item.minute, `📣 ${awayEnd ? 'Deplasman tribünü' : 'Tribünler'}: "${pickLine(CHANTS)(fanName(awayEnd ? away : home))}"`, 'chant');
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
          minEl.textContent = 'MS';
          line(`90+${match.stoppage}`, `Maç sona erdi! ${scoreText()}`, 'whistle');
          const hg = match.isHome ? match.score.my : match.score.opp;
          const ag = match.isHome ? match.score.opp : match.score.my;
          bc.fullTime(hg > ag ? 'home' : ag > hg ? 'away' : null);
          sfx('whistle');
          buzz('whistle');
          cancelAnimationFrame(raf);
          await sleep(900);
          // kazanılan maçın son düdüğü: tribün coşkusu
          if (match.score.my > match.score.opp && match.role !== 'out') saveFrame('fulltime', bc.snapshot(), 90);
          if (match.national) app.finishCampMatch(match);
          else if (match.cup) app.finishCupMatch(match);
          else app.finishMatch(match);
          return;
        }
        if (item.ev) {
          const g0 = (match.goals || []).length;
          const ln = applyAiEvent(match, item.ev);
          await animate({ ...ln, ai: true, side: item.ev.side }, (match.goals || [])[g0]);
          return;
        }
        if (item.tension) {
          if (item.tension.done || !onPitchNow()) return;
          await playTension(item.tension, skipTo !== null);
          return;
        }
        if (item.m) {
          if (item.m.skipped || match.sentOff != null) return; // kırmızı kart: kalan anlar yok
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
          // 1x hızda maç saati 90 saniye (1 sn = 1 dk); canlandırmalar sırasında saat durur ve ayrı sürer
          const adv = dt * (90 / MATCH_SECONDS) * speed * (app.autoplay ? 6 : 1); // test modunda hızlı
          if (phase === 'h1') { minute += adv; if (minute >= 45) { minute = 45; phase = 'st1'; stopT = 0; } }
          else if (phase === 'st1') { stopT += adv; if (stopT >= stop1) phase = 'htReady'; }
          else if (phase === 'h2') { minute += adv; if (minute >= 90) { minute = 90; phase = 'st2'; stopT = 0; } }
          else if (phase === 'st2') { stopT += adv; if (stopT >= match.stoppage) phase = 'ftReady'; }
          if (skipTo !== null) {
            if (phase === 'h1' || phase === 'st1') {
              if (skipTo > 45) { minute = 45; phase = 'htReady'; } else minute = Math.max(minute, skipTo);
            } else if (phase === 'h2' || phase === 'st2') {
              if (skipTo >= 90) { minute = 90; phase = 'ftReady'; } else minute = Math.max(minute, skipTo);
            }
          }
          minEl.textContent = board();
          updateCond();
          if (Math.random() < 0.1) setMom();
          while (idx < timeline.length && timeline[idx].minute <= minute && !busy && !finished) {
            const item = timeline[idx];
            // devre arası ve bitiş düdüğü uzatma dakikaları bitince çalar
            if (item.kind === 'ht' && phase !== 'htReady') break;
            if (item.kind === 'ft' && phase !== 'ftReady') break;
            idx++;
            if (item.m) minEl.textContent = clock(item.minute);
            await process(item);
          }
        }
        if (!finished) raf = requestAnimationFrame(tick);
      };
      bc.start();
      // (ilk maçta) eğitici asistan → tünel çıkışı → başlama vuruşu
      busy = true;
      runTutorial(app, 'match').catch(() => {}).then(() => siyah('pre')).catch(() => {}).then(() => bc.intro()).catch(() => {}).finally(() => { busy = false; last = performance.now(); raf = requestAnimationFrame(tick); });

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
        const rest = timeline.slice(idx).filter((t) => t.m && !t.m.skipped && match.sentOff == null);
        skipTo = rest.length ? rest[0].minute : 90;
        if (rest.length <= 1) skipBtn.innerHTML = `${icon('chev')} Sona atla`;
      });
    },
  };
}
