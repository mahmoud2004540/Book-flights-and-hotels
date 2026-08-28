-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "notifications_type_createdAt_idx" ON "notifications"("type", "createdAt");
