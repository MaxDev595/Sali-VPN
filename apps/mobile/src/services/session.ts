import { api } from './api/client';
import { secureStorage } from './secureStorage';
import { vpnEngine } from './vpn/VpnEngine';

let pending: Promise<string> | null = null;

/**
 * Silent sign-in on first launch: the installation key becomes a store-app
 * account with its own Sali ID. No forms, no Telegram required to start.
 */
export function ensureSession() {
  pending ??= (async () => {
    const existing = await secureStorage.getToken();
    if (existing) return existing;
    const deviceKey = await vpnEngine.deviceKey();
    const auth = await api.appLogin(deviceKey);
    await secureStorage.setToken(auth.token);
    return auth.token;
  })().finally(() => { pending = null; });
  return pending;
}

const BOT = (process.env.EXPO_PUBLIC_BOT_USERNAME ?? 'SaliVPNOfficialBot').replace(/^@/, '');
/** Opens the bot and claims this installation: t.me/<bot>?start=link_<SaliID>. */
export const telegramLinkUrl = (publicId: string) => `https://t.me/${BOT}?start=link_${publicId.replace(/[^0-9A-Z]/gi, '').replace(/^SL/i, '')}`;
export const telegramBotUrl = () => `https://t.me/${BOT}`;
