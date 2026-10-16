// What the browser adds to a printed page: old addresses sent to their new pages, tabs over the sector panels,
// the copy buttons on every citation, the live check, and the motion that brings in each section. Every page
// reads in full without it.
import { toDom } from './vnode.js';

const doc = document;
const root = doc.documentElement;
const lang = root.lang === 'en' ? 'en' : 'ar';
const base = lang === 'ar' ? '/' : '/en/';

// Addresses from the first version of the site were routes after a hash (#/countries/KW?s=education&i=1&c=2) and
// ?lang=en for English. Each one now has a page of its own.
function legacy() {
  const query = new URLSearchParams(location.search);
  const hash = location.hash;
  if (hash.startsWith('#/')) {
    const [path, rest = ''] = hash.slice(2).split('?');
    const p = new URLSearchParams(rest);
    const prefix = query.get('lang') === 'en' ? '/en/' : base;
    const [view, arg] = path.split('/');
    const cc = arg && /^[A-Za-z]{2}$/.test(arg) ? arg.toLowerCase() : null;
    let rel = '';
    if (view === 'countries') rel = cc ? `countries/${cc}/` : 'countries/';
    else if (view === 'checks') rel = arg && /^[a-z_0-9]+$/.test(arg) ? `standards/${arg.replace(/_/g, '-')}/` : 'standards/';
    else if (view === 'domain') rel = 'check/';
    else if (view === 'method') rel = 'method/';
    const issue = p.get('i');
    if (issue && /^\d+$/.test(issue) && (view === '' || view === 'countries')) rel = `issues/${issue}/${cc ? `${cc}/` : ''}`;
    const next = new URLSearchParams();
    const sector = p.get('s');
    if (sector && /^[a-z]+$/.test(sector)) next.set('s', sector);
    if (view === 'domain' && p.get('d')) next.set('d', p.get('d'));
    const clause = p.get('c');
    const to = clause && /^\d+$/.test(clause) ? `#c${clause}${sector && sector !== 'all' ? `-${sector}` : ''}` : p.get('to') ? `#${encodeURIComponent(p.get('to'))}` : '';
    location.replace(`${prefix}${rel}${next.toString() ? `?${next}` : ''}${to}`);
    return true;
  }
  if (query.get('lang') === 'en' && lang === 'ar' && location.pathname === '/') { location.replace('/en/'); return true; }
  return false;
}

