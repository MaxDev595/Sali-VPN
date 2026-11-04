-- Sali node agents: per-server connection data for AmneziaWG/WireGuard nodes.
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "hostname" TEXT;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "agentUrl" TEXT;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "agentKeyEnc" TEXT;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "agentCertPem" TEXT;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "wgPublicKey" TEXT;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "awgPublicKey" TEXT;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "awgPort" INTEGER;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "awgParams" JSONB;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "online" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VpnServer" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "NodeEnrollToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "serverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NodeEnrollToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NodeEnrollToken_tokenHash_key" ON "NodeEnrollToken"("tokenHash");
