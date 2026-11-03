import { create } from 'zustand';
import { ApiError, api } from '../services/api/client';
import { ensureSession } from '../services/session';
import { secureStorage } from '../services/secureStorage';
import { getEntitlement } from '../utils/entitlement';
import type { HomeState, SubscriptionStatus } from '../types';

type AccountState = {
  home: HomeState | null;
  access: SubscriptionStatus;
  loading: boolean;
  error: string | null;
  refresh(): Promise<HomeState | null>;
};

/** Sali ID, Telegram link and current tariff — the server is the source of truth. */
export const useAccountStore = create<AccountState>((set) => ({
  home: null,
  access: 'free',
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true });
    const load = async () => { await ensureSession(); return api.home(); };
    try {
      let home: HomeState;
      try { home = await load(); }
      catch (error) {
        // Expired session: sign in again silently with the installation key.
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        await secureStorage.clearToken();
        home = await load();
      }
      set({ home, access: getEntitlement(home), loading: false, error: null });
      return home;
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Не удалось загрузить аккаунт' });
      return null;
    }
  },
}));
