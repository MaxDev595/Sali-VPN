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
      const body = await response.json().catch(() => ({})) as { message?: string | string[]; code?: string };
      const message = Array.isArray(body.message) ? body.message[0] : body.message;
      throw new ApiError(message ?? 'Не удалось выполнить запрос', body.code ?? 'UNKNOWN', response.status);
    }
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Нет связи с Sali. Проверьте интернет и попробуйте снова.', 'NETWORK', 0);
  } finally { clearTimeout(timeout); }
}

export interface RedeemResult { kind: 'PAID' | 'FREE' | 'GIFT' | 'PROMO'; durationDays: number; planName: string | null; expiresAt: string | null }

/**
 * The store app never sells anything: no prices, no checkout, no billing SDK.
 * Access arrives only as activation codes issued by the Telegram bot.
 */
export const api = {
  appLogin: (deviceKey: string) => request<{ token: string; publicId: string }>('/auth/app', { method: 'POST', body: JSON.stringify({ deviceKey }) }),
  exchangeTelegramToken: (token: string) => request<{ token: string }>('/auth/mobile', { method: 'POST', body: JSON.stringify({ token }) }),
  home: () => request<HomeState>('/home'),
  redeem: (code: string) => request<RedeemResult>('/codes/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  connect: (deviceKey: string) => request<{ config: { configText: string; serverLocation: string; allocatedIp: string } }>('/vpn/connect', { method: 'POST', headers: { 'X-Device-Key': deviceKey } }),
  disconnect: () => request('/vpn/disconnect', { method: 'POST' }),
  servers: () => request<VPNServer[]>('/servers'),
  registerCurrentDevice: (deviceKey: string) => request('/devices/current', { method: 'POST', body: JSON.stringify({ deviceKey, name: 'Android', platform: 'ANDROID' }) }),
  createSupportTicket: (message: string) => request('/support/tickets', { method: 'POST', body: JSON.stringify({ category: 'other', message }) }),
};
