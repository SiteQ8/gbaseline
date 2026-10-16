// The Gulf is the Arabian Gulf: no file in the repository, no page of the site and no picture names it otherwise,
// whether in its text, its credits or the metadata inside an image. The spellings this guard looks for are kept in
// base64 so that they never appear in the repository themselves. The domain inventory is left out: it lists the
// names that registries publish, which are measured, never written by this project.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { root } from './helpers.mjs';

const NEEDLES = ['cGVyc2lh', 'cGVyc2lj', 'cGVyc2lx', 'cGVyc2lzY2g=', 'cMOpcnNpYw==', 'ZmFyc2k=', '2YHYp9ix2LPZig=='].map((b) => Buffer.from(b, 'base64').toString('utf8'));
const SKIP = new Set(['.git', 'node_modules', '.impeccable', '.taste-skill']);
const SKIP_PATHS = new Set(['data/inventory']);

function files(dir = root, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (SKIP_PATHS.has(relative(root, p))) continue;
    if (statSync(p).isDirectory()) files(p, out);
    else out.push(p);
  }
  return out;
}

// Every file is read twice, as UTF-8 for the Arabic spelling and as Latin-1 for text hidden in binary metadata.
function found(buf) {
  const text = `${buf.toString('utf8')}\n${buf.toString('latin1')}`.toLowerCase();
  return NEEDLES.filter((n) => text.includes(n));
}

test('the Gulf is named the Arabian Gulf in every file, page, credit and picture', () => {
  const all = files();
  assert.ok(all.length > 50, 'the guard sees the repository');
  const bad = all.map((p) => [relative(root, p), found(readFileSync(p))]).filter(([, hits]) => hits.length);
  assert.deepEqual(bad.map(([p]) => p), [], 'files that name the Gulf otherwise');
});

test('the project names the Arabian Gulf in both languages where it introduces itself', () => {
  const project = JSON.parse(readFileSync(join(root, 'data/src/project.json'), 'utf8'));
  assert.match(project.about.ar, /الخليج العربي/);
  assert.match(project.about.en, /Arabian Gulf/);
  const html = readFileSync(join(root, 'docs/index.html'), 'utf8');
  assert.match(html.match(/<meta name="description" content="([^"]*)">/)[1], /الخليج العربي[\s\S]*Arabian Gulf/);
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(readme, /Arabian Gulf/);
  assert.match(readme, /الخليج العربي/);
});
