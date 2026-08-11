import { Context } from 'telegraf';
import { api } from '../services/api-client';
import {
  buySubscriptionInlineKeyboard,
  mainReplyKeyboard,
  openAppInlineKeyboard,
  supportCategoriesKeyboard,
  welcomeInlineKeyboard,
} from '../keyboards';

const MINIAPP_URL = process.env.TELEGRAM_MINIAPP_URL ?? 'https://your-miniapp-domain.example';
const PRICE = process.env.SUBSCRIPTION_PRICE_USD ?? '5';
const ORIGINAL_PRICE = process.env.SUBSCRIPTION_ORIGINAL_PRICE_USD ?? '8';

export async function handleStart(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const startPayload = (ctx as any).startPayload as string | undefined;

  await api.syncUser({
    telegramId: from.id,
    username: from.username,
    firstName: from.first_name,
    lastName: from.last_name,
    languageCode: from.language_code,
    startParam: startPayload,
  });

  await ctx.reply(
    [
      'Добро пожаловать в Sali VPN',
      '',
      'Быстрый, простой и приватный VPN без лишней регистрации.',
      '',
      'Подключитесь за несколько секунд и получите 1 час бесплатного доступа.',
    ].join('\n'),
    welcomeInlineKeyboard(MINIAPP_URL),
  );

  await ctx.reply('Используйте меню ниже для быстрого доступа:', mainReplyKeyboard);
}

export async function handleFeatures(ctx: Context) {
  await ctx.answerCbQuery();
  await ctx.reply(
    [
      '⚡ Возможности Sali VPN',
      '',
      '• Быстрое подключение — без логина и пароля',
      '• Приватность — трафик защищён WireGuard-протоколом',
      '• Стабильное соединение на нескольких локациях',
      '• Простая работа с нескольких устройств',
    ].join('\n'),
    openAppInlineKeyboard(MINIAPP_URL, '🔐 Подключить VPN'),
  );
}

export async function handleConnectCommand(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  try {
    const result = await api.connectVpn(from.id);
    const isTrial = result.trial.status === 'ACTIVE';

    await ctx.reply(
      [
        'Добро пожаловать в Sali VPN 🖤',
        '',
        'Ваш аккаунт успешно создан.',
        '',
        isTrial ? '🎁 Бесплатный доступ: 1 час.' : '',
        '',
        'После окончания пробного периода VPN будет отключён.',
      ]
        .filter(Boolean)
        .join('\n'),
      buySubscriptionInlineKeyboard(MINIAPP_URL),
    );
    await ctx.replyWithHTML(
      `<b>~$${ORIGINAL_PRICE}~ $${PRICE}/мес</b> (-38%)`,
      openAppInlineKeyboard(MINIAPP_URL, '📱 Открыть Sali VPN'),
    );
  } catch (err) {
    await ctx.reply('Что-то пошло не так. Попробуйте ещё раз.');
  }
}

export async function handleMySubscription(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  try {
    const state = await api.getState(from.id);
    if (state.subscription) {
      const expires = new Date(state.subscription.expiresAt).toLocaleDateString('ru-RU');
      await ctx.reply(
        [
          '👤 Моя подписка',
          '',
          `Тариф: ${state.subscription.plan.name}`,
          `Действует до: ${expires}`,
        ].join('\n'),
      );
    } else {
      await ctx.reply('Подписка не активна', buySubscriptionInlineKeyboard(MINIAPP_URL));
    }
  } catch {
    await ctx.reply('Что-то пошло не так. Попробуйте ещё раз.');
  }
}

export async function handleTariff(ctx: Context) {
  await ctx.replyWithHTML(
    [
      '<b>Sali Pro</b>',
      '',
      `$${PRICE} / month`,
      `<s>$${ORIGINAL_PRICE}</s>  -38%`,
      '',
      '• Fast VPN',
      '• Secure connection',
      '• Multiple locations',
      '• No manual registration',
      '• Device support',
      '• Stable connection',
    ].join('\n'),
    buySubscriptionInlineKeyboard(MINIAPP_URL),
  );
}

export async function handleInviteFriend(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  try {
    const state = await api.getState(from.id);
    const link = state.referralStats.link;
    await ctx.reply(
      ['Пригласи друга', '', 'Поделись Sali VPN и получай бонусы.', '', link].join('\n'),
    );
  } catch {
    await ctx.reply('Что-то пошло не так. Попробуйте ещё раз.');
  }
}

export async function handleSettings(ctx: Context) {
  await ctx.reply(
    ['⚙️ Настройки', '', 'Language\nNotifications\nFAQ\nTerms\nPrivacy Policy'].join('\n'),
    openAppInlineKeyboard(MINIAPP_URL, '📱 Открыть в приложении'),
  );
}

export async function handleSupport(ctx: Context) {
  await ctx.reply('🛟 Поддержка\n\nВыберите тему обращения:', supportCategoriesKeyboard);
}

export async function handleSupportCategory(ctx: Context, category: string) {
  await ctx.answerCbQuery();
  (ctx as any).session ??= {};
  (ctx as any).session.pendingSupportCategory = category;
  await ctx.reply('Опишите проблему одним сообщением — мы передадим её оператору.');
}

export async function handleSupportMessage(ctx: Context, category: string, message: string) {
  const from = ctx.from;
  if (!from) return;

  try {
    await api.createSupportTicket({ telegramId: from.id, category, message });
    await ctx.reply('Спасибо! Обращение передано в поддержку. Мы ответим как можно скорее.');
  } catch {
    await ctx.reply('Что-то пошло не так. Попробуйте ещё раз.');
  }
}
