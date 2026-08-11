import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
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
      data: { userId, startedAt: now, expiresAt, activeSince: null, status: TrialStatus.ACTIVE },
    });
  }

  private limitSeconds() {
    return Number(this.config.get('TRIAL_DURATION_MINUTES', 60)) * 60;
  }

  async assertAvailable(userId: string) {
    const trial = await this.startTrialIfNeeded(userId);
    const runningSeconds = trial.activeSince
      ? Math.max(0, Math.floor((Date.now() - trial.activeSince.getTime()) / 1000))
      : 0;
    if (trial.status === TrialStatus.EXPIRED || trial.usedSeconds + runningSeconds >= this.limitSeconds()) {
      throw new ForbiddenException('Пробный период закончился');
    }
    return trial;
  }

  async startSession(userId: string) {
    const trial = await this.assertAvailable(userId);
    if (trial.activeSince) return trial;

    const now = new Date();
    const remainingSeconds = this.limitSeconds() - trial.usedSeconds;
    return this.prisma.trial.update({
      where: { userId },
      data: { activeSince: now, expiresAt: new Date(now.getTime() + remainingSeconds * 1000) },
    });
  }

  async pauseSession(userId: string) {
    const trial = await this.getTrial(userId);
    if (!trial?.activeSince) return trial;

    const elapsed = Math.max(0, Math.floor((Date.now() - trial.activeSince.getTime()) / 1000));
    const usedSeconds = Math.min(this.limitSeconds(), trial.usedSeconds + elapsed);
    return this.prisma.trial.update({
      where: { userId },
      data: {
        usedSeconds,
        activeSince: null,
        status: usedSeconds >= this.limitSeconds() ? TrialStatus.EXPIRED : TrialStatus.ACTIVE,
      },
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
      where: { status: TrialStatus.ACTIVE, activeSince: { not: null }, expiresAt: { lte: now } },
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
