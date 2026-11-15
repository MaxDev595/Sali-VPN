import { Context } from 'telegraf';
import { BotConfig } from '../config';
import { api } from '../services/api-client';
import { genericError, referralMessage } from '../messages';
import { docBySlug } from '../docs';
import { docTopicKeyboard, helpKeyboard, mainInlineKeyboard, mainReplyKeyboard, referralShareKeyboard } from '../keyboards';

function callbackData(ctx: Context) {
  return ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
}

export function createHandlers(config: BotConfig) {
  return {
    menu: async (ctx: Context) => {
      await ctx.reply('Меню закреплено внизу 👇', mainReplyKeyboard);
      await ctx.reply('Что сделать?', mainInlineKeyboard);
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

    help: async (ctx: Context) => {
      await ctx.replyWithHTML(
        '<b>Помощь</b>\n\nВыберите тему. Не нашли ответ — напишите нам, отвечают живые люди.',
        helpKeyboard(config.supportUrl),
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
