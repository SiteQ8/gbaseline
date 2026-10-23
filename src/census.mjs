// The census: every live domain in the inventory asked once for its first page, and what that page announces
// about the software behind it kept per domain in memory and in a temporary file. Only totals are published.
// Lighter than the weekly scan, so it can run within a day of a newly exploited vulnerability.
import { createResolver } from '../docs/assets/engine/dns.js';
import { existence, addresses } from '../docs/assets/engine/checks.js';
import { compactSoftware } from '../docs/assets/engine/software.js';
import { observeSoftware } from './probe.mjs';
import { shardOf } from './scan.mjs';

export async function censusDomain(domain, resolver, ctx = {}) {
  const dns = await existence(domain, resolver);
  if (dns.state !== 'live') return { dns: dns.state, web: null, sw: null };
  const [apex, www] = await Promise.all([addresses(domain, resolver), addresses(`www.${domain}`, resolver)]);
  const web = await observeSoftware(domain, { apex, www }, { timeout: ctx.timeout, agent: ctx.agent });
  return { dns: 'live', web: web.state, scheme: web.scheme || null, sw: web.state === 'ok' ? compactSoftware(web.software) : null };
}

export async function census(inventory, scope, options = {}) {
  const resolver = options.resolver || createResolver({ timeout: 8000, maxInFlight: options.maxInFlight || 48 });
  const meta = new Map(scope.suffixes.map((s) => [s.suffix, s]));
  const excluded = new Set(scope.exclude || []);
  let jobs = Object.entries(inventory.domains)
    .map(([d, row]) => ({ d, suffix: row.suffix, ...meta.get(row.suffix) }))
    .filter((j) => j.country && !excluded.has(j.d));
  if (options.shard) jobs = jobs.filter((j) => shardOf(j.d, options.shard.count) === options.shard.index);
  if (options.only) jobs = jobs.filter((j) => options.only.includes(j.d));
  if (options.limit) jobs = jobs.slice(0, options.limit);
  const rows = [];
  let next = 0;
  const started = Date.now();
  const observe = options.observe || censusDomain;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next];
      next += 1;
      let row;
      try {
        const seen = await observe(job.d, resolver, { timeout: options.timeout, agent: options.agent });
        row = { d: job.d, c: job.country, s: job.sector, ...seen };
      } catch {
        row = { d: job.d, c: job.country, s: job.sector, dns: 'error', web: null, sw: null };
      }
      rows.push(row);
      if (options.onProgress) options.onProgress(rows.length, jobs.length);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency || 16) }, worker));
  rows.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return { rows, seconds: Math.round((Date.now() - started) / 1000) };
}

// Several shards of one census put back together: every domain once.
export function mergeCensus(parts) {
  const seen = new Set();
  const rows = [];
  for (const p of parts) for (const r of p.rows) { if (!seen.has(r.d)) { seen.add(r.d); rows.push(r); } }
  rows.sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0));
  return { rows, seconds: Math.max(...parts.map((p) => p.seconds || 0)) };
}
