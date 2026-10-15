// The site: this week's issue, the countries, the checks, the live domain check and the method.
// Everything is built from the bundle and the published data with DOM nodes; no markup strings, no inline styles.
import { createResolver, cleanDomain } from './engine/dns.js';
import { CHECKS, GROUPS, PASS_LEVELS, NA_LEVELS, observeDns, evaluate, suffixChain } from './engine/checks.js';
import { tr, fill, number, percent, counted, share, dateLong, dateHijri } from './engine/i18n.js';

const KEY = 'register:v1';
const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
let B;
let D = { summary: null, history: [] };
let S;

function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
const t = (key, vars) => fill(tr(B.ui[key], S.lang), vars);
const P = (pair) => tr(pair, S.lang);
const words = (n, key) => counted(n, B.ui[key], S.lang);
const num = (n) => number(n, S.lang);
const pctText = (v) => (v === null ? t('no_data') : percent(v, S.lang));
const ofCount = (cell) => t('of_count', { pass: num(cell.pass), measured: num(cell.pass + cell.fail) });
const PLACES = () => ['GCC', ...Object.keys(B.scope.countries)];
const SECTORS = () => ['all', ...Object.keys(B.scope.sectors)];
const placeName = (p) => (p === 'GCC' ? t('place_GCC') : P(B.scope.countries[p]));
const sectorName = (s) => (s === 'all' ? t('sector_all') : P(B.scope.sectors[s]));
const checkMeta = (id) => CHECKS.find((c) => c.id === id);
const levelText = (id, level) => P((B.checks[id].levels || {})[level] || B.common_levels[level] || { en: level, ar: level });
const name = () => P({ en: B.project.name_en, ar: B.project.name_ar });
const repoPath = () => { const m = String(B.project.repo || '').match(/github\.com\/([^/]+\/[^/#?]+)/); return m ? m[1] : 'SiteQ8/REPO'; };
const ltr = (text) => h('bdi', { dir: 'ltr' }, text);

// Marks: a filled stamp passes, a struck cross fails, a ring does not apply, a broken ring was not measured.
function mark(state) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('class', `mark ${state}`);
  svg.setAttribute('aria-hidden', 'true');
  const el = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); svg.append(e); };
  if (state === 'pass') el('circle', { cx: 6, cy: 6, r: 5, fill: 'currentColor' });
  else if (state === 'fail') el('path', { d: 'M2.6 2.6 9.4 9.4M9.4 2.6 2.6 9.4', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round', fill: 'none' });
  else el('circle', { cx: 6, cy: 6, r: 4.4, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, ...(state === 'unknown' ? { 'stroke-dasharray': '1.7 1.9' } : {}) });
  return svg;
}

function figure(v) {
  if (v === null) return h('span', { class: 'figure' }, t('no_data'));
  return h('span', { class: 'figure' }, String(Math.round(v)), h('span', { class: 'pct' }, S.lang === 'ar' ? '٪' : '%'));
}
function cellFig(v) {
  if (v === null) return h('span', { class: 'cell-fig' }, t('no_data'));
  return h('span', { class: 'cell-fig' }, String(Math.round(v)), h('span', { class: 'pct' }, S.lang === 'ar' ? '٪' : '%'));
}
function bar(v) {
  const i = h('i');
  if (v !== null) i.style.setProperty('--v', String(Math.max(0, Math.min(100, v))));
  return h('span', { class: 'bar', 'aria-hidden': 'true' }, i);
}

function load() {
  let s = { lang: 'ar', place: 'GCC', sector: 'all', compare: 'KW' };
  try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') s = { ...s, ...saved }; } catch { /* storage unavailable */ }
  const q = new URLSearchParams(location.search);
  if (q.has('lang')) s.lang = q.get('lang');
  s.lang = s.lang === 'en' ? 'en' : 'ar';
  if (!PLACES().includes(s.place)) s.place = 'GCC';
  if (!SECTORS().includes(s.sector)) s.sector = 'all';
  if (!Object.keys(B.scope.countries).includes(s.compare)) s.compare = 'KW';
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ } }

function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { view: parts[0] || 'overview', arg: parts[1] ? decodeURIComponent(parts[1]) : null, query: new URLSearchParams(query || '') };
}

async function getJson(url) {
  try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; }
}

