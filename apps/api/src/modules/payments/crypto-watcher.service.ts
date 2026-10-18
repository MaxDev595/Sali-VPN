import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CryptoInvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';

const OFFICIAL_USDT_TON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
type Account = { address?: string };
type JettonOperation = {
  amount?: string;
  destination?: Account;
  jetton?: { address?: string };
  operation?: string;
  payload?: unknown;
  trace_id?: string;
  transaction_hash?: string;
  utime?: number;
};

@Injectable()
export class CryptoWatcherService {
  private readonly logger = new Logger(CryptoWatcherService.name);
  private running = false;
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService, private readonly payments: PaymentsService) {}

  @Cron('*/20 * * * * *')
  async reconcile() {
    if (this.running || this.config.get<string>('CRYPTO_WATCHER_ENABLED') !== 'true') return;
    const address = this.config.get<string>('CRYPTO_TON_RECEIVE_ADDRESS')?.trim();
    if (!address) return;
    this.running = true;
    try {
      await this.expireInvoices();
      await this.finishDetected();
      const master = this.config.get<string>('CRYPTO_USDT_TON_MASTER')?.trim() || OFFICIAL_USDT_TON_MASTER;
      const [recipientRaw, masterRaw, operations] = await Promise.all([
        this.normalizeAddress(address),
        this.normalizeAddress(master),
        this.fetchJettonOperations(address),
      ]);
      const open = await this.prisma.cryptoInvoice.findMany({ where: { network: 'TON', asset: 'USDT', status: CryptoInvoiceStatus.PENDING, expiresAt: { gt: new Date() } } });
      for (const invoice of open) {
        const match = this.findTransfer(operations, recipientRaw, masterRaw, invoice.expectedAtomic, invoice.reference, invoice.createdAt);
        if (!match) continue;
        const claimed = await this.prisma.cryptoInvoice.updateMany({ where: { id: invoice.id, status: CryptoInvoiceStatus.PENDING, txHash: null }, data: { status: CryptoInvoiceStatus.DETECTED, txHash: match.hash, detectedAt: match.detectedAt } });
        if (claimed.count === 1) await this.finishInvoice(invoice.id);
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    } finally {
      this.running = false;
    }
  }

  private findTransfer(operations: JettonOperation[], recipientRaw: string, masterRaw: string, amount: bigint, reference: string, createdAt: Date) {
    for (const operation of operations) {
      if (operation.operation !== 'transfer' || !operation.transaction_hash || !operation.utime || operation.utime * 1000 < createdAt.getTime() - 60_000) continue;
      if (operation.jetton?.address?.toLowerCase() !== masterRaw.toLowerCase()) continue;
      if (operation.destination?.address?.toLowerCase() !== recipientRaw.toLowerCase() || operation.amount !== amount.toString()) continue;
      if (this.extractComment(operation.payload) !== reference) continue;
      return { hash: operation.transaction_hash, detectedAt: new Date(operation.utime * 1000) };
    }
    return null;
  }

  private extractComment(payload: unknown): string {
    if (typeof payload === 'string') return payload.trim();
    if (!payload || typeof payload !== 'object') return '';
    const value = payload as Record<string, unknown>;
    for (const key of ['comment', 'text', 'value']) if (typeof value[key] === 'string') return value[key].trim();
    return '';
  }

  private async fetchJettonOperations(address: string): Promise<JettonOperation[]> {
    const response = await fetch(`${this.baseUrl()}/v2/accounts/${encodeURIComponent(address)}/jettons/history?limit=100`, { headers: this.tonApiHeaders() });
    if (!response.ok) throw new Error(`TonAPI request failed (${response.status})`);
    const body = (await response.json()) as { operations?: JettonOperation[] };
    if (!Array.isArray(body.operations)) throw new Error('Unexpected TonAPI response');
    return body.operations;
  }

  private async normalizeAddress(address: string): Promise<string> {
    const response = await fetch(`${this.baseUrl()}/v2/address/${encodeURIComponent(address)}/parse`, { headers: this.tonApiHeaders() });
    if (!response.ok) throw new Error(`TonAPI address validation failed (${response.status})`);
    const body = (await response.json()) as { raw_form?: string };
    if (!body.raw_form) throw new Error('TonAPI returned an invalid address');
    return body.raw_form;
  }

  private baseUrl() { return (this.config.get<string>('TONAPI_BASE_URL') ?? 'https://tonapi.io').replace(/\/$/, ''); }
  private tonApiHeaders(): Record<string, string> {
    const key = this.config.get<string>('TONAPI_API_KEY')?.trim();
    return key && /^[\x21-\x7e]+$/.test(key) ? { Authorization: `Bearer ${key}` } : {};
  }
  private async finishDetected() { const rows = await this.prisma.cryptoInvoice.findMany({ where: { status: CryptoInvoiceStatus.DETECTED } }); for (const row of rows) await this.finishInvoice(row.id); }
  private async finishInvoice(id: string) { const row = await this.prisma.cryptoInvoice.findUniqueOrThrow({ where: { id }, include: { payment: true } }); if (row.payment.status !== PaymentStatus.SUCCEEDED) await this.payments.confirmSucceeded(row.paymentId); await this.prisma.cryptoInvoice.update({ where: { id }, data: { status: CryptoInvoiceStatus.CONFIRMED, confirmedAt: new Date() } }); }
  private async expireInvoices() { const rows = await this.prisma.cryptoInvoice.findMany({ where: { status: CryptoInvoiceStatus.PENDING, expiresAt: { lte: new Date() } } }); for (const row of rows) { await this.prisma.cryptoInvoice.update({ where: { id: row.id }, data: { status: CryptoInvoiceStatus.EXPIRED } }); await this.payments.markFailed(row.paymentId, 'crypto_invoice_expired'); } }
}
