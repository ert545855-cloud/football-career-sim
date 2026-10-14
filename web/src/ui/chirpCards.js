// CHIRP GÖRSEL KARTLARI — gönderilerin altındaki "görsel": maç önü, sonuç, transfer karşılama, sakatlık,
// milli kadro, kupa sonuçları, puan durumu, piyasa değeri, tribün pankartı, şampiyonlar.
import { CLUB_BY_ID, COUNTRY_BY_ID, LEAGUES } from '../core/data.js';
import { CUPS, STAGE_LABEL } from '../core/world/europe.js';
import { avatarSVG, crestSVG, icon } from './art.js';
import { esc } from './dom.js';

const club = (id) => CLUB_BY_ID[id] || { name: '?', short: '?', colors: ['#334155', '#e2e8f0'] };
const flagOf = (id) => COUNTRY_BY_ID[CLUB_BY_ID[id]?.country]?.flag || '';
const leagueTitle = (lid) => {
  const lg = LEAGUES[lid];
  if (!lg) return '';
  return lg.country === 'tr' ? lg.name : `${COUNTRY_BY_ID[lg.country]?.flag || ''} ${lg.name}`;
};

function preview(c) {
  const H = club(c.home);
  const A = club(c.away);
  return `<div class="cc cc-preview" style="--h:${H.colors[0]};--a:${A.colors[0]}">
    <div class="cc-top"><span>MAÇ GÜNÜ</span><span>Hafta ${c.week} · ${esc(leagueTitle(c.league))}</span></div>
    <div class="cc-vs">
      <div class="cc-team">${crestSVG(H, 'crest lg')}<b>${esc(H.name)}</b></div>
      <span class="cc-vs-x">VS</span>
      <div class="cc-team">${crestSVG(A, 'crest lg')}<b>${esc(A.name)}</b></div>
    </div>
    ${c.ready
      ? '<div class="cc-ready">MAÇA HAZIRIZ 💪<small>Eksik: yok ✅</small></div>'
      : `<div class="cc-missing"><b>${icon('bandage', 'ico xs')} Eksikler</b>${c.missing.map((n) => `<span>${esc(n)}</span>`).join('')}</div>`}
  </div>`;
}

function result(c) {
  const H = club(c.home);
  const A = club(c.away);
  const list = (arr) => (arr || []).map((n) => `<span>⚽ ${esc(n)}</span>`).join('');
  return `<div class="cc cc-result" style="--h:${H.colors[0]};--a:${A.colors[0]}">
    <div class="cc-top"><span>MAÇ SONUCU</span><span>${c.week ? `Hafta ${c.week}` : ''}</span></div>
    <div class="cc-score">
      <div class="cc-team">${crestSVG(H, 'crest')}<b>${esc(H.short)}</b></div>
      <div class="cc-num">${c.hg}<i>-</i>${c.ag}</div>
      <div class="cc-team">${crestSVG(A, 'crest')}<b>${esc(A.short)}</b></div>
    </div>
    <div class="cc-scorers"><div>${list(c.scorers?.home)}</div><div>${list(c.scorers?.away)}</div></div>
    ${c.motm ? `<div class="cc-motm">${icon('star', 'ico xs')} Maçın oyuncusu: <b>${esc(c.motm)}</b></div>` : ''}
  </div>`;
}

