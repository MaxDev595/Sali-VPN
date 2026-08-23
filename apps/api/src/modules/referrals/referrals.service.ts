import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

const DISCOUNT_PERCENT_PER_REFERRAL = 10;
const REFERRED_TRIAL_BONUS_SECONDS = 30 * 60;

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  buildReferralLink(telegramId: bigint): string {
    const botUsername = this.config.getOrThrow<string>('TELEGRAM_BOT_USERNAME');
    return `https://t.me/${botUsername}?start=ref_${telegramId.toString()}`;
  }

  /**
   * Called only while creating a cryptographically verified new Mini App user.
   * Idempotent — a user can only ever be referred once (enforced by
   * the unique constraint on Referral.referredUserId).
   */
  async recordReferralIfNew(referredUserId: string, referrerTelegramId: bigint) {
    const referrer = await this.prisma.user.findUnique({ where: { telegramId: referrerTelegramId } });
    if (!referrer || referrer.id === referredUserId) return null;

    const existing = await this.prisma.referral.findUnique({ where: { referredUserId } });
    if (existing) return existing;

    return this.prisma.referral.create({
      data: { referrerId: referrer.id, referredUserId, status: ReferralStatus.PENDING },
    });
  }

  /**
   * Grants both sides exactly once: 10% for the referrer and 30 trial minutes
   * for the newly-created referred account.
   */
  async rewardIfEligible(referredUserId: string) {
    const referral = await this.prisma.referral.findUnique({ where: { referredUserId } });
    if (!referral || referral.status === ReferralStatus.REWARDED) return null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.referral.updateMany({
        where: { id: referral.id, status: ReferralStatus.PENDING },
        data: { status: ReferralStatus.REWARDED },
      });
      if (claimed.count === 0) return null;

      await tx.referralReward.create({
        data: {
          referralId: referral.id,
          userId: referral.referrerId,
          kind: 'discount_percent',
          amount: DISCOUNT_PERCENT_PER_REFERRAL,
        },
      });
      const trial = await tx.trial.findUniqueOrThrow({ where: { userId: referredUserId } });
      await tx.trial.update({
        where: { userId: referredUserId },
        data: {
          bonusSeconds: { increment: REFERRED_TRIAL_BONUS_SECONDS },
          expiresAt: new Date(trial.expiresAt.getTime() + REFERRED_TRIAL_BONUS_SECONDS * 1000),
        },
      });
      return tx.referral.findUniqueOrThrow({ where: { id: referral.id } });
    });

    if (!updated) return null;

    await this.notifications.enqueue(referral.referrerId, 'REFERRAL_REWARD');
    return updated;
  }

  async getStats(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [totalInvited, rewards] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: userId } }),
      this.prisma.referralReward.findMany({ where: { userId } }),
    ]);

    return {
      link: this.buildReferralLink(user.telegramId),
      totalInvited,
      totalRewarded: rewards.length,
      availableDiscounts: rewards.filter((reward) => !reward.paymentId && !reward.consumedAt).length,
      discountPercent: DISCOUNT_PERCENT_PER_REFERRAL,
      referredTrialBonusMinutes: REFERRED_TRIAL_BONUS_SECONDS / 60,
    };
  }
}
