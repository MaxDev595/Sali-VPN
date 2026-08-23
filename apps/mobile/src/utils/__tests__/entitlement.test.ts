import { getEntitlement } from '../entitlement';
import type { HomeState } from '../../types';
const base = { user: { id: '1', telegramId: '1' }, vpn: null, trial: null, subscription: null } satisfies HomeState;
test('premium wins over trial', () => expect(getEntitlement({ ...base, subscription: { status: 'ACTIVE', expiresAt: '2099-01-01', plan: { id: 'p', name: 'Premium', priceUsd: 5, originalPriceUsd: 8 } } })).toBe('premium'));
test('expired trial is rejected', () => expect(getEntitlement({ ...base, trial: { status: 'ACTIVE', expiresAt: '2020-01-01', secondsRemaining: 42, isRunning: false } })).toBe('expired'));
