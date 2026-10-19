// SPOR SALONU EKRANI — piksel salon sahnesi (ekipmana dokun → istasyon), kondisyon / güç / kas ağrısı,
// maça etkileri, tesis kalitesi, istasyon kartları ve son seanslar.
import { CLUB_BY_ID } from '../../core/data.js';
import { GYM_RULES, GYM_STATIONS, canGym, ensureGym, finishGym, gymEffects, gymQuality } from '../../core/gym.js';
import { playerLook } from '../../core/cosmetics.js';
import { STATS } from '../../core/data.js';
import { buzz, sfx } from '../../audio.js';
import { icon } from '../art.js';
import { animateBars, esc, sheet, toast } from '../dom.js';
import { meter } from '../components.js';
import { blitSprite, gymLook, runGymGame } from '../../games/gym.js';
import {
  R, drawBarbell, drawBench, drawDumbbellRack, drawGymRoom, drawMat, drawPoster, drawSquatRack, drawTreadmill, drawWaterCooler,
} from '../../games/pixel/gymArt.js';
import { drawPixelText } from '../../games/pixel/font.js';
import { questsOn } from '../../core/quests.js';

const LW = 200;
const LH = 124;
/** Dokunma bölgeleri (mantıksal piksel) */
const SPOTS = {
  barbell: { x: 6, y: 26, w: 70, h: 62, label: 'HALTER', lx: 40, ly: 88 },
  dumbbell: { x: 80, y: 48, w: 58, h: 44, label: 'DAMBIL', lx: 109, ly: 43 },
  treadmill: { x: 140, y: 36, w: 58, h: 52, label: 'KOŞU BANDI', lx: 168, ly: 31 },
  stretch: { x: 8, y: 98, w: 56, h: 26, label: 'ESNEME', lx: 30, ly: 107 },
};

const MATE_LOOK = (kit, skin, hair, hairColor) => ({ skin, hair, hairColor, kit: { body: kit, accent: '#ffffff', pattern: 'solid', shorts: '#16181d', socks: '#e5e7eb' }, boots: { main: '#f4f4f0', accent: '#16181d' } });

function drawOverview(c, t, o) {
  const floorY = 80;
  drawGymRoom(c, LW, LH, t, { floorY, sign: o.sign, accent: o.accent });
  drawPoster(c, 100, 26, 'GÜÇ', o.accent);
  // halter istasyonu
  drawSquatRack(c, 40, 84, { half: 26, h: 58, hookY: 46 });
  drawBarbell(c, 40, 44, 80, { half: 34 });
  // dambıl + sehpa
  drawDumbbellRack(c, 82, floorY, 54);
  drawBench(c, 92, 96, 26);
  // koşu bandı + koşan takım arkadaşı
  const ph = t * 9;
  drawTreadmill(c, 146, 84, 34, t * 30, { screen: '12' });
  blitSprite(c, o.mate1, 'side', `run${Math.floor(ph) % 4}`, 160, 83, 1);
  drawWaterCooler(c, 189, floorY + 2);
  // dambıl çalışan takım arkadaşı
  const cur = Math.floor(t * 1.6) % 3;
  blitSprite(c, { ...o.mate2, dumbbell: true }, 'down', cur === 0 ? 'curlL' : cur === 1 ? 'curl0' : 'curlR', 126, 98, 1);
  // esneme köşesi
  drawMat(c, 14, 118, 30);
  // oyuncu (sen) ortada, hafif nefes
  blitSprite(c, o.me, 'down', Math.floor(t * 0.7) % 4 === 3 ? 'ready' : 'idle', 80, 120, 1);
  // kondisyoner antrenör (kurgusal) panoya bakar
  blitSprite(c, o.coach, 'down', Math.floor(t * 0.5) % 3 === 2 ? 'clipW' : 'clip', 176, 120, 1);
  // etiketler + seçili bölge
  for (const [id, sp] of Object.entries(SPOTS)) {
    const on = o.ok[id];
    const pulse = 0.5 + Math.sin(t * 4 + sp.x) * 0.5;
    const col = on ? `rgba(198,255,61,${0.45 + pulse * 0.4})` : 'rgba(148,163,184,0.5)';
    const w = sp.label.length * 4 + 5;
    R(c, sp.lx - Math.round(w / 2), sp.ly - 1, w, 8, on ? '#0b1a05' : '#11151d');
    R(c, sp.lx - Math.round(w / 2), sp.ly - 1, w, 1, col);
    drawPixelText(c, sp.label, sp.lx, sp.ly + 1, on ? '#c6ff3d' : '#94a3b8', { align: 'center' });
  }
}

