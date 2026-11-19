import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus, PromoKind } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NodesService } from '../vpn/nodes/nodes.service';
import { AdminBotService, FOREVER_DAYS, type PeopleSegment } from '../admin-bot/admin-bot.service';
import { formatPublicId, parseDeviceId } from '../codes/code-format';
import { PromoService } from './promo.service';
import { BalanceService } from './balance.service';
import { ConfigService } from '@nestjs/config';
import { BALANCE_WALLET_DEFAULT } from '../payments/providers/crypto.provider';

class LookupDto { @IsString() @MaxLength(80) query!: string; }
class UserDto { @IsString() @MaxLength(40) userId!: string; }
class GrantDto extends UserDto {
  @IsInt() @Min(1) @Max(FOREVER_DAYS) days!: number;
  @IsIn(['admin', 'gift']) kind!: 'admin' | 'gift';
  @IsOptional() @IsString() @MaxLength(700) message?: string;
}
class BlockDto extends UserDto { @IsBoolean() isBlocked!: boolean; }
class PeopleQuery {
  @IsIn(['paid', 'granted', 'trial', 'expired']) segment!: PeopleSegment;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000) page?: number;
}
class PromoCreateDto {
  @IsString() @MaxLength(40) code!: string;
  @IsIn(['DAYS', 'DISCOUNT']) kind!: PromoKind;
  @IsOptional() @IsInt() days?: number;
  @IsOptional() @IsInt() discountPercent?: number;
  @IsOptional() @IsInt() @Min(0) maxUses?: number;
  @IsOptional() @IsInt() @Min(0) @Max(3650) expiresInDays?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
class ToggleDto { @IsBoolean() isActive!: boolean; }
class AdjustDto extends UserDto { @IsNumber({ maxDecimalPlaces: 2 }) amountUsd!: number; @IsString() @MaxLength(200) note!: string; }

/**
 * Admin panel inside the app — only for accounts whose Telegram is in ADMIN_TELEGRAM_IDS.
 * Same actions as the bot's /admin (it reuses the same service), plus promo codes.
 */
@Controller('app/admin')
@UseGuards(JwtAuthGuard)
export class AppAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nodes: NodesService,
    private readonly admin: AdminBotService,
    private readonly promos: PromoService,
    private readonly balance: BalanceService,
    private readonly config: ConfigService,
  ) {}

  /** The account a card belongs to (a device card → its Telegram account). */
  private async accountOf(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, linkedTelegramId: true } });
    if (!u) return null;
    return u.linkedTelegramId ? (await this.prisma.user.findUnique({ where: { telegramId: u.linkedTelegramId }, select: { id: true } }))?.id ?? u.id : u.id;
  }

  /** Telegram ID of the admin behind this installation, or 403. */
  private async adminId(userId: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true, linkedTelegramId: true } });
    const tg = me?.telegramId ?? me?.linkedTelegramId;
    if (!tg || !this.nodes.isAdmin(tg)) throw new ForbiddenException('Только для администратора');
    return Number(tg);
  }

  @Get('stats')
  async stats(@CurrentUser() user: AuthTokenPayload) {
    const stats = await this.admin.stats(await this.adminId(user.sub));
    // Sali balances: top-ups land in the balance wallet; what customers spent from it belongs to the main wallet.
    const [held, kinds] = await Promise.all([
      this.prisma.user.aggregate({ _sum: { balanceUsd: true }, where: { balanceUsd: { gt: 0 } } }),
      this.prisma.balanceTx.groupBy({ by: ['kind'], _sum: { amountUsd: true } }),
    ]);
    const sum = (k: string) => Number(kinds.find((r) => r.kind === k)?._sum.amountUsd ?? 0);
    const spent = -(sum('PURCHASE') + sum('GIFT') + sum('AUTO_RENEW')) - sum('REFUND');
    return {
      ...stats,
      balances: {
        wallet: this.config.get<string>('CRYPTO_TON_BALANCE_ADDRESS')?.trim() || BALANCE_WALLET_DEFAULT,
        held: Number(held._sum.balanceUsd ?? 0),
        toppedUp: sum('TOPUP'),
        spent: Math.round(spent * 100) / 100,
      },
    };
  }

  @Get('people')
  async people(@CurrentUser() user: AuthTokenPayload, @Query() q: PeopleQuery) {
    return this.admin.people(await this.adminId(user.sub), q.segment, q.page ?? 0);
  }

  /** @username, Telegram ID, Sali ID (SL-XXXX-XXXX) or a device label (D-XXXXXX). */
  @Post('lookup')
  async lookup(@CurrentUser() user: AuthTokenPayload, @Body() dto: LookupDto) {
    const adminId = await this.adminId(user.sub);
    let query = dto.query;
    const device = parseDeviceId(query);
    if (device) {
      const row = await this.prisma.user.findFirst({ where: { id: { startsWith: device } }, select: { id: true } });
      if (row) query = row.id;
    }
    const card = await this.admin.lookup(adminId, query);
    const accountId = await this.accountOf(card.id);
    const balance = accountId ? await this.prisma.user.findUnique({ where: { id: accountId }, select: { balanceUsd: true, autoRenewPlanId: true } }) : null;
    return { ...card, accountId, balanceUsd: balance ? Number(balance.balanceUsd) : 0, autoRenew: Boolean(balance?.autoRenewPlanId) };
  }

  /** Runs the automatic renewal from balances now (it also runs every hour by itself). */
  @Post('renew-now')
  async renewNow(@CurrentUser() user: AuthTokenPayload) {
    await this.adminId(user.sub);
    return { renewed: await this.balance.renewDue() };
  }

  /** Put money on / take it off a balance (refund by hand, compensation). */
  @Post('balance')
  async adjustBalance(@CurrentUser() user: AuthTokenPayload, @Body() dto: AdjustDto) {
    await this.adminId(user.sub);
    const accountId = await this.accountOf(dto.userId);
    if (!accountId) throw new ForbiddenException('Пользователь не найден');
    return this.balance.adjust(accountId, dto.amountUsd, dto.note);
  }

  @Post('grant')
  async grant(@CurrentUser() user: AuthTokenPayload, @Body() dto: GrantDto) {
    return this.admin.grant(await this.adminId(user.sub), dto.userId, dto.days, dto.kind, dto.message);
  }

  @Post('revoke')
  async revoke(@CurrentUser() user: AuthTokenPayload, @Body() dto: UserDto) {
    return this.admin.revoke(await this.adminId(user.sub), dto.userId);
  }

  @Post('block')
  async block(@CurrentUser() user: AuthTokenPayload, @Body() dto: BlockDto) {
    return this.admin.setBlocked(await this.adminId(user.sub), dto.userId, dto.isBlocked);
  }

  @Get('payments')
  async payments(@CurrentUser() user: AuthTokenPayload) {
    await this.adminId(user.sub);
    const rows = await this.prisma.payment.findMany({
      where: { status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED] } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { plan: true, user: { select: { publicId: true, username: true, firstName: true } } },
    });
    const giftIds = rows.map((r) => r.giftToUserId).filter((v): v is string => Boolean(v));
    const gifts = new Map((await this.prisma.user.findMany({ where: { id: { in: giftIds } }, select: { id: true, publicId: true } })).map((u) => [u.id, formatPublicId(u.publicId)]));
    return rows.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      status: r.status,
      amountUsd: Number(r.amountUsd),
      discountPercent: r.discountPercent,
      method: r.provider,
      plan: r.plan.name,
      account: formatPublicId(r.user.publicId),
      name: r.user.username ? `@${r.user.username}` : r.user.firstName ?? null,
      giftTo: r.giftToUserId ? gifts.get(r.giftToUserId) ?? '—' : null,
    }));
  }

  @Get('promos')
  async promoList(@CurrentUser() user: AuthTokenPayload) {
    await this.adminId(user.sub);
    return this.promos.list();
  }

  @Post('promos')
  async promoCreate(@CurrentUser() user: AuthTokenPayload, @Body() dto: PromoCreateDto) {
    const adminId = await this.adminId(user.sub);
    return this.promos.create(dto, String(adminId));
  }

  @Post('promos/:id/active')
  async promoToggle(@CurrentUser() user: AuthTokenPayload, @Param('id') id: string, @Body() dto: ToggleDto) {
    await this.adminId(user.sub);
    return this.promos.setActive(id, dto.isActive);
  }
}
