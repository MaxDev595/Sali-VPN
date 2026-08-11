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

    const subscription = await this.prisma.subscription.create({
      data: { userId, planId, status: SubscriptionStatus.PENDING_PAYMENT },
    });

    const result = await this.provider.createPayment({
      userId,
      planId,
      amountUsd: Number(plan.priceUsd),
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId,
        subscriptionId: subscription.id,
        provider: this.provider.name,
        externalPaymentId: result.externalPaymentId,
        amountUsd: plan.priceUsd,
        status: result.status === 'SUCCEEDED' ? PaymentStatus.SUCCEEDED : PaymentStatus.PENDING,
      },
    });

    if (result.status === 'SUCCEEDED') {
      await this.confirmSucceeded(payment.id);
    }

    return { payment, subscription, checkout: result };
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

    return payment;
  }

  async markFailed(paymentId: string, reason: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED, failureReason: reason },
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
