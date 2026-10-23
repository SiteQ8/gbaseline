#!/usr/bin/env node
// Command line: check one domain fully, or run the weekly pipeline (inventory, scan, publish), or serve MCP.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createResolver, cleanDomain } from '../docs/assets/engine/dns.js';
import { CHECKS, GROUPS, suffixChain } from '../docs/assets/engine/checks.js';
import { tr, ui, counted } from '../docs/assets/engine/i18n.js';
import { observeDomain, pqCapable } from '../src/probe.mjs';
import { emptyInventory, refresh, serialize, bySuffixLength } from '../src/inventory.mjs';
import { scan, mergeScans } from '../src/scan.mjs';
import { census, mergeCensus } from '../src/census.mjs';
import { fetchReferences, newKev } from '../src/references.mjs';
import { aggregateReadiness } from '../src/readiness.mjs';
import { aggregate, appendHistory, historyCsv, CSV_HEAD, csvRows } from '../src/aggregate.mjs';
import { bundle, project, scope, userAgent, levelText } from '../src/meta.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = 'data/inventory/domains.json';

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) { out[k] = argv[i + 1]; i += 1; } else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

function suffixOf(domain) {
  const s = bySuffixLength(scope).find((x) => domain.endsWith(`.${x.suffix}`));
  return s ? s.suffix : null;
}

async function cmdCheck(a) {
  const lang = a.lang === 'ar' ? 'ar' : 'en';
  const domain = cleanDomain(a._[1]);
  if (!domain) { console.error(ui(bundle, 'domain_invalid', lang)); process.exit(2); }
  const resolver = createResolver();
  const suffix = suffixOf(domain);
  const chain = suffix ? await suffixChain(suffix, resolver) : undefined;
  const { obs, results } = await observeDomain(domain, resolver, { chain, agent: userAgent(), skipWeb: Boolean(a['dns-only']) });
  if (a.json) {
    console.log(JSON.stringify({ domain, at: obs.at, results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { ...v, label: levelText(k, v.level, lang) }])), observation: obs }, null, 2));
    return;
  }
  const state = { pass: ui(bundle, 'state_pass', lang), fail: ui(bundle, 'state_fail', lang), na: ui(bundle, 'state_na', lang), unknown: ui(bundle, 'state_unknown', lang) };
  const width = Math.max(...Object.values(state).map((s) => s.length));
  const lines = [domain, obs.at.replace('T', ' ').slice(0, 16) + ' UTC', ''];
  if (obs.dns.state === 'nxdomain') { console.log(lines.concat(ui(bundle, 'domain_nx', lang)).join('\n')); process.exit(1); }
  if (obs.dns.state !== 'live') { console.log(lines.concat(ui(bundle, 'domain_broken', lang)).join('\n')); process.exit(1); }
  for (const g of GROUPS) {
    lines.push(tr(bundle.groups[g], lang));
    for (const c of CHECKS.filter((x) => x.group === g)) {
      const r = results[c.id];
      lines.push(`  ${state[r.state].padEnd(width)}  ${tr(bundle.checks[c.id].short, lang)}  ${levelText(c.id, r.level, lang)}`);
    }
  }
  const measured = Object.values(results).filter((r) => r.state === 'pass' || r.state === 'fail');
  const passed = measured.filter((r) => r.state === 'pass').length;
  lines.push('', ui(bundle, 'domain_summary', lang, { pass: passed, checks: counted(measured.length, bundle.ui.w_check, lang) }));
  console.log(lines.join('\n'));
}

function loadInventory(file) {
  return existsSync(join(root, file)) ? JSON.parse(readFileSync(join(root, file), 'utf8')) : emptyInventory();
}

async function cmdInventory(a) {
  const file = a.file || INVENTORY;
  const inv = loadInventory(file);
  const before = Object.keys(inv.domains).length;
  const date = a.date || new Date().toISOString().slice(0, 10);
  await refresh(inv, scope, date, { ct: !a['no-ct'] });
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), serialize(inv));
  const after = Object.keys(inv.domains).length;
  console.log(`inventory: ${after} domains (${after - before} new)`);
  console.log(JSON.stringify(inv.sources));
  return inv;
}

// --shard i/N scans the i-th of N parts of the inventory, so one weekly run can spread over several runners.
function parseShard(v) {
  if (!v) return undefined;
  const m = String(v).match(/^(\d+)\/(\d+)$/);
  if (!m || Number(m[1]) >= Number(m[2]) || Number(m[2]) < 1) throw new Error(`--shard takes i/N with i below N, not ${v}`);
  return { index: Number(m[1]), count: Number(m[2]) };
}

