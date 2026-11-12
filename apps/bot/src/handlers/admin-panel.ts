import { Markup, type Context } from 'telegraf';
import { api, ApiRejection, type AdminCard, type AnnouncePlatform, type AnnouncementDraft, type PeopleSegment } from '../services/api-client';
import { nodes as showNodes } from './admin';

/**
 * /admin — панель администратора прямо в боте.
 *
 *   🎁 Выдать подписку → кому (@username / Telegram ID / SL-XXXX-XXXX / пересланное сообщение)
 *                      → срок (1 день … бессрочно, или своё число дней)
 *                      → тип: 🛡 от администрации | 🎁 подарок
 *                      → сообщение получателю (необязательно) → подтверждение
 *   ⛔ Отозвать → список активных подписок и неиспользованных кодов, отзыв по одной (молча или с уведомлением) или всё сразу
 *   🔎 Найти пользователя → карточка: доступ, устройства, оплаты, коды; выдать / отозвать / блок
 *   👥 Пользователи → 💎 платные · 🛡 от админа · 🎁 пробные · ⌛ истёкшие (по 10, листание, тап — карточка)
 *   📣 Рассылка → 🆕 обновление (платформа, версия) или 📢 новость (заголовок) → ваш текст
 *                → предпросмотр (кому, показать ли в приложении) → отправка всем, кто в боте; статус доставки
 *   📊 Статистика · 📜 Выданные · 🖥 Серверы
 *
 * Доступ проверяет API (ADMIN_TELEGRAM_IDS) на каждом действии.
 */

const FOREVER = 36_500;
type Step = 'target' | 'find' | 'revoke' | 'days' | 'message' | 'diag' | 'code_days' | 'an_version' | 'an_title' | 'an_body';
interface Draft { step?: Step; userId?: string; title?: string; days?: number; kind?: 'admin' | 'gift'; message?: string; an?: Partial<AnnouncementDraft>; at: number }
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
    [Markup.button.callback('🩺 Почему не работает', 'adm:diag'), Markup.button.callback('⛔ Отозвать', 'adm:revoke')],
    [Markup.button.callback('👥 Пользователи', 'adm:pp:paid:0'), Markup.button.callback('📣 Рассылка', 'adm:an')],
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
    [Markup.button.callback('🎁 Выдать подписку', `adm:g:${c.id}`), Markup.button.callback('🩺 Почему не работает', `adm:dg:${c.id}`)],
    [Markup.button.callback('⛔ Отозвать', `adm:rl:${c.id}`), Markup.button.callback(c.isBlocked ? '✅ Разблокировать' : '🚫 Заблокировать', `adm:bl:${c.isBlocked ? 0 : 1}:${c.id}`)],
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
    save(ctx.from!.id, { kind: 'gift' });
    const where = `Подписка ляжет <b>на аккаунт</b> и сразу заработает на всех его устройствах (до 3). Клиенту ничего вводить не надо — ему придёт сообщение.`;
    await show(ctx, `🎁 Подписка для <b>${esc(c.title)}</b>\n${where}\n\nНа какой срок?`, Markup.inlineKeyboard([
      [1, 3, 7].map((d) => Markup.button.callback(dur(d), `adm:d:${d}`)),
      [30, 90, 180].map((d) => Markup.button.callback(dur(d), `adm:d:${d}`)),
      [Markup.button.callback('1 год', 'adm:d:365'), Markup.button.callback('♾ Бессрочно', `adm:d:${FOREVER}`)],
      [Markup.button.callback('✏️ Своё число дней', 'adm:d:custom')],
      back,
    ]));
  } catch (error) { await fail(ctx, error); }
}

function durationKeyboard(prefix: string) {
  return Markup.inlineKeyboard([
    [1, 3, 7].map((d) => Markup.button.callback(dur(d), `${prefix}:${d}`)),
    [30, 90, 180].map((d) => Markup.button.callback(dur(d), `${prefix}:${d}`)),
    [Markup.button.callback('1 год', `${prefix}:365`), Markup.button.callback('♾ Бессрочно', `${prefix}:${FOREVER}`)],
    [Markup.button.callback('✏️ Своё число дней', `${prefix}:custom`)],
    back,
  ]);
}

