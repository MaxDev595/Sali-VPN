import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './providers/payment-provider.interface';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Step 1: user taps "Buy subscription" — creates a PENDING payment + subscription. */
  async initiatePurchase(userId: string, planId: string) {
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
          provider: this.provider.name,
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
      result = await this.provider.createPayment({ userId, planId, amountUsd: reserved.amountUsd });
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

  private async confirmSucceeded(paymentId: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.SUCCEEDED },
      include: { plan: true },
    });

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
      await this.provider.refundPayment(payment.externalPaymentId);
    }
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED },
    });
  }
}