/* ---------- frame: masthead, sections, colophon ---------- */

function renderMasthead() {
  const m = $('masthead');
  m.replaceChildren();
  const n = name();
  const lang = h('button', { class: 'lang', id: 'lang', type: 'button', lang: S.lang === 'ar' ? 'en' : 'ar', onclick: () => setLang(S.lang === 'ar' ? 'en' : 'ar') }, S.lang === 'ar' ? 'English' : 'العربية');
  m.append(h('div', { class: 'mast-row' }, h('a', { class: n ? 'wordmark' : 'wordmark long', href: '#/' }, n || t('tagline')), lang));
  if (n) m.append(h('p', { class: 'tagline' }, t('tagline')));
  m.append(h('div', { class: 'rule2', 'aria-hidden': 'true' }));
  const s = D.summary;
  if (s) {
    m.append(h('p', { class: 'issue-line' },
      h('span', {}, h('b', {}, t('issue', { n: s.issue }))),
      h('span', { class: 'nowrap' }, t('week_of', { date: dateLong(s.date, S.lang) })),
      h('span', { class: 'nowrap' }, dateHijri(s.date, S.lang)),
      h('span', {}, t('weekly'))));
  }
}

const NAV = [['overview', '#/', 'nav_overview'], ['countries', '#/countries', 'nav_countries'], ['checks', '#/checks', 'nav_checks'], ['domain', '#/domain', 'nav_domain'], ['method', '#/method', 'nav_method']];
function renderNav(r) {
  const nav = $('sections');
  nav.setAttribute('aria-label', t('nav_label'));
  const active = r.view === 'check' ? 'checks' : r.view === 'country' ? 'countries' : r.view;
  nav.replaceChildren(h('ul', {}, NAV.map(([id, href, key]) => h('li', {}, h('a', { href, 'aria-current': id === active ? 'page' : null }, t(key))))));
}

function renderColophon() {
  const f = $('colophon');
  f.replaceChildren(
    h('div', { class: 'rule2', 'aria-hidden': 'true' }),
    h('p', {}, t('foot_note')),
    h('p', { class: 'links' },
      h('span', {}, t('foot_author', { author: '' }), h('a', { href: B.project.author_url }, P(B.project.author))),
      B.project.repo ? h('a', { href: B.project.repo }, t('foot_code')) : null,
      h('a', { href: '#/method' }, t('m_data_h'))),
  );
}

/* ---------- citation slips ---------- */

// The address of one clause in its scope and language; it never ends on a slash, so it reads whole inside Arabic.
function clauseUrl(n, place, sector, lang) {
  const base = B.project.domain ? `https://${B.project.domain}/` : location.origin + location.pathname;
  const q = new URLSearchParams();
  if (place !== 'GCC') q.set('p', place);
  if (sector !== 'all') q.set('s', sector);
  q.set('c', String(n));
  return `${base}?lang=${lang}#/?${q}`;
}

function citation(sentence, lang, ref) {
  const s = D.summary;
  const label = tr({ en: B.project.name_en, ar: B.project.name_ar }, lang) || tr(B.ui.tagline, lang).replace(/\.$/, '');
  const url = clauseUrl(ref.n, ref.place, ref.sector, lang);
  const [before, after = ''] = tr(B.ui.cite_source, lang).split('{url}');
  const vars = { name: label, clause: ref.n, issue: s.issue, date: dateLong(s.date, lang) };
  return { sentence, source: [fill(before, vars), url, fill(after, vars)], text: `${sentence}\n${fill(before, vars)}${url}${fill(after, vars)}` };
}

