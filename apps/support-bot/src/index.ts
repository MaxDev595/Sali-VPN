import { config as loadEnv } from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { Context, Markup, Telegraf } from 'telegraf';

loadEnv({ path: resolve(__dirname, '../../../.env') });

const token = process.env.SUPPORT_BOT_TOKEN;
const supportEmail = process.env.SUPPORT_EMAIL;
const adminUsername = (process.env.SUPPORT_ADMIN_USERNAME || 'Chernicka1488').replace(/^@/, '');
const stateFile = process.env.SUPPORT_BOT_STATE_FILE || resolve(process.cwd(), 'data/state.json');

if (!token || !supportEmail) {
  throw new Error('SUPPORT_BOT_TOKEN and SUPPORT_EMAIL are required');
}

interface SupportState {
  adminChatId?: number;
  replies: Record<string, number>;
}

function loadState(): SupportState {
  try {
    return existsSync(stateFile)
      ? JSON.parse(readFileSync(stateFile, 'utf8')) as SupportState
      : { replies: {} };
  } catch (error) {
    console.error('Failed to read support bot state', error);
    return { replies: {} };
  }
}

const state = loadState();

function saveState() {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state), 'utf8');
}

/**
 * Who answers support. Render wipes local files on every deploy, so the admin must not live
 * only in state.json: SUPPORT_ADMIN_CHAT_ID / ADMIN_TELEGRAM_IDS (Render env) always work;
 * the admin who pressed /start is remembered on top of that.
 */
const envAdmins = [process.env.SUPPORT_ADMIN_CHAT_ID, process.env.ADMIN_TELEGRAM_IDS]
  .flatMap((v) => (v ?? '').split(','))
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isSafeInteger(v) && v > 0);
const adminIds = () => [...new Set([...envAdmins, ...(state.adminChatId ? [state.adminChatId] : [])])];
/** Where new requests go: the support admin first, otherwise the first admin. */
const supportChat = () => Number(process.env.SUPPORT_ADMIN_CHAT_ID?.split(',')[0]) || state.adminChatId || envAdmins[0] || null;

function isConfiguredAdmin(ctx: Context) {
  return Boolean(ctx.from && adminIds().includes(ctx.from.id));
}

/** The client's chat id is written into every message the admin gets — replies never depend on saved state. */
const MARK = /#id(\d{4,16})\b/;
const mark = (chatId: number) => `#id${chatId}`;

function hasAdminUsername(ctx: Context) {
  return ctx.from?.username?.toLowerCase() === adminUsername.toLowerCase();
}

const bot = new Telegraf(token);
const welcomeKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Написать сюда', 'write_here')],
  [Markup.button.callback('Почта поддержки', 'support_email')],
]);

const welcomeText = [
  '<b>Здравствуйте! Это поддержка Sali VPN.</b>',
  '',
  'Чем можем помочь?',
  'Напишите сообщение прямо сюда или воспользуйтесь почтой поддержки.',
].join('\n');

function senderDetails(ctx: Context) {
  if (!ctx.from) return 'Пользователь не определён';
  const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
  const username = ctx.from.username ? `@${ctx.from.username}` : 'не указан';
  return [`📩 Обращение от ${name || 'клиента'} (${username}) · ${mark(ctx.from.id)}`, 'Нажмите «Ответить» на это сообщение — ответ уйдёт клиенту.'].join('\n');
}

async function showWelcome(ctx: Context) {
  if (isConfiguredAdmin(ctx)) {
    await ctx.reply(`Админ-панель Sali Support активна для @${adminUsername}. Новые обращения будут приходить сюда.`);
    return;
  }
  await ctx.replyWithHTML(welcomeText, welcomeKeyboard);
}

bot.start(async (ctx) => {
  if (hasAdminUsername(ctx) && !isConfiguredAdmin(ctx)) {
    state.adminChatId = ctx.from.id;
    try { saveState(); } catch (error) { console.warn('Support state not saved', error); }
  }
  await showWelcome(ctx);
});

bot.command('help', showWelcome);
bot.command('admin', async (ctx) => {
  if (!isConfiguredAdmin(ctx)) return;
  await ctx.reply(['Админ-панель Sali Support', '', 'Все обращения автоматически приходят в этот чат.', 'Чтобы ответить пользователю, используйте функцию «Ответить» на его сообщение.'].join('\n'));
});

bot.action('write_here', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Напишите ваш вопрос следующим сообщением. Мы передадим его администратору.');
});

bot.action('support_email', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(`Почта поддержки: ${supportEmail}`);
});

