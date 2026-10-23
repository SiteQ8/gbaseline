// The readiness index: what a page announces is read right, versions are matched to the ranges a vulnerability
// names and to the support cycles of their makers, the references are refreshed without losing what was known,
// and the census is counted into totals with no domain name in them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identify, cleanVersion, compareVersions, support, affected, rangesFromNvd, kevProduct, compactSoftware } from '../docs/assets/engine/software.js';
import { relevantKev, newKev, fetchReferences } from '../src/references.mjs';
import { aggregateReadiness, exposure } from '../src/readiness.mjs';
import { census, mergeCensus } from '../src/census.mjs';
import { readJson } from './helpers.mjs';

const scope = readJson('data/src/scope.json');
const TODAY = '2026-10-23';
const php = [{ cycle: '8.3', eol: '2027-12-31', latest: '8.3.14' }, { cycle: '8.2', eol: '2026-12-31', latest: '8.2.26' }, { cycle: '8.1', eol: '2025-12-31', latest: '8.1.31' }, { cycle: '7.4', eol: '2022-11-28', latest: '7.4.33' }, { cycle: '5.6', eol: '2018-12-31', latest: '5.6.40' }];

test('what a first page announces is read from its headers and its markup, and nothing is guessed', () => {
  const a = identify({ server: 'Apache/2.4.41 (Ubuntu) OpenSSL/1.1.1f PHP/7.4.3 mod_ssl/2.4.41', powered: 'PHP/7.4.3' });
  assert.deepEqual(a.products, [{ id: 'apache', version: '2.4.41' }, { id: 'openssl', version: '1.1.1' }, { id: 'php', version: '7.4.3' }]);
  const b = identify({ server: 'nginx/1.18.0', powered: 'PHP/8.1.2-1ubuntu2.14', html: '<html><head><meta name="generator" content="WordPress 6.4.2"></head></html>' });
  assert.deepEqual(b.products, [{ id: 'nginx', version: '1.18.0' }, { id: 'php', version: '8.1.2' }, { id: 'wordpress', version: '6.4.2' }]);
  assert.equal(b.generator, 'WordPress 6.4.2');
  const c = identify({ server: 'Microsoft-IIS/10.0', powered: 'ASP.NET', aspnet: '4.0.30319' });
  assert.deepEqual(c.products, [{ id: 'iis', version: '10.0' }, { id: 'aspnet', version: '4.0.30319' }]);
  const d = identify({ server: 'cloudflare', html: '<link href="/wp-content/themes/x/style.css">' });
  assert.deepEqual(d, { products: [{ id: 'wordpress', version: null }], fronts: ['cloudflare'], generator: null });
  const e = identify({ server: 'LiteSpeed', html: '<meta content="Joomla! - Open Source Content Management" name="generator">' });
  assert.deepEqual(e.products.map((x) => x.id), ['litespeed', 'joomla']);
  assert.deepEqual(identify({ server: 'Apache-Coyote/1.1' }).products, [{ id: 'tomcat', version: null }], 'the connector version is not the server version');
  assert.deepEqual(identify({}).products, []);
  assert.deepEqual(identify({ server: 'Apache' }).products, [{ id: 'apache', version: null }], 'a product without a version is a product without a version');
  assert.equal(cleanVersion('v1.2.3-beta'), '1.2.3');
  assert.equal(cleanVersion('secret'), null);
  assert.equal(compareVersions('2.4.41', '2.4.5'), 1);
  assert.equal(compareVersions('10', '10.0'), 0);
  assert.deepEqual(compactSoftware(b), { p: [['nginx', '1.18.0'], ['php', '8.1.2'], ['wordpress', '6.4.2']], f: [] });
});

