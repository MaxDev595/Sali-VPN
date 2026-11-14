import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ActivationCodeKind, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CodesService } from '../codes/codes.service';
import { formatPublicId } from '../codes/code-format';

/**
 * The account is the Telegram user. Everything is given to the account — a purchase,
 * a gift, the free 24 hours — and works on every device linked to it (up to the plan's
 * maxDevices). A device is one app installation with one stable Sali ID.
 *
 * Linking a device does all the bookkeeping by itself:
 *  - a subscription the device held moves to the account;
 *  - an older installation of the same phone/PC (reinstall) is replaced, not duplicated;
 *  - when the account is full, the device unused the longest makes room;
 *  - a new account gets its free 24 hours on that device right away.
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly codes: CodesService,
  ) {}

  /** The Telegram account behind a user row (itself for a bot user; the linked one for a device). */
  async accountFor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.telegramId) return user;
    if (!user.linkedTelegramId) return null;
    return this.prisma.user.findUnique({ where: { telegramId: user.linkedTelegramId } });
  }

  /** Links an app installation to a Telegram account and tidies the account up. */
  async link(publicIdOrRaw: string, telegramId: bigint) {
    const app = await this.prisma.user.findFirst({ where: { publicId: publicIdOrRaw.replace(/^SL-?/i, '').replace(/-/g, '').toUpperCase() } });
    if (!app || !app.appDeviceKey) return { status: 'not_found' as const };
    if (app.linkedTelegramId && app.linkedTelegramId !== telegramId) return { status: 'linked_elsewhere' as const, app };
    const account = await this.prisma.user.findUnique({ where: { telegramId } });
    const already = app.linkedTelegramId === telegramId;
    if (!already) await this.prisma.user.update({ where: { id: app.id }, data: { linkedTelegramId: telegramId, linkedAt: new Date() } });

    const notes: { replaced: string[]; freed: string | null; trialStarted: boolean } = { replaced: [], freed: null, trialStarted: false };
    // 1. The account owns the subscription — never a single installation.
    if (account) await this.prisma.subscription.updateMany({ where: { userId: app.id, status: SubscriptionStatus.ACTIVE }, data: { userId: account.id } });

    // 1b. Bought or gifted earlier as a code that nobody typed in: apply it now.
    if (account) {
      const waiting = await this.prisma.activationCode.findMany({ where: { ownerId: account.id, status: 'ISSUED', kind: { in: [ActivationCodeKind.PAID, ActivationCodeKind.GIFT] }, expiresAt: { gt: new Date() }, NOT: { note: { contains: 'без получателя' } } } });
      for (const code of waiting) await this.codes.redeem(account.id, code.code, { silent: true }).catch(() => undefined);
    }

    // 2. Same phone / PC installed again: the older installation goes away.
    notes.replaced = await this.replaceTwins(app.id);

    // 3. Over the limit: the device that has not used the VPN the longest makes room.
    const family = await this.subscriptions.sharing(telegramId);
    if (family.sub && !family.devices.find((d) => d.id === app.id)?.covered) {
      const idle = [...family.devices].filter((d) => d.id !== app.id && d.covered && !d.ownSub)
        .sort((a, b) => (a.lastActiveAt?.getTime() ?? 0) - (b.lastActiveAt?.getTime() ?? 0))[0];
      if (idle) {
        await this.subscriptions.unlinkInstallation(telegramId, idle.id);
        notes.freed = formatPublicId(idle.publicId);
      }
    }

    // 4. A new account: the free 24 hours start on this device, nothing to request.
    if (account && !(await this.subscriptions.getActiveForUser(app.id))) {
      notes.trialStarted = await this.startFreeOn(account.id, app.id);
    }
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: app.id } });
    return { status: already ? 'already' as const : 'linked' as const, app: fresh, notes };
  }

  /**
   * One device = one Sali ID: older installations of the same phone/PC (same platform and
   * device name) under this account are unlinked. Runs on linking and on every connect.
   */
  async replaceTwins(appId: string) {
    const app = await this.prisma.user.findUnique({ where: { id: appId } });
    if (!app?.linkedTelegramId) return [];
    const mine = await this.prisma.device.findFirst({ where: { userId: app.id }, orderBy: { createdAt: 'desc' } });
    if (!mine || !mine.name || mine.name === 'Android' || mine.name === 'Windows') return []; // too generic to tell devices apart
    const twins = await this.prisma.user.findMany({
      where: { linkedTelegramId: app.linkedTelegramId, id: { not: app.id }, createdAt: { lt: app.createdAt }, devices: { some: { platform: mine.platform, name: mine.name } } },
    });
    const replaced: string[] = [];
    for (const twin of twins) {
      await this.subscriptions.unlinkInstallation(app.linkedTelegramId, twin.id);
      replaced.push(formatPublicId(twin.publicId));
    }
    return replaced;
  }

  /**
   * The free 24 hours — once per Telegram account and once per device. Recorded as the
   * account's FREE code (redeemed by the device) so the bot and admin stats stay right.
   */
  async startFreeOn(accountId: string, deviceId: string) {
    const used = await this.prisma.activationCode.findFirst({ where: { ownerId: accountId, kind: ActivationCodeKind.FREE } });
    const trial = await this.prisma.trial.findUnique({ where: { userId: deviceId } });
    if (trial) return false;
    if (used && used.status !== 'ISSUED') {
      // Started in the bot before any app (Happ, or «Подключиться» first): an app linked
      // during those 24 hours shares the same window — it does not get a second one.
      if (used.redeemedById !== accountId || deviceId === accountId) return false;
      const own = await this.prisma.trial.findUnique({ where: { userId: accountId } });
      if (!own || own.status !== 'ACTIVE' || own.expiresAt <= new Date()) return false;
      await this.prisma.trial.create({
        data: { userId: deviceId, startedAt: own.startedAt, expiresAt: own.expiresAt, activeSince: new Date(), status: own.status, bonusSeconds: own.bonusSeconds },
      }).catch(() => undefined);
      return true;
    }
    try {
      const code = used ?? await this.codes.issueFree(accountId);
      await this.codes.redeem(deviceId, code.code, { silent: true });
      return true;
    } catch (error) {
      this.logger.warn(`Free 24h not started account=${accountId} device=${deviceId}: ${(error as Error).message}`);
      return false;
    }
  }

  /** «🎁 24 часа бесплатно» in the bot: starts on the account's most recent device. */
  async freeFromBot(telegramId: bigint) {
    const account = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!account) throw new ConflictException('Сначала нажмите /start');
    if ((await this.subscriptions.sharing(telegramId)).sub) throw new ConflictException('У вас уже есть подписка — бесплатный период не нужен 🙂');
    const device = await this.prisma.user.findFirst({ where: { linkedTelegramId: telegramId, appDeviceKey: { not: null } }, orderBy: { linkedAt: 'desc' } });
    // No app yet: the 24 hours start on the account itself, so the customer can connect
    // right away (Happ), and an app linked later shares the same 24 hours.
    const target = device ?? account;
    if (device && await this.subscriptions.getActiveForUser(device.id)) throw new ConflictException('У вас уже есть подписка — бесплатный период не нужен 🙂');
    const started = await this.startFreeOn(account.id, target.id);
    if (!started) throw new ConflictException('Бесплатные 24 часа уже были использованы на этом аккаунте или устройстве.');
    const trial = await this.prisma.trial.findUniqueOrThrow({ where: { userId: target.id } });
    return { device: device ? formatPublicId(device.publicId) : null, expiresAt: trial.expiresAt.toISOString() };
  }

  /**
   * Gives days to an account (purchase, gift, admin). A device that is not linked yet keeps
   * them itself until it is linked — then they move to the account.
   */
  async giveDays(userId: string, planId: string, days: number, source: string) {
    const account = (await this.accountFor(userId)) ?? (await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }));
    const sub = await this.subscriptions.grantDays(account.id, planId, days, source);
    return { account, sub };
  }

  /** Short summary for messages: plan, until, devices N of max. */
  async summary(userId: string) {
    const account = await this.accountFor(userId);
    const tg = account?.telegramId;
    if (!tg) return null;
    const family = await this.subscriptions.sharing(tg);
    return {
      accountId: formatPublicId(account!.publicId),
      plan: family.sub?.plan.name ?? null,
      until: family.sub?.expiresAt?.toISOString() ?? null,
      used: family.used,
      max: family.max || 3,
      devices: family.devices.map((d) => ({ publicId: formatPublicId(d.publicId), platform: d.platform, covered: d.covered || d.ownSub })),
    };
  }
}
