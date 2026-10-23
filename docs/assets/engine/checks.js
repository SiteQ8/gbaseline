// The checks: what is observed over DNS for one domain, and how every observation becomes a result.
// observeDns runs in the browser and in Node. Web and TLS observations come from the Node probes
// (src/probe.mjs) in the same shape, so the site, the command line and the weekly scan share one evaluator.
import { txtValue, parseMx, parseCaa } from './dns.js';
import { isDmarc, parseDmarc, isSpf, parseSpf, isMtaSts, parseMtaStsRecord, isTlsRpt, parseTlsRpt } from './records.js';

export const CHECKS = [
  { id: 'dmarc', group: 'email' },
  { id: 'spf', group: 'email' },
  { id: 'mta_sts', group: 'email' },
  { id: 'tls_rpt', group: 'email' },
  { id: 'dnssec', group: 'dns' },
  { id: 'caa', group: 'dns' },
  { id: 'https', group: 'web' },
  { id: 'redirect', group: 'web' },
  { id: 'hsts', group: 'web' },
  { id: 'tls13', group: 'web' },
  { id: 'legacy_tls', group: 'web' },
  { id: 'pq_kex', group: 'web' },
  { id: 'security_txt', group: 'disclosure' },
];
export const GROUPS = ['email', 'dns', 'web', 'disclosure'];
// Every level evaluate() can return, per check. The build fails when one has no wording in both languages.
// Levels that come with a passing result, so a breakdown can mark each one.
export const PASS_LEVELS = new Set(['reject', 'quarantine', 'strict', 'soft', 'enforce', 'present', 'validated', 'own', 'inherited', 'valid', 'valid-incomplete-chain', 'redirects-https', 'closed', 'preload-ready', 'one-year', 'supported', 'refused', 'hybrid']);
export const NA_LEVELS = new Set(['no-mail', 'no-web', 'no-domain']);
export const COMMON_LEVELS = ['no-domain', 'dns-broken', 'dns-error', 'resolvers-disagree', 'no-mail', 'not-measured', 'no-web', 'unreachable', 'probe-failed', 'missing'];
export const LEVELS = {
  dmarc: ['reject', 'quarantine', 'partial', 'none', 'invalid', 'multiple', 'missing'],
  spf: ['strict', 'soft', 'neutral', 'open', 'no-all', 'too-many-lookups', 'multiple', 'error', 'invalid', 'missing'],
  mta_sts: ['enforce', 'testing', 'none', 'missing', 'invalid', 'policy-unreachable', 'policy-invalid', 'record-only'],
  tls_rpt: ['present', 'missing', 'invalid'],
  dnssec: ['validated', 'unsigned', 'chain-unavailable', 'bogus'],
  caa: ['own', 'inherited', 'none'],
  https: ['valid', 'valid-incomplete-chain', 'expired', 'self-signed', 'name-mismatch', 'untrusted', 'handshake-failed', 'no-https'],
  redirect: ['redirects-https', 'closed', 'serves-http', 'redirects-http', 'http-error'],
  hsts: ['preload-ready', 'one-year', 'short', 'disabled', 'missing', 'no-https'],
  tls13: ['supported', 'not-supported', 'no-https'],
  legacy_tls: ['refused', 'tls10', 'tls11', 'no-https'],
  pq_kex: ['hybrid', 'classical', 'no-tls13', 'no-https', 'probe-failed'],
  security_txt: ['valid', 'expired', 'incomplete', 'missing', 'fetch-error'],
};
export const SPF_LOOKUP_LIMIT = 10;
export const HSTS_MIN = 31536000;

const records = (res) => res.answers.map((a) => (a.text !== undefined ? a.text : txtValue(a.data)));
const failed = (res) => res.status === 'ERROR' || res.status === 'SERVFAIL' || res.status === 'REFUSED';
const sameSet = (a, b) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
const normDmarc = (list) => list.filter(isDmarc).map((s) => s.replace(/\s+/g, ' ').trim());
// A TXT record that mentions the tag but does not start with it (stray quotes, a leading space) is ignored by receivers.
const malformed = (list, re) => list.some((s) => re.test(s));

