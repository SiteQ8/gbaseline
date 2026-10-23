// Every page of the site as a tree (see vnode.js). scripts/prerender.mjs prints each one to HTML when an issue is
// published, so every page can be read, linked and cited without script; the browser renders only the live check
// again. The layout is a printed annual: a mosaic of the six states at night across the top, titles hung on one
// axis, figures set inside sentences, and solid colour pages. No view sets the states side by side or ranks them.
import { h, frag } from './vnode.js';
import { CHECKS, GROUPS, PASS_LEVELS, NA_LEVELS } from './engine/checks.js';
import { CLAUSES, clauseShare } from './engine/clauses.js';
import { tr, fill, number, percent, counted, dateLong } from './engine/i18n.js';

export const LANGS = ['ar', 'en'];
export const SLUGS = Object.fromEntries(CHECKS.map((c) => [c.id, c.id.replace(/_/g, '-')]));
export const RUN_TIME = '02:17';

// The address of a page in a language: Arabic at the root, English under /en/.
export const pathOf = (lang, rel = '') => `${lang === 'ar' ? '/' : '/en/'}${rel}`;

// Every page the site prints, in the order of the sitemap. Each issue keeps a page for the Gulf and one per state.
export function routes(B, D) {
  const cc = Object.keys(B.scope.countries);
  const out = [{ page: 'home', rel: '' }, { page: 'countries', rel: 'countries/' }];
  for (const c of cc) out.push({ page: 'country', cc: c, rel: `countries/${c.toLowerCase()}/` });
  out.push({ page: 'standards', rel: 'standards/' });
  for (const c of CHECKS) out.push({ page: 'standard', id: c.id, rel: `standards/${SLUGS[c.id]}/` });
  out.push({ page: 'check', rel: 'check/' }, { page: 'method', rel: 'method/' }, { page: 'film', rel: 'film/' }, { page: 'issues', rel: 'issues/' });
  for (let n = 1; n <= issueCount(D); n += 1) {
    out.push({ page: 'issue', n, place: 'GCC', rel: `issues/${n}/` });
    for (const c of cc) out.push({ page: 'issue', n, place: c, rel: `issues/${n}/${c.toLowerCase()}/` });
  }
  return out;
}

export const issueCount = (D) => (D.summary ? D.summary.issue : 0);

/* ---------- the kit: words, numbers and addresses in the page's language ---------- */

export function kit(ctx) {
  const { B, lang } = ctx;
  const t = (key, vars) => fill(tr(B.ui[key], lang), vars);
  const tl = (key, l, vars) => fill(tr(B.ui[key], l), vars);
  const P = (pair) => tr(pair, lang);
  const num = (n) => number(n, lang);
  const pct = (v) => (v === null || v === undefined ? t('no_data') : percent(v, lang));
  const words = (n, key) => counted(n, B.ui[key], lang);
  const href = (rel, l = lang) => pathOf(l, rel);
  const abs = (rel, l = lang) => `https://${B.project.domain}${pathOf(l, rel)}`;
  const place = (p) => (p === 'GCC' ? t('place_GCC') : P(B.scope.countries[p]));
  const sectorName = (s) => (s === 'all' ? t('sector_all') : P(B.scope.sectors[s]));
  const date = (iso) => dateLong(iso, lang);
  return { ...ctx, t, tl, P, num, pct, words, href, abs, place, sectorName, date, other: lang === 'ar' ? 'en' : 'ar' };
}

// A template whose placeholders are printed in full ink: figures written into prose.
function rich(k, key, vars, strong = Object.keys(vars)) {
  const parts = tr(k.B.ui[key], k.lang).split(/(\{\w+\})/);
  return parts.filter(Boolean).map((p) => {
    const m = p.match(/^\{(\w+)\}$/);
    if (!m) return p;
    const v = vars[m[1]];
    return strong.includes(m[1]) ? h('strong', {}, v) : v;
  });
}

const ltr = (text) => h('bdi', { dir: 'ltr' }, text);

// One issue's figures, from the full summary when it is the latest and from the weekly series otherwise.
export function issueOf(D, n) {
  const latest = issueCount(D);
  if (!latest || n < 1 || n > latest) return null;
  if (n === latest) {
    const s = D.summary;
    return {
      n, latest: true, date: s.date,
      cell: (id, place, sector) => { const c = ((s.checks[id] || {})[place] || {})[sector]; return c ? [c.pass, c.pass + c.fail] : [0, 0]; },
      live: (place, sector) => (((s.inventory[place] || {})[sector]) || {}).live ?? null,
      sectors: (place) => ['all', ...Object.keys(s.inventory[place] || {}).filter((x) => x !== 'all' && s.inventory[place][x].live)],
    };
  }
  const e = D.history[n - 1];
  if (!e) return null;
  const cell = (id, place, sector) => ((((e.c || {})[id] || {})[place] || {})[sector]) || [0, 0];
  return {
    n, latest: false, date: e.date, cell,
    live: (place, sector) => (place === 'GCC' && sector === 'all' ? e.live ?? null : null),
    sectors: (place) => ['all', ...Object.keys((((e.c || {}).dmarc || {})[place]) || {}).filter((x) => x !== 'all')],
  };
}

/* ---------- pictures ---------- */

// The six night photographs, one per state, in the order the scope lists the states.
const pictureOf = (k, cc) => k.pictures.find((p) => p.state === cc);

function img(k, p, size, attrs = {}) {
  const v = p.files[size];
  return h('img', { src: `/img/${v.file}`, width: v.width, height: v.height, alt: attrs.alt ?? k.P(p.alt), loading: attrs.eager ? null : 'lazy', decoding: 'async', fetchpriority: attrs.eager ? 'high' : null, class: attrs.class || null });
}

/* ---------- the top of every page ---------- */

function nameLines(k, lang = k.lang) {
  const name = lang === 'ar' ? k.B.project.name_ar : k.B.project.name_en;
  const w = name.split(' ');
  const cut = lang === 'ar' ? w.length - 2 : w.length - 1;
  return [w.slice(0, cut).join(' '), w.slice(cut).join(' ')];
}

const NAV = [['standards', 'standards/', 'nav_standards'], ['countries', 'countries/', 'nav_countries'], ['method', 'method/', 'nav_method']];

function header(k, active) {
  const [a, b] = nameLines(k);
  return h('header', { class: 'top' },
    h('div', { class: 'run' },
      h('a', { class: 'mark', href: k.href('') }, h('span', {}, a), h('span', {}, b)),
      h('nav', { class: 'tab', 'aria-label': k.t('nav_label') }, h('ul', {}, NAV.map(([id, rel, key]) => h('li', {}, h('a', { href: k.href(rel), 'aria-current': id === active ? 'page' : null }, k.t(key))))))),
    h('div', { class: 'ends' },
      h('a', { class: 'lang', href: k.href(k.route.rel || '', k.other), hreflang: k.other, lang: k.other }, k.other === 'en' ? 'English' : 'العربية'),
      h('a', { class: 'act', href: k.href('check/'), 'aria-current': active === 'check' ? 'page' : null }, k.t('nav_check'))));
}

