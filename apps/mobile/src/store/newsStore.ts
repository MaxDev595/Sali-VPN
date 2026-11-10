import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { api, type Announcement } from '../services/api/client';

const SEEN_KEY = 'sali.news.seen';
export const APP_VERSION = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '0';

/** 1 when a is newer than b ("0.5.10" > "0.5.4"), -1 when older, 0 when equal. */
export function compareVersions(a: string, b: string) {
  const x = a.split('.').map(n => parseInt(n, 10) || 0);
  const y = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0) ? 1 : -1;
  }
  return 0;
}

/** An update for a version newer than this app. */
export const isNewerUpdate = (item?: Announcement | null) => Boolean(item && item.kind === 'UPDATE' && item.version && compareVersions(item.version, APP_VERSION) > 0);

type NewsState = {
  items: Announcement[];
  seenId: string | null;
  loaded: boolean;
  load(): Promise<void>;
  markSeen(): void;
};

/** What's new: update notes and news the admin sends from the bot. */
export const useNewsStore = create<NewsState>((set, get) => ({
  items: [],
  seenId: null,
  loaded: false,
  load: async () => {
    const seenId = get().loaded ? get().seenId : await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
    try {
      const items = await api.announcements();
      set({ items, seenId, loaded: true });
    } catch {
      set({ seenId, loaded: true }); // offline: keep what we had
    }
  },
  markSeen: () => {
    const latest = get().items[0]?.id ?? null;
    if (!latest) return;
    set({ seenId: latest });
    void AsyncStorage.setItem(SEEN_KEY, latest).catch(() => undefined);
  },
}));
