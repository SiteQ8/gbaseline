// Shared by the command line and the MCP server: the bundle, the scanner's user agent and level wording.
import { readFileSync } from 'node:fs';
import { tr } from '../docs/assets/engine/i18n.js';

export const bundle = JSON.parse(readFileSync(new URL('../docs/data/bundle.json', import.meta.url), 'utf8'));
export const project = bundle.project;
export const scope = bundle.scope;

export function userAgent() {
  const name = project.slug || 'observatory';
  const where = project.domain ? `https://${project.domain}/#/method` : 'https://github.com/SiteQ8';
  return `Mozilla/5.0 (compatible; ${name}/${project.version}; +${where})`;
}

export function levelText(id, level, lang) {
  const own = ((bundle.checks[id] || {}).levels || {})[level];
  return tr(own || bundle.common_levels[level] || { en: level, ar: level }, lang);
}
