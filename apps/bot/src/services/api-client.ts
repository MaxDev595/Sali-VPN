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

export interface HappLink {
  url: string;
  openUrl: string;
  enabled: boolean;
  expiresAt: string | null;
  servers: number;
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
  /** Referral discount waiting for this customer (0 if none). */
  discountPercent?: number;
  discountedPriceUsd?: number | null;
  discountedStars?: number | null;
}

export interface ReferralStats {
  link: string;
  totalInvited: number;
  totalRewarded: number;
  availableDiscounts: number;
  discountPercent: number;
  friendBonusHours: number;
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

/** The account's subscription as seen by a freshly linked installation (shared by up to `max`). */
export type LinkNotes = { replaced: string[]; freed: string | null; trialStarted: boolean };
export type PaidInfo = { plan: string; until: string | null; maxDevices: number; devices: number };

export interface LinkShare {
  plan: string;
  until: string | null;
  covered: boolean;
  used: number;
  max: number;
  others: Array<{ publicId: string; platform: string | null }>;
}

export interface DevicesOverview {
  devices: LinkedDevice[];
  subscription: { plan: string; until: string | null; used: number; max: number } | null;
}

export interface LinkedDevice {
  publicId: string;
  platform?: string | null;
  shared?: boolean;
  idleDays?: number | null;
  linkedAt: string | null;
  tariff: string | null;
  until: string | null;
  active: boolean;
  secondsLeft?: number;
}

export type Purchase =
  | { method: 'stars'; paymentId: string; stars: number; title: string; description: string; discountPercent?: number }
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
    call<{ publicId: string; link: { status: 'linked' | 'already' | 'not_found' | 'linked_elsewhere'; publicId?: string; share?: LinkShare | null; notes?: LinkNotes } | null; linkedApps: number; freeUsed: boolean; isBlocked: boolean; referred?: boolean; friendBonusHours?: number }>('/bot/start', { profile, startParam }),
  referrals: (telegramId: number) => call<ReferralStats>('/bot/referrals', { telegramId }),
  link: (telegramId: number, publicId: string) =>
    call<{ status: 'linked' | 'already' | 'not_found' | 'linked_elsewhere'; publicId: string | null; share: LinkShare | null; notes?: LinkNotes }>('/bot/link', { telegramId, publicId }),
  unlink: (telegramId: number, publicId: string) => call<{ ok: boolean; publicId: string }>('/bot/unlink', { telegramId, publicId }, 0),
  devices: (telegramId: number) => call<DevicesOverview>('/bot/devices', { telegramId }),
  plans: (telegramId?: number) => call<BotPlan[]>('/bot/plans', telegramId ? { telegramId } : {}),
  purchase: (profile: TelegramProfile, planCode: string, method: 'stars' | 'crypto' | 'card') =>
    call<Purchase>('/bot/purchase', { profile, planCode, method }, 0),
  precheck: (telegramId: number, paymentId: string, amount: number, currency: string) =>
    call<{ ok: boolean; error?: string }>('/bot/precheck', { telegramId, paymentId, amount, currency }, 0),
  starsPaid: (telegramId: number, paymentId: string, amount: number, currency: string, chargeId: string) =>
    call<{ code: IssuedCode | null; paid?: PaidInfo | null }>('/bot/stars-paid', { telegramId, paymentId, amount, currency, chargeId }),
  paymentStatus: (telegramId: number, paymentId: string) =>
    call<{ status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'; code: IssuedCode | null; paid?: PaidInfo | null }>('/bot/payment-status', { telegramId, paymentId }),
  freeCode: (telegramId: number) => call<{ device: string; expiresAt: string }>('/bot/free', { telegramId }, 0),
  codes: (telegramId: number) => call<OwnedCode[]>('/bot/codes', { telegramId }),
  apply: (telegramId: number, code: string, publicId?: string) =>
    call<{ chooseDevice?: string[]; referralBonusHours?: number; kind?: string; durationDays?: number; planName?: string | null; expiresAt?: string | null; publicId?: string }>('/bot/apply', { telegramId, code, publicId }, 0),

  // --- Admin: VPN nodes ----------------------------------------------------
  nodeToken: (telegramId: number, countryCode: string, city?: string) =>
    call<{ name: string; command: string }>('/bot/nodes/token', { telegramId, countryCode, city }, 0),
  nodes: (telegramId: number) =>
    call<Array<{ name: string; host: string; country: string; active: boolean; premiumOnly?: boolean; online: boolean; users: number | null; connectedNow: number | null; load: number | null; happ?: number | null }>>('/bot/nodes/list', { telegramId }, 0),
  nodeActive: (telegramId: number, name: string, isActive: boolean) =>
    call<{ updated: number }>('/bot/nodes/active', { telegramId, name, isActive }, 0),
  nodePremium: (telegramId: number, name: string, premiumOnly: boolean) =>
    call<{ updated: number }>('/bot/nodes/premium', { telegramId, name, premiumOnly }, 0),

  // --- Admin panel (/admin) -------------------------------------------------
  happEnabled: () => call<{ enabled: boolean }>('/bot/happ/enabled', {}, 0),
  happLink: (telegramId: number) => call<HappLink>('/bot/happ/link', { telegramId }, 0),
  happRotate: (telegramId: number) => call<HappLink>('/bot/happ/rotate', { telegramId }, 0),
  isAdmin: (telegramId: number) => call<{ admin: boolean }>('/bot/nodes/is-admin', { telegramId }, 1),
  adminLookup: (telegramId: number, query: string) => call<AdminCard>('/bot/admin/lookup', { telegramId, query }, 0),
  adminGrant: (telegramId: number, userId: string, days: number, kind: 'admin' | 'gift', message?: string) =>
    call<{ mode: 'code' | 'direct'; code: string; delivered: boolean; devices: string[]; activationError: string | null; until?: string }>('/bot/admin/grant', { telegramId, userId, days, kind, message }, 0),
  adminCode: (telegramId: number, days: number) => call<{ code: string; plan: string; days: number; expiresAt: string }>('/bot/admin/code', { telegramId, days }, 0),
  adminDiagnose: (telegramId: number, userId: string) => call<{ title: string; lines: string[]; problems: string[] }>('/bot/admin/diagnose', { telegramId, userId }, 0),
  adminRevoke: (telegramId: number, userId: string) => call<{ subscriptions: number; codes: number }>('/bot/admin/revoke', { telegramId, userId }, 0),
  adminRevocable: (telegramId: number, userId: string) => call<{ title: string; subscriptions: Array<{ id: string; where: string; plan: string; until: string }>; codes: Array<{ id: string; code: string; what: string }> }>('/bot/admin/revocable', { telegramId, userId }, 0),
  adminRevokeSub: (telegramId: number, subscriptionId: string, notify: boolean) => call<{ userId: string }>('/bot/admin/revoke-sub', { telegramId, subscriptionId, notify }, 0),
  adminRevokeCode: (telegramId: number, codeId: string) => call<{ userId: string }>('/bot/admin/revoke-code', { telegramId, codeId }, 0),
  adminBlock: (telegramId: number, userId: string, isBlocked: boolean) => call<{ isBlocked: boolean }>('/bot/admin/block', { telegramId, userId, isBlocked }, 0),
  adminIssued: (telegramId: number) => call<AdminGrantRow[]>('/bot/admin/issued', { telegramId }, 0),
  adminStats: (telegramId: number) => call<AdminStats>('/bot/admin/stats', { telegramId }, 0),
  adminPeople: (telegramId: number, segment: PeopleSegment, page: number) => call<AdminPeople>('/bot/admin/people', { telegramId, segment, page }, 0),
  announcePreview: (telegramId: number, draft: AnnouncementDraft) => call<{ html: string; recipients: number }>('/bot/admin/announce/preview', { telegramId, ...draft }, 0),
  announcePublish: (telegramId: number, draft: AnnouncementDraft) => call<{ id: string; recipients: number }>('/bot/admin/announce/publish', { telegramId, ...draft }, 0),
  announceStatus: (telegramId: number, id: string) => call<{ id: string; recipients: number; delivered: number; failed: number; finishedAt: string | null }>('/bot/admin/announce/status', { telegramId, id }, 0),
  announceHistory: (telegramId: number) => call<AnnouncementRow[]>('/bot/admin/announce/history', { telegramId }, 0),
  announceHide: (telegramId: number, id: string) => call<{ ok: boolean }>('/bot/admin/announce/hide', { telegramId, id }, 0),
};

export type AnnouncePlatform = 'android' | 'windows' | 'all';
export interface AnnouncementDraft { kind: 'UPDATE' | 'NEWS'; platform?: AnnouncePlatform; version?: string; title?: string; body: string; showInApp: boolean }
export interface AnnouncementRow { id: string; kind: 'UPDATE' | 'NEWS'; version: string | null; title: string | null; platform: string | null; body: string; showInApp: boolean; recipients: number; delivered: number; failed: number; finished: boolean; createdAt: string }

export type PeopleSegment = 'paid' | 'granted' | 'trial' | 'expired';
export interface AdminPeople {
  segment: PeopleSegment;
  page: number;
  pages: number;
  counts: { paid: number; granted: number; trial: number; expired: number; online: number | null };
  list: Array<{ userId: string; name: string; username: string | null; device: string | null; plan: string; until: string; via: string | null; blocked: boolean }>;
}

export interface AdminCard {
  id: string;
  kind: 'telegram' | 'device';
  title: string;
  username: string | null;
  telegramId: string | null;
  publicId: string;
  owner: string | null;
  createdAt: string;
  isBlocked: boolean;
  access: string;
  devices: Array<{ id: string; publicId: string; access: string }>;
  paidUsd: number;
  payments: number;
  codesIssued: number;
  codesRedeemed: number;
  invited: number;
}

export interface AdminGrantRow {
  to: string;
  kind: 'admin' | 'gift';
  duration: string;
  status: 'ISSUED' | 'REDEEMED' | 'REVOKED' | 'APPLIED';
  code: string | null;
  device: string | null;
  message: string | null;
  at: string;
}

export interface AdminStats {
  telegramUsers: number;
  devices: number;
  linkedDevices?: number;
  new24h: number;
  new7d: number;
  new30d?: number;
  activeDevices7d?: number;
  activeSubscriptions: number;
  activeTrials: number;
  access?: { paid: number; granted: number; trial: number; expired30d: number; expiringPaid3d: number; onlineNow: number | null };
  revenue: {
    day: number; dayCount: number; month: number; monthCount: number; total: number; totalCount: number;
    week?: number; weekCount?: number; avgCheck30d?: number; payers?: number; payers30d?: number; refunds?: number;
    byMethod30d?: Array<{ method: string; sum: number; count: number }>;
  };
  conversion?: { payersOfUsers: number; freeOfUsers: number };
  codes?: { freeIssued: number; freeRedeemed: number; paid30d: number; paidRedeemed30d: number };
  referrals?: { total: number; rewarded: number };
  servers: Array<{ name: string; online: boolean; premiumOnly: boolean; isActive: boolean; users?: number; connectedNow?: number | null }>;
  adminGrants: number;
}
