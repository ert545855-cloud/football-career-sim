import { ITEM_BY_ID, POSITIONS, STATS, STAT_KEYS, LEAGUES } from '../../core/data.js';
import { form, ovr, effectiveSkill } from '../../core/player.js';
import { money, itemEffects } from '../../core/economy.js';
import { leagueOf } from '../../core/league.js';
import { icon, itemArt, playerAvatar } from '../art.js';
import { animateBars, esc } from '../dom.js';
import { meter, statRow } from '../components.js';
import { currentClub } from '../../core/game.js';
import { MENTOR_TRAITS } from '../../core/mentor/index.js';

function radar(stats) {
  // Ölçek: en yüksek stat'a göre (erken kariyerde şekil okunur kalsın), en az 50
  const top = Math.max(50, Math.ceil((Math.max(...STAT_KEYS.map((k) => stats[k])) + 10) / 10) * 10);
  const cx = 110;
  const cy = 104;
  const R = 78;
  const pts = (scale) => STAT_KEYS.map((k, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const r = R * scale(k);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const ring = (f) => pts(() => f).map((p) => p.join(',')).join(' ');
  const shape = pts((k) => stats[k] / top);
  const labels = STAT_KEYS.map((k, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = cx + Math.cos(a) * (R + 18);
    const y = cy + Math.sin(a) * (R + 16) + 4;
    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="11" font-weight="800" fill="${STATS[k].color}">${STATS[k].short} ${stats[k]}</text>`;
  }).join('');
  return `<svg viewBox="0 0 220 210" style="width:100%;max-width:300px;margin:0 auto">
    ${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ring(f)}" fill="none" stroke="rgba(255,255,255,.12)"/>`).join('')}
    ${pts(() => 1).map(([x, y]) => `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.08)"/>`).join('')}
    <polygon points="${shape.map((p) => p.join(',')).join(' ')}" fill="rgba(198,255,61,.22)" stroke="#c6ff3d" stroke-width="2.5" stroke-linejoin="round">
      <animate attributeName="opacity" from="0" to="1" dur=".6s"/>
    </polygon>
    ${shape.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#c6ff3d"/>`).join('')}
    ${labels}
    <text x="110" y="206" text-anchor="middle" font-size="9.5" fill="rgba(255,255,255,.4)">Ölçek 0–${top}</text>
  </svg>`;
}

export function playerScreen(app) {
  const s = app.state;
  const p = s.player;
  const pos = POSITIONS[p.position];
  const club = currentClub(s);
  const fx = itemEffects(s);
  const items = s.career.items.map((id) => ITEM_BY_ID[id]).filter(Boolean);
  const fxChips = [
    fx.morale && `<span class="chip good">Moral +${fx.morale}/hf</span>`,
    fx.energy && `<span class="chip good">Enerji +${fx.energy}/hf</span>`,
    fx.fans && `<span class="chip good">Taraftar +${fx.fans}/hf</span>`,
    fx.train && `<span class="chip accent">Antrenman +%${Math.round(fx.train * 100)}</span>`,
    s.flags.trainBoostWeeks > 0 && `<span class="chip accent">Kamp bonusu +%25 · ${s.flags.trainBoostWeeks} hf</span>`,
    p.mentorBonus && `<span class="chip gold" style="white-space:normal;line-height:1.3;height:auto;padding-top:5px;padding-bottom:5px">${icon('mentor', 'ico sm')} ${MENTOR_TRAITS[p.mentorBonus.trait].name} mentor: ${MENTOR_TRAITS[p.mentorBonus.trait].desc.replace(/\.$/, '')}</span>`,
  ].filter(Boolean).join('');

  return {
    tabs: 'player',
    html: `
      <div class="row" style="gap:14px">
        <div class="avatar-ring" style="width:84px;height:84px">${playerAvatar(s)}</div>
        <div class="grow">
          <h1 class="h-title ellipsis">${esc(p.name)}</h1>
          <div class="muted small" style="margin-top:4px">${pos.name} · #${p.number} · ${p.age} yaş</div>
          <div class="chips" style="margin-top:8px"><span class="chip">${esc(club.name)}</span><span class="chip">${LEAGUES[leagueOf(club.id)].name}</span></div>
        </div>
        <div class="ovr-badge">${ovr(p)}<small>OVR</small></div>
      </div>

      <div class="card" style="margin-top:14px">${radar(p.stats)}</div>

      <div class="h-sec">Özellikler <span>Ana: ${STATS[pos.primary].name} ×1.5 · Yan: ${STATS[pos.secondary].name} ×1.25</span></div>
      <div class="card">
        ${STAT_KEYS.map((k) => statRow(k, p.stats[k], p.progress[k] * 4, k === pos.primary || k === pos.secondary)).join('')}
        <p class="muted small" style="margin:8px 0 0">Açık renkli uzantı, bir sonraki puana ne kadar yaklaştığını gösterir.</p>
      </div>

      <div class="h-sec">Durum</div>
      <div class="card" style="display:grid;gap:12px">
        ${meter('Form (son 5 maç)', 'chart', (form(p) - 3) * 14.3, 100, 'var(--accent)', form(p).toFixed(1).replace('.', ','))}
        ${meter('Şut oyununda etkin yetenek', 'target', effectiveSkill(p, { shooting: 1 }) * 100, 100, '#fb923c', `%${Math.round(effectiveSkill(p, { shooting: 1 }) * 100)}`)}
        ${meter('Pas oyununda etkin yetenek', 'target', effectiveSkill(p, { passing: 1 }) * 100, 100, '#a3e635', `%${Math.round(effectiveSkill(p, { passing: 1 }) * 100)}`)}
        ${meter('Müdahalede etkin yetenek', 'target', effectiveSkill(p, { defending: 0.7, speed: 0.3 }) * 100, 100, '#c084fc', `%${Math.round(effectiveSkill(p, { defending: 0.7, speed: 0.3 }) * 100)}`)}
        <p class="muted small" style="margin:0">Etkin yetenek; stat, enerji (yorgunluk) ve morale göre hesaplanır.</p>
      </div>

      <div class="h-sec">Kulüpteki yerin</div>
      <button class="card" data-go-mentor style="display:grid;gap:12px;width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer">
        ${meter('Kulüp Nüfuzu', 'flag', p.influence ?? 0, 100, 'var(--gold)')}
        ${meter('Kulüp Sadakati', 'shield', p.loyalty ?? 0, 100, '#fb923c')}
        <span class="muted small">Nüfuz maç oynadıkça, takımla vakit geçirdikçe ve sezonlar boyunca kulüpte kaldıkça artar. Mentorluk ekranı için dokun.</span>
      </button>

      <div class="h-sec">Sözleşme</div>
      <div class="card">
        <div class="row between"><span class="muted">Haftalık maaş</span><b class="tnum" style="color:var(--gold)">${money(s.career.contract.wage)}</b></div>
        <div class="row between" style="margin-top:8px"><span class="muted">Kalan süre</span><b>${s.career.contract.yearsLeft} sezon</b></div>
        <div class="row between" style="margin-top:8px"><span class="muted">Primler</span><span class="small">Galibiyet %10 · Gol %15 · Asist %8</span></div>
      </div>

      <div class="h-sec">Eşyalar ve etkileri</div>
      <div class="card">
        ${items.length ? `<div class="scroller">${items.map((it) => `<div style="flex:none;width:76px;text-align:center"><div style="width:64px;height:64px;margin:0 auto">${itemArt(it)}</div><div class="small ellipsis">${esc(it.name)}</div></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Henüz bir şey almadın. Mağazaya göz at!</p>'}
        ${fxChips ? `<div class="chips" style="margin-top:10px">${fxChips}</div>` : ''}
      </div>`,
    mount(el) {
      animateBars(el);
      el.querySelector('[data-go-mentor]')?.addEventListener('click', () => {
        app.click();
        app.go('mentor');
      });
    },
  };
}
