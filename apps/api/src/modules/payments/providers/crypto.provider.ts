import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentInput, CreatePaymentResult, PaymentProvider, PaymentStatusResult } from './payment-provider.interface';

/** Creates USDT (Jetton) invoices payable to a TON Space wallet. */
@Injectable()
export class CryptoPaymentProvider implements PaymentProvider {
  readonly name = 'crypto';
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const paymentId = input.metadata?.paymentId;
    const address = this.config.get<string>('CRYPTO_TON_RECEIVE_ADDRESS')?.trim();
    // A plan-specific override is useful when its USDT price differs from USD.
    // Otherwise charge the amount reserved by PaymentsService, including discounts.
    const configuredAmount = this.config.get<string>(`CRYPTO_USDT_TON_AMOUNT_${input.planId}`)
      ?? input.amountUsd.toFixed(2);
    if (!paymentId || !address) throw new ServiceUnavailableException('Оплата через Telegram Wallet пока не настроена');
    const amount = Number(configuredAmount);
    if (!Number.isFinite(amount) || amount <= 0) throw new ServiceUnavailableException('Некорректная стоимость в USDT');
    const expectedAtomic = parseAtomic(configuredAmount, 6);
    const reference = `SALI-${randomBytes(6).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + Number(this.config.get('CRYPTO_INVOICE_TTL_MINUTES') ?? 30) * 60_000);
    const invoice = await this.prisma.cryptoInvoice.create({ data: { paymentId, network: 'TON', asset: 'USDT', receiveAddress: address, expectedAtomic, decimals: 6, reference, expiresAt } });
    const master = this.config.get<string>('CRYPTO_USDT_TON_MASTER')?.trim() || 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
    const paymentUrl = `ton://transfer/${encodeURIComponent(address)}?jetton=${encodeURIComponent(master)}&amount=${expectedAtomic.toString()}&text=${encodeURIComponent(reference)}&exp=${Math.floor(expiresAt.getTime() / 1000)}`;
    return { externalPaymentId: invoice.id, status: 'PENDING', cryptoInvoice: { network: 'TON', asset: 'USDT', address, amount: formatAtomic(expectedAtomic, 6), expiresAt: expiresAt.toISOString(), reference, paymentUrl } };
  }

  async getPaymentStatus(externalPaymentId: string): Promise<PaymentStatusResult> {
    const invoice = await this.prisma.cryptoInvoice.findUnique({ where: { id: externalPaymentId }, include: { payment: true } });
    return invoice?.payment.status ?? 'FAILED';
  }
  async refundPayment(): Promise<void> { throw new Error('Crypto refunds require a destination wallet and manual approval'); }
}

function parseAtomic(value: string, decimals: number) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) throw new ServiceUnavailableException('Некорректная стоимость в USDT');
  const [whole, fraction = ''] = value.trim().split('.');
  if (fraction.length > decimals) throw new ServiceUnavailableException(`USDT поддерживает не более ${decimals} знаков после запятой`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'));
}

function formatAtomic(value: bigint, decimals: number) {
  const raw = value.toString().padStart(decimals + 1, '0');
  const fraction = raw.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${raw.slice(0, -decimals)}.${fraction}` : raw.slice(0, -decimals);
}
