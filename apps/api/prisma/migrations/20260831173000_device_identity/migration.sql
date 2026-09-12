ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "deviceKey" TEXT;

UPDATE "Device"
SET "deviceKey" = "id"
WHERE "deviceKey" IS NULL;

ALTER TABLE "Device" ALTER COLUMN "deviceKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Device_userId_deviceKey_key" ON "Device"("userId", "deviceKey");
