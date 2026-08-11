import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('plans')
  async listPlans() {
    const plans = await this.prisma.plan.findMany({ where: { isActive: true } });
    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      durationDays: p.durationDays,
      priceUsd: Number(p.priceUsd),
      originalPriceUsd: p.originalPriceUsd ? Number(p.originalPriceUsd) : null,
      maxDevices: p.maxDevices,
    }));
  }

  @Get('subscription')
  async mySubscription(@CurrentUser() authUser: AuthTokenPayload) {
    const subscription = await this.subscriptions.getLatestForUser(authUser.sub);
    if (!subscription) return null;
    return {
      id: subscription.id,
      status: subscription.status,
      plan: subscription.plan,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      autoRenew: subscription.autoRenew,
    };
  }
}
