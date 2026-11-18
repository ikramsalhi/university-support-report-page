import { createServer as createHttpServer } from 'node:http';
import { randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const categories = new Set(['IT & Digital', 'Registration & Records', 'Academic Support', 'Finance & Scholarships', 'Campus Life', 'Wellbeing & Accessibility', 'Other']);
const priorities = new Set(['Low', 'Normal', 'High']);
const allowedFields = new Set(['fullName', 'studentId', 'email', 'category', 'priority', 'subject', 'description', 'consent']);
const referencePattern = /^SUP-\d{8}-[A-F0-9]{24}$/;
const staticPaths = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/supportpage/index.html', ['supportpage/index.html', 'text/html; charset=utf-8']],
  ['/supportpage/app.js', ['supportpage/app.js', 'text/javascript; charset=utf-8']],
  ['/supportpage/styles.css', ['supportpage/styles.css', 'text/css; charset=utf-8']],
  ['/supportpage/server-client.js', ['supportpage/server-client.js', 'text/javascript; charset=utf-8']],
  ['/supportpage/server-client.css', ['supportpage/server-client.css', 'text/css; charset=utf-8']],
  ['/supportpage/assets/favicon.svg', ['supportpage/assets/favicon.svg', 'image/svg+xml']]
]);

export function readEncryptionKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new Error('DATA_ENCRYPTION_KEY must be a 32-byte base64 value (generate with node:crypto).');
  }
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('DATA_ENCRYPTION_KEY must be 32 random bytes, base64 encoded.');
  return key;
}

function validateRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowedFields.has(key))) return false;
  const fields = ['fullName', 'studentId', 'email', 'category', 'priority', 'subject', 'description'];
  if (fields.some(field => typeof value[field] !== 'string')) return false;
  const { fullName, studentId, email, category, priority, subject, description, consent } = value;
  return fullName.trim().length >= 2 && fullName.trim().length <= 100 &&
    /^[\p{L}\p{M} .'’-]{2,100}$/u.test(fullName.trim()) &&
    /^[A-Za-z0-9-]{3,32}$/.test(studentId.trim()) &&
    email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    categories.has(category) && priorities.has(priority) &&
    subject.trim().length >= 5 && subject.trim().length <= 100 &&
    description.trim().length >= 20 && description.trim().length <= 1200 &&
    consent === true;
}

const digest = token => createHash('sha256').update(token).digest();
function encrypt(key, reference, data) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(reference));
  const dataEncrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return { iv, dataEncrypted, tag: cipher.getAuthTag() };
}
function decrypt(key, row) {
  const decipher = createDecipheriv('aes-256-gcm', key, row.iv);
  decipher.setAAD(Buffer.from(row.reference));
  decipher.setAuthTag(row.tag);
  return JSON.parse(Buffer.concat([decipher.update(row.payload), decipher.final()]).toString('utf8'));
}
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function error(res, status, message) { send(res, status, { error: message }); }

async function readJson(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) {
    const e = new Error('Content-Type must be application/json'); e.status = 415; throw e;
  }
  const limit = 8192;
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) { const e = new Error('Request body is too large'); e.status = 413; throw e; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const e = new Error('Malformed JSON'); e.status = 400; throw e; }
}

