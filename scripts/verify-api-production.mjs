import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const port = await reservePort();
const child = spawn('pnpm', ['--filter', '@budstar/api', 'run', 'start:prod'], {
  cwd: new URL('..', import.meta.url),
  detached: true,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    CORS_ORIGINS: 'https://smoke.invalid',
    TRUST_PROXY_HOPS: '0',
    AUTH_TOKEN_SECRET: 'smoke-only-secret',
    DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:1/smoke',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += String(chunk);
});
child.stderr.on('data', (chunk) => {
  output += String(chunk);
});

try {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Production API exited early:\n${output}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      const body = await response.json();
      if (
        response.ok &&
        body.status === 'ok' &&
        body.readiness === 'degraded' &&
        body.degradedReasons.includes('tencent-sms-not-configured') &&
        body.degradedReasons.includes('second-factor-not-configured')
      ) {
        console.log('Production API health smoke passed');
        process.exitCode = 0;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (process.exitCode !== 0) {
    throw new Error(`Production API health check timed out:\n${output}`);
  }
} finally {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // The child may already have exited.
  }
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to reserve a smoke-test port'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}
