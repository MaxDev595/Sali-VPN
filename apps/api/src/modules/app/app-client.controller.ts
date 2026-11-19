import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TrialsService } from '../trials/trials.service';
import { ReferralsService, REFERRAL_DISCOUNT_PERCENT, REFERRAL_FRIEND_BONUS_HOURS } from '../referrals/referrals.service';
import { formatDeviceId, formatPublicId, normalizePublicId } from '../codes/code-format';
import { PromoService } from './promo.service';
import { HappService } from '../happ/happ.service';

class PurchaseDto {
  @IsString() @MaxLength(32) planCode!: string;
  /** Sali ID of the friend who gets the subscription. */
  @IsOptional() @IsString() @MaxLength(20) giftTo?: string;
  /** A DISCOUNT promo code. */
  @IsOptional() @IsString() @MaxLength(40) promo?: string;
}
class PromoDto { @IsString() @Length(3, 40) code!: string; }
class RemoveDeviceDto { @IsString() @Length(36, 36) key!: string; }

const SITE = (process.env.PUBLIC_SITE_URL ?? 'https://salivpn.com').replace(/\/$/, '');
const CHANNEL = (process.env.NEWS_CHANNEL_URL || 'https://t.me/SaliVpnNews').replace(/\/$/, '');
const CHANNEL_TAG = `@${CHANNEL.split('/').pop()}`;
/** 24 → «1 день», 48 → «2 дня», 3 → «3 часа». */
const bonusWords = (hours: number) => {
  const plural = (n: number, one: string, few: string, many: string) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
  if (hours % 24 === 0) { const d = hours / 24; return `${d} ${plural(d, 'день', 'дня', 'дней')}`; }
  return `${hours} ${plural(hours, 'час', 'часа', 'часов')}`;
};
const days = (d: Date | null) => (d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000)) : null);

/**
 * Everything a customer does lives in the app now: tariffs, paying (USDT on TON), gifts,
 * promo codes, inviting friends, devices. The Telegram bot is only where an account is
 * linked (one tap) — paying needs that link, the free 3 days do not.
 *
 * Account = the Telegram user once linked, otherwise the installation itself. It has one
 * Sali ID for life; devices only carry a technical label (D-XXXXXX).
 */
