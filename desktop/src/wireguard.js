// Runs the Sali tunnel through the official WireGuard for Windows service
// (wireguard.exe /installtunnelservice). The app runs elevated, so no extra prompts.
const { app } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const TUNNEL = 'SaliVPN';
const SERVICE = `WireGuardTunnel$${TUNNEL}`;
const isWindows = process.platform === 'win32';

function run(file, args, { timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout }, (error, stdout, stderr) => {
      if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); } else resolve(String(stdout));
    });
  });
}

function wireguardExe() {
  const roots = [process.env.ProgramFiles, process.env['ProgramW6432'], 'C:\\Program Files'].filter(Boolean);
  for (const root of roots) {
    const exe = path.join(root, 'WireGuard', 'wireguard.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

function bundledInstaller() {
  const dir = app.isPackaged ? path.join(process.resourcesPath, 'vendor') : path.join(__dirname, '..', 'vendor');
  try { return fs.readdirSync(dir).filter((f) => /^wireguard.*\.msi$/i.test(f)).map((f) => path.join(dir, f))[0] ?? null; } catch { return null; }
}

/** Installs WireGuard silently from the copy bundled with Sali VPN (first connection only). */
async function ensureInstalled(onStatus) {
  if (!isWindows) throw new Error('VPN работает только в Windows');
  let exe = wireguardExe();
  if (exe) return exe;
  const msi = bundledInstaller();
  if (!msi) {
    const error = new Error('Нужен компонент WireGuard. Установите его с wireguard.com и попробуйте снова.');
    error.code = 'WIREGUARD_MISSING';
    throw error;
  }
  onStatus?.('Устанавливаем компонент VPN…');
  await run('msiexec.exe', ['/i', msi, '/qn', '/norestart', 'DO_NOT_LAUNCH=1'], { timeout: 180000 });
  for (let i = 0; i < 30 && !exe; i++) { await new Promise((r) => setTimeout(r, 500)); exe = wireguardExe(); }
  if (!exe) throw new Error('Не удалось установить компонент VPN. Перезапустите Sali VPN от имени администратора.');
  return exe;
}

function configPath() {
  const dir = path.join(process.env.ProgramData || app.getPath('userData'), 'SaliVPN');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${TUNNEL}.conf`);
}

async function status() {
  if (!isWindows) return 'disconnected';
  try {
    const out = await run('sc.exe', ['query', SERVICE], { timeout: 8000 });
    if (/RUNNING/.test(out)) return 'connected';
    if (/START_PENDING/.test(out)) return 'connecting';
    if (/STOP_PENDING/.test(out)) return 'disconnecting';
    return 'disconnected';
  } catch { return 'disconnected'; }
}

async function waitFor(target, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if ((await status()) === target) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function down() {
  const exe = wireguardExe();
  if (!exe) return;
  if ((await status()) === 'disconnected') return;
  await run(exe, ['/uninstalltunnelservice', TUNNEL]).catch(() => undefined);
  await waitFor('disconnected', 15000);
}

async function up(configText, onStatus) {
  const exe = await ensureInstalled(onStatus);
  await down();
  const file = configPath();
  fs.writeFileSync(file, configText.replace(/\r?\n/g, '\r\n'), { mode: 0o600 });
  // The tunnel service reads this file on start; only SYSTEM and administrators may read the key.
  await run('icacls.exe', [path.dirname(file), '/inheritance:r', '/grant:r', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'], { timeout: 10000 }).catch(() => undefined);
  onStatus?.('Подключаемся…');
  await run(exe, ['/installtunnelservice', file]);
  if (!(await waitFor('connected', 25000))) throw new Error('VPN не запустился. Попробуйте ещё раз или смените сеть.');
}

module.exports = { up, down, status, wireguardExe };
