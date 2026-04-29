CREATE TYPE "FunnelStructuralType" AS ENUM (
  'generic',
  'two_step_conversion',
  'multi_step_conversion'
);

ALTER TABLE "FunnelInstance"
ADD COLUMN "structuralType" "FunnelStructuralType" NOT NULL DEFAULT 'generic',
ADD COLUMN "conversionContract" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "FunnelInstance_teamId_structuralType_idx"
ON "FunnelInstance"("teamId", "structuralType");
