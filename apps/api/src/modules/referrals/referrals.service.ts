import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

const REWARD_DAYS_PER_REFERRAL = 3;

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
   * Called by the bot on /start when a `ref_<telegramId>` deep-link param is
   * present. Idempotent — a user can only ever be referred once (enforced by
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
   * Reward is granted once the referred user actually starts using the
   * service (their trial begins) — not merely for opening the bot, to avoid
   * trivial reward farming.
   */
  async rewardIfEligible(referredUserId: string) {
    const referral = await this.prisma.referral.findUnique({ where: { referredUserId } });
    if (!referral || referral.status === ReferralStatus.REWARDED) return null;

    const updated = await this.prisma.referral.update({
      where: { id: referral.id },
      data: { status: ReferralStatus.REWARDED },
    });

    await this.prisma.referralReward.create({
      data: {
        referralId: referral.id,
        userId: referral.referrerId,
        kind: 'free_days',
        amount: REWARD_DAYS_PER_REFERRAL,
      },
    });

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
      rewardDaysEarned: rewards.reduce((sum, r) => sum + r.amount, 0),
    };
  }
}
