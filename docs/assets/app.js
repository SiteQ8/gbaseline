// The site, printed as stationery: this week's card beside the photograph of the Gulf at night, the ledger of
// Gulf figures, the citation slips, the itinerary of a run, the reply card for the live check and the back of the
// card. Each state has its own page; no view sets states side by side. Built from the bundle and the published
// data with DOM nodes only: no markup strings, no inline styles.
import { createResolver, cleanDomain } from './engine/dns.js';
import { CHECKS, GROUPS, PASS_LEVELS, NA_LEVELS, observeDns, evaluate, suffixChain } from './engine/checks.js';
import { CLAUSES, clauseShare } from './engine/clauses.js';
import { tr, fill, number, percent, counted, share, dateLong } from './engine/i18n.js';

const KEY = 'baseline:v1';
const SVGNS = 'http://www.w3.org/2000/svg';
const RUN_TIME = '02:17';
const $ = (id) => document.getElementById(id);
let B;
let D = { summary: null, history: [] };
let S;
let observer = null;

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
const tl = (key, lang, vars) => fill(tr(B.ui[key], lang), vars);
const P = (pair) => tr(pair, S.lang);
const words = (n, key) => counted(n, B.ui[key], S.lang);
// The counted noun without its number, for a figure printed large beside it: 1234 then "نطاقاً حياً".
const noun = (n, key) => words(n, key).replace(/^[\d,]+\s+/, '');
const num = (n) => number(n, S.lang);
const pctText = (v) => (v === null ? t('no_data') : percent(v, S.lang));
const COUNTRIES = () => Object.keys(B.scope.countries);
const SECTORS = () => ['all', ...Object.keys(B.scope.sectors)];
const placeName = (p) => (p === 'GCC' ? t('place_GCC') : P(B.scope.countries[p]));
const sectorName = (s) => (s === 'all' ? t('sector_all') : P(B.scope.sectors[s]));
const levelText = (id, level) => P((B.checks[id].levels || {})[level] || B.common_levels[level] || { en: level, ar: level });
const projectName = (lang = S.lang) => tr({ en: B.project.name_en, ar: B.project.name_ar }, lang);
const repoPath = () => { const m = String(B.project.repo || '').match(/github\.com\/([^/]+\/[^/#?]+)/); return m ? m[1] : 'SiteQ8/gbaseline'; };
const ltr = (text) => h('bdi', { dir: 'ltr' }, text);
const setVar = (node, name, value) => { node.style.setProperty(name, String(value)); return node; };

// Marks: a filled dot passes, a cross fails, a ring does not apply, a broken ring was not measured.
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

// A share printed as a ledger figure, split on the decimal point so every row aligns on it.
function fig(v) {
  if (v === null) return h('span', { class: 'fig none' }, t('no_data'));
  const [whole, frac] = (Math.round(v * 10) / 10).toFixed(1).split('.');
  return h('span', { class: 'fig', dir: 'ltr' }, h('span', { class: 'whole' }, whole), h('span', { class: 'frac' }, `.${frac}`));
}

function load() {
  let s = { lang: 'ar', sector: 'all' };
  try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') s = { ...s, ...saved }; } catch { /* storage unavailable */ }
  const q = new URLSearchParams(location.search);
  if (q.has('lang')) s.lang = q.get('lang');
  s.lang = s.lang === 'en' ? 'en' : 'ar';
  if (!SECTORS().includes(s.sector)) s.sector = 'all';
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ lang: S.lang, sector: S.sector })); } catch { /* storage unavailable */ } }

function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { view: parts[0] || 'overview', arg: parts[1] ? decodeURIComponent(parts[1]) : null, query: new URLSearchParams(query || '') };
}

async function getJson(url) {
  try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; }
}

/* ---------- pieces of stationery ---------- */

// The measuring scale across the top of every card: a major tick every fourth, drawn in on arrival.
function scale() {
  const row = h('div', { class: 'scale', 'aria-hidden': 'true' });
  for (let i = 0; i < 41; i += 1) row.append(setVar(h('i'), '--i', i));
  return row;
}

function night(focus, caption = true) {
  const img = h('img', {
    src: 'img/gulf-night-1600.jpg', srcset: 'img/gulf-night-1600.jpg 1600w, img/gulf-night-2400.jpg 2400w',
    sizes: '(max-width: 900px) 100vw, 92vw', width: 2400, height: 1600, alt: t('photo_alt'), fetchpriority: 'high',
  });
  if (focus) setVar(img, '--focus', focus);
  return h('figure', { class: 'night' }, img, caption ? h('figcaption', {}, t('photo_caption')) : null);
}

function wordmark() {
  return h('a', { class: 'wordmark', href: '#/' }, h('span', { class: 'w1' }, projectName()));
}

function langButton(cls) {
  return h('button', { class: cls, id: 'lang', type: 'button', lang: S.lang === 'ar' ? 'en' : 'ar', onclick: () => setLang(S.lang === 'ar' ? 'en' : 'ar') }, S.lang === 'ar' ? 'English' : 'العربية');
}

const NAV = [['overview', '#/', 'nav_overview'], ['countries', '#/countries', 'nav_countries'], ['checks', '#/checks', 'nav_checks'], ['domain', '#/domain', 'nav_domain'], ['method', '#/method', 'nav_method']];

