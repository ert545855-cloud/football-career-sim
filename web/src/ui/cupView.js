// KUPA ARAYÜZÜ — kupa maçı akışı (maç öncesi kart, maç, penaltılar, sonuç), lig ekranındaki kupa ağacı.
import { CLUB_BY_ID, LEAGUES } from '../core/data.js';
import { KO_ROUNDS, ROUND_LABEL, completeCupMatch, cupStages, cupTieCanPostpone, cupWeek, ensureCup, entryStage, groupTable, isGroupStage, isPreStage, myCupStatus, myGroup, nextPath, planCupMatch, postponeCupTie, preRounds, roundLabel } from '../core/cup.js';
import { drawPostponeArt } from './postponeArt.js';
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
  const mk = tie.kind === 'makeup';
  const grp = isGroupStage(tie.round);
  const ctx = cupContext(s, tie.round);
  // Kar / fırtına: hakem sahayı oynanamaz bulursa eşleşme bir hafta ertelenir (bir kez; final ve Süper Kupa hariç)
  if (cupTieCanPostpone(s, match)) {
    const why = postponeCupTie(s, match);
    const w = match.weather;
    const txt = { snow: ['YOĞUN KAR', 'Saha kar altında; hakem ve federasyon temsilcisi maçı oynanamaz buldu.'], frost: ['DONDURUCU SOĞUK', 'Zemin buz tuttu; oyuncuların sağlığı için maç oynatılmayacak.'], storm: ['FIRTINA', 'Şiddetli fırtına ve şimşek nedeniyle güvenlik kararıyla maç ertelendi.'] }[why];
    app.save();
    sfx('whistle');
    await sheet({
      center: true,
      dismissable: false,
      html: `<div class="postpone-art ${why}"><canvas data-pp></canvas></div>
        <div class="center"><span class="chip bad">${icon('shield', 'ico xs')} ${mk ? 'ERTELENEN MAÇ YİNE ERTELENDİ' : 'KUPA MAÇI ERTELENDİ'} · ${txt[0]}</span></div>
        <div class="fixture" style="margin:12px 0">
          <div class="team">${crestSVG(home, 'crest lg')}<span>${esc(home.name)}</span></div>
          <span class="vs">${w ? `${w.emoji} ${w.temp}°` : 'VS'}</span>
          <div class="team">${crestSVG(away, 'crest lg')}<span>${esc(away.name)}</span></div>
        </div>
        <p class="lead center">${esc(txt[1])}</p>
        <p class="muted small center">${esc(match.cup?.name || '')} eşleşmesi gelecek hafta hafta içinde oynanacak. Bu hafta lig maçına odaklan.</p>
        <button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>`,
      onMount: (n) => drawPostponeArt(n.querySelector('[data-pp]'), why),
    });
    app.go('hub');
    return true;
  }
  sfx('whistle');
  await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center">${spriteOr('cup_gold', icon('trophy'), { size: 64 })}</div>
      <div class="center"><span class="chip ${mk ? '' : 'gold'}">${sup ? 'SEZON AÇILIŞI' : mk ? (tie.midweek ? 'HAFTA İÇİ · LİG MAÇI' : 'HAFTA İÇİ · ERTELENEN LİG MAÇI') : grp ? `GRUP ${esc(tie.group || '')} · ${tie.round.slice(1)}. MAÇ` : `HAFTA İÇİ · ${esc(roundLabel(s.cup, tie.round).toLocaleUpperCase('tr'))}`}</span></div>
      <h3 class="center" style="margin-top:8px">${esc(match.cup.name)}</h3>
      <div class="fixture" style="margin:12px 0">
        <div class="team">${crestSVG(home, 'crest lg')}<span>${esc(home.name)}</span></div>
        <span class="vs">VS</span>
        <div class="team">${crestSVG(away, 'crest lg')}<span>${esc(away.name)}</span></div>
      </div>
      <p class="lead center">${sup ? 'Lig şampiyonu ile kupa şampiyonu karşı karşıya. Sezonun ilk kupası seni bekliyor!' : mk ? (tie.midweek ? `Sıkışık fikstür: ${tie.week}. haftanın ikinci lig maçı hafta içinde oynanıyor. Sonuç lig tablosuna işlenecek.` : `${tie.week}. haftada hava muhalefeti yüzünden ertelenen maç. Sonuç lig tablosuna işlenecek.`) : grp ? `Grup maçı: beraberlik de puan. Grubunu ilk 2'de bitiren doğrudan ${ROUND_LABEL[s.cup?.format?.ko] || 'eleme'} turuna çıkar.` : 'Tek maç eleme: berabere biterse penaltılar. Kaybeden kupaya veda eder.'}</p>
      ${ctx ? `<div class="cup-ctx">${ctx}</div>` : ''}
      <div class="chips" style="justify-content:center"><span class="chip">${icon('bolt', 'ico xs')} Enerji ${s.player.energy}</span><span class="chip ${match.role === 'starter' ? 'good' : 'warn'}">${match.role === 'starter' ? 'İlk 11' : match.role === 'out' ? 'Kadro dışı' : 'Yedek'}</span></div>
      <button class="btn primary lg block" style="margin-top:14px" data-close>${icon('whistle')} Maça çık</button>`,
  });
  app.go('match', { match });
  return true;
}

/** Maç sonrası: grupta sıra, turu geçtiysen sıradaki rakip, elendiysen veda */
function afterNote(s, r) {
  const cup = s.cup;
  const me = s.career.clubId;
  if (!cup) return '';
  if (isGroupStage(r.round)) {
    const g = myGroup(cup, me);
    const pos = g ? groupTable(s.world, g).findIndex((x) => x.id === me) + 1 : 0;
    if (r.out) return `<p class="center small" style="color:var(--bad);margin:10px 0 0">Grup ${g?.id || ''} ${pos}.liği: kupaya veda ettik.</p>`;
    if (KO_ROUNDS.includes(cup.stage)) return `<p class="center small" style="color:var(--good);margin:10px 0 0">Gruptan çıktık! ${esc(ROUND_LABEL[cup.stage])} kurası çekildi.</p>`;
    return `<p class="center small muted" style="margin:10px 0 0">Grup ${g?.id || ''}'de ${pos}. sıradasın.</p>`;
  }
  if (r.out) return '';
  const t = cup.stage && (cup.pre?.[cup.stage] || cup.rounds?.[cup.stage] || []).find((x) => x.h === me || x.a === me);
  if (t && t.h && t.a) return `<p class="center small" style="color:var(--good);margin:10px 0 0">${esc(roundLabel(cup, cup.stage))} rakibi: ${esc(CLUB_BY_ID[t.h === me ? t.a : t.h]?.name || '')} (H${cupWeek(cup, cup.stage)})</p>`;
  if (isPreStage(cup.stage) && (cup.preByes?.[cup.stage] || []).includes(me)) return `<p class="center small" style="color:var(--good);margin:10px 0 0">${esc(roundLabel(cup, cup.stage))}: kuraya göre bay geçtik.</p>`;
  if (isGroupStage(cup.stage)) return `<p class="center small" style="color:var(--good);margin:10px 0 0">Gruplara kaldık! Grup ${esc(myGroup(cup, me)?.id || '')}.</p>`;
  return '';
}

