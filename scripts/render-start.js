// Render: one web service runs the whole backend.
//   1. applies database migrations (Neon) and the idempotent seed (plans, servers)
//   2. starts the API on Render's $PORT
//   3. starts the main bot and the support bot; they talk to the API over localhost
// If any process dies, the whole service exits so Render restarts it cleanly.
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiDir = path.join(root, 'apps/api');
const port = process.env.PORT || process.env.API_PORT || '10000';

for (const name of ['DATABASE_URL', 'INTERNAL_API_KEY', 'JWT_SECRET', 'TELEGRAM_BOT_TOKEN']) {
  if (!process.env[name]) {
    console.error(`[render] ${name} is not set — add it in Render → Environment.`);
    process.exit(1);
  }
}

function runOnce(label, args, cwd) {
  console.log(`[render] ${label}…`);
  const result = spawnSync(process.execPath, args, { cwd, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[render] ${label} failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

const prismaCli = require.resolve('prisma/build/index.js', { paths: [apiDir, root] });
runOnce('Applying database migrations', [prismaCli, 'migrate', 'deploy'], apiDir);
runOnce('Seeding plans and servers', ['prisma/seed.js'], apiDir);

const children = [];
let stopping = false;

function start(label, script, extraEnv) {
  const child = spawn(process.execPath, [script], {
    cwd: path.dirname(path.dirname(script)),
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[render] ${label} stopped (${signal ?? `exit ${code}`}) — restarting the service.`);
    shutdown(1);
  });
  children.push(child);
  console.log(`[render] ${label} started (pid ${child.pid})`);
}

function shutdown(code) {
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 3000).unref();
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

const localApi = `http://127.0.0.1:${port}`;
start('API', path.join(apiDir, 'dist/main.js'), { API_PORT: port });

// Give the API a moment to bind before the bots start calling it.
setTimeout(() => {
  start('Bot', path.join(root, 'apps/bot/dist/index.js'), { API_URL: localApi, TELEGRAM_MODE: 'polling' });
  if (process.env.SUPPORT_BOT_TOKEN) {
    start('Support bot', path.join(root, 'apps/support-bot/dist/index.js'), { API_URL: localApi });
  } else {
    console.log('[render] SUPPORT_BOT_TOKEN is not set — support bot skipped.');
  }
}, 4000);