function welcome(c, state) {
  const C = club(c.clubId);
  const look = c.me ? state.player.avatar || {} : c.look || {};
  const from = c.from ? CLUB_BY_ID[c.from] : null;
  return `<div class="cc cc-welcome" style="--h:${C.colors[0]};--a:${C.colors[1]}">
    <div class="cc-wm">${crestSVG(C, 'crest xl')}</div>
    <div class="cc-hello">HOŞ<br>GELDİN</div>
    <div class="cc-player">${avatarSVG(look, { colors: C.colors, pattern: C.pattern }, c.number ?? '')}</div>
    <div class="cc-name"><b>${esc(c.name)}</b><span>${crestSVG(C, 'crest xs')} ${esc(C.name)}</span></div>
    <div class="cc-deal">
      ${c.years ? `<span>✍️ ${c.years} yıl</span>` : ''}
      ${c.number ? `<span>#${c.number}</span>` : ''}
      ${c.fee ? `<span>💶 ${esc(c.fee)}</span>` : ''}
      ${c.wage ? `<span>Maaş €${Number(c.wage).toLocaleString('tr-TR')}/hf</span>` : ''}
      ${from ? `<span>← ${esc(from.short)} ${flagOf(from.id)}</span>` : ''}
    </div>
  </div>`;
}

function injury(c) {
  const C = club(c.clubId);
  const w = Math.min(100, (c.weeks / 6) * 100);
  return `<div class="cc cc-injury">
    <div class="cc-med">✚</div>
    <div class="grow" style="min-width:0">
      <div class="cc-top" style="padding:0"><span>SAĞLIK AÇIKLAMASI</span><span>${crestSVG(C, 'crest xs')}</span></div>
      <b class="cc-inj-name">${esc(c.name)}</b>
      <div class="small">${esc(c.part)}</div>
      <div class="cc-inj-bar"><i style="width:${w}%"></i></div>
      <div class="small muted-on">Tahmini dönüş: ${c.weeks} hafta</div>
    </div>
  </div>`;
}

function squad(c) {
  const LABEL = { K: 'Kaleciler', D: 'Defans', O: 'Orta saha', F: 'Forvet' };
  return `<div class="cc cc-squad">
    <div class="cc-top"><span>☾★ ${esc(c.title)}</span><span>Aday kadro</span></div>
    <div class="cc-squad-grid">${Object.entries(c.groups).map(([k, list]) => `<div><b>${LABEL[k]}</b>${list.map((n) => `<span class="${n === c.highlight ? 'hl' : ''}">${esc(n)}</span>`).join('')}</div>`).join('')}</div>
  </div>`;
}

function cup(c) {
  const meta = CUPS[c.cup];
  const shown = c.matches.slice(0, 8);
  return `<div class="cc cc-cup" style="--c:${meta.color};--a:${meta.accent}">
    <div class="cc-top"><span>⭐ ${esc(meta.name)}</span><span>${STAGE_LABEL[c.stage]}${c.md ? ` · ${c.md}. maç günü` : ''}</span></div>
    ${shown.map((m) => `<div class="cc-row"><span class="r">${esc(club(m.h).short)} ${flagOf(m.h)}</span>${crestSVG(club(m.h), 'crest xs')}<b>${m.hg} - ${m.ag}</b>${crestSVG(club(m.a), 'crest xs')}<span>${flagOf(m.a)} ${esc(club(m.a).short)}</span>${m.pen ? `<em>pen ${m.pen[0]}-${m.pen[1]}</em>` : ''}</div>`).join('')}
    ${c.matches.length > shown.length ? `<div class="cc-more">+${c.matches.length - shown.length} maç daha</div>` : ''}
  </div>`;
}

function table(c) {
  return `<div class="cc cc-table">
    <div class="cc-top"><span>${esc(leagueTitle(c.league))}</span><span>Puan durumu</span></div>
    ${c.rows.map((r, i) => `<div class="cc-row t"><span class="pos">${i + 1}</span>${crestSVG(club(r.id), 'crest xs')}<span class="grow ellipsis">${esc(club(r.id).name)}</span><span class="muted-on">${r.p}</span><b>${r.pts}</b></div>`).join('')}
    ${(c.results || []).length ? `<div class="cc-results">${c.results.map((m) => `<span>${esc(club(m.h).short)} ${m.hg}-${m.ag} ${esc(club(m.a).short)}</span>`).join('')}</div>` : ''}
  </div>`;
}

function value(c, state) {
  const C = club(c.clubId);
  return `<div class="cc cc-value" style="--h:${C.colors[0]}">
    <div class="cc-player sm">${avatarSVG(state.player.avatar || {}, { colors: C.colors, pattern: C.pattern }, state.player.number)}</div>
    <div class="grow">
      <div class="cc-top" style="padding:0"><span>PİYASA DEĞERİ</span><span>${esc(c.pos || '')} · ${c.age} yaş</span></div>
      <div class="cc-val">${esc(c.value)} <i>📈</i></div>
      <div class="small">Taraftara göre: <b>${esc(c.hype)}</b> 😅</div>
    </div>
  </div>`;
}

function banner(c) {
  const C = club(c.clubId);
  return `<div class="cc cc-banner ${c.tone}" style="--h:${C.colors[0]};--a:${C.colors[1]}">
    <div class="cc-cloth"><span>${esc(c.text)}</span></div>
    <div class="cc-credit">— ${esc(C.short)} tribünü</div>
  </div>`;
}

function champs(c) {
  return `<div class="cc cc-table">
    <div class="cc-top"><span>🏆 Şampiyonlar</span><span>Sezon sonu</span></div>
    ${c.items.map((it) => `<div class="cc-row t">${crestSVG(club(it.id), 'crest xs')}<span class="grow ellipsis"><b>${esc(club(it.id).name)}</b></span><span class="muted-on">${esc(leagueTitle(it.league))}</span></div>`).join('')}
  </div>`;
}

const RENDER = { preview, result, welcome, injury, squad, cup, table, value, banner, champs };

/** Kartı çizer (bilinmeyen tür boş döner) */
export function chirpCardHTML(card, state) {
  if (!card) return '';
  try {
    return RENDER[card.kind]?.(card, state) || '';
  } catch {
    return '';
  }
}