/** Kupa maçı bitti: gerekiyorsa penaltı atışı (sen atarsın), sonuç ve ilerleme */
export async function finishCupMatch(app, match) {
  const s = app.state;
  let shootout = null;
  const mk = match.cup?.kind === 'makeup';
  if (!mk && !isGroupStage(match.cup?.round) && match.score.my === match.score.opp && match.role !== 'out' && (match.role === 'starter' || match.subMinute)) {
    await sheet({ center: true, dismissable: false, html: `<h3 class="center">Seri penaltılar!</h3><p class="lead center">Normal süre ${match.score.my}-${match.score.opp} bitti. Teknik direktör beşinci penaltıyı sana verdi. Tüm stat nefesini tuttu…</p><button class="btn primary lg block" style="margin-top:12px" data-close>Topun başına geç</button>` });
    const opp = CLUB_BY_ID[match.oppId];
    shootout = await runMiniGame({
      type: 'shot', context: 'penalty', skill: effectiveSkill(s.player, { shooting: 1 }) * 0.95,
      title: 'Seri Penaltılar', text: 'Kader anı: gol olursa kupada şansımız artar.',
      myKit: CLUB_BY_ID[match.myId], me: playerLook(s, { club: CLUB_BY_ID[match.myId] }), oppKit: opp, ball: match.ball,
      keeper: Math.min(0.95, clubRating(s.world, match.oppId) / 90), number: s.player.number, auto: app.autoplay,
      big: { title: 'Seri penaltılar', nerves: 0.45, tempo: 1.2, cool: false },
    });
  }
  const r = completeCupMatch(s, match, shootout);
  app.save();
  const sm = r.summary;
  if (r.won) { sfx('levelup'); buzz([60, 40, 60]); } else sfx('miss');
  if (r.award) { confetti(); sfx('goal'); }
  const grpR = isGroupStage(r.round);
  const head = grpR ? (r.won ? ['GRUPTA GALİBİYET', 'var(--good)'] : r.draw ? ['GRUPTA BERABERLİK', 'var(--warn)'] : ['GRUPTA MAĞLUBİYET', 'var(--bad)']) : mk ? (r.won ? ['GALİBİYET', 'var(--good)'] : r.draw ? ['BERABERLİK', 'var(--warn)'] : ['MAĞLUBİYET', 'var(--bad)']) : r.won ? ['TUR ATLADIK', 'var(--good)'] : ['KUPAYA VEDA', 'var(--bad)'];
  const sup = r.round === 'super';
  await sheet({
    center: true,
    dismissable: false,
    html: `${r.award ? `<div class="center">${spriteOr('cup_gold', icon('trophy'), { size: 84 })}</div>` : ''}
      <div class="center"><span class="chip" style="background:transparent;color:${head[1]};font-size:14px;letter-spacing:.1em">${mk || grpR ? head[0] : r.award ? 'ŞAMPİYON!' : sup ? (r.won ? 'ŞAMPİYON' : 'KAYBETTİK') : r.round === 'f' && !r.won ? 'FİNALİST' : head[0]}</span></div>
      <h3 class="center" style="margin-top:6px">${esc(match.cup.name)}</h3>
      <h3 class="center">${esc(sm.scoreLine)}${r.pens ? ` <small class="muted">(P ${r.pens[0]}-${r.pens[1]})</small>` : ''}</h3>
      ${shootout ? `<p class="center small ${shootout.success ? '' : 'muted'}" style="margin:2px 0 8px">${shootout.success ? 'Penaltını gole çevirdin!' : 'Penaltını kaçırdın…'}</p>` : ''}
      ${sm.played ? `<div class="center" style="margin:8px 0"><div class="muted small">Maç notun</div><div class="rating-big" style="color:${ratingColor(sm.rating)}">${sm.rating.toFixed(1)}</div></div>` : '<p class="lead center">Bu maçta forma giymedin.</p>'}
      <div class="chips" style="justify-content:center">${sm.goals ? `<span class="chip accent">${sm.goals} gol</span>` : ''}${sm.assists ? `<span class="chip accent">${sm.assists} asist</span>` : ''}${r.award ? `<span class="chip gold">${icon('trophy', 'ico xs')} ${esc(r.award.title)}</span>` : ''}</div>
      <div style="margin-top:8px">${changeChips(Object.entries(sm.deltas).filter(([, v]) => v).map(([k, v]) => ({ key: k, label: { morale: 'Moral', energy: 'Enerji', manager: 'Hoca', teammates: 'Takım', fans: 'Taraftar', fame: 'Ün' }[k], delta: v })))}</div>
      ${!mk && !sup ? afterNote(s, r) : ''}
      ${!mk && !sup ? `<div class="cup-ctx">${cupContext(s, r.round)}</div>` : ''}
      <button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
  });
  return app.runPending();
}

// ─────────────────────────── Kupa şablonu: aşamalar, gruplar, en iyi üçüncüler, eleme ağacı ───────────────────────────
const short = (id) => CLUB_BY_ID[id]?.short || '?';

/** Aşama şeridi: ön eleme → gruplar → eleme turları */
export function cupSteps(cup, me) {
  const stages = cupStages(cup);
  const chips = [];
  const seen = new Set();
  for (const st of stages) {
    const key = isGroupStage(st) ? 'groups' : st;
    if (seen.has(key)) continue;
    seen.add(key);
    const idx = stages.indexOf(st);
    const cur = cup.stage ? stages.indexOf(cup.stage) : stages.length;
    const lastIdx = key === 'groups' ? stages.filter(isGroupStage).map((x) => stages.indexOf(x)).pop() : idx;
    const state = cup.winner || cur > lastIdx ? 'done' : (key === 'groups' ? isGroupStage(cup.stage) : cup.stage === st) ? 'cur' : '';
    const gs = stages.filter(isGroupStage);
    const label = key === 'groups' ? 'Gruplar' : isPreStage(st) ? roundLabel(cup, st).replace(' Ön eleme', ' Ön').replace('Ön eleme', 'Ön') : roundLabel(cup, st).replace(' final', '');
    const wk = key === 'groups' ? `H${cupWeek(cup, gs[0])}–${cupWeek(cup, gs[gs.length - 1])}` : `H${cupWeek(cup, st)}`;
    const out = cup.out && (cup.out === key || (cup.out === 'groups' && key === 'groups'));
    chips.push(`<span class="cs ${state} ${out ? 'out' : ''}"><b>${esc(label)}</b><small>${wk}</small></span>`);
  }
  chips.push(`<span class="cs ${cup.winner ? 'done' : ''}"><b>🏆</b><small>${cup.winner ? esc(short(cup.winner)) : 'Şampiyon'}</small></span>`);
  return `<div class="cup-steps">${chips.join('<i></i>')}</div>`;
}

/** Grup tablosu. o.mini: yalnız puan sütunu */
export function groupCard(state, cup, g, o = {}) {
  const me = state.career.clubId;
  const rows = groupTable(state.world, g);
  const body = rows.map((r, i) => {
    const q = i < 2 ? 'q' : 'x';
    const av = `${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}`;
    if (o.compact) return `<div class="gt-r ${q} ${r.id === me ? 'me' : ''}"><span class="n">${i + 1}</span>${crestSVG(CLUB_BY_ID[r.id], 'crest xs')}<span class="grow ellipsis">${esc(CLUB_BY_ID[r.id]?.name || '')}</span><span class="c">${r.p}</span><span class="c">${av}</span><b class="c">${r.pts}</b></div>`;
    return o.mini
      ? `<div class="gt-r ${q} ${r.id === me ? 'me' : ''}"><span class="n">${i + 1}</span>${crestSVG(CLUB_BY_ID[r.id], 'crest xs')}<span class="grow ellipsis">${esc(short(r.id))}</span><b>${r.pts}</b></div>`
      : `<div class="gt-r ${q} ${r.id === me ? 'me' : ''}"><span class="n">${i + 1}</span>${crestSVG(CLUB_BY_ID[r.id], 'crest xs')}<span class="grow ellipsis">${esc(CLUB_BY_ID[r.id]?.name || '')}</span><span class="c">${r.p}</span><span class="c">${r.w}</span><span class="c">${r.d}</span><span class="c">${r.l}</span><span class="c">${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</span><b class="c">${r.pts}</b></div>`;
  }).join('');
  const fx = o.fixtures ? `<div class="gt-fx">${g.fx.map((f) => `<span class="${f.h === me || f.a === me ? 'me' : ''}"><em>${f.md}.</em> ${esc(short(f.h))} <b>${f.hg == null ? '–' : `${f.hg}-${f.ag}`}</b> ${esc(short(f.a))}</span>`).join('')}</div>` : '';
  return `<div class="gt ${o.mini ? 'mini' : ''}"><div class="gt-h"><b>Grup ${g.id}</b>${o.mini ? '' : o.compact ? '<span class="c">O</span><span class="c">AV</span><span class="c">P</span>' : '<span class="c">O</span><span class="c">G</span><span class="c">B</span><span class="c">M</span><span class="c">AV</span><span class="c">P</span>'}</div>${body}${fx}</div>`;
}


function tieRow(t, side, me) {
  const id = t[side];
  const w = t.w && t.w === id;
  const lose = t.w && t.w !== id;
  const sc = t.hg == null ? '' : side === 'h' ? t.hg : t.ag;
  const pen = t.pens ? `<sup>${side === 'h' ? t.pens[0] : t.pens[1]}</sup>` : '';
  if (!id) return `<div class="bt ph"><span class="crest-ph"></span><span class="grow ellipsis">${esc(t[side === 'h' ? 'hl' : 'al'] || '?')}</span></div>`;
  return `<div class="bt ${w ? 'w' : ''} ${lose ? 'l' : ''} ${id === me ? 'me' : ''}">${crestSVG(CLUB_BY_ID[id], 'crest xs')}<span class="grow ellipsis">${esc(short(id))}</span><b>${sc}${pen}</b></div>`;
}

/** Eleme ağacı: turlar sütun sütun, komşu eşleşmeler çizgilerle birleşir */
export function bracketHTML(state, cup, { from = null } = {}) {
  const me = state.career.clubId;
  const start = from && KO_ROUNDS.includes(from) ? from : cup.format?.ko || 'qf';
  const rounds = KO_ROUNDS.slice(KO_ROUNDS.indexOf(start));
  const n0 = cup.rounds[rounds[0]]?.length || 4;
  const cols = rounds.map((r, ci) => {
    const prevR = ci ? cup.rounds[rounds[ci - 1]] : KO_ROUNDS.indexOf(r) > 0 ? cup.rounds[KO_ROUNDS[KO_ROUNDS.indexOf(r) - 1]] : null;
    // henüz belli olmayan yer: besleyen eşleşmenin takımları ("BOĞ/NEM")
    const ties = (cup.rounds[r] || []).map((t, i) => {
      if (!prevR || (t.h && t.a)) return t;
      const lab = (p) => (p?.w ? null : p?.h && p?.a ? `${short(p.h)}/${short(p.a)}` : null);
      return { ...t, hl: t.h ? t.hl : lab(prevR[i * 2]) || t.hl, al: t.a ? t.al : lab(prevR[i * 2 + 1]) || t.al };
    });
    const pairs = [];
    for (let i = 0; i < ties.length; i += 2) pairs.push(ties.slice(i, i + 2));
    const last = ci === rounds.length - 1;
    const body = pairs.map((pr) => `<div class="brk-pair ${pr.length > 1 && !last ? 'join' : ''}">${pr.map((t) => `<div class="brk-tie ${t.h === me || t.a === me ? 'me' : ''} ${ci ? 'in' : ''}">${tieRow(t, 'h', me)}${tieRow(t, 'a', me)}</div>`).join('')}</div>`).join('');
    return `<div class="brk-col ${cup.stage === r ? 'cur' : ''}" ${cup.stage === r ? 'data-brk-cur' : ''}><div class="brk-h">${esc(ROUND_LABEL[r])}<small>H${cupWeek(cup, r)}</small></div><div class="brk-body">${body}</div></div>`;
  }).join('');
  const champ = `<div class="brk-col champ"><div class="brk-h">Şampiyon</div><div class="brk-body"><div class="brk-pair"><div class="brk-tie in champ-box">${cup.winner ? `${crestSVG(CLUB_BY_ID[cup.winner], 'crest sm')}<b>${esc(CLUB_BY_ID[cup.winner]?.name || '')}</b>` : '<span class="trophy">🏆</span><span class="muted small">?</span>'}</div></div></div></div>`;
  return `<div class="brk" style="--rows:${n0}">${cols}${champ}</div>`;
}

/** Senin yolun: oynadığın kupa maçları ve sıradaki adım */
function pathCard(state, cup) {
  const me = state.career.clubId;
  const res = cup.myResults.map((r) => `<div class="li small"><span class="chip ${r.won ? 'good' : r.draw ? 'warn' : 'bad'}">${r.won ? 'G' : r.draw ? 'B' : 'M'}</span><span class="grow">${esc(roundLabel(cup, r.round))} · ${esc(CLUB_BY_ID[r.opp]?.name || '')}</span><b class="tnum">${r.my}-${r.opp_goals}${r.pens ? ` <small>(P ${r.pens[0]}-${r.pens[1]})</small>` : ''}</b></div>`).join('');
  let next = '';
  const st = cup.stage;
  if (!cup.out && !cup.winner && st) {
    const list = isGroupStage(st) ? (myGroup(cup, me)?.fx || []).filter((f) => f.md >= Number(st.slice(1)) && f.hg == null && (f.h === me || f.a === me)) : [];
    const entry = entryStage(cup, me);
    if (isGroupStage(st) && list.length) next = list.map((f) => `<div class="li small"><span class="chip">${f.md}. maç · H${cupWeek(cup, `g${f.md}`)}</span><span class="grow">${esc(CLUB_BY_ID[f.h === me ? f.a : f.h]?.name || '')} ${f.h === me ? '(İ)' : '(D)'}</span></div>`).join('');
    else if (isPreStage(st) && entry === 'groups') next = `<div class="li small"><span class="chip accent">Gruplar · H${cupWeek(cup, 'g1')}</span><span class="grow">Üst lig kulübü olarak ön elemeye katılmadan gruplardan başlıyorsun</span></div>`;
    else if (isPreStage(st) && entry && cup.stages.indexOf(entry) > cup.stages.indexOf(st)) next = `<div class="li small"><span class="chip">${esc(roundLabel(cup, entry))} · H${cupWeek(cup, entry)}</span><span class="grow">Kademen bu turda kupaya katılıyor</span></div>`;
    else if (isPreStage(st) && (cup.preByes?.[st] || []).includes(me)) next = `<div class="li small"><span class="chip">${esc(roundLabel(cup, st))}</span><span class="grow">Bu turda bay geçiyorsun; sonraki tur H${cupWeek(cup, cup.stages[cup.stages.indexOf(st) + 1])}</span></div>`;
    else {
      const path = nextPath(cup, me);
      const t = (cup.pre?.[st] || cup.rounds[st] || []).find((x) => x.h === me || x.a === me);
      if (t) next = `<div class="li small"><span class="chip accent">${esc(roundLabel(cup, st))} · H${cupWeek(cup, st)}</span><span class="grow">${esc(CLUB_BY_ID[t.h === me ? t.a : t.h]?.name || '')}</span></div>`;
      if (path) next += `<div class="li small muted"><span class="chip">${esc(ROUND_LABEL[path.round])}</span><span class="grow">Kazanırsan: ${path.tie.h ? `${esc(short(path.tie.h))} – ${esc(short(path.tie.a))} galibi` : 'ağaçtaki komşu eşleşmenin galibi'}</span></div>`;
    }
  }
  return `<div class="card list">${res || '<div class="muted small" style="padding:8px 4px">Henüz kupa maçı oynamadın.</div>'}${next ? `<div class="divider" style="margin:6px 0"></div>${next}` : ''}</div>`;
}

/** Lig ekranındaki Kupa sekmesi */
export function cupSection(state, view = {}) {
  const cup = ensureCup(state);
  if (!cup) return '<div class="card muted small">Bu ülkede kupa yok.</div>';
  const me = state.career.clubId;
  const status = myCupStatus(state);
  const hasGroups = cup.groups?.length > 0;
  const grpStarted = hasGroups && cup.groups.some((g) => g.fx.some((f) => f.hg != null));
  const def = cup.stage && KO_ROUNDS.includes(cup.stage) ? 'bracket' : isGroupStage(cup.stage) || (hasGroups && !KO_ROUNDS.includes(cup.stage)) ? 'groups' : isPreStage(cup.stage) ? 'pre' : 'bracket';
  // not: Avrupa sekmesi view.cup'ı kullanır; yerli kupanın alt sekmesi ayrı anahtarda (view.dcup)
  const tab = ['path', 'pre', 'groups', 'bracket'].includes(view.dcup) ? view.dcup : def;
  const tabs = [['path', 'Yolum'], cup.plan?.length ? ['pre', 'Ön eleme'] : null, cup.format.groups ? ['groups', 'Gruplar'] : null, ['bracket', 'Eleme ağacı']].filter(Boolean);
  let body = '';
  if (tab === 'path') body = pathCard(state, cup);
  else if (tab === 'pre') {
    // ön eleme planı: hangi tur, kaç maç, hangi kademe katılıyor
    const lvName = (id) => esc(LEAGUES[CLUB_BY_ID[id]?.league]?.div || (CLUB_BY_ID[id]?.amateur ? 'Amatör' : ''));
    const plan = (cup.plan || []).map((p) => `<div class="li small ${cup.stage === p.id ? 'me' : ''}"><span class="chip ${cup.stage === p.id ? 'accent' : ''}">${esc(roundLabel(cup, p.id))} · H${cupWeek(cup, p.id)}</span><span class="grow">${p.matches} maç${p.enter.length ? ` · katılan: ${[...new Set(p.enter.map(lvName))].filter(Boolean).join(', ')}` : ''}</span></div>`).join('');
    body = `<div class="card list">${plan}<div class="li small muted"><span class="chip">Gruplar · H${cupWeek(cup, 'g1')}</span><span class="grow">${cup.format.qualifiers} ön eleme galibi + ${cup.direct.length} üst lig kulübü</span></div></div>`;
    body += preRounds(cup).reverse().map((r) => `<div class="h-sec">${esc(roundLabel(cup, r))} <span>Hafta ${cupWeek(cup, r)} · ${cup.pre[r].length} eşleşme${cup.preByes?.[r]?.length ? ` · ${cup.preByes[r].length} bay` : ''}</span></div>
      <div class="pre-grid">${cup.pre[r].map((t) => `<div class="brk-tie flat ${t.h === me || t.a === me ? 'me' : ''}">${tieRow(t, 'h', me)}${tieRow(t, 'a', me)}</div>`).join('')}</div>`).join('');
    body += `<div class="h-sec">Gruplardan başlayanlar (üst lig) <span>${cup.direct.length} kulüp</span></div><div class="chips">${cup.direct.map((id) => `<span class="chip ${id === me ? 'accent' : ''}">${crestSVG(CLUB_BY_ID[id], 'crest xs')} ${esc(short(id))}</span>`).join('')}</div>`;
  } else if (tab === 'groups') {
    if (!hasGroups) body = `<div class="card muted small">Grup kurası ön eleme bitince çekilecek (Hafta ${cupWeek(cup, 'g1')} öncesi). ${cup.format.groups} grup × ${cup.format.size} takım: ${cup.direct.length} üst lig kulübü seribaşı, ${cup.format.qualifiers} takım ön elemeden. Grup birincileri ve ikincileri doğrudan ${ROUND_LABEL[cup.format.ko].toLocaleLowerCase('tr')}de.</div>`;
    else {
      const mine = myGroup(cup, me);
      body = `${mine ? groupCard(state, cup, mine, { fixtures: true }) : ''}
        <div class="gt-grid">${cup.groups.filter((g) => g !== mine).map((g) => groupCard(state, cup, g, { mini: true })).join('')}</div>
        <p class="muted small" style="margin-top:8px">Yeşil: ilk 2 (doğrudan ${esc(ROUND_LABEL[cup.format.ko].toLocaleLowerCase('tr'))}) · Kırmızı: elenir.${grpStarted ? '' : ' Tek devre: her takım grubundaki herkesle bir kez oynar.'}</p>`;
    }
  } else body = `${bracketHTML(state, cup)}<p class="muted small" style="margin-top:6px">Kazanan ağaçta sağa ilerler. Grup birincisi, başka gruptan bir ikinciyle iç sahada eşleşir; aynı gruptan iki takım ancak finalde karşılaşabilir.</p>`;
  return `<div class="card cup-head">${spriteOr('cup_gold', icon('trophy'), { size: 40 })}<div class="grow"><b>${esc(cup.name)}</b><div class="muted small">Sezon ${cup.season} · ${esc(status || '')}</div></div>${cup.winner ? `<span class="chip gold">${esc(short(cup.winner))}</span>` : ''}</div>
    ${cupSteps(cup, me)}
    <div class="seg" style="margin:10px 0">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-dcup="${k}">${l}</button>`).join('')}</div>
    ${body}
    ${state.lastCup && state.lastCup.season !== cup.season ? `<p class="muted small" style="margin-top:10px">Geçen sezon ${esc(state.lastCup.name)}: ${esc(CLUB_BY_ID[state.lastCup.winner]?.name || '–')}</p>` : ''}`;
}

/** Maç öncesi / sonrası şablon: grupta tablo + maç günü; elemede ağaçtaki yol */
export function cupContext(state, round) {
  const cup = state.cup;
  if (!cup || !round || round === 'super' || round === 'makeup') return '';
  const me = state.career.clubId;
  if (isGroupStage(round)) {
    const g = myGroup(cup, me);
    return g ? groupCard(state, cup, g, { fixtures: true, compact: true }) : '';
  }
  if (KO_ROUNDS.includes(round) || KO_ROUNDS.includes(cup.stage)) {
    const from = KO_ROUNDS.includes(cup.stage) ? cup.stage : round;
    return `<div class="brk-mini">${bracketHTML(state, cup, { from })}</div>`;
  }
  return '';
}