async function cmdScan(a, inv) {
  const inventory = inv || loadInventory(a.file || INVENTORY);
  const total = Object.keys(inventory.domains).length;
  let last = 0;
  const res = await scan(inventory, scope, {
    shard: parseShard(a.shard),
    concurrency: Number(a.concurrency) || 16,
    limit: Number(a.limit) || undefined,
    only: a.only ? String(a.only).split(',') : undefined,
    skipWeb: Boolean(a['skip-web']),
    agent: userAgent(),
    onProgress: (n, t) => { if (n - last >= 250 || n === t) { last = n; console.log(`scan: ${n}/${t}`); } },
  });
  const out = a.out || join(tmpdir(), 'scan-rows.json');
  writeFileSync(out, JSON.stringify(res));
  console.log(`scan: ${res.rows.length} of ${total} domains in ${res.seconds}s, ${res.retried} looked at twice, rows in ${out}`);
  return res;
}

function writeText(rel, text) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

// The rows of one scan, or of every shard of one run: a file, several files separated by commas, or a folder.
function readScans(spec) {
  const files = String(spec).split(',').flatMap((f) => (existsSync(f) && statSync(f).isDirectory() ? readdirSync(f).filter((x) => x.endsWith('.json')).sort().map((x) => join(f, x)) : [f]));
  if (!files.length) throw new Error(`no scan rows found in ${spec}`);
  return mergeScans(files.map((f) => JSON.parse(readFileSync(f, 'utf8'))));
}

async function cmdPublish(a, res) {
  const scanned = res || readScans(a.rows || join(tmpdir(), 'scan-rows.json'));
  const date = a.date || new Date().toISOString().slice(0, 10);
  const inv = loadInventory(a.file || INVENTORY);
  const scanner = { version: project.version, node: process.versions.node, openssl: process.versions.openssl, pq: pqCapable(), runner: process.env.GITHUB_ACTIONS ? 'github-hosted' : 'local', web: !scanned.rows.every((r) => (r.r.https || [])[1] === 'not-measured') };
  const { summary } = aggregate(scanned.rows, scope, { date, chain: scanned.chain, seconds: scanned.seconds, resolver: scanned.resolver, scanner, sources: inv.sources });
  const historyPath = join(root, 'docs/data/history.json');
  const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, 'utf8')) : [];
  const nextHistory = appendHistory(history, summary);
  summary.issue = nextHistory.findIndex((h) => h.date === date) + 1;
  writeText('docs/data/summary.json', JSON.stringify(summary, null, 1) + '\n');
  writeText('docs/data/history.json', JSON.stringify(nextHistory) + '\n');
  rmSync(join(root, 'docs/data/hall.json'), { force: true });
  writeText('docs/data/open/latest.csv', [CSV_HEAD, ...csvRows(summary)].join('\n') + '\n');
  const histCsv = join(root, 'docs/data/open/history.csv');
  writeText('docs/data/open/history.csv', historyCsv(existsSync(histCsv) ? readFileSync(histCsv, 'utf8') : '', summary));
  const g = summary.inventory.GCC.all;
  console.log(`publish: issue ${summary.issue} for ${date}, ${g.live} live of ${g.discovered} discovered`);
  return summary;
}

// The census: what every live domain's first page announces, one shard or all, rows to a file.
async function cmdCensus(a) {
  const inventory = loadInventory(a.file || INVENTORY);
  const total = Object.keys(inventory.domains).length;
  let last = 0;
  const res = await census(inventory, scope, {
    shard: parseShard(a.shard),
    concurrency: Number(a.concurrency) || 16,
    limit: Number(a.limit) || undefined,
    only: a.only ? String(a.only).split(',') : undefined,
    agent: userAgent(),
    onProgress: (n, t) => { if (n - last >= 250 || n === t) { last = n; console.log(`census: ${n}/${t}`); } },
  });
  const out = a.out || join(tmpdir(), 'census-rows.json');
  writeFileSync(out, JSON.stringify(res));
  const seen = res.rows.filter((r) => r.web === 'ok').length;
  console.log(`census: ${res.rows.length} of ${total} domains in ${res.seconds}s, ${seen} first pages read, rows in ${out}`);
  return res;
}

