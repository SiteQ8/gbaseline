// The files the published site needs once it has a name and a domain: CNAME, robots.txt, sitemap.xml and
// .well-known/security.txt. Run on its own it refreshes them: the sitemap takes the latest issue date, and
// security.txt is renewed for a year whenever fewer than 180 days remain before it expires.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseSecurityTxt } from '../docs/assets/engine/records.js';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86400000;
export const RENEW_DAYS = 180;

export function repoPath(project) {
  const m = String(project.repo || '').match(/github\.com\/([^/\s]+\/[^/#?\s]+?)(?:\.git)?\/?$/);
  return m ? m[1] : null;
}

export function securityTxt(project, expires) {
  const repo = repoPath(project);
  return [
    `Contact: https://github.com/${repo}/security/advisories/new`,
    `Expires: ${expires}`,
    'Preferred-Languages: ar, en',
    `Canonical: https://${project.domain}/.well-known/security.txt`,
    `Policy: https://github.com/${repo}/blob/main/SECURITY.md`,
    '',
  ].join('\n');
}

// Keep the current expiry while it is more than RENEW_DAYS away, otherwise move it a year from today.
export function expiryFor(currentText, now = new Date()) {
  const current = currentText ? parseSecurityTxt(currentText, now) : null;
  if (current && current.valid && new Date(current.expires).getTime() - now.getTime() > RENEW_DAYS * DAY) return current.expires;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 365 * DAY);
  return next.toISOString();
}

export function sitemap(domain, lastmod) {
  const base = `https://${domain}/`;
  const alternates = [['ar', base], ['en', `${base}?lang=en`]];
  const entry = (loc) => [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    ...alternates.map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`),
    '  </url>',
  ].join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...alternates.map(([, href]) => entry(href)),
    '</urlset>',
    '',
  ].join('\n');
}

export function robots(domain) {
  return `User-agent: *\nAllow: /\nSitemap: https://${domain}/sitemap.xml\n`;
}

function write(root, rel, text) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  const before = existsSync(p) ? readFileSync(p, 'utf8') : null;
  if (before === text) return false;
  writeFileSync(p, text);
  return true;
}

export function writeSiteFiles(root = here, now = new Date()) {
  const project = JSON.parse(readFileSync(join(root, 'data/src/project.json'), 'utf8'));
  if (!project.domain || !repoPath(project)) return { skipped: 'project.json has no domain or repository yet', changed: [] };
  const summaryPath = join(root, 'docs/data/summary.json');
  const lastmod = existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, 'utf8')).date : project.updated;
  const stPath = join(root, 'docs/.well-known/security.txt');
  const expires = expiryFor(existsSync(stPath) ? readFileSync(stPath, 'utf8') : '', now);
  const files = {
    'docs/CNAME': `${project.domain}\n`,
    'docs/robots.txt': robots(project.domain),
    'docs/sitemap.xml': sitemap(project.domain, lastmod),
    'docs/.well-known/security.txt': securityTxt(project, expires),
  };
  const changed = Object.entries(files).filter(([rel, text]) => write(root, rel, text)).map(([rel]) => rel);
  return { changed, expires, lastmod };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const res = writeSiteFiles();
  if (res.skipped) console.log(`site files: ${res.skipped}`);
  else console.log(`site files: ${res.changed.length ? res.changed.join(', ') : 'nothing changed'}; security.txt expires ${res.expires.slice(0, 10)}`);
}
