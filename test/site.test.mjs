import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, textFiles, readJson, pairs, pair, arabicLabel } from './helpers.mjs';
import { parseSecurityTxt } from '../docs/assets/engine/records.js';
import { readText, PROVENANCE_KEY } from '../scripts/og.mjs';
import { loadData, renderSite, checkSite, CSP } from '../scripts/prerender.mjs';
import { routes, pathOf, LANGS } from '../docs/assets/views.js';

const read = (p) => readFileSync(join(root, p), 'utf8');
const html = read('docs/index.html');
const views = read('docs/assets/views.js');
const site = read('docs/assets/site.js');
const css = read('docs/assets/styles.css') + read('docs/assets/fonts.css');
const project = readJson('data/src/project.json');
const ui = readJson('data/src/ui.json');
const { pictures } = readJson('data/src/pictures.json');

// Every page the printer wrote, as paths under docs/.
function pages() {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (!['assets', 'fonts', 'img', 'data'].includes(n)) walk(p); } else if (n.endsWith('.html')) out.push(relative(join(root, 'docs'), p)); } };
  walk(join(root, 'docs'));
  return out;
}

test('every page is printed from the data, and the printed pages are current', () => {
  const data = loadData(root);
  const want = Object.keys(renderSite(data)).filter((f) => f.endsWith('.html')).sort();
  assert.deepEqual(pages().sort(), want, 'the pages on disk are exactly the pages the data prints');
  const { stale, extra } = checkSite(renderSite(data), join(root, 'docs'));
  assert.deepEqual([...stale, ...extra], [], 'run node scripts/prerender.mjs');
  assert.ok(want.length >= 2 * (1 + 1 + 6 + 1 + 13 + 3), 'both languages, the home page, the states, the standards, the check, the method and the issues');
});

