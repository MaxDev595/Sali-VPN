import type {
  DeviceDTO,
  DevicesStateDTO,
  HomeStateDTO,
  PlanDTO,
  ReferralInfoDTO,
  SubscriptionDTO,
  UserPreferencesDTO,
  VpnServerDTO,
} from '@sali/types';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/api/v1';
let authToken: string | null = null;

export class ApiRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token && typeof window !== 'undefined') window.dispatchEvent(new Event('sali:authenticated'));
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  }).catch(() => {
    throw new ApiRequestError('Сервер недоступен. Попробуйте позже.');
  });

  if (!response.ok) {
    let message = 'Что-то пошло не так. Попробуйте ещё раз.';
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // Ответ без JSON: оставляем безопасное сообщение.
    }
    throw new ApiRequestError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  loginWithTelegramWebApp: (initData: string, referralCode?: string) =>
    request<{ token: string; startParam?: string }>('/auth/telegram-webapp', {
      method: 'POST', body: JSON.stringify({ initData, referralCode }),
    }),
  getHome: () => request<HomeStateDTO>('/home'),
  connectVpn: (deviceKey: string) =>
    request<{ account: unknown; config: { configText: string; qrCodeDataUrl: string } }>(
      '/vpn/connect', { method: 'POST', headers: { 'X-Device-Key': deviceKey } },
    ),
  disconnectVpn: () => request('/vpn/disconnect', { method: 'POST' }),
  getPlans: () => request<PlanDTO[]>('/plans'),
  getMySubscription: () => request<SubscriptionDTO | null>('/subscription'),
  purchase: (planId: string, provider?: 'paddle' | 'crypto' | 'telegram_stars') =>
    request<{ payment: { id: string }; subscription: unknown; checkout: { checkoutUrl?: string; cryptoInvoice?: { network: string; asset: string; address: string; amount: string; expiresAt: string; reference?: string; paymentUrl?: string } } }>('/payments/purchase', {
      method: 'POST', body: JSON.stringify({ planId, provider }),
    }),
  getPayment: (paymentId: string) =>
    request<{ id: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'; failureReason?: string }>(
      `/payments/${encodeURIComponent(paymentId)}`,
    ),
  getDevices: () => request<DevicesStateDTO>('/devices'),
  registerCurrentDevice: (device: { deviceKey: string; name: string; platform: string }) =>
    request<DeviceDTO>('/devices/current', { method: 'POST', body: JSON.stringify(device) }),
  addDevice: (name: string, platform: string) =>
    request<DeviceDTO>('/devices', { method: 'POST', body: JSON.stringify({ name, platform }) }),
  removeDevice: (id: string) => request(`/devices/${id}`, { method: 'DELETE' }),
  getServers: () => request<VpnServerDTO[]>('/servers'),
  getPreferences: () => request<UserPreferencesDTO>('/preferences'),
  updatePreferences: (preferences: Partial<UserPreferencesDTO>) =>
    request<UserPreferencesDTO>('/preferences', { method: 'PATCH', body: JSON.stringify(preferences) }),
  getReferralInfo: () => request<ReferralInfoDTO>('/referrals/me'),
  createSupportTicket: (category: string, message: string) =>
    request('/support/tickets', { method: 'POST', body: JSON.stringify({ category, message }) }),
};
