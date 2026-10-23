// The figures behind each CIS Controls safeguard the measurement can see from outside, for the Arabian Gulf or one
// state: every check it rests on with its domains passing, and every figure of the readiness index with its sites
// meeting it. Every share reads the same way, as the share meeting the evidence. Shared by the site, the open data
// and the MCP server, so the three never disagree.
const SITE_KEY = { supported: 'support', patched: 'patch', unexposed: 'kev' };

export function cisEvidence(summary, readiness, place, e) {
  if (e.check) {
    const cell = summary && summary.checks[e.check] && summary.checks[e.check][place] ? summary.checks[e.check][place].all : null;
    const of = cell ? cell.pass + cell.fail : 0;
    return { kind: 'check', id: e.check, pass: cell ? cell.pass : 0, of, share: of ? (cell.pass / of) * 100 : null, unit: 'domains', date: summary ? summary.date : null };
  }
  const pair = readiness && readiness.places[place] && readiness.places[place].site ? readiness.places[place].site[SITE_KEY[e.readiness]] : null;
  if (!pair) return { kind: 'readiness', id: e.readiness, pass: 0, of: 0, share: null, unit: 'sites', date: readiness ? readiness.date : null, pending: true };
  const [bad, of] = pair;
  return { kind: 'readiness', id: e.readiness, pass: of - bad, of, share: of ? ((of - bad) / of) * 100 : null, unit: 'sites', date: readiness.date };
}

export function cisFigures(cis, summary, readiness, place) {
  return cis.safeguards.map((g) => ({ id: g.id, control: g.control, ig: g.ig, title: g.title, controlTitle: cis.controls[g.control], evidence: g.evidence.map((e) => cisEvidence(summary, readiness, place, e)) }));
}
