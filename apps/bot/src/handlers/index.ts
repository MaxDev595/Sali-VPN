import { Context } from 'telegraf';
import { BotConfig } from '../config';
import { api, BotUserState } from '../services/api-client';
import { accessText, date, genericError, onboarding } from '../messages';
import { expiredAccessKeyboard, faqKeyboard, mainReplyKeyboard, openAppKeyboard } from '../keyboards';

const FAQ: Record<string, string> = {
  faq_connect: '<b>Как подключить VPN?</b>\n\nОткройте Sali VPN, нажмите кнопку подключения и следуйте короткой инструкции для вашего устройства.',
  faq_not_connecting: '<b>VPN не подключается</b>\n\nПроверьте интернет, отключите другой VPN и попробуйте подключиться снова. Если не помогло — напишите в поддержку.',
  faq_server: '<b>Как сменить сервер?</b>\n\nОткройте Sali VPN и выберите доступный сервер в приложении.',
  faq_buy: '<b>Как купить подписку?</b>\n\nОткройте раздел «Подписка» в Sali VPN и выберите тариф.',
  faq_payment: '<b>Проблемы с оплатой</b>\n\nНе повторяйте платёж много раз. Проверьте его статус в Sali VPN, затем обратитесь в поддержку.',
};

function profile(ctx: Context) {
  if (!ctx.from) return null;
  return {
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    languageCode: ctx.from.language_code,
  };
}

async function stateFor(ctx: Context): Promise<BotUserState | null> {
  return ctx.from ? api.getState(ctx.from.id) : null;
}

function isExpired(state: BotUserState) {
  return state.state === 'TRIAL_EXPIRED' || state.state === 'SUBSCRIPTION_EXPIRED';
}

export function createHandlers(config: BotConfig) {
  return {
    menu: async (ctx: Context) => {
      await ctx.reply('Главное меню', mainReplyKeyboard);
    },

    start: async (ctx: Context) => {
      const telegramProfile = profile(ctx);
      if (!telegramProfile) return;
      try {
        const startParam = (ctx as Context & { startPayload?: string }).startPayload;
        await api.syncUser({ ...telegramProfile, startParam });
        const state = await api.getState(telegramProfile.telegramId);
        if (!state.registered && state.state === 'NEW') {
          await ctx.replyWithHTML(onboarding, openAppKeyboard(config.miniAppUrl, '⚡ Попробовать бесплатно'));
          await ctx.reply('Главное меню', mainReplyKeyboard);
          return;
        }
        await ctx.replyWithHTML(
          accessText(state),
          isExpired(state)
            ? expiredAccessKeyboard(config.miniAppUrl, config.subscriptionUrl)
            : openAppKeyboard(config.miniAppUrl),
        );
        await ctx.reply('Главное меню', mainReplyKeyboard);
      } catch (error) {
        console.error('Failed to handle /start', error);
        await ctx.reply(genericError);
      }
    },

    vpn: async (ctx: Context) => {
      try {
        const state = await stateFor(ctx);
        if (!state) return;
        await ctx.replyWithHTML(
          accessText(state),
          isExpired(state)
            ? expiredAccessKeyboard(config.miniAppUrl, config.subscriptionUrl)
            : openAppKeyboard(config.miniAppUrl, '⚡ Открыть VPN'),
        );
      } catch (error) {
        console.error('Failed to show VPN state', error);
        await ctx.reply(genericError);
      }
    },

    subscription: async (ctx: Context) => {
      try {
        const state = await stateFor(ctx);
        if (!state) return;
        const text = state.subscription
          ? [
              '<b>Подписка</b>',
              '',
              `Тариф: ${state.subscription.plan.name}`,
              `Статус: ${state.subscription.status === 'ACTIVE' ? 'активна' : 'неактивна'}`,
              `Действует до: ${date(state.subscription.expiresAt)}`,
            ].join('\n')
          : state.trial?.status === 'ACTIVE'
            ? `<b>Подписка</b>\n\nСейчас действует бесплатный период.\nОсталось: ${Math.ceil(state.trial.secondsRemaining / 60)} мин.`
            : '<b>Подписка</b>\n\nАктивной подписки нет.';
        await ctx.replyWithHTML(text, openAppKeyboard(config.subscriptionUrl, state.subscription?.status === 'EXPIRED' ? '💎 Продлить подписку' : '💎 Купить подписку'));
      } catch (error) {
        console.error('Failed to show subscription', error);
        await ctx.reply(genericError);
      }
    },

    account: async (ctx: Context) => {
      try {
        const state = await stateFor(ctx);
        if (!state) return;
        const telegram = state.user.username ? `@${state.user.username}` : state.user.firstName || 'Telegram';
        const tariff = state.subscription?.plan.name ?? (state.trial?.status === 'ACTIVE' ? 'Бесплатный' : 'Нет активного тарифа');
        await ctx.reply(
          ['Аккаунт', '', `Telegram: ${telegram}`, `Sali ID: ${state.user.publicId}`, `Статус: ${state.state === 'BLOCKED' ? 'ограничен' : 'активен'}`, `Тариф: ${tariff}`, ...(state.subscription ? [`Действует до: ${date(state.subscription.expiresAt)}`] : [])].join('\n'),
          openAppKeyboard(config.accountUrl, 'Открыть аккаунт'),
        );
      } catch (error) {
        console.error('Failed to show account', error);
        await ctx.reply(genericError);
      }
    },

    help: async (ctx: Context) => {
      await ctx.replyWithHTML('<b>Помощь</b>\n\nВыберите вопрос:', faqKeyboard(config.supportUrl));
    },

    faq: async (ctx: Context) => {
      if (!('callback_query' in ctx.update)) return;
      const data = 'data' in ctx.update.callback_query ? ctx.update.callback_query.data : undefined;
      if (!data || !FAQ[data]) return;
      await ctx.answerCbQuery().catch(() => undefined);
      await ctx.replyWithHTML(FAQ[data], config.supportUrl ? faqKeyboard(config.supportUrl) : undefined);
    },
  };
}
