// ALTIN TOP ARAYÜZÜ — tören (3.→2.→1. açıklama) ve sıralama ekranı.
import { BALLON_RULES, ballonRank, ballonStandings, ensureBallon, visibility } from '../core/ballondor.js';
import { buzz, sfx } from '../audio.js';
import { spriteOr } from '../assets/sprites.js';
import { icon } from './art.js';
import { confetti, esc, sheet, sleep } from './dom.js';

const NAT_COLORS = {
  TÜR: ['#e30a17', '#ffffff'], ARG: ['#75aadb', '#ffffff'], FRA: ['#1e3a8a', '#ef4444'], BRA: ['#facc15', '#16a34a'], ESP: ['#c60b1e', '#ffc400'],
  ENG: ['#ffffff', '#c8102e'], SWE: ['#1d4ed8', '#facc15'], POR: ['#9f1239', '#15803d'], JPN: ['#ffffff', '#dc2626'], MAR: ['#b91c1c', '#15803d'],
  CRO: ['#dc2626', '#ffffff'], GER: ['#111827', '#facc15'], SEN: ['#16a34a', '#facc15'], ITA: ['#16a34a', '#dc2626'], NED: ['#f97316', '#1e3a8a'],
  BEL: ['#111827', '#dc2626'], URU: ['#7dd3fc', '#ffffff'], COL: ['#facc15', '#1e3a8a'], DEN: ['#c8102e', '#ffffff'], POL: ['#ffffff', '#dc2626'],
  USA: ['#1e3a8a', '#dc2626'], AUT: ['#ef4444', '#ffffff'], SUI: ['#dc2626', '#ffffff'],
};
const flagOf = (nat) => {
  const c = NAT_COLORS[nat] || ['#475569', '#cbd5e1'];
  return `<span class="nat-dot" style="--a:${c[0]};--b:${c[1]}" title="${esc(nat)}"></span>`;
};

export const golden = (size = 64) => spriteOr('golden_ball', icon('star'), { size });

/** Sezon sonu töreni (aday listesindeysen) */
export async function ballonCeremony(app, r) {
  if (!r?.nominated) return;
  sfx('whistle');
  await sheet({
    center: true,
    dismissable: false,
    html: `<div class="center">${golden(80)}</div><div class="center" style="margin-top:6px"><span class="chip gold">ALTIN TOP TÖRENİ · SEZON ${r.season}</span></div>
      <h3 class="center" style="margin-top:8px">${r.rank <= 3 ? 'Podyumdasın!' : 'Aday listesindesin'}</h3>
      <p class="lead center">${r.rank <= 3 ? 'Salonda nefesler tutuldu. Dünyanın en iyi üç oyuncusu açıklanıyor…' : `Dünyanın en iyi ${BALLON_RULES.nominees} oyuncusu arasında ${r.rank}. sıradasın.`}</p>
      <button class="btn primary block" style="margin-top:14px" data-close>${r.rank <= 3 ? 'Zarfı aç' : 'Sonuçları gör'}</button>`,
  });
  const order = [2, 1, 0].filter((i) => r.podium[i]);
  const html = (shown) => `
    <div class="center">${golden(64)}</div>
    <div class="podium">${[1, 0, 2].map((i) => {
      const p = r.podium[i];
      const vis = p && shown.includes(i);
      return `<div class="pod p${i + 1} ${vis ? 'on' : ''} ${p?.me ? 'me' : ''}"><div class="pod-name">${vis ? `${flagOf(p.nat)}<b>${esc(p.me ? 'SEN' : p.name.split(' ').slice(-1)[0])}</b>` : '<b>?</b>'}</div><div class="pod-bar"><span>${i + 1}</span></div></div>`;
    }).join('')}</div>
    <p class="lead center" data-msg style="min-height:2.6em">${shown.length === 3 || shown.includes(0) ? `<b>${esc(r.podium[0].me ? 'ALTIN TOP SENİN!' : `Kazanan: ${r.podium[0].name}`)}</b>` : 'Sıradaki isim…'}</p>
    ${shown.length >= order.length ? `<div class="chips" style="justify-content:center"><span class="chip ${r.rank <= 3 ? 'gold' : ''}">Senin sıran: ${r.rank}.</span><span class="chip">${Math.round(r.pts)} puan</span></div><button class="btn primary block" style="margin-top:12px" data-close>Devam</button>` : ''}`;
  await sheet({
    center: true,
    dismissable: false,
    html: html([]),
    onMount: async (node) => {
      const shown = [];
      for (const i of order) {
        await sleep(i === 0 ? 1300 : 900);
        shown.push(i);
        node.innerHTML = html(shown);
        if (r.podium[i].me) {
          sfx(i === 0 ? 'goal' : 'levelup');
          buzz(i === 0 ? [80, 50, 80, 50, 200] : [30, 40, 30]);
          if (i === 0) confetti({ colors: ['#ffcf3d', '#fff', '#fde68a'] });
        } else sfx('tick');
      }
    },
  });
}

