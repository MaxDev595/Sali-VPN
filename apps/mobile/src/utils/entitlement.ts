import type { HomeState, SubscriptionStatus } from '../types';
export function getEntitlement(home: HomeState | undefined, now = Date.now()): SubscriptionStatus {
  if (home?.subscription?.status === 'ACTIVE' && (!home.subscription.expiresAt || Date.parse(home.subscription.expiresAt) > now)) return 'premium';
  if (home?.trial?.status === 'ACTIVE' && home.trial.secondsRemaining > 0 && Date.parse(home.trial.expiresAt) > now) return 'trial';
  return home?.trial ? 'expired' : 'free';
}
