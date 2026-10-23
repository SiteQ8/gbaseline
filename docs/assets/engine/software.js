// What a website announces about the software it runs, read from the headers and the first page any visitor
// receives: the web server, the platform behind it and the content system, each with a version when the site
// says one. Pure functions, no network: the scan passes what it saw and the readiness page what was counted.
// Versions are compared the way their makers number them, matched against the ranges a vulnerability names and
// against the support cycles their makers publish.

// The products the measurement can see from outside. `eol` names the product on endoflife.date, when it has one.
export const PRODUCTS = {
  php: { en: 'PHP', ar: 'PHP', kind: 'platform', eol: 'php', cpe: ['php:php'] },
  apache: { en: 'Apache HTTP Server', ar: 'خادم Apache', kind: 'server', eol: 'apache', cpe: ['apache:http_server'] },
  nginx: { en: 'nginx', ar: 'nginx', kind: 'server', eol: 'nginx', cpe: ['nginx:nginx', 'f5:nginx', 'f5:nginx_open_source'] },
  // IIS ships with Windows Server and is supported as long as it is, so its cycles are Microsoft's dates for each
  // Windows Server, kept here because endoflife.date lists the servers and not IIS: 10.0 on 2016 and later, 8.5 on
  // 2012 R2 and 8.0 on 2012 (both ended 10 October 2023), 7.5 on 2008 R2 and 7.0 on 2008 (14 January 2020), 6.0 on
  // 2003 (14 July 2015).
  iis: { en: 'Microsoft IIS', ar: 'Microsoft IIS', kind: 'server', eol: null, cpe: ['microsoft:internet_information_services'], cycles: [
    { cycle: '10.0', eol: false, latest: '10.0', support: true },
    { cycle: '8.5', eol: '2023-10-10', latest: '8.5', support: false },
    { cycle: '8.0', eol: '2023-10-10', latest: '8.0', support: false },
    { cycle: '7.5', eol: '2020-01-14', latest: '7.5', support: false },
    { cycle: '7.0', eol: '2020-01-14', latest: '7.0', support: false },
    { cycle: '6.0', eol: '2015-07-14', latest: '6.0', support: false },
  ] },
  litespeed: { en: 'LiteSpeed', ar: 'LiteSpeed', kind: 'server', eol: null, cpe: ['litespeedtech:litespeed_web_server', 'litespeedtech:openlitespeed'] },
  openresty: { en: 'OpenResty', ar: 'OpenResty', kind: 'server', eol: null, cpe: ['openresty:openresty'] },
  tomcat: { en: 'Apache Tomcat', ar: 'Apache Tomcat', kind: 'server', eol: 'tomcat', cpe: ['apache:tomcat'] },
  openssl: { en: 'OpenSSL', ar: 'OpenSSL', kind: 'library', eol: 'openssl', cpe: ['openssl:openssl'] },
  aspnet: { en: 'ASP.NET', ar: 'ASP.NET', kind: 'platform', eol: null, cpe: ['microsoft:asp.net', 'microsoft:.net_framework'] },
  express: { en: 'Express', ar: 'Express', kind: 'platform', eol: null, cpe: ['openjsf:express', 'expressjs:express'] },
  nextjs: { en: 'Next.js', ar: 'Next.js', kind: 'platform', eol: 'nextjs', cpe: ['vercel:next.js'] },
  wordpress: { en: 'WordPress', ar: 'WordPress', kind: 'cms', eol: 'wordpress', cpe: ['wordpress:wordpress'] },
  drupal: { en: 'Drupal', ar: 'Drupal', kind: 'cms', eol: 'drupal', cpe: ['drupal:drupal'] },
  joomla: { en: 'Joomla', ar: 'Joomla', kind: 'cms', eol: 'joomla', cpe: ['joomla:joomla\\!', 'joomla:joomla'] },
  typo3: { en: 'TYPO3', ar: 'TYPO3', kind: 'cms', eol: 'typo3', cpe: ['typo3:typo3'] },
};
export const PRODUCT_IDS = Object.keys(PRODUCTS);

// The fronts that answer in place of the site: behind them the site's own server is not announced.
const FRONTS = { cloudflare: 'cloudflare', 'cloudfront': 'cloudfront', akamaighost: 'akamai', 'akamai': 'akamai', 'amazons3': 's3', 'gws': 'google', 'esf': 'google', 'microsoft-azure-application-gateway': 'azure', 'kestrel': 'kestrel', 'caddy': 'caddy', 'varnish': 'varnish', 'imperva': 'imperva', 'incapsula': 'imperva', 'sucuri/cloudproxy': 'sucuri', 'bunnycdn': 'bunny', 'fastly': 'fastly', 'envoy': 'envoy', 'awselb/2.0': 'aws-elb', 'microsoft-httpapi/2.0': 'microsoft-httpapi' };

