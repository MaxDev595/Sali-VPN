import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { VpnService } from '../vpn/vpn.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsService } from '../payments/payments.service';

class SetBlockedDto {
  @IsBoolean()
  isBlocked!: boolean;
}

class ExtendSubscriptionDto {
  @IsInt()
  @Min(1)
  days!: number;
}

class ListQueryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  take?: number;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vpn: VpnService,
    private readonly subscriptions: SubscriptionsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('users')
  listUsers(@Query() query: ListQueryDto) {
    return this.prisma.user.findMany({
      skip: query.skip ?? 0,
      take: query.take ?? 50,
      orderBy: { createdAt: 'desc' },
      include: { subscriptions: { take: 1, orderBy: { createdAt: 'desc' } }, trial: true },
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
        vpnAccount: { include: { server: true } },
        trial: true,
        subscriptions: { include: { plan: true } },
        devices: true,
        payments: true,
      },
    });
  }

  @Patch('users/:id/block')
  setBlocked(@Param('id') id: string, @Body() dto: SetBlockedDto) {
    return this.prisma.user.update({ where: { id }, data: { isBlocked: dto.isBlocked } });
  }

  @Post('users/:id/vpn/disable')
  disableVpn(@Param('id') id: string) {
    return this.vpn.disable(id);
  }

  @Post('users/:id/vpn/enable')
  enableVpn(@Param('id') id: string) {
    return this.vpn.enable(id);
  }

  @Post('subscriptions/:id/extend')
  async extendSubscription(@Param('id') id: string, @Body() dto: ExtendSubscriptionDto) {
    const sub = await this.prisma.subscription.findUniqueOrThrow({ where: { id } });
    const base = sub.expiresAt && sub.expiresAt > new Date() ? sub.expiresAt : new Date();
    const expiresAt = new Date(base.getTime() + dto.days * 24 * 60 * 60 * 1000);
    return this.prisma.subscription.update({
      where: { id },
      data: { expiresAt, status: 'ACTIVE' },
    });
  }

  @Get('subscriptions')
  listSubscriptions(@Query() query: ListQueryDto) {
    return this.prisma.subscription.findMany({
      skip: query.skip ?? 0,
      take: query.take ?? 50,
      orderBy: { createdAt: 'desc' },
      include: { plan: true, user: true },
    });
  }

  @Get('payments')
  listPayments(@Query() query: ListQueryDto) {
    return this.prisma.payment.findMany({
      skip: query.skip ?? 0,
      take: query.take ?? 50,
      orderBy: { createdAt: 'desc' },
      include: { user: true, plan: true },
    });
  }

  @Post('payments/:id/confirm')
  confirmPayment(@Param('id') id: string) {
    // Manual confirmation path for the "manual" payment provider during MVP —
    // e.g. after verifying a bank transfer by hand.
    return this.payments.adminConfirmPayment(id);
  }

  @Get('vpn-servers')
  listServers() {
    return this.prisma.vpnServer.findMany();
  }

  @Get('devices')
  listDevices(@Query() query: ListQueryDto) {
    return this.prisma.device.findMany({
      skip: query.skip ?? 0,
      take: query.take ?? 50,
      include: { user: true },
    });
  }

  @Get('referrals')
  listReferrals(@Query() query: ListQueryDto) {
    return this.prisma.referral.findMany({
      skip: query.skip ?? 0,
      take: query.take ?? 50,
      include: { referrer: true, referredUser: true, rewards: true },
    });
  }

  @Get('support/tickets')
  listSupportTickets(@Query() query: ListQueryDto) {
    return this.prisma.supportTicket.findMany({
      skip: query.skip ?? 0,
      take: query.take ?? 50,
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  @Patch('support/tickets/:id')
  updateTicketStatus(@Param('id') id: string, @Body() dto: { status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' }) {
    return this.prisma.supportTicket.update({ where: { id }, data: { status: dto.status } });
  }
}
