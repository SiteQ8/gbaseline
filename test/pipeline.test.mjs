import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entityOf, bySuffixLength, absorb, emptyInventory, serialize, refresh } from '../src/inventory.mjs';
import { scan, compact, expand, needsRetry, merge, shardOf, mergeScans } from '../src/scan.mjs';
import { aggregate, appendHistory, historyCsv, csvRows, CSV_HEAD, percent } from '../src/aggregate.mjs';
import { runSummary } from '../scripts/run-summary.mjs';
import { CHECKS } from '../docs/assets/engine/checks.js';
import { readJson } from './helpers.mjs';

const bundle = readJson('docs/data/bundle.json');

const scope = readJson('data/src/scope.json');
const suffixes = bySuffixLength(scope);

test('certificate names reduce to the registrable domain under their suffix', () => {
  assert.deepEqual(entityOf('www.portal.moh.gov.kw', suffixes), { domain: 'moh.gov.kw', suffix: 'gov.kw' });
  assert.deepEqual(entityOf('*.Uni.EDU.SA.', suffixes), { domain: 'uni.edu.sa', suffix: 'edu.sa' });
  assert.equal(entityOf('gov.kw', suffixes), null, 'the suffix itself is not an organisation');
  assert.equal(entityOf('moh.gov.kw.example.com', suffixes), null);
  assert.equal(entityOf('bad_label.gov.ae', suffixes), null);
  assert.equal(entityOf('someone@moh.gov.kw', suffixes), null);
  assert.equal(entityOf('x.ac.ae', suffixes).suffix, 'ac.ae');
});

test('sources fold into the inventory without duplicates, and a failed source never shrinks it', async () => {
  const inv = emptyInventory();
  assert.equal(absorb(inv, ['a.moh.gov.kw', 'b.moh.gov.kw', 'ku.edu.kw'], suffixes, 'ct', '2026-10-19'), 2);
  absorb(inv, ['moh.gov.kw'], suffixes, 'tranco', '2026-10-26');
  assert.deepEqual(inv.domains['moh.gov.kw'], { suffix: 'gov.kw', first: '2026-10-19', src: ['ct', 'tranco'] });
  const before = Object.keys(inv.domains).length;
  await refresh(inv, scope, '2026-11-02', {
    crtPsql: async (s) => (s === 'gov.sa' ? { ok: true, names: ['www.moe.gov.sa'] } : { ok: false, error: 'timeout', names: [] }),
    crtJson: async (s) => (s === 'gov.qa' ? { ok: true, names: ['hukoomi.gov.qa'] } : { ok: false, error: 'http-502', names: [] }),
    tranco: async () => ({ ok: false, error: 'network', names: [] }),
  });
  assert.equal(Object.keys(inv.domains).length, before + 2, 'only additions, never removals');
  assert.equal(inv.sources.ct['gov.sa'].psql, 1);
  assert.equal(inv.sources.ct['gov.qa'].json, 1);
  assert.equal(inv.sources.ct['gov.kw'].psql, 'timeout');
  assert.equal(inv.sources.tranco.entities, 'network');
  await refresh(inv, { ...scope, exclude: ['moe.gov.sa'] }, '2026-11-09', { ct: false, tranco: async () => ({ ok: true, names: ['www.moe.gov.sa'] }) });
  assert.equal(inv.domains['moe.gov.sa'], undefined, 'a domain on the exclude list leaves the inventory and stays out');
  const text = serialize(inv);
  assert.deepEqual(JSON.parse(text).domains, inv.domains);
  assert.ok(text.indexOf('"hukoomi.gov.qa"') < text.indexOf('"moh.gov.kw"'), 'domains are sorted for readable diffs');
});

const R = (state, level) => ({ state, level });
const allOf = (state, level) => Object.fromEntries(CHECKS.map((c) => [c.id, R(state, level)]));

