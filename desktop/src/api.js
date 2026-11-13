// Sali API client for the desktop app. Same endpoints as the Android app:
// the plan lives on the Telegram account and arrives by itself.
const os = require('node:os');
const store = require('./store');

const DISCOVERY_URL = 'https://salivpn.com/config.json';
const baked = (() => { try { return require('./build-config.json').apiUrl; } catch { return null; } })();
const BUILT_IN_API = (process.env.SALI_API_URL || baked || 'https://api.salivpn.com').replace(/\/$/, '');
let apiBase = null;
const FALLBACK_API = 'https://salivpn.com/api/v1';
let preferred = 0;

class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function withTimeout(url, init = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}

/** The API address can change, so ask salivpn.com/config.json first; fall back to the built-in one. */
async function base() {
  if (apiBase) return apiBase;
  try {
    const response = await withTimeout(DISCOVERY_URL, { headers: { 'Cache-Control': 'no-cache' } }, 5000);
    const body = response.ok ? await response.json() : {};
    if (body.apiUrl && /^https:\/\//.test(body.apiUrl)) apiBase = body.apiUrl.replace(/\/$/, '') + '/api/v1';
  } catch { /* offline or no discovery file */ }
  apiBase ??= BUILT_IN_API + '/api/v1';
  return apiBase;
}

async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const token = auth ? store.getToken() : null;
  const init = {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'User-Agent': `SaliVPN-Desktop/${require('../package.json').version} (Windows)`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  };
  // Every way to reach the API: discovered/built-in address, then salivpn.com/api (Cloudflare
  // forwards it) for networks that cut api.salivpn.com now and then. Two rounds.
  const list = [...new Set([await base(), BUILT_IN_API + '/api/v1', FALLBACK_API])];
  let response = null;
  for (let round = 0; round < 2 && !response; round++) {
    if (round) await new Promise((r) => setTimeout(r, 1500));
    for (let k = 0; k < list.length && !response; k++) {
      const i = (preferred + k) % list.length;
      try { response = await withTimeout(list[i] + path, init, round ? 15000 : 9000); preferred = i; } catch { /* next address */ }
    }
  }
  if (!response) {
    apiBase = null;
    throw new ApiError('Нет связи с сервером Sali. Проверьте интернет — мы попробуем ещё раз.', 0, 'NETWORK');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    if (response.status === 401 && auth) store.clearToken();
    throw new ApiError(message || 'Не удалось выполнить запрос', response.status, data.code || 'UNKNOWN');
  }
  return response.status === 204 ? undefined : response.json();
}

let signingIn = null;
/** Silent sign-in: this PC's installation key becomes an app account with its own Sali ID. */
async function moveToMachineKey() {
  const machine = store.machineKey();
  if (!machine || machine === store.deviceKey()) return;
  const moved = await request('/auth/app/rebind', { method: 'POST', body: { deviceKey: machine } }).catch(() => null);
  if (moved && moved.ok) store.set('deviceKey', machine);
}

async function ensureSession() {
  if (store.getToken()) { if (!store.get('machineKeyChecked')) { store.set('machineKeyChecked', true); void moveToMachineKey(); } return; }
  signingIn ??= (async () => {
    const deviceKey = store.deviceKey();
    const auth = await request('/auth/app', { method: 'POST', body: { deviceKey }, auth: false });
    store.setToken(auth.token);
    // Older installs used a random key: move this account to the machine key once, so a
    // reinstall (which wipes the random one) still finds the same Sali ID.
    await moveToMachineKey();
    store.set('machineKeyChecked', true);
    await request('/devices/current', { method: 'POST', body: { deviceKey: store.deviceKey(), name: os.hostname().slice(0, 40) || 'Windows', platform: 'WINDOWS' } }).catch(() => undefined);
  })().finally(() => { signingIn = null; });
  return signingIn;
}

async function authed(fn) {
  await ensureSession();
  try { return await fn(); } catch (error) {
    if (error.status === 401) { await ensureSession(); return fn(); }
    throw error;
  }
}

module.exports = {
  ApiError,
  home: () => authed(() => request('/home')),
  redeem: (code) => authed(() => request('/codes/redeem', { method: 'POST', body: { code } })),
  connect: () => authed(() => request('/vpn/connect', { method: 'POST', headers: { 'X-Device-Key': store.deviceKey() } })),
  disconnect: () => authed(() => request('/vpn/disconnect', { method: 'POST' })).catch(() => undefined),
  accountDevices: () => authed(() => request('/devices/account')),
  unlinkDevice: (publicId) => authed(() => request('/devices/account/unlink', { method: 'POST', body: { publicId } })),
  support: (message) => authed(() => request('/support/tickets', { method: 'POST', body: { category: 'other', message } })),
};
