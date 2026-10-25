import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const defaultScript = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
export function httpsCli({ root, key, cert, operatorSecret, extra = [], library = ':memory:', usage = ':memory:', script = defaultScript, final = false, nodeArgs = [], env = {} }) {
  const child = spawn(process.execPath, [...nodeArgs, script, root, '--api', '--env=', '--library', library, '--usage', usage, '--index', '_test.html',
    '--port', '0', ...(script === defaultScript ? ['--operator', path.join(path.dirname(key), 'operator.json'), '--permissions', path.join(path.dirname(key), 'permissions.json'), '--sessions', path.join(path.dirname(key), '..', 'sessions.sqlite')] : []), ...(final || script !== defaultScript ? [] : ['--legacy-origin']), '--tls-key', key, '--tls-cert', cert, ...extra], {
    env: { ...process.env, AI_PROVIDER: 'mock', EMBEDDING_PROVIDER: 'mock', AI_LOCAL_ONLY: '1',
      ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', OLLAMA_MODEL: '', BROWSER_MODEL_URL: '', BROWSER_RUNTIME: 'wllama', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const close = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      child.once('exit', () => { clearTimeout(timer); resolve(null); }); child.kill('SIGTERM');
    });
  };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('HTTPS fixture startup timed out')); }, 20_000);
    const collect = data => {
      output += data.toString();
      if (output.length > 256 * 1024) { child.kill('SIGKILL'); clearTimeout(timer); reject(Error('HTTPS fixture output exceeded its limit')); return; }
      const url = /^Serving Kibitz at (https:\/\/(?:127\.0\.0\.1|(?:[a-z0-9-]+\.)+test):\d+\/)$/m.exec(output)?.[1];
      if (url) {
        clearTimeout(timer); const base = url.slice(0, -1);
        resolve({ child, base, output: () => output, close, login: async (cookie = '', { secret = operatorSecret, migrate = true } = {}) => {
          const response = await tlsRequest(base + '/api/library/session', fs.readFileSync(cert), { cookie, body: { secret, migrate } });
          if (response.status !== 200) {
            const code = response.data()?.error?.code;
            const category = ['permission_unavailable', 'unavailable', 'session_expired', 'bad_request', 'forbidden', 'rate_limited'].includes(code) ? code : 'other';
            throw Error('Synthetic operator sign-in failed: ' + response.status + ' ' + category);
          }
          return response.headers['set-cookie'].find(value => value.startsWith('__Host-kibitz_session=')).split(';')[0];
        } });
      }
    };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.once('error', () => { clearTimeout(timer); reject(Error('HTTPS fixture could not start')); });
    child.once('exit', () => { clearTimeout(timer); reject(Error('HTTPS fixture exited before listening')); });
  });
}

export const tlsRequest = (url, ca, { cookie = '', body = undefined, method = body === undefined ? 'GET' : 'POST', headers = {} } = {}) => new Promise((resolve, reject) => {
  const req = https.request(url, { ca, agent: false, timeout: 5000, method, servername: new URL(url).hostname === '127.0.0.1' ? '' : new URL(url).hostname,
    lookup: (_name, _options, done) => done(null, [{ address: '127.0.0.1', family: 4 }]),
    headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers } }, res => {
    let text = ''; res.setEncoding('utf8'); res.on('data', part => text += part);
    res.once('aborted', () => reject(Error('TLS fixture response aborted'))); res.once('error', reject);
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, data: () => JSON.parse(text) }));
  });
  req.once('error', reject); req.once('timeout', () => req.destroy(Error('TLS fixture timed out'))); req.end(body === undefined ? undefined : JSON.stringify(body));
});
