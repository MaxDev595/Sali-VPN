import type {
  DeviceDTO,
  HomeStateDTO,
  PlanDTO,
  ReferralInfoDTO,
  SubscriptionDTO,
} from '@sali/types';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/api/v1';
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  }).catch(() => {
    throw new Error('Сервер недоступен. Попробуйте позже.');
  });

  if (!response.ok) {
    let message = 'Что-то пошло не так. Попробуйте ещё раз.';
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // Ответ без JSON: оставляем безопасное сообщение.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  loginWithTelegramWebApp: (initData: string) =>
    request<{ token: string; startParam?: string }>('/auth/telegram-webapp', {
      method: 'POST', body: JSON.stringify({ initData }),
    }),
  getHome: () => request<HomeStateDTO>('/home'),
  connectVpn: () =>
    request<{ account: unknown; config: { configText: string; qrCodeDataUrl: string } }>(
      '/vpn/connect', { method: 'POST' },
    ),
  disconnectVpn: () => request('/vpn/disconnect', { method: 'POST' }),
  getPlans: () => request<PlanDTO[]>('/plans'),
  getMySubscription: () => request<SubscriptionDTO | null>('/subscription'),
  purchase: (planId: string) =>
    request<{ payment: unknown; subscription: unknown; checkout: unknown }>('/payments/purchase', {
      method: 'POST', body: JSON.stringify({ planId }),
    }),
  getDevices: () => request<DeviceDTO[]>('/devices'),
  addDevice: (name: string, platform: string) =>
    request<DeviceDTO>('/devices', { method: 'POST', body: JSON.stringify({ name, platform }) }),
  removeDevice: (id: string) => request(`/devices/${id}`, { method: 'DELETE' }),
  getReferralInfo: () => request<ReferralInfoDTO>('/referrals/me'),
  createSupportTicket: (category: string, message: string) =>
    request('/support/tickets', { method: 'POST', body: JSON.stringify({ category, message }) }),
};
