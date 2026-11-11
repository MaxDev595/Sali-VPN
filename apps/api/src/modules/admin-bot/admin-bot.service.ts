import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActivationCodeKind, ActivationCodeStatus, PaymentStatus, Prisma, SubscriptionStatus, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NodesService } from '../vpn/nodes/nodes.service';
import { VpnService } from '../vpn/vpn.service';
import { CodesService } from '../codes/codes.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { formatCode, formatPublicId, normalizePublicId } from '../codes/code-format';

/** 100 years: shown everywhere as «бессрочно». */
export const FOREVER_DAYS = 36_500;
const PLANS = {
  admin: { code: 'admin_grant', name: 'Sali Pro · от администрации' },
  gift: { code: 'admin_gift', name: 'Sali Pro · подарок' },
} as const;
const NOTE_PREFIX = 'admin:';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const date = (d: Date) => d.toLocaleDateString('ru-RU', { timeZone: 'UTC' });
export const durationText = (days: number) => {
  if (days >= FOREVER_DAYS) return 'бессрочно';
  const n = days % 100, m = days % 10;
  const word = n >= 11 && n <= 14 ? 'дней' : m === 1 ? 'день' : m >= 2 && m <= 4 ? 'дня' : 'дней';
  return `${days} ${word}`;
};

type Kind = keyof typeof PLANS;
export type PeopleSegment = 'paid' | 'granted' | 'trial' | 'expired';

