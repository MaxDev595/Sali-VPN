import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BalanceTxKind, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { REFERRAL_DISCOUNT_PERCENT } from '../referrals/referrals.service';
import { applyBalance, usd } from '../payments/balance';
import { formatPublicId } from '../codes/code-format';

const DAY = 86_400_000;
/** Renew this long before the subscription ends. */
const RENEW_AHEAD_MS = DAY;
/** A subscription that already ended this recently is still renewed (topped up a bit late). */
const RENEW_GRACE_MS = 2 * DAY;
const KIND_LABEL: Record<BalanceTxKind, string> = {
  TOPUP: 'Пополнение', PURCHASE: 'Оплата тарифа', GIFT: 'Подарок другу', AUTO_RENEW: 'Автопродление', REFUND: 'Возврат', ADMIN: 'Корректировка',
};
const dateRu = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Almaty' });

/**
 * Sali balance. The customer tops it up with USDT and spends it only on Sali VPN: tariffs,
 * gifts, and the automatic monthly renewal. It is never paid out — a refund is a support
 * case, sent back by hand to the wallet the money came from.
 */
@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async latestSub(accountId: string) {
    return this.prisma.subscription.findFirst({ where: { userId: accountId }, orderBy: { expiresAt: 'desc' }, include: { plan: true } });
  }

  async info(accountId: string) {
    const [user, history] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: accountId }, select: { balanceUsd: true, autoRenewPlanId: true } }),
      this.prisma.balanceTx.findMany({ where: { userId: accountId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    const plan = user.autoRenewPlanId ? await this.prisma.plan.findUnique({ where: { id: user.autoRenewPlanId } }) : null;
    const sub = await this.subscriptions.getActiveForUser(accountId);
    return {
      balanceUsd: Number(user.balanceUsd),
      autoRenew: plan ? { planCode: plan.code, name: plan.name, durationDays: plan.durationDays, priceUsd: Number(plan.priceUsd) } : null,
      nextRenewalAt: plan && sub?.expiresAt ? new Date(sub.expiresAt.getTime() - RENEW_AHEAD_MS).toISOString() : null,
      subscriptionUntil: sub?.expiresAt?.toISOString() ?? null,
      history: history.map((t) => ({ id: t.id, at: t.createdAt.toISOString(), kind: t.kind, label: KIND_LABEL[t.kind], amountUsd: Number(t.amountUsd), balanceAfter: Number(t.balanceAfter), note: t.note })),
    };
  }

  /**
   * Buy a tariff (or gift it) from the balance. Same price as paying by transfer: the better of
   * the promo code and the referral discount; the referral discount is used up.
   */
  async buy(accountId: string, planCode: string, options: { giftToUserId?: string; giftLabel?: string; promo?: { id: string; percent: number }; rewardOwnerIds?: string[] } = {}) {
    const plan = await this.prisma.plan.findFirst({ where: { code: planCode, isActive: true } });
    if (!plan) throw new NotFoundException('Тариф не найден');
    const target = options.giftToUserId ?? accountId;
    const owners = options.rewardOwnerIds?.length ? options.rewardOwnerIds : [accountId];

    const charged = await this.prisma.$transaction(async (tx) => {
      const reward = await tx.referralReward.findFirst({ where: { userId: { in: owners }, kind: 'discount_percent', paymentId: null, consumedAt: null }, orderBy: { grantedAt: 'asc' } });
      const promoWins = Boolean(options.promo && options.promo.percent > (reward ? REFERRAL_DISCOUNT_PERCENT : 0));
      const percent = promoWins ? Math.min(90, options.promo!.percent) : reward ? REFERRAL_DISCOUNT_PERCENT : 0;
      const price = Math.round(Number(plan.priceUsd) * (100 - percent)) / 100;
      const row = await applyBalance(tx, accountId, -price, options.giftToUserId ? 'GIFT' : 'PURCHASE', {
        planId: plan.id,
        note: `${plan.name}${options.giftLabel ? ` → ${options.giftLabel}` : ''}${percent ? ` · −${percent}%` : ''}`,
      });
      if (reward && !promoWins) {
        const used = await tx.referralReward.updateMany({ where: { id: reward.id, consumedAt: null }, data: { consumedAt: new Date() } });
        if (used.count !== 1) throw new BadRequestException('Скидка уже использована — попробуйте ещё раз');
      }
      if (promoWins) {
        await tx.promoRedemption.create({ data: { promoId: options.promo!.id, accountId } });
        await tx.promoCode.update({ where: { id: options.promo!.id }, data: { usedCount: { increment: 1 } } });
      }
      return { price, percent, balanceAfter: Number(row.balanceAfter) };
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new BadRequestException('Вы уже использовали этот промокод');
      throw error;
    });

    try {
      const sub = await this.subscriptions.grantDays(target, plan.id, plan.durationDays, 'balance');
      if (options.giftToUserId) {
        await this.notifications.sendHtml(target, `🎁 <b>Вам подарили Sali VPN!</b>\n\nПодписка <b>${plan.name}</b> активна до ${sub.expiresAt ? dateRu(sub.expiresAt) : '—'}. Откройте приложение Sali VPN и нажмите «Включить».`).catch(() => false);
      }
      return { plan: plan.name, priceUsd: charged.price, discountPercent: charged.percent, balanceUsd: charged.balanceAfter, until: sub.expiresAt?.toISOString() ?? null, gift: Boolean(options.giftToUserId) };
    } catch (error) {
      // Nothing was granted: the money goes back onto the balance.
      await this.prisma.$transaction((tx) => applyBalance(tx, accountId, charged.price, 'REFUND', { planId: plan.id, note: 'Не удалось начислить подписку — деньги возвращены' }));
      throw error;
    }
  }

  async setAutoRenew(accountId: string, planCode: string | null) {
    if (!planCode) {
      await this.prisma.user.update({ where: { id: accountId }, data: { autoRenewPlanId: null } });
      return this.info(accountId);
    }
    const plan = await this.prisma.plan.findFirst({ where: { code: planCode, isActive: true } });
    if (!plan) throw new NotFoundException('Тариф не найден');
    await this.prisma.user.update({ where: { id: accountId }, data: { autoRenewPlanId: plan.id, autoRenewNoticeAt: null } });
    return this.info(accountId);
  }

  /** Admin: put money on or take it off the balance (with a reason). */
  async adjust(accountId: string, amountUsd: number, note: string) {
    if (!Number.isFinite(amountUsd) || amountUsd === 0 || Math.abs(amountUsd) > 10_000) throw new BadRequestException('Сумма: от −10000 до 10000, не 0');
    const row = await this.prisma.$transaction((tx) => applyBalance(tx, accountId, amountUsd, amountUsd > 0 ? 'ADMIN' : 'REFUND', { note: note.slice(0, 200) || 'Администратор' }));
    return { balanceUsd: Number(row.balanceAfter) };
  }

  /**
   * Automatic renewal: a day before the subscription ends (or up to two days after, if the
   * balance was topped up late) the chosen tariff is bought from the balance. Not enough →
   * one reminder in Telegram per period.
   */
  @Cron('30 7 * * * *')
  async renewDue(now = new Date()) {
    const accounts = await this.prisma.user.findMany({ where: { autoRenewPlanId: { not: null }, isBlocked: false }, select: { id: true, autoRenewPlanId: true, autoRenewNoticeAt: true, balanceUsd: true, publicId: true } });
    let renewed = 0;
    for (const account of accounts) {
      try {
        const sub = await this.latestSub(account.id);
        if (!sub?.expiresAt || (sub.status !== SubscriptionStatus.ACTIVE && sub.status !== SubscriptionStatus.EXPIRED)) continue;
        const left = sub.expiresAt.getTime() - now.getTime();
        if (left > RENEW_AHEAD_MS || left < -RENEW_GRACE_MS) continue;
        const plan = await this.prisma.plan.findFirst({ where: { id: account.autoRenewPlanId!, isActive: true } });
        if (!plan) { await this.prisma.user.update({ where: { id: account.id }, data: { autoRenewPlanId: null } }); continue; }
        const price = Number(plan.priceUsd);
        if (Number(account.balanceUsd) < price) {
          const noticed = account.autoRenewNoticeAt && now.getTime() - account.autoRenewNoticeAt.getTime() < 3 * DAY;
          if (!noticed) {
            await this.notifications.sendHtml(account.id, `⚠️ <b>Не хватает денег для автопродления</b>\n\nНа балансе $${usd(account.balanceUsd)}, а ${plan.name} стоит $${usd(price)}. Подписка ${left > 0 ? `закончится ${dateRu(sub.expiresAt)}` : 'закончилась'}.\n\nПополните баланс в приложении: «Подписка» → «Баланс».`).catch(() => false);
            await this.prisma.user.update({ where: { id: account.id }, data: { autoRenewNoticeAt: now } });
          }
          continue;
        }
        const done = await this.prisma.$transaction((tx) => applyBalance(tx, account.id, -price, 'AUTO_RENEW', { planId: plan.id, note: plan.name }));
        try {
          const next = await this.subscriptions.grantDays(account.id, plan.id, plan.durationDays, 'balance');
          await this.prisma.user.update({ where: { id: account.id }, data: { autoRenewNoticeAt: null } });
          await this.notifications.sendHtml(account.id, `🔄 <b>Подписка продлена</b>\n\n${plan.name} — списано $${usd(price)} с баланса. Подписка до ${next.expiresAt ? dateRu(next.expiresAt) : '—'}, на балансе $${usd(done.balanceAfter)}.`).catch(() => false);
          renewed += 1;
        } catch (error) {
          await this.prisma.$transaction((tx) => applyBalance(tx, account.id, price, 'REFUND', { planId: plan.id, note: 'Автопродление не прошло — деньги возвращены' }));
          throw error;
        }
      } catch (error) {
        this.logger.warn(`auto-renew ${formatPublicId(account.publicId)}: ${(error as Error).message}`);
      }
    }
    if (renewed) this.logger.log(`auto-renewed ${renewed} subscription(s) from the balance`);
    return renewed;
  }
}
