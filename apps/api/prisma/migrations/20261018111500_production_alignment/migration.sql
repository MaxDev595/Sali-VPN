-- The production database predates Prisma Migrate tracking. Its original
-- schema matches the baseline migration, except for these later-added fields.
-- Keep every operation idempotent so this migration is safe on databases
-- that were previously synchronized with `prisma db push`.

ALTER TABLE "Trial"
  ADD COLUMN IF NOT EXISTS "bonusSeconds" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ReferralReward"
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "consumedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ReferralReward_userId_kind_consumedAt_idx"
  ON "ReferralReward"("userId", "kind", "consumedAt");

CREATE INDEX IF NOT EXISTS "ReferralReward_paymentId_idx"
  ON "ReferralReward"("paymentId");
