import { Body, Controller, Get, Headers, Post, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { formatPublicId } from '../codes/code-format';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { VpnService } from '../vpn/vpn.service';
import { TrialsService } from '../trials/trials.service';
import { trialLimitSeconds, trialSecondsLeft, trialSecondsUsed } from '../trials/trial-clock';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { HomeStateDTO } from '@sali/types';
import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(
    private readonly vpn: VpnService,
    private readonly trials: TrialsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly users: UsersService,
    private readonly devices: DevicesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('home')
  async getHome(@CurrentUser() authUser: AuthTokenPayload): Promise<HomeStateDTO> {
    const user = await this.users.findById(authUser.sub);
    const [account, trial, subscription] = await Promise.all([
      this.vpn.getAccountWithServer(authUser.sub),
      this.trials.getTrial(authUser.sub),
      this.subscriptions.getActiveForUser(authUser.sub),
    ]);

    const now = Date.now();
    const secondsRemaining = trial ? trialSecondsLeft(trial, now) : 0;
    const totalSeconds = trial ? trialSecondsUsed(trial, now) : 0;
    const limitSeconds = trial ? trialLimitSeconds(trial) : 0;

    return {
      user: {
        id: user.id,
        telegramId: user.telegramId?.toString() ?? null,
        publicId: formatPublicId(user.publicId),
        telegramLinked: Boolean(user.telegramId ?? user.linkedTelegramId),
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
            sessionSeconds: totalSeconds,
            totalSeconds,
            limitSeconds,
            isRunning: secondsRemaining > 0,
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
  async connect(
    @CurrentUser() authUser: AuthTokenPayload,
    @Headers('x-device-key') deviceKey?: string,
    @Headers('x-vpn-protocol') protocolHeader?: string,
    @Body() body?: { serverId?: string },
  ) {
    // Apps that speak AmneziaWG send "X-VPN-Protocol: awg"; older ones get plain WireGuard.
    const protocol = protocolHeader === 'awg' ? 'awg' : 'wg';
    if (!deviceKey || deviceKey.length < 16 || deviceKey.length > 128) {
      throw new BadRequestException('Сначала зарегистрируйте это устройство');
    }
    const access = await this.devices.assertCanConnect(authUser.sub, deviceKey);
    const serverId = typeof body?.serverId === 'string' && body.serverId.length <= 40 ? body.serverId : undefined;
    // Free tariff → free servers only; subscription → every location.
    const account = await this.vpn.ensureHealthyAccount(authUser.sub, serverId, Boolean(access.activeSub));

    const activeSub = access.activeSub;
    if (!activeSub) {
      // Store-app accounts get the free tariff only through a FREE code from the bot.
      const user = await this.users.findById(authUser.sub);
      if (!user.telegramId && !(await this.trials.getTrial(authUser.sub))) {
        throw new ForbiddenException('Нет активного тарифа. Получите код в Telegram-боте и введите его в приложении');
      }
      await this.trials.assertAvailable(authUser.sub);
    }
    await this.vpn.enable(authUser.sub);
    if (!activeSub) await this.trials.startSession(authUser.sub);

    const config = await this.vpn.getConnectionConfig(authUser.sub, protocol);
    // The server the tunnel really goes to (the API may pick another one than asked for),
    // so the app shows the right location.
    const server = await this.prisma.vpnServer.findUnique({ where: { id: account.serverId } });
    return {
      account, config,
      server: server && {
        id: server.id, name: server.name, location: server.location, countryCode: server.countryCode, city: server.city,
        premiumOnly: server.premiumOnly, pingMs: server.pingMs, currentLoad: server.currentLoad, capacity: server.capacity, recommended: false,
      },
    };
  }

  @Post('vpn/disconnect')
  async disconnect(@CurrentUser() authUser: AuthTokenPayload) {
    const account = await this.vpn.disable(authUser.sub);
    await this.trials.pauseSession(authUser.sub);
    return account;
  }
}
