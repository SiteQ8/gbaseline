#!/usr/bin/env node
// MCP server (stdio, newline-delimited JSON-RPC 2.0): the observatory's published figures for AI assistants,
// plus a live full check of any domain. No dependencies. Every tool is read-only.
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { CHECKS, GROUPS, suffixChain } from '../docs/assets/engine/checks.js';
import { createResolver, cleanDomain } from '../docs/assets/engine/dns.js';
import { CLAUSES, clauseShare } from '../docs/assets/engine/clauses.js';
import { PRODUCTS } from '../docs/assets/engine/software.js';
import { tr, ui, share, percent, counted, dateLong } from '../docs/assets/engine/i18n.js';
import { bundle, project, scope, userAgent, levelText } from '../src/meta.mjs';
import { bySuffixLength } from '../src/inventory.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const SUPPORTED = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export const PREFIX = (project.slug || 'observatory').replace(/-/g, '_');
const T = (name) => `${PREFIX}_${name}`;
const loadJson = (rel) => {
  const u = new URL(`../${rel}`, import.meta.url);
  return existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) : null;
};
export function publishedData() {
  const readiness = loadJson('docs/data/readiness.json');
  return { summary: loadJson('docs/data/summary.json'), history: loadJson('docs/data/history.json') || [], readiness: readiness && readiness.schema === 'readiness/1' ? readiness : null };
}

const PLACES = ['GCC', ...Object.keys(scope.countries)];
const SECTORS = ['all', ...Object.keys(scope.sectors)];
const IDS = CHECKS.map((c) => c.id);
const LANG = { type: 'string', enum: ['en', 'ar'], default: 'en', description: 'Language for the answer: en or ar.' };
const FORMAT = { type: 'string', enum: ['markdown', 'json'], default: 'markdown', description: 'markdown for reading, json for further processing.' };
const PLACE = { type: 'string', enum: PLACES, default: 'GCC', description: 'GCC for all six states together, or KW Kuwait, SA Saudi Arabia, AE UAE, QA Qatar, BH Bahrain, OM Oman.' };
const SECTOR = { type: 'string', enum: SECTORS, default: 'all', description: `all, or one sector: ${SECTORS.slice(1).join(', ')}.` };
const CHECK = { type: 'string', enum: IDS, description: `One of ${IDS.join(', ')}.` };
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const tools = [
  { name: T('overview'), title: 'Overview of the latest issue', description: 'What the baseline measures, the latest weekly issue with its date, the six headline figures for the Gulf as a whole (email impersonation, DNSSEC, HSTS, old TLS versions, post quantum readiness, vulnerability disclosure) with their counts and ready to quote sentences, coverage and where the open data lives. Start here.', inputSchema: { type: 'object', properties: { lang: LANG, response_format: FORMAT }, additionalProperties: false }, annotations: RO },
  { name: T('figures'), title: 'Every check for the Gulf or one state', description: 'The share of measured domains passing each of the thirteen checks, with the passing and measured counts and what the scan found (the levels), for the Gulf as a whole or for one state on its own, all sectors or one of them. One place per call: the baseline does not rank or compare the states.', inputSchema: { type: 'object', properties: { place: PLACE, sector: SECTOR, lang: LANG, response_format: FORMAT }, additionalProperties: false }, annotations: RO },
  { name: T('check_info'), title: 'What a check means and how to fix it', description: 'The question a check answers, why it matters, exactly when it passes, the steps to fix it, an example record, the standards behind it and the Gulf figure from the latest issue.', inputSchema: { type: 'object', properties: { check: CHECK, lang: LANG, response_format: FORMAT }, required: ['check'], additionalProperties: false }, annotations: RO },
  { name: T('history'), title: 'Week by week series', description: 'The weekly series of one check for a place and sector: date, issue number, passing, measured and share.', inputSchema: { type: 'object', properties: { check: CHECK, place: PLACE, sector: SECTOR, lang: LANG, response_format: FORMAT }, required: ['check'], additionalProperties: false }, annotations: RO },
  { name: T('readiness'), title: 'Readiness against exploited vulnerabilities', description: 'The readiness index for the Gulf as a whole or one state: the date of the last census of what every live site announces about its software (server, platform, content system, version), every exploited vulnerability from the CISA KEV catalogue that concerns software visible from outside with the share of sites announcing an affected version, the share of announced software past its support on endoflife.date, and the series of both. A floor, not a count: only sites that announce a version are measured against a vulnerability. One place per call.', inputSchema: { type: 'object', properties: { place: PLACE, lang: LANG, response_format: FORMAT }, additionalProperties: false }, annotations: RO },
  { name: T('methodology'), title: 'Method, limits and citation', description: 'How the domains are found and measured, what is published and what is not, the limits of the measurement, data quality for the latest issue and how to cite a figure.', inputSchema: { type: 'object', properties: { lang: LANG, response_format: FORMAT }, additionalProperties: false }, annotations: RO },
  { name: T('check_domain'), title: 'Check any domain live', description: 'Runs every check live for one domain from this machine: DNS over HTTPS through two public resolvers, then HTTPS, HSTS, TLS versions, the post quantum hybrid key exchange and security.txt. Takes a few seconds. dns_only skips the website and TLS probes.', inputSchema: { type: 'object', properties: { domain: { type: 'string', description: 'A domain such as example.com. A URL or an email address works too.' }, dns_only: { type: 'boolean', default: false }, lang: LANG, response_format: FORMAT }, required: ['domain'], additionalProperties: false }, annotations: { ...RO, idempotentHint: false, openWorldHint: true } },
];

