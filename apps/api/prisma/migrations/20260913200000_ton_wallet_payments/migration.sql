DROP INDEX IF EXISTS "CryptoInvoice_network_receiveAddress_expectedAtomic_key";
ALTER TABLE "CryptoInvoice" ADD COLUMN "reference" TEXT;
UPDATE "CryptoInvoice" SET "reference" = 'LEGACY-' || "id" WHERE "reference" IS NULL;
ALTER TABLE "CryptoInvoice" ALTER COLUMN "reference" SET NOT NULL;
CREATE UNIQUE INDEX "CryptoInvoice_reference_key" ON "CryptoInvoice"("reference");
