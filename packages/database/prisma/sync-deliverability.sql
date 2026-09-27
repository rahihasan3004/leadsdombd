UPDATE "Agent"
SET "isDeliverable" = true
WHERE "email" IS NOT NULL
  AND "email" != ''
  AND id IN (SELECT "agentId" FROM "UnlockedLead")
  AND "isDeliverable" = false;
