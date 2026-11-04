// Sali VPN for Windows — main process: window, tray, and the bridge between the UI,
// the Sali API and the WireGuard tunnel service.
const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, clipboard, Notification } = require('electron');
const path = require('node:path');
const api = require('./api');
const wg = require('./wireguard');
const store = require('./store');

const BOT = 'SaliVPNOfficialBot';
const SUPPORT = 'https://t.me/SaliVPNHelpBot';
let win = null;
let tray = null;
let quitting = false;
let vpnState = 'disconnected';
let serverLocation = store.get('serverLocation') || null;

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId('app.sali.vpn.desktop');

const asset = (name) => path.join(__dirname, 'renderer', 'assets', name);

function send(channel, payload) { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); }
function setVpnState(next, detail) {
  vpnState = next;
  send('vpn:state', { state: next, detail: detail ?? null, serverLocation });
  updateTray();
}

function createWindow() {
  win = new BrowserWindow({
    width: 420, height: 720, minWidth: 380, minHeight: 640, show: false, resizable: true,
    backgroundColor: '#040913', title: 'Sali VPN', icon: asset('app.png'),
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#040913', symbolColor: '#B7C0D4', height: 36 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
    if (vpnState === 'connected' && !store.get('trayHintShown')) {
      store.set('trayHintShown', true);
      new Notification({ title: 'Sali VPN работает в фоне', body: 'VPN остаётся включённым. Значок Sali — в области уведомлений.' }).show();
    }
  });
}

function updateTray() {
  if (!tray) return;
  const on = vpnState === 'connected';
  tray.setToolTip(on ? `Sali VPN — подключено${serverLocation ? ` (${serverLocation})` : ''}` : 'Sali VPN — отключено');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: on ? 'Подключено' : 'Отключено', enabled: false },
    { type: 'separator' },
    on ? { label: 'Отключить VPN', click: () => void disconnect() } : { label: 'Подключить VPN', click: () => void connect() },
    { label: 'Открыть Sali VPN', click: () => { win?.show(); win?.focus(); } },
    { type: 'separator' },
    { label: 'Выйти', click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const image = nativeImage.createFromPath(asset('tray.png'));
  tray = new Tray(image.isEmpty() ? nativeImage.createFromPath(asset('app.png')).resize({ width: 16, height: 16 }) : image);
  tray.on('click', () => { win?.show(); win?.focus(); });
  updateTray();
}

const errorMessage = (error) => (error && error.message) || 'Что-то пошло не так. Попробуйте ещё раз.';

async function connect() {
  if (vpnState === 'connecting' || vpnState === 'connected') return { ok: true };
  setVpnState('connecting');
  try {
    const { config } = await api.connect();
    serverLocation = config.serverLocation || null;
    store.set('serverLocation', serverLocation);
    await wg.up(config.configText, (detail) => setVpnState('connecting', detail));
    store.set('connectedAt', Date.now());
    setVpnState('connected');
    return { ok: true };
  } catch (error) {
    await wg.down().catch(() => undefined);
    setVpnState('disconnected');
    return { ok: false, error: errorMessage(error), code: error.code ?? null, status: error.status ?? null };
  }
}

async function disconnect() {
  setVpnState('disconnecting');
  await wg.down().catch(() => undefined);
  await api.disconnect();
  store.set('connectedAt', null);
  setVpnState('disconnected');
  return { ok: true };
}

ipcMain.handle('home', async () => {
  try { return { ok: true, home: await api.home() }; } catch (error) { return { ok: false, error: errorMessage(error) }; }
});
ipcMain.handle('redeem', async (_event, code) => {
  try { return { ok: true, result: await api.redeem(String(code)) }; } catch (error) { return { ok: false, error: errorMessage(error) }; }
});
ipcMain.handle('vpn:connect', () => connect());
ipcMain.handle('vpn:disconnect', () => disconnect());
ipcMain.handle('vpn:state', async () => ({ state: vpnState, serverLocation, connectedAt: store.get('connectedAt') ?? null }));
ipcMain.handle('open:bot', (_event, start) => shell.openExternal(`https://t.me/${BOT}${start ? `?start=${encodeURIComponent(start)}` : ''}`));
ipcMain.handle('open:support', () => shell.openExternal(SUPPORT));
ipcMain.handle('open:download', () => shell.openExternal('https://salivpn.com/download'));
ipcMain.handle('clipboard:read', () => clipboard.readText());
ipcMain.handle('clipboard:write', (_event, text) => clipboard.writeText(String(text)));
ipcMain.handle('app:version', () => app.getVersion());

app.on('second-instance', () => { win?.show(); win?.focus(); });
app.whenReady().then(async () => {
  createWindow();
  createTray();
  // Pick up a tunnel left running from the previous session.
  const current = await wg.status();
  setVpnState(current === 'connected' ? 'connected' : 'disconnected');
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* keep running in the tray */ });