// SPF with every include and redirect followed, counting the DNS lookups RFC 7208 section 4.6.4 limits to ten.
export async function evaluateSpf(domain, resolver, ctx = { lookups: 0 }, depth = 0, path = new Set()) {
  const res = await resolver.query(domain, 'TXT');
  if (failed(res)) return { status: 'temperror', all: null, lookups: ctx.lookups, problems: [`dns-${res.status.toLowerCase()}`] };
  const all = records(res);
  const found = all.filter(isSpf);
  if (!found.length) return { status: depth ? 'include-missing' : 'missing', all: null, lookups: ctx.lookups, problems: !depth && malformed(all, /v=spf1/i) ? ['malformed'] : [] };
  if (found.length > 1) return { status: 'multiple', all: null, lookups: ctx.lookups, problems: [], records: found };
  const spf = parseSpf(found[0]);
  const problems = [...spf.problems];
  if (problems.some((p) => p.startsWith('unknown-term'))) return { status: 'permerror', all: spf.all, lookups: ctx.lookups, problems, record: found[0] };
  const here = new Set([...path, domain]);
  for (const m of spf.mechanisms) {
    if (!['include', 'a', 'mx', 'ptr', 'exists'].includes(m.name)) continue;
    ctx.lookups += 1;
    if (ctx.lookups > SPF_LOOKUP_LIMIT) return { status: 'permerror', all: spf.all, lookups: ctx.lookups, problems: [...problems, 'too-many-lookups'], record: found[0] };
    if (m.name === 'include' && m.value && !m.value.includes('%') && depth < 10) {
      const target = m.value.toLowerCase().replace(/\.$/, '');
      if (here.has(target)) return { status: 'permerror', all: spf.all, lookups: ctx.lookups, problems: [...problems, 'include-loop'], record: found[0] };
      const inner = await evaluateSpf(target, resolver, ctx, depth + 1, here);
      if (inner.status === 'temperror') return { ...inner, record: found[0] };
      if (inner.status !== 'ok') return { status: 'permerror', all: spf.all, lookups: ctx.lookups, problems: [...problems, inner.status === 'include-missing' ? `include-missing:${target}` : `include-error:${target}`, ...inner.problems], record: found[0] };
    }
  }
  let policy = spf.all;
  if (!policy && spf.modifiers.redirect) {
    ctx.lookups += 1;
    const target = spf.modifiers.redirect.toLowerCase().replace(/\.$/, '');
    if (ctx.lookups > SPF_LOOKUP_LIMIT) return { status: 'permerror', all: null, lookups: ctx.lookups, problems: [...problems, 'too-many-lookups'], record: found[0] };
    if (target.includes('%')) return { status: 'ok', all: null, lookups: ctx.lookups, problems: [...problems, 'redirect-macro'], record: found[0] };
    if (here.has(target)) return { status: 'permerror', all: null, lookups: ctx.lookups, problems: [...problems, 'redirect-loop'], record: found[0] };
    const inner = await evaluateSpf(target, resolver, ctx, depth + 1, here);
    if (inner.status === 'temperror') return { ...inner, record: found[0] };
    if (inner.status !== 'ok') return { status: 'permerror', all: null, lookups: ctx.lookups, problems: [...problems, `redirect-error:${target}`], record: found[0] };
    policy = inner.all;
  }
  return { status: 'ok', all: policy, lookups: ctx.lookups, problems, record: found[0] };
}

async function dmarcAgreed(domain, resolver) {
  const name = `_dmarc.${domain}`;
  const pair = async (fresh) => Promise.all(['cloudflare', 'google'].map((provider) => resolver.query(name, 'TXT', { provider, fresh })));
  let [a, b] = await pair(false);
  const usable = (r) => !failed(r);
  if (!usable(a) && !usable(b)) return { status: 'error', records: [], agreement: null };
  if (!usable(a) || !usable(b)) {
    const raw = records(usable(a) ? a : b);
    const list = normDmarc(raw);
    return { status: 'ok', records: list, agreement: null, malformed: !list.length && malformed(raw, /v\s*=\s*dmarc1/i) };
  }
  if (!sameSet(normDmarc(records(a)), normDmarc(records(b)))) [a, b] = await pair(true);
  const ra = normDmarc(records(a));
  const rb = normDmarc(records(b));
  return { status: 'ok', records: ra, agreement: usable(a) && usable(b) ? sameSet(ra, rb) : null, malformed: !ra.length && malformed(records(a), /v\s*=\s*dmarc1/i) };
}

