// Preflight: rebuild the bundle, run the structural guards, the MCP selftest, every test and the browser checks.
// --release adds the publication gates: the name and domain are set and no placeholder is left anywhere.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url).pathname;
const release = process.argv.includes('--release');
const problems = [];
const notes = [];
const run = (args, label, env = {}) => {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.status !== 0) problems.push(`${label} failed:\n${r.stdout}\n${r.stderr}`);
  return r;
};
run([join(root, 'scripts/build.mjs'), ...(release ? ['--release'] : [])], 'build');
const required = ['docs/.nojekyll', 'docs/data/bundle.json', 'docs/favicon.svg', 'docs/fonts/OFL.txt', 'LICENSE', 'NOTICE.md', 'README.md', 'SECURITY.md', 'CHANGELOG.md', 'package.json', '.github/workflows/weekly.yml', '.github/workflows/test.yml'];
if (release) required.push('docs/CNAME', 'docs/robots.txt', 'docs/sitemap.xml', 'docs/og.png', 'docs/.well-known/security.txt');
for (const f of required) if (!existsSync(join(root, f))) problems.push(`missing ${f}`);

const TEXT = new Set(['.js', '.mjs', '.json', '.md', '.html', '.css', '.yml', '.txt', '.xml']);
const marker = new RegExp(['TO' + 'DO', 'FIX' + 'ME', 'X' + 'XX'].map((w) => `\\b${w}\\b`).join('|'));
const secret = /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const token = /__(NAME_EN|NAME_AR|DOMAIN|REPO|SLUG)__/;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', '.impeccable'].includes(name) || ['PRODUCT.md', 'DESIGN.md'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!TEXT.has(extname(name)) && name !== 'CNAME') continue;
    const s = readFileSync(p, 'utf8');
    if (marker.test(s)) problems.push(`unfinished marker in ${p}`);
    if (secret.test(s)) problems.push(`something that looks like a credential in ${p}`);
    if (release && token.test(s) && !p.endsWith('scripts/preflight.mjs') && !p.endsWith('scripts/name.mjs')) problems.push(`placeholder left in ${p}`);
  }
}
walk(root);
run([join(root, 'mcp/server.mjs'), '--selftest'], 'mcp selftest');
const links = spawnSync(process.execPath, [join(root, 'scripts/links.mjs')], { cwd: root, encoding: 'utf8' });
if (links.status !== 0) problems.push(`external links failed:\n${links.stdout}\n${links.stderr}`);
const linkSummary = (links.stdout.match(/^links: .*$/m) || [''])[0];
const tests = ['engine', 'probe', 'pipeline', 'data', 'name', 'mcp', 'site'].map((n) => join(root, 'test', `${n}.test.mjs`));
const t = run(['--test', ...tests], 'tests');
let pw = process.env.PW_MODULE || null;
if (!pw) { try { createRequire(import.meta.url).resolve('playwright'); pw = 'playwright'; } catch { pw = null; } }
if (pw) run([join(root, 'test/ui.mjs')], 'browser checks', { PW_MODULE: pw });
else notes.push('browser checks skipped: Playwright is not installed here');

if (problems.length) {
  console.error('PREFLIGHT FAILED');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`preflight passed${release ? ' with the publication gates' : ''}`);
for (const n of notes) console.log(n);
if (linkSummary) console.log(linkSummary);
console.log(t.stdout.split('\n').filter((l) => /^# (tests|pass|fail)/.test(l)).join('\n'));