export class ToolError extends Error {}
const pickLang = (a) => (a && a.lang === 'ar' ? 'ar' : 'en');
const pick = (v, list, fallback) => (v === undefined ? fallback : list.includes(v) ? v : (() => { throw new ToolError(`must be one of ${list.join(', ')}, not "${v}".`); })());
const placeName = (p, lang) => (p === 'GCC' ? ui(bundle, 'place_GCC', lang) : tr(scope.countries[p], lang));
const sectorName = (s, lang) => (s === 'all' ? ui(bundle, 'sector_all', lang) : tr(scope.sectors[s], lang));
const site = () => (project.domain ? `https://${project.domain}/` : null);
function result(obj, markdown, args) {
  return { content: [{ type: 'text', text: args.response_format === 'json' ? JSON.stringify(obj, null, 2) : markdown }], structuredContent: obj };
}
function requireSummary(data, lang) {
  if (!data.summary) throw new ToolError(tr({ en: 'No issue has been published yet: the first weekly scan is still running. check_info, methodology and check_domain work now.', ar: 'لم يصدر أي عدد بعد لأن الفحص الأسبوعي الأول ما زال جارياً بينما تعمل أدوات شرح المعايير والمنهجية وفحص النطاق الآن.' }, lang));
  return data.summary;
}
function row(summary, id, place, sector, lang) {
  const cell = summary.checks[id][place][sector];
  const s = share(cell);
  return { check: id, name: tr(bundle.checks[id].short, lang), group: CHECKS.find((c) => c.id === id).group, pass: cell.pass, fail: cell.fail, measured: cell.pass + cell.fail, not_applicable: cell.na, unknown: cell.unknown, share: s === null ? null : Math.round(s * 10) / 10, levels: Object.fromEntries(Object.entries(cell.levels).map(([k, n]) => [k, { count: n, label: levelText(id, k, lang) }])) };
}
const pctText = (v, lang) => (v === null ? ui(bundle, 'no_data', lang) : percent(v, lang));
// Arabic answers never carry Latin commas or colons: parts are joined with a middle dot and counts read "x من y".
const J = (lang, ...parts) => parts.filter(Boolean).join(lang === 'ar' ? ' · ' : ', ');
const C = (lang, a, b) => (lang === 'ar' ? `(${a} من ${b})` : `(${a}/${b})`);
const KV = (lang, k, v) => (lang === 'ar' ? `${k} · ${v}` : `${k}: ${v}`);

