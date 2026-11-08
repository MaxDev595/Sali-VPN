import { Markup, type Context } from 'telegraf';
import { api, ApiRejection, type AdminCard } from '../services/api-client';
import { nodes as showNodes } from './admin';

/**
 * /admin — панель администратора прямо в боте.
 *
 *   🎁 Выдать подписку → кому (@username / Telegram ID / SL-XXXX-XXXX / пересланное сообщение)
 *                      → срок (1 день … бессрочно, или своё число дней)
 *                      → тип: 🛡 от администрации | 🎁 подарок
 *                      → сообщение получателю (необязательно) → подтверждение
 *   🔎 Найти пользователя → карточка: доступ, устройства, оплаты, коды; выдать / забрать / блок
 *   📊 Статистика · 📜 Выданные · 🖥 Серверы
 *
 * Доступ проверяет API (ADMIN_TELEGRAM_IDS) на каждом действии.
 */

const FOREVER = 36_500;
type Step = 'target' | 'find' | 'days' | 'message';
interface Draft { step?: Step; userId?: string; title?: string; days?: number; kind?: 'admin' | 'gift'; message?: string; at: number }
const drafts = new Map<number, Draft>();
const draft = (id: number) => {
  const d = drafts.get(id);
  if (d && Date.now() - d.at > 30 * 60_000) { drafts.delete(id); return undefined; }
  return d;
};
const save = (id: number, patch: Partial<Draft>) => drafts.set(id, { ...(draft(id) ?? {}), ...patch, at: Date.now() });

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const dur = (days: number) => {
  if (days >= FOREVER) return '♾ бессрочно';
  const n = days % 100, m = days % 10;
  return `${days} ${n >= 11 && n <= 14 ? 'дней' : m === 1 ? 'день' : m >= 2 && m <= 4 ? 'дня' : 'дней'}`;
};
const kindLabel = (k?: 'admin' | 'gift') => (k === 'gift' ? '🎁 Подарок' : '🛡 От администрации');
const usd = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;

async function fail(ctx: Context, error: unknown) {
  const text = error instanceof ApiRejection ? `⚠️ ${error.message}` : '⚠️ Не получилось, попробуйте ещё раз.';
  await ctx.reply(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Админ-панель', 'adm:menu')]]));
}

/** Edits the panel message when we came from a button, otherwise sends a new one. */
async function show(ctx: Context, html: string, keyboard: ReturnType<typeof Markup.inlineKeyboard>) {
  if (ctx.callbackQuery) {
    try { await ctx.editMessageText(html, { parse_mode: 'HTML', ...keyboard, link_preview_options: { is_disabled: true } }); return; } catch { /* message too old or unchanged */ }
  }
  await ctx.replyWithHTML(html, { ...keyboard, link_preview_options: { is_disabled: true } });
}

const back = [Markup.button.callback('⬅️ Меню', 'adm:menu')];

async function isAdmin(ctx: Context) {
  const ok = await api.isAdmin(ctx.from!.id).then((r) => r.admin).catch(() => false);
  if (!ok) await ctx.reply('Эта команда только для администратора.');
  return ok;
}

export async function menu(ctx: Context) {
  if (!ctx.callbackQuery && !(await isAdmin(ctx))) return;
  drafts.delete(ctx.from!.id);
  await show(ctx, '🛠 <b>Админ-панель Sali VPN</b>\n\nЧто делаем?', Markup.inlineKeyboard([
    [Markup.button.callback('🎁 Выдать подписку', 'adm:grant')],
    [Markup.button.callback('🔎 Найти пользователя', 'adm:find'), Markup.button.callback('📊 Статистика', 'adm:stats')],
    [Markup.button.callback('📜 Выданные', 'adm:issued'), Markup.button.callback('🖥 Серверы', 'adm:nodes')],
  ]));
}

const ASK_TARGET = 'Кому? Пришлите одно из:\n• <b>@username</b>\n• <b>Telegram ID</b> (цифры)\n• номер устройства <b>SL-XXXX-XXXX</b> (в приложении → Профиль)\n• или <b>перешлите</b> сюда любое сообщение этого человека';

function card(c: AdminCard) {
  const lines = [
    `${c.kind === 'telegram' ? '👤' : '📱'} <b>${esc(c.title)}</b>${c.isBlocked ? ' · 🚫 заблокирован' : ''}`,
    c.username ? `@${esc(c.username)}` : null,
    c.telegramId ? `Telegram ID: <code>${c.telegramId}</code>` : null,
    `Sali ID: <code>${c.publicId}</code>`,
    c.owner ? `Владелец: ${esc(c.owner)}` : null,
    `С нами с ${new Date(c.createdAt).toLocaleDateString('ru-RU')}`,
    '',
    `Доступ: <b>${esc(c.access)}</b>`,
  ].filter((l) => l !== null);
  if (c.kind === 'telegram') {
    lines.push(c.devices.length ? `\n📱 Устройства (${c.devices.length}):\n${c.devices.map((d) => `• <code>${d.publicId}</code> — ${esc(d.access)}`).join('\n')}` : '\n📱 Устройств пока нет — подписка придёт кодом в чат.');
    lines.push(`\n💳 Оплат: ${c.payments} на ${usd(c.paidUsd)} · 🔑 кодов: ${c.codesIssued} (активировано ${c.codesRedeemed}) · 👥 пригласил: ${c.invited}`);
  }
  return lines.join('\n');
}

function cardKeyboard(c: AdminCard) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎁 Выдать подписку', `adm:g:${c.id}`)],
    [Markup.button.callback('⛔ Забрать доступ', `adm:rv:${c.id}`), Markup.button.callback(c.isBlocked ? '✅ Разблокировать' : '🚫 Заблокировать', `adm:bl:${c.isBlocked ? 0 : 1}:${c.id}`)],
    ...c.devices.slice(0, 5).map((d) => [Markup.button.callback(`📱 ${d.publicId}`, `adm:c:${d.id}`)]),
    back,
  ]);
}

