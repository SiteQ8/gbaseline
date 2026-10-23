// From the census rows and the references to what is published: for the Arabian Gulf and for each state, how
// many sites announce which software, how many of those announcing a version run one that is affected by an
// exploited vulnerability or past the end of its support, and the series of both. No domain name leaves here.
import { PRODUCTS, PRODUCT_IDS, support, affected, compareVersions, cycleOf } from '../docs/assets/engine/software.js';

const PLATFORMS = new Set(PRODUCT_IDS.filter((id) => PRODUCTS[id].kind === 'platform'));
const SERVERS = new Set(PRODUCT_IDS.filter((id) => PRODUCTS[id].kind === 'server'));
const CMS = new Set(PRODUCT_IDS.filter((id) => PRODUCTS[id].kind === 'cms'));

const emptyPlace = () => ({ live: 0, sites: 0, announce: { server: 0, version: 0, platform: 0, cms: 0, front: 0 }, fronts: {}, products: {}, kev: {} });
const emptyProduct = () => ({ sites: 0, versioned: 0, eol: 0, supported: 0, unknown: 0, behind: 0, cycles: {}, versions: {} });

export function aggregateReadiness(rows, scope, refs, { date, run = 'census', previous = null, seconds = null } = {}) {
  const places = Object.fromEntries(['GCC', ...Object.keys(scope.countries)].map((p) => [p, emptyPlace()]));
  const kev = (refs.kev || []).filter((k) => k.ranges && k.ranges.length);
  for (const p of Object.values(places)) for (const k of kev) p.kev[k.cve] = { exposed: 0, announced: 0 };
  for (const row of rows) {
    if (row.dns !== 'live') continue;
    const targets = [places[row.c], places.GCC].filter(Boolean);
    for (const p of targets) p.live += 1;
    if (row.web !== 'ok' || !row.sw) continue;
    const products = row.sw.p || [];
    const fronts = row.sw.f || [];
    for (const p of targets) {
      p.sites += 1;
      if (products.some(([id]) => SERVERS.has(id)) || fronts.length) p.announce.server += 1;
      if (products.some(([, v]) => v)) p.announce.version += 1;
      if (products.some(([id]) => PLATFORMS.has(id))) p.announce.platform += 1;
      if (products.some(([id]) => CMS.has(id))) p.announce.cms += 1;
      if (fronts.length) p.announce.front += 1;
      for (const f of fronts) p.fronts[f] = (p.fronts[f] || 0) + 1;
      for (const [id, version] of products) {
        const x = p.products[id] || (p.products[id] = emptyProduct());
        x.sites += 1;
        if (!version) continue;
        x.versioned += 1;
        const cycles = (refs.cycles || {})[id] || null;
        const s = support(version, cycles, date);
        x[s] += 1;
        const c = cycleOf(version, cycles);
        if (c) { x.cycles[c.cycle] = (x.cycles[c.cycle] || 0) + 1; if (c.latest && compareVersions(version, c.latest) < 0) x.behind += 1; }
        if (p === places.GCC) x.versions[version] = (x.versions[version] || 0) + 1;
        for (const k of kev) {
          if (k.product !== id) continue;
          p.kev[k.cve].announced += 1;
          if (affected(version, k.ranges)) p.kev[k.cve].exposed += 1;
        }
      }
    }
  }
  // Versions of the whole Gulf, largest first and at most forty per product, so the file stays small.
  for (const x of Object.values(places.GCC.products)) {
    x.versions = Object.fromEntries(Object.entries(x.versions).sort((a, b) => b[1] - a[1] || compareVersions(b[0], a[0])).slice(0, 40));
  }
  const entry = {
    date, run, sites: places.GCC.sites, live: places.GCC.live,
    kev: Object.fromEntries(Object.entries(places.GCC.kev).map(([cve, x]) => [cve, [x.exposed, x.announced]])),
    eol: Object.fromEntries(Object.entries(places.GCC.products).filter(([id]) => PRODUCTS[id].eol).map(([id, x]) => [id, [x.eol, x.versioned]])),
  };
  const history = [...((previous && previous.history) || []).filter((h) => h.date !== date), entry].sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    schema: 'readiness/1',
    date,
    run,
    census: { seconds, live: places.GCC.live, sites: places.GCC.sites },
    places,
    kev: kev.map((k) => ({ cve: k.cve, product: k.product, vendor: k.vendor, productName: k.productName, name: k.name, description: k.description, added: k.added, due: k.due, ransomware: k.ransomware || null, notes: k.notes || [], ranges: k.ranges })),
    unmatched: (refs.kev || []).filter((k) => !k.ranges || !k.ranges.length).map((k) => ({ cve: k.cve, product: k.product, added: k.added, reason: k.nvdError || 'no-visible-range' })),
    cycles: refs.cycles || {},
    sources: refs.sources || {},
    history,
  };
}

// The share of sites announcing a version of a product that run an affected one, for a place.
export const exposure = (place, cve) => {
  const x = place && place.kev && place.kev[cve];
  return x && x.announced ? { share: Math.round((x.exposed / x.announced) * 1000) / 10, ...x } : null;
};