bot.on('message', async (ctx, next) => {
  if ('text' in ctx.message && ctx.message.text.startsWith('/')) return next();

  if (isConfiguredAdmin(ctx)) {
    const replied = 'reply_to_message' in ctx.message ? ctx.message.reply_to_message : undefined;
    if (!replied) {
      await ctx.reply('Чтобы ответить клиенту, нажмите «Ответить» на его обращении (там есть метка #id…).');
      return;
    }
    const repliedText = ('text' in replied && replied.text) || ('caption' in replied && replied.caption) || '';
    const fromMark = repliedText.match(MARK)?.[1];
    const userChatId = fromMark ? Number(fromMark) : state.replies[String(replied.message_id)];
    if (!userChatId) {
      await ctx.reply('Не нашёл, кому ответить: нажмите «Ответить» на сообщении с меткой #id… клиента.');
      return;
    }
    try {
      await ctx.telegram.copyMessage(userChatId, ctx.chat.id, ctx.message.message_id);
      await ctx.reply('✅ Ответ отправлен клиенту.');
    } catch (error) {
      console.error('Failed to send admin reply', error);
      await ctx.reply('Не удалось отправить ответ: клиент мог заблокировать бота.');
    }
    return;
  }

  const target = supportChat();
  if (!target) {
    console.error('Support has no admin: set SUPPORT_ADMIN_CHAT_ID or ADMIN_TELEGRAM_IDS in Render');
    await ctx.reply(`Не удалось передать сообщение. Напишите нам на почту: ${supportEmail}`);
    return;
  }

  try {
    const header = senderDetails(ctx);
    const msg = ctx.message;
    if ('text' in msg) {
      // One message: who wrote + what — replying to it is all the admin needs.
      await ctx.telegram.sendMessage(target, `${header}\n\n${msg.text}`);
    } else {
      const head = await ctx.telegram.sendMessage(target, header);
      const withCaption = 'photo' in msg || 'video' in msg || 'document' in msg || 'audio' in msg || 'voice' in msg || 'animation' in msg;
      const caption = withCaption ? `${'caption' in msg && msg.caption ? `${msg.caption}\n\n` : ''}${mark(ctx.chat.id)}` : undefined;
      const copied = await ctx.telegram.copyMessage(target, ctx.chat.id, msg.message_id, { ...(caption ? { caption } : {}), reply_parameters: { message_id: head.message_id } } as never);
      state.replies[String(copied.message_id)] = ctx.chat.id;
      const keys = Object.keys(state.replies);
      for (const key of keys.slice(0, Math.max(0, keys.length - 2000))) delete state.replies[key];
      try { saveState(); } catch { /* the #id mark is enough */ }
    }
    await ctx.reply('Спасибо! Сообщение передано в поддержку. Мы ответим вам здесь как можно скорее.');
  } catch (error) {
    console.error('Failed to forward support message', error);
    await ctx.reply(`Не удалось передать сообщение. Попробуйте ещё раз или напишите на почту: ${supportEmail}`);
  }
});

bot.catch((error, ctx) => console.error(`Unhandled support bot error update=${ctx.update.update_id}`, error));

async function main() {
  // Profile texts: the intro in an empty chat (description) and «О боте» (short description).
  const site = (process.env.SITE_URL || 'https://salivpn.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const news = `@${(process.env.NEWS_CHANNEL_URL || 'https://t.me/SaliVpnNews').replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '')}`;
  const main = `@${(process.env.MAIN_BOT_USERNAME || 'SaliVPNOfficialBot').replace(/^@/, '')}`;
  for (const [lang, description, short] of [
    [undefined, `💬 Поддержка SALI VPN — поможем с подключением, оплатой и устройствами.\n\nНапишите, что случилось, и пришлите ваш Sali ID (SL-XXXX-XXXX) из приложения — так ответим быстрее.\n\n🛡 Бот SALI VPN: ${main}\n📢 Новости и обновления: ${news}\n🌐 Сайт: ${site}`,
      `Поддержка SALI VPN. Бот VPN: ${main} · Новости: ${news} · ${site}`],
    ['en', `💬 SALI VPN support — help with connecting, payments and devices.\n\nTell us what happened and send your Sali ID (SL-XXXX-XXXX) from the app — we'll answer faster.\n\n🛡 SALI VPN bot: ${main}\n📢 News and updates: ${news}\n🌐 Website: ${site}`,
      `SALI VPN support. VPN bot: ${main} · News: ${news} · ${site}`],
  ] as const) {
    await bot.telegram.setMyDescription(description, lang).catch((error) => console.warn('Failed to set support bot description', error));
    await bot.telegram.setMyShortDescription(short, lang).catch((error) => console.warn('Failed to set support bot short description', error));
  }

  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Открыть поддержку' },
    { command: 'help', description: 'Как связаться с поддержкой' },
    { command: 'admin', description: 'Админ-панель' },
  ]).catch((error) => {
    console.warn('Failed to register support bot commands; continuing with polling', error);
  });
  await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch((error) => {
    console.warn('Failed to delete support bot webhook; continuing with polling', error);
  });
  await bot.launch({ dropPendingUpdates: false });
  console.log(`Sali support bot started; admin=@${adminUsername}; admin chats=${adminIds().join(',') || 'none'}`);
}

main().catch((error) => {
  console.error('Failed to start Sali support bot', error);
  process.exitCode = 1;
});

const shutdown = (signal: 'SIGINT' | 'SIGTERM') => bot.stop(signal);
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
