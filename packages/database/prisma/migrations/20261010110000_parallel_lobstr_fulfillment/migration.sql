ALTER TABLE "LeadFulfillmentJob" ADD COLUMN "parallelConfig" JSONB;
ALTER TABLE "LeadFulfillmentRun" ADD COLUMN "squidId" TEXT, ADD COLUMN "zipCode" TEXT,
 ADD COLUMN "backupDepth" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "backupOfId" TEXT, ADD COLUMN "newLeadCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "lastError" TEXT;
CREATE UNIQUE INDEX "LeadFulfillmentRun_backupOfId_key" ON "LeadFulfillmentRun"("backupOfId");
CREATE UNIQUE INDEX "LeadFulfillmentRun_jobId_zipCode_key" ON "LeadFulfillmentRun"("jobId", "zipCode");
CREATE TABLE "LobstrCapacityReservation" (
 "id" TEXT NOT NULL, "runRowId" TEXT NOT NULL, "estimatedCredits" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'RESERVED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LobstrCapacityReservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LobstrCapacityReservation_runRowId_key" ON "LobstrCapacityReservation"("runRowId");
CREATE INDEX "LobstrCapacityReservation_status_idx" ON "LobstrCapacityReservation"("status");
ALTER TABLE "LobstrCapacityReservation" ADD CONSTRAINT "LobstrCapacityReservation_runRowId_fkey"
 FOREIGN KEY ("runRowId") REFERENCES "LeadFulfillmentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Agent_normalized_email_ingest_idx" ON "Agent" (lower(trim("email")));
CREATE INDEX "Agent_normalized_phone_ingest_idx" ON "Agent" (right(regexp_replace(regexp_replace("phone", '[[:space:]]*(ext\.?|x|#).*$', '', 'i'), '[^0-9]', '', 'g'), 10));
CREATE INDEX "Agent_normalized_office_phone_ingest_idx" ON "Agent" (right(regexp_replace(regexp_replace("officePhone", '[[:space:]]*(ext\.?|x|#).*$', '', 'i'), '[^0-9]', '', 'g'), 10));
