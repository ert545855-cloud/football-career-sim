// Chirp görünüm parçaları: gönderi kartı (görselli kartlar, #etiketler, yanıtlar), paylaşım kartı,
// serbest gönderi yazma, yanıtlama, keşfet için anlık (kaydedilmeyen) gönderiler.
import { allTurkish, localizeText, showComment } from '../core/chirp/lang.js';
import { attitudeBar } from './attitudeView.js';
import { attitudeOf } from '../core/attitude.js';
import { CLUB_BY_ID } from '../core/data.js';
import { JOURNALISTS, PERSONAS, PlayerPostService, RELATIONS, Timeline, TweetModel, playerAuthor } from '../core/chirp/index.js';
import { FOREIGN_POSTS, USER_POSTS } from '../core/chirp/content.js';
import { randomUser } from '../core/chirp/personas.js';
import { fillTemplate } from '../core/chirp/turkish.js';
import { hashStr, seededRng } from '../core/world/generate.js';
import { MentorManager } from '../core/mentor/index.js';
import { avatarSVG, chirpAvatar, crestSVG, icon } from './art.js';
import { confetti, esc, sheet, toast } from './dom.js';
import { chirpCardHTML } from './chirpCards.js';
import { paintPhotos } from './tabloidView.js';
import { buzz, sfx } from '../audio.js';

/** 1234 → "1,2B", 2_400_000 → "2,4 Mn" (Türkçe sosyal medya biçimi) */
export function compact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mn`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace('.', ',')}B`;
  return String(n);
}

/** Gönderinin yazarı: oyuncu, sabit kişiler ya da gönderide saklı anlık görüntü (kulüp, taraftar, kullanıcı) */
export function authorOf(state, tw) {
  if (tw.authorId === 'me') return playerAuthor(state);
  if (tw.author) return tw.author;
  return JOURNALISTS[tw.authorId] || PERSONAS[tw.authorId] || { displayName: tw.authorId, handle: '', avatar: { color: '#475569', initials: '?' } };
}

