// MİLLİ TAKIM ARAYÜZÜ — arma, çağrı/maç akışı, turnuva akışı.
import { GAME_WEIGHTS } from '../core/data.js';
import { condOf } from '../core/gym.js';
import { effectiveSkill } from '../core/player.js';
import { MOMENT_INTRO, MOMENT_TITLE } from '../core/match.js';
import {
  HOME_NATION, NATIONAL_TEAMS, RESULT_LABEL, declineCallUp, finishTournament, nationByShort, nationalMoment, playNationalMatch, startTournament,
} from '../core/national.js';
import { endCamp, finishCampMatch, startCamp } from '../core/nationalCamp.js';
import { runMiniGame } from '../games/index.js';
import { playerLook } from '../core/cosmetics.js';
import { buzz, sfx } from '../audio.js';
import { icon } from './art.js';
import { changeChips } from './components.js';
import { confetti, esc, sheet, sleep } from './dom.js';
import { ratingColor } from './components.js';
import { spriteOr } from '../assets/sprites.js';

/** Ay-yıldızlı arma (kalkan) */
export function nationalCrest(cls = 'crest', level = 'A') {
  const label = level === 'A' ? 'TÜRKİYE' : NATIONAL_TEAMS[level]?.short || '';
  return `<svg class="${cls}" viewBox="0 0 100 121" aria-label="${HOME_NATION.name} milli takım arması">
    <path d="M50 4 L93 15 V56 C93 86 74 104 50 117 C26 104 7 86 7 56 V15 Z" fill="#e30a17" stroke="#fff" stroke-width="4"/>
    <circle cx="44" cy="54" r="21" fill="#fff"/><circle cx="50" cy="54" r="17" fill="#e30a17"/>
    <path d="M70 54 l-10.3 3.4 0 10.8 -6.4 -8.8 -10.3 3.3 6.4 -8.7 -6.4 -8.8 10.3 3.4 6.4 -8.8 0 10.9z" transform="translate(-4 0) scale(1)" fill="#fff"/>
    <text x="50" y="98" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">${label}</text>
  </svg>`;
}

/** Rakip ülke rozeti (renkli daire + kısaltma) */
export function nationBadge(short, size = 40) {
  const n = nationByShort(short) || { short, colors: ['#334155', '#fff'] };
  return `<span class="nation-badge" style="--a:${n.colors[0]};--b:${n.colors[1]};--sz:${size}px"><b>${esc(n.short)}</b></span>`;
}

const scoreTxt = (m) => `${m.my}-${m.opp}${m.pens ? ` (P ${m.pens[0]}-${m.pens[1]})` : ''}`;
const resTone = (m) => (m.my > m.opp || (m.pens && m.pens[0] > m.pens[1]) ? 'good' : m.my === m.opp && !m.pens ? 'warn' : 'bad');

async function playMoment(app, title, minute, oppShort) {
  const s = app.state;
  const mom = nationalMoment(s);
  const opp = nationByShort(oppShort);
  const skill = effectiveSkill(s.player, GAME_WEIGHTS[mom.type]);
  return runMiniGame({
    type: mom.type,
    skill,
    cond: condOf(s),
    context: mom.context,
    title: `${title} · ${MOMENT_TITLE[mom.type]}`,
    text: MOMENT_INTRO[mom.type][mom.context],
    minute,
    myKit: { colors: HOME_NATION.colors, pattern: 'solid' },
    me: playerLook(s, { club: { colors: HOME_NATION.colors, pattern: 'solid' } }),
    oppKit: { colors: opp?.colors || ['#334155', '#fff'] },
    keeper: Math.min(0.95, (opp?.r || 75) / 95),
    number: s.player.number,
    name: s.player.name.split(' ')[0].toUpperCase(),
    auto: app.autoplay,
  });
}

