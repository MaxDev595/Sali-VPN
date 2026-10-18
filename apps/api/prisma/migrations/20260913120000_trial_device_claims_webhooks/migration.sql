ALTER TABLE "Device" ADD COLUMN "revokedAt" TIMESTAMP(3);

ALTER TABLE "Subscription" ADD COLUMN "provider" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "externalSubscriptionId" TEXT;
CREATE UNIQUE INDEX "Subscription_externalSubscriptionId_key" ON "Subscription"("externalSubscriptionId");

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "externalId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3), "payload" JSONB NOT NULL,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_externalId_key"
  ON "PaymentWebhookEvent"("provider", "externalId");

CREATE TABLE "TrialDeviceClaim" (
  "id" TEXT NOT NULL,
  "deviceKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrialDeviceClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrialDeviceClaim_deviceKey_key" ON "TrialDeviceClaim"("deviceKey");
CREATE INDEX "TrialDeviceClaim_userId_idx" ON "TrialDeviceClaim"("userId");
