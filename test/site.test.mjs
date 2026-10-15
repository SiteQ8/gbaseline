import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, textFiles, readJson } from './helpers.mjs';
import { parseSecurityTxt } from '../docs/assets/engine/records.js';
import { readText, PROVENANCE_KEY } from '../scripts/og.mjs';

const read = (p) => readFileSync(join(root, p), 'utf8');
const html = read('docs/index.html');
const app = read('docs/assets/app.js');
const css = read('docs/assets/styles.css') + read('docs/assets/fonts.css');
const project = readJson('data/src/project.json');

test('the page declares a strict CSP whose only outside connections are the two resolvers', () => {
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /default-src 'self'; script-src 'self'; style-src 'self'/);
  assert.match(csp, /connect-src 'self' https:\/\/cloudflare-dns\.com https:\/\/dns\.google;/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.ok(!/unsafe-/.test(csp));
});

test('Arabic first, right to left, own assets only, no inline code or styles', () => {
  assert.match(html, /<html lang="ar" dir="rtl">/);
  for (const a of ['assets/app.js', 'assets/styles.css', 'assets/fonts.css', 'favicon.svg']) assert.ok(html.includes(a), a);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>[^<]/.test(html), 'no inline script');
  assert.ok(!/\sstyle=/.test(html), 'no inline style attributes');
  assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(html), 'no inline handlers');
  assert.ok(!/style=|\.innerHTML|insertAdjacentHTML|document\.write|eval\(/.test(app), 'app builds nodes, never markup strings or style attributes');
  assert.ok(!/url\(\s*['"]?https?:/.test(css), 'fonts and images are self-hosted');
  const remote = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !project.domain || !u.startsWith(`https://${project.domain}/`));
  assert.deepEqual(remote, [], 'no remote assets in the page');
});

test('the published folder is complete', () => {
  const need = ['docs/.nojekyll', 'docs/favicon.svg', 'docs/fonts/OFL.txt', 'docs/data/bundle.json', 'LICENSE', 'NOTICE.md', 'README.md', 'SECURITY.md', 'CHANGELOG.md'];
  if (project.domain) need.push('docs/CNAME', 'docs/robots.txt', 'docs/sitemap.xml', 'docs/og.png');
  for (const f of need) assert.ok(existsSync(join(root, f)), f);
  for (const m of css.matchAll(/url\('\.\.\/fonts\/([^']+)'\)/g)) assert.ok(existsSync(join(root, 'docs/fonts', m[1])), m[1]);
  if (project.domain) assert.equal(read('docs/CNAME').trim(), project.domain);
});

test('once named, the site files agree with the name and the share card carries its provenance', { skip: !project.domain && 'no name yet' }, () => {
  const st = parseSecurityTxt(read('docs/.well-known/security.txt'));
  assert.ok(st.valid, `security.txt: ${st.problems.join(', ')}`);
  assert.match(read('docs/.well-known/security.txt'), new RegExp(`^Canonical: https://${project.domain.replace(/\./g, '\\.')}/\\.well-known/security\\.txt$`, 'm'));
  assert.ok(read('docs/robots.txt').includes(`Sitemap: https://${project.domain}/sitemap.xml`));
  assert.ok(read('docs/sitemap.xml').includes(`<loc>https://${project.domain}/</loc>`));
  assert.ok(html.includes(`<link rel="canonical" href="https://${project.domain}/">`));
  assert.ok(html.includes(`<meta property="og:image" content="https://${project.domain}/og.png">`));
  const png = readFileSync(join(root, 'docs/og.png'));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], 'the share card is 1200 by 630');
  assert.match(readText(png)[PROVENANCE_KEY] || '', /^Origin: /, 'the share card says how it was made');
});

test('house style holds in every text file', () => {
  const dash = /[\u2010-\u2015]/;
  const banned = new RegExp(['cla' + 'ude', 'anthro' + 'pic', '\\bnb' + 'k\\b', 'co-authored' + '-by'].join('|'), 'i');
  for (const f of textFiles()) {
    const s = read(f);
    assert.ok(!dash.test(s), `${f}: no Unicode dashes`);
    assert.ok(!banned.test(s), `${f}: no tool or employer attribution`);
  }
});

test('no published file names a domain', () => {
  for (const f of ['docs/data/summary.json', 'docs/data/history.json', 'docs/data/open/latest.csv', 'docs/data/open/history.csv']) {
    if (!existsSync(join(root, f))) continue;
    const s = read(f);
    assert.ok(!/"d"\s*:/.test(s) && !/[a-z0-9-]\.(gov|edu|ac)\.(kw|sa|ae|qa|bh|om)\b/.test(s), `${f} carries totals only`);
  }
  assert.ok(!existsSync(join(root, 'docs/data/hall.json')), 'no list of named domains is published');
  assert.ok(!/hall/i.test(app), 'the site has no page that lists domains by name');
});
