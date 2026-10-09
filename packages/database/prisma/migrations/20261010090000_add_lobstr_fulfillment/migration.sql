-- Additive, backwards-compatible fulfillment state and durable outbox.
ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TABLE "LeadPurchase" ADD COLUMN "lobstrRunId" TEXT;
CREATE TABLE "LeadFulfillmentJob" (
 "id" TEXT NOT NULL, "purchaseId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED',
 "category" TEXT NOT NULL, "creditsHeld" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseToken" TEXT,
 "leaseUntil" TIMESTAMP(3), "failureCount" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LeadFulfillmentJob_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LeadFulfillmentRun" (
 "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "state" TEXT NOT NULL, "targetQuantity" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'QUEUED', "runId" TEXT, "resultPage" INTEGER NOT NULL DEFAULT 1,
 "resultOffset" INTEGER NOT NULL DEFAULT 0, "processedCount" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LeadFulfillmentRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LeadFulfillmentCandidate" (
 "jobId" TEXT NOT NULL, "agentId" TEXT NOT NULL, "verificationDone" BOOLEAN NOT NULL DEFAULT false,
 "verificationAttempts" INTEGER NOT NULL DEFAULT 0, "nextVerificationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LeadFulfillmentCandidate_pkey" PRIMARY KEY ("jobId", "agentId")
);
CREATE UNIQUE INDEX "LeadFulfillmentJob_purchaseId_key" ON "LeadFulfillmentJob"("purchaseId");
CREATE INDEX "LeadFulfillmentJob_status_nextAttemptAt_idx" ON "LeadFulfillmentJob"("status", "nextAttemptAt");
CREATE UNIQUE INDEX "LeadFulfillmentRun_runId_key" ON "LeadFulfillmentRun"("runId");
CREATE INDEX "LeadFulfillmentRun_jobId_status_idx" ON "LeadFulfillmentRun"("jobId", "status");
CREATE INDEX "LeadFulfillmentCandidate_agentId_idx" ON "LeadFulfillmentCandidate"("agentId");
ALTER TABLE "LeadFulfillmentJob" ADD CONSTRAINT "LeadFulfillmentJob_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "LeadPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadFulfillmentRun" ADD CONSTRAINT "LeadFulfillmentRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LeadFulfillmentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadFulfillmentCandidate" ADD CONSTRAINT "LeadFulfillmentCandidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LeadFulfillmentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadFulfillmentCandidate" ADD CONSTRAINT "LeadFulfillmentCandidate_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
