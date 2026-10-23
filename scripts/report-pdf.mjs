// Prints the readiness report to PDF in both languages, from the printed pages of the site, with a headless
// Chrome or Chromium: the same sheets a reader sees, saved beside the page as
// docs/readiness/report/gbaseline-readiness-ar.pdf and -en.pdf. The readiness workflow runs it after every census.
//   node scripts/report-pdf.mjs            (CHROME=/path/to/chrome when it is not on the usual paths)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { LANGS, pathOf, REPORT_REL, reportPdf } from '../docs/assets/views.js';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(here, 'docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

export function findChrome() {
  const tried = [process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
  for (const c of tried) {
    if (c.startsWith('/') ? existsSync(c) : spawnSync('which', [c]).status === 0) return c;
  }
  return null;
}

function run(cmd, args, timeout = 120000) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stderr }); });
  });
}

async function serve() {
  const server = createServer(async (req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(docs, p);
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { res.writeHead(404); res.end(); return; }
    try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(join(docs, 'data/readiness.json'))) { console.log('report: no readiness census yet, nothing to print'); process.exit(0); }
  const chrome = findChrome();
  if (!chrome) { console.error('report: no Chrome or Chromium found; set CHROME'); process.exit(1); }
  const server = await serve();
  const port = server.address().port;
  try {
    for (const lang of LANGS) {
      const out = join(docs, reportPdf(lang).slice(1));
      const url = `http://127.0.0.1:${port}${pathOf(lang, REPORT_REL)}`;
      const profile = mkdtempSync(join(tmpdir(), 'report-chrome-'));
      // Chrome is run without blocking, so this process can serve it the pages while it prints.
      const r = await run(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-proxy-server', '--disable-background-networking', '--no-first-run', `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=8000', `--print-to-pdf=${out}`, url]);
      rmSync(profile, { recursive: true, force: true });
      if (r.status !== 0 || !existsSync(out)) { console.error(r.stderr); throw new Error(`report: Chrome could not print ${url}`); }
      console.log(`report: ${out.replace(`${here}/`, '')} (${Math.round((await stat(out)).size / 1024)} KB)`);
    }
  } finally {
    server.close();
  }
}
