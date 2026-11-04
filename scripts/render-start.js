// Render: one web service runs the whole backend.
//   1. applies database migrations (Neon) and the idempotent seed (plans, servers)
//   2. starts the API on Render's $PORT
//   3. starts the main bot and the support bot; they talk to the API over localhost
// If the API dies the whole service exits so Render restarts it; bots restart on their own.
const { spawn, spawnSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
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

const children = new Map();

// Bot states for GET /api/v1/health/bots (the API reads this file).
const STATUS_FILE = process.env.SALI_BOT_STATUS_FILE || '/tmp/sali-bots.json';
process.env.SALI_BOT_STATUS_FILE = STATUS_FILE;
const botStatus = {};
function setStatus(label, state, extra = {}) {
  botStatus[label] = { state, at: new Date().toISOString(), ...extra };
  try { writeFileSync(STATUS_FILE, JSON.stringify(botStatus)); } catch { /* status is best-effort */ }
  console.log(`[render] status ${label}: ${state}${extra.detail ? ` — ${extra.detail}` : ''}`);
}
let stopping = false;

// The API is essential: if it dies, the whole service exits and Render restarts it.
// A bot is not: it restarts on its own with a growing delay, so the API stays up
// (e.g. while the same bot is still running somewhere else and Telegram answers 409).
function start(label, script, extraEnv, { essential = false, attempt = 0 } = {}) {
  const child = spawn(process.execPath, [script], {
    cwd: path.dirname(path.dirname(script)),
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });
  const startedAt = Date.now();
  children.set(label, child);
  console.log(`[render] ${label} started (pid ${child.pid})`);
  if (!essential) setStatus(label, 'running', { username: extraEnv.SALI_BOT_USERNAME });
  child.on('exit', (code, signal) => {
    children.delete(label);
    if (stopping) return;
    const why = signal ?? `exit ${code}`;
    if (essential) {
      console.error(`[render] ${label} stopped (${why}) — restarting the service.`);
      shutdown(1);
      return;
    }
    setStatus(label, 'crashed', { detail: why });
    const next = Date.now() - startedAt > 60_000 ? 0 : attempt + 1;
    const delay = Math.min(5 * 60_000, 5_000 * 2 ** next);
    console.error(`[render] ${label} stopped (${why}) — restarting in ${Math.round(delay / 1000)}s.`);
    setTimeout(() => { if (!stopping) start(label, script, extraEnv, { essential, attempt: next }); }, delay).unref?.();
  });
}

function shutdown(code) {
  stopping = true;
  for (const child of children.values()) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 3000).unref();
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

const localApi = `http://127.0.0.1:${port}`;
start('API', path.join(apiDir, 'dist/main.js'), { API_PORT: port }, { essential: true });

/** Removes the usual copy-paste damage from a bot token: spaces, quotes, a "bot" prefix. */
function cleanToken(raw) {
  return String(raw ?? '').trim().replace(/^["'`]+|["'`]+$/g, '').replace(/^bot(?=\d)/i, '').trim();
}

/** Asks Telegram whether a token is valid, so a wrong token is reported once, clearly. */
async function checkToken(label, token) {
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) {
    console.error(`[render] ${label}: the token has a wrong format (expected 1234567890:AA...). Copy it again from @BotFather → /mybots → API Token.`);
    setStatus(label, 'bad-token', { detail: 'wrong format' });
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10_000) });
    const body = await res.json().catch(() => ({}));
    if (body.ok) {
      console.log(`[render] ${label}: token OK → @${body.result.username}`);
      return body.result.username;
    }
    console.error(`[render] ${label}: Telegram rejected the token for bot id ${token.split(':')[0]} (${res.status} ${body.description ?? ''}). It is wrong or was revoked — take the current one from @BotFather → /mybots → API Token and put it in Render → Environment.`);
    setStatus(label, 'bad-token', { detail: `Telegram ${res.status} for bot id ${token.split(':')[0]}` });
    return false;
  } catch (error) {
    console.warn(`[render] ${label}: could not reach Telegram to check the token (${error.message}); starting anyway.`);
    setStatus(label, 'starting', { detail: 'token not verified: ' + error.message });
    return true;
  }
}

// Give the API a moment to bind before the bots start calling it.
setTimeout(async () => {
  const botToken = cleanToken(process.env.TELEGRAM_BOT_TOKEN);
  const botName = await checkToken('Bot', botToken);
  if (botName) {
    start('Bot', path.join(root, 'apps/bot/dist/index.js'), { API_URL: localApi, TELEGRAM_MODE: 'polling', TELEGRAM_BOT_TOKEN: botToken, SALI_BOT_USERNAME: botName === true ? undefined : botName });
  } else {
    console.error('[render] Bot not started until the token is fixed (changing it in Render redeploys automatically).');
  }

  const supportToken = cleanToken(process.env.SUPPORT_BOT_TOKEN);
  if (!supportToken) {
    console.log('[render] SUPPORT_BOT_TOKEN is not set — support bot skipped.');
    setStatus('Support bot', 'not-configured');
  } else if (await checkToken('Support bot', supportToken)) {
    start('Support bot', path.join(root, 'apps/support-bot/dist/index.js'), {
      API_URL: localApi,
      SUPPORT_BOT_TOKEN: supportToken,
      SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@salivpn.com',
      SUPPORT_BOT_STATE_FILE: process.env.SUPPORT_BOT_STATE_FILE || '/tmp/sali-support-state.json',
    });
  }
}, 4000);