test('a version is placed in its support cycle and matched against the ranges a vulnerability names', () => {
  assert.deepEqual(['8.3.1', '8.1.2', '7.4.3', '5.3.3', '9.0.0', null].map((v) => support(v, php, TODAY)), ['supported', 'eol', 'eol', 'eol', 'unknown', 'unknown']);
  assert.equal(support('8.1.2', null, TODAY), 'unknown', 'no cycles, no verdict');
  const nvd = { configurations: [{ nodes: [{ cpeMatch: [
    { vulnerable: true, criteria: 'cpe:2.3:a:php:php:*:*:*:*:*:*:*:*', versionStartIncluding: '8.1.0', versionEndExcluding: '8.1.29' },
    { vulnerable: true, criteria: 'cpe:2.3:a:php:php:*:*:*:*:*:*:*:*', versionEndExcluding: '8.0.30' },
    { vulnerable: true, criteria: 'cpe:2.3:a:php:php:8.3.0:*:*:*:*:*:*:*' },
    { vulnerable: true, criteria: 'cpe:2.3:o:microsoft:windows:-:*:*:*:*:*:*:*' },
    { vulnerable: false, criteria: 'cpe:2.3:a:php:php:*:*:*:*:*:*:*:*', versionEndExcluding: '9' },
  ] }] }] };
  const ranges = rangesFromNvd(nvd);
  assert.equal(ranges.length, 3, 'only the vulnerable ranges of products the measurement can see');
  assert.deepEqual(['8.1.2', '8.1.29', '7.4.3', '8.3.1', '8.3.0'].map((v) => affected(v, ranges)), [true, false, true, false, true]);
  assert.equal(affected(null, ranges), false);
  assert.deepEqual([
    kevProduct({ vendorProject: 'PHP Group', product: 'PHP' }), kevProduct({ vendorProject: 'Apache', product: 'HTTP Server' }),
    kevProduct({ vendorProject: 'WordPress', product: 'Ultimate Member Plugin' }), kevProduct({ vendorProject: 'Microsoft', product: 'Internet Information Services (IIS)' }),
    kevProduct({ vendorProject: 'Microsoft', product: 'Exchange Server' }),
  ], ['php', 'apache', null, 'iis', null]);
});

const catalogue = { catalogVersion: '2026.10.23', dateReleased: '2026-10-23T12:00:00.0000Z', vulnerabilities: [
  { cveID: 'CVE-2026-1001', vendorProject: 'PHP Group', product: 'PHP', vulnerabilityName: 'PHP argument injection', dateAdded: '2026-10-20', dueDate: '2026-11-10', shortDescription: 'PHP contains an argument injection vulnerability \u2013 on Windows.', notes: 'https://www.php.net/advisory ; https://nvd.nist.gov/vuln/detail/CVE-2026-1001', knownRansomwareCampaignUse: 'Unknown' },
  { cveID: 'CVE-2024-0001', vendorProject: 'Apache', product: 'HTTP Server', vulnerabilityName: 'Old Apache bug', dateAdded: '2024-01-10', dueDate: '2024-01-31', shortDescription: 'Old.', notes: '', knownRansomwareCampaignUse: 'Known' },
  { cveID: 'CVE-2026-2002', vendorProject: 'Microsoft', product: 'Exchange Server', vulnerabilityName: 'Not visible from outside', dateAdded: '2026-10-21', dueDate: '2026-11-11', shortDescription: 'x', notes: '', knownRansomwareCampaignUse: 'Unknown' },
] };
const nvdFor = {
  'CVE-2026-1001': { vulnerabilities: [{ cve: { configurations: [{ nodes: [{ cpeMatch: [{ vulnerable: true, criteria: 'cpe:2.3:a:php:php:*:*:*:*:*:*:*:*', versionStartIncluding: '8.1.0', versionEndExcluding: '8.1.31' }, { vulnerable: true, criteria: 'cpe:2.3:a:php:php:*:*:*:*:*:*:*:*', versionStartIncluding: '8.2.0', versionEndExcluding: '8.2.26' }] }] }] } }] },
};
const fakeFetch = (log = []) => async (url) => {
  log.push(url);
  const json = (v) => ({ ok: true, json: async () => v });
  if (url.includes('cisa.gov')) return json(catalogue);
  if (url.includes('nvd.nist.gov')) { const cve = decodeURIComponent(url.split('cveId=')[1]); return nvdFor[cve] ? json(nvdFor[cve]) : json({ vulnerabilities: [] }); }
  if (url.includes('endoflife.date/api/php.json')) return json(php.map((c) => ({ ...c, support: c.eol })));
  if (url.includes('endoflife.date/api/')) return { ok: false, status: 404 };
  return { ok: false, status: 500 };
};

