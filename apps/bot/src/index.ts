import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { Context, Telegraf } from 'telegraf';
import { loadConfig } from './config';
import { createHandlers } from './handlers';
import * as admin from './handlers/admin';
import * as adminPanel from './handlers/admin-panel';
import { createBillingHandlers } from './handlers/billing';
import { genericError } from './messages';
import { menuLabels } from './keyboards';

// npm workspaces starts this process with apps/bot as the working directory.
// Resolve from __dirname so both src/ (development) and dist/ (production)
// reliably load the monorepo-level .env file.
loadEnv({ path: resolve(__dirname, '../../../.env') });

/**
 * Bot structure (payments live only here):
 *
 *   /start [link_<SaliID> | buy | free | ref_<id>]
 *     ├─ 💎 Купить подписку → месяц / год → Stars | USDT | карта → код SALI-XXXX-XXXX-XXXX
 *     ├─ 🎁 24 часа бесплатно → FREE-код (один на Telegram)
 *     ├─ 🔑 Мои коды       → все купленные коды и где активированы
 *     ├─ 📱 Мои устройства → привязанные приложения и их тариф
 *     ├─ 📲 Скачать приложение
 *     ├─ 👥 Пригласить друга
 *     ├─ 📖 Документация  → короткие статьи + ссылки на salivpn.com/help/*
 *     ├─ 💬 Поддержка (FAQ → бот поддержки)
 *     └─ ⚙️ Аккаунт
 *
 *   Text "SL-XXXX-XXXX" → привязать устройство; text with a code → «Активировать».
 */
