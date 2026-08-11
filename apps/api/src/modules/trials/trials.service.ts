import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { VpnService } from '../vpn/vpn.service';
import { TrialStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TrialsService {
  private readonly logger = new Logger(TrialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly vpn: VpnService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Starts the free trial the first time a user connects. Idempotent: if a
   * trial already exists, the existing one is returned untouched — trial
   * duration can never be extended by calling this again.
   */
  async startTrialIfNeeded(userId: string) {
    const existing = await this.prisma.trial.findUnique({ where: { userId } });
    if (existing) return existing;

    const minutes = Number(this.config.get('TRIAL_DURATION_MINUTES', 60));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + minutes * 60_000);

    return this.prisma.trial.create({
      data: { userId, startedAt: now, expiresAt, status: TrialStatus.ACTIVE },
    });
  }

  async getTrial(userId: string) {
    return this.prisma.trial.findUnique({ where: { userId } });
  }

  /**
   * Server-authoritative expiry check. The Mini App countdown is purely
   * cosmetic — access is only ever granted or revoked based on this.
   */
  private async expireOne(trialId: string, userId: string) {
    await this.prisma.trial.update({
      where: { id: trialId },
      data: { status: TrialStatus.EXPIRED },
    });
    await this.vpn.disable(userId).catch((err) => {
      this.logger.error(`Failed to disable VPN for expired trial user=${userId}`, err);
    });
    await this.notifications.enqueue(userId, 'TRIAL_EXPIRED');
  }

  /** Runs every minute; disables VPN access for any trial whose time is up. */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepExpiredTrials() {
    const now = new Date();
    const expired = await this.prisma.trial.findMany({
      where: { status: TrialStatus.ACTIVE, expiresAt: { lte: now } },
      select: { id: true, userId: true },
    });

    for (const trial of expired) {
      await this.expireOne(trial.id, trial.userId);
    }

    if (expired.length > 0) {
      this.logger.log(`Expired ${expired.length} trial(s)`);
    }
  }
}