/** Ana ekran/kariyer için kısa özet */
export function ballonSummary(state) {
  const b = ensureBallon(state);
  const rank = ballonRank(state);
  return { rank, pts: b.me, best: b.history.length ? Math.min(...b.history.map((h) => h.rank)) : null };
}

/** Sıralama ekranı */
export function ballonScreen(app) {
  const s = app.state;
  const table = ballonStandings(s);
  const rank = table.findIndex((x) => x.me) + 1;
  const b = ensureBallon(s);
  const vis = visibility(s);
  const rows = table.slice(0, 10).map((p, i) => row(p, i + 1)).join('') + (rank > 10 ? `<div class="li muted small center" style="justify-content:center">…</div>${row(table[rank - 1], rank)}` : '');
  function row(p, n) {
    return `<div class="li bd-row ${p.me ? 'me' : ''}"><span class="bd-rank">${n}</span>${flagOf(p.nat)}<div class="grow" style="min-width:0"><b class="small ellipsis">${esc(p.me ? `${p.name} (Sen)` : p.name)}</b><div class="muted small">${esc({ FW: 'Forvet', MF: 'Orta saha', DF: 'Defans' }[p.pos] || '')}</div></div><b class="tnum">${Math.round(p.pts)}</b></div>`;
  }
  const hist = b.history.slice().reverse().map((h) => `<div class="li"><span class="bd-rank">${h.rank}</span><div class="grow small">Sezon ${h.season} · kazanan ${esc(h.winner)}</div><b class="tnum small">${Math.round(h.pts)}</b></div>`).join('');
  return {
    tabs: 'career',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Altın Top</h1>
      </div>
      <div class="card bd-hero" style="margin-top:12px">
        <div class="row" style="gap:14px">${golden(64)}<div class="grow"><div class="muted small">Sezon ${s.calendar.season} yarışı</div><b style="font-size:22px">${rank <= BALLON_RULES.nominees ? `${rank}. sıra` : 'Aday değilsin'}</b><div class="muted small">${Math.round(b.me)} puan</div></div></div>
        <p class="muted small" style="margin:10px 0 0">Gol, asist, maç notu ve galibiyetler puan getirir; sezon sonunda kupalar ve milli turnuva eklenir. Görünürlüğün: <b style="color:var(--gold)">%${Math.round(vis * 100)}</b> (lig seviyesi × genel güç). Dünya sahnesinde fark edilmek için Süper Lig ve OVR 75+ gerekir.</p>
      </div>
      <div class="h-sec">Güncel sıralama</div>
      <div class="card list">${rows}</div>
      ${hist ? `<div class="h-sec">Geçmiş törenler</div><div class="card list">${hist}</div>` : ''}`,
    mount(node) {
      node.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="back"]')) {
          app.click();
          app.go('career');
        }
      });
    },
  };
}
