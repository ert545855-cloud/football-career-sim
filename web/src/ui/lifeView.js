// KARAKTER + YAŞAYAN DÜNYA arayüzü: özel çalışma, oyun tarzı, kişilik kartı, yaz kampı, ayın oyuncusu,
// başkanlık seçimi, kariyer arşivi, rakip ve başkan kartları, jübile.
import { CLUB_BY_ID, POSITIONS } from '../core/data.js';
import { attitudeCard } from './attitudeView.js';
import { DRILLS, PERKS, PERSONA, PERSONA_KEYS, PLAYSTYLES, drillNeed, ensureCharacter, hasPerk, perkPoints, personaLabel, potentialRange, styleById, unlockPerk } from '../core/character.js';
import { CAMP_FOCUS, runSummerCamp } from '../core/summerCamp.js';
import { resolveElection, presidentLabel, ensurePresident, ensureRival } from '../core/living.js';
import { GOAL_KINDS, archiveSummary } from '../core/archive.js';
import { marketValue, interestLabel, ensureMarket } from '../core/market.js';
import { money } from '../core/economy.js';
import { ovr } from '../core/player.js';
import { crestSVG, icon } from './art.js';
import { confetti, esc, sheet, toast } from './dom.js';
import { meter } from './components.js';
import { sfx } from '../audio.js';

