import { Context, Markup } from 'telegraf';
import { api, ApiRejection, HappLink } from '../services/api-client';
import { genericError } from '../messages';

/**
 * «📲 Подключить в Happ»: a personal subscription link for Happ (VLESS + Reality).
 * Shown only when the API has Happ switched on (HAPP_ENABLED, staging first).
 */
let cached: { value: boolean; at: number } | null = null;
export async function happEnabled() {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
  const value = await api.happEnabled().then((r) => r.enabled).catch(() => false);
  cached = { value, at: Date.now() };
  return value;
}

/** Extra keyboard row for menus (empty when Happ is off). */
export async function happRow() {
  return (await happEnabled()) ? [[Markup.button.callback('📲 Подключить в Happ', 'menu_happ')]] : [];
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const until = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }) : 'бессрочно');

function message(link: HappLink, rotated = false) {
  return [
    rotated ? '🔄 <b>Новая ссылка для Happ готова</b>\nСтарая больше не работает — добавьте новую в Happ заново.' : '📲 <b>Sali VPN в Happ</b>',
    '',
    'Happ — приложение для iPhone, Android, Windows и Mac. Sali работает в нём по протоколу VLESS + Reality: трафик выглядит как обычный сайт, поэтому его труднее заблокировать.',
    '',
    '1. Установите Happ (кнопка «Открыть в Happ» подскажет ссылки).',
    '2. Нажмите «Открыть в Happ» — серверы Sali добавятся сами.',
    '   Или скопируйте ссылку ниже и добавьте её в Happ через «+» → «Вставить из буфера».',
    '',
    `<code>${esc(link.url)}</code>`,
    '',
    `Подписка до: <b>${until(link.expiresAt)}</b> · серверов: ${link.servers}`,
    '',
    '🔒 Ссылка личная и работает как пароль — не пересылайте её. Если она попала к чужим, нажмите «Сбросить ссылку».',
  ].join('\n');
}

function keyboard(link: HappLink) {
  return Markup.inlineKeyboard([
    [Markup.button.url('📲 Открыть в Happ', link.openUrl)],
    [Markup.button.callback('🔄 Сбросить ссылку', 'happ_rotate')],
  ]);
}

async function fail(ctx: Context, error: unknown) {
  if (error instanceof ApiRejection) {
    await ctx.reply(error.message, Markup.inlineKeyboard([[Markup.button.callback('💎 Купить подписку', 'menu_buy')]]));
    return;
  }
  console.error('Bot happ error', error);
  await ctx.reply(genericError);
}

export async function show(ctx: Context) {
  if (!ctx.from) return;
  if (!(await happEnabled())) { await ctx.reply('Подключение через Happ скоро появится.'); return; }
  try {
    const link = await api.happLink(ctx.from.id);
    await ctx.replyWithHTML(message(link), { ...keyboard(link), link_preview_options: { is_disabled: true } });
  } catch (error) {
    await fail(ctx, error);
  }
}

/** happ_rotate → confirmation; happ_rotate_ok → new link. */
export async function rotate(ctx: Context) {
  const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '';
  await ctx.answerCbQuery().catch(() => undefined);
  if (!ctx.from) return;
  if (data === 'happ_rotate') {
    await ctx.reply('Сбросить ссылку? Happ на всех ваших устройствах перестанет подключаться, пока вы не добавите новую ссылку.', Markup.inlineKeyboard([
      [Markup.button.callback('Да, сбросить', 'happ_rotate_ok'), Markup.button.callback('Отмена', 'happ_rotate_no')],
    ]));
    return;
  }
  await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
  if (data !== 'happ_rotate_ok') return;
  try {
    const link = await api.happRotate(ctx.from.id);
    await ctx.replyWithHTML(message(link, true), { ...keyboard(link), link_preview_options: { is_disabled: true } });
  } catch (error) {
    await fail(ctx, error);
  }
}
