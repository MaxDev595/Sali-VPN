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