const stars = (n) => `<span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;

// ─────────────────────────── Özel çalışma ───────────────────────────
export async function drillSheet(app) {
  const p = ensureCharacter(app.state);
  const rows = Object.entries(DRILLS).map(([k, d]) => {
    const prog = Math.round((p.drill[k] / drillNeed(p[k])) * 100);
    return `<button class="card drill-opt" data-close="${k}" ${p[k] >= 5 ? 'disabled' : ''}>
      <div class="row between"><b>${icon(d.icon, 'ico sm')} ${d.name}</b>${stars(p[k])}</div>
      <div class="muted small" style="margin:4px 0 8px">${d.desc} · −${d.energy} enerji</div>
      <div class="bar"><i style="width:${p[k] >= 5 ? 100 : prog}%;--c:var(--accent)"></i></div>
      <div class="muted small" style="margin-top:4px">${p[k] >= 5 ? 'Maksimum seviye' : `Sonraki yıldız: %${prog}`}</div>
    </button>`;
  }).join('');
  return sheet({
    html: `<h3>Özel Çalışma</h3>
      <p class="lead" style="margin:4px 0 12px">Zayıf ayak şut ve pas anlarında, beceri hareketleri çalım ve ataklarda etkin yeteneğini artırır.</p>
      <div class="stack">${rows}</div>
      <button class="btn ghost block" style="margin-top:10px" data-close="">Vazgeç</button>`,
  });
}

// ─────────────────────────── Oyun tarzı ───────────────────────────
export async function playstyleSheet(app) {
  const s = app.state;
  const p = ensureCharacter(s);
  const list = PLAYSTYLES[p.position] || [];
  const choice = await sheet({
    html: `<h3>Oyun Tarzı</h3>
      <p class="lead" style="margin:4px 0 12px">${POSITIONS[p.position].name} olarak nasıl bir oyuncu olmak istiyorsun? Sezonda bir kez değiştirebilirsin.</p>
      <div class="stack">${list.map((st) => `<button class="card style-opt ${p.style === st.id ? 'on' : ''}" data-close="${st.id}"><b>${esc(st.name)}</b><div class="muted small">${esc(st.desc)}</div></button>`).join('')}</div>
      <button class="btn ghost block" style="margin-top:10px" data-close="">Kapat</button>`,
  });
  if (!choice || choice === p.style) return false;
  if (p.styleSeason === s.calendar.season && p.style) { toast('Oyun tarzını bu sezon zaten değiştirdin.', 'bad'); return false; }
  p.style = choice;
  p.styleSeason = s.calendar.season;
  app.save();
  sfx('levelup');
  toast(`Yeni oyun tarzın: ${styleById(p.position, choice).name}`, 'good');
  return true;
}

// ─────────────────────────── Uzmanlıklar (gelişim ağacı) ───────────────────────────
export async function perkSheet(app) {
  const s = app.state;
  const p = ensureCharacter(s);
  let changed = false;
  for (;;) {
    const pts = perkPoints(s, ovr(p));
    const list = Object.entries(PERKS).filter(([, pk]) => pk.pos.includes(p.position));
    const choice = await sheet({
      html: `<h3>Uzmanlıklar</h3>
        <p class="lead" style="margin:4px 0 12px">Her 4 OVR gelişimi ve her 2 ödül sana bir uzmanlık puanı kazandırır. <b style="color:var(--accent)">${pts} puanın var.</b></p>
        <div class="perk-grid">${list.map(([id, pk]) => {
          const on = hasPerk(p, id);
          return `<button class="card perk ${on ? 'on' : ''}" data-close="${id}" ${on || !pts ? 'disabled' : ''}><b>${on ? '✓ ' : ''}${esc(pk.name)}</b><span class="muted small">${esc(pk.desc)}</span></button>`;
        }).join('')}</div>
        <button class="btn ghost block" style="margin-top:10px" data-close="">Kapat</button>`,
    });
    if (!choice) break;
    const r = unlockPerk(s, choice, ovr(p));
    toast(r.text, r.ok ? 'good' : 'bad');
    if (r.ok) { changed = true; sfx('levelup'); app.save(); }
  }
  return changed;
}

// ─────────────────────────── Oyuncu ekranı: karakter kartı ───────────────────────────
export function characterCard(state) {
  const p = ensureCharacter(state);
  const st = styleById(p.position, p.style);
  const [lo, hi] = potentialRange(p);
  const ad = state.adapt;
  const m = ensureMarket(state);
  return `
    ${attitudeCard(state)}
    <div class="h-sec">Karakter <span>${esc(personaLabel(p.persona))}</span></div>
    <div class="card" style="display:grid;gap:10px">
      ${PERSONA_KEYS.map((k) => meter(PERSONA[k].name, k === 'professionalism' ? 'dumbbell' : k === 'leadership' ? 'flag' : k === 'ambition' ? 'fire' : 'shield', p.persona[k], 100, PERSONA[k].color)).join('')}
      <p class="muted small" style="margin:0">Profesyonellik antrenman verimini ve sakatlık direncini, liderlik nüfuzu, hırs büyük maç moralini, disiplin kart riskini etkiler. Alışkanlıkların bunları zamanla değiştirir.</p>
    </div>
    <div class="card char-grid" style="margin-top:10px">
      <div><span class="muted small">Zayıf ayak</span>${stars(p.weakFoot)}</div>
      <div><span class="muted small">Beceri</span>${stars(p.skillMoves)}</div>
      <div><span class="muted small">Potansiyel</span><b>${lo}–${hi}</b></div>
      <div><span class="muted small">Piyasa değeri</span><b style="color:var(--gold)">${money(marketValue(state))}</b></div>
      <button class="btn sm block" data-playstyle style="grid-column:1/-1">${icon('star', 'ico sm')} Oyun tarzı: ${st ? esc(st.name) : 'Seç'}</button>
      <button class="btn sm block ${perkPoints(state, ovr(p)) ? 'primary' : ''}" data-perks style="grid-column:1/-1">${icon('medal', 'ico sm')} Uzmanlıklar · ${p.perks.length} açık${perkPoints(state, ovr(p)) ? ` · ${perkPoints(state, ovr(p))} puan!` : ''}</button>
      ${st ? `<p class="muted small" style="grid-column:1/-1;margin:0">${esc(st.desc)}</p>` : ''}
      ${ad && ad.pct < 100 ? `<div style="grid-column:1/-1">${meter(`Uyum · ${esc(CLUB_BY_ID[ad.clubId]?.short || '')}${ad.abroad ? ' (yurt dışı)' : ''}`, 'users', ad.pct, 100, '#22d3ee')}</div>` : ''}
      ${m.interest.length ? `<div style="grid-column:1/-1"><span class="muted small">İlgilenen kulüpler</span><div class="chips" style="margin-top:6px">${m.interest.map((it) => `<span class="chip accent">${crestSVG(CLUB_BY_ID[it.clubId], 'crest xs')} ${esc(CLUB_BY_ID[it.clubId]?.short || '')} · ${interestLabel(it.level)}</span>`).join('')}</div></div>` : ''}
    </div>`;
}

// ─────────────────────────── Yaz kampı ───────────────────────────
export async function summerCampSheet(app) {
  const s = app.state;
  const choice = await sheet({
    dismissable: false,
    html: `<div class="center" style="font-size:44px">🏕️</div><h3 class="center">Yaz Kampı</h3>
      <p class="lead center">Yeni sezon öncesi kulüp kampa giriyor. Hangi alana odaklanmak istersin?</p>
      <div class="stack">${CAMP_FOCUS.map((f, i) => `<button class="card camp-opt" data-close="${f.id}"><b>${icon(f.icon, 'ico sm')} ${f.name}</b><div class="muted small">${f.desc}</div><div class="small" style="color:var(--accent);margin-top:4px">${f.fx}</div></button>`).join('')}</div>`,
  });
  const r = runSummerCamp(s, choice || 'fitness');
  app.save();
  const f = r.friendly;
  await sheet({
    center: true,
    html: `<h3 class="center">${esc(r.focus.name)} · ${esc(r.place)}</h3>
      <p class="lead center">${esc(r.notes.join(' '))}</p>
      <div class="card" style="margin-top:10px"><div class="muted small">Hazırlık maçı</div><b>${esc(CLUB_BY_ID[s.career.clubId].short)} ${f.my}-${f.op} ${esc(f.oppName)}</b>${f.goals ? '<div class="small" style="color:var(--accent)">Hazırlık maçında gol attın! Hoca not aldı.</div>' : ''}</div>
      <button class="btn primary block" style="margin-top:14px" data-close>Sezona hazırım</button>`,
  });
}

// ─────────────────────────── Ayın oyuncusu ───────────────────────────
export async function monthAwardSheet(app) {
  const a = app.state.pending.monthAward;
  app.state.pending.monthAward = null;
  app.save();
  if (!a) return;
  sfx('levelup');
  confetti();
  await sheet({
    center: true,
    html: `<div class="center" style="font-size:52px">🏅</div><h3 class="center">${esc(a.title)}</h3>
      <p class="lead center">Son dört haftada ortalama ${a.avg.toFixed(1).replace('.', ',')} not, ${a.goals} gol ve ${a.assists} asist. Taraftarların oylamasında da açık ara öndeydin.</p>
      <div class="chips" style="justify-content:center"><span class="chip gold">Ün +3</span><span class="chip good">Moral +5</span></div>
      <button class="btn primary block" style="margin-top:14px" data-close>Harika!</button>`,
  });
}

// ─────────────────────────── Başkanlık seçimi ───────────────────────────
export async function electionSheet(app) {
  const s = app.state;
  const e = s.pending.election;
  if (!e) return;
  const b = ensurePresident(s);
  const choice = await sheet({
    dismissable: false,
    html: `<div class="center" style="font-size:44px">🗳️</div><h3 class="center">Başkanlık Seçimi</h3>
      <p class="lead center">${esc(CLUB_BY_ID[s.career.clubId].name)} genel kurula gidiyor. Mevcut başkan <b>${esc(e.incumbent)}</b> (${presidentLabel(b)}) karşısında <b>${esc(e.challenger)}</b> aday. Adayın vaadi: “${esc(e.promise.text)}”.</p>
      <p class="muted small center">Açıkça destek verirsen kazanan tarafla yönetim ilişkin güçlenir, kaybeden tarafı seçersen zarar görür.</p>
      <div class="stack">
        <button class="btn block" data-close="inc">Destekle: ${esc(e.incumbent)} (mevcut başkan)</button>
        <button class="btn block" data-close="chal">Destekle: ${esc(e.challenger)} (aday)</button>
        <button class="btn ghost block" data-close="neutral">Tarafsız kal</button>
      </div>`,
  });
  const r = resolveElection(s, choice || 'neutral');
  app.save();
  await sheet({
    center: true,
    html: `<h3 class="center">Seçim sonucu</h3><p class="lead center"><b>${esc(r.winner)}</b> ${r.incWins ? 'yeniden başkan seçildi.' : 'kulübün yeni başkanı oldu!'}${r.boardD > 0 ? ' Desteklediğin aday kazandı: yönetimle aran çok iyi.' : r.boardD < 0 ? ' Karşı tarafı desteklemiştin; yönetim bunu unutmayacak.' : ''}</p><button class="btn primary block" style="margin-top:12px" data-close>Tamam</button>`,
  });
}

// ─────────────────────────── Kariyer ekranı: arşiv + yaşayan dünya ───────────────────────────
export function archiveHTML(state) {
  const a = archiveSummary(state);
  const r = a.records;
  const clubs = a.clubs.map((c) => `<tr><td><div class="team-cell">${crestSVG(CLUB_BY_ID[c.id], 'crest sm')}<span>${esc(CLUB_BY_ID[c.id]?.short || c.id)}</span></div></td><td>S${c.from}${c.to && c.to !== c.from ? `–${c.to}` : ''}</td><td>${c.apps}</td><td>${c.goals}</td><td>${c.assists}</td></tr>`).join('');
  const kinds = a.kinds.map(([k, n]) => `<div class="gk-row"><span>${esc(GOAL_KINDS[k] || k)}</span><i style="--w:${Math.round((n / Math.max(1, a.totalKinds)) * 100)}%"></i><b>${n}</b></div>`).join('');
  const tr = a.transfers.slice().reverse().map((t) => `<div class="li"><span class="chip ${t.kind === 'loan' ? 'warn' : t.kind === 'free' ? 'good' : ''}">${t.kind === 'loan' ? 'Kiralık' : t.kind === 'free' ? 'Serbest' : t.kind === 'buy' ? 'Opsiyon' : 'Transfer'}</span><div class="grow small">${esc(CLUB_BY_ID[t.from]?.short || '')} → <b>${esc(CLUB_BY_ID[t.to]?.short || '')}</b></div><span class="small" style="color:var(--gold)">${t.fee ? money(t.fee) : '–'}</span><span class="muted small">S${t.s}</span></div>`).join('');
  return `
    <div class="h-sec">Kariyer arşivi</div>
    <div class="kpis">
      <div class="kpi"><b>${r.bestRating ? r.bestRating.toFixed(1) : '–'}</b><span>En iyi not</span></div>
      <div class="kpi"><b>${r.mostGoals}</b><span>Maçta en çok gol</span></div>
      <div class="kpi"><b>${r.hatTricks}</b><span>Hat-trick</span></div>
      <div class="kpi"><b>${r.bestStreak}</b><span>Gol serisi</span></div>
    </div>
    ${a.topFee ? `<div class="chips" style="margin-top:8px"><span class="chip gold">En yüksek bonservis: ${money(a.topFee.fee)} (${esc(CLUB_BY_ID[a.topFee.to]?.short || '')})</span>${a.trophies.length ? `<span class="chip gold">${a.trophies.length} kupa</span>` : ''}</div>` : a.trophies.length ? `<div class="chips" style="margin-top:8px"><span class="chip gold">${a.trophies.length} kupa</span></div>` : ''}
    ${kinds ? `<div class="card" style="margin-top:10px"><div class="muted small" style="margin-bottom:6px">Gol türleri</div>${kinds}</div>` : ''}
    ${clubs ? `<div class="card" style="padding:8px 10px;margin-top:10px"><table class="table"><thead><tr><th>Kulüp</th><th>Dönem</th><th>M</th><th>G</th><th>A</th></tr></thead><tbody>${clubs}</tbody></table></div>` : ''}
    ${tr ? `<div class="card list" style="margin-top:10px">${tr}</div>` : ''}`;
}

export function livingWorldHTML(state) {
  const rv = state.rival || ensureRival(state);
  const b = state.board || ensurePresident(state);
  const rivalCard = rv ? `<div class="card rival-card">
      <div class="row between"><b>${icon('fire', 'ico sm')} Kariyer rakibin</b><span class="chip">${esc(CLUB_BY_ID[rv.clubId]?.short || '')}</span></div>
      <div style="font-weight:800;margin-top:6px">${esc(rv.name)} <span class="muted small">· ${rv.age} yaş · OVR ${rv.ovr}${rv.retired ? ' · emekli' : ''}</span></div>
      <div class="chips" style="margin-top:8px"><span class="chip">Bu sezon ${rv.season.goals} G · ${rv.season.assists} A</span><span class="chip">Kariyer ${rv.totals.goals} G</span><span class="chip ${rv.h2h.w >= rv.h2h.l ? 'good' : 'bad'}">Kafa kafaya ${rv.h2h.w}G ${rv.h2h.d}B ${rv.h2h.l}M</span></div>
      <p class="muted small" style="margin:8px 0 0">Sen OVR ${ovr(state.player)} · ${state.career.season.goals + state.career.totals.goals} kariyer golü</p>
    </div>` : '';
  const boardCard = b ? `<div class="card" style="margin-top:10px">
      <div class="row between"><b>${icon('clipboard', 'ico sm')} Kulüp başkanı</b><span class="chip ${b.approval >= 65 ? 'good' : b.approval < 40 ? 'bad' : 'warn'}">${presidentLabel(b)}</span></div>
      <div style="font-weight:800;margin-top:6px">${esc(b.president)}</div>
      ${meter('Taraftar desteği', 'users', b.approval, 100, '#fbbf24')}
      <div class="chips" style="margin-top:8px">${b.crisis ? '<span class="chip bad">Mali kriz: maaşlar gecikiyor</span>' : ''}<span class="chip">Seçim: Sezon ${b.nextElection}</span></div>
    </div>` : '';
  return `<div class="h-sec">Yaşayan dünya</div>${rivalCard}${boardCard}`;
}

// ─────────────────────────── Jübile ───────────────────────────
export async function testimonialSheet(app) {
  const s = app.state;
  const c = s.career;
  const apps = c.totals.apps;
  const goals = c.totals.goals;
  const clubId = (archiveSummary(s).clubs[0] || {}).id || c.clubId;
  const club = CLUB_BY_ID[clubId];
  sfx('goal');
  confetti();
  await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center" style="font-size:52px">🏟️</div><h3 class="center">Jübile Maçı</h3>
      <p class="lead center">${esc(club?.name || '')} stadı ağzına kadar dolu. Eski takım arkadaşların, efsaneler ve ailen sahada. ${apps} maç, ${goals} gol, ${c.awards.length} ödül… Son kez formanı giydin.</p>
      <p class="lead center">Maçın 90. dakikasında tribünler adını haykırırken oyundan çıktın. Seremonide formanın numarası (#${s.player.number}) ${esc(club?.short || '')} tarafından bir sezon boyunca kimseye verilmeyecek.</p>
      <button class="btn primary block" style="margin-top:14px" data-close>Teşekkürler futbol</button>`,
  });
}
