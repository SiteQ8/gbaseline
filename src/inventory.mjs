// The inventory: every registrable domain under the government and education suffixes of the six Gulf states.
// Names come from Certificate Transparency (crt.sh, by its public database first and its JSON interface second)
// and from the Tranco list of popular sites. A source that fails never shrinks the inventory: names seen once stay,
// and the weekly scan decides from DNS whether each one still exists.
import { spawn } from 'node:child_process';

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function bySuffixLength(scope) {
  return [...scope.suffixes].sort((a, b) => b.suffix.length - a.suffix.length);
}

// The registrable domain a certificate name belongs to: the label right under its public suffix.
export function entityOf(name, suffixes) {
  const n = String(name || '').trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
  if (!n || n.includes(' ') || n.includes('@')) return null;
  for (const s of suffixes) {
    if (!n.endsWith(`.${s.suffix}`)) continue;
    const label = n.slice(0, -(s.suffix.length + 1)).split('.').pop();
    if (!LABEL.test(label)) return null;
    return { domain: `${label}.${s.suffix}`, suffix: s.suffix };
  }
  return null;
}

const sql = (suffix) => `SELECT DISTINCT lower(cai.name_value) FROM certificate_and_identities cai WHERE plainto_tsquery('certwatch', '${suffix}') @@ identities(cai.certificate) AND lower(cai.name_value) LIKE '%.${suffix}';`;

// crt.sh offers a read only PostgreSQL guest login. psql ships on GitHub's Ubuntu runners.
export function crtPsql(suffix, { timeoutMs = 900000, bin = 'psql' } = {}) {
  if (!/^[a-z0-9.]+$/.test(suffix)) return Promise.resolve({ ok: false, error: 'bad-suffix', names: [] });
  return new Promise((resolve) => {
    const args = ['-h', 'crt.sh', '-p', '5432', '-U', 'guest', '-d', 'certwatch', '-A', '-t', '-X', '-q', '-c', sql(suffix)];
    let out = '';
    let err = '';
    let child;
    try { child = spawn(bin, args, { env: { ...process.env, PGCONNECT_TIMEOUT: '30' } }); } catch (e) { resolve({ ok: false, error: e.code || 'spawn', names: [] }); return; }
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, error: e.code || 'spawn', names: [] }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const names = out.split('\n').map((s) => s.trim()).filter(Boolean);
      resolve(code === 0 ? { ok: true, names } : { ok: false, error: (err.trim().split('\n').pop() || `exit ${code}`).slice(0, 200), names: [] });
    });
  });
}

export async function crtJson(suffix, { fetchImpl = globalThis.fetch, timeoutMs = 600000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://crt.sh/?q=${encodeURIComponent(`%.${suffix}`)}&output=json&exclude=expired`, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return { ok: false, error: `http-${res.status}`, names: [] };
    const rows = await res.json();
    const names = new Set();
    for (const row of rows) for (const n of String(row.name_value || '').split('\n')) names.add(n.trim().toLowerCase());
    return { ok: true, names: [...names] };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : 'network', names: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function tranco({ fetchImpl = globalThis.fetch } = {}) {
  try {
    const meta = await (await fetchImpl('https://tranco-list.eu/api/lists/date/latest')).json();
    const res = await fetchImpl(`https://tranco-list.eu/download/${meta.list_id}/1000000`);
    if (!res.ok) return { ok: false, error: `http-${res.status}`, names: [] };
    const text = await res.text();
    const names = text.split(/\r?\n/).map((l) => l.split(',')[1]).filter(Boolean);
    return { ok: true, names, list: meta.list_id };
  } catch {
    return { ok: false, error: 'network', names: [] };
  }
}

// Fold the names one source returned into the inventory. Returns how many entities the source contributed.
export function absorb(inventory, names, suffixes, source, date) {
  let found = 0;
  const seen = new Set();
  for (const name of names) {
    const e = entityOf(name, suffixes);
    if (!e || seen.has(e.domain)) continue;
    seen.add(e.domain);
    found += 1;
    const row = inventory.domains[e.domain];
    if (row) {
      if (!row.src.includes(source)) row.src = [...row.src, source].sort();
    } else {
      inventory.domains[e.domain] = { suffix: e.suffix, first: date, src: [source] };
    }
  }
  return found;
}

export function emptyInventory() {
  return { schema: 'inventory/1', updated: null, sources: {}, domains: {} };
}

// Stable serialisation: domains sorted, one per line, so weekly diffs stay readable.
export function serialize(inventory) {
  const keys = Object.keys(inventory.domains).sort();
  const domains = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(inventory.domains[k])}`).join(',\n');
  const head = { schema: inventory.schema, updated: inventory.updated, sources: inventory.sources };
  const headText = JSON.stringify(head, null, 1).replace(/\n}$/, '');
  return `${headText},\n "domains": {\n${domains}\n }\n}\n`;
}

export async function refresh(inventory, scope, date, options = {}) {
  const suffixes = bySuffixLength(scope);
  const report = {};
  const ct = options.ct !== false;
  for (const s of scope.suffixes) {
    const entry = { psql: null, json: null };
    if (ct) {
      const viaPsql = await (options.crtPsql || crtPsql)(s.suffix);
      entry.psql = viaPsql.ok ? absorb(inventory, viaPsql.names, suffixes, 'ct', date) : viaPsql.error;
      if (!viaPsql.ok) {
        const viaJson = await (options.crtJson || crtJson)(s.suffix);
        entry.json = viaJson.ok ? absorb(inventory, viaJson.names, suffixes, 'ct', date) : viaJson.error;
      }
    }
    report[s.suffix] = entry;
  }
  const tr = await (options.tranco || tranco)();
  const trCount = tr.ok ? absorb(inventory, tr.names, suffixes, 'tranco', date) : tr.error;
  // A domain whose administrators asked to be left out is dropped, however often the sources name it.
  for (const d of scope.exclude || []) delete inventory.domains[d];
  inventory.updated = date;
  inventory.sources = { date, ct: report, tranco: { list: tr.list || null, entities: trCount } };
  return inventory;
}
