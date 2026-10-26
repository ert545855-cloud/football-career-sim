// FUTBOL SONRASI EKRANLARI — teknik direktörlük ve TV yorumculuğu.
import { CLUB_BY_ID, LEAGUES } from '../../core/data.js';
import {
  COACH_CHOICES, MAX_AFTER_AGE, SHOWS, TONES, acceptCoachOffer, coachOffers, doShow, endPunditSeason, ensureAfter, fullyRetire, playCoachSeason,
  startCoaching, startPunditry,
} from '../../core/afterCareer.js';
import { money } from '../../core/economy.js';
import { buzz, sfx } from '../../audio.js';
import { crestSVG, icon, playerAvatar } from '../art.js';
import { animateBars, confetti, esc, sheet } from '../dom.js';
import { meter } from '../components.js';

/** Emeklilik ekranındaki "Futbol sonrası" bölümü */
export function afterCareerSection(state) {
  const a = ensureAfter(state);
  if (a.path === 'coach' && a.coach) {
    const club = CLUB_BY_ID[a.coach.clubId];
    return `<div class="h-sec">Futbol sonrası</div><button class="card ag-entry" data-act="coach">${crestSVG(club, 'crest sm')}<div class="grow"><b>Teknik direktör · ${esc(club.name)}</b><div class="muted small">${a.coach.seasons.length} sezon · ${a.coach.titles} şampiyonluk · İtibar ${Math.round(a.coach.rep)}</div></div>${icon('chev')}</button>`;
  }
  if (a.path === 'pundit' && a.pundit) {
    return `<div class="h-sec">Futbol sonrası</div><button class="card ag-entry" data-act="pundit"><span class="ag-av" style="--c:#0ea5e9">${icon('mic')}</span><div class="grow"><b>TV yorumcusu</b><div class="muted small">Popülerlik ${Math.round(a.pundit.pop)} · Kazanç ${money(a.pundit.earnings)}</div></div>${icon('chev')}</button>`;
  }
  if (a.path === 'rest') return `<div class="h-sec">Futbol sonrası</div><div class="card muted small">Huzurlu bir emekliliğin tadını çıkarıyorsun. Efsane puanın: <b style="color:var(--gold)">${a.legend}</b></div>`;
  return `
    <div class="h-sec">Futbol sonrası <span>Efsane puanı ${a.legend}</span></div>
    <div class="stack">
      <button class="card path-card" data-path="coach"><span class="path-ic">${icon('clipboard')}</span><div class="grow"><b>Teknik direktör ol</b><div class="muted small">Kulübede yeni bir kariyer: taktik, transfer ve antrenman kararları senin. ${a.legend >= 60 ? 'Efsane statün Süper Lig kapılarını açıyor.' : 'İlk teklifler alt liglerden gelir.'}</div></div></button>
      <button class="card path-card" data-path="pundit"><span class="path-ic">${icon('mic')}</span><div class="grow"><b>TV yorumcusu ol</b><div class="muted small">Maç sonu programları, derbi özelleri. Üslubunu seç, reytingleri topla.</div></div></button>
      <button class="card path-card" data-path="rest"><span class="path-ic">${icon('sprout')}</span><div class="grow"><b>Huzurlu emeklilik</b><div class="muted small">Ailene ve futbol okuluna zaman ayır.</div></div></button>
    </div>`;
}

/** Emeklilik ekranındaki tıklamalar */
export async function afterCareerClick(app, t) {
  const s = app.state;
  if (t.dataset.act === 'coach') return app.go('coach');
  if (t.dataset.act === 'pundit') return app.go('pundit');
  const path = t.dataset.path;
  if (!path) return;
  if (path === 'rest') {
    if (await app.confirm('Huzurlu emeklilik', 'Futbol sonrası kariyer yolları kapanacak.', 'Emekliliğin tadını çıkar')) {
      fullyRetire(s);
      app.save();
      app.go('retired');
    }
    return;
  }
  if (path === 'pundit') {
    startPunditry(s);
    app.save();
    sfx('levelup');
    return app.go('pundit');
  }
  const offers = coachOffers(s);
  const pick = await offersSheet(offers, 'Teknik direktörlük teklifleri', 'Efsane statün kulüplerin kapısını çaldırdı.');
  if (pick == null) return;
  startCoaching(s, offers[pick]);
  app.save();
  confetti();
  sfx('levelup');
  app.go('coach');
}

