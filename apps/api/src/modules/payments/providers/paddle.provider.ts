import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatePaymentInput, CreatePaymentResult, PaymentProvider, PaymentStatusResult } from './payment-provider.interface';

@Injectable()
export class PaddlePaymentProvider implements PaymentProvider {
  readonly name = 'paddle';
  constructor(private readonly config: ConfigService) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const apiKey = this.config.get<string>('PADDLE_API_KEY');
    const priceId = this.config.get<string>(`PADDLE_PRICE_ID_${input.planId}`) ?? this.config.get<string>('PADDLE_PRICE_ID');
    if (!apiKey || !priceId) throw new Error('Paddle credentials or price ID are not configured');
    const checkoutUrl = this.config.get<string>('PADDLE_CHECKOUT_URL')?.trim();
    const response = await fetch(`${this.baseUrl(apiKey)}/transactions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        collection_mode: 'automatic',
        custom_data: input.metadata,
        ...(checkoutUrl ? { checkout: { url: checkoutUrl } } : {}),
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1_000);
      throw new Error(`Paddle transaction creation failed (${response.status}): ${detail}`);
    }
    const body = await response.json() as { data: { id: string; checkout?: { url?: string } } };
    return { externalPaymentId: body.data.id, checkoutUrl: body.data.checkout?.url, status: 'PENDING' };
  }
  async getPaymentStatus(externalPaymentId: string): Promise<PaymentStatusResult> {
    const apiKey = this.config.getOrThrow<string>('PADDLE_API_KEY');
    const response = await fetch(`${this.baseUrl(apiKey)}/transactions/${encodeURIComponent(externalPaymentId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) throw new Error(`Paddle transaction status failed (${response.status})`);
    const body = await response.json() as { data?: { status?: string } };
    if (body.data?.status === 'completed') return 'SUCCEEDED';
    if (['canceled', 'past_due'].includes(body.data?.status ?? '')) return 'FAILED';
    return 'PENDING';
  }
  async refundPayment(externalPaymentId: string): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('PADDLE_API_KEY');
    const response = await fetch(`${this.baseUrl(apiKey)}/adjustments`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refund', transaction_id: externalPaymentId, reason: 'customer_request' }),
    });
    if (!response.ok) throw new Error(`Paddle refund failed (${response.status})`);
  }
  async cancelSubscription(externalSubscriptionId: string): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('PADDLE_API_KEY');
    const response = await fetch(`${this.baseUrl(apiKey)}/subscriptions/${encodeURIComponent(externalSubscriptionId)}/cancel`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ effective_from: 'next_billing_period' }),
    });
    if (!response.ok) throw new Error(`Paddle cancellation failed (${response.status})`);
  }

  private baseUrl(apiKey: string) {
    return (this.config.get<string>('PADDLE_API_BASE_URL')
      ?? (apiKey.includes('_sdbx_') ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com')).replace(/\/$/, '');
  }
}