test('the scan runs every domain, retries what was inconclusive and keeps a DNSSEC failure only when seen twice', async () => {
  const inv = emptyInventory();
  absorb(inv, ['a.gov.kw', 'b.gov.kw', 'c.edu.om'], suffixes, 'ct', '2026-10-19');
  const calls = {};
  const observe = async (d) => {
    calls[d] = (calls[d] || 0) + 1;
    if (d === 'a.gov.kw') return { obs: { dns: { state: 'live' }, dmarc: { agreement: true } }, results: { ...allOf('pass', 'valid'), dnssec: calls[d] === 1 ? R('fail', 'bogus') : R('pass', 'validated') } };
    if (d === 'b.gov.kw') return { obs: { dns: { state: calls[d] === 1 ? 'broken' : 'live' }, dmarc: { agreement: true } }, results: allOf('fail', 'missing') };
    return { obs: { dns: { state: 'nxdomain' }, dmarc: null }, results: allOf('na', 'no-domain') };
  };
  const fakeResolver = { query: async () => ({ status: 'NOERROR', ad: true, answers: [], authority: [] }), stats: { queries: 0 } };
  const res = await scan(inv, scope, { observe, resolver: fakeResolver, retryResolver: fakeResolver, concurrency: 2 });
  assert.deepEqual(res.rows.map((r) => r.d), ['a.gov.kw', 'b.gov.kw', 'c.edu.om']);
  const quiet = async () => ({ obs: { dns: { state: 'live' }, dmarc: null }, results: allOf('pass', 'valid') });
  const skipped = await scan(inv, { ...scope, exclude: ['b.gov.kw'] }, { observe: quiet, resolver: fakeResolver, retryResolver: fakeResolver, concurrency: 2 });
  assert.deepEqual(skipped.rows.map((r) => r.d).sort(), ['a.gov.kw', 'c.edu.om'], 'an excluded domain is not scanned');
  assert.deepEqual(calls, { 'a.gov.kw': 2, 'b.gov.kw': 2, 'c.edu.om': 1 });
  assert.deepEqual(res.rows[0].r.dnssec, ['pass', 'validated'], 'a transient DNSSEC failure is replaced');
  assert.equal(res.rows[1].dns, 'live', 'a transient DNS failure is replaced');
  assert.equal(res.retried, 2);
  assert.equal(needsRetry({ dns: 'live', r: compact({ ...allOf('pass', 'x'), https: R('unknown', 'unreachable') }) }), true);
  assert.equal(needsRetry({ dns: 'live', r: compact(allOf('pass', 'x')) }), false);
  const kept = merge({ dns: 'live', agree: true, r: compact({ ...allOf('pass', 'x'), dnssec: R('fail', 'bogus') }) }, { dns: 'live', agree: true, r: compact({ ...allOf('fail', 'y'), dnssec: R('fail', 'bogus') }) });
  assert.deepEqual(kept.r.dnssec, ['fail', 'bogus'], 'seen twice, it stands');
  assert.deepEqual(kept.r.dmarc, ['pass', 'x'], 'conclusive results are not touched');
  assert.deepEqual(expand(compact({ dmarc: R('pass', 'reject') })).dmarc, R('pass', 'reject'));
});

function rows() {
  return [
    { d: 'a.gov.kw', c: 'KW', s: 'government', dns: 'live', agree: true, r: compact({ ...allOf('pass', 'valid'), dnssec: R('pass', 'validated') }) },
    { d: 'b.gov.kw', c: 'KW', s: 'government', dns: 'live', agree: false, r: compact({ ...allOf('fail', 'missing'), dmarc: R('unknown', 'resolvers-disagree'), https: R('unknown', 'unreachable') }) },
    { d: 'c.edu.sa', c: 'SA', s: 'education', dns: 'live', agree: null, r: compact({ ...allOf('fail', 'missing'), dmarc: R('pass', 'reject'), mta_sts: R('na', 'no-mail') }) },
    { d: 'd.gov.om', c: 'OM', s: 'government', dns: 'nxdomain', agree: null, r: compact(allOf('na', 'no-domain')) },
    { d: 'e.gov.om', c: 'OM', s: 'government', dns: 'broken', agree: null, r: compact(allOf('unknown', 'dns-broken')) },
  ];
}

test('totals by country, sector and check, with levels and quality, and no domain named', () => {
  const { summary, ...rest } = aggregate(rows(), scope, { date: '2026-10-19', chain: { 'gov.kw': true }, seconds: 600, resolver: { queries: 1234 } });
  assert.deepEqual(Object.keys(rest), [], 'only the summary comes out');
  assert.ok(!/[a-z]\.(gov|edu|ac)\.[a-z]{2}\b/.test(JSON.stringify(summary)), 'the summary names no domain');
  assert.deepEqual(summary.inventory.GCC.all, { discovered: 5, live: 3, retired: 1, broken: 1 });
  assert.deepEqual(summary.inventory.OM.government, { discovered: 2, live: 0, retired: 1, broken: 1 });
  const d = summary.checks.dmarc;
  assert.deepEqual({ pass: d.GCC.all.pass, fail: d.GCC.all.fail, unknown: d.GCC.all.unknown }, { pass: 2, fail: 0, unknown: 2 }, 'the disagreement and the broken domain are unknown, the retired one is not counted');
  assert.equal(d.KW.government.levels['resolvers-disagree'], 1);
  assert.equal(summary.checks.mta_sts.SA.education.na, 1);
  assert.deepEqual(summary.quality.agreement, { same: 1, differ: 1, single: 1 });
  assert.equal(summary.quality.web.unreachable, 1);
  assert.equal(percent({ pass: 1, fail: 2 }), 33.3);
  assert.equal(percent({ pass: 0, fail: 0 }), null);
  for (const p of Object.keys(summary.checks.dmarc)) for (const g of Object.keys(summary.checks.dmarc[p])) {
    const x = summary.checks.spf[p][g];
    assert.equal(x.pass + x.fail + x.na + x.unknown, summary.inventory[p][g].live + summary.inventory[p][g].broken, `${p} ${g}: every counted domain lands in exactly one state`);
  }
});