function cardHead(active) {
  return h('header', { class: 'card-head' },
    wordmark(),
    h('nav', { id: 'sections', 'aria-label': t('nav_label') }, h('ul', {}, NAV.map(([id, href, key]) => h('li', {}, h('a', { href, 'aria-current': id === active ? 'page' : null }, t(key)))))),
    langButton('lang'));
}

// The back of the card: the footer, laid out as the back of a postcard.
function back() {
  const s = D.summary;
  const scallops = h('div', { class: 'scallops', 'aria-hidden': 'true' });
  for (let i = 0; i < 24; i += 1) scallops.append(h('i'));
  const repo = B.project.repo || `https://github.com/${repoPath()}`;
  const imprint = [s ? t('hero_issue', { n: s.issue, date: dateLong(s.date, S.lang) }) : null, t('foot_imprint')].filter(Boolean).join(' · ');
  return h('footer', { class: 'back', id: 'back' },
    h('div', { class: 'postcard' },
      scallops,
      h('div', { class: 'pc-msg', 'data-rise': '' },
        h('p', { class: 'sign' }, t('foot_sign')),
        h('p', {}, t('foot_note')),
        h('p', {}, t('foot_author', { author: '' }), h('a', { class: 'link', href: B.project.author_url }, P(B.project.author)))),
      h('div', { class: 'pc-addr', 'data-rise': '' },
        h('figure', { class: 'stamp' }, h('img', { src: 'img/gulf-night-stamp.jpg', width: 264, height: 352, alt: t('stamp_alt'), loading: 'lazy' })),
        h('ul', { class: 'addr' },
          h('li', {}, h('a', { class: 'link', href: repo }, t('foot_code'))),
          h('li', {}, h('a', { class: 'link', href: '#/method?to=data' }, t('foot_data'))),
          h('li', {}, h('a', { class: 'link', href: '#/method?to=cli' }, t('foot_tools'))),
          h('li', {}, h('a', { class: 'link', href: `${repo}/issues/new` }, t('foot_report'))))),
      h('p', { class: 'imprint' }, imprint)));
}

/* ---------- citations ---------- */

// The address of one clause in one issue, scope and language. It never ends on a slash, so it reads whole in Arabic.
function clauseUrl(ref, lang) {
  const base = B.project.domain ? `https://${B.project.domain}/` : location.origin + location.pathname;
  const q = new URLSearchParams();
  if (ref.sector !== 'all') q.set('s', ref.sector);
  q.set('i', String(ref.issue));
  q.set('c', String(ref.n));
  const path = ref.place === 'GCC' ? '' : `countries/${ref.place}`;
  return `${base}?lang=${lang}#/${path}?${q}`;
}

function citeSentence(cl, ref, lang) {
  const vars = { pct: ref.v === null ? tl('no_data', lang) : percent(ref.v, lang), sector: tl(`of_${ref.sector}`, lang), place: tl(`in_${ref.place}`, lang) };
  return tl(`cite_${cl.id}`, lang, vars);
}

function citation(cl, ref, lang) {
  const sentence = citeSentence(cl, ref, lang);
  const url = clauseUrl(ref, lang);
  const [before, after = ''] = tr(B.ui.cite_source, lang).split('{url}');
  const vars = { name: projectName(lang) || tr(B.ui.tagline, lang).replace(/\.$/, ''), clause: ref.n, issue: ref.issue, date: dateLong(ref.date, lang) };
  return { sentence, source: [fill(before, vars), url, fill(after, vars)], text: `${sentence}\n${fill(before, vars)}${url}${fill(after, vars)}` };
}

async function copyText(text, node, done) {
  try { await navigator.clipboard.writeText(text); } catch {
    const sel = getSelection(); const range = document.createRange(); range.selectNodeContents(node); sel.removeAllRanges(); sel.addRange(range);
  }
  done.textContent = t('copied');
  setTimeout(() => { done.textContent = ''; }, 1800);
}

// Two buttons: copy in the page's language, and in the other one.
function copyButtons(cl, ref, node) {
  const done = h('span', { class: 'done', 'aria-live': 'polite' });
  const other = S.lang === 'ar' ? 'en' : 'ar';
  const button = (lang, label, aria) => h('button', { class: 'textbtn', type: 'button', lang: lang === S.lang ? null : lang, 'aria-label': aria, onclick: () => copyText(citation(cl, ref, lang).text, node, done) }, label);
  return h('div', { class: 'slip-actions' },
    button(S.lang, t('copy'), t(S.lang === 'ar' ? 'copy_ar' : 'copy_en')),
    button(other, other === 'en' ? 'English' : 'العربية', t(other === 'ar' ? 'copy_ar' : 'copy_en')),
    done);
}

// The slip that opens under a ledger row: the sentence and its source in both languages.
function inlineSlip(cl, ref) {
  const slip = h('div', { class: 'slip-inline', hidden: true });
  const order = S.lang === 'ar' ? ['ar', 'en'] : ['en', 'ar'];
  const quotes = order.map((lang) => {
    const c = citation(cl, ref, lang);
    return h('blockquote', { lang, dir: lang === 'ar' ? 'rtl' : 'ltr' },
      h('span', { class: 'q' }, c.sentence),
      h('span', { class: 'src' }, c.source[0], h('bdi', { dir: 'ltr' }, c.source[1]), c.source[2]));
  });
  slip.append(h('h3', {}, t('cite_title')), ...quotes, copyButtons(cl, ref, quotes[0]));
  return slip;
}