function slipFor(sentences, ref) {
  const slip = h('div', { class: 'slip', hidden: true });
  const row = (lang) => {
    const c = citation(sentences[lang], lang, ref);
    const quote = h('blockquote', { lang, dir: lang === 'ar' ? 'rtl' : 'ltr' },
      h('span', { class: 'q' }, c.sentence),
      h('span', { class: 'src' }, c.source[0], h('bdi', { dir: 'ltr' }, c.source[1]), c.source[2]));
    const done = h('span', { class: 'done', 'aria-live': 'polite' });
    const copy = h('button', { class: 'btn', type: 'button', onclick: async () => {
      try { await navigator.clipboard.writeText(c.text); } catch { const sel = getSelection(); const range = document.createRange(); range.selectNodeContents(quote); sel.removeAllRanges(); sel.addRange(range); }
      done.textContent = t('copied');
      setTimeout(() => { done.textContent = ''; }, 1800);
    } }, t(lang === 'ar' ? 'copy_ar' : 'copy_en'));
    return [quote, h('div', { class: 'row' }, copy, done)];
  };
  const order = S.lang === 'ar' ? ['ar', 'en'] : ['en', 'ar'];
  slip.append(h('h3', {}, t('cite_title')), ...order.flatMap(row));
  return slip;
}

function citeButton(slip) {
  const b = h('button', { class: 'cite', type: 'button', 'aria-expanded': 'false', onclick: () => {
    const open = slip.hidden;
    slip.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
  } }, t('cite'));
  return b;
}

/* ---------- overview: the issue ---------- */

const CLAUSES = [
  { n: 1, id: 'dmarc', mode: 'fail', key: 'lead_dmarc', cite: 'lead_dmarc' },
  { n: 2, id: 'pq_kex', mode: 'pass', key: 'lead_pq_kex', cite: 'cite_pq_kex' },
  { n: 3, id: 'security_txt', mode: 'pass', key: 'lead_security_txt', cite: 'cite_security_txt' },
  { n: 4, id: 'dnssec', mode: 'pass', key: 'lead_dnssec', cite: 'cite_dnssec' },
];

function clauseFigures(id, mode, place, sector) {
  const c = D.summary.checks[id][place][sector];
  const measured = c.pass + c.fail;
  const v = measured ? ((mode === 'fail' ? c.fail : c.pass) / measured) * 100 : null;
  return { v, count: mode === 'fail' ? c.fail : c.pass, measured };
}

function sentenceOf(key, lang, vars) {
  const template = tr(B.ui[key], lang);
  return fill(template, vars);
}

function clauseNode(cl, place, sector) {
  const f = clauseFigures(cl.id, cl.mode, place, sector);
  const vars = (lang) => ({ pct: f.v === null ? tr(B.ui.no_data, lang) : percent(f.v, lang), sector: tr(B.ui[`of_${sector}`], lang), place: tr(B.ui[`in_${place}`], lang) });
  const full = { ar: sentenceOf(cl.cite, 'ar', vars('ar')), en: sentenceOf(cl.cite, 'en', vars('en')) };
  const rest = fill(tr(B.ui[cl.key], S.lang).replace(/^\{pct\}\s*/, ''), vars(S.lang));
  const slip = slipFor(full, { n: cl.n, place, sector });
  const lead = cl.n === 1;
  const text = f.measured
    ? h('p', { class: lead ? 'lead-sentence' : 'clause-text' }, figure(f.v), lead ? null : ' ', rest)
    : h('p', { class: lead ? 'lead-sentence' : 'clause-text' }, t('no_data_sentence'));
  const basis = f.measured ? h('p', { class: 'basis' }, h('span', {}, t('basis', { count: num(f.count), domains: words(f.measured, 'w_domain') })), citeButton(slip)) : null;
  return h('li', { class: 'clause', id: `c${cl.n}` },
    h('span', { class: 'num', 'aria-hidden': 'true' }, String(cl.n)),
    h('div', {}, h('span', { class: 'sr' }, t('clause', { n: cl.n })), text, basis),
    f.measured ? slip : null);
}

function segmented(legendKey, nameAttr, options, current, labelOf, onChange) {
  return h('fieldset', { class: 'seg' },
    h('legend', {}, t(legendKey)),
    h('div', { class: 'opts' }, options.map((o) => h('label', {},
      h('input', { type: 'radio', name: nameAttr, value: o, checked: o === current, onchange: () => onChange(o) }),
      h('span', {}, labelOf(o))))));
}

