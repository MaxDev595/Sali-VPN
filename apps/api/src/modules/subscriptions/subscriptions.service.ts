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

  /** Server-authoritative expiry sweep — never trust a client-side clock. */
  @Cron(CronExpression.EVERY_5_MINUTES)
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