async function main() {
  const config = loadConfig();
  const bot = new Telegraf(config.token);
  const handlers = createHandlers(config);
  const billing = createBillingHandlers(config);

  const action = (handler: (ctx: Context) => Promise<unknown>) => async (ctx: Context) => {
    await ctx.answerCbQuery().catch(() => undefined);
    await handler(ctx);
  };

  bot.start(async (ctx) => {
    const payload = (ctx as Context & { startPayload?: string }).startPayload || undefined;
    await billing.start(ctx, payload);
  });
  bot.command('menu', handlers.menu);
  bot.command('buy', billing.buy);
  bot.command('free', billing.free);
  bot.command('codes', billing.codes);
  bot.command('devices', billing.devices);
  bot.command('vpn', handlers.vpn);
  bot.command('subscription', handlers.subscription);
  bot.command('account', handlers.account);
  bot.command('help', handlers.help);
  bot.command('docs', handlers.docs);
  bot.command('invite', handlers.invite);
  bot.command('myid', admin.myId);
  bot.command('addserver', admin.addServer);
  bot.command('nodes', admin.nodes);
  bot.command('node_off', admin.nodeOff);
  bot.command('node_on', admin.nodeOn);
  bot.command('node_free', admin.nodeFree);
  bot.command('node_paid', admin.nodePaid);
  bot.command('admin', adminPanel.menu);
  bot.action(/^adm:/, adminPanel.callback);
  // Admin panel steps (waiting for a name, a number of days, a message) come before the normal text handler.
  bot.on('text', adminPanel.text);

  bot.hears(menuLabels.buy, billing.buy);
  bot.hears([menuLabels.free, '🎁 Бесплатный день', '🎁 Бесплатный тариф'], billing.free);
  bot.hears([menuLabels.codes, '🔑 Мои коды'], billing.devices);
  bot.hears(menuLabels.devices, billing.devices);
  bot.hears(menuLabels.download, billing.download);
  bot.hears(menuLabels.invite, handlers.invite);
  bot.hears(menuLabels.support, handlers.help);
  bot.hears(menuLabels.docs, handlers.docs);
  bot.hears(menuLabels.settings, handlers.account);
  // Old persistent keyboards
  bot.hears(menuLabels.legacyVpn, handlers.vpn);
  bot.hears(menuLabels.legacySubscription, handlers.subscription);
  bot.hears(menuLabels.legacyTariffs, billing.buy);
  bot.hears(menuLabels.legacyServers, handlers.servers);
  bot.hears(menuLabels.legacyInvite, handlers.invite);
  bot.hears(menuLabels.legacySupport, handlers.help);
  bot.hears(menuLabels.legacySettings, handlers.account);

  bot.action('menu_buy', action(billing.buy));
  bot.action('menu_free', action(billing.free));
  bot.action('menu_codes', action(billing.devices));
  bot.action('menu_devices', action(billing.devices));
  bot.action('menu_download', action(billing.download));
  bot.action('menu_vpn', action(handlers.vpn));
  bot.action('menu_subscription', action(handlers.subscription));
  bot.action('menu_tariffs', action(billing.buy));
  bot.action('menu_servers', action(handlers.servers));
  bot.action('menu_invite', action(handlers.invite));
  bot.action('menu_support', action(handlers.help));
  bot.action('menu_settings', action(handlers.account));
  bot.action('menu_docs', action(handlers.docs));
  bot.action(/^doc_/, handlers.doc);
  bot.action(/^buy_/, billing.choosePlan);
  bot.action(/^pay_/, billing.payCallback);
  bot.action(/^chk_/, billing.checkPayment);
  bot.action(/^(apply|at)_/, billing.apply);
  bot.action(/^unly?_/, billing.unlink);
  bot.action(/^lnk_/, billing.linkDevice);
  bot.action(/^faq_/, handlers.faq);
  bot.action(/^language_(ru|en)$/, action((ctx) => billing.start(ctx)));

  bot.on('pre_checkout_query', billing.preCheckout);
  bot.on('successful_payment', billing.successfulPayment);
  bot.on('text', billing.text);

  bot.catch(async (error, ctx) => {
    console.error(`Unhandled bot error update=${ctx.update.update_id}`, error);
    await ctx.reply(genericError).catch(() => undefined);
  });

  // Profile texts: the intro in an empty chat (description) and «О боте» (short description).
  const site = (process.env.SITE_URL || 'https://salivpn.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const news = `@${(process.env.NEWS_CHANNEL_URL || 'https://t.me/SaliVpnNews').replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '')}`;
  const help = `@${(process.env.SUPPORT_BOT_USERNAME || 'SaliVPNHelpBot').replace(/^@/, '')}`;
  for (const [lang, description, short] of [
    [undefined, `SALI VPN — быстрый и надёжный VPN для свободного доступа к интернету.\n\n📢 Новости и обновления: ${news}\n💬 Поддержка: ${help}\n🌐 Сайт: ${site}`,
      `Быстрый и надёжный VPN. Новости: ${news} · Поддержка: ${help} · ${site}`],
    ['en', `SALI VPN — a fast and reliable VPN for free access to the internet.\n\n📢 News and updates: ${news}\n💬 Support: ${help}\n🌐 Website: ${site}`,
      `Fast and reliable VPN. News: ${news} · Support: ${help} · ${site}`],
  ] as const) {
    await bot.telegram.setMyDescription(description, lang).catch((error) => console.warn('Failed to set bot description', error));
    await bot.telegram.setMyShortDescription(short, lang).catch((error) => console.warn('Failed to set bot short description', error));
  }

  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Открыть Sali VPN' },
    { command: 'buy', description: 'Купить подписку' },
    { command: 'free', description: '24 часа бесплатно' },
    { command: 'codes', description: 'Мои коды' },
    { command: 'devices', description: 'Мои устройства' },
    { command: 'invite', description: 'Пригласить друга' },
    { command: 'docs', description: 'Документация' },
    { command: 'account', description: 'Аккаунт' },
    { command: 'help', description: 'Помощь и поддержка' },
  ]).catch((error) => {
    console.warn('Failed to register bot commands; continuing with polling', error);
  });
  // Admins also see /admin in their command menu.
  for (const id of (process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    await bot.telegram.setMyCommands([
      { command: 'admin', description: '🛠 Админ-панель' },
      { command: 'start', description: 'Открыть Sali VPN' },
      { command: 'buy', description: 'Купить подписку' },
      { command: 'devices', description: 'Мои устройства' },
      { command: 'nodes', description: 'VPN-серверы' },
      { command: 'help', description: 'Помощь и поддержка' },
    ], { scope: { type: 'chat', chat_id: Number(id) } }).catch(() => undefined);
  }

  if (config.mode === 'webhook') {
    await bot.launch({
      webhook: {
        domain: config.webhookUrl!,
        port: config.port,
        secretToken: config.webhookSecret!,
      },
    });
  } else {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch((error) => {
      console.warn('Failed to delete webhook; continuing with polling', error);
    });
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
