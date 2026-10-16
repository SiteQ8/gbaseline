// Language helpers shared by the site, the command line and the MCP server.
// Arabic keeps Western digits, grouped by thousands as in English, and the Arabic percent sign, and its counted
// nouns follow the number.

export const tr = (pair, lang) => (pair ? (lang === 'ar' ? pair.ar : pair.en) : '');
export const fill = (template, vars = {}) => String(template).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
export const ui = (bundle, key, lang, vars) => fill(tr(bundle.ui[key], lang), vars);

export function number(n, lang) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return Math.round(n).toLocaleString('en-US');
}

// One decimal, like the open data: 63.4٪ in Arabic and 63.4% in English.
export function percent(value, lang) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const v = (Math.round(value * 10) / 10).toFixed(1);
  return lang === 'ar' ? `${v}٪` : `${v}%`;
}

// A count with its noun. Arabic forms: [one, two, few (3 to 10), many (11 to 99), hundred (00, 01 and 02 endings)].
export function counted(n, forms, lang) {
  if (lang !== 'ar') return `${number(n, 'en')} ${n === 1 ? forms.en[0] : forms.en[1]}`;
  const [one, two, few, many, hundred] = forms.ar;
  if (n === 1) return one;
  if (n === 2) return two;
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${number(n, 'ar')} ${few}`;
  if (r >= 11 && r <= 99) return `${number(n, 'ar')} ${many}`;
  return `${number(n, 'ar')} ${hundred}`;
}

export function share(cell) {
  if (!cell) return null;
  const measured = cell.pass + cell.fail;
  return measured ? (cell.pass / measured) * 100 : null;
}

const fmt = (locale, opts) => { try { return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts }); } catch { return null; } };

// 19 October 2026, and the same day in the Umm al-Qura calendar, both with Western digits.
export function dateLong(iso, lang) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const f = fmt(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return f ? f.format(d) : iso;
}

export function dateHijri(iso, lang) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const f = fmt(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-GB-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
  return f ? f.format(d) : '';
}
