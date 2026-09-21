-- Cleanup: Delete all Agent records without verified emails
-- Before running, check count:
-- SELECT COUNT(*) FROM "Agent" WHERE "email" IS NULL OR "email" = '' OR "emailStatus" NOT IN ('validated', 'mx_verified');

-- Purge non-email records
DELETE FROM "Agent"
WHERE "email" IS NULL
   OR "email" = ''
   OR "emailStatus" NOT IN ('validated', 'mx_verified');

-- Verify remaining records all have valid emails and non-empty zip codes:
-- SELECT COUNT(*) as total_remaining FROM "Agent";
-- SELECT COUNT(*) FILTER (WHERE "email" IS NULL OR "email" = '') as no_email FROM "Agent";
-- SELECT COUNT(*) FILTER (WHERE "zipCode" IS NULL OR "zipCode" = '') as no_zip FROM "Agent";