test('every page declares the same strict CSP, whose only outside connections are the two resolvers', () => {
  assert.match(CSP, /default-src 'self'; script-src 'self'; style-src 'self'/);
  assert.match(CSP, /connect-src 'self' https:\/\/cloudflare-dns\.com https:\/\/dns\.google;/);
  assert.match(CSP, /object-src 'none'/);
  assert.match(CSP, /base-uri 'self'/);
  assert.match(CSP, /form-action 'self'/, 'the check form posts to this site only');
  assert.ok(!/unsafe-/.test(CSP));
  for (const p of pages()) assert.ok(read(`docs/${p}`).includes(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`), p);
});

test('Arabic at the root and English under /en/, own assets only, no inline code or styles', () => {
  for (const p of pages()) {
    const h = read(`docs/${p}`);
    const en = p.startsWith('en/');
    assert.match(h, en ? /<html lang="en" dir="ltr">/ : /<html lang="ar" dir="rtl">/, p);
    for (const a of ['/assets/site.js', '/assets/styles.css', '/assets/fonts.css', '/favicon.svg']) assert.ok(h.includes(a), `${p}: ${a}`);
    const scripts = [...h.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1]);
    assert.ok(scripts.every((attrs) => /type="application\/ld\+json"/.test(attrs)), `${p}: the only inline script is the dataset description, which never runs`);
    assert.ok(!/\sstyle=/.test(h), `${p}: no inline style attributes`);
    assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(h), `${p}: no inline handlers`);
    const remote = [...h.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => /\.(js|css|woff2?|jpe?g|png|svg)(\?|$)/.test(u));
    assert.deepEqual(remote, [], `${p}: no remote assets`);
    for (const m of h.matchAll(/(?:src|href)="(\/(?:assets|fonts|img|data)\/[^"#?]+)"/g)) assert.ok(existsSync(join(root, 'docs', m[1])), `${p}: ${m[1]} exists`);
  }
  for (const code of [views, site]) assert.ok(!/style=|\.innerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/.test(code), 'pages are built as trees of nodes, never markup strings, style attributes or eval');
  assert.ok(!/url\(\s*['"]?https?:/.test(css), 'fonts and images are self-hosted');
});

test('every page can be found: canonical, both languages, the sitemap and the dataset', { skip: !project.domain && 'no name yet' }, () => {
  const data = loadData(root);
  const all = routes(data.B, data.D);
  const sitemap = read('docs/sitemap.xml');
  for (const r of all) {
    for (const lang of LANGS) {
      const url = `https://${project.domain}${pathOf(lang, r.rel)}`;
      const h = read(`docs/${pathOf(lang, r.rel).slice(1)}index.html`);
      assert.ok(h.includes(`<link rel="canonical" href="${url}">`), `${url} names itself`);
      for (const l of LANGS) assert.ok(h.includes(`<link rel="alternate" hreflang="${l}" href="https://${project.domain}${pathOf(l, r.rel)}">`), `${url} links its ${l} version`);
      assert.ok(sitemap.includes(`<loc>${url}</loc>`), `${url} is in the sitemap`);
    }
  }
  for (const p of ['index.html', 'en/index.html']) {
    const ld = JSON.parse(read(`docs/${p}`).match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
    assert.equal(ld['@type'], 'Dataset');
    for (const k of ['name', 'alternateName', 'description', 'license', 'creator', 'spatialCoverage', 'variableMeasured', 'distribution']) assert.ok(ld[k], `${p}: the dataset has ${k}`);
    assert.equal(ld.spatialCoverage.length, 6, 'the six states');
    for (const d of ld.distribution) assert.ok(existsSync(join(root, 'docs', new URL(d.contentUrl).pathname)), `${d.contentUrl} exists`);
  }
  assert.ok(existsSync(join(root, 'docs/404.html')), 'a page for addresses that do not exist');
  assert.match(read('docs/404.html'), /<meta name="robots" content="noindex">/);
});

test('the published folder is complete', () => {
  const need = ['docs/.nojekyll', 'docs/favicon.svg', 'docs/fonts/OFL.txt', 'docs/data/bundle.json', 'LICENSE', 'NOTICE.md', 'README.md', 'SECURITY.md', 'CHANGELOG.md', 'CITATION.cff'];
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
  assert.ok(html.includes(`<meta property="og:image" content="https://${project.domain}/og.png">`));
  const png = readFileSync(join(root, 'docs/og.png'));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], 'the share card is 1200 by 630');
  const note = readText(png)[PROVENANCE_KEY] || '';
  assert.match(note, /^Origin: /, 'the share card says how it was made');
  for (const p of pictures) assert.ok(note.includes(String(p.commons)), `the share card names the source of the photograph of ${p.state}`);
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
  const named = /[a-z0-9-]\.(gov|edu|ac|sch|med|com|co|org|net)\.(kw|sa|ae|qa|bh|om)\b/;
  for (const f of ['docs/data/summary.json', 'docs/data/history.json', 'docs/data/open/latest.csv', 'docs/data/open/history.csv', ...pages().map((p) => `docs/${p}`)]) {
    if (!existsSync(join(root, f))) continue;
    const s = read(f);
    assert.ok(!/"d"\s*:/.test(s) && !named.test(s), `${f} carries totals only`);
  }
  assert.ok(!existsSync(join(root, 'docs/data/hall.json')), 'no list of named domains is published');
  assert.ok(!spawnSync('git', ['ls-files', 'data/inventory'], { cwd: root, encoding: 'utf8' }).stdout.trim(), 'the inventory of names is never committed');
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

test('one NASA night photograph for each state, credited in both languages and inside every file', () => {
  const dir = join(root, 'docs/img');
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f));
  const listed = pictures.flatMap((p) => Object.values(p.files).map((v) => v.file));
  assert.deepEqual(files.sort(), [...listed].sort(), 'every picture on disk is in the register, and every one in the register is on disk');
  assert.deepEqual(pictures.map((p) => p.state).sort(), Object.keys(readJson('data/src/scope.json').countries).sort(), 'one for each state');
  for (const p of pictures) {
    for (const k of ['alt', 'caption', 'credit']) { pair(p[k].en, p[k].ar, `${p.state}.${k}`); arabicLabel(p[k].ar, `${p.state}.${k}`); }
    assert.ok(p.alt.en.length > 30, `${p.state}: the alt text says what the picture shows`);
    for (const v of Object.values(p.files)) {
      const notes = jpegComments(readFileSync(join(dir, v.file))).filter((c) => c.startsWith(`${PROVENANCE_KEY}\0`));
      assert.equal(notes.length, 1, `${v.file} carries one origin note`);
      assert.match(notes[0], new RegExp(`\\0Origin: photograph of .+ at night, taken from the International Space Station by the NASA Expedition ${p.expedition} crew .+ public domain, from Wikimedia Commons page ${p.commons} .+ Not generated\\.$`), `${v.file} names its source and licence`);
    }
    assert.ok(read('NOTICE.md').includes(`curid=${p.commons}`), `NOTICE.md credits the photograph of ${p.state}`);
  }
});

test('one typeface under the Open Font License, and nothing that sets the states side by side', () => {
  const families = new Set([...css.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]));
  assert.deepEqual([...families].sort(), ['Alexandria']);
  assert.match(read('docs/fonts/OFL.txt'), /Alexandria: Copyright/);
  for (const p of pages()) for (const m of read(`docs/${p}`).matchAll(/rel="preload" href="(\/fonts\/[^"]+)"/g)) assert.ok(existsSync(join(root, 'docs', m[1])), `${m[1]} is preloaded and exists`);
  assert.ok(!/compare|ranking/i.test(views), 'the site has no comparison of states');
});

test('every word the pages use is written in both languages', () => {
  const used = new Set([...views.matchAll(/\bt[l]?\('([a-z0-9_]+)'/g), ...site.matchAll(/\bt\('([a-z0-9_]+)'/g)].map((m) => m[1]));
  for (const k of used) assert.ok(ui[k], `ui.json has ${k}`);
  assert.ok(pairs(ui).length > 150, 'the interface strings are read as pairs');
});
