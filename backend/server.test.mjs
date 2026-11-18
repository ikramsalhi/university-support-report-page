import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildServer, readEncryptionKey } from './server.mjs';

const good = {
  fullName: 'Student Example', studentId: '2026-12345', email: 'student@example.edu',
  category: 'IT & Digital', priority: 'Normal', subject: 'Cannot access portal',
  description: 'Login shows an error after I enter my university account.', consent: true
};

async function fixture(fn) {
  const folder = mkdtempSync(join(tmpdir(), 'campuscare-'));
  const server = buildServer({ encryptionKey: randomBytes(32), databasePath: join(folder, 'tickets.sqlite'), publicOrigin: 'http://127.0.0.1:3000' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); }
  finally { await new Promise(resolve => server.close(resolve)); rmSync(folder, { recursive: true, force: true }); }
}
const post = (base, payload, headers = {}) => fetch(base + '/api/requests', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload)
});

test('requires a strong encryption key', () => {
  assert.throws(() => readEncryptionKey('demo-secret'));
  const key = randomBytes(32);
  assert.deepEqual(readEncryptionKey(key.toString('base64')), key);
});

test('creates a private request and verifies the ticket key on read and delete', async () => fixture(async base => {
  const created = await post(base, good);
  assert.equal(created.status, 201);
  const payload = await created.json();
  assert.match(payload.reference, /^SUP-\d{8}-[A-F0-9]{24}$/);
  assert.match(payload.accessToken, /^[\w-]{43}$/);
  const path = `${base}/api/requests/${payload.reference}`;
  assert.equal((await fetch(path)).status, 404);
  assert.equal((await fetch(path, { headers: { 'x-ticket-key': randomBytes(32).toString('base64url') } })).status, 404);
  const found = await fetch(path, { headers: { 'x-ticket-key': payload.accessToken } });
  assert.equal(found.status, 200);
  const ticket = await found.json();
  assert.equal(ticket.description, good.description);
  assert.equal(ticket.email, good.email);
  assert.equal(ticket.accessToken, undefined);
  assert.equal((await fetch(path, { method: 'DELETE', headers: { 'x-ticket-key': payload.accessToken } })).status, 200);
  assert.equal((await fetch(path, { headers: { 'x-ticket-key': payload.accessToken } })).status, 404);
}));

test('rejects malformed inputs, cross-site writes and unauthorized listing', async () => fixture(async base => {
  assert.equal((await post(base, { ...good, priority: 'Admin' })).status, 422);
  assert.equal((await post(base, { ...good, isAdmin: true })).status, 422);
  assert.equal((await post(base, { ...good, fullName: '<img src=x>' })).status, 422);
  assert.equal((await post(base, good, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await fetch(base + '/api/requests')).status, 404);
  assert.equal((await fetch(base + '/backend/data/tickets.sqlite')).status, 404);
  const malformed = await fetch(base + '/api/requests', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(malformed.status, 415);
  const giant = await fetch(base + '/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'a'.repeat(9000) });
  assert.equal(giant.status, 413);
}));

test('rate limits repeated invalid ticket creation', async () => fixture(async base => {
  for (let i = 0; i < 10; i++) assert.equal((await post(base, { ...good, consent: false })).status, 422);
  const limited = await post(base, good);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
}));

test('uses secure headers and no cache for API responses', async () => fixture(async base => {
  const response = await fetch(base + '/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
}));