/** Bot admin panel (/admin): look up anyone, grant or revoke access, stats. */
@Injectable()
export class AdminBotService {
  private readonly logger = new Logger(AdminBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nodes: NodesService,
    private readonly vpn: VpnService,
    private readonly codes: CodesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  private guard(telegramId: number) {
    if (!this.nodes.isAdmin(telegramId)) throw new ForbiddenException('Только для администратора');
  }

  private async plan(kind: Kind) {
    const p = PLANS[kind];
    return this.prisma.plan.upsert({
      where: { code: p.code },
      update: { name: p.name, isActive: false },
      create: { code: p.code, name: p.name, durationDays: 30, priceUsd: 0, maxDevices: 3, isActive: false },
    });
  }

  /** @username, Telegram ID, SL-XXXX-XXXX or an internal user id. */
  private async find(query: string): Promise<User> {
    const q = query.trim();
    let user: User | null = null;
    if (/^[0-9a-f-]{36}$/i.test(q)) user = await this.prisma.user.findUnique({ where: { id: q } });
    else if (/^\d{5,15}$/.test(q)) user = await this.prisma.user.findUnique({ where: { telegramId: BigInt(q) } });
    else if (/^sl[-\s]?/i.test(q) || /^[0-9a-z]{4}-[0-9a-z]{4}$/i.test(q)) user = await this.prisma.user.findUnique({ where: { publicId: normalizePublicId(q) } });
    else {
      const name = q.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
      user = await this.prisma.user.findFirst({ where: { username: { equals: name, mode: 'insensitive' }, telegramId: { not: null } } });
    }
    if (!user) throw new NotFoundException('Не нашёл. Пришлите @username, Telegram ID или номер устройства SL-XXXX-XXXX. Человек должен хотя бы раз открыть бота или приложение.');
    return user;
  }

  private async access(userId: string) {
    const [sub, trial] = await Promise.all([this.subscriptions.getActiveForUser(userId), this.prisma.trial.findUnique({ where: { userId } })]);
    if (sub) {
      const left = sub.expiresAt ? Math.round((sub.expiresAt.getTime() - Date.now()) / 86_400_000) : FOREVER_DAYS;
      return { label: `${sub.plan.name} · ${left >= FOREVER_DAYS - 400 ? 'бессрочно' : `до ${date(sub.expiresAt!)}`}`, active: true };
    }
    if (trial?.status === 'ACTIVE' && trial.expiresAt > new Date()) return { label: `бесплатный тариф до ${date(trial.expiresAt)}`, active: true };
    return { label: 'нет доступа', active: false };
  }

  private title(u: User) {
    if (u.telegramId) return [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.username ? `@${u.username}` : `ID ${u.telegramId}`);
    return `Устройство ${formatPublicId(u.publicId)}`;
  }

  /** Card for the panel. */
  async lookup(adminId: number, query: string) {
    this.guard(adminId);
    const user = await this.find(query);
    const tg = user.telegramId ?? user.linkedTelegramId;
    const devices = user.telegramId
      ? await this.prisma.user.findMany({ where: { linkedTelegramId: user.telegramId, telegramId: null }, orderBy: { linkedAt: 'desc' }, take: 10 })
      : [];
    const owner = !user.telegramId && user.linkedTelegramId ? await this.prisma.user.findUnique({ where: { telegramId: user.linkedTelegramId } }) : null;
    const [access, deviceAccess, paid, codes, invited] = await Promise.all([
      this.access(user.id),
      Promise.all(devices.map(async (d) => ({ id: d.id, publicId: formatPublicId(d.publicId), access: (await this.access(d.id)).label }))),
      this.prisma.payment.aggregate({ where: { userId: user.id, status: PaymentStatus.SUCCEEDED }, _sum: { amountUsd: true }, _count: true }),
      this.prisma.activationCode.groupBy({ by: ['status'], where: { ownerId: user.id }, _count: true }),
      this.prisma.referral.count({ where: { referrerId: user.id } }).catch(() => 0),
    ]);
    return {
      id: user.id,
      kind: user.telegramId ? 'telegram' : 'device',
      title: this.title(user),
      username: user.username,
      telegramId: tg?.toString() ?? null,
      publicId: formatPublicId(user.publicId),
      owner: owner ? this.title(owner) : null,
      createdAt: user.createdAt.toISOString(),
      isBlocked: user.isBlocked,
      access: access.label,
      devices: deviceAccess,
      paidUsd: Number(paid._sum.amountUsd ?? 0),
      payments: paid._count,
      codesIssued: codes.reduce((n, c) => n + c._count, 0),
      codesRedeemed: codes.find((c) => c.status === ActivationCodeStatus.REDEEMED)?._count ?? 0,
      invited,
    };
  }

  /**
   * Grants access. A device gets it right away; a Telegram account gets it on
   * every app linked to it, or — if nothing is linked yet — a code in the chat.
   */
  /**
   * «Выдать подписку» — always a code, so it never lands somewhere the client can't see:
   * - the client gets it in Telegram with «⚡ Активировать» buttons for their linked devices
   *   (or types it in the app: «Ввести код»);
   * - a device picked by Sali ID gets it activated right away (that is the app they have open);
   * - the admin always sees the code too, to forward it by hand.
   */
  async grant(adminId: number, userId: string, days: number, kind: Kind, message?: string) {
    this.guard(adminId);
    if (!Number.isInteger(days) || days < 1 || days > FOREVER_DAYS) throw new BadRequestException('Срок: от 1 дня до бессрочного');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    const plan = await this.plan(kind);
    const note = `${NOTE_PREFIX}${kind}:${adminId}${message ? `:${message.slice(0, 300)}` : ''}`;
    const text = message?.trim() ? `\n\n💬 <i>${esc(message.trim().slice(0, 700))}</i>` : '';
    const head = kind === 'gift'
      ? `🎁 <b>Вам подарок!</b>\n\nВам подарили подписку <b>${plan.name}</b> — ${durationText(days)}.${text}`
      : `🛡 <b>Подписка от администрации Sali VPN</b>\n\nВам выдана подписка <b>${plan.name}</b> — ${durationText(days)}.${text}`;

    const isDevice = Boolean(user.appDeviceKey);
    const tg = user.telegramId ?? user.linkedTelegramId;
    const owner = user.telegramId ? user : tg ? (await this.prisma.user.findUnique({ where: { telegramId: tg } })) ?? user : user;
    const code = await this.codes.issueAdmin(owner.id, plan.id, days, note);

    // Picked by Sali ID: switch it on right there — nothing for the client to do.
    let activatedOn: string | null = null;
    let activationError: string | null = null;
    if (isDevice) {
      try {
        await this.codes.redeem(user.id, code.code);
        activatedOn = formatPublicId(user.publicId);
      } catch (error) { activationError = (error as Error).message; }
    }

    const devices = tg ? await this.prisma.user.findMany({ where: { linkedTelegramId: tg, appDeviceKey: { not: null } }, orderBy: { linkedAt: 'desc' }, take: 4 }) : [];
    const how = activatedOn
      ? `✅ Уже включена в приложении на устройстве <b>${activatedOn}</b>. Откройте Sali VPN и нажмите «Подключить».`
      : [
          `🔑 Ваш код: <code>${code.display}</code> <i>(нажмите, чтобы скопировать)</i>`,
          '',
          'Как включить:',
          '1. Откройте приложение Sali VPN',
          '2. Нажмите «Код» на главном экране',
          '3. Вставьте код и нажмите «Активировать»',
          devices.length ? '\nИли просто нажмите кнопку ниже 👇' : '',
        ].join('\n');
    const keyboard = activatedOn ? undefined : {
      inline_keyboard: [
        ...devices.map((d) => [{ text: `⚡ Активировать на ${formatPublicId(d.publicId)}`, callback_data: `at_${code.code}_${formatPublicId(d.publicId)}` }]),
        [{ text: '📲 Скачать приложение', callback_data: 'menu_download' }],
      ],
    };
    const delivered = await this.notifications.sendHtml(owner.id, `${head}\n\n${how}`, keyboard).catch(() => false);
    void this.nodes.notifyAdmins(`Админ ${adminId} выдал подписку «${plan.name}» (${durationText(days)}) → ${this.title(user)}: код ${code.display}${activatedOn ? `, активирован на ${activatedOn}` : ''}.`);
    return { mode: activatedOn ? 'direct' as const : 'code' as const, code: code.display, delivered, devices: activatedOn ? [activatedOn] : [], activationError };
  }

  /** «🎟 Создать код»: a gift code with no recipient — the admin sends it to anyone. */
  async createCode(adminId: number, days: number) {
    this.guard(adminId);
    if (!Number.isInteger(days) || days < 1 || days > FOREVER_DAYS) throw new BadRequestException('Срок: от 1 дня до бессрочного');
    const admin = await this.prisma.user.findUnique({ where: { telegramId: BigInt(adminId) } });
    if (!admin) throw new NotFoundException('Сначала нажмите /start в боте');
    const plan = await this.plan('gift');
    const code = await this.codes.issueAdmin(admin.id, plan.id, days, `${NOTE_PREFIX}gift:${adminId}:код без получателя`);
    return { code: code.display, plan: plan.name, days, expiresAt: code.expiresAt };
  }

  /**
   * «🩺 Почему не работает»: everything that decides whether this person can connect,
   * in plain words, per installation — no guessing.
   */
  async diagnose(adminId: number, userId: string) {
    this.guard(adminId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const tg = user.telegramId ?? user.linkedTelegramId;
    const installs = user.appDeviceKey && !tg ? [user]
      : tg ? await this.prisma.user.findMany({ where: { linkedTelegramId: tg, appDeviceKey: { not: null } }, orderBy: { linkedAt: 'desc' } }) : [];
    if (user.appDeviceKey && !installs.some((i) => i.id === user.id)) installs.unshift(user);
    const now = new Date();
    const problems: string[] = [];
    const lines: string[] = [];
    if (user.isBlocked) problems.push('🚫 Аккаунт заблокирован — разблокируйте в карточке.');
    if (!installs.length) problems.push('📱 Ни одно приложение не привязано к этому Telegram. Клиент должен открыть приложение → «Привязать Telegram», или пришлите ему код — он введёт его в приложении.');

    for (const app of installs) {
      const [sub, trial, account, device] = await Promise.all([
        this.subscriptions.getActiveForUser(app.id),
        this.prisma.trial.findUnique({ where: { userId: app.id } }),
        this.prisma.vpnAccount.findUnique({ where: { userId: app.id }, include: { server: true } }),
        this.prisma.device.findFirst({ where: { userId: app.id }, orderBy: { lastActiveAt: { sort: 'desc', nulls: 'last' } } }),
      ]);
      const id = formatPublicId(app.publicId);
      const trialLeft = trial && trial.status === 'ACTIVE' && trial.expiresAt > now ? Math.floor((trial.expiresAt.getTime() - now.getTime()) / 3_600_000) : 0;
      const access = sub ? `💎 ${sub.plan.name} ${!sub.expiresAt || sub.expiresAt.getTime() - Date.now() > (FOREVER_DAYS - 400) * 86_400_000 ? 'бессрочно' : `до ${date(sub.expiresAt)}`}` : trialLeft ? `🎁 бесплатно, осталось ~${trialLeft} ч` : '❌ нет тарифа';
      const server = account ? `${account.server.countryCode} ${account.server.name}${!account.server.isActive ? ' (выключен)' : !account.server.online ? ' (не отвечает)' : ''}` : 'ещё не подключался';
      const used = device?.lastActiveAt ? `VPN был ${date(device.lastActiveAt)}` : 'VPN ещё ни разу не включал';
      lines.push(`${device?.platform === 'WINDOWS' ? '💻' : '📱'} <b>${id}</b> · ${access}\n    сервер: ${server} · ${used}`);
      if (!sub && !trialLeft) problems.push(`❌ На <b>${id}</b> нет тарифа — VPN не включится. Выдайте подписку на <code>${id}</code> (включится сразу) или пришлите код.`);
      if (account && !account.server.isActive) problems.push(`🛑 Сервер ${account.server.name} выключен в админке — клиенту надо выбрать другую страну.`);
      else if (account && !account.server.online) problems.push(`🔌 Сервер ${account.server.name} не отвечает — проверьте «🖥 Серверы» или пусть клиент выберет другую страну.`);
      if (account && account.status !== 'ACTIVE' && (sub || trialLeft)) problems.push(`⚠️ На <b>${id}</b> VPN-ключ в статусе ${account.status} — исправится сам при следующем «Подключить».`);
    }

    const codes = await this.prisma.activationCode.findMany({
      where: { ownerId: { in: [user.id, ...(tg ? (await this.prisma.user.findMany({ where: { telegramId: tg }, select: { id: true } })).map((u) => u.id) : [])] }, status: ActivationCodeStatus.ISSUED, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' }, take: 3,
    });
    for (const c of codes) problems.push(`🔑 Код <code>${formatCode(c.code)}</code> выдан, но не введён. Попросите клиента вставить его в приложении («Код» на главном экране).`);

    if (!problems.length) problems.push('✅ С нашей стороны всё в порядке: тариф есть, сервер работает.\nЕсли не подключается — пусть клиент: 1) обновит приложение до последней версии, 2) выберет другую страну, 3) выключит другие VPN/«Частный DNS» в настройках Android.');
    return { title: this.title(user), lines, problems };
  }

  /** Takes access away: ends subscriptions on the account and its linked apps, revokes unused admin codes. */
  async revoke(adminId: number, userId: string) {
    this.guard(adminId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ids = [user.id, ...(user.telegramId ? (await this.prisma.user.findMany({ where: { linkedTelegramId: user.telegramId }, select: { id: true } })).map((u) => u.id) : [])];
    const now = new Date();
    const subs = await this.prisma.subscription.updateMany({ where: { userId: { in: ids }, status: SubscriptionStatus.ACTIVE }, data: { status: SubscriptionStatus.EXPIRED, expiresAt: now, autoRenew: false } });
    const codes = await this.prisma.activationCode.updateMany({ where: { ownerId: user.id, status: ActivationCodeStatus.ISSUED, note: { startsWith: NOTE_PREFIX } }, data: { status: ActivationCodeStatus.REVOKED } });
    for (const id of ids) await this.vpn.disable(id).catch(() => undefined);
    return { subscriptions: subs.count, codes: codes.count };
  }

  /** Everything that can be taken back: active subscriptions (account + linked apps) and unused codes. */
  async revocable(adminId: number, userId: string) {
    this.guard(adminId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const linked = user.telegramId ? await this.prisma.user.findMany({ where: { linkedTelegramId: user.telegramId, telegramId: null } }) : [];
    const owners = new Map([user, ...linked].map((u) => [u.id, u]));
    const now = new Date();
    const [subs, codes] = await Promise.all([
      this.prisma.subscription.findMany({ where: { userId: { in: [...owners.keys()] }, status: SubscriptionStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, include: { plan: true }, orderBy: { expiresAt: 'desc' } }),
      this.prisma.activationCode.findMany({ where: { ownerId: user.id, status: ActivationCodeStatus.ISSUED, expiresAt: { gt: now } }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    const until = (d: Date | null) => (!d || d.getTime() - Date.now() > (FOREVER_DAYS - 400) * 86_400_000 ? 'бессрочно' : `до ${date(d)}`);
    return {
      title: this.title(user),
      subscriptions: subs.map((s) => {
        const owner = owners.get(s.userId)!;
        return { id: s.id, where: owner.telegramId ? 'Telegram-аккаунт' : formatPublicId(owner.publicId), plan: s.plan.name, until: until(s.expiresAt) };
      }),
      codes: codes.map((c) => ({ id: c.id, code: formatCode(c.code), what: c.kind === ActivationCodeKind.FREE ? '24 часа бесплатно' : `${c.plan?.name ?? 'Sali Pro'} · ${durationText(c.durationDays)}` })),
    };
  }

  /** Ends one subscription now (the app loses access on its next check). */
  async revokeSubscription(adminId: number, subscriptionId: string, notify: boolean) {
    this.guard(adminId);
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) throw new NotFoundException('Подписка уже не активна');
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.EXPIRED, expiresAt: new Date(), autoRenew: false } });
    // The owner and every installation that shared it.
    await this.subscriptions.disableUncovered(sub.userId).catch(() => undefined);
    if (notify) await this.notifications.sendHtml(sub.userId, `⛔ <b>Подписка ${esc(sub.plan.name)} отозвана администрацией.</b>\n\nЕсли это ошибка — напишите в поддержку.`).catch(() => undefined);
    return { userId: sub.userId };
  }

  /** Makes an unused code invalid. */
  async revokeCode(adminId: number, codeId: string) {
    this.guard(adminId);
    const code = await this.prisma.activationCode.findUnique({ where: { id: codeId } });
    const res = await this.prisma.activationCode.updateMany({ where: { id: codeId, status: ActivationCodeStatus.ISSUED }, data: { status: ActivationCodeStatus.REVOKED } });
    if (!res.count || !code) throw new NotFoundException('Код уже активирован или отозван');
    return { userId: code.ownerId };
  }

  async setBlocked(adminId: number, userId: string, isBlocked: boolean) {
    this.guard(adminId);
    await this.prisma.user.update({ where: { id: userId }, data: { isBlocked } });
    if (isBlocked) await this.vpn.disable(userId).catch(() => undefined);
    return { isBlocked };
  }

  /** Last admin grants. */
  async issued(adminId: number) {
    this.guard(adminId);
    const rows = await this.prisma.activationCode.findMany({
      where: { note: { startsWith: NOTE_PREFIX } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { owner: true, redeemedBy: true },
    });
    return rows.map((r) => {
      const [, kind, , ...msg] = (r.note ?? '').split(':');
      return {
        to: this.title(r.owner),
        kind: kind === 'gift' ? 'gift' : 'admin',
        duration: durationText(r.durationDays),
        status: r.code.startsWith('ADM') ? 'APPLIED' : r.status,
        code: r.code.startsWith('ADM') ? null : formatCode(r.code),
        device: r.redeemedBy ? formatPublicId(r.redeemedBy.publicId) : null,
        message: msg.join(':') || null,
        at: r.createdAt.toISOString(),
      };
    });
  }

  /** Who counts as paid / from admin / trial / expired — shared by «Пользователи» and «Статистика». */
  private segments(now: Date) {
    const month = new Date(now.getTime() - 30 * 86_400_000);
    const adminPlan: Prisma.SubscriptionWhereInput = { OR: [{ provider: 'admin' }, { provider: { startsWith: 'admin_' } }, { plan: { code: { in: [PLANS.admin.code, PLANS.gift.code] } } }] };
    const active: Prisma.SubscriptionWhereInput = { status: SubscriptionStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
    const subWhere: Record<'paid' | 'granted' | 'expired', Prisma.SubscriptionWhereInput> = {
      paid: { AND: [active, { NOT: adminPlan }] },
      granted: { AND: [active, adminPlan] },
      expired: { expiresAt: { gte: month, lte: now }, user: { subscriptions: { none: active } } },
    };
    const trialWhere: Prisma.TrialWhereInput = { status: 'ACTIVE', expiresAt: { gt: now }, user: { subscriptions: { none: active } } };
    return { adminPlan, active, subWhere, trialWhere };
  }

  /**
   * «👥 Пользователи»: who has access right now, split into segments, 10 per page.
   *   paid    — active paid subscription (Stars, USDT, card, paid code)
   *   granted — active subscription from the admin (🛡 or 🎁)
   *   trial   — free 24 h tariff, no subscription
   *   expired — access ended in the last 30 days (who to win back)
   * Only account data — no traffic, sites or connection history (there is none).
   */
  async people(adminId: number, segment: PeopleSegment, page = 0) {
    this.guard(adminId);
    const now = new Date();
    const take = 10, skip = Math.max(0, page) * take;
    const { subWhere, trialWhere } = this.segments(now);

    const [paid, granted, trial, expired, online] = await Promise.all([
      this.prisma.subscription.count({ where: subWhere.paid }),
      this.prisma.subscription.count({ where: subWhere.granted }),
      this.prisma.trial.count({ where: trialWhere }),
      this.prisma.subscription.groupBy({ by: ['userId'], where: subWhere.expired }).then((g) => g.length), // one row per person
      this.nodes.list(adminId).then((l) => l.reduce((n, s) => n + (s.connectedNow ?? 0), 0)).catch(() => null),
    ]);

    type Row = { userId: string; until: Date | null; plan: string; via: string | null };
    let rows: Row[];
    if (segment === 'trial') {
      const t = await this.prisma.trial.findMany({ where: trialWhere, orderBy: { expiresAt: 'asc' }, skip, take });
      rows = t.map((x) => ({ userId: x.userId, until: x.expiresAt, plan: 'бесплатный тариф', via: null }));
    } else {
      const s = await this.prisma.subscription.findMany({
        where: subWhere[segment], orderBy: segment === 'expired' ? { expiresAt: 'desc' } : { createdAt: 'desc' }, skip, take, include: { plan: true },
        ...(segment === 'expired' ? { distinct: ['userId'] as Prisma.SubscriptionScalarFieldEnum[] } : {}),
      });
      rows = s.map((x) => ({ userId: x.userId, until: x.expiresAt, plan: x.plan.name, via: x.provider }));
    }

    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } } });
    const ownerIds = [...new Set(users.map((u) => u.linkedTelegramId).filter((v): v is bigint => v !== null))];
    const owners = ownerIds.length ? await this.prisma.user.findMany({ where: { telegramId: { in: ownerIds } } }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const ownerOf = new Map(owners.map((o) => [o.telegramId!.toString(), o]));
    const VIA: Record<string, string> = { telegram_stars: '⭐', crypto_ton: '💵 USDT', paddle: '💳', code: '🔑 код', google_play: 'Google Play', admin: '🛡', admin_admin: '🛡', admin_gift: '🎁' };

    const list = rows.map((r) => {
      const u = byId.get(r.userId);
      const owner = u?.linkedTelegramId ? ownerOf.get(u.linkedTelegramId.toString()) : undefined;
      const who = u?.telegramId ? u : owner;
      return {
        userId: r.userId,
        name: who ? this.title(who) : u ? this.title(u) : '—',
        username: who?.username ?? null,
        device: u && !u.telegramId ? formatPublicId(u.publicId) : null,
        plan: r.plan,
        until: !r.until || r.until.getTime() - now.getTime() > 50 * 365 * 86_400_000 ? 'бессрочно' : date(r.until), // 50+ years = «forever» grants
        via: r.via ? (VIA[r.via] ?? r.via) : null,
        blocked: u?.isBlocked ?? false,
      };
    });
    const total = { paid, granted, trial, expired }[segment];
    return { segment, page, pages: Math.max(1, Math.ceil(total / take)), counts: { paid, granted, trial, expired, online }, list };
  }

  /** «📊 Статистика»: audience, access, money, conversion, codes, referrals, servers. Counts only. */
  async stats(adminId: number) {
    this.guard(adminId);
    const now = new Date();
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
    const day = ago(1), week = ago(7), month = ago(30);
    const { subWhere, trialWhere } = this.segments(now);
    const ok = { status: PaymentStatus.SUCCEEDED };
    const paid = (since?: Date) => this.prisma.payment.aggregate({ where: { ...ok, ...(since ? { createdAt: { gte: since } } : {}) }, _sum: { amountUsd: true }, _count: true });
    const [
      tgUsers, devices, linked, new24, new7, new30, active7,
      paidNow, granted, trials, expired, expiring3,
      p24, p7, p30, pAll, byMethod, payers, payers30, refunds,
      freeIssued, freeRedeemed, paidCodes30, paidRedeemed30, giftsAdmin,
      refAll, refRewarded,
      servers, perServer, online,
    ] = await Promise.all([
      this.prisma.user.count({ where: { telegramId: { not: null } } }),
      this.prisma.user.count({ where: { telegramId: null } }),
      this.prisma.user.count({ where: { telegramId: null, linkedTelegramId: { not: null } } }),
      this.prisma.user.count({ where: { createdAt: { gte: day } } }),
      this.prisma.user.count({ where: { createdAt: { gte: week } } }),
      this.prisma.user.count({ where: { createdAt: { gte: month } } }),
      this.prisma.device.count({ where: { lastActiveAt: { gte: week } } }),
      this.prisma.subscription.count({ where: subWhere.paid }),
      this.prisma.subscription.count({ where: subWhere.granted }),
      this.prisma.trial.count({ where: trialWhere }),
      this.prisma.subscription.groupBy({ by: ['userId'], where: subWhere.expired }).then((g) => g.length),
      this.prisma.subscription.count({ where: { AND: [subWhere.paid, { expiresAt: { gt: now, lte: new Date(now.getTime() + 3 * 86_400_000) } }] } }),
      paid(day), paid(week), paid(month), paid(),
      this.prisma.payment.groupBy({ by: ['provider'], where: { ...ok, createdAt: { gte: month } }, _sum: { amountUsd: true }, _count: true }),
      this.prisma.payment.groupBy({ by: ['userId'], where: ok }).then((g) => g.length),
      this.prisma.payment.groupBy({ by: ['userId'], where: { ...ok, createdAt: { gte: month } } }).then((g) => g.length),
      this.prisma.payment.count({ where: { status: PaymentStatus.REFUNDED } }),
      this.prisma.activationCode.count({ where: { kind: ActivationCodeKind.FREE } }),
      this.prisma.activationCode.count({ where: { kind: ActivationCodeKind.FREE, status: ActivationCodeStatus.REDEEMED } }),
      this.prisma.activationCode.count({ where: { kind: ActivationCodeKind.PAID, createdAt: { gte: month } } }),
      this.prisma.activationCode.count({ where: { kind: ActivationCodeKind.PAID, createdAt: { gte: month }, status: ActivationCodeStatus.REDEEMED } }),
      this.prisma.activationCode.count({ where: { note: { startsWith: NOTE_PREFIX } } }),
      this.prisma.referral.count(),
      this.prisma.referral.count({ where: { status: 'REWARDED' } }),
      this.prisma.vpnServer.findMany({ where: { agentUrl: { not: null } }, select: { id: true, name: true, online: true, premiumOnly: true, isActive: true } }),
      this.prisma.vpnAccount.groupBy({ by: ['serverId'], _count: true }),
      this.nodes.list(adminId).catch(() => null),
    ]);
    const usd = (a: { _sum: { amountUsd: Prisma.Decimal | null } }) => Number(a._sum.amountUsd ?? 0);
    const users = new Map(perServer.map((r) => [r.serverId, r._count]));
    const live = new Map((online ?? []).map((n) => [n.name, n.connectedNow ?? null]));
    const METHOD: Record<string, string> = { telegram_stars: '⭐ Stars', crypto_ton: '💵 USDT', crypto: '💵 USDT', paddle: '💳 Карта', google_play: '▶️ Google Play', manual: '✍️ Вручную' };
    return {
      telegramUsers: tgUsers, devices, linkedDevices: linked, new24h: new24, new7d: new7, new30d: new30, activeDevices7d: active7,
      access: {
        paid: paidNow, granted, trial: trials, expired30d: expired, expiringPaid3d: expiring3,
        onlineNow: online ? online.reduce((n, s) => n + (s.connectedNow ?? 0), 0) : null,
      },
      // kept for older bot builds
      activeSubscriptions: paidNow + granted, activeTrials: trials,
      revenue: {
        day: usd(p24), dayCount: p24._count, week: usd(p7), weekCount: p7._count,
        month: usd(p30), monthCount: p30._count, total: usd(pAll), totalCount: pAll._count,
        avgCheck30d: p30._count ? usd(p30) / p30._count : 0,
        byMethod30d: byMethod.map((m) => ({ method: METHOD[m.provider] ?? m.provider, sum: Number(m._sum.amountUsd ?? 0), count: m._count })).sort((a, b) => b.sum - a.sum),
        payers, payers30d: payers30, refunds,
      },
      conversion: {
        // share of Telegram users who ever paid / who took the free tariff
        payersOfUsers: tgUsers ? payers / tgUsers : 0,
        freeOfUsers: tgUsers ? freeIssued / tgUsers : 0,
      },
      codes: { freeIssued, freeRedeemed, paid30d: paidCodes30, paidRedeemed30d: paidRedeemed30 },
      referrals: { total: refAll, rewarded: refRewarded },
      servers: servers.map((s) => ({ name: s.name, online: s.online, premiumOnly: s.premiumOnly, isActive: s.isActive, users: users.get(s.id) ?? 0, connectedNow: live.get(s.name) ?? null })),
      adminGrants: giftsAdmin,
    };
  }
}
