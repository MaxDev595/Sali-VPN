import { Context } from 'telegraf';
import { BotConfig } from '../config';
import { api, BotUserState } from '../services/api-client';
import { accessText, date, duration, genericError, howItWorks, referralMessage } from '../messages';
import { docBySlug } from '../docs';
import {
  accessKeyboard,
  accountKeyboard,
  docsKeyboard,
  docTopicKeyboard,
  expiredAccessKeyboard,
  faqKeyboard,
  mainInlineKeyboard,
  mainReplyKeyboard,
  referralShareKeyboard,
  supportKeyboard,
} from '../keyboards';

const FAQ: Record<string, string> = {
  faq_how: howItWorks,
  faq_code: '<b>Нужен ли код?</b>\n\nНет. Подписка выдаётся на ваш аккаунт автоматически — после оплаты в боте, подарка или бонуса. Она сама появляется во всех ваших приложениях (до 3 устройств).\n\nВводить нужно только <b>промокод</b>, если он у вас есть: в приложении «Подписка» → «Промокод».',
  faq_link: '<b>Как войти в приложение?</b>\n\nВ приложении нажмите «Войти через Telegram», а здесь — «Запустить». Устройство подключится к вашему аккаунту. Если бот не ответил — пришлите сюда номер устройства из приложения: <code>SL-XXXX-XXXX</code>.',
  faq_not_connecting: '<b>VPN не подключается</b>\n\nПроверьте подписку в «💎 Моя подписка», отключите другие VPN и попробуйте снова. Если подписка есть, а VPN всё равно не подключается — напишите в поддержку @SaliVPNHelpBot и укажите номер устройства SL-XXXX-XXXX, разберёмся.',
  faq_payment: '<b>Проблемы с оплатой</b>\n\nНе оплачивайте повторно. После оплаты подписка сама появляется на аккаунте — проверьте «💎 Моя подписка». Для USDT нажмите «Я оплатил — проверить». Если подписки нет через 10 минут — напишите в поддержку.',
};

async function stateFor(ctx: Context): Promise<BotUserState | null> {
  return ctx.from ? api.getState(ctx.from.id) : null;
}

function isExpired(state: BotUserState) {
  return state.state === 'TRIAL_EXPIRED' || state.state === 'SUBSCRIPTION_EXPIRED';
}

function callbackData(ctx: Context) {
  return ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
}

export function createHandlers(config: BotConfig) {
  return {
    menu: async (ctx: Context) => {
      await ctx.reply('Главное меню', mainInlineKeyboard);
      await ctx.reply('Быстрые кнопки закреплены снизу', mainReplyKeyboard);
    },

    /** Old "Подключить VPN" / "Моя подписка" buttons: status + what to do next. */
    vpn: async (ctx: Context) => {
      try {
        const state = await stateFor(ctx);
        if (!state) return;
        await ctx.replyWithHTML(accessText(state), isExpired(state) ? expiredAccessKeyboard() : accessKeyboard());
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
            ? `<b>Подписка</b>\n\nСейчас действует бесплатный тариф.\nОсталось: ${duration(state.trial.secondsRemaining)}`
            : '<b>Подписка</b>\n\nАктивной подписки нет. Подписка привязывается к устройству — посмотрите сроки в «📱 Мои устройства».';
        await ctx.replyWithHTML(text, isExpired(state) || !state.subscription ? expiredAccessKeyboard() : accessKeyboard());
      } catch (error) {
        console.error('Failed to show subscription', error);
        await ctx.reply(genericError);
      }
    },

    servers: async (ctx: Context) => {
      const topic = docBySlug('servers')!;
      await ctx.replyWithHTML(topic.text, docTopicKeyboard(config.siteUrl, topic.slug));
    },

    invite: async (ctx: Context) => {
      if (!ctx.from) return;
      try {
        const stats = await api.referrals(ctx.from.id);
        const shareText = `Попробуй Sali VPN — быстрый и приватный VPN. По моей ссылке ты получишь +${stats.friendBonusHours} часа бесплатно.`;
        await ctx.replyWithHTML(referralMessage(stats));
        await ctx.reply(
          `${shareText}\n\n${stats.link}`,
          referralShareKeyboard(stats.link, shareText) as Parameters<Context['reply']>[1],
        );
      } catch (error) {
        console.error('Failed to show referral link', error);
        await ctx.reply(genericError);
      }
    },

    account: async (ctx: Context) => {
      try {
        const state = await stateFor(ctx);
        if (!state) return;
        const telegram = state.user.username ? `@${state.user.username}` : state.user.firstName || 'Telegram';
        await ctx.replyWithHTML(
          [
            '<b>Аккаунт</b>',
            '',
            `Telegram: ${telegram}`,
            `Статус: ${state.state === 'BLOCKED' ? 'ограничен' : 'активен'}`,
            '',
            'Тарифы привязаны к устройствам: сроки — в «📱 Мои устройства», купленные коды — в «🔑 Мои коды».',
          ].join('\n'),
          accountKeyboard(),
        );
      } catch (error) {
        console.error('Failed to show account', error);
        await ctx.reply(genericError);
      }
    },

    help: async (ctx: Context) => {
      await ctx.replyWithHTML(
        '<b>Помощь</b>\n\nВыберите вопрос. Если ответа нет — напишите в поддержку, там отвечают живые люди.',
        faqKeyboard(config.supportUrl),
      );
    },

    faq: async (ctx: Context) => {
      const data = callbackData(ctx);
      if (!data || !FAQ[data]) return;
      await ctx.answerCbQuery().catch(() => undefined);
      await ctx.replyWithHTML(FAQ[data], supportKeyboard(config.supportUrl));
    },

    docs: async (ctx: Context) => {
      await ctx.replyWithHTML(
        '<b>Документация Sali VPN</b>\n\nКоротко о том, как всё устроено. Полные статьи — в справочном центре на сайте.',
        docsKeyboard(config.siteUrl),
      );
    },

    /** doc_<slug> */
    doc: async (ctx: Context) => {
      const topic = docBySlug(callbackData(ctx).replace(/^doc_/, ''));
      await ctx.answerCbQuery().catch(() => undefined);
      if (!topic) return;
      await ctx.replyWithHTML(topic.text, { ...docTopicKeyboard(config.siteUrl, topic.slug), link_preview_options: { is_disabled: true } });
    },
  };
}
