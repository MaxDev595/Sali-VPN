-- Sali ID, store-app accounts and activation codes sold through the bot.

-- 1. Users: public Sali ID, optional Telegram identity, app installation key.
ALTER TABLE "User" ADD COLUMN "publicId" TEXT;
UPDATE "User" SET "publicId" = upper(substr(md5(random()::text || "id"), 1, 8)) WHERE "publicId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "publicId" SET NOT NULL;
CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");

ALTER TABLE "User" ALTER COLUMN "telegramId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "appDeviceKey" TEXT;
ALTER TABLE "User" ADD COLUMN "linkedTelegramId" BIGINT;
ALTER TABLE "User" ADD COLUMN "linkedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_appDeviceKey_key" ON "User"("appDeviceKey");
CREATE INDEX "User_linkedTelegramId_idx" ON "User"("linkedTelegramId");

-- 2. Payments made in the bot are delivered as a code.
ALTER TABLE "Payment" ADD COLUMN "deliverAsCode" BOOLEAN NOT NULL DEFAULT false;

-- 3. Activation codes.
CREATE TYPE "ActivationCodeKind" AS ENUM ('PAID', 'FREE', 'GIFT', 'PROMO');
CREATE TYPE "ActivationCodeStatus" AS ENUM ('ISSUED', 'REDEEMED', 'REVOKED');

CREATE TABLE "ActivationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ActivationCodeKind" NOT NULL,
    "status" "ActivationCodeStatus" NOT NULL DEFAULT 'ISSUED',
    "durationDays" INTEGER NOT NULL,
    "planId" TEXT,
    "ownerId" TEXT NOT NULL,
    "paymentId" TEXT,
    "redeemedById" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActivationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivationCode_code_key" ON "ActivationCode"("code");
CREATE UNIQUE INDEX "ActivationCode_paymentId_key" ON "ActivationCode"("paymentId");
CREATE INDEX "ActivationCode_ownerId_status_idx" ON "ActivationCode"("ownerId", "status");
CREATE INDEX "ActivationCode_redeemedById_idx" ON "ActivationCode"("redeemedById");

ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
