// Mentorluk görünüm parçaları: aday kartı, ana ekran kartı, seçim / buluşma / rol değişimi / talep pencereleri.
import { CLUB_BY_ID } from '../core/data.js';
import { MENTOR_RULES, MENTOR_TRAITS, MentorManager, ORIGINS, SQUAD_POSITIONS, TEAM_ROLES, upcomingBigMatch } from '../core/mentor/index.js';
import { avatarSVG, icon } from './art.js';
import { animateBars, confetti, esc, sheet, toast } from './dom.js';
import { changeChips, meter } from './components.js';
import { buzz, sfx } from '../audio.js';

/** Kadro oyuncusunun portresi (kulüp formasıyla) */
export function squadAvatar(p, clubId, cls = '') {
  return `<span class="sq-av ${cls}">${avatarSVG(p.avatar, CLUB_BY_ID[clubId], p.number)}</span>`;
}

export function roleChip(role) {
  const r = TEAM_ROLES[role] || TEAM_ROLES.regular;
  return `<span class="chip ${r.tone}">${role === 'captain' ? icon('crown', 'ico sm') : ''}${r.label}</span>`;
}

export function traitBlock(traitId, { compact = false } = {}) {
  const t = MENTOR_TRAITS[traitId];
  return `<div class="trait ${compact ? 'compact' : ''}" style="--c:${t.color}">
    <span class="t-ic">${icon(t.icon, 'ico sm')}</span>
    <div class="grow"><b>${t.name} <span class="muted">· ${t.en}</span></b>${compact ? '' : `<span>${esc(t.desc)}</span>`}</div>
  </div>`;
}

const relColor = (v) => (v >= 70 ? 'var(--good)' : v >= 40 ? 'var(--blue)' : 'var(--warn)');

/** Seçim listesindeki aday kartı */
export function candidateCard(p, clubId, { selectable = true } = {}) {
  return `<article class="cand">
    <div class="row" style="gap:12px;align-items:flex-start">
      ${squadAvatar(p, clubId, 'lg')}
      <div class="grow" style="min-width:0">
        <div class="row" style="gap:6px;flex-wrap:wrap"><b class="cand-name">${esc(p.name)}</b>${roleChip(p.role)}</div>
        <div class="muted small" style="margin-top:3px">${p.age} yaş · ${SQUAD_POSITIONS[p.position]} · OVR ${p.ovr}</div>
        <div style="margin-top:8px">${meter('Kulüp Nüfuzu', 'flag', p.influence, 100, 'var(--gold)')}</div>
      </div>
    </div>
    ${traitBlock(p.trait)}
    ${selectable ? `<button class="btn primary block" data-pick-mentor="${p.id}">${icon('check')} ${esc(p.name.split(' ')[0])} mentorum olsun</button>` : ''}
  </article>`;
}

/** Konuşma balonu */
export function speech(p, clubId, text, { name = p?.name } = {}) {
  return `<div class="speech">
    ${p ? squadAvatar(p, clubId) : ''}
    <div class="bubble"><b>${esc(name)}</b><p>${esc(text)}</p></div>
  </div>`;
}

