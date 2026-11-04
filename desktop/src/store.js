// Local state for the desktop app: the installation key (this PC's identity), the
// session token (encrypted with Windows DPAPI through Electron safeStorage) and prefs.
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const file = () => path.join(app.getPath('userData'), 'state.json');

function read() {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; }
}

function write(next) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(next, null, 2));
}

function update(patch) { const next = { ...read(), ...patch }; write(next); return next; }

function encrypt(value) {
  if (!value) return null;
  return safeStorage.isEncryptionAvailable() ? { enc: safeStorage.encryptString(value).toString('base64') } : { raw: value };
}

function decrypt(box) {
  if (!box) return null;
  try { return box.enc ? safeStorage.decryptString(Buffer.from(box.enc, 'base64')) : box.raw ?? null; } catch { return null; }
}

module.exports = {
  /** Stable random key for this installation (the API's device key, like the phone app). */
  deviceKey() {
    const state = read();
    if (state.deviceKey) return state.deviceKey;
    const key = 'win-' + crypto.randomBytes(24).toString('hex');
    update({ deviceKey: key });
    return key;
  },
  getToken: () => decrypt(read().token),
  setToken: (token) => update({ token: encrypt(token) }),
  clearToken: () => update({ token: null }),
  get: (key) => read()[key],
  set: (key, value) => update({ [key]: value }),
};