/* ---------- the ledger: one place's figures, aligned on the decimal point ---------- */

// Which issue a view shows: the latest, or an earlier one a citation points to (kept whole in the weekly series).
function issueFor(r) {
  const latest = D.summary.issue;
  const asked = Number(r.query.get('i'));
  const n = Number.isInteger(asked) && asked >= 1 && asked < latest && D.history[asked - 1] ? asked : latest;
  const entry = (k) => D.history[k - 1] || null;
  const cell = (k, id, place, sector) => {
    if (k === latest) return D.summary.checks[id][place][sector];
    const e = entry(k);
    return e ? ((e.c[id] || {})[place] || {})[sector] || [0, 0] : null;
  };
  return { n, latest, date: n === latest ? D.summary.date : entry(n).date, past: n !== latest, cell: (id, place, sector) => cell(n, id, place, sector), prev: n > 1 && entry(n - 1) ? (id, place, sector) => cell(n - 1, id, place, sector) : null };
}

function ledgerSection(r, place, base) {
  const issue = issueFor(r);
  const sector = SECTORS().includes(r.query.get('s')) ? r.query.get('s') : (place === 'GCC' ? S.sector : 'all');
  const go = (v) => {
    if (place === 'GCC') { S.sector = v; save(); }
    const q = new URLSearchParams(r.query);
    q.set('s', v);
    q.delete('c');
    history.replaceState(null, '', `${location.pathname}${location.search}${base}?${q}`);
    const next = ledgerSection(route(), place, base);
    next.classList.add('in');
    section.replaceWith(next);
    const again = next.querySelector(`input[value='${v}']`);
    if (again) again.focus();
  };
  const tabs = h('fieldset', { class: 'tabs' },
    h('legend', {}, t('sector_label')),
    SECTORS().map((o) => h('label', {}, h('input', { type: 'radio', name: `sector-${place}`, value: o, checked: o === sector, onchange: () => go(o) }), h('span', {}, sectorName(o)))));
  const latestHref = () => { const q = new URLSearchParams(r.query); q.delete('i'); q.delete('c'); const qs = q.toString(); return `${base}${qs ? `?${qs}` : ''}`; };
  const past = issue.past ? h('div', { class: 'past', role: 'note' },
    h('p', {}, t('stats_past', { n: issue.n, date: dateLong(issue.date, S.lang), latest: issue.latest })),
    h('a', { class: 'link small', href: latestHref() }, t('stats_latest'))) : null;
  const heading = place === 'GCC' ? t('stats_gulf') : t('stats_country', { place: t(`in_${place}`) });
  const rows = CLAUSES.map((cl, i) => {
    const f = clauseShare(issue.cell(cl.id, place, sector), cl.mode);
    const ref = { n: cl.n, place, sector, issue: issue.n, date: issue.date, v: f.v };
    const prev = issue.prev ? clauseShare(issue.prev(cl.id, place, sector), cl.mode) : null;
    const slip = f.measured ? inlineSlip(cl, ref) : null;
    const cite = slip ? h('button', { class: 'textbtn cite', type: 'button', 'aria-expanded': 'false', onclick: (e) => {
      const open = slip.hidden;
      slip.hidden = !open;
      e.currentTarget.setAttribute('aria-expanded', String(open));
    } }, t('cite')) : null;
    return setVar(h('li', { class: 'row', id: `c${cl.n}`, 'data-rise': '' },
      fig(f.v),
      h('div', { class: 'cap' },
        h('p', { class: 'what' }, f.measured ? t(`fig_${cl.id}`) : t('no_data_sentence')),
        h('p', { class: 'basis' },
          f.measured ? h('span', {}, t('basis', { count: num(f.count), domains: words(f.measured, 'w_domain') })) : null,
          prev && prev.v !== null && f.measured ? h('span', {}, t('prev_issue', { pct: percent(prev.v, S.lang) })) : null,
          cite)),
      slip), '--i', i);
  });
  const live = issue.past ? null : D.summary.inventory[place][sector].live;
  const section = h('section', { class: 'ledger band', id: 'ledger', 'aria-labelledby': `ledger-h-${place}`, 'data-section': '' },
    h('div', { class: 'grid ledger-top' },
      h('div', { class: 'ledger-head' },
        h('h2', { id: `ledger-h-${place}`, 'data-rise': '' }, h('span', { class: 'soft' }, heading), h('span', {}, t('stats_week'))),
        h('p', { 'data-rise': '' }, t('stats_scope', { sector: t(`of_${sector}`), place: t(`in_${place}`), n: issue.n, date: dateLong(issue.date, S.lang) })),
        tabs,
        past),
      h('div', { class: 'ledger-body' },
        h('ol', { class: 'figures' }, rows),
        live !== null ? h('p', { class: 'source' }, t('source_line', { date: dateLong(issue.date, S.lang), domains: words(live, 'w_live_domain') })) : null)),
    issue.past || D.history.length < 2 ? null : h('div', { class: 'grid' }, weekByWeek(place, sector)));
  return section;
}

