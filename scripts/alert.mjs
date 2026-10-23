// The alerts of the readiness index: when a census first measures the Arabian Gulf against an exploited
// vulnerability catalogued recently, an issue labelled readiness-alert is opened in the repository with the figure,
// in Arabic and in English, and the link to the vulnerability's page. Whoever watches the repository's issues, or
// only that label, is told by GitHub. Each vulnerability is announced once; no domain is ever named.
//   node scripts/alert.mjs --plan existing-titles.txt --out dir   writes one title and body per alert to send
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PRODUCTS } from '../docs/assets/engine/software.js';
import { percent, number, dateLong, tr } from '../docs/assets/engine/i18n.js';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ALERT_LABEL = 'readiness-alert';
export const ALERT_WINDOW_DAYS = 60;

// The vulnerabilities to announce: measured for the Gulf in this census, catalogued within the window, and not yet
// announced (no issue title carries the identifier).
export function alertsToSend(R, existingTitles = [], { windowDays = ALERT_WINDOW_DAYS } = {}) {
  if (!R) return [];
  const since = new Date(Date.parse(`${R.date}T00:00:00Z`) - windowDays * 86400000).toISOString().slice(0, 10);
  const sent = existingTitles.join('\n');
  return R.kev.filter((e) => {
    const x = R.places.GCC.kev[e.cve];
    return x && x.announced && e.added >= since && !sent.includes(e.cve);
  });
}

export function alertText(R, e, project) {
  const site = `https://${project.domain}`;
  const name = (l) => tr(PRODUCTS[e.product] || { en: e.product, ar: e.product }, l);
  const g = R.places.GCC.kev[e.cve];
  const pct = (l) => percent((g.exposed / g.announced) * 100, l);
  const title = `${e.cve} · ${name('en')} · ${pct('en')} of announcing sites in the Arabian Gulf affected`;
  const states = Object.keys(R.places).filter((p) => p !== 'GCC');
  const body = [
    `## ${e.cve} · ${name('ar')}`,
    '',
    `أدرجت CISA هذه الثغرة في كتالوج الثغرات المستغلة يوم ${dateLong(e.added, 'ar')} وقرأ قياس ${dateLong(R.date, 'ar')} الصفحة الأولى لكل نطاق حي في الخليج العربي فتبيّن أن ${pct('ar')} من المواقع التي تعلن إصدار ${name('ar')} كاملاً تعلن إصداراً مصاباً بها أي ${number(g.exposed)} من ${number(g.announced)}.`,
    '',
    `الصفحة الكاملة مع السلسلة والإصدارات المصابة والحل وصيغة الاقتباس ${site}/${`readiness/${e.cve.toLowerCase()}/`}`,
    '',
    `## ${e.cve} · ${name('en')}`,
    '',
    `**${e.name}**`,
    '',
    `CISA added this vulnerability to its catalogue of exploited vulnerabilities on ${dateLong(e.added, 'en')}. The census of ${dateLong(R.date, 'en')} read the first page of every live domain in the Arabian Gulf: **${pct('en')}** of the sites announcing a full ${name('en')} version announce an affected one (${number(g.exposed)} of ${number(g.announced)}).`,
    '',
    `The full page, with the series, the affected versions, the fix and a citation: ${site}/en/readiness/${e.cve.toLowerCase()}/`,
    '',
    `Each state's figure is on its own page: ${states.map((c) => `${site}/en/readiness/${c.toLowerCase()}/#${e.cve.toLowerCase()}`).join(' ')}`,
    '',
    `Sources: https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${e.cve} and https://nvd.nist.gov/vuln/detail/${e.cve}`,
    '',
    'The figures count only what a site announces about itself, so they are a floor. No domain is named and the states are never ranked. لا يُذكر اسم أي نطاق ولا تُرتب الدول.',
  ].join('\n');
  return { title, body };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2);
  const opt = (k) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined; };
  const path = join(here, 'docs/data/readiness.json');
  const R = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  const project = JSON.parse(readFileSync(join(here, 'data/src/project.json'), 'utf8'));
  const titles = opt('plan') && existsSync(opt('plan')) ? readFileSync(opt('plan'), 'utf8').split('\n').filter(Boolean) : [];
  const out = opt('out') || 'alerts';
  mkdirSync(out, { recursive: true });
  const todo = alertsToSend(R, titles);
  todo.forEach((e, i) => {
    const { title, body } = alertText(R, e, project);
    writeFileSync(join(out, `${i}.title`), title);
    writeFileSync(join(out, `${i}.md`), body);
  });
  console.log(`alerts: ${todo.length} to send${todo.length ? `: ${todo.map((e) => e.cve).join(', ')}` : ''}`);
}
