import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { Telegraf } from 'telegraf';
import { loadConfig } from './config';
import { createHandlers } from './handlers';
import { genericError } from './messages';
import { menuLabels } from './keyboards';
import { api } from './services/api-client';

// npm workspaces starts this process with apps/bot as the working directory.
// Resolve from __dirname so both src/ (development) and dist/ (production)
// reliably load the monorepo-level .env file.
loadEnv({ path: resolve(__dirname, '../../../.env') });

async function main() {
  const config = loadConfig();
  const bot = new Telegraf(config.token);
  const handlers = createHandlers(config);

  bot.start(handlers.start);
  bot.command('vpn', handlers.vpn);
  bot.command('subscription', handlers.subscription);
  bot.command('account', handlers.account);
  bot.command('help', handlers.help);
  bot.hears(menuLabels.vpn, handlers.vpn);
  bot.hears(menuLabels.subscription, handlers.subscription);
  bot.hears(menuLabels.account, handlers.account);
  bot.hears(menuLabels.help, handlers.help);
  bot.action(/^faq_/, handlers.faq);

  bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    try {
      await api.confirmPayment(payment.invoice_payload);
      await ctx.reply('Оплата прошла успешно. Подписка активирована.');
    } catch (error) {
      console.error('Failed to confirm Telegram payment', error);
      await ctx.reply('Оплата получена. Статус подписки обновляется.');
    }
  });

  bot.catch(async (error, ctx) => {
    console.error(`Unhandled bot error update=${ctx.update.update_id}`, error);
    await ctx.reply(genericError).catch(() => undefined);
  });

  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Открыть Sali VPN' },
    { command: 'vpn', description: 'Статус VPN' },
    { command: 'subscription', description: 'Подписка' },
    { command: 'account', description: 'Аккаунт' },
    { command: 'help', description: 'Помощь' },
  ]);

  if (config.mode === 'webhook') {
    await bot.launch({
      webhook: {
        domain: config.webhookUrl!,
        port: config.port,
        secretToken: config.webhookSecret!,
      },
    });
  } else {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    await bot.launch({ dropPendingUpdates: false });
  }

  console.log(`Sali VPN bot started in ${config.mode} mode`);
  const shutdown = (signal: 'SIGINT' | 'SIGTERM') => bot.stop(signal);
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Failed to start Sali VPN bot', error);
  process.exitCode = 1;
});
