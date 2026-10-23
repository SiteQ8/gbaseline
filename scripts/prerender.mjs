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
import { page, routes, pathOf, LANGS, issueCount, issueOf, kit, FILM, filmFile, listed } from '../docs/assets/views.js';
import { CLAUSES, clauseShare } from '../docs/assets/engine/clauses.js';
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
  const readiness = read('docs/data/readiness.json');
  return {
    B: read('docs/data/bundle.json'),
    D: { summary: summary && summary.checks ? summary : null, history: Array.isArray(history) ? history : [], readiness: readiness && readiness.schema === 'readiness/1' ? readiness : null },
    pictures: read('data/src/pictures.json').pictures,
  };
}

// The readiness index as search engines read it, on its page for the Gulf.
export function readinessDataset(B, D, lang, k) {
  const R = D.readiness;
  const site = `https://${B.project.domain}`;
  const name = lang === 'ar' ? B.project.name_ar : B.project.name_en;
  const person = { '@type': 'Person', name: tr(B.project.author, lang), url: B.project.author_url };
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${name}: ${k.t('readiness_title')}`,
    description: k.t('readiness_intro'),
    url: `${site}${pathOf(lang, 'readiness/')}`,
    isPartOf: `${site}${pathOf(lang)}`,
    inLanguage: ['ar', 'en'],
    isAccessibleForFree: true,
    license: 'https://opensource.org/license/mit',
    creator: person,
    publisher: person,
    keywords: lang === 'ar'
      ? ['الثغرات المستغلة', 'الاستعدادية', 'الخليج العربي', 'CISA KEV', 'نهاية الدعم', 'بيانات مفتوحة']
      : ['exploited vulnerabilities', 'readiness', 'Arabian Gulf', 'GCC', 'CISA KEV', 'end of life', 'open data'],
    spatialCoverage: Object.values(B.scope.countries).map((c) => ({ '@type': 'Country', name: tr(c, lang) })),
    temporalCoverage: `${R.history.length ? R.history[0].date : R.date}/..`,
    dateModified: R.date,
    variableMeasured: [k.t('kev_h'), k.t('eol_h'), k.t('announce_h')],
    measurementTechnique: tr(B.ui.readiness_how[0], lang),
    isBasedOn: ['https://www.cisa.gov/known-exploited-vulnerabilities-catalog', 'https://nvd.nist.gov/', 'https://endoflife.date/'],
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${site}/data/readiness.json` }],
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

