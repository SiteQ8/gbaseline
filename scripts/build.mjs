// Build the bundle the site, the command line and the MCP server load, after validating every source file.
// --check validates and compares without writing. --release also requires the published name and domain.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CHECKS, GROUPS, LEVELS, COMMON_LEVELS } from '../docs/assets/engine/checks.js';
import { entityOf, bySuffixLength } from '../src/inventory.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (name) => JSON.parse(readFileSync(join(root, 'data', 'src', name), 'utf8'));
const check = process.argv.includes('--check');
const release = process.argv.includes('--release');
const errors = [];
const fail = (m) => errors.push(m);
const pairOk = (p) => p && typeof p.en === 'string' && typeof p.ar === 'string' && p.en.trim() && p.ar.trim();

const project = src('project.json');
const scope = src('scope.json');
const checks = src('checks.json');
const ui = src('ui.json');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

if (project.version !== pkg.version) fail(`project.json version ${project.version} differs from package.json ${pkg.version}`);
if (release) {
  for (const k of ['name_en', 'name_ar', 'slug', 'domain', 'repo']) if (!String(project[k] || '').trim()) fail(`project.json ${k} is empty: the published build needs the name and domain`);
  if (project.slug && pkg.name !== project.slug) fail(`package.json name ${pkg.name} differs from the slug ${project.slug}`);
}
if (project.slug && !/^[a-z][a-z0-9-]*$/.test(project.slug)) fail(`slug ${project.slug} must be lowercase letters, digits and hyphens`);

for (const s of scope.suffixes) {
  if (!scope.countries[s.country]) fail(`suffix ${s.suffix} has unknown country ${s.country}`);
  if (!scope.sectors[s.sector]) fail(`suffix ${s.suffix} has unknown sector ${s.sector}`);
  if (!/^[a-z]+\.[a-z]{2}$/.test(s.suffix)) fail(`suffix ${s.suffix} is not of the form label.cc`);
}
if (!Array.isArray(scope.exclude)) fail('scope.json needs an exclude list, empty when no domain is left out');
for (const d of scope.exclude || []) {
  const e = entityOf(d, bySuffixLength(scope));
  if (!e || e.domain !== d) fail(`excluded ${d} is not a registrable domain under a measured suffix`);
}
// A state need not have every sector (Kuwait has no health suffix), but every state and every sector is measured somewhere.
for (const c of Object.keys(scope.countries)) if (!scope.suffixes.some((s) => s.country === c)) fail(`no suffix for ${c}`);
for (const sector of Object.keys(scope.sectors)) if (!scope.suffixes.some((s) => s.sector === sector)) fail(`no suffix for sector ${sector}`);
if (new Set(scope.suffixes.map((s) => s.suffix)).size !== scope.suffixes.length) fail('a suffix is listed twice');
// The suffixes deliberately left out (military, embassies, individuals) are listed so the method page can say so.
if (!Array.isArray(scope.left_out) || !scope.left_out.every((x) => /^[a-z]+\.[a-z]{2}$/.test(x))) fail('scope.json needs a left_out list of suffixes');
for (const x of scope.left_out || []) if (scope.suffixes.some((s) => s.suffix === x)) fail(`${x} is both measured and left out`);

for (const g of GROUPS) if (!pairOk(checks.groups[g])) fail(`group ${g} needs wording in both languages`);
for (const lvl of COMMON_LEVELS) if (!pairOk(checks.common_levels[lvl])) fail(`common level ${lvl} needs wording in both languages`);
const ids = CHECKS.map((c) => c.id);
for (const id of Object.keys(checks.checks)) if (!ids.includes(id)) fail(`checks.json describes ${id}, which the engine does not run`);
for (const { id } of CHECKS) {
  const c = checks.checks[id];
  if (!c) { fail(`check ${id} has no description`); continue; }
  for (const k of ['title', 'short', 'question', 'why', 'pass']) if (!pairOk(c[k])) fail(`check ${id} needs ${k} in both languages`);
  if (!Array.isArray(c.fix) || !c.fix.length || !c.fix.every(pairOk)) fail(`check ${id} needs fix steps in both languages`);
  if (!Array.isArray(c.refs) || !c.refs.length || !c.refs.every((r) => r.label && /^https:\/\//.test(r.url))) fail(`check ${id} needs standards with https links`);
  for (const lvl of LEVELS[id]) if (!pairOk((c.levels || {})[lvl]) && !pairOk(checks.common_levels[lvl])) fail(`check ${id} level ${lvl} has no wording`);
  for (const lvl of Object.keys(c.levels || {})) if (!LEVELS[id].includes(lvl) && !COMMON_LEVELS.includes(lvl)) fail(`check ${id} describes level ${lvl}, which evaluate never returns`);
}

const REQUIRED_UI = ['tagline', 'hero_title_1', 'hero_title_2', 'hero_sub', 'basis', 'cite_source', 'source_line', 'domain_intro', 'foot_note', 'state_pass', 'state_fail', 'state_na', 'state_unknown'];
for (const k of REQUIRED_UI) if (!ui[k]) fail(`ui.json lacks ${k}`);
for (const c of [...Object.keys(scope.countries), 'GCC']) if (!pairOk(ui[`in_${c}`])) fail(`ui.json lacks in_${c}`);
for (const s of ['all', ...Object.keys(scope.sectors)]) if (!pairOk(ui[`of_${s}`])) fail(`ui.json lacks of_${s}`);
for (const s of Object.keys(scope.sectors)) if (!pairOk(ui[`part_${s}`]) || !ui[`part_${s}`].en.includes('{n}') || !ui[`part_${s}`].ar.includes('{n}')) fail(`ui.json lacks part_${s} with {n}`);
for (const [k, v] of Object.entries(ui)) {
  if (k.startsWith('w_')) {
    if (!Array.isArray(v.en) || v.en.length !== 2 || !Array.isArray(v.ar) || v.ar.length !== 5) fail(`ui.json ${k} needs two English and five Arabic forms`);
  } else if (Array.isArray(v)) {
    if (!v.length || !v.every(pairOk)) fail(`ui.json ${k} needs every sentence in both languages`);
  } else if (!pairOk(v)) fail(`ui.json ${k} needs both languages`);
}

const bundle = {
  schema: 'bundle/1',
  project,
  scope,
  order: CHECKS,
  groups: checks.groups,
  checks: checks.checks,
  common_levels: checks.common_levels,
  ui,
};

if (errors.length) {
  console.error('BUILD FAILED');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
const out = join(root, 'docs', 'data', 'bundle.json');
const text = JSON.stringify(bundle, null, 1) + '\n';
if (check) {
  let current = '';
  try { current = readFileSync(out, 'utf8'); } catch { /* missing */ }
  if (current !== text) { console.error('docs/data/bundle.json is stale: run npm run build'); process.exit(1); }
  console.log('bundle is current');
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(`bundle written: ${CHECKS.length} checks, ${scope.suffixes.length} suffixes, ${Object.keys(ui).length} interface strings`);
}
