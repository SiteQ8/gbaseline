// Prints every page of the site to HTML from the bundle and the published data: both languages, each state, each
// standard, each issue, the method, the live check and the 404 page, with the sitemap. The weekly run calls it after
// publishing an issue, so the pages always carry the latest figures and every one of them can be read and indexed
// without script.
//   node scripts/prerender.mjs            write docs/
//   node scripts/prerender.mjs --check    fail when a page on disk is not what the data would print
//   node scripts/prerender.mjs --out DIR  write a copy elsewhere (the browser test uses this with its own data)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { page, routes, pathOf, LANGS, issueCount } from '../docs/assets/views.js';
import { toHtml } from '../docs/assets/vnode.js';
import { CHECKS } from '../docs/assets/engine/checks.js';
import { tr } from '../docs/assets/engine/i18n.js';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');

export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://cloudflare-dns.com https://dns.google; object-src 'none'; base-uri 'self'; form-action 'self'";
const COLOUR = '#0f1928';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function loadData(root = here) {
  const read = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), 'utf8')) : null);
  const summary = read('docs/data/summary.json');
  const history = read('docs/data/history.json');
  return {
    B: read('docs/data/bundle.json'),
    D: { summary: summary && summary.checks ? summary : null, history: Array.isArray(history) ? history : [] },
    pictures: read('data/src/pictures.json').pictures,
  };
}

// The dataset as search engines read it, on the two home pages.
export function dataset(B, D, lang) {
  const s = D.summary;
  const site = `https://${B.project.domain}`;
  const name = lang === 'ar' ? B.project.name_ar : B.project.name_en;
  const other = lang === 'ar' ? B.project.name_en : B.project.name_ar;
  const first = D.history.length ? D.history[0].date : s ? s.date : B.project.updated;
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    alternateName: other,
    description: tr(B.project.about, lang),
    url: `${site}${pathOf(lang)}`,
    sameAs: B.project.repo,
    inLanguage: ['ar', 'en'],
    isAccessibleForFree: true,
    license: 'https://opensource.org/license/mit',
    creator: { '@type': 'Person', name: tr(B.project.author, lang), url: B.project.author_url },
    publisher: { '@type': 'Person', name: tr(B.project.author, lang), url: B.project.author_url },
    keywords: lang === 'ar'
      ? ['الأمن السيبراني', 'الخليج العربي', 'DMARC', 'DNSSEC', 'HTTPS', 'TLS', 'التشفير المقاوم للحوسبة الكمية', 'بيانات مفتوحة']
      : ['cybersecurity', 'Arabian Gulf', 'GCC', 'DMARC', 'DNSSEC', 'HTTPS', 'TLS', 'post quantum', 'open data'],
    spatialCoverage: Object.values(B.scope.countries).map((c) => ({ '@type': 'Country', name: tr(c, lang) })),
    temporalCoverage: `${first}/..`,
    ...(s ? { dateModified: s.date, version: String(s.issue) } : {}),
    variableMeasured: CHECKS.map((c) => tr(B.checks[c.id].title, lang)),
    measurementTechnique: lang === 'ar' ? 'قراءة الإعدادات العامة عبر محللين عامين وطلبات HTTPS وTLS عادية' : 'Public configuration read through two public DNS resolvers and ordinary HTTPS and TLS requests',
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${site}/data/open/latest.csv` },
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${site}/data/open/history.csv` },
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${site}/data/summary.json` },
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${site}/data/history.json` },
    ],
  };
}

