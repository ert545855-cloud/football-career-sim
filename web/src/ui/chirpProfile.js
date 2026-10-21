// CHIRP PROFİLİ — "Ben" sekmesi: takipçi, popülerlik (kariyer yükselişinin bileşenleri), fotoğraflar ve maç kareleri.
import {
  FOLLOWER_MILESTONES, deleteFrame, followerTarget, frameLabel, galleryOf, isVerified, milestoneLabel, playerAuthor, popularityOf, riseFactors,
} from '../core/chirp/index.js';
import { chirpAvatar, icon } from './art.js';
import { esc, sheet, toast } from './dom.js';
import { paintPics, picHTML } from './photoArt.js';

const compactN = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace('.', ',')} Mn`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace('.', ',')}B`;
  return String(Math.round(n));
};

/** Takipçi geçmişi çizgisi (SVG) */
function sparkline(hist) {
  const pts = hist.slice(-40);
  if (pts.length < 2) return '<p class="muted small" style="margin:8px 0 0">Grafik için en az iki hafta gerekiyor.</p>';
  const W = 300;
  const H = 64;
  const vals = pts.map((p) => Math.log10(Math.max(10, p.f)));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = Math.max(0.05, hi - lo);
  const xy = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - 6 - ((v - lo) / span) * (H - 14)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `<svg class="fol-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Takipçi grafiği">
    <path d="${d} L${W} ${H} L0 ${H} Z" fill="rgba(56,189,248,.14)"/>
    <path d="${d}" fill="none" stroke="#38bdf8" stroke-width="2" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

/** Profil üst kısmı (Ben sekmesi) */
export function profileHTML(s) {
  const ch = s.chirp;
  const me = playerAuthor(s);
  const f = ch.followers || 0;
  const mine = (ch.timeline || []).filter((t) => t.authorId === 'me');
  const likes = mine.reduce((n, t) => n + (t.likes || 0), 0);
  const hist = ch.followerHistory || [];
  const prev = hist.length >= 2 ? hist[hist.length - 2].f : null;
  const delta = prev != null ? f - prev : 0;
  const target = followerTarget(s);
  const next = FOLLOWER_MILESTONES.find((m) => m > f);
  const lastM = [...FOLLOWER_MILESTONES].reverse().find((m) => m <= f) || 0;
  const prog = next ? Math.round(((Math.log10(Math.max(1, f)) - Math.log10(Math.max(1, lastM || 100))) / (Math.log10(next) - Math.log10(Math.max(1, lastM || 100)))) * 100) : 100;
  const pop = popularityOf(f);
  const factors = riseFactors(s);
  const photos = mine.filter((t) => t.meta?.pic).slice(0, 6);
  const gallery = galleryOf(s);
  return `
    <div class="card chirp-profile">
      <div class="cp-head">${chirpAvatar(me, 56)}
        <div class="grow" style="min-width:0">
          <b style="font-size:17px" class="ellipsis">${esc(me.displayName)} ${isVerified(s) ? `<span class="verified me" title="Onaylı hesap">${icon('check', 'ico xs')}</span>` : ''}</b>
          <div class="muted small ellipsis">${esc(me.handle)}</div>
          <span class="chip ${pop >= 70 ? 'gold' : pop >= 45 ? 'accent' : ''}" style="margin-top:6px">${icon('fire', 'ico xs')} Popülerlik ${pop}/100</span>
        </div>
      </div>
      <div class="cp-stats">
        <div><b>${compactN(f)}</b><span>takipçi</span></div>
        <div><b>${compactN(mine.length)}</b><span>gönderi</span></div>
        <div><b>${compactN(likes)}</b><span>beğeni</span></div>
      </div>
    </div>

    <div class="h-sec">Takipçi <span>${delta ? `${delta > 0 ? '+' : '−'}${compactN(Math.abs(delta))} bu hafta` : 'Hafta sonu güncellenir'}</span></div>
    <div class="card pop-meter">
      <div class="row between small"><span class="muted">Kariyerine göre beklenen</span><b>${compactN(target)}</b></div>
      ${next ? `<div class="row between small"><span class="muted">Sıradaki hedef: ${milestoneLabel(next)}</span><b>%${Math.max(0, Math.min(100, prog))}</b></div>
      <div class="bar"><i style="width:${Math.max(3, Math.min(100, prog))}%;background:#38bdf8"></i></div>` : '<div class="small"><b>Tüm kilometre taşları tamam! 🌍</b></div>'}
      ${sparkline(hist)}
      <p class="muted small" style="margin:0">${f < target ? 'Takipçin kariyerine yetişiyor: her hafta hedefe doğru artar.' : 'Takipçin kariyerinin önünde: paylaşımların ilgi çekiyor.'} Gol, asist ve yüksek notlu maçlar (büyük maçlarda daha çok) anında takipçi getirir.</p>
    </div>

    <div class="h-sec">Popülerliğini ne belirliyor?</div>
    <div class="card">
      <div class="pop-factors">${factors.map((x) => `<div class="pop-factor"><span class="ellipsis">${esc(x.label)}</span><div class="bar"><i style="width:${Math.round(x.value * 100)}%;--c:${x.value >= 0.66 ? '#22c55e' : x.value >= 0.33 ? '#f59e0b' : '#64748b'}"></i></div><b>${Math.round(x.value * 100)}</b></div>`).join('')}</div>
      <p class="muted small" style="margin:10px 0 0">Ağırlıklar: güç %30 · lig ve kulüp %20 · ün %14 · kupalar %14 · milli takım %12 · form %10. Altın Top kürsüsü takipçini katlar.</p>
    </div>

    <div class="h-sec">Fotoğraflar <span>${photos.length ? `${mine.filter((t) => t.meta?.pic).length} gönderi` : ''}</span></div>
    ${photos.length ? `<div class="pic-grid">${photos.map((t) => `<div class="pic-cell">${picHTML(t.meta.pic, { cls: 'sm' })}<span class="pic-label">♥ ${compactN(t.likes || 0)}</span></div>`).join('')}</div>` : '<div class="card muted small">Henüz fotoğraflı gönderin yok. Gönderi yazarken 📷 Fotoğraf ekle\'ye dokun.</div>'}

    <div class="h-sec">Maç kareleri <span>${gallery.length}/30</span></div>
    ${gallery.length ? `<div class="pic-grid" data-gallery>${gallery.map((g) => `<button class="pic-cell" data-frame="${esc(g.id)}">${picHTML({ t: 'frame', id: g.id, kind: g.kind, min: g.min, score: g.score, opp: g.opp }, { cls: 'sm' })}<span class="pic-label">${esc(frameLabel(g.kind))}</span></button>`).join('')}</div>` : '<div class="card muted small">Maçlarda golünde ve asistinde kare otomatik alınır; yayın sırasında 📸 düğmesiyle istediğin anı kaydedebilirsin.</div>'}

    <div class="h-sec">Gönderilerin</div>`;
}

/** Profil etkileşimleri: kareye dokun → paylaş / sil */
export function bindProfile(app, root, { compose, rerender }) {
  paintPics(root, app.state);
  root.querySelector('[data-gallery]')?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-frame]');
    if (!b) return;
    app.click();
    const id = b.dataset.frame;
    const g = galleryOf(app.state).find((x) => x.id === id);
    if (!g) return;
    const pic = { t: 'frame', id: g.id, kind: g.kind, min: g.min, score: g.score, opp: g.opp };
    const act = await sheet({
      html: `<h3>${esc(frameLabel(g.kind))}</h3>
        <p class="muted small" style="margin:0 0 8px">Sezon ${g.s} · Hafta ${g.w}${g.opp ? ` · ${esc(g.opp)}` : ''}</p>
        ${picHTML(pic)}
        <div class="stack"><button class="btn primary block" data-close="share">${icon('chirp')} Chirp'te paylaş</button><button class="btn ghost block" data-close="del">${icon('x', 'ico sm')} Galeriden sil</button><button class="btn ghost block" data-close="">Kapat</button></div>`,
      onMount: (node) => paintPics(node, app.state),
    });
    if (act === 'share') {
      const caption = g.kind === 'goal' ? 'Bu golü unutmayacağım ⚽🔥' : g.kind === 'assist' ? 'Asist benden, gol takımın 🤝' : g.kind === 'celebration' ? 'Bu sevinç hepimizin 🙌' : g.kind === 'fulltime' ? 'Üç puan bizim! 💪' : 'Maçtan bir kare 📸';
      if (await compose({ text: caption, pic })) rerender();
    } else if (act === 'del') {
      deleteFrame(app.state, id);
      app.save();
      toast('Kare galeriden silindi.');
      rerender();
    }
  });
}