// The masthead mosaic: six photographs and four colour tiles butted together. The wide tile moves to the next
// state with every issue, so no state leads the page every week.
function mosaic(k, issueN, { linked = true } = {}) {
  const states = Object.keys(k.B.scope.countries);
  const start = ((issueN || 1) - 1) % states.length;
  const order = states.slice(start).concat(states.slice(0, start));
  const photo = (cc, cls, size) => {
    const p = pictureOf(k, cc);
    const pic = img(k, p, size, { eager: true, alt: k.P(p.alt) });
    return h('div', { class: `cell ph ${cls}` }, linked ? h('a', { href: k.href(`countries/${cc.toLowerCase()}/`), 'aria-label': k.place(cc) }, pic) : pic);
  };
  return h('div', { class: 'mosaic' },
    photo(order[0], 'm-a', 'wide'),
    photo(order[1], 'm-b', 'tile'),
    h('div', { class: 'cell tone amber m-t', 'aria-hidden': 'true' }),
    h('div', { class: 'cell tone navy m-c', 'aria-hidden': 'true' }),
    photo(order[2], 'm-d', 'tile'),
    photo(order[3], 'm-e', 'tile'),
    h('div', { class: 'cell tone led m-f', 'aria-hidden': 'true' }),
    photo(order[4], 'm-g', 'tile'),
    photo(order[5], 'm-h', 'tile'),
    h('div', { class: 'cell tone deep m-i', 'aria-hidden': 'true' }));
}

// A single photograph across the top, for the page of one state.
function band(k, cc) {
  const p = pictureOf(k, cc);
  return h('figure', { class: 'band' }, img(k, p, 'wide', { eager: true }), h('figcaption', {}, k.P(p.caption)));
}

// A strip of the six photographs for the text pages: the same night, smaller.
function strip(k) {
  return h('div', { class: 'strip' }, Object.keys(k.B.scope.countries).map((cc) => h('a', { class: 'cell ph', href: k.href(`countries/${cc.toLowerCase()}/`), 'aria-label': k.place(cc) }, img(k, pictureOf(k, cc), 'tile', { eager: true }))));
}

// The title hung on the axis, in two lines the masthead reveals one after the other.
function title(lines, cls = '') {
  return h('h1', { class: `title ${cls}`.trim() }, lines.filter(Boolean).map((l, i) => [i ? ' ' : null, h('span', { class: 'line' }, h('span', {}, l))]));
}

function cover(k, { lines, standfirst, action, kind = 'home' }) {
  return h('div', { class: `cover ${kind}` },
    title(lines),
    h('div', { class: 'stand' },
      standfirst ? h('p', { class: 'standfirst' }, standfirst) : null,
      action || null));
}

/* ---------- figures, citations and sectors ---------- */

function slip(k, cl, ref) {
  const quote = (lang) => {
    const vars = { pct: percent(ref.v, lang), sector: k.tl(`of_${ref.sector}`, lang), place: k.tl(`in_${ref.place}`, lang) };
    const sentence = k.tl(`cite_${cl.id}`, lang, vars);
    const url = k.abs(issueRel(ref.issue, ref.place), lang) + (ref.sector === 'all' ? '' : `?s=${ref.sector}`) + `#${clauseId(cl.n, ref.sector)}`;
    const name = lang === 'ar' ? k.B.project.name_ar : k.B.project.name_en;
    const [before, after = ''] = tr(k.B.ui.cite_source, lang).split('{url}');
    const vars2 = { name, clause: cl.n, issue: ref.issue, date: dateLong(ref.date, lang) };
    return h('blockquote', { lang, dir: lang === 'ar' ? 'rtl' : 'ltr', 'data-quote': lang },
      h('p', { class: 'q' }, sentence),
      h('p', { class: 'src' }, fill(before, vars2), ltr(url), fill(after, vars2)));
  };
  const order = k.lang === 'ar' ? ['ar', 'en'] : ['en', 'ar'];
  return h('div', { class: 'slip' },
    order.map(quote),
    h('p', { class: 'copies' },
      h('button', { type: 'button', class: 'textbtn', 'data-copy': order[0], hidden: true }, k.t(order[0] === 'ar' ? 'copy_ar' : 'copy_en')),
      h('button', { type: 'button', class: 'textbtn', 'data-copy': order[1], hidden: true }, k.t(order[1] === 'ar' ? 'copy_ar' : 'copy_en')),
      h('span', { class: 'done', 'aria-live': 'polite', 'data-copied': k.t('copied') })));
}

export const clauseId = (n, sector) => (sector === 'all' ? `c${n}` : `c${n}-${sector}`);
export const issueRel = (n, place) => `issues/${n}/${place === 'GCC' ? '' : `${place.toLowerCase()}/`}`;

// One row for every figure on the site: the figure first on the edge the page reads from, what it measures beside
// it, and under that the line with its count or its links. The figure is isolated left to right inside a block that
// keeps the direction of the page, so an Arabic figure stands on the same edge as its words.
function figRow(tag, props, fig, label, detail = null) {
  // The spaces between the parts are not drawn, but a screen reader or a copy reads them, so a count never runs into
  // the figure before it.
  const spaced = (parts) => [parts].flat().filter(Boolean).flatMap((x, i) => (i ? [' ', x] : [x]));
  return h(tag, { ...props, class: `fig-row ${props.class || ''}`.trim() },
    h('span', { class: 'fig v' }, ltr(fig)), ' ',
    h('span', { class: 'fig-label what' }, label),
    detail ? [' ', h('span', { class: 'fig-detail' }, spaced(detail))] : null);
}

function clauseList(k, issue, place, sector) {
  return h('ol', { class: 'clauses' }, CLAUSES.map((cl) => {
    const f = clauseShare(issue.cell(cl.id, place, sector), cl.mode);
    const id = clauseId(cl.n, sector);
    if (!f.measured) return h('li', { id, class: 'none', 'data-rise': '' }, figRow('div', { class: 'row' }, k.t('no_data'), k.t(`row_${cl.id}`)));
    return h('li', { id, 'data-rise': '' },
      h('details', { class: 'cite' },
        figRow('summary', { class: 'row' }, k.pct(f.v), k.t(`row_${cl.id}`), [
          h('span', { class: 'basis' }, k.t('of_count', { pass: k.num(f.count), measured: k.num(f.measured) })),
          h('span', { class: 'cite-w' }, k.t('cite')),
          h('a', { class: 'std-w', href: k.href(`standards/${SLUGS[cl.id]}/`), title: k.P(k.B.checks[cl.id].short) }, k.t('clause_standard')),
        ]),
        slip(k, cl, { issue: issue.n, date: issue.date, place, sector, v: f.v })));
  }));
}

