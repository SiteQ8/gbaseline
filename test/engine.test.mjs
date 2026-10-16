import { test } from 'node:test';
import assert from 'node:assert/strict';
import { txtValue, parseMx, parseCaa, cleanDomain, normalize, createResolver } from '../docs/assets/engine/dns.js';
import { parseDmarc, isDmarc, parseSpf, isSpf, parseMtaStsPolicy, parseMtaStsRecord, parseTlsRpt, parseHsts, parseSecurityTxt } from '../docs/assets/engine/records.js';
import { evaluateSpf, observeDns, evaluate, CHECKS, LEVELS, COMMON_LEVELS, PASS_LEVELS, existence } from '../docs/assets/engine/checks.js';
import { counted, percent, number } from '../docs/assets/engine/i18n.js';
import { fakeResolver } from './helpers.mjs';

test('TXT data: quoted strings join, escapes resolve, raw values pass through', () => {
  assert.equal(txtValue('"v=spf1 " "-all"'), 'v=spf1 -all');
  assert.equal(txtValue('"a\\"b" "c\\059d"'), 'a"bc;d');
  assert.equal(txtValue('v=DMARC1; p=none'), 'v=DMARC1; p=none');
});

test('each resolver format is read the way it is written', () => {
  const cf = normalize({ Status: 0, AD: true, Answer: [{ name: 'x.', type: 16, TTL: 60, data: '"\\"v=DMARC1; p=reject"' }] }, 'TXT', 'cloudflare');
  const gg = normalize({ Status: 0, AD: true, Answer: [{ name: 'x.', type: 16, TTL: 60, data: '"v=DMARC1; p=reject' }] }, 'TXT', 'google');
  assert.equal(cf.answers[0].text, '"v=DMARC1; p=reject', 'a stray quote inside the record survives on Cloudflare');
  assert.equal(gg.answers[0].text, '"v=DMARC1; p=reject', 'and on Google');
  assert.equal(cf.ad, true);
  assert.equal(normalize({ Status: 3 }, 'A', 'google').status, 'NXDOMAIN');
  const mixed = normalize({ Status: 0, Answer: [{ name: 'a', type: 5, data: 'b.' }, { name: 'b', type: 1, data: '1.2.3.4' }] }, 'A', 'google');
  assert.equal(mixed.answers.length, 1, 'only answers of the asked type count');
});

test('MX, null MX and CAA in both notations', () => {
  assert.deepEqual(parseMx('10 mail.example.com.'), { pref: 10, host: 'mail.example.com', isNull: false });
  assert.equal(parseMx('0 .').isNull, true);
  assert.deepEqual(parseCaa('0 issue "letsencrypt.org"'), { flags: 0, tag: 'issue', value: 'letsencrypt.org' });
  assert.deepEqual(parseCaa('\\# 19 00 05 69 73 73 75 65 70 6b 69 2e 67 6f 6f 67'), { flags: 0, tag: 'issue', value: 'pki.goog' });
});

test('domains are cleaned from names, URLs and addresses, and nonsense is refused', () => {
  assert.equal(cleanDomain('https://WWW.Example.COM/path?q=1'), 'www.example.com');
  assert.equal(cleanDomain('security@example.gov.kw'), 'example.gov.kw');
  assert.equal(cleanDomain(' example.com. '), 'example.com');
  assert.equal(cleanDomain('مثال.إختبار'), 'xn--mgbh0fb.xn--kgbechtv');
  for (const bad of ['', 'not a domain', '192.168.1.1', 'localhost', 'a..b', '-x.com']) assert.equal(cleanDomain(bad), null, bad);
});

function fakeFetch(script) {
  const seen = [];
  const impl = async (url) => {
    seen.push(url);
    const step = script(url, seen.length);
    if (step === 'network') throw new TypeError('fetch failed');
    if (typeof step === 'number') return { ok: false, status: step, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => step };
  };
  return { impl, seen };
}

