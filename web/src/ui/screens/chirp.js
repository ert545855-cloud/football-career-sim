// CHIRP EKRANI — akış, keşfet (gündem + #etiket sayfaları), takımım, gazeteciler, magazin, ben.
import { CLUB_BY_ID, COUNTRY_BY_ID } from '../../core/data.js';
import { playerAuthor, timelineOf } from '../../core/chirp/index.js';
import { chirpAvatar, icon } from '../art.js';
import { esc } from '../dom.js';
import { bindTweetActions, compact, composeFlow, ephemeralPosts, shareCard, shareFlow, tweetCard } from '../chirpView.js';

const PRESS = new Set(['fabricio', 'yagiz', 'matteo', 'tertulia', 'footy', 'sermet', 'hakem', 'veri', 'deger', 'dunya', 'avrupa', 'milli', 'caps']);

function filters(state) {
  const myClub = state.career.clubId;
  return [
    { id: 'all', label: 'Akış', fn: null },
    { id: 'explore', label: 'Keşfet', fn: null },
    { id: 'team', label: 'Takımım', fn: (t) => t.authorId === `club:${myClub}` || t.authorId === `fans:${myClub}` || t.authorId === 'gardiyan' },
    { id: 'press', label: 'Gazeteciler', fn: (t) => PRESS.has(t.authorId) },
    { id: 'gossip', label: 'Magazin', fn: (t) => t.authorId === 'magazin' },
    { id: 'me', label: 'Ben', fn: (t) => t.authorId === 'me' || (t.comments || []).some((c) => c.me) },
  ];
}

const PAGE = 25;

