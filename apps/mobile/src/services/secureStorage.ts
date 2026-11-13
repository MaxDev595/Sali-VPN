import * as SecureStore from 'expo-secure-store';

// v2: store-app accounts (Sali ID). Tokens from the old dev-only local login are ignored.
const TOKEN_KEY = 'sali.auth.token.v2';
export const secureStorage = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clearToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  /** The last working VPN config (has the private key) — lets the app reconnect when the API is unreachable. */
  getLastTunnel: async () => {
    const raw = await SecureStore.getItemAsync('sali.tunnel.last').catch(() => null);
    try { return raw ? JSON.parse(raw) as { configText: string; label: string; serverId: string; savedAt: number } : null; } catch { return null; }
  },
  setLastTunnel: (tunnel: { configText: string; label: string; serverId: string; savedAt: number }) => SecureStore.setItemAsync('sali.tunnel.last', JSON.stringify(tunnel)).catch(() => undefined),
  clearLastTunnel: () => SecureStore.deleteItemAsync('sali.tunnel.last').catch(() => undefined),
};