// What search engines read on each page beside the words: the site and the path to the page on every page, the
// dataset on the home page and on each issue, an article on each standard and the film on its page.
export function structured(data, route, lang, v) {
  const { B, D } = data;
  const site = `https://${B.project.domain}`;
  const k = kit({ ...data, lang, route });
  const name = lang === 'ar' ? B.project.name_ar : B.project.name_en;
  const person = { '@type': 'Person', name: tr(B.project.author, lang), url: B.project.author_url };
  const url = (rel) => `${site}${pathOf(lang, rel)}`;
  const out = [{
    '@context': 'https://schema.org', '@type': 'WebSite', name, alternateName: lang === 'ar' ? B.project.name_en : B.project.name_ar,
    url: url(''), inLanguage: ['ar', 'en'], description: tr(B.project.about, lang), publisher: person, sameAs: B.project.repo,
  }];
  const trail = [[k.t('nav_home'), '']];
  if (route.page === 'countries' || route.page === 'country') trail.push([k.t('nav_countries'), 'countries/']);
  if (route.page === 'country') trail.push([k.place(route.cc), route.rel]);
  if (route.page === 'standards' || route.page === 'standard') trail.push([k.t('nav_standards'), 'standards/']);
  if (route.page === 'standard') trail.push([v.title, route.rel]);
  if (route.page === 'issues' || route.page === 'issue') trail.push([k.t('nav_issues'), 'issues/']);
  if (route.page === 'issue') { trail.push([k.t('issue', { n: route.n }), `issues/${route.n}/`]); if (route.place !== 'GCC') trail.push([k.place(route.place), route.rel]); }
  if (route.page === 'readiness') { trail.push([k.t('nav_readiness'), 'readiness/']); if (route.place !== 'GCC') trail.push([k.place(route.place), route.rel]); }
  if (['check', 'method', 'film'].includes(route.page)) trail.push([v.title, route.rel]);
  if (trail.length > 1) out.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: trail.map(([label, rel], i) => ({ '@type': 'ListItem', position: i + 1, name: label, item: url(rel) })) });
  if (route.page === 'home') out.push(dataset(B, D, lang));
  if (route.page === 'readiness' && route.place === 'GCC' && D.readiness) out.push(readinessDataset(B, D, lang, k));
  if (route.page === 'issue' && route.place === 'GCC') {
    const issue = issueOf(D, route.n);
    const main = dataset(B, D, lang);
    out.push({
      '@context': 'https://schema.org', '@type': 'Dataset', name: `${name}: ${k.t('issue_full', { n: route.n, date: k.date(issue.date) })}`,
      description: v.description, url: url(route.rel), isPartOf: main.url, version: String(route.n), datePublished: issue.date, inLanguage: ['ar', 'en'],
      isAccessibleForFree: true, license: main.license, creator: person, publisher: person, keywords: main.keywords, spatialCoverage: main.spatialCoverage,
      variableMeasured: main.variableMeasured, temporalCoverage: issue.date,
      distribution: [
        { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${B.project.repo}/releases/download/issue-${route.n}/latest.csv` },
        { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${B.project.repo}/releases/download/issue-${route.n}/summary.json` },
        { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${site}/data/open/history.csv` },
      ],
    });
  }
  if (route.page === 'standard') {
    out.push({
      '@context': 'https://schema.org', '@type': 'TechArticle', headline: v.title, description: v.description, url: url(route.rel), inLanguage: lang,
      author: person, publisher: person, datePublished: B.project.updated, dateModified: D.summary ? D.summary.date : B.project.updated, isPartOf: url(''),
      about: tr(B.checks[route.id].short, lang), keywords: [tr(B.groups[CHECKS.find((c) => c.id === route.id).group], lang), tr(B.checks[route.id].short, lang)],
    });
  }
  if (route.page === 'film') {
    for (const l of LANGS) out.push({
      '@context': 'https://schema.org', '@type': 'VideoObject', name: `${name}: ${k.t('film_title')} (${k.t(l === 'ar' ? 'film_ar' : 'film_en')})`,
      description: k.t('film_intro'), thumbnailUrl: `${site}${filmFile(l, 'jpg')}`, contentUrl: `${site}${filmFile(l, 'mp4')}`, embedUrl: url('film/'),
      uploadDate: FILM.date, duration: `PT${FILM.seconds[l]}S`, inLanguage: l, isFamilyFriendly: true, publisher: person, isAccessibleForFree: true,
    });
  }
  return out;
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
    `<link rel="alternate" type="application/atom+xml" title="${esc(tr(B.ui.feed_title, lang))}" href="${pathOf(lang, 'feed.xml')}">`,
    '<script type="module" src="/assets/site.js"></script>',
    ...(url ? structured(data, route, lang, v).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`) : []),
  ];
  return `<!doctype html>\n<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">\n<head>\n${head.join('\n')}\n</head>\n<body>\n${toHtml(v.body)}\n</body>\n</html>\n`;
}

export function sitemap(B, D) {
  const site = `https://${B.project.domain}`;
  const lastmod = D.summary ? D.summary.date : B.project.updated;
  const video = (lang) => LANGS.map((l) => [
    '    <video:video>',
    `      <video:thumbnail_loc>${site}${filmFile(l, 'jpg')}</video:thumbnail_loc>`,
    `      <video:title>${esc(`${lang === 'ar' ? B.project.name_ar : B.project.name_en}: ${tr(B.ui.film_title, lang)} (${tr(B.ui[l === 'ar' ? 'film_ar' : 'film_en'], lang)})`)}</video:title>`,
    `      <video:description>${esc(tr(B.ui.film_intro, lang))}</video:description>`,
    `      <video:content_loc>${site}${filmFile(l, 'mp4')}</video:content_loc>`,
    `      <video:duration>${FILM.seconds[l]}</video:duration>`,
    `      <video:publication_date>${FILM.date}</video:publication_date>`,
    '      <video:family_friendly>yes</video:family_friendly>',
    '    </video:video>',
  ].join('\n'));
  const entries = routes(B, D).flatMap((r) => LANGS.map((lang) => [
    '  <url>',
    `    <loc>${site}${pathOf(lang, r.rel)}</loc>`,
    `    <lastmod>${r.page === 'issue' ? D.history[r.n - 1]?.date || lastmod : r.page === 'film' ? FILM.date : r.page === 'readiness' && D.readiness ? D.readiness.date : lastmod}</lastmod>`,
    ...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${site}${pathOf(l, r.rel)}"/>`),
    ...(r.page === 'film' ? video(lang) : []),
    '  </url>',
  ].join('\n')));
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">', ...entries, '</urlset>', ''].join('\n');
}

// A feed of the issues: one entry per issue with the six figures of the Arabian Gulf as sentences and the link to
// its page, newest first, so a reader or a newsroom can follow the measurement without visiting.
export function feed(data, lang) {
  const { B, D } = data;
  const site = `https://${B.project.domain}`;
  const k = kit({ ...data, lang, route: { page: 'issues', rel: 'issues/' } });
  const name = lang === 'ar' ? B.project.name_ar : B.project.name_en;
  const entries = [];
  for (let n = issueCount(D); n >= 1; n -= 1) {
    const issue = issueOf(D, n);
    const live = issue.live('GCC', 'all');
    const lines = CLAUSES.map((cl) => {
      const f = clauseShare(issue.cell(cl.id, 'GCC', 'all'), cl.mode);
      return f.measured ? k.t(`cite_${cl.id}`, { pct: k.pct(f.v), sector: k.t('of_all'), place: k.t('in_GCC') }) : null;
    }).filter(Boolean);
    const url = `${site}${pathOf(lang, `issues/${n}/`)}`;
    entries.push([
      '  <entry>',
      `    <title>${esc(k.t('issue_full', { n, date: k.date(issue.date) }))}</title>`,
      `    <link rel="alternate" type="text/html" href="${url}"/>`,
      `    <id>${url}</id>`,
      `    <published>${issue.date}T02:17:00Z</published>`,
      `    <updated>${issue.date}T02:17:00Z</updated>`,
      `    <summary>${esc(live === null ? '' : k.t('issue_standfirst', { date: k.date(issue.date), live: k.words(live, 'w_live_domain') }))}</summary>`,
      `    <content type="html">${esc(`<ol>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol><p><a href="${url}">${esc(k.t('cite_issue_h'))}</a></p>`)}</content>`,
      '  </entry>',
    ].join('\n'));
  }
  const updated = D.summary ? `${D.summary.date}T02:17:00Z` : `${B.project.updated}T00:00:00Z`;
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">`,
    `  <title>${esc(tr(B.ui.feed_title, lang))}</title>`,
    `  <subtitle>${esc(tr(B.ui.feed_intro, lang))}</subtitle>`,
    `  <link rel="alternate" type="text/html" href="${site}${pathOf(lang)}"/>`,
    `  <link rel="self" type="application/atom+xml" href="${site}${pathOf(lang, 'feed.xml')}"/>`,
    `  <id>${site}${pathOf(lang)}</id>`,
    `  <updated>${updated}</updated>`,
    `  <author><name>${esc(tr(B.project.author, lang))}</name><uri>${B.project.author_url}</uri></author>`,
    `  <rights>${esc(name)} · MIT</rights>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n');
}

// What a language model or an agent should know first: what the site is, where the data and the tools are, and how
// to cite a figure, in both languages.
export function llms(data) {
  const { B, D } = data;
  const site = `https://${B.project.domain}`;
  const s = D.summary;
  const R = D.readiness;
  const k = kit({ ...data, lang: 'en', route: { page: 'home', rel: '' } });
  const ka = kit({ ...data, lang: 'ar', route: { page: 'home', rel: '' } });
  const states = listed(k, Object.keys(B.scope.countries).map((cc) => k.place(cc)));
  return [
    `# ${B.project.name_en} | ${B.project.name_ar}`,
    '',
    `> ${tr(B.project.about, 'en')}`,
    '',
    `An open, independent, weekly measurement of how the public domains of the six Arabian Gulf states (${states}) protect email, DNS and the web, under ${B.scope.suffixes.length} domain suffixes in six sectors, against ${CHECKS.length} standards. Published every Monday as totals by state, sector and standard. No domain is named next to a result and the states are never ranked. Arabic first, English under /en/.`,
    s ? `Latest: issue ${s.issue}, week of ${s.date}, ${k.num(s.inventory.GCC.all.live)} live domains measured.` : '',
    '',
    `The readiness index: whenever CISA catalogues an exploited vulnerability in software a website announces from outside (PHP, Apache, nginx, IIS, WordPress and the like), the first page of every live domain is read within a day and the share announcing an affected version is published, for the Gulf and for each state, with the share of announced software past its support (endoflife.date). Repeated after every issue, so the series shows how fast patches arrive.${R ? ` Latest census: ${R.date}, ${k.num(R.places.GCC.sites)} first pages read, ${R.kev.length} exploited vulnerabilities followed.` : ''}`,
    '',
    '## Pages',
    `- [Home, the Arabian Gulf as a whole](${site}/) and [in English](${site}/en/)`,
    `- [Every issue](${site}/issues/): one page per issue, with a page for each state`,
    `- [Readiness](${site}/readiness/): exploited vulnerabilities and end of life software against what the sites announce, with a page for each state`,
    `- [The six states](${site}/countries/)`,
    `- [The thirteen standards](${site}/standards/): each with why it matters, how a domain passes and how to fix it`,
    `- [Method and data](${site}/method/)`,
    `- [Check a domain](${site}/check/)`,
    `- [The launch film](${site}/film/)`,
    '',
    '## Data',
    `- [latest.csv](${site}/data/open/latest.csv): every total of the latest issue`,
    `- [history.csv](${site}/data/open/history.csv): every issue so far`,
    `- [summary.json](${site}/data/summary.json) and [history.json](${site}/data/history.json)`,
    `- [readiness.json](${site}/data/readiness.json): the readiness index with its series, the exploited vulnerabilities followed and the support cycles used`,
    `- Atom feed of issues: Arabic at ${site}/feed.xml, English at ${site}/en/feed.xml`,
    `- Source, command line tool and MCP server: ${B.project.repo}`,
    '',
    '## How to cite',
    `Every figure on the site has a citation in Arabic and in English with the issue number, the clause number and a link that opens the same figure. Cite the site as ${tr(B.project.author, 'en')} (${s ? s.date.slice(0, 4) : B.project.updated.slice(0, 4)}). ${B.project.name_en}, issue N. ${site}/issues/N/`,
    '',
    '## بالعربية',
    `${tr(B.project.about, 'ar')} ${ka.t('foot_note')} ${ka.t('foot_monday')}`,
    `${ka.t('readiness_intro')}`,
    `الصفحات: الرئيسية ${site}/ والأعداد ${site}/issues/ والاستعدادية ${site}/readiness/ والدول الست ${site}/countries/ والمعايير ${site}/standards/ والمنهجية والبيانات ${site}/method/ وفحص نطاق ${site}/check/ وفيلم الإطلاق ${site}/film/`,
    '',
  ].join('\n');
}

// Every file the site prints, as a map of path to text.
export function renderSite(data) {
  const files = {};
  for (const r of routes(data.B, data.D)) {
    for (const lang of LANGS) files[`${pathOf(lang, r.rel).slice(1)}index.html`] = documentFor(data, r, lang);
  }
  files['404.html'] = documentFor(data, { page: '404', rel: '' }, 'ar');
  files['sitemap.xml'] = sitemap(data.B, data.D);
  for (const lang of LANGS) files[`${pathOf(lang, 'feed.xml').slice(1)}`] = feed(data, lang);
  files['llms.txt'] = llms(data);
  return files;
}

// The folders the printer owns, so pages of states, standards or issues that no longer exist are removed.
const OWNED = ['en', 'countries', 'readiness', 'standards', 'check', 'method', 'film', 'issues'];

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