// One panel per sector, all printed; the browser shows one at a time behind a row of tabs, placed in the slot named
// by its id when there is one.
function sectorPanels(k, issue, place, body, slot = null) {
  const sectors = issue.sectors(place);
  return h('div', { class: 'sectors', 'data-tabs': '', 'data-label': k.t('sector_label'), 'data-slot': slot },
    sectors.map((s) => h('section', { class: 'panel', 'data-sector': s, 'aria-label': k.sectorName(s) },
      h('h3', { class: 'panel-h' }, k.sectorName(s)),
      body(s))));
}

// Every section of the site has the same two parts: its heading, with a note and the tabs that change it, held on
// the edge the page reads from; and its body from the axis. A picture that belongs to the section stands under the
// heading on a wide screen and after the body on a phone. On a phone everything hangs from the one margin.
function ledger(k, id, head, body, { note = null, tabs = false, after = null, aside = null, panel = true, cls = '', tag = 'section', label = null } = {}) {
  const classes = ['text-sec', 'ledger', cls, aside ? 'has-aside' : '', panel ? 'panelled' : ''].filter(Boolean).join(' ');
  return h(tag, { class: classes, id, 'aria-labelledby': label ? null : `${id}-h`, 'aria-label': label },
    h('div', { class: 'ledger-head' },
      h('h2', { id: `${id}-h`, class: 'big-h', 'data-rise': '' }, head),
      note ? h('p', { class: 'ledger-note', 'data-rise': '' }, note) : null,
      tabs ? h('div', { class: 'tab-slot', id: `${id}-tabs` }) : null,
      after ? h('p', { class: 'ledger-note', 'data-rise': '' }, after) : null),
    h('div', { class: 'ledger-body' }, body),
    aside ? h('div', { class: 'ledger-aside' }, aside) : null);
}

const allTable = (k, issue, place) => ledger(k, 'all', place === 'GCC' ? k.t('all_table_GCC') : k.t('country_table', { place: k.t(`in_${place}`) }),
  sectorPanels(k, issue, place, (sector) => standardsTable(k, issue, place, sector), 'all-tabs'), { tabs: true, after: k.t('table_how') });

/* ---------- the footer: the repository as the way to reach us ---------- */

