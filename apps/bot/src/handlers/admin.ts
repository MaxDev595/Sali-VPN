import type { Context } from 'telegraf';
import { api, ApiRejection } from '../services/api-client';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const args = (ctx: Context) => (((ctx.message as { text?: string } | undefined)?.text ?? '').split(/\s+/).slice(1));
const fail = (ctx: Context, error: unknown) =>
  ctx.reply(error instanceof ApiRejection ? `⚠️ ${error.message}` : '⚠️ Не получилось, попробуйте ещё раз.');

/** /myid — anyone: shows the Telegram ID (needed for ADMIN_TELEGRAM_IDS). */
export async function myId(ctx: Context) {
  await ctx.replyWithHTML(`Ваш Telegram ID: <code>${ctx.from!.id}</code>`);
}

/** /addserver DE [City] — one-time install command for a new VPS. */
export async function addServer(ctx: Context) {
  const [country, ...city] = args(ctx);
  if (!country) {
    await ctx.replyWithHTML('Использование: <code>/addserver DE</code> или <code>/addserver FI Helsinki</code>\nКод страны — две буквы.');
    return;
  }
  try {
    const { name, command } = await api.nodeToken(ctx.from!.id, country, city.join(' ') || undefined);
    await ctx.replyWithHTML(
      `<b>${esc(name)}</b>\n\n1. Откройте консоль нового сервера (Ubuntu 24.04) под root.\n2. Вставьте одну команду:\n\n<code>${esc(command)}</code>\n\nУстановка займёт 2–4 минуты. В конце будет «Готово: ${esc(name)} подключён». Команда одноразовая и действует 24 часа.`,
    );
  } catch (error) { await fail(ctx, error); }
}

/** /nodes — live state of all VPN servers. */
export async function nodes(ctx: Context) {
  try {
    const list = await api.nodes(ctx.from!.id);
    if (!list.length) { await ctx.reply('Серверов пока нет. Добавьте первый: /addserver DE'); return; }
    const lines = list.map((n) => `${n.online ? '🟢' : '🔴'} <b>${esc(n.name)}</b> ${n.country} · ${n.host} · ${n.premiumOnly ? '💎 по подписке' : '🎁 бесплатный'}${n.active ? '' : ' · выключен'}\n     пользователей: ${n.users ?? '—'}, сейчас онлайн: ${n.connectedNow ?? '—'}, нагрузка: ${n.load ?? '—'}`);
    await ctx.replyWithHTML(`<b>VPN-серверы</b>\n\n${lines.join('\n')}\n\nВыключить/включить: /node_off Sali DE-1 · /node_on Sali DE-1\nДоступ: /node_free Sali DE-1 (всем) · /node_paid Sali DE-1 (только подписка)`);
  } catch (error) { await fail(ctx, error); }
}

export async function nodeOff(ctx: Context) { await toggle(ctx, false); }
export async function nodeOn(ctx: Context) { await toggle(ctx, true); }
async function toggle(ctx: Context, isActive: boolean) {
  const name = args(ctx).join(' ');
  if (!name) { await ctx.reply(`Использование: /node_${isActive ? 'on' : 'off'} Sali DE-1`); return; }
  try {
    const { updated } = await api.nodeActive(ctx.from!.id, name, isActive);
    await ctx.reply(updated ? `${name}: ${isActive ? 'включён' : 'выключен для новых подключений'}` : `Сервер «${name}» не найден`);
  } catch (error) { await fail(ctx, error); }
}

/** /node_free NAME — everyone may use it; /node_paid NAME — subscribers only. */
export async function nodeFree(ctx: Context) { await premium(ctx, false); }
export async function nodePaid(ctx: Context) { await premium(ctx, true); }
async function premium(ctx: Context, premiumOnly: boolean) {
  const name = args(ctx).join(' ');
  if (!name) { await ctx.reply(`Использование: /node_${premiumOnly ? 'paid' : 'free'} Sali DE-1`); return; }
  try {
    const { updated } = await api.nodePremium(ctx.from!.id, name, premiumOnly);
    await ctx.reply(updated ? `${name}: ${premiumOnly ? 'только по подписке 💎' : 'бесплатный, доступен всем 🎁'}` : `Сервер «${name}» не найден`);
  } catch (error) { await fail(ctx, error); }
}

/** /grant [telegramId] — бессрочная подписка (себе, если ID не указан). */
export async function grant(ctx: Context) {
  const [target] = args(ctx);
  try {
    const res = await api.grantForever(ctx.from!.id, target);
    await ctx.reply(`✅ Бессрочная подписка выдана (Telegram ID ${res.telegramId}).`);
  } catch (error) { await fail(ctx, error); }
}