test('the resolver moves to Google on a SERVFAIL or a network failure, retries 429, and caches', async () => {
  const f = fakeFetch((url) => (url.includes('cloudflare') ? { Status: 2 } : { Status: 0, AD: true, Answer: [{ name: 'a.example', type: 1, data: '1.2.3.4' }] }));
  const r = createResolver({ fetch: f.impl, retries: 0 });
  const res = await r.query('a.example', 'A');
  assert.equal(res.status, 'NOERROR');
  assert.equal(res.provider, 'google');
  await r.query('a.example', 'A');
  assert.equal(f.seen.length, 2, 'second ask comes from the cache');
  const g = fakeFetch((url, n) => (url.includes('cloudflare') ? 'network' : n < 3 ? 429 : { Status: 3 }));
  const r2 = createResolver({ fetch: g.impl, retries: 2 });
  assert.equal((await r2.query('gone.example', 'SOA')).status, 'NXDOMAIN');
  const named = await createResolver({ fetch: f.impl, retries: 0 }).query('a.example', 'A', { provider: 'cloudflare' });
  assert.equal(named.status, 'SERVFAIL', 'a named provider is never swapped');
  const dead = createResolver({ fetch: async () => { throw new TypeError('down'); }, retries: 0 });
  assert.equal((await dead.query('x.example', 'A')).status, 'ERROR');
});

test('no more requests are in flight than the limit allows', async () => {
  let live = 0;
  let peak = 0;
  const impl = async () => { live += 1; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live -= 1; return { ok: true, status: 200, json: async () => ({ Status: 0 }) }; };
  const r = createResolver({ fetch: impl, maxInFlight: 3, retries: 0 });
  await Promise.all(Array.from({ length: 20 }, (_, i) => r.query(`n${i}.example`, 'A')));
  assert.ok(peak <= 3, `peak ${peak}`);
});

test('DMARC follows RFC 7489', () => {
  assert.ok(isDmarc('v=DMARC1; p=reject') && isDmarc('V = dmarc1 ;p=none') && !isDmarc('"v=DMARC1; p=reject') && !isDmarc('v=DMARC10'));
  assert.equal(parseDmarc('v=DMARC1; p=Reject; pct=100').policy, 'reject');
  assert.equal(parseDmarc('v=DMARC1; p=quarantine; pct=25').pct, 25);
  const fallback = parseDmarc('v=DMARC1; p=block; rua=mailto:a@example.com');
  assert.equal(fallback.policy, 'none', 'an unknown policy with reports falls back to none');
  assert.equal(parseDmarc('v=DMARC1; rua=').valid, false, 'no policy and no reports is unusable');
  assert.ok(parseDmarc('v=DMARC1; p=reject; pct=200').problems.includes('pct-invalid'));
});

test('SPF terms, qualifiers and modifiers', () => {
  assert.ok(isSpf('v=spf1 -all') && isSpf('V=SPF1') && !isSpf('v=spf10 -all'));
  const s = parseSpf('v=spf1 ip4:192.0.2.0/24 include:_spf.example.net ~all exp=explain.example');
  assert.equal(s.all, '~');
  assert.deepEqual(s.mechanisms.map((m) => m.name), ['ip4', 'include', 'all']);
  assert.equal(s.modifiers.exp, 'explain.example');
  assert.ok(parseSpf('v=spf1 bogus:x -all').problems.some((p) => p.startsWith('unknown-term')));
});

