import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentProvider } from './providers/payment-provider.interface';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ManualPaymentProvider } from './providers/manual.provider';
import { TelegramStarsPaymentProvider } from './providers/telegram-stars.provider';
import { PaddlePaymentProvider } from './providers/paddle.provider';
import { CryptoPaymentProvider } from './providers/crypto.provider';
import { GooglePlayService } from './google-play.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly manual: ManualPaymentProvider,
    private readonly stars: TelegramStarsPaymentProvider,
    private readonly paddle: PaddlePaymentProvider,
    private readonly crypto: CryptoPaymentProvider,
    private readonly googlePlay: GooglePlayService,
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  async verifyGooglePlay(userId: string, planId: string, productId: string, purchaseToken: string) {
    const expected = process.env.GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID ?? 'sali_pro_monthly';
    if (productId !== expected) throw new NotFoundException('Google Play product not found');
    const expiry = await this.googlePlay.verify(purchaseToken, expected);
    const existing = await this.prisma.payment.findFirst({ where: { provider: 'google_play', externalPaymentId: purchaseToken } });
    if (existing) {
      if (existing.userId !== userId) throw new NotFoundException('Payment not found');
      return existing;
    }
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: planId } });
    const subscription = await this.prisma.subscription.create({ data: { userId, planId, status: SubscriptionStatus.PENDING_PAYMENT } });
    const payment = await this.prisma.payment.create({ data: { userId, planId, subscriptionId: subscription.id, provider: 'google_play', externalPaymentId: purchaseToken, amountUsd: plan.priceUsd, status: PaymentStatus.SUCCEEDED } });
    await this.subscriptions.activate(subscription.id, plan.durationDays);
    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { expiresAt: expiry, autoRenew: true, provider: 'google_play', externalSubscriptionId: purchaseToken } });
    await this.notifications.enqueue(userId, 'SUBSCRIPTION_ACTIVATED');
    return payment;
  }

  /** Step 1: user taps "Buy subscription" — creates a PENDING payment + subscription. */
  private selectProvider(name?: string): PaymentProvider {
    const selected = name ?? process.env.PAYMENT_PROVIDER ?? 'manual';
    const providers: Record<string, PaymentProvider> = { manual: this.manual, telegram_stars: this.stars, paddle: this.paddle, crypto: this.crypto };
    const provider = providers[selected];
    if (!provider) throw new NotFoundException('Payment provider not found');
    return provider;
  }

  async initiatePurchase(userId: string, planId: string, providerName?: string) {
    const provider = this.selectProvider(providerName);
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: planId } });
    const fullAmount = Number(plan.priceUsd);

    const reserved = await this.prisma.$transaction(async (tx) => {
      const reward = await tx.referralReward.findFirst({
        where: { userId, kind: 'discount_percent', paymentId: null, consumedAt: null },
        orderBy: { grantedAt: 'asc' },
      });
      const subscription = await tx.subscription.create({
        data: { userId, planId, status: SubscriptionStatus.PENDING_PAYMENT },
      });
      const payment = await tx.payment.create({
        data: {
          userId,
          planId,
          subscriptionId: subscription.id,
          provider: provider.name,
          amountUsd: plan.priceUsd,
          status: PaymentStatus.PENDING,
        },
      });

      let discountPercent = 0;
      if (reward) {
        const claimed = await tx.referralReward.updateMany({
          where: { id: reward.id, paymentId: null, consumedAt: null },
          data: { paymentId: payment.id },
        });
        if (claimed.count === 1) discountPercent = reward.amount;
      }
      const amountUsd = Math.round(fullAmount * (1 - discountPercent / 100) * 100) / 100;
      const pricedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { amountUsd, discountPercent },
      });
      return { subscription, payment: pricedPayment, amountUsd };
    }, { isolationLevel: 'Serializable' });

    let result;
    try {
      result = await provider.createPayment({
        userId, planId, amountUsd: reserved.amountUsd,
        metadata: { paymentId: reserved.payment.id, userId, planId },
      });
    } catch (error) {
      await this.markFailed(reserved.payment.id, 'Payment provider initialization failed');
      throw error;
    }

    const payment = await this.prisma.payment.update({
      where: { id: reserved.payment.id },
      data: {
        externalPaymentId: result.externalPaymentId,
        status: result.status === 'SUCCEEDED' ? PaymentStatus.SUCCEEDED : PaymentStatus.PENDING,
      },
    });

    if (result.status === 'SUCCEEDED') {
      await this.confirmSucceeded(payment.id);
    }

    return { payment, subscription: reserved.subscription, checkout: result };
  }

  /** Step 2: called by a webhook / bot successful_payment update / admin confirmation. */
  async confirmByExternalId(externalPaymentId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { externalPaymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.confirmSucceeded(payment.id);
  }

  /** Used by the admin API to manually confirm a "manual" provider payment. */
  async adminConfirmPayment(paymentId: string) {
    return this.confirmSucceeded(paymentId);
  }

  async confirmSucceeded(paymentId: string) {
    const current = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { plan: true } });
    if (current.status === PaymentStatus.SUCCEEDED) return current;
    const payment = await this.prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.SUCCEEDED }, include: { plan: true } });

    if (payment.subscriptionId) {
      await this.subscriptions.activate(payment.subscriptionId, payment.plan.durationDays);
      await this.notifications.enqueue(payment.userId, 'SUBSCRIPTION_ACTIVATED');
    }

    await this.prisma.referralReward.updateMany({
      where: { paymentId: payment.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    return payment;
  }

  async markFailed(paymentId: string, reason: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED, failureReason: reason },
    });
    await this.prisma.referralReward.updateMany({
      where: { paymentId, consumedAt: null },
      data: { paymentId: null },
    });
    await this.notifications.enqueue(payment.userId, 'PAYMENT_FAILED');
    return payment;
  }

  async refund(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.externalPaymentId) {
      await this.selectProvider(payment.provider).refundPayment(payment.externalPaymentId);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.REFUNDED } });
      if (payment.subscriptionId) await tx.subscription.update({ where: { id: payment.subscriptionId }, data: { status: SubscriptionStatus.CANCELED, autoRenew: false, canceledAt: new Date() } });
      return updated;
    });
  }

  async cancelSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirstOrThrow({ where: { id: subscriptionId, userId } });
    if (subscription.provider && subscription.externalSubscriptionId) {
      const provider = this.selectProvider(subscription.provider);
      if (provider.cancelSubscription) await provider.cancelSubscription(subscription.externalSubscriptionId);
    }
    return this.subscriptions.cancelAutoRenew(subscription.id);
  }

  async getPayment(userId: string, paymentId: string) {
    let payment = await this.prisma.payment.findFirstOrThrow({
      where: { id: paymentId, userId },
      select: { id: true, provider: true, amountUsd: true, currency: true, status: true, failureReason: true, createdAt: true, updatedAt: true },
    });
    if (payment.status === PaymentStatus.PENDING) {
      const full = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (full.externalPaymentId) {
        const status = await this.selectProvider(full.provider).getPaymentStatus(full.externalPaymentId);
        if (status === 'SUCCEEDED') await this.confirmSucceeded(paymentId);
        else if (status === 'FAILED') await this.markFailed(paymentId, 'provider_reported_failed');
        payment = await this.prisma.payment.findUniqueOrThrow({
          where: { id: paymentId },
          select: { id: true, provider: true, amountUsd: true, currency: true, status: true, failureReason: true, createdAt: true, updatedAt: true },
        });
      }
    }
    return payment;
  }

  async processWebhook(provider: string, eventId: string, eventType: string, payload: Record<string, any>) {
    let inserted = await this.prisma.paymentWebhookEvent.create({ data: { provider, externalId: eventId, eventType, payload } }).catch(() => null);
    if (!inserted) {
      inserted = await this.prisma.paymentWebhookEvent.findUnique({ where: { provider_externalId: { provider, externalId: eventId } } });
      if (inserted?.processedAt) return { duplicate: true };
    }
    if (!inserted) return { duplicate: true };
    const externalSubscriptionId = payload.data?.subscription_id ? String(payload.data.subscription_id) : undefined;
    const knownSubscription = externalSubscriptionId
      ? await this.prisma.subscription.findUnique({ where: { externalSubscriptionId } })
      : null;
    if (eventType === 'subscription.canceled' && knownSubscription) {
      await this.subscriptions.cancelAutoRenew(knownSubscription.id);
      await this.prisma.paymentWebhookEvent.update({ where: { id: inserted.id }, data: { processedAt: new Date() } });
      return { received: true };
    }
    const externalPaymentId = String(payload.data?.id ?? payload.payment_id ?? '');
    const paymentId = payload.data?.custom_data?.paymentId ?? payload.order_id;
    const payment = paymentId
      ? await this.prisma.payment.findUnique({ where: { id: String(paymentId) } })
      : await this.prisma.payment.findFirst({ where: { provider, externalPaymentId } });
    const isPaddleRenewal = provider === 'paddle'
      && eventType === 'transaction.completed'
      && knownSubscription
      && (!payment || payment.externalPaymentId !== externalPaymentId);
    if (isPaddleRenewal && knownSubscription) {
      const renewalPayment = await this.prisma.payment.create({
        data: {
          userId: knownSubscription.userId,
          planId: knownSubscription.planId,
          subscriptionId: knownSubscription.id,
          provider,
          externalPaymentId,
          amountUsd: Number(payload.data?.details?.totals?.grand_total ?? 0) / 100,
          currency: String(payload.data?.currency_code ?? 'USD'),
          status: PaymentStatus.SUCCEEDED,
        },
      });
      await this.subscriptions.renew(knownSubscription.id);
      await this.prisma.paymentWebhookEvent.update({ where: { id: inserted.id }, data: { processedAt: new Date() } });
      return { received: true, paymentId: renewalPayment.id };
    }
    if (!payment) throw new NotFoundException('Payment not found');

    if (['transaction.completed', 'finished', 'confirmed'].includes(eventType)) {
      await this.confirmSucceeded(payment.id);
      if (payment.subscriptionId && externalSubscriptionId) {
        await this.prisma.subscription.update({ where: { id: payment.subscriptionId }, data: { provider, externalSubscriptionId, autoRenew: provider === 'paddle' } });
      }
    }
    else if (['transaction.payment_failed', 'failed', 'expired'].includes(eventType)) await this.markFailed(payment.id, eventType);
    else if (['adjustment.updated', 'refunded'].includes(eventType) && (payload.data?.status === 'approved' || eventType === 'refunded')) {
      await this.prisma.$transaction([
        this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REFUNDED } }),
        ...(payment.subscriptionId ? [this.prisma.subscription.update({ where: { id: payment.subscriptionId }, data: { status: SubscriptionStatus.CANCELED, autoRenew: false, canceledAt: new Date() } })] : []),
      ]);
    }

    await this.prisma.paymentWebhookEvent.update({ where: { id: inserted.id }, data: { processedAt: new Date() } });
    return { received: true };
  }
}
