// Browser checks of the printed site in both languages, on a desktop and a phone, against a synthetic issue built by
// the real aggregator and printed by the real printer into a temporary folder, with the DNS resolvers mocked.
// Run: npm run test:ui (needs Playwright; set PW_MODULE and PW_CHROME when they are not on the default paths).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync, mkdtempSync, cpSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { aggregate, appendHistory } from '../src/aggregate.mjs';
import { aggregateReadiness } from '../src/readiness.mjs';
import { compact } from '../src/scan.mjs';
import { CHECKS } from '../docs/assets/engine/checks.js';
import { CLAUSES } from '../docs/assets/engine/clauses.js';
import { renderSite, writeSite } from '../scripts/prerender.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const PORT = Number(process.env.PORT || 8911);
const shots = process.env.SHOTS || '';
const scope = JSON.parse(readFileSync(join(root, 'data/src/scope.json'), 'utf8'));
const ui = JSON.parse(readFileSync(join(root, 'data/src/ui.json'), 'utf8'));
const B = JSON.parse(readFileSync(join(root, 'docs/data/bundle.json'), 'utf8'));
const pictures = JSON.parse(readFileSync(join(root, 'data/src/pictures.json'), 'utf8')).pictures;

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

// A synthetic readiness census over the same states: every site announces something, one exploited vulnerability
// in PHP is followed, and an earlier census the week before gives the series a first point.
const sw = (p, f = []) => ({ p, f });
const crows = [];
codes.forEach((c, i) => {
  crows.push({ d: `good${i}.gov.${c.toLowerCase()}`, c, s: 'government', dns: 'live', web: 'ok', sw: sw([['apache', '2.4.41'], ['php', i % 2 ? '8.1.2' : '8.3.1']]) });
  crows.push({ d: `weak${i}.edu.${c.toLowerCase()}`, c, s: 'education', dns: 'live', web: 'ok', sw: sw([['nginx', '1.18.0'], ['php', '7.4.3'], ['wordpress', '6.4.2']]) });
  crows.push({ d: `quiet${i}.edu.${c.toLowerCase()}`, c, s: 'education', dns: 'live', web: 'ok', sw: sw([], ['cloudflare']) });
});
const refs = {
  kev: [
    { cve: 'CVE-2026-1001', product: 'php', vendor: 'PHP Group', productName: 'PHP', name: 'PHP-CGI OS Command Injection Vulnerability', description: 'x', added: '2026-10-20', due: '2026-11-10', ransomware: 'Known', notes: ['https://www.php.net/ChangeLog-8.php'], ranges: [{ product: 'php', start: '8.1.0', startIncluded: true, end: '8.1.31', endIncluded: false }] },
    { cve: 'CVE-2026-2002', product: 'tomcat', vendor: 'Apache', productName: 'Tomcat', name: 'Apache Tomcat Path Equivalence Vulnerability', description: 'x', added: '2026-04-01', due: '2026-04-22', ransomware: 'Unknown', notes: [], ranges: [{ product: 'tomcat', start: '9.0.0', startIncluded: true, end: '9.0.99', endIncluded: false }] },
  ],
  cycles: { php: [{ cycle: '8.3', eol: '2027-12-31', latest: '8.3.26', support: '2025-12-31' }, { cycle: '8.1', eol: '2025-12-31', latest: '8.1.33', support: '2023-11-25' }, { cycle: '7.4', eol: '2022-11-28', latest: '7.4.33', support: '2021-11-28' }], apache: [{ cycle: '2.4', eol: false, latest: '2.4.65', support: true }], nginx: [{ cycle: '1.18', eol: '2021-04-20', latest: '1.18.0', support: false }], wordpress: [{ cycle: '6.4', eol: true, latest: '6.4.7', support: false }] },
  sources: { kev: { url: 'x', fetched: '2026-10-23T05:10:00.000Z', version: '2026.10.22', count: 1480 }, nvd: { url: 'x', fetched: '2026-10-23T05:11:00.000Z', asked: 1 }, eol: { url: 'x', fetched: '2026-10-23T05:12:00.000Z', products: 4 } },
};
const firstCensus = aggregateReadiness(crows, scope, refs, { date: '2026-10-21', run: 'census', seconds: 600 });
const readiness = aggregateReadiness(crows.filter((r) => !r.d.startsWith('good1')), scope, refs, { date: '2026-10-23', run: 'watch', previous: firstCensus, seconds: 540 });

