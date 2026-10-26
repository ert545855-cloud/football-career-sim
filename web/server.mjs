// Krampon — statik sunucu + bulut kayıt API'si (Render Docker servisi için).
// dist/ klasörünü PORT üzerinden sunar; metin dosyalarını gzip'ler,
// hash'li dosyaları uzun süre, sayfa/service worker'ı hiç önbelleklemez.
// /api/cloud/* istekleri server/cloud.mjs'e gider (DATABASE_URL yoksa özellik kapalı döner).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createCloud } from './server/cloud.mjs';

const ROOT = fileURLToPath(new URL('./dist/', import.meta.url));
const PORT = Number(process.env.PORT) || 10000;
const cloud = createCloud();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  // Unity WebGL derlemesi (public/unity/Build)
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.unityweb': 'application/octet-stream',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.wasm', '.data']);
const NO_CACHE = new Set(['/index.html', '/sw.js', '/manifest.webmanifest']);

/** Küçük bellek önbelleği: dosya → { body, gz } */
const cache = new Map();

async function load(file) {
  if (cache.has(file)) return cache.get(file);
  const body = await readFile(file);
  const entry = { body, gz: COMPRESSIBLE.has(extname(file)) && body.length > 1024 ? gzipSync(body) : null };
  cache.set(file, entry);
  return entry;
}

async function resolve(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return null; // dizin dışına çıkma
  try {
    if ((await stat(file)).isFile()) return { file, path: p };
  } catch { /* yok */ }
  // Uzantısız yollar tek sayfalık uygulamaya düşer
  if (!extname(p)) return { file: join(ROOT, 'index.html'), path: '/index.html' };
  return null;
}

const server = createServer(async (req, res) => {
  try {
    if (await cloud.handle(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const hit = await resolve(req.url || '/');
    if (!hit) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bulunamadı');
      return;
    }
    const { body, gz } = await load(hit.file);
    const headers = {
      'Content-Type': MIME[extname(hit.file)] || 'application/octet-stream',
      'Cache-Control': hit.path.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : NO_CACHE.has(hit.path) ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept-Encoding',
    };
    const useGz = gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (useGz) headers['Content-Encoding'] = 'gzip';
    const out = useGz ? gz : body;
    // Video/ses için parça parça (Range) istek desteği: iOS Safari bunsuz video oynatmaz
    if (!useGz) {
      headers['Accept-Ranges'] = 'bytes';
      const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
      if (m && (m[1] !== '' || m[2] !== '')) {
        const size = out.length;
        let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
        let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(size - 1, Number(m[2]));
        if (!(start <= end) || start >= size) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
          return;
        }
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        res.end(req.method === 'HEAD' ? undefined : out.subarray(start, end + 1));
        return;
      }
    }
    headers['Content-Length'] = out.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : out);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end();
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Krampon ${PORT} portunda yayında · bulut kayıt ${cloud.enabled ? 'açık' : 'kapalı'}`));
