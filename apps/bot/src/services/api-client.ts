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

function settings() {
  const apiUrl = process.env.API_URL;
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!apiUrl || !internalApiKey) {
    throw new Error('API_URL and INTERNAL_API_KEY are required');
  }
  return { apiUrl: apiUrl.replace(/\/$/, ''), internalApiKey };
}

async function call<T>(path: string, body: unknown): Promise<T> {
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
    if (!response.ok) throw new Error(`Internal API ${path} returned ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  syncUser: (profile: {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
    startParam?: string;
  }) => call<{ userId: string; isBlocked: boolean }>('/users/sync', profile),
  getState: (telegramId: number) => call<BotUserState>('/users/state', { telegramId }),
  confirmPayment: (externalPaymentId: string) =>
    call<unknown>('/payments/confirm', { externalPaymentId }),
  createSupportTicket: (params: { telegramId: number; category: string; message: string }) =>
    call<unknown>('/support/tickets', params),
};