test('the weekly series and the open data replace a re-run of the same week instead of doubling it', () => {
  const { summary } = aggregate(rows(), scope, { date: '2026-10-19' });
  let history = appendHistory([], summary);
  history = appendHistory(history, summary);
  assert.equal(history.length, 1);
  assert.deepEqual(history[0].c.dmarc.GCC.all, [2, 2]);
  const later = { ...summary, date: '2026-10-26' };
  history = appendHistory(history, later);
  assert.deepEqual(history.map((h) => h.date), ['2026-10-19', '2026-10-26']);
  const first = historyCsv('', summary);
  const again = historyCsv(first, summary);
  assert.equal(first, again, 'the same week twice is the same file');
  const both = historyCsv(again, later);
  assert.equal(both.split('\n').filter((l) => l.startsWith('2026-10-26,')).length, csvRows(later).length);
  assert.ok(both.startsWith(`${CSV_HEAD}\n`));
  const row = csvRows(summary).find((l) => l.startsWith('2026-10-19,GCC,all,dmarc,'));
  assert.equal(row, '2026-10-19,GCC,all,dmarc,2,0,0,2,100.0', 'retired domains are not counted at all');
});

test('the run summary on the job page carries totals and source health, never a domain', () => {
  const { summary } = aggregate(rows(), scope, { date: '2026-10-19', seconds: 600, resolver: { queries: 1234 }, scanner: { node: '22.22.0', openssl: '3.5.4', pq: true, web: true }, sources: { ct: { 'gov.kw': { psql: 120, json: 'http-502' } }, tranco: { list: 'ABC12', entities: 410 } } });
  summary.issue = 1;
  const text = runSummary(summary, bundle);
  assert.match(text, /^## Issue 1, week of 2026-10-19$/m);
  assert.match(text, /\| Arabian Gulf \| 5 \| 3 \| 1 \| 1 \|/);
  assert.match(text, /\| gov\.kw \| 120 \| failed: http-502 \|/);
  assert.match(text, /Tranco list ABC12: 410 domains in scope/);
  assert.match(text, /### Share passing in the Arabian Gulf/);
  assert.ok(!/\| Check \| (Arabian )?Gulf \| Kuwait/.test(text), 'shares are for the Arabian Gulf only, never one state beside another');
  assert.ok(!/[a-z]\.(gov|edu|ac)\.[a-z]{2}\b/.test(text), 'no domain is named');
});

test('a run split into shards covers every domain once and joins back into one scan', async () => {
  const names = Array.from({ length: 300 }, (_, i) => `name${i}.${['gov.kw', 'com.sa', 'org.ae', 'med.om'][i % 4]}`);
  const shards = names.map((d) => shardOf(d, 6));
  assert.ok(shards.every((s) => s >= 0 && s < 6), 'every domain lands in a shard');
  assert.deepEqual(names.map((d) => shardOf(d, 6)), shards, 'the same shard every time');
  assert.ok(new Set(shards).size === 6, 'every shard gets work');
  const row = (d) => ({ d, c: 'KW', s: 'government', suffix: 'gov.kw', dns: 'live', agree: true, r: compact({}) });
  const a = { rows: [row('b.gov.kw'), row('a.gov.kw')], chain: { 'gov.kw': true }, retried: 1, seconds: 300, resolver: { queries: 10 } };
  const b = { rows: [row('c.gov.kw'), row('a.gov.kw')], chain: { 'gov.kw': true }, retried: 2, seconds: 500, resolver: { queries: 15 } };
  const m = mergeScans([a, b]);
  assert.deepEqual(m.rows.map((r) => r.d), ['a.gov.kw', 'b.gov.kw', 'c.gov.kw'], 'each domain once, in order');
  assert.equal(m.seconds, 500, 'the run lasts as long as its longest shard');
  assert.equal(m.retried, 3);
  assert.equal(m.resolver.queries, 25, 'queries add up');
  assert.equal(mergeScans([a]), a, 'one part is returned as it is');
});