function registerTable(sector, focusPlace) {
  const s = D.summary;
  const places = PLACES();
  const compare = focusPlace !== 'GCC' ? focusPlace : S.compare;
  const head = h('tr', {}, h('th', { scope: 'col' }, t('table_check')), places.map((p) => h('th', { scope: 'col', 'data-place': p, class: [p === focusPlace ? 'here' : '', p === compare ? 'focus' : ''].join(' ').trim() || null }, placeName(p))));
  const body = [];
  for (const g of GROUPS) {
    body.push(h('tr', { class: 'group' }, h('th', { colspan: places.length + 1, scope: 'colgroup' }, P(B.groups[g]))));
    for (const c of CHECKS.filter((x) => x.group === g)) {
      body.push(h('tr', {},
        h('th', { scope: 'row' }, h('a', { href: `#/checks/${c.id}` }, P(B.checks[c.id].short))),
        places.map((p) => {
          const cell = s.checks[c.id][p][sector];
          const v = share(cell);
          const cls = [p === focusPlace ? 'here' : '', p === compare ? 'focus' : '', v === null ? 'none' : ''].join(' ').trim() || null;
          return h('td', { 'data-place': p, class: cls, title: v === null ? null : ofCount(cell) }, cellFig(v), bar(v));
        })));
    }
  }
  const select = h('select', { onchange: (e) => { S.compare = e.target.value; save(); renderMain(route()); } }, Object.keys(B.scope.countries).map((c) => h('option', { value: c, selected: c === compare ? true : null }, placeName(c))));
  const live = s.inventory.GCC[sector].live;
  return h('section', { class: 'register', 'aria-labelledby': 'reg-cap' },
    h('label', { class: 'compare' }, t('compare_label'), select),
    h('div', { class: 'table-scroll' }, h('table', { class: 'reg' }, h('caption', { id: 'reg-cap' }, h('span', { class: 'tno' }, t('table_no')), `${t('table_caption')}\u00A0· ${sectorName(sector)}`), h('thead', {}, head), h('tbody', {}, body))),
    h('p', { class: 'source' }, t('source_line', { date: dateLong(s.date, S.lang), domains: words(live, 'w_live_domain') })));
}

function weekByWeek(place, sector) {
  if (D.history.length < 2) return null;
  const weeks = D.history.map((wk, i) => ({ n: i + 1, date: wk.date, c: wk.c || {} })).reverse();
  const shareOf = (wk, id) => {
    const [pass, measured] = ((wk.c[id] || {})[place] || {})[sector] || [0, 0];
    return measured ? (pass / measured) * 100 : null;
  };
  const issueHead = (wk) => [h('span', { class: 'wk-n' }, t('issue', { n: wk.n })), h('span', { class: 'wk-d' }, dateLong(wk.date, S.lang))];
  const wide = h('table', { class: 'reg wk wide' },
    h('caption', { id: 'wk-cap' }, t('trend_title')),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('issue', { n: '' }).trim()), CLAUSES.map((cl) => h('th', { scope: 'col' }, P(B.checks[cl.id].short))))),
    h('tbody', {}, weeks.map((wk) => h('tr', {}, h('th', { scope: 'row' }, issueHead(wk)), CLAUSES.map((cl) => h('td', {}, cellFig(shareOf(wk, cl.id))))))));
  const recent = weeks.slice(0, 3);
  const narrow = h('table', { class: 'reg wk narrow' },
    h('caption', {}, t('trend_title')),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('table_check')), recent.map((wk) => h('th', { scope: 'col' }, issueHead(wk))))),
    h('tbody', {}, CLAUSES.map((cl) => h('tr', {}, h('th', { scope: 'row' }, P(B.checks[cl.id].short)), recent.map((wk) => h('td', {}, cellFig(shareOf(wk, cl.id))))))));
  return h('section', { class: 'register trend', 'aria-labelledby': 'wk-cap' }, wide, narrow,
    h('p', { class: 'source' }, t('trend_source', { sector: t(`of_${sector}`), place: t(`in_${place}`) })));
}

function pendingBlock() {
  return h('section', { class: 'pending' },
    h('h1', {}, t('pending_title')),
    h('p', { class: 'lede' }, t('pending_body')),
    h('p', { class: 'links' }, h('a', { href: '#/checks' }, t('nav_checks')), ' · ', h('a', { href: '#/domain' }, t('nav_domain')), ' · ', h('a', { href: '#/method' }, t('nav_method'))));
}

