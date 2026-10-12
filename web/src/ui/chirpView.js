// Chirp görünüm parçaları: tweet kartı, yorumlar, paylaşım kartı ve paylaşım akışı.
import { JOURNALISTS, PlayerPostService, RELATIONS, playerAuthor } from '../core/chirp/index.js';
import { chirpAvatar, icon } from './art.js';
import { esc, sheet, confetti } from './dom.js';
import { sfx, buzz } from '../audio.js';

const TOPIC_LABEL = {
  form_dip: ['Kulis', 'bad'], transfer_offer: ['Transfer', 'gold'], transfer_done: ['Transfer', 'good'], renewal: ['Sözleşme', 'good'],
  great_game: ['Dedikodu', 'accent'], injury: ['Sakatlık', 'bad'], discipline: ['Disiplin', 'bad'], award: ['Ödül', 'gold'],
  bench: ['Kulis', 'warn'], board: ['Yönetim', 'bad'], player_post: ['Paylaşım', ''],
};
const SENT = { positive: ['Olumlu', 'good'], negative: ['Olumsuz', 'bad'], neutral: ['Nötr', ''] };

/** 1234 → "1,2B", 2_400_000 → "2,4 Mn" (Türkçe sosyal medya biçimi) */
export function compact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mn`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace('.', ',')}B`;
  return String(n);
}

function authorOf(state, id) {
  if (id === 'me') return playerAuthor(state);
  return JOURNALISTS[id];
}

function formatText(text, author) {
  const safe = esc(text);
  if (author?.signature && text.startsWith(author.signature)) {
    const sig = esc(author.signature);
    return `<b class="sig sig-${author.id}">${sig}</b>${safe.slice(sig.length)}`;
  }
  return safe;
}

export function tweetCard(state, tw, { compactReplies = false } = {}) {
  const author = authorOf(state, tw.authorId);
  const [topic, tone] = TOPIC_LABEL[tw.topic] || ['Gündem', ''];
  const moodPct = Math.round(tw.fanMood * 100);
  const when = tw.season === state.calendar.season && tw.week === state.calendar.week ? 'Bu hafta' : `S${tw.season} · H${tw.week}`;
  const replies = tw.comments.map((c) => {
    const [sl, st] = SENT[c.sentiment.label];
    return `<div class="reply">
      ${chirpAvatar(c.author, 30)}
      <div class="grow">
        <div class="r-head"><b>${esc(c.author.displayName)}</b> <span class="muted">${esc(c.author.handle)}</span></div>
        <p>${esc(c.text)}</p>
        <div class="row" style="gap:8px"><span class="chip ${st} sent">${sl}</span><span class="muted small">${icon('heart', 'ico xs')} ${compact(c.likes)}</span></div>
      </div>
    </div>`;
  }).join('');
  return `<article class="tweet ${tw.authorId === 'me' ? 'mine' : ''}" data-tweet="${tw.id}">
    ${chirpAvatar(author)}
    <div class="tw-body">
      <div class="tw-head">
        <b class="ellipsis">${esc(author.displayName)}</b>
        ${author.parody ? '<span class="parody">PARODİ</span>' : ''}
        <span class="muted ellipsis">${esc(author.handle)} · ${when}</span>
      </div>
      <div class="tw-text">${formatText(tw.text, author)}</div>
      <div class="row" style="gap:6px;margin-top:8px"><span class="chip ${tone}">${topic}</span>${tw.meta?.scoreLine ? `<span class="chip">${esc(tw.meta.scoreLine)}</span>` : ''}</div>
      <div class="tw-actions">
        <button data-toggle-replies>${icon('comment', 'ico sm')} ${tw.comments.length}</button>
        <span>${icon('repost', 'ico sm')} ${compact(tw.retweets)}</span>
        <button data-like class="${tw.liked ? 'liked' : ''}">${icon(tw.liked ? 'heartFill' : 'heart', 'ico sm')} <span>${compact(tw.likes)}</span></button>
      </div>
      ${tw.comments.length ? `<div class="mood" title="Taraftar nabzı (duygu analizi)">
        <span class="muted small">Taraftar nabzı</span>
        <div class="mood-bar"><i style="width:${moodPct}%"></i></div>
        <b class="small" style="color:${moodPct >= 50 ? 'var(--good)' : 'var(--bad)'}">%${moodPct} olumlu</b>
      </div>` : ''}
      <div class="replies ${compactReplies ? 'hide' : ''}">${replies}</div>
    </div>
  </article>`;
}

