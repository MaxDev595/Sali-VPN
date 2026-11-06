export interface BotConfig {
  token: string;
  mode: 'polling' | 'webhook';
  /** Public site: guides and the help centre live at <siteUrl>/help/... */
  siteUrl: string;
  supportUrl: string;
  webhookUrl?: string;
  webhookSecret?: string;
  port: number;
}

export function loadConfig(): BotConfig {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const mode = process.env.TELEGRAM_MODE === 'webhook' ? 'webhook' : 'polling';
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
  const siteUrl = (process.env.SITE_URL || 'https://salivpn.com').replace(/\/$/, '');
  new URL(siteUrl);

  const config: BotConfig = {
    token,
    mode,
    siteUrl,
    supportUrl: process.env.SUPPORT_URL || 'https://t.me/SaliVPNHelpBot',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    port: Number(process.env.PORT ?? 8080),
  };
  if (mode === 'webhook' && (!config.webhookUrl || !config.webhookSecret)) {
    throw new Error('TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET are required in webhook mode');
  }
  return config;
}