function offersSheet(offers, title, lead) {
  return sheet({
    html: `<h3>${esc(title)}</h3><p class="lead">${esc(lead)}</p>
      ${offers.map((o, i) => {
        const c = CLUB_BY_ID[o.clubId];
        return `<div class="card" style="padding:12px;margin-top:8px"><div class="row" style="gap:10px">${crestSVG(c, 'crest')}<div class="grow"><b>${esc(c.name)}</b><div class="muted small">${LEAGUES[c.league].name} · Güç ${c.rating}</div><div class="chips" style="margin-top:6px"><span class="chip gold">${money(o.salary)}/hf</span><span class="chip">Hedef: ilk ${o.target}</span></div></div></div><button class="btn primary block" style="margin-top:10px" data-close="${i}">${icon('check')} Göreve başla</button></div>`;
      }).join('')}
      <button class="btn ghost block" style="margin-top:10px" data-close="cancel">Vazgeç</button>`,
  }).then((v) => (v === 'cancel' || v == null || v === true ? null : Number(v)));
}

// ─────────────────────────── Teknik direktör ekranı ───────────────────────────

/** Emeklilik yolu henüz seçilmemişken (doğrudan açılırsa) gösterilen boş ekran */
function afterEmpty(title, text) {
  return { tabs: true, html: `<h2 style="margin:6px 0 10px">${esc(title)}</h2><div class="card"><p class="muted" style="margin:0">${esc(text)}</p></div>` };
}