/** Ana ekrandaki maç sonu paylaşım kartı. */
export function shareCard(state) {
  const p = state.chirp?.pendingPost;
  if (!p) return '';
  const svc = new PlayerPostService(state);
  const res = { W: 'Galibiyet', D: 'Beraberlik', L: 'Mağlubiyet' }[p.result];
  return `<div class="card chirp-share">
    <div class="row">
      <span class="chirp-logo">${icon('chirp')}</span>
      <div class="grow"><b>Chirp'te Paylaş</b><div class="muted small">${res} · ${esc(p.scoreLine)}${p.played && p.rating ? ` · Not ${String(p.rating.toFixed(1)).replace('.', ',')}` : ''}</div></div>
      <button class="icon-btn" style="width:34px;height:34px" data-chirp-dismiss aria-label="Paylaşma">${icon('x')}</button>
    </div>
    <div class="share-opts">
      ${svc.options().map((o) => `<button class="share-opt ${o.tone}" data-chirp-style="${o.id}">${icon(o.icon)}<b>${o.label}</b><span>${effectSummary(o.effects)}</span></button>`).join('')}
    </div>
  </div>`;
}

export function effectChips(effects) {
  return Object.entries(effects)
    .map(([k, d]) => `<span class="chip ${d > 0 ? 'good' : 'bad'}">${RELATIONS[k]?.short || k} ${d > 0 ? '+' : ''}${d}</span>`)
    .join('');
}

function effectSummary(effects) {
  return Object.entries(effects).map(([k, d]) => `${RELATIONS[k].short} ${d > 0 ? '+' : ''}${d}`).join(' · ');
}

/**
 * Paylaşım akışı: önizleme → paylaş → taraftar tepkisi.
 * @returns {Promise<boolean>} paylaşıldı mı
 */
export async function shareFlow(app, styleId) {
  const s = app.state;
  const svc = new PlayerPostService(s);
  const opt = svc.options().find((o) => o.id === styleId);
  if (!opt) return false;
  const me = playerAuthor(s);
  const risk = opt.risk ? Math.round(Math.max(0.1, Math.min(0.85, 0.25 + (50 - Math.max(0, s.player.rel.federation - 15)) / 100)) * 100) : 0;
  const ok = await sheet({
    html: `
      <h3>${esc(opt.label)} paylaşım</h3>
      <p class="lead">Bu paylaşım ilişkilerini hemen etkiler.</p>
      <article class="tweet preview">${chirpAvatar(me)}<div class="tw-body"><div class="tw-head"><b>${esc(me.displayName)}</b><span class="muted">${esc(me.handle)}</span></div><div class="tw-text">${esc(opt.text)}</div></div></article>
      <div class="chips" style="margin-top:12px">${effectChips(opt.effects)}</div>
      ${opt.risk ? `<div class="card" style="margin-top:12px;border-color:rgba(255,93,108,.4)"><b style="color:var(--bad)">${icon('shield', 'ico sm')} Ceza riski: %${risk}</b><div class="muted small" style="margin-top:4px">Federasyon açıklamayı inceleyebilir. Karar bir sonraki hafta sonunda: para cezası veya 1 maç men.</div></div>` : ''}
      <div class="stack"><button class="btn primary block" data-close="post">${icon('chirp')} Paylaş</button><button class="btn ghost block" data-close="no">Vazgeç</button></div>`,
  });
  if (ok !== 'post') return false;
  const out = svc.publish(styleId);
  app.save();
  sfx(styleId === 'aggressive' ? 'whistle' : 'swish');
  buzz(20);
  if (out.mood >= 0.75) confetti({ count: 60 });
  const moodPct = Math.round(out.mood * 100);
  const go = await sheet({
    html: `
      <h3>Paylaşıldı!</h3>
      <p class="lead">Taraftarlar tepki veriyor. Nabız: <b style="color:${moodPct >= 50 ? 'var(--good)' : 'var(--bad)'}">%${moodPct} olumlu</b></p>
      ${tweetCard(s, out.tweet)}
      <div class="chips" style="margin-top:12px">${out.changes.map((c) => `<span class="chip ${c.delta > 0 ? 'good' : 'bad'}">${esc(c.label)} ${c.delta > 0 ? '+' : ''}${c.delta}</span>`).join('')}</div>
      <div class="stack"><button class="btn primary block" data-close="chirp">${icon('chirp')} Chirp'e git</button><button class="btn ghost block" data-close="ok">Tamam</button></div>`,
  });
  return go === 'chirp' ? 'chirp' : true;
}

/** Tweet kartlarındaki beğeni ve yorum aç/kapa düğmelerini bağlar. */
export function bindTweetActions(app, scope) {
  scope.addEventListener('click', (e) => {
    const card = e.target.closest('[data-tweet]');
    if (!card) return;
    const id = card.dataset.tweet;
    if (e.target.closest('[data-like]')) {
      const btn = e.target.closest('[data-like]');
      const tl = app.state.chirp.timeline.find((t) => t.id === id);
      if (!tl) return;
      tl.liked = !tl.liked;
      tl.likes += tl.liked ? 1 : -1;
      btn.classList.toggle('liked', tl.liked);
      btn.innerHTML = `${icon(tl.liked ? 'heartFill' : 'heart', 'ico sm')} <span>${compact(tl.likes)}</span>`;
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
      if (tl.liked) sfx('tick');
      app.save();
    } else if (e.target.closest('[data-toggle-replies]')) {
      card.querySelector('.replies')?.classList.toggle('hide');
    }
  });
}
