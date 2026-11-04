import fetch, { RequestInit } from 'node-fetch';

const API_TIMEOUT_MS = Number(process.env.BOT_API_TIMEOUT_MS ?? 8_000);

export type UserState =
  | 'NEW'
  | 'REGISTERED'
  | 'TRIAL_ACTIVE'
  | 'TRIAL_EXPIRED'
  | 'SUBSCRIPTION_ACTIVE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'BLOCKED';

export interface BotUserState {
  state: UserState;
  registered: boolean;
  user: {
    publicId: string;
    username: string | null;
    firstName: string | null;
    isBlocked: boolean;
  };
  trial: {
    status: 'ACTIVE' | 'EXPIRED';
    startedAt: string;
    expiresAt: string;
    secondsRemaining: number;
  } | null;
  subscription: {
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING_PAYMENT';
    startedAt: string | null;
    expiresAt: string | null;
    plan: { name: string };
  } | null;
  referralStats: { link: string };
}

export interface TelegramProfile {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
}

export interface BotPlan {
  code: string;
  name: string;
  durationDays: number;
  priceUsd: number;
  originalPriceUsd: number | null;
  stars: number;
  maxDevices: number;
}

export interface IssuedCode {
  code: string;
  display: string;
  kind: 'PAID' | 'FREE' | 'GIFT' | 'PROMO';
  durationDays: number;
  planName: string | null;
  expiresAt: string;
}

export interface OwnedCode extends IssuedCode {
  status: 'ISSUED' | 'REDEEMED' | 'REVOKED';
  redeemedAt: string | null;
  redeemedOn: string | null;
}

export interface LinkedDevice {
  publicId: string;
  linkedAt: string | null;
  tariff: string | null;
  until: string | null;
  active: boolean;
  secondsLeft?: number;
}

export type Purchase =
  | { method: 'stars'; paymentId: string; stars: number; title: string; description: string }
  | {
      method: 'crypto' | 'card';
      paymentId: string;
      checkoutUrl: string | null;
      cryptoInvoice: { network: string; asset: string; address: string; amount: string; expiresAt: string; reference?: string; paymentUrl?: string } | null;
    };

/** API refused the request (4xx): the message is safe to show to the customer. */
export class ApiRejection extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function settings() {
  const apiUrl = process.env.API_URL;
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!apiUrl || !internalApiKey) {
    throw new Error('API_URL and INTERNAL_API_KEY are required');
  }
  return { apiUrl: apiUrl.replace(/\/$/, ''), internalApiKey };
}

async function call<T>(path: string, body: unknown, retries = 2): Promise<T> {
  const { apiUrl, internalApiKey } = settings();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Api-Key': internalApiKey },
    body: JSON.stringify(body),
    signal: controller.signal,
  };

  try {
    const response = await fetch(`${apiUrl}/api/v1/internal${path}`, init);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      if (response.status >= 400 && response.status < 500) {
        let message = 'Запрос отклонён';
        try {
          const parsed = JSON.parse(detail) as { message?: string | string[] };
          message = Array.isArray(parsed.message) ? parsed.message[0] : parsed.message ?? message;
        } catch { /* keep default */ }
        throw new ApiRejection(message, response.status);
      }
      throw new Error(`Internal API ${path} returned ${response.status}: ${detail.slice(0, 300)}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    // Business refusals are final; only network/5xx failures are retried.
    if (retries > 0 && !(error instanceof ApiRejection)) {
      await new Promise((resolve) => setTimeout(resolve, (3 - retries) * 500));
      return call<T>(path, body, retries - 1);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  syncUser: (profile: TelegramProfile & { startParam?: string }) =>
    call<{ exists: boolean; userId: string | null; isBlocked: boolean }>('/users/sync', profile),
  getState: (telegramId: number) => call<BotUserState>('/users/state', { telegramId }),
  confirmPayment: (externalPaymentId: string) =>
    call<unknown>('/payments/confirm', { externalPaymentId }, 0),
  createSupportTicket: (params: { telegramId: number; category: string; message: string }) =>
    call<unknown>('/support/tickets', params),

  // --- Bot billing & activation codes -------------------------------------
  start: (profile: TelegramProfile, startParam?: string) =>
    call<{ publicId: string; link: { status: 'linked' | 'already' | 'not_found' | 'linked_elsewhere'; publicId?: string } | null; linkedApps: number; freeUsed: boolean; isBlocked: boolean }>('/bot/start', { profile, startParam }),
  link: (telegramId: number, publicId: string) =>
    call<{ status: 'linked' | 'already' | 'not_found' | 'linked_elsewhere'; publicId: string | null }>('/bot/link', { telegramId, publicId }),
  devices: (telegramId: number) => call<LinkedDevice[]>('/bot/devices', { telegramId }),
  plans: () => call<BotPlan[]>('/bot/plans', {}),
  purchase: (profile: TelegramProfile, planCode: string, method: 'stars' | 'crypto' | 'card') =>
    call<Purchase>('/bot/purchase', { profile, planCode, method }, 0),
  precheck: (telegramId: number, paymentId: string, amount: number, currency: string) =>
    call<{ ok: boolean; error?: string }>('/bot/precheck', { telegramId, paymentId, amount, currency }, 0),
  starsPaid: (telegramId: number, paymentId: string, amount: number, currency: string, chargeId: string) =>
    call<{ code: IssuedCode | null }>('/bot/stars-paid', { telegramId, paymentId, amount, currency, chargeId }),
  paymentStatus: (telegramId: number, paymentId: string) =>
    call<{ status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'; code: IssuedCode | null }>('/bot/payment-status', { telegramId, paymentId }),
  freeCode: (telegramId: number) => call<IssuedCode & { alreadyIssued: boolean }>('/bot/free', { telegramId }, 0),
  codes: (telegramId: number) => call<OwnedCode[]>('/bot/codes', { telegramId }),
  apply: (telegramId: number, code: string, publicId?: string) =>
    call<{ chooseDevice?: string[]; kind?: string; durationDays?: number; planName?: string | null; expiresAt?: string | null; publicId?: string }>('/bot/apply', { telegramId, code, publicId }, 0),

  // --- Admin: VPN nodes ----------------------------------------------------
  nodeToken: (telegramId: number, countryCode: string, city?: string) =>
    call<{ name: string; command: string }>('/bot/nodes/token', { telegramId, countryCode, city }, 0),
  nodes: (telegramId: number) =>
    call<Array<{ name: string; host: string; country: string; active: boolean; online: boolean; users: number | null; connectedNow: number | null; load: number | null }>>('/bot/nodes/list', { telegramId }, 0),
  nodeActive: (telegramId: number, name: string, isActive: boolean) =>
    call<{ updated: number }>('/bot/nodes/active', { telegramId, name, isActive }, 0),
};