// The weekly series of the clauses, one row per clause and one column per issue, the latest first.
function weekByWeek(place, sector) {
  if (D.history.length < 2) return null;
  const weeks = D.history.map((wk, i) => ({ n: i + 1, date: wk.date, c: wk.c || {} })).reverse().slice(0, 4);
  const shareOf = (wk, cl) => clauseShare((((wk.c[cl.id] || {})[place] || {})[sector]) || [0, 0], cl.mode).v;
  const table = h('table', { class: 'wk', 'aria-label': t('trend_title') },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('table_check')),
      weeks.map((wk) => h('th', { scope: 'col', class: 'n' }, h('span', {}, t('issue', { n: wk.n })), h('span', { class: 'wk-date' }, dateLong(wk.date, S.lang)))))),
    h('tbody', {}, CLAUSES.map((cl) => h('tr', {},
      h('th', { scope: 'row' }, t(`row_${cl.id}`)),
      weeks.map((wk) => { const v = shareOf(wk, cl); return h('td', { class: 'n' }, v === null ? t('no_data') : percent(v, S.lang)); })))));
  return [
    h('div', { class: 'trend-head', 'data-rise': '' }, h('h3', { class: 'lead' }, t('trend_title')), h('p', { class: 'source' }, t('trend_source', { sector: t(`of_${sector}`), place: t(`in_${place}`) }))),
    h('div', { class: 'trend', 'data-rise': '' }, h('div', { class: 'table-scroll' }, table)),
  ];
}

/* ---------- this week: the home page ---------- */

function heroCard() {
  const s = D.summary;
  return h('div', { class: 'card' },
    scale(),
    h('div', { class: 'card-body' },
      setVar(h('div', { 'data-rise': '' }, wordmark()), '--i', 2),
      setVar(h('h1', { class: 'hero-title', 'data-rise': '' }, h('span', {}, t('hero_title_1')), ' ', h('span', {}, t('hero_title_2'))), '--i', 3),
      setVar(h('p', { class: 'hero-sub', 'data-rise': '' }, t('hero_sub')), '--i', 4),
      setVar(h('a', { class: 'btn', href: '#/domain', 'data-rise': '' }, t('hero_action')), '--i', 5)),
    h('nav', { class: 'card-foot', id: 'sections', 'aria-label': t('nav_label') },
      s ? h('a', { href: '#/?to=ledger' }, t('hero_issue', { n: s.issue, date: dateLong(s.date, S.lang) })) : h('a', { href: '#/method' }, t('pending_title')),
      h('a', { href: '#/countries' }, t('nav_countries')),
      h('a', { href: '#/checks' }, t('nav_checks')),
      h('a', { href: '#/method' }, t('nav_method')),
      langButton('lang')));
}

function intro() {
  const s = D.summary;
  const facts = [
    s ? [num(s.inventory.GCC.all.live), t('fact_live', { noun: noun(s.inventory.GCC.all.live, 'w_live_domain') })] : null,
    [num(CHECKS.length), t('fact_checks', { noun: noun(CHECKS.length, 'w_check') })],
    [num(COUNTRIES().length), t('fact_states', { noun: noun(COUNTRIES().length, 'w_state') })],
    [t('fact_day'), t('fact_day_note')],
  ].filter(Boolean);
  return h('section', { class: 'intro band', 'aria-labelledby': 'intro-h', 'data-section': '' },
    h('div', { class: 'grid' },
      h('div', { class: 'intro-top' },
        h('h2', { id: 'intro-h', 'data-rise': '' }, t('intro_title')),
        h('p', { class: 'note', 'data-rise': '' }, t('intro_note'))),
      h('div', { class: 'facts' }, facts.map(([v, k], i) => setVar(h('p', { class: 'fact', 'data-rise': '' }, h('span', { class: 'v' }, v), h('span', { class: 'k' }, k)), '--i', i + 2))),
      h('p', { class: 'plate-note soft', 'data-rise': '' }, t('foot_note')),
      h('figure', { class: 'plate', 'data-rise': '' },
        h('img', { src: 'img/gulf-night-north.jpg', width: 1120, height: 840, alt: t('north_caption'), loading: 'lazy' }),
        h('figcaption', {}, t('north_caption')))));
}

function pendingSection() {
  return h('section', { class: 'ledger band', id: 'ledger', 'aria-labelledby': 'pending-h', 'data-section': '' },
    h('div', { class: 'grid' },
      h('div', { class: 'ledger-head' },
        h('h2', { id: 'pending-h', 'data-rise': '' }, t('pending_title')),
        h('p', { 'data-rise': '' }, t('pending_body')),
        h('p', { class: 'small', 'data-rise': '' }, h('a', { class: 'link', href: '#/checks' }, t('nav_checks')), ' · ', h('a', { class: 'link', href: '#/domain' }, t('nav_domain')), ' · ', h('a', { class: 'link', href: '#/method' }, t('nav_method'))))));
}

