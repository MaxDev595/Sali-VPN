#!/usr/bin/env node
/**
 * Sali VPN node agent (v2).
 *
 * Runs as root on every VPN server and manages two tunnels with the SAME peers:
 *   awg0 — AmneziaWG (WireGuard with traffic obfuscation; works where plain WireGuard is blocked)
 *   wg0  — plain WireGuard (for app versions that don't speak AmneziaWG yet)
 * and, when installed, Xray VLESS + Reality on TCP 443 for Happ and other Xray clients.
 *
 * The Sali API talks to it over HTTPS with a bearer key. The certificate is self-signed
 * and its fingerprint is pinned by the API at enrollment, so no domain is needed.
 * Client private keys never touch this server: the API generates them and sends only
 * public keys. Peers live in a JSON state file and are re-applied on every start, so a
 * reboot or a tunnel restart never drops users.
 *
 * No npm dependencies — plain Node.js (>= 18).
 */
'use strict';
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const DIR = process.env.SALI_NODE_DIR || '/etc/sali-node';
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'node.json'), 'utf8'));
const STATE = path.join(DIR, 'peers.json');
const VERSION = '2.2.0';

// node.json: { apiKey, port, wg: { iface, port, prefix }, awg: { iface, port, prefix, params } }
const TUNNELS = [
  { kind: 'awg', bin: 'awg', ...cfg.awg },
  { kind: 'wg', bin: 'wg', ...cfg.wg },
].filter((t) => t.iface);

