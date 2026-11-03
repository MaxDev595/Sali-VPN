import { BadRequestException, Body, ConflictException, Controller, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, MaxLength, ValidateNested } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CodesService } from '../codes/codes.service';
import { PaymentsService } from '../payments/payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TrialsService } from '../trials/trials.service';
import { NotificationsService } from '../notifications/notifications.service';
import { formatPublicId } from '../codes/code-format';

class ProfileDto {
  @IsInt() telegramId!: number;
  @IsOptional() @IsString() @MaxLength(64) username?: string;
  @IsOptional() @IsString() @MaxLength(128) firstName?: string;
  @IsOptional() @IsString() @MaxLength(128) lastName?: string;
  @IsOptional() @IsString() @MaxLength(16) languageCode?: string;
}
class TelegramDto { @IsInt() telegramId!: number; }
class StartDto {
  @ValidateNested() @Type(() => ProfileDto) profile!: ProfileDto;
  @IsOptional() @IsString() @MaxLength(64) startParam?: string;
}
class LinkDto extends TelegramDto { @IsString() @Length(8, 16) publicId!: string; }
class PurchaseDto {
  @ValidateNested() @Type(() => ProfileDto) profile!: ProfileDto;
  @IsString() @MaxLength(32) planCode!: string;
  @IsIn(['stars', 'crypto', 'card']) method!: 'stars' | 'crypto' | 'card';
}
class PaymentRefDto extends TelegramDto { @IsString() @Length(36, 36) paymentId!: string; }
class PrecheckDto extends PaymentRefDto { @IsInt() amount!: number; @IsString() currency!: string; }
class StarsPaidDto extends PrecheckDto { @IsString() @MaxLength(256) chargeId!: string; }
class ApplyDto extends TelegramDto {
  @IsString() @Length(12, 40) code!: string;
  @IsOptional() @IsString() @Length(8, 16) publicId?: string;
}

const STARS_PER_USD = Number(process.env.STARS_PER_USD ?? 50);

/**
 * Everything the Telegram bot needs to sell access. Payments live only here:
 * the store app never sees a price, it only redeems codes.
 * Mounted under /internal → never exposed by the public proxy.
 */
