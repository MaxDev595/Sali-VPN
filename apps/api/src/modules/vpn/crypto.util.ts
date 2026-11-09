import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Secrets at rest (client VPN private keys, node agent keys) are encrypted with AES-256-GCM.
 *
 * v2 (current): key derived from a dedicated ENCRYPTION_KEY that is used for nothing else, so
 *   a leaked JWT_SECRET (which signs login tokens) no longer reveals any VPN key.
 *   Format: "v2:<iv>:<tag>:<data>".
 * legacy: key derived from JWT_SECRET. Format: "<iv>:<tag>:<data>". Still readable; rows are
 *   re-encrypted to v2 at startup (see VpnService.resealSecrets) once ENCRYPTION_KEY is set.
 *
 * ENCRYPTION_KEY must never change once set: rows encrypted with it can't be read without it.
 */
const ALGO = 'aes-256-gcm';
const V2 = 'v2:';
const keys = new Map<string, Buffer>();

function deriveKey(secret: string, salt: string): Buffer {
  const id = `${salt}\0${secret}`;
  let key = keys.get(id);
  if (!key) {
    key = scryptSync(secret, salt, 32);
    keys.set(id, key);
  }
  return key;
}

function encryptionKey(): string | undefined {
  const value = process.env.ENCRYPTION_KEY?.trim();
  return value ? value : undefined;
}

function seal(plainText: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

function open(payload: string, key: Buffer): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

/** `legacySecret` (JWT_SECRET) is used only while ENCRYPTION_KEY is not configured. */
export function encryptSecret(plainText: string, legacySecret: string): string {
  const dedicated = encryptionKey();
  if (dedicated) return V2 + seal(plainText, deriveKey(dedicated, 'sali-vpn-v2'));
  return seal(plainText, deriveKey(legacySecret, 'sali-vpn-static-salt'));
}

export function decryptSecret(payload: string, legacySecret: string): string {
  if (payload.startsWith(V2)) {
    const dedicated = encryptionKey();
    if (!dedicated) throw new Error('ENCRYPTION_KEY is not set, but the data was encrypted with it');
    return open(payload.slice(V2.length), deriveKey(dedicated, 'sali-vpn-v2'));
  }
  return open(payload, deriveKey(legacySecret, 'sali-vpn-static-salt'));
}

/** True when the value is still in the legacy format and ENCRYPTION_KEY is available to upgrade it. */
export function needsReseal(payload: string): boolean {
  return Boolean(encryptionKey()) && !payload.startsWith(V2);
}
