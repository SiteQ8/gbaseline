// The weekly scan: every domain in the inventory, observed and evaluated with the shared engine.
// Per domain results stay in memory and in a temporary file. Only totals are published.
import { createResolver } from '../docs/assets/engine/dns.js';
import { suffixChain, CHECKS } from '../docs/assets/engine/checks.js';
import { observeDomain } from './probe.mjs';

export const compact = (results) => Object.fromEntries(CHECKS.map((c) => [c.id, results[c.id] ? [results[c.id].state, results[c.id].level] : ['unknown', 'missing']]));
export const expand = (r) => Object.fromEntries(Object.entries(r).map(([k, [state, level]]) => [k, { state, level }]));

const SHAKY = new Set(['dns-error', 'dns-broken', 'probe-failed', 'fetch-error', 'http-error', 'resolvers-disagree', 'unreachable']);
export function needsRetry(row) {
  if (row.dns === 'broken' || row.dns === 'error') return true;
  return Object.entries(row.r).some(([id, [state, level]]) => (state === 'unknown' && SHAKY.has(level)) || (id === 'dnssec' && level === 'bogus'));
}

// Per check, keep the second observation where the first was inconclusive or claimed broken DNSSEC,
// so a transient failure never becomes a published failure.
export function merge(first, second) {
  if (first.dns !== 'live' && first.dns !== 'nxdomain') return second;
  if (second.dns !== 'live') return first;
  const r = { ...first.r };
  for (const [id, [state, level]] of Object.entries(first.r)) {
    const redo = (state === 'unknown' && SHAKY.has(level)) || (id === 'dnssec' && level === 'bogus');
    if (redo) r[id] = second.r[id];
  }
  return { ...first, r, agree: first.agree === false ? second.agree : first.agree };
}

export async function suffixChains(scope, resolver) {
  const chain = {};
  for (const s of scope.suffixes) chain[s.suffix] = await suffixChain(s.suffix, resolver);
  return chain;
}

export async function scan(inventory, scope, options = {}) {
  const resolver = options.resolver || createResolver({ timeout: 8000, maxInFlight: options.maxInFlight || 48 });
  const chain = await suffixChains(scope, resolver);
  const meta = new Map(scope.suffixes.map((s) => [s.suffix, s]));
  const excluded = new Set(scope.exclude || []);
  let jobs = Object.entries(inventory.domains)
    .map(([d, row]) => ({ d, suffix: row.suffix, ...meta.get(row.suffix) }))
    .filter((j) => j.country && !excluded.has(j.d));
  if (options.only) jobs = jobs.filter((j) => options.only.includes(j.d));
  if (options.limit) jobs = jobs.slice(0, options.limit);
  const rows = [];
  let next = 0;
  const started = Date.now();
  const observe = options.observe || observeDomain;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next];
      next += 1;
      let row;
      try {
        const { obs, results } = await observe(job.d, resolver, { chain: chain[job.suffix], timeout: options.timeout, agent: options.agent, skipWeb: options.skipWeb });
        row = { d: job.d, c: job.country, s: job.sector, suffix: job.suffix, dns: obs.dns.state, agree: obs.dmarc ? obs.dmarc.agreement : null, r: compact(results) };
      } catch {
        row = { d: job.d, c: job.country, s: job.sector, suffix: job.suffix, dns: 'error', agree: null, r: compact({}) };
      }
      rows.push(row);
      if (options.onProgress) options.onProgress(rows.length, jobs.length);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency || 16) }, worker));

  // Second pass: anything inconclusive, and every DNSSEC failure claimed as broken, is observed again
  // later with a fresh cache and less parallelism. A claimed DNSSEC failure stands only if the second look sees it too.
  const shaky = rows.filter(needsRetry);
  let retried = 0;
  if (shaky.length && options.retry !== false) {
    const fresh = options.retryResolver || createResolver({ timeout: 10000, maxInFlight: 16 });
    const again = [...shaky];
    async function retryWorker() {
      while (again.length) {
        const row = again.shift();
        try {
          const { obs, results } = await observe(row.d, fresh, { chain: chain[row.suffix], timeout: options.timeout, agent: options.agent, skipWeb: options.skipWeb });
          const second = { ...row, dns: obs.dns.state, agree: obs.dmarc ? obs.dmarc.agreement : null, r: compact(results) };
          Object.assign(row, merge(row, second));
          retried += 1;
        } catch { /* keep the first answer */ }
      }
    }
    await Promise.all(Array.from({ length: 4 }, retryWorker));
  }
  rows.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return { rows, chain, retried, seconds: Math.round((Date.now() - started) / 1000), resolver: { ...resolver.stats } };
}
