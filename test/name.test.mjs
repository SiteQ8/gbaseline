import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { root } from './helpers.mjs';
import { parseSecurityTxt } from '../docs/assets/engine/records.js';
import { validate, TOKENS } from '../scripts/name.mjs';
import { expiryFor, RENEW_DAYS } from '../scripts/site-files.mjs';

const SKIP = new Set(['.git', 'node_modules', '.impeccable', '.taste-skill']);
const sample = ['--en', 'Example', '--ar', 'مثال', '--slug', 'example-site', '--domain', 'Example.3li.info', '--repo', 'SiteQ8/Example', '--no-og'];

function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (SKIP.has(name)) continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p)] = readFileSync(p).toString('base64');
    }
  };
  walk(dir);
  return out;
}

test('the name script refuses incomplete or malformed values', () => {
  assert.ok(validate({}).problems.length >= 4);
  assert.match(validate({ en: 'مثال', ar: 'مثال', slug: 'x', domain: 'x.org' }).problems.join(), /--en/);
  assert.match(validate({ en: 'X', ar: 'X', slug: 'x', domain: 'x.org' }).problems.join(), /--ar/);
  assert.match(validate({ en: 'X', ar: 'مثال', slug: 'Bad Slug', domain: 'x.org' }).problems.join(), /--slug/);
  assert.match(validate({ en: 'X', ar: 'مثال', slug: 'x', domain: 'not a host' }).problems.join(), /--domain/);
  assert.deepEqual(validate({ en: 'X', ar: 'مثال', slug: 'x', domain: 'https://A.Example.org/path' }).values.domain, 'a.example.org');
  assert.equal(validate({ en: 'X', ar: 'مثال', slug: 'x', domain: 'a.example.org' }).values.repo, 'SiteQ8/x');
});

test('naming writes every file that depends on the name, passes the release build and is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'name-'));
  try {
    cpSync(root, dir, { recursive: true, filter: (src) => !SKIP.has(src.split(/[\\/]/).pop()) });
    for (const f of ['docs/data/summary.json', 'docs/data/history.json']) rmSync(join(dir, f), { force: true });
    const run = () => spawnSync(process.execPath, [join(dir, 'scripts/name.mjs'), ...sample], { cwd: dir, encoding: 'utf8' });
    const first = run();
    assert.equal(first.status, 0, first.stdout + first.stderr);
    const read = (p) => readFileSync(join(dir, p), 'utf8');
    const project = JSON.parse(read('data/src/project.json'));
    assert.deepEqual([project.name_en, project.name_ar, project.slug, project.domain, project.repo], ['Example', 'مثال', 'example-site', 'example.3li.info', 'https://github.com/SiteQ8/Example']);
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.name, 'example-site');
    assert.deepEqual(pkg.bin, { 'example-site': 'bin/cli.mjs' });
    assert.equal(pkg.homepage, 'https://example.3li.info');
    assert.equal(pkg.repository.url, 'git+https://github.com/SiteQ8/Example.git');
    const readme = read('README.md');
    for (const t of TOKENS) assert.ok(!readme.includes(t), `README still holds ${t}`);
    assert.ok(readme.includes('npx -y github:SiteQ8/Example check example.com'));
    assert.ok(readme.includes('`example_site_check_domain`') && !readme.includes('observatory_'), 'MCP tool names follow the slug');
    assert.equal(read('docs/CNAME'), 'example.3li.info\n');
    assert.match(read('docs/robots.txt'), /^Sitemap: https:\/\/example\.3li\.info\/sitemap\.xml$/m);
    assert.match(read('docs/sitemap.xml'), /<loc>https:\/\/example\.3li\.info\/<\/loc>/);
    const st = parseSecurityTxt(read('docs/.well-known/security.txt'));
    assert.ok(st.valid, st.problems.join());
    assert.deepEqual(st.contact, ['https://github.com/SiteQ8/Example/security/advisories/new']);
    assert.ok(new Date(st.expires) - Date.now() > RENEW_DAYS * 86400000, 'security.txt is good for more than the renewal window');
    const html = read('docs/index.html');
    assert.match(html, /<title>مثال · [^<]+<\/title>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.3li\.info\/">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/example\.3li\.info\/og\.png">/);
    assert.ok(!/\sstyle=|<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>[^<]/.test(html), 'still no inline styles or scripts');
    assert.match(read('docs/en/index.html'), /<link rel="canonical" href="https:\/\/example\.3li\.info\/en\/">/, 'every page carries the new name');
    const bundle = JSON.parse(read('docs/data/bundle.json'));
    assert.equal(bundle.project.slug, 'example-site', 'the bundle carries the name');
    const before = snapshot(dir);
    const second = run();
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.deepEqual(snapshot(dir), before, 'a second run with the same values changes nothing');
    assert.ok(existsSync(join(dir, 'docs/.well-known/security.txt')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('security.txt keeps its expiry until fewer than the renewal days remain, then moves a year ahead', () => {
  const now = new Date('2026-10-19T08:00:00Z');
  const file = (expires) => `Contact: https://github.com/o/r/security/advisories/new\nExpires: ${expires}\n`;
  assert.equal(expiryFor(file('2027-06-01T00:00:00.000Z'), now), '2027-06-01T00:00:00.000Z');
  assert.equal(expiryFor(file('2027-01-10T00:00:00.000Z'), now), '2027-10-19T00:00:00.000Z');
  assert.equal(expiryFor('', now), '2027-10-19T00:00:00.000Z');
  assert.equal(expiryFor(file('2025-01-01T00:00:00.000Z'), now), '2027-10-19T00:00:00.000Z', 'an expired file is renewed');
});