async function openCard(ctx: Context, query: string) {
  try {
    const c = await api.adminLookup(ctx.from!.id, query);
    drafts.delete(ctx.from!.id);
    await show(ctx, card(c), cardKeyboard(c));
  } catch (error) { await fail(ctx, error); }
}

async function chooseDuration(ctx: Context, userId: string) {
  try {
    const c = await api.adminLookup(ctx.from!.id, userId);
    save(ctx.from!.id, { userId: c.id, title: c.title, step: undefined, days: undefined, kind: undefined, message: undefined });
    const where = c.kind === 'device' ? `на устройство <code>${c.publicId}</code>` : c.devices.length ? `на ${c.devices.length === 1 ? 'устройство' : 'все устройства'} ${c.devices.map((d) => `<code>${d.publicId}</code>`).join(', ')}` : 'кодом в Telegram (устройств пока нет)';
    await show(ctx, `🎁 Подписка для <b>${esc(c.title)}</b>\nПридёт ${where}.\n\nНа какой срок?`, Markup.inlineKeyboard([
      [1, 3, 7].map((d) => Markup.button.callback(dur(d), `adm:d:${d}`)),
      [30, 90, 180].map((d) => Markup.button.callback(dur(d), `adm:d:${d}`)),
      [Markup.button.callback('1 год', 'adm:d:365'), Markup.button.callback('♾ Бессрочно', `adm:d:${FOREVER}`)],
      [Markup.button.callback('✏️ Своё число дней', 'adm:d:custom')],
      back,
    ]));
  } catch (error) { await fail(ctx, error); }
}

async function chooseKind(ctx: Context) {
  const d = draft(ctx.from!.id)!;
  await show(ctx, `Срок: <b>${dur(d.days!)}</b>\n\nКак оформить?\n🛡 <b>От администрации</b> — «Sali Pro · от администрации»\n🎁 <b>Подарок</b> — «Sali Pro · подарок», с открыткой`, Markup.inlineKeyboard([
    [Markup.button.callback('🛡 От администрации', 'adm:k:admin'), Markup.button.callback('🎁 Подарок', 'adm:k:gift')],
    back,
  ]));
}

async function askMessage(ctx: Context) {
  save(ctx.from!.id, { step: 'message' });
  const gift = draft(ctx.from!.id)!.kind === 'gift';
  await show(ctx, gift ? '💌 Напишите поздравление — его получат вместе с подарком.' : '✍️ Напишите сообщение получателю (необязательно).', Markup.inlineKeyboard([
    [Markup.button.callback('Без сообщения', 'adm:m:skip')],
    back,
  ]));
}

