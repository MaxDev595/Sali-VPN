export type VPNStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';
export type SubscriptionStatus = 'free' | 'trial' | 'premium' | 'expired';
/** `remote`: came from the API, so its id can be sent with /vpn/connect. */
export interface VPNServer { id: string; country: string; countryCode: string; city: string; ping: number | null; load: number | null; availability: boolean; premiumOnly: boolean; access?: 'free' | 'premium'; recommended?: boolean; remote?: boolean }
export interface VPNConnection { status: VPNStatus; server: VPNServer | null; connectedAt: number | null; publicIp?: string }
export interface User { id: string; telegramId: string | null; publicId: string; telegramLinked: boolean; firstName?: string | null; username?: string | null }
export interface Subscription { status: SubscriptionStatus; expiresAt: string | null; secondsRemaining?: number; planName?: string }
export interface HomeState { user: User; vpn: { status: 'ACTIVE' | 'DISABLED' | 'PENDING' | 'ERROR'; serverLocation: string } | null; trial: { status: 'ACTIVE' | 'EXPIRED'; expiresAt: string; secondsRemaining: number; isRunning: boolean } | null; subscription: { status: string; expiresAt: string | null; plan: { id: string; name: string; priceUsd: number; originalPriceUsd: number | null } } | null }
