CREATE TYPE "CryptoInvoiceStatus" AS ENUM ('PENDING', 'DETECTED', 'CONFIRMED', 'EXPIRED');

CREATE TABLE "CryptoInvoice" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'TRON',
    "asset" TEXT NOT NULL DEFAULT 'USDT',
    "receiveAddress" TEXT NOT NULL,
    "expectedAtomic" BIGINT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 6,
    "status" "CryptoInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CryptoInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CryptoInvoice_paymentId_key" ON "CryptoInvoice"("paymentId");
CREATE UNIQUE INDEX "CryptoInvoice_txHash_key" ON "CryptoInvoice"("txHash");
CREATE UNIQUE INDEX "CryptoInvoice_network_receiveAddress_expectedAtomic_key" ON "CryptoInvoice"("network", "receiveAddress", "expectedAtomic");
CREATE INDEX "CryptoInvoice_status_expiresAt_idx" ON "CryptoInvoice"("status", "expiresAt");
ALTER TABLE "CryptoInvoice" ADD CONSTRAINT "CryptoInvoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
