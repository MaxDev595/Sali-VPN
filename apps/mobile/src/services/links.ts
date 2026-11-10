import { Linking } from 'react-native';

/** salivpn.com: the help centre lives at /help/<slug> (apps/web/src/help/articles.ts). */
const SITE = String(process.env.EXPO_PUBLIC_SITE_URL ?? 'https://salivpn.com').replace(/\/$/, '');
const SUPPORT_BOT = (process.env.EXPO_PUBLIC_SUPPORT_BOT ?? 'SaliVPNHelpBot').replace(/^@/, '');

export type HelpTopic = 'start' | 'protocol' | 'dns' | 'devices' | 'servers' | 'kill-switch' | 'auto-connect' | 'privacy' | 'payments' | 'referrals' | 'troubleshooting';

export const siteUrl = (path = '') => `${SITE}${path}`;
export const helpUrl = (topic?: HelpTopic) => siteUrl(topic ? `/help/${topic}` : '/help');
export const supportBotUrl = () => `https://t.me/${SUPPORT_BOT}`;

export const openHelp = (topic?: HelpTopic) => void Linking.openURL(helpUrl(topic));
export const openSite = (path: string) => void Linking.openURL(siteUrl(path));
export const openSupport = () => void Linking.openURL(supportBotUrl());

/** The signed APK (GitHub release). Opening it in the browser downloads the update. */
const APK = process.env.EXPO_PUBLIC_APK_URL ?? 'https://github.com/MaxDev595/Sali-VPN/releases/download/apk-latest/sali-vpn.apk';
const NEWS_CHANNEL = process.env.EXPO_PUBLIC_NEWS_CHANNEL ?? 'https://t.me/SaliVpnNews';
export const openApkDownload = () => void Linking.openURL(APK);
export const openNewsChannel = () => void Linking.openURL(NEWS_CHANNEL);
