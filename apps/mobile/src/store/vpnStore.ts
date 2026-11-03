import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { ApiError, api } from '../services/api/client';
import { vpnEngine } from '../services/vpn/VpnEngine';
import { ensureSession } from '../services/session';
import { useAccountStore } from './accountStore';
import type { VPNConnection, VPNServer, VPNStatus } from '../types';

type VpnState = VPNConnection & {
  error: string | null;
  /** True when the server refused because there is no tariff: the UI offers "Ввести код". */
  needsCode: boolean;
  setServer(server: VPNServer): void;
  setStatus(status: VPNStatus): void;
  clearError(): void;
  toggle(): Promise<void>;
};

export const useVpnStore = create<VpnState>((set, get) => ({
  status: 'disconnected', server: { id: 'nl-free', country: 'Нидерланды', countryCode: 'NL', city: 'Амстердам', ping: 34, load: 38, availability: true, premiumOnly: false, access: 'free' }, connectedAt: null, error: null, needsCode: false,
  setServer: (server) => { set({ server }); void Haptics.selectionAsync(); },
  setStatus: (status) => set({ status }),
  clearError: () => set({ error: null, needsCode: false, status: get().status === 'error' ? 'disconnected' : get().status }),
  toggle: async () => {
    const current = get().status;
    if (current === 'connecting' || current === 'disconnecting') return;
    try {
      if (current === 'connected') {
        set({ status: 'disconnecting', error: null });
        await vpnEngine.disconnect();
        await api.disconnect();
        set({ status: 'disconnected', connectedAt: null });
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        set({ status: 'connecting', error: null, needsCode: false });
        await ensureSession();
        await vpnEngine.prepare();
        const deviceKey = await vpnEngine.deviceKey();
        await api.registerCurrentDevice(deviceKey);
        const result = await api.connect(deviceKey);
        await vpnEngine.connect(result.config.configText);
        set({ status: 'connected', connectedAt: Date.now() });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      const needsCode = error instanceof ApiError && error.status === 403;
      set({ status: needsCode ? 'disconnected' : 'error', needsCode, error: error instanceof Error ? error.message : 'Не удалось подключиться' });
      await Haptics.notificationAsync(needsCode ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Error);
    } finally {
      void useAccountStore.getState().refresh();
    }
  },
}));