/** Ana ekrandaki mentorluk kartı */
export function hubMentorCard(state) {
  const mm = new MentorManager(state);
  const v = mm.view();
  const clubId = state.career.clubId;
  if (v.mode === 'mentee') {
    if (v.active) {
      const m = v.mentor;
      const a = v.active;
      const c1 = mm.canMeet('coffee');
      const met = a.lastMeeting === mm.weekKey();
      return `<div class="card mentor-card">
        <div class="row" style="gap:12px">
          ${squadAvatar(m, clubId)}
          <div class="grow" style="min-width:0">
            <div class="muted small">Sezonun mentoru</div>
            <b class="ellipsis" style="display:block">${esc(m.name)}</b>
          </div>
          <button class="btn sm ghost" data-go-mentor>${icon('chev')}</button>
        </div>
        ${traitBlock(m.trait, { compact: true })}
        ${meter('Mentor İlişkisi', 'heart', a.relationship, 100, relColor(a.relationship))}
        <div class="meet-row">
          <button class="meet ${c1.ok ? '' : 'off'}" data-meet="coffee" title="${esc(c1.reason || '')}">${icon('coffee')}<b>Kahve İç</b><span>−${MENTOR_RULES.meetingEnergy} enerji · +${MENTOR_RULES.meetingRelationship} ilişki</span></button>
          <button class="meet ${c1.ok ? '' : 'off'}" data-meet="dinner" title="${esc(c1.reason || '')}">${icon('utensils')}<b>Yemeğe Davet Et</b><span>−${MENTOR_RULES.meetingEnergy} enerji · +${MENTOR_RULES.meetingRelationship} ilişki</span></button>
        </div>
        ${met ? `<p class="muted small" style="margin:0">${esc(m.name.split(' ')[0])} bu hafta seninle buluştu. Haftaya yine davet edebilirsin.</p>` : ''}
      </div>`;
    }
    if (v.selection.ok) {
      return `<div class="card mentor-card glow-gold">
        <div class="row" style="gap:12px">
          <span class="mentor-ic">${icon('mentor')}</span>
          <div class="grow"><b>Sezonun mentorunu seç</b><div class="muted small">${v.candidates.length} tecrübeli aday · yalnızca bu hafta</div></div>
        </div>
        <button class="btn gold block" data-open-selection>${icon('users')} Adayları gör</button>
      </div>`;
    }
    return `<button class="card mentor-card slim" data-go-mentor>
      <span class="mentor-ic dim">${icon('mentor')}</span>
      <div class="grow" style="text-align:left"><b>Mentorluk</b><div class="muted small">${esc(v.selection.reason || '')}</div></div>
      ${icon('chev')}
    </button>`;
  }
  // Akıl hocası dönemi
  const L = v.legacy;
  const pending = L.requests.length;
  return `<div class="card mentor-card legacy">
    <div class="row" style="gap:12px">
      <span class="mentor-ic gold">${icon('sprout')}</span>
      <div class="grow"><b>Akıl Hocası</b><div class="muted small">${L.mentees.length ? `${L.mentees.length} gence mentorluk yapıyorsun · nüfuz +${MENTOR_RULES.legacyInfluencePerWeek}/hafta` : v.canReceive ? 'Gençler senden mentorluk isteyebilir.' : `Nüfuzun ${MENTOR_RULES.legacyMinInfluence}'i geçince gençler sana gelecek.`}</div></div>
      <button class="btn sm ghost" data-go-mentor>${icon('chev')}</button>
    </div>
    ${meter('Kulüp Nüfuzu', 'flag', v.influence, 100, v.influence > MENTOR_RULES.legacyMinInfluence ? 'var(--gold)' : 'var(--blue)', `${Math.round(v.influence)} / ${MENTOR_RULES.legacyMinInfluence}+`)}
    ${pending ? `<button class="btn gold block" data-open-requests>${icon('sprout')} ${pending} mentorluk talebi</button>` : ''}
  </div>`;
}

/** Sezon başı mentor seçimi. @returns {Promise<boolean>} seçildi mi */
export async function selectionSheet(app) {
  const s = app.state;
  const mm = new MentorManager(s);
  const check = mm.canChooseMentor();
  if (!check.ok) {
    toast(check.reason, 'bad');
    return false;
  }
  const list = mm.candidates();
  const clubId = s.career.clubId;
  const choice = await sheet({
    html: `
      <div class="center"><span class="chip gold">${icon('mentor', 'ico sm')} SEZON ${s.calendar.season} · 1. HAFTA</span></div>
      <h3 class="center" style="margin-top:8px">Sezonun Mentorunu Seç</h3>
      <p class="lead center">Kadrodaki tecrübeli isimlerden biri bu sezon sana yol gösterecek. Bir sezonda yalnızca <b>bir</b> mentor seçebilirsin.</p>
      <div class="chips" style="justify-content:center;margin-bottom:12px"><span class="chip">${MENTOR_RULES.minMentorAge}+ yaş</span><span class="chip">Kaptan / Yıldız</span><span class="chip">Nüfuz ${MENTOR_RULES.minMentorInfluence}+</span></div>
      <div class="stack">${list.map((p) => candidateCard(p, clubId)).join('')}</div>
      <button class="btn ghost block" style="margin-top:12px" data-close="later">Sonra karar vereceğim</button>
      <button class="btn ghost block" style="margin-top:8px;border:none;color:var(--muted)" data-close="skip">Bu sezon mentor istemiyorum</button>`,
    onMount: (node, close) => {
      animateBars(node);
      node.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pick-mentor]');
        if (b) close(`pick:${b.dataset.pickMentor}`);
      });
    },
  });
  if (choice === 'skip') {
    mm.skipSelection();
    app.save();
    toast('Bu sezon mentorsuz devam ediyorsun.');
    return false;
  }
  if (typeof choice !== 'string' || !choice.startsWith('pick:')) return false;
  return confirmMentor(app, choice.slice(5));
}

/** Seçilen adayı mentor yapar ve tanışma ekranını gösterir. */
export async function confirmMentor(app, id) {
  const s = app.state;
  const mm = new MentorManager(s);
  const clubId = s.career.clubId;
  const res = mm.chooseMentor(id);
  if (!res.ok) {
    toast(res.reason, 'bad');
    return false;
  }
  app.save();
  sfx('levelup');
  buzz([20, 30, 40]);
  confetti({ count: 70, colors: ['#ffcf3d', '#c6ff3d', '#ffffff'] });
  const m = mm.activeMentor();
  await sheet({
    center: true,
    onMount: (n) => animateBars(n),
    html: `
      <div class="center"><span class="chip gold">YENİ MENTORUN</span></div>
      <div class="mentor-hero">${squadAvatar(m, clubId, 'xl')}</div>
      <h3 class="center">${esc(m.name)}</h3>
      <div class="chips" style="justify-content:center;margin:6px 0 12px">${roleChip(m.role)}<span class="chip">${m.age} yaş</span><span class="chip">Nüfuz ${m.influence}</span></div>
      ${speech(null, clubId, res.intro, { name: m.name })}
      ${traitBlock(m.trait)}
      <p class="muted small center" style="margin:10px 0 0">Haftalık panelden onu kahveye ya da yemeğe davet edebilirsin.</p>
      <button class="btn primary block" style="margin-top:14px" data-close>Harika</button>`,
  });
  return true;
}

/** Haftalık buluşma (kahve / yemek) */
export async function meetingFlow(app, kind) {
  const s = app.state;
  const mm = new MentorManager(s);
  const r = mm.meet(kind);
  if (!r.ok) {
    toast(r.reason, 'bad');
    sfx('error');
    return false;
  }
  app.save();
  sfx('swish');
  const m = mm.activeMentor();
  const clubId = s.career.clubId;
  await sheet({
    center: true,
    onMount: (n) => animateBars(n),
    html: `
      <div class="event-art">${icon(kind === 'coffee' ? 'coffee' : 'utensils')}</div>
      <h3 class="center">${esc(r.title)}</h3>
      <p class="scene">${esc(r.scene)}</p>
      ${speech(m, clubId, r.dialogue.text)}
      ${r.bigMatch ? `<div class="chips" style="justify-content:center;margin-top:10px"><span class="chip bad">${icon('fire', 'ico sm')} Bu hafta: ${esc(r.bigMatch.title)}</span></div>` : ''}
      <div style="margin-top:12px">${changeChips(r.changes)}</div>
      <div style="margin-top:12px">${meter('Mentor İlişkisi', 'heart', r.relationship, 100, relColor(r.relationship))}</div>
      <button class="btn primary block" style="margin-top:16px" data-close>Teşekkürler</button>`,
  });
  return true;
}

/** 26 yaşını geçince bir kez gösterilen rol değişimi ekranı */
export async function legacyShiftSheet(app) {
  const s = app.state;
  const mm = new MentorManager(s);
  sfx('levelup');
  await sheet({
    center: true,
    dismissable: false,
    onMount: (n) => animateBars(n),
    html: `
      <div class="event-art gold">${icon('sprout')}</div>
      <div class="center"><span class="chip gold">ROL DEĞİŞİMİ</span></div>
      <h3 class="center" style="margin-top:8px">Genç Yetenekten Akıl Hocasına</h3>
      <p class="lead center">Artık ${s.player.age} yaşındasın. Mentor seçme dönemi kapandı; bundan sonra soyunma odasında örnek alınan sensin.</p>
      <div class="card" style="display:grid;gap:10px">
        ${meter('Kulüp Nüfuzu', 'flag', s.player.influence, 100, s.player.influence > MENTOR_RULES.legacyMinInfluence ? 'var(--gold)' : 'var(--blue)', `${Math.round(s.player.influence)} / ${MENTOR_RULES.legacyMinInfluence}+`)}
        <p class="muted small" style="margin:0">Nüfuzun ${MENTOR_RULES.legacyMinInfluence}'i geçtiğinde altyapıdan ya da transferle gelen ${MENTOR_RULES.maxYouthAge} yaş ve altı gençler senden mentorluk isteyecek. Kabul edersen her hafta <b>+${MENTOR_RULES.legacyInfluencePerWeek} nüfuz</b> kazanırsın; yönetim ve hocanın gözünde değerin (Kulüp Sadakati) artar.</p>
      </div>
      ${mm.canReceiveRequests() ? '' : '<p class="muted small center" style="margin:10px 0 0">İpucu: Aynı kulüpte kalmak, maçlarda forma giymek ve takımla vakit geçirmek nüfuzunu artırır.</p>'}
      <button class="btn primary block" style="margin-top:14px" data-close>Anladım</button>`,
  });
  s.mentor.legacy.shiftShown = true;
  app.save();
}

/** Gençlerin mentorluk talepleri */
export async function requestsSheet(app) {
  const s = app.state;
  const mm = new MentorManager(s);
  const clubId = s.career.clubId;
  const L = s.mentor.legacy;
  for (const req of [...L.requests]) {
    req.prompted = true;
    const y = mm.member(req.id) || { ...req, avatar: { skin: 2, hair: 'short', hairColor: 1 }, number: 0 };
    const full = L.mentees.length >= MENTOR_RULES.maxMentees;
    const ans = await sheet({
      center: true,
      dismissable: false,
      html: `
        <div class="center"><span class="chip good">${icon('sprout', 'ico sm')} MENTORLUK TALEBİ</span></div>
        <div class="mentor-hero">${squadAvatar(y, clubId, 'xl')}</div>
        <h3 class="center">${esc(req.name)}</h3>
        <div class="chips" style="justify-content:center;margin:6px 0 12px"><span class="chip">${req.age} yaş</span><span class="chip">${SQUAD_POSITIONS[req.position]}</span><span class="chip accent">${ORIGINS[req.origin]}</span></div>
        ${speech(null, clubId, req.message, { name: req.name })}
        <div class="chips" style="justify-content:center;margin-top:10px"><span class="chip good">Nüfuz +${MENTOR_RULES.legacyInfluencePerWeek}/hafta</span><span class="chip good">Kulüp Sadakati ↑</span><span class="chip good">Hoca ↑</span><span class="chip good">Yönetim ↑</span></div>
        ${full ? `<p class="muted small center" style="margin:10px 0 0">Aynı anda en fazla ${MENTOR_RULES.maxMentees} gence mentorluk yapabilirsin.</p>` : ''}
        <div class="stack" style="margin-top:14px">
          <button class="btn primary block" data-close="yes" ${full ? 'disabled' : ''}>${icon('check')} Kabul et</button>
          <button class="btn ghost block" data-close="no">Şu an vaktim yok</button>
        </div>`,
    });
    if (ans === 'yes') {
      const r = mm.acceptRequest(req.id);
      if (r.ok) {
        sfx('levelup');
        toast(`${req.name.split(' ')[0]} artık senin öğrencin!`);
      }
    } else mm.declineRequest(req.id);
    app.save();
  }
}

/** Sıradaki maç büyük maç ise küçük etiket */
export function bigMatchChip(state) {
  const b = upcomingBigMatch(state);
  return b ? `<span class="chip bad">${icon('fire', 'ico sm')} ${esc(b.title)}</span>` : '';
}