test('MTA-STS record and policy, TLS-RPT, HSTS', () => {
  assert.equal(parseMtaStsRecord('v=STSv1; id=20261019').valid, true);
  assert.equal(parseMtaStsRecord('v=STSv1; id=').valid, false);
  const policy = parseMtaStsPolicy('version: STSv1\nmode: enforce\nmx: mail.example.com\nmax_age: 604800\n');
  assert.deepEqual({ valid: policy.valid, mode: policy.mode, mx: policy.mx }, { valid: true, mode: 'enforce', mx: ['mail.example.com'] });
  assert.equal(parseMtaStsPolicy('version: STSv1\nmode: enforce\nmax_age: 600').valid, false, 'enforce needs an mx');
  assert.equal(parseTlsRpt('v=TLSRPTv1; rua=mailto:r@example.com,https://r.example/x').rua.length, 2);
  assert.equal(parseTlsRpt('v=TLSRPTv1; rua=ftp://x').valid, false);
  assert.deepEqual(parseHsts('max-age=31536000; includeSubDomains; preload'), { maxAge: 31536000, includeSubDomains: true, preload: true });
  assert.equal(parseHsts('max-age="600"').maxAge, 600);
  assert.equal(parseHsts(null), null);
});

test('security.txt follows RFC 9116', () => {
  const now = new Date('2026-10-19T00:00:00Z');
  assert.equal(parseSecurityTxt('Contact: mailto:s@example.com\nExpires: 2027-01-01T00:00:00Z\n', now).valid, true);
  assert.deepEqual(parseSecurityTxt('Contact: mailto:s@example.com\nExpires: 2026-01-01T00:00:00Z', now).problems, ['expired']);
  assert.ok(parseSecurityTxt('Expires: 2027-01-01T00:00:00Z', now).problems.includes('contact-missing'));
  assert.ok(parseSecurityTxt('Contact: x\nExpires: 2027-01-01T00:00:00Z\nExpires: 2028-01-01T00:00:00Z', now).problems.includes('expires-repeated'));
  assert.equal(parseSecurityTxt('<!doctype html><html><body>Not found</body></html>', now).html, true);
  assert.ok(parseSecurityTxt('# only comments\n', now).problems.includes('no-fields'));
});

test('SPF lookups are counted through includes and redirects, to the limit of ten', async () => {
  const table = {
    'a.example TXT': { answers: ['v=spf1 include:one.example include:two.example -all'] },
    'one.example TXT': { answers: ['v=spf1 a mx -all'] },
    'two.example TXT': { answers: ['v=spf1 include:one.example ~all'] },
    'r.example TXT': { answers: ['v=spf1 redirect=a.example'] },
    'loop.example TXT': { answers: ['v=spf1 include:loop.example -all'] },
    'miss.example TXT': { answers: ['v=spf1 include:nothing.example -all'] },
    'many.example TXT': { answers: [`v=spf1 ${Array.from({ length: 11 }, (_, i) => `a:h${i}.example`).join(' ')} -all`] },
    'dup.example TXT': { answers: ['v=spf1 -all', 'v=spf1 ~all'] },
    'odd.example TXT': { answers: ['"v=spf1 -all'] },
  };
  const r = fakeResolver(table);
  const a = await evaluateSpf('a.example', r);
  assert.deepEqual({ status: a.status, all: a.all, lookups: a.lookups }, { status: 'ok', all: '-', lookups: 7 }, 'two includes, a and mx twice, the nested include');
  const red = await evaluateSpf('r.example', r);
  assert.equal(red.all, '-', 'the redirect target decides the closing rule');
  assert.equal(red.lookups, 8);
  assert.ok((await evaluateSpf('loop.example', r)).problems.includes('include-loop'));
  assert.ok((await evaluateSpf('miss.example', r)).problems.some((p) => p.startsWith('include-missing')));
  assert.ok((await evaluateSpf('many.example', r)).problems.includes('too-many-lookups'));
  assert.equal((await evaluateSpf('dup.example', r)).status, 'multiple');
  assert.deepEqual((await evaluateSpf('odd.example', r)).problems, ['malformed']);
  assert.equal((await evaluateSpf('none.example', r)).status, 'missing');
});

const strong = {
  'good.example SOA': { ad: true },
  'good.example MX': { answers: ['10 mail.good.example.'] },
  'good.example TXT': { answers: ['v=spf1 mx -all'] },
  '_dmarc.good.example TXT': { answers: ['v=DMARC1; p=reject; rua=mailto:d@good.example'] },
  '_mta-sts.good.example TXT': { answers: ['v=STSv1; id=1'] },
  '_smtp._tls.good.example TXT': { answers: ['v=TLSRPTv1; rua=mailto:t@good.example'] },
  'good.example CAA': { answers: ['0 issue "letsencrypt.org"'] },
  'good.example A': { answers: ['192.0.2.1'] },
};

