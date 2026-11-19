import { BadRequestException } from '@nestjs/common';
import { BalanceTxKind, Prisma } from '@prisma/client';

export const TOPUP_PLAN = 'balance_topup';
export const TOPUP_MIN_USD = 1;
export const TOPUP_MAX_USD = 500;

/** Cents, so money is never a float: 1.2 → "1.20". */
export const usd = (value: number | Prisma.Decimal | string) => Number(value).toFixed(2);

/**
 * Changes the balance and writes the ledger row, inside the caller's transaction.
 * A debit that would go below zero is refused (and the database CHECK refuses it too).
 */
export async function applyBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  delta: number,
  kind: BalanceTxKind,
  extra: { note?: string; paymentId?: string; planId?: string } = {},
) {
  const amount = usd(delta);
  const changed = await tx.$executeRaw`UPDATE "User" SET "balanceUsd" = "balanceUsd" + ${amount}::numeric, "updatedAt" = NOW() WHERE "id" = ${userId} AND "balanceUsd" + ${amount}::numeric >= 0`;
  if (changed !== 1) throw new BadRequestException('Недостаточно денег на балансе. Пополните баланс или оплатите переводом USDT');
  const { balanceUsd } = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balanceUsd: true } });
  return tx.balanceTx.create({ data: { userId, amountUsd: amount, balanceAfter: balanceUsd, kind, ...extra } });
}
