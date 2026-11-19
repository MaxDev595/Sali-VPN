import { Platform } from 'react-native';
import { secureStorage } from '../secureStorage';
import { vpnEngine } from '../vpn/VpnEngine';
import type { HomeState, VPNServer } from '../../types';
import { COUNTRY_NAMES } from '../../data/fallbackServers';

export interface ApiServer { id: string; name: string; location: string; countryCode: string | null; city: string | null; premiumOnly: boolean; pingMs: number | null; currentLoad: number; capacity: number | null; recommended: boolean }

const builtInApi = String(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const DISCOVERY_URL = process.env.EXPO_PUBLIC_DISCOVERY_URL ?? 'https://salivpn.com/config.json';
let apiBase: Promise<string> | null = null;

/**
 * The API address can change (tunnels), so the app asks salivpn.com/config.json for the
 * current one and falls back to the address baked in at build time.
 */
function resolveBaseUrl() {
  apiBase ??= (async () => {
    if (!DISCOVERY_URL) return builtInApi + '/api/v1'; // the test app talks only to its own backend
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

/**
 * Every way to reach the API, best first: the discovered address, the built-in one, and
 * salivpn.com/api (Cloudflare forwards it) for networks that cut api.salivpn.com now and then.
 */
const FALLBACK_API = process.env.EXPO_PUBLIC_FALLBACK_API ?? 'https://salivpn.com/api/v1';
let preferred = 0;
async function bases() {
  const list = [await resolveBaseUrl(), builtInApi + '/api/v1', ...(FALLBACK_API ? [FALLBACK_API] : [])];
  return list.filter((base, i) => list.indexOf(base) === i);
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One try against one address; network trouble comes back as null. */
async function attempt(base: string, path: string, init: RequestInit, token: string | null, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(base + path, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    return null;
  } finally { clearTimeout(timeout); }
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = await secureStorage.getToken();
  const list = await bases();
  let response: Response | null = null;
  // Up to two rounds over every address (the second one a bit later and more patient).
  for (let round = 0; round < 2 && !response; round++) {
    if (round) await sleep(1500);
    for (let k = 0; k < list.length && !response; k++) {
      const i = (preferred + k) % list.length;
      response = await attempt(list[i]!, path, init, token, round ? 15_000 : 9_000);
      if (response) preferred = i; // keep using the address that answered
    }
  }
  if (!response) {
    apiBase = null; // re-discover the API address next time
    throw new ApiError('Нет связи с сервером Sali. Проверьте интернет — мы попробуем ещё раз.', 'NETWORK', 0);
  }
  if (response.status === 401 && !retried && path !== '/auth/app') {
    await relogin();
    return request<T>(path, init, true);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string | string[]; code?: string };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new ApiError(message ?? 'Не удалось выполнить запрос', body.code ?? 'UNKNOWN', response.status);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export interface Announcement { id: string; kind: 'UPDATE' | 'NEWS'; platform: string | null; version: string | null; title: string; body: string; createdAt: string }

export interface AccountDevice { publicId: string; platform: string | null; current: boolean; covered: boolean; lastActiveAt: string | null; idleDays: number | null }
export interface AccountDevices { linked: boolean; subscription: { plan: string; until: string | null; used: number; max: number } | null; devices: AccountDevice[] }

export interface Plan { code: string; name: string; description: string | null; perMonthUsd: number; durationDays: number; priceUsd: number; originalPriceUsd: number | null; maxDevices: number; discountedPriceUsd: number | null }
export interface PlansResponse { telegramLinked: boolean; currency: string; discountPercent: number; plans: Plan[] }
export interface Invoice { topup?: boolean; paymentId: string; plan: { code: string; name: string; durationDays: number }; gift: string | null; discountPercent: number; amount: string; asset: string; network: string; address: string; comment: string; expiresAt: string; tonUrl: string | null; tonkeeperUrl: string | null }
export interface PaymentState { topup?: boolean; autoRenew?: boolean | null; balanceUsd?: number | null; amountUsd?: number; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'; expired: boolean; plan: string; gift: boolean; until: string | null }
export type PromoResult =
  | { kind: 'DAYS'; code: string; days: number; until: string | null }
  | { kind: 'DISCOUNT'; code: string; percent: number }
  | { kind: 'REFERRAL'; from: string; bonusHours: number; pending: boolean };
export type Backup =
  | { enabled: false }
  | { enabled: true; linked: false }
  | { enabled: true; linked: true; access: false; message: string }
  | { enabled: true; linked: true; access: true; url: string; servers: number; expiresAt: string | null; open: { happ: string; v2raytun: string; hiddify: string } };
export interface BalanceTx { id: string; at: string; kind: 'TOPUP' | 'PURCHASE' | 'GIFT' | 'AUTO_RENEW' | 'REFUND' | 'ADMIN'; label: string; amountUsd: number; balanceAfter: number; note: string | null }
export interface BalanceInfo { linked: boolean; minTopUpUsd: number; maxTopUpUsd: number; balanceUsd: number; autoRenew: { planCode: string; name: string; durationDays: number; priceUsd: number } | null; nextRenewalAt: string | null; subscriptionUntil: string | null; history: BalanceTx[] }
export interface BalancePurchase { plan: string; priceUsd: number; discountPercent: number; balanceUsd: number; until: string | null; gift: boolean }
export interface Referrals { channel?: string; channelTag?: string; code: string; invited: number; rewarded: number; availableDiscounts: number; discountPercent: number; friendBonusHours: number; shareText: string }
export interface AppDevice { key: string; id: string; name: string | null; platform: string | null; current: boolean; covered: boolean; idleDays: number | null }
export interface AppDevices { linked: boolean; max: number; used: number; devices: AppDevice[] }

// ---- admin ----
export interface AdminStats {
  telegramUsers: number; devices: number; linkedDevices: number; new24h: number; new7d: number; new30d: number; activeDevices7d: number;
  access: { paid: number; granted: number; trial: number; expired30d: number; expiringPaid3d: number; onlineNow: number | null };
  revenue: { day: number; dayCount: number; week: number; weekCount: number; month: number; monthCount: number; total: number; totalCount: number; avgCheck30d: number; byMethod30d: Array<{ method: string; sum: number; count: number }>; payers: number; payers30d: number; refunds: number };
  referrals: { total: number; rewarded: number };
  balances?: { wallet: string; held: number; toppedUp: number; spent: number };
  servers: Array<{ name: string; online: boolean; premiumOnly: boolean; isActive: boolean; users: number; connectedNow: number | null }>;
}
export type PeopleSegment = 'paid' | 'granted' | 'trial' | 'expired';
export interface AdminPeople { segment: PeopleSegment; page: number; pages: number; counts: { paid: number; granted: number; trial: number; expired: number; online: number | null }; list: Array<{ userId: string; name: string; username: string | null; device: string | null; plan: string; until: string; via: string | null; blocked: boolean }> }
export interface AdminCard { accountId?: string | null; balanceUsd?: number; autoRenew?: boolean; id: string; kind: 'telegram' | 'device'; title: string; username: string | null; telegramId: string | null; publicId: string; owner: string | null; createdAt: string; isBlocked: boolean; access: string; devices: Array<{ id: string; publicId: string; access: string }>; paidUsd: number; payments: number; invited: number }
export interface AdminPayment { id: string; at: string; status: string; amountUsd: number; discountPercent: number; method: string; plan: string; account: string; name: string | null; giftTo: string | null }
export interface AdminPromo { id: string; code: string; kind: 'DAYS' | 'DISCOUNT'; days: number; discountPercent: number; maxUses: number | null; usedCount: number; expiresAt: string | null; isActive: boolean; note: string | null; createdAt: string }

export interface RedeemResult { kind: 'PAID' | 'FREE' | 'GIFT' | 'PROMO'; durationDays: number; planName: string | null; expiresAt: string | null }

/** «Samsung SM-A515F»: tells one phone from another in the account (one device = one Sali ID). */
function deviceName() {
  const c = (Platform.constants ?? {}) as { Manufacturer?: string; Brand?: string; Model?: string };
  const name = [c.Manufacturer ?? c.Brand, c.Model].filter(Boolean).join(' ').trim();
  return (name || 'Android').slice(0, 40);
}

export const api = {
  appLogin: (deviceKey: string) => request<{ token: string; publicId: string }>('/auth/app', { method: 'POST', body: JSON.stringify({ deviceKey }) }),
  home: () => request<HomeState>('/home'),
  redeem: (code: string) => request<RedeemResult>('/codes/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  connect: (deviceKey: string, serverId?: string) => request<{ config: { configText: string }; server?: ApiServer }>('/vpn/connect', { method: 'POST', headers: { 'X-Device-Key': deviceKey }, body: JSON.stringify(serverId ? { serverId } : {}) }),
  disconnect: () => request('/vpn/disconnect', { method: 'POST' }),
  servers: async (): Promise<VPNServer[]> => (await request<ApiServer[]>('/servers')).map(toServer),
  /** Update notes and news from the bot (public; no sign-in needed). */
  announcements: () => request<Announcement[]>('/announcements?platform=android'),
  /** Every installation under this Telegram account (they share one subscription). */
  accountDevices: () => request<AccountDevices>('/devices/account'),
  unlinkDevice: (publicId: string) => request<{ ok: boolean }>('/devices/account/unlink', { method: 'POST', body: JSON.stringify({ publicId }) }),
  // ---- the app's own shop: plans, USDT (TON) invoices, gifts, promo codes, friends ----
  plans: () => request<PlansResponse>('/app/plans'),
  purchase: (planCode: string, options: { giftTo?: string; promo?: string } = {}) => request<Invoice>('/app/purchase', { method: 'POST', body: JSON.stringify({ planCode, ...options }) }),
  payment: (id: string) => request<PaymentState>(`/app/payments/${id}`),
  checkGift: (code: string) => request<{ to: string; name: string | null }>('/app/gift/check', { method: 'POST', body: JSON.stringify({ code }) }),
  promo: (code: string) => request<PromoResult>('/app/promo', { method: 'POST', body: JSON.stringify({ code }) }),
  referrals: () => request<Referrals>('/app/referrals'),
  devices: () => request<AppDevices>('/app/devices'),
  backup: () => request<Backup>('/app/backup'),
  balance: () => request<BalanceInfo>('/app/balance'),
  topUp: (amountUsd: number) => request<Invoice>('/app/balance/topup', { method: 'POST', body: JSON.stringify({ amountUsd }) }),
  payFromBalance: (planCode: string, options: { giftTo?: string; promo?: string } = {}) => request<BalancePurchase>('/app/balance/pay', { method: 'POST', body: JSON.stringify({ planCode, ...options }) }),
  setAutoRenew: (planCode: string | null) => request<BalanceInfo>('/app/balance/auto-renew', { method: 'POST', body: JSON.stringify({ planCode }) }),
  resetBackup: () => request<Backup>('/app/backup/reset', { method: 'POST' }),
  removeDevice: (key: string) => request<{ ok: boolean }>('/app/devices/remove', { method: 'POST', body: JSON.stringify({ key }) }),
  admin: {
    stats: () => request<AdminStats>('/app/admin/stats'),
    people: (segment: PeopleSegment, page = 0) => request<AdminPeople>(`/app/admin/people?segment=${segment}&page=${page}`),
    lookup: (query: string) => request<AdminCard>('/app/admin/lookup', { method: 'POST', body: JSON.stringify({ query }) }),
    grant: (userId: string, days: number, kind: 'admin' | 'gift', message?: string) => request<{ until: string; devices: string[]; delivered: boolean }>('/app/admin/grant', { method: 'POST', body: JSON.stringify({ userId, days, kind, ...(message ? { message } : {}) }) }),
    revoke: (userId: string) => request<unknown>('/app/admin/revoke', { method: 'POST', body: JSON.stringify({ userId }) }),
    block: (userId: string, isBlocked: boolean) => request<{ isBlocked: boolean }>('/app/admin/block', { method: 'POST', body: JSON.stringify({ userId, isBlocked }) }),
    payments: () => request<AdminPayment[]>('/app/admin/payments'),
    promos: () => request<AdminPromo[]>('/app/admin/promos'),
    createPromo: (input: { code: string; kind: 'DAYS' | 'DISCOUNT'; days?: number; discountPercent?: number; maxUses?: number; expiresInDays?: number; note?: string }) => request<{ id: string; code: string }>('/app/admin/promos', { method: 'POST', body: JSON.stringify(input) }),
    adjustBalance: (userId: string, amountUsd: number, note: string) => request<{ balanceUsd: number }>('/app/admin/balance', { method: 'POST', body: JSON.stringify({ userId, amountUsd, note }) }),
    renewNow: () => request<{ renewed: number }>('/app/admin/renew-now', { method: 'POST' }),
    setPromoActive: (id: string, isActive: boolean) => request<{ ok: boolean }>(`/app/admin/promos/${id}/active`, { method: 'POST', body: JSON.stringify({ isActive }) }),
  },
  registerCurrentDevice: (deviceKey: string) => request('/devices/current', { method: 'POST', body: JSON.stringify({ deviceKey, name: deviceName(), platform: 'ANDROID' }) }),
};
