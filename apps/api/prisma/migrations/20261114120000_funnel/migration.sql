-- Funnel report (where a customer came from, when they opened the Happ page) and Happ on the free 24 hours.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "HappAccess" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");
ALTER TABLE "HappAccess" ADD COLUMN IF NOT EXISTS "paid" BOOLEAN NOT NULL DEFAULT true;
