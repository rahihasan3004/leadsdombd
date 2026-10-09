-- Preserve email access for all pre-existing purchases.
CREATE TYPE "LeadTier" AS ENUM ('PHONE_ONLY', 'VERIFIED_EMAIL');
ALTER TABLE "LeadPurchase" ADD COLUMN "tier" "LeadTier" NOT NULL DEFAULT 'VERIFIED_EMAIL';
