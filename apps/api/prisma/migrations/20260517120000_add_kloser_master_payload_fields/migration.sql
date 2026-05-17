ALTER TABLE "AutomationDispatch"
ADD COLUMN "masterPayload" JSONB,
ADD COLUMN "contextSnapshot" JSONB,
ADD COLUMN "compliancePolicy" JSONB,
ADD COLUMN "ctaPolicy" JSONB;
