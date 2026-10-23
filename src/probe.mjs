// Node probes for what a browser cannot read: HTTPS and plain HTTP behaviour, HSTS, TLS versions,
// the post quantum hybrid key exchange, security.txt and the MTA-STS policy file.
// Plain node:http, node:https and node:tls, no dependencies. Every probe is a normal, single request.
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { parseHsts, parseSecurityTxt, parseMtaStsPolicy } from '../docs/assets/engine/records.js';
import { observeDns, evaluate } from '../docs/assets/engine/checks.js';
import { identify } from '../docs/assets/engine/software.js';

export const PQ_GROUP = 'X25519MLKEM768';
const CHAIN_GAPS = new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_GET_ISSUER_CERT']);
const SELF_SIGNED = new Set(['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN']);
const REFUSED = new Set(['ECONNREFUSED']);
const NO_ROUTE = new Set(['ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND', 'timeout']);

// OpenSSL 3.5 or later offers the hybrid group; older runtimes cannot measure it.
export function pqCapable() {
  const [maj, min] = String(process.versions.openssl || '0.0').split('.').map(Number);
  return maj > 3 || (maj === 3 && min >= 5);
}

// One request, no redirects followed, the body read up to maxBytes. TLS facts are captured from the socket.
export function request(url, { timeout = 10000, maxBytes = 32768, agent = 'observatory', body = false, html = false, port } = {}) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { resolve({ error: 'bad-url' }); return; }
    const lib = u.protocol === 'https:' ? https : http;
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const req = lib.request({
      host: u.hostname,
      port: port || u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      servername: u.hostname,
      rejectUnauthorized: false,
      agent: false,
      headers: { 'user-agent': agent, accept: body && !html ? 'text/plain, */*;q=0.5' : 'text/html, */*;q=0.5', connection: 'close' },
      timeout,
    }, (res) => {
      const sock = res.socket;
      const tlsInfo = u.protocol === 'https:' && sock && typeof sock.getPeerCertificate === 'function' ? {
        authorized: sock.authorized,
        error: sock.authorized ? null : String((sock.authorizationError && (sock.authorizationError.code || sock.authorizationError)) || 'unknown'),
        cert: sock.getPeerCertificate(false),
        protocol: sock.getProtocol(),
      } : null;
      const out = { status: res.statusCode, headers: res.headers, tls: tlsInfo, text: '' };
      if (!body && !html) { res.destroy(); finish(out); return; }
      const chunks = [];
      let size = 0;
      res.on('data', (c) => { size += c.length; if (size <= maxBytes) chunks.push(c); else { res.destroy(); } });
      res.on('end', () => finish({ ...out, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('close', () => finish({ ...out, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', () => finish({ ...out, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => { req.destroy(); finish({ error: 'timeout' }); });
    req.on('error', (e) => finish({ error: e.code || e.message || 'error' }));
    req.end();
  });
}

const inFamily = (host, domain) => host === domain || host.endsWith(`.${domain}`);
const locationOf = (res, base) => { try { return new URL(res.headers.location, base); } catch { return null; } };

export function certVerdict(host, info, now = Date.now()) {
  if (!info) return { certOk: false, certProblem: 'handshake-failed', chainComplete: null };
  if (info.authorized) return { certOk: true, certProblem: null, chainComplete: true };
  const cert = info.cert || {};
  const expired = cert.valid_to ? Date.parse(cert.valid_to) <= now : false;
  if (expired || info.error === 'CERT_HAS_EXPIRED') return { certOk: false, certProblem: 'expired', chainComplete: null };
  if (SELF_SIGNED.has(info.error)) return { certOk: false, certProblem: 'self-signed', chainComplete: null };
  if (info.error === 'ERR_TLS_CERT_ALTNAME_INVALID') return { certOk: false, certProblem: 'name-mismatch', chainComplete: null };
  if (CHAIN_GAPS.has(info.error)) {
    // The server left out an intermediate. Browsers often repair this, other clients do not. The name must still match.
    const nameError = cert.subject || cert.subjectaltname ? tls.checkServerIdentity(host, cert) : new Error('no-cert');
    if (nameError) return { certOk: false, certProblem: 'name-mismatch', chainComplete: false };
    return { certOk: true, certProblem: null, chainComplete: false };
  }
  return { certOk: false, certProblem: 'untrusted', chainComplete: null };
}

// One TLS handshake with chosen limits. Resolves { ok, protocol, error }.
export function handshake(host, { min, max, groups, ciphers, timeout = 8000, port = 443 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const opts = { host, port, servername: host, rejectUnauthorized: false, ALPNProtocols: ['http/1.1'] };
    if (min) opts.minVersion = min;
    if (max) opts.maxVersion = max;
    if (groups) opts.ecdhCurve = groups;
    if (ciphers) opts.ciphers = ciphers;
    let sock;
    const finish = (v) => { if (done) return; done = true; try { sock.destroy(); } catch { /* gone */ } resolve(v); };
    try { sock = tls.connect(opts, () => finish({ ok: true, protocol: sock.getProtocol() })); } catch (e) { resolve({ ok: false, error: e.code || 'error' }); return; }
    sock.setTimeout(timeout, () => finish({ ok: false, error: 'timeout' }));
    sock.on('error', (e) => finish({ ok: false, error: e.code || e.message || 'error' }));
  });
}

// A refusal is an answer (false). A timeout is not (null): the probe could not tell.
const verdictOf = (r) => (r.ok ? true : NO_ROUTE.has(r.error) ? null : false);

export async function probeTls(host, opts = {}) {
  const t = { timeout: opts.timeout, port: opts.port || 443 };
  const base = await handshake(host, { min: 'TLSv1.2', max: 'TLSv1.3', ...t });
  if (!base.ok) return { reachable: false, error: base.error };
  const [pq, tls10, tls11] = await Promise.all([
    pqCapable() ? handshake(host, { min: 'TLSv1.3', max: 'TLSv1.3', groups: PQ_GROUP, ...t }) : Promise.resolve(null),
    handshake(host, { min: 'TLSv1', max: 'TLSv1', ciphers: 'ALL:@SECLEVEL=0', ...t }),
    handshake(host, { min: 'TLSv1.1', max: 'TLSv1.1', ciphers: 'ALL:@SECLEVEL=0', ...t }),
  ]);
  return {
    reachable: true,
    protocol: base.protocol,
    tls13: base.protocol === 'TLSv1.3',
    pq: pq === null ? null : verdictOf(pq),
    tls10: verdictOf(tls10),
    tls11: verdictOf(tls11),
  };
}

async function securityTxt(origins, opts) {
  let sawResponse = false;
  for (const origin of origins) {
    for (const path of ['/.well-known/security.txt', '/security.txt']) {
      let url = `${origin}${path}`;
      for (let hop = 0; hop < 4; hop += 1) {
        const res = await request(url, { ...opts, body: true });
        if (res.error) break;
        sawResponse = true;
        if (res.status >= 300 && res.status < 400 && res.headers.location) {
          const next = locationOf(res, url);
          if (!next || next.protocol !== 'https:') break;
          url = next.href;
          continue;
        }
        if (res.status === 200) {
          const parsed = parseSecurityTxt(res.text);
          if (!parsed.html && !parsed.problems.includes('no-fields')) {
            return { found: true, url, contentType: String(res.headers['content-type'] || ''), ...parsed };
          }
        }
        break;
      }
    }
  }
  return sawResponse ? { found: false } : { error: 'unreachable' };
}

export async function mtaStsPolicy(domain, opts = {}) {
  const res = await request(`https://mta-sts.${domain}/.well-known/mta-sts.txt`, { ...opts, body: true });
  // RFC 8461 section 3.3: a valid certificate is required and redirects are not followed.
  if (res.error || res.status !== 200 || !res.tls || !res.tls.authorized) return null;
  return parseMtaStsPolicy(res.text);
}

async function plainHttp(host, opts) {
  let url = `http://${host}${opts.httpPort ? `:${opts.httpPort}` : ''}/`;
  for (let hop = 0; hop < 4; hop += 1) {
    const res = await request(url, opts);
    if (res.error) return { state: REFUSED.has(res.error) && hop === 0 ? 'closed' : 'error', error: res.error };
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const next = locationOf(res, url);
      if (!next) return { state: 'serves-http' };
      if (next.protocol === 'https:') return { state: 'redirects-https', location: next.origin };
      url = next.href;
      continue;
    }
    return { state: hop === 0 ? 'serves-http' : 'redirects-http', status: res.status };
  }
  return { state: 'redirects-http' };
}

export async function observeWeb(domain, hosts, opts = {}) {
  const candidates = [];
  if (hosts.apex && hosts.apex.v4 + hosts.apex.v6 > 0) candidates.push(domain);
  if (hosts.www && hosts.www.v4 + hosts.www.v6 > 0) candidates.push(`www.${domain}`);
  if (!candidates.length) return { state: 'none' };

  const sp = opts.httpsPort ? `:${opts.httpsPort}` : '';
  let first = null;
  const errors = [];
  for (const host of candidates) {
    const res = await request(`https://${host}${sp}/`, opts);
    if (!res.error) { first = { host, res }; break; }
    errors.push(res.error);
  }
  const http0 = await plainHttp(candidates[0], opts);
  if (!first) {
    const closed = errors.every((e) => REFUSED.has(e));
    // Nothing listens on either port: the name has an address but no website.
    if (closed && http0.state === 'closed') return { state: 'none', reason: 'nothing-listening' };
    if (http0.state === 'error' && errors.every((e) => NO_ROUTE.has(e) || e === 'ECONNRESET' || REFUSED.has(e))) return { state: 'unreachable', errors };
    return { state: 'ok', site: candidates[0], https: { ok: false, closed }, http: http0, tls: {}, securityTxt: { found: false } };
  }

  // Follow HTTPS redirects that stay inside the domain to reach the canonical host.
  let { host, res } = first;
  const verdict = certVerdict(host, res.tls);
  let url = `https://${host}${sp}/`;
  for (let hop = 0; hop < 5 && res.status >= 300 && res.status < 400 && res.headers.location; hop += 1) {
    const next = locationOf(res, url);
    if (!next || next.protocol !== 'https:' || !inFamily(next.hostname, domain)) break;
    const r2 = await request(next.href, opts);
    if (r2.error) break;
    host = next.hostname;
    url = next.href;
    res = r2;
  }
  const hsts = parseHsts(res.headers['strict-transport-security']);
  const tlsFacts = await probeTls(host, { timeout: opts.timeout, port: opts.httpsPort });
  const origins = [...new Set([`https://${host}${sp}`, `https://${first.host}${sp}`])];
  const sec = await securityTxt(origins, opts);
  return {
    state: 'ok',
    site: host,
    https: { ok: true, status: res.status, hsts, ...verdict },
    http: http0,
    tls: tlsFacts.reachable ? tlsFacts : { tls13: false, pq: null, tls10: null, tls11: null },
    securityTxt: sec,
  };
}

// What the first page a visitor receives says about the software behind it, read from the headers and the page
// itself: HTTPS first, following redirects that stay inside the domain, and plain HTTP only when HTTPS answers
// nothing at all. One ordinary request per hop, the page read up to 64 KB, nothing else asked of the site.
export async function observeSoftware(domain, hosts, opts = {}) {
  const candidates = [];
  if (hosts.apex && hosts.apex.v4 + hosts.apex.v6 > 0) candidates.push(domain);
  if (hosts.www && hosts.www.v4 + hosts.www.v6 > 0) candidates.push(`www.${domain}`);
  if (!candidates.length) return { state: 'none' };
  const o = { timeout: opts.timeout || 10000, agent: opts.agent || 'observatory', html: true, maxBytes: 65536 };
  const sp = opts.httpsPort ? `:${opts.httpsPort}` : '';
  const hp = opts.httpPort ? `:${opts.httpPort}` : '';
  const errors = [];
  const follow = async (url) => {
    let res = await request(url, o);
    for (let hop = 0; hop < 5 && !res.error && res.status >= 300 && res.status < 400 && res.headers.location; hop += 1) {
      const next = locationOf(res, url);
      if (!next || !inFamily(next.hostname, domain)) break;
      const r2 = await request(next.href, o);
      if (r2.error) break;
      url = next.href;
      res = r2;
    }
    return res;
  };
  for (const scheme of ['https', 'http']) {
    for (const host of candidates) {
      const res = await follow(`${scheme}://${host}${scheme === 'https' ? sp : hp}/`);
      if (res.error) { errors.push(res.error); continue; }
      const h = res.headers || {};
      return {
        state: 'ok',
        scheme,
        status: res.status,
        software: identify({ server: h.server, powered: h['x-powered-by'], aspnet: h['x-aspnet-version'], generator: h['x-generator'], html: res.text }),
      };
    }
  }
  if (errors.length && errors.every((e) => REFUSED.has(e))) return { state: 'none', reason: 'nothing-listening' };
  return { state: 'unreachable', errors };
}

// Everything the observatory measures for one domain, then the verdicts.
export async function observeDomain(domain, resolver, ctx = {}) {
  const obs = await observeDns(domain, resolver);
  if (obs.dns.state === 'live') {
    const opts = { timeout: ctx.timeout || 10000, agent: ctx.agent || 'observatory' };
    obs.web = ctx.skipWeb ? undefined : await observeWeb(domain, obs.hosts, opts);
    if (obs.mtaSts.record && obs.mtaSts.record.valid && !ctx.skipWeb) obs.mtaSts.policy = await mtaStsPolicy(domain, opts);
  }
  return { obs, results: evaluate(obs, { chain: ctx.chain }) };
}
