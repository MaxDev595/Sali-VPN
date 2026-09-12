import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api/client';
import { vpnEngine } from '../services/vpn/VpnEngine';
import { secureStorage } from '../services/secureStorage';
import type { VPNConnection, VPNServer, VPNStatus } from '../types';

type VpnState = VPNConnection & { error: string | null; setServer(server: VPNServer): void; setStatus(status: VPNStatus): void; toggle(): Promise<void> };
export const useVpnStore = create<VpnState>((set, get) => ({
  status: 'disconnected', server: { id: 'nl-free', country: 'Нидерланды', countryCode: 'NL', city: 'Амстердам', ping: 34, load: 38, availability: true, premiumOnly: false, access: 'free' }, connectedAt: null, error: null,
  setServer: (server) => { set({ server }); void Haptics.selectionAsync(); }, setStatus: (status) => set({ status }),
  toggle: async () => {
    const current = get().status;
    if (current === 'connecting' || current === 'disconnecting') return;
    try {
      if (current === 'connected') { set({ status: 'disconnecting', error: null }); await vpnEngine.disconnect(); await api.disconnect(); set({ status: 'disconnected', connectedAt: null }); await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
      else { set({ status: 'connecting', error: null }); await vpnEngine.prepare(); if (!(await secureStorage.getToken())) { const auth = await api.localLogin(); await secureStorage.setToken(auth.token); } const result = await api.connect(); await vpnEngine.connect(result.config.configText); set({ status: 'connected', connectedAt: Date.now() }); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    } catch (error) { set({ status: 'error', error: error instanceof Error ? error.message : 'Не удалось подключиться' }); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
  },
}));
