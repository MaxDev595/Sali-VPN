-- Update notes and news broadcast from the bot admin panel and shown in the apps.
CREATE TYPE "AnnouncementKind" AS ENUM ('UPDATE', 'NEWS');

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "kind" "AnnouncementKind" NOT NULL,
    "platform" TEXT,
    "version" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "showInApp" BOOLEAN NOT NULL DEFAULT true,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "finishedAt" TIMESTAMP(3),
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