export function buildServer({ encryptionKey, databasePath = resolve(root, 'backend/data/tickets.sqlite'), publicOrigin = '' }) {
  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) throw new Error('Provide a 32-byte encryptionKey buffer');
  if (publicOrigin && (!/^https?:\/\//.test(publicOrigin) || new URL(publicOrigin).origin !== publicOrigin)) throw new Error('PUBLIC_ORIGIN must be an origin URL, without trailing slash');
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS requests (
    reference TEXT PRIMARY KEY,
    token_hash BLOB NOT NULL,
    iv BLOB NOT NULL,
    payload BLOB NOT NULL,
    tag BLOB NOT NULL,
    created_at TEXT NOT NULL
  )`);
  const insert = db.prepare('INSERT INTO requests (reference, token_hash, iv, payload, tag, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const select = db.prepare('SELECT * FROM requests WHERE reference = ?');
  const remove = db.prepare('DELETE FROM requests WHERE reference = ?');
  const limits = new Map();
  const server = createHttpServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'");
    if (publicOrigin.startsWith('https://')) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    let path;
    try { path = new URL(req.url, 'http://localhost').pathname; }
    catch { return error(res, 400, 'Invalid URL'); }
    if (path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (req.headers.origin && (req.headers.origin !== (publicOrigin || `http://${req.headers.host}`))) return error(res, 403, 'Origin not allowed');
      if (req.headers['sec-fetch-site'] === 'cross-site') return error(res, 403, 'Cross-site access denied');
      const ip = req.socket.remoteAddress || 'unknown'; // Ignore spoofable X-Forwarded-For.
      const mutating = req.method === 'POST' || req.method === 'DELETE';
      const bucket = (mutating ? 'write:' : 'read:') + ip;
      const now = Date.now(), prior = limits.get(bucket);
      const state = !prior || prior.reset < now ? { count: 0, reset: now + 15 * 60_000 } : prior;
      state.count++;
      limits.set(bucket, state);
      if (limits.size > 10000) for (const [key, entry] of limits) if (entry.reset < now) limits.delete(key);
      res.setHeader('RateLimit-Limit', mutating ? '10' : '60');
      res.setHeader('RateLimit-Remaining', String(Math.max(0, (mutating ? 10 : 60) - state.count)));
      if (state.count > (mutating ? 10 : 60)) {
        res.setHeader('Retry-After', String(Math.ceil((state.reset - now) / 1000)));
        return error(res, 429, 'Too many requests. Please try later.');
      }
      if (req.method === 'GET' && path === '/api/health') return send(res, 200, { status: 'ok', mode: 'backend' });
      if (req.method === 'POST' && path === '/api/requests') {
        try {
          const body = await readJson(req);
          if (!validateRequest(body)) return error(res, 422, 'Invalid request fields');
          const cleaned = Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'consent').map(([key, value]) => [key, value.trim()]));
          const createdAt = new Date().toISOString();
          let reference;
          do { reference = 'SUP-' + createdAt.slice(0, 10).replaceAll('-', '') + '-' + randomBytes(12).toString('hex').toUpperCase(); }
          while (select.get(reference));
          const accessToken = randomBytes(32).toString('base64url');
          const { iv, dataEncrypted, tag } = encrypt(encryptionKey, reference, cleaned);
          insert.run(reference, digest(accessToken), iv, dataEncrypted, tag, createdAt);
          return send(res, 201, { reference, accessToken, createdAt, status: 'Submitted' });
        } catch (e) {
          if (e.status) return error(res, e.status, e.message);
          console.error('Failed to create ticket:', e.code || 'unexpected error');
          return error(res, 500, 'Could not create request');
        }
      }
      const match = /^\/api\/requests\/(SUP-\d{8}-[A-F0-9]{24})$/.exec(path);
      if (match && (req.method === 'GET' || req.method === 'DELETE')) {
        const token = req.headers['x-ticket-key'];
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return error(res, 404, 'Request not found');
        const row = select.get(match[1]);
        if (!row || !timingSafeEqual(digest(token), row.token_hash)) return error(res, 404, 'Request not found');
        if (req.method === 'DELETE') { remove.run(row.reference); return send(res, 200, { deleted: true }); }
        try { return send(res, 200, { reference: row.reference, createdAt: row.created_at, status: 'Submitted', ...decrypt(encryptionKey, row) }); }
        catch { return error(res, 500, 'Unable to read request'); }
      }
      return error(res, 404, 'Not found');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return error(res, 405, 'Method not allowed');
    const entry = staticPaths.get(path);
    if (!entry) return error(res, 404, 'Not found');
    const file = resolve(root, entry[0]);
    if (!existsSync(file)) return error(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-cache' });
    return res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 50;
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const encryptionKey = readEncryptionKey(process.env.DATA_ENCRYPTION_KEY);
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
    const server = buildServer({
      encryptionKey,
      databasePath: process.env.DATABASE_PATH || resolve(root, 'backend/data/tickets.sqlite'),
      publicOrigin: process.env.PUBLIC_ORIGIN || ''
    });
    server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`CampusCare API listening on port ${port}`));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
