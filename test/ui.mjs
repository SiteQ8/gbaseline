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

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const PORT = Number(process.env.PORT || 8911);
const shots = process.env.SHOTS || '';
const scope = JSON.parse(readFileSync(join(root, 'data/src/scope.json'), 'utf8'));

// A synthetic issue: twelve domains spread over the six states, every state seen at least once.
const R = (state, level) => ({ state, level });
const all = (state, level) => Object.fromEntries(CHECKS.map((c) => [c.id, R(state, level)]));
const good = { ...all('pass', 'valid'), dmarc: R('pass', 'reject'), spf: R('pass', 'strict'), dnssec: R('pass', 'validated'), pq_kex: R('pass', 'hybrid'), security_txt: R('pass', 'valid') };
const weak = { ...all('fail', 'missing'), dnssec: R('fail', 'unsigned'), https: R('pass', 'valid'), tls13: R('pass', 'supported'), pq_kex: R('fail', 'classical') };
const rows = [];
const codes = Object.keys(scope.countries);
codes.forEach((c, i) => {
  rows.push({ d: `good${i}.gov.${c.toLowerCase()}`, c, s: 'government', dns: 'live', agree: true, r: compact(i % 2 ? good : { ...good, dnssec: R('fail', 'chain-unavailable') }) });
  rows.push({ d: `weak${i}.edu.${c.toLowerCase()}`, c, s: 'education', dns: 'live', agree: true, r: compact(weak) });
});
const { summary } = aggregate(rows, scope, { date: '2026-10-19', chain: Object.fromEntries(scope.suffixes.map((s) => [s.suffix, !/\.(ae|qa|om)$/.test(s.suffix)])), seconds: 1234, resolver: { queries: 98765 } });
summary.issue = 2;
const previous = { ...summary, date: '2026-10-12' };
const history = appendHistory(appendHistory([], previous), summary);

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', join(root, 'docs')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--no-sandbox'] });
const errors = [];
const ARABIC = /[\u0600-\u06FF]/;
const STRAY = /\b(null|undefined|NaN|\[object Object\])\b/;
const pageText = (pg, exclude = []) => pg.evaluate((ex) => {
  const clone = document.body.cloneNode(true);
  for (const sel of [...ex, 'script', 'noscript', 'code', 'pre', 'bdi', '[lang="en"]', '[dir="ltr"]']) clone.querySelectorAll(sel).forEach((n) => n.remove());
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
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/data/summary.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(summary) }));
  await page.route('**/data/history.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(history) }));
  await page.route(/https:\/\/(cloudflare-dns\.com|dns\.google)\/.*/, (r) => r.fulfill({ contentType: 'application/dns-json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(dohAnswer(r.request().url())) }));
  return page;
}

try {
  const page = await preparePage({ width: 1440, height: 1000 });
  await page.goto(`http://localhost:${PORT}/?lang=ar#/`, { waitUntil: 'networkidle' });
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  await page.waitForSelector('#c1 .figure');
  assert.match(await page.textContent('.issue-line'), /العدد 2/);
  const lead = await page.textContent('#c1');
  assert.match(lead, /50٪/, 'six of twelve domains lack enforced DMARC');
  assert.match(lead, /6 من أصل 12 نطاقاً ضمن القياس/, 'the basis line uses the Arabic counted form');
  // The citation slip opens and carries both languages.
  await page.click('#c1 .cite');
  const slip = page.locator('#c1 .slip');
  assert.ok(await slip.isVisible());
  assert.match(await slip.locator('blockquote[lang="ar"]').textContent(), /المصدر .* في البند 1 من العدد 2 لأسبوع 19 أكتوبر 2026 على http/);
  assert.match(await slip.locator('blockquote[lang="en"]').textContent(), /Source: .*, issue 2, clause 1, week of 19 October 2026, http/);
  assert.match(await slip.locator('blockquote[lang="ar"] bdi').textContent(), /\?lang=ar#\/\?c=1$/, 'the Arabic citation links to clause 1 in Arabic, isolated from the right to left text');
  assert.match(await slip.locator('blockquote[lang="en"] bdi').textContent(), /\?lang=en#\/\?c=1$/);
  assert.match(await page.locator('#c2 .slip blockquote[lang="ar"] .q').textContent(), /من مواقع نطاقات الحكومة والتعليم في الخليج/, 'a quoted clause names whose websites it counts');
  // Scope: Kuwait, government only.
  await page.click('label:has(input[name="place"][value="KW"])');
  await page.click('label:has(input[name="sector"][value="government"])');
  assert.match(page.url(), /p=KW&s=government/);
  assert.match(await page.textContent('#c1'), /0٪ من نطاقات الجهات الحكومية في الكويت/);
  assert.equal(await page.locator('table.reg').first().locator('tbody tr:not(.group)').count(), CHECKS.length);
  assert.ok(await page.locator('#wk-cap').count(), 'two issues give a week by week table');
  const regDmarc = (await page.locator('table:has(#reg-cap) tbody tr:not(.group)').first().locator('td.here').textContent()).trim();
  const wkDmarc = (await page.locator('table.wk.wide tbody tr').first().locator('td').first().textContent()).trim();
  assert.equal(wkDmarc, regDmarc, 'the week by week DMARC column shows the same passing share as the register');
  if (shots) await page.screenshot({ path: `${shots}/ui-desktop-ar.png`, fullPage: true });
  const latin = ((await pageText(page, ['#lang'])).match(/[A-Za-z][A-Za-z0-9.\-/:+&]*/g) || []).filter((w) => !/^[A-Z0-9]/.test(w) && !w.includes('.') && !/^https?:/.test(w));
  assert.deepEqual(latin, [], 'no lowercase English inside the Arabic page');
  assert.ok(!STRAY.test(await pageText(page)), 'no stray null, undefined or NaN in the Arabic page');
  const NOT_JOINED = /\.\s+[وف]/;
  assert.ok(!NOT_JOINED.test(await pageText(page)), 'no Arabic sentence is cut by a period before its connective');
  // Every other view renders.
  for (const [hash, expect] of [['#/countries', /الكويت/], ['#/countries/SA', /السعودية/], ['#/checks', /الحماية من انتحال البريد/], ['#/checks/pq_kex', /X25519MLKEM768/], ['#/method', /مصادر الأسماء/]]) {
    await page.goto(`http://localhost:${PORT}/?lang=ar${hash}`, { waitUntil: 'networkidle' });
    assert.match(await page.textContent('main'), expect, hash);
    assert.ok(!STRAY.test(await pageText(page)), `${hash}: no stray null, undefined or NaN`);
    assert.ok(!NOT_JOINED.test(await pageText(page)), `${hash}: no Arabic sentence is cut by a period before its connective`);
  }
  await page.goto(`http://localhost:${PORT}/?lang=ar#/hall`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#c1').count(), 1, 'an old link to a removed page lands on this week');
  assert.equal(await page.locator('#sections a').count(), 5, 'five sections: this week, countries, checks, check a domain, method');
  // The live check, with the resolvers mocked.
  await page.goto(`http://localhost:${PORT}/?lang=ar#/domain`, { waitUntil: 'networkidle' });
  await page.fill('#domain-input', 'https://Example.com/path');
  await page.click('.check-form button');
  await page.waitForSelector('.result h2');
  assert.equal(await page.textContent('.result h2'), 'example.com');
  assert.equal(await page.locator('.res li.pass').count() >= 3, true, 'DMARC, SPF and DNSSEC pass');
  assert.ok(!STRAY.test(await page.textContent('.result')), 'the result prints no stray null');
  assert.match(page.url(), /#\/domain\?d=example\.com/);
  await page.fill('#domain-input', 'gone.gov.kw');
  await page.click('.check-form button');
  await page.waitForFunction(() => /غير موجود/.test(document.querySelector('.status').textContent));
  await page.fill('#domain-input', 'not a domain');
  await page.click('.check-form button');
  assert.match(await page.textContent('.status'), /أدخل اسم نطاق صحيحاً/);
  // English.
  await page.goto(`http://localhost:${PORT}/#/`, { waitUntil: 'networkidle' });
  await page.click('#lang');
  assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
  assert.match(await page.textContent('#c1'), /of government domains in Kuwait can be impersonated in email/);
  const leak = (await pageText(page, ['#lang', '[lang="ar"]'])).split(/\s+/).filter((w) => ARABIC.test(w));
  assert.deepEqual(leak, [], 'no Arabic inside the English page');
  assert.ok(!STRAY.test(await pageText(page)), 'no stray null, undefined or NaN in the English page');
  if (shots) await page.screenshot({ path: `${shots}/ui-desktop-en.png`, fullPage: true });
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const lang of ['en', 'ar']) {
      await page.goto(`http://localhost:${PORT}/?lang=${lang}#/`, { waitUntil: 'networkidle' });
      const clipped = await page.evaluate(() => { const s = document.querySelector('.register .table-scroll'); return s.scrollWidth - s.clientWidth; });
      assert.ok(clipped <= 1, `${lang} at ${width}: Table 1 shows every column without scrolling (${clipped}px hidden)`);
    }
  }
  // A phone: no sideways scroll on any view, the register shows the Gulf and one chosen country.
  const phone = await preparePage({ width: 390, height: 860 }, 2);
  for (const hash of ['#/', '#/countries/KW', '#/checks/dmarc', '#/domain', '#/method']) {
    await phone.goto(`http://localhost:${PORT}/?lang=ar${hash}`, { waitUntil: 'networkidle' });
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${hash}: no sideways scroll on a phone (overflow ${overflow}px)`);
  }
  await phone.goto(`http://localhost:${PORT}/?lang=ar#/?p=GCC&s=all`, { waitUntil: 'networkidle' });
  const visibleCols = await phone.locator('table:has(#reg-cap) thead th:visible').count();
  assert.equal(visibleCols, 3, 'check, the Gulf and the compared country');
  assert.ok(await phone.locator('table.wk.narrow').isVisible() && !(await phone.locator('table.wk.wide').isVisible()), 'a phone gets the week by week table on its side');
  const wkOver = await phone.evaluate(() => { const t = document.querySelector('table.wk.narrow'); return t.getBoundingClientRect().width - t.parentElement.getBoundingClientRect().width; });
  assert.ok(wkOver <= 1, `the week by week table fits a phone (${wkOver}px over)`);
  if (shots) await phone.screenshot({ path: `${shots}/ui-mobile-ar.png`, fullPage: true });
  // Before the first issue the site says so instead of breaking.
  const empty = await browser.newPage();
  empty.on('pageerror', (e) => errors.push(e.message));
  await empty.route('**/data/summary.json', (r) => r.fulfill({ status: 404, body: '' }));
  await empty.route('**/data/history.json', (r) => r.fulfill({ status: 404, body: '' }));
  await empty.goto(`http://localhost:${PORT}/?lang=ar#/`, { waitUntil: 'networkidle' });
  assert.match(await empty.textContent('main'), /العدد الأول قيد القياس/);
  assert.deepEqual(errors, [], 'no console errors');
  console.log('ui: all checks passed');
} finally {
  await browser.close();
  server.kill();
}