// The CAA record set that governs issuance for a name: its own, or the first one found climbing toward the root (RFC 8659 section 3).
async function caaFor(domain, resolver) {
  const labels = domain.split('.');
  for (let i = 0; i < labels.length; i += 1) {
    const name = labels.slice(i).join('.');
    const res = await resolver.query(name, 'CAA');
    if (failed(res)) return { status: 'error' };
    const list = res.answers.map((a) => parseCaa(a.data)).filter(Boolean);
    if (list.length) return { status: 'ok', at: name, inherited: i > 0, records: list };
  }
  return { status: 'ok', at: null, inherited: false, records: [] };
}

export async function addresses(name, resolver) {
  const [a, aaaa] = await Promise.all([resolver.query(name, 'A'), resolver.query(name, 'AAAA')]);
  return { v4: a.answers.length, v6: aaaa.answers.length, error: failed(a) && failed(aaaa) };
}

// Whether names under a public suffix can validate at all: the suffix's own answers must carry the AD bit.
export async function suffixChain(suffix, resolver) {
  const res = await resolver.query(suffix, 'SOA');
  if (failed(res)) return null;
  return Boolean(res.ad);
}

// Does the name exist, and does DNSSEC validate? Both resolvers are asked. DNSSEC counts as broken (bogus) when a
// validating resolver refuses the answer that it returns once validation is switched off: its users cannot reach the name.
export async function existence(domain, resolver) {
  const names = ['cloudflare', 'google'];
  const ask = (provider) => resolver.query(domain, 'SOA', { provider });
  // A SERVFAIL is asked again once before it counts: resolvers fail transiently under load.
  const settle = async (provider) => {
    const first = await ask(provider);
    if (first.status !== 'SERVFAIL' && first.status !== 'ERROR') return first;
    await new Promise((r) => setTimeout(r, 400));
    return resolver.query(domain, 'SOA', { provider, fresh: true });
  };
  const plain = await Promise.all(names.map(settle));
  const answered = plain.filter((r) => r.status === 'NOERROR' || r.status === 'NXDOMAIN');
  const servfail = names.filter((n, i) => plain[i].status === 'SERVFAIL');
  const cd = await Promise.all(servfail.map((provider) => resolver.query(domain, 'SOA', { provider, cd: true })));
  const bogus = cd.some((r) => r.status === 'NOERROR');
  if (answered.some((r) => r.status === 'NOERROR') || bogus) {
    const ok = answered.filter((r) => r.status === 'NOERROR');
    return { state: 'live', ad: !bogus && ok.length > 0 && ok.every((r) => r.ad), bogus };
  }
  if (answered.length && answered.every((r) => r.status === 'NXDOMAIN')) return { state: 'nxdomain' };
  if (cd.some((r) => r.status === 'NXDOMAIN')) return { state: 'nxdomain' };
  return { state: 'broken', rcode: (plain.find((r) => r.status !== 'ERROR') || plain[0]).status };
}

