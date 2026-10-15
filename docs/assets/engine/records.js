// Pure parsers for the records and files the observatory reads. Each follows its RFC and never touches the network.

const tags = (text) => {
  const out = {};
  for (const part of String(text).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    if (k && !(k in out)) out[k] = part.slice(i + 1).trim();
  }
  return out;
};

// DMARC, RFC 7489. Returns the policy level the record asks receivers to apply.
export const isDmarc = (txt) => /^v\s*=\s*dmarc1\s*(;|$)/i.test(String(txt).trim());
export function parseDmarc(txt) {
  const t = tags(txt);
  const problems = [];
  const p = (t.p || '').toLowerCase();
  const sp = (t.sp || '').toLowerCase();
  let policy = ['none', 'quarantine', 'reject'].includes(p) ? p : null;
  const rua = (t.rua || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!policy) {
    // Section 6.6.3: an unknown or missing p falls back to none when reports are requested, otherwise the record is unusable.
    if (rua.length) { policy = 'none'; problems.push('p-invalid-treated-as-none'); } else return { valid: false, problems: ['p-missing'], rua, pct: 100, policy: null };
  }
  let pct = 100;
  if (t.pct !== undefined) {
    if (/^\d{1,3}$/.test(t.pct) && Number(t.pct) <= 100) pct = Number(t.pct);
    else problems.push('pct-invalid');
  }
  return { valid: true, policy, subdomainPolicy: ['none', 'quarantine', 'reject'].includes(sp) ? sp : null, pct, rua, problems };
}

// SPF, RFC 7208: terms of one record. Lookup counting and redirects are resolved by the checker.
export const isSpf = (txt) => /^v=spf1(\s|$)/i.test(String(txt).trim());
const MECH = new Set(['all', 'include', 'a', 'mx', 'ptr', 'ip4', 'ip6', 'exists']);
export function parseSpf(txt) {
  const terms = String(txt).trim().split(/\s+/).slice(1);
  const mechanisms = [];
  const modifiers = {};
  const problems = [];
  for (const raw of terms) {
    const mod = raw.match(/^([a-z][a-z0-9_.-]*)=(.*)$/i);
    if (mod) {
      const name = mod[1].toLowerCase();
      if (name in modifiers && (name === 'redirect' || name === 'exp')) problems.push(`duplicate-${name}`);
      modifiers[name] = mod[2];
      continue;
    }
    const m = raw.match(/^([+\-~?]?)([a-z0-9]+)(?:[:](.*?))?(\/\d+(?:\/\/\d+)?)?$/i);
    if (!m || !MECH.has(m[2].toLowerCase())) { problems.push(`unknown-term:${raw}`); continue; }
    mechanisms.push({ qualifier: m[1] || '+', name: m[2].toLowerCase(), value: m[3] || null });
  }
  const all = mechanisms.find((x) => x.name === 'all');
  return { mechanisms, modifiers, all: all ? all.qualifier : null, problems };
}

// MTA-STS discovery record, RFC 8461 section 3.1, and the policy file, section 3.2.
export const isMtaSts = (txt) => /^v=STSv1\s*;/.test(String(txt).trim());
export function parseMtaStsRecord(txt) {
  const t = tags(txt);
  return { valid: t.v === 'STSv1' && /^[A-Za-z0-9]{1,32}$/.test(t.id || ''), id: t.id || null };
}
export function parseMtaStsPolicy(text) {
  const fields = {};
  const mx = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*([a-z_]+)\s*:\s*(.*?)\s*$/i);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === 'mx') mx.push(m[2].toLowerCase());
    else if (!(k in fields)) fields[k] = m[2];
  }
  const mode = (fields.mode || '').toLowerCase();
  const maxAge = /^\d{1,10}$/.test(fields.max_age || '') ? Number(fields.max_age) : null;
  const valid = fields.version === 'STSv1' && ['enforce', 'testing', 'none'].includes(mode) && maxAge !== null && (mode === 'none' || mx.length > 0);
  return { valid, mode: mode || null, mx, maxAge };
}

// SMTP TLS reporting record, RFC 8460 section 3.
export const isTlsRpt = (txt) => /^v=TLSRPTv1\s*;/.test(String(txt).trim());
export function parseTlsRpt(txt) {
  const t = tags(txt);
  const rua = (t.rua || '').split(',').map((s) => s.trim()).filter((u) => /^(mailto:|https:)/i.test(u));
  return { valid: rua.length > 0, rua };
}

// Strict-Transport-Security, RFC 6797 section 6.1.
export function parseHsts(header) {
  if (!header) return null;
  const directives = {};
  for (const part of String(header).split(';')) {
    const [k, v] = part.split('=');
    const key = (k || '').trim().toLowerCase();
    if (key && !(key in directives)) directives[key] = v === undefined ? true : v.trim().replace(/^"|"$/g, '');
  }
  const maxAge = /^\d+$/.test(String(directives['max-age'])) ? Number(directives['max-age']) : null;
  return { maxAge, includeSubDomains: 'includesubdomains' in directives, preload: 'preload' in directives };
}

// security.txt, RFC 9116. Contact and Expires are required, Expires appears once and lies in the future.
export function parseSecurityTxt(text, now = new Date()) {
  const body = String(text || '');
  const problems = [];
  if (/^\s*</.test(body) || /<html[\s>]/i.test(body.slice(0, 2000))) return { valid: false, html: true, contact: [], expires: null, expired: false, problems: ['html-page'] };
  const contact = [];
  const expires = [];
  let fields = 0;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const m = line.match(/^([A-Za-z-]+):\s*(.+?)\s*$/);
    if (!m) continue;
    fields += 1;
    const key = m[1].toLowerCase();
    if (key === 'contact') contact.push(m[2]);
    if (key === 'expires') expires.push(m[2]);
  }
  if (!fields) return { valid: false, html: false, contact, expires: null, expired: false, problems: ['no-fields'] };
  if (!contact.length) problems.push('contact-missing');
  let when = null;
  let expired = false;
  if (!expires.length) problems.push('expires-missing');
  else if (expires.length > 1) problems.push('expires-repeated');
  if (expires.length) {
    const d = new Date(expires[0]);
    if (Number.isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(expires[0])) problems.push('expires-invalid');
    else {
      when = d.toISOString();
      if (d.getTime() <= now.getTime()) { expired = true; problems.push('expired'); }
    }
  }
  return { valid: problems.length === 0, html: false, contact, expires: when, expired, problems };
}