function readCensus(spec) {
  const files = String(spec).split(',').flatMap((f) => (existsSync(f) && statSync(f).isDirectory() ? readdirSync(f).filter((x) => x.endsWith('.json')).sort().map((x) => join(f, x)) : [f]));
  if (!files.length) throw new Error(`no census rows found in ${spec}`);
  return mergeCensus(files.map((f) => JSON.parse(readFileSync(f, 'utf8'))));
}

// The readiness index: the references refreshed from their publishers, the census rows counted against them,
// and docs/data/readiness.json written with its series.
async function cmdReadiness(a) {
  const rows = readCensus(a.rows || join(tmpdir(), 'census-rows.json'));
  const date = a.date || new Date().toISOString().slice(0, 10);
  const path = join(root, 'docs/data/readiness.json');
  const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  const refs = a['no-fetch'] && previous ? { kev: previous.kev, cycles: previous.cycles, sources: previous.sources } : await fetchReferences({ today: date, previous, log: (m) => console.log(m) });
  const doc = aggregateReadiness(rows.rows, scope, refs, { date, run: a.run || 'census', previous, seconds: rows.seconds });
  writeText('docs/data/readiness.json', JSON.stringify(doc, null, 1) + '\n');
  const g = doc.places.GCC;
  console.log(`readiness: ${date}, ${g.sites} first pages read of ${g.live} live domains, ${doc.kev.length} exploited vulnerabilities followed, ${Object.keys(g.products).length} products announced`);
  return doc;
}

// The watch: whether the catalogue holds an exploited vulnerability, in software the measurement can see, that the
// last readiness document does not follow yet. Prints the answer and writes it to GITHUB_OUTPUT when there is one.
async function cmdWatch(a) {
  const path = join(root, 'docs/data/readiness.json');
  const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  const today = a.date || new Date().toISOString().slice(0, 10);
  const r = await newKev({ today, previous });
  if (r.error) console.log(`watch: the catalogue could not be read (${r.error})`);
  else console.log(`watch: ${r.entries.length} new of ${r.count} in catalogue ${r.version}${r.entries.length ? ': ' + r.entries.map((e) => `${e.cve} (${e.product})`).join(', ') : ''}${previous ? '' : ', and no census yet'}`);
  const go = Boolean(r.entries.length) || !previous;
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `census=${go}\nnew=${r.entries.map((e) => e.cve).join(' ')}\n`, { flag: 'a' });
  return r;
}

async function cmdWeekly(a) {
  const inv = a['skip-inventory'] ? loadInventory(a.file || INVENTORY) : await cmdInventory({ ...a, 'no-ct': a['no-ct'] });
  const res = await cmdScan(a, inv);
  return cmdPublish(a, res);
}

const HELP = `usage:
  check <domain> [--json] [--lang ar|en] [--dns-only]   every check for one domain, from this machine
  inventory [--no-ct]                                    refresh ${INVENTORY} from certificate logs and Tranco
  scan [--limit N] [--concurrency N] [--skip-web] [--shard i/N] [--out file]
                                                         scan the inventory (or one shard of it), rows to a file
  publish [--rows file,file|folder] [--date YYYY-MM-DD]  write the totals, the weekly series and the open data
  weekly                                                 inventory, scan and publish in one run
  census [--shard i/N] [--concurrency N] [--out file]    what every live domain's first page announces, rows to a file
  readiness [--rows file,file|folder] [--date YYYY-MM-DD] [--no-fetch]
                                                         count the census against the exploited vulnerabilities and the support cycles
  watch                                                  whether the catalogue holds a new exploited vulnerability the index should measure
  mcp                                                    the MCP server over stdio`;

const a = args(process.argv.slice(2));
const cmd = a._[0];
try {
  if (cmd === 'check') await cmdCheck(a);
  else if (cmd === 'inventory') await cmdInventory(a);
  else if (cmd === 'scan') await cmdScan(a);
  else if (cmd === 'publish') await cmdPublish(a);
  else if (cmd === 'weekly') await cmdWeekly(a);
  else if (cmd === 'census') await cmdCensus(a);
  else if (cmd === 'readiness') await cmdReadiness(a);
  else if (cmd === 'watch') await cmdWatch(a);
  else if (cmd === 'mcp') await import('../mcp/server.mjs');
  else if (cmd === 'version' || a.version) console.log(project.version);
  else { console.log(HELP); if (cmd && cmd !== 'help') process.exit(2); }
} catch (e) {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
}