export function chirpScreen(app, params = {}) {
  const s = app.state;
  const tl = timelineOf(s);
  const view = (app.chirpView ||= { filter: 'all', tag: null, limit: PAGE });
  if (params.tag !== undefined) {
    view.tag = params.tag;
    view.filter = 'explore';
  }
  const FILTERS = filters(s);
  const f = FILTERS.find((x) => x.id === view.filter) || FILTERS[0];
  tl.markRead();
  app.save();
  const me = playerAuthor(s);
  const trends = s.chirp.trends || [];

  let body;
  if (view.filter === 'explore' && view.tag) {
    // #etiket sayfası: zaman tünelindeki gönderiler + o etiketle yazan kullanıcılar
    const tag = view.tag;
    const lower = tag.toLocaleLowerCase('tr');
    const own = tl.list((t) => (t.tags || []).some((x) => x.toLocaleLowerCase('tr') === lower) || t.text.toLocaleLowerCase('tr').includes(lower));
    const trend = trends.find((t) => t.tag === tag);
    const eph = ephemeralPosts(s, tag, 6);
    body = `
      <div class="tag-head">
        <button class="icon-btn" data-back-tag aria-label="Geri">${icon('back')}</button>
        <div class="grow" style="min-width:0"><b class="ellipsis" style="font-size:20px;display:block">${esc(tag)}</b><span class="muted small">${trend ? `${compact(trend.count)} gönderi · gündemde` : 'Gündemde değil'}</span></div>
        <button class="btn sm primary" data-post-tag="${esc(tag)}">${icon('plus', 'ico sm')} Paylaş</button>
      </div>
      <div class="feed-tweets">${own.map((t) => tweetCard(s, t)).join('')}${eph.map((t) => tweetCard(s, t, { eph: true })).join('')}</div>`;
  } else if (view.filter === 'explore') {
    const popular = tl.list().filter((t) => t.authorId !== 'me').sort((a, b) => b.likes - a.likes).slice(0, 6);
    body = `
      <div class="h-sec">${esc(COUNTRY_BY_ID[s.player.nationality || 'tr']?.name || 'Türkiye')} gündemi <span>Hafta ${s.calendar.week}</span></div>
      <div class="card trends">${trends.length ? trends.map((t, i) => `<button class="trend" data-tag="${esc(t.tag)}">
          <span class="muted small">${i + 1} · ${t.kind === 'me' ? 'Senin hakkında' : t.kind === 'mine' ? 'Senin başlattığın' : t.kind === 'match' ? 'Maç' : t.kind === 'world' ? 'Avrupa' : 'Futbol · Gündem'}</span>
          <b>${esc(t.tag)}</b><span class="muted small">${compact(t.count)} gönderi</span></button>`).join('') : '<p class="muted small" style="margin:0">Gündem oluşuyor… Maç oynadıkça burası dolacak.</p>'}</div>
      <div class="h-sec">Popüler gönderiler</div>
      <div class="feed-tweets">${popular.map((t) => tweetCard(s, t)).join('')}</div>`;
  } else {
    const tweets = tl.list(f.fn);
    const shown = tweets.slice(0, view.limit);
    const empty = `<div class="card center" style="padding:28px 18px">
      <div class="event-art">${icon('chirp')}</div>
      <b>Burası henüz sessiz</b>
      <p class="muted small" style="margin:6px 0 0">Maç oynadıkça kulübün, taraftarlar, gazeteciler ve yorumcular yazmaya başlayacak. Sen de paylaşabilirsin.</p>
    </div>`;
    body = `<div class="feed-tweets">${shown.length ? shown.map((t) => tweetCard(s, t)).join('') : empty}</div>
      ${tweets.length > shown.length ? `<button class="btn ghost block" style="margin-top:10px" data-more-feed>Daha fazla göster (${tweets.length - shown.length})</button>` : ''}`;
  }

  return {
    tabs: 'chirp',
    html: `
      <div class="row between">
        <div class="row" style="gap:10px"><span class="chirp-logo lg">${icon('chirp')}</span><h1 class="h-title">Chirp</h1></div>
        <div class="row" style="gap:8px">${chirpAvatar(me, 34)}<div class="col" style="gap:0"><b class="small">${compact(s.chirp.followers)}</b><span class="muted" style="font-size:10.5px">takipçi</span></div></div>
      </div>
      <button class="compose-bar" data-compose>${chirpAvatar(me, 32)}<span class="grow">Ne düşünüyorsun, ${esc(s.player.name.split(' ')[0])}?</span>${icon('plus', 'ico sm')}</button>
      ${view.filter === 'all' ? `${trends.length ? `<div class="trend-strip">${trends.slice(0, 5).map((t) => `<button data-tag="${esc(t.tag)}">${esc(t.tag)}</button>`).join('')}</div>` : ''}` : ''}
      ${view.filter === 'all' ? shareCard(s) : ''}
      <div class="seg chirp-tabs" style="margin:12px 0">
        ${FILTERS.map((x) => `<button class="${x.id === view.filter ? 'on' : ''}" data-filter="${x.id}">${x.label}</button>`).join('')}
      </div>
      ${body}`,
    mount(el) {
      const rerender = () => app.go('chirp');
      bindTweetActions(app, el, {
        onTag: (tag) => {
          view.tag = tag;
          view.filter = 'explore';
          app.go('chirp');
          el.closest('main')?.scrollTo?.(0, 0);
        },
        onChange: rerender,
      });
      el.addEventListener('click', async (e) => {
        const fb = e.target.closest('[data-filter]');
        if (fb) {
          app.click();
          view.filter = fb.dataset.filter;
          view.tag = null;
          view.limit = PAGE;
          app.go('chirp');
          return;
        }
        if (e.target.closest('[data-back-tag]')) {
          app.click();
          view.tag = null;
          app.go('chirp');
          return;
        }
        if (e.target.closest('[data-more-feed]')) {
          app.click();
          view.limit += PAGE;
          app.go('chirp');
          return;
        }
        const pt = e.target.closest('[data-post-tag]');
        if (pt || e.target.closest('[data-compose]')) {
          app.click();
          if (await composeFlow(app, { text: pt ? `${pt.dataset.postTag} ` : '' })) {
            if (!pt) view.filter = 'me';
            app.go('chirp');
          }
          return;
        }
        const st = e.target.closest('[data-chirp-style]');
        if (st) {
          app.click();
          await shareFlow(app, st.dataset.chirpStyle);
          app.go('chirp');
          return;
        }
        if (e.target.closest('[data-chirp-dismiss]')) {
          app.state.chirp.pendingPost = null;
          app.save();
          app.go('chirp');
        }
      });
    },
  };
}

export { CLUB_BY_ID };
