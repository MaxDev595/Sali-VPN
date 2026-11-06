const env = import.meta.env as Record<string, string | undefined>;
const RELEASES = 'https://github.com/MaxDev595/Sali-VPN/releases/download';

/** Where every Sali VPN build lives. Updated automatically by GitHub Actions on each release. */
export const DOWNLOADS = {
  page: 'https://salivpn.com/download',
  apk: env.VITE_APK_URL ?? `${RELEASES}/apk-latest/sali-vpn.apk`,
  windows: env.VITE_WINDOWS_URL ?? `${RELEASES}/desktop-latest/SaliVPN-Setup.exe`,
  windowsPortable: env.VITE_WINDOWS_PORTABLE_URL ?? `${RELEASES}/desktop-latest/SaliVPN-Portable.exe`,
  bot: (env.VITE_TELEGRAM_BOT_URL ?? 'https://t.me/SaliVPNOfficialBot').replace(/\/$/, ''),
  support: env.VITE_SUPPORT_URL ?? 'https://t.me/SaliVPNHelpBot',
};
