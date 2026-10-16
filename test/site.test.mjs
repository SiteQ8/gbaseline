import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

// A JPEG comment segment written right after the start of image, keyed like the share card's PNG chunk.
function jpegComments(buf) {
  const out = [];
  for (let i = 2; i + 4 <= buf.length && buf[i] === 0xff;) {
    const marker = buf[i + 1];
    if (marker === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xfe) out.push(buf.toString('latin1', i + 4, i + 2 + len));
    i += 2 + len;
  }
  return out;
}

test('every picture on the site is the NASA photograph and says so inside the file', () => {
  const dir = join(root, 'docs/img');
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f));
  assert.ok(files.length >= 4, 'the page carries real pictures');
  for (const f of files) {
    const notes = jpegComments(readFileSync(join(dir, f))).filter((c) => c.startsWith(`${PROVENANCE_KEY}\0`));
    assert.equal(notes.length, 1, `${f} carries one origin note`);
    assert.match(notes[0], /\0Origin: photograph of the Gulf at night .* NASA .* public domain/, `${f} names its source and licence`);
    assert.ok(!/Persian/i.test(notes[0]), `${f}: the origin note names the Gulf as the site does`);
  }
  for (const m of app.matchAll(/img\/([a-z0-9-]+\.(?:jpe?g|png|webp|avif))/g)) assert.ok(files.includes(m[1]), `the app refers to img/${m[1]}, which exists`);
});

test('two typefaces, both under the Open Font License, and nothing that sets the states side by side', () => {
  const families = new Set([...css.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]));
  assert.deepEqual([...families].sort(), ['Alexandria', 'El Messiri']);
  const ofl = read('docs/fonts/OFL.txt');
  assert.match(ofl, /El Messiri: Copyright/);
  assert.match(ofl, /Alexandria: Copyright/);
  for (const m of html.matchAll(/rel="preload" href="(fonts\/[^"]+)"/g)) assert.ok(existsSync(join(root, 'docs', m[1])), `${m[1]} is preloaded and exists`);
  assert.ok(!/compare|ranking/i.test(app), 'the site has no comparison of states');
});