export function coachScreen(app) {
  const s = app.state;
  const a = ensureAfter(s);
  const co = a.coach;
  if (!co) return afterEmpty('Teknik direktörlük', 'Futbolu bıraktıktan sonra Kariyer sekmesinden teknik direktörlüğe başlayabilirsin.');
  const club = CLUB_BY_ID[co.clubId];
  const pick = { tactic: 'balanced', transfer: 'keep', training: 'normal' };
  const seg = (key) => `<div class="seg wrap" data-seg="${key}">${COACH_CHOICES[key].map((c) => `<button class="${c.id === pick[key] ? 'on' : ''}" data-v="${c.id}">${esc(c.label)}</button>`).join('')}</div><p class="muted small" data-desc="${key}" style="margin:6px 0 0">${esc(COACH_CHOICES[key].find((c) => c.id === pick[key]).desc)}</p>`;
  const history = co.seasons.slice().reverse().map((h) => `<div class="li">${crestSVG(CLUB_BY_ID[h.clubId], 'crest sm')}<div class="grow small"><b>${esc(CLUB_BY_ID[h.clubId].short)}</b> · Yıl ${h.year}</div><span class="chip ${h.champion ? 'gold' : h.position <= h.target ? 'good' : 'bad'}">${h.position}. (hedef ${h.target})</span></div>`).join('');
  const done = a.age >= MAX_AFTER_AGE;

  return {
    tabs: false,
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Teknik Direktör</h1>
        <span class="chip">${a.age} yaş</span>
      </div>
      <div class="card coach-hero" style="margin-top:12px">
        <div class="row" style="gap:12px"><div class="avatar-ring">${playerAvatar(s)}</div><div class="grow"><b style="font-size:18px">${esc(s.player.name)}</b><div class="muted small">${esc(club.name)} · ${LEAGUES[club.league].name}</div></div>${crestSVG(club, 'crest')}</div>
        <div style="margin-top:12px;display:grid;gap:10px">${meter('İtibar', 'star', co.rep, 100, 'var(--gold)')}</div>
        <div class="chips" style="margin-top:10px"><span class="chip gold">${money(co.salary)}/hf</span><span class="chip">Yönetim hedefi: ilk ${co.target}</span><span class="chip accent">${co.titles} şampiyonluk</span></div>
      </div>
      ${done ? '<div class="card" style="margin-top:12px"><b>Kulübeye veda zamanı.</b><p class="muted small">Uzun ve onurlu bir kariyerin sonuna geldin.</p></div>' : `
      <div class="h-sec">Sezon planı · Yıl ${a.year}</div>
      <div class="card" style="display:grid;gap:12px">
        <div><b class="small">Taktik</b>${seg('tactic')}</div>
        <div><b class="small">Transfer</b>${seg('transfer')}</div>
        <div><b class="small">Antrenman</b>${seg('training')}</div>
      </div>
      <button class="btn primary lg block" style="margin-top:12px" data-act="play">${icon('whistle')} Sezonu oynat</button>`}
      ${history ? `<div class="h-sec">Kulübe geçmişi</div><div class="card list">${history}</div>` : ''}
      ${a.awards.length ? `<div class="h-sec">Teknik direktör ödülleri</div>${a.awards.filter((x) => x.role === 'coach').map((x) => `<div class="award">${icon('trophy', 'tro')}<div class="grow"><b>${esc(x.title)}</b><div class="muted small">Yıl ${x.year}</div></div></div>`).join('')}` : ''}
      <button class="btn ghost block" style="margin-top:14px" data-act="quit">Kulübeye veda et (tamamen emekli ol)</button>`,
    mount(node) {
      animateBars(node);
      node.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-seg] button');
        if (b) {
          const key = b.parentElement.dataset.seg;
          pick[key] = b.dataset.v;
          b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          node.querySelector(`[data-desc="${key}"]`).textContent = COACH_CHOICES[key].find((c) => c.id === pick[key]).desc;
          sfx('tick');
          return;
        }
        const t = e.target.closest('[data-act]');
        if (!t) return;
        app.click();
        if (t.dataset.act === 'back') return app.go('retired');
        if (t.dataset.act === 'quit') {
          if (await app.confirm('Kulübeye veda', 'Teknik direktörlük kariyerin sona erecek.', 'Veda et')) {
            fullyRetire(s);
            app.save();
            app.go('retired');
          }
          return;
        }
        if (t.dataset.act === 'play') {
          const r = playCoachSeason(s, pick);
          app.save();
          if (r.champion) {
            confetti();
            sfx('goal');
            buzz([80, 50, 80, 50, 200]);
          } else sfx(r.verdict === 'fired' ? 'error' : 'levelup');
          const top = r.table.slice(0, 5).map((row, i) => `<div class="li ${row.id === co.clubId ? 'me-row' : ''}"><span class="bd-rank">${i + 1}</span>${crestSVG(CLUB_BY_ID[row.id], 'crest sm')}<div class="grow small">${esc(CLUB_BY_ID[row.id].name)}</div><b class="tnum">${row.pts}</b></div>`).join('');
          await sheet({
            center: true,
            dismissable: false,
            html: `<div class="center">${crestSVG(CLUB_BY_ID[co.clubId], 'crest lg')}</div>
              <h3 class="center">${r.champion ? 'ŞAMPİYON!' : `${r.position}. sıra`}</h3>
              <p class="lead center">Hedef ilk ${r.target}'ti. ${r.crisis ? 'Sezon ortasında sakatlık krizi yaşandı. ' : ''}${{ extend: 'Yönetim sözleşmeni uzattı ve maaşına zam yaptı.', ok: 'Yönetim yolun doğru olduğunu düşünüyor.', fired: 'Yönetim yollarınızı ayırdı. Yeni teklifler masanda.' }[r.verdict]}</p>
              <div class="card list" style="margin-top:8px">${top}</div>
              ${r.awards.length ? `<div class="chips" style="justify-content:center;margin-top:10px">${r.awards.map((x) => `<span class="chip gold">${icon('trophy', 'ico xs')} ${esc(x)}</span>`).join('')}</div>` : ''}
              <button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
          });
          if (r.verdict === 'fired') {
            const offers = co.offers || coachOffers(s, { rep: co.rep });
            const idx = await offersSheet(offers, 'Yeni teklifler', 'Kovulmak bu işin parçası. Yeni bir sayfa açma zamanı.');
            if (idx != null) acceptCoachOffer(s, offers[idx]);
            else fullyRetire(s);
            app.save();
            return app.go(idx != null ? 'coach' : 'retired');
          }
          app.go('coach');
        }
      });
    },
  };
}

// ─────────────────────────── TV yorumcusu ekranı ───────────────────────────