async function confirm(ctx: Context) {
  const d = draft(ctx.from!.id);
  if (!d?.userId || !d.days) { await menu(ctx); return; }
  save(ctx.from!.id, { step: undefined });
  const html = [
    '<b>Проверьте</b>',
    '',
    `Кому: <b>${esc(d.title ?? '')}</b>`,
    `Срок: <b>${dur(d.days)}</b>`,
    `Тип: <b>${kindLabel(d.kind)}</b>`,
    d.message ? `Сообщение: <i>${esc(d.message)}</i>` : 'Сообщение: —',
  ].join('\n');
  await show(ctx, html, Markup.inlineKeyboard([[Markup.button.callback('✅ Выдать', 'adm:ok'), Markup.button.callback('✖️ Отмена', 'adm:menu')]]));
}

async function grant(ctx: Context) {
  const d = draft(ctx.from!.id);
  if (!d?.userId || !d.days || !d.kind) { await menu(ctx); return; }
  drafts.delete(ctx.from!.id);
  try {
    const r = await api.adminGrant(ctx.from!.id, d.userId, d.days, d.kind, d.message);
    const where = r.mode === 'direct'
      ? `Включена на ${r.devices.length > 1 ? 'устройствах' : 'устройстве'} <b>${r.devices.join(', ')}</b>.`
      : `Устройств нет — отправил код <code>${r.code}</code>.`;
    const note = r.delivered ? '📨 Получатель уведомлён в Telegram.' : '⚠️ Написать получателю не удалось (он не открывал бота). Передайте сами' + (r.code ? ` код <code>${r.code}</code>.` : '.');
    await show(ctx, `✅ <b>Готово</b> — ${dur(d.days)}, ${kindLabel(d.kind).toLowerCase()}, для <b>${esc(d.title ?? '')}</b>.\n${where}\n${note}`, Markup.inlineKeyboard([
      [Markup.button.callback('👤 Карточка', `adm:c:${d.userId}`), Markup.button.callback('🎁 Ещё', 'adm:grant')],
      back,
    ]));
  } catch (error) { await fail(ctx, error); }
}

async function stats(ctx: Context) {
  try {
    const s = await api.adminStats(ctx.from!.id);
    const servers = s.servers.map((n) => `${n.online ? '🟢' : '🔴'} ${esc(n.name)} · ${n.premiumOnly ? '💎' : '🎁'}${n.isActive ? '' : ' · выкл'}`).join('\n') || '—';
    await show(ctx, [
      '📊 <b>Статистика</b>',
      '',
      `👤 Telegram: <b>${s.telegramUsers}</b> · 📱 устройств: <b>${s.devices}</b>`,
      `🆕 за 24 ч: <b>${s.new24h}</b> · за 7 дней: <b>${s.new7d}</b>`,
      `💎 активных подписок: <b>${s.activeSubscriptions}</b> · 🎁 бесплатный тариф: <b>${s.activeTrials}</b>`,
      '',
      `💰 за 24 ч: <b>${usd(s.revenue.day)}</b> (${s.revenue.dayCount})`,
      `💰 за 30 дней: <b>${usd(s.revenue.month)}</b> (${s.revenue.monthCount})`,
      `💰 всего: <b>${usd(s.revenue.total)}</b> (${s.revenue.totalCount})`,
      `🛡 выдано админом: <b>${s.adminGrants}</b>`,
      '',
      servers,
    ].join('\n'), Markup.inlineKeyboard([[Markup.button.callback('🔄 Обновить', 'adm:stats')], back]));
  } catch (error) { await fail(ctx, error); }
}

async function issued(ctx: Context) {
  try {
    const rows = await api.adminIssued(ctx.from!.id);
    const state = { ISSUED: '⏳ код не активирован', REDEEMED: '✅ активирован', REVOKED: '⛔ отозван', APPLIED: '✅ включена сразу' } as const;
    const body = rows.length ? rows.map((r) => `${r.kind === 'gift' ? '🎁' : '🛡'} <b>${esc(r.to)}</b> · ${r.duration} · ${state[r.status]}${r.device ? ` (${r.device})` : ''}${r.code && r.status === 'ISSUED' ? `\n    <code>${r.code}</code>` : ''}\n    <i>${new Date(r.at).toLocaleDateString('ru-RU')}${r.message ? ` · «${esc(r.message.slice(0, 60))}»` : ''}</i>`).join('\n') : 'Пока ничего не выдавали.';
    await show(ctx, `📜 <b>Последние выдачи</b>\n\n${body}`, Markup.inlineKeyboard([back]));
  } catch (error) { await fail(ctx, error); }
}

