const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
const publish = process.argv.includes('--publish');
const apiOnly = process.argv.includes('--api-only');
const cloudflared = path.join(root, '.tools', 'cloudflared.exe');
const children = [];
const cmd = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
const npm = (args) => [cmd, ['/d', '/s', '/c', 'npm.cmd', ...args]];
const npx = (args) => [cmd, ['/d', '/s', '/c', 'npx.cmd', ...args]];

function toWslPath(windowsPath) {
  return windowsPath
    .replace(/^([A-Za-z]):/, (_match, drive) => `/mnt/${drive.toLowerCase()}`)
    .replaceAll('\\', '/');
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...options.env },
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    });
    let output = '';
    if (options.capture) {
      child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
      child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk); });
    }
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve(output) : reject(new Error(`${command} exited with code ${code}`)));
  });
}

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    windowsHide: true,
  });
  children.push(child);
  child.once('exit', (code) => {
    if (!stopping && code) {
      console.error(`${command} stopped with code ${code}`);
      void stopAll();
      process.exitCode = code;
    }
  });
  return child;
}

let stopping = false;
let database;
async function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  if (database) await database.stop().catch(() => {});
}

async function waitFor(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

async function startTunnel() {
  if (!existsSync(cloudflared)) {
    throw new Error('Missing .tools/cloudflared.exe; download the official Cloudflare Tunnel binary first.');
  }
  return new Promise((resolve, reject) => {
    const child = spawn(cloudflared, ['tunnel', '--url', 'http://127.0.0.1:3000', '--no-autoupdate'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    children.push(child);
    let settled = false;
    const onData = (chunk) => {
      const message = chunk.toString();
      process.stdout.write(message);
      const match = message.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !settled) { settled = true; resolve(match[0]); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('error', reject);
    child.once('exit', (code) => { if (!settled) reject(new Error(`cloudflared exited with code ${code}`)); });
  });
}

async function startWireGuardAgent() {
  if (await isPortOpen(51821)) return;
  if (!process.env.WIREGUARD_API_KEY) {
    throw new Error('WIREGUARD_API_KEY is required to start the WireGuard agent.');
  }

  const agentDir = `${toWslPath(root)}/infrastructure/wg-agent`;
  const shellAgentDir = `'${agentDir.replaceAll("'", "'\\''")}'`;
  const wslEnv = [process.env.WSLENV, 'AGENT_API_KEY/u'].filter(Boolean).join(':');
  start('wsl.exe', [
    '-d', 'Ubuntu', '-u', 'root', '--', 'bash', '-lc',
    `wg show wg0 >/dev/null 2>&1 || wg-quick up wg0; cd ${shellAgentDir}; exec env WG_SUBNET_PREFIX=10.8.0 node index.js`,
  ], {
    AGENT_API_KEY: process.env.WIREGUARD_API_KEY,
    WSLENV: wslEnv,
  });
  await waitFor('http://127.0.0.1:51821/status');
}

async function main() {
  const databasePort = Number(process.env.LOCAL_POSTGRES_PORT || 55432);
  const databaseUrl = `postgresql://sali:sali_password@127.0.0.1:${databasePort}/sali?schema=public`;
  const localEnv = {
    DATABASE_URL: databaseUrl,
    API_URL: 'http://127.0.0.1:3000',
    TELEGRAM_MODE: 'polling',
    VPN_PROVIDER: process.env.VPN_PROVIDER || 'wireguard',
  };
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = path.join(process.env.TEMP || process.env.TMP || root, 'sali-vpn-postgres');
  database = new EmbeddedPostgres({
    // PostgreSQL's Windows binaries cannot initialize inside a path containing
    // Cyrillic characters, so use Windows' ASCII 8.3 temp path on this machine.
    databaseDir,
    user: 'sali',
    password: 'sali_password',
    port: databasePort,
    persistent: true,
    // Do not inherit a legacy Windows code page (for example WIN1251):
    // Prisma/PostgreSQL migrations and JSON payloads require UTF-8.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
    await database.initialise();
  }
  if (!(await isPortOpen(databasePort))) {
    await database.start();
    await database.createDatabase('sali').catch((error) => {
      if (!String(error).includes('already exists')) throw error;
    });
  } else {
    // A previous local launcher may already own this persistent database.
    database = undefined;
  }


  if (localEnv.VPN_PROVIDER === 'wireguard') {
    await startWireGuardAgent();
  }

  await run(...npm(['run', 'prisma:generate']), { env: localEnv });
  await run(process.execPath, [path.join(root, 'scripts', 'run-prisma.js'), 'migrate', 'deploy'], { env: localEnv });
  await run(...npm(['run', 'prisma:seed', '--workspace=apps/api']), { env: localEnv });
  start(...npm(['run', 'dev:api']), localEnv);
  await waitFor('http://127.0.0.1:3000/api/v1/plans', 90000);

  if (!apiOnly) {
    start(...npm(['run', 'dev:web']), { VITE_API_URL: 'http://127.0.0.1:3000' });
    await waitFor('http://127.0.0.1:5173', 60000);
  }

  if (publish) {
    const publicApiUrl = await startTunnel();
    console.log(`Public API: ${publicApiUrl}`);
    await run(...npm(['run', 'build', '--workspace=apps/web']), { env: { VITE_API_URL: publicApiUrl } });
    await run(...npx(['wrangler', 'deploy']));
  }

  if (!apiOnly) {
    start(...npm(['run', 'dev:bot']), localEnv);
    start(...npm(['run', 'dev:support-bot']), localEnv);
  }
  console.log('Sali local stack is running. Press Ctrl+C to stop.');
}

process.once('SIGINT', () => void stopAll());
process.once('SIGTERM', () => void stopAll());
main().catch(async (error) => {
  console.error(error);
  await stopAll();
  process.exitCode = 1;
});
