import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatusResult,
} from './payment-provider.interface';

/**
 * MVP placeholder provider. It does NOT move real money — it exists so the
 * full subscription flow (create payment → mark succeeded → activate
 * subscription) is wired end-to-end and testable before a real processor
 * (Stripe, Telegram Payments/Stars, a local PSP, etc.) is connected.
 *
 * To go live: implement `PaymentProvider` for your real processor (see the
 * interface in payment-provider.interface.ts), add its credentials to
 * .env.example, and switch PAYMENT_PROVIDER in .env. No other code changes.
 */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'manual';
  private statuses = new Map<string, PaymentStatusResult>();

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const externalPaymentId = `manual_${randomUUID()}`;
    // Marked PENDING until an admin (or a real webhook, once wired) confirms it.
    this.statuses.set(externalPaymentId, 'PENDING');
    return {
      externalPaymentId,
      status: 'PENDING',
      telegramInvoicePayload: { amountUsd: input.amountUsd, planId: input.planId },
    };
  }

  async getPaymentStatus(externalPaymentId: string): Promise<PaymentStatusResult> {
    return this.statuses.get(externalPaymentId) ?? 'PENDING';
  }

  async refundPayment(externalPaymentId: string): Promise<void> {
    this.statuses.set(externalPaymentId, 'REFUNDED');
  }

  /** Test/admin-only helper to simulate a successful payment confirmation. */
  markSucceeded(externalPaymentId: string) {
    this.statuses.set(externalPaymentId, 'SUCCEEDED');
  }
}
