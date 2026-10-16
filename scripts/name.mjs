// Gives the project the name and domain Ali chooses, and writes everything that depends on them:
//   node scripts/name.mjs --en "English name" --ar "الاسم" --slug slug --domain sub.example.org [--repo Owner/Repo] [--no-og]
// project.json and package.json, the README placeholders and MCP tool names, the bundle, every printed page with its
// title, canonical and share tags, the sitemap, CNAME, robots.txt, .well-known/security.txt and the share card.
// Running it again with the same values changes nothing.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeSiteFiles } from './site-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARABIC = /[؀-ۿ]/;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const TOKENS = ['__NAME_EN__', '__NAME_AR__', '__DOMAIN__', '__REPO__', '__SLUG__'];

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) { out[key] = argv[i + 1]; i += 1; } else out[key] = true;
  }
  return out;
}

export function validate(a) {
  const problems = [];
  const en = String(a.en || '').trim();
  const ar = String(a.ar || '').trim();
  const slug = String(a.slug || '').trim();
  const domain = String(a.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const repo = String(a.repo || (slug ? `SiteQ8/${slug}` : '')).trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  if (!en || ARABIC.test(en) || /[<>"]/.test(en)) problems.push('--en needs the English name, in Latin letters');
  if (!ar || !ARABIC.test(ar) || /[<>"]/.test(ar)) problems.push('--ar needs the Arabic name');
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) problems.push('--slug needs lowercase letters, digits and hyphens, starting with a letter');
  if (!HOST.test(domain)) problems.push('--domain needs a host name such as sub.example.org');
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) problems.push('--repo needs Owner/Repo');
  return { problems, values: { en, ar, slug, domain, repo } };
}

// The placeholders on the first naming, and the previous values on a renaming, so the script can run again.
export function nameReadme(text, { en, ar, domain, repo, slug }, previous = {}) {
  const prefix = slug.replace(/-/g, '_');
  let out = text;
  for (const [old, next] of [[previous.repo, repo], [previous.domain, domain], [previous.en, en], [previous.ar, ar], [previous.slug, slug]]) {
    if (old && old !== next) out = out.replaceAll(old, next);
  }
  return out
    .replaceAll('__NAME_EN__', en).replaceAll('__NAME_AR__', ar).replaceAll('__DOMAIN__', domain)
    .replaceAll('__REPO__', repo).replaceAll('__SLUG__', slug)
    .replace(/`[a-z][a-z0-9_-]*_(overview|figures|compare|check_info|history|methodology|check_domain)`/g, `\`${prefix}_$1\``);
}

export function namePackage(pkg, { slug, domain, repo }) {
  const order = ['name', 'version', 'description', 'type', 'bin', 'homepage', 'repository', 'bugs', 'scripts', 'files', 'engines', 'author', 'license', 'keywords'];
  const next = { ...pkg, name: slug, bin: { [slug]: 'bin/cli.mjs' }, homepage: `https://${domain}`, repository: { type: 'git', url: `git+https://github.com/${repo}.git` }, bugs: { url: `https://github.com/${repo}/issues` } };
  const sorted = {};
  for (const k of order) if (k in next) sorted[k] = next[k];
  for (const k of Object.keys(next)) if (!(k in sorted)) sorted[k] = next[k];
  return sorted;
}

const readText = (rel) => readFileSync(join(root, rel), 'utf8');
const writeText = (rel, text) => writeFileSync(join(root, rel), text);
const writeJson = (rel, value) => writeText(rel, `${JSON.stringify(value, null, 2)}\n`);

async function main() {
  const a = args(process.argv.slice(2));
  const { problems, values } = validate(a);
  if (problems.length) {
    console.error(`name: ${problems.join('; ')}`);
    console.error('usage: node scripts/name.mjs --en "English name" --ar "الاسم" --slug slug --domain sub.example.org [--repo Owner/Repo] [--no-og]');
    process.exit(2);
  }
  const { en, ar, slug, domain, repo } = values;
  const project = JSON.parse(readText('data/src/project.json'));
  const previousRepo = (String(project.repo || '').match(/github\.com\/([^/\s]+\/[^/#?\s]+)/) || [])[1];
  const previous = { en: project.name_en, ar: project.name_ar, slug: project.slug, domain: project.domain, repo: previousRepo };
  Object.assign(project, { name_en: en, name_ar: ar, slug, domain, repo: `https://github.com/${repo}` });
  if (a.date) project.updated = a.date;
  writeJson('data/src/project.json', project);
  writeJson('package.json', namePackage(JSON.parse(readText('package.json')), values));
  writeText('README.md', nameReadme(readText('README.md'), values, previous));
  const built = spawnSync(process.execPath, [join(root, 'scripts/build.mjs'), '--release'], { cwd: root, encoding: 'utf8' });
  if (built.status !== 0) { console.error(built.stdout + built.stderr); process.exit(1); }
  const printed = spawnSync(process.execPath, [join(root, 'scripts/prerender.mjs'), '--root', root], { cwd: root, encoding: 'utf8' });
  if (printed.status !== 0) { console.error(printed.stdout + printed.stderr); process.exit(1); }
  const site = writeSiteFiles(root);
  console.log(`name: ${ar} | ${en}, ${domain}, github.com/${repo}`);
  console.log(`site files: ${site.changed.length ? site.changed.join(', ') : 'unchanged'}`);
  if (!a['no-og']) {
    try {
      const { renderOg } = await import('./og.mjs');
      console.log(`share card: ${await renderOg({ root })}`);
    } catch (e) {
      console.error(`share card not rendered (${e.message}): run node scripts/og.mjs where Playwright is installed`);
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
