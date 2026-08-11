/**
 * Sali VPN — reference WireGuard management agent.
 *
 * Runs directly on a WireGuard server (as root, or with CAP_NET_ADMIN) and
 * exposes a small HTTP API that the Sali VPN backend (apps/api,
 * WireGuardProvider) calls to create/enable/disable peers. This keeps root
 * access confined to the VPN box itself instead of granting it to the
 * application backend.
 *
 * This is a REFERENCE implementation for the MVP — it shells out to `wg`
 * directly and keeps peer bookkeeping in a local JSON file for simplicity.
 * Before production use on real user traffic, consider:
 *   - Locking this service down to only be reachable from the API's IP
 *     (firewall rule / private network), in addition to the bearer token.
 *   - Persisting peer state in something more robust than a JSON file.
 *   - Rotating AGENT_API_KEY regularly.
 *
 * Requires: `wireguard-tools` installed (`wg`, `wg-quick`) and an existing
 * `wg0` interface already brought up with a server keypair. See
 * docs/vpn-server-setup.md for full setup steps.
 */

const express = require('express');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 51821;
const API_KEY = process.env.AGENT_API_KEY;
const WG_INTERFACE = process.env.WG_INTERFACE || 'wg0';
const WG_SUBNET_PREFIX = process.env.WG_SUBNET_PREFIX || '10.66.0'; // .2 .. .254 handed to peers
const SERVER_PRIVATE_KEY_PATH = process.env.SERVER_PRIVATE_KEY_PATH || '/etc/wireguard/server_private.key';
const SERVER_PUBLIC_KEY_PATH = process.env.SERVER_PUBLIC_KEY_PATH || '/etc/wireguard/server_public.key';
const PEERS_DB_PATH = process.env.PEERS_DB_PATH || path.join(__dirname, 'peers.json');

if (!API_KEY) {
  console.error('AGENT_API_KEY is required.');
  process.exit(1);
}

function loadPeers() {
  if (!fs.existsSync(PEERS_DB_PATH)) return {};
  return JSON.parse(fs.readFileSync(PEERS_DB_PATH, 'utf8'));
}

function savePeers(peers) {
  fs.writeFileSync(PEERS_DB_PATH, JSON.stringify(peers, null, 2));
}

function nextIp(peers) {
  const used = new Set(Object.values(peers).map((p) => p.allocatedIp));
  for (let i = 2; i < 255; i++) {
    const candidate = `${WG_SUBNET_PREFIX}.${i}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('No free IPs left in subnet');
}

function generateKeypair() {
  const privateKey = execFileSync('wg', ['genkey']).toString().trim();
  const publicKey = execFileSync('wg', ['pubkey'], { input: privateKey }).toString().trim();
  return { privateKey, publicKey };
}

function wgSyncPeer(publicKey, allocatedIp) {
  execFileSync('wg', [
    'set',
    WG_INTERFACE,
    'peer',
    publicKey,
    'allowed-ips',
    `${allocatedIp}/32`,
  ]);
}

function wgRemovePeer(publicKey) {
  execFileSync('wg', ['set', WG_INTERFACE, 'peer', publicKey, 'remove']);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(API_KEY);
  const valid =
    tokenBuf.length === expectedBuf.length && crypto.timingSafeEqual(tokenBuf, expectedBuf);
  if (!valid) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

const app = express();
app.use(express.json());
app.use(requireAuth);

app.get('/server-public-key', (_req, res) => {
  const publicKey = fs.readFileSync(SERVER_PUBLIC_KEY_PATH, 'utf8').trim();
  res.json({ publicKey });
});

app.post('/peers', (req, res) => {
  try {
    const { externalId } = req.body;
    if (!externalId) return res.status(400).json({ message: 'externalId is required' });

    const peers = loadPeers();
    if (peers[externalId]) {
      return res.status(409).json({ message: 'Peer already exists' });
    }

    const { privateKey, publicKey } = generateKeypair();
    const allocatedIp = nextIp(peers);

    wgSyncPeer(publicKey, allocatedIp);

    peers[externalId] = { publicKey, allocatedIp, isEnabled: true };
    savePeers(peers);

    res.json({ publicKey, privateKey, allocatedIp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create peer' });
  }
});

app.get('/peers/:externalId', (req, res) => {
  const peers = loadPeers();
  const peer = peers[req.params.externalId];
  if (!peer) return res.status(404).json({ message: 'Peer not found' });
  res.json(peer);
});

app.delete('/peers/:externalId', (req, res) => {
  try {
    const peers = loadPeers();
    const peer = peers[req.params.externalId];
    if (!peer) return res.status(404).json({ message: 'Peer not found' });

    wgRemovePeer(peer.publicKey);
    delete peers[req.params.externalId];
    savePeers(peers);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete peer' });
  }
});

app.post('/peers/:externalId/disable', (req, res) => {
  try {
    const peers = loadPeers();
    const peer = peers[req.params.externalId];
    if (!peer) return res.status(404).json({ message: 'Peer not found' });

    wgRemovePeer(peer.publicKey); // removing from the live interface blocks traffic immediately
    peer.isEnabled = false;
    savePeers(peers);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to disable peer' });
  }
});

app.post('/peers/:externalId/enable', (req, res) => {
  try {
    const peers = loadPeers();
    const peer = peers[req.params.externalId];
    if (!peer) return res.status(404).json({ message: 'Peer not found' });

    wgSyncPeer(peer.publicKey, peer.allocatedIp);
    peer.isEnabled = true;
    savePeers(peers);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to enable peer' });
  }
});

app.get('/status', (_req, res) => {
  try {
    const peers = loadPeers();
    const enabledCount = Object.values(peers).filter((p) => p.isEnabled).length;
    res.json({ peerCount: enabledCount, totalPeers: Object.keys(peers).length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to read status' });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Sali wg-agent listening on 127.0.0.1:${PORT} (interface ${WG_INTERFACE})`);
});
