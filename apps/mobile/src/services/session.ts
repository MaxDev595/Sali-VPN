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

/**
 * «Привязать Telegram» that can't get lost: copies the Sali ID first (if Telegram drops the
 * start link, the customer just pastes it into the bot), opens the bot, and keeps checking
 * the account for two minutes so the app flips to «привязан» by itself.
 */
let watching: ReturnType<typeof setInterval> | null = null;
export async function linkTelegram(publicId: string, onTick: () => Promise<{ user: { telegramLinked: boolean } } | null>) {
  const { setStringAsync } = await import('expo-clipboard');
  const { Linking, Platform, ToastAndroid } = await import('react-native');
  await setStringAsync(publicId).catch(() => undefined);
  if (Platform.OS === 'android') ToastAndroid.show(`В Telegram нажмите «Запустить» внизу. Если бот не ответил — вставьте ему номер ${publicId} (уже скопирован)`, ToastAndroid.LONG);
  await Linking.openURL(telegramLinkUrl(publicId));
  if (watching) clearInterval(watching);
  const started = Date.now();
  watching = setInterval(() => {
    if (Date.now() - started > 120_000) { clearInterval(watching!); watching = null; return; }
    void onTick().then((home) => { if (home?.user.telegramLinked && watching) { clearInterval(watching); watching = null; } }).catch(() => undefined);
  }, 3000);
}
