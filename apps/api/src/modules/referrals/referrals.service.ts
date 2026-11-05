import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralStatus, SubscriptionStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

/** Referrer: one 10% discount per friend, spent on the next purchase. */
export const REFERRAL_DISCOUNT_PERCENT = Number(process.env.REFERRAL_DISCOUNT_PERCENT ?? 10);
/** Friend: extra free VPN time on top of the free tariff (or the first paid code). */
export const REFERRAL_FRIEND_BONUS_HOURS = Number(process.env.REFERRAL_FRIEND_BONUS_HOURS ?? 3);
const FRIEND_BONUS_SECONDS = Math.round(REFERRAL_FRIEND_BONUS_HOURS * 3600);

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  buildReferralLink(telegramId: bigint): string {
    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME') ?? 'SaliVPNOfficialBot';
    return `https://t.me/${botUsername}?start=ref_${telegramId.toString()}`;
  }

  /**
   * /start ref_<telegramId> from a brand-new Telegram account.
   * Idempotent — a user can only ever be referred once (unique Referral.referredUserId).
   */
  async recordReferralIfNew(referredUserId: string, referrerTelegramId: bigint) {
    const referrer = await this.prisma.user.findUnique({ where: { telegramId: referrerTelegramId } });
    if (!referrer || referrer.id === referredUserId) return null;

    const existing = await this.prisma.referral.findUnique({ where: { referredUserId } });
    if (existing) return existing;

    return this.prisma.referral.create({
      data: { referrerId: referrer.id, referredUserId, status: ReferralStatus.PENDING },
    }).catch(() => null);
  }

  /** Whether this Telegram account came by a friend's link and the bonus is still waiting. */
  async pendingFor(referredUserId: string) {
    const referral = await this.prisma.referral.findUnique({ where: { referredUserId } });
    return referral?.status === ReferralStatus.PENDING ? referral : null;
  }

  /**
   * Fires once, when the invited friend activates their first code on a device.
   * Friend: +3 hours on that device (free tariff or subscription).
   * Referrer: a 10% discount for the next purchase.
   */
  async rewardIfEligible(referredUserId: string, deviceUserId: string = referredUserId) {
    const referral = await this.prisma.referral.findUnique({ where: { referredUserId } });
    if (!referral || referral.status === ReferralStatus.REWARDED) return null;

    const rewarded = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.referral.updateMany({
        where: { id: referral.id, status: ReferralStatus.PENDING },
        data: { status: ReferralStatus.REWARDED },
      });
      if (claimed.count === 0) return false;

      await tx.referralReward.create({
        data: { referralId: referral.id, userId: referral.referrerId, kind: 'discount_percent', amount: REFERRAL_DISCOUNT_PERCENT },
      });

      const now = new Date();
      const subscription = await tx.subscription.findFirst({
        where: { userId: deviceUserId, status: SubscriptionStatus.ACTIVE, expiresAt: { gt: now } },
        orderBy: { expiresAt: 'desc' },
      });
      if (subscription?.expiresAt) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { expiresAt: new Date(subscription.expiresAt.getTime() + FRIEND_BONUS_SECONDS * 1000) },
        });
      } else {
        const trial = await tx.trial.findUnique({ where: { userId: deviceUserId } });
        if (trial) {
          await tx.trial.update({
            where: { userId: deviceUserId },
            data: {
              bonusSeconds: { increment: FRIEND_BONUS_SECONDS },
              expiresAt: new Date(Math.max(trial.expiresAt.getTime(), now.getTime()) + FRIEND_BONUS_SECONDS * 1000),
            },
          });
        }
      }
      return true;
    });

    if (!rewarded) return null;

    await this.notifications.enqueue(referral.referrerId, 'REFERRAL_REWARD').catch((error) => {
      this.logger.warn(`Failed to notify referrer=${referral.referrerId}`, error as Error);
    });
    return { friendBonusHours: REFERRAL_FRIEND_BONUS_HOURS, referrerDiscountPercent: REFERRAL_DISCOUNT_PERCENT };
  }

  async getStats(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [totalInvited, rewards] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: userId } }),
      this.prisma.referralReward.findMany({ where: { userId } }),
    ]);

    return {
      link: this.buildReferralLink(user.telegramId ?? user.linkedTelegramId ?? 0n),
      totalInvited,
      totalRewarded: rewards.length,
      availableDiscounts: rewards.filter((reward) => !reward.paymentId && !reward.consumedAt).length,
      discountPercent: REFERRAL_DISCOUNT_PERCENT,
      friendBonusHours: REFERRAL_FRIEND_BONUS_HOURS,
    };
  }
}
