-- CreateTable
CREATE TABLE "StorageAddon" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "addonType" TEXT NOT NULL DEFAULT 'extended_retention',
    "status" TEXT NOT NULL DEFAULT 'active',
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "stripePriceId" TEXT,
    "stripeSubId" TEXT,
    "extraRetentionDays" INTEGER,
    "maxStorageGB" DECIMAL(10,2),
    "currentStorageGB" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "StorageAddon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageAddon_stripeSubId_key" ON "StorageAddon"("stripeSubId");

-- CreateIndex
CREATE INDEX "StorageAddon_userId_idx" ON "StorageAddon"("userId");

-- CreateIndex
CREATE INDEX "StorageAddon_status_idx" ON "StorageAddon"("status");

-- CreateIndex
CREATE INDEX "StorageAddon_periodEnd_idx" ON "StorageAddon"("periodEnd");

-- AddForeignKey
ALTER TABLE "StorageAddon" ADD CONSTRAINT "StorageAddon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
