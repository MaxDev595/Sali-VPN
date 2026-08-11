import 'dotenv/config';
import { Telegraf } from 'telegraf';
import {
  handleConnectCommand,
  handleFeatures,
  handleInviteFriend,
  handleMySubscription,
  handleSettings,
  handleStart,
  handleSupport,
  handleSupportCategory,
  handleSupportMessage,
  handleTariff,
} from './handlers';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required. Get one from @BotFather.');
}

const bot = new Telegraf(BOT_TOKEN);

// Minimal in-memory session keyed by chat id, only used for the short-lived
// "which support category did you pick" flow. Fine for MVP / single
// instance; swap for a Redis-backed session store before scaling to
// multiple bot instances.
const pendingSupport = new Map<number, string>();

bot.start(handleStart);

bot.action('features', handleFeatures);

bot.hears('🔐 Подключить VPN', handleConnectCommand);
bot.hears('👤 Моя подписка', handleMySubscription);
bot.hears('💳 Тариф', handleTariff);
bot.hears('🎁 Пригласить друга', handleInviteFriend);
bot.hears('🛟 Поддержка', handleSupport);
bot.hears('⚙️ Настройки', handleSettings);

const SUPPORT_CATEGORIES = [
  'vpn_not_connecting',
  'no_internet',
  'payment_issue',
  'device_setup',
  'other',
];

for (const category of SUPPORT_CATEGORIES) {
  bot.action(`support_${category}`, async (ctx) => {
    if (ctx.chat) pendingSupport.set(ctx.chat.id, category);
    await handleSupportCategory(ctx, category);
  });
}

bot.on('text', async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (chatId && pendingSupport.has(chatId)) {
    const category = pendingSupport.get(chatId)!;
    pendingSupport.delete(chatId);
    await handleSupportMessage(ctx, category, ctx.message.text);
    return;
  }
  return next();
});

// Handles Telegram's native payment confirmation (used only when
// PAYMENT_PROVIDER=telegram_stars). Forwards straight to the API, which is
// the sole source of truth for payment status.
bot.on('successful_payment', async (ctx) => {
  const payload = (ctx.message as any)?.successful_payment?.invoice_payload;
  if (!payload) return;
  const { api } = await import('./services/api-client');
  await api.confirmPayment(payload).catch(() => undefined);
  await ctx.reply('Оплата прошла успешно! Подписка активирована. 🖤');
});

bot.catch((err, ctx) => {
  // eslint-disable-next-line no-console
  console.error(`Unhandled bot error for update ${ctx.updateType}`, err);
  ctx.reply('Что-то пошло не так. Попробуйте ещё раз.').catch(() => undefined);
});

async function main() {
  const mode = process.env.TELEGRAM_MODE ?? 'polling';

  if (mode === 'webhook') {
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!webhookUrl || !secret) {
      throw new Error('TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET are required in webhook mode.');
    }
    await bot.telegram.setWebhook(webhookUrl, { secret_token: secret });
    await bot.launch({
      webhook: {
        domain: webhookUrl,
        port: Number(process.env.PORT ?? 8080),
        secretToken: secret,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Sali VPN bot running in webhook mode: ${webhookUrl}`);
  } else {
    await bot.launch();
    // eslint-disable-next-line no-console
    console.log('Sali VPN bot running in polling mode');
  }
}

main();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
