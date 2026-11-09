import { request } from 'https';
import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'crypto';

/** What a Sali node agent needs to be reached: URL, bearer key, pinned self-signed cert. */
export interface NodeTarget {
  agentUrl: string;
  agentKey: string;
  certPem: string;
}

export class NodeError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

/**
 * Calls a node agent over HTTPS. The agent's certificate is self-signed; trusting exactly
 * that certificate (as the only CA) pins it, so no domain or public CA is needed and a
 * man-in-the-middle can't impersonate the node.
 */
export function callNode<T>(node: NodeTarget, method: string, path: string, body?: unknown, timeoutMs = 8000): Promise<T> {
  const url = new URL(path, node.agentUrl);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise<T>((resolve, reject) => {
    const req = request(url, {
      method,
      ca: node.certPem,
      rejectUnauthorized: true,
      timeout: timeoutMs,
      headers: {
        authorization: `Bearer ${node.agentKey}`,
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        let data: unknown = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }
        if (status >= 200 && status < 300) resolve(data as T);
        else reject(new NodeError((data as { message?: string } | null)?.message ?? `node answered ${status}`, status));
      });
    });
    req.on('timeout', () => req.destroy(new NodeError('node timeout')));
    req.on('error', (error) => reject(error instanceof NodeError ? error : new NodeError(error.message)));
    if (payload) req.write(payload);
    req.end();
  });
}

/** WireGuard/AmneziaWG keypair (Curve25519), base64 like `wg genkey | wg pubkey`. */
export function generateWgKeypair() {
  const { privateKey, publicKey } = generateKeyPairSync('x25519');
  const priv = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
  const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return { privateKey: priv.toString('base64'), publicKey: pub.toString('base64') };
}

/** Public key for an existing base64 private key (used to migrate legacy accounts). */
export function wgPublicKeyOf(privateKeyB64: string) {
  const der = Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), Buffer.from(privateKeyB64, 'base64')]);
  const pub = createPublicKey(createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }));
  return pub.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
}

export interface NodeInfo {
  version: string;
  up: boolean;
  /** agent >= 2.1: the node's own no-log resolver is running */
  dns?: boolean;
  peers: number;
  enabled: number;
  active: number;
  load: number;
  tunnels: {
    awg?: { publicKey: string | null; port: number; params?: Record<string, number> };
    wg?: { publicKey: string | null; port: number };
  };
}

export interface NodePeer {
  externalId: string;
  enabled: boolean;
  ips: { awg?: string; wg?: string };
}
