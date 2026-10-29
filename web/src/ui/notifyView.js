// BİLDİRİM MERKEZİ — ana sayfadaki zil: okunmamış rozeti, haber ve uyarı listesi; cihaz bildirimi kısayolu.
import { icon } from './art.js';
import { esc, sheet } from './dom.js';
import { markNotifsRead, notifList, unreadNotifs } from '../core/notify.js';
import { enableSysNotify, sysNotifyOn, sysNotifyPermission } from './sysNotify.js';

/** Zil düğmesi (okunmamış sayısıyla) */
export function notifBell(state) {
  const n = unreadNotifs(state);
  return `<button class="icon-btn notif-btn" data-act="notifs" aria-label="Bildirimler">${icon('bell')}${n ? `<i class="nb">${n > 9 ? '9+' : n}</i>` : ''}</button>`;
}

export async function openNotifs(app) {
  const s = app.state;
  const items = notifList(s, 30);
  const perm = sysNotifyPermission();
  const sysRow = perm === 'unsupported' || sysNotifyOn(app) ? '' : perm === 'denied'
    ? `<div class="notif-sys muted small">${icon('bell', 'ico sm')} Cihaz bildirimleri tarayıcı ayarlarından kapatılmış.</div>`
    : `<button class="btn sm block notif-sys" data-sys>${icon('bell', 'ico sm')} Cihaz bildirimlerini aç (maç günü hatırlatması)</button>`;
  const rows = items.length
    ? items.map((it) => `
      <${it.go ? 'button' : 'div'} class="li notif-li ${it.unread ? 'unread' : ''}" ${it.go ? `data-go="${it.go}"` : ''}>
        <span class="notif-ic ${it.kind}">${icon(it.icon, 'ico sm')}</span>
        <span class="grow small">${esc(it.text)}</span>
        ${it.when ? `<span class="muted small">S${it.when.s}·H${it.when.w}</span>` : ''}
        ${it.go ? icon('chev', 'ico sm') : ''}
      </${it.go ? 'button' : 'div'}>`).join('')
    : '<div class="muted small" style="padding:12px 4px">Henüz bildirim yok.</div>';
  markNotifsRead(s);
  app.save();
  const go = await sheet({
    html: `
      <div class="row between"><h2 class="notif-h">${icon('bell')} Bildirimler</h2><button class="icon-btn" data-close aria-label="Kapat">${icon('x')}</button></div>
      ${sysRow}
      <div class="card list notif-list">${rows}</div>`,
    onMount(layer, close) {
      layer.addEventListener('click', async (e) => {
        const g = e.target.closest('[data-go]');
        if (g) { close(g.dataset.go); return; }
        if (e.target.closest('[data-close]')) { close(null); return; }
        const b = e.target.closest('[data-sys]');
        if (b) {
          b.disabled = true;
          const r = await enableSysNotify(app);
          b.outerHTML = `<div class="notif-sys muted small">${r === 'granted' ? '✓ Cihaz bildirimleri açık' : 'İzin verilmedi'}</div>`;
        }
      });
    },
  });
  if (typeof go === 'string' && go.length > 1) app.go(go);
  else if (app.current === 'hub') app.go('hub'); // rozeti güncelle
}
