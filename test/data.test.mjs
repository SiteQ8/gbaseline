import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readJson, root, pair, pairs, arabicSentence, arabicLabel, ARABIC } from './helpers.mjs';
import { CHECKS, LEVELS } from '../docs/assets/engine/checks.js';

const ui = readJson('data/src/ui.json');
const checks = readJson('data/src/checks.json');
const scope = readJson('data/src/scope.json');
const project = readJson('data/src/project.json');
const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const INDIC = /[\u0660-\u0669\u06F0-\u06F9]/;

function check(p, where) {
  pair(p.en, p.ar, where);
  assert.deepEqual(holes(p.ar), holes(p.en), `${where}: the same placeholders in both languages`);
  assert.ok(!INDIC.test(p.ar), `${where}: Arabic keeps Western digits`);
  const en = p.en.trim();
  if (en.endsWith('.')) arabicSentence(p.ar, where);
  else arabicLabel(p.ar, where);
  if (en.endsWith('?')) assert.ok(p.ar.trim().endsWith('؟'), `${where}: an Arabic question ends with the Arabic question mark`);
}

test('every interface string is complete, faithful and follows the Arabic rules', () => {
  let n = 0;
  for (const [k, v] of Object.entries(ui)) {
    if (k.startsWith('w_')) {
      assert.equal(v.en.length, 2, k);
      assert.equal(v.ar.length, 5, k);
      for (const form of v.ar) assert.ok(ARABIC.test(form) && !/\d/.test(form), `${k}: Arabic counted forms carry no digits`);
      continue;
    }
    if (Array.isArray(v)) {
      v.forEach((p, i) => {
        check(p, `ui.${k}[${i}]`);
        assert.ok(p.en.trim().endsWith('.'), `ui.${k}[${i}] is a sentence`);
        // Each item is a paragraph of its own: one opening with a connective continues the one before it and belongs inside it.
        assert.ok(!/^[وف]/.test(p.ar.trim()), `ui.${k}[${i}]: an Arabic paragraph never opens with a connective, join it to the sentence before`);
        n += 1;
      });
      continue;
    }
    check(v, `ui.${k}`);
    n += 1;
  }
  assert.ok(n > 110, `checked ${n} strings`);
});

test('every check reads in both languages, with labels, questions and one sentence per step', () => {
  for (const g of Object.keys(checks.groups)) check(checks.groups[g], `group ${g}`);
  for (const [lvl, p] of Object.entries(checks.common_levels)) check(p, `common level ${lvl}`);
  for (const c of CHECKS) {
    const x = checks.checks[c.id];
    for (const k of ['title', 'short', 'question', 'why', 'pass']) check(x[k], `${c.id}.${k}`);
    x.fix.forEach((f, i) => { check(f, `${c.id}.fix[${i}]`); assert.ok(f.en.trim().endsWith('.'), `${c.id}.fix[${i}] is a sentence`); });
    for (const [lvl, p] of Object.entries(x.levels)) { check(p, `${c.id}.levels.${lvl}`); assert.ok(LEVELS[c.id].includes(lvl), `${c.id} describes a level it can return`); }
    assert.ok(!ARABIC.test(x.example), `${c.id}: examples are records, not prose`);
  }
  const all = pairs(checks);
  assert.ok(all.length > 150, `${all.length} pairs`);
});

test('scope and project read in both languages and the suffixes cover every country and sector', () => {
  for (const [k, p] of Object.entries(scope.countries)) check(p, `country ${k}`);
  for (const [k, p] of Object.entries(scope.sectors)) check(p, `sector ${k}`);
  check(project.about, 'project.about');
  check(project.author, 'project.author');
  // Every state has government and education suffixes; the other sectors exist where the state's registry offers them.
  for (const c of Object.keys(scope.countries)) for (const s of ['government', 'education']) assert.ok(scope.suffixes.some((x) => x.country === c && x.sector === s), `${c} ${s}`);
  for (const s of Object.keys(scope.sectors)) assert.ok(scope.suffixes.some((x) => x.sector === s), `sector ${s} has a suffix`);
  for (const x of scope.left_out) assert.ok(!scope.suffixes.some((s) => s.suffix === x), `${x} left out`);
  assert.equal(new Set(scope.suffixes.map((s) => s.suffix)).size, scope.suffixes.length, 'no suffix twice');
});

test('the bundle is current', () => {
  const r = spawnSync(process.execPath, [join(root, 'scripts/build.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});
