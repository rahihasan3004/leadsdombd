CREATE TABLE "OrderEmailNotification" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "firstAttemptAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "providerId" TEXT,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderEmailNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderEmailNotification_purchaseId_kind_key" ON "OrderEmailNotification"("purchaseId", "kind");
CREATE INDEX "OrderEmailNotification_status_nextAttemptAt_idx" ON "OrderEmailNotification"("status", "nextAttemptAt");
ALTER TABLE "OrderEmailNotification" ADD CONSTRAINT "OrderEmailNotification_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "LeadPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
