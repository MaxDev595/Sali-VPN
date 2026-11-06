import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { ApiError, api } from '../services/api/client';
import { vpnEngine } from '../services/vpn/VpnEngine';
import { ensureSession } from '../services/session';
import { useAccountStore } from './accountStore';
import type { VPNConnection, VPNServer, VPNStatus } from '../types';
import { fallbackServers } from '../data/fallbackServers';

type VpnState = VPNConnection & {
  error: string | null;
  /** True when the server refused because there is no tariff: the UI offers "Ввести код". */
  needsCode: boolean;
  setServer(server: VPNServer): void;
  adoptServer(servers: VPNServer[]): void;
  setStatus(status: VPNStatus): void;
  clearError(): void;
  toggle(): Promise<void>;
};

export const useVpnStore = create<VpnState>((set, get) => ({
  status: 'disconnected', server: fallbackServers[0]!, connectedAt: null, error: null, needsCode: false,
  setServer: (server) => { set({ server }); void Haptics.selectionAsync(); },
  adoptServer: (servers) => {
    // Swap the offline placeholder for the matching (or recommended) real server once the list loads.
    const current = get().server;
    if (current?.remote) return;
    const next = servers.find((item) => item.countryCode === current?.countryCode && !item.premiumOnly) ?? servers.find((item) => item.recommended) ?? servers[0];
    if (next) set({ server: next });
  },
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
        const server = get().server;
        const result = await api.connect(deviceKey, server?.remote ? server.id : undefined);
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