// ---------- state ----------
let peers = {};
try { peers = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { peers = {}; }
function save() {
  const tmp = `${STATE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(peers));
  fs.renameSync(tmp, STATE); // atomic: a crash never leaves a half-written file
}

// Index n (2..65534) → 10.X.hi.lo inside the tunnel's /16.
function ipFor(prefix, n) { return `${prefix}.${Math.floor(n / 256)}.${n % 256}`; }
function nextIndex() {
  const used = new Set(Object.values(peers).map((p) => p.index));
  for (let n = 2; n < 65534; n++) if (n % 256 !== 0 && n % 256 !== 255 && !used.has(n)) return n;
  throw new Error('node is full');
}

// ---------- tunnels ----------
function run(bin, args) { return execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(); }
function applyPeer(p) {
  for (const t of TUNNELS) {
    try {
      if (p.enabled) run(t.bin, ['set', t.iface, 'peer', p.publicKey, 'allowed-ips', `${ipFor(t.prefix, p.index)}/32`]);
      else run(t.bin, ['set', t.iface, 'peer', p.publicKey, 'remove']);
    } catch (error) {
      console.error(`[agent] ${t.iface}: ${error.stderr?.toString().trim() || error.message}`);
    }
  }
}
function removePeer(p) { for (const t of TUNNELS) { try { run(t.bin, ['set', t.iface, 'peer', p.publicKey, 'remove']); } catch { /* already gone */ } } }
function resyncAll() {
  let n = 0;
  for (const p of Object.values(peers)) { if (p.enabled) { applyPeer(p); n++; } }
  console.log(`[agent] re-applied ${n} peer(s) to ${TUNNELS.map((t) => t.iface).join(', ')}`);
}
function publicKeyOf(t) { try { return run(t.bin, ['show', t.iface, 'public-key']); } catch { return null; } }
function handshakes() {
  // latest-handshakes per peer from awg0 (or wg0): "pubkey\tunix"
  const out = {};
  for (const t of TUNNELS) {
    try {
      for (const line of run(t.bin, ['show', t.iface, 'latest-handshakes']).split('\n')) {
        const [key, ts] = line.split('\t');
        if (key && Number(ts) > (out[key] ?? 0)) out[key] = Number(ts);
      }
    } catch { /* interface down */ }
  }
  return out;
}
function tunnelsUp() { return TUNNELS.every((t) => publicKeyOf(t)); }
// The node's own no-log resolver (unbound on the tunnel addresses). When it runs, the API
// points clients' DNS at it instead of a public resolver.
function dnsUp() { try { run('systemctl', ['is-active', '--quiet', 'unbound']); return true; } catch { return false; } }

// ---------- xray (VLESS + Reality, for Happ and other Xray clients) ----------
// Optional: only nodes installed with Xray have cfg.xray. Clients are one UUID per Sali
// account, kept in xray.json and written into Xray's config; Xray logs nothing.
const XRAY = cfg.xray && cfg.xray.port ? cfg.xray : null;
const XSTATE = path.join(DIR, 'xray.json');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let xusers = {};
try { xusers = JSON.parse(fs.readFileSync(XSTATE, 'utf8')); } catch { xusers = {}; }
function saveX() { const tmp = `${XSTATE}.tmp`; fs.writeFileSync(tmp, JSON.stringify(xusers)); fs.renameSync(tmp, XSTATE); }
function xrayConfig() {
  const clients = Object.entries(xusers).filter(([, u]) => u.enabled).map(([id, u]) => ({ id: u.uuid, flow: 'xtls-rprx-vision', email: id }));
  return {
    log: { loglevel: 'none', access: 'none', error: 'none' },
    dns: { servers: [XRAY.dns || '10.67.0.1', 'localhost'], queryStrategy: 'UseIPv4' },
    inbounds: [{
      tag: 'reality', listen: '0.0.0.0', port: XRAY.port, protocol: 'vless',
      settings: { clients, decryption: 'none' },
      streamSettings: {
        network: 'tcp', security: 'reality',
        realitySettings: { show: false, dest: `${XRAY.sni}:443`, xver: 0, serverNames: [XRAY.sni], privateKey: fs.readFileSync(path.join(DIR, 'xray.key'), 'utf8').trim(), shortIds: [XRAY.shortId] },
      },
      sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'], routeOnly: true },
    }],
    outbounds: [{ tag: 'direct', protocol: 'freedom', settings: { domainStrategy: 'UseIPv4' } }, { tag: 'block', protocol: 'blackhole' }],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      // Same privacy rules as the tunnels: no access to the hoster's private networks or metadata.
      rules: [{ type: 'field', ip: ['geoip:private'], outboundTag: 'block' }, { type: 'field', protocol: ['bittorrent'], outboundTag: 'block' }],
    },
  };
}
let xrayTimer = null;
// Xray has no live reload: rewrite the config and restart, batching bursts of changes.
function applyXray() {
  if (!XRAY) return;
  clearTimeout(xrayTimer);
  xrayTimer = setTimeout(() => {
    try {
      const file = XRAY.config || '/usr/local/etc/xray/config.json';
      const text = JSON.stringify(xrayConfig(), null, 1);
      let current = '';
      try { current = fs.readFileSync(file, 'utf8'); } catch { /* first run */ }
      if (current === text && xrayUp()) return; // nothing changed: keep live connections
      fs.writeFileSync(`${file}.tmp`, text);
      run('xray', ['run', '-test', '-c', `${file}.tmp`]);
      fs.renameSync(`${file}.tmp`, file);
      run('systemctl', ['restart', 'xray']);
    } catch (error) { console.error(`[agent] xray: ${error.stderr?.toString().trim() || error.message}`); }
  }, 1500);
}
function xrayUp() { if (!XRAY) return false; try { run('systemctl', ['is-active', '--quiet', 'xray']); return true; } catch { return false; } }

// ---------- http ----------
const KEY_RE = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/;
function send(res, code, body) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }
function authorized(req) {
  const got = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
  const want = Buffer.from(cfg.apiKey);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
  });
}
function info() {
  const now = Date.now() / 1000;
  const hs = handshakes();
  const active = Object.values(peers).filter((p) => p.enabled && hs[p.publicKey] && now - hs[p.publicKey] < 180).length;
  return {
    version: VERSION,
    up: tunnelsUp(),
    dns: dnsUp(),
    peers: Object.keys(peers).length,
    enabled: Object.values(peers).filter((p) => p.enabled).length,
    active,
    load: os().load,
    tunnels: Object.fromEntries(TUNNELS.map((t) => [t.kind, { publicKey: publicKeyOf(t), port: t.port, ...(t.params ? { params: t.params } : {}) }])),
    ...(XRAY ? { xray: { up: xrayUp(), port: XRAY.port, publicKey: XRAY.publicKey, shortId: XRAY.shortId, sni: XRAY.sni, users: Object.values(xusers).filter((u) => u.enabled).length } } : {}),
  };
}
function os() { const [l1] = require('node:os').loadavg(); return { load: Math.round(l1 * 100) / 100 }; }
function peerView(id, p) {
  return { externalId: id, enabled: p.enabled, ips: Object.fromEntries(TUNNELS.map((t) => [t.kind, ipFor(t.prefix, p.index)])) };
}

async function handle(req, res) {
  if (!authorized(req)) return send(res, 401, { message: 'Unauthorized' });
  const url = new URL(req.url, 'https://node');
  const m = url.pathname.match(/^\/peers\/([A-Za-z0-9_-]{1,80})(\/(enable|disable))?$/);
  try {
    if (req.method === 'GET' && url.pathname === '/info') return send(res, 200, info());
    if (req.method === 'POST' && url.pathname === '/resync') { resyncAll(); return send(res, 200, { ok: true }); }
    const x = url.pathname.match(/^\/xray\/([A-Za-z0-9_-]{1,80})$/);
    if (x) {
      if (!XRAY) return send(res, 404, { message: 'Xray is not installed on this node' });
      const xid = x[1];
      if (req.method === 'GET') return xusers[xid] ? send(res, 200, { id: xid, enabled: xusers[xid].enabled }) : send(res, 404, { message: 'User not found' });
      if (req.method === 'PUT') {
        // Create or update (idempotent). Body: { uuid, enabled? }
        const body = await readJson(req);
        if (!UUID_RE.test(body.uuid || '')) return send(res, 400, { message: 'uuid must be a lowercase UUID' });
        const next = { uuid: body.uuid, enabled: body.enabled ?? true };
        const old = xusers[xid];
        if (!old || old.uuid !== next.uuid || old.enabled !== next.enabled) { xusers[xid] = next; saveX(); applyXray(); }
        return send(res, 200, { id: xid, enabled: next.enabled });
      }
      if (req.method === 'DELETE') { if (xusers[xid]) { delete xusers[xid]; saveX(); applyXray(); } return send(res, 200, { ok: true }); }
      return send(res, 405, { message: 'Method not allowed' });
    }
    if (!m) return send(res, 404, { message: 'Not found' });
    const id = m[1];
    const action = m[3];
    if (req.method === 'GET' && !action) return peers[id] ? send(res, 200, peerView(id, peers[id])) : send(res, 404, { message: 'Peer not found' });
    if (req.method === 'PUT' && !action) {
      // Create or update a peer (idempotent). Body: { publicKey, enabled? }
      const body = await readJson(req);
      if (!KEY_RE.test(body.publicKey || '')) return send(res, 400, { message: 'publicKey must be a WireGuard public key' });
      const old = peers[id];
      if (old && old.publicKey !== body.publicKey) removePeer(old);
      peers[id] = { publicKey: body.publicKey, index: old?.index ?? nextIndex(), enabled: body.enabled ?? true };
      save();
      applyPeer(peers[id]);
      return send(res, 200, peerView(id, peers[id]));
    }
    if (req.method === 'DELETE' && !action) {
      if (peers[id]) { removePeer(peers[id]); delete peers[id]; save(); }
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && action) {
      if (!peers[id]) return send(res, 404, { message: 'Peer not found' });
      peers[id].enabled = action === 'enable';
      save();
      applyPeer(peers[id]);
      return send(res, 200, peerView(id, peers[id]));
    }
    return send(res, 405, { message: 'Method not allowed' });
  } catch (error) {
    console.error('[agent]', error);
    return send(res, 500, { message: error.message });
  }
}

resyncAll();
applyXray(); // the config on disk always matches xray.json after a start
// A tunnel restart (awg-quick down/up) wipes its peers: each tunnel's PostUp restarts this
// agent, and this watchdog also re-applies peers if an interface lost them.
setInterval(() => {
  for (const t of TUNNELS) {
    try {
      const live = run(t.bin, ['show', t.iface, 'peers']).split('\n').filter(Boolean).length;
      const want = Object.values(peers).filter((p) => p.enabled).length;
      if (live < want) { console.warn(`[agent] ${t.iface} has ${live}/${want} peers — re-applying`); resyncAll(); return; }
    } catch { console.error(`[agent] ${t.iface} is down`); }
  }
}, 30_000).unref();

https.createServer({
  key: fs.readFileSync(path.join(DIR, 'tls.key')),
  cert: fs.readFileSync(path.join(DIR, 'tls.crt')),
  minVersion: 'TLSv1.2',
}, (req, res) => { handle(req, res); }).listen(cfg.port || 8443, '0.0.0.0', () => {
  console.log(`[agent] Sali node agent ${VERSION} on :${cfg.port || 8443} (${TUNNELS.map((t) => `${t.iface}/${t.port}`).join(', ')}${XRAY ? `, xray/${XRAY.port}` : ''})`);
});
