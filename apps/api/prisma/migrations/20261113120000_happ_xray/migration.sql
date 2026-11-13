-- Xray VLESS + Reality on nodes, and Happ subscription links per Telegram account.
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "xrayPort" INTEGER;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "xrayPublicKey" TEXT;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "xrayShortId" TEXT;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "xraySni" TEXT;

CREATE TABLE IF NOT EXISTS "HappAccess" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "lastFetchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HappAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HappAccess_telegramId_key" ON "HappAccess"("telegramId");
CREATE UNIQUE INDEX IF NOT EXISTS "HappAccess_tokenHash_key" ON "HappAccess"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "HappAccess_uuid_key" ON "HappAccess"("uuid");
