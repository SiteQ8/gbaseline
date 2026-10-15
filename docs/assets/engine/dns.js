// DNS over HTTPS client and record parsers, shared by the site, the command line and the weekly scan.
// Uses the JSON interfaces of two public validating resolvers. No dependencies, no Node built-ins.

export const TYPES = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28, DS: 43, DNSKEY: 48, CAA: 257 };
const RCODES = ['NOERROR', 'FORMERR', 'SERVFAIL', 'NXDOMAIN', 'NOTIMP', 'REFUSED'];

export const PROVIDERS = {
  cloudflare: (name, type, cd) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}${cd ? '&cd=1' : ''}`,
  google: (name, type, cd) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}${cd ? '&cd=1' : ''}`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A resolver with a per run cache. fetchImpl is injectable so tests run offline.
export function createResolver(options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  const order = options.providers || ['cloudflare', 'google'];
  const timeout = options.timeout || 8000;
  const retries = options.retries ?? 2;
  const cache = new Map();
  const stats = { queries: 0, network: 0, failures: 0 };
  // At most maxInFlight requests on the wire at once, so a large scan stays polite to the resolvers.
  const maxInFlight = options.maxInFlight || 48;
  let inFlight = 0;
  const waiting = [];
  const acquire = () => (inFlight < maxInFlight ? (inFlight += 1, Promise.resolve()) : new Promise((r) => waiting.push(r)));
  const release = () => { const next = waiting.shift(); if (next) next(); else inFlight -= 1; };

  async function ask(provider, name, type, cd) {
    const url = PROVIDERS[provider](name, TYPES[type] || type, cd);
    let lastError = 'unreachable';
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await acquire();
      // The clock starts once the request is on the wire, not while it waits for a slot.
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
      try {
        stats.network += 1;
        const res = await fetchImpl(url, { headers: { accept: 'application/dns-json' }, signal: ctrl ? ctrl.signal : undefined });
        if (res.status === 429 || res.status >= 500) { lastError = `http-${res.status}`; await sleep(300 * (attempt + 1)); continue; }
        if (!res.ok) return { error: `http-${res.status}` };
        return { body: await res.json() };
      } catch (e) {
        lastError = e && e.name === 'AbortError' ? 'timeout' : 'network';
        await sleep(200 * (attempt + 1));
      } finally {
        if (timer) clearTimeout(timer);
        release();
      }
    }
    return { error: lastError };
  }

  // Returns { status, ad, answers, authority, provider } or { status: 'ERROR', error }.
  // Without a named provider, a SERVFAIL or a network failure moves on to the next resolver.
  async function query(name, type, opts = {}) {
    const fqdn = String(name).replace(/\.$/, '').toLowerCase();
    const providers = opts.provider ? [opts.provider] : order;
    const key = `${providers.join('+')}|${fqdn}|${type}|${opts.cd ? 1 : 0}`;
    if (!opts.fresh && cache.has(key)) return cache.get(key);
    stats.queries += 1;
    const pending = (async () => {
      let error = 'unreachable';
      let soft = null;
      for (const provider of providers) {
        const r = await ask(provider, fqdn, type, opts.cd);
        if (r.body) {
          const res = normalize(r.body, type, provider);
          if (res.status !== 'SERVFAIL') return res;
          soft = soft || res;
          continue;
        }
        error = r.error;
      }
      if (soft) return soft;
      stats.failures += 1;
      return { status: 'ERROR', error, ad: false, answers: [], authority: [], provider: null };
    })();
    cache.set(key, pending);
    return pending;
  }

  return { query, stats, cache };
}

export function normalize(body, type, provider) {
  const code = TYPES[type] || type;
  const status = RCODES[body.Status] || `RCODE${body.Status}`;
  // Cloudflare presents TXT data as quoted character strings, Google as the raw joined value.
  const text = (data) => (code === 16 ? (provider === 'google' ? String(data) : txtValue(data)) : undefined);
  const answers = (body.Answer || []).filter((a) => a.type === code).map((a) => ({ name: String(a.name).replace(/\.$/, ''), ttl: a.TTL, data: a.data, text: text(a.data) }));
  const authority = (body.Authority || []).map((a) => ({ name: String(a.name).replace(/\.$/, ''), type: a.type, data: a.data }));
  return { status, ad: Boolean(body.AD), answers, authority, provider };
}

// TXT data arrives as one or more quoted character strings: "part one" "part two".
export function txtValue(data) {
  const s = String(data).trim();
  if (!s.startsWith('"')) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    while (i < s.length && s[i] !== '"') i += 1;
    if (i >= s.length) break;
    i += 1;
    while (i < s.length && s[i] !== '"') {
      if (s[i] === '\\' && i + 1 < s.length) {
        const dec = s.slice(i + 1, i + 4);
        if (/^\d{3}$/.test(dec)) { out += String.fromCharCode(Number(dec)); i += 4; continue; }
        out += s[i + 1];
        i += 2;
        continue;
      }
      out += s[i];
      i += 1;
    }
    i += 1;
  }
  return out;
}

export function parseMx(data) {
  const m = String(data).trim().match(/^(\d+)\s+(\S+)$/);
  if (!m) return null;
  const host = m[2].replace(/\.$/, '').toLowerCase();
  return { pref: Number(m[1]), host, isNull: host === '' || m[2] === '.' };
}

// CAA as presentation text (0 issue "ca.example") or in the generic RFC 3597 form (\# 19 00 05 69 73 ...).
export function parseCaa(data) {
  const s = String(data).trim();
  const generic = s.match(/^\\#\s+(\d+)\s+([0-9a-fA-F\s]+)$/);
  if (generic) {
    const bytes = generic[2].replace(/\s+/g, '').match(/.{2}/g).map((h) => parseInt(h, 16));
    const flags = bytes[0];
    const len = bytes[1];
    const tag = String.fromCharCode(...bytes.slice(2, 2 + len)).toLowerCase();
    const value = String.fromCharCode(...bytes.slice(2 + len));
    return { flags, tag, value };
  }
  const m = s.match(/^(\d+)\s+([A-Za-z0-9]+)\s+(.*)$/);
  if (!m) return null;
  let value = m[3].trim();
  if (value.startsWith('"')) value = txtValue(value);
  return { flags: Number(m[1]), tag: m[2].toLowerCase(), value };
}

// Hostname from free input: a bare name, a URL or an email address. Returns ASCII (punycode) or null.
export function cleanDomain(input) {
  let s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('@') && !s.includes('/')) s = s.split('@').pop();
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `http://${s}`;
  let host;
  try { host = new URL(s).hostname; } catch { return null; }
  host = host.replace(/\.$/, '');
  if (host.startsWith('[') || /^\d+(\.\d+){3}$/.test(host)) return null;
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(host)) return null;
  return host;
}