export async function observeDns(domain, resolver) {
  const obs = { domain, at: new Date().toISOString(), dns: await existence(domain, resolver) };
  if (obs.dns.state !== 'live') return obs;

  const [mx, spf, dmarc, sts, rpt, caa, ds, apex, www] = await Promise.all([
    resolver.query(domain, 'MX'),
    evaluateSpf(domain, resolver),
    dmarcAgreed(domain, resolver),
    resolver.query(`_mta-sts.${domain}`, 'TXT'),
    resolver.query(`_smtp._tls.${domain}`, 'TXT'),
    caaFor(domain, resolver),
    resolver.query(domain, 'DS'),
    addresses(domain, resolver),
    addresses(`www.${domain}`, resolver),
  ]);
  const mxList = mx.answers.map((a) => parseMx(a.data)).filter(Boolean);
  obs.mx = { status: failed(mx) ? 'error' : 'ok', records: mxList, nullMx: mxList.length === 1 && mxList[0].isNull };
  obs.spf = spf;
  obs.dmarc = { ...dmarc, parsed: dmarc.records.length === 1 ? parseDmarc(dmarc.records[0]) : null };
  const stsRecords = failed(sts) ? null : records(sts).filter(isMtaSts);
  obs.mtaSts = { status: failed(sts) ? 'error' : 'ok', record: stsRecords && stsRecords.length === 1 ? parseMtaStsRecord(stsRecords[0]) : null, count: stsRecords ? stsRecords.length : 0 };
  const rptRecords = failed(rpt) ? null : records(rpt).filter(isTlsRpt);
  obs.tlsRpt = { status: failed(rpt) ? 'error' : 'ok', record: rptRecords && rptRecords.length === 1 ? parseTlsRpt(rptRecords[0]) : null, count: rptRecords ? rptRecords.length : 0 };
  obs.caa = caa;
  obs.dns.ds = ds.answers.length > 0;
  obs.hosts = { apex, www };
  return obs;
}

const R = (state, level) => ({ state, level });

