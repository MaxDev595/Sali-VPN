import { Context, Markup } from 'telegraf';
import type { Message } from 'telegraf/types';
import { api, ApiRejection, TelegramProfile } from '../services/api-client';

/**
 * Sali VPN lives in the app now. For customers the bot does exactly one thing: link the app
 * to their Telegram account (the app opens t.me/<bot>?start=link_<code>). Everything else —
 * tariffs, paying, gifts, promo codes, devices — is in the app. Admins keep the whole bot.
 */

const SALI_ID = /^\s*(?:SL[-\s]?)?([0-9A-Za-z]{4})[-\s]?([0-9A-Za-z]{4})\s*$/i;

export const adminIds = () => (process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
export const isAdmin = (id?: number) => id !== undefined && adminIds().includes(String(id));

const site = () => (process.env.SITE_URL || 'https://salivpn.com').replace(/\/$/, '');
const downloadUrl = () => process.env.APP_DOWNLOAD_URL || site();
const supportBot = () => `@${(process.env.SUPPORT_BOT_USERNAME || 'SaliVPNHelpBot').replace(/^@/, '')}`;

const appButton = () => Markup.inlineKeyboard([[Markup.button.url('📲 Скачать приложение Sali VPN', downloadUrl())]]);
const noKeyboard = { reply_markup: { remove_keyboard: true as const } };

export function appOnlyMessage() {
  return [
    '📲 <b>Sali VPN теперь работает в приложении</b>',
    '',
    'Всё там: включить VPN, подписка, оплата, подарки, промокоды и устройства.',
    'Бесплатные 3 дня — просто скачайте приложение и нажмите «Включить».',
    '',
    `Уже есть приложение? Откройте его → «Подписка» → «Привязать Telegram».`,
    `Вопросы: ${supportBot()}`,
  ].join('\n');
}

function linkedMessage(status: string, accountId?: string | null) {
  if (status === 'linked' || status === 'already') {
    return [
      status === 'linked' ? '✅ <b>Аккаунт привязан</b>' : '✅ <b>Аккаунт уже привязан</b>',
      '',
      accountId ? `Ваш Sali ID: <b>${accountId}</b>` : '',
      'Подписки и подарки начисляются на этот аккаунт и работают на всех ваших устройствах (до 3).',
      '',
      'Вернитесь в приложение Sali VPN — всё уже обновилось 👌',
    ].filter((line, i, all) => line || all[i - 1]).join('\n');
  }
  if (status === 'linked_elsewhere') return `Это приложение уже привязано к другому Telegram-аккаунту.\nЕсли это ошибка — напишите ${supportBot()}.`;
  return 'Не нашёл приложение с таким номером. Откройте Sali VPN → «Подписка» → «Привязать Telegram» и нажмите ещё раз.';
}

function profile(ctx: Context): TelegramProfile | null {
  if (!ctx.from) return null;
  return { telegramId: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name };
}

async function link(ctx: Context, code: string) {
  const who = profile(ctx);
  if (!who) return;
  try {
    const result = await api.start(who, `link_${code}`);
    await ctx.replyWithHTML(linkedMessage(result.link?.status ?? 'not_found', result.link?.accountId ?? result.publicId), noKeyboard);
  } catch (error) {
    const text = error instanceof ApiRejection ? error.message : 'Не получилось привязать. Попробуйте ещё раз через минуту.';
    await ctx.reply(text, noKeyboard).catch(() => undefined);
  }
}

/** Middleware: customers get the app-only flow; admins (and payments in flight) pass through. */
export function clientGate() {
  return async (ctx: Context, next: () => Promise<void>) => {
    if (isAdmin(ctx.from?.id)) return next();
    // A Stars payment that was already on its way still completes normally.
    const message = ctx.message as Message | undefined;
    if (message && 'successful_payment' in message) return next();
    if (ctx.preCheckoutQuery) {
      await ctx.answerPreCheckoutQuery(false, 'Оплата теперь в приложении Sali VPN').catch(() => undefined);
      return;
    }
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('Sali VPN теперь в приложении').catch(() => undefined);
      await ctx.replyWithHTML(appOnlyMessage(), appButton()).catch(() => undefined);
      return;
    }
    const text = message && 'text' in message ? message.text : '';
    const start = text.match(/^\/start(?:@\w+)?\s+link_([0-9A-Za-z]{8})\s*$/);
    if (start) return link(ctx, start[1]!);
    // The app copies its number before opening Telegram: pasting it here links too.
    const pasted = text.match(SALI_ID);
    if (pasted) return link(ctx, `${pasted[1]}${pasted[2]}`.toUpperCase());
    if (ctx.chat?.type !== 'private') return;
    if (text.startsWith('/start')) {
      const who = profile(ctx);
      if (who) await api.start(who, text.split(/\s+/)[1]).catch(() => undefined); // keeps the funnel source
    }
    await ctx.replyWithHTML(appOnlyMessage(), appButton()).catch(() => undefined);
    if (text.startsWith('/start')) await ctx.reply('Меню бота больше не нужно 🙂', noKeyboard).catch(() => undefined);
  };
}
