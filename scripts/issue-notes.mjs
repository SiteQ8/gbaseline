// The notes of the release each weekly issue is archived as: the issue, its date, how many domains it measured
// and the Gulf's six headline figures in Arabic and English, each with the link that reopens it. No domain is named.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CLAUSES, clauseShare } from '../docs/assets/engine/clauses.js';
import { tr, fill, percent, counted, dateLong } from '../docs/assets/engine/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function issueNotes(summary, bundle) {
  const ui = (key, lang, vars) => fill(tr(bundle.ui[key], lang), vars);
  const p = bundle.project;
  const base = p.domain ? `https://${p.domain}/` : '';
  const live = summary.inventory.GCC.all.live;
  const lines = (lang) => CLAUSES.map((cl) => {
    const f = clauseShare(summary.checks[cl.id].GCC.all, cl.mode);
    const sentence = ui(`cite_${cl.id}`, lang, { pct: f.v === null ? ui('no_data', lang) : percent(f.v, lang), sector: ui('of_all', lang), place: ui('in_GCC', lang) });
    return `- ${sentence} ${base}?lang=${lang}#/?i=${summary.issue}&c=${cl.n}`;
  });
  const ar = [
    `## ${p.name_ar}، العدد ${summary.issue}`,
    '',
    `صدر العدد ${summary.issue} لأسبوع ${dateLong(summary.date, 'ar')} بعد قياس ${counted(live, bundle.ui.w_live_domain, 'ar')} في دول الخليج الست.`,
    '',
    ...lines('ar'),
    '',
    'بيانات هذا العدد مرفقة بصيغتي CSV وJSON.',
  ];
  const en = [
    `## ${p.name_en}, issue ${summary.issue}`,
    '',
    `Issue ${summary.issue}, week of ${dateLong(summary.date, 'en')}, measured ${counted(live, bundle.ui.w_live_domain, 'en')} across the six Gulf states.`,
    '',
    ...lines('en'),
    '',
    'The open data of this issue is attached as CSV and JSON.',
  ];
  return `${[...ar, '', ...en].join('\n')}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const bundle = JSON.parse(readFileSync(join(root, 'docs/data/bundle.json'), 'utf8'));
  const summary = JSON.parse(readFileSync(join(root, 'docs/data/summary.json'), 'utf8'));
  process.stdout.write(issueNotes(summary, bundle));
}
