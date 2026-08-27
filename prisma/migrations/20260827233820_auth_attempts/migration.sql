-- CreateTable
CREATE TABLE "auth_attempts" (
    "identifier" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastFailAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("identifier")
);

-- CreateIndex
CREATE INDEX "auth_attempts_lockedUntil_idx" ON "auth_attempts"("lockedUntil");