function proof() {
  const lines = COUNTRIES().map((c) => {
    const suffixes = B.scope.suffixes.filter((x) => x.country === c).map((x) => x.suffix).join(' · ');
    return h('li', {}, h('a', { href: `#/countries/${c}` }, h('span', { class: 'who' }, placeName(c)), ' ', h('bdi', { dir: 'ltr' }, suffixes)));
  });
  return h('section', { class: 'proof', 'aria-labelledby': 'proof-h', 'data-section': '' },
    h('div', { class: 'proof-card', 'data-rise': '' },
      h('h2', { id: 'proof-h' }, t('proof_title')),
      h('figure', { class: 'tipped' },
        h('img', { src: 'img/gulf-night-coast.jpg', width: 1280, height: 720, alt: t('coast_caption'), loading: 'lazy' }),
        h('figcaption', {}, t('coast_caption'))),
      h('ul', { class: 'guests' }, lines),
      h('p', { class: 'proof-note' }, t('proof_note'))));
}

function showcase() {
  const s = D.summary;
  const ref = (cl, v) => ({ n: cl.n, place: 'GCC', sector: 'all', issue: s.issue, date: s.date, v });
  const slips = CLAUSES.map((cl, i) => {
    const f = clauseShare(s.checks[cl.id].GCC.all, cl.mode);
    const text = h('p', { class: 'slip-text' }, f.measured ? [h('span', { class: 'slip-fig', dir: 'ltr' }, (Math.round(f.v * 10) / 10).toFixed(1)), ' ', t(`fig_${cl.id}`)] : t('no_data_sentence'));
    return setVar(h('li', { class: 'slip' },
      h('p', { class: 'slip-head' }, t('slip_head', { n: cl.n, issue: s.issue })),
      h('p', { class: 'slip-rule', 'aria-hidden': 'true' }, '- - - - - - - - - - - - - - - - - - - -'),
      text,
      f.measured ? copyButtons(cl, ref(cl, f.v), text) : null), '--i', i);
  });
  return h('section', { class: 'showcase', 'aria-labelledby': 'show-h', 'data-section': '' },
    h('img', { src: 'img/gulf-night-1600.jpg', srcset: 'img/gulf-night-1600.jpg 1600w, img/gulf-night-2400.jpg 2400w', sizes: '100vw', width: 2400, height: 1600, alt: '', loading: 'lazy' }),
    h('div', { class: 'say', 'data-rise': '' },
      h('div', {}, h('h2', { id: 'show-h' }, t('show_title')), ' ', h('span', { class: 'p1' }, t('show_p1'))),
      h('p', {}, t('show_p2'))),
    h('ul', { class: 'slips' }, slips));
}

function how() {
  const s = D.summary;
  const line = (label, value) => h('div', { class: 'line' }, h('dt', {}, label), value === null ? null : h('span', { class: 'dots', 'aria-hidden': 'true' }), h('dd', {}, value === null ? '' : value));
  const g = s ? s.inventory.GCC.all : null;
  const q = s ? s.quality : null;
  const minutes = q && q.seconds !== null && q.seconds !== undefined ? words(Math.max(1, Math.round(q.seconds / 60)), 'w_minute') : null;
  const group = (head, rows) => [h('h3', {}, head), h('dl', {}, rows.filter(Boolean))];
  return h('section', { class: 'how band on-surface', 'aria-labelledby': 'how-h', 'data-section': '' },
    h('div', { class: 'grid' },
      h('div', { class: 'how-text' },
        h('h2', { id: 'how-h', 'data-rise': '' }, t('how_title')),
        h('p', { 'data-rise': '' }, t('how_note'))),
      h('div', { class: 'receipt', 'data-rise': '' },
        group(t('how_monday', { time: RUN_TIME }), [
          line(t('how_names'), g ? words(g.discovered, 'w_name') : null),
          line(t('how_retired'), g ? words(g.retired, 'w_name') : null),
        ]),
        group(t('how_run'), [
          line(t('how_dns'), q && q.queries ? words(q.queries, 'w_query') : null),
          line(t('how_web'), q ? words(q.web.measured, 'w_site') : null),
          line(t('how_retry'), t('how_retry_v')),
        ]),
        group(t('how_end'), [
          line(t('how_totals'), words(CHECKS.length, 'w_check')),
          line(t('how_publish'), t('how_publish_v')),
        ]),
        h('p', { class: 'total' }, h('span', {}, s ? t('how_result', { n: s.issue }) : t('how_result_next')), minutes ? h('span', {}, minutes) : null))));
}

function reply() {
  const input = h('input', { id: 'reply-input', name: 'd', type: 'text', inputmode: 'url', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'example.com', dir: 'ltr' });
  const form = h('form', { class: 'reply-card', 'data-rise': '', onsubmit: (e) => {
    e.preventDefault();
    location.hash = `#/domain?d=${encodeURIComponent(input.value.trim())}`;
  } },
    h('h2', { id: 'reply-h' }, t('hero_action')),
    h('p', {}, t('domain_privacy')),
    h('label', { class: 'field', for: 'reply-input' }, h('span', { class: 'sr' }, t('domain_label')), input),
    h('button', { class: 'btn bar', type: 'submit' }, t('domain_button')));
  form.setAttribute('aria-labelledby', 'reply-h');
  return h('section', { class: 'reply', 'data-section': '' },
    h('div', { class: 'grid' },
      h('p', { class: 'reply-side', 'data-rise': '' }, t('cta_side')),
      form));
}

