// BULUT KAYIT API'si — Postgres'te kariyer kaydı saklar (Render Postgres ya da herhangi bir DATABASE_URL).
//
// Hesap modeli (e-posta / parola yok):
//   • Oluştur: oyuncu 4–6 haneli bir PIN seçer → sunucu "KRMP" tarzı 8 karakterlik bir kod üretir.
//   • Bu cihaz rastgele bir cihaz anahtarı (token) alır; otomatik eşitleme yalnızca bu anahtarla yapılır.
//   • Başka cihaz: kod + PIN ile bağlanır, kendi anahtarını alır. 5 yanlış PIN → kod 15 dk kilitlenir.
// Saklama: PIN scrypt + tuz ile, cihaz anahtarları SHA-256 ile; kayıt gzip'lenmiş JSON.
// Çakışma: her yükleme "baseRev" gönderir; sunucudaki sürüm daha yeniyse 409 döner (istemci seçer).
import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';

const scrypt = promisify(scryptCb);

export const LIMITS = {
  bodyBytes: 2 * 1024 * 1024,
  maxFails: 5,
  lockMinutes: 15,
  perMinute: 60,
  linkPerWindow: 12,
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan karakterler (0/O, 1/I) yok
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export function makeCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Kullanıcının yazdığı kodu normalize eder ("abcd efgh" → "ABCD-EFGH") */
export function normalizeCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 8 || [...s].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export const validPin = (pin) => typeof pin === 'string' && /^\d{4,6}$/.test(pin);

async function hashPin(pin, salt) {
  const buf = await scrypt(pin, salt, 32);
  return buf.toString('hex');
}

/** Kayıt özeti (sunucu tarafında, istemciye güvenmeden) */
export function summarize(state) {
  const p = state.player || {};
  const c = state.career || {};
  const cal = state.calendar || {};
  const stats = p.stats ? Object.values(p.stats).filter((v) => typeof v === 'number') : [];
  return {
    name: String(p.name || '').slice(0, 40),
    clubId: String(c.clubId || '').slice(0, 16),
    season: Number(cal.season) || 1,
    week: Number(cal.week) || 1,
    age: Number(p.age) || null,
    phase: String(cal.phase || '').slice(0, 12),
    avg: stats.length ? Math.round(stats.reduce((a, b) => a + b, 0) / stats.length) : null,
  };
}

export function validState(state) {
  return !!state && typeof state === 'object' && !Array.isArray(state) && typeof state.player === 'object' && typeof state.career === 'object';
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS krampon_cloud (
  code TEXT PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  data BYTEA,
  rev INTEGER NOT NULL DEFAULT 0,
  summary JSONB,
  failed INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS krampon_cloud_tokens (
  token_hash TEXT PRIMARY KEY,
  code TEXT NOT NULL REFERENCES krampon_cloud(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS krampon_cloud_tokens_code ON krampon_cloud_tokens(code);
`;

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Basit bellek içi hız sınırlayıcı (IP başına kayan pencere) */
function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
    return arr.length <= max;
  };
}

/**
 * @param {{databaseUrl?:string, pool?:any}} opts  pool verilirse (testler) onu kullanır
 */
export function createCloud({ databaseUrl = process.env.DATABASE_URL, pool: givenPool = null } = {}) {
  const enabled = !!(databaseUrl || givenPool);
  let pool = givenPool;
  let ready = null;
  const perMinute = limiter(LIMITS.perMinute, 60_000);
  const linkLimit = limiter(LIMITS.linkPerWindow, LIMITS.lockMinutes * 60_000);

  async function db() {
    if (!enabled) throw new HttpError(503, 'Bulut kayıt bu sunucuda kapalı.');
    if (!pool) {
      const { default: pg } = await import('pg');
      // Render iç adresi SSL istemez; dış adres (…render.com) ister
      const ssl = /render\.com|sslmode=require/.test(databaseUrl) || process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false;
      pool = new pg.Pool({ connectionString: databaseUrl, ssl, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8_000 });
      pool.on('error', (e) => console.error('[cloud] pg havuz hatası', e.message));
    }
    if (!ready) ready = pool.query(SCHEMA).catch((e) => { ready = null; throw e; });
    await ready;
    return pool;
  }

  async function auth(req) {
    const h = req.headers.authorization || '';
    const m = /^Bearer ([a-f0-9]{64})$/.exec(h);
    if (!m) throw new HttpError(401, 'Cihaz anahtarı eksik.');
    const p = await db();
    const r = await p.query('UPDATE krampon_cloud_tokens SET last_used = now() WHERE token_hash = $1 RETURNING code', [sha256(m[1])]);
    if (!r.rowCount) throw new HttpError(401, 'Bu cihazın bağlantısı geçersiz. Kod ve PIN ile yeniden bağlan.');
    return r.rows[0].code;
  }

  async function issueToken(p, code) {
    const token = randomBytes(32).toString('hex');
    await p.query('INSERT INTO krampon_cloud_tokens (token_hash, code) VALUES ($1, $2)', [sha256(token), code]);
    return token;
  }

  const meta = (row) => ({ code: row.code, rev: row.rev, summary: row.summary, updatedAt: row.updated_at });

  const routes = {
    'GET /api/cloud/status': async () => {
      if (!enabled) return { enabled: false };
      try {
        const p = await db();
        await p.query('SELECT 1');
        return { enabled: true };
      } catch (e) {
        console.error('[cloud] durum', e.message);
        return { enabled: false, error: 'Veritabanına ulaşılamıyor.' };
      }
    },

    'POST /api/cloud/create': async (req, body) => {
      if (!validPin(body?.pin)) throw new HttpError(400, 'PIN 4–6 haneli bir sayı olmalı.');
      const p = await db();
      const salt = randomBytes(16).toString('hex');
      const pinHash = await hashPin(body.pin, salt);
      for (let i = 0; i < 6; i++) {
        const code = makeCode();
        const r = await p.query('INSERT INTO krampon_cloud (code, pin_hash, pin_salt) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING', [code, pinHash, salt]);
        if (r.rowCount) return { code, token: await issueToken(p, code), rev: 0 };
      }
      throw new HttpError(500, 'Kod üretilemedi, tekrar dene.');
    },

    'POST /api/cloud/link': async (req, body, ip) => {
      if (!linkLimit(ip)) throw new HttpError(429, 'Çok fazla deneme. Biraz sonra tekrar dene.');
      const code = normalizeCode(body?.code);
      if (!code || !validPin(body?.pin)) throw new HttpError(400, 'Kod ya da PIN hatalı.');
      const p = await db();
      const r = await p.query('SELECT * FROM krampon_cloud WHERE code = $1', [code]);
      if (!r.rowCount) throw new HttpError(403, 'Kod ya da PIN hatalı.');
      const row = r.rows[0];
      if (row.locked_until && new Date(row.locked_until) > new Date()) throw new HttpError(429, `Çok fazla yanlış PIN. ${LIMITS.lockMinutes} dakika sonra tekrar dene.`);
      const ok = timingSafeEqual(Buffer.from(await hashPin(body.pin, row.pin_salt), 'hex'), Buffer.from(row.pin_hash, 'hex'));
      if (!ok) {
        const fails = row.failed + 1;
        if (fails >= LIMITS.maxFails) await p.query(`UPDATE krampon_cloud SET failed = 0, locked_until = now() + interval '${LIMITS.lockMinutes} minutes' WHERE code = $1`, [code]);
        else await p.query('UPDATE krampon_cloud SET failed = $2 WHERE code = $1', [code, fails]);
        throw new HttpError(403, 'Kod ya da PIN hatalı.');
      }
      await p.query('UPDATE krampon_cloud SET failed = 0, locked_until = NULL WHERE code = $1', [code]);
      return { token: await issueToken(p, code), ...meta(row) };
    },

    'GET /api/cloud/meta': async (req) => {
      const code = await auth(req);
      const r = await (await db()).query('SELECT code, rev, summary, updated_at FROM krampon_cloud WHERE code = $1', [code]);
      return meta(r.rows[0]);
    },

    'GET /api/cloud/save': async (req) => {
      const code = await auth(req);
      const r = await (await db()).query('SELECT code, rev, summary, updated_at, data FROM krampon_cloud WHERE code = $1', [code]);
      const row = r.rows[0];
      if (!row.data) throw new HttpError(404, 'Bulutta henüz kayıt yok.');
      return { ...meta(row), state: JSON.parse(gunzipSync(row.data).toString('utf8')) };
    },

    'PUT /api/cloud/save': async (req, body) => {
      const code = await auth(req);
      if (!validState(body?.state)) throw new HttpError(400, 'Geçersiz kayıt.');
      const baseRev = Number(body.baseRev) || 0;
      const p = await db();
      const data = gzipSync(Buffer.from(JSON.stringify(body.state), 'utf8'));
      const summary = summarize(body.state);
      // Çakışma kontrolü tek sorguda: yalnızca rev eşleşiyorsa (ya da force) yazar
      const r = await p.query(
        `UPDATE krampon_cloud SET data = $2, summary = $3, rev = rev + 1, updated_at = now()
         WHERE code = $1 AND ($4::boolean OR rev = $5) RETURNING code, rev, summary, updated_at`,
        [code, data, summary, !!body.force, baseRev],
      );
      if (r.rowCount) return meta(r.rows[0]);
      const cur = await p.query('SELECT code, rev, summary, updated_at FROM krampon_cloud WHERE code = $1', [code]);
      throw new HttpError(409, 'Bulutta başka bir cihazdan daha yeni bir kayıt var.', meta(cur.rows[0]));
    },

    'POST /api/cloud/logout': async (req) => {
      await auth(req);
      const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization);
      await (await db()).query('DELETE FROM krampon_cloud_tokens WHERE token_hash = $1', [sha256(m[1])]);
      return { ok: true };
    },

    'DELETE /api/cloud': async (req) => {
      const code = await auth(req);
      await (await db()).query('DELETE FROM krampon_cloud WHERE code = $1', [code]);
      return { ok: true };
    },
  };

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > LIMITS.bodyBytes) {
          reject(new HttpError(413, 'Kayıt çok büyük.'));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve(null);
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new HttpError(400, 'Geçersiz JSON.'));
        }
      });
      req.on('error', reject);
    });
  }

  function send(req, res, status, obj) {
    const body = Buffer.from(JSON.stringify(obj));
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    const gz = body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const out = gz ? gzipSync(body) : body;
    if (gz) headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = out.length;
    res.writeHead(status, headers).end(out);
  }

  /** server.mjs: /api/ ile başlayan istekler buraya gelir. true dönerse yanıtlandı. */
  async function handle(req, res) {
    const path = (req.url || '').split('?')[0];
    if (!path.startsWith('/api/')) return false;
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const route = routes[`${req.method} ${path}`];
    try {
      if (!route) throw new HttpError(404, 'Bulunamadı.');
      if (!perMinute(ip)) throw new HttpError(429, 'Çok fazla istek. Biraz yavaşla.');
      const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : null;
      if (body && typeof body !== 'object') throw new HttpError(400, 'Geçersiz istek.');
      send(req, res, 200, await route(req, body, ip));
    } catch (e) {
      if (e instanceof HttpError) send(req, res, e.status, { error: e.message, ...e.extra });
      else {
        console.error('[cloud]', e);
        send(req, res, 500, { error: 'Sunucu hatası.' });
      }
    }
    return true;
  }

  return { handle, enabled, close: () => pool?.end?.() };
}