/** Metin: imza vurgusu + tıklanabilir #etiketler ve @bahsetmeler */
function formatText(text, author) {
  let safe = esc(text);
  if (author?.signature && text.startsWith(author.signature)) {
    const sig = esc(author.signature);
    safe = `<b class="sig sig-${author.id}">${sig}</b>${safe.slice(sig.length)}`;
  }
  return safe
    // &#39; gibi HTML varlıkları etiket sanılmasın
    .replace(/(^|[^&\p{L}\p{N}_])(#[\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu, '$1<button class="tag" data-tag="$2">$2</button>')
    .replace(/(^|\s)(@[\w.]+)/g, '$1<span class="mention">$2</span>')
    .replace(/\n/g, '<br>');
}

function replyHTML(c) {
  return `<div class="reply ${c.me ? 'me' : ''}">
    ${chirpAvatar(c.author, 30)}
    <div class="grow">
      <div class="r-head"><b>${esc(c.author.displayName)}</b> <span class="muted">${esc(c.author.handle || '')}</span>${c.me ? ' <span class="chip xs" style="--c:var(--accent)">Sen</span>' : ''}</div>
      <p>${formatText(c.text, null)}</p>
      <div class="row" style="gap:8px"><button class="c-like ${c.liked ? 'liked' : ''}" data-clike="${esc(c.id)}" aria-label="Yorumu beğen">${icon(c.liked ? 'heartFill' : 'heart', 'ico xs')} <span>${compact(c.likes)}</span></button></div>
    </div>
  </div>`;
}

/**
 * Gönderi kartı.
 * @param {any} state
 * @param {any} tw TweetModel ya da düz nesne
 * @param {{compactReplies?:boolean, eph?:boolean}} [opts] eph: keşfet için anlık (kaydedilmeyen) gönderi
 */
export function tweetCard(state, tw, { compactReplies = true, eph = false } = {}) {
  const author = authorOf(state, tw);
  const when = tw.season === state.calendar.season && tw.week === state.calendar.week ? 'Bu hafta' : `S${tw.season} · H${tw.week}`;
  const comments = (tw.comments || []).filter(showComment);
  const shown = compactReplies ? comments.slice(0, 2) : comments;
  const photo = tw.meta?.photo ? `<div class="tw-photo"><canvas data-photo="${esc(JSON.stringify(tw.meta.photo))}"></canvas><span class="tb-stamp sm">ÖZEL</span></div>` : '';
  return `<article class="tweet ${tw.authorId === 'me' ? 'mine' : ''} ${author.kind === 'club' ? 'official' : ''}" ${eph ? 'data-eph' : `data-tweet="${tw.id}"`}>
    ${chirpAvatar(author)}
    <div class="tw-body">
      <div class="tw-head">
        <b class="ellipsis">${esc(author.displayName)}</b>
        ${author.verified ? `<span class="verified" title="Resmi hesap">${icon('check', 'ico xs')}</span>` : ''}
        ${author.parody ? '<span class="parody">PARODİ</span>' : ''}
        <span class="muted ellipsis">${esc(author.handle || '')} · ${when}</span>
      </div>
      <div class="tw-text">${formatText(localizeText(tw.text), author)}</div>
      ${tw.card ? `<div class="tw-card">${chirpCardHTML(tw.card, state)}</div>` : ''}
      ${photo}
      ${tw.meta?.scoreLine ? `<div class="chips" style="margin-top:8px"><span class="chip">${esc(tw.meta.scoreLine)}</span></div>` : ''}
      <div class="tw-actions">
        <button data-reply>${icon('comment', 'ico sm')} ${compact(comments.length)}</button>
        <button data-repost class="${tw.reposted ? 'reposted' : ''}">${icon('repost', 'ico sm')} <span>${compact(tw.retweets || 0)}</span></button>
        <button data-like class="${tw.liked ? 'liked' : ''}">${icon(tw.liked ? 'heartFill' : 'heart', 'ico sm')} <span>${compact(tw.likes)}</span></button>
      </div>
      ${shown.length ? `<div class="replies">${shown.map(replyHTML).join('')}${comments.length > shown.length ? `<button class="more-replies" data-more>${comments.length - shown.length} yorum daha</button>` : ''}</div>` : ''}
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

const changeChipsHTML = (changes) => (changes || []).map((c) => `<span class="chip ${c.delta > 0 ? 'good' : 'bad'}">${esc(c.label)} ${c.delta > 0 ? '+' : ''}${c.delta}</span>`).join('');

/**
 * Paylaşım akışı: önizleme → paylaş → taraftar tepkisi.
 * @returns {Promise<boolean|'chirp'>} paylaşıldı mı
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
  const go = await sheet({
    html: `
      <h3>Paylaşıldı!</h3>
      <p class="lead">Taraftarlar yorumlara akın etti 👇</p>
      ${tweetCard(s, out.tweet, { compactReplies: false })}
      <div class="chips" style="margin-top:12px">${changeChipsHTML(out.changes)}</div>
      ${out.attShift ? `<div style="margin-top:12px">${attitudeBar(attitudeOf(s), { delta: out.attShift })}</div>` : ''}
      <div class="stack"><button class="btn primary block" data-close="chirp">${icon('chirp')} Chirp'e git</button><button class="btn ghost block" data-close="ok">Tamam</button></div>`,
  });
  return go === 'chirp' ? 'chirp' : true;
}

// ─────────────────────────── Yazma ve yanıtlama ───────────────────────────

function squadNames(state) {
  try {
    return new MentorManager(state).squad().map((p) => p.name);
  } catch {
    return [];
  }
}

const EMOJIS = ['🔥', '💪', '😂', '👑', '⚽', '🙏', '❤️', '😤', '🤝', '📣'];

/**
 * Serbest gönderi yazma sayfası.
 * @param {any} app
 * @param {{text?:string}} [opts]
 * @returns {Promise<boolean>}
 */
