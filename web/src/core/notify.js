// BİLDİRİMLER — oyun içi bildirim merkezi: kariyer haberleri (addNews, okunmamış takibiyle) ve süren
// durumlardan doğan uyarılar (okunmamış Chirp, bekleyen sponsor teklifi). Saf veri: DOM yok, testlerde çalışır.

const KIND_ICON = { good: 'trophy', bad: 'bandage', info: 'bell' };

/** Okunmamış sınırı: bu kimliğe kadar olan haberler okundu */
export function ensureNotify(state) {
  const c = state.career;
  if (c.newsSeq == null) {
    // eski kayıt: mevcut haberlere kimlik ver, hepsi okunmuş sayılsın
    let id = 0;
    for (let i = c.news.length - 1; i >= 0; i--) c.news[i].id ??= ++id;
    c.newsSeq = id;
    c.newsSeen = id;
  }
  c.newsSeen ??= 0;
  return c;
}

/** Süren durumlardan doğan uyarılar (okununca kaybolmaz; durum bitince kaybolur) */
export function notifAlerts(state) {
  const out = [];
  const chirp = state.chirp?.unread || 0;
  if (chirp > 0) out.push({ key: 'chirp', icon: 'chirp', kind: 'info', text: `Chirp'te ${chirp} okunmamış bildirim var`, go: 'chirp', n: chirp });
  const sp = state.sponsors?.offers?.length || 0;
  if (sp > 0) out.push({ key: 'sponsor', icon: 'coin', kind: 'good', text: `${sp} sponsor teklifi seni bekliyor`, go: 'sponsors', n: sp });
  return out;
}

/** Bildirim listesi: önce uyarılar, sonra en yeni haberler */
export function notifList(state, limit = 30) {
  const c = ensureNotify(state);
  const news = c.news.slice(0, limit).map((n) => ({
    key: `n${n.id}`, id: n.id, icon: KIND_ICON[n.kind] || 'bell', kind: n.kind || 'info', text: n.text,
    when: { s: n.s, w: n.w }, unread: (n.id || 0) > c.newsSeen,
  }));
  return [...notifAlerts(state).map((a) => ({ ...a, alert: true, unread: true })), ...news];
}

/** Rozet sayısı: okunmamış haberler + uyarılar */
export function unreadNotifs(state) {
  if (!state?.career) return 0;
  const c = ensureNotify(state);
  const news = c.news.filter((n) => (n.id || 0) > c.newsSeen).length;
  return news + notifAlerts(state).length;
}

export function markNotifsRead(state) {
  const c = ensureNotify(state);
  c.newsSeen = c.newsSeq || 0;
}

/** Cihaz bildirimi için kısa özet (servis çalışanı hatırlatmada gösterir) */
export function reminderText(state, nextOpp) {
  const p = state.player;
  if (state.flags?.injuredWeeks > 0) return `${p.name}: sakatlık süreci sürüyor, tedaviye devam!`;
  if (nextOpp) return `Hafta ${state.calendar.week}: ${nextOpp} maçı seni bekliyor. Hazırlığını yap!`;
  return `${p.name}, kariyerin seni bekliyor. Antrenman zamanı!`;
}
