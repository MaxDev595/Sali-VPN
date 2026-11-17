-- App-only: gifts and promo codes bought / entered in the app.
ALTER TABLE "User" ADD COLUMN "idLockedAt" TIMESTAMP(3);
-- Accounts that already have an app keep the ID they have.
UPDATE "User" u SET "idLockedAt" = NOW()
WHERE u."telegramId" IS NOT NULL AND EXISTS (SELECT 1 FROM "User" d WHERE d."linkedTelegramId" = u."telegramId");
ALTER TABLE "Payment" ADD COLUMN "giftToUserId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "promoCodeId" TEXT;

CREATE TYPE "PromoKind" AS ENUM ('DAYS', 'DISCOUNT');

CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "PromoKind" NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoRedemption_promoId_accountId_key" ON "PromoRedemption"("promoId", "accountId");
CREATE INDEX "PromoRedemption_accountId_idx" ON "PromoRedemption"("accountId");
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