const SERVER_NAMES = { apache: 'apache', nginx: 'nginx', 'microsoft-iis': 'iis', litespeed: 'litespeed', openresty: 'openresty', 'apache-coyote': 'tomcat', openssl: 'openssl', php: 'php', 'mod_php': 'php', 'mod_ssl': null, 'mod_perl': null, 'mod_wsgi': null, 'mod_fcgid': null, 'mod_jk': null, 'mod_auth_kerb': null, 'mod_python': null, svn: null, 'mod_bwlimited': null, perl: null, python: null, 'phusion_passenger': null, 'mod_security': null, 'mod_qos': null, 'ibm_http_server': null, 'oracle-http-server': null };

// A version as the maker writes it: digits and dots, nothing after a space, a dash or a plus, no leading v.
export function cleanVersion(v) {
  if (v === null || v === undefined) return null;
  const m = String(v).trim().replace(/^v/i, '').match(/^(\d+(?:\.\d+)*)/);
  return m ? m[1] : null;
}

export function compareVersions(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

const seen = (list, id, version) => {
  const have = list.find((x) => x.id === id);
  if (have) { if (!have.version && version) have.version = version; return; }
  list.push({ id, version: version || null });
};

// Every product a site announces, from its headers and its first page. Nothing is guessed: a product is counted
// only when the site names it, and a version only when the site writes one.
export function identify({ server, powered, aspnet, generator, html } = {}) {
  const list = [];
  const fronts = [];
  for (const token of String(server || '').split(/\s+/)) {
    if (!token || token.startsWith('(')) continue;
    const [rawName, rawVersion] = token.replace(/^\(|\)$/g, '').split('/');
    const name = rawName.toLowerCase();
    if (FRONTS[`${name}/${(rawVersion || '').toLowerCase()}`] || FRONTS[name]) { fronts.push(FRONTS[`${name}/${(rawVersion || '').toLowerCase()}`] || FRONTS[name]); continue; }
    if (name in SERVER_NAMES) { if (SERVER_NAMES[name]) seen(list, SERVER_NAMES[name], name === 'apache-coyote' ? null : cleanVersion(rawVersion)); continue; }
  }
  const p = String(powered || '');
  const php = p.match(/php\/?\s*v?([\d.]+)?/i);
  if (php) seen(list, 'php', cleanVersion(php[1]));
  if (/asp\.net/i.test(p)) seen(list, 'aspnet', cleanVersion(aspnet));
  if (/^express/i.test(p.trim())) seen(list, 'express', null);
  if (/next\.js/i.test(p)) seen(list, 'nextjs', cleanVersion((p.match(/next\.js\/?\s*v?([\d.]+)/i) || [])[1]));
  if (aspnet && !list.some((x) => x.id === 'aspnet')) seen(list, 'aspnet', cleanVersion(aspnet));
  let gen = String(generator || '');
  if (!gen && html) {
    const m = String(html).match(/<meta\s+[^>]*name\s*=\s*["']?generator["']?[^>]*>/i);
    if (m) gen = (m[0].match(/content\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
  }
  const g = gen.trim();
  const cms = g.match(/^(wordpress|drupal|joomla!?|typo3(?: cms)?)\s*v?([\d.]+)?/i);
  if (cms) seen(list, cms[1].toLowerCase().replace(/!| cms/g, ''), cleanVersion(cms[2]));
  if (!list.some((x) => x.id === 'wordpress') && html && /\/wp-(?:content|includes)\//i.test(String(html))) seen(list, 'wordpress', null);
  if (!list.some((x) => x.id === 'drupal') && html && /drupal-settings-json|\/sites\/default\/files\//i.test(String(html))) seen(list, 'drupal', null);
  return { products: list.filter((x) => PRODUCTS[x.id]), fronts: [...new Set(fronts)], generator: g ? g.slice(0, 80) : null };
}

// Compact for the scan rows: [[id, version], ...] and the fronts, nothing else from the page.
export const compactSoftware = (sw) => (sw ? { p: sw.products.map((x) => [x.id, x.version]), f: sw.fronts } : null);

// The support cycle a version belongs to on endoflife.date: the longest cycle that is a prefix of the version.
export function cycleOf(version, cycles) {
  if (!version || !cycles) return null;
  let best = null;
  for (const c of cycles) {
    const id = String(c.cycle);
    if (version === id || version.startsWith(`${id}.`)) { if (!best || id.length > String(best.cycle).length) best = c; }
  }
  return best;
}

// Whether a version is still supported on a given day: eol (its cycle ended, or it is older than any cycle
// listed), supported, or unknown when the cycles say nothing about it.
export function support(version, cycles, today) {
  if (!version) return 'unknown';
  if (!cycles || !cycles.length) return 'unknown';
  const c = cycleOf(version, cycles);
  if (c) {
    if (c.eol === true) return 'eol';
    if (c.eol === false || c.eol === null || c.eol === undefined) return 'supported';
    return String(c.eol) <= today ? 'eol' : 'supported';
  }
  const oldest = cycles.map((x) => String(x.cycle)).sort(compareVersions)[0];
  return oldest && compareVersions(version, oldest) < 0 ? 'eol' : 'unknown';
}

// Whether a version falls in one of the ranges a vulnerability names (as NVD writes them).
export function affected(version, ranges) {
  if (!version || !ranges) return false;
  return ranges.some((r) => {
    if (r.exact) return compareVersions(version, r.exact) === 0;
    if (!r.start && !r.end) return false;
    if (r.start) {
      const c = compareVersions(version, r.start);
      if (c < 0 || (c === 0 && r.startIncluded === false)) return false;
    }
    if (r.end) {
      const c = compareVersions(version, r.end);
      if (c > 0 || (c === 0 && !r.endIncluded)) return false;
    }
    return true;
  });
}

// The ranges of one vulnerability from NVD's configurations, kept only for products the measurement can see.
export function rangesFromNvd(cve) {
  const out = [];
  const byCpe = {};
  for (const id of PRODUCT_IDS) for (const c of PRODUCTS[id].cpe) byCpe[c] = id;
  for (const conf of (cve && cve.configurations) || []) {
    for (const node of conf.nodes || []) {
      for (const m of node.cpeMatch || []) {
        if (m.vulnerable === false) continue;
        const parts = String(m.criteria || '').split(':');
        if (parts.length < 6 || parts[2] !== 'a') continue;
        const id = byCpe[`${parts[3]}:${parts[4]}`];
        if (!id) continue;
        const exact = parts[5] && parts[5] !== '*' && parts[5] !== '-' ? cleanVersion(parts[5]) : null;
        const r = { product: id };
        if (exact) r.exact = exact;
        if (m.versionStartIncluding) { r.start = cleanVersion(m.versionStartIncluding); r.startIncluded = true; }
        if (m.versionStartExcluding) { r.start = cleanVersion(m.versionStartExcluding); r.startIncluded = false; }
        if (m.versionEndIncluding) { r.end = cleanVersion(m.versionEndIncluding); r.endIncluded = true; }
        if (m.versionEndExcluding) { r.end = cleanVersion(m.versionEndExcluding); r.endIncluded = false; }
        if (r.exact || r.start || r.end) out.push(r);
      }
    }
  }
  return out;
}

// Whether an entry of the exploited vulnerabilities catalogue concerns a product the measurement can see, by
// the names the catalogue uses, before NVD is asked for the versions.
export function kevProduct(entry) {
  const v = String(entry.vendorProject || '').toLowerCase();
  const p = String(entry.product || '').toLowerCase();
  if (p === 'php' || (v === 'php group' && p.startsWith('php'))) return 'php';
  if (v === 'apache' && (p === 'http server' || p === 'httpd')) return 'apache';
  if (p === 'nginx' || (v.startsWith('f5') && p.includes('nginx'))) return 'nginx';
  if (v === 'microsoft' && (p.includes('internet information services') || p === 'iis')) return 'iis';
  if (v === 'wordpress' && p === 'wordpress') return 'wordpress';
  if (v === 'drupal' && p.startsWith('drupal')) return 'drupal';
  if (v.startsWith('joomla') && p.startsWith('joomla')) return 'joomla';
  if (v === 'typo3' && p.startsWith('typo3')) return 'typo3';
  if (v === 'openssl' && p === 'openssl') return 'openssl';
  if (v === 'apache' && p === 'tomcat') return 'tomcat';
  if (v.startsWith('litespeed') && p.includes('litespeed')) return 'litespeed';
  if (v === 'openresty') return 'openresty';
  if (v === 'vercel' && p.includes('next')) return 'nextjs';
  return null;
}
