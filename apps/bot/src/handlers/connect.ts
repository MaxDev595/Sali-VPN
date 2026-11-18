import { Context, Markup } from 'telegraf';
import { api, ApiRejection, ConnectInfo } from '../services/api-client';
import { genericError } from '../messages';
import { appDownloadUrls, FREE_BUTTON } from '../keyboards';

/**
 * «⚡ Подключиться»: one message with every way to connect — the Sali app on Android and
 * Windows, Happ on iPhone and Mac. Also shown right after «🎁 Попробовать бесплатно»,
 * so a new customer is one tap away from a working VPN.
 */
const until = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }) + ' (МСК)' : null;

function connectMessage(info: ConnectInfo, headline?: string) {
  const status = info.access === 'paid'
    ? `🟢 Подписка активна${info.until ? ` до ${until(info.until)}` : ''}`
    : `🎁 Бесплатный доступ${info.until ? ` до ${until(info.until)}` : ''}`;
  return [
    ...(headline ? [headline] : []),
    status,
    '',
    ...(info.apps ? ['✅ Приложение Sali уже подключено — откройте его и нажмите «Подключить».', ''] : []),
    '<b>Где будете пользоваться VPN?</b>',
    '📱 Android · 💻 Windows — скачайте Sali и нажмите «Войти через Telegram».',
    ...(info.happ ? ['🍏 iPhone · Mac — нажмите «Happ», серверы добавятся сами.'] : []),
  ].join('\n');
}

function connectKeyboard(info: ConnectInfo) {
  const { apk, windows } = appDownloadUrls();
  return Markup.inlineKeyboard([
    [Markup.button.url('📱 Android', apk), Markup.button.url('💻 Windows', windows)],
    ...(info.happ ? [[Markup.button.url('🍏 iPhone · Mac (Happ)', info.happ.openUrl)]] : []),
    ...(info.access === 'free' ? [[Markup.button.callback('💎 Купить подписку', 'menu_plan')]] : []),
  ]);
}

export async function connect(ctx: Context, headline?: string) {
  if (!ctx.from) return;
  try {
    const info = await api.connectInfo(ctx.from.id);
    if (info.access === 'none') {
      const state = await api.start({ telegramId: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name, lastName: ctx.from.last_name, languageCode: ctx.from.language_code }).catch(() => null);
      const freeLeft = Boolean(state && !state.freeUsed);
      await ctx.replyWithHTML(
        freeLeft
          ? 'Сначала включите бесплатный доступ — одна кнопка, без карты 👇'
          : 'Бесплатные 3 дня уже использованы. Оформите подписку — и сразу подключайтесь 👇',
        Markup.inlineKeyboard([[freeLeft ? Markup.button.callback(FREE_BUTTON, 'menu_free') : Markup.button.callback('💎 Купить подписку', 'menu_plan')]]),
      );
      return;
    }
    await ctx.replyWithHTML(connectMessage(info, headline), { ...connectKeyboard(info), link_preview_options: { is_disabled: true } });
  } catch (error) {
    if (error instanceof ApiRejection) { await ctx.reply(error.message); return; }
    console.error('Bot connect error', error);
    await ctx.reply(genericError);
  }
}
