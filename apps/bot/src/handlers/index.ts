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
  faq_code: '<b>Куда вводить код?</b>\n\nОткройте приложение Sali VPN → на главном экране кнопка «Ввести код» (или Аккаунт → «Ввести код»). Регистр и дефисы не важны. Код одноразовый: после активации он привязывается к устройству.\n\nЕсли устройство привязано к Telegram, код можно активировать кнопкой «⚡ Активировать на моём устройстве» прямо под кодом.',
  faq_link: '<b>Как привязать устройство?</b>\n\nВ приложении нажмите «Привязать Telegram» — откроется этот бот, и устройство запомнится автоматически. Или пришлите сюда Sali ID из приложения: <code>SL-XXXX-XXXX</code>.',
  faq_not_connecting: '<b>VPN не подключается</b>\n\nПроверьте, что тариф активен («📱 Мои устройства»), отключите другие VPN и попробуйте снова. Если не помогло — напишите в поддержку и укажите ваш Sali ID.',
  faq_payment: '<b>Проблемы с оплатой</b>\n\nНе оплачивайте повторно. Код всегда сохраняется в «🔑 Мои коды». Для USDT нажмите «Я оплатил — проверить». Если кода нет через 10 минут — напишите в поддержку.',
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