function viewHome(r) {
  const s = D.summary;
  const main = h('main', { id: 'main', tabindex: '-1' },
    h('div', { class: 'split home' }, heroCard(), night()),
    intro(),
    s ? ledgerSection(r, 'GCC', '#/') : pendingSection(),
    proof(),
    s ? showcase() : null,
    how(),
    reply());
  return [main];
}

/* ---------- pages inside the card ---------- */

function pageFrame(active, content, { focus, after = [] } = {}) {
  const card = h('div', { class: 'card' }, scale(), cardHead(active), h('div', { class: 'sheet', id: 'content', tabindex: '-1' }, ...content.filter(Boolean)));
  return [h('main', { id: 'main', tabindex: '-1' }, h('div', { class: 'split page' }, card, night(focus)), ...after.filter(Boolean))];
}

function pendingBlock() {
  return h('section', {}, h('h2', {}, t('pending_title')), h('p', {}, t('pending_body')));
}

function viewCountries() {
  const list = COUNTRIES().map((c) => h('li', {}, h('a', { href: `#/countries/${c}` },
    h('span', { class: 'who' }, placeName(c)),
    h('bdi', { dir: 'ltr' }, B.scope.suffixes.filter((x) => x.country === c).map((x) => x.suffix).join(' · ')))));
  return pageFrame('countries', [h('h1', {}, t('countries_title')), h('p', { class: 'lead' }, t('countries_intro')), h('p', {}, t('countries_note')), h('ul', { class: 'states' }, list)], { focus: '30% 55%' });
}

function viewCountry(code, r) {
  if (!B.scope.countries[code]) return viewCountries();
  const s = D.summary;
  const notes = B.scope.suffixes.filter((x) => x.country === code).map((x) => {
    const on = s ? s.chain[x.suffix] : null;
    return h('li', {}, mark(on ? 'pass' : on === false ? 'fail' : 'unknown'), h('span', {}, t(on ? 'chain_on' : 'chain_off', { suffix: x.suffix })));
  });
  if (!s) return pageFrame('countries', [h('h1', {}, placeName(code)), pendingBlock()], { focus: '45% 60%' });
  const inv = s.inventory[code];
  const content = [
    h('h1', {}, placeName(code)),
    h('p', { class: 'lead' }, t('country_lede', { domains: words(inv.all.live, 'w_live_domain'), gov: num(inv.government.live), edu: num(inv.education.live) })),
    inv.all.retired ? h('p', {}, t('country_retired', { n: num(inv.all.retired) })) : null,
    h('ul', { class: 'levels' }, notes),
    h('p', {}, t('countries_intro')),
  ];
  return pageFrame('countries', content, { focus: '45% 60%', after: [ledgerSection(r, code, `#/countries/${code}`), countryTable(code)] });
}

// Every check for one state and nothing else: no column for any other place.
function countryTable(code) {
  const s = D.summary;
  const body = GROUPS.flatMap((g) => [
    h('tr', { class: 'group' }, h('th', { colspan: 3, scope: 'colgroup' }, P(B.groups[g]))),
    ...CHECKS.filter((c) => c.group === g).map((c) => {
      const cell = s.checks[c.id][code].all;
      const v = share(cell);
      return h('tr', {},
        h('th', { scope: 'row' }, h('a', { class: 'link', href: `#/checks/${c.id}` }, P(B.checks[c.id].short))),
        h('td', { class: 'n' }, v === null ? t('no_data') : percent(v, S.lang)),
        h('td', { class: 'n soft' }, v === null ? '' : t('of_count', { pass: num(cell.pass), measured: num(cell.pass + cell.fail) })));
    }),
  ]);
  return h('section', { class: 'band on-surface', 'aria-labelledby': 'ct-cap', 'data-section': '' },
    h('div', { class: 'grid' },
      h('div', { class: 'table-sheet', 'data-rise': '' },
        h('div', { class: 'table-scroll' }, h('table', {},
          h('caption', { id: 'ct-cap' }, t('country_table', { place: t(`in_${code}`) })),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('table_check')), h('th', { scope: 'col', class: 'n' }, sectorName('all')), h('th', { scope: 'col', class: 'n' }, h('span', { class: 'sr' }, t('table_check'))))),
          h('tbody', {}, body))),
        h('p', { class: 'source' }, t('source_line', { date: dateLong(s.date, S.lang), domains: words(s.inventory[code].all.live, 'w_live_domain') })))));
}

function viewChecks() {
  const s = D.summary;
  const out = [h('h1', {}, t('checks_title')), h('p', { class: 'lead' }, t('checks_intro'))];
  for (const g of GROUPS) {
    out.push(h('section', {}, h('h2', {}, P(B.groups[g])), h('ul', { class: 'rows' }, CHECKS.filter((c) => c.group === g).map((c) => {
      const v = s ? share(s.checks[c.id].GCC.all) : null;
      return h('li', {}, h('a', { class: 'row-link', href: `#/checks/${c.id}` },
        h('span', { class: 'row-title' }, P(B.checks[c.id].title)),
        s ? h('span', { class: 'row-fig' }, pctText(v)) : null,
        h('span', { class: 'row-meta' }, P(B.checks[c.id].question))));
    }))));
  }
  return pageFrame('checks', out, { focus: '70% 60%' });
}

