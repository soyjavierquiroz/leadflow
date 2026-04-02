ALTER TABLE "Domain"
ADD COLUMN "linkedFunnelId" TEXT;

CREATE INDEX "Domain_teamId_linkedFunnelId_idx"
ON "Domain"("teamId", "linkedFunnelId");

ALTER TABLE "Domain"
ADD CONSTRAINT "Domain_linkedFunnelId_fkey"
FOREIGN KEY ("linkedFunnelId") REFERENCES "Funnel"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
