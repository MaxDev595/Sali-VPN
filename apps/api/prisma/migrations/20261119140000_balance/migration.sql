-- Sali balance: top up with USDT, spend on tariffs, renew monthly. Never paid out.
ALTER TABLE "User" ADD COLUMN "balanceUsd" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "autoRenewPlanId" TEXT;
ALTER TABLE "User" ADD COLUMN "autoRenewNoticeAt" TIMESTAMP(3);
ALTER TABLE "User" ADD CONSTRAINT "User_balanceUsd_nonnegative" CHECK ("balanceUsd" >= 0);

CREATE TYPE "BalanceTxKind" AS ENUM ('TOPUP', 'PURCHASE', 'GIFT', 'AUTO_RENEW', 'REFUND', 'ADMIN');

CREATE TABLE "BalanceTx" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountUsd" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "kind" "BalanceTxKind" NOT NULL,
    "note" TEXT,
    "paymentId" TEXT,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BalanceTx_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BalanceTx_userId_createdAt_idx" ON "BalanceTx"("userId", "createdAt");

-- Hidden plan that top-up payments point to (Payment.planId is required).
INSERT INTO "Plan" ("id", "code", "name", "description", "durationDays", "priceUsd", "maxDevices", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'balance_topup', 'Пополнение баланса', NULL, 0, 0, 3, false, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