function viewCheck(id) {
  const c = B.checks[id];
  if (!c) return viewChecks();
  const s = D.summary;
  let gulf = null;
  let found = null;
  if (s) {
    const cell = s.checks[id].GCC.all;
    const v = share(cell);
    gulf = h('section', {}, h('h2', {}, t('check_gulf')),
      h('div', { class: 'big-fig' }, fig(v), h('p', {}, v === null ? t('no_data_sentence') : t('check_gulf_line'))),
      v === null ? null : h('p', { class: 'small soft' }, t('basis', { count: num(cell.pass), domains: words(cell.pass + cell.fail, 'w_domain') })));
    const levels = Object.entries(cell.levels).sort((a, b) => b[1] - a[1]);
    const stateOf = (level) => (PASS_LEVELS.has(level) ? 'pass' : NA_LEVELS.has(level) ? 'na' : (B.checks[id].levels || {})[level] ? 'fail' : 'unknown');
    found = h('section', {}, h('h2', {}, t('check_found')),
      h('table', {}, h('tbody', {}, levels.map(([lvl, n]) => h('tr', {}, h('th', { scope: 'row' }, mark(stateOf(lvl)), ' ', levelText(id, lvl)), h('td', { class: 'n' }, num(n)))))));
  }
  return pageFrame('checks', [
    h('h1', {}, P(c.title)),
    h('p', { class: 'lead' }, P(c.question)),
    gulf,
    h('section', {}, h('h2', {}, t('check_why')), h('p', {}, P(c.why))),
    h('section', {}, h('h2', {}, t('check_pass')), h('p', {}, P(c.pass))),
    h('section', {}, h('h2', {}, t('check_fix')), h('ol', { class: 'steps' }, c.fix.map((f) => h('li', {}, P(f))))),
    c.example ? h('section', {}, h('h2', {}, t('check_example')), h('pre', {}, h('code', {}, c.example))) : null,
    found,
    h('section', {}, h('h2', {}, t('check_refs')), h('ul', { class: 'refs' }, c.refs.map((ref) => h('li', {}, h('a', { class: 'link', href: ref.url, rel: 'noopener' }, ref.label))))),
  ], { focus: '62% 58%' });
}

/* ---------- the live domain check ---------- */

function suffixFor(domain) {
  const list = [...B.scope.suffixes].sort((a, b) => b.suffix.length - a.suffix.length);
  const hit = list.find((x) => domain.endsWith(`.${x.suffix}`));
  return hit ? hit.suffix : null;
}

function renderResult(box, domain, results) {
  const measured = Object.values(results).filter((x) => x.state === 'pass' || x.state === 'fail');
  const passed = measured.filter((x) => x.state === 'pass').length;
  const groups = GROUPS.map((g) => [
    h('h3', {}, P(B.groups[g])),
    h('ul', { class: 'res' }, CHECKS.filter((c) => c.group === g).map((c) => {
      const res = results[c.id];
      return h('li', { class: res.state }, mark(res.state),
        h('span', { class: 'what' }, h('span', { class: 'sr' }, `${t(`state_${res.state}`)} `), P(B.checks[c.id].short)),
        h('span', { class: 'dots', 'aria-hidden': 'true' }),
        h('span', { class: 'lvl' }, `${t(`state_${res.state}`)} · ${levelText(c.id, res.level)}`));
    })),
  ]);
  box.replaceChildren(h('h2', {}, ltr(domain)), h('p', {}, t('domain_summary', { pass: num(passed), checks: words(measured.length, 'w_check') })), ...groups.flat());
}

function viewDomain(r) {
  const status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const box = h('div', { class: 'result' });
  const input = h('input', { id: 'domain-input', type: 'text', inputmode: 'url', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'example.com', dir: 'ltr', value: r.query.get('d') || '' });
  const button = h('button', { class: 'btn', type: 'submit' }, t('domain_button'));
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
    h('label', { class: 'field', for: 'domain-input' }, h('span', {}, t('domain_label')), input), button);
  if (input.value) queueMicrotask(run);
  return pageFrame('domain', [
    h('h1', {}, t('domain_title')),
    h('p', {}, t('domain_intro')),
    form,
    status,
    h('p', {}, t('domain_privacy')),
    box,
    h('section', { id: 'cli' }, h('h2', {}, t('m_cli_h')), h('p', {}, t('domain_cli')), h('pre', {}, h('code', {}, `npx -y github:${repoPath()} check example.com`))),
  ], { focus: '54% 64%' });
}

/* ---------- method and data ---------- */