// The site printed from this issue into a folder of its own, beside the real assets.
function printSite(D) {
  const dir = mkdtempSync(join(tmpdir(), 'gbaseline-ui-'));
  for (const f of ['assets', 'fonts', 'img', 'favicon.svg', 'og.png']) cpSync(join(root, 'docs', f), join(dir, f), { recursive: true });
  mkdirSync(join(dir, 'data'), { recursive: true });
  cpSync(join(root, 'docs/data/bundle.json'), join(dir, 'data/bundle.json'));
  if (D.summary) {
    writeFileSync(join(dir, 'data/summary.json'), JSON.stringify(D.summary));
    writeFileSync(join(dir, 'data/history.json'), JSON.stringify(D.history));
  }
  if (D.readiness) writeFileSync(join(dir, 'data/readiness.json'), JSON.stringify(D.readiness));
  writeSite(renderSite({ B, D, pictures }), dir);
  return dir;
}
const site = printSite({ summary, history, readiness });
const empty = printSite({ summary: null, history: [], readiness: null });

const serve = (dir, port) => spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir], { stdio: 'ignore' });
const servers = [serve(site, PORT), serve(empty, PORT + 1)];
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--no-sandbox', '--proxy-bypass-list=127.0.0.1;localhost'] });
const errors = [];
const ARABIC = /[؀-ۿ]/;
const STRAY = /\b(null|undefined|NaN|\[object Object\])\b/;
const NOT_JOINED = /\.\s+[وف]/;
const pageText = (pg, exclude = []) => pg.evaluate((ex) => {
  const clone = document.body.cloneNode(true);
  for (const sel of [...ex, 'script', 'code', 'pre', 'bdi', '[lang="en"]', '[dir="ltr"]', '[hidden]', '.slip']) clone.querySelectorAll(sel).forEach((n) => n.remove());
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
  await page.route(/https:\/\/(cloudflare-dns\.com|dns\.google)\/.*/, (r) => r.fulfill({ contentType: 'application/dns-json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(dohAnswer(r.request().url())) }));
  return page;
}
const go = (page, path, port = PORT) => page.goto(`http://127.0.0.1:${port}/${path}`, { waitUntil: 'networkidle' });
const host = `https://${B.project.domain}`;

try {
  const page = await preparePage({ width: 1440, height: 1000 });
  await go(page, '');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  // The cover: the six states at night, the title in two lines on the axis, the issue and the one action.
  assert.equal(await page.locator('.mosaic img').count(), codes.length, 'the masthead shows the six states');
  for (const img of await page.locator('.mosaic img').all()) assert.ok((await img.getAttribute('alt')).length > 10, 'every photograph says what it shows');
  assert.equal((await page.textContent('.cover h1')).replace(/\s+/g, ' ').trim(), `${ui.title_1.ar} ${ui.title_2.ar}`);
  assert.equal(await page.locator('.cover .btn').getAttribute('href'), '/check/');
  assert.match(await page.textContent('.standfirst'), /العدد 2 الصادر في 19 أكتوبر 2026/);
  assert.match(await page.textContent('.lede'), /من 12 نطاقاً حياً في الخليج العربي يمكن انتحال 50\.0٪ منها في البريد/);
  // Six figures for the Arabian Gulf, every sector printed, one shown at a time behind its tab.
  assert.equal(await page.locator('.panel[data-sector="all"] .clauses li').count(), CLAUSES.length);
  assert.equal((await page.textContent('#c1 .v')).trim(), '50.0٪', 'six of twelve domains lack enforced DMARC');
  assert.equal((await page.textContent('#c1 .basis')).trim(), '6 من 12');
  assert.match(await page.textContent('#c1 .what'), /يمكن انتحال أسمائها/);
  const clausesText = await page.textContent('.figures .sectors');
  for (const c of codes) assert.ok(!clausesText.includes(scope.countries[c].ar), `the figures never name ${scope.countries[c].en}`);
  // A citation stays folded until asked for, then carries both languages and the issue page in its link.
  const slip = page.locator('#c1 .slip');
  assert.equal(await slip.isVisible(), false, 'a citation is folded until it is opened');
  await page.click('#c1 summary');
  assert.ok(await slip.isVisible());
  assert.match(await slip.locator('blockquote[lang="ar"]').textContent(), /المصدر .* في البند 1 من العدد 2 لأسبوع 19 أكتوبر 2026 على https/);
  assert.match(await slip.locator('blockquote[lang="en"]').textContent(), /Source: .*, issue 2, clause 1, week of 19 October 2026, https/);
  assert.equal(await slip.locator('blockquote[lang="ar"] bdi').textContent(), `${host}/issues/2/#c1`, 'the Arabic citation links to clause 1 of issue 2, isolated from the right to left text');
  assert.equal(await slip.locator('blockquote[lang="en"] bdi').textContent(), `${host}/en/issues/2/#c1`);
  assert.match(await slip.locator('blockquote[lang="ar"] .q').textContent(), /^50\.0٪ من النطاقات المقيسة في الخليج العربي يمكن انتحال أسمائها/);
  await slip.locator('button[data-copy="ar"]').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /^50\.0٪ من النطاقات المقيسة في الخليج العربي .*\nالمصدر .* على https:\/\/\S+\/issues\/2\/#c1$/s, 'the citation copies the sentence and its source');
  // Sector tabs: government only, kept in the address.
  const tabs = page.locator('.figures [role="tab"]');
  assert.ok(await tabs.count() >= 3, 'all sectors, government and education');
  await page.click('.figures [role="tab"][data-sector="government"]');
  assert.match(page.url(), /s=government/);
  assert.ok(await page.locator('#c1-government').isVisible());
  assert.equal(await page.locator('#c1').isVisible(), false, 'one sector shows at a time');
  assert.equal((await page.textContent('#c1-government .v')).trim(), '0.0٪', 'every government domain in the issue enforces DMARC');
  if (shots) await page.screenshot({ path: `${shots}/ui-desktop-ar.png`, fullPage: true });
  const latin = ((await pageText(page, ['.lang'])).match(/[A-Za-z][A-Za-z0-9.\-/:+&]*/g) || []).filter((w) => !/^[A-Z0-9]/.test(w) && !w.includes('.') && !/^https?:/.test(w));
  assert.deepEqual(latin, [], 'no lowercase English inside the Arabic page');
  assert.ok(!STRAY.test(await pageText(page)), 'no stray null, undefined or NaN in the Arabic page');
  assert.ok(!NOT_JOINED.test(await pageText(page)), 'no Arabic sentence is cut by a period before its connective');
  // A citation of an earlier issue opens that issue's page, with a way to the latest.
  await go(page, 'issues/1/#c1');
  assert.match(await page.textContent('.past'), /تعرض هذه الأرقام العدد 1 لأسبوع 12 أكتوبر 2026 كما اقتُبس بينما صدر بعده العدد 2/);
  assert.equal((await page.textContent('#c1 .v')).trim(), '41.7٪', 'issue 1 had five of twelve domains open to impersonation');
  assert.ok(await page.locator('#c1.stamped details[open]').count(), 'the cited clause is marked and open');
  // Every other page renders, in Arabic, with the same three sections and the action.
  for (const [path, expect] of [['countries/', /الكويت/], ['countries/sa/', /ستة أرقام عن السعودية/], ['standards/', /الحماية من انتحال البريد/], ['standards/pq-kex/', /X25519MLKEM768/], ['method/', /من أين تأتي الأسماء/], ['issues/', /العدد 2/], ['issues/2/kw/', /الكويت/], ['check/', /افحص نطاقك/], ['film/', /كيف صُنع/], ['readiness/', /الثغرات المستغلة/], ['readiness/kw/', /الكويت/]]) {
    await go(page, path);
    assert.match(await page.textContent('main'), expect, path);
    assert.ok(!STRAY.test(await pageText(page)), `${path}: no stray null, undefined or NaN`);
    assert.ok(!NOT_JOINED.test(await pageText(page)), `${path}: no Arabic sentence is cut by a period before its connective`);
    assert.equal(await page.locator('.top .tab a').count(), 4, `${path}: four sections in the header`);
    assert.equal(await page.locator('.top .act').getAttribute('href'), '/check/');
  }
  // The readiness index: the exploited vulnerability with its exposure, the software past its support, what the
  // sites announce, each in the row of the figures, the Gulf and each state on its own page, no domain named.
  await go(page, 'readiness/');
  assert.match(await page.textContent('.lede'), /قيس في 23 أكتوبر 2026 .* فأجاب 17 موقعاً/);
  assert.equal((await page.textContent('#cve-2026-1001 .v')).trim(), '18.2٪', 'two of the eleven sites announcing a PHP version announce an affected one');
  assert.equal((await page.textContent('#cve-2026-1001 .basis')).trim(), '2 من 11 يعلن إصداره كاملاً');
  assert.equal(await page.locator('#kev .kev-list li').count(), 1, 'only the measured entries are rows');
  assert.match(await page.textContent('#kev'), /و1 أخرى في Apache Tomcat لا يعلن أي موقع إصدارها كاملاً/, 'the entry no site can be held against is named in one line');
  assert.match(await page.textContent('#cve-2026-1001'), /كانت 25\.0٪ في 21 أكتوبر 2026/, 'the row says where the share moved from');
  assert.match(await page.textContent('#cve-2026-1001'), /تُستخدم في حملات فدية/);
  assert.equal(await page.locator('#cve-2026-1001 a[href^="https://nvd.nist.gov/vuln/detail/CVE-2026-1001"]').count(), 1);
  assert.match(await page.textContent('#eol'), /7\.4/, 'the cycle past its support is named');
  assert.match(await page.textContent('#announce'), /تعلن خادمها/);
  const readyText = await page.textContent('main');
  assert.ok(!/gov\.kw|edu\.sa|good0|weak0/.test(readyText), 'the readiness page names no domain');
  assert.ok(!STRAY.test(await pageText(page)), 'readiness: no stray null');
  assert.ok(!NOT_JOINED.test(await pageText(page)), 'readiness: no Arabic sentence is cut by a period before its connective');
  const readyLatin = ((await pageText(page, ['.lang'])).match(/[A-Za-z][A-Za-z0-9.\-/:+&]*/g) || []).filter((w) => !/^[A-Z0-9]/.test(w) && !w.includes('.') && !/^https?:/.test(w));
  assert.deepEqual(readyLatin, [], 'no lowercase English inside the Arabic readiness page');
  // Each vulnerability has a page that can be cited: the Gulf's exposure, the series, the affected versions and the
  // citation in both languages, reached from its row.
  assert.equal(await page.locator('#cve-2026-1001 a[href="/readiness/cve-2026-1001/"]').count(), 1, 'the row leads to the page of its vulnerability');
  await go(page, 'readiness/cve-2026-1001/');
  assert.equal((await page.textContent('#exposure .v')).trim(), '18.2٪');
  assert.equal(await page.locator('#series .series-list li').count(), 2, 'one row per census');
  assert.match(await page.textContent('#versions .r-range'), /8\.1\.0 ≤ v < 8\.1\.31/);
  assert.match(await page.textContent('#cite blockquote[lang="ar"]'), /^18\.2٪ من مواقع الخليج العربي التي تعلن إصدار PHP كاملاً تعلن إصداراً مصاباً بالثغرة المستغلة CVE-2026-1001/);
  assert.equal(await page.locator('#cite blockquote[lang="ar"] bdi').textContent(), `${host}/readiness/cve-2026-1001/`);
  await page.locator('#cite button[data-copy="en"]').click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^18\.2% of the sites in the Arabian Gulf .*\nSource: .*readiness index, census of 23 October 2026, https:\/\/\S+\/en\/readiness\/cve-2026-1001\/$/s);
  assert.equal(await page.locator('#exposure .places a').count(), codes.length, 'the way to each state, none set beside another');
  assert.ok(!STRAY.test(await pageText(page)), 'vulnerability page: no stray null');
  assert.ok(!NOT_JOINED.test(await pageText(page)), 'vulnerability page: no Arabic sentence cut by a period before its connective');
  assert.equal(await page.locator('main a[href="/readiness/cve-2026-2002/"]').count(), 0, 'a vulnerability no site can be held against has no page');
  // The report: four sheets of A4 with the Gulf's figures, the citation, and the PDFs beside it.
  await go(page, 'readiness/report/');
  assert.equal(await page.locator('.sheet').count(), 5, 'a cover and four sheets, the CIS Controls among them');
  assert.match(await page.textContent('.cover-sheet'), /تقرير الاستعدادية/);
  assert.match(await page.textContent('.r-keys'), /18\.2٪/, 'the cover leads with the vulnerability most sites are exposed to');
  assert.equal(await page.locator('.report-bar a[href="/readiness/report/gbaseline-readiness-ar.pdf"]').count(), 1);
  assert.ok(!STRAY.test(await pageText(page)), 'report: no stray null');
  assert.ok(!NOT_JOINED.test(await pageText(page)), 'report: no Arabic sentence cut by a period before its connective');
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.report-bar').isVisible(), false, 'nothing but the sheets is printed');
  await page.emulateMedia({ media: 'screen' });
  // The CIS Controls: each safeguard with its CIS number, title and group as CIS publishes them, and the evidence
  // the measurement can see, for the Gulf on its page and for each state on the state's own page.
  await go(page, 'cis/');
  assert.equal(await page.locator('#cis .cis-sg').count(), B.cis.safeguards.length);
  assert.match(await page.textContent('#cis-9-5 .cis-t'), /تطبيق DMARC/);
  assert.equal((await page.textContent('#cis-9-5 .cis-ev li:first-child .v')).trim(), '50.0٪', 'DMARC evidence is the Gulf share enforcing it');
  assert.match(await page.textContent('#cis-7-7'), /لا تعلن إصداراً مصاباً بثغرة مستغلة/);
  assert.match(await page.textContent('#cis'), /CC BY-NC-ND 4\.0/, 'CIS is credited with its licence');
  assert.ok(!STRAY.test(await pageText(page)), 'cis: no stray null');
  assert.ok(!NOT_JOINED.test(await pageText(page)), 'cis: no Arabic sentence cut by a period before its connective');
  await go(page, 'countries/kw/');
  assert.equal(await page.locator('#cis .cis-sg').count(), B.cis.safeguards.length, 'each state reads its own figures against the safeguards');
  const kwCis = await page.textContent('#cis');
  for (const c of codes.filter((x) => x !== 'KW')) assert.ok(!kwCis.includes(scope.countries[c].ar), `the Kuwaiti CIS figures never name ${scope.countries[c].en}`);
  await go(page, 'readiness/kw/');
  assert.equal((await page.textContent('#cve-2026-1001 .v')).trim(), '0.0٪', 'the Kuwaiti site announcing a PHP version is not affected after the first census');
  assert.equal(await page.locator('nav.others a').count(), codes.length - 1, 'a state leads to the other five');
  assert.equal(await page.locator('main .places a[aria-current="page"]').textContent(), scope.countries.KW.ar);
  await go(page, '');
  assert.match(await page.textContent('#ready'), /CVE-2026-1001/, 'the home page carries the newest exploited vulnerability');
  assert.equal(await page.locator('#ready a[href="/readiness/"]').count(), 1);
  await go(page, 'countries/sa/');
  const saText = await page.textContent('.figures');
  for (const c of codes.filter((x) => x !== 'SA')) assert.ok(!saText.includes(scope.countries[c].ar), `the Saudi figures never name ${scope.countries[c].en}`);
  assert.deepEqual(await page.locator('.std-table').first().locator('thead th').allTextContents(), [ui.table_share.ar, ui.table_check.ar], 'the state table reads like the figures: the share first, then the standard');
  assert.match(await page.locator('.std-table tbody tr:not(.group) th .basis').first().textContent(), /^\d[\d,]* من \d/, 'how many passed of how many sits under the name of the standard, and no other place is named');
  // The long table keeps its heading and its sector tabs beside it; its bars are drawn for the eye only.
  assert.ok(await page.locator('#all-tabs [role="tab"]').count() >= 2, 'the tabs of the long table sit under its heading');
  await page.click('#all-tabs [role="tab"][data-sector="government"]');
  assert.ok(await page.locator('#all .panel[data-sector="government"]').isVisible());
  assert.equal(await page.locator('#all .panel[data-sector="all"]').isVisible(), false, 'one sector of the long table at a time');
  assert.ok(await page.locator('#figures .panel[data-sector="government"]').isVisible(), 'the six figures above follow the sector chosen under the table');
  assert.equal(await page.locator('#figures-tabs [aria-selected="true"]').getAttribute('data-sector'), 'government', 'both lists of tabs show the same choice');
  assert.equal(await page.locator('.std-table svg.bar').first().getAttribute('aria-hidden'), 'true');
  // A standard: what the measurement found sits beside the explanation, in the same column as its share.
  await go(page, 'standards/dmarc/');
  assert.ok(await page.locator('.side .found tbody tr').count() >= 2, 'the findings are listed beside the explanation');
  // A state's page of an issue leads to the same issue in the other five states.
  await go(page, 'issues/2/kw/');
  assert.equal(await page.locator('nav.others a').count(), codes.length - 1);
  assert.equal(await page.locator('nav.others a').first().getAttribute('href'), `/issues/2/${codes.find((c) => c !== 'KW').toLowerCase()}/`);
  // Addresses from the first version land on their pages.
  for (const [old, now] of [['#/countries/KW', '/countries/kw/'], ['?lang=en', '/en/'], ['#/checks/pq_kex', '/standards/pq-kex/'], ['#/?i=1&c=1', '/issues/1/'], ['#/hall', '/']]) {
    await go(page, old);
    await page.waitForURL((u) => u.pathname === now, { timeout: 5000 });
    assert.equal(new URL(page.url()).pathname, now, `${old} goes to ${now}`);
  }
  // The live check, with the resolvers mocked, reached from the field on the home page.
  await go(page, '');
  await page.fill('#home-input', 'https://Example.com/path');
  await page.click('.field-form button[type=submit]');
  await page.waitForSelector('.result h2');
  assert.equal(new URL(page.url()).pathname, '/check/');
  assert.equal(await page.textContent('.result h2'), 'example.com');
  assert.ok(await page.locator('.res li.pass').count() >= 3, 'DMARC, SPF and DNSSEC pass');
  assert.match(await page.textContent('.res li.pass .gulf >> nth=0'), /يجتازه .* من نطاقات الخليج العربي/, 'each result stands beside the Arabian Gulf');
  assert.ok(!STRAY.test(await page.textContent('.result')), 'the result prints no stray null');
  assert.match(page.url(), /\?d=example\.com/);
  await page.fill('#check-input', 'gone.gov.kw');
  await page.click('.live .check-form button');
  await page.waitForFunction(() => /غير موجود/.test(document.querySelector('.status').textContent));
  await page.fill('#check-input', 'not a domain');
  await page.click('.live .check-form button');
  assert.match(await page.textContent('.status'), /أدخل اسم نطاق صحيحاً/);
  // English.
  await go(page, 'en/');
  assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
  assert.match(await page.textContent('#c1'), /Can be impersonated in email/);
  assert.equal((await page.textContent('.cover h1')).replace(/\s+/g, ' ').trim(), `${ui.title_1.en} ${ui.title_2.en}`);
  const leak = (await pageText(page, ['.lang', '[lang="ar"]'])).split(/\s+/).filter((w) => ARABIC.test(w));
  assert.deepEqual(leak, [], 'no Arabic inside the English page');
  assert.ok(!STRAY.test(await pageText(page)), 'no stray null, undefined or NaN in the English page');
  assert.equal(await page.locator('.top .lang').getAttribute('href'), '/', 'the other language is one link away');
  if (shots) await page.screenshot({ path: `${shots}/ui-desktop-en.png`, fullPage: true });
  // A phone: no sideways scroll on any page, the mosaic comes before the title.
  const phone = await preparePage({ width: 390, height: 860 }, 2);
  for (const path of ['', 'countries/kw/', 'standards/dmarc/', 'check/', 'method/', 'film/', 'issues/2/', 'readiness/', 'readiness/cve-2026-1001/', 'readiness/report/', 'cis/', 'en/', 'en/readiness/report/', 'en/readiness/cve-2026-1001/', 'en/countries/sa/', 'en/standards/dmarc/', 'en/issues/2/', 'en/readiness/kw/']) {
    await go(phone, path);
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${path || 'home'}: no sideways scroll on a phone (overflow ${overflow}px)`);
    // The page clips anything wider than the screen, so a table that does not fit would lose its last column.
    const cut = await phone.evaluate(() => [...document.querySelectorAll('table')].filter((t) => t.offsetParent).map((t) => t.getBoundingClientRect()).filter((r) => r.left < -1 || r.right > innerWidth + 1).length);
    assert.equal(cut, 0, `${path || 'home'}: every table fits the width of a phone`);
  }
  await go(phone, '');
  // Nothing in a row of figures is sent to the far edge: the figure stands on the edge the page reads from, its words
  // beside it, and the count and the citation under the words on the same line.
  const rows = await phone.evaluate(() => [...document.querySelectorAll('.panel:not([hidden]) .clauses .fig-row')].map((r) => {
    const box = (sel) => r.querySelector(sel).getBoundingClientRect();
    return { row: r.getBoundingClientRect(), fig: box('.fig'), label: box('.fig-label'), basis: box('.basis'), cite: box('.cite-w') };
  }));
  assert.equal(rows.length, CLAUSES.length);
  for (const [i, x] of rows.entries()) {
    assert.ok(Math.abs(x.fig.right - x.row.right) <= 1, `row ${i + 1}: the figure stands on the right edge`);
    assert.ok(x.label.right < x.fig.left + 1, `row ${i + 1}: the words sit beside the figure`);
    assert.ok(Math.abs(x.basis.right - x.label.right) <= 1, `row ${i + 1}: the count starts under the words`);
    assert.ok(Math.abs(x.cite.top - x.basis.top) <= 2 && x.cite.right <= x.basis.left, `row ${i + 1}: the citation follows the count on its line`);
  }
  const cells = await phone.evaluate(() => [...document.querySelectorAll('#figures-tabs [role="tab"]')].map((b) => Math.round(b.getBoundingClientRect().width)));
  assert.ok(cells.length >= 2 && Math.max(...cells) - Math.min(...cells) <= 1, `the sector tabs are cells of one width (${cells.join(', ')})`);
  const [band, title] = await Promise.all(['.mosaic', '.cover h1'].map((s) => phone.locator(s).boundingBox()));
  assert.ok(band.y < title.y, 'on a phone the mosaic comes first');
  if (shots) await phone.screenshot({ path: `${shots}/ui-mobile-ar.png`, fullPage: true });
  // Before the first issue the site says so instead of breaking.
  const before1 = await preparePage({ width: 1280, height: 900 });
  await go(before1, '', PORT + 1);
  assert.match(await before1.textContent('main'), /العدد الأول قيد القياس/);
  assert.ok(!STRAY.test(await pageText(before1)), 'no stray null before the first issue');
  for (const path of ['countries/kw/', 'standards/dmarc/', 'method/', 'readiness/', 'readiness/kw/', 'en/', 'en/readiness/']) {
    await go(before1, path, PORT + 1);
    assert.ok(!STRAY.test(await pageText(before1)), `${path}: no stray null before the first issue`);
  }
  await go(before1, 'readiness/', PORT + 1);
  assert.match(await before1.textContent('main'), /أول قياس للاستعدادية يجري الآن/, 'before the first census the readiness page says so');
  assert.deepEqual(errors.filter((e) => !/404/.test(e)), [], 'no console errors');
  console.log('ui: all checks passed');
} finally {
  await browser.close();
  for (const s of servers) s.kill();
  rmSync(site, { recursive: true, force: true });
  rmSync(empty, { recursive: true, force: true });
}
