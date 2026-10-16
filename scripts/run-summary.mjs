// The weekly run's summary for the GitHub job page: how many names each state's inventory holds, the Gulf's
// shares, data quality and the health of each name source. No domain is ever named here.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { percent } from '../src/aggregate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'docs/data/summary.json');

export function runSummary(summary, bundle) {
  const places = ['GCC', ...Object.keys(bundle.scope.countries)];
  const placeName = (p) => (p === 'GCC' ? 'Arabian Gulf' : bundle.scope.countries[p].en);
  const share = (x) => {
    const v = percent(x);
    return v === null ? 'n/a' : `${v.toFixed(1)}% (${x.pass} of ${x.pass + x.fail})`;
  };
  const out = [`## Issue ${summary.issue ?? '?'}, week of ${summary.date}`, ''];
  out.push('| | Discovered | Live | Retired | DNS broken |', '|---|---:|---:|---:|---:|');
  for (const p of places) {
    const n = summary.inventory[p].all;
    out.push(`| ${placeName(p)} | ${n.discovered} | ${n.live} | ${n.retired} | ${n.broken} |`);
  }
  // Shares for the Arabian Gulf as a whole only: like the site, the run never sets the states side by side.
  const sectors = ['all', ...Object.keys(bundle.scope.sectors)];
  const sectorName = (g) => (g === 'all' ? 'All sectors' : bundle.scope.sectors[g].en);
  out.push('', '### Share passing in the Arabian Gulf', '', `| Check | ${sectors.map(sectorName).join(' | ')} |`, `|---|${sectors.map(() => '---:').join('|')}|`);
  for (const c of bundle.order) out.push(`| ${bundle.checks[c.id].short.en} | ${sectors.map((g) => share(summary.checks[c.id].GCC[g])).join(' | ')} |`);
  out.push('', '| Sector | Discovered | Live |', '|---|---:|---:|');
  for (const g of sectors) { const n = summary.inventory.GCC[g]; out.push(`| ${sectorName(g)} | ${n.discovered} | ${n.live} |`); }
  const q = summary.quality || {};
  const a = q.agreement || {};
  const w = q.web || {};
  const s = summary.scanner || {};
  out.push('', '### Data quality', '');
  out.push(`- DMARC answers: both resolvers agreed on ${a.same ?? 0}, differed on ${a.differ ?? 0}, one resolver only for ${a.single ?? 0}.`);
  out.push(`- Websites: measured ${w.measured ?? 0}, unreachable from the scanner ${w.unreachable ?? 0}, no website ${w.none ?? 0}.`);
  if (q.seconds !== null && q.seconds !== undefined) out.push(`- Scan time ${Math.round(q.seconds / 60)} minutes, ${q.queries ?? '?'} DNS queries.`);
  if (s.node) out.push(`- Scanner: Node ${s.node}, OpenSSL ${s.openssl}, post quantum check ${s.pq ? 'on' : 'off'}, web checks ${s.web ? 'on' : 'off'}.`);
  const src = summary.sources;
  if (src && src.ct) {
    const cellOf = (v) => (v === undefined ? '' : typeof v === 'number' ? String(v) : `failed: ${v}`);
    out.push('', '### Name sources', '', '| Suffix | Certificate logs (PostgreSQL) | Certificate logs (JSON) |', '|---|---:|---:|');
    for (const [suffix, e] of Object.entries(src.ct)) out.push(`| ${suffix} | ${cellOf(e.psql)} | ${cellOf(e.json)} |`);
    if (src.tranco) out.push('', `Tranco list ${src.tranco.list || 'unavailable'}: ${typeof src.tranco.entities === 'number' ? `${src.tranco.entities} domains in scope` : `failed: ${src.tranco.entities}`}.`);
  }
  return `${out.join('\n')}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(file)) {
    console.log('No issue was published in this run.');
  } else {
    const bundle = JSON.parse(readFileSync(join(root, 'docs/data/bundle.json'), 'utf8'));
    process.stdout.write(runSummary(JSON.parse(readFileSync(file, 'utf8')), bundle));
  }
}
