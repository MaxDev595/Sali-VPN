/**
 * PaymentProvider abstracts the payment backend away from bot / subscription
 * logic, exactly like VPNProvider does for VPN technology. Adding Stripe,
 * Telegram Stars, or any other processor later means adding one adapter.
 */

export interface CreatePaymentInput {
  userId: string;
  planId: string;
  amountUsd: number;
  /** Used to redirect back into the bot/Mini App after payment where relevant */
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  externalPaymentId: string;
  /** Where/how the user completes payment. For Telegram-native flows this
   * may be an invoke payload rather than a URL — see each adapter. */
  checkoutUrl?: string;
  telegramInvoicePayload?: Record<string, unknown>;
  status: 'PENDING' | 'SUCCEEDED';
}

export type PaymentStatusResult = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(externalPaymentId: string): Promise<PaymentStatusResult>;
  refundPayment(externalPaymentId: string): Promise<void>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