function footer(k) {
  const repo = k.B.project.repo;
  const repoText = repo.replace(/^https:\/\/(www\.)?/, '');
  const [owner, name] = repoText.replace(/^github\.com\//, '').split('/');
  const s = k.D.summary;
  // The same two edges as the page: what the project is on the edge it reads from, where to go next from the axis,
  // then the address to write to across both, then the imprint.
  return h('footer', { class: 'foot', id: 'foot' },
    h('div', { class: 'foot-top' },
      h('div', { class: 'notes' },
        h('p', {}, k.t('foot_note')),
        h('p', {}, k.t('foot_monday')),
        s ? h('p', {}, h('a', { href: k.href(issueRel(s.issue, 'GCC')) }, k.t('hero_issue', { n: s.issue, date: k.date(s.date) }))) : null),
      h('ul', { class: 'links' },
        h('li', {}, h('a', { href: k.href('issues/') }, k.t('nav_issues'))),
        h('li', {}, h('a', { href: k.href('film/') }, k.t('film_title'))),
        h('li', {}, h('a', { href: `${k.href('method/')}#data` }, k.t('foot_data'))),
        h('li', {}, h('a', { href: `${k.href('method/')}#cli` }, k.t('foot_tools'))),
        h('li', {}, h('a', { href: repo }, k.t('foot_code'))),
        h('li', {}, h('a', { class: 'up', href: '#top' }, k.t('foot_top'))))),
    h('div', { class: 'reach' },
      h('p', { class: 'reach-note' }, k.t('foot_contact_note')),
      h('a', { class: 'reach-line', href: `${repo}/issues`, dir: 'ltr' }, h('span', {}, `github.com/${owner}/`), h('span', {}, name))),
    h('div', { class: 'meta' },
      h('p', { class: 'credits' }, k.t('foot_imprint')),
      h('p', { class: 'by' }, k.t('foot_author', { author: k.P(k.B.project.author) }))));
}

/* ---------- home ---------- */

function lede(k, issue, place) {
  const g = (id) => clauseShare(issue.cell(id, place, 'all'), CLAUSES.find((c) => c.id === id).mode);
  const live = issue.live(place, 'all');
  const vars = {
    live: k.words(live ?? 0, 'w_live_domain'),
    where: place === 'GCC' ? k.t('where_GCC') : k.t('where_state', { place: k.t(`in_${place}`) }),
    dmarc: k.pct(g('dmarc').v),
    dnssec: k.pct(g('dnssec').v),
  };
  return h('section', { class: 'lede', 'aria-labelledby': 'lede-h' },
    h('h2', { id: 'lede-h', class: 'sr' }, k.t('lede_h')),
    h('p', { class: 'statement', 'data-rise': '' }, rich(k, 'lede', vars, ['live', 'dmarc', 'dnssec'])));
}

// The six figures: the heading, the issue and the sector tabs on the edge the page reads from, the rows from the
// axis, and the photograph under the heading.
function clausesSection(k, issue, place, { photo, detail = false } = {}) {
  const head = place === 'GCC' ? k.t('clauses_h') : k.t('clauses_state_h', { place: k.t(`in_${place}`) });
  const aside = photo ? h('figure', { class: 'aside-photo', 'data-rise': '' }, img(k, photo, 'portrait'), h('figcaption', {}, detail ? k.t('photo_detail') : k.P(photo.caption))) : null;
  // Each sector closes with its own count of domains, so the line under the rows always matches them.
  const source = (s) => {
    const live = issue.live(place, s);
    return live !== null ? h('p', { class: 'source after' }, k.t('source_line', { date: k.date(issue.date), domains: k.words(live, 'w_live_domain') })) : null;
  };
  return ledger(k, 'figures', head,
    sectorPanels(k, issue, place, (s) => [clauseList(k, issue, place, s), source(s)], 'figures-tabs'),
    { note: k.t('issue_full', { n: issue.n, date: k.date(issue.date) }), tabs: true, aside, cls: 'figures' });
}

// What we measure, in the same rows as the figures: the thirteen standards with their four groups under them, the
// suffixes, then the two things the measure never does.
function measureSection(k) {
  const s = k.D.summary;
  const groups = GROUPS.map((g) => h('a', { href: `${k.href('standards/')}#${g}` }, k.P(k.B.groups[g])));
  const p = pictureOf(k, Object.keys(k.B.scope.countries)[((s ? s.issue : 1) + 2) % 6]);
  const sfx = k.B.scope.suffixes;
  return ledger(k, 'measure', k.t('measure_h'), [
    h('ul', { class: 'facts' },
      figRow('li', { 'data-rise': '' }, k.num(CHECKS.length), h('a', { href: k.href('standards/') }, k.t('measure_count')), groups),
      figRow('li', { 'data-rise': '' }, k.num(sfx.length), k.t('measure_suffixes', { states: listed(k, Object.keys(k.B.scope.countries).map((cc) => k.place(cc))), first: sfx[0].suffix, last: sfx[sfx.length - 1].suffix }))),
    h('p', { class: 'lead', 'data-rise': '' }, k.t('measure_outside')),
    h('p', { class: 'lead', 'data-rise': '' }, k.t('measure_names')),
  ], { aside: h('figure', { class: 'aside-photo', 'data-rise': '' }, img(k, p, 'tile'), h('figcaption', {}, k.P(p.caption))), panel: false, cls: 'measure' });
}

// Agreement is shown rounded down, so 99.95 reads as 99.9 and never as a perfect 100.0.
const agreeShown = (v) => (v === null ? null : Math.floor(v * 10) / 10);

function stairs(k) {
  const s = k.D.summary;
  const g = s.inventory.GCC.all;
  const q = s.quality || {};
  const agree = q.agreement && (q.agreement.same + q.agreement.differ) ? (q.agreement.same / (q.agreement.same + q.agreement.differ)) * 100 : null;
  const steps = [
    ['how_1', 'how_1_note', { names: k.words(g.discovered, 'w_name') }],
    ['how_2', 'how_2_note', { queries: k.words(q.queries || 0, 'w_query'), sites: k.words((q.web || {}).measured || 0, 'w_site') }],
    ['how_3', 'how_3_note', { agree: k.pct(agreeShown(agree)) }],
    ['how_4', 'how_4_note', {}],
  ];
  return h('section', { class: 'stairs', 'aria-labelledby': 'how-1' },
    h('ol', {}, steps.map(([line, note, vars], i) => h('li', { class: `step s${i + 1}`, 'data-rise': '' },
      i === 0 ? h('h2', { id: 'how-1', class: 'step-line' }, k.t(line)) : h('p', { class: 'step-line' }, k.t(line)),
      h('p', { class: 'step-note' }, rich(k, note, vars))))));
}

function checkForm(k, { id = 'd', value = '' } = {}) {
  return h('form', { class: 'check-form', action: k.href('check/'), method: 'get', role: 'search' },
    h('label', { class: 'field', for: `${id}-input` }, h('span', {}, k.t('domain_label')),
      h('input', { id: `${id}-input`, name: 'd', type: 'text', inputmode: 'url', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'example.com', dir: 'ltr', value: value || null, required: true })),
    h('button', { class: 'btn', type: 'submit' }, k.t('domain_button')));
}

function fieldSection(k) {
  const states = Object.keys(k.B.scope.countries);
  const n = k.D.summary ? k.D.summary.issue : 1;
  const three = [3, 4, 5].map((i) => states[(n - 1 + i) % states.length]);
  return h('section', { class: 'field-sec', 'aria-labelledby': 'field-h' },
    h('div', { class: 'three' }, three.map((cc) => img(k, pictureOf(k, cc), 'tile'))),
    h('div', { class: 'field-band' },
      h('h2', { id: 'field-h', class: 'field-say', 'data-rise': '' }, k.t('field_title')),
      h('div', { class: 'field-form', 'data-rise': '' }, checkForm(k, { id: 'home' }), h('p', { class: 'small' }, k.t('domain_privacy')))));
}

function viewHome(k) {
  const s = k.D.summary;
  const issue = s ? issueOf(k.D, s.issue) : null;
  const action = h('a', { class: 'btn', href: k.href('check/') }, k.t('hero_action'));
  const standfirst = s ? k.t('standfirst', { n: s.issue, date: k.date(s.date) }) : k.t('pending_body');
  const main = [
    h('div', { class: 'masthead' }, header(k, 'home'), mosaic(k, s ? s.issue : null)),
    cover(k, { lines: [k.t('title_1'), k.t('title_2')], standfirst, action }),
    issue ? lede(k, issue, 'GCC') : h('section', { class: 'lede' }, h('h2', {}, k.t('pending_title'))),
    issue ? clausesSection(k, issue, 'GCC', { photo: pictureOf(k, Object.keys(k.B.scope.countries)[(s.issue + 1) % 6]) }) : null,
    measureSection(k),
    s ? stairs(k) : null,
    ledger(k, 'watch', k.t('film_title'), [
      h('div', { class: 'film-box' }, filmVideo(k, k.lang)),
      h('p', { class: 'after', 'data-rise': '' }, h('a', { href: k.href('film/') }, k.t('film_more'))),
    ], { note: k.t('film_note'), panel: false, cls: 'watch' }),
    fieldSection(k),
  ];
  return { title: k.t('title_full'), description: k.P(k.B.project.about), main };
}

/* ---------- the six states ---------- */

function textPage(k, active, { lines, standfirst, action, top, side, span = false, numbers = false }, body) {
  // The parts of a section rise one after another: its heading, then its text, then what it holds. A part whose own
  // children already rise one by one is left to them.
  const rises = (n) => Boolean(n && n.kids && n.kids.some((c) => c && c.props && ('data-rise' in c.props || rises(c))));
  const mark = (n) => (n && typeof n === 'object' && n.tag && !rises(n) && !('data-still' in n.props) ? { ...n, props: { ...n.props, 'data-rise': '' } } : n);
  const rise = (n) => (n && n.tag === 'section' ? { ...n, kids: n.kids.map(mark) } : mark(n));
  return [
    h('div', { class: 'masthead slim' }, header(k, active), top || strip(k)),
    cover(k, { lines, standfirst, action, kind: 'page' }),
    h('div', { class: 'text' }, side ? h('aside', { class: numbers ? 'side numbers' : 'side', 'aria-label': side.label }, side.body) : null, h('div', { class: span ? 'body span' : 'body' }, [body].flat().map(rise))),
  ];
}

// The side of a text page: links to the sections of a long page.
function contents(k, items) {
  return { label: k.t('contents_label'), body: h('ol', { class: 'toc' }, items.map(([id, label]) => h('li', {}, h('a', { href: `#${id}` }, label)))) };
}

// A list of things in prose, joined the way the language joins them.
export function listed(k, parts) {
  if (k.lang === 'ar') return parts.join(' و');
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts.join('');
}

function sectorParts(k, inv) {
  return listed(k, Object.keys(k.B.scope.sectors).filter((s) => inv[s] && inv[s].live).map((s) => k.t(`part_${s}`, { n: k.num(inv[s].live) })));
}

function viewCountries(k) {
  const states = Object.keys(k.B.scope.countries);
  const list = h('ul', { class: 'states' }, states.map((cc) => {
    const p = pictureOf(k, cc);
    return h('li', { 'data-rise': '' }, h('a', { href: k.href(`countries/${cc.toLowerCase()}/`) },
      img(k, p, 'tile'),
      h('span', { class: 'who' }, k.place(cc)),
      h('span', { class: 'sfx' }, ltr(k.B.scope.suffixes.filter((x) => x.country === cc).map((x) => x.suffix).join(' · ')))));
  }));
  const main = [
    h('div', { class: 'masthead' }, header(k, 'countries'), mosaic(k, k.D.summary ? k.D.summary.issue : null, { linked: true })),
    cover(k, { lines: [k.t('countries_title')], standfirst: k.t('countries_intro'), kind: 'page' }),
    h('div', { class: 'text' }, h('section', { class: 'states-sec', 'aria-label': k.t('countries_title') }, h('p', { class: 'lead' }, k.t('countries_note')), list)),
  ];
  return { title: k.t('countries_title'), description: k.t('countries_intro'), main };
}

function chainList(k, cc) {
  const s = k.D.summary;
  return h('ul', { class: 'chain' }, k.B.scope.suffixes.filter((x) => x.country === cc).map((x) => {
    const on = s ? s.chain[x.suffix] : undefined;
    return h('li', { class: on === true ? 'on' : on === false ? 'off' : 'unknown' },
      h('span', { class: 'sfx' }, ltr(x.suffix)),
      h('span', {}, on === undefined ? k.t('chain_unknown') : k.t(on ? 'chain_on' : 'chain_off', { suffix: x.suffix })));
  }));
}

// A share drawn as a bar, for the eye only: the figure beside it is what is read and cited.
function bar(v) {
  const w = Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
  return h('svg', { class: 'bar', viewBox: '0 0 100 10', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
    h('rect', { class: 'track', width: '100', height: '10' }),
    h('rect', { class: 'fill', width: String(w), height: '10' }));
}

// Every standard for one place and sector, in the row of the figures: the share first, the standard beside it with
// how many passed of how many were measured under its name, and the share drawn as a bar where there is room.
function standardsTable(k, issue, place, sector) {
  return h('table', { class: 'std-table', 'data-rise': '' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', class: 'n' }, k.t('table_share')), h('th', { scope: 'col' }, k.t('table_check')), h('td', { class: 'bar-c', 'aria-hidden': 'true' }))),
    GROUPS.map((g) => h('tbody', {},
      h('tr', { class: 'group' }, h('th', { colspan: 3, scope: 'colgroup' }, k.P(k.B.groups[g]))),
      CHECKS.filter((c) => c.group === g).map((c) => {
        const [pass, measured] = issue.cell(c.id, place, sector);
        return h('tr', {},
          h('td', { class: 'n share' }, ltr(measured ? k.pct((pass / measured) * 100) : k.t('no_data'))),
          h('th', { scope: 'row' }, h('a', { href: k.href(`standards/${SLUGS[c.id]}/`) }, k.P(k.B.checks[c.id].short)),
            measured ? h('span', { class: 'basis' }, k.t('of_count', { pass: k.num(pass), measured: k.num(measured) })) : null),
          h('td', { class: 'bar-c' }, measured ? bar((pass / measured) * 100) : null));
      }))));
}

function others(k, cc, rel) {
  return ledger(k, 'others', k.t('others_label'),
    h('ul', { class: 'others-list' }, Object.keys(k.B.scope.countries).filter((x) => x !== cc).map((x) => h('li', { 'data-rise': '' }, h('a', { class: 'cell', href: k.href(rel(x)) }, img(k, pictureOf(k, x), 'tile'), h('span', {}, k.place(x)))))),
    { panel: false, cls: 'others', tag: 'nav', label: k.t('others_label') });
}

function viewCountry(k, cc) {
  const s = k.D.summary;
  const issue = s ? issueOf(k.D, s.issue) : null;
  const inv = s ? s.inventory[cc] : null;
  const standfirst = inv ? k.t('country_lede', { domains: k.words(inv.all.live, 'w_live_domain'), parts: sectorParts(k, inv) }) : k.t('pending_body');
  const main = [
    h('div', { class: 'masthead slim' }, header(k, 'countries'), band(k, cc)),
    cover(k, { lines: [k.place(cc)], standfirst, kind: 'page' }),
    issue ? lede(k, issue, cc) : null,
    issue ? clausesSection(k, issue, cc, { photo: pictureOf(k, cc), detail: true }) : null,
    issue ? allTable(k, issue, cc) : null,
    ledger(k, 'chain', k.t('chain_h'), [
      h('div', { 'data-rise': '' }, chainList(k, cc)),
      inv && inv.all.retired ? h('p', { class: 'after', 'data-rise': '' }, k.t('country_retired', { n: k.num(inv.all.retired) })) : null,
      h('p', { class: 'small soft after', 'data-rise': '' }, k.t('countries_intro')),
    ], { note: k.t('chain_note') }),
    others(k, cc, (x) => `countries/${x.toLowerCase()}/`),
  ];
  return { title: k.place(cc), description: standfirst, main };
}

/* ---------- the thirteen standards ---------- */

function viewStandards(k) {
  const s = k.D.summary;
  const body = GROUPS.map((g) => h('section', { class: 'group-sec', id: g, 'aria-labelledby': `g-${g}` },
    h('h2', { id: `g-${g}`, class: 'group-h', 'data-rise': '' }, k.P(k.B.groups[g])),
    h('ul', { class: 'std-list' }, CHECKS.filter((c) => c.group === g).map((c) => {
      const cell = s ? s.checks[c.id].GCC.all : null;
      const m = cell ? cell.pass + cell.fail : 0;
      return h('li', { 'data-rise': '' }, figRow('a', { href: k.href(`standards/${SLUGS[c.id]}/`) },
        s ? (m ? k.pct((cell.pass / m) * 100) : k.t('no_data')) : '',
        k.P(k.B.checks[c.id].title),
        k.P(k.B.checks[c.id].question)));
    }))));
  return { title: k.t('standards_title'), description: k.t('standards_intro'), main: textPage(k, 'standards', { lines: [k.t('standards_title')], standfirst: k.t('standards_intro'), span: true }, body) };
}

function markOf(id, level, B) {
  return PASS_LEVELS.has(level) ? 'pass' : NA_LEVELS.has(level) ? 'na' : (B.checks[id].levels || {})[level] || level === 'missing' ? 'fail' : 'unknown';
}
const levelText = (k, id, level) => k.P((k.B.checks[id].levels || {})[level] || k.B.common_levels[level] || { en: level, ar: level });

function viewStandard(k, id) {
  const c = k.B.checks[id];
  const s = k.D.summary;
  const cell = s ? s.checks[id].GCC.all : null;
  const m = cell ? cell.pass + cell.fail : 0;
  const v = m ? (cell.pass / m) * 100 : null;
  const levels = cell ? Object.entries(cell.levels || {}).sort((a, b) => b[1] - a[1]) : [];
  const found = levels.reduce((a, [, n]) => a + n, 0);
  const sectors = s ? ['all', ...Object.keys(k.B.scope.sectors).filter((x) => s.checks[id].GCC[x] && (s.checks[id].GCC[x].pass + s.checks[id].GCC[x].fail))] : [];
  const side = s ? {
    label: k.t('check_gulf'),
    body: [
      h('p', { class: 'side-n' }, v === null ? '' : ltr((Math.round(v * 10) / 10).toFixed(1))),
      h('p', { class: 'side-cap' }, v === null ? k.t('no_data_sentence') : k.t('check_gulf_line')),
      v === null ? null : h('p', { class: 'small soft' }, k.t('basis', { count: k.num(cell.pass), domains: k.words(m, 'w_domain') })),
      sectors.length > 1 ? h('ul', { class: 'side-sectors' }, sectors.filter((x) => x !== 'all').map((x) => {
        const cx = s.checks[id].GCC[x];
        return figRow('li', {}, k.pct((cx.pass / (cx.pass + cx.fail)) * 100), k.sectorName(x));
      })) : null,
      levels.length ? h('section', { class: 'found-sec', 'aria-labelledby': 'found-h' }, h('h2', { id: 'found-h' }, k.t('check_found')),
        h('table', { class: 'found', 'data-rise': '' }, h('tbody', {}, levels.map(([lvl, n]) => h('tr', { class: markOf(id, lvl, k.B) },
          h('td', { class: 'n' }, ltr(k.num(n))),
          h('th', { scope: 'row' }, h('span', { class: 'lv' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), levelText(k, id, lvl))),
          h('td', { class: 'bar-c' }, bar((n / found) * 100))))))) : null,
      h('p', { class: 'small soft source' }, h('a', { href: k.href(issueRel(s.issue, 'GCC')) }, k.t('issue_full', { n: s.issue, date: k.date(s.date) }))),
    ],
  } : null;
  const body = [
    h('p', { class: 'lead question' }, k.P(c.question)),
    h('section', { 'aria-labelledby': 'why-h' }, h('h2', { id: 'why-h' }, k.t('check_why')), h('p', {}, k.P(c.why))),
    h('section', { 'aria-labelledby': 'pass-h' }, h('h2', { id: 'pass-h' }, k.t('check_pass')), h('p', {}, k.P(c.pass))),
    h('section', { 'aria-labelledby': 'fix-h' }, h('h2', { id: 'fix-h' }, k.t('check_fix')), h('ol', { class: 'steps' }, c.fix.map((f) => h('li', {}, k.P(f))))),
    c.example ? h('section', { 'aria-labelledby': 'ex-h' }, h('h2', { id: 'ex-h' }, k.t('check_example')), h('pre', { dir: 'ltr' }, h('code', {}, c.example))) : null,
    h('section', { 'aria-labelledby': 'refs-h' }, h('h2', { id: 'refs-h' }, k.t('check_refs')), h('ul', { class: 'refs' }, c.refs.map((r) => h('li', {}, h('a', { href: r.url, rel: 'noopener' }, r.label))))),
    h('p', { class: 'back' }, h('a', { href: k.href('standards/') }, k.t('standards_back'))),
  ];
  const t = k.P(c.title);
  return { title: t, description: k.P(c.question), main: textPage(k, 'standards', { lines: [k.P(c.short)], standfirst: t, side, numbers: true }, body) };
}

/* ---------- the live check ---------- */

function viewCheck(k) {
  const repo = (k.B.project.repo.match(/github\.com\/([^/]+\/[^/#?]+)/) || [])[1];
  const body = [
    h('section', { class: 'live', 'aria-labelledby': 'live-h' },
      h('h2', { id: 'live-h', class: 'sr' }, k.t('domain_title')),
      checkForm(k, { id: 'check' }),
      h('p', { class: 'status', role: 'status', 'aria-live': 'polite', id: 'status' }),
      h('p', { class: 'small' }, k.t('domain_privacy')),
      h('div', { class: 'result', id: 'result' })),
    h('section', { id: 'cli', 'aria-labelledby': 'cli-h' }, h('h2', { id: 'cli-h' }, k.t('m_cli_h')), h('p', {}, k.t('domain_cli')), h('pre', { dir: 'ltr' }, h('code', {}, `npx -y github:${repo} check example.com`))),
  ];
  return { title: k.t('domain_title'), description: k.t('domain_intro'), main: textPage(k, 'check', { lines: [k.t('domain_title')], standfirst: k.t('domain_intro') }, body) };
}

// The answer for one domain, rendered in the browser: each standard, what was found, and the Gulf beside it.
export function checkResult(k, domain, results) {
  const measured = Object.values(results).filter((x) => x.state === 'pass' || x.state === 'fail');
  const passed = measured.filter((x) => x.state === 'pass').length;
  const s = k.D.summary;
  const gulf = (id) => { const c = s ? s.checks[id].GCC.all : null; const m = c ? c.pass + c.fail : 0; return m ? k.t('result_gulf', { pct: k.pct((c.pass / m) * 100) }) : ''; };
  return frag(
    h('h2', { class: 'res-h' }, ltr(domain)),
    h('p', { class: 'lead' }, k.t('domain_summary', { pass: k.num(passed), checks: k.words(measured.length, 'w_check') })),
    GROUPS.map((g) => h('section', { class: 'res-group' },
      h('h3', {}, k.P(k.B.groups[g])),
      h('ul', { class: 'res' }, CHECKS.filter((c) => c.group === g).map((c) => {
        const r = results[c.id];
        return h('li', { class: r.state },
          h('span', { class: 'dot', 'aria-hidden': 'true' }),
          h('a', { class: 'what', href: k.href(`standards/${SLUGS[c.id]}/`) }, k.P(k.B.checks[c.id].short)),
          h('span', { class: 'lvl' }, `${k.t(`state_${r.state}`)} · ${levelText(k, c.id, r.level)}`),
          r.state === 'pass' || r.state === 'fail' ? h('span', { class: 'gulf' }, gulf(c.id)) : null);
      })))));
}

/* ---------- method and data ---------- */

function viewMethod(k) {
  const s = k.D.summary;
  const paras = (key) => k.B.ui[key].map((x) => h('p', {}, tr(x, k.lang)));
  const sec = (id, key, ...kids) => h('section', { id, 'aria-labelledby': `${id}-h` }, h('h2', { id: `${id}-h` }, k.t(key)), ...kids);
  const repo = (k.B.project.repo.match(/github\.com\/([^/]+\/[^/#?]+)/) || [])[1];
  // The suffixes of each state on one line, each marked by whether DNSSEC can reach the domains under it.
  const legend = s ? h('p', { class: 'small soft legend' }, h('span', { class: 'pass' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), ' ', k.t('chain_yes')), h('span', { class: 'fail' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), ' ', k.t('chain_no'))) : null;
  const suffixes = h('ul', { class: 'sfx-groups' }, Object.keys(k.B.scope.countries).map((cc) => h('li', {},
    h('span', { class: 'who' }, k.place(cc)),
    h('ul', { class: 'sfx' }, k.B.scope.suffixes.filter((x) => x.country === cc).map((x) => {
      const on = s ? s.chain[x.suffix] : undefined;
      return h('li', { class: on === true ? 'pass' : on === false ? 'fail' : 'unknown' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('bdi', {}, x.suffix), h('span', { class: 'soft' }, k.P(k.B.scope.sectors[x.sector])), h('span', { class: 'sr' }, on === undefined ? '' : k.t(on ? 'chain_yes' : 'chain_no')));
    })))));
  const q = s ? s.quality : null;
  const agree = q && (q.agreement.same + q.agreement.differ) ? (q.agreement.same / (q.agreement.same + q.agreement.differ)) * 100 : null;
  const dl = [['dl_latest_csv', '/data/open/latest.csv'], ['dl_history_csv', '/data/open/history.csv'], ['dl_summary_json', '/data/summary.json'], ['dl_history_json', '/data/history.json']];
  const mcp = JSON.stringify({ mcpServers: { [k.B.project.slug]: { command: 'npx', args: ['-y', `github:${repo}`, 'mcp'] } } }, null, 2);
  const body = [
    sec('scope', 'm_scope_h', paras('m_scope'), h('h3', {}, k.t('m_suffixes')), legend, suffixes),
    sec('sources', 'm_sources_h', paras('m_sources')),
    sec('how', 'm_how_h', paras('m_how')),
    sec('publish', 'm_publish_h', paras('m_publish')),
    sec('limits', 'm_limits_h', paras('m_limits')),
    q ? sec('quality', 'm_quality_h',
      h('p', {}, k.t('q_agree', { pct: k.pct(agreeShown(agree)) })),
      h('p', {}, k.t('q_unreachable', { n: k.num(q.web.unreachable) })),
      q.seconds ? h('p', {}, k.t('q_runtime', { minutes: k.words(Math.max(1, Math.round(q.seconds / 60)), 'w_minute'), queries: k.words(q.queries || 0, 'w_query') })) : null) : null,
    sec('data', 'm_data_h', paras('m_data'), s ? h('ul', { class: 'downloads' }, dl.map(([key, url]) => h('li', {}, h('a', { href: url, download: '' }, k.t(key))))) : null),
    sec('cite', 'm_cite_h', paras('m_cite'), s ? citeBlock(k, issueOf(k.D, s.issue)) : null),
    sec('cli', 'm_cli_h', paras('m_cli'), h('pre', { dir: 'ltr' }, h('code', {}, `npx -y github:${repo} check example.com\nnpx -y github:${repo} check example.com --lang ar --json`)), h('pre', { dir: 'ltr' }, h('code', {}, mcp))),
    sec('code', 'm_code_h', paras('m_code'), h('p', {}, h('a', { href: k.B.project.repo }, ltr(k.B.project.repo.replace(/^https:\/\//, ''))))),
    sec('credits', 'm_credits_h', paras('m_credits'), h('ul', { class: 'credits-list' }, k.pictures.map((p) => h('li', {}, k.P(p.credit), ' ', h('a', { href: `https://commons.wikimedia.org/w/index.php?curid=${p.commons}` }, k.t('credit_source')))))),
  ];
  const toc = [['scope', 'm_scope_h'], ['sources', 'm_sources_h'], ['how', 'm_how_h'], ['publish', 'm_publish_h'], ['limits', 'm_limits_h'], q ? ['quality', 'm_quality_h'] : null, ['data', 'm_data_h'], ['cite', 'm_cite_h'], ['cli', 'm_cli_h'], ['code', 'm_code_h'], ['credits', 'm_credits_h']].filter(Boolean).map(([id, key]) => [id, k.t(key)]);
  return { title: k.t('method_title'), description: tr(k.B.ui.m_scope[0], k.lang), main: textPage(k, 'method', { lines: [k.t('method_title')], standfirst: k.t('method_intro'), side: contents(k, toc) }, body) };
}

/* ---------- issues ---------- */

// How to cite one issue: the reference in Arabic and in English, and a BibTeX entry.
export function citation(k, issue, lang) {
  const year = issue.date.slice(0, 4);
  const author = tr(k.B.project.author, lang);
  const name = lang === 'ar' ? k.B.project.name_ar : k.B.project.name_en;
  return k.tl('cite_issue', lang, { author, year, name, n: issue.n, date: dateLong(issue.date, lang), url: k.abs(issueRel(issue.n, 'GCC'), lang) });
}

export function bibtex(k, issue) {
  const [last, ...first] = k.B.project.author.en.split(' ').reverse();
  return [
    `@misc{${k.B.project.slug}-issue-${issue.n},`,
    `  author = {${last}, ${first.reverse().join(' ')}},`,
    `  title = {${k.B.project.name_en}, issue ${issue.n}},`,
    `  year = {${issue.date.slice(0, 4)}},`,
    `  date = {${issue.date}},`,
    `  url = {${k.abs(issueRel(issue.n, 'GCC'), 'en')}},`,
    `  note = {${tr(k.B.project.about, 'en').replace(/\.$/, '')}}`,
    '}',
  ].join('\n');
}

function citeBlock(k, issue) {
  const order = k.lang === 'ar' ? ['ar', 'en'] : ['en', 'ar'];
  const quote = (lang) => {
    const url = k.abs(issueRel(issue.n, 'GCC'), lang);
    const [before, after = ''] = citation(k, issue, lang).split(url);
    return h('blockquote', { lang, dir: lang === 'ar' ? 'rtl' : 'ltr', 'data-quote': lang }, h('p', {}, before, ltr(url), after));
  };
  return h('div', { class: 'cite-issue' },
    order.map(quote),
    h('pre', { dir: 'ltr', 'data-quote': 'bib' }, h('code', {}, bibtex(k, issue))),
    h('p', { class: 'copies' },
      order.map((lang) => h('button', { type: 'button', class: 'textbtn', 'data-copy': lang, hidden: true }, k.t(lang === 'ar' ? 'copy_ar' : 'copy_en'))),
      h('button', { type: 'button', class: 'textbtn', 'data-copy': 'bib', hidden: true }, k.t('copy_bib')),
      h('span', { class: 'done', 'aria-live': 'polite', 'data-copied': k.t('copied') })));
}

function viewIssues(k) {
  const n = issueCount(k.D);
  const rows = [];
  for (let i = n; i >= 1; i -= 1) {
    const is = issueOf(k.D, i);
    const live = is.live('GCC', 'all');
    rows.push(h('li', { 'data-rise': '' }, h('a', { href: k.href(issueRel(i, 'GCC')) },
      h('span', { class: 'n' }, k.t('issue', { n: i })),
      i === n ? h('span', { class: 'latest' }, k.t('latest_word')) : null,
      h('span', { class: 'd' }, k.date(is.date), live !== null ? [' · ', h('span', { class: 'l' }, k.words(live, 'w_live_domain'))] : null))));
  }
  const body = [h('ol', { class: 'issues' }, rows), h('p', {}, h('a', { href: `${k.B.project.repo}/releases` }, k.t('issues_releases')))];
  return { title: k.t('issues_title'), description: k.t('issues_intro'), main: textPage(k, 'issues', { lines: [k.t('issues_title')], standfirst: k.t('issues_intro') }, body) };
}

function viewIssue(k, n, place) {
  const issue = issueOf(k.D, n);
  const latest = issueCount(k.D);
  const states = Object.keys(k.B.scope.countries);
  const places = h('nav', { class: 'places', 'aria-label': k.t('issue_places') }, h('ul', {}, ['GCC', ...states].map((p) => h('li', {}, h('a', { href: k.href(issueRel(n, p)), 'aria-current': p === place ? 'page' : null }, k.place(p))))));
  const live = issue.live(place, 'all');
  const standfirst = place === 'GCC' && live !== null ? k.t('issue_standfirst', { date: k.date(issue.date), live: k.words(live, 'w_live_domain') }) : k.t('issue_standfirst_state', { date: k.date(issue.date), place: k.t(`in_${place}`) });
  const body = [
    n < latest ? h('p', { class: 'past', role: 'note', 'data-rise': '' }, k.t('stats_past', { n, date: k.date(issue.date), latest }), ' ', h('a', { href: k.href(issueRel(latest, place)) }, k.t('stats_latest'))) : null,
    { ...places, props: { ...places.props, 'data-rise': '' } },
  ];
  const lines = [k.t('issue', { n }), place === 'GCC' ? null : k.place(place)];
  const main = [
    h('div', { class: 'masthead slim' }, header(k, 'issues'), place === 'GCC' ? strip(k) : band(k, place)),
    cover(k, { lines, standfirst, kind: 'page' }),
    h('div', { class: 'text' }, body),
    clausesSection(k, issue, place, { photo: pictureOf(k, place === 'GCC' ? states[(n + 1) % states.length] : place), detail: place !== 'GCC' }),
    allTable(k, issue, place),
    ledger(k, 'cite', k.t('cite_issue_h'), [
      h('div', { 'data-rise': '' }, citeBlock(k, issue)),
      h('ul', { class: 'downloads after', 'data-rise': '' },
        h('li', {}, h('a', { href: `${k.B.project.repo}/releases/tag/issue-${n}` }, k.t('issue_release', { n }))),
        issue.latest ? h('li', {}, h('a', { href: '/data/open/latest.csv', download: '' }, k.t('dl_latest_csv'))) : null,
        h('li', {}, h('a', { href: '/data/open/history.csv', download: '' }, k.t('dl_history_csv')))),
    ], { panel: false, cls: 'cite-sec' }),
    place === 'GCC' ? null : others(k, place, (x) => issueRel(n, x)),
  ];
  const title = place === 'GCC' ? k.t('issue_full', { n, date: k.date(issue.date) }) : `${k.t('issue', { n })} · ${k.place(place)}`;
  return { title, description: standfirst, main };
}

/* ---------- the launch film ---------- */

// The two films with their captions, the one in the page's language first, then how the film was made and the
// files to download. The films are served from the site itself.
// The launch film: when it was finished and how long each language runs, for the page and for search engines.
export const FILM = { date: '2026-10-22', seconds: { ar: 62, en: 59 } };
export const filmFile = (lang, ext) => `/film/gbaseline-film-${lang}.${ext}`;

// The film in one language, with its captions, its poster and a line for a browser that plays no video.
function filmVideo(k, lang) {
  return h('video', { class: 'film-v', controls: true, playsinline: true, preload: 'metadata', poster: filmFile(lang, 'jpg'), width: 1920, height: 1080, lang },
    h('source', { src: filmFile(lang, 'mp4'), type: 'video/mp4' }),
    h('track', { kind: 'captions', srclang: lang, src: filmFile(lang, 'vtt'), label: lang === 'ar' ? 'العربية' : 'English', default: lang === k.lang }),
    k.t('film_fallback'));
}

function viewFilm(k) {
  const order = k.lang === 'ar' ? ['ar', 'en'] : ['en', 'ar'];
  const film = (lang) => {
    const base = `/film/gbaseline-film-${lang}`;
    return h('section', { class: 'film', 'aria-labelledby': `film-${lang}-h` },
      h('h2', { id: `film-${lang}-h` }, k.t(lang === 'ar' ? 'film_ar' : 'film_en')),
      h('div', { class: 'film-box', 'data-still': '' }, filmVideo(k, lang)),
      h('ul', { class: 'downloads' },
        h('li', {}, h('a', { href: `${base}.mp4`, download: '' }, k.t('film_dl_mp4'))),
        h('li', {}, h('a', { href: `${base}.vtt`, download: '' }, k.t('film_dl_vtt'))),
        h('li', {}, h('a', { href: `${base}.srt`, download: '' }, k.t('film_dl_srt')))));
  };
  const body = [
    ...order.map(film),
    h('section', { 'aria-labelledby': 'film-about-h' }, h('h2', { id: 'film-about-h' }, k.t('film_about_h')), k.B.ui.film_about.map((x) => h('p', {}, tr(x, k.lang)))),
  ];
  return { title: k.t('film_title'), description: k.t('film_intro'), main: textPage(k, null, { lines: [k.t('film_title')], standfirst: k.t('film_intro'), span: true }, body) };
}

/* ---------- not found ---------- */

function viewNotFound(k) {
  const body = [h('p', { class: 'lead' }, k.t('nf_body')), h('ul', { class: 'downloads' }, h('li', {}, h('a', { href: k.href('') }, k.t('nf_home'))), h('li', {}, h('a', { href: k.href('issues/') }, k.t('issues_title'))))];
  return { title: k.t('nf_title'), description: k.t('nf_body'), main: textPage(k, null, { lines: [k.t('nf_title')] }, body) };
}

/* ---------- a whole page ---------- */

export function page(ctx) {
  const k = kit(ctx);
  const r = ctx.route;
  let v;
  if (r.page === 'home') v = viewHome(k);
  else if (r.page === 'countries') v = viewCountries(k);
  else if (r.page === 'country') v = viewCountry(k, r.cc);
  else if (r.page === 'standards') v = viewStandards(k);
  else if (r.page === 'standard') v = viewStandard(k, r.id);
  else if (r.page === 'check') v = viewCheck(k);
  else if (r.page === 'method') v = viewMethod(k);
  else if (r.page === 'issues') v = viewIssues(k);
  else if (r.page === 'issue') v = viewIssue(k, r.n, r.place);
  else if (r.page === 'film') v = viewFilm(k);
  else v = viewNotFound(k);
  const body = h('div', { class: `site p-${r.page}`, id: 'top' },
    h('a', { class: 'skip', href: '#main' }, k.t('skip')),
    h('main', { id: 'main', tabindex: '-1' }, v.main),
    footer(k));
  return { ...v, body, k };
}
