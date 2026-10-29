// CİHAZ BİLDİRİMLERİ — izin verilirse servis çalışanı üzerinden sistem bildirimi gösterir.
// Uygulama kapalıyken hatırlatma: Android'de ana ekrana eklenmiş uygulamada günlük arka plan eşitlemesi
// (Periodic Background Sync) ile "maç seni bekliyor" bildirimi; servis çalışanı bunun için sayfanın yazdığı
// kısa özeti (krampon-meta önbelleği) okur. iPhone'da bildirimler ana ekrana eklenmiş uygulamada çalışır.
import { tx } from '../i18n/index.js';
import { reminderText } from '../core/notify.js';
import { fixtureFor } from '../core/league.js';
import { CLUB_BY_ID } from '../core/data.js';

const META_CACHE = 'krampon-meta';
const META_URL = './__krampon_meta';
const ICON = 'icons/icon-192.png';

export const sysNotifySupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
/** 'unsupported' | 'default' | 'granted' | 'denied' */
export const sysNotifyPermission = () => (sysNotifySupported() ? Notification.permission : 'unsupported');
export const sysNotifyOn = (app) => !!app.settings.notify && sysNotifyPermission() === 'granted';

async function registerDaily() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return false;
    const st = await navigator.permissions?.query({ name: 'periodic-background-sync' }).catch(() => null);
    if (st && st.state !== 'granted') return false;
    await reg.periodicSync.register('krampon-daily', { minInterval: 20 * 3600 * 1000 });
    return true;
  } catch {
    return false;
  }
}

/** Sistem bildirimi (izin varsa) */
export async function showSysNotification(title, body, tag = 'krampon') {
  if (sysNotifyPermission() !== 'granted') return false;
  const opts = { body: tx(body), icon: ICON, badge: ICON, tag, data: { url: './' } };
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(tx(title), opts);
    return true;
  } catch {
    try { new Notification(tx(title), opts); return true; } catch { return false; }
  }
}

/** Ayarlardan aç: izin ister, günlük hatırlatmayı kaydeder, deneme bildirimi gösterir */
export async function enableSysNotify(app) {
  if (!sysNotifySupported()) return 'unsupported';
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission().catch(() => 'denied');
  app.settings.notify = perm === 'granted';
  app.saveSettings();
  if (perm === 'granted') {
    await registerDaily();
    writeNotifyMeta(app, true);
    await showSysNotification('Bildirimler açık ⚽', 'Maç günü ve antrenman hatırlatmaları buraya gelecek.', 'krampon-on');
  }
  return perm;
}

export async function disableSysNotify(app) {
  app.settings.notify = false;
  app.saveSettings();
  writeNotifyMeta(app, true);
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.periodicSync?.unregister('krampon-daily');
  } catch { /* yok */ }
}

let metaTimer = 0;
/** Servis çalışanının hatırlatmada göstereceği özet (birkaç saniyede bir yazılır) */
export function writeNotifyMeta(app, now = false) {
  if (typeof caches === 'undefined' || !sysNotifySupported()) return;
  clearTimeout(metaTimer);
  const run = () => {
    const s = app.state;
    const fx = s?.world ? fixtureFor(s.world, s.career.clubId, s.calendar.week) : null;
    const oppId = fx ? (fx[0] === s.career.clubId ? fx[1] : fx[0]) : null;
    const meta = {
      on: sysNotifyOn(app) && !!s && !s.career?.retired,
      ts: Date.now(),
      title: 'New Football Stars ⚽',
      body: s ? tx(reminderText(s, oppId ? CLUB_BY_ID[oppId]?.name : null)) : '',
    };
    caches.open(META_CACHE).then((c) => c.put(META_URL, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }))).catch(() => {});
  };
  if (now) run();
  else metaTimer = setTimeout(run, 2500);
}