test('the references are refreshed from their publishers and what was known is kept', async () => {
  const kept = relevantKev(catalogue, { today: TODAY, windowDays: 365 });
  assert.deepEqual(kept.map((k) => k.cve), ['CVE-2026-1001'], 'a vulnerability in software that cannot be seen from outside is left out, and one older than the window too');
  assert.deepEqual(relevantKev(catalogue, { today: TODAY, windowDays: 365, known: ['CVE-2024-0001'] }).map((k) => k.cve), ['CVE-2026-1001', 'CVE-2024-0001'], 'an entry already followed keeps its series');
  assert.deepEqual(relevantKev(catalogue, { today: TODAY }).map((k) => k.cve), ['CVE-2026-1001', 'CVE-2024-0001'], 'by default the whole catalogue is followed, newest first');
  assert.deepEqual(kept[0].notes, ['https://www.php.net/advisory', 'https://nvd.nist.gov/vuln/detail/CVE-2026-1001']);
  assert.equal(kept[0].description, 'PHP contains an argument injection vulnerability - on Windows.', 'the catalogue dash is written plain, as everything published is');
  const log = [];
  const refs = await fetchReferences({ today: TODAY, fetchImpl: fakeFetch(log), nvdKey: 'test' });
  assert.equal(refs.kev.length, 2, 'both entries for visible software, the newest first');
  assert.equal(refs.kev[0].cve, 'CVE-2026-1001');
  assert.equal(refs.kev[0].ranges.length, 2, 'the versions NVD names');
  assert.deepEqual([refs.kev[1].ranges, refs.kev[1].nvdError], [[], 'empty'], 'an entry NVD knows nothing about yet waits without ranges');
  assert.equal(refs.cycles.php.length, 5);
  assert.equal(refs.sources.kev.version, '2026.10.23');
  assert.equal(refs.sources.eol.products, 1, 'the cycles of one product could be read in this fixture');
  assert.equal(refs.cycles.iis.length, 6, 'the cycles IIS takes from Windows Server are kept in the engine');
  assert.deepEqual(['10.0', '8.5', '7.5'].map((v) => support(v, refs.cycles.iis, TODAY)), ['supported', 'eol', 'eol']);
  // A second run asks NVD nothing for a vulnerability whose ranges are known.
  const log2 = [];
  const again = await fetchReferences({ today: TODAY, previous: { kev: refs.kev, cycles: refs.cycles, sources: refs.sources }, fetchImpl: fakeFetch(log2), nvdKey: 'test' });
  assert.deepEqual(log2.filter((u) => u.includes('nvd.nist.gov')).map((u) => decodeURIComponent(u.split('cveId=')[1])), ['CVE-2024-0001'], 'NVD is asked again only for the entry still without ranges');
  assert.equal(again.kev[0].ranges.length, 2);
  // When the catalogue cannot be read, what was followed stays.
  const down = await fetchReferences({ today: TODAY, previous: { kev: refs.kev, cycles: refs.cycles, sources: refs.sources }, fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(down.kev.length, 2);
  assert.equal(down.sources.kev.error, 'http-503');
  assert.equal(down.cycles.php.length, 5, 'the cycles known before are kept');
  // The watch: what the catalogue holds that the last document does not follow.
  const w = await newKev({ today: TODAY, fetchImpl: fakeFetch() });
  assert.deepEqual(w.entries.map((e) => e.cve), ['CVE-2026-1001', 'CVE-2024-0001']);
  assert.equal(w.count, 3);
  assert.deepEqual((await newKev({ today: TODAY, previous: { kev: refs.kev }, fetchImpl: fakeFetch() })).entries, [], 'nothing new once followed');
  assert.deepEqual((await newKev({ today: TODAY, previous: { kev: [refs.kev[0]], unmatched: [{ cve: 'CVE-2024-0001' }] }, fetchImpl: fakeFetch() })).entries, [], 'an entry waiting for its ranges is not new either');
  assert.equal((await newKev({ today: TODAY, fetchImpl: async () => ({ ok: false, status: 503 }) })).error, 'http-503');
});

const rows = [
  { d: 'a.gov.kw', c: 'KW', s: 'government', dns: 'live', web: 'ok', sw: { p: [['apache', '2.4.41'], ['php', '8.1.2']], f: [] } },
  { d: 'b.gov.kw', c: 'KW', s: 'government', dns: 'live', web: 'ok', sw: { p: [['nginx', '1.18.0'], ['php', '8.3.1'], ['wordpress', '6.4.2']], f: [] } },
  { d: 'c.edu.kw', c: 'KW', s: 'education', dns: 'live', web: 'ok', sw: { p: [['php', null]], f: ['cloudflare'] } },
  { d: 'd.gov.sa', c: 'SA', s: 'government', dns: 'live', web: 'ok', sw: { p: [['iis', '10.0'], ['aspnet', '4.0.30319']], f: [] } },
  { d: 'e.gov.sa', c: 'SA', s: 'government', dns: 'live', web: 'ok', sw: { p: [['php', '7.4.3']], f: [] } },
  { d: 'f.gov.sa', c: 'SA', s: 'government', dns: 'live', web: 'unreachable', sw: null },
  { d: 'g.gov.qa', c: 'QA', s: 'government', dns: 'nxdomain', web: null, sw: null },
];

test('the census is counted into totals for the Gulf and for each state, with no domain name in them', async () => {
  const refs = await fetchReferences({ today: TODAY, fetchImpl: fakeFetch(), nvdKey: 'test' });
  const doc = aggregateReadiness(rows, scope, refs, { date: TODAY, run: 'census', seconds: 12 });
  const g = doc.places.GCC;
  assert.equal(g.live, 6);
  assert.equal(g.sites, 5);
  assert.deepEqual(g.announce, { server: 4, version: 4, platform: 5, cms: 1, front: 1 }, 'four PHP sites and one ASP.NET site announce a platform');
  assert.equal(g.products.php.sites, 4);
  assert.equal(g.products.php.versioned, 3);
  assert.deepEqual([g.products.php.eol, g.products.php.supported, g.products.php.unknown, g.products.php.behind], [2, 1, 0, 3]);
  assert.deepEqual(g.products.php.cycles, { '8.1': 1, '8.3': 1, '7.4': 1 });
  assert.deepEqual(g.products.php.versions, { '8.1.2': 1, '8.3.1': 1, '7.4.3': 1 });
  assert.deepEqual(g.kev['CVE-2026-1001'], { exposed: 1, announced: 3 }, '8.1.2 is in the range, 8.3.1 and 7.4.3 are not');
  assert.deepEqual(exposure(g, 'CVE-2026-1001'), { share: 33.3, exposed: 1, announced: 3 });
  assert.equal(doc.places.KW.sites, 3);
  assert.deepEqual(doc.places.KW.kev['CVE-2026-1001'], { exposed: 1, announced: 2 });
  assert.deepEqual(doc.places.KW.products.php.versions, {}, 'versions are listed for the Gulf only');
  assert.equal(doc.places.QA.live, 0);
  assert.deepEqual(doc.history, [{ date: TODAY, run: 'census', sites: 5, live: 6, kev: { 'CVE-2026-1001': [1, 3] }, eol: { apache: [0, 1], php: [2, 3], nginx: [0, 1], wordpress: [0, 1], iis: [0, 1] } }]);
  assert.ok(!JSON.stringify(doc).includes('gov.kw'), 'no domain name is published');
  // The series grows, one entry per day, and a day measured twice keeps the later count.
  const next = aggregateReadiness(rows.slice(0, 2), scope, refs, { date: '2026-10-30', previous: doc });
  assert.deepEqual(next.history.map((h) => [h.date, h.sites]), [[TODAY, 5], ['2026-10-30', 2]]);
  const redo = aggregateReadiness(rows.slice(0, 1), scope, refs, { date: '2026-10-30', previous: next });
  assert.deepEqual(redo.history.map((h) => [h.date, h.sites]), [[TODAY, 5], ['2026-10-30', 1]]);
});

test('the census asks every live domain once, in shards that cover the inventory exactly', async () => {
  const inventory = { domains: Object.fromEntries(['a.gov.kw', 'b.gov.kw', 'c.edu.sa', 'd.com.qa', 'e.org.om'].map((d) => [d, { suffix: d.split('.').slice(1).join('.') }])) };
  const observe = async (d) => ({ dns: 'live', web: 'ok', scheme: 'https', sw: { p: [['php', '8.3.1']], f: [] } });
  const parts = await Promise.all([0, 1, 2].map((i) => census(inventory, scope, { shard: { index: i, count: 3 }, observe, resolver: {} })));
  const all = mergeCensus(parts);
  assert.deepEqual(all.rows.map((r) => r.d), ['a.gov.kw', 'b.gov.kw', 'c.edu.sa', 'd.com.qa', 'e.org.om']);
  assert.equal(all.rows[0].c, 'KW');
  assert.equal(all.rows[2].s, 'education');
});
