// MENTORLUK EKRANI — genç dönemde mentor, 26 yaş sonrası akıl hocalığı; kadro ve kurallar.
import { MENTOR_RULES, MentorManager, ORIGINS, SQUAD_POSITIONS } from '../../core/mentor/index.js';
import { icon } from '../art.js';
import { animateBars, esc } from '../dom.js';
import { meter } from '../components.js';
import {
  candidateCard, confirmMentor, meetingFlow, requestsSheet, roleChip, selectionSheet, speech, squadAvatar, traitBlock,
} from '../mentorView.js';

export function mentorScreen(app) {
  const s = app.state;
  const mm = new MentorManager(s);
  const v = mm.view();
  const clubId = s.career.clubId;
  const isMentee = v.mode === 'mentee';

  const modeBanner = isMentee
    ? `<div class="mode-banner"><span class="mentor-ic">${icon('mentor')}</span><div><b>Genç Yetenek dönemi</b><span>${MENTOR_RULES.maxMenteeAge} yaşına kadar her sezon bir mentor seçebilirsin. ${Math.max(0, MENTOR_RULES.maxMenteeAge - v.age + 1)} sezon kaldı.</span></div></div>`
    : `<div class="mode-banner gold"><span class="mentor-ic gold">${icon('sprout')}</span><div><b>Akıl Hocası dönemi</b><span>Mentor seçme ekranı kapandı. Nüfuzun ${MENTOR_RULES.legacyMinInfluence}'i geçince gençler sana gelir.</span></div></div>`;

  const stats = `<div class="card" style="display:grid;gap:12px">
    ${meter('Kulüp Nüfuzu', 'flag', v.influence, 100, 'var(--gold)', `${Math.round(v.influence)}${isMentee ? '' : ` / ${MENTOR_RULES.legacyMinInfluence}+`}`)}
    ${meter('Kulüp Sadakati', 'shield', v.loyalty, 100, '#fb923c')}
    <div class="chips">${v.captain ? `<span class="chip gold">${icon('crown', 'ico sm')} Takım kaptanısın</span>` : ''}<span class="chip">Nüfuz kulübe özeldir: transferde büyük kısmı kaybolur</span></div>
  </div>`;

  let main = '';
  if (isMentee) {
    if (v.active) {
      const m = v.mentor;
      const a = v.active;
      const check = mm.canMeet('coffee');
      const log = [...(a.log || [])].reverse().slice(0, 4);
      main = `<div class="h-sec">Sezonun mentoru <span>${a.meetings} buluşma</span></div>
        <div class="card" style="display:grid;gap:12px">
          <div class="row" style="gap:12px">${squadAvatar(m, clubId, 'lg')}<div class="grow" style="min-width:0"><b class="cand-name">${esc(m.name)}</b><div class="row" style="gap:6px;margin-top:4px;flex-wrap:wrap">${roleChip(m.role)}<span class="chip">${m.age} yaş</span><span class="chip">Nüfuz ${m.influence}</span></div></div></div>
          ${traitBlock(m.trait)}
          ${meter('Mentor İlişkisi', 'heart', a.relationship, 100, a.relationship >= 70 ? 'var(--good)' : 'var(--blue)')}
          <p class="muted small" style="margin:0">Buluşmadığın her hafta ilişki ${MENTOR_RULES.weeklyDecay} puan düşer. Sezon sonunda ilişki 70+ ise mentorundan nüfuz mirası alırsın.</p>
          <div class="meet-row">
            <button class="meet ${check.ok ? '' : 'off'}" data-meet="coffee">${icon('coffee')}<b>Kahve İç</b><span>−${MENTOR_RULES.meetingEnergy} enerji · +${MENTOR_RULES.meetingRelationship} ilişki</span></button>
            <button class="meet ${check.ok ? '' : 'off'}" data-meet="dinner">${icon('utensils')}<b>Yemeğe Davet Et</b><span>−${MENTOR_RULES.meetingEnergy} enerji · +${MENTOR_RULES.meetingRelationship} ilişki</span></button>
          </div>
          ${check.ok ? '' : `<p class="muted small" style="margin:0">${esc(check.reason)}</p>`}
        </div>
        ${log.length ? `<div class="h-sec">Son sohbetler</div><div class="stack">${log.map((l) => `<div class="log-item"><span class="muted small">${l.kind === 'coffee' ? 'Kahve' : 'Yemek'} · Hafta ${l.week}</span>${speech(null, clubId, l.text, { name: m.name.split(' ')[0] })}</div>`).join('')}</div>` : ''}`;
    } else if (v.selection.ok) {
      main = `<div class="h-sec">Mentor adayları <span>en fazla ${MENTOR_RULES.maxCandidates}</span></div>
        <div class="stack">${v.candidates.map((p) => candidateCard(p, clubId)).join('')}</div>
        <button class="btn ghost block" style="margin-top:10px" data-open-selection>Seçim ekranını aç</button>`;
    } else {
      main = `<div class="card center" style="padding:20px 16px"><div class="event-art">${icon('mentor')}</div><b>Bu sezon mentorun yok</b><p class="muted small" style="margin:6px 0 0">${esc(v.selection.reason || '')}</p></div>`;
    }
  } else {
    const L = v.legacy;
    main = `
      ${L.requests.length ? `<button class="btn gold block" style="margin-top:12px" data-open-requests>${icon('sprout')} ${L.requests.length} mentorluk talebini gör</button>` : ''}
      <div class="h-sec">Yetiştirdiğin gençler <span>${L.mentees.length}/${MENTOR_RULES.maxMentees}</span></div>
      ${L.mentees.length ? `<div class="stack">${L.mentees.map((m) => {
        const y = mm.member(m.id);
        return `<div class="card row" style="gap:12px">${y ? squadAvatar(y, clubId) : ''}<div class="grow" style="min-width:0"><b>${esc(m.name)}</b><div class="muted small">${m.age} yaş · ${SQUAD_POSITIONS[m.position]} · ${ORIGINS[m.origin]} · ${m.weeks} hafta</div></div><span class="chip good">Gelişim +${m.growth.toFixed(1)}</span></div>`;
      }).join('')}</div>` : `<div class="card muted small">${v.canReceive ? 'Henüz bir genç seni seçmedi. Kadroya genç geldikçe talepler gelecek.' : `Kulüp nüfuzun ${MENTOR_RULES.legacyMinInfluence}'in üstüne çıkınca ${MENTOR_RULES.maxYouthAge} yaş ve altı gençler sana mentorluk teklif edecek.`}</div>`}
      ${(L.notes || []).length ? `<div class="h-sec">Notlar</div><div class="card list">${[...L.notes].reverse().slice(0, 4).map((n) => `<div class="li small"><span class="news-dot good"></span><div class="grow">${esc(n.text)}</div><span class="muted small">H${n.week}</span></div>`).join('')}</div>` : ''}`;
  }

  const squad = [...v.squad].sort((a, b) => b.age - a.age).map((p) => {
    const eligible = MentorManager.isEligibleMentor(p);
    const youth = p.age <= MENTOR_RULES.maxYouthAge;
    const tag = isMentee
      ? (eligible ? `<span class="chip gold">Mentor adayı</span>` : '')
      : (youth ? `<span class="chip good">${icon('sprout', 'ico sm')} Genç</span>` : '');
    const why = isMentee && !eligible && p.age >= 30 ? `<div class="muted" style="font-size:11px">${esc(MentorManager.eligibilityIssues(p).join(' · '))}</div>` : '';
    return `<div class="li">${squadAvatar(p, clubId, 'sm')}<div class="grow" style="min-width:0"><b class="small">${esc(p.name)}</b> <span class="muted small">${p.age} · ${SQUAD_POSITIONS[p.position]}</span>${why}</div><div class="col" style="align-items:flex-end;gap:4px">${roleChip(p.role)}${tag}</div><b class="inf-num" title="Kulüp Nüfuzu">${p.influence}</b></div>`;
  }).join('');

  const history = v.history.length ? `<div class="h-sec">Geçmiş mentorların</div><div class="card list">${[...v.history].reverse().slice(0, 6).map((h) => `<div class="li"><div class="grow"><b class="small">${esc(h.mentor.name)}</b><div class="muted small">Sezon ${h.season} · ${h.meetings} buluşma${h.ended === 'transfer' ? ' · transferle bitti' : ''}</div></div>${traitBlock(h.mentor.trait, { compact: true })}<b class="inf-num">${h.relationship}</b></div>`).join('')}</div>` : '';

  return {
    tabs: 'home',
    html: `
      <div class="row" style="margin-bottom:12px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Mentorluk</h1>
      </div>
      ${modeBanner}
      ${stats}
      ${main}
      <div class="h-sec">Kadro <span>Nüfuz</span></div>
      <div class="card list squad-list">${squad}</div>
      ${history}
      <div class="h-sec">Kurallar</div>
      <div class="card rules small">
        <p><b>Mentor adayı:</b> ${MENTOR_RULES.minMentorAge}+ yaş, Kaptan veya Yıldız Oyuncu, kulüp nüfuzu ${MENTOR_RULES.minMentorInfluence}'in üstünde. Sezon başında en fazla ${MENTOR_RULES.maxCandidates} aday listelenir.</p>
        <p><b>Seçim:</b> ${MENTOR_RULES.maxMenteeAge} yaş ve altıysan, sezonun ilk haftasında bir mentor seçersin. Bir sezonda bir mentor.</p>
        <p><b>Buluşma:</b> Kahve ya da yemek: −${MENTOR_RULES.meetingEnergy} enerji, +${MENTOR_RULES.meetingRelationship} mentor ilişkisi, haftada bir.</p>
        <p><b>Rol değişimi:</b> ${MENTOR_RULES.maxMenteeAge} yaşını geçince, nüfuzun ${MENTOR_RULES.legacyMinInfluence}'in üstündeyse ${MENTOR_RULES.maxYouthAge} yaş ve altı gençler seni mentor seçmek ister. Kabul edersen her hafta nüfuz +${MENTOR_RULES.legacyInfluencePerWeek}, kulüp sadakati, hoca ve yönetim ilişkisi artar.</p>
      </div>`,
    mount(el) {
      animateBars(el);
      el.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-act],[data-meet],[data-open-selection],[data-open-requests],[data-pick-mentor]');
        if (!t) return;
        app.click();
        if (t.dataset.act === 'back') return app.go('hub');
        if (t.dataset.meet) {
          await meetingFlow(app, t.dataset.meet);
          return app.go('mentor');
        }
        if (t.dataset.pickMentor) {
          await confirmMentor(app, t.dataset.pickMentor);
          return app.go('mentor');
        }
        if (t.hasAttribute('data-open-selection')) {
          await selectionSheet(app);
          return app.go('mentor');
        }
        if (t.hasAttribute('data-open-requests')) {
          await requestsSheet(app);
          return app.go('mentor');
        }
      });
    },
  };
}
