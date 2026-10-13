// BULUT KAYIT İSTEMCİSİ — sunucudaki /api/cloud/* ile konuşur.
// Bağlantı bilgisi (kod, cihaz anahtarı, son eşitlenen sürüm) bu cihazın localStorage'ında durur.
// Otomatik eşitleme: her kayıttan ~15 sn sonra (art arda kayıtlar birleşir) ve uygulama arka plana geçerken.

const KEY = 'krampon.cloud.v1';
const DEBOUNCE_MS = 15000;

function store() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** @returns {{code:string, token:string, rev:number, syncedAt:number|null, conflict?:object|null}|null} */
export function cloudLink() {
  try {
    const v = JSON.parse(store()?.getItem(KEY) || 'null');
    return v && v.code && v.token ? v : null;
  } catch {
    return null;
  }
}

function setLink(v) {
  try {
    if (v) store()?.setItem(KEY, JSON.stringify(v));
    else store()?.removeItem(KEY);
  } catch {
    /* yoksay */
  }
}

async function api(method, path, body, { token, keepalive = false } = {}) {
  let r;
  try {
    r = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      keepalive,
    });
  } catch {
    const e = new Error('İnternet bağlantısı yok.');
    e.status = 0;
    throw e;
  }
  let json = {};
  try {
    json = await r.json();
  } catch {
    /* boş */
  }
  if (!r.ok) {
    const e = new Error(json.error || `Sunucu hatası (${r.status})`);
    e.status = r.status;
    e.data = json;
    throw e;
  }
  return json;
}

let statusCache = null;
/** Sunucuda bulut kayıt açık mı? (oturum boyunca önbelleklenir) */
export async function cloudAvailable() {
  if (statusCache) return statusCache;
  statusCache = api('GET', '/api/cloud/status')
    .then((r) => !!r.enabled)
    .catch(() => false);
  return statusCache;
}

export async function cloudCreate(pin, state) {
  const r = await api('POST', '/api/cloud/create', { pin });
  setLink({ code: r.code, token: r.token, rev: 0, syncedAt: null, conflict: null });
  if (state) await cloudUpload(state);
  return cloudLink();
}

/** Başka cihazdaki hesaba bağlan (kod + PIN). Sunucudaki özeti döner. */
export async function cloudConnect(code, pin) {
  const r = await api('POST', '/api/cloud/link', { code, pin });
  setLink({ code: r.code, token: r.token, rev: 0, syncedAt: null, conflict: null });
  return r;
}

export async function cloudMeta() {
  const l = cloudLink();
  if (!l) return null;
  return api('GET', '/api/cloud/meta', null, { token: l.token });
}

/** Buluttaki kaydı indirir (sürümü bu cihaza işler). */
export async function cloudDownload() {
  const l = cloudLink();
  if (!l) throw new Error('Bulut bağlantısı yok.');
  const r = await api('GET', '/api/cloud/save', null, { token: l.token });
  setLink({ ...l, rev: r.rev, syncedAt: Date.now(), conflict: null });
  return r;
}

/**
 * Kaydı yükler. Bulutta başka cihazdan daha yeni kayıt varsa (409) çakışma işaretlenir ve hata fırlatılır.
 * @param {object} state @param {{force?:boolean, keepalive?:boolean}} [o]
 */
export async function cloudUpload(state, { force = false, keepalive = false } = {}) {
  const l = cloudLink();
  if (!l || !state) return null;
  try {
    const r = await api('PUT', '/api/cloud/save', { baseRev: l.rev, state, force }, { token: l.token, keepalive });
    setLink({ ...l, rev: r.rev, syncedAt: Date.now(), conflict: null });
    return r;
  } catch (e) {
    if (e.status === 409) setLink({ ...l, conflict: e.data });
    if (e.status === 401) setLink(null); // anahtar iptal edilmiş
    throw e;
  }
}

/** Bu cihazın bağlantısını kaldırır (buluttaki kayıt kalır). */
export async function cloudUnlink() {
  const l = cloudLink();
  if (l) await api('POST', '/api/cloud/logout', null, { token: l.token }).catch(() => {});
  setLink(null);
}

/** Buluttaki hesabı ve kaydı tamamen siler. */
export async function cloudDelete() {
  const l = cloudLink();
  if (l) await api('DELETE', '/api/cloud', null, { token: l.token });
  setLink(null);
}

// ─────────────────────────── Otomatik eşitleme ───────────────────────────

let timer = null;
let latest = null;
let busy = false;

/** app.save() her kayıtta çağırır; yükleme seyreltilir. */
export function scheduleCloudSync(state) {
  if (!cloudLink() || cloudLink().conflict) return;
  latest = state;
  clearTimeout(timer);
  timer = setTimeout(() => flushCloudSync(), DEBOUNCE_MS);
}

export async function flushCloudSync({ keepalive = false } = {}) {
  clearTimeout(timer);
  timer = null;
  if (!latest || busy || !cloudLink() || cloudLink().conflict) return;
  const st = latest;
  latest = null;
  busy = true;
  try {
    await cloudUpload(st, { keepalive });
  } catch {
    /* çevrimdışı ya da çakışma: ayarlar ekranında gösterilir */
  } finally {
    busy = false;
  }
}

if (typeof document !== 'undefined') {
  // Uygulama arka plana geçerken bekleyen kaydı hemen gönder
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushCloudSync({ keepalive: true });
  });
}

export function cloudSummaryText(summary, clubName) {
  if (!summary) return 'Boş kayıt';
  return `${summary.name || 'Oyuncu'} · ${clubName || summary.clubId || ''} · Sezon ${summary.season}, Hafta ${summary.week}`;
}