/** Ready-to-forward text for the client: the code and three steps. */
function forwardText(code: string, days: number) {
  return [
    `🎁 Вам подписка Sali VPN — ${dur(days)}.`,
    '',
    `Ваш код: <code>${code}</code>`,
    '',
    'Как включить:',
    '1. Скачайте приложение: salivpn.com/download (или в @SaliVpnNews)',
    '2. Откройте его и нажмите «Код» на главном экране',
    '3. Вставьте код → «Активировать» → «Подключить»',
  ].join('\n');
}

/** «🎟 Создать код»: a code with no recipient + the text to forward. */
async function makeCode(ctx: Context, days: number) {
  try {
    const r = await api.adminCode(ctx.from!.id, days);
    await show(ctx, `🎟 <b>Код готов</b> — ${r.plan}, ${dur(days)}\n\n<code>${r.code}</code>\n\nДействует для активации до ${new Date(r.expiresAt).toLocaleDateString('ru-RU')}. Ниже — готовый текст для клиента, просто перешлите его 👇`, Markup.inlineKeyboard([
      [Markup.button.callback('🎟 Ещё код', 'adm:code')],
      back,
    ]));
    await ctx.replyWithHTML(forwardText(r.code, days));
  } catch (error) { await fail(ctx, error); }
}

