// Browser checks of the site in both languages, on a desktop and a phone, against a synthetic issue built by the
// real aggregator and served by route interception, with the DNS resolvers mocked. Run: npm run test:ui
// (needs Playwright; set PW_MODULE and PW_CHROME when they are not on the default paths).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { aggregate, appendHistory } from '../src/aggregate.mjs';
import { compact } from '../src/scan.mjs';
import { CHECKS } from '../docs/assets/engine/checks.js';
import { CLAUSES } from '../docs/assets/engine/clauses.js';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const PORT = Number(process.env.PORT || 8911);
const shots = process.env.SHOTS || '';
const scope = JSON.parse(readFileSync(join(root, 'data/src/scope.json'), 'utf8'));
const ui = JSON.parse(readFileSync(join(root, 'data/src/ui.json'), 'utf8'));

// A synthetic issue: twelve domains spread over the six states, every state seen at least once.
const R = (state, level) => ({ state, level });
const all = (state, level) => Object.fromEntries(CHECKS.map((c) => [c.id, R(state, level)]));
const good = { ...all('pass', 'valid'), dmarc: R('pass', 'reject'), spf: R('pass', 'strict'), dnssec: R('pass', 'validated'), pq_kex: R('pass', 'hybrid'), security_txt: R('pass', 'valid'), legacy_tls: R('pass', 'refused'), hsts: R('pass', 'one-year') };
const weak = { ...all('fail', 'missing'), dnssec: R('fail', 'unsigned'), https: R('pass', 'valid'), tls13: R('pass', 'supported'), pq_kex: R('fail', 'classical'), legacy_tls: R('fail', 'tls10') };
const rows = [];
const codes = Object.keys(scope.countries);
codes.forEach((c, i) => {
  rows.push({ d: `good${i}.gov.${c.toLowerCase()}`, c, s: 'government', dns: 'live', agree: true, r: compact(i % 2 ? good : { ...good, dnssec: R('fail', 'chain-unavailable') }) });
  rows.push({ d: `weak${i}.edu.${c.toLowerCase()}`, c, s: 'education', dns: 'live', agree: true, r: compact(weak) });
});
const { summary } = aggregate(rows, scope, { date: '2026-10-19', chain: Object.fromEntries(scope.suffixes.map((s) => [s.suffix, !/\.(ae|qa|om)$/.test(s.suffix)])), seconds: 1234, resolver: { queries: 98765 } });
summary.issue = 2;
// The week before, with one Kuwaiti education domain fixed, so a cited earlier issue reads differently.
const before = aggregate(rows.map((r) => (r.d === 'weak0.edu.kw' ? { ...r, r: compact(good) } : r)), scope, { date: '2026-10-12', chain: {} }).summary;
const history = appendHistory(appendHistory([], before), summary);

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', join(root, 'docs')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--no-sandbox'] });
const errors = [];
const ARABIC = /[؀-ۿ]/;
const STRAY = /\b(null|undefined|NaN|\[object Object\])\b/;
const NOT_JOINED = /\.\s+[وف]/;
const pageText = (pg, exclude = []) => pg.evaluate((ex) => {
  const clone = document.body.cloneNode(true);
  for (const sel of [...ex, 'script', 'noscript', 'code', 'pre', 'bdi', '[lang="en"]', '[dir="ltr"]', '[hidden]']) clone.querySelectorAll(sel).forEach((n) => n.remove());
  return clone.textContent;
}, exclude);