export async function composeFlow(app, opts = {}) {
  const s = app.state;
  const me = playerAuthor(s);
  const trends = (s.chirp.trends || []).slice(0, 6).map((t) => t.tag);
  const mates = squadNames(s).slice(0, 4);
  const club = CLUB_BY_ID[s.career.clubId];
  const ideas = [
    'Taraftarımıza teşekkürler, sesiniz bize güç veriyor 🙏 #TribündeyizBuGece',
    `Haftaya ${club.short} için sahadayız! 💪`,
    mates[0] ? `${mates[0]} bu sezon ilk 11'de olmalı, çalışkanlığını herkes görüyor 👏` : 'Bu sezon büyük işler yapacağız 🔥',
    'Hakem kararları yine konuşulur… VAR nerede? 🤔 #VARNerede',
    'Frikik çalışmaya devam 🎯 Sermet Hoca izliyorsa selamlar 😂 #BursaFrikiği',
  ];
  const text = await sheet({
    html: `
      <div class="row" style="gap:10px">${chirpAvatar(me, 40)}<div class="grow"><b>${esc(me.displayName)}</b><div class="muted small">${esc(me.handle)} · ${compact(s.chirp.followers)} takipçi</div></div></div>
      <textarea class="compose" maxlength="280" placeholder="Ne düşünüyorsun? #etiket ekle, @arkadaşını an…" data-text>${esc(opts.text || '')}</textarea>
      <div class="row between small"><span class="muted">Etiketli gönderiler gündeme oturabilir. Hakeme/federasyona yüklenmek ceza riski taşır.</span><b data-count>0/280</b></div>
      ${trends.length ? `<div class="muted small" style="margin-top:10px">Gündem</div><div class="chips compose-chips">${trends.map((t) => `<button class="chip" data-ins="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
      ${mates.length ? `<div class="muted small" style="margin-top:8px">Takım arkadaşların</div><div class="chips compose-chips">${mates.map((m) => `<button class="chip" data-ins="@${esc(m.replace(/\s+/g, ''))}">@${esc(m)}</button>`).join('')}</div>` : ''}
      <div class="chips compose-chips" style="margin-top:8px">${EMOJIS.map((e) => `<button class="chip" data-ins="${e}">${e}</button>`).join('')}</div>
      <div class="muted small" style="margin-top:10px">Fikir mi lazım?</div>
      <div class="stack" style="margin-top:6px">${ideas.map((t) => `<button class="btn sm ghost block idea" data-idea="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="stack"><button class="btn primary block" data-post>${icon('chirp')} Paylaş</button><button class="btn ghost block" data-close="">Vazgeç</button></div>`,
    onMount: (node, close) => {
      const ta = node.querySelector('[data-text]');
      const cnt = node.querySelector('[data-count]');
      const upd = () => (cnt.textContent = `${ta.value.length}/280`);
      upd();
      ta.addEventListener('input', upd);
      node.addEventListener('click', (e) => {
        const ins = e.target.closest('[data-ins]');
        if (ins) {
          ta.value = `${ta.value}${ta.value && !/\s$/.test(ta.value) ? ' ' : ''}${ins.dataset.ins} `.slice(0, 280);
          upd();
          ta.focus();
        }
        const idea = e.target.closest('[data-idea]');
        if (idea) {
          ta.value = idea.dataset.idea;
          upd();
        }
        if (e.target.closest('[data-post]')) {
          if (!ta.value.trim()) return toast('Önce bir şeyler yaz.', 'bad');
          close(ta.value);
        }
      });
      setTimeout(() => ta.focus(), 250);
    },
  });
  if (typeof text !== 'string' || !text.trim()) return false;
  const out = new PlayerPostService(s).publishText(text);
  if (!out) return false;
  app.save();
  sfx(out.tweet.meta.style === 'aggr' ? 'whistle' : 'swish');
  buzz(out.trending ? 'celebrate' : 'tap');
  if (out.trending) {
    confetti({ count: 70 });
    toast(`${out.trending} Türkiye'de gündem oldu! 🔥`, 'good');
  }
  await sheet({
    html: `
      <h3>${out.trending ? 'Gündemdesin! 🔥' : 'Paylaşıldı!'}</h3>
      <p class="lead">${out.spam ? 'Bu hafta çok paylaşım yaptın; bazı takipçiler sıkıldı.' : 'Yorumlar gelmeye başladı 👇'}</p>
      ${tweetCard(s, out.tweet, { compactReplies: false })}
      <div class="chips" style="margin-top:12px">${changeChipsHTML(out.changes)}${out.trending ? `<span class="chip gold">${esc(out.trending)} TT</span>` : ''}</div>
      ${out.discipline ? `<div class="card" style="margin-top:12px;border-color:rgba(255,93,108,.4)"><b style="color:var(--bad)">${icon('shield', 'ico sm')} Federasyon gönderini inceliyor</b><div class="muted small" style="margin-top:4px">Hafta sonunda para cezası ya da men cezası gelebilir.</div></div>` : ''}
      <button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>`,
  });
  return true;
}

/**
 * Yanıt yazma ("şu oyuncu ilk 11'de olmalı" kısayollarıyla).
 * @returns {Promise<boolean>}
 */
export async function replyFlow(app, tweetId) {
  const s = app.state;
  const raw = s.chirp.timeline.find((t) => t.id === tweetId);
  if (!raw) return false;
  const tw = TweetModel.from(raw);
  const author = authorOf(s, tw);
  const mates = squadNames(s).slice(0, 5);
  const kind = tw.card?.kind;
  const quick = [
    ...(kind === 'injury' ? [`Geçmiş olsun kardeşim, çabuk dön 🙏`] : []),
    ...(kind === 'welcome' ? ['Hoş geldin kardeşim 🤝', 'Birlikte büyük işler yapacağız 🔥'] : []),
    ...(kind === 'preview' || kind === 'result' || author.kind === 'fans' ? mates.slice(0, 3).map((m) => `${m} ilk 11'de olmalı`) : []),
    ...(author.kind === 'fans' && /hak etmiyor|yürü|rezalet|kadro dışı/i.test(tw.text) ? ['Haklısınız, daha çok çalışacağım 🙏', 'Eleştiriyi kabul ediyorum ama hakaret etmeyin'] : []),
    ...(author.id === 'sermet' ? ['Hocam o frikiği bir gün bana da öğret 😂', 'Bursa frikiği efsane hocam 🎯'] : []),
    'Taraftarımıza teşekkürler 🙏',
    'Hocam bana güven 💪',
    '😂😂😂',
    'Hakem maçı katletti',
  ];
  const text = await sheet({
    html: `
      <div class="muted small">Yanıtlanan: <b>${esc(author.displayName)}</b></div>
      <div class="quote">${esc(tw.text.slice(0, 160))}${tw.text.length > 160 ? '…' : ''}</div>
      <textarea class="compose" maxlength="240" placeholder="Yanıtını yaz…" data-text></textarea>
      <div class="chips compose-chips">${quick.slice(0, 8).map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="stack"><button class="btn primary block" data-send>${icon('reply', 'ico sm')} Yanıtla</button><button class="btn ghost block" data-close="">Vazgeç</button></div>`,
    onMount: (node, close) => {
      const ta = node.querySelector('[data-text]');
      node.addEventListener('click', (e) => {
        const q = e.target.closest('[data-q]');
        if (q) ta.value = q.dataset.q;
        if (e.target.closest('[data-send]')) {
          if (!ta.value.trim()) return toast('Yanıt boş olamaz.', 'bad');
          close(ta.value);
        }
      });
      setTimeout(() => ta.focus(), 250);
    },
  });
  if (typeof text !== 'string' || !text.trim()) return false;
  const out = new PlayerPostService(s).reply(tweetId, text);
  if (!out) return false;
  app.save();
  sfx('swish');
  buzz('tap');
  if (out.changes.length) toast(out.changes.map((c) => `${c.label} ${c.delta > 0 ? '+' : ''}${c.delta}`).join(' · '), out.changes.some((c) => c.delta < 0) ? 'bad' : 'good');
  return true;
}

// ─────────────────────────── Keşfet: anlık gönderiler ───────────────────────────

/**
 * Bir etiket için anlık (kayda yazılmayan) kullanıcı gönderileri. Aynı hafta aynı etiket aynı akışı verir.
 * @returns {Array<object>} tweet benzeri nesneler
 */
export function ephemeralPosts(state, tag, n = 6) {
  const rnd = seededRng(hashStr(`${tag}-${state.calendar.season}-${state.calendar.week}`));
  const club = CLUB_BY_ID[state.career.clubId];
  const mates = squadNames(state);
  const vars = { player: state.player.name, first: state.player.name.split(' ')[0], club: club.name, clubShort: club.short, league: '', tag, mate: mates[0] || 'yedek kaleci' };
  const out = [];
  for (let i = 0; i < n; i++) {
    const foreign = !allTurkish() && rnd() < Math.min(0.4, (state.player.fame || 0) / 150);
    const langs = Object.keys(FOREIGN_POSTS);
    const lang = foreign ? langs[Math.floor(rnd() * langs.length)] : 'tr';
    const pool = foreign ? FOREIGN_POSTS[lang] : USER_POSTS;
    const tpl = pool[Math.floor(rnd() * pool.length)];
    const author = randomUser(rnd, lang, club.short);
    const text = fillTemplate(tpl.includes('{tag}') ? tpl : `${tpl} {tag}`, { ...vars, mate: mates[Math.floor(rnd() * Math.max(1, mates.length))] || vars.mate });
    out.push({
      id: `x${i}`, authorId: `u:${author.handle}`, author: { ...author, kind: 'user' }, text, season: state.calendar.season, week: state.calendar.week,
      likes: Math.round(rnd() * 900 * (1 + (state.player.fame || 0) / 40)), retweets: Math.round(rnd() * 120), comments: [], meta: {},
    });
  }
  return out;
}

/** Gönderi kartlarındaki beğen, yanıtla, paylaş, etiket ve "daha fazla yorum" düğmelerini bağlar. */
export function bindTweetActions(app, scope, { onTag, onChange } = {}) {
  paintPhotos(scope, app.state);
  scope.addEventListener('click', async (e) => {
    const tag = e.target.closest('[data-tag]');
    if (tag) {
      e.stopPropagation();
      app.click();
      onTag?.(tag.dataset.tag);
      return;
    }
    const card = e.target.closest('[data-tweet],[data-eph]');
    if (!card) return;
    const eph = card.hasAttribute('data-eph');
    const id = card.dataset.tweet;
    const tl = eph ? null : app.state.chirp.timeline.find((t) => t.id === id);
    const cl = e.target.closest('[data-clike]');
    if (cl) {
      // yorum beğenisi
      let r = null;
      if (tl) {
        r = new Timeline(app.state).toggleCommentLike(id, cl.dataset.clike);
        app.save();
      }
      const liked = r ? r.liked : !cl.classList.contains('liked');
      const n = r ? r.likes : Math.max(0, Number(cl.querySelector('span')?.textContent?.replace(/\D/g, '') || 0) + (liked ? 1 : -1));
      cl.classList.toggle('liked', liked);
      cl.innerHTML = `${icon(liked ? 'heartFill' : 'heart', 'ico xs')} <span>${compact(n)}</span>`;
      cl.classList.remove('pop');
      void cl.offsetWidth;
      cl.classList.add('pop');
      if (liked) {
        sfx('tick');
        buzz('tap');
      }
      if (r?.thanks) {
        toast(`${r.thanks.author.displayName}: "${r.thanks.text}"`);
        onChange?.();
      }
      return;
    }
    if (e.target.closest('[data-like]')) {
      const btn = e.target.closest('[data-like]');
      const span = btn.querySelector('span');
      const liked = !btn.classList.contains('liked');
      btn.classList.toggle('liked', liked);
      const n = (tl ? tl.likes : Number(btn.dataset.n || span?.textContent?.replace(/\D/g, '') || 0)) + (liked ? 1 : -1);
      if (tl) {
        tl.liked = liked;
        tl.likes = n;
        app.save();
      }
      btn.innerHTML = `${icon(liked ? 'heartFill' : 'heart', 'ico sm')} <span>${compact(Math.max(0, n))}</span>`;
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
      if (liked) {
        sfx('tick');
        buzz('tap');
      }
    } else if (e.target.closest('[data-repost]')) {
      const btn = e.target.closest('[data-repost]');
      const on = !btn.classList.contains('reposted');
      btn.classList.toggle('reposted', on);
      if (tl) {
        tl.reposted = on;
        tl.retweets = (tl.retweets || 0) + (on ? 1 : -1);
        app.save();
        btn.innerHTML = `${icon('repost', 'ico sm')} <span>${compact(tl.retweets)}</span>`;
      }
      if (on) toast('Profilinde paylaştın 🔁');
    } else if (e.target.closest('[data-reply]')) {
      if (eph) return toast('Bu gönderiye yanıt veremezsin.', 'bad');
      app.click();
      if (await replyFlow(app, id)) onChange?.();
    } else if (e.target.closest('[data-more]')) {
      if (!tl) return;
      const tw = TweetModel.from(tl);
      card.outerHTML = tweetCard(app.state, tw, { compactReplies: false });
    }
  });
}

/** Avatar ve kart için küçük yardımcılar (başka ekranlar) */
export { avatarSVG, crestSVG };
