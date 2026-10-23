// The references the readiness index measures against, fetched from their publishers: the exploited
// vulnerabilities catalogue (CISA KEV), the versions each one affects (NVD) and the support cycles of each
// product (endoflife.date). What was fetched before is kept, so a run asks only for what is new.
import { PRODUCTS, PRODUCT_IDS, kevProduct, rangesFromNvd } from '../docs/assets/engine/software.js';

export const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
export const NVD_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=';
export const EOL_URL = 'https://endoflife.date/api/';
// The whole catalogue is followed, since a site still announcing a version hit years ago is still exposed: the
// window only keeps an entry older than the catalogue itself from ever counting.
export const KEV_WINDOW_DAYS = 3650;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, fetchImpl, { timeout = 30000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { accept: 'application/json', 'user-agent': 'gbaseline readiness (https://gbaseline.3li.info)', ...headers } });
    if (!res.ok) return { error: `http-${res.status}` };
    return { json: await res.json() };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout' : (e.code || e.message || 'error') };
  } finally {
    clearTimeout(t);
  }
}

// The catalogue entries that concern a product the measurement can see, added within the window, plus any
// entry already followed so its series continues. Newest first.
export function relevantKev(catalogue, { today, known = [], windowDays = KEV_WINDOW_DAYS } = {}) {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - windowDays * 86400000).toISOString().slice(0, 10);
  const keep = new Set(known);
  const out = [];
  for (const e of catalogue.vulnerabilities || []) {
    const id = kevProduct(e);
    if (!id) continue;
    if (e.dateAdded < since && !keep.has(e.cveID)) continue;
    out.push({ cve: e.cveID, product: id, vendor: e.vendorProject, productName: e.product, name: e.vulnerabilityName, description: e.shortDescription, added: e.dateAdded, due: e.dueDate, ransomware: e.knownRansomwareCampaignUse, notes: String(e.notes || '').split(/\s*;\s*/).filter((u) => /^https?:\/\//.test(u)) });
  }
  return out.sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : a.cve < b.cve ? 1 : -1));
}

// What the catalogue holds today that the last readiness document does not: the entries, added within the window,
// that concern software the measurement can see and have not been followed yet. The watch runs this every day and
// a census follows when the answer is not empty.
export async function newKev({ today, previous = null, fetchImpl = globalThis.fetch } = {}) {
  const cat = await getJson(KEV_URL, fetchImpl, { timeout: 60000 });
  if (!cat.json) return { error: cat.error, entries: [] };
  const known = new Set(((previous && previous.kev) || []).map((k) => k.cve).concat(((previous && previous.unmatched) || []).map((k) => k.cve)));
  const entries = relevantKev(cat.json, { today }).filter((k) => !known.has(k.cve));
  return { entries, version: cat.json.catalogVersion || null, count: (cat.json.vulnerabilities || []).length };
}

// Everything the index measures against, refreshed. `previous` is the last readiness document, whose NVD
// ranges and cycles are reused when a feed cannot be reached, so one failed feed never empties the page.
export async function fetchReferences({ today, previous = null, fetchImpl = globalThis.fetch, nvdKey = process.env.NVD_API_KEY, log = () => {} } = {}) {
  const prev = previous || {};
  const fetched = new Date().toISOString();
  const sources = { kev: { url: KEV_URL }, nvd: { url: 'https://nvd.nist.gov/' }, eol: { url: 'https://endoflife.date/' } };
  // 1. The catalogue.
  let kev = [];
  const cat = await getJson(KEV_URL, fetchImpl, { timeout: 60000 });
  if (cat.json) {
    kev = relevantKev(cat.json, { today, known: (prev.kev || []).map((k) => k.cve) });
    sources.kev = { ...sources.kev, fetched, version: cat.json.catalogVersion || null, released: cat.json.dateReleased || null, count: (cat.json.vulnerabilities || []).length };
    log(`kev: ${kev.length} entries concern software the measurement can see, of ${sources.kev.count} in the catalogue`);
  } else {
    kev = (prev.kev || []).map((k) => ({ ...k }));
    sources.kev = { ...sources.kev, fetched: prev.sources && prev.sources.kev ? prev.sources.kev.fetched : null, error: cat.error };
    log(`kev: the catalogue could not be read (${cat.error}), keeping the ${kev.length} entries followed so far`);
  }
  // 2. The versions each one affects, from NVD, kept from the last run when already known.
  const knownRanges = Object.fromEntries((prev.kev || []).filter((k) => k.ranges && k.ranges.length).map((k) => [k.cve, k.ranges]));
  let asked = 0;
  for (const k of kev) {
    if (knownRanges[k.cve]) { k.ranges = knownRanges[k.cve]; continue; }
    if (asked) await sleep(nvdKey ? 700 : 6500);
    asked += 1;
    const r = await getJson(`${NVD_URL}${encodeURIComponent(k.cve)}`, fetchImpl, { timeout: 30000, headers: nvdKey ? { apiKey: nvdKey } : {} });
    const cve = r.json && r.json.vulnerabilities && r.json.vulnerabilities[0] ? r.json.vulnerabilities[0].cve : null;
    k.ranges = cve ? rangesFromNvd(cve) : [];
    if (!cve) k.nvdError = r.error || 'empty';
    log(`nvd: ${k.cve} ${k.ranges.length} ranges${k.nvdError ? ` (${k.nvdError})` : ''}`);
  }
  sources.nvd = { ...sources.nvd, fetched, asked };
  // 3. The support cycles of each product.
  const cycles = { ...(prev.cycles || {}) };
  let eolOk = 0;
  for (const id of PRODUCT_IDS) {
    if (PRODUCTS[id].cycles) { cycles[id] = PRODUCTS[id].cycles.map((c) => ({ ...c })); continue; }
    const slug = PRODUCTS[id].eol;
    if (!slug) continue;
    const r = await getJson(`${EOL_URL}${slug}.json`, fetchImpl, { timeout: 20000 });
    if (Array.isArray(r.json)) {
      cycles[id] = r.json.map((c) => ({ cycle: String(c.cycle), eol: c.eol === undefined ? null : c.eol, latest: c.latest || null, support: c.support === undefined ? null : c.support }));
      eolOk += 1;
    } else log(`eol: ${slug} could not be read (${r.error})`);
  }
  sources.eol = { ...sources.eol, fetched, products: eolOk };
  return { kev, cycles, sources };
}