export function makeHandlers(data) {
  return {
    [T('overview')](args) {
      const lang = pickLang(args);
      const base = { name: tr({ en: project.name_en, ar: project.name_ar }, lang) || null, about: tr(project.about, lang), site: site(), checks: IDS, places: PLACES, suffixes: scope.suffixes.map((s) => s.suffix) };
      if (!data.summary) {
        const out = { ...base, issue: null, note: ui(bundle, 'pending_body', lang) };
        return result(out, [`# ${base.name || 'Gulf Cybersecurity Baseline'}`, '', base.about, '', out.note].join('\n'), args);
      }
      const s = data.summary;
      const g = s.inventory.GCC.all;
      const vars = { place: ui(bundle, 'in_GCC', lang), sector: ui(bundle, 'of_all', lang) };
      // The six clauses of the issue, with the sentences the site prints on its citation slips.
      const clauses = CLAUSES.map((cl) => {
        const f = clauseShare(s.checks[cl.id].GCC.all, cl.mode);
        const pct = f.v === null ? null : Math.round(f.v * 10) / 10;
        return { clause: cl.n, check: cl.id, counts: cl.mode === 'fail' ? 'not_passing' : 'passing', share: pct, count: f.count, measured: f.measured, sentence: f.measured ? ui(bundle, `cite_${cl.id}`, lang, { ...vars, pct: pctText(pct, lang) }) : ui(bundle, 'no_data_sentence', lang), cite: site() ? `${site()}${lang === 'ar' ? '' : 'en/'}issues/${s.issue}/#c${cl.n}` : null };
      });
      const out = { ...base, issue: s.issue, date: s.date, live_domains: g.live, discovered: g.discovered, clauses, data: site() ? { latest_csv: `${site()}data/open/latest.csv`, history_csv: `${site()}data/open/history.csv`, summary_json: `${site()}data/summary.json` } : null };
      const md = [
        `# ${J(lang, base.name || 'Gulf Cybersecurity Baseline', ui(bundle, 'issue', lang, { n: s.issue }), dateLong(s.date, lang))}`, '', base.about, '',
        ...clauses.map((c) => `- ${c.sentence} ${C(lang, c.count, c.measured)}`),
        '', ui(bundle, 'source_line', lang, { date: dateLong(s.date, lang), domains: counted(g.live, bundle.ui.w_live_domain, lang) }),
      ].join('\n');
      return result(out, md, args);
    },
    [T('figures')](args) {
      const lang = pickLang(args);
      const s = requireSummary(data, lang);
      const place = pick(args.place, PLACES, 'GCC');
      const sector = pick(args.sector, SECTORS, 'all');
      const rows = IDS.map((id) => row(s, id, place, sector, lang));
      const out = { issue: s.issue, date: s.date, place, sector, live_domains: s.inventory[place][sector].live, checks: rows };
      const md = [`# ${J(lang, placeName(place, lang), sectorName(sector, lang), ui(bundle, 'issue', lang, { n: s.issue }))}`, '', ...GROUPS.flatMap((g) => [`## ${tr(bundle.groups[g], lang)}`, ...rows.filter((r) => r.group === g).map((r) => `- ${KV(lang, r.name, pctText(r.share, lang))} ${C(lang, r.pass, r.measured)}`), ''])].join('\n');
      return result(out, md, args);
    },
    [T('check_info')](args) {
      const lang = pickLang(args);
      const id = pick(args.check, IDS);
      const c = bundle.checks[id];
      const out = { check: id, group: CHECKS.find((x) => x.id === id).group, title: tr(c.title, lang), question: tr(c.question, lang), why: tr(c.why, lang), passes_when: tr(c.pass, lang), fix: c.fix.map((f) => tr(f, lang)), example: c.example || null, standards: c.refs };
      if (data.summary) { const cell = data.summary.checks[id].GCC.all; const v = share(cell); out.gulf = { issue: data.summary.issue, date: data.summary.date, share: v === null ? null : Math.round(v * 10) / 10, pass: cell.pass, measured: cell.pass + cell.fail }; }
      const gulfLine = out.gulf && out.gulf.share !== null ? ['', `${ui(bundle, 'check_gulf', lang)} · ${pctText(out.gulf.share, lang)} ${C(lang, out.gulf.pass, out.gulf.measured)}`] : [];
      const md = [`# ${out.title}`, '', `**${out.question}**`, ...gulfLine, '', out.why, '', `## ${ui(bundle, 'check_pass', lang)}`, out.passes_when, '', `## ${ui(bundle, 'check_fix', lang)}`, ...out.fix.map((f, i) => `${i + 1}. ${f}`), ...(out.example ? ['', '```', out.example, '```'] : []), '', ...c.refs.map((r) => `- [${r.label}](${r.url})`)].join('\n');
      return result(out, md, args);
    },
    [T('history')](args) {
      const lang = pickLang(args);
      requireSummary(data, lang);
      const id = pick(args.check, IDS);
      const place = pick(args.place, PLACES, 'GCC');
      const sector = pick(args.sector, SECTORS, 'all');
      const series = data.history.map((h, i) => { const [pass, measured] = (((h.c || {})[id] || {})[place] || {})[sector] || [0, 0]; return { issue: i + 1, date: h.date, pass, measured, share: measured ? Math.round((pass / measured) * 1000) / 10 : null }; });
      const out = { check: id, place, sector, series };
      const md = [`# ${J(lang, tr(bundle.checks[id].short, lang), placeName(place, lang), sectorName(sector, lang))}`, '', ...series.map((p) => `- ${KV(lang, J(lang, ui(bundle, 'issue', lang, { n: p.issue }), p.date), pctText(p.share, lang))} ${C(lang, p.pass, p.measured)}`)].join('\n');
      return result(out, md, args);
    },
    [T('readiness')](args) {
      const lang = pickLang(args);
      const R = data.readiness;
      if (!R) throw new ToolError(ui(bundle, 'readiness_pending', lang));
      const place = pick(args.place, PLACES, 'GCC');
      const p = R.places[place];
      const round1 = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
      const name = (id) => tr(PRODUCTS[id] || { en: id, ar: id }, lang);
      const kev = R.kev.map((e) => {
        const x = p.kev[e.cve] || { exposed: 0, announced: 0 };
        return { cve: e.cve, product: e.product, product_name: name(e.product), name: e.name, added: e.added, due: e.due, ransomware: e.ransomware, exposed: x.exposed, announcing_version: x.announced, share: round1(x.exposed, x.announced), catalogue: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${encodeURIComponent(e.cve)}`, nvd: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(e.cve)}`, notes: e.notes };
      });
      const products = Object.entries(p.products).sort((a, b) => b[1].sites - a[1].sites).map(([id, x]) => ({ product: id, name: name(id), sites: x.sites, announcing_version: x.versioned, past_support: x.eol, supported: x.supported, support_unknown: x.unknown, share_past_support: PRODUCTS[id] && (PRODUCTS[id].eol || PRODUCTS[id].cycles) ? round1(x.eol, x.versioned) : null, cycles: x.cycles }));
      const page = site() ? `${site()}${lang === 'ar' ? '' : 'en/'}readiness/${place === 'GCC' ? '' : `${place.toLowerCase()}/`}` : null;
      const out = { date: R.date, run: R.run, place, live_domains: p.live, sites_read: p.sites, announce: { ...p.announce }, fronts: p.fronts, exploited_vulnerabilities: kev, unmatched: R.unmatched || [], products, sources: R.sources, series: place === 'GCC' ? R.history : null, page, data: site() ? `${site()}data/readiness.json` : null };
      const measured = ui(bundle, 'readiness_measured', lang, { date: dateLong(R.date, lang), place: ui(bundle, `in_${place}`, lang), sites: counted(p.sites, bundle.ui.w_site, lang) });
      const md = [
        `# ${J(lang, ui(bundle, 'readiness_title', lang), placeName(place, lang), dateLong(R.date, lang))}`, '', measured, '',
        `## ${ui(bundle, 'kev_h', lang)}`,
        ...(kev.length ? kev.map((e) => `- ${KV(lang, `${e.product_name} ${e.cve}`, e.share === null ? ui(bundle, 'kev_none_announce', lang) : `${pctText(e.share, lang)} ${C(lang, e.exposed, e.announcing_version)}`)} · ${e.name}`) : [ui(bundle, 'kev_none', lang)]),
        '', `## ${ui(bundle, 'eol_h', lang)}`,
        ...products.filter((x) => x.share_past_support !== null).map((x) => `- ${KV(lang, x.name, pctText(x.share_past_support, lang))} ${C(lang, x.past_support, x.announcing_version)}`),
        '', `## ${ui(bundle, 'announce_h', lang)}`,
        ...['server', 'version', 'cms', 'front'].map((key) => `- ${KV(lang, ui(bundle, `announce_${key}`, lang), pctText(round1(p.announce[key], p.sites), lang))} ${C(lang, p.announce[key], p.sites)}`),
      ].join('\n');
      return result(out, md, args);
    },
    [T('methodology')](args) {
      const lang = pickLang(args);
      const join = (k) => bundle.ui[k].map((p) => tr(p, lang)).join('\n\n');
      const sections = ['m_scope', 'm_sources', 'm_how', 'm_publish', 'm_limits', 'm_cite'].map((k) => ({ heading: ui(bundle, `${k}_h`, lang), text: join(k) }));
      const out = { sections, suffixes: scope.suffixes, quality: data.summary ? data.summary.quality : null, scanner: data.summary ? data.summary.scanner : null };
      const md = sections.map((s) => `## ${s.heading}\n${s.text}`).join('\n\n');
      return result(out, md, args);
    },
    async [T('check_domain')](args) {
      const lang = pickLang(args);
      const domain = cleanDomain(args.domain);
      if (!domain) throw new ToolError(ui(bundle, 'domain_invalid', lang));
      const { observeDomain } = await import('../src/probe.mjs');
      const resolver = createResolver();
      const suffix = bySuffixLength(scope).find((x) => domain.endsWith(`.${x.suffix}`));
      const chain = suffix ? await suffixChain(suffix.suffix, resolver) : undefined;
      const { obs, results } = await observeDomain(domain, resolver, { chain, agent: userAgent(), skipWeb: Boolean(args.dns_only) });
      if (obs.dns.state === 'nxdomain') throw new ToolError(ui(bundle, 'domain_nx', lang));
      const rows = CHECKS.map((c) => ({ check: c.id, name: tr(bundle.checks[c.id].short, lang), state: results[c.id].state, level: results[c.id].level, label: levelText(c.id, results[c.id].level, lang) }));
      const out = { domain, at: obs.at, dns: obs.dns.state, checks: rows };
      const st = { pass: ui(bundle, 'state_pass', lang), fail: ui(bundle, 'state_fail', lang), na: ui(bundle, 'state_na', lang), unknown: ui(bundle, 'state_unknown', lang) };
      const md = [`# ${domain}`, '', ...rows.map((r) => `- ${KV(lang, r.name, st[r.state])} (${r.label})`)].join('\n');
      return result(out, md, args);
    },
  };
}