export function gymScreen(app) {
  const s = app.state;
  const g = ensureGym(s);
  const fx = gymEffects(s);
  const Q = gymQuality(s);
  const club = CLUB_BY_ID[s.career.clubId];
  const accent = '#c6ff3d';
  const me = gymLook(playerLook(s, { training: true }));
  const ok = Object.fromEntries(Object.keys(GYM_STATIONS).map((id) => [id, canGym(s, id).ok]));
  const sign = `${club?.short || ''} FİT`.trim();
  const mates = [MATE_LOOK(club?.colors?.[0] || '#2563eb', '#8d5a3b', 'buzz', '#14100c'), MATE_LOOK(club?.colors?.[1] && club.colors[1] !== '#ffffff' ? club.colors[1] : '#475569', '#f0c8a0', 'curly', '#5a3a1e')];
  const coach = { skin: '#c9926a', hair: 'bald', hairColor: '#2a1a10', beard: true, longSleeve: true, pants: true, stripes: true, zip: true, kit: { body: '#1e293b', accent: '#c6ff3d', pattern: 'solid', shorts: '#1e293b', socks: '#1e293b' }, boots: { main: '#f4f4f0', accent: '#16181d' } };

  const effTxt = (v, good) => (v === 0 ? 'etkisiz' : `${v > 0 ? '+' : '−'}%${Math.abs(v)}${good === (v > 0) ? '' : ''}`);
  const qParts = [`Kulüp tesisi ×${Q.toFixed(2).replace('.', ',')}`];
  if ((s.career.items || []).includes('villa')) qParts.push('evdeki özel salon');
  if ((s.career.items || []).includes('coach')) qParts.push('kişisel antrenör');
  if ((s.business?.list || []).some((b) => b.type === 'gym' && !b.closed)) qParts.push('kendi spor salonun');

  const cards = Object.values(GYM_STATIONS).map((st) => {
    const c = canGym(s, st.id);
    const best = g.best[st.id];
    return `<article class="card gym-st ${c.ok ? '' : 'off'}">
      <div class="row between"><b>${esc(st.full)}</b>${st.energy ? `<span class="chip">${icon('bolt', 'ico xs')} −${st.energy}</span>` : '<span class="chip good">+4 enerji</span>'}</div>
      <p class="muted small" style="margin:4px 0 6px">${esc(st.desc)}</p>
      <div class="chips"><span class="chip accent">${esc(st.gains)}</span>${best ? `<span class="chip gold">Rekor: ${esc(best.label)}</span>` : ''}</div>
      <button class="btn ${c.ok ? 'primary' : ''} block sm" style="margin-top:8px" data-st="${st.id}" ${c.ok ? '' : 'disabled'}>${c.ok ? `${icon('play', 'ico sm')} ${st.noGame ? 'Esnemeye başla' : 'Başla'}` : esc(c.reason)}</button>
    </article>`;
  }).join('');

  const log = g.log.slice(0, 5).map((l) => `<div class="li"><span class="news-dot info"></span><div class="grow small">${esc(GYM_STATIONS[l.station]?.name || l.station)}${GYM_STATIONS[l.station]?.noGame ? '' : ` · başarı %${l.q}`}</div><span class="muted small">S${l.s}·H${l.w}</span></div>`).join('');

  return {
    tabs: 'home',
    html: `
      <div class="row" style="gap:10px">
        <button class="icon-btn" data-act="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="h-title grow">Spor Salonu</h1>
        <span class="chip ${g.week >= GYM_RULES.maxPerWeek ? 'warn' : 'accent'}">Bu hafta ${g.week}/${GYM_RULES.maxPerWeek}</span>
      </div>
      <div class="gym-scene card" style="margin-top:12px"><canvas data-scene aria-label="Spor salonu: halter, dambıl, koşu bandı ve esneme köşesi"></canvas><span class="gym-hint">Ekipmana dokun</span></div>

      <div class="card gym-meters" data-tut="gym-meters">
        ${meter('Kondisyon', 'bolt', g.cond, 100, '#4ade80', Math.round(g.cond))}
        <p class="muted small gym-fx">Maçta ${fx.fatigue < 0 ? `<b class="t-up">%${-fx.fatigue} daha yavaş</b>` : fx.fatigue > 0 ? `<b class="t-down">%${fx.fatigue} daha hızlı</b>` : 'normal hızda'} yorulursun · sakatlık riski ${fx.injury < 0 ? `<b class="t-up">−%${-fx.injury}</b>` : fx.injury > 0 ? `<b class="t-down">+%${fx.injury}</b>` : 'normal'}</p>
        ${meter('Güç', 'dumbbell', g.power, 100, '#fb923c', Math.round(g.power))}
        <p class="muted small gym-fx">Top kapma ${fx.tackle >= 0 ? `<b class="t-up">+%${fx.tackle}</b>` : `<b class="t-down">−%${-fx.tackle}</b>`} · kafa topu ${fx.header >= 0 ? `<b class="t-up">+%${fx.header}</b>` : `<b class="t-down">−%${-fx.header}</b>`} · şut sertliği ${effTxt(Math.round(fx.shot))}</p>
        ${meter('Kas ağrısı', 'bandage', g.sore, 100, g.sore > 45 ? '#ff5d6c' : '#fbbf24', Math.round(g.sore))}
        <p class="muted small gym-fx">${g.sore > 45 ? '<b class="t-down">Maç gününe ağrıyla çıkarsan erken yorulursun ve sakatlık riskin artar.</b> Dinlen ya da esneme yap.' : g.sore > 20 ? 'Hafif ağrı: maç gününe kadar çoğu geçer.' : 'Kasların dinç.'}${g.stretchWeeks > 0 ? ` · Esneme koruması ${g.stretchWeeks} hf` : ''}</p>
        <p class="muted small" style="margin:6px 0 0">${esc(qParts.join(' · '))}. Çalışmazsan kondisyon ve güç her hafta biraz düşer.</p>
      </div>

      <div class="h-sec">İstasyonlar <span>haftada ${GYM_RULES.maxPerWeek} seans</span></div>
      <div class="stack">${cards}</div>
      ${log ? `<div class="h-sec">Son seanslar</div><div class="card list">${log}</div>` : ''}`,
    mount(node) {
      animateBars(node);
      const cv = node.querySelector('[data-scene]');
      const cx = cv.getContext('2d');
      const off = document.createElement('canvas');
      off.width = LW;
      off.height = LH;
      const oc = off.getContext('2d');
      let raf = 0;
      const t0 = performance.now();
      const frame = () => {
        if (!cv.isConnected) return;
        const w = cv.clientWidth;
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        const h = Math.round((w * LH) / LW);
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = `${h}px`; }
        drawOverview(oc, (performance.now() - t0) / 1000, { sign, accent, me, mate1: mates[0], mate2: mates[1], coach, ok });
        cx.imageSmoothingEnabled = false;
        cx.drawImage(off, 0, 0, cv.width, cv.height);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      cv.addEventListener('click', (e) => {
        const r = cv.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * LW;
        const y = ((e.clientY - r.top) / r.height) * LH;
        const hit = Object.entries(SPOTS).find(([, sp]) => x >= sp.x && x <= sp.x + sp.w && y >= sp.y && y <= sp.y + sp.h);
        if (hit) start(hit[0]);
      });
      node.addEventListener('click', (e) => {
        const t = e.target.closest('[data-st],[data-act]');
        if (!t || t.disabled) return;
        app.click();
        if (t.dataset.act === 'back') { cancelAnimationFrame(raf); return app.go('hub'); }
        if (t.dataset.st) start(t.dataset.st);
      });
      async function start(id) {
        const c = canGym(s, id);
        if (!c.ok) { toast(c.reason, 'bad'); sfx('error'); return; }
        const st = GYM_STATIONS[id];
        let res = { q: 1, score: 0, label: '' };
        if (!st.noGame) {
          res = await runGymGame(id, { look: playerLook(s, { training: true }), power: g.power, cond: g.cond, sore: g.sore, sign, auto: app.autoplay });
          if (!res) return; // vazgeçti
        }
        const r = finishGym(s, id, res.q, { score: res.score, label: res.label });
        if (!r.ok) { toast(r.text, 'bad'); return; }
        questsOn(s, 'gym', { station: id, q: res.q });
        app.save();
        sfx(r.record ? 'levelup' : 'coin');
        buzz([12, 30, 12]);
        const chip = (lbl, v, unit = '') => (Math.abs(v) >= 0.05 ? `<span class="chip ${v > 0 ? 'good' : 'bad'}">${lbl} ${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}${unit}</span>` : '');
        await sheet({
          center: true,
          html: `<h3 class="center">${esc(st.full)}</h3>
            ${res.label ? `<p class="lead center">${esc(res.label)}</p>` : `<p class="lead center">Köpük rulo ve esneme: kasların gevşedi.</p>`}
            ${r.record ? `<div class="center" style="margin-bottom:8px"><span class="chip gold">${icon('star', 'ico sm')} Yeni rekor!</span></div>` : ''}
            <div class="chips" style="justify-content:center">${chip('Kondisyon', r.dCond)}${chip('Güç', r.dPower)}${r.stat && !st.noGame ? `<span class="chip accent">${esc(STATS[r.stat].name)} gelişimi</span>` : ''}<span class="chip ${r.sore > 45 ? 'warn' : ''}">Kas ağrısı %${Math.round(r.sore)}</span></div>
            <button class="btn primary block" style="margin-top:14px" data-close>Tamam</button>`,
        });
        cancelAnimationFrame(raf);
        app.go('gym');
      }
    },
  };
}
