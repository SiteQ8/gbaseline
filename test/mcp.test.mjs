import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, readJson } from './helpers.mjs';

const SERVER = join(root, 'mcp/server.mjs');
const project = readJson('data/src/project.json');
const prefix = (project.slug || 'observatory').replace(/-/g, '_');

test('mcp selftest passes', () => {
  const r = spawnSync(process.execPath, [SERVER, '--selftest'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /0 failed/);
});

test('mcp answers a JSON-RPC session over stdio', () => {
  const reqs = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: `${prefix}_check_info`, arguments: { check: 'pq_kex', lang: 'ar' } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: `${prefix}_check_domain`, arguments: { domain: 'not a domain' } } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: `${prefix}_overview`, arguments: {} } },
    { jsonrpc: '2.0', id: 6, method: 'nope' },
    { jsonrpc: '2.0', id: 7, method: 'ping' },
  ];
  const r = spawnSync(process.execPath, [SERVER], { input: reqs.map((x) => JSON.stringify(x)).join('\n') + '\n', encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const byId = new Map(lines.map((m) => [m.id, m]));
  assert.equal(lines.length, 7, 'the notification gets no reply');
  assert.equal(byId.get(1).result.protocolVersion, '2025-06-18');
  assert.equal(byId.get(2).result.tools.length, 6);
  assert.ok(!byId.get(2).result.tools.some((t) => /compare/.test(t.name)), 'no tool sets the states side by side');
  for (const t of byId.get(2).result.tools) assert.equal(t.annotations.readOnlyHint, true, `${t.name} read-only`);
  const info = byId.get(3).result.structuredContent;
  assert.ok(/[\u0600-\u06FF]/.test(info.why) && info.passes_when.includes('X25519MLKEM768'));
  assert.ok(!/[,;:]/.test(byId.get(3).result.content[0].text.split('```')[0].replace(/https?:\/\/\S+/g, '').replace(/\([^)]*\)/g, '')), 'the Arabic answer has no Latin commas, semicolons or colons');
  assert.equal(byId.get(4).result.isError, true);
  assert.ok(byId.get(5).result.structuredContent.about);
  assert.equal(byId.get(6).error.code, -32601);
  assert.deepEqual(byId.get(7).result, {});
});

test('README documents every tool by name', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const src = readFileSync(SERVER, 'utf8');
  const names = [...src.matchAll(/name: T\('([a-z_]+)'\)/g)].map((m) => `${prefix}_${m[1]}`);
  assert.equal(new Set(names).size, 6);
  for (const n of names) assert.ok(readme.includes(n), `README mentions ${n}`);
});