function viewOverview(r) {
  if (!D.summary) return [pendingBlock()];
  const place = PLACES().includes(r.query.get('p')) ? r.query.get('p') : S.place;
  const sector = SECTORS().includes(r.query.get('s')) ? r.query.get('s') : S.sector;
  const change = (k, v) => {
    S[k] = v; save();
    const q = new URLSearchParams({ p: k === 'place' ? v : place, s: k === 'sector' ? v : sector });
    history.replaceState(null, '', `${location.pathname}${location.search}#/?${q}`);
    renderMain(route());
    const again = document.querySelector(`input[name='${k}'][value='${v}']`);
    if (again) again.focus();
  };
  const scope = h('div', { class: 'scope' },
    segmented('country_label', 'place', PLACES(), place, placeName, (v) => change('place', v)),
    segmented('sector_label', 'sector', SECTORS(), sector, sectorName, (v) => change('sector', v)));
  const [lead, ...others] = CLAUSES;
  const first = h('div', { class: 'issue-lead' },
    h('h1', { class: 'sr' }, `${t('issue', { n: D.summary.issue })} · ${dateLong(D.summary.date, S.lang)}`),
    h('ol', { class: 'clauses' }, clauseNode(lead, place, sector)),
    scope,
    h('ol', { class: 'clauses', start: 2 }, others.map((cl) => clauseNode(cl, place, sector))));
  return [h('div', { class: 'issue' }, first, registerTable(sector, place)), weekByWeek(place, sector)];
}

/* ---------- countries ---------- */

function viewCountries() {
  if (!D.summary) return [h('h1', {}, t('countries_title')), pendingBlock()];
  const s = D.summary;
  const items = Object.keys(B.scope.countries).map((c) => {
    const inv = s.inventory[c].all;
    const figs = ['dmarc', 'dnssec', 'hsts', 'security_txt'].map((id) => h('span', { class: 'nowrap' }, `${P(B.checks[id].short)} `, h('b', {}, pctText(share(s.checks[id][c].all)))));
    return h('li', {}, h('a', { class: 'row-link', href: `#/countries/${c}` },
      h('span', { class: 'row-title' }, placeName(c)),
      h('span', { class: 'row-meta' }, t('country_count', { domains: words(inv.live, 'w_live_domain') })),
      h('span', { class: 'row-stats' }, figs)));
  });
  return [h('h1', {}, t('countries_title')), h('ul', { class: 'rows' }, items)];
}

function viewCountry(code, r) {
  if (!B.scope.countries[code]) return viewCountries();
  if (!D.summary) return [h('h1', {}, placeName(code)), pendingBlock()];
  const s = D.summary;
  const sector = SECTORS().includes(r.query.get('s')) ? r.query.get('s') : 'all';
  const inv = s.inventory[code];
  const notes = B.scope.suffixes.filter((x) => x.country === code).map((x) => {
    const on = s.chain[x.suffix];
    return h('li', {}, mark(on ? 'pass' : on === false ? 'fail' : 'unknown'), ' ', t(on ? 'chain_on' : 'chain_off', { suffix: x.suffix }));
  });
  const rows = GROUPS.flatMap((g) => [
    h('tr', { class: 'group' }, h('th', { colspan: 3, scope: 'colgroup' }, P(B.groups[g]))),
    ...CHECKS.filter((c) => c.group === g).map((c) => {
      const cell = s.checks[c.id][code][sector];
      const here = share(cell);
      const gcc = share(s.checks[c.id].GCC[sector]);
      return h('tr', {},
        h('th', { scope: 'row' }, h('a', { href: `#/checks/${c.id}` }, P(B.checks[c.id].short))),
        h('td', { class: 'here', title: here === null ? null : ofCount(cell) }, cellFig(here), bar(here)),
        h('td', {}, cellFig(gcc), bar(gcc)));
    }),
  ]);
  const seg = segmented('sector_label', 'csector', SECTORS(), sector, sectorName, (v) => { location.hash = `#/countries/${code}?s=${v}`; });
  return [
    h('h1', {}, placeName(code)),
    h('p', { class: 'lede' }, t('country_lede', { domains: words(inv.all.live, 'w_live_domain'), gov: num(inv.government.live), edu: num(inv.education.live) })),
    inv.all.retired ? h('p', { class: 'muted measure' }, t('country_retired', { n: num(inv.all.retired) })) : null,
    h('ul', { class: 'levels measure' }, notes),
    h('div', { class: 'scope' }, seg),
    h('div', { class: 'table-scroll narrow' }, h('table', { class: 'reg' },
      h('caption', {}, `${placeName(code)} · ${sectorName(sector)}`),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('table_check')), h('th', { scope: 'col', class: 'here' }, placeName(code)), h('th', { scope: 'col' }, placeName('GCC')))),
      h('tbody', {}, rows))),
    h('p', { class: 'source' }, t('source_line', { date: dateLong(s.date, S.lang), domains: words(inv[sector].live, 'w_live_domain') })),
  ];
}