test('a well configured domain passes every DNS check', async () => {
  const obs = await observeDns('good.example', fakeResolver(strong));
  const r = evaluate(obs, { chain: true });
  assert.deepEqual(Object.fromEntries(['dmarc', 'spf', 'tls_rpt', 'dnssec', 'caa'].map((k) => [k, r[k].state])), { dmarc: 'pass', spf: 'pass', tls_rpt: 'pass', dnssec: 'pass', caa: 'pass' });
  assert.deepEqual(r.mta_sts, { state: 'unknown', level: 'record-only' }, 'the browser sees the record, the policy needs the full check');
  assert.equal(r.https.level, 'not-measured');
  obs.mtaSts.policy = { valid: true, mode: 'enforce', mx: ['mail.good.example'], maxAge: 604800 };
  assert.equal(evaluate(obs).mta_sts.state, 'pass');
});

test('weak, missing and odd configurations each get their level', async () => {
  const t = {
    'weak.example SOA': {},
    'weak.example MX': { answers: ['0 .'] },
    '_dmarc.weak.example TXT': { answers: ['v=DMARC1; p=quarantine; pct=50'] },
    'weak.example TXT': { answers: ['v=spf1 +all'] },
    'odd.example SOA': {},
    '_dmarc.odd.example TXT': { answers: ['"v=DMARC1; p=reject'] },
    'odd.example CAA': {},
    'example CAA': { answers: ['0 issue "ca.example"'] },
  };
  const r = fakeResolver(t);
  const w = evaluate(await observeDns('weak.example', r), { chain: false });
  assert.deepEqual([w.dmarc.level, w.spf.level, w.mta_sts.level, w.dnssec.level, w.caa.level], ['partial', 'open', 'no-mail', 'chain-unavailable', 'inherited']);
  const o = evaluate(await observeDns('odd.example', r));
  assert.equal(o.dmarc.level, 'invalid', 'a record wrapped in stray quotes is malformed, not missing');
  assert.equal(o.dnssec.level, 'unsigned');
});

test('existence: gone, broken DNSSEC seen by one resolver, and the two resolvers disagreeing on DMARC', async () => {
  const gone = fakeResolver({ 'gone.example SOA': 'NXDOMAIN' });
  assert.deepEqual(await existence('gone.example', gone), { state: 'nxdomain' });
  assert.equal(evaluate(await observeDns('gone.example', gone)).dmarc.state, 'na');
  const bogus = fakeResolver({}, { providers: { cloudflare: { 'b.example SOA': 'SERVFAIL', 'b.example SOA cd': { ad: false } } } });
  const e = await existence('b.example', bogus);
  assert.deepEqual(e, { state: 'live', ad: false, bogus: true });
  const broken = fakeResolver({ 'x.example SOA': 'SERVFAIL', 'x.example SOA cd': 'SERVFAIL' });
  assert.equal((await existence('x.example', broken)).state, 'broken');
  const split = fakeResolver({ 'd.example SOA': {} }, { providers: { cloudflare: { '_dmarc.d.example TXT': { answers: ['v=DMARC1; p=reject'] } }, google: { '_dmarc.d.example TXT': { answers: ['v=DMARC1; p=none'] } } } });
  const obs = await observeDns('d.example', split);
  assert.equal(obs.dmarc.agreement, false);
  assert.deepEqual(evaluate(obs).dmarc, { state: 'unknown', level: 'resolvers-disagree' });
});

const webOk = { state: 'ok', site: 'www.good.example', https: { ok: true, certOk: true, chainComplete: true, hsts: { maxAge: 63072000, includeSubDomains: true, preload: true } }, http: { state: 'redirects-https' }, tls: { tls13: true, pq: true, tls10: false, tls11: false }, securityTxt: { found: true, valid: true } };

