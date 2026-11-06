import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'ru' | 'en';
type Preferences = {
  hydrated: boolean;
  language: Language;
  notifications: boolean;
  autoConnect: boolean;
  killSwitch: boolean;
  hydrate(): Promise<void>;
  set<K extends 'language' | 'notifications' | 'autoConnect' | 'killSwitch'>(key: K, value: Preferences[K]): Promise<void>;
};

const key = 'sali.preferences.v1';
const defaults = { language: 'ru' as Language, notifications: true, autoConnect: false, killSwitch: false };

export const usePreferencesStore = create<Preferences>((set, get) => ({
  ...defaults,
  hydrated: false,
  hydrate: async () => {
    try { const raw = await AsyncStorage.getItem(key); if (raw) { const saved = JSON.parse(raw) as Partial<typeof defaults>; set({ language: saved.language ?? defaults.language, notifications: saved.notifications ?? defaults.notifications, autoConnect: saved.autoConnect ?? defaults.autoConnect, killSwitch: saved.killSwitch ?? defaults.killSwitch }); } }
    finally { set({ hydrated: true }); }
  },
  set: async (name, value) => {
    set({ [name]: value } as Pick<Preferences, typeof name>);
    const current = get();
    await AsyncStorage.setItem(key, JSON.stringify({ language: current.language, notifications: current.notifications, autoConnect: current.autoConnect, killSwitch: current.killSwitch }));
  },
}));
