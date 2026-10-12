// UYGULAMA DENETLEYİCİSİ — ekran yönetimi ve oyun akışları (antrenman, maç günü, sezon sonu…)
import { ACTIONS, CLUB_BY_ID, LEAGUES, POSITIONS, STATS, STAT_KEYS, TRAINING } from '../core/data.js';
import {
  canDoAction, chooseEvent, completeMatch, declineOffers, doAction, endSeason, finishTraining, getMatch, newGame, retire, takeOffer, trainingSetup,
} from '../core/game.js';
import { getEvent } from '../core/events.js';
import { money } from '../core/economy.js';
import { clubRating, leagueOf } from '../core/league.js';
import { growthMult, ovr } from '../core/player.js';
import { clearSave, loadGame, loadSettings, saveGame, saveSettings } from '../core/storage.js';
import { runMiniGame } from '../games/index.js';
import { buzz, sfx } from '../audio.js';
import { crestSVG, icon, playerAvatar } from './art.js';
import { animateBars, confetti, countUp, el, esc, setRoot, sheet, toast } from './dom.js';
import { changeChips, offerCard, ratingColor } from './components.js';
import { titleScreen } from './screens/title.js';
import { createScreen } from './screens/create.js';
import { hubScreen } from './screens/hub.js';
import { playerScreen } from './screens/player.js';
import { leagueScreen } from './screens/league.js';
import { shopScreen } from './screens/shop.js';
import { careerScreen } from './screens/career.js';
import { settingsScreen } from './screens/settings.js';
import { matchScreen } from './screens/match.js';

const TABS = [
  { id: 'home', screen: 'hub', label: 'Ana Sayfa', icon: 'home' },
  { id: 'player', screen: 'player', label: 'Oyuncu', icon: 'user' },
  { id: 'league', screen: 'league', label: 'Lig', icon: 'table' },
  { id: 'shop', screen: 'shop', label: 'Mağaza', icon: 'bag' },
  { id: 'career', screen: 'career', label: 'Kariyer', icon: 'trophy' },
];

const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