@Controller('app')
@UseGuards(JwtAuthGuard)
export class AppClientController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly trials: TrialsService,
    private readonly referrals: ReferralsService,
    private readonly promos: PromoService,
    private readonly happ: HappService,
  ) {}

  /** This installation, its account and every row of that account. */
  private async context(userId: string) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const tg = me.telegramId ?? me.linkedTelegramId;
    const account = tg ? (await this.prisma.user.findUnique({ where: { telegramId: tg } })) ?? me : me;
    const family = tg
      ? (await this.prisma.user.findMany({ where: { OR: [{ telegramId: tg }, { linkedTelegramId: tg }] }, select: { id: true } })).map((u) => u.id)
      : [me.id];
    if (!family.includes(me.id)) family.push(me.id);
    return { me, tg, account, family };
  }

  private async discountWaiting(family: string[]) {
    return Boolean(await this.prisma.referralReward.findFirst({ where: { userId: { in: family }, kind: 'discount_percent', paymentId: null, consumedAt: null } }));
  }

  @Get('plans')
  async plans(@CurrentUser() user: AuthTokenPayload) {
    const { family, tg } = await this.context(user.sub);
    const plans = await this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { durationDays: 'asc' } });
    const discountPercent = (await this.discountWaiting(family)) ? REFERRAL_DISCOUNT_PERCENT : 0;
    return {
      telegramLinked: Boolean(tg),
      currency: 'USDT',
      discountPercent,
      plans: plans.map((p) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        durationDays: p.durationDays,
        /** Price per 30 days, to compare tariffs. */
        perMonthUsd: Math.round(Number(p.priceUsd) / p.durationDays * 30 * 100) / 100,
        priceUsd: Number(p.priceUsd),
        originalPriceUsd: p.originalPriceUsd ? Number(p.originalPriceUsd) : null,
        maxDevices: p.maxDevices,
        discountedPriceUsd: discountPercent ? Math.round(Number(p.priceUsd) * (100 - discountPercent)) / 100 : null,
      })),
    };
  }

  /** Who a gift goes to: any Sali ID — the account behind it gets the days. */
  @Post('gift/check')
  async checkGift(@CurrentUser() user: AuthTokenPayload, @Body() dto: PromoDto) {
    const { account } = await this.context(user.sub);
    const to = await this.recipient(dto.code, account.id);
    return { to: formatPublicId(to.publicId), name: to.firstName ?? null };
  }

  private async recipient(raw: string, buyerAccountId: string) {
    const id = normalizePublicId(raw);
    if (id.length !== 8) throw new BadRequestException('Sali ID выглядит так: SL-XXXX-XXXX');
    const row = await this.prisma.user.findUnique({ where: { publicId: id } });
    if (!row) throw new NotFoundException('Такого Sali ID нет. Попросите друга открыть приложение и прислать номер из «Профиля»');
    const tg = row.telegramId ?? row.linkedTelegramId;
    const to = tg ? (await this.prisma.user.findUnique({ where: { telegramId: tg } })) ?? row : row;
    if (to.id === buyerAccountId) throw new BadRequestException('Это ваш собственный Sali ID. Для себя — просто выберите тариф');
    if (to.isBlocked) throw new BadRequestException('Этому аккаунту нельзя подарить подписку');
    return to;
  }

  /** «Оплатить»: a USDT (TON) invoice. Paying needs a linked Telegram account. */
  @Post('purchase')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async purchase(@CurrentUser() user: AuthTokenPayload, @Body() dto: PurchaseDto) {
    const { tg, account, family } = await this.context(user.sub);
    if (!tg) throw new ForbiddenException({ message: 'Привяжите Telegram, чтобы оплатить: подписка будет на вашем аккаунте и не пропадёт', code: 'TELEGRAM_REQUIRED' });
    if (account.isBlocked) throw new ForbiddenException('Аккаунт ограничен. Напишите в поддержку');
    const plan = await this.prisma.plan.findFirst({ where: { code: dto.planCode, isActive: true } });
    if (!plan) throw new NotFoundException('Тариф не найден');
    const to = dto.giftTo ? await this.recipient(dto.giftTo, account.id) : null;
    const promo = dto.promo ? await this.promos.discountFor(dto.promo, account.id) : undefined;

    const result = await this.payments.initiatePurchase(account.id, plan.id, 'crypto', { deliverAsCode: true, giftToUserId: to?.id, promo, rewardOwnerIds: family });
    const invoice = result.checkout.cryptoInvoice;
    if (!invoice) throw new ConflictException('Не удалось выставить счёт. Попробуйте ещё раз');
    const tonUrl = invoice.paymentUrl;
    return {
      paymentId: result.payment.id,
      plan: { code: plan.code, name: plan.name, durationDays: plan.durationDays },
      gift: to ? formatPublicId(to.publicId) : null,
      discountPercent: result.payment.discountPercent ?? 0,
      amount: invoice.amount,
      asset: invoice.asset,
      network: invoice.network,
      address: invoice.address,
      comment: invoice.reference,
      expiresAt: invoice.expiresAt,
      tonUrl,
      tonkeeperUrl: tonUrl ? tonUrl.replace(/^ton:\/\/transfer\//, 'https://app.tonkeeper.com/transfer/') : null,
    };
  }

  /** The app asks every few seconds while the invoice is open; the network watcher confirms it. */
  @Get('payments/:id')
  async payment(@CurrentUser() user: AuthTokenPayload, @Param('id') id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Платёж не найден');
    const { account } = await this.context(user.sub);
    const payment = await this.payments.getPayment(account.id, id).catch(() => null);
    if (!payment) throw new NotFoundException('Платёж не найден');
    if (payment.status === PaymentStatus.SUCCEEDED) await this.payments.activateOnAccount(id).catch(() => undefined);
    const full = await this.prisma.payment.findUniqueOrThrow({ where: { id }, include: { plan: true, cryptoInvoice: true } });
    const sub = payment.status === PaymentStatus.SUCCEEDED ? await this.subscriptions.getOwnActive(full.giftToUserId ?? account.id) : null;
    return {
      status: payment.status,
      expired: payment.status === PaymentStatus.PENDING && Boolean(full.cryptoInvoice && full.cryptoInvoice.expiresAt <= new Date()),
      plan: full.plan.name,
      gift: Boolean(full.giftToUserId),
      until: sub?.expiresAt?.toISOString() ?? null,
    };
  }

  /**
   * «Промокод»: a promo code from the admin, or a friend's Sali ID (an invitation — the friend
   * gets +N hours, the inviter a discount on their next purchase).
   */
  @Post('promo')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async promo(@CurrentUser() user: AuthTokenPayload, @Body() dto: PromoDto) {
    const { me, account, family } = await this.context(user.sub);
    const looksLikeId = /^SL[-\s]?[0-9A-Z]{4}[-\s]?[0-9A-Z]{4}$/i.test(dto.code.trim());
    if (!looksLikeId || (await this.promos.exists(dto.code))) return this.promos.apply(dto.code, account.id);

    const ref = await this.prisma.user.findUnique({ where: { publicId: normalizePublicId(dto.code) } });
    if (!ref) throw new NotFoundException('Такого Sali ID нет');
    const refTg = ref.telegramId ?? ref.linkedTelegramId;
    const referrer = refTg ? (await this.prisma.user.findUnique({ where: { telegramId: refTg } })) ?? ref : ref;
    if (family.includes(referrer.id)) throw new BadRequestException('Это ваш собственный Sali ID — отправьте его друзьям');
    if (await this.prisma.referral.findFirst({ where: { referredUserId: { in: family } } })) throw new ConflictException('Приглашение уже было использовано на этом аккаунте');
    if (await this.prisma.payment.count({ where: { userId: { in: family }, status: PaymentStatus.SUCCEEDED } })) throw new ConflictException('Приглашение работает только для новых пользователей');
    await this.prisma.referral.create({ data: { referrerId: referrer.id, referredUserId: account.id } });
    // The bonus needs time to land on: the subscription, or the free 3 days already running.
    const holder = (await this.subscriptions.getOwnActive(account.id)) ? account.id : (await this.trials.getTrial(me.id)) ? me.id : null;
    if (holder) await this.referrals.rewardIfEligible(account.id, holder).catch(() => undefined);
    return { kind: 'REFERRAL' as const, from: formatPublicId(referrer.publicId), bonusHours: REFERRAL_FRIEND_BONUS_HOURS, pending: !holder };
  }

  /** «Пригласить друга». */
  @Get('referrals')
  async referralInfo(@CurrentUser() user: AuthTokenPayload) {
    const { account, family } = await this.context(user.sub);
    const [invited, rewards] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: { in: family } } }),
      this.prisma.referralReward.findMany({ where: { userId: { in: family }, kind: 'discount_percent' } }),
    ]);
    const code = formatPublicId(account.publicId);
    return {
      code,
      invited,
      rewarded: rewards.length,
      availableDiscounts: rewards.filter((r) => !r.paymentId && !r.consumedAt).length,
      discountPercent: REFERRAL_DISCOUNT_PERCENT,
      friendBonusHours: REFERRAL_FRIEND_BONUS_HOURS,
      channel: CHANNEL,
      channelTag: CHANNEL_TAG,
      // Plain text for any messenger: short lines, numbered steps, the code on its own line.
      shareText: [
        'Sali VPN — быстрый VPN без рекламы и логов',
        '',
        `Дарю тебе +${bonusWords(REFERRAL_FRIEND_BONUS_HOURS)} к бесплатным 3 дням:`,
        '',
        `1. Скачай приложение: ${SITE}/download`,
        '2. Нажми «Включить» — 3 дня бесплатно',
        '3. Введи мой код в «Подписка → Промокод»:',
        '',
        code,
        '',
        `Наш канал: ${CHANNEL_TAG} — ${CHANNEL.replace(/^https:\/\//, '')}`,
      ].join('\n'),
    };
  }

  /**
   * «Запасное подключение»: the account's personal VLESS (Reality) subscription — for Happ and
   * for any other Xray client (v2RayTun, Hiddify). Works when the Sali app's own tunnel is
   * blocked. Needs a linked Telegram (the link belongs to the account) and an active access.
   */
  @Get('backup')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async backup(@CurrentUser() user: AuthTokenPayload) {
    const { tg } = await this.context(user.sub);
    if (!this.happ.enabled) return { enabled: false as const };
    if (!tg) return { enabled: true as const, linked: false as const };
    try {
      const link = await this.happ.link(Number(tg));
      const name = encodeURIComponent('Sali VPN');
      return {
        enabled: true as const,
        linked: true as const,
        access: true as const,
        url: link.url,
        servers: link.servers,
        expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString() : null,
        open: {
          happ: `happ://add/${link.url}`,
          v2raytun: `v2raytun://import/${link.url}`,
          hiddify: `hiddify://import/${link.url}#${name}`,
        },
      };
    } catch (error) {
      if (error instanceof ForbiddenException) return { enabled: true as const, linked: true as const, access: false as const, message: (error.getResponse() as { message?: string }).message ?? 'Нет активного доступа' };
      throw error;
    }
  }

  /** New backup link: the old one stops working at once (if it leaked). */
  @Post('backup/reset')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async backupReset(@CurrentUser() user: AuthTokenPayload) {
    const { tg } = await this.context(user.sub);
    if (!tg) throw new BadRequestException('Сначала привяжите Telegram');
    await this.happ.rotate(Number(tg));
    return this.backup(user);
  }

  /** Devices of the account: a label each (not an ID), which share the subscription, removal. */
  @Get('devices')
  async devices(@CurrentUser() user: AuthTokenPayload) {
    const { me, tg } = await this.context(user.sub);
    const names = async (ids: string[]) => new Map((await this.prisma.device.findMany({ where: { userId: { in: ids } }, orderBy: { createdAt: 'asc' }, select: { userId: true, name: true, platform: true, lastActiveAt: true } })).map((d) => [d.userId, d]));
    if (!tg) {
      const d = (await names([me.id])).get(me.id);
      return { linked: false, max: 3, used: 1, devices: [{ key: me.id, id: formatDeviceId(me.id), name: d?.name ?? null, platform: d?.platform ?? null, current: true, covered: true, idleDays: days(d?.lastActiveAt ?? null) }] };
    }
    const family = await this.subscriptions.sharing(tg);
    const info = await names(family.devices.map((d) => d.id));
    return {
      linked: true,
      max: family.max || 3,
      used: family.used,
      devices: family.devices.map((d) => ({
        key: d.id,
        id: formatDeviceId(d.id),
        name: info.get(d.id)?.name ?? null,
        platform: d.platform,
        current: d.id === me.id,
        covered: d.covered || d.ownSub || !family.sub,
        idleDays: days(d.lastActiveAt),
      })),
    };
  }

  @Post('devices/remove')
  async removeDevice(@CurrentUser() user: AuthTokenPayload, @Body() dto: RemoveDeviceDto) {
    const { me, tg } = await this.context(user.sub);
    if (!tg) throw new BadRequestException('Удалять устройства можно после привязки Telegram');
    if (dto.key === me.id) throw new BadRequestException('Это устройство, с которого вы сейчас зашли');
    const app = await this.subscriptions.unlinkInstallation(tg, dto.key);
    if (!app) throw new NotFoundException('Устройство не найдено');
    return { ok: true };
  }
}
