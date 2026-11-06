import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { VpnService } from '../vpn/vpn.service';
import { TrialStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { trialDurationSeconds, trialSecondsLeft } from './trial-clock';

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
   * Starts the free tariff (24 hours, wall clock) the first time it is activated.
   * Idempotent: an existing trial is returned untouched, so it can never be extended
   * by activating again.
   */
  async startTrialIfNeeded(userId: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + trialDurationSeconds() * 1000);
    return this.prisma.trial.upsert({
      where: { userId },
      update: {},
      create: { userId, startedAt: now, expiresAt, activeSince: now, status: TrialStatus.ACTIVE },
    });
  }

  async assertAvailable(userId: string) {
    const trial = await this.startTrialIfNeeded(userId);
    if (trialSecondsLeft(trial) <= 0) throw new ForbiddenException('Бесплатные 24 часа закончились');
    return trial;
  }

  /** The free 24 hours runs on the wall clock, so connecting only checks it is still valid. */
  async startSession(userId: string) {
    return this.assertAvailable(userId);
  }

  /** Disconnecting does not pause the free 24 hours. Kept for callers that used the old usage timer. */
  async pauseSession(userId: string) {
    return this.getTrial(userId);
  }

  async getTrial(userId: string) {
    return this.prisma.trial.findUnique({ where: { userId } });
  }

  /**
   * Server-authoritative expiry check. The countdown in the apps is purely
   * cosmetic — access is only ever granted or revoked based on this.
   */
  private async expireOne(trialId: string, userId: string) {
    await this.prisma.trial.update({
      where: { id: trialId },
      data: { status: TrialStatus.EXPIRED },
    });
    // A paid subscription activated during the free 24 hours keeps the VPN on.
    const paid = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { id: true },
    });
    if (paid) return;
    await this.vpn.disable(userId).catch((err) => {
      this.logger.error(`Failed to disable VPN for expired trial user=${userId}`, err);
    });
    await this.notifications.enqueue(userId, 'TRIAL_EXPIRED');
  }

  /**
   * Every 15 minutes: disables VPN access for trials whose time is up. Connecting is
   * always checked live, so this only cleans up; running it rarely lets the Neon
   * database sleep between runs instead of staying awake (and billed) 24/7.
   */
  @Cron('0 */15 * * * *')
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