@Controller('internal/bot')
@UseGuards(InternalServiceGuard)
export class BotApiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly codes: CodesService,
    private readonly payments: PaymentsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly trials: TrialsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async buyer(profile: ProfileDto) {
    return this.users.findOrCreateByTelegramProfile({ ...profile, telegramId: BigInt(profile.telegramId) });
  }

  private async requireUser(telegramId: number) {
    const user = await this.users.findByTelegramId(BigInt(telegramId));
    if (!user) throw new NotFoundException('Сначала нажмите /start');
    return user;
  }

  private starsFor(plan: { code: string; priceUsd: unknown }) {
    const override = Number(process.env[`STARS_PRICE_${plan.code.toUpperCase()}`]);
    return Number.isFinite(override) && override > 0 ? override : Math.round(Number(plan.priceUsd) * STARS_PER_USD);
  }

  private async accessOf(userId: string) {
    const [sub, trial] = await Promise.all([this.subscriptions.getActiveForUser(userId), this.trials.getTrial(userId)]);
    if (sub) return { tariff: sub.plan.name, until: sub.expiresAt?.toISOString() ?? null, active: true };
    if (trial) {
      const running = trial.activeSince ? Math.floor((Date.now() - trial.activeSince.getTime()) / 1000) : 0;
      const limit = Number(process.env.TRIAL_DURATION_MINUTES ?? 60) * 60 + trial.bonusSeconds;
      const left = Math.max(0, limit - trial.usedSeconds - running);
      return { tariff: 'Бесплатный', until: null, active: left > 0 && trial.status === 'ACTIVE', secondsLeft: left };
    }
    return { tariff: null, until: null, active: false };
  }

  /** /start — registers the customer and, for start=link_<SaliID>, claims the store-app installation. */
  @Post('start')
  async start(@Body() dto: StartDto) {
    const user = await this.buyer(dto.profile);
    let link: { status: string; publicId?: string } | null = null;
    const match = dto.startParam?.match(/^link_([0-9A-Za-z]{8})$/);
    if (match) {
      const result = await this.users.linkAppToTelegram(match[1], BigInt(dto.profile.telegramId));
      link = { status: result.status, publicId: 'app' in result && result.app ? formatPublicId(result.app.publicId) : undefined };
    }
    const apps = await this.users.listLinkedApps(BigInt(dto.profile.telegramId));
    const freeUsed = Boolean(await this.prisma.activationCode.findFirst({ where: { ownerId: user.id, kind: 'FREE' } }));
    return { publicId: formatPublicId(user.publicId), link, linkedApps: apps.length, freeUsed, isBlocked: user.isBlocked };
  }

  @Post('link')
  async link(@Body() dto: LinkDto) {
    await this.requireUser(dto.telegramId);
    const result = await this.users.linkAppToTelegram(dto.publicId, BigInt(dto.telegramId));
    return { status: result.status, publicId: 'app' in result && result.app ? formatPublicId(result.app.publicId) : null };
  }

  /** Devices (store-app installations) claimed by this Telegram account, with their access. */
  @Post('devices')
  async devices(@Body() dto: TelegramDto) {
    const apps = await this.users.listLinkedApps(BigInt(dto.telegramId));
    return Promise.all(apps.map(async (app) => ({ publicId: formatPublicId(app.publicId), linkedAt: app.linkedAt?.toISOString() ?? null, ...(await this.accessOf(app.id)) })));
  }

  @Post('plans')
  async plans() {
    const plans = await this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { durationDays: 'asc' } });
    return plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      durationDays: plan.durationDays,
      priceUsd: Number(plan.priceUsd),
      originalPriceUsd: plan.originalPriceUsd ? Number(plan.originalPriceUsd) : null,
      stars: this.starsFor(plan),
      maxDevices: plan.maxDevices,
    }));
  }

  @Post('purchase')
  async purchase(@Body() dto: PurchaseDto) {
    const user = await this.buyer(dto.profile);
    if (user.isBlocked) throw new BadRequestException('Аккаунт ограничен. Напишите в поддержку');
    const plan = await this.prisma.plan.findFirst({ where: { code: dto.planCode, isActive: true } });
    if (!plan) throw new NotFoundException('Тариф не найден');

    if (dto.method === 'stars') {
      const payment = await this.payments.createStarsPayment(user.id, plan.id);
      return {
        method: 'stars',
        paymentId: payment.id,
        stars: this.starsFor(plan),
        title: `Sali VPN — ${plan.durationDays >= 360 ? '1 год' : '1 месяц'}`,
        description: `Код активации на ${plan.durationDays} дней. Введите его в приложении Sali VPN. До ${plan.maxDevices} устройств.`,
      };
    }
    const result = await this.payments.initiatePurchase(user.id, plan.id, dto.method === 'card' ? 'paddle' : 'crypto', { deliverAsCode: true });
    return {
      method: dto.method,
      paymentId: result.payment.id,
      checkoutUrl: result.checkout.checkoutUrl ?? null,
      cryptoInvoice: result.checkout.cryptoInvoice ?? null,
    };
  }

  /** pre_checkout_query: last chance to refuse a Stars charge. */
  @Post('precheck')
  async precheck(@Body() dto: PrecheckDto) {
    const user = await this.requireUser(dto.telegramId);
    const payment = await this.prisma.payment.findFirst({ where: { id: dto.paymentId, userId: user.id }, include: { plan: true } });
    if (!payment || payment.status !== PaymentStatus.PENDING) return { ok: false, error: 'Счёт устарел. Выберите тариф заново.' };
    if (dto.currency !== 'XTR' || dto.amount !== this.starsFor(payment.plan)) return { ok: false, error: 'Сумма изменилась. Выберите тариф заново.' };
    return { ok: true };
  }

  /** successful_payment for Stars → code (the bot shows it, so no API push). */
  @Post('stars-paid')
  async starsPaid(@Body() dto: StarsPaidDto) {
    const user = await this.requireUser(dto.telegramId);
    const payment = await this.prisma.payment.findFirst({ where: { id: dto.paymentId, userId: user.id } });
    if (!payment) throw new NotFoundException('Платёж не найден');
    await this.payments.confirmSucceeded(payment.id, { silent: true });
    // Keep Telegram's charge id: it is what a Stars refund needs.
    await this.prisma.payment.update({ where: { id: payment.id }, data: { externalPaymentId: dto.chargeId } });
    return { code: await this.payments.codeForPayment(payment.id) };
  }

  @Post('payment-status')
  async paymentStatus(@Body() dto: PaymentRefDto) {
    const user = await this.requireUser(dto.telegramId);
    const payment = await this.payments.getPayment(user.id, dto.paymentId);
    return { status: payment.status, code: payment.status === 'SUCCEEDED' ? await this.payments.codeForPayment(payment.id) : null };
  }

  @Post('free')
  async free(@Body() dto: TelegramDto) {
    const user = await this.requireUser(dto.telegramId);
    return this.codes.issueFree(user.id);
  }

  @Post('codes')
  async list(@Body() dto: TelegramDto) {
    const user = await this.requireUser(dto.telegramId);
    return this.codes.listForOwner(user.id);
  }

  /** "Активировать на моём устройстве": redeem straight onto a linked app, no typing. */
  @Post('apply')
  async apply(@Body() dto: ApplyDto) {
    const apps = await this.users.listLinkedApps(BigInt(dto.telegramId));
    const target = dto.publicId ? apps.find((app) => formatPublicId(app.publicId) === dto.publicId || app.publicId === dto.publicId) : apps.length === 1 ? apps[0] : undefined;
    if (!apps.length) throw new ConflictException('К этому Telegram не привязано ни одно устройство. Откройте приложение → «Привязать Telegram» или введите код в приложении вручную');
    if (!target) return { chooseDevice: apps.map((app) => formatPublicId(app.publicId)) };
    const result = await this.codes.redeem(target.id, dto.code);
    return { ...result, publicId: formatPublicId(target.publicId) };
  }
}
