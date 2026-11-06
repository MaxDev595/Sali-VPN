import { secureStorage } from '../secureStorage';
import type { HomeState, VPNServer } from '../../types';
import { COUNTRY_NAMES } from '../../data/fallbackServers';

interface ApiServer { id: string; name: string; location: string; countryCode: string | null; city: string | null; premiumOnly: boolean; pingMs: number | null; currentLoad: number; capacity: number | null; recommended: boolean }

const builtInApi = String(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const DISCOVERY_URL = 'https://salivpn.com/config.json';
let apiBase: Promise<string> | null = null;

/**
 * The API address can change (tunnels), so the app asks salivpn.com/config.json for the
 * current one and falls back to the address baked in at build time.
 */
function resolveBaseUrl() {
  apiBase ??= (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(DISCOVERY_URL, { signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } }).finally(() => clearTimeout(timer));
      const body = response.ok ? await response.json() as { apiUrl?: string } : {};
      if (body.apiUrl && /^https:\/\//.test(body.apiUrl)) return body.apiUrl.replace(/\/$/, '') + '/api/v1';
    } catch { /* offline or no discovery file: use the built-in address */ }
    return builtInApi + '/api/v1';
  })();
  return apiBase;
}
export class ApiError extends Error { constructor(message: string, readonly code: string, readonly status: number) { super(message); } }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await secureStorage.getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const baseUrl = await resolveBaseUrl();
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
    apiBase = null; // re-discover the API address on the next request
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
  home: () => request<HomeState>('/home'),
  redeem: (code: string) => request<RedeemResult>('/codes/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  connect: (deviceKey: string, serverId?: string) => request<{ config: { configText: string; serverLocation: string; allocatedIp: string } }>('/vpn/connect', { method: 'POST', headers: { 'X-Device-Key': deviceKey }, body: JSON.stringify(serverId ? { serverId } : {}) }),
  disconnect: () => request('/vpn/disconnect', { method: 'POST' }),
  servers: async (): Promise<VPNServer[]> => {
    const rows = await request<ApiServer[]>('/servers');
    return rows.map((row) => ({
      id: row.id,
      country: COUNTRY_NAMES[row.countryCode ?? '']?.ru ?? row.location,
      countryCode: row.countryCode ?? '',
      city: row.city ?? row.location,
      ping: row.pingMs ?? null,
      load: row.capacity ? Math.round((row.currentLoad / row.capacity) * 100) : null,
      availability: true,
      premiumOnly: row.premiumOnly,
      access: row.premiumOnly ? 'premium' : 'free',
      recommended: row.recommended,
      remote: true,
    }));
  },
  registerCurrentDevice: (deviceKey: string) => request('/devices/current', { method: 'POST', body: JSON.stringify({ deviceKey, name: 'Android', platform: 'ANDROID' }) }),
};
