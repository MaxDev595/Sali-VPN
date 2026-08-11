const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/internal${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Api-Key': INTERNAL_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

export interface SyncUserResult {
  userId: string;
  isBlocked: boolean;
}

export const api = {
  syncUser: (params: {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
    startParam?: string;
  }) => call<SyncUserResult>('/users/sync', params),

  connectVpn: (telegramId: number) =>
    call<{
      account: { status: string };
      trial: { status: string; expiresAt: string };
      config: { configText: string; qrCodeDataUrl: string };
    }>('/vpn/connect', { telegramId }),

  getState: (telegramId: number) => call<any>('/users/state', { telegramId }),

  confirmPayment: (externalPaymentId: string) =>
    call<any>('/payments/confirm', { externalPaymentId }),

  createSupportTicket: (params: { telegramId: number; category: string; message: string }) =>
    call<any>('/support/tickets', params),
};
