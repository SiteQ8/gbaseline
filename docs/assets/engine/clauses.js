// The figures every issue leads with, in the order the ledger prints them. A clause number is part of every
// citation, so a clause keeps its number for good and new ones are only ever added at the end.
// A 'fail' clause states the share that does not pass (the domains that can be impersonated, for example).
export const CLAUSES = [
  { n: 1, id: 'dmarc', mode: 'fail' },
  { n: 2, id: 'dnssec', mode: 'pass' },
  { n: 3, id: 'hsts', mode: 'pass' },
  { n: 4, id: 'legacy_tls', mode: 'fail' },
  { n: 5, id: 'pq_kex', mode: 'pass' },
  { n: 6, id: 'security_txt', mode: 'pass' },
];

// The share a clause states, from a summary cell ({ pass, fail }) or a history pair ([pass, measured]).
export function clauseShare(cell, mode) {
  const [pass, measured] = Array.isArray(cell) ? cell : cell ? [cell.pass, cell.pass + cell.fail] : [0, 0];
  const count = mode === 'fail' ? measured - pass : pass;
  return { v: measured ? (count / measured) * 100 : null, count, measured };
}
