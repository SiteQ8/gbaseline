// Runs in a child process with NODE_EXTRA_CA_CERTS pointing at a test root, so certificate trust is real.
// Starts local servers for each scenario, probes them with the observatory's code and prints the results as JSON.
import https from 'node:https';
import http from 'node:http';
import tls from 'node:tls';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { observeWeb, probeTls } from '../../src/probe.mjs';

const dir = process.argv[2];
const f = (n) => readFileSync(join(dir, n));
const leaf = { key: f('leaf.key'), cert: Buffer.concat([f('leaf.crt'), f('inter.crt')]) };
const gap = { key: f('leaf.key'), cert: f('leaf.crt') };
const self = { key: f('self.key'), cert: f('self.crt') };
const other = { key: f('other.key'), cert: Buffer.concat([f('other.crt'), f('inter.crt')]) };
const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
const port = (srv) => srv.address().port;
const site = (opts, extra = {}) => https.createServer({ ...opts, minVersion: 'TLSv1.2', ...extra }, (req, res) => {
  if (req.url === '/.well-known/security.txt' && !extra.soft404) { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Contact: mailto:security@example.test\nExpires: 2030-01-01T00:00:00Z\n'); return; }
  if (extra.soft404) { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><body>home</body></html>'); return; }
  res.writeHead(200, { 'strict-transport-security': 'max-age=63072000; includeSubDomains; preload', 'content-type': 'text/html' }); res.end('ok');
});
const redirectTo = (p) => http.createServer((req, res) => { res.writeHead(301, { location: `https://localhost:${p}/` }); res.end(); });
const servesPlain = () => http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('plain'); });
const free = async () => { const s = await listen(http.createServer()); const p = port(s); await new Promise((r) => s.close(r)); return p; };
const hosts = { apex: { v4: 1, v6: 0 }, www: { v4: 0, v6: 0 } };
const opts = (hp, sp) => ({ timeout: 3000, httpsPort: sp, httpPort: hp, agent: 'test' });
const out = {};
const servers = [];
async function scenario(name, httpsSrv, httpSrv) {
  if (httpsSrv) servers.push(await listen(httpsSrv));
  if (httpSrv && typeof httpSrv !== 'function') servers.push(await listen(httpSrv));
  const sp = httpsSrv ? port(httpsSrv) : await free();
  let hp;
  if (typeof httpSrv === 'function') { const s = await listen(httpSrv(sp)); servers.push(s); hp = port(s); } else hp = httpSrv ? port(httpSrv) : await free();
  out[name] = await observeWeb('localhost', hosts, opts(hp, sp));
}
await scenario('full', site(leaf), redirectTo);
await scenario('gap', site(gap), redirectTo);
await scenario('self', site(self), redirectTo);
await scenario('other', site(other), redirectTo);
await scenario('soft404', site(leaf, { soft404: true }), redirectTo);
await scenario('plainOnly', null, servesPlain());
await scenario('nothing', null, null);
const classic = await listen(tls.createServer({ ...leaf, minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2' }, (s) => s.end()));
const legacy = await listen(tls.createServer({ ...leaf, minVersion: 'TLSv1', maxVersion: 'TLSv1.3', ciphers: 'ALL:@SECLEVEL=0' }, (s) => s.end()));
servers.push(classic, legacy);
out.classicTls = await probeTls('localhost', { port: port(classic), timeout: 3000 });
out.legacyTls = await probeTls('localhost', { port: port(legacy), timeout: 3000 });
for (const s of servers) s.close();
console.log(JSON.stringify(out));