/** Milli ara: çağrı → (katıl) kritik an → sonuç */
export async function nationalFlow(app) {
  const s = app.state;
  const call = s.pending.national;
  if (!call) return;
  const team = NATIONAL_TEAMS[call.level];
  const opp = nationByShort(call.opp);
  sfx('whistle');
  buzz([20, 50, 20]);
  const tired = s.player.energy < 35;
  const choice = await sheet({
    center: true,
    dismissable: false,
    html: `
      <div class="center" style="margin-bottom:6px">${nationalCrest('crest xl', call.level)}</div>
      <div class="center"><span class="chip accent">MİLLİ TAKIM ÇAĞRISI</span></div>
      <h3 class="center" style="margin-top:8px">${esc(team.name)}</h3>
      <p class="lead center">Teknik direktör seni ${esc(call.comp.toLocaleLowerCase('tr'))} için kadroya çağırdı.</p>
      <div class="fixture" style="margin:12px 0">
        <div class="team">${nationalCrest('crest', call.level)}<span>${esc(HOME_NATION.name)}</span></div>
        <span class="vs">VS</span>
        <div class="team">${nationBadge(call.opp, 56)}<span>${esc(opp.name)}</span></div>
      </div>
      <div class="chips" style="justify-content:center"><span class="chip">${call.home ? 'İç saha' : 'Deplasman'}</span><span class="chip ${call.role === 'starter' ? 'good' : 'warn'}">${call.role === 'starter' ? 'İlk 11' : 'Yedek kulübesi'}</span><span class="chip">${icon('bolt', 'ico xs')} Enerji ${s.player.energy}</span></div>
      ${tired ? '<p class="small center" style="color:var(--warn);margin:10px 0 0">Çok yorgunsun: kampta sakatlanma riskin yüksek.</p>' : ''}
      <div class="stack" style="margin-top:14px">
        <button class="btn primary lg block" data-close="join">${icon('flag')} Kampa katıl</button>
        <button class="btn ghost block" data-close="decline">Sakatlık bahanesiyle reddet (dinlen)</button>
      </div>`,
  });
  if (choice === 'decline') {
    const r = declineCallUp(s);
    app.save();
    await sheet({ center: true, html: `<h3 class="center">Çağrıyı reddettin</h3><p class="lead center">Kulübünde dinlenip bir sonraki maça hazırlandın ama Federasyon bundan hoşlanmadı.</p>${changeChips(r.changes)}<button class="btn primary block" style="margin-top:14px" data-close>Devam</button>` });
    return;
  }
  // Kampa katıl: milli takımın kendi ana ekranı (2 maç, kamp hakları)
  startCamp(s, call);
  app.save();
  app.go('camp');
  return 'camp';
}

