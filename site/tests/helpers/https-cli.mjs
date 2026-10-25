import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const defaultScript = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
export function httpsCli({ root, key, cert, extra = [], library = ':memory:', usage = ':memory:', script = defaultScript }) {
  const child = spawn(process.execPath, [script, root, '--api', '--env=', '--library', library, '--usage', usage, '--index', '_test.html',
    '--port', '0', '--tls-key', key, '--tls-cert', cert, ...extra], {
    env: { ...process.env, AI_PROVIDER: 'mock', EMBEDDING_PROVIDER: 'mock', AI_LOCAL_ONLY: '1',
      ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', OLLAMA_MODEL: '', BROWSER_MODEL_URL: '', BROWSER_RUNTIME: 'wllama' },
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
      const url = /^Serving Kibitz at (https:\/\/127\.0\.0\.1:\d+\/)$/m.exec(output)?.[1];
      if (url) { clearTimeout(timer); resolve({ child, base: url.slice(0, -1), output: () => output, close }); }
    };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.once('error', () => { clearTimeout(timer); reject(Error('HTTPS fixture could not start')); });
    child.once('exit', () => { clearTimeout(timer); reject(Error('HTTPS fixture exited before listening')); });
  });
}
