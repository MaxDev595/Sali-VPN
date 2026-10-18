import { secureStorage } from '../secureStorage';
import type { HomeState, VPNServer } from '../../types';

const baseUrl = String(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '') + '/api/v1';
export class ApiError extends Error { constructor(message: string, readonly code: string, readonly status: number) { super(message); } }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await secureStorage.getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(baseUrl + path, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { message?: string; code?: string };
      throw new ApiError(body.message ?? 'Не удалось выполнить запрос', body.code ?? 'UNKNOWN', response.status);
    }
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Нет связи с Sali. Проверьте интернет и попробуйте снова.', 'NETWORK', 0);
  } finally { clearTimeout(timeout); }
}

export const api = {
  localLogin: () => request<{ token: string }>('/auth/local', { method: 'POST' }),
  exchangeTelegramToken: (token: string) => request<{ token: string }>('/auth/mobile', { method: 'POST', body: JSON.stringify({ token }) }),
  home: () => request<HomeState>('/home'),
  connect: (deviceKey: string) => request<{ config: { configText: string; serverLocation: string; allocatedIp: string } }>('/vpn/connect', { method: 'POST', headers: { 'X-Device-Key': deviceKey } }),
  disconnect: () => request('/vpn/disconnect', { method: 'POST' }),
  servers: () => request<VPNServer[]>('/servers'),
  plans: () => request<Array<{ id: string; name: string; priceUsd: number; originalPriceUsd: number | null }>>('/plans'),
  subscription: () => request<{ id: string; status: string; expiresAt: string | null; autoRenew: boolean } | null>('/subscription'),
  purchase: (planId: string, provider: 'paddle' | 'crypto') => request<{ payment: { id: string; status: string }; checkout: { checkoutUrl?: string; cryptoInvoice?: { network: string; asset: string; address: string; amount: string; expiresAt: string; reference?: string; paymentUrl?: string } } }>('/payments/purchase', { method: 'POST', body: JSON.stringify({ planId, provider }) }),
  payment: (paymentId: string) => request<{ id: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' }>(`/payments/${encodeURIComponent(paymentId)}`),
  verifyGooglePlay: (planId: string, productId: string, purchaseToken: string) => request('/payments/google-play/verify', { method: 'POST', body: JSON.stringify({ planId, productId, purchaseToken }) }),
  cancelSubscription: (subscriptionId: string) => request(`/payments/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { method: 'POST' }),
  registerCurrentDevice: (deviceKey: string) => request('/devices/current', { method: 'POST', body: JSON.stringify({ deviceKey, name: 'Android', platform: 'ANDROID' }) }),
  createSupportTicket: (message: string) => request('/support/tickets', { method: 'POST', body: JSON.stringify({ category: 'other', message }) }),
};