// Every check's result for one observation: pass, fail, na (does not apply) or unknown (could not be measured).
export function evaluate(obs, ctx = {}) {
  const out = {};
  const state = obs.dns && obs.dns.state;
  for (const c of CHECKS) out[c.id] = state === 'live' ? null : R(state === 'nxdomain' ? 'na' : 'unknown', state === 'nxdomain' ? 'no-domain' : 'dns-broken');
  if (state !== 'live') return out;

  const d = obs.dmarc;
  if (d.status === 'error') out.dmarc = R('unknown', 'dns-error');
  else if (d.agreement === false) out.dmarc = R('unknown', 'resolvers-disagree');
  else if (!d.records.length) out.dmarc = R('fail', d.malformed ? 'invalid' : 'missing');
  else if (d.records.length > 1) out.dmarc = R('fail', 'multiple');
  else if (!d.parsed.valid) out.dmarc = R('fail', 'invalid');
  else if (d.parsed.policy === 'none') out.dmarc = R('fail', 'none');
  else if (d.parsed.pct < 100) out.dmarc = R('fail', 'partial');
  else out.dmarc = R('pass', d.parsed.policy);

  const s = obs.spf;
  if (s.status === 'temperror') out.spf = R('unknown', 'dns-error');
  else if (s.status === 'missing') out.spf = R('fail', s.problems.includes('malformed') ? 'invalid' : 'missing');
  else if (s.status === 'multiple') out.spf = R('fail', 'multiple');
  else if (s.status !== 'ok') out.spf = R('fail', s.problems.includes('too-many-lookups') ? 'too-many-lookups' : 'error');
  else if (s.all === '-') out.spf = R('pass', 'strict');
  else if (s.all === '~') out.spf = R('pass', 'soft');
  else if (s.all === '+') out.spf = R('fail', 'open');
  else if (s.all === '?') out.spf = R('fail', 'neutral');
  else out.spf = R('fail', 'no-all');

  const receives = obs.mx.status === 'ok' && obs.mx.records.length > 0 && !obs.mx.nullMx;
  if (obs.mx.status === 'error') { out.mta_sts = R('unknown', 'dns-error'); out.tls_rpt = R('unknown', 'dns-error'); }
  else if (!receives) { out.mta_sts = R('na', 'no-mail'); out.tls_rpt = R('na', 'no-mail'); }
  else {
    const m = obs.mtaSts;
    if (m.status === 'error') out.mta_sts = R('unknown', 'dns-error');
    else if (!m.count) out.mta_sts = R('fail', 'missing');
    else if (!m.record || !m.record.valid) out.mta_sts = R('fail', 'invalid');
    else if (m.policy === undefined) out.mta_sts = R('unknown', 'record-only');
    else if (m.policy === null) out.mta_sts = R('fail', 'policy-unreachable');
    else if (!m.policy.valid) out.mta_sts = R('fail', 'policy-invalid');
    else out.mta_sts = m.policy.mode === 'enforce' ? R('pass', 'enforce') : R('fail', m.policy.mode);
    const t = obs.tlsRpt;
    if (t.status === 'error') out.tls_rpt = R('unknown', 'dns-error');
    else if (!t.count) out.tls_rpt = R('fail', 'missing');
    else if (!t.record || !t.record.valid) out.tls_rpt = R('fail', 'invalid');
    else out.tls_rpt = R('pass', 'present');
  }

  if (obs.dns.ad) out.dnssec = R('pass', 'validated');
  else if (obs.dns.bogus) out.dnssec = R('fail', 'bogus');
  else if (ctx.chain === false) out.dnssec = R('fail', 'chain-unavailable');
  else out.dnssec = R('fail', 'unsigned');

  if (obs.caa.status === 'error') out.caa = R('unknown', 'dns-error');
  else if (!obs.caa.records.length) out.caa = R('fail', 'none');
  else out.caa = R('pass', obs.caa.inherited ? 'inherited' : 'own');

  const w = obs.web;
  const web = ['https', 'redirect', 'hsts', 'tls13', 'legacy_tls', 'pq_kex', 'security_txt'];
  const set = (level, st) => { for (const id of web) out[id] = R(st, level); };
  if (!w) set('not-measured', 'unknown');
  else if (w.state === 'none') set('no-web', 'na');
  else if (w.state === 'unreachable') set('unreachable', 'unknown');
  else {
    const h = w.https;
    const httpsOk = Boolean(h && h.ok && h.certOk);
    if (!h || !h.ok) out.https = R('fail', h && h.closed ? 'no-https' : 'handshake-failed');
    else if (!h.certOk) out.https = R('fail', h.certProblem || 'untrusted');
    else out.https = R('pass', h.chainComplete === false ? 'valid-incomplete-chain' : 'valid');

    const p = w.http || {};
    if (p.state === 'redirects-https' || p.state === 'closed') out.redirect = R('pass', p.state);
    else if (p.state === 'serves-http' || p.state === 'redirects-http') out.redirect = R('fail', p.state);
    else out.redirect = R('unknown', 'http-error');

    if (!httpsOk) out.hsts = R('fail', 'no-https');
    else if (!h.hsts || h.hsts.maxAge === null) out.hsts = R('fail', 'missing');
    else if (h.hsts.maxAge === 0) out.hsts = R('fail', 'disabled');
    else if (h.hsts.maxAge < HSTS_MIN) out.hsts = R('fail', 'short');
    else out.hsts = R('pass', h.hsts.includeSubDomains && h.hsts.preload ? 'preload-ready' : 'one-year');

    const t = w.tls || {};
    if (!h || !h.ok) { out.tls13 = R('fail', 'no-https'); out.pq_kex = R('fail', 'no-https'); }
    else {
      out.tls13 = t.tls13 ? R('pass', 'supported') : R('fail', 'not-supported');
      if (t.pq === true) out.pq_kex = R('pass', 'hybrid');
      else if (t.pq === false) out.pq_kex = R('fail', t.tls13 ? 'classical' : 'no-tls13');
      else out.pq_kex = R('unknown', 'probe-failed');
    }
    if (!h || !h.ok) out.legacy_tls = R('unknown', 'no-https');
    else if (t.tls10 === null || t.tls11 === null || t.tls10 === undefined || t.tls11 === undefined) out.legacy_tls = R('unknown', 'probe-failed');
    else if (t.tls10) out.legacy_tls = R('fail', 'tls10');
    else if (t.tls11) out.legacy_tls = R('fail', 'tls11');
    else out.legacy_tls = R('pass', 'refused');

    const x = w.securityTxt;
    if (!x || x.error) out.security_txt = R('unknown', 'fetch-error');
    else if (!x.found) out.security_txt = R('fail', 'missing');
    else if (x.valid) out.security_txt = R('pass', 'valid');
    else if (x.expired) out.security_txt = R('fail', 'expired');
    else out.security_txt = R('fail', 'incomplete');
  }
  return out;
}