/** Kamp maçı bitti: sonuç → kampa dön ya da kamp/turnuva özeti */
export async function campMatchFlow(app, match) {
  const s = app.state;
  const level = match.level;
  const team = NATIONAL_TEAMS[level];
  const r = finishCampMatch(s, match);
  app.save();
  if (!r) return app.runPending();
  if (r.res === 'W') { sfx('levelup'); buzz([60, 40, 60, 40, 120]); } else sfx(r.res === 'D' ? 'whistle' : 'miss');
  const head = { W: ['GALİBİYET', 'var(--good)'], D: ['BERABERLİK', 'var(--warn)'], L: ['MAĞLUBİYET', 'var(--bad)'] }[r.res];
  await sheet({
    center: true,
    dismissable: false,
    html: `
      <div class="center"><span class="chip" style="background:transparent;color:${head[1]};font-size:14px;letter-spacing:.1em">${head[0]}</span></div>
      <div class="center" style="margin-top:4px"><span class="chip">${esc(match.comp || team.short)}</span></div>
      <div class="fixture" style="margin:12px 0">
        <div class="team">${nationalCrest('crest', level)}<span>${esc(HOME_NATION.name)}</span></div>
        <span class="score-big">${r.my}-${r.opp}</span>
        <div class="team">${nationBadge(r.nation.short, 56)}<span>${esc(r.nation.name)}</span></div>
      </div>
      ${r.pens ? `<p class="center small muted" style="margin:-4px 0 8px">Penaltılar: ${r.pens[0]}-${r.pens[1]}</p>` : ''}
      ${r.played ? `<div class="center" style="margin:6px 0"><div class="muted small">Milli maç notun</div><div class="rating-big" style="color:${ratingColor(r.rating)}">${r.rating.toFixed(1)}</div></div>` : '<p class="lead center">Bu maçta forma giymedin.</p>'}
      <div class="chips" style="justify-content:center">${r.goals ? `<span class="chip accent">${r.goals} gol</span>` : ''}${r.assists ? `<span class="chip accent">${r.assists} asist</span>` : ''}${r.played ? `<span class="chip gold">${level === 'A' ? `A milli: ${s.national.caps.A}. maç` : `${team.short}: ${s.national.caps[level]}. maç`}</span>` : ''}${r.injured ? `<span class="chip bad">${icon('bandage', 'ico xs')} Sakatlandın · ${r.injured} hf</span>` : ''}</div>
      <div style="margin-top:10px">${changeChips(r.changes)}</div>
      <button class="btn primary block" style="margin-top:14px" data-close>${r.next === 'over' ? 'Kampı kapat' : 'Kampa dön'}</button>`,
  });
  if (r.next !== 'over') return app.go('camp');
  const sum = endCamp(s);
  app.save();
  const T = sum.tournament;
  const champ = sum.record?.result === 'champion';
  if (champ) { confetti(); sfx('goal'); buzz([80, 50, 80, 50, 200]); }
  const caps = sum.played.filter((m) => m.rating != null).length;
  const goals = sum.played.reduce((a, m) => a + (m.goals || 0), 0);
  await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center">${champ ? spriteOr('cup_gold', icon('trophy'), { size: 84 }) : nationalCrest('crest xl', level)}</div>
      <h3 class="center">${T ? `${esc(T.name)}: ${esc(RESULT_LABEL[sum.record.result])}` : `${esc(team.name)} kampı bitti`}</h3>
      <div class="card list" style="margin-top:10px">${sum.played.map((m) => `<div class="li"><span class="nat-res ${m.res === 'W' ? 'good' : m.res === 'D' ? 'warn' : 'bad'}"></span>${nationBadge(m.opp, 28)}<div class="grow small"><b>${esc(nationByShort(m.opp)?.name || m.opp)}</b>${m.rating ? `<div class="muted small">Notun ${m.rating.toFixed(1)}</div>` : ''}</div><b class="tnum">${scoreTxt({ my: m.my, opp: m.opp_goals, pens: m.pens })}</b></div>`).join('')}</div>
      <p class="lead center">${champ ? 'Ay-yıldızlı formayla tarih yazdın! Adın milli takım efsaneleri arasında.' : T ? (sum.record.result === 'final' ? 'Kupaya çok yaklaştın. Bu acı, bir sonraki turnuvanın yakıtı olacak.' : 'Turnuva bitti. Milli takım deneyimi seni daha da güçlendirdi.') : 'Kulübüne dönüyorsun. Kamptaki performansın bir sonraki çağrıda hatırlanacak.'}</p>
      <div class="chips" style="justify-content:center"><span class="chip gold">${caps} milli maç</span>${goals ? `<span class="chip accent">${goals} gol</span>` : ''}${sum.award ? `<span class="chip accent">${icon('trophy', 'ico xs')} ${esc(sum.award.title)}</span>` : ''}</div>
      <button class="btn primary block" style="margin-top:14px" data-close>${T ? 'Sezon sonuna geç' : 'Kulübüne dön'}</button>`,
  });
  return app.runPending();
}

function stageHTML(st) {
  return st.matches.map((m) => `<div class="li"><span class="nat-res ${resTone(m)}"></span>${nationBadge(m.vs, 30)}<div class="grow"><b class="small">${esc(nationByShort(m.vs)?.name || m.vs)}</b>${m.rating ? `<div class="muted small">Notun ${m.rating.toFixed(1)}${m.goals ? ' · gol' : ''}</div>` : ''}</div><b class="tnum">${scoreTxt(m)}</b></div>`).join('');
}

/** Büyük turnuva: aşama aşama sonuçlar, finalde kritik an */
export async function tournamentFlow(app) {
  const s = app.state;
  const t = s.pending.tournament || startTournament(s);
  app.save();
  sfx('whistle');
  await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center">${nationalCrest('crest xl')}</div><div class="center" style="margin-top:6px"><span class="chip gold">${icon('trophy', 'ico xs')} SEZON SONU TURNUVASI</span></div>
      <h3 class="center" style="margin-top:8px">${esc(t.name)}</h3><p class="lead center">A Milli Takım kadrosundasın. Grup aşamasından finale uzanan yol başlıyor!</p>
      <button class="btn primary lg block" style="margin-top:14px" data-close>${icon('play')} Turnuvaya başla</button>`,
  });
  for (const st of t.stages) {
    await sleep(150);
    if (st.through) sfx('levelup');
    else sfx('miss');
    await sheet({
      center: true,
      dismissable: false,
      html: `<div class="center"><span class="chip ${st.through ? 'good' : 'bad'}">${esc(st.name.toLocaleUpperCase('tr'))}</span></div>
        <div class="card list" style="margin-top:12px">${stageHTML(st)}</div>
        ${st.id === 'group' ? `<p class="muted small center">${st.pts} puan · averaj ${st.gd >= 0 ? '+' : ''}${st.gd}</p>` : ''}
        <h3 class="center" style="margin-top:10px">${st.through ? (st.id === 'sf' ? 'FİNALDEYİZ!' : 'Tur atladık!') : 'Elendik.'}</h3>
        <button class="btn primary block" style="margin-top:12px" data-close>${st.through ? 'Devam' : 'Turnuvayı bitir'}</button>`,
    });
  }
  let momentResult = null;
  if (t.final) {
    const opp = nationByShort(t.final.opp);
    await sheet({
      center: true,
      dismissable: false,
      html: `<div class="center"><span class="chip gold">FİNAL</span></div>
        <div class="fixture" style="margin:12px 0"><div class="team">${nationalCrest('crest')}<span>${esc(HOME_NATION.name)}</span></div><span class="vs">VS</span><div class="team">${nationBadge(t.final.opp, 56)}<span>${esc(opp.name)}</span></div></div>
        <p class="lead center">Stat tıklım tıklım. Kupanın kaderi senin kritik anında!</p>
        <button class="btn primary lg block" style="margin-top:12px" data-close>${icon('whistle')} Finale çık</button>`,
    });
    momentResult = await playMoment(app, 'Final', 70 + Math.floor(Math.random() * 18), t.final.opp);
  }
  const out = finishTournament(s, momentResult);
  app.save();
  const champ = out.t.result === 'champion';
  if (champ) {
    confetti();
    sfx('goal');
    buzz([80, 50, 80, 50, 200]);
  }
  await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center">${champ ? spriteOr('cup_gold', icon('trophy'), { size: 84 }) : nationalCrest('crest xl')}</div>
      <h3 class="center">${esc(out.t.name)}: ${esc(RESULT_LABEL[out.t.result])}</h3>
      ${out.final ? `<div class="card list" style="margin-top:10px">${stageHTML({ matches: [out.final] })}</div>` : ''}
      <p class="lead center">${champ ? 'Ay-yıldızlı formayla tarih yazdın! Adın milli takım efsaneleri arasında.' : out.t.result === 'final' ? 'Kupaya çok yaklaştın. Bu acı, bir sonraki turnuvanın yakıtı olacak.' : 'Turnuva bitti. Milli takım deneyimi seni daha da güçlendirdi.'}</p>
      <div class="chips" style="justify-content:center"><span class="chip gold">${out.apps} milli maç</span>${out.award ? `<span class="chip accent">${icon('trophy', 'ico xs')} ${esc(out.award.title)}</span>` : ''}</div>
      <button class="btn primary block" style="margin-top:14px" data-close>Sezon sonuna geç</button>`,
  });
}
