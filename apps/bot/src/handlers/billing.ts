import { Context, Markup } from 'telegraf';
import { BotConfig } from '../config';
import { api, ApiRejection, TelegramProfile } from '../services/api-client';
import { happEnabled, happRow } from './happ';
import {
  checkPaymentKeyboard,
  chooseDeviceKeyboard,
  codeKeyboard,
  downloadKeyboard,
  enabledMethods,
  mainReplyKeyboard,
  methodsKeyboard,
  PayMethod,
  plansKeyboard,
  welcomeKeyboard,
} from '../keyboards';
import {
  codesListMessage,
  devicesMessage,
  freeStartedMessage,
  paidAccountMessage,
  genericError,
  howItWorks,
  linkResultMessage,
  paidCodeMessage,
  plansMessage,
  redeemedMessage,
  referredWelcome,
} from '../messages';

/** Sali ID typed by the customer: SL-7K4P-Q2M9, sl7k4pq2m9, 7K4P Q2M9… */
export const SALI_ID_PATTERN = /^\s*(?:SL[-\s]?)?([0-9A-Za-z]{4})[-\s]?([0-9A-Za-z]{4})\s*$/i;
/** Activation code pasted into the chat. */
export const CODE_PATTERN = /^\s*(?:SALI[-\s]?)?([0-9A-Za-z]{4})[-\s]?([0-9A-Za-z]{4})[-\s]?([0-9A-Za-z]{4})\s*$/i;

function profile(ctx: Context): TelegramProfile | null {
  if (!ctx.from) return null;
  return {
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    languageCode: ctx.from.language_code,
  };
}

async function fail(ctx: Context, error: unknown, where: string) {
  if (error instanceof ApiRejection) {
    await ctx.reply(error.message);
    return;
  }
  console.error(`Bot billing error in ${where}`, error);
  await ctx.reply(genericError);
}

function callbackData(ctx: Context) {
  return ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
}

/** «SL-7K4P-Q2M9» → «7K4PQ2M9» (callback data) and back. */
const rawId = (publicId: string) => publicId.replace(/^SL-?/i, '').replace(/-/g, '').toUpperCase();
const prettyId = (raw: string) => `SL-${raw.slice(0, 4)}-${raw.slice(4)}`;
function unlinkKeyboard(others: Array<{ publicId: string; platform: string | null }>) {
  return Markup.inlineKeyboard([
    ...others.map((o) => [Markup.button.callback(`🔓 Отвязать ${o.platform === 'WINDOWS' ? '💻' : '📱'} ${o.publicId}`, `unl_${rawId(o.publicId)}`)]),
    [Markup.button.callback('📱 Мои устройства', 'menu_devices')],
  ]);
}