function viewMethod() {
  const s = D.summary;
  const sec = (id, headKey, body) => h('section', { id }, h('h2', {}, t(headKey)), ...body);
  const paras = (key) => B.ui[key].map((x) => h('p', {}, tr(x, S.lang)));
  const suffixes = h('ul', { class: 'suffixes' }, B.scope.suffixes.map((x) => {
    const on = s ? s.chain[x.suffix] : null;
    return h('li', {}, h('code', {}, x.suffix), h('span', { class: 'soft' }, placeName(x.country), ' · ', P(B.scope.sectors[x.sector])), s ? h('span', {}, mark(on ? 'pass' : on === false ? 'fail' : 'unknown'), ' ', t(on ? 'chain_yes' : 'chain_no')) : null);
  }));
  const quality = s ? sec('quality', 'm_quality_h', [
    h('p', {}, t('q_agree', { pct: pctText((s.quality.agreement.same + s.quality.agreement.differ) ? (s.quality.agreement.same / (s.quality.agreement.same + s.quality.agreement.differ)) * 100 : null) })),
    h('p', {}, t('q_unreachable', { n: num(s.quality.web.unreachable) })),
    s.quality.seconds !== null && s.quality.seconds !== undefined ? h('p', {}, t('q_runtime', { minutes: words(Math.max(1, Math.round(s.quality.seconds / 60)), 'w_minute'), queries: words(s.quality.queries || 0, 'w_query') })) : null,
  ]) : null;
  const dl = [['dl_latest_csv', 'data/open/latest.csv'], ['dl_history_csv', 'data/open/history.csv'], ['dl_summary_json', 'data/summary.json'], ['dl_history_json', 'data/history.json']];
  const mcpConfig = JSON.stringify({ mcpServers: { [B.project.slug || 'gbaseline']: { command: 'npx', args: ['-y', `github:${repoPath()}`, 'mcp'] } } }, null, 2);
  return pageFrame('method', [
    h('h1', {}, t('method_title')),
    sec('scope', 'm_scope_h', [paras('m_scope'), h('h3', {}, t('m_suffixes')), suffixes]),
    sec('sources', 'm_sources_h', [paras('m_sources')]),
    sec('how', 'm_how_h', [paras('m_how')]),
    sec('publish', 'm_publish_h', [paras('m_publish')]),
    sec('limits', 'm_limits_h', [paras('m_limits')]),
    quality,
    sec('data', 'm_data_h', [paras('m_data'), s ? h('ul', { class: 'downloads' }, dl.map(([k, href]) => h('li', {}, h('a', { class: 'link', href, download: '' }, t(k))))) : null]),
    sec('cite', 'm_cite_h', [paras('m_cite')]),
    sec('cli', 'm_cli_h', [paras('m_cli'), h('pre', {}, h('code', {}, `npx -y github:${repoPath()} check example.com\nnpx -y github:${repoPath()} check example.com --lang ar --json`)), h('pre', {}, h('code', {}, mcpConfig))]),
    sec('code', 'm_code_h', [paras('m_code'), B.project.repo ? h('p', {}, h('a', { class: 'link', href: B.project.repo }, ltr(B.project.repo.replace(/^https:\/\//, '')))) : null]),
    sec('credits', 'm_credits_h', [paras('m_credits')]),
  ], { focus: '36% 52%' });
}

/* ---------- render ---------- */

function reveal(root) {
  if (observer) observer.disconnect();
  const parts = [...root.querySelectorAll('[data-section]'), ...root.querySelectorAll('.split, .back')];
  if (!('IntersectionObserver' in window) || !document.documentElement.classList.contains('motion')) {
    parts.forEach((n) => n.classList.add('in'));
    return;
  }
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  for (const part of parts) {
    part.querySelectorAll('[data-rise]').forEach((n, i) => { if (!n.style.getPropertyValue('--i')) setVar(n, '--i', i); });
    observer.observe(part);
  }
}

function render(moveFocus = false) {
  const r = route();
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  let nodes;
  if (r.view === 'overview' || r.view === '') nodes = viewHome(r);
  else if (r.view === 'countries' || r.view === 'country') nodes = r.arg ? viewCountry(r.arg.toUpperCase(), r) : viewCountries();
  else if (r.view === 'checks' || r.view === 'check') nodes = r.arg ? viewCheck(r.arg) : viewChecks();
  else if (r.view === 'domain') nodes = viewDomain(r);
  else if (r.view === 'method') nodes = viewMethod();
  else nodes = viewHome(r);
  const app = $('app');
  app.replaceChildren(...nodes, back());
  const titles = { overview: 'nav_overview', countries: 'nav_countries', checks: 'nav_checks', domain: 'nav_domain', method: 'nav_method' };
  const head = r.view === 'countries' && r.arg && B.scope.countries[r.arg.toUpperCase()] ? placeName(r.arg.toUpperCase()) : r.view === 'checks' && r.arg && B.checks[r.arg] ? P(B.checks[r.arg].short) : t(titles[r.view] || 'nav_overview');
  document.title = [head, projectName() || t('tagline').replace(/\.$/, '')].join(' · ');
  const skip = $('skip');
  skip.textContent = t('skip');
  skip.dataset.target = $('ledger') ? 'ledger' : $('content') ? 'content' : 'main';
  reveal(app);
  const target = r.query.get('c') ? $(`c${r.query.get('c')}`) : r.query.get('to') ? $(r.query.get('to')) : null;
  if (target) {
    if (target.classList.contains('row')) target.classList.add('stamped');
    target.closest('[data-section]')?.classList.add('in');
    requestAnimationFrame(() => target.scrollIntoView({ block: target.classList.contains('row') ? 'center' : 'start' }));
  } else if (moveFocus) {
    scrollTo({ top: 0 });
    const focus = $('content') || $('main');
    focus.focus({ preventScroll: true });
  }
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
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('motion');
  render();
  addEventListener('hashchange', () => render(true));
  // The skip link moves focus itself, because an in-page anchor would read as a route.
  $('skip').addEventListener('click', (e) => {
    e.preventDefault();
    const target = $(e.currentTarget.dataset.target);
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.closest('[data-section]')?.classList.add('in');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  });
}

boot();