/** «🩺 Почему не работает»: what blocks this client, in plain words. */
async function diagnose(ctx: Context, userId: string) {
  try {
    const r = await api.adminDiagnose(ctx.from!.id, userId);
    await show(ctx, [
      `🩺 <b>${esc(r.title)}</b>`,
      '',
      ...(r.lines.length ? [...r.lines, ''] : []),
      '<b>Что мешает:</b>',
      ...r.problems,
    ].join('\n'), Markup.inlineKeyboard([
      [Markup.button.callback('🎁 Выдать подписку', `adm:g:${userId}`), Markup.button.callback('🔄 Ещё раз', `adm:dg:${userId}`)],
      [Markup.button.callback('👤 Карточка', `adm:c:${userId}`)],
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
    d.message ? `Сообщение: <i>${esc(d.message)}</i>` : null,
  ].filter((l) => l !== null).join('\n');
  await show(ctx, html, Markup.inlineKeyboard([
    [Markup.button.callback('✅ Выдать', 'adm:ok')],
    [Markup.button.callback(d.message ? '💬 Изменить сообщение' : '💬 Добавить сообщение', 'adm:msg'), Markup.button.callback('✖️ Отмена', 'adm:menu')],
  ]));
}

async function grant(ctx: Context) {
  const d = draft(ctx.from!.id);
  if (!d?.userId || !d.days || !d.kind) { await menu(ctx); return; }
  drafts.delete(ctx.from!.id);
  try {
    const r = await api.adminGrant(ctx.from!.id, d.userId, d.days, d.kind, d.message);
    const lines = [
      `✅ <b>Готово</b> — ${dur(d.days)} для <b>${esc(d.title ?? '')}</b>`,
      '',
      `💎 Действует: <b>${r.until ?? ''}</b>`,
      r.devices.length ? `📱 Работает на: <b>${r.devices.join(', ')}</b>` : '📱 Устройств на аккаунте пока нет — заработает сразу, как клиент войдёт в приложении через Telegram.',
      r.delivered ? '📨 Клиенту отправлено в Telegram.' : '⚠️ Написать клиенту в Telegram не удалось (он не запускал бота).',
    ].filter((l) => l !== null);
    await show(ctx, lines.join('\n'), Markup.inlineKeyboard([
      [Markup.button.callback('🩺 Проверить клиента', `adm:dg:${d.userId}`), Markup.button.callback('🎁 Ещё', 'adm:grant')],
      back,
    ]));
  } catch (error) { await fail(ctx, error); }
}

async function stats(ctx: Context) {
  try {
    const s = await api.adminStats(ctx.from!.id);
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const a = s.access;
    const r = s.revenue;
    const servers = s.servers.map((n) => `${n.online ? '🟢' : '🔴'} ${esc(n.name)} · ${n.premiumOnly ? '💎' : '🎁'}`
      + `${n.users !== undefined ? ` · 👤 ${n.users}` : ''}${n.connectedNow != null ? ` · сейчас ${n.connectedNow}` : ''}${n.isActive ? '' : ' · выкл'}`).join('\n') || '—';
    const methods = r.byMethod30d?.length ? r.byMethod30d.map((m) => `   ${esc(m.method)}: <b>${usd(m.sum)}</b> (${m.count})`).join('\n') : '   оплат пока не было';
    await show(ctx, [
      '📊 <b>Статистика Sali VPN</b>',
      '',
      '<b>👥 Аудитория</b>',
      `Telegram: <b>${s.telegramUsers}</b> · 📱 приложений: <b>${s.devices}</b>${s.linkedDevices !== undefined ? ` (привязано ${s.linkedDevices})` : ''}`,
      `🆕 новых: 24 ч <b>${s.new24h}</b> · 7 дн <b>${s.new7d}</b>${s.new30d !== undefined ? ` · 30 дн <b>${s.new30d}</b>` : ''}`,
      s.activeDevices7d !== undefined ? `📲 пользовались за 7 дней: <b>${s.activeDevices7d}</b> устройств` : null,
      '',
      '<b>🔐 Доступ сейчас</b>',
      a ? `💎 платные: <b>${a.paid}</b> · 🛡 от админа: <b>${a.granted}</b> · 🎁 пробные: <b>${a.trial}</b>` : `💎 подписок: <b>${s.activeSubscriptions}</b> · 🎁 пробных: <b>${s.activeTrials}</b>`,
      a?.onlineNow != null ? `🟢 подключены прямо сейчас: <b>${a.onlineNow}</b>` : null,
      a ? `⏳ платная заканчивается за 3 дня: <b>${a.expiringPaid3d}</b> · ⌛ закончилась за 30 дн: <b>${a.expired30d}</b>` : null,
      '',
      '<b>💰 Деньги</b>',
      `24 ч: <b>${usd(r.day)}</b> (${r.dayCount})${r.week !== undefined ? ` · 7 дн: <b>${usd(r.week)}</b> (${r.weekCount})` : ''}`,
      `30 дн: <b>${usd(r.month)}</b> (${r.monthCount})${r.avgCheck30d ? ` · средний чек ${usd(r.avgCheck30d)}` : ''}`,
      `всего: <b>${usd(r.total)}</b> (${r.totalCount})${r.refunds ? ` · возвратов: ${r.refunds}` : ''}`,
      r.byMethod30d ? `Способы оплаты за 30 дн:\n${methods}` : null,
      r.payers !== undefined ? `🧾 платили хоть раз: <b>${r.payers}</b> чел. · за 30 дн: <b>${r.payers30d}</b>` : null,
      '',
      s.conversion ? '<b>📈 Конверсия</b>' : null,
      s.conversion ? `взяли бесплатный тариф: <b>${pct(s.conversion.freeOfUsers)}</b> · стали платить: <b>${pct(s.conversion.payersOfUsers)}</b> от пользователей Telegram` : null,
      s.codes ? `🔑 бесплатные коды: выдано ${s.codes.freeIssued}, активировано ${s.codes.freeRedeemed}` : null,
      s.codes ? `🔑 платные коды за 30 дн: куплено ${s.codes.paid30d}, активировано ${s.codes.paidRedeemed30d}` : null,
      s.referrals ? `👥 приглашений: ${s.referrals.total}, с наградой: ${s.referrals.rewarded}` : null,
      `🛡 выдано админом: <b>${s.adminGrants}</b>`,
      '',
      '<b>🖥 Серверы</b> <i>(👤 закреплено пользователей)</i>',
      servers,
      '',
      `<i>Обновлено ${new Date().toLocaleTimeString('ru-RU', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit' })}</i>`,
    ].filter((line) => line !== null).join('\n'), Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Обновить', 'adm:stats'), Markup.button.callback('👥 Пользователи', 'adm:pp:paid:0')],
      back,
    ]));
  } catch (error) { await fail(ctx, error); }
}

const SEGMENTS: Record<PeopleSegment, { icon: string; title: string; empty: string }> = {
  paid: { icon: '💎', title: 'Платные', empty: 'Пока никто не платит.' },
  granted: { icon: '🛡', title: 'От админа', empty: 'Активных подписок от администрации нет.' },
  trial: { icon: '🎁', title: 'Пробные', empty: 'Сейчас никто не на бесплатном тарифе.' },
  expired: { icon: '⌛', title: 'Истёкшие', empty: 'За 30 дней ни у кого не закончился доступ.' },
};

/** «👥 Пользователи»: who uses the VPN — paid / from admin / trial / expired, 10 per page. */
async function people(ctx: Context, segment: PeopleSegment, page: number) {
  try {
    const r = await api.adminPeople(ctx.from!.id, segment, page);
    const c = r.counts;
    const seg = SEGMENTS[segment];
    const using = c.paid + c.granted + c.trial;
    const lines = [
      '👥 <b>Пользователи</b>',
      '',
      `С доступом сейчас: <b>${using}</b>${c.online !== null ? ` · 🟢 подключены прямо сейчас: <b>${c.online}</b>` : ''}`,
      `💎 платные: <b>${c.paid}</b> · 🛡 от админа: <b>${c.granted}</b> · 🎁 пробные: <b>${c.trial}</b>`,
      `⌛ закончился доступ за 30 дней: <b>${c.expired}</b>`,
      '',
      `${seg.icon} <b>${seg.title}</b>${r.pages > 1 ? ` · стр. ${r.page + 1}/${r.pages}` : ''}`,
    ];
    if (!r.list.length) lines.push(seg.empty);
    r.list.forEach((p, i) => {
      const n = r.page * 10 + i + 1;
      const who = `${esc(p.name)}${p.username && !p.name.startsWith('@') ? ` @${esc(p.username)}` : ''}`;
      const deviceOnly = p.device && p.name.includes(p.device);
      lines.push(`${n}. ${p.blocked ? '🚫 ' : ''}${deviceOnly ? `📱 <code>${p.device}</code> <i>(без Telegram)</i>` : `<b>${who}</b>${p.device ? ` · <code>${p.device}</code>` : ''}`}`);
      const until = p.until === 'бессрочно' ? '♾ бессрочно' : `${segment === 'expired' ? 'закончилась' : 'до'} ${p.until}`;
      lines.push(`    ${esc(p.plan)} · ${until}${p.via ? ` · ${esc(p.via)}` : ''}`);
    });
    const tabs = (Object.keys(SEGMENTS) as PeopleSegment[]).map((s) => {
      const count = { paid: c.paid, granted: c.granted, trial: c.trial, expired: c.expired }[s];
      return Markup.button.callback(`${s === segment ? '• ' : ''}${SEGMENTS[s].icon} ${count}`, `adm:pp:${s}:0`);
    });
    const open = r.list.map((p, i) => Markup.button.callback(`${r.page * 10 + i + 1}`, `adm:c:${p.userId}`));
    const pager = [
      ...(r.page > 0 ? [Markup.button.callback('◀️', `adm:pp:${segment}:${r.page - 1}`)] : []),
      Markup.button.callback('🔄', `adm:pp:${segment}:${r.page}`),
      ...(r.page + 1 < r.pages ? [Markup.button.callback('▶️', `adm:pp:${segment}:${r.page + 1}`)] : []),
    ];
    if (r.list.length) lines.push('', '<i>Нажмите номер — откроется карточка.</i>');
    await show(ctx, lines.join('\n'), Markup.inlineKeyboard([tabs, ...(open.length ? [open.slice(0, 5), open.slice(5)].filter((row) => row.length) : []), pager, back]));
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

/** Active subscriptions and unused codes, each with its own «отозвать» button. */
async function revokeList(ctx: Context, userId: string) {
  try {
    const r = await api.adminRevocable(ctx.from!.id, userId);
    drafts.delete(ctx.from!.id);
    const rows: ReturnType<typeof Markup.button.callback>[][] = [];
    const lines = [`⛔ <b>Отзыв — ${esc(r.title)}</b>`, ''];
    if (r.subscriptions.length) {
      lines.push('<b>Активные подписки:</b>');
      r.subscriptions.forEach((s, i) => {
        lines.push(`${i + 1}. ${esc(s.plan)} · ${s.until} · ${esc(s.where)}`);
        rows.push([Markup.button.callback(`⛔ Подписка ${i + 1} (${s.where})`, `adm:rs:${s.id}`)]);
      });
    }
    if (r.codes.length) {
      lines.push('', '<b>Неактивированные коды:</b>');
      r.codes.forEach((c, i) => {
        lines.push(`К${i + 1}. <code>${c.code}</code> · ${esc(c.what)}`);
        rows.push([Markup.button.callback(`⛔ Код К${i + 1}`, `adm:rc:${c.id}`)]);
      });
    }
    if (!r.subscriptions.length && !r.codes.length) lines.push('Нечего отзывать: активных подписок и неиспользованных кодов нет.');
    else if (r.subscriptions.length + r.codes.length > 1) rows.push([Markup.button.callback('⛔ Отозвать всё', `adm:rv:${userId}`)]);
    rows.push([Markup.button.callback('👤 Карточка', `adm:c:${userId}`)], back);
    await show(ctx, lines.join('\n'), Markup.inlineKeyboard(rows));
  } catch (error) { await fail(ctx, error); }
}

// ---------------------------------------------------------------------------
// 📣 Рассылка: update notes and news to everyone in the bot, also shown in the apps.
// ---------------------------------------------------------------------------

const PLATFORMS: Record<AnnouncePlatform, string> = { android: '📱 Android', windows: '💻 Windows', all: '📱💻 Android и Windows' };
const an = (id: number) => draft(id)?.an ?? {};
const setAn = (id: number, patch: Partial<AnnouncementDraft>, step?: Step) => save(id, { an: { ...an(id), ...patch }, step });

async function announceStart(ctx: Context) {
  save(ctx.from!.id, { an: { showInApp: true }, step: undefined });
  await show(ctx, [
    '📣 <b>Рассылка</b>',
    '',
    'Сообщение получат все, кто запускал бота и не отключал уведомления. Его же увидят в приложении на главном экране.',
    '',
    'Что отправляем?',
  ].join('\n'), Markup.inlineKeyboard([
    [Markup.button.callback('🆕 Обновление приложения', 'adm:an:k:UPDATE')],
    [Markup.button.callback('📢 Новость', 'adm:an:k:NEWS')],
    [Markup.button.callback('📜 Прошлые рассылки', 'adm:an:h')],
    back,
  ]));
}

async function askPlatform(ctx: Context) {
  await show(ctx, '🆕 <b>Обновление</b>\n\nДля какой платформы?', Markup.inlineKeyboard([
    [Markup.button.callback(PLATFORMS.android, 'adm:an:p:android'), Markup.button.callback(PLATFORMS.windows, 'adm:an:p:windows')],
    [Markup.button.callback(PLATFORMS.all, 'adm:an:p:all')],
    back,
  ]));
}

async function askVersion(ctx: Context) {
  setAn(ctx.from!.id, {}, 'an_version');
  await show(ctx, '🔢 Номер версии? Например <b>0.5.4</b>.\nПриложение сравнит его со своей версией и предложит обновиться.', Markup.inlineKeyboard([
    [Markup.button.callback('Без номера', 'adm:an:v:skip')],
    back,
  ]));
}

async function askBody(ctx: Context) {
  setAn(ctx.from!.id, {}, 'an_body');
  const update = an(ctx.from!.id).kind === 'UPDATE';
  await show(ctx, update
    ? '✍️ Напишите, что нового, — своими словами. Например:\n\n<i>• VPN работает в фоне\n• В шторке видно сервер и время\n• Исправили смену сервера</i>\n\nСсылки на скачивание бот добавит сам.'
    : '✍️ Напишите текст новости.', Markup.inlineKeyboard([back]));
}

async function announcePreview(ctx: Context) {
  const d = an(ctx.from!.id);
  if (!d.kind || !d.body) return announceStart(ctx);
  try {
    const p = await api.announcePreview(ctx.from!.id, d as AnnouncementDraft);
    save(ctx.from!.id, { step: undefined });
    await show(ctx, [
      '👀 <b>Так увидят пользователи:</b>',
      '━━━━━━━━━━━━',
      p.html,
      '━━━━━━━━━━━━',
      d.kind === 'UPDATE' ? '<i>+ кнопки «Скачать», «Наш канал», «Сайт»</i>' : '<i>+ кнопки «Наш канал», «Сайт»</i>',
      '',
      `📨 Получат в Telegram: <b>${p.recipients}</b> чел.`,
      `📱 В приложении: <b>${d.showInApp ? 'показать' : 'не показывать'}</b>`,
    ].join('\n'), Markup.inlineKeyboard([
      [Markup.button.callback(`✅ Отправить ${p.recipients}`, 'adm:an:go')],
      [Markup.button.callback(d.showInApp ? '📱 Не показывать в приложении' : '📱 Показать в приложении', `adm:an:app:${d.showInApp ? 0 : 1}`)],
      [Markup.button.callback('✏️ Изменить текст', 'adm:an:edit'), Markup.button.callback('✖️ Отмена', 'adm:menu')],
    ]));
  } catch (error) { await fail(ctx, error); }
}

async function announceSend(ctx: Context) {
  const d = an(ctx.from!.id);
  if (!d.kind || !d.body) return announceStart(ctx);
  drafts.delete(ctx.from!.id);
  try {
    const r = await api.announcePublish(ctx.from!.id, d as AnnouncementDraft);
    await show(ctx, `🚀 <b>Рассылка запущена</b> — ${r.recipients} чел.\nTelegram разрешает ~25 сообщений в секунду, так что на всех уйдёт около ${Math.max(1, Math.ceil(r.recipients / 20 / 60))} мин.${d.showInApp ? '\n📱 В приложении уже видно.' : ''}`, Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Статус доставки', `adm:an:st:${r.id}`)],
      back,
    ]));
  } catch (error) { await fail(ctx, error); }
}

async function announceStatus(ctx: Context, id: string) {
  try {
    const s = await api.announceStatus(ctx.from!.id, id);
    const done = s.delivered + s.failed;
    await show(ctx, [
      s.finishedAt ? '✅ <b>Рассылка завершена</b>' : '⏳ <b>Рассылка идёт</b>',
      '',
      `Доставлено: <b>${s.delivered}</b> из ${s.recipients}`,
      s.failed ? `Не дошло: <b>${s.failed}</b> <i>(заблокировали бота или удалили аккаунт)</i>` : null,
      s.finishedAt ? null : `Обработано: ${done}/${s.recipients}`,
    ].filter((l) => l !== null).join('\n'), Markup.inlineKeyboard([
      ...(s.finishedAt ? [] : [[Markup.button.callback('🔄 Обновить', `adm:an:st:${id}`)]]),
      [Markup.button.callback('📜 Прошлые рассылки', 'adm:an:h')],
      back,
    ]));
  } catch (error) { await fail(ctx, error); }
}

async function announceHistory(ctx: Context) {
  try {
    const rows = await api.announceHistory(ctx.from!.id);
    const lines = ['📜 <b>Прошлые рассылки</b>', ''];
    if (!rows.length) lines.push('Пока ничего не отправляли.');
    rows.forEach((r, i) => {
      const what = r.kind === 'UPDATE' ? `🆕 Обновление${r.version ? ` ${esc(r.version)}` : ''}` : `📢 ${esc(r.title ?? 'Новость')}`;
      lines.push(`${i + 1}. ${what} · ${new Date(r.createdAt).toLocaleDateString('ru-RU')}`);
      lines.push(`    📨 ${r.delivered}/${r.recipients}${r.finished ? '' : ' ⏳'} · 📱 ${r.showInApp ? 'в приложении' : 'скрыто'}`);
    });
    const hide = rows.filter((r) => r.showInApp).slice(0, 6).map((r) => Markup.button.callback(`📱✖️ ${rows.indexOf(r) + 1}`, `adm:an:hide:${r.id}`));
    if (hide.length) lines.push('', '<i>📱✖️ N — убрать из приложения (в Telegram сообщения останутся).</i>');
    await show(ctx, lines.join('\n'), Markup.inlineKeyboard([
      ...(hide.length ? [hide] : []),
      [Markup.button.callback('📣 Новая рассылка', 'adm:an')],
      back,
    ]));
  } catch (error) { await fail(ctx, error); }
}

async function announceCallback(ctx: Context, a?: string, b?: string) {
  const id = ctx.from!.id;
  switch (a) {
    case 'k':
      if (b === 'UPDATE') { setAn(id, { kind: 'UPDATE' }); return askPlatform(ctx); }
      setAn(id, { kind: 'NEWS', platform: undefined, version: undefined }, 'an_title');
      return show(ctx, '📢 <b>Новость</b>\n\nЗаголовок? Например: <i>Новая страна — Финляндия</i>', Markup.inlineKeyboard([back]));
    case 'p': setAn(id, { platform: (['android', 'windows', 'all'].includes(b!) ? b : 'all') as AnnouncePlatform }); return askVersion(ctx);
    case 'v': setAn(id, { version: undefined }); return askBody(ctx);
    case 'app': setAn(id, { showInApp: b === '1' }); return announcePreview(ctx);
    case 'edit': return askBody(ctx);
    case 'go': return announceSend(ctx);
    case 'st': return announceStatus(ctx, b!);
    case 'h': return announceHistory(ctx);
    case 'hide':
      try { await api.announceHide(id, b!); return announceHistory(ctx); } catch (error) { return fail(ctx, error); }
    default: return announceStart(ctx);
  }
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
      save(id, { days: Number(a), kind: draft(id)?.kind ?? 'gift' }); return confirm(ctx);
    case 'msg': return askMessage(ctx);
    case 'm': save(id, { message: undefined }); return confirm(ctx);
    case 'code': save(id, { step: undefined }); return show(ctx, '🎟 <b>Код без получателя</b>\n\nСоздам код — перешлёте его кому угодно. Человек вставит его в приложении и подписка включится.\n\nНа какой срок?', durationKeyboard('adm:cd'));
    case 'cd':
      if (a === 'custom') { save(id, { step: 'code_days' }); return show(ctx, '✏️ Сколько дней? Пришлите число, например <b>45</b>.', Markup.inlineKeyboard([back])); }
      return makeCode(ctx, Number(a));
    case 'diag': save(id, { step: 'diag' }); return show(ctx, `🩺 <b>Почему у клиента не работает VPN</b>\n\n${ASK_TARGET}`, Markup.inlineKeyboard([back]));
    case 'dg': return diagnose(ctx, a!);
    case 'ok': return grant(ctx);
    case 'revoke': save(id, { step: 'revoke' }); return show(ctx, `⛔ <b>Отозвать подписку</b>\n\n${ASK_TARGET}`, Markup.inlineKeyboard([back]));
    case 'rl': return revokeList(ctx, a!);
    case 'rs': return show(ctx, '⛔ Отозвать эту подписку? Доступ на устройстве закончится сразу.', Markup.inlineKeyboard([
      [Markup.button.callback('Да, молча', `adm:rsy:${a}:0`), Markup.button.callback('Да и уведомить', `adm:rsy:${a}:1`)],
      [Markup.button.callback('Нет', 'adm:menu')],
    ]));
    case 'rsy':
      try { const r = await api.adminRevokeSub(id, a!, b === '1'); return show(ctx, `⛔ Подписка отозвана${b === '1' ? ', пользователь уведомлён' : ''}.`, Markup.inlineKeyboard([[Markup.button.callback('↩️ К списку', `adm:rl:${r.userId}`)], back])); } catch (error) { return fail(ctx, error); }
    case 'rc':
      try { const r = await api.adminRevokeCode(id, a!); return revokeList(ctx, r.userId); } catch (error) { return fail(ctx, error); }
    case 'rv': return show(ctx, '⛔ Забрать весь доступ у этого пользователя и его устройств? Неактивированные коды от админа тоже отзовутся.', Markup.inlineKeyboard([[Markup.button.callback('Да, забрать', `adm:rvy:${a}`), Markup.button.callback('Нет', `adm:c:${a}`)]]));
    case 'rvy':
      try { const r = await api.adminRevoke(id, a!); return show(ctx, `⛔ Готово: завершено подписок — ${r.subscriptions}, отозвано кодов — ${r.codes}.`, Markup.inlineKeyboard([[Markup.button.callback('👤 Карточка', `adm:c:${a}`)], back])); } catch (error) { return fail(ctx, error); }
    case 'bl':
      try { await api.adminBlock(id, b!, a === '1'); return openCard(ctx, b!); } catch (error) { return fail(ctx, error); }
    case 'pp': return people(ctx, (['paid', 'granted', 'trial', 'expired'].includes(a!) ? a : 'paid') as PeopleSegment, Math.max(0, Number(b) || 0));
    case 'an': return announceCallback(ctx, a, b);
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
  if (message?.forward_origin && !forwarded && (d.step === 'target' || d.step === 'find' || d.step === 'revoke')) {
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
    case 'diag': {
      try {
        const c = await api.adminLookup(ctx.from!.id, forwarded ? String(forwarded) : raw);
        return diagnose(ctx, c.id);
      } catch (error) { return fail(ctx, error); }
    }
    case 'code_days': {
      const days = Number(raw.replace(/\D/g, ''));
      if (!days || days < 1 || days > FOREVER) { await ctx.reply('Нужно число от 1 до 36500.'); return; }
      save(ctx.from!.id, { step: undefined });
      return makeCode(ctx, days);
    }
    case 'revoke': {
      try {
        const c = await api.adminLookup(ctx.from!.id, forwarded ? String(forwarded) : raw);
        return revokeList(ctx, c.id);
      } catch (error) { return fail(ctx, error); }
    }
    case 'days': {
      const days = Number(raw.replace(/\D/g, ''));
      if (!days || days < 1 || days > FOREVER) { await ctx.reply('Нужно число от 1 до 36500.'); return; }
      save(ctx.from!.id, { days, step: undefined, kind: draft(ctx.from!.id)?.kind ?? 'gift' });
      return confirm(ctx);
    }
    case 'message':
      save(ctx.from!.id, { message: raw.slice(0, 700) });
      return confirm(ctx);
    case 'an_version': {
      const version = raw.replace(/^v/i, '').slice(0, 20);
      if (!/^\d+(\.\d+){0,3}$/.test(version)) { await ctx.reply('Версия — цифры через точку, например 0.5.4. Или нажмите «Без номера».'); return; }
      setAn(ctx.from!.id, { version });
      return askBody(ctx);
    }
    case 'an_title':
      setAn(ctx.from!.id, { title: raw.slice(0, 80) });
      return askBody(ctx);
    case 'an_body':
      if (raw.length > 3500) { await ctx.reply(`Слишком длинно: ${raw.length} символов, максимум 3500.`); return; }
      setAn(ctx.from!.id, { body: raw }, undefined);
      return announcePreview(ctx);
  }
}
