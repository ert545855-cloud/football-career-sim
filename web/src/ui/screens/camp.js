// MİLLİ KAMP EKRANI — milli takımın kendi ana ekranı: Türkiye U-19 vs rakip kartı, kamp hakları,
// hoca güveni / uyum / enerji, kadro, grup tablosu (turnuva) ve "Maça çık".
import { NATIONAL_TEAMS, HOME_NATION, nationByShort } from '../../core/national.js';
import { condOf } from '../../core/gym.js';
import {
  CAMP_ACTIONS, activeCamp, campRole, campTrainingSetup, doCampAction, fixtureCard, planCampMatch, simulateCampMatch, sortedGroup, squadFor, teamLabel,
} from '../../core/nationalCamp.js';
import { effectiveSkill, ovr } from '../../core/player.js';
import { playerLook } from '../../core/cosmetics.js';
import { runMiniGame } from '../../games/index.js';
import { icon } from '../art.js';
import { animateBars, esc, sheet, toast } from '../dom.js';
import { changeChips, energyColor, meter } from '../components.js';
import { nationBadge, nationalCrest } from '../nationalView.js';
import { windArrow } from '../../core/weather.js';
import { sfx } from '../../audio.js';

const RES = { G: 'good', B: 'warn', M: 'bad' };

export function campScreen(app) {
  const s = app.state;
  const camp = activeCamp(s);
  if (!camp) {
    setTimeout(() => app.runPending(), 0);
    return { tabs: false, html: '<p class="muted center" style="margin-top:40vh">Kamp bitti…</p>' };
  }
  const team = NATIONAL_TEAMS[camp.level];
  const card = fixtureCard(s, camp);
  const role = campRole(s, camp);
  const T = camp.tournament;
  const squad = squadFor(s, camp.level);
  const total = T ? '' : `${Math.min(camp.idx + 1, camp.fixtures.length)}/${camp.fixtures.length}`;
  const w = card.weather;

  const actions = CAMP_ACTIONS.map((a) => {
    const off = camp.slots <= 0 || (a.energy < 0 && s.player.energy + a.energy < 5);
    return `<button class="action ${off ? 'off' : ''}" data-camp="${a.id}" title="${esc(a.desc)}">
      <span class="ic">${icon(a.icon)}</span><b>${a.name}</b><span>${a.energy > 0 ? `+${a.energy}` : a.energy} enerji</span></button>`;
  }).join('');

  const results = camp.played.map((m) => `<div class="li"><span class="nat-res ${m.res === 'W' ? 'good' : m.res === 'D' ? 'warn' : 'bad'}"></span>${nationBadge(m.opp, 28)}<div class="grow small"><b>${esc(nationByShort(m.opp)?.name || m.opp)}</b><div class="muted small">${esc(m.comp)}${m.rating ? ` · notun ${m.rating.toFixed(1)}` : ' · forma giymedin'}${m.goals ? ` · ${m.goals} gol` : ''}${m.assists ? ` · ${m.assists} asist` : ''}</div></div><b class="tnum">${m.my}-${m.opp_goals}${m.pens ? ` <small>(P ${m.pens[0]}-${m.pens[1]})</small>` : ''}</b></div>`).join('');

  const group = T ? sortedGroup(T).map((r, i) => `<div class="li gt ${r.id === HOME_NATION.short ? 'me' : ''}"><b class="tnum" style="width:16px">${i + 1}</b>${r.id === HOME_NATION.short ? nationalCrest('crest xs', camp.level) : nationBadge(r.id, 22)}<span class="grow small"><b>${esc(r.id === HOME_NATION.short ? HOME_NATION.name : nationByShort(r.id)?.name || r.id)}</b></span><span class="tnum small muted">${r.p}</span><span class="tnum small muted" style="width:34px;text-align:right">${r.gf - r.ga >= 0 ? '+' : ''}${r.gf - r.ga}</span><b class="tnum" style="width:26px;text-align:right">${r.pts}</b></div>`).join('') : '';
  const path = T ? ['group', 'qf', 'sf', 'final'].map((st) => `<span class="tp ${T.stage === st ? 'on' : ['group', 'qf', 'sf', 'final'].indexOf(st) < ['group', 'qf', 'sf', 'final'].indexOf(T.stage) ? 'done' : ''}">${{ group: 'Grup', qf: 'Çeyrek', sf: 'Yarı', final: 'Final' }[st]}</span>`).join('<i></i>') : '';

  const squadList = squad.map((p) => `<div class="li sq"><b class="tnum">${p.num}</b><span class="pos">${p.pos}</span><span class="grow small">${esc(p.name)}${p.captain ? ' <span class="chip xs gold">K</span>' : ''}</span><span class="tnum small muted">${p.ovr}</span></div>`).join('');

  return {
    tabs: false,
    html: `
      <div class="camp-top">
        ${nationalCrest('crest lg', camp.level)}
        <div class="grow" style="min-width:0">
          <div class="muted small">${T ? esc(T.name) : 'Milli ara · Kamp'}</div>
          <h1 class="h-title" style="font-size:22px">${esc(teamLabel(camp.level))}</h1>
          <div class="chips" style="margin-top:4px"><span class="chip ${role === 'starter' ? 'good' : 'warn'}">${role === 'starter' ? 'İlk 11 adayı' : 'Yedek kulübesi'}</span>${total ? `<span class="chip">Maç ${total}</span>` : ''}</div>
        </div>
      </div>
      ${T ? `<div class="t-path">${path}</div>` : ''}

      <div class="card glow camp-fix">
        <div class="center"><span class="chip accent">${esc(card.fx.comp)}</span></div>
        <div class="fixture" style="margin-top:10px">
          <div class="team">${card.fx.home ? nationalCrest('crest', camp.level) : nationBadge(card.fx.opp, 56)}<span>${esc(card.fx.home ? card.my : card.opp)}</span></div>
          <div class="col" style="align-items:center;gap:6px"><span class="vs">VS</span><span class="chip">${card.fx.home ? 'İç saha' : 'Deplasman'}</span></div>
          <div class="team">${card.fx.home ? nationBadge(card.fx.opp, 56) : nationalCrest('crest', camp.level)}<span>${esc(card.fx.home ? card.opp : card.my)}</span></div>
        </div>
        <div class="opp-info">
          <div class="row between small"><span class="muted">Güç</span><span><b>${card.fx.home ? card.myR : Math.round(card.prof.r)}</b> <span class="muted">vs</span> <b>${card.fx.home ? Math.round(card.prof.r) : card.myR}</b></span></div>
          <div class="row between small"><span class="muted">Rakibin son 5 maçı</span><span class="form5">${card.prof.last5.map((x) => `<i class="${RES[x]}">${x}</i>`).join('')}</span></div>
          <div class="row between small"><span class="muted">Dikkat</span><span><b>${card.prof.star.num} · ${esc(card.prof.star.name)}</b> <span class="muted">(yıldız oyuncu)</span></span></div>
          <div class="row between small"><span class="muted">Hava</span><span>${w.emoji} ${esc(w.name)} · ${w.temp}°C${w.windKmh >= 12 ? ` · ${windArrow(w.wind)} ${w.windKmh} km/sa` : ''}</span></div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;display:grid;gap:12px">
        ${meter('Hoca güveni', 'clipboard', camp.trust, 100, camp.trust >= 60 ? 'var(--good)' : camp.trust >= 45 ? '#f59e0b' : 'var(--bad)')}
        ${meter('Takım uyumu', 'users', camp.chem, 100, '#38bdf8')}
        ${meter('Enerji', 'bolt', s.player.energy, 100, energyColor(s.player.energy))}
        <p class="muted small" style="margin:0">${role === 'starter' ? 'Hoca seni ilk 11\'de düşünüyor. Güveni koru!' : 'İlk 11 için hoca güvenini artır: antrenmanda parla, taktik toplantısına katıl.'}${camp.prep ? ' · <b style="color:var(--accent)">Rakip analizi hazır (+%5)</b>' : ''}</p>
      </div>

      <div class="h-sec">Kamp <span class="slots">${Array.from({ length: T ? 1 : 2 }, (_, i) => `<i class="${i < camp.slots ? 'on' : ''}"></i>`).join('')}</span></div>
      <div class="actions">${actions}</div>
      ${camp.log[0] ? `<p class="muted small" style="margin:8px 2px 0">${esc(camp.log[0])}</p>` : ''}

      <button class="btn primary lg block ${camp.slots === 0 ? 'pulse' : ''}" style="margin-top:14px" data-act="play">${icon('whistle')} Maça Çık</button>
      <button class="btn ghost block" style="margin-top:8px" data-act="sim">${icon('chev')} Hızlı simüle et</button>

      ${T ? `<div class="h-sec">Grup tablosu <span>O · Av · P</span></div><div class="card list group-table">${group}</div>` : ''}
      ${results ? `<div class="h-sec">Bu kamp</div><div class="card list">${results}</div>` : ''}

      <details class="card squad" style="margin-top:14px">
        <summary><b>Kadro</b> <span class="muted small">${squad.length + 1} oyuncu · sen #${s.player.number}</span></summary>
        <div class="list" style="margin-top:8px"><div class="li sq me"><b class="tnum">${s.player.number}</b><span class="pos">${s.player.position}</span><span class="grow small"><b>${esc(s.player.name)}</b> <span class="chip xs accent">SEN</span></span><span class="tnum small">${ovr(s.player)}</span></div>${squadList}</div>
      </details>
      <div style="height:20px"></div>`,
    mount(node) {
      animateBars(node);
      node.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-camp],[data-act]');
        if (!b) return;
        app.click();
        if (b.dataset.camp) {
          if (b.classList.contains('off')) {
            toast(camp.slots <= 0 ? 'Bu maç öncesi kamp hakkın bitti. Maça çık!' : 'Çok yorgunsun. Önce dinlen.', 'bad');
            return;
          }
          let result = null;
          if (b.dataset.camp === 'train') {
            const st = campTrainingSetup(s);
            result = await runMiniGame({
              cond: condOf(s),
              type: st.type,
              skill: effectiveSkill(s.player, st.weights),
              context: st.context,
              title: `${team.short} Kampı · Antrenman`,
              text: 'Teknik direktör kenarda kollarını kavuşturmuş izliyor. Göster kendini!',
              myKit: { colors: ['#f4f4f0', '#e30a17'], pattern: 'solid' },
              me: playerLook(s, { training: true }),
              oppKit: { colors: ['#e30a17', '#ffffff'] },
              keeper: 0.5,
              number: s.player.number,
              auto: app.autoplay,
              weather: card.weather,
            });
          }
          const r = doCampAction(s, b.dataset.camp, result);
          app.save();
          if (!r.ok) { toast(r.text, 'bad'); return; }
          sfx(b.dataset.camp === 'rest' ? 'coin' : 'levelup');
          await sheet({ center: true, html: `<h3 class="center">${esc(CAMP_ACTIONS.find((a) => a.id === b.dataset.camp).name)}</h3><p class="lead center">${esc(r.text)}</p>${changeChips(r.changes)}<button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>` });
          app.go('camp');
        } else if (b.dataset.act === 'play') {
          const match = planCampMatch(s);
          app.go('match', { match });
        } else if (b.dataset.act === 'sim') {
          const ok = await app.confirm('Hızlı simülasyon', 'Maçı oynamadan sonucu görmek istiyor musun? Notun genel gücüne ve formuna göre belirlenir.', 'Simüle et');
          if (!ok) return;
          await app.finishCampMatch(simulateCampMatch(s));
        }
      });
    },
  };
}
