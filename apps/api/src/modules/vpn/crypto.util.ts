import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// VPN private keys must never be stored in plaintext, even in the database.
// We encrypt with AES-256-GCM using a key derived from JWT_SECRET (or a
// dedicated ENCRYPTION_KEY if you prefer to rotate independently).
const ALGO = 'aes-256-gcm';

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'sali-vpn-static-salt', 32);
}

export function encryptSecret(plainText: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptSecret(payload: string, secret: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