/* ---------- checks ---------- */

function viewChecks() {
  const s = D.summary;
  const out = [h('h1', {}, t('checks_title')), h('p', { class: 'lede' }, t('checks_intro'))];
  for (const g of GROUPS) {
    out.push(h('h2', { class: 'group-h' }, P(B.groups[g])));
    out.push(h('ul', { class: 'rows' }, CHECKS.filter((c) => c.group === g).map((c) => {
      const v = s ? share(s.checks[c.id].GCC.all) : null;
      return h('li', {}, h('a', { class: 'row-link', href: `#/checks/${c.id}` },
        h('span', { class: 'row-title' }, P(B.checks[c.id].title)),
        s ? h('span', { class: 'row-fig' }, pctText(v)) : h('span'),
        h('span', { class: 'row-meta' }, P(B.checks[c.id].question))));
    })));
  }
  return out;
}

function viewCheck(id) {
  const c = B.checks[id];
  if (!c) return viewChecks();
  const s = D.summary;
  const main = h('div', {},
    h('section', {}, h('h2', {}, t('check_why')), h('p', { class: 'measure' }, P(c.why))),
    h('section', {}, h('h2', {}, t('check_pass')), h('p', { class: 'measure' }, P(c.pass))),
    h('section', {}, h('h2', {}, t('check_fix')), h('ol', { class: 'steps measure' }, c.fix.map((f) => h('li', {}, P(f))))),
    c.example ? h('section', {}, h('h2', {}, t('check_example')), h('pre', { class: 'code' }, c.example)) : null,
    h('section', {}, h('h2', {}, t('check_refs')), h('ul', { class: 'refs' }, c.refs.map((ref) => h('li', {}, h('a', { href: ref.url, rel: 'noopener' }, ref.label))))));
  let side = null;
  if (s) {
    const rows = PLACES().map((p) => {
      const cell = s.checks[id][p].all;
      const v = share(cell);
      return h('tr', {}, h('th', { scope: 'row' }, placeName(p)), h('td', {}, cellFig(v), bar(v)), h('td', { class: 'muted' }, ofCount(cell)));
    });
    const levels = Object.entries(s.checks[id].GCC.all.levels).sort((a, b) => b[1] - a[1]);
    const stateOf = (level) => (PASS_LEVELS.has(level) ? 'pass' : NA_LEVELS.has(level) ? 'na' : (B.checks[id].levels || {})[level] ? 'fail' : 'unknown');
    side = h('aside', { class: 'side' },
      h('section', {}, h('h2', {}, t('check_by_country')), h('table', { class: 'reg' }, h('tbody', {}, rows))),
      h('section', {}, h('h2', {}, t('check_found')), h('ul', { class: 'levels' }, levels.map(([lvl, n]) => h('li', {}, mark(stateOf(lvl)), h('span', {}, levelText(id, lvl)), h('span', { class: 'n' }, num(n)))))));
  }
  return [
    h('h1', {}, P(c.title)),
    h('p', { class: 'question' }, P(c.question)),
    h('div', { class: 'entry' }, main, side),
  ];
}

/* ---------- live domain check ---------- */

function suffixFor(domain) {
  const list = [...B.scope.suffixes].sort((a, b) => b.suffix.length - a.suffix.length);
  const hit = list.find((x) => domain.endsWith(`.${x.suffix}`));
  return hit ? hit.suffix : null;
}

