import { Context, Markup } from 'telegraf';
import { api, ApiRejection, ConnectInfo } from '../services/api-client';
import { genericError } from '../messages';
import { appDownloadUrls, menuLabels } from '../keyboards';

/**
 * «⚡ Подключиться» — the second (and last) tap after «🎁 Получить 24 часа бесплатно».
 * One message with every way to connect: the Sali app first, Happ as the extra way
 * (iPhone, Mac, or anyone who does not want to install an APK).
 */
const until = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }) + ' (МСК)' : null;

function connectMessage(info: ConnectInfo) {
  const head = info.access === 'paid'
    ? `🟢 <b>Подписка активна</b>${info.until ? ` до ${until(info.until)}` : ''}`
    : `🎁 <b>Бесплатный доступ</b>${info.until ? ` до ${until(info.until)}` : ''}`;
  return [
    head,
    '',
    '<b>Как подключиться</b>',
    '',
    info.apps
      ? '📱 <b>Приложение Sali</b> уже привязано — откройте его и нажмите «Подключить».'
      : '📱 <b>Приложение Sali</b> (Android, Windows): установите и нажмите «Войти через Telegram» — доступ появится сам.',
    ...(info.happ
      ? ['', '📲 <b>Через Happ</b> (iPhone, Mac, Android, ПК): нажмите «Открыть в Happ» — серверы Sali добавятся сами, без настроек.']
      : []),
    '',
    '<i>Не получилось? «💬 Поддержка» — поможем за пару минут.</i>',
  ].join('\n');
}

function connectKeyboard(info: ConnectInfo) {
  const { apk, windows } = appDownloadUrls();
  return Markup.inlineKeyboard([
    [Markup.button.url('📱 Sali для Android', apk), Markup.button.url('💻 Sali для Windows', windows)],
    ...(info.happ ? [[Markup.button.url('📲 Открыть в Happ', info.happ.openUrl)]] : []),
    ...(info.happ ? [[Markup.button.callback('🔗 Ссылка для Happ вручную', 'menu_happ')]] : []),
    ...(info.access === 'free' ? [[Markup.button.callback(menuLabels.buy, 'menu_buy')]] : []),
  ]);
}

export async function connect(ctx: Context) {
  if (!ctx.from) return;
  try {
    const info = await api.connectInfo(ctx.from.id);
    if (info.access === 'none') {
      const state = await api.start({ telegramId: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name, lastName: ctx.from.last_name, languageCode: ctx.from.language_code }).catch(() => null);
      await ctx.replyWithHTML(
        state && !state.freeUsed
          ? 'Сначала включите бесплатный доступ — это одна кнопка, без оплаты и без карты 👇'
          : 'Бесплатные 24 часа уже использованы. Оформите подписку — и сразу подключайтесь 👇',
        Markup.inlineKeyboard([
          ...(state && !state.freeUsed ? [[Markup.button.callback('🎁 Получить 24 часа бесплатно', 'menu_free')]] : []),
          [Markup.button.callback(menuLabels.buy, 'menu_buy')],
        ]),
      );
      return;
    }
    await ctx.replyWithHTML(connectMessage(info), { ...connectKeyboard(info), link_preview_options: { is_disabled: true } });
  } catch (error) {
    if (error instanceof ApiRejection) { await ctx.reply(error.message); return; }
    console.error('Bot connect error', error);
    await ctx.reply(genericError);
  }
}