function send(msg) { process.stdout.write(`${JSON.stringify(msg)}\n`); }
const reply = (id, res) => send({ jsonrpc: '2.0', id, result: res });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

export function serve(handlers) {
  async function handle(msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      if (msg && msg.id !== undefined && msg.id !== null) fail(msg.id, -32600, 'Invalid request');
      return;
    }
    const { id, method, params } = msg;
    if (id === undefined || id === null) return;
    switch (method) {
      case 'initialize': {
        const asked = params?.protocolVersion;
        reply(id, {
          protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: pkg.name, title: `${project.name_en || 'Gulf Cybersecurity Baseline'} MCP server`, version: pkg.version },
          instructions: 'Read-only tools over a weekly, passive measurement of every public domain under the government, education, health, business, non-profit and network suffixes of Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain and Oman: email impersonation protection, DNSSEC, HTTPS and HSTS, TLS versions, post quantum key exchange and security.txt, plus the readiness index: what the sites announce about their software against the CISA KEV catalogue of exploited vulnerabilities and the support cycles on endoflife.date. Cite the issue number and date, or the census date, with any figure. The figures describe public configuration only and are not an audit of any organisation. No tool lists organisations, and no tool ranks or compares the states: ask for the Gulf as a whole or for one state at a time.',
        });
        return;
      }
      case 'ping': reply(id, {}); return;
      case 'tools/list': reply(id, { tools }); return;
      case 'tools/call': {
        const h = handlers[params?.name];
        if (!h) { fail(id, -32602, `Unknown tool: ${params?.name}`); return; }
        try {
          reply(id, await h(params.arguments || {}));
        } catch (e) {
          const text = e instanceof ToolError ? e.message : 'The tool failed on this input. Check the arguments against the tool schema.';
          if (!(e instanceof ToolError)) process.stderr.write(`tool ${params.name} failed: ${e.stack}\n`);
          reply(id, { isError: true, content: [{ type: 'text', text }] });
        }
        return;
      }
      default: fail(id, -32601, `Method not found: ${method}`);
    }
  }
  let queue = Promise.resolve();
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (text) => {
    if (!text.trim()) return;
    let msg;
    try { msg = JSON.parse(text); } catch { fail(null, -32700, 'Parse error'); return; }
    queue = queue.then(() => (Array.isArray(msg) ? Promise.all(msg.map(handle)) : handle(msg)));
  });
  rl.on('close', () => { queue.then(() => process.exit(0)); });
}

