// Shared types across apps/api, apps/bot and apps/web.
// Keep this package free of framework-specific dependencies.

export type VpnAccountStatus = 'ACTIVE' | 'DISABLED' | 'PENDING' | 'ERROR';
export type TrialStatus = 'ACTIVE' | 'EXPIRED';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING_PAYMENT';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type DevicePlatform = 'IOS' | 'ANDROID' | 'WINDOWS' | 'MACOS' | 'LINUX' | 'OTHER';
export type ReferralStatus = 'PENDING' | 'REWARDED';
export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export interface UserDTO {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isBlocked: boolean;
  createdAt: string;
}

export interface TrialDTO {
  status: TrialStatus;
  startedAt: string;
  expiresAt: string;
  secondsRemaining: number;
  sessionSeconds: number;
  totalSeconds: number;
  limitSeconds: number;
  isRunning: boolean;
}

export interface PlanDTO {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  priceUsd: number;
  originalPriceUsd: number | null;
  maxDevices: number;
}

export interface SubscriptionDTO {
  id: string;
  status: SubscriptionStatus;
  plan: PlanDTO;
  startedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
}

export interface VpnConnectionConfigDTO {
  // Full WireGuard config file contents. Never logged, never cached client-side
  // longer than necessary — shown once and the user is told to save it.
  configText: string;
  qrCodeDataUrl: string;
  serverLocation: string;
  allocatedIp: string;
}

export interface VpnAccountDTO {
  status: VpnAccountStatus;
  serverLocation: string;
  pingMs?: number | null;
}

export interface DeviceDTO {
  id: string;
  name: string;
  platform: DevicePlatform;
  isActive: boolean;
  lastActiveAt: string | null;
}

export interface ReferralInfoDTO {
  link: string;
  totalInvited: number;
  totalRewarded: number;
  rewardDaysEarned: number;
}

export interface HomeStateDTO {
  user: UserDTO;
  vpn: VpnAccountDTO | null;
  trial: TrialDTO | null;
  subscription: SubscriptionDTO | null;
  hasEverHadAccess: boolean;
}

export interface ApiErrorBody {
  message: string;
  code: string;
}

// Telegram WebApp initData, validated server-side (see apps/api auth module)
export interface TelegramInitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}
