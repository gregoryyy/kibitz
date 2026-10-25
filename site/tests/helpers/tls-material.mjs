// Synthetic, short-lived test identities. No operator certificate or trust store is read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newOperator } from '../../server/operator.mjs';
import { execFileSync } from 'node:child_process';

export function tlsMaterial({ hostname = 'kibitz.test' } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-test-tls-')));
  fs.chmodSync(dir, 0o700);
  const key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem'), config = path.join(dir, 'openssl.cnf');
  const close = () => fs.rmSync(dir, { recursive: true, force: true });
  try {
    fs.writeFileSync(config, '[req]\ndistinguished_name=dn\n[dn]\n[fixture]\nsubjectAltName=IP:127.0.0.1,DNS:localhost,DNS:' + hostname + '\nbasicConstraints=critical,CA:TRUE\n');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1', '-subj', '/CN=localhost',
      '-config', config, '-extensions', 'fixture', '-keyout', key, '-out', cert], { stdio: 'ignore', timeout: 20_000 });
    fs.chmodSync(key, 0o600);
    const operator = path.join(dir, 'operator.json'), setup = newOperator();
    fs.writeFileSync(operator, JSON.stringify(setup), { mode: 0o600 });
    return { dir, key, cert, operator, secret: setup.secret, ca: fs.readFileSync(cert), close };
  } catch (error) { close(); throw error; }
}
