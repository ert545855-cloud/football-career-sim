// KUPA ARAYÜZÜ — kupa maçı akışı (maç öncesi kart, maç, penaltılar, sonuç), lig ekranındaki kupa ağacı.
import { CLUB_BY_ID } from '../core/data.js';
import { CUP_ROUNDS, CUP_WEEK, ROUND_LABEL, completeCupMatch, ensureCup, myCupStatus, planCupMatch } from '../core/cup.js';
import { clubRating } from '../core/league.js';
import { effectiveSkill } from '../core/player.js';
import { playerLook } from '../core/cosmetics.js';
import { runMiniGame } from '../games/index.js';
import { crestSVG, icon } from './art.js';
import { confetti, esc, sheet } from './dom.js';
import { changeChips, ratingColor } from './components.js';
import { spriteOr } from '../assets/sprites.js';
import { sfx, buzz } from '../audio.js';

/** Bekleyen kupa maçı: tanıtım → maç ekranı */
export async function cupFlow(app) {
  const s = app.state;
  const tie = s.pending.cupTie;
  if (!tie) return false;
  const match = planCupMatch(s);
  const home = CLUB_BY_ID[match.homeId];
  const away = CLUB_BY_ID[match.awayId];
  const sup = tie.kind === 'super';
  sfx('whistle');
  await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center">${spriteOr('cup_gold', icon('trophy'), { size: 64 })}</div>
      <div class="center"><span class="chip gold">${sup ? 'SEZON AÇILIŞI' : 'HAFTA İÇİ KUPA MAÇI'}</span></div>
      <h3 class="center" style="margin-top:8px">${esc(match.cup.name)}</h3>
      <div class="fixture" style="margin:12px 0">
        <div class="team">${crestSVG(home, 'crest lg')}<span>${esc(home.name)}</span></div>
        <span class="vs">VS</span>
        <div class="team">${crestSVG(away, 'crest lg')}<span>${esc(away.name)}</span></div>
      </div>
      <p class="lead center">${sup ? 'Lig şampiyonu ile kupa şampiyonu karşı karşıya. Sezonun ilk kupası seni bekliyor!' : 'Tek maç eleme: berabere biterse penaltılar. Kaybeden kupaya veda eder.'}</p>
      <div class="chips" style="justify-content:center"><span class="chip">${icon('bolt', 'ico xs')} Enerji ${s.player.energy}</span><span class="chip ${match.role === 'starter' ? 'good' : 'warn'}">${match.role === 'starter' ? 'İlk 11' : match.role === 'out' ? 'Kadro dışı' : 'Yedek'}</span></div>
      <button class="btn primary lg block" style="margin-top:14px" data-close>${icon('whistle')} Maça çık</button>`,
  });
  app.go('match', { match });
  return true;
}

/** Kupa maçı bitti: gerekiyorsa penaltı atışı (sen atarsın), sonuç ve ilerleme */
export async function finishCupMatch(app, match) {
  const s = app.state;
  let shootout = null;
  if (match.score.my === match.score.opp && match.role !== 'out' && (match.role === 'starter' || match.subMinute)) {
    await sheet({ center: true, dismissable: false, html: `<h3 class="center">Seri penaltılar!</h3><p class="lead center">Normal süre ${match.score.my}-${match.score.opp} bitti. Teknik direktör beşinci penaltıyı sana verdi. Tüm stat nefesini tuttu…</p><button class="btn primary lg block" style="margin-top:12px" data-close>Topun başına geç</button>` });
    const opp = CLUB_BY_ID[match.oppId];
    shootout = await runMiniGame({
      type: 'shot', context: 'penalty', skill: effectiveSkill(s.player, { shooting: 1 }) * 0.95,
      title: 'Seri Penaltılar', text: 'Kader anı: gol olursa kupada şansımız artar.',
      myKit: CLUB_BY_ID[match.myId], me: playerLook(s, { club: CLUB_BY_ID[match.myId] }), oppKit: opp,
      keeper: Math.min(0.95, clubRating(s.world, match.oppId) / 90), number: s.player.number, auto: app.autoplay,
      big: { title: 'Seri penaltılar', nerves: 0.45, tempo: 1.2, cool: false },
    });
  }
  const r = completeCupMatch(s, match, shootout);
  app.save();
  const sm = r.summary;
  if (r.won) { sfx('levelup'); buzz([60, 40, 60]); } else sfx('miss');
  if (r.award) { confetti(); sfx('goal'); }
  const head = r.won ? ['TUR ATLADIK', 'var(--good)'] : ['KUPAYA VEDA', 'var(--bad)'];
  const sup = r.round === 'super';
  await sheet({
    center: true,
    dismissable: false,
    html: `${r.award ? `<div class="center">${spriteOr('cup_gold', icon('trophy'), { size: 84 })}</div>` : ''}
      <div class="center"><span class="chip" style="background:transparent;color:${head[1]};font-size:14px;letter-spacing:.1em">${r.award ? 'ŞAMPİYON!' : sup ? (r.won ? 'ŞAMPİYON' : 'KAYBETTİK') : r.round === 'f' && !r.won ? 'FİNALİST' : head[0]}</span></div>
      <h3 class="center" style="margin-top:6px">${esc(match.cup.name)}</h3>
      <h3 class="center">${esc(sm.scoreLine)}${r.pens ? ` <small class="muted">(P ${r.pens[0]}-${r.pens[1]})</small>` : ''}</h3>
      ${shootout ? `<p class="center small ${shootout.success ? '' : 'muted'}" style="margin:2px 0 8px">${shootout.success ? 'Penaltını gole çevirdin!' : 'Penaltını kaçırdın…'}</p>` : ''}
      ${sm.played ? `<div class="center" style="margin:8px 0"><div class="muted small">Maç notun</div><div class="rating-big" style="color:${ratingColor(sm.rating)}">${sm.rating.toFixed(1)}</div></div>` : '<p class="lead center">Bu maçta forma giymedin.</p>'}
      <div class="chips" style="justify-content:center">${sm.goals ? `<span class="chip accent">${sm.goals} gol</span>` : ''}${sm.assists ? `<span class="chip accent">${sm.assists} asist</span>` : ''}${r.award ? `<span class="chip gold">${icon('trophy', 'ico xs')} ${esc(r.award.title)}</span>` : ''}</div>
      <div style="margin-top:8px">${changeChips(Object.entries(sm.deltas).filter(([, v]) => v).map(([k, v]) => ({ key: k, label: { morale: 'Moral', energy: 'Enerji', manager: 'Hoca', teammates: 'Takım', fans: 'Taraftar', fame: 'Ün' }[k], delta: v })))}</div>
      <button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
  });
  return app.runPending();
}

