import { FABRICIO, MAGAZIN, YAGIZ, playerAuthor, timelineOf } from '../../core/chirp/index.js';
import { paintPhotos } from '../tabloidView.js';
import { chirpAvatar, icon } from '../art.js';
import { esc } from '../dom.js';
import { bindTweetActions, compact, shareCard, shareFlow, tweetCard } from '../chirpView.js';

const FILTERS = [
  { id: 'all', label: 'Akış', fn: null },
  { id: 'press', label: 'Gazeteciler', fn: (t) => t.authorId !== 'me' && t.authorId !== 'magazin' },
  { id: 'gossip', label: 'Magazin', fn: (t) => t.authorId === 'magazin' },
  { id: 'me', label: 'Paylaşımlarım', fn: (t) => t.authorId === 'me' },
];

export function chirpScreen(app) {
  const s = app.state;
  const tl = timelineOf(s);
  const view = (app.chirpView ||= { filter: 'all' });
  const f = FILTERS.find((x) => x.id === view.filter) || FILTERS[0];
  const tweets = tl.list(f.fn);
  tl.markRead();
  app.save();
  const me = playerAuthor(s);

  const empty = `<div class="card center" style="padding:28px 18px">
    <div class="event-art">${icon('chirp')}</div>
    <b>Zaman tünelin henüz sessiz</b>
    <p class="muted small" style="margin:6px 0 0">Maç oynadıkça Fabricio Romana ve Yağız Sapanca senin hakkında yazmaya başlayacak. Maç sonrası kendin de paylaşabilirsin.</p>
  </div>`;

  return {
    tabs: 'chirp',
    html: `
      <div class="row between">
        <div class="row" style="gap:10px"><span class="chirp-logo lg">${icon('chirp')}</span><h1 class="h-title">Chirp</h1></div>
        <div class="row" style="gap:8px">${chirpAvatar(me, 34)}<div class="col" style="gap:0"><b class="small">${compact(s.chirp.followers)}</b><span class="muted" style="font-size:10.5px">takipçi</span></div></div>
      </div>
      <div class="press-row">
        ${[FABRICIO, YAGIZ, MAGAZIN].map((a) => `<div class="press">${chirpAvatar(a, 38)}<div class="grow" style="min-width:0"><b class="small ellipsis">${esc(a.displayName)}</b><div class="muted ellipsis" style="font-size:11px">${esc(a.signature)} · ${compact(a.followers)}</div></div></div>`).join('')}
      </div>
      ${shareCard(s)}
      <div class="seg" style="margin:12px 0">
        ${FILTERS.map((x) => `<button class="${x.id === view.filter ? 'on' : ''}" data-filter="${x.id}">${x.label}</button>`).join('')}
      </div>
      <div class="feed-tweets">${tweets.length ? tweets.map((t) => tweetCard(s, t)).join('') : empty}</div>`,
    mount(el) {
      bindTweetActions(app, el);
      paintPhotos(el, s);
      el.addEventListener('click', async (e) => {
        const fb = e.target.closest('[data-filter]');
        if (fb) {
          app.click();
          view.filter = fb.dataset.filter;
          app.go('chirp');
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
