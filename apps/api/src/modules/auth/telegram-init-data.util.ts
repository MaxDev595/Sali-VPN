import { createHash, createHmac, timingSafeEqual } from 'crypto';

export interface ParsedTelegramInitData {
  authDate: number;
  user: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  queryId?: string;
  startParam?: string;
}

/**
 * Validates Telegram Mini App `initData` per the official algorithm:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 *
 * 1. Parse the query string.
 * 2. Remove `hash`, sort remaining keys alphabetically, join as "key=value" with "\n".
 * 3. secret_key = HMAC_SHA256(bot_token, key="WebAppData")
 * 4. expected_hash = HMAC_SHA256(data_check_string, key=secret_key), hex-encoded.
 * 5. Compare with the provided hash using constant-time comparison.
 * 6. Reject if `auth_date` is too old (replay protection).
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): ParsedTelegramInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new Error('Missing hash in initData');
  }
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const expectedBuf = Buffer.from(expectedHash, 'hex');
  const actualBuf = Buffer.from(hash, 'hex');
  const isValid =
    expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);

  if (!isValid) {
    throw new Error('Invalid initData signature');
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    throw new Error('initData is expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new Error('Missing user in initData');
  }

  return {
    authDate,
    user: JSON.parse(userRaw),
    queryId: params.get('query_id') ?? undefined,
    startParam: params.get('start_param') ?? undefined,
  };
}

/** Used only for hashing internal identifiers in logs — never for security decisions. */
export function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
