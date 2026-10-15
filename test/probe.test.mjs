import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { certVerdict, pqCapable } from '../src/probe.mjs';
import { root } from './helpers.mjs';

// A small PKI: a root, an intermediate, a leaf for localhost, a leaf for another name, and a self signed certificate.
function pki() {
  const dir = mkdtempSync(join(tmpdir(), 'probe-pki-'));
  const ssl = (...args) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });
  writeFileSync(join(dir, 'ca.ext'), 'basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n');
  writeFileSync(join(dir, 'leaf.ext'), 'basicConstraints=CA:FALSE\nsubjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\n');
  writeFileSync(join(dir, 'other.ext'), 'basicConstraints=CA:FALSE\nsubjectAltName=DNS:other.test\nextendedKeyUsage=serverAuth\n');
  const ec = ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes'];
  ssl('req', '-x509', ...ec, '-keyout', 'root.key', '-out', 'root.crt', '-days', '3', '-subj', '/CN=Probe Test Root', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign');
  for (const [name, signer, ext, cn] of [['inter', 'root', 'ca.ext', 'Probe Test Intermediate'], ['leaf', 'inter', 'leaf.ext', 'localhost'], ['other', 'inter', 'other.ext', 'other.test']]) {
    ssl('req', ...ec, '-keyout', `${name}.key`, '-out', `${name}.csr`, '-subj', `/CN=${cn}`);
    ssl('x509', '-req', '-in', `${name}.csr`, '-CA', `${signer}.crt`, '-CAkey', `${signer}.key`, '-CAcreateserial', '-out', `${name}.crt`, '-days', '2', '-extfile', ext);
  }
  ssl('req', '-x509', ...ec, '-keyout', 'self.key', '-out', 'self.crt', '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost');
  return dir;
}

test('web probes against real local servers: chains, names, HSTS, redirects, security.txt and TLS versions', { skip: !pqCapable() && 'needs OpenSSL 3.5 for the hybrid group' }, () => {
  const dir = pki();
  try {
    const r = spawnSync(process.execPath, [join(root, 'test/fixtures/probe-world.mjs'), dir], { env: { ...process.env, NODE_EXTRA_CA_CERTS: join(dir, 'root.crt') }, encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 0, r.stderr);
    const o = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.equal(o.full.state, 'ok');
    assert.deepEqual([o.full.https.certOk, o.full.https.chainComplete], [true, true], 'a full chain to a trusted root');
    assert.equal(o.full.https.hsts.maxAge, 63072000);
    assert.equal(o.full.http.state, 'redirects-https');
    assert.deepEqual([o.full.tls.tls13, o.full.tls.pq, o.full.tls.tls10, o.full.tls.tls11], [true, true, false, false]);
    assert.equal(o.full.securityTxt.valid, true);
    assert.deepEqual([o.gap.https.certOk, o.gap.https.chainComplete], [true, false], 'a missing intermediate is noted but passes');
    assert.equal(o.self.https.certProblem, 'self-signed');
    assert.equal(o.other.https.certProblem, 'name-mismatch');
    assert.equal(o.soft404.securityTxt.found, false, 'an HTML page at the address is not a security.txt');
    assert.deepEqual([o.plainOnly.https.ok, o.plainOnly.https.closed, o.plainOnly.http.state], [false, true, 'serves-http']);
    assert.equal(o.nothing.state, 'none', 'nothing listening means no website');
    assert.deepEqual([o.classicTls.tls13, o.classicTls.pq], [false, false]);
    assert.deepEqual([o.legacyTls.tls10, o.legacyTls.tls11], [true, true]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('certificate verdicts from the socket facts', () => {
  const future = new Date(Date.now() + 864e5).toUTCString();
  const past = new Date(Date.now() - 864e5).toUTCString();
  const cert = { subject: { CN: 'example.com' }, subjectaltname: 'DNS:example.com', valid_to: future };
  assert.deepEqual(certVerdict('example.com', { authorized: true, cert }), { certOk: true, certProblem: null, chainComplete: true });
  assert.equal(certVerdict('example.com', { authorized: false, error: 'CERT_HAS_EXPIRED', cert: { ...cert, valid_to: past } }).certProblem, 'expired');
  assert.equal(certVerdict('example.com', { authorized: false, error: 'DEPTH_ZERO_SELF_SIGNED_CERT', cert }).certProblem, 'self-signed');
  assert.deepEqual(certVerdict('example.com', { authorized: false, error: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', cert }), { certOk: true, certProblem: null, chainComplete: false });
  assert.equal(certVerdict('www.example.org', { authorized: false, error: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', cert }).certProblem, 'name-mismatch');
  assert.equal(certVerdict('example.com', { authorized: false, error: 'SOMETHING_ELSE', cert }).certProblem, 'untrusted');
  assert.equal(certVerdict('example.com', null).certProblem, 'handshake-failed');
});