test('web observations become verdicts', async () => {
  const obs = await observeDns('good.example', fakeResolver(strong));
  obs.web = webOk;
  const r = evaluate(obs, { chain: true });
  for (const id of ['https', 'redirect', 'hsts', 'tls13', 'legacy_tls', 'pq_kex', 'security_txt']) assert.equal(r[id].state, 'pass', id);
  assert.equal(r.hsts.level, 'preload-ready');
  obs.web = { ...webOk, tls: { tls13: false, pq: false, tls10: true, tls11: false } };
  const legacy = evaluate(obs, { chain: true });
  assert.deepEqual([legacy.tls13.level, legacy.pq_kex.level, legacy.legacy_tls.level], ['not-supported', 'no-tls13', 'tls10']);
  obs.web = { ...webOk, https: { ok: true, certOk: false, certProblem: 'expired', hsts: null } };
  const expired = evaluate(obs);
  assert.deepEqual([expired.https.level, expired.hsts.level], ['expired', 'no-https']);
  obs.web = { state: 'unreachable' };
  assert.deepEqual(evaluate(obs).https, { state: 'unknown', level: 'unreachable' });
  obs.web = { state: 'none' };
  assert.deepEqual(evaluate(obs).security_txt, { state: 'na', level: 'no-web' });
  obs.web = { ...webOk, https: { ok: false, closed: true }, securityTxt: { found: false } };
  const closed = evaluate(obs);
  assert.deepEqual([closed.https.level, closed.redirect.state, closed.security_txt.level], ['no-https', 'pass', 'missing']);
  obs.web = { ...webOk, securityTxt: { found: true, valid: false, expired: true } };
  assert.equal(evaluate(obs).security_txt.level, 'expired');
  obs.web = { ...webOk, https: { ...webOk.https, chainComplete: false } };
  assert.equal(evaluate(obs).https.level, 'valid-incomplete-chain');
});

test('every level the evaluator returns is declared, and every pass level is a real level', async () => {
  const seen = new Map();
  const note = (r) => { for (const [id, v] of Object.entries(r)) { if (!seen.has(id)) seen.set(id, new Set()); seen.get(id).add(v.level); } };
  const obs = await observeDns('good.example', fakeResolver(strong));
  for (const web of [undefined, webOk, { state: 'none' }, { state: 'unreachable' }, { ...webOk, https: { ok: false }, http: { state: 'serves-http' } }]) { obs.web = web; note(evaluate(obs, { chain: false })); }
  for (const [id, levels] of seen) for (const l of levels) assert.ok(LEVELS[id].includes(l) || COMMON_LEVELS.includes(l), `${id} returned undeclared level ${l}`);
  const declared = new Set(Object.values(LEVELS).flat());
  for (const l of PASS_LEVELS) assert.ok(declared.has(l), `pass level ${l} is declared`);
});

test('Arabic counts agree with their number, percentages keep Western digits', () => {
  const w = { en: ['domain', 'domains'], ar: ['نطاق واحد', 'نطاقان', 'نطاقات', 'نطاقاً', 'نطاق'] };
  assert.deepEqual([1, 2, 3, 10, 11, 99, 100, 102, 103, 3955].map((n) => counted(n, w, 'ar')), ['نطاق واحد', 'نطاقان', '3 نطاقات', '10 نطاقات', '11 نطاقاً', '99 نطاقاً', '100 نطاق', '102 نطاق', '103 نطاقات', '3,955 نطاقاً']);
  assert.equal(counted(3955, w, 'en'), '3,955 domains');
  assert.equal(percent(61.54, 'ar'), '61.5٪', 'one decimal, like the open data');
  assert.equal(percent(7, 'en'), '7.0%');
  assert.equal(percent(null, 'en'), '');
  assert.equal(number(12345, 'ar'), '12,345', 'grouped by thousands in both languages');
});