export function createApp(rootEl) {
  setRoot(rootEl);

  const SCREENS = {
    title: titleScreen,
    create: createScreen,
    hub: hubScreen,
    player: playerScreen,
    league: leagueScreen,
    shop: shopScreen,
    career: careerScreen,
    settings: settingsScreen,
    match: matchScreen,
    retired: retiredScreen,
  };

  const app = {
    state: loadGame(),
    settings: loadSettings(),
    installPrompt: null,
    autoplay: new URLSearchParams(location.search).has('autoplay'),
    current: null,
    prev: null,
    draft: null,

    save() {
      if (this.state) saveGame(this.state);
    },
    saveSettings() {
      saveSettings(this.settings);
    },
    click() {
      sfx('click');
    },

    go(name, params = {}) {
      const def = SCREENS[name](this, params);
      rootEl.innerHTML = '';
      let screenEl;
      if (def.raw) {
        screenEl = el(`<div style="flex:1;display:flex;flex-direction:column;min-height:0">${def.html}</div>`);
      } else {
        screenEl = el(`<main class="screen ${def.tabs ? '' : 'no-tabs'}">${def.html}</main>`);
      }
      rootEl.appendChild(screenEl);
      if (def.tabs) rootEl.appendChild(tabbar(def.tabs));
      if (name !== this.current) {
        this.prev = this.current;
        this.current = name;
      }
      def.mount?.(screenEl, screenEl);
    },

    back() {
      if (this.state && this.state.calendar.phase !== 'retired') this.go(['player', 'league', 'shop', 'career'].includes(this.prev) ? this.prev : 'hub');
      else this.go(this.state ? 'retired' : 'title');
    },

    confirm(title, text, okLabel = 'Evet') {
      return sheet({
        center: true,
        html: `<h3>${esc(title)}</h3><p class="lead">${esc(text)}</p><div class="stack"><button class="btn danger block" data-close="ok">${esc(okLabel)}</button><button class="btn ghost block" data-close="no">Vazgeç</button></div>`,
      }).then((v) => v === 'ok');
    },

    showText(title, text) {
      return sheet({
        html: `<h3>${esc(title)}</h3><p class="lead">Bu kodu kopyalayıp sakla:</p><textarea class="field" style="height:120px;padding:10px;font-size:12px;font-weight:500" readonly>${esc(text)}</textarea><button class="btn primary block" style="margin-top:12px" data-close>Tamam</button>`,
      });
    },

    async startCareer(draft) {
      this.state = newGame({ name: draft.name, position: draft.position, avatar: draft.avatar, number: draft.number });
      this.draft = null;
      this.save();
      const s = this.state;
      const club = CLUB_BY_ID[s.career.clubId];
      confetti();
      sfx('levelup');
      await sheet({
        center: true,
        dismissable: false,
        html: `
          <div class="center" style="margin-bottom:8px"><span class="chip accent">İLK PROFESYONEL SÖZLEŞME</span></div>
          <div style="display:grid;place-items:center;margin:10px 0">${crestSVG(club, 'crest lg')}</div>
          <h3 class="center">${esc(club.name)}</h3>
          <p class="lead center">${esc(club.city)} · ${LEAGUES[club.league].name}<br>Kulüp seni A takım kadrosuna aldı. Formanı kapmak için hocayı etkilemelisin!</p>
          <div class="chips" style="justify-content:center"><span class="chip gold">${money(s.career.contract.wage)}/hafta</span><span class="chip">${s.career.contract.yearsLeft} yıl</span><span class="chip">#${s.player.number}</span></div>
          <button class="btn primary lg block" style="margin-top:16px" data-close>${icon('check')} İmzala</button>`,
      });
      sfx('coin');
      this.go('hub');
      setTimeout(() => toast('İpucu: Haftada 4 zaman hakkın var. Antrenman yap, sonra maç gününe geç!'), 600);
    },

    resume() {
      if (!this.state) return this.go('title');
      this.runPending();
    },

    // ── Haftalık aksiyonlar ──
    async runAction(id) {
      const s = this.state;
      if (id === 'train') return this.train();
      const r = doAction(s, id);
      if (!r.ok) {
        toast(r.text, 'bad');
        sfx('error');
        return;
      }
      this.save();
      if (id === 'sponsor') sfx('coin');
      const act = ACTIONS.find((a) => a.id === id);
      await sheet({
        center: true,
        html: `<div class="event-art">${icon(act.icon)}</div><h3 class="center">${esc(r.title)}</h3><p class="lead center">${esc(r.text)}</p>${changeChips(r.changes)}<button class="btn primary block" style="margin-top:16px" data-close>Tamam</button>`,
      });
      this.go('hub');
    },

    async train() {
      const s = this.state;
      const check = canDoAction(s, 'train');
      if (!check.ok) {
        toast(check.reason, 'bad');
        sfx('error');
        return;
      }
      const pos = POSITIONS[s.player.position];
      const opts = STAT_KEYS.map((k) => {
        const setup = trainingSetup(s, k);
        const mult = growthMult(s.player, k);
        return `<button class="btn block" style="justify-content:space-between;min-height:62px;text-align:left" data-close="${k}">
          <span class="row" style="gap:12px"><span style="width:12px;height:12px;border-radius:50%;background:${STATS[k].color};box-shadow:0 0 10px ${STATS[k].color}"></span>
          <span><b>${STATS[k].name}</b> <span class="muted">${s.player.stats[k]}</span><br><span class="muted small">${TRAINING[k].title} · yetenek %${Math.round(setup.skill * 100)}</span></span></span>
          <span class="chip ${mult > 1 ? 'accent' : ''}">×${mult}</span></button>`;
      }).join('');
      const stat = await sheet({
        html: `<h3>Antrenman</h3><p class="lead">Hangi özelliğini çalışacaksın? ${pos.name} için <b>${STATS[pos.primary].name}</b> ve <b>${STATS[pos.secondary].name}</b> daha hızlı gelişir.</p><div class="stack">${opts}</div><button class="btn ghost block" style="margin-top:10px" data-close="cancel">Vazgeç</button>`,
      });
      if (!stat || stat === true || stat === 'cancel') return;
      const setup = trainingSetup(s, stat);
      const club = CLUB_BY_ID[s.career.clubId];
      const result = await runMiniGame({
        type: setup.game,
        skill: setup.skill,
        context: setup.game === 'shot' ? 'box' : setup.game === 'pass' ? 'buildup' : 'duel',
        title: setup.title,
        text: setup.hint,
        myKit: club,
        oppKit: { colors: ['#f97316', '#1e293b'] },
        keeper: 0.45,
        number: s.player.number,
        name: s.player.name.split(' ')[0].toUpperCase(),
        auto: this.autoplay,
      });
      const res = finishTraining(s, stat, result);
      this.save();
      if (res.gained) {
        sfx('levelup');
        buzz([30, 30, 60]);
      }
      await sheet({
        center: true,
        onMount: (node) => {
          animateBars(node);
          if (res.gained) countUp(node.querySelector('[data-val]'), res.after, { from: res.before, duration: 900 });
        },
        html: `
          <div class="event-art">${icon(res.success ? 'star' : 'dumbbell')}</div>
          <h3 class="center">${res.success ? 'Harika antrenman!' : 'Zorlu bir gün'}</h3>
          <p class="lead center">${res.gained ? `<b style="color:var(--accent)">${res.name} +${res.gained}!</b> Çalışmanın karşılığını aldın.` : `${res.name} gelişiyor. Bir sonraki puana az kaldı.`}</p>
          <div class="card">
            <div class="row between"><b>${res.name}</b><b class="big-num" data-val style="color:${STATS[stat].color}">${res.after}</b></div>
            <div class="muted small" style="margin:8px 0 4px">Sonraki puana ilerleme</div>
            <div class="bar thick"><i style="--c:${STATS[stat].color}" data-w="${Math.round(res.progress * 100)}"></i></div>
          </div>
          <div class="chips" style="margin-top:10px;justify-content:center"><span class="chip bad">Enerji −18</span>${res.success ? '<span class="chip good">Moral +1</span>' : ''}</div>
          <button class="btn primary block" style="margin-top:16px" data-close>Tamam</button>`,
      });
      this.go('hub');
    },

    // ── Maç günü ──
    async matchDay() {
      const s = this.state;
      if (s.calendar.phase !== 'week') return this.runPending();
      if (s.calendar.slots > 0) {
        const ok = await sheet({
          center: true,
          html: `<h3>Maç gününe geçilsin mi?</h3><p class="lead">Bu hafta hâlâ <b>${s.calendar.slots}</b> zaman hakkın var. Kullanılmayan haklar kaybolur.</p><div class="stack"><button class="btn primary block" data-close="go">Evet, maça geç</button><button class="btn ghost block" data-close="no">Haftaya devam</button></div>`,
        });
        if (ok !== 'go') return;
      }
      const match = getMatch(s);
      this.save();
      const my = CLUB_BY_ID[match.myId];
      const opp = CLUB_BY_ID[match.oppId];
      const home = CLUB_BY_ID[match.homeId];
      const away = CLUB_BY_ID[match.awayId];
      const myR = clubRating(s.world, match.myId);
      const oppR = clubRating(s.world, match.oppId);
      let decision;
      if (match.role === 'starter') decision = `<span class="chip accent">${icon('check')} İlk 11'desin</span><p class="lead" style="margin-top:10px">Hoca: "Bugün sana güveniyorum. Fırsat geldiğinde değerlendir."</p>`;
      else if (match.role === 'out') decision = `<span class="chip bad">${icon('bandage')} Sakatsın</span><p class="lead" style="margin-top:10px">Bu maçı tribünden izleyeceksin.</p>`;
      else decision = `<span class="chip warn">${icon('user')} Yedek kulübesi</span><p class="lead" style="margin-top:10px">${match.reason === 'tired' ? 'Hoca: "Çok yorgunsun, bugün kenardan başla."' : 'Hoca: "Sabırlı ol, gerekirse seni oyuna alacağım."'} ${match.subMinute ? '' : ''}</p>`;
      const go = await sheet({
        html: `
          <div class="center"><span class="chip">${LEAGUES[leagueOf(match.myId)].name} · Hafta ${match.week}</span></div>
          <div class="fixture" style="margin:14px 0">
            <div class="team">${crestSVG(home, 'crest lg')}<span>${esc(home.name)}</span></div>
            <span class="vs">VS</span>
            <div class="team">${crestSVG(away, 'crest lg')}<span>${esc(away.name)}</span></div>
          </div>
          <div class="card" style="display:grid;gap:8px">
            <div class="row between small"><span>${esc(my.short)} gücü</span><b>${myR}</b></div>
            <div class="bar"><i style="--c:var(--accent)" data-w="${myR}"></i></div>
            <div class="row between small"><span>${esc(opp.short)} gücü</span><b>${oppR}</b></div>
            <div class="bar"><i style="--c:var(--bad)" data-w="${oppR}"></i></div>
          </div>
          <div style="margin-top:14px">${decision}</div>
          <div class="chips"><span class="chip">${icon('bolt')} Enerji ${s.player.energy}</span><span class="chip">${icon('smile')} Moral ${s.player.morale}</span></div>
          <button class="btn primary lg block" style="margin-top:16px" data-close="go">${icon('whistle')} Maça Çık</button>
          <button class="btn ghost block" style="margin-top:8px" data-close="no">Geri</button>`,
        onMount: (n) => animateBars(n),
      });
      if (go !== 'go') return;
      this.go('match', { match: clone(match) });
    },

    async finishMatch(match) {
      const s = this.state;
      const out = completeMatch(s, match);
      this.save();
      const sm = out.summary;
      const head = { W: ['GALİBİYET', 'var(--good)'], D: ['BERABERLİK', 'var(--warn)'], L: ['MAĞLUBİYET', 'var(--bad)'] }[sm.result];
      if (sm.result === 'W') sfx('levelup');
      const statChips = Object.entries(sm.gained).map(([k, v]) => `<span class="chip accent">${STATS[k].name} +${v}</span>`).join('');
      const bonus = sm.bonusTotal ? `<span class="chip gold">Prim +${money(sm.bonusTotal)}</span>` : '';
      await sheet({
        center: true,
        dismissable: false,
        onMount: (n) => {
          if (sm.rating) countUp(n.querySelector('[data-rating]'), sm.rating, { from: 3, duration: 1100, decimals: 1 });
          if (sm.motm) setTimeout(() => confetti(), 300);
        },
        html: `
          <div class="center"><span class="chip" style="background:transparent;color:${head[1]};font-size:14px;letter-spacing:.1em">${head[0]}</span></div>
          <h3 class="center" style="margin-top:6px">${esc(sm.scoreLine)}</h3>
          ${sm.played ? `<div class="center" style="margin:14px 0 4px"><div class="muted small">Maç notun</div><div class="rating-big" data-rating style="color:${ratingColor(sm.rating)}">${sm.rating.toFixed(1)}</div></div>` : `<p class="lead center">Bu maçta forma giymedin.</p>`}
          ${sm.motm ? '<div class="center" style="margin-bottom:8px"><span class="chip gold">' + icon('star') + ' MAÇIN OYUNCUSU</span></div>' : ''}
          <div class="chips" style="justify-content:center">${sm.goals ? `<span class="chip accent">${sm.goals} gol</span>` : ''}${sm.assists ? `<span class="chip accent">${sm.assists} asist</span>` : ''}${bonus}${statChips}</div>
          <div class="divider"></div>
          ${changeChips(Object.entries(sm.deltas).filter(([, v]) => v).map(([k, v]) => ({ key: k, label: { morale: 'Moral', energy: 'Enerji', manager: 'Hoca', teammates: 'Takım', fans: 'Taraftar', fame: 'Ün' }[k], delta: v })))}
          <button class="btn primary block" style="margin-top:16px" data-close>Devam</button>`,
      });

      const we = out.weekEnd;
      const f = we.finance;
      await sheet({
        center: true,
        html: `
          <h3>Hafta ${match.week} tamamlandı</h3>
          <p class="lead">Maaşın yattı, vücudun toparlandı.</p>
          <div class="card">
            <div class="row between small"><span class="muted">Maaş</span><b style="color:var(--good)">+${money(f.income)}</b></div>
            <div class="row between small" style="margin-top:6px"><span class="muted">Yaşam gideri</span><b style="color:var(--bad)">−${money(f.living)}</b></div>
            ${f.upkeep ? `<div class="row between small" style="margin-top:6px"><span class="muted">Eşya/abonelik</span><b style="color:var(--bad)">−${money(f.upkeep)}</b></div>` : ''}
            <div class="divider" style="margin:10px 0"></div>
            <div class="row between"><span>Kasa</span><b style="color:var(--gold)">${money(s.career.money)}</b></div>
          </div>
          <div style="margin-top:10px">${changeChips(we.changes.filter((c) => c.key !== 'money'))}</div>
          <button class="btn primary block" style="margin-top:16px" data-close>Devam</button>`,
      });
      await this.runPending();
    },

    // ── Bekleyen akışlar: olay → teklifler → sezon sonu ──
    async runPending() {
      const s = this.state;
      if (!s) return this.go('title');
      if (s.pending.event) await this.eventFlow();
      if (s.pending.offers && s.pending.offers.kind === 'mid') await this.offersFlow();
      if (s.calendar.phase === 'seasonEnd') {
        endSeason(s);
        this.save();
      }
      if (s.pending.seasonReport) await this.seasonFlow(s.pending.seasonReport);
      if (s.calendar.phase === 'retired') return this.go('retired');
      if (s.pending.offers) await this.offersFlow();
      this.go('hub');
    },

    async eventFlow() {
      const s = this.state;
      const evp = s.pending.event;
      const ev = getEvent(evp.id);
      if (!ev) {
        s.pending.event = null;
        return;
      }
      sfx('swish');
      const choice = await sheet({
        center: true,
        dismissable: false,
        html: `<div class="event-art">${icon(ev.icon)}</div><h3 class="center">${esc(ev.title)}</h3><p class="lead center">${esc(evp.text)}</p><div class="stack">${ev.choices.map((c, i) => `<button class="btn block ${i === 0 ? 'primary' : ''}" data-close="${i}">${esc(c.label)}</button>`).join('')}</div>`,
      });
      const out = chooseEvent(s, Number(choice) || 0);
      this.save();
      await sheet({
        center: true,
        html: `<h3 class="center">${esc(ev.title)}</h3><p class="lead center">${esc(out?.note || '')}</p>${changeChips(out?.changes || [])}<button class="btn primary block" style="margin-top:16px" data-close>Devam</button>`,
      });
    },

    async offersFlow() {
      const s = this.state;
      const p = s.pending.offers;
      if (!p || !p.list.length) {
        s.pending.offers = null;
        return;
      }
      sfx('coin');
      const choice = await sheet({
        dismissable: false,
        html: `<h3>${p.kind === 'mid' ? 'Devre Arası Teklifler' : 'Sezon Sonu Teklifler'}</h3>
          <p class="lead">${p.mandatory ? 'Sözleşmen sona erdi. Devam etmek için bir teklifi kabul etmelisin.' : 'Menajerin masana teklifler koydu. İstersen kulübünde kalabilirsin.'}</p>
          ${p.list.map((o, i) => offerCard(s, o, i)).join('')}
          ${p.mandatory ? '' : '<button class="btn ghost block" style="margin-top:12px" data-close="decline">Tümünü reddet, kulübümde kal</button>'}`,
        onMount: (node, close) => node.addEventListener('click', (e) => {
          const b = e.target.closest('[data-offer]');
          if (b) close(`offer:${b.dataset.offer}`);
        }),
      });
      if (typeof choice === 'string' && choice.startsWith('offer:')) {
        const offer = p.list[Number(choice.split(':')[1])];
        const text = takeOffer(s, offer);
        this.save();
        const club = CLUB_BY_ID[offer.clubId];
        if (!offer.renewal) confetti();
        sfx('levelup');
        await sheet({
          center: true,
          html: `<div style="display:grid;place-items:center;margin:6px 0 10px">${crestSVG(club, 'crest lg')}</div><h3 class="center">${offer.renewal ? 'İmzalar atıldı!' : 'Yeni kulübüne hoş geldin!'}</h3><p class="lead center">${esc(text)}</p><div class="chips" style="justify-content:center"><span class="chip gold">${money(offer.wage)}/hf</span>${offer.signingBonus ? `<span class="chip gold">İmza parası ${money(offer.signingBonus)}</span>` : ''}</div><button class="btn primary block" style="margin-top:16px" data-close>Devam</button>`,
        });
      } else {
        declineOffers(s);
        this.save();
        toast('Teklifleri reddettin. Kulübünde devam!');
      }
    },

    async seasonFlow(r) {
      const s = this.state;
      const lg = LEAGUES[r.leagueId];
      const champs = Object.entries(r.champions).map(([lid, cid]) => `<div class="li">${crestSVG(CLUB_BY_ID[cid], 'crest sm')}<div class="grow"><b>${esc(CLUB_BY_ID[cid].name)}</b><div class="muted small">${LEAGUES[lid].name} şampiyonu</div></div>${icon('trophy', 'ico')}</div>`).join('');
      const ageCh = Object.entries(r.ageChanges).map(([k, v]) => `<span class="chip ${v > 0 ? 'good' : 'bad'}">${STATS[k].name} ${v > 0 ? '+' : ''}${v}</span>`).join('');
      if (r.awards.length) {
        confetti();
        sfx('goal');
      }
      const choice = await sheet({
        dismissable: false,
        html: `
          <div class="center"><span class="chip accent">SEZON ${r.season} BİTTİ</span></div>
          <h3 class="center" style="margin-top:10px">${lg.name}: ${r.position}. sıra</h3>
          <div class="kpis" style="margin-top:14px">
            <div class="kpi"><b>${r.record.apps}</b><span>Maç</span></div>
            <div class="kpi"><b>${r.record.goals}</b><span>Gol</span></div>
            <div class="kpi"><b>${r.record.assists}</b><span>Asist</span></div>
            <div class="kpi"><b>${r.record.avg ? r.record.avg.toFixed(1) : '–'}</b><span>Not</span></div>
          </div>
          ${r.awards.length ? `<div class="h-sec">Ödüllerin</div>${r.awards.map((a) => `<div class="award"><span class="tro">${icon(a.icon, 'tro')}</span><b>${esc(a.title)}</b></div>`).join('')}` : ''}
          <div class="h-sec">Şampiyonlar</div><div class="card list" style="padding:4px 12px">${champs}</div>
          <p class="muted small" style="margin-top:12px">Ligin gol kralı ${r.aiTop} golle zirvedeydi.</p>
          <div class="h-sec">Yeni sezon</div>
          <p class="lead" style="margin:0 0 8px">Artık ${r.newAge} yaşındasın.${ageCh ? ' Doğal gelişim/yaşlanma:' : ''}</p>
          <div class="chips">${ageCh}</div>
          <button class="btn primary lg block" style="margin-top:16px" data-close="next">${r.mustRetire ? 'Kariyerimi bitir' : 'Yeni sezona başla'}</button>
          ${r.canRetire && !r.mustRetire ? '<button class="btn ghost block" style="margin-top:8px" data-close="retire">Futbolu bırak (emekli ol)</button>' : ''}`,
      });
      s.pending.seasonReport = null;
      if (choice === 'retire' || r.mustRetire) {
        retire(s);
        this.save();
      } else this.save();
    },
  };

  function tabbar(active) {
    const bar = el(`<nav class="tabbar">${TABS.map((t) => `<button class="tab ${t.id === active ? 'active' : ''}" data-screen="${t.screen}">${icon(t.icon)}<span>${t.label}</span></button>`).join('')}</nav>`);
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-screen]');
      if (!b) return;
      app.click();
      app.go(b.dataset.screen, b.dataset.screen === 'league' ? { reset: true } : {});
    });
    return bar;
  }

  function retiredScreen(a) {
    const s = a.state;
    const c = s.career;
    return {
      tabs: false,
      html: `
        <div class="center" style="margin-top:20px">
          <div class="avatar-big">${playerAvatar(s)}</div>
          <h1 class="h-title" style="margin-top:14px">${esc(s.player.name)}</h1>
          <p class="muted">Futbolu ${s.player.age} yaşında bıraktı</p>
        </div>
        <div class="kpis" style="margin-top:18px">
          <div class="kpi"><b>${c.totals.apps}</b><span>Maç</span></div>
          <div class="kpi"><b>${c.totals.goals}</b><span>Gol</span></div>
          <div class="kpi"><b>${c.totals.assists}</b><span>Asist</span></div>
          <div class="kpi"><b>${c.awards.length}</b><span>Ödül</span></div>
        </div>
        <div class="h-sec">Kupa dolabı</div>
        ${c.awards.map((aw) => `<div class="award"><span class="tro">${icon(aw.icon, 'tro')}</span><div class="grow"><b>${esc(aw.title)}</b><div class="muted small">Sezon ${aw.season}</div></div></div>`).join('') || '<div class="card muted small">Kupa kazanamadın ama taraftarın kalbinde yerin var.</div>'}
        <div class="h-sec">Kariyer</div>
        <div class="card list">${c.history.map((h) => `<div class="li">${crestSVG(CLUB_BY_ID[h.clubId], 'crest sm')}<div class="grow"><b>${esc(CLUB_BY_ID[h.clubId].name)}</b><div class="muted small">Sezon ${h.season} · ${h.apps} maç · ${h.goals} gol · OVR ${h.ovr}</div></div></div>`).join('')}</div>
        <p class="center muted" style="margin-top:14px">Son OVR: ${ovr(s.player)} · Kasa: ${money(c.money)}</p>
        <button class="btn primary lg block" style="margin-top:12px" data-act="new">${icon('plus')} Yeni Kariyer</button>`,
      mount(node) {
        node.querySelector('[data-act="new"]').addEventListener('click', () => {
          clearSave();
          a.state = null;
          a.go('create');
        });
      },
    };
  }

  return app;
}
