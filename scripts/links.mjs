// External links in the README, the notice and the standards each check cites. A 404 or 410 fails;
// refusals, rate limits and network errors are reported only, because the network can be narrower than the web.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const text = ['README.md', 'NOTICE.md', 'SECURITY.md'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
const checks = JSON.parse(readFileSync(join(root, 'data/src/checks.json'), 'utf8'));
const urls = new Set([...text.matchAll(/https:\/\/[^\s)>"'`|]+/g)].map((m) => m[0].replace(/[.,]+$/, '')).filter((u) => !u.includes('__') && !u.includes('example.') && !/github\.com\/SiteQ8\/?$/.test(u)));
for (const c of Object.values(checks.checks)) for (const r of c.refs) urls.add(r.url);
const dead = [];
const soft = [];
let okCount = 0;
await Promise.all([...urls].map(async (u) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    let res = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 link check' } });
    if (res.status === 405 || res.status === 403) res = await fetch(u, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 link check' } });
    if (res.status === 404 || res.status === 410) dead.push(`${res.status} ${u}`);
    else if (res.ok) okCount += 1;
    else soft.push(`${res.status} ${u}`);
  } catch (e) {
    soft.push(`${e.name === 'AbortError' ? 'timeout' : 'network'} ${u}`);
  } finally {
    clearTimeout(timer);
  }
}));
for (const s of soft) console.log(`  unverified ${s}`);
for (const d of dead) console.error(`  dead ${d}`);
console.log(`links: ${okCount} ok, ${soft.length} unverified, ${dead.length} dead of ${urls.size}`);
process.exit(dead.length ? 1 : 0);