/** Lig ekranında kupa ağacı */
export function cupSection(state) {
  const cup = ensureCup(state);
  if (!cup) return '<div class="card muted small">Bu ülkede kupa yok.</div>';
  const me = state.career.clubId;
  const rounds = CUP_ROUNDS.filter((r) => cup.rounds[r]).map((r) => {
    const ties = cup.rounds[r].map((t) => {
      const mine = t.h === me || t.a === me;
      const score = t.w ? `${t.hg}-${t.ag}${t.pens ? ` <small>(P ${t.pens[0]}-${t.pens[1]})</small>` : ''}` : '<span class="muted">–</span>';
      return `<div class="li cup-tie ${mine ? 'me' : ''}">${crestSVG(CLUB_BY_ID[t.h], 'crest sm')}<span class="grow small ellipsis ${t.w === t.h ? 'b' : ''}">${esc(CLUB_BY_ID[t.h].short)}</span><b class="tnum small">${score}</b><span class="grow small ellipsis right ${t.w === t.a ? 'b' : ''}">${esc(CLUB_BY_ID[t.a].short)}</span>${crestSVG(CLUB_BY_ID[t.a], 'crest sm')}</div>`;
    }).join('');
    return `<div class="h-sec">${ROUND_LABEL[r]} <span>Hafta ${CUP_WEEK[r]}</span></div><div class="card list">${ties}</div>`;
  }).reverse().join('');
  const status = myCupStatus(state);
  return `<div class="card cup-head">${spriteOr('cup_gold', icon('trophy'), { size: 40 })}<div class="grow"><b>${esc(cup.name)}</b><div class="muted small">Sezon ${cup.season} · ${esc(status || '')}</div></div>${cup.winner ? `<span class="chip gold">${esc(CLUB_BY_ID[cup.winner].short)}</span>` : ''}</div>
    ${rounds}
    ${state.lastCup && state.lastCup.season !== cup.season ? `<p class="muted small" style="margin-top:10px">Geçen sezon ${esc(state.lastCup.name)}: ${esc(CLUB_BY_ID[state.lastCup.winner]?.name || '–')}</p>` : ''}`;
}