/** All panel buttons: callback data «adm:…». */
export async function callback(ctx: Context) {
  const data = (ctx.callbackQuery as { data?: string } | undefined)?.data ?? '';
  await ctx.answerCbQuery().catch(() => undefined);
  const id = ctx.from!.id;
  const [, action, a, b] = data.split(':');
  switch (action) {
    case 'menu': return menu(ctx);
    case 'grant': save(id, { step: 'target', userId: undefined }); return show(ctx, `🎁 <b>Выдать подписку</b>\n\n${ASK_TARGET}`, Markup.inlineKeyboard([back]));
    case 'find': save(id, { step: 'find' }); return show(ctx, `🔎 <b>Найти пользователя</b>\n\n${ASK_TARGET}`, Markup.inlineKeyboard([back]));
    case 'c': return openCard(ctx, a!);
    case 'g': return chooseDuration(ctx, a!);
    case 'd':
      if (a === 'custom') { save(id, { step: 'days' }); return show(ctx, '✏️ Сколько дней? Пришлите число, например <b>45</b>.', Markup.inlineKeyboard([back])); }
      save(id, { days: Number(a) }); return chooseKind(ctx);
    case 'k': save(id, { kind: a === 'gift' ? 'gift' : 'admin' }); return askMessage(ctx);
    case 'm': save(id, { message: undefined }); return confirm(ctx);
    case 'ok': return grant(ctx);
    case 'rv': return show(ctx, '⛔ Забрать весь доступ у этого пользователя и его устройств? Неактивированные коды от админа тоже отзовутся.', Markup.inlineKeyboard([[Markup.button.callback('Да, забрать', `adm:rvy:${a}`), Markup.button.callback('Нет', `adm:c:${a}`)]]));
    case 'rvy':
      try { const r = await api.adminRevoke(id, a!); return show(ctx, `⛔ Готово: завершено подписок — ${r.subscriptions}, отозвано кодов — ${r.codes}.`, Markup.inlineKeyboard([[Markup.button.callback('👤 Карточка', `adm:c:${a}`)], back])); } catch (error) { return fail(ctx, error); }
    case 'bl':
      try { await api.adminBlock(id, b!, a === '1'); return openCard(ctx, b!); } catch (error) { return fail(ctx, error); }
    case 'stats': return stats(ctx);
    case 'issued': return issued(ctx);
    case 'nodes': return showNodes(ctx);
    default: return menu(ctx);
  }
}

/** Text while a panel step waits for input. Anything else goes on to the normal bot. */
export async function text(ctx: Context, next: () => Promise<void>) {
  const d = draft(ctx.from!.id);
  const message = ctx.message as { text?: string; forward_origin?: { type: string; sender_user?: { id: number } }; forward_from?: { id: number } } | undefined;
  const raw = message?.text?.trim() ?? '';
  if (!d?.step || raw.startsWith('/')) { if (d?.step) save(ctx.from!.id, { step: undefined }); return next(); }
  const forwarded = message?.forward_origin?.sender_user?.id ?? message?.forward_from?.id;
  if (message?.forward_origin && !forwarded && (d.step === 'target' || d.step === 'find')) {
    await ctx.reply('У этого человека скрыт профиль при пересылке. Пришлите его @username или Telegram ID.');
    return;
  }
  switch (d.step) {
    case 'target': {
      try {
        const c = await api.adminLookup(ctx.from!.id, forwarded ? String(forwarded) : raw);
        return chooseDuration(ctx, c.id);
      } catch (error) { return fail(ctx, error); }
    }
    case 'find': return openCard(ctx, forwarded ? String(forwarded) : raw);
    case 'days': {
      const days = Number(raw.replace(/\D/g, ''));
      if (!days || days < 1 || days > FOREVER) { await ctx.reply('Нужно число от 1 до 36500.'); return; }
      save(ctx.from!.id, { days, step: undefined });
      return chooseKind(ctx);
    }
    case 'message':
      save(ctx.from!.id, { message: raw.slice(0, 700) });
      return confirm(ctx);
  }
}
