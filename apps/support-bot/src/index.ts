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

function isConfiguredAdmin(ctx: Context) {
  return Boolean(ctx.from && state.adminChatId === ctx.from.id);
}

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
  return ['Новое обращение в поддержку', `Имя: ${name || 'не указано'}`, `Username: ${username}`, `Telegram ID: ${ctx.from.id}`, '', 'Ответьте на сообщение ниже, чтобы ответ ушёл пользователю.'].join('\n');
}

async function showWelcome(ctx: Context) {
  if (isConfiguredAdmin(ctx)) {
    await ctx.reply(`Админ-панель Sali Support активна для @${adminUsername}. Новые обращения будут приходить сюда.`);
    return;
  }
  await ctx.replyWithHTML(welcomeText, welcomeKeyboard);
}

bot.start(async (ctx) => {
  if (hasAdminUsername(ctx)) {
    if (state.adminChatId && state.adminChatId !== ctx.from.id) {
      await ctx.reply('Администратор уже зарегистрирован.');
      return;
    }
    state.adminChatId = ctx.from.id;
    saveState();
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
    const repliedTo = 'reply_to_message' in ctx.message ? ctx.message.reply_to_message?.message_id : undefined;
    const userChatId = repliedTo ? state.replies[String(repliedTo)] : undefined;
    if (!userChatId) {
      await ctx.reply('Чтобы ответить клиенту, нажмите «Ответить» именно на его пересланном сообщении.');
      return;
    }
    try {
      await ctx.telegram.copyMessage(userChatId, ctx.chat.id, ctx.message.message_id);
      await ctx.reply('Ответ отправлен пользователю.');
    } catch (error) {
      console.error('Failed to send admin reply', error);
      await ctx.reply('Не удалось отправить ответ пользователю.');
    }
    return;
  }

  if (!state.adminChatId) {
    await ctx.reply(`Поддержка ещё не активирована администратором. Напишите нам на почту: ${supportEmail}`);
    return;
  }

  try {
    await ctx.telegram.sendMessage(state.adminChatId, senderDetails(ctx));
    const copied = await ctx.telegram.copyMessage(state.adminChatId, ctx.chat.id, ctx.message.message_id);
    state.replies[String(copied.message_id)] = ctx.chat.id;
    const keys = Object.keys(state.replies);
    for (const key of keys.slice(0, Math.max(0, keys.length - 2000))) delete state.replies[key];
    saveState();
    await ctx.reply('Спасибо! Сообщение передано в поддержку. Мы ответим вам как можно скорее.');
  } catch (error) {
    console.error('Failed to forward support message', error);
    await ctx.reply(`Не удалось передать сообщение. Попробуйте ещё раз или напишите на почту: ${supportEmail}`);
  }
});

bot.catch((error, ctx) => console.error(`Unhandled support bot error update=${ctx.update.update_id}`, error));

async function main() {
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Открыть поддержку' },
    { command: 'help', description: 'Как связаться с поддержкой' },
    { command: 'admin', description: 'Админ-панель' },
  ]);
  await bot.telegram.deleteWebhook({ drop_pending_updates: false });
  await bot.launch({ dropPendingUpdates: false });
  console.log(`Sali support bot started; admin=@${adminUsername}`);
}

main().catch((error) => {
  console.error('Failed to start Sali support bot', error);
  process.exitCode = 1;
});

const shutdown = (signal: 'SIGINT' | 'SIGTERM') => bot.stop(signal);
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