// --selftest drives every tool in-process over a synthetic issue built by the real aggregator, without a client.
async function selftest() {
  const { aggregate, appendHistory } = await import('../src/aggregate.mjs');
  const { compact } = await import('../src/scan.mjs');
  const all = (state, level) => Object.fromEntries(IDS.map((id) => [id, { state, level }]));
  const rows = [
    { d: 'a.gov.kw', c: 'KW', s: 'government', dns: 'live', agree: true, r: compact({ ...all('pass', 'valid'), dnssec: { state: 'pass', level: 'validated' } }) },
    { d: 'b.gov.kw', c: 'KW', s: 'government', dns: 'live', agree: true, r: compact({ ...all('fail', 'missing') }) },
    { d: 'c.edu.sa', c: 'SA', s: 'education', dns: 'live', agree: true, r: compact({ ...all('fail', 'missing'), dmarc: { state: 'pass', level: 'reject' } }) },
    { d: 'd.gov.om', c: 'OM', s: 'government', dns: 'nxdomain', agree: null, r: compact(all('na', 'no-domain')) },
  ];
  const { summary } = aggregate(rows, scope, { date: '2026-10-19', chain: {} });
  summary.issue = 1;
  const { aggregateReadiness } = await import('../src/readiness.mjs');
  const refs = {
    kev: [{ cve: 'CVE-2026-1001', product: 'php', vendor: 'PHP Group', productName: 'PHP', name: 'PHP argument injection', description: 'x', added: '2026-10-20', due: '2026-11-10', ransomware: 'Unknown', notes: [], ranges: [{ product: 'php', start: '8.1.0', startIncluded: true, end: '8.1.31', endIncluded: false }] }],
    cycles: { php: [{ cycle: '8.3', eol: '2027-12-31', latest: '8.3.26', support: '2025-12-31' }, { cycle: '8.1', eol: '2025-12-31', latest: '8.1.33', support: '2023-11-25' }] },
    sources: { kev: { fetched: '2026-10-23T05:00:00.000Z' } },
  };
  const readiness = aggregateReadiness([
    { d: 'a.gov.kw', c: 'KW', s: 'government', dns: 'live', web: 'ok', sw: { p: [['apache', '2.4.41'], ['php', '8.1.2']], f: [] } },
    { d: 'b.gov.kw', c: 'KW', s: 'government', dns: 'live', web: 'ok', sw: { p: [['nginx', '1.18.0'], ['php', '8.3.1']], f: [] } },
    { d: 'c.edu.sa', c: 'SA', s: 'education', dns: 'live', web: 'ok', sw: { p: [], f: ['cloudflare'] } },
  ], scope, refs, { date: '2026-10-23', run: 'census' });
  const data = { summary, history: appendHistory([], summary), readiness };
  const h = makeHandlers(data);
  let pass = 0;
  let failn = 0;
  const ok = (cond, label) => { if (cond) pass += 1; else { failn += 1; console.error('FAIL: ' + label); } };
  try {
    ok(tools.length === 7, 'seven tools');
    ok(!tools.some((x) => /compare/.test(x.name)), 'no tool sets the states side by side');
    ok(!JSON.stringify(h[T('overview')]({}).structuredContent).includes('a.gov.kw'), 'no tool names a measured domain');
    const ov = h[T('overview')]({}).structuredContent;
    ok(ov.live_domains === 3 && ov.discovered === 4, 'overview counts three live of four discovered');
    const dm = ov.clauses.find((c) => c.check === 'dmarc');
    ok(ov.clauses.length === 6 && dm.share === 33.3 && dm.count === 1 && dm.counts === 'not_passing', 'one of three can be impersonated');
    ok(/33\.3%/.test(dm.sentence), 'the overview quotes the clause sentence with one decimal');
    const kw = h[T('figures')]({ place: 'KW', sector: 'government', lang: 'ar' }).structuredContent;
    ok(kw.checks.find((c) => c.check === 'dmarc').share === 50 && /[\u0600-\u06FF]/.test(kw.checks[0].name), 'Kuwait government DMARC at half, in Arabic');
    const om = h[T('figures')]({ place: 'OM' }).structuredContent;
    ok(om.live_domains === 0 && om.checks.every((c) => c.measured === 0), 'Oman alone has no live domain in the synthetic issue');
    const info = h[T('check_info')]({ check: 'pq_kex' }).structuredContent;
    ok(info.passes_when.includes('X25519MLKEM768') && info.gulf && !Array.isArray(info.gulf) && info.gulf.measured === 3, 'post quantum check explains its group and gives the Gulf figure only');
    ok(h[T('history')]({ check: 'dmarc' }).structuredContent.series.length === 1, 'one week of history');
    ok(h[T('methodology')]({ lang: 'ar' }).structuredContent.sections.length === 6, 'six method sections');
    let threw = false; try { await h[T('check_domain')]({ domain: 'not a domain' }); } catch (x) { threw = x instanceof ToolError; } ok(threw, 'invalid domain throws ToolError');
    threw = false; try { h[T('figures')]({ place: 'XX' }); } catch (x) { threw = x instanceof ToolError; } ok(threw, 'unknown place throws ToolError');
    const rd = h[T('readiness')]({ lang: 'ar' }).structuredContent;
    ok(rd.sites_read === 3 && rd.exploited_vulnerabilities.length === 1 && rd.exploited_vulnerabilities[0].share === 50 && rd.exploited_vulnerabilities[0].announcing_version === 2, 'one of the two sites announcing a PHP version announces an affected one');
    ok(rd.products.find((x) => x.product === 'php').share_past_support === 50 && !JSON.stringify(rd).includes('gov.kw'), 'half of the announced PHP versions are past their support, and no domain is named');
    ok(h[T('readiness')]({ place: 'SA' }).structuredContent.exploited_vulnerabilities[0].share === null, 'a state where no site announces the product has no share');
    const empty = makeHandlers({ summary: null, history: [], readiness: null });
    ok(empty[T('overview')]({}).structuredContent.issue === null, 'overview works before the first issue');
    threw = false; try { empty[T('readiness')]({}); } catch (x) { threw = x instanceof ToolError; } ok(threw, 'readiness before the first census throws ToolError');
    threw = false; try { empty[T('figures')]({}); } catch (x) { threw = x instanceof ToolError; } ok(threw, 'figures before the first issue throws ToolError');
  } catch (x) { failn += 1; console.error('THREW: ' + x.stack); }
  console.log(`selftest: ${pass} passed, ${failn} failed`);
  process.exit(failn ? 1 : 0);
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
const viaCli = process.argv[2] === 'mcp';
if (process.argv.includes('--selftest')) await selftest();
else if (isMain || viaCli) serve(makeHandlers(publishedData()));
