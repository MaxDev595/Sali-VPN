import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatusResult,
} from './payment-provider.interface';

/**
 * Adapter for Telegram's native Payments (e.g. Telegram Stars). Requires a
 * provider token from @BotFather (TELEGRAM_PAYMENTS_PROVIDER_TOKEN). The
 * actual invoice is sent by the Bot (see apps/bot/src/services/payments.ts)
 * using this payload; final confirmation arrives via the bot's
 * `successful_payment` update, which the bot forwards to
 * POST /internal/payments/confirm on the API.
 */
@Injectable()
export class TelegramStarsPaymentProvider implements PaymentProvider {
  readonly name = 'telegram_stars';

  constructor(private readonly config: ConfigService) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerToken = this.config.get<string>('TELEGRAM_PAYMENTS_PROVIDER_TOKEN');
    if (!providerToken) {
      throw new Error(
        'TELEGRAM_PAYMENTS_PROVIDER_TOKEN is not set. Get one from @BotFather to enable Telegram payments.',
      );
    }

    const externalPaymentId = `tg_${randomUUID()}`;
    return {
      externalPaymentId,
      status: 'PENDING',
      telegramInvoicePayload: {
        payload: externalPaymentId,
        currency: 'USD',
        prices: [{ label: 'Sali Pro — 1 month', amount: Math.round(input.amountUsd * 100) }],
      },
    };
  }

  async getPaymentStatus(): Promise<PaymentStatusResult> {
    // Telegram payments are confirmed asynchronously via webhook
    // (successful_payment update) rather than polled — see payments.service.ts
    // confirmByExternalId(), called from the internal payments controller.
    return 'PENDING';
  }

  async refundPayment(): Promise<void> {
    throw new Error('Refunds for Telegram Stars must be issued via refundStarPayment Bot API method.');
  }
}
