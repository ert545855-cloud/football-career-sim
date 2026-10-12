// MAÇ EKRANI — canlı anlatım, skor tabelası, oyuncunun anlarında mini oyun.
import { CLUB_BY_ID, GAME_WEIGHTS } from '../../core/data.js';
import { applyAiEvent, MOMENT_INTRO, MOMENT_TITLE, resolveMoment } from '../../core/match.js';
import { effectiveSkill } from '../../core/player.js';
import { clubRating } from '../../core/league.js';
import { runMiniGame } from '../../games/index.js';
import { buzz, sfx } from '../../audio.js';
import { crestSVG, icon } from '../art.js';
import { confetti, el, esc, sleep } from '../dom.js';

export function matchScreen(app, { match }) {
  const s = app.state;
  const home = CLUB_BY_ID[match.homeId];
  const away = CLUB_BY_ID[match.awayId];
  const my = CLUB_BY_ID[match.myId];
  const opp = CLUB_BY_ID[match.oppId];
  const name = s.player.name;
  const shortName = name.split(' ')[0];

  const timeline = [{ minute: 0, order: 0, kind: 'kickoff' }];
  match.events.forEach((ev) => timeline.push({ minute: ev.minute, order: 2, ev }));
  match.moments.forEach((m) => timeline.push({ minute: m.minute, order: 3, m }));
  if (match.subMinute) timeline.push({ minute: match.subMinute, order: 1, kind: 'sub' });
  timeline.push({ minute: 45, order: 4, kind: 'ht' });
  timeline.push({ minute: 90 + match.stoppage, order: 9, kind: 'ft' });
  timeline.sort((a, b) => a.minute - b.minute || a.order - b.order);

  const roleText = match.role === 'starter' ? 'İlk 11\'desin' : match.role === 'out' ? (match.reason === 'suspended' ? 'Cezalısın, tribündesin' : 'Sakatsın, tribündesin') : 'Yedek kulübesindesin';

  return {
    tabs: false,
    html: `
      <div class="scoreboard">
        <div class="t">${crestSVG(home)}<span class="ellipsis" style="max-width:110px">${esc(home.name)}</span></div>
        <div class="center"><div class="sc" data-score>0 - 0</div><span class="min" data-min>0'</span></div>
        <div class="t">${crestSVG(away)}<span class="ellipsis" style="max-width:110px">${esc(away.name)}</span></div>
      </div>
      <div class="row between" style="margin-top:10px">
        <span class="chip ${match.role === 'starter' ? 'accent' : 'warn'}" data-role>${icon('user')} ${roleText}</span>
        <span class="chip">${match.moments.length ? `${match.moments.length} kritik an` : 'Kritik an yok'}</span>
      </div>
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
      const line = (minuteN, text, kind = '') => {
        const n = el(`<div class="ln ${kind}"><span class="m">${minuteN}'</span><span class="tx"></span></div>`);
        n.querySelector('.tx').textContent = (kind === 'goal-me' ? '⭐ ' : '') + text;
        feed.prepend(n);
        if (feed.children.length > 40) feed.lastElementChild.remove();
      };
      const push = (ln) => {
        line(ln.minute, ln.text, ln.kind);
        if (ln.kind === 'goal-my' || ln.kind === 'goal-me') { momentum = Math.min(85, momentum + 18); pop(); sfx('goal'); buzz([50, 40, 90]); }
        else if (ln.kind === 'goal-opp') { momentum = Math.max(15, momentum - 18); pop(); sfx('miss'); }
        else if (ln.kind === 'save' || ln.kind === 'chance' || ln.kind === 'post') sfx('swish');
      };
      const setMom = () => {
        momentum += (Math.random() - 0.5) * 6;
        momentum = Math.max(10, Math.min(90, momentum + (50 - momentum) * 0.02));
        mom.style.left = `${momentum - 15}%`;
      };

      line(0, `Hakemin düdüğüyle maç başladı! ${home.name} - ${away.name}.`, 'whistle');
      sfx('whistle');
      if (match.role !== 'starter') {
        line(0, match.role === 'out' ? (match.reason === 'suspended' ? `${shortName} PFDK cezası nedeniyle bu maçta yok.` : `${shortName} sakatlığı nedeniyle bu maçta yok.`) : `${shortName} maça yedek kulübesinde başlıyor.`, '');
      }

      async function playMoment(m) {
        busy = true;
        const type = m.type;
        const weights = GAME_WEIGHTS[type];
        const skill = effectiveSkill(s.player, weights);
        await sleep(350);
        const result = await runMiniGame({
          type,
          skill,
          context: m.context,
          title: MOMENT_TITLE[type],
          text: MOMENT_INTRO[type][m.context],
          minute: m.minute,
          myKit: my,
          oppKit: opp,
          keeper: Math.min(0.95, clubRating(s.world, match.oppId) / 90),
          number: s.player.number,
          name: shortName.toUpperCase(),
          auto: app.autoplay,
        });
        const lines = resolveMoment(match, m, result, shortName);
        lines.forEach((ln) => push({ ...ln, kind: ln.kind === 'goal-me' ? 'goal-me' : ln.kind }));
        if (lines.some((l) => l.kind === 'goal-me')) confetti();
        busy = false;
        last = performance.now();
      }

      async function process(item) {
        if (item.kind === 'kickoff') return;
        if (item.kind === 'ht') { line(45, `İlk yarı sona erdi. ${scoreText()}`, 'whistle'); sfx('shortWhistle'); return; }
        if (item.kind === 'sub') {
          line(item.minute, `Oyuncu değişikliği: ${shortName} oyuna giriyor!`, 'tackle');
          roleEl.innerHTML = `${icon('user')} Oyundasın (${item.minute}')`;
          roleEl.className = 'chip accent';
          sfx('shortWhistle');
          return;
        }
        if (item.kind === 'ft') {
          finished = true;
          line(item.minute, `Maç sona erdi! ${scoreText()}`, 'whistle');
          sfx('whistle');
          cancelAnimationFrame(raf);
          await sleep(900);
          app.finishMatch(match);
          return;
        }
        if (item.ev) { push(applyAiEvent(match, item.ev)); return; }
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
          minEl.textContent = `${Math.min(90 + match.stoppage, Math.floor(minute))}'`;
          if (Math.random() < 0.1) setMom();
          while (idx < timeline.length && timeline[idx].minute <= minute && !busy && !finished) {
            const item = timeline[idx++];
            if (item.m) minEl.textContent = `${item.minute}'`;
            await process(item);
          }
        }
        if (!finished) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

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