export function documentFor(data, route, lang) {
  const { B } = data;
  const v = page({ ...data, lang, route });
  const site = `https://${B.project.domain}`;
  const name = lang === 'ar' ? B.project.name_ar : B.project.name_en;
  const rel = route.page === '404' ? null : route.rel;
  const url = rel === null ? null : `${site}${pathOf(lang, rel)}`;
  const title = route.page === 'home' ? `${name} · ${v.title}` : `${v.title} · ${name}`;
  const description = String(v.description || '').replace(/\s+/g, ' ').trim();
  const fontSet = lang === 'ar' ? 'arabic' : 'latin';
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="referrer" content="no-referrer">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    ...(url ? [
      `<link rel="canonical" href="${url}">`,
      ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site}${pathOf(l, rel)}">`),
      `<link rel="alternate" hreflang="x-default" href="${site}${pathOf('ar', rel)}">`,
    ] : ['<meta name="robots" content="noindex">']),
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${esc(`${B.project.name_ar} | ${B.project.name_en}`)}">`,
    `<meta property="og:title" content="${esc(v.title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    ...(url ? [`<meta property="og:url" content="${url}">`] : []),
    `<meta property="og:image" content="${site}/og.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(`${B.project.name_ar} | ${B.project.name_en}`)}">`,
    `<meta property="og:locale" content="${lang === 'ar' ? 'ar_AR' : 'en_US'}">`,
    `<meta property="og:locale:alternate" content="${lang === 'ar' ? 'en_US' : 'ar_AR'}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(v.title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${site}/og.png">`,
    `<meta name="theme-color" content="${COLOUR}">`,
    '<meta name="color-scheme" content="dark">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    `<link rel="preload" href="/fonts/alexandria-${fontSet}-600.woff2" as="font" type="font/woff2" crossorigin>`,
    `<link rel="preload" href="/fonts/alexandria-${fontSet}-400.woff2" as="font" type="font/woff2" crossorigin>`,
    '<link rel="stylesheet" href="/assets/fonts.css">',
    '<link rel="stylesheet" href="/assets/styles.css">',
    '<link rel="alternate" type="text/csv" href="/data/open/latest.csv">',
    '<script type="module" src="/assets/site.js"></script>',
    ...(route.page === 'home' ? [`<script type="application/ld+json">${JSON.stringify(dataset(B, data.D, lang)).replace(/</g, '\\u003c')}</script>`] : []),
  ];
  return `<!doctype html>\n<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">\n<head>\n${head.join('\n')}\n</head>\n<body>\n${toHtml(v.body)}\n</body>\n</html>\n`;
}

export function sitemap(B, D) {
  const site = `https://${B.project.domain}`;
  const lastmod = D.summary ? D.summary.date : B.project.updated;
  const entries = routes(B, D).flatMap((r) => LANGS.map((lang) => [
    '  <url>',
    `    <loc>${site}${pathOf(lang, r.rel)}</loc>`,
    `    <lastmod>${r.page === 'issue' ? D.history[r.n - 1]?.date || lastmod : lastmod}</lastmod>`,
    ...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${site}${pathOf(l, r.rel)}"/>`),
    '  </url>',
  ].join('\n')));
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">', ...entries, '</urlset>', ''].join('\n');
}

// Every file the site prints, as a map of path to text.
export function renderSite(data) {
  const files = {};
  for (const r of routes(data.B, data.D)) {
    for (const lang of LANGS) files[`${pathOf(lang, r.rel).slice(1)}index.html`] = documentFor(data, r, lang);
  }
  files['404.html'] = documentFor(data, { page: '404', rel: '' }, 'ar');
  files['sitemap.xml'] = sitemap(data.B, data.D);
  return files;
}

// The folders the printer owns, so pages of states, standards or issues that no longer exist are removed.
const OWNED = ['en', 'countries', 'standards', 'check', 'method', 'issues'];

function listOwned(dir) {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n === 'index.html') out.push(p); } };
  for (const o of OWNED) if (existsSync(join(dir, o))) walk(join(dir, o));
  return out;
}

export function writeSite(files, dir) {
  const want = new Set(Object.keys(files).map((f) => join(dir, f)));
  for (const p of listOwned(dir)) if (!want.has(p)) rmSync(p);
  let changed = 0;
  for (const [rel, text] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    if (existsSync(p) && readFileSync(p, 'utf8') === text) continue;
    writeFileSync(p, text);
    changed += 1;
  }
  return changed;
}

export function checkSite(files, dir) {
  const stale = Object.entries(files).filter(([rel, text]) => !existsSync(join(dir, rel)) || readFileSync(join(dir, rel), 'utf8') !== text).map(([rel]) => rel);
  const want = new Set(Object.keys(files).map((f) => join(dir, f)));
  const extra = listOwned(dir).filter((p) => !want.has(p));
  return { stale, extra };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2);
  const opt = (k) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined; };
  const data = loadData(opt('root') || here);
  const files = renderSite(data);
  const out = opt('out') || join(opt('root') || here, 'docs');
  if (a.includes('--check')) {
    const { stale, extra } = checkSite(files, out);
    if (stale.length || extra.length) {
      console.error(`pages are stale: ${[...stale, ...extra].slice(0, 12).join(', ')}${stale.length + extra.length > 12 ? ' and more' : ''}; run node scripts/prerender.mjs`);
      process.exit(1);
    }
    console.log(`pages are current: ${Object.keys(files).length} files`);
  } else {
    const changed = writeSite(files, out);
    console.log(`pages printed: ${Object.keys(files).length} files, ${changed} changed, issue ${issueCount(data.D) || 'none yet'}`);
  }
}
