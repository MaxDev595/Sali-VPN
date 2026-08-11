import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { VpnService } from '../vpn/vpn.service';
import { TrialsService } from '../trials/trials.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { HomeStateDTO } from '@sali/types';

@Controller()
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(
    private readonly vpn: VpnService,
    private readonly trials: TrialsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly users: UsersService,
  ) {}

  @Get('home')
  async getHome(@CurrentUser() authUser: AuthTokenPayload): Promise<HomeStateDTO> {
    const user = await this.users.findById(authUser.sub);
    const [account, trial, subscription] = await Promise.all([
      this.vpn.getAccountWithServer(authUser.sub),
      this.trials.getTrial(authUser.sub),
      this.subscriptions.getActiveForUser(authUser.sub),
    ]);

    const now = new Date();
    const secondsRemaining = trial
      ? Math.max(0, Math.floor((trial.expiresAt.getTime() - now.getTime()) / 1000))
      : 0;

    return {
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt.toISOString(),
      },
      vpn: account
        ? { status: account.status, serverLocation: account.server.location }
        : null,
      trial: trial
        ? {
            status: trial.status,
            startedAt: trial.startedAt.toISOString(),
            expiresAt: trial.expiresAt.toISOString(),
            secondsRemaining,
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            plan: {
              id: subscription.plan.id,
              code: subscription.plan.code,
              name: subscription.plan.name,
              durationDays: subscription.plan.durationDays,
              priceUsd: Number(subscription.plan.priceUsd),
              originalPriceUsd: subscription.plan.originalPriceUsd
                ? Number(subscription.plan.originalPriceUsd)
                : null,
              maxDevices: subscription.plan.maxDevices,
            },
            startedAt: subscription.startedAt?.toISOString() ?? null,
            expiresAt: subscription.expiresAt?.toISOString() ?? null,
            autoRenew: subscription.autoRenew,
          }
        : null,
      hasEverHadAccess: Boolean(account),
    };
  }

  /**
   * "Подключить VPN" — creates the account + starts the trial on first use,
   * or simply re-enables an already-provisioned account.
   */
  @Post('vpn/connect')
  async connect(@CurrentUser() authUser: AuthTokenPayload) {
    const account = await this.vpn.ensureAccountForUser(authUser.sub);
    await this.trials.startTrialIfNeeded(authUser.sub);

    const activeSub = await this.subscriptions.getActiveForUser(authUser.sub);
    const trial = await this.trials.getTrial(authUser.sub);
    const trialActive = trial?.status === 'ACTIVE';

    if (activeSub || trialActive) {
      await this.vpn.enable(authUser.sub);
    }

    const config = await this.vpn.getConnectionConfig(authUser.sub);
    return { account, config };
  }

  @Post('vpn/disconnect')
  async disconnect(@CurrentUser() authUser: AuthTokenPayload) {
    return this.vpn.disable(authUser.sub);
  }
}
