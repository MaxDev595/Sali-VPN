import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, api } from '../services/api/client';
import { ensureSession } from '../services/session';
import { secureStorage } from '../services/secureStorage';
import { getEntitlement } from '../utils/entitlement';
import type { HomeState, SubscriptionStatus } from '../types';

type AccountState = {
  home: HomeState | null;
  /** True while showing the last saved account because the server did not answer. */
  stale: boolean;
  access: SubscriptionStatus;
  loading: boolean;
  error: string | null;
  refresh(): Promise<HomeState | null>;
};

/** Sali ID, Telegram link and current tariff — the server is the source of truth. */
const CACHE_KEY = 'sali.home.cache';

/**
 * A network hiccup must never look like «нет тарифа»: the last answer is kept on the phone,
 * shown at once on launch, and stays on screen if a refresh fails.
 */
export const useAccountStore = create<AccountState>((set, get) => ({
  home: null,
  stale: false,
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
      set({ home, access: getEntitlement(home), loading: false, error: null, stale: false });
      void AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ home, savedAt: Date.now() })).catch(() => undefined);
      return home;
    } catch (error) {
      const offline = error instanceof ApiError && error.code === 'NETWORK';
      // Nothing on screen yet (launch): show the saved account instead of an empty «нет тарифа».
      if (offline && !get().home) {
        const cached = await AsyncStorage.getItem(CACHE_KEY).then((raw) => (raw ? JSON.parse(raw) as { home: HomeState } : null)).catch(() => null);
        if (cached?.home) set({ home: cached.home, access: getEntitlement(cached.home), stale: true });
      } else if (offline) set({ stale: true });
      set({ loading: false, error: error instanceof Error ? error.message : 'Не удалось загрузить аккаунт' });
      return get().home;
    }
  },
}));
