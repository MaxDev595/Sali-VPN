import { secureStorage } from '../secureStorage';
import { vpnEngine } from '../vpn/VpnEngine';
import type { HomeState, VPNServer } from '../../types';
import { COUNTRY_NAMES } from '../../data/fallbackServers';

export interface ApiServer { id: string; name: string; location: string; countryCode: string | null; city: string | null; premiumOnly: boolean; pingMs: number | null; currentLoad: number; capacity: number | null; recommended: boolean }

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
/** API server row → the app's server model. */
export function toServer(row: ApiServer): VPNServer {
  return {
    id: row.id,
    country: COUNTRY_NAMES[row.countryCode ?? '']?.ru ?? row.location,
    countryCode: row.countryCode ?? '',
    city: row.city ?? row.location,
    ping: row.pingMs ?? null,
    load: row.capacity ? Math.round(((row.currentLoad ?? 0) / row.capacity) * 100) : null,
    availability: true,
    premiumOnly: row.premiumOnly,
    access: row.premiumOnly ? 'premium' : 'free',
    recommended: row.recommended ?? false,
    remote: true,
  };
}

export class ApiError extends Error { constructor(message: string, readonly code: string, readonly status: number) { super(message); } }

/**
 * Sign-in tokens expire (7 days). On 401 the app silently signs in again with its installation
 * key and repeats the request once — otherwise, a week after install, the server list and
 * everything else would stop loading.
 */
async function relogin() {
  await secureStorage.clearToken();
  const deviceKey = await vpnEngine.deviceKey();
  const auth = await request<{ token: string }>('/auth/app', { method: 'POST', body: JSON.stringify({ deviceKey }) }, true);
  await secureStorage.setToken(auth.token);
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
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
    if (response.status === 401 && !retried && path !== '/auth/app') {
      clearTimeout(timeout);
      await relogin();
      return request<T>(path, init, true);
    }
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

export interface Announcement { id: string; kind: 'UPDATE' | 'NEWS'; platform: string | null; version: string | null; title: string; body: string; createdAt: string }

export interface RedeemResult { kind: 'PAID' | 'FREE' | 'GIFT' | 'PROMO'; durationDays: number; planName: string | null; expiresAt: string | null }

/**
 * The store app never sells anything: no prices, no checkout, no billing SDK.
 * Access arrives only as activation codes issued by the Telegram bot.
 */
export const api = {
  appLogin: (deviceKey: string) => request<{ token: string; publicId: string }>('/auth/app', { method: 'POST', body: JSON.stringify({ deviceKey }) }),
  home: () => request<HomeState>('/home'),
  redeem: (code: string) => request<RedeemResult>('/codes/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  connect: (deviceKey: string, serverId?: string) => request<{ config: { configText: string }; server?: ApiServer }>('/vpn/connect', { method: 'POST', headers: { 'X-Device-Key': deviceKey }, body: JSON.stringify(serverId ? { serverId } : {}) }),
  disconnect: () => request('/vpn/disconnect', { method: 'POST' }),
  servers: async (): Promise<VPNServer[]> => (await request<ApiServer[]>('/servers')).map(toServer),
  /** Update notes and news from the bot (public; no sign-in needed). */
  announcements: () => request<Announcement[]>('/announcements?platform=android'),
  registerCurrentDevice: (deviceKey: string) => request('/devices/current', { method: 'POST', body: JSON.stringify({ deviceKey, name: 'Android', platform: 'ANDROID' }) }),
};