// DNS over HTTPS answers for the live check: example.com is well configured, everything else does not exist.
function dohAnswer(url) {
  const u = new URL(url);
  const name = (u.searchParams.get('name') || '').replace(/\.$/, '');
  const type = Number(u.searchParams.get('type'));
  const google = u.hostname === 'dns.google';
  const txt = (v) => (google ? v : `"${v}"`);
  const table = {
    'example.com|6': { Status: 0, AD: true },
    'example.com|15': { Status: 0, AD: true, Answer: [{ name, type: 15, TTL: 60, data: '10 mail.example.com.' }] },
    'example.com|16': { Status: 0, AD: true, Answer: [{ name, type: 16, TTL: 60, data: txt('v=spf1 mx -all') }] },
    '_dmarc.example.com|16': { Status: 0, AD: true, Answer: [{ name, type: 16, TTL: 60, data: txt('v=DMARC1; p=reject') }] },
    'example.com|1': { Status: 0, AD: true, Answer: [{ name, type: 1, TTL: 60, data: '192.0.2.1' }] },
  };
  if (name.endsWith('example.com') || name === 'com') return table[`${name}|${type}`] || { Status: 0, AD: true };
  return { Status: 3, AD: false };
}

async function preparePage(viewport, scale = 1) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/data/summary.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(summary) }));
  await page.route('**/data/history.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(history) }));
  await page.route(/https:\/\/(cloudflare-dns\.com|dns\.google)\/.*/, (r) => r.fulfill({ contentType: 'application/dns-json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(dohAnswer(r.request().url())) }));
  return page;
}
const go = (page, path) => page.goto(`http://localhost:${PORT}/${path}`, { waitUntil: 'networkidle' });

try {
  const page = await preparePage({ width: 1440, height: 1000 });
  await go(page, '?lang=ar#/');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  await page.waitForSelector('#c1 .fig');
  // The card: the name, the headline in two lines, the action, the issue and the way to the other language.
  assert.equal((await page.textContent('h1.hero-title')).replace(/\s+/g, ' ').trim(), `${ui.hero_title_1.ar} ${ui.hero_title_2.ar}`);
  assert.equal(await page.locator('.split.home .btn').getAttribute('href'), '#/domain');
  assert.match(await page.textContent('.card-foot'), /العدد 2 لأسبوع 19 أكتوبر 2026/);
  assert.equal(await page.locator('.scale i').first().count(), 1, 'the card carries its measuring scale');
  assert.equal(await page.locator('.night img').getAttribute('src'), 'img/gulf-night-1600.jpg');
  assert.match(await page.textContent('.night figcaption'), /ناسا/, 'the photograph is credited where it is shown');
  // The ledger: the Gulf only, six clauses aligned on the decimal point.
  assert.equal(await page.locator('.figures .row').count(), CLAUSES.length);
  assert.equal((await page.textContent('#c1 .fig')).trim(), '50.0', 'six of twelve domains lack enforced DMARC');
  assert.match(await page.textContent('#c1 .basis'), /6 من أصل 12 نطاقاً ضمن القياس/, 'the basis line uses the Arabic counted form');
  assert.match(await page.textContent('#c1 .what'), /يمكن انتحال أسمائها/);
  assert.equal(await page.locator('input[type=radio][name^="place"]').count(), 0, 'the home page has no switch between states');
  for (const c of codes) assert.ok(!(await page.textContent('.ledger')).includes(scope.countries[c].ar), `the ledger never names ${scope.countries[c].en}`);
  // The citation slip stays folded until asked for, then carries both languages and the issue in its link.
  const slip = page.locator('#c1 .slip-inline');
  assert.equal(await slip.isVisible(), false, 'a citation slip is folded until its button is pressed');
  await page.click('#c1 .cite');
  assert.ok(await slip.isVisible());
  assert.match(await slip.locator('blockquote[lang="ar"]').textContent(), /المصدر .* في البند 1 من العدد 2 لأسبوع 19 أكتوبر 2026 على http/);
  assert.match(await slip.locator('blockquote[lang="en"]').textContent(), /Source: .*, issue 2, clause 1, week of 19 October 2026, http/);
  assert.match(await slip.locator('blockquote[lang="ar"] bdi').textContent(), /\?lang=ar#\/\?i=2&c=1$/, 'the Arabic citation links to clause 1 of issue 2 in Arabic, isolated from the right to left text');
  assert.match(await slip.locator('blockquote[lang="en"] bdi').textContent(), /\?lang=en#\/\?i=2&c=1$/);
  assert.match(await slip.locator('blockquote[lang="ar"] .q').textContent(), /^50\.0٪ من النطاقات المقيسة في الخليج يمكن انتحال أسمائها/);
  // The showcase slips copy the full citation.
  await page.locator('.slips .slip').first().locator('button').first().click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /^50\.0٪ من النطاقات المقيسة في الخليج .*\nالمصدر .* على https?:\/\/\S+\?lang=ar#\/\?i=2&c=1$/s, 'the slip copies the sentence and its source');
  // Sector: government only, kept in the address.
  await page.click('label:has(input[value="government"])');
  assert.match(page.url(), /s=government/);
  assert.equal((await page.textContent('#c1 .fig')).trim(), '0.0', 'every government domain in the issue enforces DMARC');
  assert.match(await page.textContent('.ledger'), /نطاقات الجهات الحكومية في الخليج/);
  // The weekly table agrees with the ledger.
  await page.click('label:has(input[value="all"])');
  assert.equal(await page.locator('table.wk tbody tr').count(), CLAUSES.length, 'two issues give a week by week table');
  assert.equal((await page.locator('table.wk tbody tr').first().locator('td').first().textContent()).trim(), '50.0٪', 'the weekly table shows the same share as the ledger');
  if (shots) await page.screenshot({ path: `${shots}/ui-desktop-ar.png`, fullPage: true });
  const latin = ((await pageText(page, ['#lang'])).match(/[A-Za-z][A-Za-z0-9.\-/:+&]*/g) || []).filter((w) => !/^[A-Z0-9]/.test(w) && !w.includes('.') && !/^https?:/.test(w));
  assert.deepEqual(latin, [], 'no lowercase English inside the Arabic page');
  assert.ok(!STRAY.test(await pageText(page)), 'no stray null, undefined or NaN in the Arabic page');
  assert.ok(!NOT_JOINED.test(await pageText(page)), 'no Arabic sentence is cut by a period before its connective');
  // A citation of an earlier issue reopens that issue's figures, with a way to the latest.
  await go(page, '?lang=ar#/?i=1&c=1');
  assert.match(await page.textContent('.past'), /تعرض هذه الأرقام العدد 1 لأسبوع 12 أكتوبر 2026 كما اقتُبس بينما صدر بعده العدد 2/);
  assert.equal((await page.textContent('#c1 .fig')).trim(), '41.7', 'issue 1 had five of twelve domains open to impersonation');
  assert.ok(await page.locator('#c1.stamped').count(), 'the cited clause is marked');
  // Every other view renders, and a state's page shows that state alone.
  for (const [hash, expect] of [['#/countries', /الكويت/], ['#/countries/SA', /أين تقف السعودية/], ['#/checks', /الحماية من انتحال البريد/], ['#/checks/pq_kex', /X25519MLKEM768/], ['#/method', /مصادر الأسماء/]]) {
    await go(page, `?lang=ar${hash}`);
    assert.match(await page.textContent('main'), expect, hash);
    assert.ok(!STRAY.test(await pageText(page)), `${hash}: no stray null, undefined or NaN`);
    assert.ok(!NOT_JOINED.test(await pageText(page)), `${hash}: no Arabic sentence is cut by a period before its connective`);
    assert.equal(await page.locator('#sections a').count(), 5, `${hash}: five sections, this week, countries, checks, check a domain, method`);
  }
  await go(page, '?lang=ar#/countries/SA');
  const saText = await page.textContent('main');
  for (const c of codes.filter((x) => x !== 'SA')) assert.ok(!saText.includes(scope.countries[c].ar), `the Saudi page never names ${scope.countries[c].en}`);
  assert.equal(await page.locator('.table-sheet thead th').count(), 3, 'the state table has the check, its share and its counts, no other place');
  await go(page, '?lang=ar#/hall');
  assert.equal(await page.locator('#c1').count(), 1, 'an old link to a removed page lands on this week');
  // The live check, with the resolvers mocked, reached from the reply card.
  await go(page, '?lang=ar#/');
  await page.fill('#reply-input', 'https://Example.com/path');
  await page.click('.reply-card button[type=submit]');
  await page.waitForSelector('.result h2');
  assert.equal(await page.textContent('.result h2'), 'example.com');
  assert.ok(await page.locator('.res li.pass').count() >= 3, 'DMARC, SPF and DNSSEC pass');
  assert.ok(!STRAY.test(await page.textContent('.result')), 'the result prints no stray null');
  assert.match(page.url(), /#\/domain\?d=example\.com/);
  await page.fill('#domain-input', 'gone.gov.kw');
  await page.click('.check-form button');
  await page.waitForFunction(() => /غير موجود/.test(document.querySelector('.status').textContent));
  await page.fill('#domain-input', 'not a domain');
  await page.click('.check-form button');
  assert.match(await page.textContent('.status'), /أدخل اسم نطاق صحيحاً/);
  // English.
  await go(page, '#/');
  await page.click('#lang');
  assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
  assert.match(await page.textContent('#c1'), /percent can be impersonated in email/);
  assert.equal((await page.textContent('h1.hero-title')).replace(/\s+/g, ' ').trim(), `${ui.hero_title_1.en} ${ui.hero_title_2.en}`);
  const leak = (await pageText(page, ['#lang', '[lang="ar"]'])).split(/\s+/).filter((w) => ARABIC.test(w));
  assert.deepEqual(leak, [], 'no Arabic inside the English page');
  assert.ok(!STRAY.test(await pageText(page)), 'no stray null, undefined or NaN in the English page');
  if (shots) await page.screenshot({ path: `${shots}/ui-desktop-en.png`, fullPage: true });
  // A phone: no sideways scroll on any view, the card follows the photograph, the slips stack.
  const phone = await preparePage({ width: 390, height: 860 }, 2);
  for (const hash of ['#/', '#/countries/KW', '#/checks/dmarc', '#/domain', '#/method']) {
    await go(phone, `?lang=ar${hash}`);
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${hash}: no sideways scroll on a phone (overflow ${overflow}px)`);
  }
  await go(phone, '?lang=ar#/');
  const [photo, card] = await Promise.all(['.night', '.split.home .card'].map((s) => phone.locator(s).boundingBox()));
  assert.ok(photo.y < card.y && card.y < photo.y + photo.height, 'on a phone the photograph comes first and the card overlaps its lower edge');
  const slipBoxes = await phone.locator('.slips .slip').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
  assert.ok(slipBoxes.every((x) => Math.abs(x - slipBoxes[0]) < 24), 'the slips stack on a phone instead of running off the edge');
  const wkOver = await phone.evaluate(() => { const t = document.querySelector('table.wk'); return t.getBoundingClientRect().width - t.closest('.table-scroll').getBoundingClientRect().width; });
  assert.ok(wkOver <= 1, `the week by week table fits a phone (${wkOver}px over)`);
  if (shots) await phone.screenshot({ path: `${shots}/ui-mobile-ar.png`, fullPage: true });
  // Before the first issue the site says so instead of breaking.
  const empty = await browser.newPage();
  empty.on('pageerror', (e) => errors.push(e.message));
  await empty.route('**/data/summary.json', (r) => r.fulfill({ status: 404, body: '' }));
  await empty.route('**/data/history.json', (r) => r.fulfill({ status: 404, body: '' }));
  await go(empty, '?lang=ar#/');
  assert.match(await empty.textContent('main'), /العدد الأول قيد القياس/);
  assert.ok(!STRAY.test(await pageText(empty)), 'no stray null before the first issue');
  assert.deepEqual(errors.filter((e) => !/404/.test(e)), [], 'no console errors');
  console.log('ui: all checks passed');
} finally {
  await browser.close();
  server.kill();
}
