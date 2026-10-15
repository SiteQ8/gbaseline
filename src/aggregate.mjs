// From per domain results to what is published: totals by country, sector and check, the weekly series,
// the open data files and the hall of fame. No per domain failure ever leaves this module.
import { CHECKS, hallEligible } from '../docs/assets/engine/checks.js';
import { expand } from './scan.mjs';

const cell = () => ({ pass: 0, fail: 0, na: 0, unknown: 0, levels: {} });
const counts = () => ({ discovered: 0, live: 0, retired: 0, broken: 0 });

export function percent(x) {
  const measured = x.pass + x.fail;
  return measured ? Math.round((x.pass / measured) * 1000) / 10 : null;
}

export function aggregate(rows, scope, meta = {}) {
  const places = ['GCC', ...Object.keys(scope.countries)];
  const groups = ['all', ...Object.keys(scope.sectors)];
  const grid = (make) => Object.fromEntries(places.map((p) => [p, Object.fromEntries(groups.map((g) => [g, make()]))]));
  const inventory = grid(counts);
  const checks = Object.fromEntries(CHECKS.map((c) => [c.id, grid(cell)]));
  const quality = { agreement: { same: 0, differ: 0, single: 0 }, web: { measured: 0, unreachable: 0, none: 0 } };
  const hall = [];

  for (const row of rows) {
    const targets = [[row.c, row.s], [row.c, 'all'], ['GCC', row.s], ['GCC', 'all']];
    for (const [p, g] of targets) {
      const n = inventory[p][g];
      n.discovered += 1;
      if (row.dns === 'live') n.live += 1;
      else if (row.dns === 'nxdomain') n.retired += 1;
      else n.broken += 1;
    }
    if (row.dns === 'nxdomain') continue;
    for (const c of CHECKS) {
      const [state, level] = row.r[c.id] || ['unknown', 'missing'];
      for (const [p, g] of targets) {
        const x = checks[c.id][p][g];
        x[state] += 1;
        x.levels[level] = (x.levels[level] || 0) + 1;
      }
    }
    if (row.dns !== 'live') continue;
    if (row.agree === true) quality.agreement.same += 1;
    else if (row.agree === false) quality.agreement.differ += 1;
    else quality.agreement.single += 1;
    const https = row.r.https || [];
    if (https[1] === 'unreachable') quality.web.unreachable += 1;
    else if (https[1] === 'no-web') quality.web.none += 1;
    else if (https[0] === 'pass' || https[0] === 'fail') quality.web.measured += 1;
    if (hallEligible(expand(row.r))) hall.push({ d: row.d, c: row.c, s: row.s });
  }
  hall.sort((a, b) => places.indexOf(a.c) - places.indexOf(b.c) || (a.d < b.d ? -1 : 1));

  const summary = {
    schema: 'summary/1',
    date: meta.date,
    inventory,
    checks,
    chain: meta.chain || {},
    quality: { ...quality, seconds: meta.seconds ?? null, queries: meta.resolver ? meta.resolver.queries : null },
    scanner: meta.scanner || null,
    sources: meta.sources || null,
    hall: hall.length,
  };
  return { summary, hall: { date: meta.date, domains: hall } };
}

export function historyEntry(summary) {
  const c = {};
  for (const id of Object.keys(summary.checks)) {
    c[id] = {};
    for (const [p, byGroup] of Object.entries(summary.checks[id])) {
      c[id][p] = {};
      for (const [g, x] of Object.entries(byGroup)) c[id][p][g] = [x.pass, x.pass + x.fail];
    }
  }
  return { date: summary.date, live: summary.inventory.GCC.all.live, c };
}

export function appendHistory(history, summary) {
  const entry = historyEntry(summary);
  const rest = (history || []).filter((h) => h.date !== entry.date);
  return [...rest, entry].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export const CSV_HEAD = 'date,country,sector,check,pass,fail,not_applicable,unknown,percent_pass';
export function csvRows(summary) {
  const out = [];
  for (const id of Object.keys(summary.checks)) {
    for (const [p, byGroup] of Object.entries(summary.checks[id])) {
      for (const [g, x] of Object.entries(byGroup)) {
        const pct = percent(x);
        out.push([summary.date, p, g, id, x.pass, x.fail, x.na, x.unknown, pct === null ? '' : pct.toFixed(1)].join(','));
      }
    }
  }
  return out;
}

export function historyCsv(previousText, summary) {
  const keep = String(previousText || '').split(/\r?\n/).filter((l) => l && l !== CSV_HEAD && !l.startsWith(`${summary.date},`));
  return [CSV_HEAD, ...keep, ...csvRows(summary)].join('\n') + '\n';
}
