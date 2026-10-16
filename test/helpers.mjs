import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
export const ARABIC = /[\u0600-\u06FF]/;
const stripPlaceholders = (s) => s.replace(/\{[^}]*\}/g, '');
// Version numbers such as 1.3 or 3.5 are numbers, and names such as security.txt or crt.sh are names: neither is punctuation.
const stripVersions = (s) => s.replace(/\d+(?:\.\d+)+/g, '');
const stripNames = (s) => s.replace(/[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, 'NAME');
const clean = (s) => stripNames(stripVersions(stripPlaceholders(s)));
export const sentencePeriods = (s) => (clean(s).match(/\./g) || []).length;
export const digits = (s) => (stripPlaceholders(s).match(/\d+/g) || []).sort();
const latinTokens = (s) => clean(s).match(/[A-Za-z][A-Za-z0-9/&+-]*/g) || [];

// An Arabic sentence: one period, at the end; clauses joined with connectives, never commas, semicolons or colons.
export function arabicSentence(ar, where) {
  assert.ok(ARABIC.test(ar), `${where}: Arabic text expected`);
  assert.ok(ar.trim().endsWith('.'), `${where}: must end with a period`);
  assert.equal(sentencePeriods(ar), 1, `${where}: a period may only close the sentence`);
  assert.ok(!/[،؛]/.test(ar), `${where}: no Arabic comma or semicolon`);
  assert.ok(!/[,;:]/.test(stripPlaceholders(ar)), `${where}: join clauses with connectives, not Latin punctuation`);
  for (const tok of latinTokens(ar)) assert.match(tok, /^[A-Z0-9]/, `${where}: stray lowercase Latin word "${tok}"`);
}

// An Arabic label, title or question: no period at all, the same punctuation and token rules.
export function arabicLabel(ar, where) {
  assert.ok(ARABIC.test(ar), `${where}: Arabic text expected`);
  assert.equal(sentencePeriods(ar), 0, `${where}: a label carries no period`);
  assert.ok(!/[،؛]/.test(ar), `${where}: no Arabic comma or semicolon`);
  assert.ok(!/[,;:]/.test(stripPlaceholders(ar)), `${where}: no Latin punctuation in a label`);
  for (const tok of latinTokens(ar)) assert.match(tok, /^[A-Z0-9]/, `${where}: stray lowercase Latin word "${tok}"`);
}

export function pair(en, ar, where) {
  assert.ok(en && ar, `${where}: both languages required`);
  assert.ok(!ARABIC.test(en), `${where}: English text contains Arabic`);
  assert.deepEqual(digits(ar), digits(en), `${where}: every number must survive translation`);
}

export function pairs(value, path = '$', out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => pairs(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    if (typeof value.en === 'string' && typeof value.ar === 'string') out.push({ en: value.en, ar: value.ar, path });
    for (const [k, v] of Object.entries(value)) if (k !== 'en' && k !== 'ar') pairs(v, `${path}.${k}`, out);
  }
  return out;
}

const TEXT = new Set(['.js', '.mjs', '.json', '.md', '.html', '.css', '.txt', '.xml', '.svg', '.yml', '.csv', '']);
const SKIP = new Set(['.git', 'node_modules', '.impeccable', '.taste-skill']);
const SKIP_FILES = new Set(['PRODUCT.md', 'DESIGN.md']);

// The files of the project: what git tracks or would add, so the working data of a run (the inventory of names and
// the scanned rows, both ignored) is never read as the project's own text. Outside a git checkout, every file.
export function repoFiles() {
  const git = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  if (git.status === 0 && git.stdout) return [...new Set(git.stdout.split('\0').filter(Boolean))].filter((f) => existsSync(join(root, f)) && !f.split('/').some((part) => SKIP.has(part)) && !SKIP_FILES.has(f));
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) || SKIP_FILES.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(root, p));
    }
  };
  walk(root);
  return out;
}

export function textFiles() {
  return repoFiles().filter((f) => { const name = f.split('/').pop(); return TEXT.has(extname(name)) || ['LICENSE', 'CNAME', '.gitignore', '.nojekyll'].includes(name); });
}

// An offline resolver: answers come from a table keyed "name TYPE", optionally per provider.
export function fakeResolver(table, { providers = {} } = {}) {
  const calls = [];
  return {
    calls,
    stats: { queries: 0, network: 0, failures: 0 },
    async query(name, type, opts = {}) {
      calls.push(`${name} ${type}${opts.provider ? ` @${opts.provider}` : ''}${opts.cd ? ' cd' : ''}`);
      const key = `${name} ${type}`;
      const scoped = opts.provider && providers[opts.provider] && providers[opts.provider][key + (opts.cd ? ' cd' : '')];
      const hit = scoped || table[key + (opts.cd ? ' cd' : '')] || table[key];
      if (!hit) return { status: 'NOERROR', ad: false, answers: [], authority: [], provider: opts.provider || 'cloudflare' };
      if (typeof hit === 'string') return { status: hit, ad: false, answers: [], authority: [], provider: opts.provider || 'cloudflare' };
      return { status: hit.status || 'NOERROR', ad: Boolean(hit.ad), answers: (hit.answers || []).map((d) => ({ name, ttl: 300, data: d, text: type === 'TXT' ? d : undefined })), authority: [], provider: opts.provider || 'cloudflare' };
    },
  };
}