function renderResult(box, domain, results) {
  const measured = Object.values(results).filter((x) => x.state === 'pass' || x.state === 'fail');
  const passed = measured.filter((x) => x.state === 'pass').length;
  const groups = GROUPS.map((g) => [
    h('h3', { class: 'group-h' }, P(B.groups[g])),
    h('ul', { class: 'res' }, CHECKS.filter((c) => c.group === g).map((c) => {
      const res = results[c.id];
      return h('li', { class: res.state }, mark(res.state), h('span', { class: 'what' }, h('span', { class: 'sr' }, `${t(`state_${res.state}`)} `), P(B.checks[c.id].short)), h('span', { class: 'lvl' }, `${t(`state_${res.state}`)} · ${levelText(c.id, res.level)}`));
    })),
  ]);
  box.replaceChildren(...[
    h('h2', {}, ltr(domain)),
    h('p', {}, t('domain_summary', { pass: num(passed), checks: words(measured.length, 'w_check') })),
    ...groups.flat()].filter(Boolean));
}

function viewDomain(r) {
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const box = h('div', { class: 'result' });
  const input = h('input', { id: 'domain-input', type: 'text', inputmode: 'url', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'example.com', dir: 'ltr', value: r.query.get('d') || '' });
  const button = h('button', { class: 'btn primary', type: 'submit' }, t('domain_button'));
  async function run() {
    const domain = cleanDomain(input.value);
    status.classList.remove('error');
    if (!domain) { status.textContent = t('domain_invalid'); status.classList.add('error'); return; }
    history.replaceState(null, '', `${location.pathname}${location.search}#/domain?d=${encodeURIComponent(domain)}`);
    button.disabled = true;
    status.textContent = t('domain_running');
    box.replaceChildren();
    try {
      const resolver = createResolver({ timeout: 8000 });
      const suffix = suffixFor(domain);
      const chain = suffix ? await suffixChain(suffix, resolver) : undefined;
      const obs = await observeDns(domain, resolver);
      if (obs.dns.state === 'nxdomain') { status.textContent = t('domain_nx'); return; }
      if (obs.dns.state !== 'live') { status.textContent = obs.dns.rcode === 'ERROR' ? t('domain_error') : t('domain_broken'); status.classList.add('error'); return; }
      status.textContent = '';
      renderResult(box, domain, evaluate(obs, { chain }));
    } catch {
      status.textContent = t('domain_error');
      status.classList.add('error');
    } finally {
      button.disabled = false;
    }
  }
  const form = h('form', { class: 'check-form', onsubmit: (e) => { e.preventDefault(); run(); } },
    h('label', { for: 'domain-input' }, t('domain_label'), input), button);
  if (input.value) queueMicrotask(run);
  return [
    h('h1', {}, t('domain_title')),
    h('p', { class: 'lede' }, t('domain_intro')),
    form,
    status,
    h('p', { class: 'muted measure' }, t('domain_privacy')),
    box,
    h('section', { class: 'measure cli-note' }, h('h2', {}, t('m_cli_h')), h('p', {}, t('domain_cli')), h('pre', { class: 'code' }, `npx -y github:${repoPath()} check example.com`)),
  ];
}

/* ---------- method and data ---------- */