// Tabs over the sector panels: one panel shows, the others wait, and the address remembers the choice.
function tabs() {
  const want = new URLSearchParams(location.search).get('s');
  const target = location.hash ? doc.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  doc.querySelectorAll('[data-tabs]').forEach((box, bi) => {
    const panels = [...box.children].filter((n) => n.classList.contains('panel'));
    if (panels.length < 2) { box.classList.add('single'); return; }
    const list = doc.createElement('div');
    list.className = 'tablist';
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', box.dataset.label || '');
    const buttons = panels.map((panel) => {
      const sector = panel.dataset.sector;
      panel.id = panel.id || `panel-${bi}-${sector}`;
      const b = doc.createElement('button');
      b.type = 'button';
      b.id = `tab-${bi}-${sector}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', panel.id);
      b.dataset.sector = sector;
      b.textContent = panel.querySelector('.panel-h').textContent;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', b.id);
      panel.removeAttribute('aria-label');
      list.append(b);
      return b;
    });
    const slot = box.dataset.slot ? doc.getElementById(box.dataset.slot) : null;
    (slot || box).prepend(list);
    box.classList.add('tabbed');
    const select = (sector, { focus = false, remember = false } = {}) => {
      for (const b of buttons) {
        const on = b.dataset.sector === sector;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        doc.getElementById(b.getAttribute('aria-controls')).hidden = !on;
        if (on && focus) b.focus();
      }
      if (remember) {
        const url = new URL(location.href);
        if (sector === 'all') url.searchParams.delete('s'); else url.searchParams.set('s', sector);
        url.hash = '';
        history.replaceState(null, '', url);
      }
    };
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[role="tab"]');
      if (b) select(b.dataset.sector, { remember: true });
    });
    list.addEventListener('keydown', (e) => {
      const i = buttons.indexOf(doc.activeElement);
      if (i < 0) return;
      const forward = lang === 'ar' ? 'ArrowLeft' : 'ArrowRight';
      const back = lang === 'ar' ? 'ArrowRight' : 'ArrowLeft';
      let j = null;
      if (e.key === forward) j = (i + 1) % buttons.length;
      else if (e.key === back) j = (i - 1 + buttons.length) % buttons.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = buttons.length - 1;
      if (j === null) return;
      e.preventDefault();
      select(buttons[j].dataset.sector, { focus: true, remember: true });
    });
    const holding = target && box.contains(target) ? target.closest('.panel').dataset.sector : null;
    const first = holding || (buttons.some((b) => b.dataset.sector === want) ? want : 'all');
    select(buttons.some((b) => b.dataset.sector === first) ? first : buttons[0].dataset.sector);
  });
}

// A cited row opens with its citation showing.
function stamp() {
  if (!location.hash) return;
  const el = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!el || !el.closest('.clauses')) return;
  el.classList.add('stamped');
  const d = el.querySelector('details');
  if (d) d.open = true;
  requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
}

async function copyText(text, node) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const range = doc.createRange();
    range.selectNodeContents(node);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return false;
  }
}

function copies() {
  doc.querySelectorAll('[data-copy]').forEach((b) => {
    b.hidden = false;
    b.addEventListener('click', async () => {
      const box = b.closest('.slip, .cite-issue');
      const node = box.querySelector(`[data-quote="${b.dataset.copy}"]`);
      const text = [...node.querySelectorAll('p')].map((p) => p.innerText.trim()).join('\n') || node.innerText.trim();
      const done = box.querySelector('.done');
      const ok = await copyText(text, node);
      if (ok && done) {
        done.textContent = done.dataset.copied;
        setTimeout(() => { done.textContent = ''; }, 1800);
      }
    });
  });
}

// The live check: the browser asks two public resolvers and evaluates the answers with the same engine as the
// weekly scan. Nothing typed here reaches this site.
async function live() {
  const form = doc.querySelector('.p-check .check-form');
  if (!form) return;
  const input = form.querySelector('input');
  const button = form.querySelector('button');
  const status = doc.getElementById('status');
  const box = doc.getElementById('result');
  const [dns, checks, views] = await Promise.all([import('./engine/dns.js'), import('./engine/checks.js'), import('./views.js')]);
  const getJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [B, summary] = await Promise.all([getJson('/data/bundle.json'), getJson('/data/summary.json')]);
  if (!B) return;
  const k = views.kit({ B, D: { summary: summary && summary.checks ? summary : null, history: [] }, lang, route: { page: 'check', rel: 'check/' }, pictures: [] });
  const t = (key) => k.t(key);
  const suffixFor = (domain) => [...B.scope.suffixes].sort((a, b) => b.suffix.length - a.suffix.length).find((x) => domain.endsWith(`.${x.suffix}`));
  async function run() {
    const domain = dns.cleanDomain(input.value);
    status.classList.remove('error');
    if (!domain) { status.textContent = t('domain_invalid'); status.classList.add('error'); return; }
    history.replaceState(null, '', `?d=${encodeURIComponent(domain)}`);
    button.disabled = true;
    status.textContent = t('domain_running');
    box.replaceChildren();
    try {
      const resolver = dns.createResolver({ timeout: 8000 });
      const hit = suffixFor(domain);
      const chain = hit ? await checks.suffixChain(hit.suffix, resolver) : undefined;
      const obs = await checks.observeDns(domain, resolver);
      if (obs.dns.state === 'nxdomain') { status.textContent = t('domain_nx'); return; }
      if (obs.dns.state !== 'live') { status.textContent = obs.dns.rcode === 'ERROR' ? t('domain_error') : t('domain_broken'); status.classList.add('error'); return; }
      status.textContent = '';
      box.replaceChildren(toDom(views.checkResult(k, domain, checks.evaluate(obs, { chain }))));
      box.querySelector('h2').setAttribute('tabindex', '-1');
      box.querySelector('h2').focus({ preventScroll: false });
    } catch {
      status.textContent = t('domain_error');
      status.classList.add('error');
    } finally {
      button.disabled = false;
    }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  const asked = new URLSearchParams(location.search).get('d');
  if (asked) { input.value = asked; run(); }
}

// Each part rises in as it arrives, a little after the one before it in the same block; the parts already on screen
// rise as the page opens, with the title. Nothing is hidden when motion is reduced or the observer is missing.
function motion() {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const parts = [...doc.querySelectorAll('[data-rise]')];
  const order = new Map();
  for (const n of parts) {
    const i = order.get(n.parentElement) || 0;
    order.set(n.parentElement, i + 1);
    n.style.setProperty('--i', String(Math.min(i, 6)));
  }
  root.classList.add('motion');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
  // Two frames later, so what is on screen is painted at its starting point once and then rises.
  requestAnimationFrame(() => requestAnimationFrame(() => { for (const n of parts) io.observe(n); }));
  addEventListener('beforeprint', () => parts.forEach((p) => p.classList.add('in')));
}

if (!legacy()) {
  tabs();
  copies();
  stamp();
  motion();
  live();
}
