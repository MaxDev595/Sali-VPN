import { createHmac, timingSafeEqual } from 'node:crypto';

function equalHex(expected: string, actual: string) {
  const a = Buffer.from(expected, 'hex'); const b = Buffer.from(actual, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyPaddleSignature(raw: Buffer, header: string, secret: string, now = Date.now()) {
  const parts = Object.fromEntries(header.split(';').map((part) => part.split('=', 2)));
  const ts = Number(parts.ts);
  if (!Number.isFinite(ts) || Math.abs(now - ts * 1000) > 5 * 60_000 || !parts.h1) return false;
  const expected = createHmac('sha256', secret).update(`${ts}:${raw.toString('utf8')}`).digest('hex');
  return equalHex(expected, parts.h1);
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortObject(v)]));
  return value;
}
export function verifyNowPaymentsSignature(payload: unknown, signature: string, secret: string) {
  const expected = createHmac('sha512', secret).update(JSON.stringify(sortObject(payload))).digest('hex');
  return equalHex(expected, signature);
}
