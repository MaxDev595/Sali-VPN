export interface BotConfig {
  token: string;
  mode: 'polling' | 'webhook';
  miniAppUrl: string;
  subscriptionUrl: string;
  accountUrl: string;
  supportUrl?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  port: number;
}

function webAppUrl(base: string, path: string) {
  const url = new URL(base);
  url.pathname = path;
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function loadConfig(): BotConfig {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const miniAppUrl = process.env.TELEGRAM_MINIAPP_URL;
  const mode = process.env.TELEGRAM_MODE === 'webhook' ? 'webhook' : 'polling';
  if (!token || !miniAppUrl) throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_MINIAPP_URL are required');
  new URL(miniAppUrl);

  const config: BotConfig = {
    token,
    mode,
    miniAppUrl: miniAppUrl.replace(/\/$/, ''),
    subscriptionUrl: webAppUrl(miniAppUrl, '/subscription'),
    accountUrl: webAppUrl(miniAppUrl, '/settings'),
    supportUrl: process.env.SUPPORT_URL || undefined,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    port: Number(process.env.PORT ?? 8080),
  };
  if (mode === 'webhook' && (!config.webhookUrl || !config.webhookSecret)) {
    throw new Error('TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET are required in webhook mode');
  }
  return config;
}
