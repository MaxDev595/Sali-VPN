import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { UsersService } from '../users/users.service';
import { VpnService } from '../vpn/vpn.service';
import { TrialsService } from '../trials/trials.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ReferralsService } from '../referrals/referrals.service';
import { PaymentsService } from '../payments/payments.service';
import { SupportService } from '../support/support.service';
import {
  ConfirmPaymentDto,
  CreateSupportTicketByTelegramDto,
  SyncTelegramUserDto,
  TelegramIdParamDto,
} from './dto/internal.dto';

@Controller('internal')
@UseGuards(InternalServiceGuard)
export class InternalController {
  constructor(
    private readonly users: UsersService,
    private readonly vpn: VpnService,
    private readonly trials: TrialsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly referrals: ReferralsService,
    private readonly payments: PaymentsService,
    private readonly support: SupportService,
  ) {}

  /** Called on every /start — creates the user if needed and records referrals. */
  @Post('users/sync')
  async syncUser(@Body() dto: SyncTelegramUserDto) {
    const user = await this.users.findOrCreateByTelegramProfile({
      telegramId: BigInt(dto.telegramId),
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      languageCode: dto.languageCode,
    });

    if (dto.startParam?.startsWith('ref_')) {
      const referrerTelegramId = BigInt(dto.startParam.replace('ref_', ''));
      await this.referrals.recordReferralIfNew(user.id, referrerTelegramId);
    }

    return { userId: user.id, isBlocked: user.isBlocked };
  }

  /** Bot's "Подключить VPN" button — creates the account/trial and returns config. */
  @Post('vpn/connect')
  async connectVpn(@Body() dto: TelegramIdParamDto) {
    const user = await this.users.findByTelegramId(BigInt(dto.telegramId));
    if (!user) throw new Error('User not found — call users/sync first');

    const account = await this.vpn.ensureAccountForUser(user.id);
    const trial = await this.trials.startTrialIfNeeded(user.id);
    await this.referrals.rewardIfEligible(user.id);

    const activeSub = await this.subscriptions.getActiveForUser(user.id);
    if (activeSub || trial.status === 'ACTIVE') {
      await this.vpn.enable(user.id);
    }

    const config = await this.vpn.getConnectionConfig(user.id);
    return { account, trial, config };
  }

  @Post('users/state')
  async getState(@Body() dto: TelegramIdParamDto) {
    const user = await this.users.findByTelegramId(BigInt(dto.telegramId));
    if (!user) throw new Error('User not found');

    const [trial, activeSubscription, latestSubscription, referralStats] = await Promise.all([
      this.trials.getTrial(user.id),
      this.subscriptions.getActiveForUser(user.id),
      this.subscriptions.getLatestForUser(user.id),
      this.referrals.getStats(user.id),
    ]);
    const now = Date.now();
    const trialSessionSeconds = trial?.activeSince
      ? Math.max(0, Math.floor((now - trial.activeSince.getTime()) / 1000))
      : 0;
    const trialLimitSeconds = Number(process.env.TRIAL_DURATION_MINUTES ?? 60) * 60;
    const trialSecondsRemaining = trial
      ? Math.max(0, trialLimitSeconds - trial.usedSeconds - trialSessionSeconds)
      : 0;
    const trialActive = Boolean(trial && trial.status === 'ACTIVE' && trialSecondsRemaining > 0);
    const subscription = activeSubscription ?? latestSubscription;
    const registered = Boolean(trial || subscription);
    const state = user.isBlocked
      ? 'BLOCKED'
      : activeSubscription
        ? 'SUBSCRIPTION_ACTIVE'
        : latestSubscription && ['EXPIRED', 'CANCELED'].includes(latestSubscription.status)
          ? 'SUBSCRIPTION_EXPIRED'
          : trialActive
            ? 'TRIAL_ACTIVE'
            : trial
              ? 'TRIAL_EXPIRED'
              : registered
                ? 'REGISTERED'
                : 'NEW';

    return {
      state,
      registered,
      user: {
        publicId: user.id.slice(0, 8).toUpperCase(),
        username: user.username,
        firstName: user.firstName,
        isBlocked: user.isBlocked,
      },
      trial: trial
        ? {
            status: trialActive ? 'ACTIVE' : 'EXPIRED',
            startedAt: trial.startedAt.toISOString(),
            expiresAt: trial.expiresAt.toISOString(),
            secondsRemaining: trialSecondsRemaining,
          }
        : null,
      subscription: subscription
        ? {
            status: activeSubscription ? 'ACTIVE' : subscription.status,
            startedAt: subscription.startedAt?.toISOString() ?? null,
            expiresAt: subscription.expiresAt?.toISOString() ?? null,
            plan: { name: subscription.plan.name },
          }
        : null,
      referralStats,
    };
  }

  /** Called after Telegram's `successful_payment` webhook, or a manual admin confirm. */
  @Post('payments/confirm')
  async confirmPayment(@Body() dto: ConfirmPaymentDto) {
    return this.payments.confirmByExternalId(dto.externalPaymentId);
  }

  @Post('support/tickets')
  async createSupportTicket(@Body() dto: CreateSupportTicketByTelegramDto) {
    const user = await this.users.findByTelegramId(BigInt(dto.telegramId));
    if (!user) throw new Error('User not found');
    return this.support.createTicket(user.id, dto.category, dto.message);
  }
}
