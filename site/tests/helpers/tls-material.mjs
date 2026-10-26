// Synthetic, short-lived test identities. No operator certificate or trust store is read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PERMISSIONS, validatePermissions } from '../../server/permissions.mjs';
import { newOperator } from '../../server/operator.mjs';
import { execFileSync } from 'node:child_process';

export function tlsMaterial({ hostname = 'kibitz.test', permissions = [...PERMISSIONS] } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-test-tls-')));
  fs.chmodSync(dir, 0o700);
  const tls = path.join(dir, 'tls'); fs.mkdirSync(tls, { mode: 0o700 });
  const key = path.join(tls, 'key.pem'), cert = path.join(tls, 'cert.pem'), config = path.join(tls, 'openssl.cnf');
  const close = () => fs.rmSync(dir, { recursive: true, force: true });
  try {
    fs.writeFileSync(config, '[req]\ndistinguished_name=dn\n[dn]\n[fixture]\nsubjectAltName=IP:127.0.0.1,DNS:localhost,DNS:' + hostname + '\nbasicConstraints=critical,CA:TRUE\n');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1', '-subj', '/CN=localhost',
      '-config', config, '-extensions', 'fixture', '-keyout', key, '-out', cert], { stdio: 'ignore', timeout: 20_000 });
    fs.chmodSync(key, 0o600);
    const operator = path.join(tls, 'operator.json'), setup = newOperator();
    fs.writeFileSync(operator, JSON.stringify(setup), { mode: 0o600 });
    const policy = path.join(tls, 'permissions.json');
    fs.writeFileSync(policy, JSON.stringify(validatePermissions({ version: 1, operator: setup.id, allow: permissions }, setup)), { mode: 0o600 });
    return { policy, dir, key, cert, operator, operatorId: setup.id, secret: setup.secret, ca: fs.readFileSync(cert), close };
  } catch (error) { close(); throw error; }
}
