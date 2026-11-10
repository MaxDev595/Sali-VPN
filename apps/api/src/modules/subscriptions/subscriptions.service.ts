import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import { VpnService } from '../vpn/vpn.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vpn: VpnService,
    private readonly notifications: NotificationsService,
  ) {}

  /** A subscription this installation / account holds itself. */
  async getOwnActive(userId: string) {
    const now = new Date();
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
  }

  /**
   * Access of an installation: its own subscription, or the subscription of the
   * Telegram account it is linked to — shared by up to plan.maxDevices installations
   * (phone, PC, a reinstalled app…). This is what keeps a subscription after reinstalling.
   */
  async getActiveForUser(userId: string) {
    const own = await this.getOwnActive(userId);
    if (own) return own;
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true, linkedTelegramId: true, appDeviceKey: true } });
    const tg = me?.linkedTelegramId ?? me?.telegramId;
    if (!me?.appDeviceKey || !tg) return null;
    const family = await this.sharing(tg);
    return family.sub && family.devices.some((d) => d.id === userId && d.covered) ? family.sub : null;
  }

  /**
   * Everything under one Telegram account: the bot user plus every app installation
   * linked to it. The longest active subscription among them is shared: the installation
   * that holds it first, then the others in the order they were linked, up to maxDevices.
   * Installations with a subscription of their own keep it and take no shared slot.
   */
  async sharing(telegramId: bigint) {
    const now = new Date();
    const members = await this.prisma.user.findMany({
      where: { OR: [{ telegramId }, { linkedTelegramId: telegramId }] },
      select: { id: true, publicId: true, appDeviceKey: true, linkedAt: true, createdAt: true, isBlocked: true, devices: { select: { platform: true, lastActiveAt: true }, take: 1, orderBy: { lastActiveAt: { sort: 'desc', nulls: 'last' } } } },
    });
    const subs = await this.prisma.subscription.findMany({
      where: { userId: { in: members.map((m) => m.id) }, status: SubscriptionStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      include: { plan: true },
      orderBy: { expiresAt: { sort: 'desc', nulls: 'first' } },
    });
    const sub = subs[0] ?? null;
    const owners = new Set(subs.map((s) => s.userId));
    const since = (m: { linkedAt: Date | null; createdAt: Date }) => (m.linkedAt ?? m.createdAt).getTime();
    const installs = members
      .filter((m) => m.appDeviceKey && !m.isBlocked)
      .sort((a, b) => Number(b.id === sub?.userId) - Number(a.id === sub?.userId) || since(a) - since(b));
    const max = sub?.plan.maxDevices ?? 0;
    let used = 0;
    const devices = installs.map((m) => {
      const ownSub = owners.has(m.id) && m.id !== sub?.userId;
      const covered = !ownSub && Boolean(sub) && used < max;
      if (covered) used += 1;
      return { id: m.id, publicId: m.publicId, platform: m.devices[0]?.platform ?? null, lastActiveAt: m.devices[0]?.lastActiveAt ?? null, linkedAt: m.linkedAt, ownSub, covered };
    });
    return { sub, max, used, devices };
  }

  /**
   * Removes an installation from a Telegram account (an old phone, a reinstalled app):
   * frees its place on the subscription. A subscription it held moves to the account's
   * bot user, so the other installations keep it.
   */
  async unlinkInstallation(telegramId: bigint, appId: string) {
    const [app, owner] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: appId } }),
      this.prisma.user.findUnique({ where: { telegramId } }),
    ]);
    if (!app || app.linkedTelegramId !== telegramId || !app.appDeviceKey) return null;
    if (owner) await this.prisma.subscription.updateMany({ where: { userId: app.id, status: SubscriptionStatus.ACTIVE }, data: { userId: owner.id } });
    await this.prisma.user.update({ where: { id: app.id }, data: { linkedTelegramId: null, linkedAt: null } });
    await this.disableUncovered(app.id).catch(() => undefined);
    return app;
  }

  /** After access ends somewhere in a Telegram family: switch off VPN on installations left without access. */
  async disableUncovered(userId: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true, linkedTelegramId: true } });
    const tg = me?.linkedTelegramId ?? me?.telegramId;
    const ids = tg
      ? (await this.prisma.user.findMany({ where: { OR: [{ telegramId: tg }, { linkedTelegramId: tg }] }, select: { id: true } })).map((u) => u.id)
      : [userId];
    if (!ids.includes(userId)) ids.push(userId);
    const now = new Date();
    for (const id of ids) {
      if (await this.getActiveForUser(id)) continue;
      const trial = await this.prisma.trial.findUnique({ where: { userId: id } });
      if (trial && trial.status === 'ACTIVE' && trial.expiresAt > now) continue;
      await this.vpn.disable(id).catch(() => undefined); // no VPN account yet — nothing to switch off
    }
  }

  async getLatestForUser(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Activates a subscription after payment succeeds and (re)enables VPN access. */
  async activate(subscriptionId: string, durationDays: number) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE, startedAt: now, expiresAt },
    });

    await this.vpn.ensureAccountForUser(subscription.userId);
    await this.vpn.enable(subscription.userId);

    return subscription;
  }

  async cancelAutoRenew(subscriptionId: string) {
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { autoRenew: false, canceledAt: new Date() },
    });
  }

  async renew(subscriptionId: string) {
    const current = await this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId }, include: { plan: true } });
    const now = new Date();
    const base = current.expiresAt && current.expiresAt > now ? current.expiresAt : now;
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.ACTIVE, autoRenew: true, canceledAt: null, expiresAt: new Date(base.getTime() + current.plan.durationDays * 86_400_000) },
    });
    await this.vpn.ensureAccountForUser(updated.userId);
    await this.vpn.enable(updated.userId);
    return updated;
  }

  /**
   * Adds days of access (activation codes). Stacks on top of an active
   * subscription, otherwise starts a new one from now.
   */
  async grantDays(userId: string, planId: string, days: number, provider: string) {
    const now = new Date();
    const active = await this.getActiveForUser(userId);
    const subscription = active
      ? await this.prisma.subscription.update({
          where: { id: active.id },
          data: { expiresAt: new Date((active.expiresAt && active.expiresAt > now ? active.expiresAt : now).getTime() + days * 86_400_000) },
        })
      : await this.prisma.subscription.create({
          data: { userId, planId, provider, status: SubscriptionStatus.ACTIVE, startedAt: now, expiresAt: new Date(now.getTime() + days * 86_400_000), autoRenew: false },
        });
    await this.vpn.ensureAccountForUser(userId);
    await this.vpn.enable(userId);
    return subscription;
  }

  /** Reminds customers 3 days before access ends (once per subscription period). */
  @Cron(CronExpression.EVERY_HOUR)
  async remindExpiringSoon() {
    const now = new Date();
    const soon = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE, expiresAt: { gt: now, lte: new Date(now.getTime() + 3 * 86_400_000) } },
      select: { userId: true, expiresAt: true },
    });
    for (const sub of soon) {
      const alreadySent = await this.prisma.notification.findFirst({
        where: { userId: sub.userId, type: 'SUBSCRIPTION_EXPIRING_SOON', createdAt: { gt: new Date(now.getTime() - 4 * 86_400_000) } },
      });
      if (!alreadySent) await this.notifications.enqueue(sub.userId, 'SUBSCRIPTION_EXPIRING_SOON');
    }
  }

  /** Server-authoritative expiry sweep — never trust a client-side clock. Every 15 min so Neon can sleep. */
  @Cron('5 */15 * * * *')
  async sweepExpiredSubscriptions() {
    const now = new Date();
    const expired = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE, expiresAt: { lte: now } },
      select: { id: true, userId: true },
    });

    for (const sub of expired) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      // The owner and every installation that shared this subscription.
      await this.disableUncovered(sub.userId).catch((err) => {
        this.logger.error(`Failed to disable VPN for expired sub user=${sub.userId}`, err);
      });
      await this.notifications.enqueue(sub.userId, 'SUBSCRIPTION_EXPIRED');
    }

    if (expired.length > 0) {
      this.logger.log(`Expired ${expired.length} subscription(s)`);
    }
  }
}