function viewMethod() {
  const s = D.summary;
  const sec = (headKey, body) => h('section', {}, h('h2', {}, t(headKey)), ...body);
  const p = (key) => B.ui[key].map((x) => h('p', { class: 'measure' }, tr(x, S.lang)));
  const suffixes = h('ul', { class: 'suffixes' }, B.scope.suffixes.map((x) => {
    const on = s ? s.chain[x.suffix] : null;
    return h('li', {}, h('code', {}, x.suffix), h('span', { class: 'muted' }, placeName(x.country), ' · ', P(B.scope.sectors[x.sector])), s ? h('span', { class: 'chain' }, mark(on ? 'pass' : on === false ? 'fail' : 'unknown'), t(on ? 'chain_yes' : 'chain_no')) : null);
  }));
  const quality = s ? sec('m_quality_h', [
    h('p', { class: 'measure' }, t('q_agree', { pct: pctText((s.quality.agreement.same + s.quality.agreement.differ) ? (s.quality.agreement.same / (s.quality.agreement.same + s.quality.agreement.differ)) * 100 : null) })),
    h('p', { class: 'measure' }, t('q_unreachable', { n: num(s.quality.web.unreachable) })),
    s.quality.seconds !== null ? h('p', { class: 'measure' }, t('q_runtime', { minutes: words(Math.max(1, Math.round(s.quality.seconds / 60)), 'w_minute'), queries: words(s.quality.queries || 0, 'w_query') })) : null,
  ]) : null;
  const dl = [['dl_latest_csv', 'data/open/latest.csv'], ['dl_history_csv', 'data/open/history.csv'], ['dl_summary_json', 'data/summary.json'], ['dl_history_json', 'data/history.json']];
  const mcpConfig = JSON.stringify({ mcpServers: { [B.project.slug || 'observatory']: { command: 'npx', args: ['-y', `github:${repoPath()}`, 'mcp'] } } }, null, 2);
  return [h('div', { class: 'method' },
    h('h1', {}, t('method_title')),
    sec('m_scope_h', [p('m_scope'), h('h3', {}, t('m_suffixes')), suffixes]),
    sec('m_sources_h', [p('m_sources')]),
    sec('m_how_h', [p('m_how')]),
    sec('m_publish_h', [p('m_publish')]),
    sec('m_limits_h', [p('m_limits')]),
    quality,
    sec('m_data_h', [p('m_data'), s ? h('ul', { class: 'downloads' }, dl.map(([k, href]) => h('li', {}, h('a', { href, download: '' }, t(k))))) : null]),
    sec('m_cite_h', [p('m_cite')]),
    sec('m_cli_h', [p('m_cli'), h('pre', { class: 'code' }, `npx -y github:${repoPath()} check example.com\nnpx -y github:${repoPath()} check example.com --lang ar --json`), h('pre', { class: 'code' }, mcpConfig)]),
    sec('m_code_h', [p('m_code'), B.project.repo ? h('p', {}, h('a', { href: B.project.repo }, B.project.repo.replace(/^https:\/\//, ''))) : null]),
  )];
}

/* ---------- render ---------- */

function renderMain(r) {
  const main = $('main');
  let nodes;
  if (r.view === 'overview' || r.view === '') nodes = viewOverview(r);
  else if (r.view === 'countries' || r.view === 'country') nodes = r.arg ? viewCountry(r.arg.toUpperCase(), r) : viewCountries();
  else if (r.view === 'checks' || r.view === 'check') nodes = r.arg ? viewCheck(r.arg) : viewChecks();
  else if (r.view === 'domain') nodes = viewDomain(r);
  else if (r.view === 'method') nodes = viewMethod();
  else nodes = viewOverview(r);
  main.replaceChildren(...nodes.filter(Boolean));
  const titleBits = { overview: 'nav_overview', countries: 'nav_countries', country: 'nav_countries', checks: 'nav_checks', check: 'nav_checks', domain: 'nav_domain', method: 'nav_method' };
  document.title = [t(titleBits[r.view] || 'nav_overview'), name() || t('tagline').replace(/\.$/, '')].join(' · ');
  const target = r.query.get('c');
  if (target) { const el = $(`c${target}`); if (el) { el.classList.add('stamped'); el.scrollIntoView({ block: 'center' }); } }
}

function render(moveFocus = false) {
  const r = route();
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  $('skip').textContent = t('skip');
  renderMasthead();
  renderNav(r);
  renderMain(r);
  renderColophon();
  if (moveFocus) $('main').focus({ preventScroll: true });
}

function setLang(lang) {
  S.lang = lang;
  save();
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  history.replaceState(null, '', url);
  render();
  $('lang').focus();
}

async function boot() {
  B = await getJson('data/bundle.json');
  if (!B) return;
  const [summary, hist] = await Promise.all([getJson('data/summary.json'), getJson('data/history.json')]);
  D = { summary: summary && summary.checks ? summary : null, history: Array.isArray(hist) ? hist : [] };
  S = load();
  render();
  addEventListener('hashchange', () => { render(true); scrollTo({ top: 0 }); });
}

boot();
