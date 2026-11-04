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

  async getActiveForUser(userId: string) {
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
      await this.vpn.disable(sub.userId).catch((err) => {
        this.logger.error(`Failed to disable VPN for expired sub user=${sub.userId}`, err);
      });
      await this.notifications.enqueue(sub.userId, 'SUBSCRIPTION_EXPIRED');
    }

    if (expired.length > 0) {
      this.logger.log(`Expired ${expired.length} subscription(s)`);
    }
  }
}
