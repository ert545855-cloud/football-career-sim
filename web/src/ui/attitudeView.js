// Karakter barı görünümü: Mütevazı ↔ Dengeli ↔ Egoist (piksel dilimli şerit + ok)
import { ATT_KINDS, ATT_RULES, attitudeKind, attitudeLabel, attitudeOf, ensureAttitude } from '../core/attitude.js';
import { esc, toast } from './dom.js';

const CELLS = 21;
const pct = (v) => ((v + 100) / 200) * 100;

/** Dilimli bar. o.delta: son kayma (ok önceki yerden kayarak gelir). o.compact: başlıksız */
export function attitudeBar(v, o = {}) {
  const kind = attitudeKind(v);
  const cells = [];
  for (let i = 0; i < CELLS; i++) {
    const x = (i / (CELLS - 1)) * 200 - 100; // −100 … +100
    const z = x <= ATT_RULES.humbleAt ? 'h' : x >= ATT_RULES.egoAt ? 'e' : 'b';
    const depth = Math.min(1, Math.abs(x) / 100);
    cells.push(`<i class="att-c ${z}" style="--d:${depth.toFixed(2)}"></i>`);
  }
  const from = o.delta ? pct(Math.max(-100, Math.min(100, v - o.delta))) : pct(v);
  const to = pct(v);
  return `<div class="att ${o.compact ? 'compact' : ''}">
    ${o.compact ? '' : `<div class="att-h">${['humble', 'balanced', 'ego'].map((k) => `<span class="${k === kind ? 'on' : ''}" style="${k === kind ? `color:${ATT_KINDS[k].color}` : ''}">${esc(k === kind ? attitudeLabel(v) : ATT_KINDS[k].label)}</span>`).join('')}</div>`}
    <div class="att-track"><div class="att-cells">${cells.join('')}</div><u class="att-mk ${o.delta ? 'move' : ''}" style="--from:${from.toFixed(1)}%;--to:${to.toFixed(1)}%;left:${to.toFixed(1)}%"></u></div>
    ${o.delta ? `<div class="att-d ${o.delta > 0 ? 'e' : 'h'}">${o.delta > 0 ? 'Egoist yönüne ▶' : '◀ Mütevazı yönüne'} ${Math.abs(o.delta).toFixed(1)}</div>` : ''}
  </div>`;
}

/** Oyuncu ekranındaki kart: bar + açıklama + son etkenler */
export function attitudeCard(state) {
  const p = ensureAttitude(state);
  const v = p.attitude;
  const kind = attitudeKind(v);
  const log = (p.attLog || []).slice(0, 4);
  return `
    <div class="h-sec">Karakter barı <span>${esc(ATT_KINDS[kind].label)}</span></div>
    <div class="card" style="display:grid;gap:8px">
      ${attitudeBar(v)}
      <p class="muted small" style="margin:0">${esc(ATT_KINDS[kind].desc)}</p>
      ${log.length ? `<div class="att-log">${log.map((l) => `<span class="${l.d > 0 ? 'e' : 'h'}">${l.d > 0 ? '▶' : '◀'} ${esc(l.label)} <b>${l.d > 0 ? '+' : ''}${l.d}</b></span>`).join('')}</div>` : '<p class="muted small" style="margin:0">Basın toplantıları, röportajlar, paylaşımların, gol sevincin ve sahadaki tepkilerin barı azar azar oynatır.</p>'}
    </div>`;
}

/** Kısa bildirim */
export function attitudeToast(state, d) {
  if (!d || Math.abs(d) < 0.5) return;
  const v = attitudeOf(state);
  toast(`Karakter barı: ${d > 0 ? 'Egoist yönüne ▶' : '◀ Mütevazı yönüne'} (${attitudeLabel(v)})`, d > 0 ? 'warn' : 'good');
}