export function createBillingHandlers(config: BotConfig) {
  const handlers = {
    /** /start: registers the customer; start=link_<SaliID> claims the app installation ("фиксация клиента"). */
    start: async (ctx: Context, startParam?: string): Promise<void> => {
      const me = profile(ctx);
      if (!me) return;
      try {
        const result = await api.start(me, startParam);
        if (result.isBlocked) {
          await ctx.reply('Доступ к аккаунту ограничен. Обратитесь в поддержку.');
          return;
        }
        if (result.link) {
          await ctx.replyWithHTML(linkResultMessage(result.link.status, result.link.publicId, result.link.share, result.link.notes), mainReplyKeyboard);
          if (result.link.share && !result.link.share.covered) {
            await ctx.reply('Какое устройство отвязать?', unlinkKeyboard(result.link.share.others));
            return;
          }
          if (result.link.share?.covered) return;
          if (result.link.status === 'linked' || result.link.status === 'already') {
            await ctx.replyWithHTML(
              result.freeUsed ? 'Осталось выбрать тариф 👇' : 'Начните с бесплатного тарифа или сразу выберите подписку 👇',
              welcomeKeyboard(result.freeUsed),
            );
          }
          return;
        }
        if (startParam === 'buy') return handlers.buy(ctx);
        if (startParam === 'free') return handlers.free(ctx);
        if (startParam?.startsWith('doc_')) return;
        await ctx.replyWithHTML(
          [
            '<b>Sali VPN</b> — быстрый и приватный VPN в одно нажатие.',
            '',
            `Ваш Sali ID в боте: <code>${result.publicId}</code>`,
            '',
            howItWorks,
          ].join('\n'),
          mainReplyKeyboard,
        );
        if (result.referred) await ctx.replyWithHTML(referredWelcome(result.friendBonusHours ?? 3));
        await ctx.reply('С чего начнём?', welcomeKeyboard(result.freeUsed));
      } catch (error) {
        await fail(ctx, error, 'start');
      }
    },

    buy: async (ctx: Context): Promise<void> => {
      try {
        const plans = await api.plans(ctx.from?.id);
        await ctx.replyWithHTML(plansMessage(plans), plansKeyboard(plans));
      } catch (error) {
        await fail(ctx, error, 'buy');
      }
    },

    /** buy_<planCode> → choose how to pay. */
    choosePlan: async (ctx: Context): Promise<void> => {
      const planCode = callbackData(ctx).replace(/^buy_/, '');
      await ctx.answerCbQuery().catch(() => undefined);
      const methods = enabledMethods();
      if (methods.length === 1) return handlers.pay(ctx, methods[0], planCode);
      await ctx.reply('Как удобнее оплатить?', methodsKeyboard(planCode));
    },

    /** pay_<method>_<planCode> */
    payCallback: async (ctx: Context) => {
      const [, method, ...rest] = callbackData(ctx).split('_');
      await ctx.answerCbQuery().catch(() => undefined);
      await handlers.pay(ctx, method as PayMethod, rest.join('_'));
    },

    pay: async (ctx: Context, method: PayMethod, planCode: string): Promise<void> => {
      const me = profile(ctx);
      if (!me) return;
      try {
        const purchase = await api.purchase(me, planCode, method);
        if (purchase.method === 'stars') {
          await ctx.replyWithInvoice({
            title: purchase.title,
            description: purchase.description,
            payload: purchase.paymentId,
            provider_token: '',
            currency: 'XTR',
            prices: [{ label: purchase.title, amount: purchase.stars }],
          });
          return;
        }
        if (purchase.cryptoInvoice) {
          const invoice = purchase.cryptoInvoice;
          const until = new Date(invoice.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
          await ctx.replyWithHTML(
            [
              `<b>Оплата ${invoice.asset} · сеть ${invoice.network}</b>`,
              '',
              `Сумма (точно): <code>${invoice.amount}</code> ${invoice.asset}`,
              `Адрес: <code>${invoice.address}</code>`,
              ...(invoice.reference ? [`Комментарий (обязательно): <code>${invoice.reference}</code>`] : []),
              '',
              `Счёт действует до ${until} UTC. Код придёт сюда автоматически сразу после подтверждения сети.`,
            ].join('\n'),
            checkPaymentKeyboard(purchase.paymentId, invoice.paymentUrl, '👛 Открыть кошелёк'),
          );
          return;
        }
        if (purchase.checkoutUrl) {
          await ctx.reply('Оплата картой откроется на защищённой странице. Код придёт сюда после оплаты.', checkPaymentKeyboard(purchase.paymentId, purchase.checkoutUrl, '💳 Перейти к оплате'));
          return;
        }
        await ctx.reply(genericError);
      } catch (error) {
        await fail(ctx, error, 'pay');
      }
    },

    preCheckout: async (ctx: Context) => {
      if (!('pre_checkout_query' in ctx.update)) return;
      const query = ctx.update.pre_checkout_query;
      try {
        const result = await api.precheck(query.from.id, query.invoice_payload, query.total_amount, query.currency);
        await ctx.answerPreCheckoutQuery(result.ok, result.error);
      } catch (error) {
        console.error('pre_checkout_query failed', error);
        await ctx.answerPreCheckoutQuery(false, 'Не получилось проверить счёт. Попробуйте ещё раз через минуту.');
      }
    },

    successfulPayment: async (ctx: Context) => {
      if (!ctx.message || !('successful_payment' in ctx.message) || !ctx.from) return;
      const payment = ctx.message.successful_payment;
      try {
        if (payment.currency !== 'XTR') {
          // Legacy invoices created before the code flow.
          await api.confirmPayment(payment.invoice_payload);
          await ctx.reply('Оплата прошла успешно. Подписка активирована.');
          return;
        }
        const result = await api.starsPaid(ctx.from.id, payment.invoice_payload, payment.total_amount, payment.currency, payment.telegram_payment_charge_id);
        if (result.paid) await ctx.replyWithHTML(paidAccountMessage(result.paid), result.paid.devices ? undefined : downloadKeyboard());
        else if (result.code) await ctx.replyWithHTML(paidCodeMessage(result.code), codeKeyboard(result.code));
        else await ctx.reply('Оплата получена ✅ Подписка включится на вашем аккаунте через минуту.');
      } catch (error) {
        console.error('Failed to confirm Stars payment', error);
        await ctx.reply('Оплата получена ✅ Подписка включится на вашем аккаунте в течение пары минут. Если не появится — напишите в поддержку.');
      }
    },

    /** chk_<paymentId> */
    checkPayment: async (ctx: Context) => {
      const paymentId = callbackData(ctx).replace(/^chk_/, '');
      if (!ctx.from) return;
      try {
        const result = await api.paymentStatus(ctx.from.id, paymentId);
        if (result.status === 'SUCCEEDED' && (result.paid || result.code)) {
          await ctx.answerCbQuery('Оплата найдена ✅').catch(() => undefined);
          if (result.paid) await ctx.replyWithHTML(paidAccountMessage(result.paid), result.paid.devices ? undefined : downloadKeyboard());
          else await ctx.replyWithHTML(paidCodeMessage(result.code!), codeKeyboard(result.code!));
        } else if (result.status === 'FAILED') {
          await ctx.answerCbQuery('Счёт истёк или платёж не прошёл', { show_alert: true }).catch(() => undefined);
        } else {
          await ctx.answerCbQuery('Пока не видим оплату. Сеть может подтверждать до пары минут.', { show_alert: true }).catch(() => undefined);
        }
      } catch (error) {
        await ctx.answerCbQuery().catch(() => undefined);
        await fail(ctx, error, 'checkPayment');
      }
    },

    free: async (ctx: Context): Promise<void> => {
      if (!ctx.from) return;
      try {
        const started = await api.freeCode(ctx.from.id);
        await ctx.replyWithHTML(freeStartedMessage(started));
      } catch (error) {
        if (error instanceof ApiRejection && error.status === 404) {
          await api.start(profile(ctx)!).catch(() => undefined);
          return handlers.free(ctx);
        }
        if (error instanceof ApiRejection) {
          await ctx.reply(`${error.message}. Выберите подписку на месяц или год 👇`, Markup.inlineKeyboard([[Markup.button.callback('💎 Купить подписку', 'menu_buy')]]));
          return;
        }
        await fail(ctx, error, 'free');
      }
    },

    codes: async (ctx: Context) => {
      if (!ctx.from) return;
      try {
        await ctx.replyWithHTML(codesListMessage(await api.codes(ctx.from.id)));
      } catch (error) {
        await fail(ctx, error, 'codes');
      }
    },

    devices: async (ctx: Context) => {
      if (!ctx.from) return;
      try {
        const overview = await api.devices(ctx.from.id);
        await ctx.replyWithHTML(devicesMessage(overview), Markup.inlineKeyboard([
          ...overview.devices.map((d) => [Markup.button.callback(`🔓 Отвязать ${d.publicId}`, `unl_${rawId(d.publicId)}`)]),
          [Markup.button.callback('📲 Скачать приложение', 'menu_download')],
          ...await happRow(),
        ]));
      } catch (error) {
        await fail(ctx, error, 'devices');
      }
    },

    /** «🔗 Да, это моё устройство» under «код активирован»: links that app in one tap. */
    linkDevice: async (ctx: Context) => {
      const raw = callbackData(ctx).replace(/^lnk_/, '');
      await ctx.answerCbQuery().catch(() => undefined);
      if (!ctx.from || !/^[0-9A-Za-z]{8}$/.test(raw)) return;
      try {
        const result = await api.link(ctx.from.id, raw);
        await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
        await ctx.replyWithHTML(linkResultMessage(result.status, result.publicId, result.share, result.notes), result.share && !result.share.covered ? unlinkKeyboard(result.share.others) : undefined);
      } catch (error) {
        await fail(ctx, error, 'devices');
      }
    },

    /** «Отвязать SL-…»: asks first; then frees the place on the subscription. */
    unlink: async (ctx: Context) => {
      const data = callbackData(ctx);
      await ctx.answerCbQuery().catch(() => undefined);
      if (!ctx.from) return;
      const ask = data.match(/^unl_([0-9A-Z]{8})$/);
      if (ask) {
        await ctx.replyWithHTML(
          `Отвязать устройство <b>${prettyId(ask[1])}</b>?\n\nОно перестанет пользоваться вашей подпиской, а место освободится для нового. Подписка никуда не пропадёт.`,
          Markup.inlineKeyboard([[Markup.button.callback('🔓 Да, отвязать', `unly_${ask[1]}`), Markup.button.callback('Нет', 'menu_devices')]]),
        );
        return;
      }
      const yes = data.match(/^unly_([0-9A-Z]{8})$/);
      if (!yes) return;
      try {
        const r = await api.unlink(ctx.from.id, yes[1]);
        await ctx.replyWithHTML(`🔓 Устройство <b>${r.publicId}</b> отвязано. Если на новом устройстве приложение уже открыто — нажмите «Подключить».`);
        await handlers.devices(ctx);
      } catch (error) {
        await fail(ctx, error, 'devices');
      }
    },

    download: async (ctx: Context) => {
      await ctx.replyWithHTML(
        [
          '<b>Приложение Sali VPN</b>',
          '',
          'Есть для телефона (Android) и компьютера (Windows). Одна подписка — до 3 устройств.',
          '',
          'После установки откройте приложение и нажмите «Войти через Telegram» — подписка появится сама, устройство — в «📱 Мои устройства».',
          ...((await happEnabled()) ? ['', 'На iPhone и Mac — через приложение Happ: кнопка «📲 Подключить в Happ».'] : []),
        ].join('\n'),
        (await happEnabled()) ? Markup.inlineKeyboard([...downloadKeyboard().reply_markup.inline_keyboard, ...await happRow()]) : downloadKeyboard(),
      );
    },

    /** apply_<code> and at_<code>_<SaliID>: redeem a code onto a linked device without typing. */
    apply: async (ctx: Context) => {
      const data = callbackData(ctx);
      const [, code, publicId] = data.split('_');
      if (!ctx.from || !code) return;
      await ctx.answerCbQuery().catch(() => undefined);
      try {
        const result = await api.apply(ctx.from.id, code, publicId);
        if (result.chooseDevice) {
          await ctx.reply('На какое устройство активировать?', chooseDeviceKeyboard(code, result.chooseDevice));
          return;
        }
        await ctx.replyWithHTML(redeemedMessage(result));
      } catch (error) {
        await fail(ctx, error, 'apply');
      }
    },

    /** Free text: a Sali ID links a device, an activation code gets an "activate" button. */
    text: async (ctx: Context, next: () => Promise<void>) => {
      if (!ctx.message || !('text' in ctx.message) || !ctx.from) return next();
      const text = ctx.message.text;
      const code = text.match(CODE_PATTERN);
      if (code) {
        const raw = code.slice(1).join('').toUpperCase();
        await ctx.reply(`Код SALI-${code[1]}-${code[2]}-${code[3]}`.toUpperCase(), Markup.inlineKeyboard([[Markup.button.callback('⚡ Активировать на моём устройстве', `apply_${raw}`)]]));
        return;
      }
      const id = text.match(SALI_ID_PATTERN);
      if (id && /\d/.test(text) && /^\s*SL/i.test(text)) {
        try {
          const result = await api.link(ctx.from.id, `${id[1]}${id[2]}`);
          await ctx.replyWithHTML(linkResultMessage(result.status, result.publicId, result.share, result.notes), result.share && !result.share.covered ? unlinkKeyboard(result.share.others) : undefined);
        } catch (error) {
          await fail(ctx, error, 'link');
        }
        return;
      }
      return next();
    },

  };
  return handlers;
}
