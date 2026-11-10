import { create } from 'zustand';
import { PermissionsAndroid, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ApiError, api, toServer } from '../services/api/client';
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
  /** Moves a live tunnel to the selected server (new config from the API, swapped in place). */
  reconnect(previous?: VPNServer): Promise<void>;
  /** Picks up a tunnel that kept running while the app was closed and follows native changes. */
  init(): () => void;
};

/** What the ongoing notification shows: «Германия · Франкфурт». */
const label = (server?: VPNServer | null) => (server ? [server.country, server.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ') : '');

/** Android 13+: the ongoing «VPN подключён» notification needs this permission. Never blocks connecting. */
async function askNotifications() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try { await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never); } catch { /* the VPN works without it */ }
}

/** Asks the API for a config (it may move us to the chosen server) and starts/swaps the tunnel. */
async function bringUp(server: VPNServer | null) {
  const deviceKey = await vpnEngine.deviceKey();
  const result = await api.connect(deviceKey, server?.remote ? server.id : undefined);
  // The real server the tunnel goes to — not the placeholder picked while the list was offline.
  const actual = result.server ? toServer(result.server) : server;
  await vpnEngine.connect(result.config.configText, label(actual), actual?.id ?? '');
  return actual;
}

export const useVpnStore = create<VpnState>((set, get) => ({
  status: 'disconnected', server: fallbackServers[0]!, connectedAt: null, error: null, needsCode: false,
  setServer: (server) => {
    const previous = get().server;
    set({ server });
    void Haptics.selectionAsync();
    // Picking another location while connected must actually move the tunnel, not just the label.
    if (previous?.id !== server.id && get().status === 'connected') void get().reconnect(previous ?? undefined);
  },
  adoptServer: (servers) => {
    const current = get().server;
    if (current?.remote) {
      // Refresh the details (load, ping) of the selected real server.
      const fresh = servers.find((item) => item.id === current.id);
      if (fresh) set({ server: fresh });
      return;
    }
    // Swap the offline placeholder for the matching (or recommended) real server once the list loads.
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
        await api.disconnect().catch(() => undefined);
        set({ status: 'disconnected', connectedAt: null });
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        set({ status: 'connecting', error: null, needsCode: false });
        await ensureSession();
        await vpnEngine.prepare();
        await askNotifications();
        const deviceKey = await vpnEngine.deviceKey();
        await api.registerCurrentDevice(deviceKey);
        const actual = await bringUp(get().server);
        const session = await vpnEngine.session().catch(() => null);
        set({ status: 'connected', connectedAt: session?.connectedAt || Date.now(), ...(actual ? { server: actual } : {}) });
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
  reconnect: async (previous) => {
    if (get().status !== 'connected') return;
    set({ status: 'connecting', error: null, needsCode: false });
    try {
      const actual = await bringUp(get().server);
      const session = await vpnEngine.session().catch(() => null);
      set({ status: 'connected', connectedAt: session?.connectedAt || get().connectedAt || Date.now(), ...(actual ? { server: actual } : {}) });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сменить сервер';
      const needsCode = error instanceof ApiError && error.status === 403;
      // If the old tunnel is still up, stay on it and put the old server back in the UI.
      const still = await vpnEngine.status().catch(() => 'disconnected' as VPNStatus);
      if (still === 'connected') set({ status: 'connected', server: previous ?? get().server, error: message, needsCode });
      else set({ status: needsCode ? 'disconnected' : 'error', connectedAt: null, error: message, needsCode });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      void useAccountStore.getState().refresh();
    }
  },
  init: () => {
    void vpnEngine.session().then((session) => {
      if (!session || session.status !== 'connected' || get().status !== 'disconnected') return;
      const known = get().server;
      set({
        status: 'connected',
        connectedAt: session.connectedAt || Date.now(),
        // Until the server list loads, show what the notification shows.
        server: known?.id === session.serverId ? known : { ...(known ?? fallbackServers[0]!), id: session.serverId, country: session.label || known?.country || '', city: '', remote: Boolean(session.serverId) },
      });
    }).catch(() => undefined);
    // «Отключить» in the notification, or the system taking the VPN away.
    return vpnEngine.subscribe((next) => {
      const current = get().status;
      if (current === 'connecting' || current === 'disconnecting') return; // our own switch in progress
      if (next === 'disconnected' && current === 'connected') {
        set({ status: 'disconnected', connectedAt: null });
        void api.disconnect().catch(() => undefined);
      }
    });
  },
}));