export function punditScreen(app) {
  const s = app.state;
  const a = ensureAfter(s);
  const p = a.pundit;
  if (!p) return afterEmpty('TV yorumculuğu', 'Futbolu bıraktıktan sonra Kariyer sekmesinden TV yorumculuğuna başlayabilirsin.');
  const showId = p.shows?.[p.showIndex];
  const show = SHOWS.find((x) => x.id === showId);
  const done = a.age >= MAX_AFTER_AGE;
  const hist = p.seasons.slice().reverse().map((h) => `<div class="li">${icon(h.award ? 'trophy' : 'mic', 'ico sm')}<div class="grow small">Yıl ${h.year} · popülerlik ${h.pop}</div><b class="small">${money(h.money)}</b></div>`).join('');
  return {
    tabs: false,
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">TV Yorumcusu</h1>
        <span class="chip">${a.age} yaş</span>
      </div>
      <div class="card pundit-hero" style="margin-top:12px">
        <div class="row" style="gap:12px"><div class="avatar-ring">${playerAvatar(s)}</div><div class="grow"><b style="font-size:18px">${esc(s.player.name)}</b><div class="muted small">Futbol yorumcusu · Yıl ${a.year}</div></div><span class="on-air">CANLI</span></div>
        <div style="margin-top:12px;display:grid;gap:10px">${meter('Popülerlik', 'star', p.pop, 100, '#38bdf8')}${meter('Tartışma', 'fire', p.controversy, 100, 'var(--bad)')}</div>
        <div class="chips" style="margin-top:10px"><span class="chip gold">Toplam kazanç ${money(p.earnings)}</span></div>
      </div>
      ${done ? '<div class="card" style="margin-top:12px"><b>Mikrofonu bırakma zamanı.</b></div>' : show ? `
      <div class="h-sec">Bu haftaki program <span>${p.showIndex + 1}/${p.shows.length}</span></div>
      <div class="card"><b>${esc(show.name)}</b><p class="muted small" style="margin:4px 0 10px">${esc(show.desc)}</p>
        <div class="stack">${TONES.map((t) => `<button class="btn block tone-btn" data-tone="${t.id}"><b>${esc(t.label)}</b><span class="muted small">${esc(t.desc)}</span></button>`).join('')}</div>
      </div>` : ''}
      ${hist ? `<div class="h-sec">Sezonlar</div><div class="card list">${hist}</div>` : ''}
      <button class="btn ghost block" style="margin-top:14px" data-act="quit">Mikrofonu bırak (tamamen emekli ol)</button>`,
    mount(node) {
      animateBars(node);
      node.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-tone],[data-act]');
        if (!t) return;
        app.click();
        if (t.dataset.act === 'back') return app.go('retired');
        if (t.dataset.act === 'quit') {
          if (await app.confirm('Mikrofonu bırak', 'Yorumculuk kariyerin sona erecek.', 'Bırak')) {
            fullyRetire(s);
            app.save();
            app.go('retired');
          }
          return;
        }
        const r = doShow(s, t.dataset.tone);
        app.save();
        sfx(r.backlash ? 'error' : 'coin');
        await sheet({
          center: true,
          html: `<div class="center"><span class="on-air">YAYINDA</span></div><h3 class="center" style="margin-top:10px">${esc(r.show.name)}</h3><p class="lead center">${esc(r.note)}</p>
            <div class="chips" style="justify-content:center"><span class="chip ${r.dPop >= 0 ? 'good' : 'bad'}">Popülerlik ${r.dPop >= 0 ? '+' : ''}${r.dPop}</span><span class="chip ${r.dCon > 0 ? 'warn' : 'good'}">Tartışma ${r.dCon >= 0 ? '+' : ''}${r.dCon}</span><span class="chip gold">+${money(r.fee)}</span></div>
            <button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
        });
        if (r.done) {
          const end = endPunditSeason(s);
          app.save();
          if (end.award) confetti();
          await sheet({
            center: true,
            html: `<h3 class="center">Sezon bitti</h3><p class="lead center">${end.award ? '<b>Yılın Yorumcusu</b> ödülü senin!' : end.dropped ? 'Reytingler düştü, kanal sözleşmeni yenilemedi.' : 'Kanal sözleşmeni yeniledi.'}</p><div class="chips" style="justify-content:center"><span class="chip gold">Sezon primi ${money(end.bonus)}</span></div><button class="btn primary block" style="margin-top:14px" data-close>Devam</button>`,
          });
          if (end.dropped) {
            fullyRetire(s);
            app.save();
            return app.go('retired');
          }
        }
        app.go('pundit');
      });
    },
  };
}
